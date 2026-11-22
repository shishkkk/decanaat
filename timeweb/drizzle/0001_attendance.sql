ALTER TABLE users ADD COLUMN login_enabled INTEGER NOT NULL DEFAULT 1 CHECK(login_enabled IN (0,1));
--> statement-breakpoint
UPDATE users SET login_enabled=0 WHERE id IN ('student-max','staff-elena');
--> statement-breakpoint
CREATE TABLE attendance_roster (group_name TEXT NOT NULL, id TEXT PRIMARY KEY, name TEXT NOT NULL, name_en TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE attendance_marks (lesson_id TEXT NOT NULL REFERENCES lessons(id) ON DELETE CASCADE, member_id TEXT NOT NULL REFERENCES attendance_roster(id), status TEXT NOT NULL CHECK(status IN ('present','late','absent','excused','unmarked')), PRIMARY KEY(lesson_id,member_id));
--> statement-breakpoint
INSERT INTO attendance_roster VALUES ('ИСТ-31','student-alex','Александр Миронов','Alexander Mironov'),
('ИСТ-31','kira','Кира Астахова','Kira Astakhova'),
('ИСТ-31','ilya','Илья Ветров','Ilya Vetrov'),
('ИСТ-31','anna','Анна Зорина','Anna Zorina'),
('ИСТ-31','lev','Лев Орлов','Lev Orlov'),
('ФИЛ-11','student-max','Максим Волков','Maxim Volkov'),
('ФИЛ-11','irina','Ирина Власова','Irina Vlasova'),
('ФИЛ-11','mark','Марк Громов','Mark Gromov'),
('ФИЛ-11','eva','Ева Сомова','Eva Somova');