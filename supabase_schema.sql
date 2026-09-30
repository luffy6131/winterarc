-- Winter Arc Supabase Database Schema
-- Copy and run this script in your Supabase SQL Editor

-- 1. Create User Data Table
CREATE TABLE IF NOT EXISTS public.winter_arc_userdata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.winter_arc_userdata ENABLE ROW LEVEL SECURITY;

-- 3. Create RLS Policies
CREATE POLICY "Users can view their own data" 
ON public.winter_arc_userdata 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data" 
ON public.winter_arc_userdata 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data" 
ON public.winter_arc_userdata 
FOR UPDATE 
USING (auth.uid() = user_id);

-- 4. Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE public.winter_arc_userdata;
