'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function GroupPage() {
  // useParamsを使ってパラメータを取得
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  
  const [user, setUser] = useState<any>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetName, setTargetName] = useState('');
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  
  const router = useRouter();

  // ユーザー情報とグループ情報を取得
  useEffect(() => {
    async function fetchData() {
      try {
        // セッション取得時のエラーハンドリングを追加
        let session = null;
        try {
          const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.warn('セッション取得エラー:', sessionError);
            // 古いトークンエラーの場合はサインアウトして招待ページへ
            if (sessionError.message.includes('refresh') || sessionError.message.includes('token')) {
              await supabase.auth.signOut();
              router.push(`/invite/${inviteCode}`);
              return;
            }
          } else {
            session = sessionData.session;
          }
        } catch (authError) {
          console.warn('認証エラー:', authError);
          // 認証エラーの場合は招待ページにリダイレクト
          await supabase.auth.signOut();
          router.push(`/invite/${inviteCode}`);
          return;
        }
        
        if (!session) {
          router.push(`/invite/${inviteCode}`);
          return;
        }
        
        setUser(session.user);
        
        // 招待情報を取得
        const { data: inviteData, error: inviteError } = await supabase
          .from('invites')
          .select('*')
          .eq('invite_code', inviteCode)
          .single();
        
        if (inviteError) {
          setError('招待リンクが無効です');
          setLoading(false);
          return;
        }
        
        setInviteData(inviteData);
        
        // このグループの自分のマッチング情報を取得
        await fetchMyMatches(session.user.id, inviteData.id);
        
        setLoading(false);
      } catch (err) {
        console.error('エラー:', err);
        setError('エラーが発生しました');
        setLoading(false);
      }
    }
    
    fetchData();
  }, [inviteCode, router]);
  
  // マッチング情報取得をAPIエンドポイント経由に変更
  async function fetchMyMatches(userId: string, inviteId: string) {
    try {
      console.log('=== fetchMyMatches開始（API経由）===');
      console.log('userId:', userId);
      console.log('inviteId:', inviteId);
      
      // 新しいマッチ一覧取得APIを使用
      const response = await fetch(`/api/matching/get-matches?userId=${userId}&inviteId=${inviteId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'マッチ一覧の取得に失敗しました');
      }

      const result = await response.json();
      console.log('マッチ一覧取得結果:', result);
      
      setMyMatches(result.matches || []);
      
    } catch (err: any) {
      console.error('マッチング情報の取得エラー:', err);
      // エラー時は空配列を設定
      setMyMatches([]);
    }
  }
  
  // 会いたい人を登録 - 新しいAPIエンドポイント使用
  async function handleAddTarget() {
    if (!targetName.trim()) {
      alert('名前を入力してください');
      return;
    }
    
    try {
      setSuccessMessage('');
      
      // 既に同じ名前で登録していないかチェック（ローカルで）
      const existingMatch = myMatches.find(
        match => match.target_name.toLowerCase() === targetName.toLowerCase()
      );
      
      if (existingMatch) {
        alert('すでに同じ名前で登録されています');
        return;
      }
      
      // 新しいマッチング登録APIを使用
      const response = await fetch('/api/matching/add-target', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          targetName: targetName,
          inviteId: inviteData.id
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'マッチング登録に失敗しました');
      }

      const result = await response.json();
      console.log('マッチング登録結果:', result);
      
      // 成功時の処理
      setMyMatches(result.matches || []);
      setTargetName('');
      
      if (result.isMatch) {
        setSuccessMessage('🎉 マッチング成立しました！相手もあなたに会いたいと思っています！');
      } else {
        setSuccessMessage('会いたい人を登録しました！');
      }
      
      // 3秒後にメッセージを消す
      setTimeout(() => setSuccessMessage(''), 3000);
      
    } catch (err: any) {
      console.error('登録エラー:', err);
      alert(err.message || '登録に失敗しました');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-2xl font-bold mb-2 text-center">
        {inviteData?.name || 'グループ'}
      </h1>
      <p className="text-center text-gray-600 mb-8">
        会いたい人を登録して、マッチングを待ちましょう
      </p>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 text-green-700 p-4 rounded-md mb-6">
          {successMessage}
        </div>
      )}
      
      {/* 会いたい人登録フォーム */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">会いたい人を登録</h2>
        <div className="flex mb-4">
          <input
            type="text"
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md"
            placeholder="会いたい人の名前"
          />
          <button
            onClick={handleAddTarget}
            className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600"
          >
            追加
          </button>
        </div>
        <p className="text-sm text-gray-600">
          ※相手も同様にあなたの名前を登録すると、マッチングが成立します
        </p>
      </div>
      
      {/* 登録した会いたい人リスト */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">あなたが会いたい人</h2>
        {myMatches.length > 0 ? (
          <ul className="space-y-2">
            {myMatches.map(match => (
              <li 
                key={match.id} 
                className={`p-3 rounded-md ${match.matched ? 'bg-pink-100' : 'bg-gray-100'}`}
              >
                <div className="font-medium">{match.target_name}</div>
                {match.matched && (
                  <div className="text-sm text-pink-600 font-medium mt-1">
                    マッチングしました！
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">まだ登録されていません</p>
        )}
      </div>
      
      {/* マッチング結果 */}
      {myMatches.some(match => match.matched) && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">マッチング成立！</h2>
          <p className="mb-4">以下の人もあなたに会いたいと思っています:</p>
          <ul className="space-y-2">
            {myMatches
              .filter(match => match.matched)
              .map(match => (
                <li key={match.id} className="p-3 bg-pink-100 rounded-md">
                  <div className="font-medium">{match.target_name}</div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
} 