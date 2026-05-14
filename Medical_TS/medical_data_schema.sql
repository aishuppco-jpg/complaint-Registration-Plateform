-- Run this SQL in your Supabase SQL Editor to create the medical_data table

CREATE TABLE IF NOT EXISTS public.medical_data (
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
    
    -- Legacy dates (if used)
    year VARCHAR(4),
    month VARCHAR(20),
    date DATE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.medical_data ENABLE ROW LEVEL SECURITY;

-- Create basic policies (Allow all for testing - make sure to secure this later!)
CREATE POLICY "Enable read access for all users" ON public.medical_data FOR SELECT USING (true);
CREATE POLICY "Enable insert access for all users" ON public.medical_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update access for all users" ON public.medical_data FOR UPDATE USING (true);
CREATE POLICY "Enable delete access for all users" ON public.medical_data FOR DELETE USING (true);

-- Optional: Create an index on PNO for faster lookups
CREATE INDEX IF NOT EXISTS idx_medical_data_pno ON public.medical_data(pno);
