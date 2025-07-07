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
  
  // 【新機能】いいね制限状況
  const [likeStatus, setLikeStatus] = useState<any>(null);
  const [isLimitReached, setIsLimitReached] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
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
        
        // 【新機能】いいね制限状況を取得
        await fetchLikeStatus(session.user.id);
        
        setLoading(false);
      } catch (err) {
        console.error('エラー:', err);
        setError('エラーが発生しました');
        setLoading(false);
      }
    }
    
    fetchData();
  }, [inviteCode, router]);

  // 【新機能】いいね制限状況取得
  async function fetchLikeStatus(userId: string) {
    try {
      console.log('=== いいね状況取得開始 ===');
      const response = await fetch(`/api/matching/get-like-status?userId=${userId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('いいね状況の取得に失敗しました');
      }

      const result = await response.json();
      console.log('いいね状況:', result);
      
      setLikeStatus(result);
      setIsLimitReached(!result.limit.allowed);
      
    } catch (err: any) {
      console.error('いいね状況取得エラー:', err);
      // エラー時はデフォルト値を設定
      setLikeStatus({
        plan: { type: 'free', isPremium: false },
        usage: { remainingLikes: 0 },
        limit: { allowed: false, message: '制限情報を取得できません' }
      });
      setIsLimitReached(true);
    }
  }
  
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

      const result = await response.json();
      console.log('マッチング登録結果:', result);
      
      // 【新機能】制限エラーのハンドリング
      if (!response.ok) {
        if (result.error === 'like_limit_exceeded') {
          setShowPaymentModal(true);
          return;
        }
        throw new Error(result.error || 'マッチング登録に失敗しました');
      }
      
      // 成功時の処理
      setMyMatches(result.matches || []);
      setTargetName('');
      
      // 【新機能】残りいいね数を更新
      if (result.remainingLikes !== undefined) {
        if (likeStatus) {
          setLikeStatus((prev: any) => ({
            ...prev,
            usage: {
              ...prev.usage,
              remainingLikes: result.remainingLikes
            },
            limit: {
              ...prev.limit,
              allowed: result.remainingLikes > 0
            }
          }));
        }
      }
      
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

  // 【新機能】課金画面への誘導
  function handlePaymentOptions() {
    setShowPaymentModal(true);
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
      
      {/* 【新機能】いいね制限状況表示 */}
      {likeStatus && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg mb-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-semibold text-blue-800">
                {likeStatus.plan.isPremium ? '✨ プレミアムプラン' : '🆓 無料プラン'}
              </p>
              <p className="text-sm text-blue-600">
                {likeStatus.plan.isPremium ? 
                  '無制限いいね' : 
                  `残りいいね数: ${likeStatus.usage.remainingLikes}/${likeStatus.usage.totalAvailable}`
                }
              </p>
            </div>
            {!likeStatus.plan.isPremium && (
              <button
                onClick={handlePaymentOptions}
                className="text-xs bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
              >
                アップグレード
              </button>
            )}
          </div>
        </div>
      )}
      
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
            disabled={isLimitReached}
          />
          <button
            onClick={isLimitReached ? handlePaymentOptions : handleAddTarget}
            className={`px-4 py-2 rounded-r-md ${
              isLimitReached 
                ? 'bg-orange-500 text-white hover:bg-orange-600' 
                : 'bg-blue-500 text-white hover:bg-blue-600'
            }`}
          >
            {isLimitReached ? '課金' : '追加'}
          </button>
        </div>
        
        {/* 【新機能】制限メッセージ */}
        {isLimitReached && (
          <div className="bg-yellow-50 border border-yellow-200 p-3 rounded-md mb-4">
            <p className="text-sm text-yellow-700">
              ⚠️ 今月のいいね制限に達しました
            </p>
            <p className="text-xs text-yellow-600 mt-1">
              プレミアムプランで無制限いいね、または追加いいねを購入できます
            </p>
          </div>
        )}
        
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

      {/* 【新機能】課金オプションモーダル */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-sm w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">いいね制限に達しました</h3>
            <p className="text-sm text-gray-600 mb-6">
              今月のいいね制限を超えました。以下のオプションからお選びください：
            </p>
            
            <div className="space-y-3">
              <button className="w-full bg-purple-500 text-white py-3 px-4 rounded-md hover:bg-purple-600">
                ✨ プレミアムプラン（月1,000円）
                <div className="text-xs text-purple-100 mt-1">無制限いいね</div>
              </button>
              
              <button className="w-full bg-orange-500 text-white py-3 px-4 rounded-md hover:bg-orange-600">
                💰 追加いいね（300円）
                <div className="text-xs text-orange-100 mt-1">1回限り</div>
              </button>
              
              <button 
                onClick={() => setShowPaymentModal(false)}
                className="w-full bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400"
              >
                キャンセル
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 