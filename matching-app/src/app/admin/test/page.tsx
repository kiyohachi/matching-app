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
      <div className="flex justify-center items-center min-h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-red-600">🧪 課金機能テスト画面</h1>
        <button
          onClick={() => router.push('/dashboard')}
          className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
        >
          ダッシュボードに戻る
        </button>
      </div>

      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-8">
        <p className="text-yellow-800 font-semibold">⚠️ 開発テスト専用画面</p>
        <p className="text-yellow-700 text-sm mt-1">
          この画面では実際の課金をせずに、課金後の状態をシミュレーションできます。
        </p>
      </div>

      {/* 現在の状況表示 */}
      {likeStatus && (
        <div className="bg-white p-6 rounded-lg shadow-md mb-8">
          <h2 className="text-xl font-semibold mb-4">📊 現在の課金状況</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-600">プラン</p>
              <p className="font-bold text-blue-800">
                {likeStatus.plan.isPremium ? '✨ プレミアム' : '🆓 無料'}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-green-600">残りいいね</p>
              <p className="font-bold text-green-800">
                {likeStatus.usage.remainingLikes}/{likeStatus.usage.totalAvailable}
              </p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <p className="text-sm text-purple-600">今月使用</p>
              <p className="font-bold text-purple-800">
                {likeStatus.usage.usedCount}回
              </p>
            </div>
            <div className="bg-orange-50 p-4 rounded-lg">
              <p className="text-sm text-orange-600">購入済み</p>
              <p className="font-bold text-orange-800">
                {likeStatus.usage.purchasedCount}回
              </p>
            </div>
          </div>
        </div>
      )}

      {/* メッセージ表示 */}
      {message && (
        <div className={`p-4 rounded-lg mb-6 ${
          message.startsWith('✅') ? 'bg-green-100 text-green-700' : 
          message.startsWith('❌') ? 'bg-red-100 text-red-700' : 
          'bg-blue-100 text-blue-700'
        }`}>
          {message}
        </div>
      )}

      {/* テスト操作ボタン */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* プラン操作 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">📋 プラン操作</h3>
          <div className="space-y-3">
            <button
              onClick={simulatePremium}
              disabled={isProcessing}
              className="w-full bg-purple-500 text-white py-3 px-4 rounded-md hover:bg-purple-600 disabled:opacity-50"
            >
              {isProcessing ? '処理中...' : '✨ プレミアムプラン加入'}
            </button>
            <button
              onClick={simulateFree}
              disabled={isProcessing}
              className="w-full bg-gray-500 text-white py-3 px-4 rounded-md hover:bg-gray-600 disabled:opacity-50"
            >
              {isProcessing ? '処理中...' : '🆓 無料プランに戻す'}
            </button>
          </div>
        </div>

        {/* いいね操作 */}
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h3 className="text-lg font-semibold mb-4">💰 いいね操作</h3>
          <div className="space-y-3">
            {likeStatus?.plan?.isPremium ? (
              <div className="bg-purple-100 text-purple-700 p-3 rounded-md text-sm">
                <p className="font-medium">✨ プレミアムプラン加入中</p>
                <p>無制限いいねをお楽しみいただけます。追加購入は不要です。</p>
              </div>
            ) : (
              <button
                onClick={simulatePurchaseLike}
                disabled={isProcessing}
                className="w-full bg-orange-500 text-white py-3 px-4 rounded-md hover:bg-orange-600 disabled:opacity-50"
              >
                {isProcessing ? '処理中...' : '💰 追加いいね購入（+1回）'}
              </button>
            )}
            <button
              onClick={resetTestData}
              disabled={isProcessing}
              className="w-full bg-red-500 text-white py-3 px-4 rounded-md hover:bg-red-600 disabled:opacity-50"
            >
              {isProcessing ? '処理中...' : '🔄 テストデータリセット'}
            </button>
          </div>
        </div>
      </div>

      {/* テストシナリオ */}
      <div className="bg-white p-6 rounded-lg shadow-md mt-8">
        <h3 className="text-lg font-semibold mb-4">🎯 推奨テストシナリオ</h3>
        <ol className="list-decimal list-inside space-y-2 text-sm text-gray-700">
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
  );
} 