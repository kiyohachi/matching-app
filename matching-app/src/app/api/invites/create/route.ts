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
    const { userId, groupName } = body;

    console.log('=== 招待作成API開始 ===');
    console.log('ユーザーID:', userId);
    console.log('グループ名:', groupName);

    // 入力データの検証
    if (!userId || !groupName) {
      return NextResponse.json(
        { error: 'ユーザーIDとグループ名が必要です' },
        { status: 400 }
      );
    }

    // ランダムな招待コードを生成
    const inviteCode = Math.random().toString(36).substring(2, 10);

    // 招待情報を作成
    const { data, error } = await supabase
      .from('invites')
      .insert([
        {
          user_id: userId,
          invite_code: inviteCode,
          name: groupName,
          clicks: 0,
          signups: 0
        }
      ])
      .select('*')
      .single();

    if (error) {
      console.error('招待作成エラー:', error);
      return NextResponse.json(
        { error: '招待リンクの作成に失敗しました' },
        { status: 500 }
      );
    }

    console.log('招待作成完了:', data);

    return NextResponse.json({
      success: true,
      message: '招待リンクを作成しました',
      invite: data
    });

  } catch (error) {
    console.error('招待作成API エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 