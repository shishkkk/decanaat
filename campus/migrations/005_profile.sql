CREATE TABLE student_credentials(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,birth_date TEXT,gradebook_no TEXT NOT NULL,pass_code TEXT NOT NULL UNIQUE);
UPDATE users SET phone='+7 (000) 000-00-31' WHERE id='student-alex' AND phone='';
INSERT INTO student_credentials SELECT id,CASE id WHEN 'student-alex' THEN '2005-04-17' WHEN 'student-max' THEN '2007-09-08' END,'ЗК-'||replace(student_no,'DEMO-',''),lower(hex(randomblob(16))) FROM users WHERE role='student';
CREATE TRIGGER init_student_credentials AFTER INSERT ON users WHEN NEW.role='student' BEGIN INSERT INTO student_credentials SELECT id,CASE id WHEN 'student-alex' THEN '2005-04-17' WHEN 'student-max' THEN '2007-09-08' END,'ЗК-'||replace(student_no,'DEMO-',''),lower(hex(randomblob(16))) FROM users WHERE id=NEW.id; UPDATE users SET phone='+7 (000) 000-00-31' WHERE id='student-alex' AND phone='' AND id=NEW.id; END;
INSERT INTO migrations VALUES(5,datetime('now'));
