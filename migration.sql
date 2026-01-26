-- Events Table
CREATE TABLE IF NOT EXISTS events (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id),
    title VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) CHECK (event_type IN ('Holiday', 'Event', 'Exam', 'Meeting', 'Other')),
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP,
    description TEXT,
    audience VARCHAR(50) DEFAULT 'All', -- All, Students, Teachers, Staff
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Announcements Table
CREATE TABLE IF NOT EXISTS announcements (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    target_role VARCHAR(50) DEFAULT 'All', -- All, Student, Teacher, Staff
    priority VARCHAR(20) DEFAULT 'Normal', -- Normal, High, Urgent
    valid_until DATE,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expenditures Table
CREATE TABLE IF NOT EXISTS expenditures (
    id SERIAL PRIMARY KEY,
    school_id INTEGER REFERENCES schools(id),
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    category VARCHAR(50),
    description TEXT,
    expense_date DATE DEFAULT CURRENT_DATE,
    payment_method VARCHAR(50),
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
