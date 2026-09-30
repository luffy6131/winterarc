-- Winter Arc Supabase Idempotent Database Schema
-- Safe to execute multiple times in Supabase SQL Editor

-- 1. Create User Data Table
CREATE TABLE IF NOT EXISTS public.winter_arc_userdata (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    state_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable Row Level Security (RLS)
ALTER TABLE public.winter_arc_userdata ENABLE ROW LEVEL SECURITY;

-- 3. Idempotent Row Level Security (RLS) Policies
DROP POLICY IF EXISTS "Users can view their own data" ON public.winter_arc_userdata;
CREATE POLICY "Users can view their own data" 
ON public.winter_arc_userdata 
FOR SELECT 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own data" ON public.winter_arc_userdata;
CREATE POLICY "Users can insert their own data" 
ON public.winter_arc_userdata 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own data" ON public.winter_arc_userdata;
CREATE POLICY "Users can update their own data" 
ON public.winter_arc_userdata 
FOR UPDATE 
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own data" ON public.winter_arc_userdata;
CREATE POLICY "Users can delete their own data" 
ON public.winter_arc_userdata 
FOR DELETE 
USING (auth.uid() = user_id);

-- 4. Automatic Timestamp Update Function & Trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_winter_arc_userdata_updated_at ON public.winter_arc_userdata;

CREATE TRIGGER update_winter_arc_userdata_updated_at
BEFORE UPDATE ON public.winter_arc_userdata
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Enable Realtime Replication (Idempotent check)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'winter_arc_userdata'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.winter_arc_userdata;
  END IF;
END $$;
