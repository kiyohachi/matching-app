import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { userId, quantity = 1 } = await request.json();

    if (!userId) {
      return NextResponse.json({ error: 'ユーザーIDが必要です' }, { status: 400 });
    }

    console.log('=== 追加いいね購入シミュレーション ===');
    console.log('ユーザーID:', userId);
    console.log('数量:', quantity);

    // プレミアムプランチェック
    const { data: planData, error: planError } = await supabase
      .rpc('get_user_plan', { p_user_id: userId });

    if (planError) {
      console.error('プランチェックエラー:', planError);
      return NextResponse.json({ error: 'プランチェックに失敗しました' }, { status: 500 });
    }

    const planInfo = planData?.[0];
    if (planInfo?.is_premium) {
      console.log('❌ プレミアムプランユーザーは追加いいねを購入できません');
      return NextResponse.json({ 
        error: 'プレミアムプラン加入中のため、追加いいねの購入は不要です。無制限いいねをお楽しみください。' 
      }, { status: 400 });
    }

    // 現在の月の文字列を取得
    const currentMonth = new Date().toISOString().slice(0, 7); // 'YYYY-MM' 形式

    // 既存の使用状況を取得
    const { data: existingUsage, error: fetchError } = await supabase
      .from('like_usage')
      .select('*')
      .eq('user_id', userId)
      .eq('month_year', currentMonth)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116は「見つからない」エラー
      console.error('使用状況取得エラー:', fetchError);
      return NextResponse.json({ error: '使用状況の取得に失敗しました' }, { status: 500 });
    }

    // 新しいpurchased_countを計算（既存値に追加）
    const currentPurchasedCount = existingUsage?.purchased_count || 0;
    const newPurchasedCount = currentPurchasedCount + quantity;

    // like_usageテーブルを更新またはインサート（正しい累積処理）
    const { data: usageData, error: usageError } = await supabase
      .from('like_usage')
      .upsert({
        user_id: userId,
        month_year: currentMonth,
        used_count: existingUsage?.used_count || 0,
        purchased_count: newPurchasedCount, // 累積した値を使用
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'user_id,month_year'
      })
      .select();

    if (usageError) {
      console.error('使用量更新エラー:', usageError);
      return NextResponse.json({ error: '使用量更新に失敗しました' }, { status: 500 });
    }

    console.log('✅ purchased_count更新:', `${currentPurchasedCount} → ${newPurchasedCount}`);

    // 購入履歴に記録
    const { error: purchaseError } = await supabase
      .from('purchase_history')
      .insert({
        user_id: userId,
        purchase_type: 'single_like',
        amount: 300 * quantity,
        quantity: quantity,
        stripe_payment_intent_id: `test_like_${userId}_${Date.now()}`
      });

    if (purchaseError) {
      console.error('購入履歴記録エラー:', purchaseError);
      // 購入履歴エラーは続行可能
    }

    console.log('✅ 追加いいね購入シミュレーション完了');

    return NextResponse.json({
      success: true,
      message: `追加いいね ${quantity}回を購入しました`,
      quantity: quantity,
      amount: 300 * quantity,
      newTotal: newPurchasedCount
    });

  } catch (error) {
    console.error('追加いいね購入シミュレーションエラー:', error);
    return NextResponse.json({ error: '予期しないエラーが発生しました' }, { status: 500 });
  }
} 