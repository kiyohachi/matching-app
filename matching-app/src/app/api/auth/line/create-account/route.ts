import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント作成
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 強力な一時パスワードを生成する関数
function generateTempPassword(): string {
  const lowercase = 'abcdefghijklmnopqrstuvwxyz';
  const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  const special = '!@#$%^&*()_+-=[]{}';
  
  // 各カテゴリから最低1文字ずつ選択
  let password = '';
  password += lowercase[Math.floor(Math.random() * lowercase.length)];
  password += uppercase[Math.floor(Math.random() * uppercase.length)];
  password += numbers[Math.floor(Math.random() * numbers.length)];
  password += special[Math.floor(Math.random() * special.length)];
  
  // 残りの文字をランダムに選択（合計16文字）
  const allChars = lowercase + uppercase + numbers + special;
  for (let i = 0; i < 12; i++) {
    password += allChars[Math.floor(Math.random() * allChars.length)];
  }
  
  // 文字をシャッフル
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

export async function POST(request: NextRequest) {
  try {
    const { email, lineUserId, displayName, pictureUrl } = await request.json();

    // 入力値検証
    if (!email || !lineUserId || !displayName) {
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

    console.log('=== LINEアカウント作成処理開始 ===');
    console.log('Email:', email);
    console.log('LINE User ID:', lineUserId);
    console.log('Display Name:', displayName);

    // 既存のLINEユーザーをチェック
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('line_user_id', lineUserId)
      .single();

    if (existingProfile) {
      return NextResponse.json(
        { error: 'このLINEアカウントは既に登録済みです' },
        { status: 409 }
      );
    }

    // 一時パスワードを生成
    const tempPassword = generateTempPassword();
    console.log('一時パスワード生成完了');

    // Supabaseでユーザーを作成（パスワード付き）
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: email,
      password: tempPassword,
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
      console.error('Supabaseユーザー作成エラー:', authError);
      
      if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
        return NextResponse.json(
          { error: 'このメールアドレスは既に使用されています' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: `アカウントの作成に失敗しました: ${authError.message}` },
        { status: 500 }
      );
    }

    if (!authData?.user?.id) {
      return NextResponse.json(
        { error: 'ユーザーIDの取得に失敗しました' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;
    console.log('Supabaseユーザー作成成功:', userId);

    // プロフィールテーブルにユーザー情報を保存
    const profileData = {
      id: userId,
      name: displayName,
      email: email,
      line_user_id: lineUserId,
      line_display_name: displayName,
    };

    const { error: profileError } = await supabase
      .from('profiles')
      .insert(profileData);

    if (profileError) {
      console.error('プロフィール保存エラー:', profileError);
      
      // プロフィール保存に失敗した場合でも、認証ユーザーは作成されているのでロールバック
      try {
        await supabase.auth.admin.deleteUser(userId);
      } catch (deleteError) {
        console.error('ユーザー削除エラー:', deleteError);
      }

      return NextResponse.json(
        { error: 'プロフィールの保存に失敗しました' },
        { status: 500 }
      );
    }

    console.log('プロフィール保存成功');
    console.log('=== LINEアカウント作成完了 ===');

    // 一時パスワードをクライアントに返す（自動ログイン用）
    return NextResponse.json({
      success: true,
      message: 'アカウントが正常に作成されました',
      userId: userId,
      displayName: displayName,
      email: email,
      tempPassword: tempPassword,
    });

  } catch (error) {
    console.error('LINEアカウント作成処理エラー:', error);
    return NextResponse.json(
      { error: '予期しないエラーが発生しました' },
      { status: 500 }
    );
  }
} 