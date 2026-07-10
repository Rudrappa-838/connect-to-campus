const bcrypt = require('bcrypt');
bcrypt.compare('123456', '$2b$10$SVtnIno0L4l07DEfdGh1.uWLIS1UHWGZl2Y6MGTfq1.Rsa9u.Jf3e').then(res => console.log('Match:', res));
