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
        // まず、ユーザーがログイン済みかチェック
        const { data: { session } } = await supabase.auth.getSession();
        
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
        
        // クリック数を増加
        await supabase
          .from('invites')
          .update({ clicks: data.clicks + 1 })
          .eq('id', data.id);
        
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
      <div className="flex justify-center items-center min-h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-md">
      <div className="bg-white p-8 rounded-lg shadow-md">
        <h1 className="text-2xl font-bold mb-6 text-center">グループへの招待</h1>
        
        {error ? (
          <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
            {error}
          </div>
        ) : (
          <>
            <p className="mb-6 text-center">
              <span className="font-semibold">{inviteData?.name || 'グループ'}</span> に招待されました。
              登録またはログインして参加しましょう。
            </p>
            
            <div className="space-y-4">
              <button
                onClick={handleSignUp}
                className="w-full bg-blue-500 text-white py-2 px-4 rounded-md hover:bg-blue-600"
              >
                新規登録して参加
              </button>
              
              <button
                onClick={handleLogin}
                className="w-full bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
              >
                ログインして参加
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
} 