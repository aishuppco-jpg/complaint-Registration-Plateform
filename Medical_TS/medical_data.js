// medical_data.js

// Initialize Supabase client
// Note: Ensure that the Supabase CDN script is included in your HTML before linking this file:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL = 'https://uelegaajeynzatmtfcrv.supabase.co'; // Base URL (Removed /rest/v1/)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlbGVnYWFqZXluemF0bXRmY3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTMzMzEsImV4cCI6MjA5MzgyOTMzMX0.VpgtLGnhogul_1nVo-9ka-cH_gzoLD1XD4C3Bf9UBRI'; // Supabase anon key

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
console.log("Supabase Client Initialized with URL:", SUPABASE_URL);

/**
 * Fetch all medical records from Supabase table 'medical_ts'
 */
async function fetchAllMedicalData() {
    try {
        const { data, error } = await supabaseClient
            .from('medical_ts')
            .select('*');

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching data from Supabase:', error);
        return null;
    }
}

/**
 * Fetch a specific employee's medical records by PNO
 */
async function fetchMedicalDataByPno(pno) {
    console.log(`Supabase API: Fetching data for PNO: ${pno}`);
    try {
        const { data, error } = await supabaseClient
            .from('medical_ts')
            .select('*')
            .eq('pno', String(pno).trim());

        if (error) {
            console.error(`Supabase API Error for PNO ${pno}:`, error);
            throw error;
        }
        console.log(`Supabase API: Found ${data ? data.length : 0} records for PNO ${pno}`);
        return data;
    } catch (error) {
        console.error(`Supabase API Exception for PNO ${pno}:`, error);
        return null;
    }
}

/**
 * Save a new medical record to Supabase table 'medical_ts'
 */
async function saveMedicalDataToSupabase(record) {
    console.log("Supabase API: Saving record:", record);
    try {
        const { data, error } = await supabaseClient
            .from('medical_ts')
            .insert([record])
            .select();

        if (error) {
            console.error("Supabase API Save Error:", error);
            throw error;
        }
        console.log("Supabase API: Record saved successfully:", data);
        return data;
    } catch (error) {
        console.error('Supabase API Save Exception:', error);
        return null;
    }
}

/**
 * Update an existing medical record in Supabase
 */
async function updateMedicalDataInSupabase(id, updates) {
    try {
        const { data, error } = await supabaseClient
            .from('medical_ts')
            .update(updates)
            .eq('id', id)
            .select();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating data in Supabase:', error);
        return null;
    }
}

// Expose the API to the window object for global access from HTML
window.supabaseAPI = {
    fetchMedicalDataByPno,
    saveMedicalDataToSupabase,
    fetchAllMedicalData,
    updateMedicalDataInSupabase
};
