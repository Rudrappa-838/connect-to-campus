-- Migration: Create Question Bank Tables

-- 1. Create Questions Table
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    subject VARCHAR(100) NOT NULL, -- Physics, Chemistry, Maths, Biology
    class_level VARCHAR(50) NOT NULL, -- PUC 1, PUC 2
    chapter VARCHAR(255) NOT NULL,
    topic VARCHAR(255),
    exam_type VARCHAR(50) DEFAULT 'NEET/CET/JEE',
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option VARCHAR(10) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    brief_solution TEXT,
    difficulty_level VARCHAR(50) DEFAULT 'Medium',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexing for fast searching of the 80k+ questions
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject);
CREATE INDEX IF NOT EXISTS idx_questions_class ON questions(class_level);
CREATE INDEX IF NOT EXISTS idx_questions_chapter ON questions(chapter);

-- 2. Create Question Papers Table
CREATE TABLE IF NOT EXISTS question_papers (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id) ON DELETE CASCADE,
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL, -- e.g., "Week 1 Exam"
    subject VARCHAR(100) NOT NULL,
    class_level VARCHAR(50) NOT NULL,
    exam_date DATE,
    question_paper_pdf_url TEXT,
    solution_pdf_url TEXT,
    key_answer_pdf_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Question Paper Items Table (Mapping)
CREATE TABLE IF NOT EXISTS question_paper_items (
    id SERIAL PRIMARY KEY,
    question_paper_id INTEGER REFERENCES question_papers(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES questions(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    UNIQUE(question_paper_id, question_id)
);
