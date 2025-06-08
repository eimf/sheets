const path = require('path');

const config = {
    port: 3001,
    database: {
        filename: path.join(__dirname, '..', '..', 'data', 'sheets.db')
    },
    auth: {
        tokenSecret: 'your-secret-key-here' // In production, use environment variables
    }
};

module.exports = config;
