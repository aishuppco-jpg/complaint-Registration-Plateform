// Server setup and dependencies
require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;
const CSV_FILE = path.join(__dirname, 'SUPA_MED_2026.csv');
const AUTHORIZED_EMAILS_FILE = path.join(__dirname, 'authorized_emails.json');
const MAPPINGS_FILE = path.join(__dirname, 'employee_mappings.json');
const JWT_SECRET = process.env.JWT_SECRET || 'up_police_medical_portal_secret_key_2026';

// In‑memory OTP cache
const otpStore = {};

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));

// ---------- Utility Functions ----------
function formatToCSVDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

function getLocalClaims() {
    try {
        const filePath = path.join(__dirname, 'local_data.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const start = content.indexOf('[');
        const end = content.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
            const jsonText = content.substring(start, end + 1);
            return JSON.parse(jsonText);
        }
    } catch (e) {
        console.error('Error reading local claims:', e);
    }
    return [];
}

function getAuthorizedEmails() {
    try {
        if (!fs.existsSync(AUTHORIZED_EMAILS_FILE)) return [];
        return JSON.parse(fs.readFileSync(AUTHORIZED_EMAILS_FILE, 'utf8'));
    } catch (e) {
        console.error('Error reading authorized_emails.json', e);
        return [];
    }
}

function getMappings() {
    try {
        if (!fs.existsSync(MAPPINGS_FILE)) return {};
        return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8'));
    } catch (e) {
        console.error('Error reading employee_mappings.json', e);
        return {};
    }
}

function saveMappings(mappings) {
    try {
        fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2), 'utf8');
    } catch (e) {
        console.error('Error saving employee_mappings.json', e);
    }
}

// ---------- Email / OTP Helper ----------
async function sendOTPEmail(email, otp) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@uppolice.gov.in';

    if (smtpHost && smtpUser && smtpPass) {
        try {
            const transporter = nodemailer.createTransport({
                host: smtpHost,
                port: parseInt(smtpPort, 10),
                secure: smtpPort == 465,
                auth: { user: smtpUser, pass: smtpPass }
            });
            await transporter.sendMail({
                from: `"UP Police Medical Portal" <${smtpFrom}>`,
                to: email,
                subject: 'OTP Verification - UP Police Medical Portal',
                text: `Your One-Time Password (OTP) is: ${otp}. Valid for 5 minutes.`,
                html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:20px;border:1px solid #e2e8f0;border-radius:8px;">
                    <h2 style="color:#1e3a8a;">UP Police Medical Portal</h2>
                    <p>Dear Employee,</p>
                    <p>Your OTP is:</p>
                    <div style="text-align:center;margin:30px 0;padding:15px;background:#f1f5f9;border-radius:6px;font-size:32px;font-weight:bold;color:#1e3a8a;">${otp}</div>
                    <p>This OTP is valid for <b>5 minutes</b>. Do not share it.</p>
                </div>`
            });
            console.log(`Email sent to ${email}`);
            return true;
        } catch (error) {
            console.error('Nodemailer error, falling back to console log:', error);
        }
    }
    // Fallback: log to console for dev mode
    console.log(`\n=== OTP DEBUG ===\nEmail: ${email}\nOTP: ${otp}\n===`);
    return false;
}

// ---------- Auth Endpoints ----------
app.post('/api/auth/request-otp', async (req, res) => {
    const { email, pno } = req.body;
    if (!email || !pno) return res.status(400).json({ error: 'Email and PNO are required.' });

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPno = pno.trim();

    // Authorized email check
    const authorizedEmails = getAuthorizedEmails();
    if (!authorizedEmails.includes(trimmedEmail)) {
        return res.status(403).json({ error: 'This email ID is not authorized to access the portal.' });
    }

    // Mapping safety checks
    const mappings = getMappings();
    if (mappings[trimmedEmail] && mappings[trimmedEmail] !== trimmedPno) {
        return res.status(400).json({ error: 'This email address is already registered to a different PNO.' });
    }
    const existingEmailForPno = Object.keys(mappings).find(k => mappings[k] === trimmedPno);
    if (existingEmailForPno && existingEmailForPno !== trimmedEmail) {
        return res.status(400).json({ error: 'This PNO is already registered to a different email address.' });
    }

    // Verify PNO exists in claims data
    const claims = getLocalClaims();
    if (!claims.some(c => String(c.PNO) === trimmedPno)) {
        return res.status(404).json({ error: 'PNO not found in the claims database.' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 5 * 60 * 1000; // 5 minutes
    otpStore[trimmedEmail] = { otp, pno: trimmedPno, expires };

    const sentReal = await sendOTPEmail(trimmedEmail, otp);
    res.json({ success: true, message: 'OTP sent.', debugOtp: sentReal ? undefined : otp });
});

app.post('/api/auth/verify-otp', (req, res) => {
    const { email, pno, otp } = req.body;
    if (!email || !pno || !otp) return res.status(400).json({ error: 'Email, PNO, and OTP are required.' });

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPno = pno.trim();
    const cached = otpStore[trimmedEmail];
    if (!cached) return res.status(400).json({ error: 'No OTP request found for this email.' });
    if (Date.now() > cached.expires) {
        delete otpStore[trimmedEmail];
        return res.status(400).json({ error: 'OTP has expired. Please request a new one.' });
    }
    if (cached.otp !== otp.trim() || cached.pno !== trimmedPno) {
        return res.status(400).json({ error: 'Invalid OTP.' });
    }
    // Successful verification
    delete otpStore[trimmedEmail];
    const mappings = getMappings();
    if (!mappings[trimmedEmail]) {
        mappings[trimmedEmail] = trimmedPno;
        saveMappings(mappings);
    }
    // Fetch employee name/designation for profile
    const claims = getLocalClaims();
    const record = claims.find(c => String(c.PNO) === trimmedPno) || {};
    const token = jwt.sign({ email: trimmedEmail, pno: trimmedPno }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ success: true, token, employee: { email: trimmedEmail, pno: trimmedPno, name: record.NAME || '', designation: record.DESIGNATION || '' } });
});

// ---------- Secure Claims Endpoint ----------
app.get('/api/employee/my-claims', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) return res.status(401).json({ error: 'No token provided.' });
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const pno = decoded.pno;
        const claims = getLocalClaims();
        const userClaims = claims.filter(c => String(c.PNO) === String(pno)).map(c => ({
            name: c.NAME,
            designation: c.DESIGNATION,
            pno: c.PNO,
            relation: c.RELATION,
            received_in_office: c['RECIVED IN OFFICE'] || '',
            send_date: c['SEND DATE'] || '',
            claimed_amt: c['CLAIMED AMT'] || '0',
            objection_date: c['OBJECTION DATE'] || '',
            resolve_date: c['RESOLVE DATE'] || '',
            passed_amount: c['PASSED AMOUNT'] || '0',
            passed_date: c['PASSED DATE'] || '',
            received_date: c['RECIVED DATE'] || '',
            payment_order_date: c['PAYMENT ORDER DATE'] || ''
        }));
        res.json({ success: true, pno, claims: userClaims });
    } catch (err) {
        console.error('Token verification failed:', err);
        res.status(401).json({ error: 'Invalid or expired token.' });
    }
});

// ---------- Save New Claim Endpoint ----------
app.post('/save', (req, res) => {
    const data = req.body;
    const row = [
        `"${data.name || ''}"`,
        `"${data.designation || ''}"`,
        `"${data.pno || ''}"`,
        `"${data.relation || ''}"`,
        formatToCSVDate(data.received_in_office),
        formatToCSVDate(data.send_date),
        data.claimed_amt || 0,
        formatToCSVDate(data.objection_date),
        formatToCSVDate(data.resolve_date),
        data.passed_amount || 0,
        formatToCSVDate(data.passed_date),
        formatToCSVDate(data.received_date),
        formatToCSVDate(data.payment_order_date)
    ].join(',');

    fs.appendFile(CSV_FILE, '\n' + row, err => {
        if (err) {
            console.error('Error writing to CSV:', err);
            return res.status(500).json({ error: 'Failed to save to CSV' });
        }
        // Update local_data.js
        const localDataFile = path.join(__dirname, 'local_data.js');
        fs.readFile(localDataFile, 'utf8', (readErr, localContent) => {
            if (readErr) {
                console.error('Error reading local_data.js:', readErr);
                return res.json({ success: true, message: 'Record saved to CSV, but local_data.js update failed' });
            }
            const lastBracket = localContent.lastIndexOf(']');
            if (lastBracket !== -1) {
                const newObj = {
                    "NAME": data.name || '',
                    "DESIGNATION": data.designation || '',
                    "PNO": data.pno || '',
                    "RELATION": data.relation || '',
                    "RECIVED IN OFFICE": formatToCSVDate(data.received_in_office),
                    "SEND DATE": formatToCSVDate(data.send_date),
                    "CLAIMED AMT": data.claimed_amt ? String(data.claimed_amt) : '0',
                    "OBJECTION DATE": formatToCSVDate(data.objection_date),
                    "RESOLVE DATE": formatToCSVDate(data.resolve_date),
                    "PASSED AMOUNT": data.passed_amount ? String(data.passed_amount) : '0',
                    "PASSED DATE": formatToCSVDate(data.passed_date),
                    "RECIVED DATE": formatToCSVDate(data.received_date),
                    "PAYMENT ORDER DATE": formatToCSVDate(data.payment_order_date)
                };
                const insert = ',\n    ' + JSON.stringify(newObj, null, 4).replace(/\n/g, '\n    ');
                const updated = localContent.substring(0, lastBracket).trimEnd() + insert + '\n]';
                fs.writeFile(localDataFile, updated, 'utf8', writeErr => {
                    if (writeErr) {
                        console.error('Error writing local_data.js:', writeErr);
                        return res.json({ success: true, message: 'Record saved to CSV, but local_data.js update failed' });
                    }
                    res.json({ success: true, message: 'Record saved to CSV and local_data.js' });
                });
            } else {
                res.json({ success: true, message: 'Record saved to CSV, local_data.js format invalid' });
            }
        });
    });
});

app.listen(PORT, () => {
    console.log(`CSV Helper Server running at http://localhost:${PORT}`);
    console.log(`Watching file: ${CSV_FILE}`);
});

const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

const app = express();
const PORT = 3000;
const CSV_FILE = path.join(__dirname, 'SUPA_MED_2026.csv');
const AUTHORIZED_EMAILS_FILE = path.join(__dirname, 'authorized_emails.json');
const MAPPINGS_FILE = path.join(__dirname, 'employee_mappings.json');
const JWT_SECRET = process.env.JWT_SECRET || 'up_police_medical_portal_secret_key_2026';

const otpStore = {};

app.use(cors());
app.use(bodyParser.json());
app.use(express.static(__dirname));


// Add required modules
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// OTP store (email+PNO => { otp, expires })
const otpStore = {};

// Helper to generate 6-digit OTP
function generateOTP() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// Endpoint to request OTP
app.post('/api/auth/request-otp', async (req, res) => {
  const { email, pno } = req.body;
  if (!email || !pno) return res.status(400).json({ error: 'Email and PNO are required.' });
  // Verify employee exists in CSV
  const csv = require('fs').readFileSync('SUPA_MED_2026.csv', 'utf8');
  const rows = csv.split('\n').slice(1);
  const found = rows.some(line => {
    const cols = line.split(',');
    const emailCol = cols[0].replace(/"/g, '').trim(); // assuming email column added later
    const pnoCol = cols[2].replace(/"/g, '').trim();
    return emailCol.toLowerCase() === email.toLowerCase() && pnoCol === pno;
  });
  if (!found) return res.status(404).json({ error: 'Employee not found.' });
  const otp = generateOTP();
  const expires = Date.now() + 5 * 60 * 1000; // 5 mins
  otpStore[`${email}|${pno}`] = { otp, expires };
  // Mock email sending - return OTP for dev
  return res.json({ message: 'OTP sent.', debugOtp: otp });
});

// Endpoint to verify OTP
app.post('/api/auth/verify-otp', async (req, res) => {
  const { email, pno, otp } = req.body;
  if (!email || !pno || !otp) return res.status(400).json({ error: 'Email, PNO, and OTP are required.' });
  const key = `${email}|${pno}`;
  const entry = otpStore[key];
  if (!entry) return res.status(400).json({ error: 'No OTP request found.' });
  if (Date.now() > entry.expires) return res.status(400).json({ error: 'OTP expired.' });
  if (entry.otp !== otp) return res.status(400).json({ error: 'Invalid OTP.' });
  // Successful, generate JWT token
  const token = jwt.sign({ email, pno }, JWT_SECRET, { expiresIn: '2h' });
  // Retrieve employee data from CSV
  const csv = require('fs').readFileSync('SUPA_MED_2026.csv', 'utf8');
  const rows = csv.split('\n').slice(1);
  let employee = null;
  for (const line of rows) {
    const cols = line.split(',');
    const emailCol = cols[0].replace(/"/g, '').trim();
    const pnoCol = cols[2].replace(/"/g, '').trim();
    if (emailCol.toLowerCase() === email.toLowerCase() && pnoCol === pno) {
      employee = {
        name: cols[0].replace(/"/g, '').trim(),
        designation: cols[1].replace(/"/g, '').trim(),
        pno: pnoCol,
        relation: cols[3].replace(/"/g, '').trim()
      };
      break;
    }
  }
  if (!employee) return res.status(404).json({ error: 'Employee record not found.' });
  // Clean up OTP
  delete otpStore[key];
  return res.json({ token, employee });
});

function formatToCSVDate(dateStr) {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    const d = String(date.getDate()).padStart(2, '0');
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const y = date.getFullYear();
    return `${d}/${m}/${y}`;
}

app.post('/save', (req, res) => {
    const data = req.body;
    
    // Map internal fields back to CSV columns
    // Columns: NAME,DESIGNATION,PNO,RELATION,RECIVED IN OFFICE,SEND DATE,CLAIMED AMT,OBJECTION DATE,RESOLVE DATE,PASSED AMOUNT,PASSED DATE,RECIVED DATE,PAYMENT ORDER DATE
    const row = [
        `"${data.name || ''}"`,
        `"${data.designation || ''}"`,
        `"${data.pno || ''}"`,
        `"${data.relation || ''}"`,
        formatToCSVDate(data.received_in_office),
        formatToCSVDate(data.send_date),
        data.claimed_amt || 0,
        formatToCSVDate(data.objection_date),
        formatToCSVDate(data.resolve_date),
        data.passed_amount || 0,
        formatToCSVDate(data.passed_date),
        formatToCSVDate(data.received_date),
        formatToCSVDate(data.payment_order_date)
    ].join(',');

    // 1. Append to CSV
    fs.appendFile(CSV_FILE, '\n' + row, (err) => {
        if (err) {
            console.error("Error writing to CSV:", err);
            return res.status(500).json({ error: "Failed to save to CSV" });
        }
        console.log("New record added to CSV:", row);

        // 2. Append to local_data.js
        const localDataFile = path.join(__dirname, 'local_data.js');
        fs.readFile(localDataFile, 'utf8', (readErr, localContent) => {
            if (readErr) {
                console.error("Error reading local_data.js:", readErr);
                // Return success anyway, since CSV was saved successfully
                return res.json({ success: true, message: "Record saved to CSV, but local_data.js update failed" });
            }

            const lastBracketIndex = localContent.lastIndexOf(']');
            if (lastBracketIndex !== -1) {
                const newRecordObj = {
                    "NAME": data.name || '',
                    "DESIGNATION": data.designation || '',
                    "PNO": data.pno || '',
                    "RELATION": data.relation || '',
                    "RECIVED IN OFFICE": formatToCSVDate(data.received_in_office),
                    "SEND DATE": formatToCSVDate(data.send_date),
                    "CLAIMED AMT": data.claimed_amt ? String(data.claimed_amt) : '0',
                    "OBJECTION DATE": formatToCSVDate(data.objection_date),
                    "RESOLVE DATE": formatToCSVDate(data.resolve_date),
                    "PASSED AMOUNT": data.passed_amount ? String(data.passed_amount) : '0',
                    "PASSED DATE": formatToCSVDate(data.passed_date),
                    "RECIVED DATE": formatToCSVDate(data.received_date),
                    "PAYMENT ORDER DATE": formatToCSVDate(data.payment_order_date)
                };

                const recordString = ',\n    ' + JSON.stringify(newRecordObj, null, 4).replace(/\n/g, '\n    ');
                const updatedContent = localContent.substring(0, lastBracketIndex).trimEnd() + recordString + '\n]';

                fs.writeFile(localDataFile, updatedContent, 'utf8', (writeErr) => {
                    if (writeErr) {
                        console.error("Error writing local_data.js:", writeErr);
                        return res.json({ success: true, message: "Record saved to CSV, but local_data.js update failed" });
                    }
                    console.log("New record successfully appended to local_data.js!");
                    res.json({ success: true, message: "Record saved to CSV and local_data.js" });
                });
            } else {
                console.error("Could not find closing bracket in local_data.js");
                res.json({ success: true, message: "Record saved to CSV, local_data.js format invalid" });
            }
        });
    });
});

// Helper to retrieve all records dynamically from local_data.js
function getLocalClaims() {
    try {
        const filePath = path.join(__dirname, 'local_data.js');
        const content = fs.readFileSync(filePath, 'utf8');
        const start = content.indexOf('[');
        const end = content.lastIndexOf(']');
        if (start !== -1 && end !== -1) {
            const jsonText = content.substring(start, end + 1);
            return JSON.parse(jsonText);
        }
    } catch (e) {
        console.error("Error reading local claims:", e);
    }
    return [];
}

function getAuthorizedEmails() {
    try {
        if (!fs.existsSync(AUTHORIZED_EMAILS_FILE)) return [];
        return JSON.parse(fs.readFileSync(AUTHORIZED_EMAILS_FILE, 'utf8'));
    } catch (e) {
        console.error("Error reading authorized_emails.json", e);
        return [];
    }
}

function getMappings() {
    try {
        if (!fs.existsSync(MAPPINGS_FILE)) return {};
        return JSON.parse(fs.readFileSync(MAPPINGS_FILE, 'utf8'));
    } catch (e) {
        console.error("Error reading employee_mappings.json", e);
        return {};
    }
}

function saveMappings(mappings) {
    try {
        fs.writeFileSync(MAPPINGS_FILE, JSON.stringify(mappings, null, 2), 'utf8');
    } catch (e) {
        console.error("Error saving employee_mappings.json", e);
    }
}

// SMTP/Email Helper
async function sendOTPEmail(email, otp) {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT || 587;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const smtpFrom = process.env.SMTP_FROM || 'no-reply@uppolice.gov.in';

    if (smtpHost && smtpUser && smtpPass) {
        try {
            let transporter = nodemailer.createTransport({
                host: smtpHost,
                port: parseInt(smtpPort, 10),
                secure: smtpPort == 465,
                auth: {
                    user: smtpUser,
                    pass: smtpPass
                }
            });

            let info = await transporter.sendMail({
                from: `"UP Police Medical Portal" <${smtpFrom}>`,
                to: email,
                subject: "OTP Verification - UP Police Medical Portal",
                text: `Your One-Time Password (OTP) for logging in is: ${otp}. This OTP is valid for 5 minutes.`,
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;">
                        <div style="text-align: center; margin-bottom: 20px;">
                            <h2 style="color: #1e3a8a; margin: 0;">UP Police Medical Portal</h2>
                            <p style="color: #64748b; font-size: 14px; margin: 5px 0 0 0;">Technical Services, Uttar Pradesh</p>
                        </div>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin-bottom: 20px;">
                        <p style="font-size: 16px; color: #0f172a;">Dear Employee,</p>
                        <p style="font-size: 16px; color: #334155; line-height: 1.5;">
                            You have requested an OTP to log in to the secure employee portal. Please use the following One-Time Password to complete your verification:
                        </p>
                        <div style="text-align: center; margin: 30px 0; padding: 15px; background-color: #f1f5f9; border-radius: 6px; font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #1e3a8a;">
                            ${otp}
                        </div>
                        <p style="font-size: 14px; color: #64748b; line-height: 1.5;">
                            This OTP is valid for <b>5 minutes</b>. Please do not share this code with anyone.
                        </p>
                        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;">
                        <p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 0;">
                            This is an automated system email. Please do not reply directly.
                        </p>
                    </div>
                `
            });
            console.log(`Email successfully sent to ${email}. MessageId: ${info.messageId}`);
            return true;
        } catch (error) {
            console.error("Nodemailer send error, falling back to console log:", error);
        }
    }

    console.log(`\n========================================\n[OTP DEBUG LOG]\nEmail: ${email}\nOTP: ${otp}\n========================================\n`);
    return false;
}

// 1. Request OTP Endpoint
app.post('/api/auth/request-otp', async (req, res) => {
    const { email, pno } = req.body;
    
    if (!email || !pno) {
        return res.status(400).json({ error: "Email and PNO are required" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPno = pno.trim();

    // Verify email is authorized
    const authorizedEmails = getAuthorizedEmails();
    if (!authorizedEmails.includes(trimmedEmail)) {
        return res.status(403).json({ error: "This email ID is not authorized to access the portal." });
    }

    // Verify mappings to prevent unauthorized pairing hijacking
    const mappings = getMappings();
    
    // Check if email is already mapped to a different PNO
    if (mappings[trimmedEmail] && mappings[trimmedEmail] !== trimmedPno) {
        return res.status(400).json({ error: "This email address is already registered to a different PNO." });
    }

    // Check if PNO is already mapped to a different email
    const existingEmailForPno = Object.keys(mappings).find(key => mappings[key] === trimmedPno);
    if (existingEmailForPno && existingEmailForPno !== trimmedEmail) {
        return res.status(400).json({ error: "This PNO is already registered to a different email address." });
    }

    // Verify PNO exists in our claims database
    const claims = getLocalClaims();
    const pnoExists = claims.some(c => String(c.PNO) === trimmedPno);
    if (!pnoExists) {
        return res.status(404).json({ error: "PNO not found in the claims database." });
    }

    // Generate OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 5 * 60 * 1000; // 5 mins cache

    otpStore[trimmedEmail] = { otp, pno: trimmedPno, expires };

    // Send OTP (Nodemailer or Mock output)
    const sentRealEmail = await sendOTPEmail(trimmedEmail, otp);

    res.json({ 
        success: true, 
        message: "OTP sent successfully to your registered email.",
        debugOtp: sentRealEmail ? undefined : otp 
    });
});

// 2. Verify OTP Endpoint
app.post('/api/auth/verify-otp', (req, res) => {
    const { email, pno, otp } = req.body;

    if (!email || !pno || !otp) {
        return res.status(400).json({ error: "Email, PNO, and OTP are required" });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPno = pno.trim();
    const trimmedOtp = otp.trim();

    const cached = otpStore[trimmedEmail];

    if (!cached) {
        return res.status(400).json({ error: "No OTP request found for this email." });
    }

    if (Date.now() > cached.expires) {
        delete otpStore[trimmedEmail];
        return res.status(400).json({ error: "OTP has expired. Please request a new one." });
    }

    if (cached.otp !== trimmedOtp || cached.pno !== trimmedPno) {
        return res.status(400).json({ error: "Invalid OTP. Please try again." });
    }

    // Verify successful!
    delete otpStore[trimmedEmail];

    // Persist mapping
    const mappings = getMappings();
    if (!mappings[trimmedEmail]) {
        mappings[trimmedEmail] = trimmedPno;
        saveMappings(mappings);
    }

    // Retrieve name and designation for dashboard profile display
    const claims = getLocalClaims();
    const empRecord = claims.find(c => String(c.PNO) === trimmedPno);
    const empName = empRecord ? empRecord.NAME : "Employee";
    const empDesignation = empRecord ? empRecord.DESIGNATION : "";

    // Generate 24-hour token
    const token = jwt.sign(
        { email: trimmedEmail, pno: trimmedPno },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    res.json({
        success: true,
        token,
        employee: {
            pno: trimmedPno,
            email: trimmedEmail,
            name: empName,
            designation: empDesignation
        }
    });
});

// 3. Secure Claims Endpoint
app.get('/api/employee/my-claims', (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: "No token provided, access denied" });
    }

    const token = authHeader.split(' ')[1];

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const pno = decoded.pno;

        const claims = getLocalClaims();
        const userClaims = claims.filter(c => String(c.PNO) === String(pno));

        // Format fields for frontend output
        const formattedClaims = userClaims.map(c => ({
            name: c.NAME,
            designation: c.DESIGNATION,
            pno: c.PNO,
            relation: c.RELATION,
            received_in_office: c["RECIVED IN OFFICE"] || '',
            send_date: c["SEND DATE"] || '',
            claimed_amt: c["CLAIMED AMT"] || '0',
            objection_date: c["OBJECTION DATE"] || '',
            resolve_date: c["RESOLVE DATE"] || '',
            passed_amount: c["PASSED AMOUNT"] || '0',
            passed_date: c["PASSED DATE"] || '',
            received_date: c["RECIVED DATE"] || '',
            payment_order_date: c["PAYMENT ORDER DATE"] || ''
        }));

        res.json({
            success: true,
            pno: pno,
            claims: formattedClaims
        });

    } catch (err) {
        console.error("Token verification failed:", err);
        return res.status(401).json({ error: "Invalid or expired session token. Please log in again." });
    }
});

app.listen(PORT, () => {
    console.log(`CSV Helper Server running at http://localhost:${PORT}`);
    console.log(`Watching file: ${CSV_FILE}`);
});

