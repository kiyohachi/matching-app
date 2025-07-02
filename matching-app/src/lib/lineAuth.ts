import { supabase } from './supabase';

export interface LineLoginResult {
  success: boolean;
  user?: any;
  error?: string;
}

export async function handleLineLoginCallback(
  userId: string,
  displayName: string
): Promise<LineLoginResult> {
  try {
    console.log('LINEログインコールバック処理開始:', { userId, displayName });

    // ユーザー情報を取得
    const { data: user, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError) {
      console.error('ユーザー取得エラー:', userError);
      return { success: false, error: 'ユーザー情報の取得に失敗しました' };
    }

    if (!user) {
      console.error('ユーザーが見つかりません');
      return { success: false, error: 'ユーザーが見つかりません' };
    }

    // クライアント側でのセッション設定（代替案）
    // 注意: これは簡易的な実装で、本番環境では適切なセッション管理が必要
    
    console.log('LINEログイン成功:', user);
    return { success: true, user: user.user };

  } catch (error) {
    console.error('LINEログインコールバック処理エラー:', error);
    return { 
      success: false, 
      error: 'ログイン処理中にエラーが発生しました' 
    };
  }
}

export function parseLineLoginParams(): {
  isLineLogin: boolean;
  userId?: string;
  displayName?: string;
} {
  if (typeof window === 'undefined') {
    return { isLineLogin: false };
  }

  const params = new URLSearchParams(window.location.search);
  const isLineLogin = params.get('line_login') === 'success';
  const userId = params.get('user_id');
  const displayName = params.get('display_name');

  return {
    isLineLogin,
    userId: userId || undefined,
    displayName: displayName ? decodeURIComponent(displayName) : undefined,
  };
} 