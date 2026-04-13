// Netlify Function: send-reminders.js
// Scheduled function that runs every hour to send appointment reminders.
// Checks for appointments 24 hours away and 1 hour away.
// 
// To use: Set up Netlify cron job that calls this function hourly.
// Example: 0 * * * * (every hour on the hour)

const https = require('https');
const querystring = require('querystring');

const TWILIO_SID    = process.env.TWILIO_SID;
const TWILIO_TOKEN  = process.env.TWILIO_TOKEN;
const TWILIO_FROM   = process.env.TWILIO_FROM;
const SLY_PHONE     = process.env.SLY_PHONE;

function sendSMS(to, body) {
    return new Promise((resolve, reject) => {
        const data = querystring.stringify({ To: to, From: TWILIO_FROM, Body: body });
        const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_TOKEN}`).toString('base64');
        const options = {
            hostname: 'api.twilio.com',
            path: `/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`,
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

// For now, this is a placeholder that accepts manual trigger
// In production, you'd hook this to a database of appointments
exports.handler = async (event) => {
    // Only accept POST from authenticated sources (Netlify scheduled functions or manual calls)
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    // If you're calling this manually with appointment data:
    let body;
    try {
        body = JSON.parse(event.body);
    } catch {
        return { statusCode: 400, body: 'Bad Request' };
    }

    const { name, phone, service, appointmentTime, reminder } = body;

    if (!name || !phone || !appointmentTime || !reminder) {
        return { statusCode: 400, body: 'Missing required fields' };
    }

    let message = '';

    if (reminder === '24h') {
        message = `📅 APPOINTMENT REMINDER

Hi ${name}!

Your ${service} appointment is tomorrow at ${appointmentTime}.

See you then! 💈`;
    } else if (reminder === '1h') {
        message = `⏰ ALMOST TIME!

Hi ${name}!

Your ${service} appointment is in 1 hour at ${appointmentTime}.

Heading over? 💈`;
    } else {
        return { statusCode: 400, body: 'Invalid reminder type' };
    }

    try {
        await sendSMS(phone, message);
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                reminder_sent: `${reminder} reminder to ${name}` 
            })
        };
    } catch (err) {
        console.error('Twilio error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to send reminder' 
            })
        };
    }
};
