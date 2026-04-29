const { markFaceAttendanceById } = require('./src/controllers/biometricController');

const test = async () => {
    // Mock req and res
    const req = {
        body: {
            userId: 1, // Assume student ID 1
            type: 'student',
            marking_mode: 'face'
        },
        user: {
            schoolId: 1,
            role: 'SCHOOL_ADMIN',
            linkedId: 1
        }
    };

    const res = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            console.log('Response:', this.statusCode || 200, data);
        }
    };

    console.log('Testing markFaceAttendanceById...');
    await markFaceAttendanceById(req, res);
    process.exit(0);
};

test();
