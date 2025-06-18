const sqlite3 = require('sqlite3').verbose();
const config = require('../config/config');

const db = new sqlite3.Database(config.database.filename, (err) => {
    if (err) {
        // Error opening database
    } else {
        // Connected to database
    }
});

// Function to clean up expired sessions
const cleanupExpiredSessions = () => {
    db.run('DELETE FROM sessions WHERE expires_at < CURRENT_TIMESTAMP');
};

// Clean up expired sessions every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);

// Function to validate and extend session
const validateAndExtendSession = (token, userId) => {
    const newExpiration = new Date();
    newExpiration.setHours(newExpiration.getHours() + 24); // 24-hour session
    
    return new Promise((resolve, reject) => {
        db.run(
            'UPDATE sessions SET expires_at = ? WHERE id = ? AND user_id = ?',
            [newExpiration, token, userId],
            function(err) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(this.changes > 0);
            }
        );
    });
};

module.exports = {
    db,
    initializeDatabase,
    cleanupExpiredSessions,
    validateAndExtendSession
};

// Database initialization
const initializeDatabase = () => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'user',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Sessions table
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);

    // Services table
    db.run(`CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        client_name TEXT NOT NULL,
        service_type TEXT NOT NULL,
        price DECIMAL(10,2) NOT NULL,
        commission DECIMAL(10,2),
        cycle_start_date DATE NOT NULL,
        cycle_end_date DATE NOT NULL,
        service_date DATE,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )`);
};

module.exports = {
    db,
    initializeDatabase
};
