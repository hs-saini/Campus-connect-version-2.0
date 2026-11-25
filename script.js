const artwork = { Technology:"💻", Cultural:"🎵", Sports:"🏆", Workshop:"🛠️", Social:"📚", Hackathon:"⌨️", Prize:"🏅" };
let events = [];
let registrations = [];
let student = null;
let selectedEventId = "";
let toastTimer;

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function api(path, options = {}) {
  const request = { method:options.method || "GET", credentials:"same-origin", headers:{} };
  if (options.body !== undefined) {
    request.headers["Content-Type"] = "application/json";
    request.body = JSON.stringify(options.body);
  }
  let response;
  try {
    response = await fetch(`/api/${path}`, request);
  } catch {
    throw new Error("Cannot reach the CampusConnect server. Check your connection and try again.");
  }
  let result;
  try { result = await response.json(); } catch { result = {}; }
  if (!response.ok) throw new ApiError(response.status, result.error || "The request could not be completed.");
  return result;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function formatDate(value) {
  return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "";
}
function formatTime(value) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
}
function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    if (file.size > 500_000) return reject(new Error("Choose a file smaller than 500 KB."));
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });
}
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
function closeModal(id) { document.querySelector(`#${id}`).hidden = true; }

function renderStudent() {
  const detailsCard = document.querySelector("#studentDetailsCard");
  const emptyDetails = document.querySelector("#studentDetailsEmpty");
  const editButton = document.querySelector("#editStudentDetails");
  const logoutButton = document.querySelector("#studentLogout");
  if (!student) {
    document.querySelector("#profileName").textContent = "Student Log In";
    document.querySelector("#profileId").textContent = "Access your Student ID";
    document.querySelector("#profileAvatar").textContent = "S";
    detailsCard.hidden = true;
    emptyDetails.hidden = false;
    editButton.hidden = true;
    logoutButton.hidden = true;
    return;
  }
  document.querySelector("#profileName").textContent = student.name;
  document.querySelector("#profileId").textContent = `${student.roll} · ${student.id}`;
  document.querySelector("#profileAvatar").textContent = student.name.charAt(0).toUpperCase();
  document.querySelector("#detailsId").textContent = student.id;
  document.querySelector("#detailsName").textContent = student.name;
  document.querySelector("#detailsRoll").textContent = student.roll;
  document.querySelector("#detailsEmail").textContent = student.email;
  document.querySelector("#detailsPhone").textContent = student.phone;
  detailsCard.hidden = false;
  emptyDetails.hidden = true;
  editButton.hidden = false;
  logoutButton.hidden = false;
}

function card(event) {
  const category = event.category || event.template || "Technology";
  const fee = Number(event.fee || 0);
  return `<article class="eventcard"><div class="eventart eventart-${escapeHtml(category.toLowerCase())}"><span class="eventart-label">${escapeHtml(category)}</span><span class="eventart-icon">${artwork[category] || "✨"}</span></div><div class="eventcontent"><div class="eventtop"><span class="category">${escapeHtml(category)}</span><span class="eventdate">${formatDate(event.date)}</span></div><h3>${escapeHtml(event.title)}</h3><p class="eventdescription">${escapeHtml(event.description)}</p><p class="eventdetails">🕒 ${escapeHtml(formatTime(event.time))}<br>📍 ${escapeHtml(event.venue)}</p><p class="eventcontact">☎ ${escapeHtml(event.contact)} · ${escapeHtml(event.email)}</p><span class="fee-tag ${fee ? "paid" : ""}">${fee ? `₹${fee} · Paid` : "Free Entry"}</span><button class="btn" data-register="${escapeHtml(event.id)}">${fee ? "Pay & Register" : "Register for event"}</button></div></article>`;
}

function renderEvents() {
  const term = document.querySelector("#search").value.trim().toLowerCase();
  const category = document.querySelector("#filter").value;
  const filtered = events.filter((event) => {
    const text = [event.title, event.category, event.template, event.venue, event.description, event.contact].join(" ").toLowerCase();
    return text.includes(term) && (category === "all" || (event.category || event.template) === category);
  });
  document.querySelector("#allEvents").innerHTML = filtered.length ? filtered.map(card).join("") : '<p class="empty">No events available.</p>';
  document.querySelector("#featured").innerHTML = events.slice(0, 3).map(card).join("");
  document.querySelector("#statEvents").textContent = events.length;
}

function renderRegistrations() {
  document.querySelector("#myRows").innerHTML = registrations.map((item) => {
    const event = events.find((entry) => entry.id === item.eventId);
    const passReady = ["Confirmed", "Payment Verified"].includes(item.status);
    return `<tr><td>${escapeHtml(item.eventTitle)}</td><td>${escapeHtml(event ? formatDate(event.date) : "")}</td><td>${escapeHtml(event?.venue || "")}</td><td>${escapeHtml(item.payment)}</td><td class="status">${escapeHtml(item.status)}</td><td>${passReady ? `<button class="table-action pass-action" data-pass="${escapeHtml(item.passToken)}">View / Download</button>` : "-"}</td></tr>`;
  }).join("");
  document.querySelector("#myEmpty").hidden = registrations.length > 0;
  document.querySelector("#statMine").textContent = registrations.length;
  document.querySelector("#statPasses").textContent = registrations.filter((item) => ["Confirmed", "Payment Verified"].includes(item.status)).length;
}

function refresh() {
  renderStudent();
  renderEvents();
  renderRegistrations();
}

async function loadSharedData() {
  const [eventResult, studentResult] = await Promise.all([
    api("events"),
    api("student/me").catch((error) => {
      if (error.status === 401) return { student:null };
      throw error;
    })
  ]);
  events = eventResult.events;
  student = studentResult.student;
  registrations = student ? (await api("registrations/me")).registrations : [];
  refresh();
}

function setStudentAuthMode(mode) {
  const login = mode === "login";
  document.querySelector("#studentForm").hidden = login;
  document.querySelector("#studentLoginForm").hidden = !login;
  document.querySelector("#studentSignupTab").classList.toggle("active", !login);
  document.querySelector("#studentLoginTab").classList.toggle("active", login);
  document.querySelector("#studentModalTitle").textContent = login ? "Log In to Student Account" : "Create Student Account";
  document.querySelector("#studentModalHint").textContent = login
    ? "Log in with the same college email and password on every device."
    : "Your email and roll number can each be used for only one Student ID.";
}

function openStudentModal() {
  if (student) {
    document.querySelector("#studentAuthTabs").hidden = true;
    document.querySelector("#studentLoginForm").hidden = true;
    document.querySelector("#studentForm").hidden = false;
    document.querySelector("#studentPasswordRow").hidden = true;
    document.querySelector("#studentPassword").required = false;
    document.querySelector("#studentModalTitle").textContent = "Edit Student Details";
    document.querySelector("#studentModalHint").textContent = "Your Student ID stays the same when you update your details.";
    document.querySelector("#studentName").value = student.name;
    document.querySelector("#studentRoll").value = student.roll;
    document.querySelector("#studentEmail").value = student.email;
    document.querySelector("#studentPhone").value = student.phone;
    document.querySelector("#saveStudentDetails").textContent = "Save Changes";
  } else {
    document.querySelector("#studentAuthTabs").hidden = false;
    document.querySelector("#studentPasswordRow").hidden = false;
    document.querySelector("#studentPassword").required = true;
    document.querySelector("#studentForm").reset();
    document.querySelector("#studentLoginForm").reset();
    document.querySelector("#saveStudentDetails").textContent = "Create Student ID";
    setStudentAuthMode("signup");
  }
  document.querySelector("#studentModal").hidden = false;
}

function showView(view) {
  document.querySelectorAll(".view").forEach((section) => { section.hidden = section.id !== view; });
  document.querySelectorAll(".navitem").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelector("#crumb").textContent = ({ dashboard:"Dashboard", events:"Browse Events", registrations:"My Registrations", profile:"My Details" })[view];
}

function openRegistration(eventId) {
  const event = events.find((item) => item.id === eventId);
  if (!event) return;
  if (!student) {
    openStudentModal();
    setStudentAuthMode("login");
    showToast("Log in or create a student account before registering.");
    return;
  }
  if (registrations.some((item) => item.eventId === eventId)) {
    showToast("You are already registered for this event.");
    return;
  }
  selectedEventId = eventId;
  document.querySelector("#modalEvent").innerHTML = `<strong>${escapeHtml(event.title)}</strong><br>${formatDate(event.date)} · ${formatTime(event.time)} · ${escapeHtml(event.venue)}<br>Coordinator: ${escapeHtml(event.contact)} · ${escapeHtml(event.email)}`;
  document.querySelector("#regName").value = student.name;
  document.querySelector("#regRoll").value = student.roll;
  document.querySelector("#regEmail").value = student.email;
  document.querySelector("#regPhone").value = student.phone;
  const paid = Number(event.fee) > 0;
  document.querySelector("#paymentSection").hidden = !paid;
  document.querySelector("#paymentProof").required = paid;
  document.querySelector("#paymentAmount").textContent = paid ? `Amount: ₹${event.fee}` : "";
  const qr = document.querySelector("#paymentQr");
  qr.innerHTML = event.qr
    ? (event.qr.startsWith("data:image") ? `<img src="${escapeHtml(event.qr)}" alt="Payment QR">` : `<a href="${escapeHtml(event.qr)}" target="_blank" rel="noopener">Open Payment QR</a>`)
    : "Payment QR not available";
  document.querySelector("#registerModal").hidden = false;
}

function openEntryPass(token) {
  const registration = registrations.find((item) => item.passToken === token);
  if (!registration) return;
  if (!["Confirmed", "Payment Verified"].includes(registration.status)) {
    showToast("Pass will be available after confirmation.");
    return;
  }
  const event = events.find((item) => item.id === registration.eventId);
  document.querySelector("#passEventName").textContent = registration.eventTitle;
  document.querySelector("#passCollege").textContent = event?.college || "CampusConnect College";
  document.querySelector("#passStudent").textContent = registration.name;
  document.querySelector("#passRoll").textContent = `${registration.roll} · ${registration.studentId}`;
  document.querySelector("#passSchedule").textContent = event ? `${formatDate(event.date)} · ${formatTime(event.time)}` : "";
  document.querySelector("#passVenue").textContent = event?.venue || "";
  document.querySelector("#passToken").textContent = registration.passToken;
  const qr = document.querySelector("#passQr");
  qr.innerHTML = "";
  if (window.QRCode) new QRCode(qr, { text:registration.passToken, width:180, height:180, correctLevel:QRCode.CorrectLevel.H });
  const mail = document.querySelector("#emailPass");
  mail.href = `mailto:${registration.email}?subject=${encodeURIComponent(`Entry Pass - ${registration.eventTitle}`)}&body=${encodeURIComponent(`Pass ID: ${registration.passToken}\nEvent: ${registration.eventTitle}\nStudent: ${registration.name}\nRoll: ${registration.roll}`)}`;
  document.querySelector("#passModal").hidden = false;
}

document.querySelector("#openStudentId").addEventListener("click", () => {
  if (student) showView("profile");
  else openStudentModal();
});
document.querySelector("#editStudentDetails").addEventListener("click", openStudentModal);
document.querySelector("#createStudentIdFromDetails").addEventListener("click", openStudentModal);
document.querySelector("#studentSignupTab").addEventListener("click", () => setStudentAuthMode("signup"));
document.querySelector("#studentLoginTab").addEventListener("click", () => setStudentAuthMode("login"));
document.querySelector("#cancelStudentId").addEventListener("click", () => closeModal("studentModal"));
document.querySelector("#cancelStudentLogin").addEventListener("click", () => closeModal("studentModal"));
document.querySelector("#cancelRegistration").addEventListener("click", () => closeModal("registerModal"));
document.querySelector("#closePass").addEventListener("click", () => closeModal("passModal"));
document.querySelector("#studentLogout").addEventListener("click", async () => {
  try {
    await api("student/logout", { method:"POST", body:{} });
    student = null;
    registrations = [];
    refresh();
    showView("dashboard");
    showToast("You are logged out.");
  } catch (error) {
    showToast(error.message);
  }
});
document.querySelector("#search").addEventListener("input", renderEvents);
document.querySelector("#filter").addEventListener("change", renderEvents);
document.querySelectorAll(".navitem").forEach((button) => button.addEventListener("click", () => showView(button.dataset.view)));
document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => document.querySelector(`.navitem[data-view="${button.dataset.openView}"]`).click()));
document.querySelectorAll(".eventgrid").forEach((grid) => grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-register]");
  if (button) openRegistration(button.dataset.register);
}));
document.querySelector("#myRows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-pass]");
  if (button) openEntryPass(button.dataset.pass);
});

document.querySelector("#studentForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const existing = student;
  const body = {
    name:document.querySelector("#studentName").value.trim(),
    roll:document.querySelector("#studentRoll").value.trim(),
    email:document.querySelector("#studentEmail").value.trim(),
    phone:document.querySelector("#studentPhone").value.trim()
  };
  if (!existing) body.password = document.querySelector("#studentPassword").value;
  const button = document.querySelector("#saveStudentDetails");
  button.disabled = true;
  try {
    const result = await api(existing ? "student/me" : "student/signup", { method:existing ? "PATCH" : "POST", body });
    student = result.student;
    registrations = (await api("registrations/me")).registrations;
    closeModal("studentModal");
    refresh();
    showView("profile");
    showToast(existing ? "Student details updated." : `Student ID created: ${student.id}`);
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#studentLoginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const button = event.submitter;
  if (button) button.disabled = true;
  try {
    const result = await api("student/login", {
      method:"POST",
      body:{
        email:document.querySelector("#studentLoginEmail").value.trim(),
        password:document.querySelector("#studentLoginPassword").value
      }
    });
    student = result.student;
    registrations = (await api("registrations/me")).registrations;
    closeModal("studentModal");
    refresh();
    showView("profile");
    showToast(`Welcome back, ${student.name}.`);
  } catch (error) {
    showToast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

document.querySelector("#regform").addEventListener("submit", async (submitEvent) => {
  submitEvent.preventDefault();
  if (!student || !selectedEventId) return;
  const button = submitEvent.submitter;
  if (button) button.disabled = true;
  try {
    const proof = await readFile(document.querySelector("#paymentProof").files[0]);
    const result = await api("registrations", { method:"POST", body:{ eventId:selectedEventId, proof } });
    registrations.unshift(result.registration);
    closeModal("registerModal");
    refresh();
    if (result.registration.status === "Confirmed") openEntryPass(result.registration.passToken);
    else showToast("Payment proof submitted. Wait for admin approval.");
  } catch (error) {
    showToast(error.message);
  } finally {
    if (button) button.disabled = false;
  }
});

document.querySelector("#downloadPass").addEventListener("click", () => {
  const canvas = document.createElement("canvas");
  canvas.width = 760;
  canvas.height = 980;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f6f2"; ctx.fillRect(0, 0, 760, 980);
  ctx.fillStyle = "#24233a"; ctx.fillRect(0, 0, 760, 110);
  ctx.fillStyle = "#fff"; ctx.font = "bold 34px Arial"; ctx.fillText("CampusConnect", 45, 68);
  ctx.fillStyle = "#24233a"; ctx.font = "bold 38px Arial"; ctx.fillText(document.querySelector("#passEventName").textContent, 45, 175);
  ctx.fillStyle = "#6654d9"; ctx.font = "22px Arial"; ctx.fillText(document.querySelector("#passCollege").textContent, 45, 210);
  ctx.fillStyle = "#24233a";
  const details = [["Student", "#passStudent"], ["Roll / ID", "#passRoll"], ["Date & Time", "#passSchedule"], ["Venue", "#passVenue"]];
  details.forEach(([label, selector], index) => {
    const y = 290 + index * 105;
    ctx.font = "bold 18px Arial"; ctx.fillText(label, 45, y);
    ctx.font = "26px Arial"; ctx.fillText(document.querySelector(selector).textContent, 45, y + 38);
  });
  const qrCanvas = document.querySelector("#passQr canvas");
  if (qrCanvas) ctx.drawImage(qrCanvas, 510, 700, 180, 180);
  ctx.font = "16px Arial"; ctx.fillStyle = "#777789"; ctx.fillText(document.querySelector("#passToken").textContent, 45, 760);
  const link = document.createElement("a");
  link.download = `entry-pass-${document.querySelector("#passRoll").textContent.split(" ")[0]}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

loadSharedData().catch((error) => {
  console.error(error);
  showToast(`CampusConnect could not load: ${error.message}`);
});
