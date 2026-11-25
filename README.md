# CampusConnect 2.0

A responsive college event portal demo with separate student and admin portals.

## Features

- Browse events and register using a Student ID
- Create a student account, log in, and keep one Student ID per email and roll number in this browser
- View and edit student details in a separate profile section
- Manage events, review registrations, and verify entry passes in the admin demo
- Responsive layout for desktop and mobile

## Run locally

Open `index.html` in a browser, or serve this folder with a static web server:

```bash
python -m http.server 8000
```

Open `http://localhost:8000`. The admin demo is available at `admin.html`.

## Live demo

- Student portal: https://hs-saini.github.io/Campus-connect-version-2.0/
- Admin demo: https://hs-saini.github.io/Campus-connect-version-2.0/admin.html

## Limitations

This is a front-end demonstration, not a production service. Events, student accounts, profiles, registrations, payment proofs, and admin data are stored in the current browser's Local Storage and are not shared across users or devices. Student passwords are hashed in the browser, but this is not secure authentication: local data can be changed or read by someone with access to the browser. The admin login is also client-side only, and no payments are processed. Do not enter real student or payment data.
