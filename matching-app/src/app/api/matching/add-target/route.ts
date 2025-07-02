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

    // 会いたい人を登録
    const { data: insertData, error: insertError } = await supabase
      .from('matches')
      .insert([
        {
          user_id: userId,
          target_name: targetName,
          matched: false,
          notified: false,
          invite_id: inviteId
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

    return NextResponse.json({
      success: true,
      message: '会いたい人を登録しました！',
      isMatch: !!matchResult,
      matches: userMatches || []
    });

  } catch (error) {
    console.error('マッチング登録API エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 