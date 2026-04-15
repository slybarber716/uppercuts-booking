// Netlify Function: booking-confirmation.js
// Multi-tenant version with database integration
// 1. Stores booking in database
// 2. Sends SMS confirmation to client with appointment details
// 3. Logs SMS in database
// 4. Returns success to client

const https = require('https');
const querystring = require('querystring');
const database = require('../../database/db');

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
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    resolve({ error: 'Invalid JSON response' });
                }
            });
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

    const { 
        business_id, 
        name, 
        phone, 
        email,
        service_id, 
        date, 
        time,
        notes 
    } = body;

    // Validate required fields
    if (!business_id || !name || !phone || !service_id || !date || !time) {
        return { 
            statusCode: 400, 
            body: JSON.stringify({ 
                success: false, 
                error: 'Missing required fields: business_id, name, phone, service_id, date, time' 
            }) 
        };
    }

    try {
        // Connect to database
        await database.connect();

        // Get business details
        const business = await database.getBusinessById(business_id);
        if (!business) {
            return { 
                statusCode: 404, 
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Business not found' 
                }) 
            };
        }

        // Get service details
        const service = await database.get('SELECT * FROM services WHERE id = ? AND business_id = ?', 
            [service_id, business_id]);
        if (!service) {
            return { 
                statusCode: 404, 
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Service not found' 
                }) 
            };
        }

        // Check if time slot is available
        const isAvailable = await database.isTimeSlotAvailable(business_id, date, time, service.duration_minutes);
        if (!isAvailable) {
            return { 
                statusCode: 409, 
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Time slot is not available' 
                }) 
            };
        }

        // Get or create client
        const client = await database.getOrCreateClient(business_id, name, phone, email);

        // Create appointment
        const appointment = await database.createAppointment(
            business_id, 
            client.id, 
            service_id, 
            date, 
            time,
            notes
        );

        // Prepare Twilio config
        const twilioConfig = {
            sid: business.twilio_sid,
            token: business.twilio_token,
            from: business.twilio_phone
        };

        // Format the confirmation message for client
        const clientMsg = `✂️ APPOINTMENT CONFIRMED
    
Hi ${name}!

Your ${service.name} appointment is confirmed:
📅 ${date}
🕐 ${time}

Location: ${business.name}
${business.address}
${business.city}, ${business.state} ${business.zip_code}

💳 Payment: $${service.deposit_amount} deposit processed via Square.

Please arrive 5 minutes early. Questions? Text us back!`;

        // Notify business owner of the new booking
        const ownerMsg = `📱 NEW BOOKING

${name} booked ${service.name}
📅 ${date} at ${time}
📞 ${phone}
💳 $${service.deposit_amount} deposit paid`;

        // Send confirmation to client
        let clientSmsResult;
        try {
            clientSmsResult = await sendSMS(phone, clientMsg, twilioConfig);
            
            // Log SMS in database
            await database.logSMS(
                business_id,
                client.id,
                'outbound',
                'confirmation',
                phone,
                business.twilio_phone,
                clientMsg,
                clientSmsResult.sid
            );
        } catch (smsError) {
            console.error('Error sending client SMS:', smsError);
            clientSmsResult = { error: smsError.message };
        }

        // Send notification to business owner
        let ownerSmsResult;
        try {
            ownerSmsResult = await sendSMS(business.phone, ownerMsg, twilioConfig);
            
            // Log SMS in database
            await database.logSMS(
                business_id,
                client.id,
                'outbound',
                'notification',
                business.phone,
                business.twilio_phone,
                ownerMsg,
                ownerSmsResult.sid
            );
        } catch (smsError) {
            console.error('Error sending owner SMS:', smsError);
            ownerSmsResult = { error: smsError.message };
        }

        // Return success response
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Allow-Methods': 'POST'
            },
            body: JSON.stringify({ 
                success: true, 
                appointment_id: appointment.id,
                message: 'Appointment confirmed and SMS sent',
                sms_status: {
                    client: clientSmsResult.sid ? 'sent' : 'failed',
                    owner: ownerSmsResult.sid ? 'sent' : 'failed'
                }
            })
        };

    } catch (error) {
        console.error('Booking confirmation error:', error);
        return {
            statusCode: 500,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                success: false, 
                error: 'Internal server error',
                message: error.message
            })
        };
    } finally {
        // Always close database connection
        await database.close();
    }
};
