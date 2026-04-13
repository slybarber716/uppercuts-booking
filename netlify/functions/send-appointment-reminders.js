const twilio = require('twilio');
const Database = require('better-sqlite3');
const path = require('path');

exports.handler = async (event) => {
    try {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioNumber = process.env.TWILIO_NUMBER;

        const client = twilio(accountSid, authToken);

        // Connect to bookings database
        const dbPath = path.join('/var/task', 'bookings.db');
        const db = new Database(dbPath);

        // Get all bookings within 24 hours
        const now = new Date();
        const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        const bookings = db.prepare(`
            SELECT * FROM bookings 
            WHERE status = 'confirmed' 
            AND datetime(date || ' ' || time) > datetime('now')
            AND datetime(date || ' ' || time) <= datetime('now', '+24 hours')
            AND reminder_sent = 0
        `).all();

        let sentCount = 0;

        for (const booking of bookings) {
            try {
                const message = await client.messages.create({
                    body: `Hi ${booking.name}! 📅 Reminder: You have a ${booking.service} scheduled tomorrow at ${booking.time}. See you then! 💈`,
                    from: twilioNumber,
                    to: booking.phone
                });

                // Mark reminder as sent
                db.prepare('UPDATE bookings SET reminder_sent = 1 WHERE id = ?').run(booking.id);
                sentCount++;

                console.log(`Reminder sent to ${booking.name}: ${message.sid}`);
            } catch (error) {
                console.error(`Failed to send reminder to ${booking.name}:`, error.message);
            }
        }

        db.close();

        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                remindersSent: sentCount,
                message: `Sent ${sentCount} appointment reminders`
            })
        };
    } catch (error) {
        console.error('Reminder function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
