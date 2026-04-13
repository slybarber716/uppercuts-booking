const twilio = require('twilio');
const Database = require('better-sqlite3');
const path = require('path');

exports.handler = async (event) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioNumber = process.env.TWILIO_PHONE;
        const ownerNumber = process.env.SLY_PHONE;

        const client = twilio(accountSid, authToken);

        // Parse incoming SMS - Twilio sends as form data in body
        const body = event.body ? 
            (typeof event.body === 'string' ? 
                Object.fromEntries(new URLSearchParams(event.body)) : 
                event.body) 
            : event.queryStringParameters || {};
        
        const incomingMessage = body.Body || '';
        let fromNumber = body.From || '';
        
        // Normalize phone numbers (remove + prefix for comparison)
        fromNumber = fromNumber.replace(/^\+/, '');
        const normalizedOwnerNumber = ownerNumber.replace(/^\+/, '');

        // Only accept commands from owner
        if (fromNumber !== normalizedOwnerNumber) {
            return {
                statusCode: 403,
                body: 'Unauthorized'
            };
        }

        // Parse command: "READY John" or "READY john doe"
        const parts = incomingMessage.trim().split(/\s+/);
        const command = parts[0]?.toUpperCase();

        if (command === 'READY' && parts.length > 1) {
            const clientName = parts.slice(1).join(' ').toLowerCase();

            // Find client in bookings
            const dbPath = path.join(__dirname, '..', '..', 'bookings.db');
            const db = new Database(dbPath);

            const booking = db.prepare(`
                SELECT * FROM bookings 
                WHERE LOWER(name) LIKE ? 
                AND status = 'confirmed'
                AND DATE(date) = DATE('now')
                LIMIT 1
            `).get(`%${clientName}%`);

            if (booking) {
                // Send SMS to client
                await client.messages.create({
                    body: `🎉 We're ready for you, ${booking.name}! Come on back. 💈`,
                    from: twilioNumber,
                    to: booking.phone
                });

                // Mark as notified
                db.prepare(`
                    UPDATE bookings 
                    SET ready_notified = 1, ready_notified_at = datetime('now')
                    WHERE id = ?
                `).run(booking.id);

                db.close();

                // Send confirmation to owner
                return {
                    statusCode: 200,
                    body: new twilio.twiml.MessagingResponse().toString(),
                    headers: {
                        'Content-Type': 'application/xml'
                    }
                };
            } else {
                db.close();
                // Client not found, send error message
                await client.messages.create({
                    body: `❌ No client named "${clientName}" found for today. Check the name and try again.`,
                    from: twilioNumber,
                    to: fromNumber
                });

                return {
                    statusCode: 200,
                    body: new twilio.twiml.MessagingResponse().toString(),
                    headers: {
                        'Content-Type': 'application/xml'
                    }
                };
            }
        }

        // Unknown command
        return {
            statusCode: 200,
            body: new twilio.twiml.MessagingResponse().toString(),
            headers: {
                'Content-Type': 'application/xml'
            }
        };

    } catch (error) {
        console.error('SMS command error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
