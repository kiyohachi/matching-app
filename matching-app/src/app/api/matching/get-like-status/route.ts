import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント作成（Service Role Key使用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    console.log('=== いいね状況取得API開始 ===');
    console.log('ユーザーID:', userId);

    // 入力データの検証
    if (!userId) {
      return NextResponse.json(
        { error: 'ユーザーIDが必要です' },
        { status: 400 }
      );
    }

    // ユーザープラン情報を取得
    const { data: planData, error: planError } = await supabase
      .rpc('get_user_plan', { p_user_id: userId });

    if (planError) {
      console.error('プラン情報取得エラー:', planError);
      return NextResponse.json(
        { error: 'プラン情報の取得に失敗しました' },
        { status: 500 }
      );
    }

    // 今月のいいね使用状況を取得
    const { data: usageData, error: usageError } = await supabase
      .rpc('get_like_usage_current_month', { p_user_id: userId });

    if (usageError) {
      console.error('使用状況取得エラー:', usageError);
      return NextResponse.json(
        { error: '使用状況の取得に失敗しました' },
        { status: 500 }
      );
    }

    // いいね制限チェック
    const { data: limitCheck, error: limitError } = await supabase
      .rpc('check_like_limit', { p_user_id: userId });

    if (limitError) {
      console.error('制限チェックエラー:', limitError);
      return NextResponse.json(
        { error: '制限チェックに失敗しました' },
        { status: 500 }
      );
    }

    const planInfo = planData?.[0];
    const usageInfo = usageData?.[0];
    const limitInfo = limitCheck?.[0];

    console.log('プラン情報:', planInfo);
    console.log('使用状況:', usageInfo);
    console.log('制限情報:', limitInfo);

    // レスポンスデータの構築
    const responseData = {
      success: true,
      plan: {
        type: planInfo?.plan_type || 'free',
        isPremium: planInfo?.is_premium || false,
        periodEnd: planInfo?.period_end || null
      },
      usage: {
        usedCount: usageInfo?.used_count || 0,
        purchasedCount: usageInfo?.purchased_count || 0,
        totalAvailable: usageInfo?.total_available || 1,
        remainingLikes: limitInfo?.remaining_likes || 0
      },
      limit: {
        allowed: limitInfo?.allowed || false,
        message: limitInfo?.message || '制限情報を取得できません'
      }
    };

    console.log('レスポンスデータ:', responseData);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('いいね状況取得API エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 