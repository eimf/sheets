const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const app = express();
const port = 3001;

// --- Utility Functions ---
const ensureDirectory = async (dirPath) => {
    try {
        await fs.access(dirPath);
    } catch (err) {
        await fs.mkdir(dirPath, { recursive: true });
        console.log(`Created directory: ${dirPath}`);
    }
};

// --- Database Initialization and Schema --- 
let db;
const projectRootScriptsDir = path.resolve(__dirname, '../scripts');
ensureDirectory(projectRootScriptsDir);

const dataDir = path.join(__dirname, 'data');
ensureDirectory(dataDir);

db = new sqlite3.Database(path.join(dataDir, 'sheets.db'), (err) => {
    if (err) {
        console.error("Error opening database:", err);
        process.exit(1);
    } else {
        console.log("Connected to SQLite database");
        db.serialize(() => {
            // Enable foreign key support
            db.run("PRAGMA foreign_keys = ON;");

            // Users table
            db.run(`CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL, -- Store hashed passwords in production
                stylish TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Sessions table
            db.run(`CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
            )`);

            // Cycles table
            db.run(`CREATE TABLE IF NOT EXISTS cycles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT UNIQUE NOT NULL,
                start_date DATE,
                end_date DATE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`);

            // Services table (Simplified)
            db.run(`CREATE TABLE IF NOT EXISTS services (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                cycle_id INTEGER NOT NULL,
                name TEXT NOT NULL, 
                price DECIMAL(10,2) NOT NULL,
                date TEXT NOT NULL, -- ISO date string
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                FOREIGN KEY (cycle_id) REFERENCES cycles (id) ON DELETE CASCADE
            )`);
            
            // Drop obsolete tables if they exist
            db.run(`DROP TABLE IF EXISTS payment_sources`);
            db.run(`DROP TABLE IF EXISTS service_payment_sources`);

            console.log("Database tables checked/created/updated.");
        });
    }
});

// --- Middleware --- 
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Authentication Middleware
const authenticateUser = (req, res, next) => {
    const { authorization } = req.headers;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(401).json({ error: "Authentication required. Token missing or malformed." });
    }
    const token = authorization.split(" ")[1];
    db.get("SELECT user_id, users.role as user_role FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?", [token], (err, session) => {
        if (err) {
            return res.status(500).json({ error: "Session validation error: " + err.message });
        }
        if (!session) {
            return res.status(401).json({ error: "Invalid or expired session." });
        }
        req.user = { id: session.user_id, role: session.user_role }; // Attach user id and role
        next();
    });
};

// --- Auth Endpoints --- 
app.post("/api/auth/register", (req, res) => {
    const { email, password, stylish } = req.body;
    if (!email || !password || !stylish) {
        return res.status(400).json({ error: "Email, password, and stylish name are required" });
    }
    // TODO: Add password hashing (e.g., bcrypt) before storing
    db.run("INSERT INTO users (email, password, stylish) VALUES (?, ?, ?)", [email, password, stylish], function (err) {
        if (err) {
            return res.status(400).json({ error: err.message.includes("UNIQUE constraint failed") ? "Email already exists." : err.message });
        }
        const userId = this.lastID;
        const sessionId = crypto.randomBytes(32).toString('hex');
        db.run("INSERT INTO sessions (id, user_id) VALUES (?, ?)", [sessionId, userId], (sessionErr) => {
            if (sessionErr) {
                return res.status(500).json({ error: "Failed to create session: " + sessionErr.message });
            }
            db.get("SELECT id, email, stylish, role FROM users WHERE id = ?", [userId], (userErr, user) => {
                if (userErr || !user) {
                    return res.status(500).json({ error: "Failed to retrieve user after registration: " + (userErr ? userErr.message : "User not found") });
                }
                res.status(201).json({ token: sessionId, user });
            });
        });
    });
});

app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        return res.status(400).json({ error: "Email and password are required" });
    }
    db.get("SELECT id, email, password, stylish, role FROM users WHERE email = ?", [email], (err, user) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        // TODO: Use bcrypt.compare for password check in production
        if (!user || user.password !== password) {
            return res.status(401).json({ error: "Invalid credentials" });
        }
        const sessionId = crypto.randomBytes(32).toString('hex');
        db.run("INSERT INTO sessions (id, user_id) VALUES (?, ?)", [sessionId, user.id], (sessionErr) => {
            if (sessionErr) {
                return res.status(500).json({ error: "Failed to create session: " + sessionErr.message });
            }
            const { password, ...userWithoutPassword } = user; // Exclude password from response
            res.json({ token: sessionId, user: userWithoutPassword });
        });
    });
});

app.get("/api/auth/profile", authenticateUser, (req, res) => {
    // req.user is attached by authenticateUser middleware
    db.get("SELECT id, email, stylish, role FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
            return res.status(404).json({ error: "User profile not found." });
        }
        res.json(user);
    });
});

// --- Cycle Endpoints --- (Protected by authenticateUser)
app.post("/api/cycles", authenticateUser, (req, res) => {
    const { name, startDate, endDate } = req.body;
    if (!name) {
        return res.status(400).json({ error: "Cycle name is required." });
    }
    const sql = `INSERT INTO cycles (name, start_date, end_date) VALUES (?, ?, ?)`;
    db.run(sql, [name, startDate, endDate], function (err) {
        if (err) {
            return res.status(400).json({ error: err.message.includes("UNIQUE constraint failed") ? "A cycle with this name already exists." : err.message });
        }
        db.get("SELECT id, name, start_date AS startDate, end_date AS endDate FROM cycles WHERE id = ?", [this.lastID], (getErr, cycle) => {
            if (getErr || !cycle) return res.status(500).json({ error: "Failed to retrieve created cycle." });
            res.status(201).json(cycle);
        });
    });
});

app.get("/api/cycles", authenticateUser, (req, res) => {
    // All authenticated users can get the full list of cycles
    db.all("SELECT id, name, start_date AS startDate, end_date AS endDate FROM cycles ORDER BY start_date DESC, name ASC", [], (err, cycles) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(cycles || []);
    });
});

app.get("/api/cycles/:cycleId", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    db.get("SELECT id, name, start_date AS startDate, end_date AS endDate FROM cycles WHERE id = ?", [cycleId], (err, cycle) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (!cycle) {
            return res.status(404).json({ error: "Cycle not found." });
        }
        res.json(cycle);
    });
});

app.put("/api/cycles/:cycleId", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const { name, startDate, endDate } = req.body;

    if (!name && !startDate && !endDate) {
        return res.status(400).json({ error: "No update fields provided (name, startDate, endDate)." });
    }

    // Build query dynamically based on provided fields
    let fieldsToUpdate = [];
    let queryParams = [];
    if (name !== undefined) { fieldsToUpdate.push("name = ?"); queryParams.push(name); }
    if (startDate !== undefined) { fieldsToUpdate.push("start_date = ?"); queryParams.push(startDate); }
    if (endDate !== undefined) { fieldsToUpdate.push("end_date = ?"); queryParams.push(endDate); }
    
    if (fieldsToUpdate.length === 0) {
         return res.status(400).json({ error: "No valid update fields provided." });
    }

    queryParams.push(cycleId);

    const sql = `UPDATE cycles SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
    db.run(sql, queryParams, function (err) {
        if (err) {
            return res.status(400).json({ error: err.message.includes("UNIQUE constraint failed") ? "A cycle with this name already exists." : err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Cycle not found or no changes made." });
        }
        db.get("SELECT id, name, start_date AS startDate, end_date AS endDate FROM cycles WHERE id = ?", [cycleId], (getErr, cycle) => {
            if (getErr || !cycle) return res.status(500).json({ error: "Failed to retrieve updated cycle." });
            res.json(cycle);
        });
    });
});

app.delete("/api/cycles/:cycleId", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    // Foreign key ON DELETE CASCADE for services.cycle_id will handle deleting associated services
    db.run("DELETE FROM cycles WHERE id = ?", [cycleId], function (err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Cycle not found." });
        }
        res.status(200).json({ success: true, message: "Cycle and associated services deleted successfully." });
    });
});

// --- Service Endpoints --- (Protected by authenticateUser)

// GET services for a specific cycle
app.get("/api/cycles/:cycleId/services", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const userId = req.user.id;

    // First, verify the cycle exists
    db.get("SELECT id FROM cycles WHERE id = ?", [cycleId], (err, cycle) => {
        if (err) return res.status(500).json({ error: "Error verifying cycle: " + err.message });
        if (!cycle) return res.status(404).json({ error: "Cycle not found." });

        // Then, get services for that cycle belonging to the authenticated user
        db.all("SELECT id, name, price, date, cycle_id as cycleId, user_id as userId FROM services WHERE cycle_id = ? AND user_id = ? ORDER BY date DESC", [cycleId, userId], (serviceErr, services) => {
            if (serviceErr) return res.status(500).json({ error: "Error fetching services: " + serviceErr.message });
            res.json(services || []);
        });
    });
});

// POST a new service to a specific cycle
app.post("/api/cycles/:cycleId/services", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const userId = req.user.id;
    const { name, price, date } = req.body;

    if (!name || price === undefined || !date) {
        return res.status(400).json({ error: "Missing required fields: name, price, date." });
    }
    if (isNaN(parseFloat(price)) || !isFinite(price)) {
        return res.status(400).json({ error: "Price must be a valid number." });
    }
    // Validate date format (basic ISO 8601 check)
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(date) && !/^\d{4}-\d{2}-\d{2}$/.test(date)){
         // Allow for optional Z, allow for optional milliseconds
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { // Also allow YYYY-MM-DD if time is not included by client
             return res.status(400).json({ error: "Date must be a valid ISO 8601 string (e.g., YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ)." });
        }
    }

    // Verify cycle exists before adding service
    db.get("SELECT id FROM cycles WHERE id = ?", [cycleId], (err, cycle) => {
        if (err) return res.status(500).json({ error: "Error verifying cycle: " + err.message });
        if (!cycle) return res.status(404).json({ error: "Cycle not found. Cannot add service." });

        const sql = `INSERT INTO services (user_id, cycle_id, name, price, date) VALUES (?, ?, ?, ?, ?)`;
        db.run(sql, [userId, cycleId, name, parseFloat(price), date], function (serviceErr) {
            if (serviceErr) return res.status(500).json({ error: "Failed to add service: " + serviceErr.message });
            db.get("SELECT id, name, price, date, cycle_id as cycleId, user_id as userId FROM services WHERE id = ?", [this.lastID], (getErr, newService) => {
                if (getErr || !newService) return res.status(500).json({ error: "Failed to retrieve newly added service." });
                res.status(201).json(newService);
            });
        });
    });
});

// PUT (update) an existing service
app.put("/api/services/:serviceId", authenticateUser, (req, res) => {
    const { serviceId } = req.params;
    const userId = req.user.id;
    const { name, price, date, cycleId } = req.body; // cycleId can be changed

    if (!name && price === undefined && !date && !cycleId) {
        return res.status(400).json({ error: "No update fields provided (name, price, date, cycleId)." });
    }

    // Validate fields if provided
    if (price !== undefined && (isNaN(parseFloat(price)) || !isFinite(price))) {
        return res.status(400).json({ error: "Price must be a valid number." });
    }
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(date) && !/^\d{4}-\d{2}-\d{2}$/.test(date)){
        return res.status(400).json({ error: "Date must be a valid ISO 8601 string." });
    }

    // First, check if the service exists and belongs to the user
    db.get("SELECT * FROM services WHERE id = ? AND user_id = ?", [serviceId, userId], (err, service) => {
        if (err) return res.status(500).json({ error: "Error finding service: " + err.message });
        if (!service) return res.status(404).json({ error: "Service not found or not owned by user." });

        // If cycleId is being changed, verify the new cycle exists
        if (cycleId && cycleId !== service.cycle_id) {
            db.get("SELECT id FROM cycles WHERE id = ?", [cycleId], (cycleErr, newCycle) => {
                if (cycleErr) return res.status(500).json({ error: "Error verifying new cycle: " + cycleErr.message });
                if (!newCycle) return res.status(400).json({ error: "New cycleId provided does not exist." });
                performServiceUpdate(service, { name, price, date, cycleId }, res);
            });
        } else {
            performServiceUpdate(service, { name, price, date, cycleId: cycleId || service.cycle_id }, res);
        }
    });
});

function performServiceUpdate(currentService, updates, res) {
    const newName = updates.name !== undefined ? updates.name : currentService.name;
    const newPrice = updates.price !== undefined ? parseFloat(updates.price) : currentService.price;
    const newDate = updates.date !== undefined ? updates.date : currentService.date;
    const newCycleId = updates.cycleId !== undefined ? updates.cycleId : currentService.cycle_id;

    const sql = `UPDATE services SET name = ?, price = ?, date = ?, cycle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
    db.run(sql, [newName, newPrice, newDate, newCycleId, currentService.id, currentService.user_id], function(err) {
        if (err) return res.status(500).json({ error: "Failed to update service: " + err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Service not found, not owned, or no effective changes made." });
        
        db.get("SELECT id, name, price, date, cycle_id as cycleId, user_id as userId FROM services WHERE id = ?", [currentService.id], (getErr, updatedService) => {
            if (getErr || !updatedService) return res.status(500).json({ error: "Failed to retrieve updated service." });
            res.json(updatedService);
        });
    });
}

// DELETE a service
app.delete("/api/services/:serviceId", authenticateUser, (req, res) => {
    const { serviceId } = req.params;
    const userId = req.user.id;

    // The 'cycleId' from frontend is for cache invalidation, not strictly needed for deletion here
    // but good to be aware it might be sent.

    db.run("DELETE FROM services WHERE id = ? AND user_id = ?", [serviceId, userId], function (err) {
        if (err) {
            return res.status(500).json({ error: "Failed to delete service: " + err.message });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: "Service not found or not owned by user." });
        }
        res.status(200).json({ success: true, message: "Service deleted successfully." });
    });
});

// --- Server Start --- 
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
}).on('error', (error) => {
    console.error('Server error:', error);
    if (error.code === 'EADDRINUSE') {
        console.error(`Port ${port} is already in use.`);
        // Consider using find-free-port or similar if you want to auto-select another port
    } else {
        process.exit(1);
    }
});

// Graceful shutdown
const gracefulShutdown = () => {
    console.log('Received shutdown signal. Closing server...');
    db.close((err) => {
        if (err) console.error('Error closing database:', err.message);
        else console.log('Database connection closed.');
        process.exit(0);
    });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    // Optionally, close server and exit
    // gracefulShutdown(); 
});
