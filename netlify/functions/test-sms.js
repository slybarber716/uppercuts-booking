const twilio = require('twilio');

exports.handler = async (event, context) => {
    console.log('=== SMS TEST WEBHOOK FIRED ===');
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('Body:', event.body);
    console.log('QueryStringParameters:', event.queryStringParameters);
    
    return {
        statusCode: 200,
        body: 'Webhook received',
        headers: {
            'Content-Type': 'text/plain'
        }
    };
};
