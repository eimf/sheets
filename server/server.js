const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");

const app = express();
const port = 3001; // Using a different port than Next.js

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Initialize SQLite database
const crypto = require("crypto");
const db = new sqlite3.Database('data/sheets.db', (err) => {
    if (err) {
        console.error("Error opening database:", err);
    } else {
        console.log("Connected to SQLite database");
    }
});

// Create tables
const createTables = () => {
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

    // Sessions table for authentication
    db.run(`CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
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

// Create tables when the server starts
createTables();

// Auth endpoints
app.post("/api/auth/register", (req, res) => {
    const { username, email, password, fullName } = req.body;

    if (!username || !email || !password || !fullName) {
        res.status(400).json({ error: "All fields are required" });
        return;
    }

    // Hash password (in production, use bcrypt)
    const hashedPassword = password; // In production, use bcrypt.hashSync()

    db.run(
        "INSERT INTO users (username, email, password, full_name) VALUES (?, ?, ?, ?)",
        [username, email, hashedPassword, fullName],
        function (err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed")) {
                    res.status(400).json({
                        error: "Username or email already exists",
                    });
                } else {
                    res.status(500).json({ error: err.message });
                }
                return;
            }

            res.json({
                success: true,
                message: "User registered successfully",
            });
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
                    username: user.username,
                    email: user.email,
                    fullName: user.full_name,
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
    const { cycleStart, cycleEnd } = req.query;

    if (!authorization) {
        res.status(401).json({ error: "Authentication required" });
        return;
    }

    if (!cycleStart || !cycleEnd) {
        res.status(400).json({ error: "Cycle dates are required" });
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
                "SELECT * FROM services WHERE user_id = ? AND cycle_start_date <= ? AND cycle_end_date >= ? ORDER BY created_at DESC",
                [session.user_id, cycleEnd, cycleStart],
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

app.post("/api/services", (req, res) => {
    const { authorization } = req.headers;
    const {
        clientName,
        serviceType,
        price,
        commission,
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

            db.run(
                "INSERT INTO services (user_id, client_name, service_type, price, commission, cycle_start_date, cycle_end_date, service_date, notes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                [
                    session.user_id,
                    clientName,
                    serviceType,
                    price,
                    commission || null,
                    cycleStartDate,
                    cycleEndDate,
                    serviceDate || null,
                    notes || null,
                ],
                function (err) {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    res.json({
                        success: true,
                        message: "Service created successfully",
                        serviceId: this.lastID,
                    });
                }
            );
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
        commission,
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

            db.get(
                "SELECT * FROM services WHERE id = ? AND user_id = ?",
                [id, session.user_id],
                (err, service) => {
                    if (err) {
                        res.status(500).json({ error: err.message });
                        return;
                    }

                    if (!service) {
                        res.status(404).json({ error: "Service not found" });
                        return;
                    }

                    db.run(
                        "UPDATE services SET client_name = ?, service_type = ?, price = ?, commission = ?, cycle_start_date = ?, cycle_end_date = ?, service_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        [
                            clientName || service.client_name,
                            serviceType || service.service_type,
                            price || service.price,
                            commission || service.commission,
                            cycleStartDate || service.cycle_start_date,
                            cycleEndDate || service.cycle_end_date,
                            serviceDate || service.service_date,
                            notes || service.notes,
                            id,
                        ],
                        function (err) {
                            if (err) {
                                res.status(500).json({ error: err.message });
                                return;
                            }

                            res.json({
                                success: true,
                                message: "Service updated successfully",
                            });
                        }
                    );
                }
            );
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
