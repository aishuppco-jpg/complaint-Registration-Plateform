// medical_data.js

// Initialize Supabase client
// Note: Ensure that the Supabase CDN script is included in your HTML before linking this file:
// <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>

const SUPABASE_URL = 'https://uelegaajeynzatmtfcrv.supabase.co'; // Base URL
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVlbGVnYWFqZXluemF0bXRmY3J2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyNTMzMzEsImV4cCI6MjA5MzgyOTMzMX0.VpgtLGnhogul_1nVo-9ka-cH_gzoLD1XD4C3Bf9UBRI'; // Supabase anon key

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Fetch all medical records from Supabase table 'medical_data'
 */
async function fetchAllMedicalData() {
    try {
        const { data, error } = await supabaseClient
            .from('medical_data')
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
    try {
        const { data, error } = await supabaseClient
            .from('medical_data')
            .select('*')
            .eq('pno', pno);

        if (error) throw error;
        return data;
    } catch (error) {
        console.error(`Error fetching data for PNO ${pno}:`, error);
        return null;
    }
}

/**
 * Save a new medical record to Supabase table 'medical_data'
 */
async function saveMedicalDataToSupabase(record) {
    try {
        const { data, error } = await supabaseClient
            .from('medical_data')
            .insert([record])
            .select();

        if (error) throw error;
        console.log("Record saved successfully to Supabase:", data);
        return data;
    } catch (error) {
        console.error('Error saving data to Supabase:', error);
        return null;
    }
}

/**
 * Update an existing medical record in Supabase
 */
async function updateMedicalDataInSupabase(id, updates) {
    try {
        const { data, error } = await supabaseClient
            .from('medical_data')
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
