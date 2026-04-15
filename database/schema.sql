-- SuiteSeat SaaS Database Schema
-- Multi-tenant database with business_id isolation

-- Businesses table (tenant isolation)
CREATE TABLE businesses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    address TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    timezone TEXT DEFAULT 'America/New_York',
    square_api_key TEXT,
    twilio_sid TEXT,
    twilio_token TEXT,
    twilio_phone TEXT,
    stripe_customer_id TEXT,
    subscription_tier TEXT DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'pro', 'premium')),
    subscription_status TEXT DEFAULT 'active' CHECK (subscription_status IN ('active', 'cancelled', 'past_due')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Services table (per business)
CREATE TABLE services (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    duration_minutes INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    category TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Clients table (per business)
CREATE TABLE clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT NOT NULL,
    notes TEXT,
    total_appointments INTEGER DEFAULT 0,
    no_show_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Appointments table (per business)
CREATE TABLE appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    client_id INTEGER NOT NULL,
    service_id INTEGER NOT NULL,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'completed', 'cancelled', 'no_show')),
    deposit_paid BOOLEAN DEFAULT 0,
    deposit_amount DECIMAL(10,2) DEFAULT 0,
    square_payment_id TEXT,
    reminder_sent_24h BOOLEAN DEFAULT 0,
    reminder_sent_1h BOOLEAN DEFAULT 0,
    check_in_time DATETIME,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE,
    FOREIGN KEY (service_id) REFERENCES services(id) ON DELETE CASCADE
);

-- Business hours table (per business)
CREATE TABLE business_hours (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    open_time TIME,
    close_time TIME,
    is_closed BOOLEAN DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    UNIQUE(business_id, day_of_week)
);

-- Time off/blocked time table (per business)
CREATE TABLE time_off (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    start_datetime DATETIME NOT NULL,
    end_datetime DATETIME NOT NULL,
    reason TEXT,
    is_recurring BOOLEAN DEFAULT 0,
    recurring_pattern TEXT, -- 'weekly', 'monthly', etc.
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- SMS message log (per business)
CREATE TABLE sms_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    client_id INTEGER,
    direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
    message_type TEXT, -- 'confirmation', 'reminder', 'checkin', 'marketing'
    to_number TEXT NOT NULL,
    from_number TEXT NOT NULL,
    message TEXT NOT NULL,
    twilio_message_sid TEXT,
    status TEXT DEFAULT 'sent',
    sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE,
    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
);

-- User accounts for business owners/admins
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_id INTEGER NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'owner' CHECK (role IN ('owner', 'admin', 'staff')),
    is_active BOOLEAN DEFAULT 1,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (business_id) REFERENCES businesses(id) ON DELETE CASCADE
);

-- Insert sample business (for testing/migration)
INSERT INTO businesses (
    name, email, phone, address, city, state, zip_code, 
    square_api_key, twilio_sid, twilio_token, twilio_phone,
    subscription_tier
) VALUES (
    'Upper Cuts Barbershop',
    'sly@uppercutsbysly.com',
    '+17703340126',
    '2179 Lawrenceville Hwy',
    'Decatur',
    'GA',
    '30033',
    'YOUR_SQUARE_API_KEY',
    'YOUR_TWILIO_SID',
    'YOUR_TWILIO_TOKEN',
    '+18559203566',
    'pro'
);

-- Insert sample services for the business
INSERT INTO services (business_id, name, description, duration_minutes, price, deposit_amount, category) VALUES
(1, 'Kids Cut', 'Haircut for children under 12', 30, 26.00, 13.00, 'Haircuts'),
(1, 'Teen Cut', 'Haircut for teens 13-17', 30, 30.00, 15.00, 'Haircuts'),
(1, 'Premium Cut', 'Premium adult haircut with styling', 45, 46.00, 23.00, 'Haircuts'),
(1, 'Signature Cut', 'Signature haircut with beard trim', 60, 60.00, 30.00, 'Haircuts'),
(1, 'Beard Trim', 'Professional beard grooming', 30, 30.00, 15.00, 'Grooming'),
(1, 'Eyebrows', 'Eyebrow shaping and trimming', 15, 16.00, 8.00, 'Grooming'),
(1, 'Facial', 'Relaxing facial treatment', 45, 40.00, 20.00, 'Skincare');

-- Insert sample business hours
INSERT INTO business_hours (business_id, day_of_week, open_time, close_time, is_closed) VALUES
(1, 0, NULL, NULL, 1), -- Sunday closed
(1, 1, '09:00', '17:00', 0), -- Monday 9am-5pm
(1, 2, '11:00', '21:00', 0), -- Tuesday 11am-9pm
(1, 3, '12:00', '19:00', 0), -- Wednesday 12pm-7pm
(1, 4, NULL, NULL, 1), -- Thursday closed
(1, 5, '11:00', '21:00', 0), -- Friday 11am-9pm
(1, 6, '11:00', '21:00', 0); -- Saturday 11am-9pm

-- Create indexes for performance (after all tables are created)
CREATE INDEX idx_business_services ON services(business_id);
CREATE INDEX idx_business_clients ON clients(business_id);
CREATE INDEX idx_client_phone ON clients(phone);
CREATE INDEX idx_business_appointments ON appointments(business_id, appointment_date);
CREATE INDEX idx_appointment_status ON appointments(status);
CREATE INDEX idx_appointments_date ON appointments(appointment_date, appointment_time);
CREATE INDEX idx_business_time_off ON time_off(business_id, start_datetime);
CREATE INDEX idx_business_sms ON sms_logs(business_id, sent_at);
CREATE INDEX idx_user_email ON users(email);
CREATE INDEX idx_services_active ON services(is_active);