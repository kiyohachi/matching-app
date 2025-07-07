'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LineEmailPage() {
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

  if (!lineUserInfo) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-md">
        <div className="bg-white p-8 rounded-lg shadow-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">
          メールアドレス入力
        </h1>
        
        {/* LINEユーザー情報表示 */}
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
          <div className="flex items-center gap-3">
            {lineUserInfo.pictureUrl && (
              <img
                src={lineUserInfo.pictureUrl}
                alt="プロフィール画像"
                className="w-12 h-12 rounded-full"
              />
            )}
            <div>
              <p className="font-medium text-green-800">
                {lineUserInfo.displayName}
              </p>
              <p className="text-sm text-green-600">
                LINEログイン完了
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <p className="text-blue-800 text-sm">
            マッチング通知を受け取るためのメールアドレスを入力してください。
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-md">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              メールアドレス
            </label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="example@example.com"
              required
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>アカウント作成中...</span>
              </div>
            ) : (
              'アカウントを作成'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/auth')}
            className="text-gray-600 hover:text-gray-800 text-sm"
          >
            ← 認証ページに戻る
          </button>
        </div>
      </div>
    </div>
  );
} 