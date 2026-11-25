# CampusConnect — Complete Project Guide

## 1. Project Overview

CampusConnect ek role-based college event management platform hai.

The system provides:
- Student lifetime ID
- Separate Student and Admin portals
- Event templates and event management
- Free and paid event registration
- Payment QR and payment proof upload
- Payment approval workflow
- Unique QR entry pass
- Live QR camera scanning
- QR image and manual token verification
- Duplicate entry prevention
- Category-based admin accounts
- Master Admin approval workflow

### Project URLs

- Student Portal: `http://127.0.0.1:4173/index.html`
- Admin Portal: `http://127.0.0.1:4173/admin.html`

### Master Admin Access

The master admin username and password hash are configured privately in the Vercel production environment. No default credentials are included in the application source.

---

## 2. Portal Structure

### Student Portal

Student Portal contains:
- Dashboard
- Browse Events
- My Registrations
- Student ID creation
- Event registration
- Free or paid registration
- Payment proof upload
- Entry pass view/download
- Email pass link

Student users cannot access event administration or the registration data of other users.

### Admin Portal

Admin Portal contains:
- Overview
- Manage Events
- Student Registrations
- Entry QR Scanner
- Admin Account Approvals

The Master Admin can see all categories, while category admins can only manage their approved category.

---

## 3. Development Timeline

### Phase 1: Initial Event Website

The project started as a basic single-page college event portal.

Initial features included:
- Dashboard
- Browse Events
- Registration table
- Basic Admin Overview
- Category search and filtering
- Browser Local Storage

Files initially used:
- `index.html`
- `style.css`
- `script.js`

The initial limitation was that students and admins were mixed into one page and role separation was missing.

### Phase 2: Lifetime Student ID

Added:
- Lifetime Student ID creation
- Name
- Roll number
- College email
- Mobile number
- Duplicate registration prevention
- Student-specific registration view

Example ID format:

`CC-12345678`

Students cannot recreate their Student ID after it has been created.

### Phase 3: Event Templates

Added event templates for:
- Technology
- Cultural
- Sports
- Workshop
- Hackathon
- Prize pool competition
- Social event

Selecting a template automatically fills:
- Category
- Default venue
- Default event description

This reduces the time needed to create a standard event.

### Phase 4: Free and Paid Events

Free event flow:
1. Student creates or already has a Student ID.
2. Student selects a free event.
3. Student submits registration.
4. Registration status becomes `Confirmed`.
5. Entry pass is generated.

Paid event flow:
1. Admin sets the participation fee.
2. Admin uploads a payment QR or supplies a QR image URL.
3. Student scans/views the payment QR.
4. Student uploads payment proof.
5. Registration status becomes `Payment Submitted`.
6. Admin verifies and approves the payment.
7. Registration status becomes `Payment Verified`.
8. Entry pass becomes available.

Payment proof supports:
- Images
- PDF files

### Phase 5: Entry Pass and QR

After successful registration, the system creates a unique pass containing:
- Student name
- Roll number
- Student ID
- Event name
- College name
- Date
- Time
- Venue
- Unique pass token
- QR code

The pass can be:
- Viewed on the Student Portal
- Downloaded as an image
- Shared using an email link

Example pass token:

`CCPASS-tech-fest-CC-12345678-K9M2P0X`

### Phase 6: Separate Student and Admin Portals

To avoid mixing student and admin responsibilities, separate pages were created:

- `index.html`: Student Portal
- `admin.html`: Admin Portal
- `script.js`: Student logic
- `admin.js`: Admin logic

Student users can access only their own registration and pass data.

### Phase 7: Multi-Admin Hierarchy

#### Master Admin

The Master Admin can:
- Approve or reject category admin applications
- Remove category admin access
- View all events
- View all registrations
- Approve payments
- Scan entry passes for all categories

#### Category Admin

Category examples:
- Fest/Technology
- Cultural
- Sports
- Workshop
- Hackathon
- Prize
- Social

A category admin can:
- Manage only approved-category events
- View only category registrations
- Approve payments for its category
- Verify entry QR passes for its category

A category admin cannot edit or delete events belonging to another category.

---

## 4. Admin Account Application Workflow

An account applicant submits:
- Full name
- Email
- Admin ID
- Password
- Event category
- Phone number

The account initially receives `pending` status.

The Master Admin can:
- Approve the application
- Reject the application
- Remove approved access

Only approved accounts can log into the Admin Portal.

Master Admin sign-in uses the username and password hash configured for the deployment. Never commit production credentials.

---

## 5. Student Registration Workflow

1. Student opens the Student Portal.
2. Student creates a lifetime Student ID.
3. Student selects an event.
4. Student submits registration details.
5. Free event:
   - Status becomes `Confirmed`
   - Pass becomes available immediately
6. Paid event:
   - Student pays using the provided QR
   - Student uploads payment proof
   - Status becomes `Payment Submitted`
7. Admin verifies the proof.
8. Admin approves payment.
9. Status becomes `Payment Verified`.
10. Student downloads or views the Entry Pass.

---

## 6. Entry QR Workflow

1. Admin opens `Entry QR Scanner`.
2. Admin starts the camera.
3. Student presents the Entry Pass QR.
4. Scanner reads the pass token.
5. System finds the matching registration.
6. System checks:
   - Registration exists
   - Registration or payment is confirmed
   - Pass belongs to the category admin
   - Pass has not been used before
7. Valid entry:
   - Entry status becomes used
   - Entry time is recorded
   - Green success modal appears
   - Student and event details are displayed
8. Repeated scan:
   - System displays duplicate entry denied
   - Entry is not recorded again

The scanner also supports:
- QR image upload
- Manual pass-token verification
- Camera stop/start controls

---

## 7. QR Scanner Issues and Fixes

### Original Problem

The scanner could display:

`Could not read QR image`

or fail to start the camera.

### Identified Causes

- Scanner CDN URL returned a 404 response
- Wrong or unavailable library version
- Camera permission denied
- Camera API unavailable
- Site not opened using localhost or HTTPS
- Scanner library not loaded
- Repeated stop/clear calls
- Scanner state not tracked

### Fixes Applied

- Updated scanner library to `html5-qrcode@2.3.8`
- Added jsDelivr plus unpkg fallback
- Added secure-context validation
- Added camera API validation
- Added scanner library validation
- Added live camera start/stop controls
- Added QR image file decoder
- Added native `BarcodeDetector` fallback
- Added manual token verification
- Added safe scanner cleanup
- Added active camera state tracking
- Added an Entry Confirmed success modal
- Added duplicate entry prevention
- Added category restrictions during verification

---

## 8. Browser Testing and Verification

Tested items:
- JavaScript syntax for both portals
- Separate Student/Admin pages
- Master Admin login
- Category admin login
- Admin application creation
- Admin approval/rejection
- Event creation
- Event edit/delete
- Free registration
- Paid registration
- Payment proof upload
- Payment approval
- QR pass creation
- QR pass download
- Live camera activation
- QR library loading
- Manual token verification
- Successful entry confirmation
- Duplicate entry denial
- Category-based entry restriction
- Camera stop/start cleanup
- Mobile responsive layout

Browser validation confirmed:
- Scanner library loaded successfully
- Browser had a secure context
- Camera API was available
- Camera became active
- Manual entry verified a matching registration
- Entry success modal appeared
- Entry-used status was saved
- Test data was removed after verification

---

## 9. Data Storage

The deployed version uses a shared Neon Postgres database through Vercel serverless functions.

| Data | Storage |
|---|---|
| Events | Neon Postgres |
| Registrations and entry status | Neon Postgres |
| Student profiles and unique Student IDs | Neon Postgres |
| Payment proof data | Neon Postgres |
| Admin applications and accounts | Neon Postgres |
| Active login sessions | Signed, HttpOnly cookies |

Email and roll number are each unique across student accounts. A database sequence assigns a persistent Student ID so logging in on another device retrieves the same profile.

---

## 10. Security Behavior in the Current Version

Current server-enforced behavior:
- Students only see their own registrations
- Category admins only see their category
- Category admins cannot edit another category
- Category admins cannot verify another category QR
- A student can create only one account per email and roll number
- Repeated event registration and repeat QR entry are blocked by database constraints
- Unconfirmed paid registrations are denied entry
- Master Admin sees all data
- Passwords are stored as scrypt hashes
- Sessions use signed, HttpOnly, SameSite cookies
- Master Admin credentials are read from server environment variables

Current limitations:
- Student email ownership is not verified by email
- Email pass opens the mail application rather than sending automatically
- Payment proof is stored in the database; no payment is processed
- Existing browser-only records are not automatically imported into the shared database

---

## 11. Vercel Production Configuration

Configure these production environment variables in Vercel:

- `DATABASE_URL`: Neon Postgres connection string
- `SESSION_SECRET`: random secret of at least 32 characters
- `MASTER_ADMIN_USERNAME`: chosen master admin username
- `MASTER_ADMIN_PASSWORD_HASH`: hash generated by `npm run hash-admin-password`

The API creates its tables and default events on first use. Never put the plain-text master password, session secret, or database URL in source control or expose them to the browser. The Vercel application should use a Neon database integration to provide `DATABASE_URL`.
- Team registration
- Judges and scoring
- Leaderboards
- Certificates
- Participant/export reports
- Excel/PDF export
- Event capacity limits
- Registration deadlines
- Real-time attendance dashboard
- Results announcement

---

## 12. Viva Presentation Guide

Project summary:

“CampusConnect is a role-based college event management platform. Students create a lifetime identity and register for events. Admin accounts are divided into Master and category-specific roles. Paid events support payment QR and proof verification. Successful registrations receive a unique Entry QR Pass. The Admin Portal scans or manually verifies passes, records entry time and prevents duplicate entry.”

### Important Viva Points

- The platform has separate Student and Admin portals.
- Master Admin approves category admins.
- Category admins cannot access another category.
- Paid and free events have separate flows.
- QR pass is unique per registration.
- QR pass stores event and student details.
- Duplicate entry is blocked using the `entered` registration flag.
- Scanner supports live camera, QR image and manual token.
- Student identities, events, and registrations are shared through the production database.
- Student and admin passwords are verified by the server; master admin credentials are deployment secrets.

---

## 13. Quick Demonstration Sequence

### Master Admin Demo

1. Open `admin.html`.
2. Log in using the Master Admin credentials configured in Vercel.
3. Open `Admin Approvals`.
4. Submit a category admin application.
5. Approve the application.
6. Add, edit or delete an event.

### Student Demo

1. Open `index.html`.
2. Create Student ID.
3. Open Browse Events.
4. Register for a free or paid event.
5. Upload payment proof for a paid event.
6. Open My Registrations.
7. View or download the Entry Pass.

### Entry Demo

1. Master or category admin opens the QR Scanner.
2. Start the camera.
3. Scan the student pass.
4. Verify entry success modal.
5. Scan the same pass again.
6. Confirm duplicate entry denial.

---

## 14. Project Files

- `index.html` — Student Portal
- `admin.html` — Admin Portal
- `script.js` — Student Portal logic
- `admin.js` — Admin Portal logic
- `style.css` — Shared responsive UI
- `PROJECT_GUIDE.md` — Complete project documentation
