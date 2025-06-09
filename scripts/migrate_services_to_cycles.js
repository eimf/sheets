const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Adjust this path if your database file is located elsewhere relative to the scripts directory
const dbPath = path.resolve(__dirname, '../server/database.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
    process.exit(1); // Exit if DB connection fails
  }
  console.log('Connected to the SQLite database.');
  runMigration();
});

async function runMigration() {
  try {
    console.log('Starting database migration for services to cycles...');

    // Step 1: Ensure 'cycles' table exists (created by server.js normally)
    // We assume it exists. If not, the FOREIGN KEY constraint in step 2 might indicate issues.

    // Step 2: Add 'cycle_id' column to 'services' table if it doesn't exist.
    // This also adds the foreign key constraint.
    try {
      await dbRunAsync("ALTER TABLE services ADD COLUMN cycle_id INTEGER REFERENCES cycles(id)");
      console.log("'cycle_id' column added to 'services' table (or already existed).");
    } catch (error) {
      // Common error if column already exists: SQLITE_ERROR: duplicate column name: cycle_id
      if (error.message.includes('duplicate column name') || error.message.includes('already exists')) {
        console.log("'cycle_id' column already exists in 'services' table.");
      } else {
        throw error; // Re-throw other errors
      }
    }

    // Step 3: Fetch services that need migration.
    // These are services that have the old date columns and for which cycle_id is currently NULL.
    // This query will return 0 rows if cycle_start_date/cycle_end_date columns don't exist.
    let servicesToMigrate = [];
    try {
        servicesToMigrate = await dbAllAsync(
            "SELECT id, cycle_start_date, cycle_end_date FROM services WHERE cycle_id IS NULL AND cycle_start_date IS NOT NULL AND cycle_end_date IS NOT NULL"
        );
    } catch (error) {
        if (error.message.includes('no such column: cycle_start_date') || error.message.includes('no such column: cycle_end_date')) {
            console.log('Old columns cycle_start_date/cycle_end_date not found in services table. Assuming no data to migrate from these columns.');
        } else {
            throw error;
        }
    }

    if (servicesToMigrate.length === 0) {
      console.log('No services found needing migration based on current criteria.');
      // Check if services exist at all that might need manual checking
      const anyServicesWithoutCycleId = await dbGetAsync("SELECT COUNT(*) as count FROM services WHERE cycle_id IS NULL");
      if (anyServicesWithoutCycleId && anyServicesWithoutCycleId.count > 0) {
        console.warn(`Warning: ${anyServicesWithoutCycleId.count} services exist without a cycle_id, but could not be migrated automatically (e.g., missing old date columns or values).`);
      }
      return; // Exit if no services to migrate
    }
    console.log(`Found ${servicesToMigrate.length} services to migrate.`);

    let migratedCount = 0;
    for (const service of servicesToMigrate) {
      if (!service.cycle_start_date || !service.cycle_end_date) {
        console.warn(`Service ID ${service.id} is missing cycle_start_date or cycle_end_date values. Skipping.`);
        continue;
      }

      // Step 4: Find or create a cycle for the service's dates.
      let cycle = await dbGetAsync("SELECT id FROM cycles WHERE start_date = ? AND end_date = ?", [service.cycle_start_date, service.cycle_end_date]);
      let cycleIdToAssign;

      if (cycle) {
        cycleIdToAssign = cycle.id;
      } else {
        // Cycle doesn't exist, create it.
        const result = await dbRunAsync("INSERT INTO cycles (start_date, end_date) VALUES (?, ?)", [service.cycle_start_date, service.cycle_end_date]);
        cycleIdToAssign = result.lastID;
        console.log(`Created new cycle for dates ${service.cycle_start_date} - ${service.cycle_end_date} with ID ${cycleIdToAssign}.`);
      }

      // Step 5: Update the service with the new cycle_id.
      await dbRunAsync("UPDATE services SET cycle_id = ? WHERE id = ?", [cycleIdToAssign, service.id]);
      console.log(`Updated service ID ${service.id} with cycle_id ${cycleIdToAssign}.`);
      migratedCount++;
    }

    console.log(`Migration completed. ${migratedCount} services processed.`);

    // Step 6: Guidance for post-migration cleanup (manual execution recommended).
    if (migratedCount > 0) {
        console.log('\n--- Post-Migration Steps (Manual Execution Recommended) ---');
        console.log('After verifying the migration and ensuring all data is correct:');
        console.log('1. Consider removing the old date columns from the `services` table:');
        console.log('   -- ALTER TABLE services DROP COLUMN cycle_start_date;');
        console.log('   -- ALTER TABLE services DROP COLUMN cycle_end_date;');
        console.log('   (Note: SQLite has limited ALTER TABLE support for dropping columns. You might need to recreate the table or use a more complex procedure for older SQLite versions.)');
        console.log('\n2. If all services are expected to have a cycle, update the `cycle_id` column to be NOT NULL:');
        console.log('   -- This typically requires recreating the table with the new constraint or using specific SQLite pragmas/procedures.');
        console.log('   -- Example for new table: CREATE TABLE services_new (... cycle_id INTEGER NOT NULL REFERENCES cycles(id), ...); INSERT INTO services_new SELECT ... FROM services; DROP TABLE services; ALTER TABLE services_new RENAME TO services;');
        console.log('-------------------------------------------------------------');
    }

  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    db.close((err) => {
      if (err) {
        console.error('Error closing database connection:', err.message);
      } else {
        console.log('Database connection closed.');
      }
    });
  }
}

// Promisified helper functions for SQLite operations
function dbRunAsync(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) { // Must use function() to access this.lastID
      if (err) {
        reject(err);
      } else {
        resolve(this); // 'this' contains lastID and changes
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
        resolve(rows);
      }
    });
  });
}
