const fs = require('fs');
const csv = require('csv-parser');

const results = [];
fs.createReadStream('SUPA_MED_2026.csv')
  .pipe(csv())
  .on('data', (data) => {
      // Just keep exactly the parsed object
      // Fix the double space in CLAIMED  AMT so it's consistent if we want, or leave it. 
      // Actually, better to fix it so the frontend expects CLAIMED AMT.
      const cleaned = {};
      for (let k in data) {
          let trimmedKey = k.trim().replace(/\s+/g, ' '); // normalizes "CLAIMED  AMT" to "CLAIMED AMT"
          cleaned[trimmedKey] = data[k];
      }
      results.push(cleaned);
  })
  .on('end', () => {
      const output = 'const LOCAL_DATA = ' + JSON.stringify(results, null, 4) + ';';
      fs.writeFileSync('local_data.js', output);
      console.log(`Successfully parsed ${results.length} records and wrote to local_data.js`);
  });
