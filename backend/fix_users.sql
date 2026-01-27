-- SQL FIX FOR MISSING USERS
-- Staff DAD8663
INSERT INTO users (email, password, role, school_id, must_change_password)
SELECT 'dad8663@staff.school.com', '$2b$10$7d9ad1a38c1449d1807b7uGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'STAFF', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'dad8663@staff.school.com' OR (email = 'mrudru7@gmail.com' AND role = 'STAFF'));

-- Student DAS5778
INSERT INTO users (email, password, role, school_id, must_change_password)
SELECT 'das5778@student.school.com', '$2b$10$7d9ad1a38c1449d1807b7uGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', 'STUDENT', 2, TRUE
WHERE NOT EXISTS (SELECT 1 FROM users WHERE email = 'das5778@student.school.com' OR (email = 'mrudru7@gmail.com' AND role = 'STUDENT'));
