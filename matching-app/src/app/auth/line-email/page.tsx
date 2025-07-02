'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function LineEmailPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URLパラメータからLINE情報を取得
  const lineUserId = searchParams.get('line_user_id');
  const displayName = searchParams.get('display_name');
  const pictureUrl = searchParams.get('picture_url');

  useEffect(() => {
    // LINE情報が不足している場合は認証画面にリダイレクト
    if (!lineUserId || !displayName) {
      router.push('/auth?error=missing_line_info');
    }
  }, [lineUserId, displayName, router]);

  async function handleEmailSubmit() {
    try {
      setLoading(true);
      setError('');
      
      if (!email || !email.includes('@')) {
        setError('有効なメールアドレスを入力してください');
        return;
      }

      console.log('LINEアカウント作成処理開始:', {
        lineUserId,
        displayName,
        email
      });

      // LINEアカウント作成APIを呼び出し
      const response = await fetch('/api/auth/line/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          lineUserId,
          displayName,
          pictureUrl,
          email,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'アカウント作成に失敗しました');
      }

      const result = await response.json();
      console.log('LINEアカウント作成成功:', result);

      // ダッシュボードにリダイレクト
      router.push(`/dashboard?line_login=success&user_id=${result.userId}&display_name=${encodeURIComponent(displayName!)}`);
      
    } catch (error: any) {
      console.error('LINEアカウント作成エラー:', error);
      setError(error.message || 'アカウント作成中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  if (!lineUserId || !displayName) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>LINE情報を読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-[#06C755] rounded-full flex items-center justify-center">
            {pictureUrl ? (
              <img 
                src={pictureUrl} 
                alt={displayName!} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
              </svg>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            こんにちは、{decodeURIComponent(displayName!)}さん！
          </h1>
          <p className="text-gray-600">
            LINEログインが完了しました。<br />
            最後に、マッチング通知用のメールアドレスを入力してください。
          </p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 bg-red-100 border border-red-300 text-red-700 rounded-md">
            {error}
          </div>
        )}
        
        <div className="space-y-6">
          <div>
            <label className="block text-gray-700 mb-2 font-medium">
              メールアドレス
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="example@email.com"
              disabled={loading}
            />
            <p className="text-sm text-gray-500 mt-2">
              このメールアドレスはマッチング通知の送信に使用されます
            </p>
          </div>
          
          <button
            onClick={handleEmailSubmit}
            disabled={loading || !email}
            className="w-full bg-[#06C755] text-white py-3 px-4 rounded-md hover:bg-[#05B84F] disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-200 font-medium"
          >
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>アカウント作成中...</span>
              </div>
            ) : (
              'アカウントを作成'
            )}
          </button>
          
          <div className="text-center">
            <a
              href="/auth"
              className="text-blue-500 hover:underline transition-colors duration-200 text-sm"
            >
              最初からやり直す
            </a>
          </div>
        </div>
      </div>
    </div>
  );
} 