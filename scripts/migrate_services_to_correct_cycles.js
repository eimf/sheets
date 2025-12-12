const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs").promises;

// Database path - matches server.js location
const dbPath = path.resolve(__dirname, "../server/data/sheets.db");

// Check if database exists
async function checkDatabaseExists() {
    try {
        await fs.access(dbPath);
        return true;
    } catch {
        return false;
    }
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1);
    }
    console.log("Connected to the SQLite database.");
    // Enable foreign key support
    db.run("PRAGMA foreign_keys = ON;", (pragmaErr) => {
        if (pragmaErr) {
            console.warn(
                "Warning: Could not enable foreign key constraints:",
                pragmaErr.message
            );
        }
        runMigration();
    });
});

async function runMigration() {
    let backupPath = null;
    try {
        const dbExists = await checkDatabaseExists();
        if (!dbExists) {
            console.error(`Database file not found at: ${dbPath}`);
            process.exit(1);
        }

        console.log(
            "Starting migration to move services to correct cycles based on dates...\n"
        );

        // Step 1: Create backup of database
        backupPath = `${dbPath}.backup.${Date.now()}`;
        try {
            await fs.copyFile(dbPath, backupPath);
            console.log(`✓ Database backup created at: ${backupPath}\n`);
        } catch (backupError) {
            console.error(
                `⚠️  Warning: Could not create backup: ${backupError.message}`
            );
            console.log("Continuing without backup...\n");
            backupPath = null;
        }

        // Step 2: Get all services with their current cycle_id and date
        const services = await dbAllAsync(`
      SELECT 
        id, 
        date, 
        cycle_id as currentCycleId,
        name,
        user_id
      FROM services
      ORDER BY id
    `);

        if (services.length === 0) {
            console.log("No services found in the database.");
            db.close();
            return;
        }

        console.log(`Found ${services.length} services to check.\n`);

        // Step 3: Get all cycles with their date ranges
        const cycles = await dbAllAsync(`
      SELECT 
        id, 
        name,
        start_date as startDate, 
        end_date as endDate
      FROM cycles
      ORDER BY start_date DESC
    `);

        if (cycles.length === 0) {
            console.log(
                "No cycles found in the database. Cannot migrate services."
            );
            db.close();
            return;
        }

        console.log(`Found ${cycles.length} cycles.\n`);

        // Check for overlapping cycles and warn
        const overlappingCycles = [];
        for (let i = 0; i < cycles.length; i++) {
            for (let j = i + 1; j < cycles.length; j++) {
                const cycle1 = cycles[i];
                const cycle2 = cycles[j];
                if (
                    cycle1.startDate &&
                    cycle1.endDate &&
                    cycle2.startDate &&
                    cycle2.endDate
                ) {
                    // Check if cycles overlap
                    if (
                        (cycle1.startDate <= cycle2.endDate &&
                            cycle1.endDate >= cycle2.startDate) ||
                        (cycle2.startDate <= cycle1.endDate &&
                            cycle2.endDate >= cycle1.startDate)
                    ) {
                        overlappingCycles.push({
                            cycle1: { id: cycle1.id, name: cycle1.name },
                            cycle2: { id: cycle2.id, name: cycle2.name },
                        });
                    }
                }
            }
        }
        if (overlappingCycles.length > 0) {
            console.warn(
                `⚠️  Warning: Found ${overlappingCycles.length} overlapping cycle pairs.`
            );
            console.warn(
                "When a service date falls within multiple cycles, the first matching cycle will be used.\n"
            );
        }

        // Step 4: Begin transaction for atomicity
        await dbRunAsync("BEGIN TRANSACTION");

        // Step 5: Process each service
        let movedCount = 0;
        let unchangedCount = 0;
        let errorCount = 0;
        const movedServices = [];
        const servicesWithoutCycle = [];
        const servicesWithMultipleCycles = [];

        for (const service of services) {
            try {
                // Extract date part (YYYY-MM-DD) from service date
                let serviceDateStr = service.date;
                if (!serviceDateStr) {
                    console.warn(
                        `Service ID ${service.id} has no date. Skipping.`
                    );
                    errorCount++;
                    continue;
                }

                // Handle ISO date strings (remove time portion if present)
                if (serviceDateStr.includes("T")) {
                    serviceDateStr = serviceDateStr.split("T")[0];
                }
                // Remove any trailing whitespace
                serviceDateStr = serviceDateStr.trim();
                // Ensure it's in YYYY-MM-DD format
                if (!/^\d{4}-\d{2}-\d{2}$/.test(serviceDateStr)) {
                    console.warn(
                        `Service ID ${service.id} has invalid date format: ${service.date}. Skipping.`
                    );
                    errorCount++;
                    continue;
                }

                // Step 6: Find all cycles that contain this service's date
                // A cycle contains a date if: start_date <= service.date <= end_date
                const matchingCycles = cycles.filter((cycle) => {
                    if (!cycle.startDate || !cycle.endDate) return false;
                    return (
                        serviceDateStr >= cycle.startDate &&
                        serviceDateStr <= cycle.endDate
                    );
                });

                if (matchingCycles.length === 0) {
                    // No cycle found for this date
                    servicesWithoutCycle.push({
                        id: service.id,
                        name: service.name,
                        date: serviceDateStr,
                        currentCycleId: service.currentCycleId,
                    });
                    console.warn(
                        `⚠️  Service ID ${service.id} (${service.name}) with date ${serviceDateStr} does not fall within any cycle's date range.`
                    );
                    errorCount++;
                    continue;
                }

                // If multiple cycles match, warn and use the first one
                // Prefer the cycle that the service is already in if it's one of the matches
                let matchingCycle = matchingCycles[0];
                if (matchingCycles.length > 1) {
                    const currentCycleId = service.currentCycleId
                        ? String(service.currentCycleId)
                        : null;
                    const alreadyInCycle = matchingCycles.find(
                        (c) => String(c.id) === currentCycleId
                    );
                    if (alreadyInCycle) {
                        matchingCycle = alreadyInCycle;
                    } else {
                        servicesWithMultipleCycles.push({
                            id: service.id,
                            name: service.name,
                            date: serviceDateStr,
                            matchingCycles: matchingCycles.map((c) => ({
                                id: c.id,
                                name: c.name,
                            })),
                        });
                        console.warn(
                            `⚠️  Service ID ${service.id} (${service.name}) with date ${serviceDateStr} falls within ${matchingCycles.length} cycles. Using cycle ${matchingCycle.id} (${matchingCycle.name}).`
                        );
                    }
                }

                // Step 7: Verify the cycle still exists (defensive check)
                const cycleExists = await dbGetAsync(
                    "SELECT id FROM cycles WHERE id = ?",
                    [matchingCycle.id]
                );
                if (!cycleExists) {
                    console.error(
                        `Error: Cycle ID ${matchingCycle.id} no longer exists. Skipping service ID ${service.id}.`
                    );
                    errorCount++;
                    continue;
                }

                // Step 8: Check if service needs to be moved
                const currentCycleId = service.currentCycleId
                    ? String(service.currentCycleId)
                    : null;
                const correctCycleId = String(matchingCycle.id);

                if (currentCycleId === correctCycleId) {
                    // Service is already in the correct cycle
                    unchangedCount++;
                    continue;
                }

                // Step 9: Update the service to the correct cycle
                await dbRunAsync(
                    "UPDATE services SET cycle_id = ? WHERE id = ?",
                    [correctCycleId, service.id]
                );

                movedCount++;
                movedServices.push({
                    id: service.id,
                    name: service.name,
                    date: serviceDateStr,
                    oldCycleId: currentCycleId || "NULL",
                    newCycleId: correctCycleId,
                    newCycleName: matchingCycle.name,
                });

                console.log(
                    `✓ Moved service ID ${service.id} (${
                        service.name
                    }) from cycle ${
                        currentCycleId || "NULL"
                    } to cycle ${correctCycleId} (${matchingCycle.name})`
                );
            } catch (error) {
                console.error(
                    `Error processing service ID ${service.id}:`,
                    error.message
                );
                errorCount++;
            }
        }

        // Step 10: Commit or rollback transaction
        // Only rollback if we have excessive errors (more than 10% of services)
        const nonMissingCycleErrors = errorCount - servicesWithoutCycle.length;
        if (nonMissingCycleErrors > services.length * 0.1) {
            // More than 10% non-missing-cycle errors
            console.error(
                "\n⚠️  Too many errors detected. Rolling back transaction."
            );
            await dbRunAsync("ROLLBACK");
            throw new Error(
                "Migration aborted due to excessive errors. All changes have been rolled back."
            );
        } else if (
            errorCount === 0 ||
            servicesWithoutCycle.length === errorCount
        ) {
            // Only errors were services without cycles, which is acceptable
            await dbRunAsync("COMMIT");
            console.log("\n✓ Transaction committed successfully.");
        } else {
            // Some errors occurred but not excessive
            console.warn(
                "\n⚠️  Some errors occurred during migration. Transaction will be committed."
            );
            await dbRunAsync("COMMIT");
        }

        // Step 11: Print summary
        console.log("\n" + "=".repeat(60));
        console.log("MIGRATION SUMMARY");
        console.log("=".repeat(60));
        console.log(`Total services checked: ${services.length}`);
        console.log(`Services moved to correct cycle: ${movedCount}`);
        console.log(`Services already in correct cycle: ${unchangedCount}`);
        console.log(`Services with errors or no matching cycle: ${errorCount}`);
        if (servicesWithMultipleCycles.length > 0) {
            console.log(
                `Services with multiple matching cycles: ${servicesWithMultipleCycles.length}`
            );
        }
        console.log("=".repeat(60));

        if (movedServices.length > 0) {
            console.log("\nServices that were moved:");
            console.log("-".repeat(60));
            movedServices.forEach((s) => {
                console.log(`  Service ID ${s.id} (${s.name})`);
                console.log(`    Date: ${s.date}`);
                console.log(`    Old Cycle: ${s.oldCycleId}`);
                console.log(
                    `    New Cycle: ${s.newCycleId} (${s.newCycleName})`
                );
                console.log("");
            });
        }

        if (servicesWithMultipleCycles.length > 0) {
            console.log("\n⚠️  Services that fell within multiple cycles:");
            console.log("-".repeat(60));
            servicesWithMultipleCycles.forEach((s) => {
                console.log(
                    `  Service ID ${s.id} (${s.name}) - Date: ${s.date}`
                );
                console.log(`    Matching cycles:`);
                s.matchingCycles.forEach((c) => {
                    console.log(`      - Cycle ${c.id} (${c.name})`);
                });
            });
            console.log(
                "\nThese services were assigned to the first matching cycle. Please review manually if needed."
            );
        }

        if (servicesWithoutCycle.length > 0) {
            console.log(
                "\n⚠️  Services that could not be assigned to any cycle:"
            );
            console.log("-".repeat(60));
            servicesWithoutCycle.forEach((s) => {
                console.log(
                    `  Service ID ${s.id} (${s.name}) - Date: ${
                        s.date
                    } - Current Cycle: ${s.currentCycleId || "NULL"}`
                );
            });
            console.log(
                "\nThese services may need manual review or a new cycle needs to be created for their dates."
            );
        }

        console.log("\n✓ Migration completed successfully!");
        if (backupPath) {
            console.log(`\nDatabase backup saved at: ${backupPath}`);
            console.log(
                "You can restore from backup if needed by copying it back to the database location."
            );
        }
    } catch (error) {
        console.error("Migration failed:", error);
        process.exit(1);
    } finally {
        db.close((err) => {
            if (err) {
                console.error(
                    "Error closing database connection:",
                    err.message
                );
            } else {
                console.log("\nDatabase connection closed.");
            }
        });
    }
}

// Promisified helper functions for SQLite operations
function dbRunAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.run(sql, params, function (err) {
            if (err) {
                reject(err);
            } else {
                resolve(this);
            }
        });
    });
}

function dbGetAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.get(sql, params, (err, row) => {
            if (err) {
                reject(err);
            } else {
                resolve(row);
            }
        });
    });
}

function dbAllAsync(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.all(sql, params, (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows || []);
            }
        });
    });
}
