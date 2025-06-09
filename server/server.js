const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3001; // Using a different port than Next.js

// Create necessary directories
const ensureDirectory = async (dirPath) => {
    try {
        await fs.access(dirPath);
    } catch (err) {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
};

const projectRootScriptsDir = path.resolve(__dirname, '../scripts');
ensureDirectory(projectRootScriptsDir); // Ensure scripts directory exists at project root



// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Database operations
const createTables = (db) => {
    return new Promise((resolve, reject) => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            stylish TEXT NOT NULL, -- Renamed from full_name, username removed
            role TEXT DEFAULT 'user',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`, (err) => {
            if (err) return reject(err);

            // Sessions table for authentication
            db.run(`CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )`, (err) => {
                if (err) return reject(err);

                // Cycles table
                db.run(`CREATE TABLE IF NOT EXISTS cycles (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    start_date DATE NOT NULL,
                    end_date DATE NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(start_date, end_date) -- Assuming cycles are global and unique by date range
                )`, (err) => {
                    if (err) return reject(err);

                    // Services table
                    db.run(`CREATE TABLE IF NOT EXISTS services (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,     -- Made NOT NULL
                        cycle_id INTEGER NOT NULL,    -- Added cycle_id
                        client_name TEXT NOT NULL,
                        service_type TEXT NOT NULL,
                        price DECIMAL(10,2) NOT NULL,
                        tip DECIMAL(10,2),
                        commission DECIMAL(10,2),
                        service_date DATE,            -- Kept service_date for the actual service event
                        notes TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (user_id) REFERENCES users (id),
                        FOREIGN KEY (cycle_id) REFERENCES cycles (id) -- Added FK to cycles
                    )`, (err) => {
                        if (err) return reject(err);
                        resolve();
                    });
                });
            });
        });
    });
};

// Initialize SQLite database
let db;
const initializeDatabase = async () => {
    const dataDir = path.join(__dirname, 'data');
    await ensureDirectory(dataDir);
    
    db = new sqlite3.Database(path.join(dataDir, 'sheets.db'), (err) => {
        if (err) {
            console.error("Error opening database:", err);
        } else {
            console.log("Connected to SQLite database");
            // Create tables
            createTables(db).catch(err => {
                console.error("Error creating tables:", err);
            });
        }
    });
};

// Initialize database and start server
const startServer = async () => {
    try {
        await initializeDatabase();
        
        // Create server instance
        const server = app.listen(port, () => {
            console.log(`Server running at http://localhost:${port}`);
        });

        // Error handling
        server.on('error', (error) => {
            console.error('Server error:', error);
            
            if (error.code === 'EADDRINUSE') {
                console.error(`Port ${port} is already in use. Trying to use a different port...`);
                // Try to find a free port
                const findFreePort = require('find-free-port');
                findFreePort(port + 1, port + 100, (err, freePort) => {
                    if (err) {
                        console.error('Could not find a free port:', err);
                        process.exit(1);
                    }
                    console.log(`Using port ${freePort} instead`);
                    // Close the old server first
                    server.close(() => {
                        // Create new server on the free port
                        app.listen(freePort, () => {
                            console.log(`Server running at http://localhost:${freePort}`);
                        });
                    });
                });
            } else {
                process.exit(1);
            }
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('Received SIGTERM. Shutting down gracefully...');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('Received SIGINT. Shutting down gracefully...');
            server.close(() => {
                console.log('Server closed');
                process.exit(0);
            });
        });

        // Handle unhandled promise rejections
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            process.exit(1);
        });

    } catch (err) {
        console.error('Failed to start server:', err);
        process.exit(1);
    }
};

// Start the server
startServer();

// Auth endpoints
app.post("/api/auth/register", (req, res) => {
    const { email, password, stylish } = req.body; // username removed, fullName changed to stylish

    if (!email || !password || !stylish) { // username removed, fullName changed to stylish
        res.status(400).json({ error: "Email, password, and stylish name are required" });
        return;
    }

    // Hash password (in production, use bcrypt)
    const hashedPassword = password; // In production, use bcrypt.hashSync()

    db.run(
        "INSERT INTO users (email, password, stylish) VALUES (?, ?, ?)", // username removed, full_name changed to stylish
        [email, hashedPassword, stylish], // username removed, fullName changed to stylish
        function (err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed") && err.message.includes("users.email")) {
                    res.status(400).json({
                        error: "Email already exists", // Username part removed
                    });
                } else {
                    res.status(500).json({ error: err.message });
                }
                return;
            }

            // Get the user ID of the newly created user
            const userId = this.lastID;

            // Create a session for the new user
            const sessionId = crypto.randomBytes(32).toString('hex');
            db.run(
                "INSERT INTO sessions (id, user_id) VALUES (?, ?)",
                [sessionId, userId],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    // Get the user data to return
                    db.get(
                        "SELECT id, email, stylish, role FROM users WHERE id = ?", // Fetched stylish and role
                        [userId],
                        (err, user) => {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }

                            res.json({
                                success: true,
                                message: "User registered successfully",
                                token: sessionId,
                                user: { // Ensure this matches the User type in lib/api.ts
                                    id: user.id,
                                    email: user.email,
                                    stylish: user.stylish, // Use stylish
                                    role: user.role       // Include role
                                }
                            });
                        }
                    );
                }
            );
        }
    );
});

app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        res.status(400).json({ error: "Email and password are required" });
        return;
    }

    db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }

        if (!user) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        // In production, compare hashed passwords using bcrypt.compare()
        if (user.password !== password) {
            res.status(401).json({ error: "Invalid credentials" });
            return;
        }

        // Create session
        const sessionId = crypto.randomUUID();
        db.run(
            "INSERT INTO sessions (id, user_id) VALUES (?, ?)",
            [sessionId, user.id],
            (err) => {
                if (err) {
                    res.status(500).json({ error: err.message });
                    return;
                }

                res.json({
                    success: true,
                    token: sessionId,
                    user: {
                        id: user.id,
                        username: user.username,
                        email: user.email,
                        fullName: user.full_name,
                        role: user.role,
                    },
                });
            }
        );
    });
});

app.get("/api/auth/profile", (req, res) => {
    const { authorization } = req.headers;

    if (!authorization) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }

    const token = authorization.split(" ")[1];
    db.get(
        "SELECT users.* FROM users JOIN sessions ON users.id = sessions.user_id WHERE sessions.id = ?",
        [token],
        (err, user) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!user) {
                res.status(401).json({ error: "Invalid session" });
                return;
            }

            res.json({
                success: true,
                user: {
                    id: user.id,
                    email: user.email,
                    stylish: user.stylish,
                    role: user.role,
                },
            });
        }
    );
});

// Service endpoints
app.get("/api/services", (req, res) => {
    const { authorization } = req.headers;

    if (!authorization) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }

    const token = authorization.split(" ")[1];
    db.get(
        "SELECT user_id FROM sessions WHERE id = ?",
        [token],
        (err, session) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!session) {
                res.status(401).json({ error: "Invalid session" });
                return;
            }

            db.all(
                "SELECT * FROM services WHERE user_id = ? ORDER BY created_at DESC",
                [session.user_id],
                (err, services) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    res.json({
                        success: true,
                        services: services.map((service) => ({
                            ...service,
                            cycle_start_date: service.cycle_start_date,
                            cycle_end_date: service.cycle_end_date,
                            service_date: service.service_date,
                        })),
                    });
                }
            );
        }
    );
});

app.get("/api/services/cycle", (req, res) => {
    const { authorization } = req.headers;
    const { cycleStartDate, cycleEndDate } = req.query; // Corrected to cycleStartDate and cycleEndDate

    if (!authorization) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }

    // Corrected check to use cycleStartDate and cycleEndDate
    if (!cycleStartDate || !cycleEndDate) { 
        res.status(400).json({ error: "cycleStartDate and cycleEndDate query parameters are required" }); // Updated error message for clarity
        return;
    }

    const token = authorization.split(" ")[1];
    db.get(
        "SELECT user_id FROM sessions WHERE id = ?",
        [token],
        (err, session) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!session) {
                res.status(401).json({ error: "Invalid session" });
                return;
            }

            // cycleStartDate and cycleEndDate are already in scope from the top of the handler.
            // The redundant destructuring and check for them here have been removed.

            // Find the cycle_id based on cycleStartDate and cycleEndDate
            db.get("SELECT id FROM cycles WHERE start_date = ? AND end_date = ?", 
                [cycleStartDate, cycleEndDate], 
                (err, cycle) => {
                if (err) {
                    res.status(500).json({ error: `Error finding cycle: ${err.message}` });
                    return;
                }

                if (!cycle) {
                    // If cycle doesn't exist, return empty services array for this period
                    res.json({ success: true, services: [] });
                    return;
                }

                const cycleId = cycle.id;
                const userId = session.user_id;

                // Fetch services for the given user_id and cycle_id, joining with cycles table to get cycle dates
                db.all(
                    `SELECT s.*, c.start_date as cycle_start_date, c.end_date as cycle_end_date
                     FROM services s
                     JOIN cycles c ON s.cycle_id = c.id
                     WHERE s.user_id = ? AND s.cycle_id = ? 
                     ORDER BY s.service_date DESC, s.created_at DESC`,
                    [userId, cycleId],
                    (err, services) => {
                        if (err) {
                            res.status(500).json({ error: `Error fetching services: ${err.message}` });
                            return;
                        }
                        res.json({
                            success: true,
                            services: services // The mapping is no longer needed as dates are selected from join
                        });
                    }
                );
            });
        }
    );
});

app.post("/api/services", (req, res) => {
    const { authorization } = req.headers;
    const {
        clientName,
        serviceType,
        price,
        tip,
        cycleStartDate,
        cycleEndDate,
        serviceDate,
        notes,
    } = req.body;

    if (!authorization) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }

    if (
        !clientName ||
        !serviceType ||
        !price ||
        !cycleStartDate ||
        !cycleEndDate
    ) {
        res.status(400).json({ error: "Required fields are missing" });
        return;
    }

    const token = authorization.split(" ")[1];
    db.get(
        "SELECT user_id FROM sessions WHERE id = ?",
        [token],
        (err, session) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!session) {
                res.status(401).json({ error: "Invalid session" });
                return;
            }

            const userId = session.user_id;

            // Find or create cycle
            db.get(
                "SELECT id FROM cycles WHERE start_date = ? AND end_date = ?",
                [cycleStartDate, cycleEndDate],
                (err, cycle) => {
                    if (err) {
                        res.status(500).json({ error: `Error finding cycle: ${err.message}` });
                        return;
                    }

                    let cycleId;
                    if (cycle) {
                        cycleId = cycle.id;
                        insertService(userId, cycleId);
                    } else {
                        db.run(
                            "INSERT INTO cycles (start_date, end_date) VALUES (?, ?)",
                            [cycleStartDate, cycleEndDate],
                            function (err) {
                                if (err) {
                                    res.status(500).json({ error: `Error creating cycle: ${err.message}` });
                                    return;
                                }
                                cycleId = this.lastID;
                                insertService(userId, cycleId);
                            }
                        );
                    }
                }
            );

            function insertService(userId, cycleId) {
                db.run(
                    `INSERT INTO services (
                        user_id,
                        cycle_id,
                        client_name,
                        service_type,
                        price,
                        tip,
                        service_date,
                        notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                    [
                        userId,
                        cycleId,
                        clientName,
                        serviceType,
                        price,
                        tip || null, // Ensure null if undefined/empty
                        serviceDate || null, // Ensure null if undefined/empty
                        notes || null // Ensure null if undefined/empty
                    ],
                    function (err) {
                        if (err) {
                            res.status(500).json({ error: `Error inserting service: ${err.message}` });
                            return;
                        }
                        // Fetch the created service to return it, joining with cycle for dates
                        db.get(`
                            SELECT s.*, c.start_date as cycle_start_date, c.end_date as cycle_end_date 
                            FROM services s
                            JOIN cycles c ON s.cycle_id = c.id
                            WHERE s.id = ?
                        `, [this.lastID], (err, newService) => {
                            if (err) {
                                res.status(500).json({ error: `Error fetching new service: ${err.message}` });
                                return;
                            }
                            res.status(201).json({ success: true, service: newService });
                        });
                    }
                );
            }
        }
    );
});

app.put("/api/services/:id", (req, res) => {
    const { authorization } = req.headers;
    const { id } = req.params;
    const {
        clientName,
        serviceType,
        price,
        tip,
        cycleStartDate,
        cycleEndDate,
        serviceDate,
        notes,
    } = req.body;

    if (!authorization) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }

    if (!id) {
        res.status(400).json({ error: "Service ID is required" });
        return;
    }

    const token = authorization.split(" ")[1];
    db.get(
        "SELECT user_id FROM sessions WHERE id = ?",
        [token],
        (err, session) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!session) {
                res.status(401).json({ error: "Invalid session" });
                return;
            }

            const userId = session.user_id;

            // Function to perform the actual service update
            const performUpdate = (serviceToUpdate, newCycleId) => {
                const updateFields = {
                    client_name: clientName || serviceToUpdate.client_name,
                    service_type: serviceType || serviceToUpdate.service_type,
                    price: price === undefined ? serviceToUpdate.price : price, // Allow explicit null/0
                    tip: tip === undefined ? serviceToUpdate.tip : tip, // Allow explicit null/0
                    service_date: serviceDate || serviceToUpdate.service_date,
                    notes: notes === undefined ? serviceToUpdate.notes : notes, // Allow explicit null/empty
                    cycle_id: newCycleId || serviceToUpdate.cycle_id, // Update cycle_id if new one is provided
                    updated_at: new Date().toISOString().slice(0, 19).replace('T', ' ')
                };

                const fields = [];
                const values = [];
                for (const [key, value] of Object.entries(updateFields)) {
                    if (value !== undefined) { // Only include fields that are being set
                        fields.push(`${key} = ?`);
                        values.push(value);
                    }
                }
                values.push(id); // For WHERE id = ?

                if (fields.length === 0) {
                    // If nothing to update, just fetch and return current service
                    return db.get(`
                        SELECT s.*, c.start_date as cycle_start_date, c.end_date as cycle_end_date
                        FROM services s
                        JOIN cycles c ON s.cycle_id = c.id
                        WHERE s.id = ? AND s.user_id = ?
                    `, [id, userId], (err, updatedService) => {
                        if (err) return res.status(500).json({ error: `Error fetching service: ${err.message}` });
                        if (!updatedService) return res.status(404).json({ error: "Service not found after attempted update." });
                        return res.json({ success: true, service: updatedService });
                    });
                }

                const sql = `UPDATE services SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;
                
                db.run(sql, [...values, userId], function (err) {
                    if (err) {
                        res.status(500).json({ error: `Error updating service: ${err.message}` });
                        return;
                    }
                    if (this.changes === 0) {
                        res.status(404).json({ error: "Service not found or not authorized to update." });
                        return;
                    }

                    // Fetch the updated service to return it, joining with cycle for dates
                    db.get(`
                        SELECT s.*, c.start_date as cycle_start_date, c.end_date as cycle_end_date
                        FROM services s
                        JOIN cycles c ON s.cycle_id = c.id
                        WHERE s.id = ?
                    `, [id], (err, updatedService) => {
                        if (err) {
                            res.status(500).json({ error: `Error fetching updated service: ${err.message}` });
                            return;
                        }
                        res.json({ success: true, service: updatedService });
                    });
                });
            };

            // First, get the existing service to check ownership and get current cycle_id
            db.get("SELECT * FROM services WHERE id = ? AND user_id = ?", [id, userId], (err, existingService) => {
                if (err) {
                    res.status(500).json({ error: `Error finding service: ${err.message}` });
                    return;
                }
                if (!existingService) {
                    res.status(404).json({ error: "Service not found or not authorized." });
                    return;
                }

                // If cycleStartDate and cycleEndDate are provided, find/create the new cycle
                if (cycleStartDate && cycleEndDate) {
                    db.get("SELECT id FROM cycles WHERE start_date = ? AND end_date = ?", 
                        [cycleStartDate, cycleEndDate], 
                        (err, cycle) => {
                        if (err) {
                            res.status(500).json({ error: `Error finding new cycle: ${err.message}` });
                            return;
                        }
                        if (cycle) {
                            performUpdate(existingService, cycle.id);
                        } else {
                            db.run("INSERT INTO cycles (start_date, end_date) VALUES (?, ?)", 
                                [cycleStartDate, cycleEndDate], 
                                function (err) {
                                if (err) {
                                    res.status(500).json({ error: `Error creating new cycle: ${err.message}` });
                                    return;
                                }
                                performUpdate(existingService, this.lastID);
                            });
                        }
                    });
                } else {
                    // If cycle dates are not provided, update other fields with existing cycle_id
                    performUpdate(existingService, existingService.cycle_id);
                }
            });
        }
    );
});

app.delete("/api/services/:id", (req, res) => {
    const { authorization } = req.headers;
    const { id } = req.params;

    if (!authorization) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }

    if (!id) {
        res.status(400).json({ error: "Service ID is required" });
        return;
    }

    const token = authorization.split(" ")[1];
    db.get(
        "SELECT user_id FROM sessions WHERE id = ?",
        [token],
        (err, session) => {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }

            if (!session) {
                res.status(401).json({ error: "Invalid session" });
                return;
            }

            db.run(
                "DELETE FROM services WHERE id = ? AND user_id = ?",
                [id, session.user_id],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    if (this.changes === 0) {
                        res.status(404).json({ error: "Service not found" });
                        return;
                    }

                    res.json({
                        success: true,
                        message: "Service deleted successfully",
                    });
                }
            );
        }
    );
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
