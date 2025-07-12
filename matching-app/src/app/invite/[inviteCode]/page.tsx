'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function InvitePage() {
  // useParamsを使ってパラメータを取得
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  
  const [inviteData, setInviteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  const router = useRouter();

  useEffect(() => {
    async function fetchInviteData() {
      try {
        // セッション取得時のエラーハンドリングを追加
        let session = null;
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.warn('セッション取得エラー（無視して続行）:', sessionError);
            // 古いトークンエラーの場合はセッションをクリア
            if (sessionError.message.includes('refresh') || sessionError.message.includes('token')) {
              await supabase.auth.signOut();
            }
          } else {
            session = sessionData.session;
          }
        } catch (authError) {
          console.warn('認証エラー（無視して続行）:', authError);
          // 認証エラーの場合はセッションをクリア
          await supabase.auth.signOut();
        }
        
        if (session) {
          // ログイン済みの場合はグループページに直接リダイレクト
          router.push(`/group/${inviteCode}`);
          return;
        }
        
        // 招待情報を取得
        const { data, error } = await supabase
          .from('invites')
          .select('*')
          .eq('invite_code', inviteCode)
          .single();
        
        if (error) {
          setError('招待リンクが無効です');
          setLoading(false);
          return;
        }
        
        setInviteData(data);
        setLoading(false);
        
        // クリック数を増加（認証済みユーザーのみ）
        if (session) {
          try {
            await fetch('/api/invites/update-clicks', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                inviteCode: inviteCode
              }),
            });
          } catch (clickError) {
            console.warn('クリック数更新エラー（無視）:', clickError);
          }
        }
        
      } catch (err) {
        console.error('エラー:', err);
        setError('エラーが発生しました');
        setLoading(false);
      }
    }
    
    fetchInviteData();
  }, [inviteCode, router]);
  
  // 登録ボタンのハンドラー
  function handleSignUp() {
    // 招待コードを含めて登録ページにリダイレクト
    router.push(`/auth?mode=signup&invite=${inviteCode}`);
  }
  
  // ログインボタンのハンドラー
  function handleLogin() {
    // 招待コードを含めてログインページにリダイレクト
    router.push(`/auth?mode=login&invite=${inviteCode}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-xl">r</span>
          </div>
          <p className="text-lg font-medium">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-bold text-xl">r</span>
            </div>
            <h1 className="text-3xl font-bold text-white">remeet</h1>
          </div>
          <div className="text-6xl mb-6">🎉</div>
          <h2 className="text-2xl font-bold mb-2">
            グループへの招待
          </h2>
          <p className="text-gray-300">
            懐かしい仲間との再会が待っています
          </p>
        </div>

        {/* メインコンテンツ */}
        <div className="bg-white/10 backdrop-blur-sm p-8 rounded-2xl shadow-2xl border border-white/20">
          {error ? (
            <div className="text-center">
              <div className="text-6xl mb-4">❌</div>
              <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
                <p className="text-red-300 text-sm">{error}</p>
              </div>
              <button
                onClick={() => router.push('/')}
                className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300"
              >
                ホームに戻る
              </button>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="text-5xl mb-4">🎓</div>
                <h3 className="text-xl font-bold mb-4 text-white">
                  {inviteData?.group_name || 'グループ'}
                </h3>
                <p className="text-gray-300 leading-relaxed">
                  <span className="font-semibold text-orange-300">{inviteData?.group_name || 'グループ'}</span> に招待されました！<br />
                  登録またはログインして<br />
                  懐かしい仲間との再会を楽しみましょう
                </p>
              </div>
              
              <div className="space-y-4">
                <button
                  onClick={handleSignUp}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-4 px-6 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  新規登録して参加
                </button>
                
                <button
                  onClick={handleLogin}
                  className="w-full bg-white/10 backdrop-blur-sm text-white border border-white/20 py-4 px-6 rounded-lg font-semibold hover:bg-white/20 transition-all duration-300"
                >
                  ログインして参加
                </button>
              </div>
              
              <div className="mt-8 text-center">
                <p className="text-gray-400 text-sm">
                  まだアカウントをお持ちでない方は新規登録を、<br />
                  既にアカウントをお持ちの方はログインを選択してください
                </p>
              </div>
            </>
          )}
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