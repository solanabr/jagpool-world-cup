-- Extend validators with metadata mirrored from jagpool.org

alter table public.validators
  add column if not exists location text,
  add column if not exists region text,
  add column if not exists total_stake numeric,
  add column if not exists current_stake numeric,
  add column if not exists target_stake numeric;

create index if not exists validators_region_idx on public.validators (region);
