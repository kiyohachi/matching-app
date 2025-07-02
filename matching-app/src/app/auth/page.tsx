'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import LineLoginButton from '@/components/LineLoginButton';
import { parseLineLoginParams, handleLineLoginCallback } from '@/lib/lineAuth';

export default function AuthPage() {
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
    if (errorParam) {
      switch (errorParam) {
        case 'no_code':
          setError('認証コードが取得できませんでした');
          break;
        case 'token_error':
          setError('認証トークンの取得に失敗しました');
          break;
        case 'no_id_token':
          setError('IDトークンが取得できませんでした');
          break;
        case 'supabase_auth_error':
          setError('アカウント作成に失敗しました');
          break;
        case 'no_supabase_user':
          setError('ユーザー情報の作成に失敗しました');
          break;
        case 'line_auth_start_error':
          setError('LINE認証の開始に失敗しました');
          break;
        case 'unexpected_error':
          setError('予期しないエラーが発生しました');
          break;
        default:
          setError('認証エラーが発生しました');
      }
    }
  }, [searchParams]);

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
          // プロフィール情報を保存
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                email: email,
                name: name
              }
            ]);
          
          if (profileError) throw profileError;
          
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
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
          {isLogin ? 'ログイン' : '新規登録'}
        </h1>
        
        {inviteCode && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md text-center">
            <p className="text-blue-800">招待リンクから{isLogin ? 'ログイン' : '登録'}します</p>
          </div>
        )}
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-6">
          {/* LINEログインボタン */}
          <div>
            <LineLoginButton disabled={loading} />
          </div>
          
          {/* 区切り線 */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">または</span>
            </div>
          </div>
          
          {/* メール認証フォーム */}
          <div className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-gray-700 mb-2 font-medium">名前</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="あなたの名前"
                />
              </div>
            )}
            
            <div>
              <label className="block text-gray-700 mb-2 font-medium">メールアドレス</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="example@email.com"
              />
            </div>
            
            <div>
              <label className="block text-gray-700 mb-2 font-medium">パスワード</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="パスワード"
              />
            </div>
            
            <button
              onClick={handleAuth}
              disabled={loading}
              className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:bg-blue-300 transition-colors duration-200 font-medium"
            >
              {loading ? '処理中...' : isLogin ? 'メールでログイン' : 'メールで登録'}
            </button>
          </div>
          
          <div className="text-center">
            <a
              href={`/auth?mode=${isLogin ? 'signup' : 'login'}${inviteCode ? `&invite=${inviteCode}` : ''}`}
              className="text-blue-500 hover:underline transition-colors duration-200"
            >
              {isLogin ? '新規登録はこちら' : 'ログインはこちら'}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}