const EVENT_KEY = "college-event-list";
const REG_KEY = "college-event-registrations";
const STUDENT_KEY = "college-event-student-id";
const STUDENTS_KEY = "college-event-students";
const ACTIVE_STUDENT_KEY = "college-event-active-student";
const artwork = { Technology:"💻", Cultural:"🎵", Sports:"🏆", Workshop:"🛠️", Social:"📚", Hackathon:"⌨️", Prize:"🏅" };
let selectedEventId = "";
let toastTimer;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function readEvents() {
  try {
    const value = JSON.parse(localStorage.getItem(EVENT_KEY));
    if (Array.isArray(value) && value.length) return value;
  } catch (error) { console.error(error); }
  const defaults = [
    { id:"tech-fest", title:"Annual Tech Fest", template:"Technology", category:"Technology", college:"CampusConnect College", date:"2026-12-05", time:"10:00", venue:"Main Auditorium", contact:"9876543210", email:"techfest@college.edu", description:"Coding challenges, project displays and technology talks.", fee:0, qr:"" },
    { id:"music-evening", title:"Music Evening", template:"Cultural", category:"Cultural", college:"CampusConnect College", date:"2026-12-12", time:"18:00", venue:"Open-Air Stage", contact:"9876543211", email:"culture@college.edu", description:"Live performances by students.", fee:0, qr:"" },
    { id:"sports-day", title:"College Sports Day", template:"Sports", category:"Sports", college:"CampusConnect College", date:"2026-12-18", time:"09:00", venue:"College Ground", contact:"9876543212", email:"sports@college.edu", description:"Track events, games and friendly matches.", fee:0, qr:"" }
  ];
  localStorage.setItem(EVENT_KEY, JSON.stringify(defaults));
  return defaults;
}
function readRegs() {
  try { const value = JSON.parse(localStorage.getItem(REG_KEY)); if (Array.isArray(value)) return value; } catch (error) { console.error(error); }
  return [];
}
function saveRegs(value) { localStorage.setItem(REG_KEY, JSON.stringify(value)); }
function readStudents() {
  try {
    const value = JSON.parse(localStorage.getItem(STUDENTS_KEY));
    if (Array.isArray(value)) return value;
  } catch (error) { console.error(error); }
  return [];
}
function saveStudents(value) {
  try {
    localStorage.setItem(STUDENTS_KEY, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(error);
    showToast("Could not save your account in this browser.");
    return false;
  }
}
function normalizeEmail(value) { return String(value || "").trim().toLowerCase(); }
function normalizeRoll(value) { return String(value || "").trim().toUpperCase(); }
function setActiveStudent(email) {
  try {
    localStorage.setItem(ACTIVE_STUDENT_KEY, normalizeEmail(email));
    return true;
  } catch (error) {
    console.error(error);
    showToast("Could not save your login in this browser.");
    return false;
  }
}
function readStudent() {
  const students = readStudents();
  let activeEmail = "";
  try { activeEmail = localStorage.getItem(ACTIVE_STUDENT_KEY) || ""; } catch (error) { console.error(error); }
  if (activeEmail) return students.find((student) => normalizeEmail(student.email) === normalizeEmail(activeEmail)) || null;

  try {
    const legacy = JSON.parse(localStorage.getItem(STUDENT_KEY));
    if (!legacy?.id || !legacy?.email || !legacy?.roll) return null;
    const byEmail = students.find((student) => normalizeEmail(student.email) === normalizeEmail(legacy.email));
    if (byEmail) {
      setActiveStudent(byEmail.email);
      localStorage.removeItem(STUDENT_KEY);
      return byEmail;
    }
    if (students.some((student) => normalizeRoll(student.roll) === normalizeRoll(legacy.roll))) return null;
    const migrated = { ...legacy, passwordSalt:"", passwordHash:"" };
    if (!saveStudents([...students, migrated]) || !setActiveStudent(migrated.email)) return null;
    localStorage.removeItem(STUDENT_KEY);
    return migrated;
  } catch (error) {
    console.error(error);
    return null;
  }
}
function createStudentId(students) {
  const existingIds = new Set(students.map((student) => student.id));
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const id = `CC-${String(Math.floor(10000000 + Math.random() * 90000000))}`;
    if (!existingIds.has(id)) return id;
  }
  throw new Error("Could not create a unique Student ID. Please try again.");
}
function toHex(bytes) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
function fromHex(value) { return new Uint8Array(value.match(/.{2}/g).map((part) => parseInt(part, 16))); }
async function hashPassword(password, salt) {
  if (!window.crypto?.subtle) throw new Error("Secure password hashing is unavailable in this browser. Open the site using HTTPS or localhost.");
  const saltBytes = salt ? Uint8Array.from(atob(salt), (character) => character.charCodeAt(0)) : window.crypto.getRandomValues(new Uint8Array(16));
  const key = await window.crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await window.crypto.subtle.deriveBits({ name:"PBKDF2", salt:saltBytes, iterations:120000, hash:"SHA-256" }, key, 256);
  return {
    passwordSalt: btoa(String.fromCharCode(...saltBytes)),
    passwordHash: toHex(new Uint8Array(bits))
  };
}
function passwordsMatch(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}
function formatDate(value) { return value ? new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : ""; }
function formatTime(value) {
  if (!value) return "";
  const [h, m] = value.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString("en-IN", { hour:"2-digit", minute:"2-digit" });
}
function readFile(file) {
  return new Promise((resolve) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => resolve("");
    reader.readAsDataURL(file);
  });
}
function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function closeModal(id) { document.querySelector(`#${id}`).hidden = true; }

function renderStudent() {
  const student = readStudent();
  const detailsCard = document.querySelector("#studentDetailsCard");
  const emptyDetails = document.querySelector("#studentDetailsEmpty");
  const editButton = document.querySelector("#editStudentDetails");
  const passwordButton = document.querySelector("#setStudentPassword");
  const logoutButton = document.querySelector("#studentLogout");
  if (!student) {
    document.querySelector("#profileName").textContent = "Student Login / Sign up";
    document.querySelector("#profileId").textContent = "This browser only";
    document.querySelector("#profileAvatar").textContent = "S";
    detailsCard.hidden = true;
    emptyDetails.hidden = false;
    editButton.hidden = true;
    passwordButton.hidden = true;
    logoutButton.hidden = true;
  } else {
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
    passwordButton.hidden = Boolean(student.passwordHash);
    logoutButton.hidden = false;
  }
}

function card(event) {
  const category = event.category || event.template || "Technology";
  const fee = Number(event.fee || 0);
  return `<article class="eventcard"><div class="eventart eventart-${category.toLowerCase()}"><span class="eventart-label">${escapeHtml(category)}</span><span class="eventart-icon">${artwork[category] || "✨"}</span></div><div class="eventcontent"><div class="eventtop"><span class="category">${escapeHtml(category)}</span><span class="eventdate">${formatDate(event.date)}</span></div><h3>${escapeHtml(event.title)}</h3><p class="eventdescription">${escapeHtml(event.description)}</p><p class="eventdetails">🕒 ${escapeHtml(formatTime(event.time))}<br>📍 ${escapeHtml(event.venue)}</p><p class="eventcontact">☎ ${escapeHtml(event.contact)} · ${escapeHtml(event.email)}</p><span class="fee-tag ${fee ? "paid" : ""}">${fee ? `₹${fee} · Paid` : "Free Entry"}</span><button class="btn" data-register="${escapeHtml(event.id)}">${fee ? "Pay & Register" : "Register for event"}</button></div></article>`;
}

function renderEvents() {
  const events = readEvents();
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

function myRegistrations() {
  const student = readStudent();
  if (!student) return [];
  return readRegs().filter((item) => item.studentId === student.id || (!item.studentId && item.roll.toLowerCase() === student.roll.toLowerCase()));
}

function renderRegistrations() {
  const list = myRegistrations();
  document.querySelector("#myRows").innerHTML = list.map((item) => {
    const event = readEvents().find((event) => event.id === item.eventId);
    const passReady = ["Confirmed", "Payment Verified"].includes(item.status);
    return `<tr><td>${escapeHtml(item.eventTitle)}</td><td>${escapeHtml(event ? formatDate(event.date) : "")}</td><td>${escapeHtml(event?.venue || "")}</td><td>${escapeHtml(item.payment)}</td><td class="status">${escapeHtml(item.status)}</td><td>${passReady ? `<button class="table-action pass-action" data-pass="${escapeHtml(item.passToken)}">View / Download</button>` : "-"}</td></tr>`;
  }).join("");
  document.querySelector("#myEmpty").hidden = list.length > 0;
  document.querySelector("#statMine").textContent = list.length;
  document.querySelector("#statPasses").textContent = list.filter((item) => ["Confirmed", "Payment Verified"].includes(item.status)).length;
}

function refresh() { renderStudent(); renderEvents(); renderRegistrations(); }

function setStudentModalMode(mode) {
  const tabs = document.querySelector("#studentAuthTabs");
  const loginForm = document.querySelector("#loginForm");
  const signupForm = document.querySelector("#signupForm");
  const editForm = document.querySelector("#studentForm");
  const passwordForm = document.querySelector("#passwordSetupForm");
  tabs.hidden = mode === "edit" || mode === "password";
  loginForm.hidden = mode !== "login";
  signupForm.hidden = mode !== "signup";
  editForm.hidden = mode !== "edit";
  passwordForm.hidden = mode !== "password";
  document.querySelectorAll("[data-student-mode]").forEach((button) => {
    button.classList.toggle("active", button.dataset.studentMode === mode);
  });
  const title = { login:"Student Login", signup:"Create Student Account", edit:"Edit Student Details", password:"Set Login Password" }[mode];
  const hint = {
    login:"Log in to use your saved Student ID on this browser.",
    signup:"Your account and Student ID are saved in this browser only.",
    edit:"Update the details saved to your Student ID.",
    password:"Set a password for the saved student account on this browser."
  }[mode];
  document.querySelector("#studentModalTitle").textContent = title;
  document.querySelector("#studentModalHint").textContent = hint;
}

function openStudentModal(mode) {
  const existing = readStudent();
  const activeMode = mode || (existing ? "edit" : "login");
  setStudentModalMode(activeMode);
  if (activeMode === "edit" && existing) {
    document.querySelector("#editStudentName").value = existing.name;
    document.querySelector("#editStudentRoll").value = existing.roll;
    document.querySelector("#editStudentEmail").value = existing.email;
    document.querySelector("#editStudentPhone").value = existing.phone;
  } else if (activeMode === "signup") {
    document.querySelector("#signupForm").reset();
  } else if (activeMode === "login") {
    document.querySelector("#loginForm").reset();
  } else if (activeMode === "password") {
    document.querySelector("#passwordSetupForm").reset();
  }
  document.querySelector("#studentModal").hidden = false;
}

function showView(view) {
  document.querySelectorAll(".view").forEach((section) => { section.hidden = section.id !== view; });
  document.querySelectorAll(".navitem").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  document.querySelector("#crumb").textContent = ({ dashboard:"Dashboard", events:"Browse Events", registrations:"My Registrations", profile:"My Details" })[view];
}

function openRegistration(eventId) {
  const event = readEvents().find((item) => item.id === eventId);
  const student = readStudent();
  if (!student) {
    openStudentModal();
    showToast("Create your Student ID first.");
    return;
  }
  if (readRegs().some((item) => item.eventId === eventId && item.roll.toLowerCase() === student.roll.toLowerCase())) {
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
    ? (event.qr.startsWith("data:image") ? `<img src="${escapeHtml(event.qr)}" alt="Payment QR">` : `<a href="${escapeHtml(event.qr)}" target="_blank">Open Payment QR</a>`)
    : "Payment QR not available";
  document.querySelector("#registerModal").hidden = false;
}

function openEntryPass(token) {
  const registration = readRegs().find((item) => item.passToken === token);
  if (!registration) return;
  if (!["Confirmed", "Payment Verified"].includes(registration.status)) {
    showToast("Pass will be available after confirmation.");
    return;
  }
  const event = readEvents().find((item) => item.id === registration.eventId);
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
  if (readStudent()) showView("profile");
  else openStudentModal("login");
});
document.querySelector("#editStudentDetails").addEventListener("click", () => openStudentModal("edit"));
document.querySelector("#setStudentPassword").addEventListener("click", () => openStudentModal("password"));
document.querySelector("#studentLogout").addEventListener("click", () => {
  localStorage.removeItem(ACTIVE_STUDENT_KEY);
  refresh();
  showView("dashboard");
  showToast("Logged out. Your account is saved only in this browser.");
});
document.querySelector("#createStudentIdFromDetails").addEventListener("click", () => openStudentModal("login"));
document.querySelector("#cancelStudentId").addEventListener("click", () => closeModal("studentModal"));
document.querySelector("#cancelRegistration").addEventListener("click", () => closeModal("registerModal"));
document.querySelector("#closePass").addEventListener("click", () => closeModal("passModal"));
document.querySelectorAll("[data-student-mode]").forEach((button) => button.addEventListener("click", () => setStudentModalMode(button.dataset.studentMode)));
document.querySelector("#search").addEventListener("input", renderEvents);
document.querySelector("#filter").addEventListener("change", renderEvents);
document.querySelectorAll(".navitem").forEach((button) => button.addEventListener("click", () => {
  showView(button.dataset.view);
}));
document.querySelectorAll("[data-open-view]").forEach((button) => button.addEventListener("click", () => document.querySelector(`.navitem[data-view="${button.dataset.openView}"]`).click()));
document.querySelectorAll(".eventgrid").forEach((grid) => grid.addEventListener("click", (event) => {
  const button = event.target.closest("[data-register]");
  if (button) openRegistration(button.dataset.register);
}));
document.querySelector("#myRows").addEventListener("click", (event) => {
  const button = event.target.closest("[data-pass]");
  if (button) openEntryPass(button.dataset.pass);
});

document.querySelector("#signupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = document.querySelector("#studentName").value.trim();
  const roll = document.querySelector("#studentRoll").value.trim();
  const email = normalizeEmail(document.querySelector("#studentEmail").value);
  const phone = document.querySelector("#studentPhone").value.trim();
  const password = document.querySelector("#signupPassword").value;
  if (password !== document.querySelector("#confirmPassword").value) {
    showToast("Passwords do not match.");
    return;
  }
  const students = readStudents();
  const emailAccount = students.find((student) => normalizeEmail(student.email) === email);
  const rollAccount = students.find((student) => normalizeRoll(student.roll) === normalizeRoll(roll));
  const upgradingLegacyAccount = emailAccount && rollAccount === emailAccount && !emailAccount.passwordHash;
  if ((emailAccount || rollAccount) && !upgradingLegacyAccount) {
    showToast(emailAccount ? "This email already has a Student ID. Log in instead." : "This roll number already has a Student ID.");
    return;
  }
  try {
    const credentials = await hashPassword(password);
    const student = {
      id:upgradingLegacyAccount ? emailAccount.id : createStudentId(students),
      name, roll, email, phone,
      ...credentials
    };
    const updatedStudents = upgradingLegacyAccount
      ? students.map((item) => item === emailAccount ? student : item)
      : [...students, student];
    if (!saveStudents(updatedStudents) || !setActiveStudent(student.email)) return;
    closeModal("studentModal");
    refresh();
    showView("profile");
    showToast(upgradingLegacyAccount ? `Login enabled. Your Student ID is still ${student.id}.` : `Account created. Your Student ID is ${student.id}.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not create your account.");
  }
});

document.querySelector("#loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const email = normalizeEmail(document.querySelector("#loginEmail").value);
  const password = document.querySelector("#loginPassword").value;
  const student = readStudents().find((item) => normalizeEmail(item.email) === email);
  if (!student) {
    showToast("No account found for this email in this browser.");
    return;
  }
  if (!student.passwordHash) {
    if (!setActiveStudent(student.email)) return;
    refresh();
    closeModal("studentModal");
    showView("profile");
    openStudentModal("password");
    showToast("Set a login password to protect this saved profile.");
    return;
  }
  try {
    const credentials = await hashPassword(password, student.passwordSalt);
    if (!passwordsMatch(credentials.passwordHash, student.passwordHash)) {
      showToast("Incorrect email or password.");
      return;
    }
    if (!setActiveStudent(student.email)) return;
    closeModal("studentModal");
    refresh();
    showView("dashboard");
    showToast(`Welcome back, ${student.name}.`);
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not log in.");
  }
});

document.querySelector("#studentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const existing = readStudent();
  if (!existing) return;
  const student = {
    ...existing,
    name:document.querySelector("#editStudentName").value.trim(),
    roll:document.querySelector("#editStudentRoll").value.trim(),
    email:normalizeEmail(document.querySelector("#editStudentEmail").value),
    phone:document.querySelector("#editStudentPhone").value.trim()
  };
  const duplicate = readStudents().find((item) => item.id !== existing.id
    && (normalizeEmail(item.email) === student.email || normalizeRoll(item.roll) === normalizeRoll(student.roll)));
  if (duplicate) {
    showToast("That email or roll number already belongs to another Student ID.");
    return;
  }
  const students = readStudents().map((item) => item.id === existing.id ? student : item);
  if (!saveStudents(students) || !setActiveStudent(student.email)) return;
  closeModal("studentModal");
  refresh();
  showView("profile");
  showToast("Student details updated. Your Student ID is unchanged.");
});

document.querySelector("#passwordSetupForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const password = document.querySelector("#newStudentPassword").value;
  if (password !== document.querySelector("#confirmStudentPassword").value) {
    showToast("Passwords do not match.");
    return;
  }
  const existing = readStudent();
  if (!existing) return;
  try {
    const credentials = await hashPassword(password);
    const students = readStudents().map((item) => item.id === existing.id ? { ...item, ...credentials } : item);
    if (!saveStudents(students)) return;
    closeModal("studentModal");
    refresh();
    showView("profile");
    showToast("Login password saved in this browser.");
  } catch (error) {
    console.error(error);
    showToast(error.message || "Could not save your password.");
  }
});

document.querySelector("#regform").addEventListener("submit", (submitEvent) => {
  submitEvent.preventDefault();
  const selectedEvent = readEvents().find((item) => item.id === selectedEventId);
  const student = readStudent();
  if (!selectedEvent || !student) return;
  const paid = Number(selectedEvent.fee) > 0;
  readFile(document.querySelector("#paymentProof").files[0]).then((proof) => {
    const passToken = `CCPASS-${selectedEvent.id}-${student.id}-${Date.now().toString(36).toUpperCase()}`;
    const regs = readRegs();
    regs.push({ eventId:selectedEvent.id, eventTitle:selectedEvent.title, studentId:student.id, name:student.name, roll:student.roll, email:student.email, phone:student.phone, payment:paid ? `₹${selectedEvent.fee} · Pending verification` : "Free", proof, passToken, entered:false, entryTime:"", status:paid ? "Payment Submitted" : "Confirmed" });
    saveRegs(regs);
    closeModal("registerModal");
    refresh();
    if (!paid) openEntryPass(passToken);
    else showToast("Payment proof submitted. Wait for admin approval.");
  });
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
  details.forEach(([label, selector], index) => { const y = 290 + index * 105; ctx.font = "bold 18px Arial"; ctx.fillText(label, 45, y); ctx.font = "26px Arial"; ctx.fillText(document.querySelector(selector).textContent, 45, y + 38); });
  const qrCanvas = document.querySelector("#passQr canvas");
  if (qrCanvas) ctx.drawImage(qrCanvas, 510, 700, 180, 180);
  ctx.font = "16px Arial"; ctx.fillStyle = "#777789"; ctx.fillText(document.querySelector("#passToken").textContent, 45, 760);
  const link = document.createElement("a");
  link.download = `entry-pass-${document.querySelector("#passRoll").textContent.split(" ")[0]}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

refresh();
