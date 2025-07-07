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

    console.log('=== 無料プラン戻しシミュレーション ===');
    console.log('ユーザーID:', userId);

    // user_subscriptionsテーブルを無料プランに戻す
    const { data: subscriptionData, error: subscriptionError } = await supabase
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
      })
      .select();

    if (subscriptionError) {
      console.error('サブスクリプション設定エラー:', subscriptionError);
      return NextResponse.json({ error: 'サブスクリプション設定に失敗しました' }, { status: 500 });
    }

    console.log('✅ 無料プラン戻しシミュレーション完了');

    return NextResponse.json({
      success: true,
      message: '無料プランに戻しました',
      plan: 'free'
    });

  } catch (error) {
    console.error('無料プラン戻しシミュレーションエラー:', error);
    return NextResponse.json({ error: '予期しないエラーが発生しました' }, { status: 500 });
  }
} 