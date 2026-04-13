// Netlify Function: sms-webhook.js
// Twilio webhook — receives all incoming SMS to your Twilio number.
// Routes messages to the appropriate handler:
// - Check-in QR scans (lobby.html) → calls /checkin
// - Sly's "READY" responses → calls /ready
// - General inquiries → could add AI chatbot here

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

exports.handler = async (event) => {
    // Twilio sends POST with form-encoded body
    const params = querystring.parse(event.body);
    const from = params.From;
    const msgBody = (params.Body || '').trim().toUpperCase();

    // Always respond with TwiML (Twilio XML) to acknowledge receipt
    let twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;

    // Security: only process READY commands from Sly's number
    if (from === SLY_PHONE && msgBody.startsWith('READY')) {
        const parts = msgBody.split(' ');
        const encoded = parts[1];

        if (!encoded) {
            twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>⚠️ No client data found. Reply to the check-in alert with READY followed by the code.</Message>
</Response>`;
        } else {
            try {
                const client = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
                const { name, phone, service } = client;

                // Text the client they can come back
                const clientMsg = `Hey ${name}! 💈 Sly is ready for you — head on back now. See you in a second!`;
                await sendSMS(phone, clientMsg);

                twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ ${name} has been notified — they're on their way.</Message>
</Response>`;
            } catch (err) {
                console.error('Error parsing client data:', err);
                twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>⚠️ Couldn't parse client data. Try again.</Message>
</Response>`;
            }
        }
    } else if (from === SLY_PHONE) {
        // Sly texted something else — just acknowledge
        twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    } else {
        // Client or unknown number — acknowledge
        // In the future, could add AI chatbot here for general inquiries
        twimlResponse = `<?xml version="1.0" encoding="UTF-8"?><Response></Response>`;
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'text/xml' },
        body: twimlResponse
    };
};
