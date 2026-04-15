const { pool } = require('../config/db');
const { generateQuestionPaperPack } = require('../services/pdfGeneratorService');

exports.getQuestions = async (req, res) => {
    try {
        const { subject, class_level, chapter, topic, page = 1, limit = 50 } = req.query;
        let query = 'SELECT * FROM questions WHERE 1=1';
        const params = [];

        if (subject) {
            params.push(subject);
            query += ` AND subject = $${params.length}`;
        }
        if (class_level) {
            params.push(class_level);
            query += ` AND class_level = $${params.length}`;
        }
        if (chapter) {
            params.push(chapter);
            query += ` AND chapter = $${params.length}`;
        }
        if (topic) {
            params.push(topic);
            query += ` AND topic = $${params.length}`;
        }

        const countQuery = query.replace('*', 'COUNT(*)');
        const countResult = await pool.query(countQuery, params);
        const total = parseInt(countResult.rows[0].count, 10);

        // Pagination
        const offset = (page - 1) * limit;
        params.push(limit, offset);
        query += ` ORDER BY id DESC LIMIT $${params.length - 1} OFFSET $${params.length}`;

        const result = await pool.query(query, params);

        res.json({
            status: 'SUCCESS',
            data: result.rows,
            pagination: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching questions:', error);
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
};

exports.generatePaper = async (req, res) => {
    try {
        const { school_id, title, school_name, exam_date, subject, class_level, question_ids } = req.body;

        if (!question_ids || question_ids.length === 0) {
            return res.status(400).json({ status: 'ERROR', message: 'No questions selected' });
        }

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            // 1. Fetch the actual question details securely
            const qResult = await client.query('SELECT * FROM questions WHERE id = ANY($1) ORDER BY id', [question_ids]);
            const questions = qResult.rows;

            if (questions.length !== question_ids.length) {
                // Some IDs might be invalid, but we just proceed with the found ones
                console.warn(`Requested ${question_ids.length} questions, found ${questions.length}.`);
            }

            // 2. Create tracking record in DB
            const pResult = await client.query(
                `INSERT INTO question_papers (school_id, title, subject, class_level, exam_date, created_by)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
                [school_id, title, subject, class_level, exam_date || new Date(), req.user ? req.user.id : null]
            );
            const paperId = pResult.rows[0].id;

            // 3. Map items to paper
            for (let i = 0; i < questions.length; i++) {
                await client.query(
                    'INSERT INTO question_paper_items (question_paper_id, question_id, question_number) VALUES ($1, $2, $3)',
                    [paperId, questions[i].id, i + 1]
                );
            }

            // 4. Generate the PDFs using Puppeteer service
            const dateStr = exam_date || new Date().toISOString().split('T')[0];
            const pdfUrls = await generateQuestionPaperPack(paperId, title, school_name || 'School Name', dateStr, questions);

            // 5. Update URLs in DB
            await client.query(
                'UPDATE question_papers SET question_paper_pdf_url = $1, solution_pdf_url = $2, key_answer_pdf_url = $3 WHERE id = $4',
                [pdfUrls.mainUrl, pdfUrls.solutionsUrl, pdfUrls.keyUrl, paperId]
            );

            await client.query('COMMIT');

            res.json({
                status: 'SUCCESS',
                message: 'Question paper generated successfully',
                data: {
                    paperId,
                    ...pdfUrls
                }
            });

        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('Error generating question paper:', error);
        res.status(500).json({ status: 'ERROR', message: 'Failed to generate PDFs. See server logs.' });
    }
};
