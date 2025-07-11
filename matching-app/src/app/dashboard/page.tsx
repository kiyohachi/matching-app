'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function DashboardContent() {
  const [user, setUser] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newInviteName, setNewInviteName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  // 【新機能】いいね制限状況
  const [likeStatus, setLikeStatus] = useState<any>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handleLineLogin() {
      // URLパラメータからLINEログイン情報を取得
      const lineLogin = searchParams.get('line_login');
      const userId = searchParams.get('user_id');
      const email = searchParams.get('email');
      const tempPassword = searchParams.get('temp_password');
      const displayName = searchParams.get('display_name');
      const loginType = searchParams.get('login_type');

      if (lineLogin === 'success' && userId && email && tempPassword) {
        console.log('=== LINEログイン成功、Supabase認証開始 ===');
        
        try {
          // Supabaseにサインイン
          const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email: email,
            password: tempPassword
          });

          if (authError) {
            console.error('認証エラー:', authError);
            setError('認証に失敗しました');
            return;
          }

          console.log('Supabase認証成功:', authData);
          
          // 成功メッセージを表示
          if (loginType === 'new') {
            setError(''); // エラーをクリア
            // 新規ユーザー用のメッセージを設定したい場合はここで設定
          }
          
          // URLパラメータをクリア
          const url = new URL(window.location.href);
          url.search = '';
          window.history.replaceState({}, '', url.pathname);
          
          // LINEログイン後はダッシュボードデータを取得
          await fetchDashboardData();
          
        } catch (err) {
          console.error('認証処理エラー:', err);
          setError('認証処理でエラーが発生しました');
        }
      } else {
        // 通常のセッションチェック
        await fetchDashboardData();
      }
    }

    async function fetchDashboardData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          router.push('/auth');
          return;
        }
        
        setUser(session.user);
        
        // ユーザーの招待リストを取得
        const { data: invitesData, error: invitesError } = await supabase
          .from('invites')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        
        if (invitesError) {
          console.error('招待データの取得エラー:', invitesError);
        } else {
          setInvites(invitesData || []);
        }
        
        // 【新機能】いいね制限状況を取得
        await fetchLikeStatus(session.user.id);
        
        setLoading(false);
      } catch (err) {
        console.error('エラー:', err);
        setLoading(false);
      }
    }
    
    handleLineLogin();
  }, [router, searchParams]);

  // 【新機能】いいね制限状況取得
  async function fetchLikeStatus(userId: string) {
    try {
      console.log('=== ダッシュボード：いいね状況取得開始 ===');
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
      console.log('ダッシュボード：いいね状況:', result);
      
      setLikeStatus(result);
      
    } catch (err: any) {
      console.error('いいね状況取得エラー:', err);
      // エラー時はデフォルト値を設定
      setLikeStatus({
        plan: { type: 'free', isPremium: false },
        usage: { remainingLikes: 0, totalAvailable: 1 },
        limit: { allowed: false, message: '制限情報を取得できません' }
      });
    }
  }

  // グループ作成処理
  async function handleCreateInvite() {
    if (!newInviteName.trim()) {
      alert('グループ名を入力してください');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      // 新しい招待作成APIを使用
      const response = await fetch('/api/invites/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          groupName: newInviteName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '招待リンクの作成に失敗しました');
      }

      const result = await response.json();
      console.log('招待作成結果:', result);
      
      // 招待リストを更新
      setInvites(prev => [result.invite, ...prev]);
      setNewInviteName('');
      
    } catch (err: any) {
      console.error('招待作成エラー:', err);
      setError(err.message || '招待リンクの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  }

  // 【新機能】課金画面への誘導
  function handlePaymentOptions() {
    setShowPaymentModal(true);
  }

  // ログアウト処理
  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-gradient-to-r from-orange-500 via-red-500 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
            <span className="text-white font-bold text-xl">R</span>
          </div>
          <p className="text-lg font-medium">読み込み中...</p>
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
                onClick={() => router.push('/admin/test')}
                className="bg-yellow-500/20 backdrop-blur-sm text-yellow-300 border border-yellow-500/30 px-4 py-2 rounded-lg hover:bg-yellow-500/30 transition-all duration-300 text-sm"
              >
                🧪 テスト
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
        {/* ウェルカムセクション */}
        <div className="mb-8">
          <h2 className="text-3xl font-bold mb-4">
            おかえりなさい！
          </h2>
          <p className="text-gray-300 text-lg">
            {user?.user_metadata?.name || user?.email}さんのダッシュボード
          </p>
        </div>

        {/* いいね制限状況の表示 */}
        {likeStatus && (
          <div className="mb-8 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-white">いいね制限状況</h3>
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
            {!likeStatus.plan.isPremium && (
              <button
                onClick={handlePaymentOptions}
                className="mt-4 bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                プレミアムにアップグレード
              </button>
            )}
          </div>
        )}

        {/* 新しいグループ作成 */}
        <div className="mb-8 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
          <h3 className="text-xl font-bold mb-4 text-white">新しいグループを作成</h3>
          <div className="flex flex-col sm:flex-row gap-4">
            <input
              type="text"
              value={newInviteName}
              onChange={(e) => setNewInviteName(e.target.value)}
              placeholder="グループ名を入力（例：〇〇高校3年A組）"
              className="flex-1 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
            />
            <button
              onClick={handleCreateInvite}
              disabled={isCreating}
              className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              {isCreating ? '作成中...' : '作成'}
            </button>
          </div>
          {error && (
            <p className="mt-4 text-red-300 text-sm">{error}</p>
          )}
        </div>

        {/* 作成したグループ一覧 */}
        <div className="space-y-6">
          <h3 className="text-2xl font-bold text-white">作成したグループ</h3>
          {invites.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📝</div>
              <p className="text-gray-300 text-lg">まだグループを作成していません</p>
              <p className="text-gray-400 mt-2">上のフォームから新しいグループを作成しましょう</p>
            </div>
          ) : (
            <div className="grid gap-6">
              {invites.map((invite) => (
                <div key={invite.id} className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20 hover:bg-white/15 transition-all duration-300">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-white mb-2">{invite.group_name}</h4>
                      <div className="space-y-1">
                        <p className="text-gray-300">
                          <span className="font-medium">招待コード:</span> 
                          <span className="ml-2 font-mono bg-white/10 px-2 py-1 rounded text-orange-300">
                            {invite.invite_code}
                          </span>
                        </p>
                        <p className="text-gray-300">
                          <span className="font-medium">クリック数:</span> 
                          <span className="ml-2 text-white">{invite.click_count || 0}回</span>
                        </p>
                        <p className="text-gray-300">
                          <span className="font-medium">作成日:</span> 
                          <span className="ml-2 text-white">{new Date(invite.created_at).toLocaleDateString()}</span>
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <button
                        onClick={() => navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.invite_code}`)}
                        className="bg-white/10 backdrop-blur-sm text-white border border-white/20 px-4 py-2 rounded-lg hover:bg-white/20 transition-all duration-300"
                      >
                        URLをコピー
                      </button>
                      <button
                        onClick={() => router.push(`/group/${invite.invite_code}`)}
                        className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 rounded-lg font-semibold hover:from-orange-600 hover:to-red-600 transition-all duration-300"
                      >
                        グループを見る
                      </button>
                    </div>
                  </div>
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

export default function Dashboard() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex justify-center items-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <p className="mt-4 text-gray-600">読み込み中...</p>
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  );
} 