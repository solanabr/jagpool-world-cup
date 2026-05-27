-- FIFA WC 2026 introduces a round-of-32 before the round-of-16 due to 48-team format.
-- This must run in its own transaction before any seed that uses the new value.

alter type match_stage add value if not exists 'round_of_32' before 'round_of_16';
