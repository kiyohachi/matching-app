import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント作成
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lineUserId, displayName, pictureUrl, email } = body;

    console.log('=== LINEアカウント作成API開始 ===');
    console.log('リクエストデータ:', { lineUserId, displayName, email });

    // 入力データの検証
    if (!lineUserId || !displayName || !email) {
      return NextResponse.json(
        { error: '必要な情報が不足しています' },
        { status: 400 }
      );
    }

    if (!email.includes('@')) {
      return NextResponse.json(
        { error: '有効なメールアドレスを入力してください' },
        { status: 400 }
      );
    }

    // 既存のLINEユーザーIDチェック
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();

    if (existingProfile) {
      console.log('既存のLINEユーザーIDが検出されました:', lineUserId);
      return NextResponse.json(
        { error: 'このLINEアカウントは既に登録済みです' },
        { status: 409 }
      );
    }

    // Supabase Authでユーザーを作成
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      email_confirm: true,
      app_metadata: {
        provider: 'line',
        line_user_id: lineUserId,
      },
      user_metadata: {
        name: displayName,
        picture: pictureUrl,
        line_display_name: displayName,
        line_user_id: lineUserId,
      },
    });

    if (authError) {
      console.error('Supabase認証エラー:', authError);
      
      if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
        // メールアドレス重複の場合、既存ユーザーを検索してLINE情報を追加
        console.log('既存メールアドレス検出、LINE情報を追加');
        
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers.users.find(user => user.email === email);
        
        if (existingUser) {
          // 既存ユーザーにLINE情報を追加
          const { error: updateError } = await supabase
            .from('profiles')
            .update({
              line_user_id: lineUserId,
              line_display_name: displayName,
              name: displayName, // 表示名も更新
            })
            .eq('id', existingUser.id);

          if (updateError) {
            console.error('プロフィール更新エラー:', updateError);
            return NextResponse.json(
              { error: 'プロフィールの更新に失敗しました' },
              { status: 500 }
            );
          }

          console.log('既存ユーザーにLINE情報を追加完了:', existingUser.id);
          return NextResponse.json({
            success: true,
            userId: existingUser.id,
            message: '既存アカウントにLINE情報を追加しました'
          });
        }
      }
      
      return NextResponse.json(
        { error: 'アカウント作成に失敗しました' },
        { status: 500 }
      );
    }

    if (!authData?.user?.id) {
      console.error('ユーザーIDが取得できませんでした');
      return NextResponse.json(
        { error: 'ユーザーIDの取得に失敗しました' },
        { status: 500 }
      );
    }

    // プロフィールテーブルに情報を保存
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user.id,
        email: email,
        name: displayName,
        line_user_id: lineUserId,
        line_display_name: displayName,
      });

    if (profileError) {
      console.error('プロフィール作成エラー:', profileError);
      // ユーザーは作成されているので、削除してエラーを返す
      await supabase.auth.admin.deleteUser(authData.user.id);
      
      return NextResponse.json(
        { error: 'プロフィールの作成に失敗しました' },
        { status: 500 }
      );
    }

    console.log('LINEアカウント作成完了:', authData.user.id);
    
    return NextResponse.json({
      success: true,
      userId: authData.user.id,
      message: 'アカウントが正常に作成されました'
    });

  } catch (error) {
    console.error('LINEアカウント作成API エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 