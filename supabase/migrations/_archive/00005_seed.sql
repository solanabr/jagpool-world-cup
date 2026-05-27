-- Seed the FIFA WC 2026 tournament row. Min JagSOL is a placeholder
-- and should be updated by admin before launch.

insert into public.tournaments (
  slug, name, starts_at, ends_at, min_jagsol_amount, group_lock_at, metadata
) values (
  'fifa-wc-2026',
  'FIFA World Cup 2026',
  '2026-06-11 12:00:00-03',
  '2026-07-19 23:59:59-03',
  1,
  '2026-06-11 12:00:00-03',
  jsonb_build_object(
    'host_countries', jsonb_build_array('USA', 'CAN', 'MEX'),
    'prize_pool_top_users', 10
  )
) on conflict (slug) do nothing;
