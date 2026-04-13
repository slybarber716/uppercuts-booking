const twilio = require('twilio');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method not allowed' };
    }

    try {
        const { name, phone, checkInTime, service } = JSON.parse(event.body);
        
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioNumber = process.env.TWILIO_NUMBER;
        const ownerPhone = process.env.OWNER_PHONE;

        const client = twilio(accountSid, authToken);

        // Encode client data as base64 for Sly to reply with
        const clientData = { name, phone, service };
        const encoded = Buffer.from(JSON.stringify(clientData)).toString('base64');

        // Send check-in alert to owner with encoded data
        const message = await client.messages.create({
            body: `✅ CHECK-IN ALERT\n\n👤 ${name}\n⏰ ${checkInTime}\n\nReply: READY ${encoded}`,
            from: twilioNumber,
            to: ownerPhone
        });

        console.log('Check-in alert sent:', message.sid);

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
