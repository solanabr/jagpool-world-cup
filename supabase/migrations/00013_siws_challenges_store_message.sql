-- Store the SIWS message text we sent to the client so the verify endpoint
-- can re-verify against the exact bytes — avoids ISO/Postgres timestamp
-- formatting drift that broke signature verification.

alter table public.siws_challenges add column if not exists message text;
