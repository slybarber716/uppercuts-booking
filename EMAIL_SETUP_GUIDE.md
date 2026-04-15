# SuiteSeat Email Setup Complete Guide

## 🎯 Goal: Professional Email for SuiteSeat Business

**Primary Email:** sly@suiteseatbooking.com
**Support Email:** support@suiteseatbooking.com  
**Marketing Email:** hello@suiteseatbooking.com

---

## STEP 1: Business Email Setup (Google Workspace Recommended)

### Option A: Google Workspace (Recommended)
**Cost:** $6/month per user
**Benefits:** Professional Gmail, Google Drive, Meet, Calendar

**Setup Process:**
1. Go to https://workspace.google.com
2. Click "Get Started"
3. Enter "suiteseatbooking.com" as your domain
4. Create admin account: sly@suiteseatbooking.com
5. Verify domain ownership (requires DNS access)
6. Add MX records to your domain DNS

**MX Records for Google Workspace:**
```
ASPMX.L.GOOGLE.COM (Priority 1)
ALT1.ASPMX.L.GOOGLE.COM (Priority 5)  
ALT2.ASPMX.L.GOOGLE.COM (Priority 5)
ALT3.ASPMX.L.GOOGLE.COM (Priority 10)
ALT4.ASPMX.L.GOOGLE.COM (Priority 10)
```

### Option B: Microsoft 365 Business
**Cost:** $6/month per user
**Benefits:** Outlook, Teams, Office apps

**Setup Process:**
1. Go to https://www.microsoft.com/en-us/microsoft-365/business
2. Choose "Business Basic" ($6/month)
3. Enter your domain: suiteseatbooking.com
4. Follow setup wizard
5. Add Microsoft MX records

**MX Records for Microsoft 365:**
```
suiteseatbooking-com.mail.protection.outlook.com (Priority 0)
```

### Option C: Zoho Workplace (Budget Option)
**Cost:** $3/month per user
**Benefits:** Good features, lower cost

---

## STEP 2: Email Marketing Platform Setup

### Recommended: Mailchimp (Free up to 500 contacts)

**Setup Process:**
1. Go to https://mailchimp.com
2. Sign up with your business email (sly@suiteseatbooking.com)
3. Create audience: "SuiteSeat Leads"
4. Set up signup forms
5. Create welcome email automation

**Email Sequences to Create:**
- Welcome series (3 emails)
- Educational content about booking efficiency
- Promotional offers
- Customer success stories

### Alternative: ConvertKit (Better for creators)
**Cost:** Free up to 1,000 subscribers

---

## STEP 3: Transactional Email Setup

### For Booking Confirmations & Reminders

**Recommended: SendGrid (Free 100 emails/day)**

**Setup Process:**
1. Go to https://sendgrid.com
2. Sign up with business email
3. Verify domain (requires DNS TXT record)
4. Create API key
5. Integrate with Netlify functions

**DNS Records for SendGrid:**
```
suiteseatbooking.com TXT: v=spf1 include:sendgrid.net ~all
```

### Alternative: Twilio SendGrid (Same as above)
Since you already have Twilio, this integrates well

---

## STEP 4: Email Capture on Website

### Add to Marketing Page (marketing.html)

**Signup Form HTML:**
```html
<!-- Email Capture Section -->
<section class="email-capture" style="padding: 60px 0; background: var(--surface);">
    <div class="container" style="text-align: center;">
        <h2 style="color: var(--gold); margin-bottom: 20px;">Get Started Free</h2>
        <p style="color: var(--text-secondary); margin-bottom: 30px;">Join hundreds of suite owners streamlining their bookings</p>
        
        <form id="emailSignup" style="max-width: 500px; margin: 0 auto;">
            <div style="display: flex; gap: 10px;">
                <input type="email" id="emailInput" placeholder="Enter your email" required 
                       style="flex: 1; padding: 15px; border: 1px solid var(--gold); background: var(--primary-dark); 
                              color: var(--text-primary); border-radius: 6px;">
                <button type="submit" style="background: var(--gold); color: var(--primary-dark); 
                                           border: none; padding: 15px 30px; border-radius: 6px; 
                                           font-weight: 600; cursor: pointer;">
                    Start Free Trial
                </button>
            </div>
            <p style="color: var(--text-secondary); font-size: 14px; margin-top: 10px;">
                Free 30-day trial • No credit card required
            </p>
        </form>
    </div>
</section>
```

**JavaScript for Form:**
```javascript
document.getElementById('emailSignup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('emailInput').value;
    
    try {
        // Add to Mailchimp or your email platform
        const response = await fetch('/.netlify/functions/add-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, source: 'marketing_page' })
        });
        
        if (response.ok) {
            alert('Thanks! Check your email for next steps.');
            document.getElementById('emailInput').value = '';
        } else {
            alert('Something went wrong. Please try again.');
        }
    } catch (error) {
        alert('Error signing up. Please try again.');
    }
});
```

---

## STEP 5: Create Netlify Function for Email Capture

**File:** `netlify/functions/add-email.js`

```javascript
const axios = require('axios');

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const { email, source } = JSON.parse(event.body);
        
        if (!email) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Email required' }) };
        }

        // Add to Mailchimp
        const mailchimpResponse = await addToMailchimp(email, source);
        
        // Send welcome email
        await sendWelcomeEmail(email);
        
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ success: true, message: 'Email added successfully' })
        };
        
    } catch (error) {
        console.error('Email signup error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    }
};

async function addToMailchimp(email, source) {
    const MAILCHIMP_API_KEY = process.env.MAILCHIMP_API_KEY;
    const MAILCHIMP_SERVER_PREFIX = process.env.MAILCHIMP_SERVER_PREFIX;
    const MAILCHIMP_LIST_ID = process.env.MAILCHIMP_LIST_ID;
    
    // Implementation depends on your Mailchimp setup
    // This is a placeholder - you'll need to add actual Mailchimp API calls
}

async function sendWelcomeEmail(email) {
    // Send welcome email via SendGrid
    // Implementation depends on your SendGrid setup
}
```

---

## STEP 6: Email Templates to Create

### Welcome Email Template
```
Subject: Welcome to SuiteSeat! Your free trial starts now 🎉

Hi there!

Thanks for signing up for SuiteSeat! I'm Sly, the creator, and I'm excited to help you streamline your booking process.

Here's what happens next:
1. Your 30-day free trial starts today
2. I'll personally help you set up your account
3. You'll get access to all Pro features

Questions? Just reply to this email - I read every single one.

Ready to eliminate no-shows? 
→ Start here: https://suiteseatbooking.com

Talk soon,
Sly
Founder, SuiteSeat

P.S. Follow me on Instagram @slybarber for booking tips and behind-the-scenes
```

### Booking Confirmation Template
```
Subject: Appointment Confirmed - [DATE] at [TIME]

Hi [CLIENT_NAME],

Your appointment is confirmed!

📅 Date: [DATE]
⏰ Time: [TIME]
✂️ Service: [SERVICE]
💰 Total: $[PRICE]
💳 Deposit: $[DEPOSIT] (paid)

📍 Location: [ADDRESS]

When you arrive, scan the QR code to check in:
https://suiteseatbooking.com/checkin.html

See you soon!
[BUSINESS_NAME]

Questions? Reply to this email or call [PHONE]
```

### Reminder Email Template
```
Subject: Reminder: Your appointment tomorrow at [TIME]

Hi [CLIENT_NAME],

Just a friendly reminder about your appointment:

📅 Tomorrow, [DATE] at [TIME]
✂️ [SERVICE] with [STYLIST_NAME]

Location: [ADDRESS]
Check-in: https://suiteseatbooking.com/checkin.html

Can't make it? Reply CANCEL to reschedule.

See you tomorrow!
[BUSINESS_NAME]
```

---

## STEP 7: Environment Variables to Add

Add these to your Netlify dashboard:

```
# Email Service API Keys
MAILCHIMP_API_KEY=your_mailchimp_api_key
MAILCHIMP_SERVER_PREFIX=us1  # or your server
MAILCHIMP_LIST_ID=your_list_id
SENDGRID_API_KEY=your_sendgrid_api_key

# Business Email (for sending)
BUSINESS_EMAIL=sly@suiteseatbooking.com
BUSINESS_NAME=SuiteSeat
```

---

## STEP 8: Quick Setup Checklist

- [ ] Choose email provider (Google Workspace recommended)
- [ ] Set up business email accounts
- [ ] Configure MX records in domain DNS
- [ ] Create Mailchimp account
- [ ] Set up SendGrid for transactional emails
- [ ] Add email capture to website
- [ ] Create Netlify function for email signup
- [ ] Add environment variables
- [ ] Test email workflows
- [ ] Create email templates

---

## Need Help?

**DNS/Domain Issues:** Contact your domain registrar
**Google Workspace Setup:** https://support.google.com/a/answer/63965
**Mailchimp Help:** https://mailchimp.com/help/
**SendGrid Docs:** https://docs.sendgrid.com/

**Questions for me?** Just ask - I'll walk you through any step!
