import type {
  MatchWinner,
  GroupPrediction,
  MatchPrediction,
  User,
} from "./db";

export type ApiError = {
  error: string;
  details?: unknown;
};

// =====================================================================
// SIWS
// =====================================================================
export type SiwsChallengeRequest = {
  publicKey: string;
};

export type SiwsChallengeResponse = {
  nonce: string;
  message: string;
  expiresAt: string;
};

export type SiwsVerifyRequest = {
  publicKey: string;
  signature: string;
  nonce: string;
};

export type SiwsVerifyResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    walletAddress: string;
    username: string | null;
  };
};

// =====================================================================
// Onboarding
// =====================================================================
export type OnboardingRequest = {
  validatorId: string;
};

export type OnboardingResponse = {
  user: User;
};

// =====================================================================
// Predictions
// =====================================================================
export type GroupPredictionRequest = {
  tournamentId: string;
  groupName: string;
  team1: string;
  team2: string;
};

export type GroupPredictionResponse = {
  prediction: GroupPrediction;
};

export type MatchPredictionRequest = {
  matchId: string;
  winner: MatchWinner;
  homeScore?: number;
  awayScore?: number;
};

export type MatchPredictionResponse = {
  prediction: MatchPrediction;
};

// =====================================================================
// JagSOL
// =====================================================================
export type JagsolVerifyResponse = {
  balance: string;
  meetsMinimum: boolean;
  minimumRequired: string;
  verifiedAt: string;
};
