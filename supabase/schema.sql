-- =============================================
-- CAMPUS BITES: SAFE AUTH & PROFILE FIX
-- Creates profiles table, RLS policies and trigger
-- =============================================

-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY
        REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '',
    email TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Ensure required columns exist
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';

ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS created_at
    TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 3. Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Recreate policies safely
DROP POLICY IF EXISTS "Users read own profile"
    ON public.profiles;

CREATE POLICY "Users read own profile"
    ON public.profiles
    FOR SELECT
    TO authenticated
    USING ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users upsert own profile"
    ON public.profiles;

CREATE POLICY "Users upsert own profile"
    ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK ((SELECT auth.uid()) = id);

DROP POLICY IF EXISTS "Users update own profile"
    ON public.profiles;

CREATE POLICY "Users update own profile"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING ((SELECT auth.uid()) = id)
    WITH CHECK ((SELECT auth.uid()) = id);

-- 5. Create the new-user profile function
-- Explicit schema qualification prevents the missing
-- relation "profiles" error caused by search_path issues.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
    INSERT INTO public.profiles (id, name, email)
    VALUES (
        NEW.id,
        COALESCE(
            NEW.raw_user_meta_data ->> 'name',
            NEW.raw_user_meta_data ->> 'full_name',
            split_part(COALESCE(NEW.email, ''), '@', 1),
            ''
        ),
        COALESCE(NEW.email, '')
    )
    ON CONFLICT (id) DO UPDATE
    SET
        email = EXCLUDED.email,
        name = CASE
            WHEN public.profiles.name = ''
            THEN EXCLUDED.name
            ELSE public.profiles.name
        END;

    RETURN NEW;
END;
$function$;

-- 6. Recreate the trigger on Supabase Auth users
DROP TRIGGER IF EXISTS on_auth_user_created
    ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- 7. VERIFY TABLE AND TRIGGER
-- =============================================

SELECT
    table_schema,
    table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'profiles';

SELECT
    trigger_name,
    event_object_schema,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'
  AND event_object_schema = 'auth';