import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント作成
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const inviteId = searchParams.get('inviteId');

    console.log('=== マッチ一覧取得API開始 ===');
    console.log('ユーザーID:', userId);
    console.log('グループID:', inviteId);

    // 入力データの検証
    if (!userId || !inviteId) {
      return NextResponse.json(
        { error: '必要な情報が不足しています' },
        { status: 400 }
      );
    }

    // ユーザーのマッチ一覧を取得（シンプル版）
    const { data: matchesData, error: matchesError } = await supabase
      .from('matches')
      .select('*')
      .eq('user_id', userId)
      .eq('invite_id', inviteId)
      .order('created_at', { ascending: false });

    if (matchesError) {
      console.error('マッチ一覧取得エラー:', matchesError);
      return NextResponse.json(
        { error: 'マッチ一覧の取得に失敗しました' },
        { status: 500 }
      );
    }

    console.log('取得したマッチ一覧:', matchesData);

    return NextResponse.json({
      success: true,
      matches: matchesData || []
    });

  } catch (error) {
    console.error('マッチ一覧取得API エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 