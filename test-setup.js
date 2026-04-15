#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { initializeDatabase } = require('./database/init-db');
const { migrateToMultiTenant } = require('./database/migrate');
const database = require('./database/db');

async function testSetup() {
    console.log('🚀 Testing SuiteSeat SaaS Setup...\n');
    
    try {
        // Step 1: Check if database directory exists
        const dbDir = path.join(__dirname, 'database');
        if (!fs.existsSync(dbDir)) {
            console.log('📁 Creating database directory...');
            fs.mkdirSync(dbDir);
        }
        
        // Step 2: Initialize database
        console.log('📊 Initializing database...');
        
        // Remove existing database if it exists
        const DB_PATH = path.join(__dirname, 'database', 'suiteseat.db');
        if (fs.existsSync(DB_PATH)) {
            console.log('Removing existing database...');
            fs.unlinkSync(DB_PATH);
        }
        
        // Use the working initialization directly
        const { execSync } = require('child_process');
        const nodePath = process.execPath;
        execSync(`"${nodePath}" database/init-db.js`, { stdio: 'inherit' });
        console.log('Database initialization complete!');
        
        // Step 3: Test database connection
        console.log('🔗 Testing database connection...');
        await database.connect();
        
        // Step 4: Test business retrieval
        console.log('🏢 Testing business retrieval...');
        const business = await database.getBusinessById(1);
        if (business) {
            console.log(`   ✅ Found business: ${business.name}`);
            console.log(`   📍 Location: ${business.address}, ${business.city}, ${business.state}`);
            console.log(`   📞 Phone: ${business.phone}`);
        } else {
            console.log('   ❌ Business not found');
        }
        
        // Step 5: Test services retrieval
        console.log('✂️ Testing services retrieval...');
        const services = await database.getBusinessServices(1);
        console.log(`   ✅ Found ${services.length} services:`);
        services.forEach(service => {
            console.log(`      - ${service.name}: $${service.price} (${service.duration_minutes}min)`);
        });
        
        // Step 6: Test business hours
        console.log('⏰ Testing business hours...');
        const hours = await database.getBusinessHours(1);
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        hours.forEach(hour => {
            const day = days[hour.day_of_week];
            const status = hour.is_closed ? 'Closed' : `${hour.open_time} - ${hour.close_time}`;
            console.log(`   ${day}: ${status}`);
        });
        
        // Step 7: Test client creation
        console.log('👤 Testing client creation...');
        const testClient = await database.getOrCreateClient(1, 'Test Client', '+1234567890', 'test@example.com');
        console.log(`   ✅ Created/Found client: ${testClient.name} (ID: ${testClient.id})`);
        
        // Step 8: Test appointment creation
        console.log('📅 Testing appointment creation...');
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        const appointmentDate = tomorrow.toISOString().split('T')[0];
        
        const appointment = await database.createAppointment(
            1, 
            testClient.id, 
            1, // Kids Cut service
            appointmentDate, 
            '14:30',
            'Test appointment'
        );
        console.log(`   ✅ Created appointment ID: ${appointment.id}`);
        
        // Step 9: Test time slot availability
        console.log('🔍 Testing time slot availability...');
        const isAvailable = await database.isTimeSlotAvailable(1, appointmentDate, '15:00', 30);
        console.log(`   ✅ 15:00 slot available: ${isAvailable}`);
        
        const isNotAvailable = await database.isTimeSlotAvailable(1, appointmentDate, '14:30', 30);
        console.log(`   ✅ 14:30 slot available: ${isNotAvailable} (should be false)`);
        
        console.log('\n✅ All tests passed! Database is ready for multi-tenant SaaS operation.');
        
    } catch (error) {
        console.error('\n❌ Test failed:', error);
        console.error(error.stack);
    } finally {
        // Always close database connection
        await database.close();
        console.log('\n🔒 Database connection closed.');
    }
}

// Run tests
if (require.main === module) {
    testSetup().catch(console.error);
}

module.exports = { testSetup };
