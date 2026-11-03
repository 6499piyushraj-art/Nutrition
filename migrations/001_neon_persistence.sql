-- MyNutri AI cloud persistence schema.
-- Applied to Neon project Nutrition, production branch, database neondb.

CREATE TABLE IF NOT EXISTS public.nutrition_profiles (
  profile_id text PRIMARY KEY CHECK (profile_id = 'primary'),
  targets jsonb NOT NULL CHECK (jsonb_typeof(targets) = 'object'),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.nutrition_meal_logs (
  id text PRIMARY KEY,
  profile_id text NOT NULL DEFAULT 'primary'
    REFERENCES public.nutrition_profiles(profile_id) ON DELETE CASCADE,
  meal_date date NOT NULL,
  meal_type text NOT NULL CHECK (meal_type IN ('Breakfast', 'Lunch', 'Dinner', 'Snack')),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  serving text NOT NULL CHECK (length(serving) BETWEEN 1 AND 120),
  nutrition jsonb NOT NULL CHECK (jsonb_typeof(nutrition) = 'object'),
  confidence text NOT NULL DEFAULT 'low' CHECK (confidence IN ('low', 'medium', 'high')),
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS nutrition_meal_logs_profile_date_idx
  ON public.nutrition_meal_logs (profile_id, meal_date DESC, created_at DESC);

REVOKE ALL ON TABLE public.nutrition_profiles, public.nutrition_meal_logs FROM PUBLIC;
