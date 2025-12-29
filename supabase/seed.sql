-- Seed file for vibeworkout local development
-- This runs automatically after migrations during `supabase db reset`

-- Create a test user profile (will be linked to Supabase auth user)
-- Note: The actual auth user needs to be created via Supabase Auth
-- This just ensures the profile table has test data if needed

-- For now, we just ensure the schema is ready
-- Prisma handles the actual schema, this is for any Supabase-specific setup

SELECT 'vibeworkout seed complete' as status;
