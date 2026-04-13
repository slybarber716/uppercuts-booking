// Netlify Function: booking-confirmation.js
// Fires when a client books an appointment.
// 1. Sends SMS confirmation to client with appointment details
// 2. Stores booking for reminder scheduler
// 3. Returns success to client

const https = require('https');
const querystring = require('querystring');

const TWILIO_SID    = process.env.TWILIO_SID;
const TWILIO_TOKEN  = process.env.TWILIO_TOKEN;
const TWILIO_FROM   = process.env.TWILIO_FROM;   // +18559203566
const SLY_PHONE     = process.env.SLY_PHONE;     // +17703340126

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

    const { name, phone, service, date, time } = body;

    if (!name || !phone || !service || !date || !time) {
        return { statusCode: 400, body: 'Missing required fields' };
    }

    // Format the confirmation message for client
    const clientMsg = `✂️ APPOINTMENT CONFIRMED
    
Hi ${name}!

Your ${service} appointment is confirmed:
📅 ${date}
🕐 ${time}

Location: Upper Cuts Barbershop
2179 Lawrenceville Hwy, Decatur, GA 30033

💳 Payment processed via Square at booking.

Please arrive 5 minutes early. Questions? Text us back!`;

    // Notify Sly of the new booking
    const slyMsg = `📱 NEW BOOKING

${name} booked ${service}
📅 ${date} at ${time}
📞 ${phone}`;

    try {
        // Send confirmation to client
        await sendSMS(phone, clientMsg);
        
        // Notify Sly
        await sendSMS(SLY_PHONE, slyMsg);
        
        return {
            statusCode: 200,
            body: JSON.stringify({ 
                success: true, 
                message: 'Confirmation sent' 
            })
        };
    } catch (err) {
        console.error('Twilio error:', err);
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                success: false, 
                error: 'Failed to send confirmation' 
            })
        };
    }
};
