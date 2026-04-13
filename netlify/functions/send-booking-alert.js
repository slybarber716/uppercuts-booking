const twilio = require('twilio');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const { name, phone, service, date, time, depositAmount } = JSON.parse(event.body);
        
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioNumber = process.env.TWILIO_NUMBER;
        const ownerPhone = process.env.OWNER_PHONE; // +17703340126

        const client = twilio(accountSid, authToken);

        // Send alert to owner
        const message = await client.messages.create({
            body: `📅 NEW BOOKING\n\n👤 ${name}\n☎️ ${phone}\n✂️ ${service}\n📍 ${date} @ ${time}\n💵 Deposit: $${depositAmount}\n\nReply READY [name] when they're ready.`,
            from: twilioNumber,
            to: ownerPhone
        });

        console.log('SMS sent:', message.sid);

        return {
            statusCode: 200,
            body: JSON.stringify({ success: true, messageSid: message.sid })
        };
    } catch (error) {
        console.error('Twilio error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
