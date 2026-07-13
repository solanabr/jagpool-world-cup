export type MatchStage =
  | "group"
  | "round_of_32"
  | "round_of_16"
  | "quarter"
  | "semi"
  | "third_place"
  | "final";

export type MatchStatus =
  | "upcoming"
  | "live"
  | "locked"
  | "completed"
  | "cancelled";

export type MatchWinner = "home" | "away" | "draw";

export type Validator = {
  id: string;
  vote_account: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  website_url: string | null;
  is_active: boolean;
  display_order: number;
  location: string | null;
  region: string | null;
  total_stake: string | null;
  current_stake: string | null;
  target_stake: string | null;
  created_at: string;
};

export type User = {
  id: string;
  wallet_address: string;
  // The verified X @handle once linked; a `user_<pubkey8>` stub until then.
  username: string;
  x_user_id: string | null;
  x_avatar_url: string | null;
  validator_id: string | null;
  validator_locked_at: string | null;
  jagsol_verified_at: string | null;
  jagsol_balance: string | null;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
};

export type Tournament = {
  id: string;
  slug: string;
  name: string;
  starts_at: string;
  ends_at: string;
  min_jagsol_amount: string;
  group_lock_at: string | null;
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
};

export type Match = {
  id: string;
  tournament_id: string;
  stage: MatchStage;
  group_name: string | null;
  match_number: number;
  home_team: string | null;
  away_team: string | null;
  kickoff_at: string;
  status: MatchStatus;
  home_score: number | null;
  away_score: number | null;
  winner: MatchWinner | null;
  locked_at: string | null;
  parent_match_a: string | null;
  parent_match_b: string | null;
  venue: string | null;
  created_at: string;
  updated_at: string;
};

export type GroupPrediction = {
  id: string;
  user_id: string;
  tournament_id: string;
  group_name: string;
  advancing_team_1: string;
  advancing_team_2: string;
  locked: boolean;
  submitted_at: string;
  updated_at: string;
};

export type MatchPrediction = {
  id: string;
  user_id: string;
  match_id: string;
  winner: MatchWinner;
  home_score: number | null;
  away_score: number | null;
  locked: boolean;
  submitted_at: string;
  updated_at: string;
};

export type Score = {
  id: string;
  user_id: string;
  tournament_id: string | null;
  match_id: string | null;
  group_prediction_id: string | null;
  match_prediction_id: string | null;
  champion_prediction_user_id: string | null;
  points: number;
  reason: string;
  created_at: string;
};

export type GroupResult = {
  tournament_id: string;
  group_name: string;
  first_place_team: string;
  second_place_team: string;
  finalized_at: string;
  finalized_by: string;
};

export type ChampionPrediction = {
  user_id: string;
  tournament_id: string;
  team: string;
  submitted_at: string;
  locked: boolean;
};

export type UserLeaderboardRow = {
  user_id: string;
  username: string;
  x_avatar_url: string | null;
  wallet_address: string;
  validator_id: string | null;
  validator_name: string | null;
  validator_logo_url: string | null;
  total_points: number;
  score_events: number;
  // Rank at the previous snapshot (from user_rank_snapshots). null until the
  // first snapshot exists; used to render the ▲/▼ position-change indicator.
  previous_rank: number | null;
};

export type ValidatorLeaderboardRow = {
  validator_id: string;
  name: string;
  logo_url: string | null;
  vote_account: string;
  user_count: number;
  total_points: number;
  qualified_points: number;
  qualified_count: number;
};
