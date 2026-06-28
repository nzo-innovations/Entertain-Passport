-- Demo venue: The Long Bar (pub with weekly live music)
-- Run against Supabase after `npm run db:push`.
-- Replace :ORG_ID with a BUSINESS_OWNER organization id from your database.

-- Example: link to an existing business owner org
-- INSERT INTO "Venue" (...) - use Prisma/portal UI instead for easiest setup.

-- Weekly program seed (after venue exists):
-- INSERT INTO "VenueProgram" ("id","venueId","title","performerName","actType","recurrence","dayOfWeek","startTime","endTime","isPublished","sortOrder","createdAt","updatedAt")
-- VALUES
--   (gen_random_uuid()::text, '<venue-id>', 'Acoustic Session', 'Various artists', 'SOLO', 'WEEKLY', 1, '20:00', '23:00', true, 0, now(), now()),
--   (gen_random_uuid()::text, '<venue-id>', 'Live Band Night', 'The Long Bar House Band', 'FULL_BAND', 'WEEKLY', 3, '21:00', '00:30', true, 1, now(), now()),
--   (gen_random_uuid()::text, '<venue-id>', 'DJ Friday', 'Resident DJ', 'DJ', 'WEEKLY', 5, '22:00', '02:00', true, 2, now(), now());

-- Sign up as Company / Venue Owner at /organizer/login, then use Portal → My Venue to publish.
