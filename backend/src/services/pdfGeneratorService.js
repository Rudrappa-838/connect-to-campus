const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const UPLOADS_DIR = path.join(__dirname, '../../uploads/question_papers');

// Ensure directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

/**
 * Generates an HTML document with basic styling.
 */
function generateHTMLTemplate(title, schoolName, date, bodyContent) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14px; color: #333; margin: 40px; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #ccc; padding-bottom: 10px; }
            .school-name { font-size: 24px; font-weight: bold; margin: 0; }
            .exam-title { font-size: 18px; margin: 5px 0; }
            .exam-meta { font-size: 14px; color: #666; display: flex; justify-content: space-between; margin-top: 15px;}
            .question-item { margin-bottom: 25px; page-break-inside: avoid; }
            .question-text { font-weight: bold; margin-bottom: 10px; }
            .options { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-left: 20px; }
            .option { padding: 5px; }
            .solution { background: #f9f9f9; padding: 10px; border-left: 4px solid #4CAF50; margin-top: 10px; font-style: italic; }
            .key-table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            .key-table th, .key-table td { border: 1px solid #ddd; padding: 8px; text-align: center; }
            .key-table th { background-color: #f2f2f2; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1 class="school-name">${schoolName}</h1>
            <h2 class="exam-title">${title}</h2>
            <div class="exam-meta">
                <span>Date: ${date}</span>
                <span>Max Marks: ________</span>
            </div>
        </div>
        <div class="content">
            ${bodyContent}
        </div>
    </body>
    </html>`;
}

/**
 * Builds the Question Paper HTML
 */
function buildMainPaperHTML(questions) {
    let body = '<h3>Questions</h3>';
    questions.forEach((q, index) => {
        body += `
        <div class="question-item">
            <div class="question-text">${index + 1}. ${q.question_text}</div>
            <div class="options">
                <div class="option">A) ${q.option_a}</div>
                <div class="option">B) ${q.option_b}</div>
                <div class="option">C) ${q.option_c}</div>
                <div class="option">D) ${q.option_d}</div>
            </div>
        </div>`;
    });
    return body;
}

/**
 * Builds the Brief Solutions HTML
 */
function buildSolutionsHTML(questions) {
    let body = '<h3>Step-by-Step Solutions</h3>';
    questions.forEach((q, index) => {
        body += `
        <div class="question-item">
            <div class="question-text">${index + 1}. ${q.question_text}</div>
            <div class="solution">
                <strong>Correct Option: ${q.correct_option}</strong><br/>
                Explanation: ${q.brief_solution || "N/A"}
            </div>
        </div>`;
    });
    return body;
}

/**
 * Builds the Answer Key HTML (just a table)
 */
function buildAnswerKeyHTML(questions) {
    let body = '<h3>Answer Key</h3>';
    body += '<table class="key-table"><thead><tr><th>Q. No</th><th>Answer</th></tr></thead><tbody>';
    questions.forEach((q, index) => {
        body += `<tr><td>${index + 1}</td><td><strong>${q.correct_option}</strong></td></tr>`;
    });
    body += '</tbody></table>';
    return body;
}

/**
 * Core function to generate the 3 PDFs via Puppeteer
 */
async function generateQuestionPaperPack(paperId, title, schoolName, date, questions) {
    const mainPaperHTML = generateHTMLTemplate(title, schoolName, date, buildMainPaperHTML(questions));
    const solutionsHTML = generateHTMLTemplate(`${title} - Solutions`, schoolName, date, buildSolutionsHTML(questions));
    const answerKeyHTML = generateHTMLTemplate(`${title} - Answer Key`, schoolName, date, buildAnswerKeyHTML(questions));

    const mainPaperPath = path.join(UPLOADS_DIR, `paper_${paperId}_main.pdf`);
    const solutionsPath = path.join(UPLOADS_DIR, `paper_${paperId}_solutions.pdf`);
    const answerKeyPath = path.join(UPLOADS_DIR, `paper_${paperId}_key.pdf`);

    const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    try {
        const page = await browser.newPage();

        // 1. Generate Main Paper
        await page.setContent(mainPaperHTML, { waitUntil: 'networkidle0' });
        await page.pdf({ path: mainPaperPath, format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });

        // 2. Generate Solutions
        await page.setContent(solutionsHTML, { waitUntil: 'networkidle0' });
        await page.pdf({ path: solutionsPath, format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });

        // 3. Generate Answer Key
        await page.setContent(answerKeyHTML, { waitUntil: 'networkidle0' });
        await page.pdf({ path: answerKeyPath, format: 'A4', printBackground: true, margin: { top: '20px', bottom: '20px' } });

        return {
            mainUrl: `/uploads/question_papers/paper_${paperId}_main.pdf`,
            solutionsUrl: `/uploads/question_papers/paper_${paperId}_solutions.pdf`,
            keyUrl: `/uploads/question_papers/paper_${paperId}_key.pdf`
        };

    } catch (error) {
        console.error('❌ Error generating PDFs:', error);
        throw error;
    } finally {
        await browser.close();
    }
}

module.exports = {
    generateQuestionPaperPack
};
