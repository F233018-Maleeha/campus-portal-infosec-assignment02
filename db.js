const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'campus.db');
const isNew = !fs.existsSync(dbPath);
const db = new Database(dbPath);

if (isNew) {
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'student'
    );

    CREATE TABLE courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT NOT NULL
    );

    CREATE TABLE reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      comment TEXT NOT NULL,
      FOREIGN KEY (course_id) REFERENCES courses(id)
    );
  `);

  const insertUser = db.prepare('INSERT INTO users (username, password, email, role) VALUES (?, ?, ?, ?)');
  insertUser.run('alice', 'alice123', 'alice@campus.edu', 'student');
  insertUser.run('bob', 'bobpass', 'bob@campus.edu', 'student');
  insertUser.run('admin', 'S3cr3tAdminPW!', 'admin@campus.edu', 'admin');

  const insertCourse = db.prepare('INSERT INTO courses (name, description) VALUES (?, ?)');
  insertCourse.run('Information Security', 'Intro to InfoSec: crypto, network security, web security.');
  insertCourse.run('Database Systems', 'Relational databases, SQL, normalization, transactions.');
  insertCourse.run('Operating Systems', 'Processes, memory management, file systems, concurrency.');

  const insertReview = db.prepare('INSERT INTO reviews (course_id, username, comment) VALUES (?, ?, ?)');
  insertReview.run(1, 'alice', 'Really enjoyed the buffer overflow labs, very hands-on.');
  insertReview.run(1, 'bob', 'Tough but fair. The SQL injection module was eye opening.');
  insertReview.run(2, 'alice', 'Clear explanations of normalization and ER diagrams.');

  console.log('Database initialized with seed data.');
}

module.exports = db;
