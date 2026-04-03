-- Fix: Add 'basico' to plan CHECK constraint
ALTER TABLE user_data DROP CONSTRAINT IF EXISTS user_data_plan_check;
ALTER TABLE user_data ADD CONSTRAINT user_data_plan_check CHECK (plan IN ('free', 'basico', 'pro'));
