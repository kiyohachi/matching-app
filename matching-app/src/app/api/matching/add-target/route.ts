import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント作成（Service Role Key使用）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, targetName, inviteId } = body;

    console.log('=== マッチング登録API開始 ===');
    console.log('ユーザーID:', userId);
    console.log('対象者名:', targetName);
    console.log('グループID:', inviteId);

    // 入力データの検証
    if (!userId || !targetName || !inviteId) {
      return NextResponse.json(
        { error: '必要な情報が不足しています' },
        { status: 400 }
      );
    }

    // 【新機能】いいね制限チェック
    console.log('=== いいね制限チェック開始 ===');
    const { data: limitCheck, error: limitError } = await supabase
      .rpc('check_like_limit', { p_user_id: userId });

    if (limitError) {
      console.error('制限チェックエラー:', limitError);
      return NextResponse.json(
        { error: '制限チェックに失敗しました' },
        { status: 500 }
      );
    }

    const limitResult = limitCheck?.[0];
    console.log('制限チェック結果:', limitResult);

    // 制限に達している場合はエラーレスポンス
    if (!limitResult?.allowed) {
      console.log('❌ いいね制限に達しています');
      return NextResponse.json(
        { 
          error: 'like_limit_exceeded',
          message: limitResult?.message || '今月のいいね制限に達しました',
          remainingLikes: limitResult?.remaining_likes || 0,
          limitExceeded: true
        },
        { status: 403 }
      );
    }

    console.log('✅ いいね制限OK、残り:', limitResult?.remaining_likes);

    // 既存のターゲットをチェック（同じグループ内で）
    const { data: existingMatch } = await supabase
      .from('matches')
      .select('id')
      .eq('user_id', userId)
      .eq('target_name', targetName)
      .eq('invite_id', inviteId)
      .single();

    if (existingMatch) {
      return NextResponse.json(
        { error: 'すでに同じ名前で登録されています' },
        { status: 409 }
      );
    }

    // 【新機能】いいね消費処理
    console.log('=== いいね消費処理開始 ===');
    const { data: consumeResult, error: consumeError } = await supabase
      .rpc('consume_like', { p_user_id: userId });

    if (consumeError) {
      console.error('いいね消費エラー:', consumeError);
      return NextResponse.json(
        { error: 'いいね消費処理に失敗しました' },
        { status: 500 }
      );
    }

    if (!consumeResult) {
      console.log('❌ いいね消費失敗（制限に達している可能性）');
      return NextResponse.json(
        { 
          error: 'like_limit_exceeded',
          message: '今月のいいね制限に達しました',
          remainingLikes: 0,
          limitExceeded: true
        },
        { status: 403 }
      );
    }

    console.log('✅ いいね消費完了');

    // 会いたい人を登録
    const { data: insertData, error: insertError } = await supabase
      .from('matches')
      .insert([
        {
          user_id: userId,
          target_name: targetName,
          matched: false,
          notified: false,
          invite_id: inviteId,
          consumed_like: true // いいねを消費したことを記録
        }
      ])
      .select('*');

    if (insertError) {
      console.error('登録エラー:', insertError);
      return NextResponse.json(
        { error: '登録に失敗しました' },
        { status: 500 }
      );
    }

    console.log('いいね登録完了:', insertData);

    // 相互マッチングをチェック・処理（特権関数使用）
    const { data: matchResult, error: matchError } = await supabase
      .rpc('process_mutual_match', {
        p_user_id: userId,
        p_target_name: targetName,
        p_invite_id: inviteId
      });

    if (matchError) {
      console.error('マッチング処理エラー:', matchError);
      // マッチング処理エラーでも登録は成功として扱う
    } else {
      console.log('マッチング処理結果:', matchResult ? 'マッチ成立' : 'マッチなし');
    }

    // ユーザーの最新マッチ一覧を取得
    const { data: userMatches, error: fetchError } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId)
      .eq('invite_id', inviteId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('マッチ一覧取得エラー:', fetchError);
    }

    // 【新機能】現在の残りいいね数を取得
    const { data: currentUsage, error: usageError } = await supabase
      .rpc('get_like_usage_current_month', { p_user_id: userId });

    let remainingLikes = 0;
    if (!usageError && currentUsage?.[0]) {
      const usage = currentUsage[0];
      remainingLikes = usage.total_available - usage.used_count;
    }

    return NextResponse.json({
      success: true,
      message: '会いたい人を登録しました！',
      isMatch: !!matchResult,
      matches: userMatches || [],
      remainingLikes: remainingLikes, // 残りいいね数を返す
      likeConsumed: true // いいねを消費したことを通知
    });

  } catch (error) {
    console.error('マッチング登録API エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 