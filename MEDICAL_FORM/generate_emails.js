// generate_emails.js - Generates placeholder email addresses for all employees and writes authorized_emails.json
const fs = require('fs');
const csvFile = 'SUPA_MED_2026.csv';
const outputFile = 'authorized_emails.json';
function nameToEmail(name) {
  // Convert name to lowercase, replace spaces with dots, remove non-alphanumeric characters
  return name.trim().toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, '.') + '@example.com';
}
fs.readFile(csvFile, 'utf8', (err, data) => {
  if (err) {
    console.error('Failed to read CSV:', err);
    return;
  }
  const lines = data.split(/\r?\n/).filter(l => l.trim() !== '');
  const emails = new Set();
  for (let i = 1; i < lines.length; i++) { // skip header
    const cols = lines[i].split(',');
    const name = cols[0];
    if (name) {
      emails.add(nameToEmail(name));
    }
  }
  fs.writeFileSync(outputFile, JSON.stringify(Array.from(emails), null, 2));
  console.log('Generated authorized_emails.json with', emails.size, 'emails');
});
