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
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          {isLogin ? 'ログイン' : '新規登録'}
        </h1>
        
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
            {error}
          </div>
        )}

        <form onSubmit={(e) => { e.preventDefault(); handleAuth(); }}>
          {!isLogin && (
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                名前
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                required
              />
            </div>
          )}
          
          <div className="mb-4">
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          
          <div className="mb-6">
            <label htmlFor="password" className="block text-sm font-medium mb-2">
              パスワード
            </label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50 mb-4"
          >
            {loading ? '処理中...' : (isLogin ? 'ログイン' : '新規登録')}
          </button>
        </form>
        
        <div className="text-center mb-4">
          <p className="text-gray-600">または</p>
        </div>
        
        <LineLoginButton inviteCode={inviteCode} />
        
        <div className="text-center mt-4">
          <button
            onClick={() => {
              const newMode = isLogin ? 'register' : 'login';
              const url = new URL(window.location.href);
              url.searchParams.set('mode', newMode);
              window.location.href = url.toString();
            }}
            className="text-blue-500 hover:underline"
          >
            {isLogin ? '新規登録はこちら' : 'ログインはこちら'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">読み込み中...</div>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}