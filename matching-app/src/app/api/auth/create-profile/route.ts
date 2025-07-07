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
    const { userId, email, name } = body;

    console.log('=== プロフィール作成API開始 ===');
    console.log('ユーザーID:', userId);
    console.log('メール:', email);
    console.log('名前:', name);

    // 入力データの検証
    if (!userId || !email || !name) {
      return NextResponse.json(
        { error: 'ユーザーID、メール、名前が必要です' },
        { status: 400 }
      );
    }

    // プロフィール情報を作成
    const { data, error } = await supabase
      .from('profiles')
      .insert([
        {
          id: userId,
          email: email,
          name: name
        }
      ])
      .select('*')
      .single();

    if (error) {
      console.error('プロフィール作成エラー:', error);
      return NextResponse.json(
        { error: 'プロフィールの作成に失敗しました' },
        { status: 500 }
      );
    }

    console.log('プロフィール作成完了:', data);

    return NextResponse.json({
      success: true,
      message: 'プロフィールを作成しました',
      profile: data
    });

  } catch (error) {
    console.error('プロフィール作成API エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 