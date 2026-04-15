// Netlify Function: booking-confirmation.js
// Fires when a client books an appointment.
// 1. Stores booking in database
// 2. Sends SMS confirmation to client with appointment details
// 3. Returns success to client

const https = require('https');
const querystring = require('querystring');
const { getDatabase, getBusinessById } = require('./db-helper');

function sendSMS(to, body, twilioConfig) {
    return new Promise((resolve, reject) => {
        const data = querystring.stringify({ To: to, From: twilioConfig.from, Body: body });
        const auth = Buffer.from(`${twilioConfig.sid}:${twilioConfig.token}`).toString('base64');
        const options = {
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${twilioConfig.sid}/Messages.json`,
            method: 'POST',
            headers: {
                'Authorization': `Basic ${auth}`,
                'Content-Type': 'application/x-www-form-urlencoded',
                'Content-Length': Buffer.byteLength(data)
            }
        };
        const req = https.request(options, res => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: 'Bad Request' };
    }

    const { businessId, name, phone, service, date, time, email, notes, squarePaymentId } = body;

    if (!businessId || !name || !phone || !service || !date || !time) {
        return { statusCode: 400, body: 'Missing required fields' };
    }

    const db = getDatabase();
    
    try {
        // Get business configuration
        const business = await getBusinessById(businessId);
        if (!business) {
            return {
                statusCode: 404,
                body: JSON.stringify({ success: false, error: 'Business not found' })
            };
        }

        // Get service details
        const serviceData = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM services WHERE business_id = ? AND name = ? AND is_active = 1', 
                [businessId, service], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
        });

        if (!serviceData) {
            return {
                statusCode: 404,
                body: JSON.stringify({ success: false, error: 'Service not found' })
            };
        }

        // Get or create client
        let client = await new Promise((resolve, reject) => {
            db.get('SELECT * FROM clients WHERE business_id = ? AND phone = ?', 
                [businessId, phone], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
        });

        if (client) {
            // Update client info if needed
            if (client.name !== name || (email && client.email !== email)) {
                await new Promise((resolve, reject) => {
                    db.run('UPDATE clients SET name = ?, email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
                        [name, email || client.email, client.id], (err) => {
                            if (err) reject(err);
                            else resolve();
                        });
                });
            }
        } else {
            // Create new client
            const result = await new Promise((resolve, reject) => {
                db.run('INSERT INTO clients (business_id, name, phone, email) VALUES (?, ?, ?, ?)',
                    [businessId, name, phone, email], function(err) {
                        if (err) reject(err);
                        else resolve({ id: this.lastID });
                    });
            });
            
            client = await new Promise((resolve, reject) => {
                db.get('SELECT * FROM clients WHERE id = ?', [result.id], (err, row) => {
                    if (err) reject(err);
                    else resolve(row);
                });
            });
        }

        // Check if time slot is available
        const isAvailable = await new Promise((resolve, reject) => {
            const startTime = new Date(`${date}T${time}`);
            const endTime = new Date(startTime.getTime() + serviceData.duration_minutes * 60000);
            
            db.get(`
                SELECT COUNT(*) as count FROM appointments 
                WHERE business_id = ? AND appointment_date = ? AND status = 'confirmed'
                AND (
                    datetime(appointment_date || ' ' || appointment_time) >= datetime(?)
                    AND datetime(appointment_date || ' ' || appointment_time) < datetime(?)
                )
            `, [businessId, date, startTime.toISOString(), endTime.toISOString()], (err, row) => {
                if (err) reject(err);
                else resolve(row.count === 0);
            });
        });

        if (!isAvailable) {
            return {
                statusCode: 409,
                body: JSON.stringify({ success: false, error: 'Time slot not available' })
            };
        }

        // Create appointment
        const appointmentResult = await new Promise((resolve, reject) => {
            db.run(`INSERT INTO appointments (
                business_id, client_id, service_id, appointment_date, appointment_time,
                duration_minutes, deposit_amount, square_payment_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [businessId, client.id, serviceData.id, date, time, serviceData.duration_minutes, 
             serviceData.deposit_amount, squarePaymentId, notes], function(err) {
                if (err) reject(err);
                else resolve({ id: this.lastID });
            });
        });

        // Close database
        db.close();

        // Prepare SMS configuration
        const twilioConfig = {
            sid: business.twilio_sid,
            token: business.twilio_token,
            from: business.twilio_phone
        };

        // Format the confirmation message for client
        const clientMsg = `✂️ APPOINTMENT CONFIRMED
    
Hi ${name}!

Your ${service} appointment is confirmed:
📅 ${date}
🕐 ${time}

Location: ${business.name}
${business.address}, ${business.city}, ${business.state} ${business.zip_code}

💳 Payment processed via Square at booking.

Please arrive 5 minutes early. Questions? Text us back!`;

        // Notify business owner of the new booking
        const ownerMsg = `📱 NEW BOOKING

${name} booked ${service}
📅 ${date} at ${time}
📞 ${phone}`;

        // Send confirmation to client
        await sendSMS(phone, clientMsg, twilioConfig);
        
        // Notify business owner
        await sendSMS(business.phone, ownerMsg, twilioConfig);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                appointmentId: appointmentResult.id,
                message: 'Appointment confirmed and saved' 
            })
        };
        
    } catch (err) {
        console.error('Error processing booking:', err);
        db.close();
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to process booking' 
            })
        };
    }
};
