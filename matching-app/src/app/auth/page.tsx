'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LineLoginButton from '@/components/LineLoginButton';
import { parseLineLoginParams, handleLineLoginCallback } from '@/lib/lineAuth';

function AuthPageContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URLからモードと招待コードを取得
  const mode = searchParams.get('mode') || 'login';
  const inviteCode = searchParams.get('invite');
  
  const isLogin = mode === 'login';

  useEffect(() => {
    // LINEログインコールバックの処理
    const { isLineLogin, userId, displayName } = parseLineLoginParams();
    
    if (isLineLogin && userId && displayName) {
      console.log('LINEログインコールバック検出');
      
      handleLineLoginCallback(userId, displayName).then(result => {
        if (result.success) {
          // 招待コードがある場合はグループページへ
          if (inviteCode) {
            router.push(`/group/${inviteCode}`);
          } else {
            router.push('/dashboard');
          }
        } else {
          setError(result.error || 'LINEログインに失敗しました');
        }
      });
      
      return;
    }

    // 既にログインしているかチェック
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        // 招待コードがある場合はグループページへ
        if (inviteCode) {
          router.push(`/group/${inviteCode}`);
        } else {
          router.push('/dashboard');
        }
      }
    }
    
    checkAuth();
  }, [router, inviteCode]);

  // URLからエラーパラメータを確認
  useEffect(() => {
    const errorParam = searchParams.get('error');
    const messageParam = searchParams.get('message');
    
    if (errorParam) {
      // カスタムメッセージがある場合はそれを使用（デバッグ時のみ）
      if (messageParam) {
        try {
          const decodedMessage = decodeURIComponent(messageParam);
          setError(decodedMessage);
        } catch (decodeError) {
          console.error('URLメッセージのデコードエラー:', decodeError);
          // デフォルトメッセージにフォールバック
          setError(getDefaultErrorMessage(errorParam));
        }
        return;
      }
      
      // エラーコードに基づくデフォルトメッセージ
      setError(getDefaultErrorMessage(errorParam));
    }
  }, [searchParams]);

  // エラーコードからデフォルトメッセージを取得
  function getDefaultErrorMessage(errorCode: string): string {
    switch (errorCode) {
      case 'password_update_error':
        return 'ログイン処理に失敗しました。時間をおいて再度お試しください。';
      case 'line_access_denied':
        return 'LINE認証がキャンセルされました。再度お試しください。';
      case 'line_error':
        return 'LINE認証でエラーが発生しました。再度お試しください。';
      case 'no_code':
        return '認証コードが取得できませんでした。再度お試しください。';
      case 'token_error':
        return '認証トークンの取得に失敗しました。時間をおいて再度お試しください。';
      case 'no_id_token':
        return 'LINEユーザー情報の取得に失敗しました。';
      case 'supabase_auth_error':
        return 'アカウント作成に失敗しました。';
      case 'no_supabase_user':
        return 'ユーザー情報の作成に失敗しました。';
      case 'existing_user_not_found':
        return '既存のアカウントが見つかりませんでした。';
      case 'profile_save_error':
        return 'プロフィールの保存に失敗しました。';
      case 'line_auth_start_error':
        return 'LINE認証の開始に失敗しました。';
      case 'unexpected_error':
        return '予期しないエラーが発生しました。時間をおいて再度お試しください。';
      default:
        return '認証エラーが発生しました。';
    }
  }

  async function handleAuth() {
    try {
      setLoading(true);
      setError('');
      
      if (!email || !password) {
        setError('メールアドレスとパスワードを入力してください');
        return;
      }
      
      if (!isLogin && !name) {
        setError('名前を入力してください');
        return;
      }
      
      if (isLogin) {
        // ログイン処理
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) throw error;
        
      } else {
        // 新規登録処理
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        
        if (error) throw error;
        
        if (data?.user) {
          // プロフィール情報を保存（API経由）
          try {
            const profileResponse = await fetch('/api/auth/create-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                userId: data.user.id,
                email: email,
                name: name
              }),
            });

            if (!profileResponse.ok) {
              const profileError = await profileResponse.json();
              throw new Error(profileError.error || 'プロフィールの作成に失敗しました');
            }

            console.log('プロフィール作成成功');
            
          } catch (profileErr: any) {
            console.error('プロフィール作成エラー:', profileErr);
            throw new Error(profileErr.message || 'プロフィールの作成に失敗しました');
          }
          
          alert('確認メールを送信しました。メールを確認してください。');
        }
      }
      
      // 招待コードがある場合はグループページへ、なければダッシュボードへ
      if (inviteCode) {
        router.push(`/group/${inviteCode}`);
      } else {
        router.push('/dashboard');
      }
      
    } catch (error: any) {
      setError(error.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">R</span>
            </div>
            <h1 className="text-3xl font-bold text-white">Reunion</h1>
          </div>
          <h2 className="text-2xl font-bold mb-2">
            {isLogin ? 'ログイン' : '新規登録'}
          </h2>
          <p className="text-gray-300">
            {isLogin ? '既存のアカウントでログイン' : '新しいアカウントを作成'}
          </p>
        </div>

        {/* メインフォーム */}
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20">
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}
          
          <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }} className="space-y-6">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  お名前
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="山田太郎"
                  required={!isLogin}
                />
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                メールアドレス
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="example@email.com"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                パスワード
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                placeholder="パスワード（6文字以上）"
                required
              />
            </div>
            
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {loading ? '処理中...' : (isLogin ? 'ログイン' : '新規登録')}
            </button>
          </form>
          
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/20"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white/10 text-gray-300">または</span>
              </div>
            </div>
            
            <div className="mt-6">
              <LineLoginButton inviteCode={inviteCode} />
            </div>
          </div>
          
          <div className="mt-6 text-center">
            <button
              onClick={() => router.push(`/auth${inviteCode ? `?invite=${inviteCode}` : ''}${isLogin ? '?mode=signup' : ''}${inviteCode && !isLogin ? '&mode=login' : ''}`)}
              className="text-orange-300 hover:text-orange-200 transition-colors font-medium"
            >
              {isLogin ? 'アカウントをお持ちでない方' : '既にアカウントをお持ちの方'}
            </button>
          </div>
        </div>
        
        {/* フッター */}
        <div className="mt-8 text-center">
          <button
            onClick={() => router.push('/')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← ホームに戻る
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <p className="text-lg font-medium">読み込み中...</p>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}