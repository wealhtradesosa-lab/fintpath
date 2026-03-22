-- ═══════════════════════════════════════════════════
-- FINPATH — Supabase Schema
-- Run this in Supabase SQL Editor (supabase.com → SQL Editor)
-- ═══════════════════════════════════════════════════

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  name TEXT NOT NULL DEFAULT '',
  email TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'family')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  trm NUMERIC DEFAULT 4200,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Investments
CREATE TABLE IF NOT EXISTS investments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  ubicacion TEXT DEFAULT '',
  tipo TEXT DEFAULT 'Real Estate',
  valor_compra NUMERIC DEFAULT 0,
  valor_actual NUMERIC DEFAULT 0,
  unidades JSONB DEFAULT '[]',
  ingresos JSONB DEFAULT '[]',
  gastos JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Income (standalone)
CREATE TABLE IF NOT EXISTS ingresos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  categoria TEXT DEFAULT 'Otro',
  mensual NUMERIC DEFAULT 0,
  tipo TEXT DEFAULT 'fijo',
  fuente TEXT DEFAULT '',
  notas TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Debts
CREATE TABLE IF NOT EXISTS deudas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  nombre TEXT NOT NULL,
  tipo TEXT DEFAULT 'loan',
  monto NUMERIC DEFAULT 0,
  pago NUMERIC DEFAULT 0,
  tasa NUMERIC DEFAULT 0,
  linked_asset_id UUID REFERENCES investments(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Expenses (categories with items as JSONB for flexibility)
CREATE TABLE IF NOT EXISTS gastos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  categoria TEXT NOT NULL,
  items JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Trading positions
CREATE TABLE IF NOT EXISTS trading (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  ticker TEXT NOT NULL,
  nombre TEXT DEFAULT '',
  shares NUMERIC DEFAULT 0,
  costo NUMERIC DEFAULT 0,
  precio NUMERIC DEFAULT 0,
  target NUMERIC DEFAULT 0,
  sector TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Pension settings
CREATE TABLE IF NOT EXISTS pension_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL UNIQUE,
  age INT DEFAULT 35,
  retire_age INT DEFAULT 60,
  monthly_savings NUMERIC DEFAULT 2500,
  current_savings NUMERIC DEFAULT 120000,
  return_rate NUMERIC DEFAULT 7,
  inflation NUMERIC DEFAULT 3,
  desired_monthly NUMERIC DEFAULT 6000,
  btc_cagr NUMERIC DEFAULT 56,
  btc_price NUMERIC DEFAULT 50000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ ROW LEVEL SECURITY ═══
-- Users can only see/edit their own data

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE investments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingresos ENABLE ROW LEVEL SECURITY;
ALTER TABLE deudas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE trading ENABLE ROW LEVEL SECURITY;
ALTER TABLE pension_settings ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Investments
CREATE POLICY "Users own investments" ON investments FOR ALL USING (auth.uid() = user_id);

-- Ingresos
CREATE POLICY "Users own ingresos" ON ingresos FOR ALL USING (auth.uid() = user_id);

-- Deudas
CREATE POLICY "Users own deudas" ON deudas FOR ALL USING (auth.uid() = user_id);

-- Gastos
CREATE POLICY "Users own gastos" ON gastos FOR ALL USING (auth.uid() = user_id);

-- Trading
CREATE POLICY "Users own trading" ON trading FOR ALL USING (auth.uid() = user_id);

-- Pension
CREATE POLICY "Users own pension" ON pension_settings FOR ALL USING (auth.uid() = user_id);

-- ═══ AUTO-CREATE PROFILE ON SIGNUP ═══
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══ INDEXES ═══
CREATE INDEX IF NOT EXISTS idx_investments_user ON investments(user_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_user ON ingresos(user_id);
CREATE INDEX IF NOT EXISTS idx_deudas_user ON deudas(user_id);
CREATE INDEX IF NOT EXISTS idx_gastos_user ON gastos(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_user ON trading(user_id);
CREATE INDEX IF NOT EXISTS idx_pension_user ON pension_settings(user_id);
