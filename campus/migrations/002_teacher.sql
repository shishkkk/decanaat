CREATE TABLE users_new(id TEXT PRIMARY KEY,login TEXT UNIQUE NOT NULL,password_hash TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('student','staff','teacher')),name TEXT NOT NULL,name_en TEXT NOT NULL,group_name TEXT NOT NULL DEFAULT '',faculty TEXT NOT NULL DEFAULT '',faculty_en TEXT NOT NULL DEFAULT '',program TEXT NOT NULL DEFAULT '',program_en TEXT NOT NULL DEFAULT '',year INTEGER NOT NULL DEFAULT 0,admission INTEGER NOT NULL DEFAULT 0,funding TEXT NOT NULL DEFAULT '',student_no TEXT NOT NULL DEFAULT '',email TEXT NOT NULL DEFAULT '',phone TEXT NOT NULL DEFAULT '',avatar TEXT NOT NULL DEFAULT 'ink');
INSERT INTO users_new SELECT * FROM users;
DROP TABLE users;
ALTER TABLE users_new RENAME TO users;
CREATE INDEX courses_teacher ON courses(teacher_id);
INSERT INTO migrations VALUES(2,datetime('now'));
