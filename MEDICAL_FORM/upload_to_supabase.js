const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');

const SUPABASE_URL = 'https://rrgtcspactmapauaqiav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3Rjc3BhY3RtYXBhdWFxaWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTE5MjksImV4cCI6MjA5MzQ2NzkyOX0.DWiJ2KPitmdA5AN0NiLIywiQ7TwvFwuuZW9QyVpMEHw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function parseDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    let parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length !== 3) return null;
    
    let d = parseInt(parts[0]);
    let m = parseInt(parts[1]);
    let y = parseInt(parts[2]);
    
    if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
    if (y < 100) y += 2000;
    if (y < 2000 || y > 2100) return null; // basic validation for things like "204"

    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseAmount(amtStr) {
    if (!amtStr) return 0;
    const clean = amtStr.toString().replace(/,/g, '').trim();
    const val = parseFloat(clean);
    return isNaN(val) ? 0 : val;
}

const results = [];

fs.createReadStream('SUPA_MED_2026.csv')
  .pipe(csv())
  .on('data', (data) => {
      // Map to Supabase Schema
      // Keys from CSV: NAME,DESIGNATION,PNO,RELATION,RECIVED IN OFFICE,SEND DATE,CLAIMED AMT,OBJECTION DATE,RESOLVE DATE,PASSED AMOUNT,PASSED DATE,RECIVED DATE,PAYMENT ORDER DATE
      
      const record = {
          pno: data['PNO'] || 'UNKNOWN',
          name: data['NAME'] || 'Unknown',
          designation: data['DESIGNATION'] || null,
          relation: data['RELATION'] || null,
          
          received_in_office: parseDate(data['RECIVED IN OFFICE']),
          send_date: parseDate(data['SEND DATE']),
          objection_date: parseDate(data['OBJECTION DATE']),
          resolve_date: parseDate(data['RESOLVE DATE']),
          passed_date: parseDate(data['PASSED DATE']),
          received_date: parseDate(data['RECIVED DATE']),
          payment_order_date: parseDate(data['PAYMENT ORDER DATE']),
          
          claimed_amt: parseAmount(data['CLAIMED AMT']),
          passed_amount: parseAmount(data['PASSED AMOUNT']),
      };
      
      // Basic fallback since schema requires pno and name
      if (!record.pno || record.pno.trim() === '') record.pno = 'NOT_PROVIDED';
      if (!record.name || record.name.trim() === '') record.name = 'Unknown';

      results.push(record);
  })
  .on('end', async () => {
      console.log(`Parsed ${results.length} rows from CSV.`);
      
      // Upload in batches of 100 to avoid rate limits
      const BATCH_SIZE = 100;
      let successCount = 0;
      
      for (let i = 0; i < results.length; i += BATCH_SIZE) {
          const batch = results.slice(i, i + BATCH_SIZE);
          
          const { data, error } = await supabase
              .from('medical_data')
              .insert(batch);
              
          if (error) {
              console.error(`Error inserting batch ${i / BATCH_SIZE + 1}:`, error);
          } else {
              successCount += batch.length;
              console.log(`Successfully inserted batch ${i / BATCH_SIZE + 1} (${batch.length} rows).`);
          }
      }
      
      console.log(`Upload complete. Successfully uploaded ${successCount} out of ${results.length} records.`);
  });
