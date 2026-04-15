const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const path = require('path');

// Database file path
const DB_PATH = path.join(__dirname, 'suiteseat.db');

// Read schema SQL
const schemaSQL = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
console.log('Schema file length:', schemaSQL.length);
console.log('First 200 chars:', schemaSQL.substring(0, 200));
console.log('Last 200 chars:', schemaSQL.substring(schemaSQL.length - 200));

// Initialize database
function initializeDatabase() {
    // Remove existing database if it exists (for development)
    if (fs.existsSync(DB_PATH)) {
        console.log('Removing existing database...');
        fs.unlinkSync(DB_PATH);
    }

    // Create new database
    const db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error opening database:', err);
            return;
        }
        console.log('Connected to SQLite database');
    });

    // Enable foreign keys
    db.run('PRAGMA foreign_keys = ON');

    // Execute schema
    console.log('Creating database schema...');
    
    // Split SQL by semicolons and execute each statement
    // But first, let's separate table creation from indexes and inserts
    const allStatements = schemaSQL
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0);
    
    console.log(`Found ${allStatements.length} total statements (before filtering)`);
    
    // Separate statements by type
    const tableStatements = [];
    const indexStatements = [];
    const insertStatements = [];
    
    allStatements.forEach((stmt, index) => {
        const upperStmt = stmt.toUpperCase();
        console.log(`Statement ${index}: ${upperStmt.substring(0, 50)}...`);
        if (upperStmt.includes('CREATE TABLE')) {
            tableStatements.push(stmt);
        } else if (upperStmt.includes('CREATE INDEX')) {
            indexStatements.push(stmt);
        } else if (upperStmt.includes('INSERT INTO')) {
            insertStatements.push(stmt);
        }
    });
    
    console.log(`Tables: ${tableStatements.length}, Inserts: ${insertStatements.length}, Indexes: ${indexStatements.length}`);
    
    // Execute in correct order: tables first, then inserts, then indexes
    const statements = [...tableStatements, ...insertStatements, ...indexStatements];

    let completed = 0;
    
    function executeNext() {
        if (completed >= statements.length) {
            console.log('Database initialization complete!');
            
            // Display summary
            db.all("SELECT name FROM sqlite_master WHERE type='table'", (err, tables) => {
                if (err) {
                    console.error('Error listing tables:', err);
                } else {
                    console.log('\nCreated tables:');
                    tables.forEach(table => console.log(`  - ${table.name}`));
                }
                
                // Close database
                db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                    } else {
                        console.log('\nDatabase connection closed.');
                    }
                });
            });
            
            return;
        }

        const statement = statements[completed];
        console.log(`Executing: ${statement.substring(0, 50)}...`);
        
        db.run(statement, (err) => {
            if (err) {
                console.error(`Error executing statement ${completed + 1}:`, err);
                console.error('Statement:', statement);
            } else {
                completed++;
                executeNext();
            }
        });
    }

    executeNext();
}

// Export for use in other modules
module.exports = {
    initializeDatabase,
    DB_PATH
};

// Run if called directly
if (require.main === module) {
    initializeDatabase();
}
