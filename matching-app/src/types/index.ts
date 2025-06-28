// ユーザープロファイルの型定義
export interface Profile {
  id: string;
  created_at: string;
  name: string;
  email: string;
  avatar_url?: string;
}

// 招待の型定義
export interface Invite {
  id: string;
  created_at: string;
  user_id: string;
  invite_code: string;
  name: string;
  clicks: number;
  signups: number;
}

// マッチングの型定義
export interface Match {
  id: string;
  created_at: string;
  user_id: string;
  target_name: string;
  matched: boolean;
  notified: boolean;
  invite_id: string;
}

// マッチング結果の型定義
export interface MatchResult {
  isMatched: boolean;
  targetProfile?: Profile;
} 