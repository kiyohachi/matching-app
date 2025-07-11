'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AdminTestPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [likeStatus, setLikeStatus] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  
  const router = useRouter();

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          router.push('/auth');
          return;
        }
        
        setUser(session.user);
        await fetchLikeStatus(session.user.id);
        setLoading(false);
      } catch (err) {
        console.error('エラー:', err);
        setLoading(false);
      }
    }
    
    fetchData();
  }, [router]);

  // いいね状況取得
  async function fetchLikeStatus(userId: string) {
    try {
      const response = await fetch(`/api/matching/get-like-status?userId=${userId}`);
      if (response.ok) {
        const result = await response.json();
        setLikeStatus(result);
      }
    } catch (err) {
      console.error('いいね状況取得エラー:', err);
    }
  }

  // プレミアムプラン加入シミュレーション
  async function simulatePremium() {
    setIsProcessing(true);
    setMessage('プレミアムプラン加入中...');

    try {
      const response = await fetch('/api/admin/simulate-premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ プレミアムプラン加入シミュレーション完了！');
        await fetchLikeStatus(user.id);
      } else {
        setMessage('❌ エラー: ' + result.error);
      }
    } catch (err) {
      setMessage('❌ エラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  }

  // 無料プラン戻しシミュレーション
  async function simulateFree() {
    setIsProcessing(true);
    setMessage('無料プランに戻し中...');

    try {
      const response = await fetch('/api/admin/simulate-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ 無料プランに戻しました！');
        await fetchLikeStatus(user.id);
      } else {
        setMessage('❌ エラー: ' + result.error);
      }
    } catch (err) {
      setMessage('❌ エラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  }

  // 追加いいね購入シミュレーション
  async function simulatePurchaseLike() {
    setIsProcessing(true);
    setMessage('追加いいね購入中...');

    try {
      const response = await fetch('/api/admin/simulate-purchase-like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, quantity: 1 })
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ 追加いいね購入シミュレーション完了！');
        await fetchLikeStatus(user.id);
      } else {
        setMessage('❌ エラー: ' + result.error);
      }
    } catch (err) {
      setMessage('❌ エラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
  }

  // テストデータリセット
  async function resetTestData() {
    setIsProcessing(true);
    setMessage('テストデータリセット中...');

    try {
      const response = await fetch('/api/admin/reset-test-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id })
      });

      const result = await response.json();
      if (result.success) {
        setMessage('✅ テストデータをリセットしました！');
        await fetchLikeStatus(user.id);
      } else {
        setMessage('❌ エラー: ' + result.error);
      }
    } catch (err) {
      setMessage('❌ エラーが発生しました');
    } finally {
      setIsProcessing(false);
    }
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
            <button
              onClick={() => router.push('/dashboard')}
              className="bg-white/10 backdrop-blur-sm text-white border border-white/20 px-4 py-2 rounded-lg hover:bg-white/20 transition-all duration-300"
            >
              ダッシュボードに戻る
            </button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-4xl">
        {/* タイトルセクション */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🧪</div>
          <h2 className="text-3xl font-bold mb-4 text-white">課金機能テスト画面</h2>
          <p className="text-gray-300">開発テスト専用画面</p>
        </div>

        <div className="mb-8 p-6 bg-yellow-500/20 border border-yellow-500/30 rounded-2xl">
          <p className="text-yellow-300 font-semibold mb-2">⚠️ 開発テスト専用画面</p>
          <p className="text-yellow-200 text-sm">
            この画面では実際の課金をせずに、課金後の状態をシミュレーションできます。
          </p>
        </div>

        {/* 現在の状況表示 */}
        {likeStatus && (
          <div className="mb-8 p-6 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/20">
            <h3 className="text-xl font-bold mb-6 text-white">📊 現在の課金状況</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-blue-500/20 border border-blue-500/30 p-4 rounded-lg">
                <p className="text-sm text-blue-300 mb-1">プラン</p>
                <p className="font-bold text-blue-200">
                  {likeStatus.plan.isPremium ? '✨ プレミアム' : '🆓 無料'}
                </p>
              </div>
              <div className="bg-green-500/20 border border-green-500/30 p-4 rounded-lg">
                <p className="text-sm text-green-300 mb-1">残りいいね</p>
                <p className="font-bold text-green-200">
                  {likeStatus.usage.remainingLikes}/{likeStatus.usage.totalAvailable}
                </p>
              </div>
              <div className="bg-purple-500/20 border border-purple-500/30 p-4 rounded-lg">
                <p className="text-sm text-purple-300 mb-1">今月使用</p>
                <p className="font-bold text-purple-200">
                  {likeStatus.usage.usedCount}回
                </p>
              </div>
              <div className="bg-orange-500/20 border border-orange-500/30 p-4 rounded-lg">
                <p className="text-sm text-orange-300 mb-1">購入済み</p>
                <p className="font-bold text-orange-200">
                  {likeStatus.usage.purchasedCount}回
                </p>
              </div>
            </div>
          </div>
        )}

        {/* メッセージ表示 */}
        {message && (
          <div className={`p-4 rounded-lg mb-6 ${
            message.startsWith('✅') ? 'bg-green-500/20 border border-green-500/30 text-green-300' : 
            message.startsWith('❌') ? 'bg-red-500/20 border border-red-500/30 text-red-300' : 
            'bg-blue-500/20 border border-blue-500/30 text-blue-300'
          }`}>
            {message}
          </div>
        )}

        {/* テスト操作ボタン */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* プラン操作 */}
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
            <h4 className="text-lg font-semibold mb-4 text-white">📋 プラン操作</h4>
            <div className="space-y-3">
              <button
                onClick={simulatePremium}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-purple-500 to-purple-600 text-white py-3 px-4 rounded-lg hover:from-purple-600 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isProcessing ? '処理中...' : '✨ プレミアムプラン加入'}
              </button>
              <button
                onClick={simulateFree}
                disabled={isProcessing}
                className="w-full bg-white/20 backdrop-blur-sm text-white border border-white/30 py-3 px-4 rounded-lg hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
              >
                {isProcessing ? '処理中...' : '🆓 無料プランに戻す'}
              </button>
            </div>
          </div>

          {/* いいね操作 */}
          <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
            <h4 className="text-lg font-semibold mb-4 text-white">💰 いいね操作</h4>
            <div className="space-y-3">
              {likeStatus?.plan?.isPremium ? (
                <div className="bg-purple-500/20 border border-purple-500/30 text-purple-200 p-3 rounded-lg text-sm">
                  <p className="font-medium">✨ プレミアムプラン加入中</p>
                  <p>無制限いいねをお楽しみいただけます。追加購入は不要です。</p>
                </div>
              ) : (
                <button
                  onClick={simulatePurchaseLike}
                  disabled={isProcessing}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-500 text-white py-3 px-4 rounded-lg hover:from-orange-600 hover:to-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                >
                  {isProcessing ? '処理中...' : '💰 追加いいね購入（+1回）'}
                </button>
              )}
              <button
                onClick={resetTestData}
                disabled={isProcessing}
                className="w-full bg-gradient-to-r from-red-500 to-red-600 text-white py-3 px-4 rounded-lg hover:from-red-600 hover:to-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
              >
                {isProcessing ? '処理中...' : '🔄 テストデータリセット'}
              </button>
            </div>
          </div>
        </div>

        {/* テストシナリオ */}
        <div className="bg-white/10 backdrop-blur-sm p-6 rounded-2xl border border-white/20">
          <h4 className="text-lg font-semibold mb-4 text-white">🎯 推奨テストシナリオ</h4>
          <ol className="list-decimal list-inside space-y-2 text-sm text-gray-300">
            <li>まず現在の状況を確認（無料プラン、残り1いいね）</li>
            <li>グループページで1回いいねを使い切る</li>
            <li>制限モーダルが表示されることを確認</li>
            <li>「✨ プレミアムプラン加入」でプレミアムにする</li>
            <li>グループページで無制限いいねができることを確認</li>
            <li>【新機能】プレミアム中は追加いいね購入ボタンが非表示になることを確認</li>
            <li>テスト画面で追加いいね購入が「プレミアムプラン加入中」メッセージになることを確認</li>
            <li>「🆓 無料プランに戻す」で無料に戻す</li>
            <li>「💰 追加いいね購入」で追加いいねを付与</li>
            <li>グループページで追加分だけ使えることを確認</li>
            <li>「🔄 テストデータリセット」で初期状態に戻す</li>
          </ol>
        </div>
      </div>
    </div>
  );
} 