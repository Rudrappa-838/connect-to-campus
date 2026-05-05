const fs = require('fs');
const path = require('path');

const keyPath = path.join(__dirname, 'serviceAccountKey.json');
const raw = fs.readFileSync(keyPath, 'utf8');

// Step 1: Parse what we can to isolate the private_key field
// The private key in a JSON file should have newlines as \\n (two chars: backslash + n)
// But other backslash sequences like \V, \C, \+, etc. are INVALID in JSON

// We'll fix this by finding the private_key value and re-encoding it properly
// Strategy: replace any \X where X is not a valid JSON escape char (", \, /, b, f, n, r, t, u)
const fixed = raw.replace(/\\([^"\\/bfnrtu\n])/g, (match, char) => {
    // This is an invalid escape - just keep the character itself
    return char;
});

try {
    const parsed = JSON.parse(fixed);
    fs.writeFileSync(keyPath, JSON.stringify(parsed, null, 2), 'utf8');
    console.log('SUCCESS: serviceAccountKey.json has been fixed!');
    console.log('Project ID:', parsed.project_id);
    console.log('Client Email:', parsed.client_email);
} catch (e) {
    console.log('Still has errors after first pass:', e.message);
    const pos = parseInt((e.message.match(/position (\d+)/) || [])[1] || 0);
    console.log('Context around position', pos, ':');
    console.log(JSON.stringify(fixed.substring(Math.max(0, pos - 20), pos + 30)));
}
