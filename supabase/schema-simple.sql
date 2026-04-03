-- ═══════════════════════════════════════════════════
-- FINPATH — Supabase Schema (Simple JSON approach)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════

-- 1. User data (stores entire app state as JSON, like localStorage)
CREATE TABLE IF NOT EXISTS user_data (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT,
  data JSONB NOT NULL DEFAULT '{}',
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'family')),
  stripe_customer_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Row Level Security — each user can only access their own data
ALTER TABLE user_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own data" ON user_data FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can insert own data" ON user_data FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own data" ON user_data FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can delete own data" ON user_data FOR DELETE USING (auth.uid() = id);

-- 3. Auto-create user_data row on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_data (id, email, data)
  VALUES (
    NEW.id,
    NEW.email,
    jsonb_build_object(
      'p', jsonb_build_object('name', COALESCE(NEW.raw_user_meta_data->>'name', ''), 'email', NEW.email, 'plan', 'free'),
      'trm', 4200,
      'inv', '[]'::jsonb,
      'deu', '[]'::jsonb,
      'gas', '{}'::jsonb,
      'ibk', '[]'::jsonb,
      'ingresos', '[]'::jsonb,
      'metas', '[]'::jsonb,
      'pen', jsonb_build_object('age', 35, 'rAge', 60, 'sv', 2500, 'cur', 120000, 'ret', 7, 'inf', 3, 'des', 6000, 'btcC', 56, 'btcP', 50000)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
