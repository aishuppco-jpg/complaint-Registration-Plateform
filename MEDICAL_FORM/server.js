const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3000;
const CSV_FILE = path.join(__dirname, 'SUPA_MED_2026.csv');

app.use(cors());
app.use(bodyParser.json());

// Helper to format date for CSV (DD/MM/YYYY)
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

    fs.appendFile(CSV_FILE, '\n' + row, (err) => {
        if (err) {
            console.error("Error writing to CSV:", err);
            return res.status(500).json({ error: "Failed to save to CSV" });
        }
        console.log("New record added to CSV:", row);
        res.json({ success: true, message: "Record saved to CSV" });
    });
});

app.listen(PORT, () => {
    console.log(`CSV Helper Server running at http://localhost:${PORT}`);
    console.log(`Watching file: ${CSV_FILE}`);
});
