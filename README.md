# Campus Portal — InfoSec Assignment 2, Part 2

A small student-portal web app (login, course search, course reviews, profile,
account settings) used to demonstrate common web vulnerabilities and their
fixes, as required by Part 2 of the assignment.

## Tech Stack
- Node.js + Express
- better-sqlite3 (file-based SQLite DB, `campus.db`, auto-created on first run)
- Plain server-rendered HTML (no frontend framework) + vanilla JS for the DOM XSS demo
- `csurf` for CSRF token protection in Safe Mode

## Project Structure
Single shared codebase with a `SAFE_MODE` environment variable toggle, as
permitted by the assignment brief. Every vulnerable code path is guarded by
an `if (!SAFE_MODE) { ... } else { ... }` block in `server.js`, with comments
marking exactly which line causes or fixes each vulnerability.

```
campus-portal/
├── server.js          # all routes, vulnerable/safe logic side by side
├── db.js              # SQLite setup + seed data
├── seed-data.sql       # same seed data as a standalone SQL file
├── public/
│   └── csrf-attack.html  # same-origin CSRF proof-of-concept page
└── package.json
```

## How to Run

```bash
npm install

# Vulnerable version
npm run vulnerable        # http://localhost:3000

# Safe (hardened) version
npm run safe               # http://localhost:3000
```

Only one mode runs at a time (same port); stop one before starting the other.
Login with seeded user: `alice` / `alice123` (or `admin` / `S3cr3tAdminPW!`).

## Implemented Vulnerabilities & Fixes

| # | Vulnerability | Location | Vulnerable behavior | Fix in Safe Mode |
|---|---|---|---|---|
| 1 | Reflected XSS | `GET /search?q=` | Search term echoed into HTML unescaped | HTML-entity escaping before output |
| 2 | Stored XSS | `GET/POST /reviews` | Review comments rendered raw from DB | Escaping applied at render time |
| 3 | DOM-based XSS | `GET /profile` | `location.hash` written via `innerHTML` | Written via `textContent` instead |
| 4 | CSRF | `POST /change-email` | No token check, cookie `sameSite=lax` | `csurf` token required, cookie `sameSite=strict` |
| 5 | SQL Injection — Easy | `POST /login` | Raw string-concatenated query, `' OR '1'='1` bypasses login | Parameterized query (`?` placeholders) |
| 6 | SQL Injection — Intermediate | `GET /check-user?username=` | Blind boolean-based injection via string concat | Parameterized query |
| 7 | SQL Injection — Advanced | `GET /search?q=` | UNION-based injection to enumerate columns → extract `users` table | Parameterized query |



