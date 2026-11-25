const EVENT_KEY = "college-event-list";
const REG_KEY = "college-event-registrations";
const ADMIN_SESSION = "college-event-admin-session";
const ADMIN_ACCOUNTS_KEY = "college-event-admin-accounts";
let events = readEvents();
let editingId = "";
let scanner = null;
let starting = false;
let cameraRunning = false;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function readEvents() {
  try {
    const value = JSON.parse(localStorage.getItem(EVENT_KEY));
    if (Array.isArray(value)) return value;
  } catch (error) { console.error(error); }
  return [
    { id:"tech-fest", title:"Annual Tech Fest", template:"Technology", category:"Technology", college:"CampusConnect College", date:"2026-12-05", time:"10:00", venue:"Main Auditorium", contact:"9876543210", email:"techfest@college.edu", description:"Coding challenges, project displays and technology talks.", fee:0, qr:"" },
    { id:"music-evening", title:"Music Evening", template:"Cultural", category:"Cultural", college:"CampusConnect College", date:"2026-12-12", time:"18:00", venue:"Open-Air Stage", contact:"9876543211", email:"culture@college.edu", description:"Live performances by students.", fee:0, qr:"" },
    { id:"sports-day", title:"College Sports Day", template:"Sports", category:"Sports", college:"CampusConnect College", date:"2026-12-18", time:"09:00", venue:"College Ground", contact:"9876543212", email:"sports@college.edu", description:"Track events, games and friendly matches.", fee:0, qr:"" }
  ];
}
function saveEvents() { localStorage.setItem(EVENT_KEY, JSON.stringify(events)); }
function readRegs() {
  try {
    const value = JSON.parse(localStorage.getItem(REG_KEY));
    if (Array.isArray(value)) return value;
  } catch (error) { console.error(error); }
  return [];
}
function saveRegs(value) { localStorage.setItem(REG_KEY, JSON.stringify(value)); }
function readAccounts() {
  try {
    const value = JSON.parse(localStorage.getItem(ADMIN_ACCOUNTS_KEY));
    if (Array.isArray(value)) return value;
  } catch (error) { console.error(error); }
  return [];
}
function saveAccounts(value) { localStorage.setItem(ADMIN_ACCOUNTS_KEY, JSON.stringify(value)); }
function readSession() {
  try { return JSON.parse(sessionStorage.getItem(ADMIN_SESSION)); } catch (error) { return null; }
}
function isUnlocked() { return Boolean(readSession()); }
function getCurrentAdmin() { return readSession(); }
function isMaster() { return getCurrentAdmin()?.role === "master"; }
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
  clearTimeout(window.adminToastTimer);
  window.adminToastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}
function closeModal(id) { document.querySelector(`#${id}`).hidden = true; }

function setLocked() {
  document.querySelectorAll(".view").forEach((view) => view.hidden = true);
  document.querySelector("#loginModal").hidden = false;
  document.querySelector("#adminStatus").textContent = "Locked";
  document.querySelector("#adminApprovalNav").hidden = true;
}

function unlock() {
  document.querySelector("#loginModal").hidden = true;
  const admin = getCurrentAdmin();
  document.querySelector("#adminStatus").textContent = isMaster()
    ? "Master Admin"
    : `${admin.category} Admin`;
  const profileName = document.querySelector(".topbar .profile strong");
  if (profileName) profileName.textContent = admin.name || "Administrator";
  document.querySelector("#adminApprovalNav").hidden = !isMaster();
  document.querySelector("#overview").hidden = false;
  refresh();
}

function switchView(view) {
  document.querySelectorAll(".view").forEach((section) => section.hidden = section.id !== view);
  document.querySelectorAll(".navitem").forEach((item) => item.classList.toggle("active", item.dataset.view === view));
  const titles = { overview:"Admin Overview", events:"Manage Events", students:"Student Registrations", scanner:"Entry QR Scanner", approvals:"Admin Approvals" };
  document.querySelector("#adminCrumb").textContent = titles[view];
  if (view === "scanner") document.querySelector("#startCamera").click();
  if (view !== "scanner") stopCamera(false);
}

function visibleEvents() {
  if (isMaster()) return events;
  const admin = getCurrentAdmin();
  return events.filter((event) => (event.ownerCategory || event.category) === admin?.category);
}

function visibleRegs() {
  if (isMaster()) return readRegs();
  const allowedEventIds = new Set(visibleEvents().map((event) => event.id));
  return readRegs().filter((registration) => allowedEventIds.has(registration.eventId));
}

function renderRows() {
  const regs = visibleRegs();
  const scopedEvents = visibleEvents();
  const studentSet = new Set(regs.map((item) => `${item.roll}`.trim().toLowerCase()));
  document.querySelector("#adminEvents").textContent = scopedEvents.length;
  document.querySelector("#adminStudents").textContent = studentSet.size;
  document.querySelector("#entryCount").textContent = regs.filter((item) => item.entered).length;

  const row = (item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.roll)}</td><td>${escapeHtml(item.eventTitle)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.payment)}</td><td>${item.proof ? `<a class="proof-link" href="${escapeHtml(item.proof)}" target="_blank">View proof</a>` : "-"}</td><td class="status">${escapeHtml(item.status)}${item.status === "Payment Submitted" ? `<button class="table-action verify-action" data-approve="${escapeHtml(item.passToken)}">Approve Payment</button>` : ""}${item.entered ? `<small class="entry-used">Entry used · ${escapeHtml(item.entryTime ? new Date(item.entryTime).toLocaleString("en-IN") : "")}</small>` : ""}</td></tr>`;
  const recent = regs.slice().reverse().map(row).join("");
  document.querySelector("#adminRows").innerHTML = recent;
  renderStudents();

  document.querySelector("#adminEventRows").innerHTML = scopedEvents.map((item) => `<tr><td>${escapeHtml(item.title)}</td><td>${escapeHtml(item.template || item.category)}</td><td>${formatDate(item.date)} · ${escapeHtml(formatTime(item.time))}</td><td>${escapeHtml(item.venue)}</td><td>${Number(item.fee) > 0 ? `₹${escapeHtml(item.fee)}` : "Free"}</td><td><button class="table-action" data-edit="${escapeHtml(item.id)}">Edit</button> <button class="table-action danger-action" data-delete="${escapeHtml(item.id)}">Delete</button></td></tr>`).join("");
}

function renderStudents() {
  const term = (document.querySelector("#registrationSearch").value || "").trim().toLowerCase();
  const rows = visibleRegs().filter((item) => [item.name, item.roll, item.eventTitle, item.email, item.phone].join(" ").toLowerCase().includes(term));
  const row = (item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.roll)}</td><td>${escapeHtml(item.eventTitle)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.phone)}</td><td>${escapeHtml(item.payment)}</td><td>${item.proof ? `<a class="proof-link" href="${escapeHtml(item.proof)}" target="_blank">View proof</a>` : "-"}</td><td class="status">${escapeHtml(item.status)}${item.status === "Payment Submitted" ? `<button class="table-action verify-action" data-approve="${escapeHtml(item.passToken)}">Approve Payment</button>` : ""}</td></tr>`;
  document.querySelector("#studentRows").innerHTML = rows.slice().reverse().map(row).join("");
}
function renderApprovals() {
  if (!isMaster()) return;
  const accounts = readAccounts();
  document.querySelector("#pendingAdminRows").innerHTML = accounts
    .filter((item) => item.status === "pending")
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.adminId)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.category)}</td><td>${escapeHtml(new Date(item.requestedAt).toLocaleString("en-IN"))}</td><td><button class="table-action verify-action" data-admin-action="approve" data-admin-id="${escapeHtml(item.adminId)}">Approve</button> <button class="table-action danger-action" data-admin-action="reject" data-admin-id="${escapeHtml(item.adminId)}">Reject</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">No pending applications.</td></tr>';
  document.querySelector("#approvedAdminRows").innerHTML = accounts
    .filter((item) => item.status === "approved")
    .map((item) => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.adminId)}</td><td>${escapeHtml(item.email)}</td><td>${escapeHtml(item.category)}</td><td class="status">Approved</td><td><button class="table-action danger-action" data-admin-action="remove" data-admin-id="${escapeHtml(item.adminId)}">Remove Access</button></td></tr>`).join("") || '<tr><td colspan="6" class="empty">No approved category admins.</td></tr>';
}
function refresh() { renderRows(); renderApprovals(); }

const templates = {
  Technology:{ category:"Technology", venue:"Main Auditorium", description:"A technology event featuring projects, talks, demonstrations and team participation." },
  Cultural:{ category:"Cultural", venue:"Open-Air Stage", description:"A cultural event showcasing performances, creativity and student talent." },
  Sports:{ category:"Sports", venue:"College Ground", description:"A sports event with team and individual participation, match schedules and live scores." },
  Workshop:{ category:"Workshop", venue:"Seminar Hall", description:"A hands-on learning session with practical activities and guided expert support." },
  Hackathon:{ category:"Hackathon", venue:"Innovation Lab", description:"Build innovative solutions with your team during a timed challenge." },
  Prize:{ category:"Prize", venue:"College Auditorium", description:"A competitive event with judging rounds and prize pool rewards." },
  Social:{ category:"Social", venue:"College Campus", description:"A community-focused event with student participation." }
};

function openEventModal(eventId = "") {
  editingId = eventId;
  document.querySelector("#eventForm").reset();
  document.querySelector("#eventModalTitle").textContent = eventId ? "Edit Event" : "Add Event";
  document.querySelector("#eventCollege").value = "CampusConnect College";
  document.querySelector("#eventFee").value = "0";
  document.querySelector("#paymentQrField").hidden = true;
  document.querySelector("#paymentQrPreview").hidden = true;
  if (!isMaster()) {
    const category = getCurrentAdmin().category;
    document.querySelector("#eventTemplate").value = category;
    document.querySelector("#eventTemplate").disabled = true;
  } else {
    document.querySelector("#eventTemplate").disabled = false;
  }
  if (eventId) {
    const event = events.find((item) => item.id === eventId);
    if (!event) return;
    document.querySelector("#eventTemplate").value = event.template || event.category;
    document.querySelector("#eventCollege").value = event.college || "CampusConnect College";
    document.querySelector("#eventTitle").value = event.title;
    document.querySelector("#eventDate").value = event.date;
    document.querySelector("#eventTime").value = event.time || "";
    document.querySelector("#eventVenue").value = event.venue;
    document.querySelector("#eventContact").value = event.contact;
    document.querySelector("#eventEmail").value = event.email;
    document.querySelector("#eventDescription").value = event.description;
    document.querySelector("#eventFee").value = event.fee || 0;
    document.querySelector("#eventQrUrl").value = event.qr && !event.qr.startsWith("data:image") ? event.qr : "";
    document.querySelector("#paymentQrField").hidden = Number(event.fee) <= 0;
    if (event.qr?.startsWith("data:image")) {
      document.querySelector("#paymentQrPreview").innerHTML = `<img src="${escapeHtml(event.qr)}" alt="Payment QR">`;
      document.querySelector("#paymentQrPreview").hidden = false;
    }
  }
  document.querySelector("#eventModal").hidden = false;
}

document.querySelector("#loginForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const adminId = document.querySelector("#adminLoginId").value.trim().toLowerCase();
  const password = document.querySelector("#adminLoginPassword").value;
  let sessionAdmin = null;
  if (adminId === "masteradmin" && password === "1234") {
    sessionAdmin = { role:"master", name:"Master Administrator", adminId:"masteradmin", category:"All" };
  } else {
    const account = readAccounts().find((item) =>
      item.status === "approved" &&
      item.adminId.toLowerCase() === adminId &&
      item.password === password
    );
    if (!account) {
      alert("Invalid credentials or account is not approved yet.");
      return;
    }
    sessionAdmin = { role:"category", name:account.name, adminId:account.adminId, category:account.category };
  }
  sessionStorage.setItem(ADMIN_SESSION, JSON.stringify(sessionAdmin));
  unlock();
});

document.querySelector("#showLoginTab").addEventListener("click", () => {
  document.querySelector("#loginForm").hidden = false;
  document.querySelector("#applyAdminForm").hidden = true;
  document.querySelector("#showLoginTab").classList.add("active");
  document.querySelector("#showApplyTab").classList.remove("active");
});
document.querySelector("#showApplyTab").addEventListener("click", () => {
  document.querySelector("#loginForm").hidden = true;
  document.querySelector("#applyAdminForm").hidden = false;
  document.querySelector("#showApplyTab").classList.add("active");
  document.querySelector("#showLoginTab").classList.remove("active");
});
document.querySelector("#applyAdminForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const adminId = document.querySelector("#applyAdminId").value.trim();
  const accounts = readAccounts();
  if (accounts.some((item) => item.adminId.toLowerCase() === adminId.toLowerCase())) {
    alert("This Admin ID is already registered or pending.");
    return;
  }
  accounts.push({
    name:document.querySelector("#applyName").value.trim(),
    email:document.querySelector("#applyEmail").value.trim(),
    adminId,
    password:document.querySelector("#applyPassword").value,
    category:document.querySelector("#applyCategory").value,
    phone:document.querySelector("#applyPhone").value.trim(),
    status:"pending",
    requestedAt:new Date().toISOString()
  });
  saveAccounts(accounts);
  document.querySelector("#applyAdminForm").reset();
  showToast("Application submitted. Wait for Master Admin approval.");
  document.querySelector("#showLoginTab").click();
});
document.querySelector("#logoutAdmin").addEventListener("click", () => {
  sessionStorage.removeItem(ADMIN_SESSION);
  if (scanner && cameraRunning) {
    scanner.stop().catch(() => {}).finally(() => {
      if (typeof scanner.clear === "function") scanner.clear();
      scanner = null;
      cameraRunning = false;
    });
  }
  setLocked();
});
document.querySelectorAll(".navitem").forEach((item) => item.addEventListener("click", () => { if (isUnlocked()) switchView(item.dataset.view); }));
document.querySelector("#addEvent").addEventListener("click", () => openEventModal());
document.querySelector("#addEventAlt").addEventListener("click", () => openEventModal());
document.querySelector("#cancelEvent").addEventListener("click", () => closeModal("eventModal"));
document.querySelector("#eventTemplate").addEventListener("change", (event) => {
  const template = templates[event.target.value];
  if (template) {
    document.querySelector("#eventVenue").value = template.venue;
    document.querySelector("#eventDescription").value = template.description;
  }
});
document.querySelector("#eventFee").addEventListener("input", (event) => {
  document.querySelector("#paymentQrField").hidden = Number(event.target.value) <= 0;
});
document.querySelector("#eventQrUpload").addEventListener("change", (event) => {
  if (!event.target.files[0]) return;
  readFile(event.target.files[0]).then((qr) => {
    document.querySelector("#paymentQrPreview").innerHTML = `<img src="${escapeHtml(qr)}" alt="Payment QR preview">`;
    document.querySelector("#paymentQrPreview").hidden = false;
  });
});
document.querySelector("#registrationSearch").addEventListener("input", renderStudents);

document.querySelector("#eventForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (!isUnlocked()) return;
  const fee = Number(document.querySelector("#eventFee").value);
  const templateName = isMaster()
    ? document.querySelector("#eventTemplate").value
    : getCurrentAdmin().category;
  const template = templates[templateName];
  const existing = editingId ? events.find((item) => item.id === editingId) : null;
  readFile(document.querySelector("#eventQrUpload").files[0]).then((uploadedQr) => {
    const qr = uploadedQr || document.querySelector("#eventQrUrl").value.trim() || (existing ? existing.qr : "");
    if (fee > 0 && !qr) { alert("Upload a Payment QR or enter a QR image URL."); return; }
    const data = { title:document.querySelector("#eventTitle").value.trim(), template:templateName, category:template.category, ownerCategory:templateName, ownerAdminId:getCurrentAdmin().adminId, college:document.querySelector("#eventCollege").value.trim(), date:document.querySelector("#eventDate").value, time:document.querySelector("#eventTime").value, venue:document.querySelector("#eventVenue").value.trim(), contact:document.querySelector("#eventContact").value.trim(), email:document.querySelector("#eventEmail").value.trim(), description:document.querySelector("#eventDescription").value.trim(), fee, qr:fee > 0 ? qr : "" };
    if (editingId) {
      const index = events.findIndex((item) => item.id === editingId);
      events[index] = { ...events[index], ...data };
      showToast("Event updated.");
    } else {
      events.push({ id:`event-${Date.now()}`, ...data });
      showToast("Event published.");
    }
    saveEvents();
    editingId = "";
    closeModal("eventModal");
    refresh();
  });
});

document.querySelector("#adminEventRows").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit]");
  const remove = event.target.closest("[data-delete]");
  if (edit) {
    const target = visibleEvents().find((item) => item.id === edit.dataset.edit);
    if (target) openEventModal(target.id);
  }
  if (remove && confirm("Delete this event? Existing registrations remain in records.")) {
    if (!visibleEvents().some((item) => item.id === remove.dataset.delete)) return;
    events = events.filter((item) => item.id !== remove.dataset.delete);
    saveEvents();
    refresh();
    showToast("Event deleted.");
  }
});

document.querySelector("#adminRows").addEventListener("click", approvePayment);
document.querySelector("#studentRows").addEventListener("click", approvePayment);
document.querySelector("#pendingAdminRows").addEventListener("click", handleAdminAccountAction);
document.querySelector("#approvedAdminRows").addEventListener("click", handleAdminAccountAction);
function handleAdminAccountAction(event) {
  if (!isMaster()) return;
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  const accounts = readAccounts();
  const account = accounts.find((item) => item.adminId === button.dataset.adminId);
  if (!account) return;
  const action = button.dataset.adminAction;
  if (action === "approve") {
    account.status = "approved";
    showToast(`${account.adminId} approved.`);
  } else if (action === "reject") {
    account.status = "rejected";
    showToast(`${account.adminId} application rejected.`);
  } else if (action === "remove") {
    account.status = "removed";
    showToast(`${account.adminId} access removed.`);
  }
  saveAccounts(accounts);
  refresh();
}
function approvePayment(event) {
  const button = event.target.closest("[data-approve]");
  if (!button) return;
  const regs = readRegs();
  const registration = regs.find((item) => item.passToken === button.dataset.approve);
  if (!registration || !visibleRegs().some((item) => item.passToken === registration.passToken)) return;
  registration.status = "Payment Verified";
  registration.payment = registration.payment.replace("Pending verification", "Approved");
  saveRegs(regs);
  refresh();
  showToast("Payment approved. Entry pass is now available.");
}

function verifyToken(rawToken) {
  const token = String(rawToken || "").trim();
  const result = document.querySelector("#scanResult");
  if (!token) { result.className = "scan-result error"; result.textContent = "No pass token found."; return; }
  const regs = readRegs();
  const registration = regs.find((item) => item.passToken === token);
  if (!registration) { result.className = "scan-result error"; result.textContent = "Invalid or unknown entry pass."; return; }
  const event = events.find((item) => item.id === registration.eventId);
  if (!isMaster() && (event?.ownerCategory || event?.category) !== getCurrentAdmin().category) {
    result.className = "scan-result error";
    result.textContent = "Entry denied: this pass belongs to another event category.";
    return;
  }
  if (!["Confirmed", "Payment Verified"].includes(registration.status)) { result.className = "scan-result error"; result.textContent = "Entry denied: payment or registration is not confirmed."; return; }
  if (registration.entered) { result.className = "scan-result error"; result.textContent = `Duplicate entry denied: ${registration.name} (${registration.roll})`; return; }
  registration.entered = true;
  registration.entryTime = new Date().toISOString();
  saveRegs(regs);
  result.className = "scan-result success";
  result.innerHTML = `<strong>Entry Approved</strong><br>${escapeHtml(registration.name)} · ${escapeHtml(registration.roll)}<br>${escapeHtml(event?.title || registration.eventTitle)}<br>${escapeHtml(new Date(registration.entryTime).toLocaleString("en-IN"))}`;
  document.querySelector("#entrySuccessText").textContent =
    `${registration.name} (${registration.roll}) — ${event?.title || registration.eventTitle}. Entry recorded successfully.`;
  document.querySelector("#entrySuccessModal").hidden = false;
  stopCamera(false);
  refresh();
  showToast("Entry recorded successfully.");
}

async function startCamera() {
  if (!isUnlocked() || starting) return;
  starting = true;
  const result = document.querySelector("#scanResult");
  if (!window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") {
    result.className = "scan-result error";
    result.textContent = "Camera requires HTTPS or localhost.";
    starting = false;
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia) {
    result.className = "scan-result error";
    result.textContent = "Camera is not available in this browser.";
    starting = false;
    return;
  }
  if (!window.Html5Qrcode) {
    result.className = "scan-result error";
    result.textContent = "Scanner library failed to load. Reload this page.";
    starting = false;
    return;
  }
  try {
    if (scanner && cameraRunning) {
      await scanner.stop().catch(() => {});
      if (typeof scanner.clear === "function") {
        const clearResult = scanner.clear();
        if (clearResult?.catch) await clearResult.catch(() => {});
      }
      cameraRunning = false;
    }
    scanner = new Html5Qrcode("qrReader");
    await scanner.start(
      { facingMode:"environment" },
      { fps:12, qrbox:{ width:260, height:260 }, aspectRatio:1.0 },
      (decodedText) => verifyToken(decodedText),
      () => {}
    );
    cameraRunning = true;
    result.className = "scan-result";
    result.textContent = "Camera is active. Point it at the entry pass.";
  } catch (error) {
    console.error(error);
    cameraRunning = false;
    result.className = "scan-result error";
    result.textContent = "Camera denied or unavailable. Allow camera permission, use QR image, or use manual token.";
  } finally { starting = false; }
}
async function stopCamera(showMessage = true) {
  if (scanner && cameraRunning) {
    await scanner.stop().catch(() => {});
    if (typeof scanner.clear === "function") {
      const clearResult = scanner.clear();
      if (clearResult?.catch) await clearResult.catch(() => {});
    }
    scanner = null;
    cameraRunning = false;
  }
  if (showMessage) {
    document.querySelector("#scanResult").className = "scan-result";
    document.querySelector("#scanResult").textContent = "Camera stopped.";
  }
}

document.querySelector("#startCamera").addEventListener("click", startCamera);
document.querySelector("#stopCamera").addEventListener("click", () => stopCamera(true));
document.querySelector("#verifyManual").addEventListener("click", () => verifyToken(document.querySelector("#manualQr").value));
document.querySelector("#closeEntrySuccess").addEventListener("click", () => closeModal("entrySuccessModal"));
document.querySelector("#qrImageFile").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  await stopCamera(false);
  const result = document.querySelector("#scanResult");
  result.className = "scan-result";
  result.textContent = "Reading QR image...";
  try {
    if (window.Html5Qrcode) {
      const imageScanner = new Html5Qrcode("qrReader");
      const text = await imageScanner.scanFile(file, true);
      verifyToken(text);
    } else if ("BarcodeDetector" in window) {
      const detector = new BarcodeDetector({ formats:["qr_code"] });
      const bitmap = await createImageBitmap(file);
      const codes = await detector.detect(bitmap);
      if (!codes.length) throw new Error("No QR code found");
      verifyToken(codes[0].rawValue);
    } else {
      throw new Error("Scanner unavailable");
    }
  } catch (error) {
    result.className = "scan-result error";
    result.textContent = "Could not read QR image. Use a clearer image or manual token.";
  }
  event.target.value = "";
});

if (isUnlocked()) unlock();
else setLocked();
