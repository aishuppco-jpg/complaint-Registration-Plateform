const fs = require('fs');
const path = require('path');
const csvPath = path.join(__dirname, 'SUPA_MED_2026.csv');
if (!fs.existsSync(csvPath)) {
  console.error('CSV not found');
  process.exit(1);
}
const data = fs.readFileSync(csvPath, 'utf8').trim().split('\n');
// header line
let header = data[0];
if (!header.includes('EMAIL')) {
  const cols = header.split(',');
  // Insert EMAIL after NAME (which is first column)
  const newHeader = [cols[0], '"EMAIL"', ...cols.slice(1)].join(',');
  data[0] = newHeader;
}
// Process rows
for (let i = 1; i < data.length; i++) {
  const line = data[i];
  if (!line) continue;
  const cols = line.split(',');
  // cols[0] is NAME with quotes
  const nameRaw = cols[0].replace(/"/g, '').trim();
  const email = nameRaw.replace(/ /g, '.').toLowerCase() + '@example.com';
  if (!cols[1] || !cols[1].includes('@')) {
    // Insert email after name
    const newLine = [cols[0], `"${email}"`, ...cols.slice(1)].join(',');
    data[i] = newLine;
  }
}
fs.writeFileSync(csvPath, data.join('\n'), 'utf8');
console.log('Email column added to CSV with placeholder emails.');
