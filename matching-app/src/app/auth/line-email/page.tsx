'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function LineEmailPageContent() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lineUserInfo, setLineUserInfo] = useState<{
    lineUserId: string;
    displayName: string;
    pictureUrl: string;
  } | null>(null);

  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // URLパラメータからLINEユーザー情報を取得
    const lineUserId = searchParams.get('line_user_id');
    const displayName = searchParams.get('display_name');
    const pictureUrl = searchParams.get('picture_url');

    if (!lineUserId || !displayName) {
      // LINEユーザー情報がない場合は認証ページにリダイレクト
      router.push('/auth');
      return;
    }

    setLineUserInfo({
      lineUserId,
      displayName: (() => {
        try {
          return decodeURIComponent(displayName);
        } catch (decodeError) {
          console.error('displayNameのデコードエラー:', decodeError);
          return displayName || 'LINEユーザー';
        }
      })(),
      pictureUrl: (() => {
        try {
          return decodeURIComponent(pictureUrl || '');
        } catch (decodeError) {
          console.error('pictureUrlのデコードエラー:', decodeError);
          return pictureUrl || '';
        }
      })(),
    });
  }, [searchParams, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!email) {
      setError('メールアドレスを入力してください');
      return;
    }

    if (!lineUserInfo) {
      setError('LINEユーザー情報が取得できませんでした');
      return;
    }

    setLoading(true);
    setError('');

    try {
      console.log('アカウント作成開始...');
      
      // アカウント作成APIを呼び出し
      const response = await fetch('/api/auth/line/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email,
          lineUserId: lineUserInfo.lineUserId,
          displayName: lineUserInfo.displayName,
          pictureUrl: lineUserInfo.pictureUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'アカウント作成に失敗しました');
      }

      console.log('アカウント作成成功:', data);

      // 自動ログイン処理
      if (data.tempPassword) {
        console.log('自動ログイン開始...');
        
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email,
          password: data.tempPassword,
        });

        if (signInError) {
          console.error('自動ログインエラー:', signInError);
          throw new Error('アカウントは作成されましたが、ログインに失敗しました');
        }

        console.log('自動ログイン成功');
      }

      // 成功時はダッシュボードにリダイレクト
      router.push('/dashboard');

    } catch (error: any) {
      console.error('処理エラー:', error);
      setError(error.message || 'エラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">
          LINEアカウント作成
        </h1>
        
        {lineUserInfo && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md text-center">
            <div className="flex items-center justify-center mb-2">
              {lineUserInfo.pictureUrl && (
                <img
                  src={lineUserInfo.pictureUrl}
                  alt="プロフィール"
                  className="w-12 h-12 rounded-full mr-3"
                />
              )}
              <div>
                <p className="font-medium text-green-800">
                  {lineUserInfo.displayName}
                </p>
                <p className="text-sm text-green-600">LINEアカウント連携</p>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="email" className="block text-sm font-medium mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="your-email@example.com"
              required
            />
            <p className="text-sm text-gray-600 mt-1">
              ログイン時に使用するメールアドレスを入力してください
            </p>
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600 disabled:opacity-50"
          >
            {loading ? '作成中...' : 'アカウント作成'}
          </button>
        </form>

        <div className="text-center mt-4">
          <button
            onClick={() => router.push('/auth')}
            className="text-gray-500 hover:underline"
          >
            戻る
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LineEmailPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md">
          <div className="text-center">読み込み中...</div>
        </div>
      </div>
    }>
      <LineEmailPageContent />
    </Suspense>
  );
} 