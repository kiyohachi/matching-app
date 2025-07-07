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

    console.log('=== プレミアムプラン加入シミュレーション ===');
    console.log('ユーザーID:', userId);

    // 現在の日付から30日後を有効期限とする
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 30);

    // user_subscriptionsテーブルにプレミアムプランを設定
    const { data: subscriptionData, error: subscriptionError } = await supabase
      .from('user_subscriptions')
      .upsert({
        user_id: userId,
        plan_type: 'premium',
        status: 'active',
        stripe_customer_id: `test_customer_${userId}`,
        stripe_subscription_id: `test_subscription_${userId}`,
        current_period_start: new Date().toISOString(),
        current_period_end: endDate.toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id'
      })
      .select();

    if (subscriptionError) {
      console.error('サブスクリプション設定エラー:', subscriptionError);
      return NextResponse.json({ error: 'サブスクリプション設定に失敗しました' }, { status: 500 });
    }

    // 購入履歴に記録
    const { error: purchaseError } = await supabase
      .from('purchase_history')
      .insert({
        user_id: userId,
        purchase_type: 'subscription',
        amount: 1000,
        stripe_payment_intent_id: `test_payment_${userId}_${Date.now()}`
      });

    if (purchaseError) {
      console.error('購入履歴記録エラー:', purchaseError);
      // 購入履歴エラーは続行可能
    }

    console.log('✅ プレミアムプラン加入シミュレーション完了');

    return NextResponse.json({
      success: true,
      message: 'プレミアムプランに加入しました',
      plan: 'premium',
      validUntil: endDate.toISOString()
    });

  } catch (error) {
    console.error('プレミアムプラン加入シミュレーションエラー:', error);
    return NextResponse.json({ error: '予期しないエラーが発生しました' }, { status: 500 });
  }
} 