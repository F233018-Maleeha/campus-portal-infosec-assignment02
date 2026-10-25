-- seed-data.sql
-- Matches the schema created automatically by db.js on first run.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'student'
);

CREATE TABLE IF NOT EXISTS courses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id INTEGER NOT NULL,
  username TEXT NOT NULL,
  comment TEXT NOT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id)
);

INSERT INTO users (username, password, email, role) VALUES
  ('alice', 'alice123', 'alice@campus.edu', 'student'),
  ('bob', 'bobpass', 'bob@campus.edu', 'student'),
  ('admin', 'S3cr3tAdminPW!', 'admin@campus.edu', 'admin');

INSERT INTO courses (name, description) VALUES
  ('Information Security', 'Intro to InfoSec: crypto, network security, web security.'),
  ('Database Systems', 'Relational databases, SQL, normalization, transactions.'),
  ('Operating Systems', 'Processes, memory management, file systems, concurrency.');

INSERT INTO reviews (course_id, username, comment) VALUES
  (1, 'alice', 'Really enjoyed the buffer overflow labs, very hands-on.'),
  (1, 'bob', 'Tough but fair. The SQL injection module was eye opening.'),
  (2, 'alice', 'Clear explanations of normalization and ER diagrams.');
