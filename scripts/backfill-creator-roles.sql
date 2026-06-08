-- Align User.role with Organization.type for existing creator accounts that
-- were all stored as ORGANIZER. Safe to run multiple times (idempotent).
--
-- Run in Supabase SQL editor or: psql $DATABASE_URL -f scripts/backfill-creator-roles.sql

UPDATE "User" u
SET role = o.type, "updatedAt" = NOW()
FROM "Organization" o
WHERE o."ownerId" = u.id
  AND u.role = 'ORGANIZER'
  AND o.type IN ('ARTIST_MANAGER', 'ARTIST', 'BUSINESS_OWNER');

-- Sync auth.users metadata so login door checks stay consistent.
UPDATE auth.users au
SET raw_user_meta_data = jsonb_set(
  COALESCE(au.raw_user_meta_data, '{}'::jsonb),
  '{role}',
  to_jsonb(u.role::text),
  true
)
FROM "User" u
WHERE au.id::text = u.id
  AND u.role IN ('ARTIST_MANAGER', 'ARTIST', 'BUSINESS_OWNER');
