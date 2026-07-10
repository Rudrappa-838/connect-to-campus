const sqlite3 = require('sqlite3');
const db = new sqlite3.Database('c:/SchoolSoftware/backend/database.sqlite');
db.all("SELECT name, sql FROM sqlite_master WHERE type='table' AND name IN ('exams', 'students', 'settings', 'exam_schedules', 'school_settings', 'marks');", (err, rows) => {
  if (err) console.error(err);
  else console.log(JSON.stringify(rows, null, 2));
});
