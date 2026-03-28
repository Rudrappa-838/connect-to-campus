const bcrypt = require('bcrypt');

const hash = '$2b$10$eqz3Vxjd7Jfpe7RPeIGLu.jBcycbefwlXHYvvQmNn/ufaqGnBqGGC'; // From user's terminal
const password = '123456';

async function check() {
    const isMatch = await bcrypt.compare(password, hash);
    console.log(`Password '123456' matches current hash: ${isMatch}`);
}

check();
