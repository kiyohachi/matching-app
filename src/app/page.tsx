'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    // ログイン状態をチェック
    async function checkAuth() {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // ログイン済みの場合はダッシュボードにリダイレクト
        router.push('/dashboard');
      } else {
        setLoading(false);
      }
    }
    
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      {/* ヘッダー */}
      <header className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-800">マッチングアプリ</h1>
          <button
            onClick={() => router.push('/auth')}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            ログイン
          </button>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-5xl font-bold text-gray-800 mb-6">
          会いたい人と<br />
          つながろう
        </h2>
        
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          グループを作成して、相互に会いたいと思っている人同士を
          マッチングするシンプルなアプリです。
        </p>
        
        <div className="space-y-4 max-w-md mx-auto">
          <button
            onClick={() => router.push('/auth?mode=signup')}
            className="w-full bg-blue-500 text-white text-lg py-3 px-6 rounded-md hover:bg-blue-600 transition-colors"
          >
            無料で始める
          </button>
          
          <button
            onClick={() => router.push('/auth')}
            className="w-full bg-white text-blue-500 border-2 border-blue-500 text-lg py-3 px-6 rounded-md hover:bg-blue-50 transition-colors"
          >
            ログイン
          </button>
        </div>

        {/* 機能紹介 */}
        <div className="mt-20 grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">👥</div>
            <h3 className="text-xl font-semibold mb-2">グループ作成</h3>
            <p className="text-gray-600">
              イベントやコミュニティ用のマッチンググループを簡単に作成できます。
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">💝</div>
            <h3 className="text-xl font-semibold mb-2">マッチング</h3>
            <p className="text-gray-600">
              お互いが会いたいと思っている人同士を自動でマッチングします。
            </p>
          </div>
          
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-4">🔒</div>
            <h3 className="text-xl font-semibold mb-2">プライバシー保護</h3>
            <p className="text-gray-600">
              相互にマッチングするまで、お互いの意向は秘密に保たれます。
            </p>
          </div>
        </div>
      </main>

      {/* フッター */}
      <footer className="container mx-auto px-4 py-8 text-center text-gray-600">
        <p>&copy; 2024 マッチングアプリ. All rights reserved.</p>
      </footer>
    </div>
  );
}
