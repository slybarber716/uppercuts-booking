const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, 'suiteseat.db');

class Database {
    constructor() {
        this.db = null;
    }

    // Initialize database connection
    connect() {
        return new Promise((resolve, reject) => {
            this.db = new sqlite3.Database(DB_PATH, (err) => {
                if (err) {
                    console.error('Error opening database:', err);
                    reject(err);
                } else {
                    // Enable foreign keys
                    this.db.run('PRAGMA foreign_keys = ON');
                    console.log('Connected to SQLite database');
                    resolve();
                }
            });
        });
    }

    // Close database connection
    close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((err) => {
                    if (err) {
                        console.error('Error closing database:', err);
                        reject(err);
                    } else {
                        console.log('Database connection closed');
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }

    // Execute a single SQL statement
    run(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) {
                    console.error('SQL Error:', err);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    reject(err);
                } else {
                    resolve({ id: this.lastID, changes: this.changes });
                }
            });
        });
    }

    // Get a single row
    get(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    console.error('SQL Error:', err);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    // Get all rows
    all(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    console.error('SQL Error:', err);
                    console.error('SQL:', sql);
                    console.error('Params:', params);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    // Business-specific queries
    
    // Get business by ID
    async getBusinessById(businessId) {
        return this.get('SELECT * FROM businesses WHERE id = ?', [businessId]);
    }

    // Get business by phone (for SMS routing)
    async getBusinessByPhone(phone) {
        return this.get('SELECT * FROM businesses WHERE phone = ? OR twilio_phone = ?', [phone, phone]);
    }

    // Get services for a business
    async getBusinessServices(businessId, activeOnly = true) {
        let sql = 'SELECT * FROM services WHERE business_id = ?';
        const params = [businessId];
        
        if (activeOnly) {
            sql += ' AND is_active = 1';
        }
        
        sql += ' ORDER BY name';
        
        return this.all(sql, params);
    }

    // Get business hours
    async getBusinessHours(businessId) {
        return this.all('SELECT * FROM business_hours WHERE business_id = ? ORDER BY day_of_week', [businessId]);
    }

    // Get time off for a business
    async getBusinessTimeOff(businessId, startDate, endDate) {
        return this.all(
            'SELECT * FROM time_off WHERE business_id = ? AND start_datetime >= ? AND end_datetime <= ? ORDER BY start_datetime',
            [businessId, startDate, endDate]
        );
    }

    // Get or create client
    async getOrCreateClient(businessId, name, phone, email = null) {
        // Try to find existing client by phone
        let client = await this.get('SELECT * FROM clients WHERE business_id = ? AND phone = ?', [businessId, phone]);
        
        if (client) {
            // Update name if different
            if (client.name !== name || (email && client.email !== email)) {
                await this.run(
                    'UPDATE clients SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                    [name, email || client.email, client.id]
                );
                client = await this.get('SELECT * FROM clients WHERE id = ?', [client.id]);
            }
            return client;
        }
        
        // Create new client
        const result = await this.run(
            'INSERT INTO clients (business_id, name, phone, email) VALUES (?, ?, ?, ?)',
            [businessId, name, phone, email]
        );
        
        return this.get('SELECT * FROM clients WHERE id = ?', [result.id]);
    }

    // Create appointment
    async createAppointment(businessId, clientId, serviceId, appointmentDate, appointmentTime, notes = null) {
        // Get service details
        const service = await this.get('SELECT * FROM services WHERE id = ? AND business_id = ?', [serviceId, businessId]);
        if (!service) {
            throw new Error('Service not found');
        }

        const result = await this.run(
            `INSERT INTO appointments (
                business_id, client_id, service_id, appointment_date, appointment_time,
                duration_minutes, deposit_amount, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [businessId, clientId, serviceId, appointmentDate, appointmentTime, service.duration_minutes, service.deposit_amount, notes]
        );

        return this.get('SELECT * FROM appointments WHERE id = ?', [result.id]);
    }

    // Get appointments for a date range
    async getAppointments(businessId, startDate, endDate, status = null) {
        let sql = 'SELECT * FROM appointments WHERE business_id = ? AND appointment_date >= ? AND appointment_date <= ?';
        const params = [businessId, startDate, endDate];
        
        if (status) {
            sql += ' AND status = ?';
            params.push(status);
        }
        
        sql += ' ORDER BY appointment_date, appointment_time';
        
        return this.all(sql, params);
    }

    // Get upcoming appointments that need reminders
    async getAppointmentsNeedingReminder(businessId, hoursAhead, reminderType) {
        const targetTime = new Date();
        targetTime.setHours(targetTime.getHours() + hoursAhead);
        
        const targetDate = targetTime.toISOString().split('T')[0];
        const targetHour = targetTime.toTimeString().split(':').slice(0, 2).join(':');
        
        let reminderColumn = 'reminder_sent_24h';
        if (reminderType === '1h') {
            reminderColumn = 'reminder_sent_1h';
        }
        
        return this.all(
            `SELECT a.*, c.name as client_name, c.phone as client_phone, s.name as service_name
             FROM appointments a
             JOIN clients c ON a.client_id = c.id
             JOIN services s ON a.service_id = s.id
             WHERE a.business_id = ? 
               AND a.appointment_date = ?
               AND SUBSTR(a.appointment_time, 1, 5) = ?
               AND a.status = 'confirmed'
               AND ${reminderColumn} = 0`,
            [businessId, targetDate, targetHour]
        );
    }

    // Mark reminder as sent
    async markReminderSent(appointmentId, reminderType) {
        let column = 'reminder_sent_24h';
        if (reminderType === '1h') {
            column = 'reminder_sent_1h';
        }
        
        return this.run(`UPDATE appointments SET ${column} = 1 WHERE id = ?`, [appointmentId]);
    }

    // Log SMS message
    async logSMS(businessId, clientId, direction, messageType, toNumber, fromNumber, message, twilioSid = null) {
        return this.run(
            'INSERT INTO sms_logs (business_id, client_id, direction, message_type, to_number, from_number, message, twilio_message_sid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [businessId, clientId, direction, messageType, toNumber, fromNumber, message, twilioSid]
        );
    }

    // Check if time slot is available
    async isTimeSlotAvailable(businessId, date, time, durationMinutes, excludeAppointmentId = null) {
        const startTime = new Date(`${date}T${time}`);
        const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
        
        let sql = `
            SELECT COUNT(*) as count 
            FROM appointments 
            WHERE business_id = ? 
              AND appointment_date = ? 
              AND status = 'confirmed'
              AND (
                (datetime(appointment_date || ' ' || appointment_time) >= datetime(?) 
                 AND datetime(appointment_date || ' ' || appointment_time) < datetime(?))
                OR
                (datetime(appointment_date || ' ' || appointment_time, '+' || duration_minutes || ' minutes') > datetime(?)
                 AND datetime(appointment_date || ' ' || appointment_time) < datetime(?))
              )`;
        
        const params = [
            businessId, date,
            startTime.toISOString(), endTime.toISOString(),
            startTime.toISOString(), startTime.toISOString()
        ];
        
        if (excludeAppointmentId) {
            sql += ' AND id != ?';
            params.push(excludeAppointmentId);
        }
        
        const result = await this.get(sql, params);
        return result.count === 0;
    }
}

// Create singleton instance
const database = new Database();

module.exports = database;
