ALTER TABLE courses ADD COLUMN grade_points INTEGER CHECK (grade_points BETWEEN 0 AND 100 AND typeof(grade_points)='integer' OR grade_points IS NULL);
--> statement-breakpoint
UPDATE courses SET grade_points=grade*20;
--> statement-breakpoint
ALTER TABLE courses DROP COLUMN grade;
--> statement-breakpoint
ALTER TABLE courses RENAME COLUMN grade_points TO grade;
--> statement-breakpoint
UPDATE grade_history SET grade=grade*20;
--> statement-breakpoint
CREATE TRIGGER grade_history_points_0 BEFORE INSERT ON grade_history WHEN typeof(NEW.grade)<>'integer' OR NEW.grade NOT BETWEEN 0 AND 100 BEGIN SELECT RAISE(ABORT,'Grade must be an integer from 0 to 100'); END;
--> statement-breakpoint
CREATE TRIGGER grade_history_points_1 BEFORE UPDATE OF grade ON grade_history WHEN typeof(NEW.grade)<>'integer' OR NEW.grade NOT BETWEEN 0 AND 100 BEGIN SELECT RAISE(ABORT,'Grade must be an integer from 0 to 100'); END;
