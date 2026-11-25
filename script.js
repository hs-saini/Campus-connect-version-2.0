const EVENT_KEY = "college-event-list";
const REG_KEY = "college-event-registrations";
const STUDENT_KEY = "college-event-student-id";
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
function readStudent() { try { return JSON.parse(localStorage.getItem(STUDENT_KEY)); } catch (error) { return null; } }
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
  if (!student) {
    document.querySelector("#profileName").textContent = "Create Student ID";
    document.querySelector("#profileId").textContent = "Campus member";
    document.querySelector("#profileAvatar").textContent = "S";
    detailsCard.hidden = true;
    emptyDetails.hidden = false;
    editButton.hidden = true;
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

function openStudentModal() {
  const existing = readStudent();
  document.querySelector("#studentModalTitle").textContent = existing ? "Edit Student Details" : "Create Lifetime Student ID";
  document.querySelector("#saveStudentDetails").textContent = existing ? "Save Changes" : "Create Student ID";
  if (existing) {
    document.querySelector("#studentName").value = existing.name;
    document.querySelector("#studentRoll").value = existing.roll;
    document.querySelector("#studentEmail").value = existing.email;
    document.querySelector("#studentPhone").value = existing.phone;
  } else {
    document.querySelector("#studentForm").reset();
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
  else openStudentModal();
});
document.querySelector("#editStudentDetails").addEventListener("click", openStudentModal);
document.querySelector("#createStudentIdFromDetails").addEventListener("click", openStudentModal);
document.querySelector("#cancelStudentId").addEventListener("click", () => closeModal("studentModal"));
document.querySelector("#cancelRegistration").addEventListener("click", () => closeModal("registerModal"));
document.querySelector("#closePass").addEventListener("click", () => closeModal("passModal"));
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

document.querySelector("#studentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const existing = readStudent();
  const student = { id:existing?.id || `CC-${Date.now().toString().slice(-8)}`, name:document.querySelector("#studentName").value.trim(), roll:document.querySelector("#studentRoll").value.trim(), email:document.querySelector("#studentEmail").value.trim(), phone:document.querySelector("#studentPhone").value.trim() };
  localStorage.setItem(STUDENT_KEY, JSON.stringify(student));
  closeModal("studentModal");
  refresh();
  showView("profile");
  showToast(existing ? "Student details updated." : `Student ID created: ${student.id}`);
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
