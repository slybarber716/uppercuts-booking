const fs = require('fs');
const path = require('path');
const database = require('./db');

// Migration script to convert from single-tenant to multi-tenant
async function migrateToMultiTenant() {
    console.log('Starting migration to multi-tenant database...');
    
    try {
        // Connect to database
        await database.connect();
        console.log('Connected to database');
        
        // Check if businesses table exists (migration already run)
        const businessesTable = await database.get("SELECT name FROM sqlite_master WHERE type='table' AND name='businesses'");
        
        if (!businessesTable) {
            console.log('Businesses table not found. Please run the schema first.');
            return;
        }
        
        // Check if we already have the sample business
        let business = await database.get('SELECT * FROM businesses WHERE id = 1');
        
        if (!business) {
            console.log('Creating sample business...');
            // The schema.sql already inserted the sample business
            business = await database.get('SELECT * FROM businesses WHERE id = 1');
        }
        
        console.log(`Migration complete. Business "${business.name}" is set up with ID: ${business.id}`);
        
        // Show summary of what's been created
        const services = await database.all('SELECT COUNT(*) as count FROM services WHERE business_id = 1');
        const businessHours = await database.all('SELECT COUNT(*) as count FROM business_hours WHERE business_id = 1');
        
        console.log(`\nMigration Summary:`);
        console.log(`- Business: ${business.name}`);
        console.log(`- Services: ${services[0].count} created`);
        console.log(`- Business Hours: ${businessHours[0].count} configured`);
        
        // Show next steps
        console.log(`\nNext steps for SaaS conversion:`);
        console.log(`1. Update all Netlify functions to accept business_id parameter`);
        console.log(`2. Modify booking flow to identify business by domain/phone/SMS`);
        console.log(`3. Create business signup/login system`);
        console.log(`4. Add Stripe subscription billing`);
        console.log(`5. Create admin panel for business management`);
        
    } catch (error) {
        console.error('Migration error:', error);
    } finally {
        await database.close();
    }
}

// Sample data migration (if needed from existing bookings)
async function migrateExistingBookings() {
    console.log('Migrating existing booking data...');
    
    // This would be where you migrate from:
    // - Flat files
    // - JSON storage
    // - Another database
    // - Netlify forms data
    
    // For now, we'll create a sample client and appointment to test the system
    try {
        await database.connect();
        
        // Create sample client
        const client = await database.getOrCreateClient(
            1, // business_id
            'John Doe',
            '+1234567890',
            'john@example.com'
        );
        
        console.log(`Created sample client: ${client.name}`);
        
        // Create sample appointment
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const appointmentDate = tomorrow.toISOString().split('T')[0];
        
        const appointment = await database.createAppointment(
            1, // business_id
            client.id,
            1, // service_id (Kids Cut)
            appointmentDate,
            '14:00',
            'Sample appointment for testing'
        );
        
        console.log(`Created sample appointment for ${appointmentDate} at 14:00`);
        
    } catch (error) {
        console.error('Error migrating data:', error);
    } finally {
        await database.close();
    }
}

// Run migration
if (require.main === module) {
    const command = process.argv[2];
    
    if (command === 'migrate') {
        migrateToMultiTenant();
    } else if (command === 'sample') {
        migrateExistingBookings();
    } else {
        console.log('Usage:');
        console.log('  node migrate.js migrate  - Run the main migration');
        console.log('  node migrate.js sample   - Add sample data');
    }
}

module.exports = {
    migrateToMultiTenant,
    migrateExistingBookings
};
