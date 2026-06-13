-- ─────────────────────────────────────────────────────────────────────────────
-- Subject Combination / Group System — Migration
-- Run this on your PostgreSQL database to enable Subject Combination Allocation
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Subjects master (school-level subject definitions)
CREATE TABLE IF NOT EXISTS exam_subjects (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    subject_code VARCHAR(20),
    type VARCHAR(30) DEFAULT 'CORE',          -- CORE | LANGUAGE | OPTIONAL | ELECTIVE
    is_common_to_all BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 2. Subject Groups / Combinations (e.g. PCMB, PCMC, Commerce, Arts)
CREATE TABLE IF NOT EXISTS exam_subject_groups (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    name VARCHAR(100) NOT NULL,               -- e.g. "PCMB + English + Kannada"
    description TEXT,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Subjects inside a group
CREATE TABLE IF NOT EXISTS exam_group_subjects (
    id SERIAL PRIMARY KEY,
    group_id INTEGER NOT NULL REFERENCES exam_subject_groups(id) ON DELETE CASCADE,
    subject_id INTEGER NOT NULL REFERENCES exam_subjects(id) ON DELETE CASCADE,
    is_required BOOLEAN DEFAULT TRUE,
    choice_pool_id INTEGER,                   -- FK added below
    UNIQUE(group_id, subject_id)
);

-- 4. Choice pools (for optional language choices within a group)
CREATE TABLE IF NOT EXISTS exam_choice_pools (
    id SERIAL PRIMARY KEY,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    group_id INTEGER REFERENCES exam_subject_groups(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL
);

-- Add FK from exam_group_subjects -> exam_choice_pools (safe add)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE constraint_name = 'fk_group_subjects_pool'
    ) THEN
        ALTER TABLE exam_group_subjects
            ADD CONSTRAINT fk_group_subjects_pool
            FOREIGN KEY (choice_pool_id) REFERENCES exam_choice_pools(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Student ↔ Group assignment (one assignment per student per class per academic year)
CREATE TABLE IF NOT EXISTS student_subject_assignments (
    id SERIAL PRIMARY KEY,
    student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    school_id INTEGER NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
    class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    academic_year VARCHAR(20) NOT NULL,       -- e.g. "2026-2027"
    group_id INTEGER REFERENCES exam_subject_groups(id) ON DELETE SET NULL,
    chosen_subjects JSONB DEFAULT '[]',       -- e.g. [{"pool_id":1,"subject_id":5}]
    assigned_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(student_id, school_id, class_id, academic_year)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_exam_subjects_school ON exam_subjects(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_groups_school ON exam_subject_groups(school_id);
CREATE INDEX IF NOT EXISTS idx_exam_groups_class ON exam_subject_groups(class_id);
CREATE INDEX IF NOT EXISTS idx_student_assignments_class ON student_subject_assignments(class_id, academic_year);
CREATE INDEX IF NOT EXISTS idx_student_assignments_student ON student_subject_assignments(student_id);
