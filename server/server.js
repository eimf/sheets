const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

// --- Next.js Setup ---
const next = require('next');
const dev = process.env.NODE_ENV !== 'production';
// Point Next to project root
const nextApp = next({ dev, dir: path.resolve(__dirname, '..') });
const handle = nextApp.getRequestHandler();

const app = express();
const port = process.env.PORT || 3001;

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
                customer TEXT, 
                notes TEXT,
                payments TEXT,
                price REAL NOT NULL,
                tip REAL DEFAULT 0,
                date TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
            );`);
            
            // Drop obsolete tables if they exist
            db.run(`DROP TABLE IF EXISTS payment_sources`);
            db.run(`DROP TABLE IF EXISTS service_payment_sources`);

            // Ensure the customer column exists for existing databases
            db.all(`PRAGMA table_info(services)`, [], (err, columns) => {
                if (err) {
                    console.error('Failed to inspect services table', err);
                    return;
                }
                const hasCustomer = columns.some(col => col.name === 'customer');
                const hasNotes = columns.some(col => col.name === 'notes');
                const hasPayments = columns.some(col => col.name === 'payments');
                if (!hasCustomer) {
                    db.run(`ALTER TABLE services ADD COLUMN customer TEXT;`, [], (alterErr)=>{
                        if(alterErr){
                            console.error('Failed to add customer column', alterErr);
                        } else {
                            console.log('Customer column added to services table');
                        }
                    })
                }
                if (!hasNotes) {
                    db.run(`ALTER TABLE services ADD COLUMN notes TEXT;`, [], (alterErr)=>{
                        if(alterErr){
                            console.error('Failed to add notes column', alterErr);
                        } else {
                            console.log('Notes column added to services table');
                        }
                    })
                }
                if (!hasPayments) {
                    db.run(`ALTER TABLE services ADD COLUMN payments TEXT;`, [], (alterErr)=>{
                        if(alterErr){
                            console.error('Failed to add payments column', alterErr);
                        } else {
                            console.log('Payments column added to services table');
                        }
                    })
                }
            });

            console.log("Database tables checked/created/updated.");
        });
    }
});

// --- Middleware --- 
// Configure CORS with credentials support
const corsOptions = {
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://your-production-domain.com'] 
    : ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));
app.use(express.json());
app.use(express.static("public"));

// Admin Middleware
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Admin access required' });
    }
}

// Authentication Middleware
const authenticateUser = (req, res, next) => {
    const { authorization } = req.headers;
    console.log("Authorization header:", authorization); // <-- LOG
    if (!authorization || !authorization.startsWith('Bearer ')) {
        console.log("No or malformed token"); // <-- LOG
        return res.status(401).json({ error: "Authentication required. Token missing or malformed." });
    }
    const token = authorization.split(" ")[1];
    db.get(
        "SELECT user_id AS userId, users.role AS userRole FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?",
        [token],
        (err, session) => {
            if (err) {
                console.log("Session validation error:", err); // <-- LOG
                return res.status(500).json({ error: "Session validation error: " + err.message });
            }
            if (!session) {
                console.log("No session found for token:", token); // <-- LOG
                return res.status(401).json({ error: "Invalid or expired session." });
            }
            console.log("Authenticated user:", session); // <-- LOG
            req.user = { id: session.userId, role: session.userRole }; // <-- FIXED: use camelCase
            next();
        }
    );
};

// --- Admin Endpoints ---
// Get all cycles for admin
app.get('/api/admin/cycles', authenticateUser, requireAdmin, (req, res) => {
    db.all(
        'SELECT id, name, start_date as startDate, end_date as endDate FROM cycles ORDER BY id DESC',
        [],
        (err, cycles) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(cycles);
        }
    );
});

// Get cycle stats for admin
app.get('/api/admin/cycles/:cycleId/stats', authenticateUser, requireAdmin, (req, res) => {
    const { cycleId } = req.params;
    
    const query = `
        SELECT 
            u.stylish,
            SUM(s.price) as total_price,
            SUM(COALESCE(s.tip, 0)) as total_tips,
            COUNT(s.id) as service_count
        FROM services s
        JOIN users u ON s.user_id = u.id
        JOIN cycles c ON s.cycle_id = c.id
        WHERE c.id = ?
        GROUP BY u.stylish
        ORDER BY total_price DESC;
    `;

    db.all(query, [cycleId], (err, stats) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json(stats);
    });
});

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
        console.log("Login attempt for:", email, "Found user:", user); // <-- Add this line
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
    console.log("Fetching profile for user id:", req.user.id, "Type:", typeof req.user.id); // <-- LOG
    db.get("SELECT id, email, stylish, role FROM users WHERE id = ?", [req.user.id], (err, user) => {
        if (err || !user) {
            console.log("User not found or error:", err); // <-- LOG
            return res.status(404).json({ error: "User profile not found." });
        }
        console.log("User profile found:", user); // <-- LOG
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
        db.all("SELECT id, name, customer, notes, payments, price, tip, date, cycle_id as cycleId, user_id as userId FROM services WHERE cycle_id = ? AND user_id = ? ORDER BY date DESC", [cycleId, userId], (serviceErr, services) => {
            if (serviceErr) return res.status(500).json({ error: "Error fetching services: " + serviceErr.message });
            services.forEach(service => {
                if(service.payments){
                    service.payments = JSON.parse(service.payments);
                } else {
                    service.payments = [];
                }
            });
            res.json(services || []);
        });
    });
});

// POST a new service to a specific cycle
app.post("/api/cycles/:cycleId/services", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const userId = req.user.id;
    const { name, customer, notes, payments, price, tip, date } = req.body;

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

        // Determine payments JSON
        let paymentsArray = payments;
        if (!Array.isArray(paymentsArray) || paymentsArray.length === 0) {
            paymentsArray = [{ method: 'card', amount: parseFloat(price) }];
        }
        const paymentsJson = JSON.stringify(paymentsArray);

        const sql = `INSERT INTO services (user_id, cycle_id, name, customer, notes, payments, price, tip, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(sql, [userId, cycleId, name, customer || null, notes || null, paymentsJson, parseFloat(price), parseFloat(tip || 0), date], function (serviceErr) {
            if (serviceErr) return res.status(500).json({ error: "Failed to add service: " + serviceErr.message });
            db.get("SELECT id, name, customer, notes, payments, price, tip, date, cycle_id as cycleId, user_id as userId FROM services WHERE id = ?", [this.lastID], (getErr, newService) => {
                if (getErr || !newService) return res.status(500).json({ error: "Failed to retrieve newly added service." });
                newService.payments = newService.payments ? JSON.parse(newService.payments) : [];
                res.status(201).json(newService);
            });
        });
    });
});

// PUT (update) an existing service
app.put("/api/services/:serviceId", authenticateUser, (req, res) => {
    const { serviceId } = req.params;
    const userId = req.user.id;
    const { name, customer, notes, payments, price, tip, date, cycleId } = req.body; // cycleId can be changed

    if (!name && price === undefined && !date && !cycleId && !customer && !notes && !payments) {
        return res.status(400).json({ error: "No update fields provided." });
    }

    // Validate fields if provided
    if (price !== undefined && (isNaN(parseFloat(price)) || !isFinite(price))) {
        return res.status(400).json({ error: "Price must be a valid number." });
    }
    if (date !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(date) && !/^\d{4}-\d{2}-\d{2}$/.test(date)){
        return res.status(400).json({ error: "Date must be a valid ISO 8601 string." });
    }

    // First, check if the service exists and belongs to the user
    db.get("SELECT id, name, customer, notes, payments, price, tip, date, cycle_id AS cycleId, user_id AS userId FROM services WHERE id = ? AND user_id = ?", [serviceId, userId], (err, service) => {
        if (err) return res.status(500).json({ error: "Error finding service: " + err.message });
        if (!service) return res.status(404).json({ error: "Service not found or not owned by user." });

        // If cycleId is being changed, verify the new cycle exists
        if (cycleId && cycleId !== service.cycleId) {
            db.get("SELECT id FROM cycles WHERE id = ?", [cycleId], (cycleErr, newCycle) => {
                if (cycleErr) return res.status(500).json({ error: "Error verifying new cycle: " + cycleErr.message });
                if (!newCycle) return res.status(400).json({ error: "New cycleId provided does not exist." });
                performServiceUpdate(service, { name, customer, notes, payments, price, tip, date, cycleId }, res);
            });
        } else {
            performServiceUpdate(service, { name, customer, notes, payments, price, tip, date, cycleId: cycleId || service.cycleId }, res);
        }
    });
});

function performServiceUpdate(currentService, updates, res) {
    const newName = updates.name !== undefined ? updates.name : currentService.name;
    const newCustomer = updates.customer !== undefined ? updates.customer : currentService.customer;
    const newNotes = updates.notes !== undefined ? updates.notes : currentService.notes;
    const newPayments = updates.payments !== undefined ? JSON.stringify(updates.payments) : currentService.payments;
    const newPrice = updates.price !== undefined ? parseFloat(updates.price) : currentService.price;
    const newTip = updates.tip !== undefined ? parseFloat(updates.tip) : currentService.tip;
    const newDate = updates.date !== undefined ? updates.date : currentService.date;
    const newCycleId = updates.cycleId !== undefined ? updates.cycleId : (currentService.cycleId || currentService.cycle_id);

    const sql = `UPDATE services SET name = ?, customer = ?, notes = ?, payments = ?, price = ?, tip = ?, date = ?, cycle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
    const params = [newName, newCustomer, newNotes, newPayments, newPrice, newTip, newDate, newCycleId, currentService.id, currentService.userId || currentService.user_id];
    db.run(sql, params, function(err) {
        if (err) return res.status(500).json({ error: "Failed to update service: " + err.message });
        if (this.changes === 0) return res.status(404).json({ error: "Service not found, not owned, or no effective changes made." });
        
        db.get("SELECT id, name, customer, notes, payments, price, tip, date, cycle_id as cycleId, user_id as userId FROM services WHERE id = ?", [currentService.id], (getErr, updatedService) => {
            if (getErr || !updatedService) return res.status(500).json({ error: "Failed to retrieve updated service." });
            if(updatedService && updatedService.payments){
                updatedService.payments = JSON.parse(updatedService.payments);
            }
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
nextApp.prepare().then(() => {
    // Route all unmatched requests to Next.js
    app.all('*', (req, res) => {
        return handle(req, res);
    });

    app.listen(port, '0.0.0.0', () => {
        console.log(`Server running at http://0.0.0.0:${port}`);
    }).on('error', (error) => {
        console.error('Server error:', error);
        if (error.code === 'EADDRINUSE') {
            console.error(`Port ${port} is already in use.`);
        } else {
            process.exit(1);
        }
    });
}).catch(err => {
    console.error('Error preparing Next.js:', err);
    process.exit(1);
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
