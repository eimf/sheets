// Seed script to wipe and repopulate the database with clean data.
// Usage: node server/seed.js

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'data', 'sheets.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        process.exit(1);
    }
    console.log('Connected to the SQLite database.');
});

function getCurrentCycle(today) {
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 4=Thu
    const daysSinceThursday = (dayOfWeek + 7 - 4) % 7;
    const cycleStart = new Date(today);
    cycleStart.setDate(today.getDate() - daysSinceThursday);
    cycleStart.setHours(0, 0, 0, 0);
    const cycleEnd = new Date(cycleStart);
    cycleEnd.setDate(cycleStart.getDate() + 13);
    return {
        start_date: cycleStart.toISOString().split('T')[0],
        end_date: cycleEnd.toISOString().split('T')[0],
    };
}

function seedDatabase() {
    db.serialize(() => {
        console.log('Wiping existing services and cycles data...');
        // We only drop services and cycles. Users are preserved.
        db.run(`DROP TABLE IF EXISTS services`);
        db.run(`DROP TABLE IF EXISTS cycles`);

        console.log('Recreating tables...');
        // Note: The users table is NOT dropped or recreated here.
        // It's assumed to be created by server.js on first run.
        db.run(`CREATE TABLE cycles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL
        )`);

        db.run(`CREATE TABLE services (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            cycle_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            date TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
            FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
        )`);

        // Check for a user. If none exists, create one.
        // If one exists, we'll use the first one we find.
        db.get('SELECT id, email FROM users ORDER BY id ASC LIMIT 1', [], (err, user) => {
            if (err) {
                console.error('Error checking for user:', err);
                db.close();
                return;
            }

            if (user) {
                console.log(`Found existing user '${user.email}' (ID: ${user.id}). Seeding data for this user.`);
                seedDataForUser(user.id);
            } else {
                console.log('No users found. Creating a default user.');
                const insertUserSql = `INSERT INTO users (email, password, stylish) VALUES (?, ?, ?)`;
                // IMPORTANT: In a real app, use a hashed password.
                db.run(insertUserSql, ['test@test.com', 'password', 'Test Stylist'], function(err) {
                    if (err) {
                        console.error('Error creating default user:', err);
                        db.close();
                        return;
                    }
                    const newUserId = this.lastID;
                    console.log(`Created default user 'test@test.com' with ID: ${newUserId}`);
                    seedDataForUser(newUserId);
                });
            }
        });
    });
}

function seedDataForUser(userId) {
    // Seed Current Cycle
    const today = new Date();
    const { start_date, end_date } = getCurrentCycle(today);
    const cycleName = `Cycle: ${start_date} to ${end_date}`;
    const insertCycleSql = `INSERT INTO cycles (name, start_date, end_date) VALUES (?, ?, ?)`;

    db.run(insertCycleSql, [cycleName, start_date, end_date], function(err) {
        if (err) {
            console.error('Error inserting cycle:', err);
            db.close();
            return;
        }
        const cycleId = this.lastID;
        console.log(`Inserted cycle '${cycleName}' with ID: ${cycleId}`);

        // Seed services for the given user
        const servicesToSeed = [
            { name: 'Haircut & Style', price: 65.00, date: new Date().toISOString() },
            { name: 'Beard Trim', price: 25.00, date: new Date().toISOString() },
        ];
        const insertServiceSql = `INSERT INTO services (user_id, cycle_id, name, price, date) VALUES (?, ?, ?, ?, ?)`;

        let completed = 0;
        servicesToSeed.forEach(service => {
            db.run(insertServiceSql, [userId, cycleId, service.name, service.price, service.date], function(err) {
                if (err) {
                    console.error('Error inserting service:', err);
                } else {
                    console.log(`Inserted service '${service.name}' for user ${userId}`);
                }
                completed++;
                if (completed === servicesToSeed.length) {
                    console.log('Database seeding complete.');
                    db.close();
                }
            });
        });
    });
}

seedDatabase();
