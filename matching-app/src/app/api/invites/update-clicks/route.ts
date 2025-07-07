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
    const { inviteCode } = body;

    console.log('=== 招待クリック数更新API開始 ===');
    console.log('招待コード:', inviteCode);

    // 入力データの検証
    if (!inviteCode) {
      return NextResponse.json(
        { error: '招待コードが必要です' },
        { status: 400 }
      );
    }

    // 招待情報を取得して、クリック数を+1
    const { data: inviteData, error: fetchError } = await supabase
      .from('invites')
      .select('id, clicks')
      .eq('invite_code', inviteCode)
      .single();

    if (fetchError || !inviteData) {
      console.error('招待情報取得エラー:', fetchError);
      return NextResponse.json(
        { error: '招待リンクが見つかりません' },
        { status: 404 }
      );
    }

    // クリック数を更新
    const { error: updateError } = await supabase
      .from('invites')
      .update({ clicks: inviteData.clicks + 1 })
      .eq('id', inviteData.id);

    if (updateError) {
      console.error('クリック数更新エラー:', updateError);
      return NextResponse.json(
        { error: 'クリック数の更新に失敗しました' },
        { status: 500 }
      );
    }

    console.log('クリック数更新完了:', inviteData.clicks + 1);

    return NextResponse.json({
      success: true,
      message: 'クリック数を更新しました',
      newClickCount: inviteData.clicks + 1
    });

  } catch (error) {
    console.error('招待クリック数更新API エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 