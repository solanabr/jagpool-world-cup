-- FIFA WC 2026 — all 104 matches.
-- Group stage matches use real team names. Knockout matches use placeholder strings
-- (e.g. "Winner of Match 73", "3rd from A/B/C/D/F") that admin overwrites once known.
-- Kickoff times are stored as UTC. Brasília time is UTC-3.

do $$
declare v_tid uuid;
begin
  select id into v_tid from public.tournaments where slug = 'fifa-wc-2026';
  if v_tid is null then
    raise exception 'tournament fifa-wc-2026 not seeded yet — run 00005_seed.sql first';
  end if;

  -- =====================================================================
  -- ROUND 1 — matches 1..24
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'group', 'A',  1, 'Mexico',                  'South Africa',        '2026-06-11T19:00:00Z', 'Mexico City'),
    (v_tid, 'group', 'A',  2, 'South Korea',             'Czech Republic',      '2026-06-12T02:00:00Z', 'Guadalajara'),
    (v_tid, 'group', 'B',  3, 'Canada',                  'Bosnia and Herzegovina','2026-06-12T19:00:00Z','Toronto'),
    (v_tid, 'group', 'D',  4, 'USA',                     'Paraguay',            '2026-06-13T01:00:00Z', 'Los Angeles'),
    (v_tid, 'group', 'B',  5, 'Qatar',                   'Switzerland',         '2026-06-13T19:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'C',  6, 'Brazil',                  'Morocco',             '2026-06-13T22:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'C',  7, 'Haiti',                   'Scotland',            '2026-06-14T01:00:00Z', 'Boston'),
    (v_tid, 'group', 'D',  8, 'Australia',               'Turkey',              '2026-06-14T04:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'E',  9, 'Germany',                 'Curaçao',             '2026-06-14T17:00:00Z', 'Houston'),
    (v_tid, 'group', 'F', 10, 'Netherlands',             'Japan',               '2026-06-14T20:00:00Z', 'Dallas'),
    (v_tid, 'group', 'E', 11, 'Ivory Coast',             'Ecuador',             '2026-06-14T23:00:00Z', 'Philadelphia'),
    (v_tid, 'group', 'F', 12, 'Sweden',                  'Tunisia',             '2026-06-15T02:00:00Z', 'Monterrey'),
    (v_tid, 'group', 'H', 13, 'Spain',                   'Cape Verde',          '2026-06-15T16:00:00Z', 'Atlanta'),
    (v_tid, 'group', 'G', 14, 'Belgium',                 'Egypt',               '2026-06-15T19:00:00Z', 'Seattle'),
    (v_tid, 'group', 'H', 15, 'Saudi Arabia',            'Uruguay',             '2026-06-15T22:00:00Z', 'Miami'),
    (v_tid, 'group', 'G', 16, 'Iran',                    'New Zealand',         '2026-06-16T01:00:00Z', 'Los Angeles'),
    (v_tid, 'group', 'I', 17, 'France',                  'Senegal',             '2026-06-16T19:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'I', 18, 'Iraq',                    'Norway',              '2026-06-16T22:00:00Z', 'Boston'),
    (v_tid, 'group', 'J', 19, 'Argentina',               'Algeria',             '2026-06-17T01:00:00Z', 'Kansas City'),
    (v_tid, 'group', 'J', 20, 'Austria',                 'Jordan',              '2026-06-17T04:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'K', 21, 'Portugal',                'DR Congo',            '2026-06-17T17:00:00Z', 'Houston'),
    (v_tid, 'group', 'L', 22, 'England',                 'Croatia',             '2026-06-17T20:00:00Z', 'Dallas'),
    (v_tid, 'group', 'L', 23, 'Ghana',                   'Panama',              '2026-06-17T23:00:00Z', 'Toronto'),
    (v_tid, 'group', 'K', 24, 'Uzbekistan',              'Colombia',            '2026-06-18T00:00:00Z', 'Mexico City')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- ROUND 2 — matches 25..48
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'group', 'A', 25, 'Czech Republic',          'South Africa',        '2026-06-18T16:00:00Z', 'Atlanta'),
    (v_tid, 'group', 'B', 26, 'Switzerland',             'Bosnia and Herzegovina','2026-06-18T19:00:00Z','Los Angeles'),
    (v_tid, 'group', 'B', 27, 'Canada',                  'Qatar',               '2026-06-18T22:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'A', 28, 'Mexico',                  'South Korea',         '2026-06-19T01:00:00Z', 'Guadalajara'),
    (v_tid, 'group', 'D', 29, 'USA',                     'Australia',           '2026-06-19T19:00:00Z', 'Seattle'),
    (v_tid, 'group', 'C', 30, 'Scotland',                'Morocco',             '2026-06-19T22:00:00Z', 'Boston'),
    (v_tid, 'group', 'C', 31, 'Brazil',                  'Haiti',               '2026-06-20T00:30:00Z', 'Philadelphia'),
    (v_tid, 'group', 'D', 32, 'Turkey',                  'Paraguay',            '2026-06-20T03:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'F', 33, 'Netherlands',             'Sweden',              '2026-06-20T17:00:00Z', 'Houston'),
    (v_tid, 'group', 'E', 34, 'Germany',                 'Ivory Coast',         '2026-06-20T20:00:00Z', 'Toronto'),
    (v_tid, 'group', 'E', 35, 'Ecuador',                 'Curaçao',             '2026-06-21T00:00:00Z', 'Kansas City'),
    (v_tid, 'group', 'F', 36, 'Tunisia',                 'Japan',               '2026-06-21T02:00:00Z', 'Monterrey'),
    (v_tid, 'group', 'H', 37, 'Spain',                   'Saudi Arabia',        '2026-06-21T16:00:00Z', 'Atlanta'),
    (v_tid, 'group', 'G', 38, 'Belgium',                 'Iran',                '2026-06-21T19:00:00Z', 'Los Angeles'),
    (v_tid, 'group', 'H', 39, 'Uruguay',                 'Cape Verde',          '2026-06-21T22:00:00Z', 'Miami'),
    (v_tid, 'group', 'G', 40, 'New Zealand',             'Egypt',               '2026-06-22T01:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'J', 41, 'Argentina',               'Austria',             '2026-06-22T17:00:00Z', 'Dallas'),
    (v_tid, 'group', 'I', 42, 'France',                  'Iraq',                '2026-06-22T21:00:00Z', 'Philadelphia'),
    (v_tid, 'group', 'I', 43, 'Norway',                  'Senegal',             '2026-06-23T00:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'J', 44, 'Jordan',                  'Algeria',             '2026-06-23T03:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'K', 45, 'Portugal',                'Uzbekistan',          '2026-06-23T17:00:00Z', 'Houston'),
    (v_tid, 'group', 'L', 46, 'England',                 'Ghana',               '2026-06-23T20:00:00Z', 'Boston'),
    (v_tid, 'group', 'L', 47, 'Panama',                  'Croatia',             '2026-06-23T23:00:00Z', 'Toronto'),
    (v_tid, 'group', 'K', 48, 'Colombia',                'DR Congo',            '2026-06-24T02:00:00Z', 'Guadalajara')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- ROUND 3 — matches 49..72
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'group', 'B', 49, 'Switzerland',             'Canada',              '2026-06-24T19:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'B', 50, 'Bosnia and Herzegovina',  'Qatar',               '2026-06-24T19:00:00Z', 'Seattle'),
    (v_tid, 'group', 'C', 51, 'Scotland',                'Brazil',              '2026-06-24T22:00:00Z', 'Miami'),
    (v_tid, 'group', 'C', 52, 'Morocco',                 'Haiti',               '2026-06-24T22:00:00Z', 'Atlanta'),
    (v_tid, 'group', 'A', 53, 'Czech Republic',          'Mexico',              '2026-06-25T01:00:00Z', 'Mexico City'),
    (v_tid, 'group', 'A', 54, 'South Africa',            'South Korea',         '2026-06-25T01:00:00Z', 'Monterrey'),
    (v_tid, 'group', 'E', 55, 'Ecuador',                 'Germany',             '2026-06-25T20:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'E', 56, 'Curaçao',                 'Ivory Coast',         '2026-06-25T20:00:00Z', 'Philadelphia'),
    (v_tid, 'group', 'F', 57, 'Japan',                   'Sweden',              '2026-06-25T23:00:00Z', 'Dallas'),
    (v_tid, 'group', 'F', 58, 'Tunisia',                 'Netherlands',         '2026-06-25T23:00:00Z', 'Kansas City'),
    (v_tid, 'group', 'D', 59, 'Turkey',                  'USA',                 '2026-06-26T02:00:00Z', 'Los Angeles'),
    (v_tid, 'group', 'D', 60, 'Paraguay',                'Australia',           '2026-06-26T02:00:00Z', 'Santa Clara'),
    (v_tid, 'group', 'I', 61, 'Norway',                  'France',              '2026-06-26T19:00:00Z', 'Boston'),
    (v_tid, 'group', 'I', 62, 'Senegal',                 'Iraq',                '2026-06-26T19:00:00Z', 'Toronto'),
    (v_tid, 'group', 'H', 63, 'Cape Verde',              'Saudi Arabia',        '2026-06-27T00:00:00Z', 'Houston'),
    (v_tid, 'group', 'H', 64, 'Uruguay',                 'Spain',               '2026-06-27T00:00:00Z', 'Guadalajara'),
    (v_tid, 'group', 'G', 65, 'Egypt',                   'Iran',                '2026-06-27T03:00:00Z', 'Seattle'),
    (v_tid, 'group', 'G', 66, 'New Zealand',             'Belgium',             '2026-06-27T03:00:00Z', 'Vancouver'),
    (v_tid, 'group', 'L', 67, 'Panama',                  'England',             '2026-06-27T21:00:00Z', 'New York / New Jersey'),
    (v_tid, 'group', 'L', 68, 'Croatia',                 'Ghana',               '2026-06-27T21:00:00Z', 'Philadelphia'),
    (v_tid, 'group', 'K', 69, 'Colombia',                'Portugal',            '2026-06-27T23:30:00Z', 'Miami'),
    (v_tid, 'group', 'K', 70, 'DR Congo',                'Uzbekistan',          '2026-06-27T23:30:00Z', 'Atlanta'),
    (v_tid, 'group', 'J', 71, 'Algeria',                 'Austria',             '2026-06-28T02:00:00Z', 'Kansas City'),
    (v_tid, 'group', 'J', 72, 'Jordan',                  'Argentina',           '2026-06-28T02:00:00Z', 'Dallas')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- ROUND OF 32 — matches 73..88 (placeholder teams; admin updates as group stage finishes)
  -- Default kickoff: 22:00 UTC. Admin can refine via PATCH /api/admin/matches/[id].
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'round_of_32', null, 73, 'Group A — 2nd',           'Group B — 2nd',          '2026-06-28T22:00:00Z', 'Los Angeles'),
    (v_tid, 'round_of_32', null, 74, 'Group E — 1st',           '3rd from A/B/C/D/F',     '2026-06-29T22:00:00Z', 'Boston'),
    (v_tid, 'round_of_32', null, 75, 'Group F — 1st',           'Group C — 2nd',          '2026-06-29T22:00:00Z', 'Monterrey'),
    (v_tid, 'round_of_32', null, 76, 'Group C — 1st',           'Group F — 2nd',          '2026-06-29T22:00:00Z', 'Houston'),
    (v_tid, 'round_of_32', null, 77, 'Group I — 1st',           '3rd from C/D/F/G/H',     '2026-06-30T22:00:00Z', 'New York / New Jersey'),
    (v_tid, 'round_of_32', null, 78, 'Group E — 2nd',           'Group I — 2nd',          '2026-06-30T22:00:00Z', 'Dallas'),
    (v_tid, 'round_of_32', null, 79, 'Group A — 1st',           '3rd from C/E/F/H/I',     '2026-06-30T22:00:00Z', 'Mexico City'),
    (v_tid, 'round_of_32', null, 80, 'Group L — 1st',           '3rd from E/H/I/J/K',     '2026-07-01T22:00:00Z', 'Atlanta'),
    (v_tid, 'round_of_32', null, 81, 'Group D — 1st',           '3rd from B/E/F/I/J',     '2026-07-01T22:00:00Z', 'Santa Clara'),
    (v_tid, 'round_of_32', null, 82, 'Group G — 1st',           '3rd from A/E/H/I/J',     '2026-07-01T22:00:00Z', 'Seattle'),
    (v_tid, 'round_of_32', null, 83, 'Group K — 2nd',           'Group L — 2nd',          '2026-07-02T22:00:00Z', 'Toronto'),
    (v_tid, 'round_of_32', null, 84, 'Group H — 1st',           'Group J — 2nd',          '2026-07-02T22:00:00Z', 'Los Angeles'),
    (v_tid, 'round_of_32', null, 85, 'Group B — 1st',           '3rd from E/F/G/I/J',     '2026-07-02T22:00:00Z', 'Vancouver'),
    (v_tid, 'round_of_32', null, 86, 'Group J — 1st',           'Group H — 2nd',          '2026-07-03T22:00:00Z', 'Miami'),
    (v_tid, 'round_of_32', null, 87, 'Group K — 1st',           '3rd from D/E/I/J/L',     '2026-07-03T22:00:00Z', 'Kansas City'),
    (v_tid, 'round_of_32', null, 88, 'Group D — 2nd',           'Group G — 2nd',          '2026-07-03T22:00:00Z', 'Dallas')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- ROUND OF 16 — matches 89..96
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'round_of_16', null, 89, 'Winner of Match 74', 'Winner of Match 77', '2026-07-04T22:00:00Z', 'Philadelphia'),
    (v_tid, 'round_of_16', null, 90, 'Winner of Match 73', 'Winner of Match 75', '2026-07-04T22:00:00Z', 'Houston'),
    (v_tid, 'round_of_16', null, 91, 'Winner of Match 76', 'Winner of Match 78', '2026-07-05T22:00:00Z', 'New York / New Jersey'),
    (v_tid, 'round_of_16', null, 92, 'Winner of Match 79', 'Winner of Match 80', '2026-07-05T22:00:00Z', 'Mexico City'),
    (v_tid, 'round_of_16', null, 93, 'Winner of Match 83', 'Winner of Match 84', '2026-07-06T22:00:00Z', 'Dallas'),
    (v_tid, 'round_of_16', null, 94, 'Winner of Match 81', 'Winner of Match 82', '2026-07-06T22:00:00Z', 'Seattle'),
    (v_tid, 'round_of_16', null, 95, 'Winner of Match 86', 'Winner of Match 88', '2026-07-07T22:00:00Z', 'Atlanta'),
    (v_tid, 'round_of_16', null, 96, 'Winner of Match 85', 'Winner of Match 87', '2026-07-07T22:00:00Z', 'Vancouver')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- QUARTERFINALS — matches 97..100
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'quarter',     null,  97, 'Winner of Match 89', 'Winner of Match 90', '2026-07-09T22:00:00Z', 'Boston'),
    (v_tid, 'quarter',     null,  98, 'Winner of Match 93', 'Winner of Match 94', '2026-07-10T22:00:00Z', 'Los Angeles'),
    (v_tid, 'quarter',     null,  99, 'Winner of Match 91', 'Winner of Match 92', '2026-07-12T22:00:00Z', 'Miami'),
    (v_tid, 'quarter',     null, 100, 'Winner of Match 95', 'Winner of Match 96', '2026-07-12T22:00:00Z', 'Kansas City')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- SEMIFINALS, THIRD PLACE, FINAL — matches 101..104
  -- =====================================================================
  insert into public.matches (tournament_id, stage, group_name, match_number, home_team, away_team, kickoff_at, venue) values
    (v_tid, 'semi',        null, 101, 'Winner of Match 97', 'Winner of Match 98',  '2026-07-14T22:00:00Z', 'Dallas'),
    (v_tid, 'semi',        null, 102, 'Winner of Match 99', 'Winner of Match 100', '2026-07-15T22:00:00Z', 'Atlanta'),
    (v_tid, 'third_place', null, 103, 'Loser of Match 101', 'Loser of Match 102',  '2026-07-18T22:00:00Z', 'Miami'),
    (v_tid, 'final',       null, 104, 'Winner of Match 101','Winner of Match 102', '2026-07-19T22:00:00Z', 'New York / New Jersey')
  on conflict (tournament_id, match_number) do nothing;

  -- =====================================================================
  -- LINK PARENT MATCHES — for matches whose teams are "Winner of X"
  -- (R32 is skipped: third-place advancement isn't a simple "winner of N" link)
  -- =====================================================================
  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 74),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 77)
  where tournament_id = v_tid and match_number = 89;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 73),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 75)
  where tournament_id = v_tid and match_number = 90;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 76),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 78)
  where tournament_id = v_tid and match_number = 91;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 79),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 80)
  where tournament_id = v_tid and match_number = 92;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 83),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 84)
  where tournament_id = v_tid and match_number = 93;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 81),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 82)
  where tournament_id = v_tid and match_number = 94;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 86),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 88)
  where tournament_id = v_tid and match_number = 95;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 85),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 87)
  where tournament_id = v_tid and match_number = 96;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 89),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 90)
  where tournament_id = v_tid and match_number = 97;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 93),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 94)
  where tournament_id = v_tid and match_number = 98;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 91),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 92)
  where tournament_id = v_tid and match_number = 99;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 95),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 96)
  where tournament_id = v_tid and match_number = 100;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 97),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 98)
  where tournament_id = v_tid and match_number = 101;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 99),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 100)
  where tournament_id = v_tid and match_number = 102;

  update public.matches m set
    parent_match_a = (select id from public.matches where tournament_id = v_tid and match_number = 101),
    parent_match_b = (select id from public.matches where tournament_id = v_tid and match_number = 102)
  where tournament_id = v_tid and match_number = 104;

  -- Match 103 (third-place) is "Loser of 101 vs Loser of 102" — parent_match_* is for winners,
  -- so we leave it null and rely on the placeholder text + admin overwrite.

  -- Update tournament group_lock_at to the first match's kickoff
  update public.tournaments
  set group_lock_at = '2026-06-11T19:00:00Z'
  where id = v_tid;
end$$;
