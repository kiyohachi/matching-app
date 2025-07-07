import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
    }

    console.log('=== テストデータリセット ===');
    console.log('ユーザーID:', userId);

    // 1. user_subscriptionsテーブルを無料プランに戻す
    const { error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_type: 'free',
        status: 'active',
        stripe_customer_id: null,
        stripe_subscription_id: null,
        current_period_start: new Date().toISOString(),
        current_period_end: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      });

    if (subscriptionError) {
      console.error('サブスクリプションリセットエラー:', subscriptionError);
      return NextResponse.json({ error: 'サブスクリプションリセットに失敗しました' }, { status: 500 });
    }

    // 2. like_usageテーブルをクリア
    const { error: usageError } = await supabase
      .from('like_usage')
      .delete()
      .eq('user_id', userId);

    if (usageError) {
      console.error('使用状況リセットエラー:', usageError);
      return NextResponse.json({ error: '使用状況リセットに失敗しました' }, { status: 500 });
    }

    // 3. purchase_historyテーブルからテストデータを削除
    const { error: historyError } = await supabase
      .from('purchase_history')
      .delete()
      .eq('user_id', userId)
      .like('description', '%テスト%');

    if (historyError) {
      console.error('購入履歴リセットエラー:', historyError);
      // 購入履歴エラーは続行可能
    }

    // 4. matchesテーブルのconsumed_likeをfalseに戻す
    const { error: matchesError } = await supabase
      .from('matches')
      .update({ consumed_like: false })
      .eq('user_id', userId);

    if (matchesError) {
      console.error('マッチリセットエラー:', matchesError);
      // マッチリセットエラーは続行可能
    }

    console.log('✅ テストデータリセット完了');

    return NextResponse.json({
      success: true,
      message: 'テストデータをリセットしました',
      reset: {
        subscription: 'free',
        usage: 'cleared',
        history: 'cleared',
        matches: 'reset'
      }
    });

  } catch (error) {
    console.error('テストデータリセットエラー:', error);
    return NextResponse.json({ error: '予期しないエラーが発生しました' }, { status: 500 });
  }
} 