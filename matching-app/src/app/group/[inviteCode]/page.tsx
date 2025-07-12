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

  // ログアウト処理
  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/');
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-6">❌</div>
          <h2 className="text-2xl font-bold mb-4">エラーが発生しました</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <button
            onClick={() => router.push('/dashboard')}
            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300"
          >
            ダッシュボードに戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* ヘッダー */}
      <header className="bg-black/80 backdrop-blur-sm border-b border-white/10 sticky top-0 z-10">
        <div className="container mx-auto px-6 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-xl flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-lg">R</span>
              </div>
              <h1 className="text-2xl font-bold text-white">Reunion</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="bg-white/10 backdrop-blur-sm text-white border border-white/20 px-4 py-2 rounded-lg hover:bg-white/20 transition-all duration-300"
              >
                ダッシュボード
              </button>
              <button
                onClick={handleLogout}
                className="bg-white/10 backdrop-blur-sm text-white border border-white/20 px-4 py-2 rounded-lg hover:bg-white/20 transition-all duration-300"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8">
        {/* グループ情報 */}
        <div className="mb-8">
          <div className="text-center mb-6">
            <div className="text-6xl mb-4">🎓</div>
            <h2 className="text-3xl font-bold mb-2">{inviteData?.group_name}</h2>
            <p className="text-gray-300">懐かしい仲間との再会を楽しもう</p>
          </div>
        </div>

        {/* いいね制限状況 */}
        {likeStatus && (
          <div className="mb-8 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">いいね制限状況</h3>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                likeStatus.plan.isPremium 
                  ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30' 
                  : 'bg-white/10 text-gray-300 border border-white/20'
              }`}>
                {likeStatus.plan.isPremium ? 'プレミアム' : 'フリープラン'}
              </span>
            </div>
            <div className="space-y-2">
              <p className="text-gray-300">
                残りいいね数: <span className="text-white font-semibold">{likeStatus.usage.remainingLikes}</span>
                {likeStatus.usage.totalAvailable && (
                  <span className="text-gray-400"> / {likeStatus.usage.totalAvailable}</span>
                )}
              </p>
              {!likeStatus.limit.allowed && (
                <p className="text-red-300 text-sm">{likeStatus.limit.message}</p>
              )}
            </div>
          </div>
        )}

        {/* 会いたい人を登録 */}
        <div className="mb-8 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
          <h3 className="text-xl font-bold mb-4 text-white">会いたい人を登録</h3>
          <p className="text-gray-300 mb-6">
            会いたい人の名前を入力してください。お互いに登録するまで相手には分かりません。
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={targetName}
              onChange={(e) => setTargetName(e.target.value)}
              placeholder="会いたい人の名前を入力"
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={handleAddTarget}
              disabled={isLimitReached}
              className={`px-6 py-3 rounded-lg font-semibold transition-all duration-300 ${
                isLimitReached
                  ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 text-white hover:from-orange-600 hover:to-red-600 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5'
              }`}
            >
              登録
            </button>
          </div>
          
          {isLimitReached && (
            <div className="mt-4 p-4 bg-red-500/20 border border-red-500/30 rounded-lg">
              <p className="text-red-300 text-sm">
                今月のいいね制限に達しました。プレミアムプランで無制限いいねを楽しもう！
              </p>
              <button
                onClick={handlePaymentOptions}
                className="mt-3 bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300"
              >
                プレミアムにアップグレード
              </button>
            </div>
          )}
          
          {successMessage && (
            <div className="mt-4 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
              <p className="text-green-300 text-sm">{successMessage}</p>
            </div>
          )}
        </div>

        {/* マッチング結果 */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-white">マッチング状況</h3>
          
          {myMatches.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">💝</div>
              <p className="text-gray-300 text-lg">まだマッチングがありません</p>
              <p className="text-gray-400 mt-2">会いたい人を登録してマッチングを始めましょう</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {myMatches.map((match, index) => (
                <div key={index} className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                        match.is_matched 
                          ? 'bg-gradient-to-r from-orange-500 to-red-500' 
                          : 'bg-white/10 border border-white/20'
                      }`}>
                        <span className="text-white font-bold text-lg">
                          {match.is_matched ? '🎉' : '⏳'}
                        </span>
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-white">{match.target_name}</h4>
                        <p className={`text-sm ${
                          match.is_matched ? 'text-orange-300' : 'text-gray-400'
                        }`}>
                          {match.is_matched ? 'マッチング成立！' : 'マッチング待ち'}
                        </p>
                      </div>
                    </div>
                    
                    {match.is_matched && (
                      <div className="text-right">
                        <p className="text-sm text-gray-300 mb-2">連絡先を交換しよう</p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => alert('連絡先交換機能は開発中です')}
                            className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300"
                          >
                            連絡先交換
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {match.is_matched && (
                    <div className="mt-4 p-4 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                      <p className="text-orange-300 text-sm">
                        🎉 おめでとうございます！{match.target_name}さんとマッチングしました。
                        懐かしい思い出話に花を咲かせましょう！
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 課金モーダル */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 max-w-md w-full border border-white/20">
            <h3 className="text-2xl font-bold mb-6 text-white text-center">プレミアムプラン</h3>
            <div className="space-y-4 mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-white">無制限のいいね</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-white">優先サポート</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">✓</span>
                </div>
                <span className="text-white">広告なし</span>
              </div>
            </div>
            <div className="text-center mb-6">
              <p className="text-3xl font-bold text-white">¥500</p>
              <p className="text-gray-300">月額</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowPaymentModal(false)}
                className="flex-1 bg-white/10 backdrop-blur-sm text-white border border-white/20 py-3 rounded-lg hover:bg-white/20 transition-all duration-300"
              >
                キャンセル
              </button>
              <button
                onClick={() => {
                  alert('課金機能は開発中です');
                  setShowPaymentModal(false);
                }}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300"
              >
                アップグレード
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 