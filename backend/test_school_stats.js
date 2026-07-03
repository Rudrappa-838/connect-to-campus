const { pool } = require('./src/config/db'); 
pool.query(`SELECT id, name FROM schools WHERE name ILIKE '%VISHWA%'`).then(res => { 
  if (res.rows.length === 0) { console.log("School not found"); return pool.end(); }
  const schoolId = res.rows[0].id;
  console.log("School:", res.rows[0]);
  pool.query(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status IS NULL OR status NOT IN ('Deleted', 'Unassigned') THEN 1 ELSE 0 END) as dashboard_total,
      SUM(CASE WHEN status IS NULL OR status != 'Deleted' THEN 1 ELSE 0 END) as admission_total
    FROM students WHERE school_id = $1
  `, [schoolId]).then(res2 => {
    console.log("Students:", res2.rows[0]);
    pool.query(`SELECT c.name, COUNT(s.id) as count
            FROM classes c
            LEFT JOIN students s ON c.id = s.class_id AND (s.status IS NULL OR s.status NOT IN ('Deleted', 'Unassigned'))
            WHERE c.school_id = $1
            GROUP BY c.id, c.name
            ORDER BY c.name ASC`, [schoolId]).then(res3 => {
                console.log("Classes:", res3.rows);
                pool.end();
            });
  });
});
