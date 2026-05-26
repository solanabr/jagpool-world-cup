-- Add venue column + unique index for idempotent seeding by FIFA match number.

alter table public.matches add column if not exists venue text;

create unique index if not exists matches_tournament_match_number_uniq
  on public.matches (tournament_id, match_number);
