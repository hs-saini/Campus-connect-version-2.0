const { createHash, randomBytes } = require("node:crypto");
const { initialize } = require("../lib/database");
const {
  clearSessionCookie,
  hashPassword,
  requestSession,
  setSessionCookie,
  verifyPassword
} = require("../lib/auth");

const categories = ["Technology", "Cultural", "Sports", "Workshop", "Hackathon", "Prize", "Social"];
const MAX_PROOF_LENGTH = 700_000;

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function respond(response, status, value) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(value));
}

function getBody(request) {
  const contentLength = Number(request.headers["content-length"] || 0);
  if (contentLength > 1_000_000) throw new HttpError(413, "Request is too large.");
  if (request.body && typeof request.body === "object") return request.body;
  if (typeof request.body === "string") {
    try { return JSON.parse(request.body); } catch { throw new HttpError(400, "Invalid JSON request."); }
  }
  return {};
}

function text(value, label, max = 200) {
  if (typeof value !== "string") throw new HttpError(400, `${label} is required.`);
  const result = value.trim();
  if (!result || result.length > max) throw new HttpError(400, `${label} is required and must be under ${max} characters.`);
  return result;
}

function normalizeEmail(value) {
  const email = text(value, "Email", 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, "Enter a valid email address.");
  return email;
}

function normalizeRoll(value) {
  return text(value, "Roll number", 50).toUpperCase();
}

function validatePassword(value) {
  if (typeof value !== "string" || value.length < 10 || value.length > 128) {
    throw new HttpError(400, "Password must be between 10 and 128 characters.");
  }
  return value;
}

function uniqueError(error, emailLabel = "Email", rollLabel = "Roll number") {
  if (error?.code !== "23505") return null;
  if (error.constraint?.includes("email")) return new HttpError(409, `${emailLabel} already has an account.`);
  if (error.constraint?.includes("roll")) return new HttpError(409, `${rollLabel} already has a Student ID.`);
  if (error.constraint?.includes("event_student")) return new HttpError(409, "You are already registered for this event.");
  if (error.constraint?.includes("admin_id")) return new HttpError(409, "That Admin ID is already in use.");
  return new HttpError(409, "This account or record already exists.");
}

function cookieOriginCheck(request) {
  const origin = request.headers.origin;
  if (!origin) return;
  let originHost;
  try { originHost = new URL(origin).host; } catch { throw new HttpError(403, "Invalid request origin."); }
  const host = request.headers.host;
  if (host && originHost !== host) throw new HttpError(403, "Cross-origin requests are not allowed.");
}

function clientIp(request) {
  const value = request.headers["x-real-ip"] || request.headers["x-forwarded-for"] || "unknown";
  return String(value).split(",")[0].trim().slice(0, 100);
}

async function limitAttempts(sql, request, identity, maxAttempts) {
  const key = createHash("sha256")
    .update(`${clientIp(request)}:${identity.toLowerCase()}`)
    .digest("hex");
  const rows = await sql`
    INSERT INTO login_rate_limits (bucket, window_started, attempts)
    VALUES (${key}, NOW(), 1)
    ON CONFLICT (bucket) DO UPDATE SET
      attempts = CASE
        WHEN login_rate_limits.window_started < NOW() - INTERVAL '15 minutes' THEN 1
        ELSE login_rate_limits.attempts + 1
      END,
      window_started = CASE
        WHEN login_rate_limits.window_started < NOW() - INTERVAL '15 minutes' THEN NOW()
        ELSE login_rate_limits.window_started
      END
    RETURNING attempts`;
  if (Number(rows[0].attempts) > maxAttempts) {
    throw new HttpError(429, "Too many attempts. Wait 15 minutes and try again.");
  }
}

function toStudent(row) {
  return {
    id:row.student_code,
    name:row.name,
    roll:row.roll_number,
    email:row.email,
    phone:row.phone
  };
}

function toEvent(row) {
  return {
    id:row.id,
    title:row.title,
    template:row.template,
    category:row.category,
    ownerCategory:row.owner_category,
    ownerAdminId:row.owner_admin_id,
    college:row.college,
    date:String(row.event_date).slice(0, 10),
    time:row.event_time,
    venue:row.venue,
    contact:row.contact,
    email:row.email,
    description:row.description,
    fee:Number(row.fee),
    qr:row.qr
  };
}

function toRegistration(row) {
  return {
    eventId:row.event_id,
    eventTitle:row.event_title,
    studentId:row.student_code,
    name:row.name,
    roll:row.roll_number,
    email:row.email,
    phone:row.phone,
    payment:row.payment,
    proof:Boolean(row.has_proof ?? row.proof),
    passToken:row.pass_token,
    entered:row.entered,
    entryTime:row.entry_time,
    status:row.status
  };
}

async function requireStudent(request, sql) {
  const session = requestSession(request, "student");
  if (!session) throw new HttpError(401, "Please log in to continue.");
  const rows = await sql`SELECT * FROM students WHERE id = ${session.sub}`;
  if (!rows.length) throw new HttpError(401, "Student account was not found. Please log in again.");
  return rows[0];
}

async function requireAdmin(request, sql) {
  const session = requestSession(request, "admin");
  if (!session) throw new HttpError(401, "Please log in to the admin portal.");
  if (session.sub === "master" && session.role === "admin") {
    return {
      role:"master",
      id:"master",
      name:"Master Administrator",
      admin_id:process.env.MASTER_ADMIN_USERNAME || ""
    };
  }
  const rows = await sql`
    SELECT id, name, admin_id, category, status
    FROM admin_accounts WHERE id = ${session.sub}`;
  if (!rows.length || rows[0].status !== "approved") {
    throw new HttpError(401, "Admin access is no longer active. Please log in again.");
  }
  return { ...rows[0], role:"category" };
}

function adminEventAllowed(admin, event) {
  return admin.role === "master" || event.owner_category === admin.category;
}

function eventInput(input, admin) {
  const template = text(input.template || input.category, "Category", 30);
  if (!categories.includes(template)) throw new HttpError(400, "Choose a valid event category.");
  const fee = Number(input.fee);
  if (!Number.isFinite(fee) || fee < 0 || fee > 1_000_000) throw new HttpError(400, "Enter a valid event fee.");
  const qr = typeof input.qr === "string" ? input.qr : "";
  if (qr.length > MAX_PROOF_LENGTH) throw new HttpError(413, "Payment QR must be smaller than 700 KB.");
  if (fee > 0 && !qr) throw new HttpError(400, "Add a payment QR for paid events.");
  const date = text(input.date, "Event date", 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, "Enter a valid event date.");
  return {
    title:text(input.title, "Event title"),
    template,
    category:template,
    ownerCategory:admin.role === "master" ? template : admin.category,
    ownerAdminId:admin.admin_id,
    college:text(input.college, "College"),
    date,
    time:text(input.time, "Event time", 10),
    venue:text(input.venue, "Venue"),
    contact:text(input.contact, "Contact", 50),
    email:normalizeEmail(input.email),
    description:text(input.description, "Description", 2000),
    fee,
    qr:fee > 0 ? qr : ""
  };
}

async function handleStudentSignup(request, response, sql) {
  const input = getBody(request);
  const name = text(input.name, "Full name", 100);
  const roll = text(input.roll, "Roll number", 50);
  const rollNormalized = normalizeRoll(roll);
  const email = normalizeEmail(input.email);
  const phone = text(input.phone, "Mobile number", 20);
  if (!/^\+?[0-9]{10,15}$/.test(phone)) throw new HttpError(400, "Enter a valid mobile number.");
  const password = validatePassword(input.password);
  await limitAttempts(sql, request, `signup:${email}`, 8);
  const passwordHash = await hashPassword(password);
  try {
    const sequence = await sql`SELECT nextval('campus_student_code_seq') AS value`;
    const studentCode = `CC-${String(sequence[0].value).padStart(8, "0")}`;
    const rows = await sql`
      INSERT INTO students (student_code, name, roll_number, roll_normalized, email, email_normalized, phone, password_hash)
      VALUES (${studentCode}, ${name}, ${roll}, ${rollNormalized}, ${email}, ${email}, ${phone}, ${passwordHash})
      RETURNING id, student_code, name, roll_number, email, phone`;
    setSessionCookie(response, request, "student", rows[0].id);
    respond(response, 201, { student:toStudent(rows[0]) });
  } catch (error) {
    const conflict = uniqueError(error);
    if (conflict) throw conflict;
    throw error;
  }
}

async function handleStudentLogin(request, response, sql) {
  const input = getBody(request);
  const email = normalizeEmail(input.email);
  if (typeof input.password !== "string" || !input.password) throw new HttpError(400, "Password is required.");
  await limitAttempts(sql, request, `student:${email}`, 10);
  const rows = await sql`SELECT * FROM students WHERE email_normalized = ${email}`;
  if (!rows.length || !(await verifyPassword(input.password, rows[0].password_hash))) {
    throw new HttpError(401, "Email or password is incorrect.");
  }
  setSessionCookie(response, request, "student", rows[0].id);
  respond(response, 200, { student:toStudent(rows[0]) });
}

async function handleStudentProfile(request, response, sql, student) {
  const input = getBody(request);
  const name = text(input.name, "Full name", 100);
  const roll = text(input.roll, "Roll number", 50);
  const rollNormalized = normalizeRoll(roll);
  const email = normalizeEmail(input.email);
  const phone = text(input.phone, "Mobile number", 20);
  if (!/^\+?[0-9]{10,15}$/.test(phone)) throw new HttpError(400, "Enter a valid mobile number.");
  try {
    const rows = await sql`
      UPDATE students
      SET name=${name}, roll_number=${roll}, roll_normalized=${rollNormalized},
          email=${email}, email_normalized=${email}, phone=${phone}
      WHERE id=${student.id}
      RETURNING id, student_code, name, roll_number, email, phone`;
    respond(response, 200, { student:toStudent(rows[0]) });
  } catch (error) {
    const conflict = uniqueError(error);
    if (conflict) throw conflict;
    throw error;
  }
}

async function handleAdminLogin(request, response, sql) {
  const input = getBody(request);
  const username = text(input.username, "Admin username", 100);
  if (typeof input.password !== "string" || !input.password) throw new HttpError(400, "Password is required.");
  await limitAttempts(sql, request, `admin:${username}`, 8);
  const masterUsername = process.env.MASTER_ADMIN_USERNAME;
  const masterHash = process.env.MASTER_ADMIN_PASSWORD_HASH;
  if (masterUsername && masterHash && username.toLowerCase() === masterUsername.toLowerCase()) {
    if (!(await verifyPassword(input.password, masterHash))) throw new HttpError(401, "Username or password is incorrect.");
    setSessionCookie(response, request, "admin", "master");
    respond(response, 200, { admin:{ role:"master", name:"Master Administrator", adminId:masterUsername, category:"All" } });
    return;
  }
  const rows = await sql`
    SELECT id, name, admin_id, category, status, password_hash
    FROM admin_accounts WHERE admin_id_normalized = ${username.toLowerCase()}`;
  if (!rows.length || rows[0].status !== "approved" || !(await verifyPassword(input.password, rows[0].password_hash))) {
    throw new HttpError(401, "Username or password is incorrect, or the account is not approved.");
  }
  setSessionCookie(response, request, "admin", rows[0].id);
  respond(response, 200, { admin:{ role:"category", name:rows[0].name, adminId:rows[0].admin_id, category:rows[0].category } });
}

async function handleAdminApplication(request, sql) {
  const input = getBody(request);
  const name = text(input.name, "Full name", 100);
  const adminId = text(input.adminId, "Admin ID", 50);
  const email = normalizeEmail(input.email);
  const phone = text(input.phone, "Mobile number", 20);
  const category = text(input.category, "Category", 30);
  if (!categories.includes(category)) throw new HttpError(400, "Choose a valid admin category.");
  const passwordHash = await hashPassword(validatePassword(input.password));
  try {
    await sql`
      INSERT INTO admin_accounts
        (name, email, email_normalized, admin_id, admin_id_normalized, password_hash, category, phone, status)
      VALUES
        (${name}, ${email}, ${email}, ${adminId}, ${adminId.toLowerCase()}, ${passwordHash}, ${category}, ${phone}, 'pending')`;
  } catch (error) {
    const conflict = uniqueError(error);
    if (conflict) throw conflict;
    throw error;
  }
}

async function handleRegistration(request, sql, student) {
  const input = getBody(request);
  const eventId = text(input.eventId, "Event", 100);
  const events = await sql`SELECT id, title, fee FROM events WHERE id=${eventId}`;
  if (!events.length) throw new HttpError(404, "Event was not found.");
  const event = events[0];
  const fee = Number(event.fee);
  const proof = typeof input.proof === "string" ? input.proof : "";
  if (proof.length > MAX_PROOF_LENGTH) throw new HttpError(413, "Payment proof must be smaller than about 500 KB.");
  if (proof && !/^data:(image\/(?:png|jpeg|gif|webp)|application\/pdf);base64,[A-Za-z0-9+/]+={0,2}$/.test(proof)) {
    throw new HttpError(400, "Payment proof must be a PNG, JPEG, GIF, WebP, or PDF file.");
  }
  if (fee > 0 && !proof) throw new HttpError(400, "Upload payment proof before submitting.");
  const passToken = `CCPASS-${event.id}-${student.student_code}-${randomBytes(12).toString("hex").toUpperCase()}`;
  try {
    const rows = await sql`
      INSERT INTO registrations
        (event_id, event_title, student_pk, student_code, name, roll_number, email, phone, payment, proof, pass_token, status)
      VALUES
        (${event.id}, ${event.title}, ${student.id}, ${student.student_code}, ${student.name},
         ${student.roll_number}, ${student.email}, ${student.phone},
         ${fee > 0 ? `₹${fee} · Pending verification` : "Free"}, ${proof}, ${passToken},
         ${fee > 0 ? "Payment Submitted" : "Confirmed"})
      ON CONFLICT (event_id, student_pk) DO NOTHING
      RETURNING event_id, event_title, student_code, name, roll_number, email, phone, payment,
        (proof <> '') AS has_proof, pass_token, entered, entry_time, status`;
    if (!rows.length) throw new HttpError(409, "You are already registered for this event.");
    return toRegistration(rows[0]);
  } catch (error) {
    const conflict = uniqueError(error);
    if (conflict) throw conflict;
    throw error;
  }
}

async function handleAdminData(response, sql, admin) {
  const eventRows = admin.role === "master"
    ? await sql`SELECT * FROM events ORDER BY event_date, event_time`
    : await sql`SELECT * FROM events WHERE owner_category=${admin.category} ORDER BY event_date, event_time`;
  const events = eventRows.map(toEvent);
  const registrations = admin.role === "master"
    ? await sql`
      SELECT id, event_id, event_title, student_pk, student_code, name, roll_number, email, phone,
        payment, (proof <> '') AS has_proof, pass_token, entered, entry_time, status, created_at
      FROM registrations ORDER BY created_at DESC`
    : await sql`
      SELECT r.id, r.event_id, r.event_title, r.student_pk, r.student_code, r.name, r.roll_number,
        r.email, r.phone, r.payment, (r.proof <> '') AS has_proof, r.pass_token, r.entered,
        r.entry_time, r.status, r.created_at
      FROM registrations r
      INNER JOIN events e ON e.id=r.event_id
      WHERE e.owner_category=${admin.category}
      ORDER BY r.created_at DESC`;
  let accounts = [];
  if (admin.role === "master") {
    accounts = await sql`
      SELECT name, email, admin_id, category, status, requested_at
      FROM admin_accounts ORDER BY requested_at DESC`;
    accounts = accounts.map((account) => ({
      name:account.name,
      email:account.email,
      adminId:account.admin_id,
      category:account.category,
      status:account.status,
      requestedAt:account.requested_at
    }));
  }
  respond(response, 200, { events, registrations:registrations.map(toRegistration), accounts });
}

async function route(request, response) {
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (request.method === "OPTIONS") {
    response.statusCode = 204;
    response.end();
    return;
  }
  if (["POST", "PATCH", "PUT", "DELETE"].includes(request.method)) cookieOriginCheck(request);

  const pathname = new URL(request.url, `https://${request.headers.host || "localhost"}`).pathname;
  const path = pathname.replace(/^\/api\/?/, "").split("/").filter(Boolean).map(decodeURIComponent);
  const key = path.join("/");
  const method = request.method;
  if (method === "POST" && key === "student/logout") {
    clearSessionCookie(response, request, "student");
    respond(response, 200, { ok:true });
    return;
  }
  if (method === "POST" && key === "admin/logout") {
    clearSessionCookie(response, request, "admin");
    respond(response, 200, { ok:true });
    return;
  }
  const sql = await initialize();

  if (key === "events" && method === "GET") {
    const rows = await sql`SELECT * FROM events ORDER BY event_date, event_time`;
    respond(response, 200, { events:rows.map(toEvent) });
    return;
  }
  if (key === "student/signup" && method === "POST") return handleStudentSignup(request, response, sql);
  if (key === "student/login" && method === "POST") return handleStudentLogin(request, response, sql);
  if (key === "student/me" && method === "GET") {
    const student = await requireStudent(request, sql);
    respond(response, 200, { student:toStudent(student) });
    return;
  }
  if (key === "student/me" && method === "PATCH") {
    const student = await requireStudent(request, sql);
    return handleStudentProfile(request, response, sql, student);
  }
  if (key === "registrations/me" && method === "GET") {
    const student = await requireStudent(request, sql);
    const rows = await sql`
      SELECT id, event_id, event_title, student_pk, student_code, name, roll_number, email, phone,
        payment, (proof <> '') AS has_proof, pass_token, entered, entry_time, status, created_at
      FROM registrations WHERE student_pk=${student.id} ORDER BY created_at DESC`;
    respond(response, 200, { registrations:rows.map(toRegistration) });
    return;
  }
  if (key === "registrations" && method === "POST") {
    const student = await requireStudent(request, sql);
    const registration = await handleRegistration(request, sql, student);
    respond(response, 201, { registration });
    return;
  }
  if (key === "admin/login" && method === "POST") return handleAdminLogin(request, response, sql);
  if (key === "admin/me" && method === "GET") {
    const admin = await requireAdmin(request, sql);
    respond(response, 200, { admin:{ role:admin.role, name:admin.name, adminId:admin.admin_id, category:admin.category || "All" } });
    return;
  }
  if (key === "admin/apply" && method === "POST") {
    await handleAdminApplication(request, sql);
    respond(response, 201, { ok:true });
    return;
  }
  if (key === "admin/data" && method === "GET") {
    const admin = await requireAdmin(request, sql);
    return handleAdminData(response, sql, admin);
  }
  if (path[0] === "admin" && path[1] === "proofs" && path.length === 3 && method === "GET") {
    const admin = await requireAdmin(request, sql);
    const rows = await sql`
      SELECT r.proof, e.owner_category
      FROM registrations r LEFT JOIN events e ON e.id=r.event_id
      WHERE r.pass_token=${path[2]}`;
    if (!rows.length || !rows[0].proof) throw new HttpError(404, "Payment proof was not found.");
    if (admin.role !== "master" && rows[0].owner_category !== admin.category) {
      throw new HttpError(403, "You cannot view this payment proof.");
    }
    const match = /^data:(image\/(?:png|jpeg|gif|webp)|application\/pdf);base64,([A-Za-z0-9+/]+={0,2})$/.exec(rows[0].proof);
    if (!match) throw new HttpError(415, "This payment proof format is not supported.");
    response.statusCode = 200;
    response.setHeader("Content-Type", match[1]);
    response.setHeader("Content-Disposition", "attachment; filename=\"payment-proof\"");
    response.end(Buffer.from(match[2], "base64"));
    return;
  }
  if (key === "admin/events" && method === "POST") {
    const admin = await requireAdmin(request, sql);
    const data = eventInput(getBody(request), admin);
    const id = `event-${randomBytes(12).toString("hex")}`;
    const rows = await sql`
      INSERT INTO events
        (id, title, template, category, owner_category, owner_admin_id, college, event_date, event_time, venue, contact, email, description, fee, qr)
      VALUES
        (${id}, ${data.title}, ${data.template}, ${data.category}, ${data.ownerCategory}, ${data.ownerAdminId},
         ${data.college}, ${data.date}, ${data.time}, ${data.venue}, ${data.contact}, ${data.email},
         ${data.description}, ${data.fee}, ${data.qr})
      RETURNING *`;
    respond(response, 201, { event:toEvent(rows[0]) });
    return;
  }
  if (key.startsWith("admin/events/") && method === "PATCH") {
    const admin = await requireAdmin(request, sql);
    const id = path[2];
    const rows = await sql`SELECT * FROM events WHERE id=${id}`;
    if (!rows.length) throw new HttpError(404, "Event was not found.");
    if (!adminEventAllowed(admin, rows[0])) throw new HttpError(403, "You cannot manage this event.");
    const data = eventInput(getBody(request), admin);
    const updated = await sql`
      UPDATE events SET title=${data.title}, template=${data.template}, category=${data.category},
        owner_category=${data.ownerCategory}, college=${data.college}, event_date=${data.date},
        event_time=${data.time}, venue=${data.venue}, contact=${data.contact}, email=${data.email},
        description=${data.description}, fee=${data.fee}, qr=${data.qr}
      WHERE id=${id} RETURNING *`;
    respond(response, 200, { event:toEvent(updated[0]) });
    return;
  }
  if (key.startsWith("admin/events/") && method === "DELETE") {
    const admin = await requireAdmin(request, sql);
    const id = path[2];
    const rows = await sql`SELECT * FROM events WHERE id=${id}`;
    if (!rows.length) throw new HttpError(404, "Event was not found.");
    if (!adminEventAllowed(admin, rows[0])) throw new HttpError(403, "You cannot delete this event.");
    await sql`DELETE FROM events WHERE id=${id}`;
    respond(response, 200, { ok:true });
    return;
  }
  if (key === "admin/applications" && method === "PATCH") {
    const admin = await requireAdmin(request, sql);
    if (admin.role !== "master") throw new HttpError(403, "Only the master admin can manage applications.");
    const input = getBody(request);
    const adminId = text(input.adminId, "Admin ID", 50);
    const action = input.action;
    const status = action === "approve" ? "approved" : action === "reject" ? "rejected" : action === "remove" ? "removed" : "";
    if (!status) throw new HttpError(400, "Choose a valid application action.");
    const rows = await sql`
      UPDATE admin_accounts SET status=${status}
      WHERE admin_id=${adminId} RETURNING admin_id`;
    if (!rows.length) throw new HttpError(404, "Admin application was not found.");
    respond(response, 200, { ok:true });
    return;
  }
  if (key.startsWith("admin/registrations/") && method === "POST") {
    const admin = await requireAdmin(request, sql);
    const action = path[2];
    const input = getBody(request);
    const passToken = text(input.passToken, "Pass token", 300);
    const rows = await sql`
      SELECT r.*, e.owner_category
      FROM registrations r LEFT JOIN events e ON e.id=r.event_id
      WHERE r.pass_token=${passToken}`;
    if (!rows.length) throw new HttpError(404, "Registration was not found.");
    const registration = rows[0];
    if (admin.role !== "master" && registration.owner_category !== admin.category) {
      throw new HttpError(403, "You cannot manage this event registration.");
    }
    if (action === "approve") {
      const updated = await sql`
        UPDATE registrations
        SET status='Payment Verified', payment=REPLACE(payment, 'Pending verification', 'Approved')
        WHERE pass_token=${passToken} AND status='Payment Submitted'
        RETURNING *`;
      if (!updated.length) throw new HttpError(409, "This payment is not awaiting verification.");
      respond(response, 200, { registration:toRegistration(updated[0]) });
      return;
    }
    if (action === "verify") {
      if (!["Confirmed", "Payment Verified"].includes(registration.status)) {
        throw new HttpError(409, "Entry denied: registration or payment is not confirmed.");
      }
      const updated = await sql`
        UPDATE registrations SET entered=TRUE, entry_time=NOW()
        WHERE pass_token=${passToken} AND entered=FALSE
        RETURNING *`;
      if (!updated.length) throw new HttpError(409, "Duplicate entry denied: this pass was already used.");
      respond(response, 200, { registration:toRegistration(updated[0]) });
      return;
    }
  }
  throw new HttpError(404, "API route was not found.");
}

module.exports = async function handler(request, response) {
  try {
    await route(request, response);
  } catch (error) {
    const safeError = error instanceof HttpError ? error : null;
    if (!safeError) console.error("API request failed:", error);
    if (!response.headersSent) {
      respond(response, safeError?.status || 500, {
        error:safeError?.message || "A server error occurred. Please try again."
      });
    } else {
      response.end();
    }
  }
};
