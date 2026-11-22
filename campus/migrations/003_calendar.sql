CREATE TABLE campus_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_en TEXT NOT NULL,
  description TEXT NOT NULL,
  description_en TEXT NOT NULL,
  starts TEXT NOT NULL,
  location TEXT NOT NULL,
  location_en TEXT NOT NULL
);
CREATE TABLE event_registrations (
  event_id TEXT NOT NULL REFERENCES campus_events(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  PRIMARY KEY (event_id,user_id)
);
CREATE TABLE exams (
  course_id TEXT PRIMARY KEY REFERENCES courses(id),
  starts TEXT NOT NULL,
  room TEXT NOT NULL
);
ALTER TABLE users ADD COLUMN last_seen_at TEXT;
INSERT INTO migrations VALUES(3,datetime('now'));
