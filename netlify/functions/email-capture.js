// Netlify Function: email-capture.js
// Captures emails from website signup forms
// Adds to mailing list and sends welcome email

const axios = require('axios');

exports.handler = async (event) => {
    // Set CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight requests
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }

    if (event.httpMethod !== 'POST') {
        return { 
            statusCode: 405, 
            headers,
            body: JSON.stringify({ error: 'Method Not Allowed' }) 
        };
    }

    try {
        const { email, firstName, lastName, businessName, source = 'website' } = JSON.parse(event.body);
        
        // Validate email
        if (!email || !isValidEmail(email)) {
            return { 
                statusCode: 400, 
                headers,
                body: JSON.stringify({ error: 'Valid email address is required' }) 
            };
        }

        console.log(`Processing email signup: ${email} from ${source}`);

        // Add to email list (Mailchimp example)
        const mailchimpResult = await addToMailchimp({
            email,
            firstName,
            lastName,
            businessName,
            source
        });

        // Send welcome email
        await sendWelcomeEmail(email, firstName || 'there');

        // Log the signup
        console.log(`Email captured successfully: ${email}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Thanks for signing up! Check your email for next steps.',
                emailId: mailchimpResult.id
            })
        };

    } catch (error) {
        console.error('Email capture error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: 'Something went wrong. Please try again later.',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            })
        };
    }
};

function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

async function addToMailchimp(userData) {
    const { email, firstName, lastName, businessName, source } = userData;
    
    // For now, we'll just log it. You'll need to:
    // 1. Sign up for Mailchimp
    // 2. Get your API key
    // 3. Create a list/audience
    // 4. Replace this with actual API calls
    
    console.log('Adding to email list:', {
        email,
        firstName,
        lastName,
        businessName,
        source,
        tags: ['suiteseat_lead', source],
        timestamp: new Date().toISOString()
    });

    // Placeholder response
    return {
        id: `temp_${Date.now()}`,
        status: 'subscribed',
        message: 'Email logged successfully (integrate with your email service)'
    };
}

async function sendWelcomeEmail(email, firstName) {
    const subject = 'Welcome to SuiteSeat! Your free trial starts now 🎉';
    const body = `
Hi ${firstName},

Thanks for your interest in SuiteSeat! I'm Sly, the creator, and I'm excited to help you streamline your booking process.

Here's what SuiteSeat can do for you:
• QR Code Check-in (no more "I'm here" texts)
• SMS Appointment Reminders
• Payment Deposits (reduce no-shows)
• Smart Scheduling & Analytics

Ready to get started?
→ Start your free trial: https://suiteseatbooking.com

Questions? Just reply to this email - I read every single one.

Talk soon,
Sly
Founder, SuiteSeat

P.S. Follow the journey on Instagram @slybarber for booking tips and behind-the-scenes content.
    `.trim();

    // For now, we'll log the email. You'll integrate with:
    // - SendGrid (recommended)
    // - Mailgun
    // - Or your business email provider
    
    console.log('Welcome email to send:', {
        to: email,
        subject,
        body,
        timestamp: new Date().toISOString()
    });

    // Placeholder - implement with your email service
    // Example SendGrid integration:
    /*
    const sgMail = require('@sendgrid/mail');
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    
    const msg = {
        to: email,
        from: process.env.BUSINESS_EMAIL,
        subject: subject,
        text: body,
        html: body.replace(/\n/g, '<br>')
    };
    
    await sgMail.send(msg);
    */

    return { success: true, message: 'Welcome email logged for sending' };
}

// Helper function to format phone number (if needed)
function formatPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
        return `+1${cleaned}`;
    }
    return phone;
}

// Helper function to validate business data
function validateBusinessData(data) {
    const errors = [];
    
    if (data.email && !isValidEmail(data.email)) {
        errors.push('Invalid email format');
    }
    
    if (data.businessName && data.businessName.length < 2) {
        errors.push('Business name too short');
    }
    
    return errors;
}
