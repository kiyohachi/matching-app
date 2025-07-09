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
      <div className="flex justify-center items-center min-h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">ダッシュボード</h1>
        <div className="flex space-x-2">
          <button
            onClick={() => router.push('/admin/test')}
            className="bg-yellow-500 text-white px-3 py-2 rounded-md hover:bg-yellow-600 text-sm"
          >
            🧪 テスト
          </button>
          <button
            onClick={handleLogout}
            className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
          >
            ログアウト
          </button>
        </div>
      </div>

      {/* 【新機能】いいね制限状況表示 */}
      {likeStatus && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 p-6 rounded-lg mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">
                {likeStatus.plan.isPremium ? '✨ プレミアムプラン' : '🆓 無料プラン'}
              </h2>
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-600">
                  {likeStatus.plan.isPremium ? (
                    <span className="text-purple-600 font-medium">無制限いいね</span>
                  ) : (
                    <span>
                      今月のいいね: <span className="font-bold text-blue-600">
                        {likeStatus.usage.remainingLikes}/{likeStatus.usage.totalAvailable}
                      </span> 残り
                    </span>
                  )}
                </div>
                {!likeStatus.plan.isPremium && likeStatus.usage.remainingLikes === 0 && (
                  <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">
                    制限に達しました
                  </span>
                )}
              </div>
            </div>
            <div className="text-right">
              {!likeStatus.plan.isPremium && (
                <button
                  onClick={handlePaymentOptions}
                  className="bg-gradient-to-r from-purple-500 to-blue-500 text-white px-4 py-2 rounded-md hover:from-purple-600 hover:to-blue-600 transition-all"
                >
                  アップグレード
                </button>
              )}
            </div>
          </div>
          
          {/* プラン詳細 */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">プラン:</span>
                <span className="font-medium">
                  {likeStatus.plan.isPremium ? 'プレミアム' : '無料'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-gray-500">今月の使用:</span>
                <span className="font-medium">
                  {likeStatus.usage.usedCount || 0}回
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}

      {/* 新しいグループ作成 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">新しいグループを作成</h2>
        <div className="flex mb-4">
          <input
            type="text"
            value={newInviteName}
            onChange={(e) => setNewInviteName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md"
            placeholder="グループ名（例: 高校同窓会2024）"
          />
          <button
            onClick={handleCreateInvite}
            disabled={isCreating}
            className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600 disabled:opacity-50"
          >
            {isCreating ? '作成中...' : '作成'}
          </button>
        </div>
        <p className="text-sm text-gray-600">
          グループを作成すると、招待リンクが生成されます。友達に共有して参加してもらいましょう。
        </p>
      </div>

      {/* 既存の招待リスト */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">あなたが作成したグループ</h2>
        {invites.length > 0 ? (
          <div className="space-y-4">
            {invites.map(invite => (
              <div key={invite.id} className="border border-gray-200 p-4 rounded-md">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{invite.name}</h3>
                  <span className="text-sm text-gray-500">
                    {new Date(invite.created_at).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm text-gray-600 mb-3">
                  <div>クリック数: {invite.clicks || 0}</div>
                  <div>参加者数: {invite.signups || 0}</div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="text"
                    value={`${window.location.origin}/invite/${invite.invite_code}`}
                    readOnly
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm"
                  />
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`${window.location.origin}/invite/${invite.invite_code}`);
                      alert('招待リンクをコピーしました！');
                    }}
                    className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 whitespace-nowrap"
                  >
                    コピー
                  </button>
                  <button
                    onClick={() => router.push(`/group/${invite.invite_code}`)}
                    className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 whitespace-nowrap"
                  >
                    参加
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">まだグループが作成されていません。上のフォームから新しいグループを作成してみましょう。</p>
        )}
      </div>

      {/* 【新機能】課金オプションモーダル */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">プランをアップグレード</h3>
            <p className="text-sm text-gray-600 mb-6">
              より多くのマッチングを楽しむために、プランをアップグレードしませんか？
            </p>
            
            <div className="space-y-4">
              {/* プレミアムプラン */}
              <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                <div className="flex justify-between items-center mb-2">
                  <h4 className="font-semibold text-purple-800">✨ プレミアムプラン</h4>
                  <span className="text-purple-600 font-bold">月1,000円</span>
                </div>
                <ul className="text-sm text-purple-700 space-y-1 mb-3">
                  <li>• 無制限いいね</li>
                  <li>• 優先表示（今後追加予定）</li>
                  <li>• 詳細分析（今後追加予定）</li>
                </ul>
                <button className="w-full bg-purple-500 text-white py-2 px-4 rounded-md hover:bg-purple-600">
                  プレミアムプランに加入
                </button>
              </div>

              {/* 単発購入 */}
              {!likeStatus?.plan?.isPremium && (
                <div className="border-2 border-orange-200 rounded-lg p-4 bg-orange-50">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-orange-800">💰 追加いいね</h4>
                    <span className="text-orange-600 font-bold">300円</span>
                  </div>
                  <p className="text-sm text-orange-700 mb-3">
                    今月限定で追加で1回いいねできます
                  </p>
                  <button className="w-full bg-orange-500 text-white py-2 px-4 rounded-md hover:bg-orange-600">
                    追加いいねを購入
                  </button>
                </div>
              )}

              {/* プレミアムプランユーザー向けのメッセージ */}
              {likeStatus?.plan?.isPremium && (
                <div className="border-2 border-purple-200 rounded-lg p-4 bg-purple-50">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-semibold text-purple-800">✨ プレミアムプラン加入中</h4>
                  </div>
                  <p className="text-sm text-purple-700">
                    無制限いいねをお楽しみいただけます。追加購入は不要です。
                  </p>
                </div>
              )}
              
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