const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Database path - in production this would be in a persistent storage
const DB_PATH = path.join(__dirname, '../../database/suiteseat.db');

// Get database connection with business_id filtering
function getDatabase() {
    return new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
            console.error('Error opening database:', err);
            throw err;
        }
    });
}

// Helper to execute queries with business_id filtering
function queryWithBusinessId(db, businessId, query, params = []) {
    return new Promise((resolve, reject) => {
        // Add business_id to WHERE clause if not already present
        let modifiedQuery = query;
        let modifiedParams = [...params];
        
        if (businessId && !query.includes('business_id')) {
            // Simple heuristic to add business_id filter
            if (query.includes('WHERE')) {
                modifiedQuery = query.replace('WHERE', `WHERE business_id = ? AND`);
            } else if (query.includes('ORDER BY') || query.includes('LIMIT')) {
                const parts = query.split(/(ORDER BY|LIMIT)/);
                modifiedQuery = `${parts[0]} WHERE business_id = ? ${parts.slice(1).join('')}`;
            } else {
                modifiedQuery = `${query} WHERE business_id = ?`;
            }
            modifiedParams.unshift(businessId);
        }
        
        db.all(modifiedQuery, modifiedParams, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
}

// Helper to run INSERT/UPDATE/DELETE with business_id
function runWithBusinessId(db, businessId, query, params = []) {
    return new Promise((resolve, reject) => {
        let modifiedQuery = query;
        let modifiedParams = [...params];
        
        // Add business_id to INSERT statements
        if (query.trim().toUpperCase().startsWith('INSERT') && businessId) {
            if (query.includes('business_id')) {
                // business_id already in query
            } else if (query.includes('VALUES')) {
                // Find table name and add business_id column
                const tableMatch = query.match(/INSERT INTO (\w+)/i);
                if (tableMatch && !['users', 'businesses'].includes(tableMatch[1])) {
                    const tableName = tableMatch[1];
                    // Add business_id to column list
                    modifiedQuery = query.replace(/INSERT INTO (\w+) \(([^)]+)\)/i, 
                        `INSERT INTO $1 (business_id, $2)`);
                    // Add business_id to values
                    const valuesMatch = modifiedQuery.match(/VALUES \(([^)]+)\)/i);
                    if (valuesMatch) {
                        modifiedQuery = modifiedQuery.replace(/VALUES \(([^)]+)\)/i, 
                            `VALUES (?, $1)`);
                        modifiedParams.unshift(businessId);
                    }
                }
            }
        }
        
        db.run(modifiedQuery, modifiedParams, function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
}

// Get single business by ID
function getBusinessById(businessId) {
    const db = getDatabase();
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM businesses WHERE id = ?', [businessId], (err, row) => {
            db.close();
            if (err) reject(err);
            else resolve(row);
        });
    });
}

// Get business by subdomain or custom domain
function getBusinessByDomain(domain) {
    const db = getDatabase();
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM businesses WHERE subdomain = ? OR custom_domain = ?', 
            [domain, domain], (err, row) => {
                db.close();
                if (err) reject(err);
                else resolve(row);
            });
    });
}

// Helper to validate business context
function validateBusinessContext(businessId) {
    if (!businessId) {
        throw new Error('Business ID is required');
    }
    if (isNaN(businessId) || businessId <= 0) {
        throw new Error('Invalid business ID');
    }
    return true;
}

// Export all helpers
module.exports = {
    getDatabase,
    queryWithBusinessId,
    runWithBusinessId,
    getBusinessById,
    getBusinessByDomain,
    validateBusinessContext,
    DB_PATH
};
