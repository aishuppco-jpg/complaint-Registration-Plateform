const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const csv = require('csv-parser');

const SUPABASE_URL = 'https://rrgtcspactmapauaqiav.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJyZ3Rjc3BhY3RtYXBhdWFxaWF2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4OTE5MjksImV4cCI6MjA5MzQ2NzkyOX0.DWiJ2KPitmdA5AN0NiLIywiQ7TwvFwuuZW9QyVpMEHw';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const results = [];

fs.createReadStream('SUPA_MED_2026.csv')
  .pipe(csv())
  .on('data', (data) => {
      const cleaned = {};
      for (const [k, v] of Object.entries(data)) {
          // Replace multiple spaces with a single space to fix 'CLAIMED  AMT' vs 'CLAIMED AMT'
          let trimmedKey = k.trim().replace(/^"|"$/g, '').replace(/\s+/g, ' ');
          let trimmedVal = v ? v.trim().replace(/^"|"$/g, '') : null;
          if (trimmedVal === "") trimmedVal = null;
          
          cleaned[trimmedKey] = trimmedVal;
      }
      
      // Ensure PNO is present
      if (cleaned['PNO']) {
         results.push(cleaned);
      }
  })
  .on('end', async () => {
      console.log(`Parsed ${results.length} valid rows from CSV.`);
      
      // Upload in batches of 100
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
      
      console.log(`Upload complete. Successfully uploaded ${successCount} out of ${results.length} records to Supabase.`);
  });
