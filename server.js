const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const csurf = require('csurf');
const db = require('./db');
const path = require('path');

const app = express();
const PORT = 3000;

const SAFE_MODE = process.env.SAFE_MODE === 'true';

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const sessions = {};
function currentUser(req) {
  const sid = req.cookies.sid;
  return sid && sessions[sid] ? sessions[sid] : null;
}

const csrfProtection = csurf({ cookie: { sameSite: 'strict' } });

function page(title, body) {
  return `<!DOCTYPE html>
<html><head><title>${title}</title>
<style>
body{font-family:sans-serif;max-width:700px;margin:40px auto;padding:0 16px;color:#222}
nav a{margin-right:12px}
.banner{background:${SAFE_MODE ? '#e6ffed' : '#ffecec'};padding:8px 12px;border-radius:6px;font-size:13px;margin-bottom:16px}
input,textarea{width:100%;padding:6px;margin:4px 0 12px;box-sizing:border-box}
button{padding:8px 16px;cursor:pointer}
.review{border-bottom:1px solid #eee;padding:8px 0}
</style></head><body>
<div class="banner">Mode: <b>${SAFE_MODE ? 'SAFE' : 'VULNERABLE'}</b> (set via SAFE_MODE env var)</div>
<nav><a href="/">Home</a><a href="/search">Search Courses</a><a href="/reviews">Reviews</a>
<a href="/profile">Profile</a><a href="/account">Account</a></nav>
${body}
</body></html>`;
}

// ---------------- HOME / LOGIN ----------------
app.get('/', (req, res) => {
  const user = currentUser(req);
  res.send(page('Campus Portal', `
    <h1>Campus Portal</h1>
    ${user ? `<p>Logged in as <b>${user.username}</b> (${user.role}). <a href="/logout">Logout</a></p>`
           : `<form method="POST" action="/login">
                <label>Username</label><input name="username">
                <label>Password</label><input name="password" type="password">
                <button>Login</button>
              </form>`}
  `));
});

// ---------------- SQL INJECTION: EASY (login bypass) ----------------
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  let user;

  if (!SAFE_MODE) {
    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
    try {
      user = db.prepare(query).get();
    } catch (e) {
      return res.send(page('Login error', `<p>SQL error: ${e.message}</p><a href="/">Back</a>`));
    }
  } else {
    user = db.prepare('SELECT * FROM users WHERE username = ? AND password = ?')
             .get(username, password);
  }

  if (user) {
    const sid = 'sid_' + Math.random().toString(36).slice(2);
    sessions[sid] = user;
    res.cookie('sid', sid, { httpOnly: true, sameSite: SAFE_MODE ? 'strict' : 'lax' });
    res.redirect('/');
  } else {
    res.send(page('Login failed', `<p>Invalid credentials.</p><a href="/">Back</a>`));
  }
});

app.get('/logout', (req, res) => {
  delete sessions[req.cookies.sid];
  res.clearCookie('sid');
  res.redirect('/');
});

// ---------------- REFLECTED XSS + SQLi ADVANCED (course search) ----------------
app.get('/search', (req, res) => {
  const q = req.query.q || '';
  let results = [];
  let resultsHtml = '';

  if (q) {
    if (!SAFE_MODE) {
      try {
        results = db.prepare(`SELECT * FROM courses WHERE name LIKE '%${q}%'`).all();
      } catch (e) {
        resultsHtml = `<p style="color:red">DB error: ${e.message}</p>`;
      }
    } else {
      results = db.prepare('SELECT * FROM courses WHERE name LIKE ?').all(`%${q}%`);
    }

    resultsHtml += results.map(r => `<li>${r.name} - ${r.description}</li>`).join('');
  }

  const echoedQuery = SAFE_MODE
    ? q.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    : q;

  res.send(page('Search Courses', `
    <h1>Search Courses</h1>
    <form method="GET" action="/search">
      <input name="q" placeholder="e.g. Security" value="${echoedQuery}">
      <button>Search</button>
    </form>
    <p>You searched for: ${echoedQuery}</p>
    <ul>${resultsHtml}</ul>
  `));
});

// ---------------- SQL INJECTION: INTERMEDIATE (blind boolean) ----------------
app.get('/check-user', (req, res) => {
  const username = req.query.username || '';
  let exists = false;

  if (!SAFE_MODE) {
    try {
      const row = db.prepare(`SELECT 1 FROM users WHERE username = '${username}'`).get();
      exists = !!row;
    } catch (e) {
      return res.json({ error: e.message });
    }
  } else {
    const row = db.prepare('SELECT 1 FROM users WHERE username = ?').get(username);
    exists = !!row;
  }

  res.json({ exists });
});

app.get('/reviews', (req, res) => {
  const courseId = req.query.course || 1;
  const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(courseId);
  const reviews = db.prepare('SELECT * FROM reviews WHERE course_id = ?').all(courseId);

  const reviewsHtml = reviews.map(r => {
    const comment = SAFE_MODE
      ? r.comment.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      : r.comment;
    return `<div class="review"><b>${r.username}</b>: ${comment}</div>`;
  }).join('');

  const courseOptions = db.prepare('SELECT * FROM courses').all()
    .map(c => `<option value="${c.id}" ${c.id == courseId ? 'selected' : ''}>${c.name}</option>`).join('');

  res.send(page('Reviews', `
    <h1>Reviews: ${course ? course.name : 'Unknown course'}</h1>
    <form method="GET" action="/reviews">
      <select name="course" onchange="this.form.submit()">${courseOptions}</select>
    </form>
    ${reviewsHtml}
    <h3>Leave a review</h3>
    <form method="POST" action="/reviews">
      <input type="hidden" name="course_id" value="${courseId}">
      <label>Your name</label><input name="username" value="${currentUser(req) ? currentUser(req).username : ''}">
      <label>Comment</label><textarea name="comment" rows="3"></textarea>
      <button>Submit review</button>
    </form>
  `));
});

app.post('/reviews', (req, res) => {
  const { course_id, username, comment } = req.body;
  db.prepare('INSERT INTO reviews (course_id, username, comment) VALUES (?, ?, ?)')
    .run(course_id, username || 'anonymous', comment || '');
  res.redirect('/reviews?course=' + course_id);
});

// ---------------- DOM-BASED XSS (profile page) ----------------
app.get('/profile', (req, res) => {
  res.send(page('Profile', `
    <h1>Profile</h1>
    <p>Set your display name via the hash in the URL, e.g.
    <code>/profile#John</code> or try <code>/profile#&lt;img src=x onerror=alert(1)&gt;</code></p>
    <div id="greeting"></div>
    <script>
      var name = decodeURIComponent(location.hash.slice(1)) || 'Guest';
      var el = document.getElementById('greeting');
      ${SAFE_MODE
        ? `el.textContent = 'Hello, ' + name + '!';`
        : `el.innerHTML = 'Hello, ' + name + '!';`
      }
    </script>
  `));
});

// ---------------- CSRF (change email) ----------------
app.get('/account', SAFE_MODE ? csrfProtection : (req, res, next) => next(), (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/');
  const token = SAFE_MODE ? req.csrfToken() : null;
  res.send(page('Account', `
    <h1>Account</h1>
    <p>Current email: <b>${user.email}</b></p>
    <form method="POST" action="/change-email">
      ${SAFE_MODE ? `<input type="hidden" name="_csrf" value="${token}">` : ''}
      <label>New email</label><input name="email" value="">
      <button>Update email</button>
    </form>
    <p style="font-size:12px;color:#888">Try the CSRF attack page at <a href="/csrf-attack.html">/csrf-attack.html</a> while logged in.</p>
  `));
});

app.post('/change-email', SAFE_MODE ? csrfProtection : (req, res, next) => next(), (req, res) => {
  const user = currentUser(req);
  if (!user) return res.redirect('/');
  db.prepare('UPDATE users SET email = ? WHERE id = ?').run(req.body.email, user.id);
  sessions[req.cookies.sid].email = req.body.email;
  res.send(page('Email updated', `<p>Email changed to <b>${req.body.email}</b>.</p><a href="/account">Back</a>`));
});

app.use((err, req, res, next) => {
  if (err.code === 'EBADCSRFTOKEN') {
    return res.status(403).send(page('Blocked', `<p>Request blocked: invalid or missing CSRF token.</p>`));
  }
  next(err);
});

app.listen(PORT, () => {
  console.log(`Campus Portal running at http://localhost:${PORT}`);
  console.log(`Mode: ${SAFE_MODE ? 'SAFE' : 'VULNERABLE'}`);
});
