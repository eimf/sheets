const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const cors = require("cors");
const fs = require("fs").promises;
const path = require("path");
const crypto = require("crypto");
// Increase default max event listeners to avoid MaxListenersExceededWarning.
// Adjust as needed; 20 should be sufficient for normal operation while still catching potential leaks.
const { EventEmitter } = require("events");
EventEmitter.defaultMaxListeners = 20;

// --- Next.js Setup ---
const next = require("next");
const dev = process.env.NODE_ENV !== "production";
// Point Next to project root
const nextApp = next({ dev, dir: path.resolve(__dirname, "..") });
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
const projectRootScriptsDir = path.resolve(__dirname, "../scripts");
ensureDirectory(projectRootScriptsDir);

const dataDir = path.join(__dirname, "data");
ensureDirectory(dataDir);

db = new sqlite3.Database(path.join(dataDir, "sheets.db"), (err) => {
    if (err) {
        // Error opening database
        process.exit(1);
    } else {
        // Connected to database
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

            // Products table (Similar to services but without tip and without customer)
            db.run(`CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                cycle_id INTEGER NOT NULL,
                name TEXT NOT NULL,
                notes TEXT,
                payments TEXT,
                price REAL NOT NULL,
                date TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
            );`);

            // Drop obsolete tables if they exist
            db.run(`DROP TABLE IF EXISTS payment_sources`);
            db.run(`DROP TABLE IF EXISTS service_payment_sources`);
            
            // Check if products table has customer column and remove it if it exists
            db.all(`PRAGMA table_info(products)`, [], (err, columns) => {
                if (err) {
                    console.error("Failed to inspect products table:", err);
                    return;
                }
                
                const hasCustomer = columns.some(col => col.name === "customer");
                
                if (hasCustomer) {
                    console.log("Removing customer column from products table...");
                    
                    // SQLite doesn't support DROP COLUMN directly, so we need to:
                    // 1. Create a new table without the customer column
                    // 2. Copy data from old table to new table
                    // 3. Drop old table
                    // 4. Rename new table to original name
                    
                    db.serialize(() => {
                        // Begin transaction for atomicity
                        db.run("BEGIN TRANSACTION");
                        
                        // Create new table without customer column
                        db.run(`CREATE TABLE products_new (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            user_id INTEGER NOT NULL,
                            cycle_id INTEGER NOT NULL,
                            name TEXT NOT NULL,
                            notes TEXT,
                            payments TEXT,
                            price REAL NOT NULL,
                            date TEXT NOT NULL,
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
                            FOREIGN KEY (cycle_id) REFERENCES cycles(id) ON DELETE CASCADE
                        )`);
                        
                        // Copy data from old table to new table
                        db.run(`INSERT INTO products_new 
                            (id, user_id, cycle_id, name, notes, payments, price, date, created_at, updated_at)
                            SELECT id, user_id, cycle_id, name, notes, payments, price, date, created_at, updated_at 
                            FROM products`);
                        
                        // Drop old table
                        db.run(`DROP TABLE products`);
                        
                        // Rename new table to original name
                        db.run(`ALTER TABLE products_new RENAME TO products`);
                        
                        // Commit transaction
                        db.run("COMMIT", (err) => {
                            if (err) {
                                console.error("Failed to migrate products table:", err);
                                db.run("ROLLBACK");
                            } else {
                                console.log("Successfully removed customer column from products table");
                            }
                        });
                    });
                }
            });

            // Ensure the customer column exists for existing databases
            db.all(`PRAGMA table_info(services)`, [], (err, columns) => {
                if (err) {
                    // Failed to inspect services table
                    return;
                }
                const hasCustomer = columns.some(
                    (col) => col.name === "customer"
                );
                const hasNotes = columns.some((col) => col.name === "notes");
                const hasPayments = columns.some(
                    (col) => col.name === "payments"
                );
                if (!hasCustomer) {
                    db.run(
                        `ALTER TABLE services ADD COLUMN customer TEXT;`,
                        [],
                        (alterErr) => {
                            if (alterErr) {
                                // Failed to add customer column
                            } else {
                                // Added customer column to services table
                            }
                        }
                    );
                }
                if (!hasNotes) {
                    db.run(
                        `ALTER TABLE services ADD COLUMN notes TEXT;`,
                        [],
                        (alterErr) => {
                            if (alterErr) {
                                // Failed to add notes column
                            } else {
                                // Added notes column to services table
                            }
                        }
                    );
                }
                if (!hasPayments) {
                    db.run(
                        `ALTER TABLE services ADD COLUMN payments TEXT;`,
                        [],
                        (alterErr) => {
                            if (alterErr) {
                                // Failed to add payments column
                            } else {
                                // Added payments column to services table
                            }
                        }
                    );
                }
            });

            // Database initialization complete
        });
    }
});

// --- Middleware ---
// Configure CORS with credentials support
const corsOptions = {
    origin:
        process.env.NODE_ENV === "production"
            ? ["https://your-production-domain.com"]
            : ["http://localhost:3000", "http://127.0.0.1:3000"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options("*", cors(corsOptions));
app.use(express.json());
app.use(express.static("public"));

// Admin Middleware
function requireAdmin(req, res, next) {
    if (req.user && req.user.role === "admin") {
        next();
    } else {
        res.status(403).json({ error: "Admin access required" });
    }
}

// Authentication Middleware
const authenticateUser = (req, res, next) => {
    const { authorization } = req.headers;
    // Authorization header present
    if (!authorization || !authorization.startsWith("Bearer ")) {
        // No or malformed token
        return res
            .status(401)
            .json({
                error: "Authentication required. Token missing or malformed.",
            });
    }
    const token = authorization.split(" ")[1];
    db.get(
        "SELECT user_id AS userId, users.role AS userRole FROM sessions JOIN users ON users.id = sessions.user_id WHERE sessions.id = ?",
        [token],
        (err, session) => {
            if (err) {
                // Session validation error
                return res
                    .status(500)
                    .json({
                        error: "Session validation error: " + err.message,
                    });
            }
            if (!session) {
                // No session found for token
                return res
                    .status(401)
                    .json({ error: "Invalid or expired session." });
            }
            // User authenticated
            req.user = { id: session.userId, role: session.userRole }; // <-- FIXED: use camelCase
            next();
        }
    );
};

// --- Admin Endpoints ---
// Get all cycles for admin
app.get("/api/admin/cycles", authenticateUser, requireAdmin, (req, res) => {
    db.all(
        "SELECT id, name, start_date as startDate, end_date as endDate FROM cycles ORDER BY id DESC",
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
app.get(
    "/api/admin/cycles/:cycleId/stats",
    authenticateUser,
    requireAdmin,
    (req, res) => {
        const { cycleId } = req.params;

        const query = `
        SELECT 
            u.id as user_id,
            u.stylish,
            (SELECT SUM(s.price) FROM services s WHERE s.user_id = u.id AND s.cycle_id = ?) as total_service_price,
            (SELECT SUM(COALESCE(s.tip, 0)) FROM services s WHERE s.user_id = u.id AND s.cycle_id = ?) as total_tips,
            (SELECT COUNT(s.id) FROM services s WHERE s.user_id = u.id AND s.cycle_id = ?) as service_count,
            (SELECT SUM(p.price) FROM products p WHERE p.user_id = u.id AND p.cycle_id = ?) as total_product_price,
            (SELECT COUNT(p.id) FROM products p WHERE p.user_id = u.id AND p.cycle_id = ?) as product_count
        FROM users u
        WHERE EXISTS (SELECT 1 FROM services s WHERE s.user_id = u.id AND s.cycle_id = ?)
           OR EXISTS (SELECT 1 FROM products p WHERE p.user_id = u.id AND p.cycle_id = ?)
        ORDER BY (total_service_price + COALESCE(total_product_price, 0)) DESC;
    `;

        db.all(query, [cycleId, cycleId, cycleId, cycleId, cycleId, cycleId, cycleId], (err, stats) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(stats);
        });
    }
);

// --- Auth Endpoints ---
app.post("/api/auth/register", (req, res) => {
    const { email, password, stylish } = req.body;
    if (!email || !password || !stylish) {
        return res
            .status(400)
            .json({ error: "Email, password, and stylish name are required" });
    }
    // TODO: Add password hashing (e.g., bcrypt) before storing
    db.run(
        "INSERT INTO users (email, password, stylish) VALUES (?, ?, ?)",
        [email, password, stylish],
        function (err) {
            if (err) {
                return res
                    .status(400)
                    .json({
                        error: err.message.includes("UNIQUE constraint failed")
                            ? "Email already exists."
                            : err.message,
                    });
            }
            const userId = this.lastID;
            const sessionId = crypto.randomBytes(32).toString("hex");
            db.run(
                "INSERT INTO sessions (id, user_id) VALUES (?, ?)",
                [sessionId, userId],
                (sessionErr) => {
                    if (sessionErr) {
                        return res
                            .status(500)
                            .json({
                                error:
                                    "Failed to create session: " +
                                    sessionErr.message,
                            });
                    }
                    db.get(
                        "SELECT id, email, stylish, role FROM users WHERE id = ?",
                        [userId],
                        (userErr, user) => {
                            if (userErr || !user) {
                                return res
                                    .status(500)
                                    .json({
                                        error:
                                            "Failed to retrieve user after registration: " +
                                            (userErr
                                                ? userErr.message
                                                : "User not found"),
                                    });
                            }
                            res.status(201).json({ token: sessionId, user });
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
        return res
            .status(400)
            .json({ error: "Email and password are required" });
    }
    db.get(
        "SELECT id, email, password, stylish, role FROM users WHERE email = ?",
        [email],
        (err, user) => {
            // Login attempt processed
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            // TODO: Use bcrypt.compare for password check in production
            if (!user || user.password !== password) {
                return res.status(401).json({ error: "Invalid credentials" });
            }
            const sessionId = crypto.randomBytes(32).toString("hex");
            db.run(
                "INSERT INTO sessions (id, user_id) VALUES (?, ?)",
                [sessionId, user.id],
                (sessionErr) => {
                    if (sessionErr) {
                        return res
                            .status(500)
                            .json({
                                error:
                                    "Failed to create session: " +
                                    sessionErr.message,
                            });
                    }
                    const { password, ...userWithoutPassword } = user; // Exclude password from response
                    res.json({ token: sessionId, user: userWithoutPassword });
                }
            );
        }
    );
});

app.get("/api/auth/profile", authenticateUser, (req, res) => {
    // Fetching user profile
    db.get(
        "SELECT id, email, stylish, role FROM users WHERE id = ?",
        [req.user.id],
        (err, user) => {
            if (err || !user) {
                return res
                    .status(404)
                    .json({ error: "User profile not found." });
            }
            res.json(user);
        }
    );
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
            return res
                .status(400)
                .json({
                    error: err.message.includes("UNIQUE constraint failed")
                        ? "A cycle with this name already exists."
                        : err.message,
                });
        }
        db.get(
            "SELECT id, name, start_date AS startDate, end_date AS endDate FROM cycles WHERE id = ?",
            [this.lastID],
            (getErr, cycle) => {
                if (getErr || !cycle)
                    return res
                        .status(500)
                        .json({ error: "Failed to retrieve created cycle." });
                res.status(201).json(cycle);
            }
        );
    });
});

app.get("/api/cycles", authenticateUser, (req, res) => {
    // All authenticated users can get the full list of cycles
    db.all(
        "SELECT id, name, start_date AS startDate, end_date AS endDate FROM cycles ORDER BY start_date DESC, name ASC",
        [],
        (err, cycles) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json(cycles || []);
        }
    );
});

app.get("/api/cycles/:cycleId", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    db.get(
        "SELECT id, name, start_date AS startDate, end_date AS endDate FROM cycles WHERE id = ?",
        [cycleId],
        (err, cycle) => {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            if (!cycle) {
                return res.status(404).json({ error: "Cycle not found." });
            }
            res.json(cycle);
        }
    );
});

app.put("/api/cycles/:cycleId", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const { name, startDate, endDate } = req.body;

    if (!name && !startDate && !endDate) {
        return res
            .status(400)
            .json({
                error: "No update fields provided (name, startDate, endDate).",
            });
    }

    // Build query dynamically based on provided fields
    let fieldsToUpdate = [];
    let queryParams = [];
    if (name !== undefined) {
        fieldsToUpdate.push("name = ?");
        queryParams.push(name);
    }
    if (startDate !== undefined) {
        fieldsToUpdate.push("start_date = ?");
        queryParams.push(startDate);
    }
    if (endDate !== undefined) {
        fieldsToUpdate.push("end_date = ?");
        queryParams.push(endDate);
    }

    if (fieldsToUpdate.length === 0) {
        return res
            .status(400)
            .json({ error: "No valid update fields provided." });
    }

    queryParams.push(cycleId);

    const sql = `UPDATE cycles SET ${fieldsToUpdate.join(", ")} WHERE id = ?`;
    db.run(sql, queryParams, function (err) {
        if (err) {
            return res
                .status(400)
                .json({
                    error: err.message.includes("UNIQUE constraint failed")
                        ? "A cycle with this name already exists."
                        : err.message,
                });
        }
        if (this.changes === 0) {
            return res
                .status(404)
                .json({ error: "Cycle not found or no changes made." });
        }
        db.get(
            "SELECT id, name, start_date AS startDate, end_date AS endDate FROM cycles WHERE id = ?",
            [cycleId],
            (getErr, cycle) => {
                if (getErr || !cycle)
                    return res
                        .status(500)
                        .json({ error: "Failed to retrieve updated cycle." });
                res.json(cycle);
            }
        );
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
        res.status(200).json({
            success: true,
            message: "Cycle and associated services deleted successfully.",
        });
    });
});

// --- Service Endpoints --- (Protected by authenticateUser)

// GET services for a specific cycle
app.get("/api/cycles/:cycleId/services", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role; // Assuming 'role' is available on req.user

    // First, verify the cycle exists
    db.get("SELECT id FROM cycles WHERE id = ?", [cycleId], (err, cycle) => {
        if (err)
            return res
                .status(500)
                .json({ error: "Error verifying cycle: " + err.message });
        if (!cycle) return res.status(404).json({ error: "Cycle not found." });

        let sqlQuery =
            "SELECT id, name, customer, notes, payments, price, tip, date, cycle_id as cycleId, user_id as userId FROM services WHERE cycle_id = ?";
        const queryParams = [cycleId];

        // Admin can optionally filter by specific user via query param ?userId=123
        if (userRole === "admin" && req.query.userId) {
            sqlQuery += " AND user_id = ?";
            queryParams.push(req.query.userId);
        } else if (userRole !== "admin") {
            // Regular users only see their own services
            sqlQuery += " AND user_id = ?";
            queryParams.push(userId);
        }
        sqlQuery += " ORDER BY date DESC";

        db.all(sqlQuery, queryParams, (serviceErr, services) => {
            if (serviceErr)
                return res
                    .status(500)
                    .json({
                        error: "Error fetching services: " + serviceErr.message,
                    });

            const processedServices = (services || []).map((service) => {
                let parsedPayments = [];
                if (service.payments) {
                    try {
                        parsedPayments = JSON.parse(service.payments);
                    } catch (e) {
                        console.error(
                            "Error parsing payments for service ID " +
                                service.id +
                                ":",
                            e
                        );
                        // parsedPayments remains []
                    }
                }
                return { ...service, payments: parsedPayments };
            });
            res.json(processedServices);
        });
    });
});

// GET all services for the authenticated user
app.get("/api/services", authenticateUser, (req, res) => {
    const userId = req.user.id; // From authenticateUser middleware

    db.all(
        "SELECT id, name, customer, notes, payments, price, tip, date, cycle_id as cycleId, user_id as userId FROM services WHERE user_id = ? ORDER BY date DESC",
        [userId],
        (err, services) => {
            if (err) {
                return res
                    .status(500)
                    .json({ error: "Error fetching services: " + err.message });
            }
            services.forEach((service) => {
                if (service.payments) {
                    try {
                        service.payments = JSON.parse(service.payments);
                    } catch (e) {
                        // Error parsing payments for service
                        service.payments = []; // Default to empty array on parse error
                    }
                } else {
                    service.payments = [];
                }
            });
            res.json(services);
        }
    );
});

// POST a new service to a specific cycle
app.post("/api/cycles/:cycleId/services", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const userId = req.user.id;
    const { name, customer, notes, payments, price, tip, date } = req.body;

    if (!name || price === undefined || !date) {
        return res
            .status(400)
            .json({ error: "Missing required fields: name, price, date." });
    }
    if (isNaN(parseFloat(price)) || !isFinite(price)) {
        return res.status(400).json({ error: "Price must be a valid number." });
    }
    // Validate date format (basic ISO 8601 check)
    if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(date) &&
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        // Allow for optional Z, allow for optional milliseconds
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            // Also allow YYYY-MM-DD if time is not included by client
            return res
                .status(400)
                .json({
                    error: "Date must be a valid ISO 8601 string (e.g., YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ).",
                });
        }
    }

    // Verify cycle exists before adding service
    db.get("SELECT id FROM cycles WHERE id = ?", [cycleId], (err, cycle) => {
        if (err)
            return res
                .status(500)
                .json({ error: "Error verifying cycle: " + err.message });
        if (!cycle)
            return res
                .status(404)
                .json({ error: "Cycle not found. Cannot add service." });

        // Determine payments JSON
        let paymentsArray = payments;
        if (!Array.isArray(paymentsArray) || paymentsArray.length === 0) {
            paymentsArray = [{ method: "card", amount: parseFloat(price) }];
        }
        const paymentsJson = JSON.stringify(paymentsArray);

        const sql = `INSERT INTO services (user_id, cycle_id, name, customer, notes, payments, price, tip, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
        db.run(
            sql,
            [
                userId,
                cycleId,
                name,
                customer || null,
                notes || null,
                paymentsJson,
                parseFloat(price),
                parseFloat(tip || 0),
                date,
            ],
            function (serviceErr) {
                if (serviceErr)
                    return res
                        .status(500)
                        .json({
                            error:
                                "Failed to add service: " + serviceErr.message,
                        });
                db.get(
                    "SELECT id, name, customer, notes, payments, price, tip, date, cycle_id as cycleId, user_id as userId FROM services WHERE id = ?",
                    [this.lastID],
                    (getErr, newService) => {
                        if (getErr || !newService)
                            return res
                                .status(500)
                                .json({
                                    error: "Failed to retrieve newly added service.",
                                });
                        newService.payments = newService.payments
                            ? JSON.parse(newService.payments)
                            : [];
                        res.status(201).json(newService);
                    }
                );
            }
        );
    });
});

// PUT (update) an existing service
app.put("/api/services/:serviceId", authenticateUser, (req, res) => {
    const { serviceId } = req.params;
    const userId = req.user.id;
    const { name, customer, notes, payments, price, tip, date, cycleId } =
        req.body; // cycleId can be changed

    if (
        !name &&
        price === undefined &&
        !date &&
        !cycleId &&
        !customer &&
        !notes &&
        !payments
    ) {
        return res.status(400).json({ error: "No update fields provided." });
    }

    // Validate fields if provided
    if (price !== undefined && (isNaN(parseFloat(price)) || !isFinite(price))) {
        return res.status(400).json({ error: "Price must be a valid number." });
    }
    if (
        date !== undefined &&
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(date) &&
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return res
            .status(400)
            .json({ error: "Date must be a valid ISO 8601 string." });
    }

    // First, check if the service exists and belongs to the user
    db.get(
        "SELECT id, name, customer, notes, payments, price, tip, date, cycle_id AS cycleId, user_id AS userId FROM services WHERE id = ? AND user_id = ?",
        [serviceId, userId],
        (err, service) => {
            if (err)
                return res
                    .status(500)
                    .json({ error: "Error finding service: " + err.message });
            if (!service)
                return res
                    .status(404)
                    .json({ error: "Service not found or not owned by user." });

            // If cycleId is being changed, verify the new cycle exists
            if (cycleId && cycleId !== service.cycleId) {
                db.get(
                    "SELECT id FROM cycles WHERE id = ?",
                    [cycleId],
                    (cycleErr, newCycle) => {
                        if (cycleErr)
                            return res
                                .status(500)
                                .json({
                                    error:
                                        "Error verifying new cycle: " +
                                        cycleErr.message,
                                });
                        if (!newCycle)
                            return res
                                .status(400)
                                .json({
                                    error: "New cycleId provided does not exist.",
                                });
                        performServiceUpdate(
                            service,
                            {
                                name,
                                customer,
                                notes,
                                payments,
                                price,
                                tip,
                                date,
                                cycleId,
                            },
                            res
                        );
                    }
                );
            } else {
                performServiceUpdate(
                    service,
                    {
                        name,
                        customer,
                        notes,
                        payments,
                        price,
                        tip,
                        date,
                        cycleId: cycleId || service.cycleId,
                    },
                    res
                );
            }
        }
    );
});

function performServiceUpdate(currentService, updates, res) {
    const newName =
        updates.name !== undefined ? updates.name : currentService.name;
    const newCustomer =
        updates.customer !== undefined
            ? updates.customer
            : currentService.customer;
    const newNotes =
        updates.notes !== undefined ? updates.notes : currentService.notes;
    const newPayments =
        updates.payments !== undefined
            ? JSON.stringify(updates.payments)
            : currentService.payments;
    const newPrice =
        updates.price !== undefined
            ? parseFloat(updates.price)
            : currentService.price;
    const newTip =
        updates.tip !== undefined
            ? parseFloat(updates.tip)
            : currentService.tip;
    const newDate =
        updates.date !== undefined ? updates.date : currentService.date;
    const newCycleId =
        updates.cycleId !== undefined
            ? updates.cycleId
            : currentService.cycleId || currentService.cycle_id;

    const sql = `UPDATE services SET name = ?, customer = ?, notes = ?, payments = ?, price = ?, tip = ?, date = ?, cycle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
    const params = [
        newName,
        newCustomer,
        newNotes,
        newPayments,
        newPrice,
        newTip,
        newDate,
        newCycleId,
        currentService.id,
        currentService.userId || currentService.user_id,
    ];
    db.run(sql, params, function (err) {
        if (err)
            return res
                .status(500)
                .json({ error: "Failed to update service: " + err.message });
        if (this.changes === 0)
            return res
                .status(404)
                .json({
                    error: "Service not found, not owned, or no effective changes made.",
                });

        db.get(
            "SELECT id, name, customer, notes, payments, price, tip, date, cycle_id as cycleId, user_id as userId FROM services WHERE id = ?",
            [currentService.id],
            (getErr, updatedService) => {
                if (getErr || !updatedService)
                    return res
                        .status(500)
                        .json({ error: "Failed to retrieve updated service." });
                if (updatedService && updatedService.payments) {
                    updatedService.payments = JSON.parse(
                        updatedService.payments
                    );
                }
                res.json(updatedService);
            }
        );
    });
}

// DELETE a service
app.delete("/api/services/:serviceId", authenticateUser, (req, res) => {
    const { serviceId } = req.params;
    const userId = req.user.id;

    // The 'cycleId' from frontend is for cache invalidation, not strictly needed for deletion here
    // but good to be aware it might be sent.

    db.run(
        "DELETE FROM services WHERE id = ? AND user_id = ?",
        [serviceId, userId],
        function (err) {
            if (err) {
                return res
                    .status(500)
                    .json({
                        error: "Failed to delete service: " + err.message,
                    });
            }
            if (this.changes === 0) {
                return res
                    .status(404)
                    .json({ error: "Service not found or not owned by user." });
            }
            res.status(200).json({
                success: true,
                message: "Service deleted successfully.",
            });
        }
    );
});

// --- Product Endpoints --- (Protected by authenticateUser)

// GET products for a specific cycle
app.get("/api/cycles/:cycleId/products", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // First, verify the cycle exists
    db.get("SELECT id FROM cycles WHERE id = ?", [cycleId], (err, cycle) => {
        if (err)
            return res
                .status(500)
                .json({ error: "Error verifying cycle: " + err.message });
        if (!cycle) return res.status(404).json({ error: "Cycle not found." });

        let sqlQuery =
            "SELECT id, name, notes, payments, price, date, cycle_id as cycleId, user_id as userId FROM products WHERE cycle_id = ?";
        const queryParams = [cycleId];

        // Admin can optionally filter by specific user via query param ?userId=123
        if (userRole === "admin" && req.query.userId) {
            sqlQuery += " AND user_id = ?";
            queryParams.push(req.query.userId);
        } else if (userRole !== "admin") {
            // Regular users only see their own products
            sqlQuery += " AND user_id = ?";
            queryParams.push(userId);
        }
        sqlQuery += " ORDER BY date DESC";

        db.all(sqlQuery, queryParams, (productErr, products) => {
            if (productErr)
                return res
                    .status(500)
                    .json({
                        error: "Error fetching products: " + productErr.message,
                    });

            const processedProducts = (products || []).map((product) => {
                let parsedPayments = [];
                if (product.payments) {
                    try {
                        parsedPayments = JSON.parse(product.payments);
                    } catch (e) {
                        console.error(
                            "Error parsing payments for product ID " +
                                product.id +
                                ":",
                            e
                        );
                        // parsedPayments remains []
                    }
                }
                return { ...product, payments: parsedPayments };
            });
            res.json(processedProducts);
        });
    });
});

// GET all products for the authenticated user
app.get("/api/products", authenticateUser, (req, res) => {
    const userId = req.user.id; // From authenticateUser middleware

    db.all(
        "SELECT id, name, notes, payments, price, date, cycle_id as cycleId, user_id as userId FROM products WHERE user_id = ? ORDER BY date DESC",
        [userId],
        (err, products) => {
            if (err) {
                return res
                    .status(500)
                    .json({ error: "Error fetching products: " + err.message });
            }
            products.forEach((product) => {
                if (product.payments) {
                    try {
                        product.payments = JSON.parse(product.payments);
                    } catch (e) {
                        // Error parsing payments for product
                        product.payments = []; // Default to empty array on parse error
                    }
                } else {
                    product.payments = [];
                }
            });
            res.json(products);
        }
    );
});

// GET a specific product by ID
app.get("/api/products/:productId", authenticateUser, (req, res) => {
    const { productId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    let sql = "SELECT id, name, notes, payments, price, date, cycle_id as cycleId, user_id as userId FROM products WHERE id = ?";
    const params = [productId];
    
    // Regular users can only view their own products
    if (userRole !== "admin") {
        sql += " AND user_id = ?";
        params.push(userId);
    }

    db.get(sql, params, (err, product) => {
        if (err) {
            return res.status(500).json({ error: "Error fetching product: " + err.message });
        }
        if (!product) {
            return res.status(404).json({ error: "Product not found or not accessible." });
        }

        // Parse payments JSON
        if (product.payments) {
            try {
                product.payments = JSON.parse(product.payments);
            } catch (e) {
                product.payments = [];
            }
        } else {
            product.payments = [];
        }

        res.json(product);
    });
});

// POST a new product to a specific cycle
app.post("/api/cycles/:cycleId/products", authenticateUser, (req, res) => {
    const { cycleId } = req.params;
    const userId = req.user.id;
    const { name, notes, payments, price, date } = req.body;

    if (!name || price === undefined || !date) {
        return res
            .status(400)
            .json({ error: "Missing required fields: name, price, date." });
    }
    if (isNaN(parseFloat(price)) || !isFinite(price)) {
        return res.status(400).json({ error: "Price must be a valid number." });
    }
    // Validate date format (basic ISO 8601 check)
    if (
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(date) &&
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        // Allow for optional Z, allow for optional milliseconds
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            // Also allow YYYY-MM-DD if time is not included by client
            return res
                .status(400)
                .json({
                    error: "Date must be a valid ISO 8601 string (e.g., YYYY-MM-DD or YYYY-MM-DDTHH:mm:ssZ).",
                });
        }
    }

    // Verify cycle exists before adding product
    db.get("SELECT id FROM cycles WHERE id = ?", [cycleId], (err, cycle) => {
        if (err)
            return res
                .status(500)
                .json({ error: "Error verifying cycle: " + err.message });
        if (!cycle)
            return res
                .status(404)
                .json({ error: "Cycle not found. Cannot add product." });

        // Determine payments JSON
        let paymentsArray = payments;
        if (!Array.isArray(paymentsArray) || paymentsArray.length === 0) {
            paymentsArray = [{ method: "card", amount: parseFloat(price) }];
        }
        const paymentsJson = JSON.stringify(paymentsArray);

        const sql = `INSERT INTO products (user_id, cycle_id, name, notes, payments, price, date) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        db.run(
            sql,
            [
                userId,
                cycleId,
                name,
                notes || null,
                paymentsJson,
                parseFloat(price),
                date,
            ],
            function (productErr) {
                if (productErr)
                    return res
                        .status(500)
                        .json({
                            error:
                                "Failed to add product: " + productErr.message,
                        });
                db.get(
                    "SELECT id, name, notes, payments, price, date, cycle_id as cycleId, user_id as userId FROM products WHERE id = ?",
                    [this.lastID],
                    (getErr, newProduct) => {
                        if (getErr || !newProduct)
                            return res
                                .status(500)
                                .json({
                                    error: "Failed to retrieve newly added product.",
                                });
                        newProduct.payments = newProduct.payments
                            ? JSON.parse(newProduct.payments)
                            : [];
                        res.status(201).json(newProduct);
                    }
                );
            }
        );
    });
});

// PUT (update) an existing product
app.put("/api/products/:productId", authenticateUser, (req, res) => {
    const { productId } = req.params;
    const userId = req.user.id;
    const { name, notes, payments, price, date, cycleId } = req.body; 

    if (
        !name &&
        price === undefined &&
        !date &&
        !cycleId &&
        !notes &&
        !payments
    ) {
        return res.status(400).json({ error: "No update fields provided." });
    }

    // Validate fields if provided
    if (price !== undefined && (isNaN(parseFloat(price)) || !isFinite(price))) {
        return res.status(400).json({ error: "Price must be a valid number." });
    }
    if (
        date !== undefined &&
        !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?$/.test(date) &&
        !/^\d{4}-\d{2}-\d{2}$/.test(date)
    ) {
        return res
            .status(400)
            .json({ error: "Date must be a valid ISO 8601 string." });
    }

    // First, check if the product exists and belongs to the user
    db.get(
        "SELECT id, name, notes, payments, price, date, cycle_id AS cycleId, user_id AS userId FROM products WHERE id = ? AND user_id = ?",
        [productId, userId],
        (err, product) => {
            if (err)
                return res
                    .status(500)
                    .json({ error: "Error finding product: " + err.message });
            if (!product)
                return res
                    .status(404)
                    .json({ error: "Product not found or not owned by user." });

            // If cycleId is being changed, verify the new cycle exists
            if (cycleId && cycleId !== product.cycleId) {
                db.get(
                    "SELECT id FROM cycles WHERE id = ?",
                    [cycleId],
                    (cycleErr, newCycle) => {
                        if (cycleErr)
                            return res
                                .status(500)
                                .json({
                                    error:
                                        "Error verifying new cycle: " +
                                        cycleErr.message,
                                });
                        if (!newCycle)
                            return res
                                .status(400)
                                .json({
                                    error: "New cycleId provided does not exist.",
                                });
                        performProductUpdate(
                            product,
                            {
                                name,
                                notes,
                                payments,
                                price,
                                date,
                                cycleId,
                            },
                            res
                        );
                    }
                );
            } else {
                performProductUpdate(
                    product,
                    {
                        name,
                        notes,
                        payments,
                        price,
                        date,
                        cycleId: cycleId || product.cycleId,
                    },
                    res
                );
            }
        }
    );
});

function performProductUpdate(currentProduct, updates, res) {
    const newName =
        updates.name !== undefined ? updates.name : currentProduct.name;
    const newNotes =
        updates.notes !== undefined ? updates.notes : currentProduct.notes;
    const newPayments =
        updates.payments !== undefined
            ? JSON.stringify(updates.payments)
            : currentProduct.payments;
    const newPrice =
        updates.price !== undefined
            ? parseFloat(updates.price)
            : currentProduct.price;
    const newDate =
        updates.date !== undefined ? updates.date : currentProduct.date;
    const newCycleId =
        updates.cycleId !== undefined
            ? updates.cycleId
            : currentProduct.cycleId || currentProduct.cycle_id;

    const sql = `UPDATE products SET name = ?, notes = ?, payments = ?, price = ?, date = ?, cycle_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?`;
    const params = [
        newName,
        newNotes,
        newPayments,
        newPrice,
        newDate,
        newCycleId,
        currentProduct.id,
        currentProduct.userId || currentProduct.user_id,
    ];
    db.run(sql, params, function (err) {
        if (err)
            return res
                .status(500)
                .json({ error: "Failed to update product: " + err.message });
        if (this.changes === 0)
            return res
                .status(404)
                .json({
                    error: "Product not found, not owned, or no effective changes made.",
                });

        db.get(
            "SELECT id, name, notes, payments, price, date, cycle_id as cycleId, user_id as userId FROM products WHERE id = ?",
            [currentProduct.id],
            (getErr, updatedProduct) => {
                if (getErr || !updatedProduct)
                    return res
                        .status(500)
                        .json({ error: "Failed to retrieve updated product." });
                if (updatedProduct && updatedProduct.payments) {
                    updatedProduct.payments = JSON.parse(
                        updatedProduct.payments
                    );
                }
                res.json(updatedProduct);
            }
        );
    });
}

// DELETE a product
app.delete("/api/products/:productId", authenticateUser, (req, res) => {
    const { productId } = req.params;
    const userId = req.user.id;

    db.run(
        "DELETE FROM products WHERE id = ? AND user_id = ?",
        [productId, userId],
        function (err) {
            if (err) {
                return res
                    .status(500)
                    .json({
                        error: "Failed to delete product: " + err.message,
                    });
            }
            if (this.changes === 0) {
                return res
                    .status(404)
                    .json({ error: "Product not found or not owned by user." });
            }
            res.status(200).json({
                success: true,
                message: "Product deleted successfully.",
            });
        }
    );
});

// --- Server Start ---
nextApp
    .prepare()
    .then(() => {
        // Route all unmatched requests to Next.js
        app.all("*", (req, res) => {
            return handle(req, res);
        });

        app.listen(port, "0.0.0.0", () => {
            // Server started
        }).on("error", (error) => {
            // Server error
            if (error.code === "EADDRINUSE") {
                // Port in use
            } else {
                process.exit(1);
            }
        });
    })
    .catch((err) => {
        // Error preparing Next.js
        process.exit(1);
    });

// Graceful shutdown
const gracefulShutdown = () => {
    // Shutting down server
    db.close((err) => {
        // Database connection closed
        process.exit(0);
    });
};

process.on("SIGTERM", gracefulShutdown);
process.on("SIGINT", gracefulShutdown);
process.on("unhandledRejection", (reason, promise) => {
    // Unhandled rejection
    console.log(`Unhandled Rejection at:`, promise, `reason:`, reason);
});

nextApp.prepare().then(() => {
    // Handle all other requests with Next.js
    app.all("*", (req, res) => handle(req, res));
    app.listen(port, () => {
        // API server started
    });
});
