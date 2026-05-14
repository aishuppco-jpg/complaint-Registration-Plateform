-- Run this SQL in your Supabase SQL Editor to correctly set up the medical_ts table
-- This ensures that the table exists and that it has the correct permissions (RLS)

CREATE TABLE IF NOT EXISTS public.medical_ts (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    pno VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    district VARCHAR(100),
    posting VARCHAR(100),
    
    -- Claim Details
    relation VARCHAR(100),
    disease VARCHAR(255),
    hospital VARCHAR(255),
    type VARCHAR(50) DEFAULT 'OPD',
    claimed_amt NUMERIC(12, 2) DEFAULT 0.00,
    passed_amount NUMERIC(12, 2) DEFAULT 0.00,
    
    -- Date Trackers
    received_in_office DATE,
    send_date DATE,
    objection_date DATE,
    resolve_date DATE,
    passed_date DATE,
    received_date DATE,
    payment_order_date DATE,
    
    -- Legacy dates
    year VARCHAR(4),
    month VARCHAR(20),
    date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.medical_ts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any to avoid errors on re-run
DROP POLICY IF EXISTS "Enable read access for all users" ON public.medical_ts;
DROP POLICY IF EXISTS "Enable insert access for all users" ON public.medical_ts;
DROP POLICY IF EXISTS "Enable update access for all users" ON public.medical_ts;
DROP POLICY IF EXISTS "Enable delete access for all users" ON public.medical_ts;

-- Create policies for public access (for testing/anonymous access)
CREATE POLICY "Enable read access for all users" ON public.medical_ts FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.medical_ts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.medical_ts FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.medical_ts FOR DELETE USING (true);

-- Index for faster PNO lookups
CREATE INDEX IF NOT EXISTS idx_medical_ts_pno ON public.medical_ts(pno);
