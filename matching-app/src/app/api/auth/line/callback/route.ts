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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const inviteCode = searchParams.get('state')?.split('_')[1]; // inviteCodeがある場合は state に含まれる

  console.log('=== LINEログインコールバック処理開始 ===');
  console.log('認可コード:', code);
  console.log('State:', state);
  
  // 環境変数からベースURLを取得
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

  if (error) {
    console.error('LINE認証エラー:', error);
    return NextResponse.redirect(new URL('/auth?error=line_auth_error', baseUrl));
  }

  if (!code) {
    console.error('認可コードが見つかりません');
    return NextResponse.redirect(new URL('/auth?error=no_code', baseUrl));
  }

  try {
    // Step 1: 認可コードでアクセストークンを取得
    const redirectUri = `${baseUrl}/api/auth/line/callback`;
    console.log('使用するredirect_uri (callback):', redirectUri);
    
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_CLIENT_ID!,
        client_secret: process.env.LINE_CLIENT_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      console.error('LINEトークン取得エラー:', tokenResponse.status);
      return NextResponse.redirect(new URL('/auth?error=token_error', baseUrl));
    }

    const tokenData = await tokenResponse.json();
    console.log('LINEトークン取得成功');

    // Step 2: IDトークンをデコードしてユーザー情報を取得
    const idToken = tokenData.id_token;
    const decodedPayload = JSON.parse(atob(idToken.split('.')[1]));
    
    const lineUserInfo = {
      lineUserId: decodedPayload.sub,
      displayName: decodedPayload.name || 'LINEユーザー',
      pictureUrl: decodedPayload.picture || null,
      email: decodedPayload.email || null,
    };

    console.log('LINEユーザー情報:', lineUserInfo);
    console.log('取得したメールアドレス:', lineUserInfo.email);

    // Step 3: 既存ユーザーの確認
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('line_user_id', lineUserInfo.lineUserId)
      .single();

    if (existingProfile) {
      // 既存LINEユーザーの場合 - 強力な一時パスワードでログイン
      console.log('既存LINEユーザーを検出:', existingProfile.id);
      console.log('既存プロフィール情報:', existingProfile);
      
      // 強力な一時パスワードを生成
      const tempPassword = generateTempPassword();
      console.log('強力な一時パスワード生成完了:', tempPassword.length, '文字');
      
      try {
        // 既存ユーザーのパスワードを強力な一時パスワードで更新
        const { error: updateError } = await supabase.auth.admin.updateUserById(
          existingProfile.id,
          { password: tempPassword }
        );

        if (updateError) {
          console.error('既存ユーザーのパスワード更新エラー:', updateError);
          console.error('エラーの詳細:', {
            message: updateError.message,
            code: updateError.code,
            status: updateError.status
          });
          return NextResponse.redirect(new URL('/auth?error=password_update_error', baseUrl));
        }

        console.log('既存ユーザーのパスワード更新成功');
        
      } catch (updateErr) {
        console.error('既存ユーザーパスワード更新処理エラー:', updateErr);
        return NextResponse.redirect(new URL('/auth?error=password_update_error', baseUrl));
      }
      
      // emailがnullの場合のフォールバック
      const userEmail = existingProfile.email || `${lineUserInfo.lineUserId}@line.local`;
      console.log('使用するメールアドレス:', userEmail);

      // プロフィール情報を更新（emailとLINE情報を確実に設定）
      try {
        const { error: profileUpdateError } = await supabase
          .from('profiles')
          .update({
            email: userEmail,
            line_user_id: lineUserInfo.lineUserId,
            line_display_name: lineUserInfo.displayName,
            name: lineUserInfo.displayName,
          })
          .eq('id', existingProfile.id);

        if (profileUpdateError) {
          console.error('プロフィール更新エラー:', profileUpdateError);
          // エラーでもログイン処理は継続
        } else {
          console.log('プロフィール更新成功');
        }
      } catch (profileErr) {
        console.error('プロフィール更新処理エラー:', profileErr);
        // エラーでもログイン処理は継続
      }

      // セッション情報を含むリダイレクト（強力な一時パスワード付き）
      const redirectUrl = new URL('/dashboard', baseUrl);
      redirectUrl.searchParams.set('line_login', 'success');
      redirectUrl.searchParams.set('user_id', existingProfile.id);
      redirectUrl.searchParams.set('email', userEmail);
      redirectUrl.searchParams.set('temp_password', tempPassword);
      redirectUrl.searchParams.set('display_name', encodeURIComponent(lineUserInfo.displayName));
      redirectUrl.searchParams.set('login_type', 'line_existing');

      console.log('既存ユーザーのリダイレクト先:', redirectUrl.toString());
      return NextResponse.redirect(redirectUrl);
    } else {
      // 新規ユーザーの場合
      console.log('新規LINEユーザーの作成を開始');
      
      // LINEからメールアドレスが取得できない場合の処理
      if (!lineUserInfo.email) {
        console.log('LINEからメールアドレスが取得できません。メール入力ページにリダイレクト');
        
        // 一時的にLINEユーザー情報をセッションに保存
        const redirectUrl = new URL('/auth/line-email', baseUrl);
        redirectUrl.searchParams.set('line_user_id', lineUserInfo.lineUserId);
        redirectUrl.searchParams.set('display_name', encodeURIComponent(lineUserInfo.displayName));
        redirectUrl.searchParams.set('picture_url', encodeURIComponent(lineUserInfo.pictureUrl || ''));
        
        return NextResponse.redirect(redirectUrl);
      }
      
      // メールアドレスが取得できた場合は直接アカウント作成
      const tempPassword = generateTempPassword();
      
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: lineUserInfo.email,
        password: tempPassword,
        email_confirm: true,
        app_metadata: {
          provider: 'line',
          line_user_id: lineUserInfo.lineUserId,
        },
        user_metadata: {
          name: lineUserInfo.displayName,
          picture: lineUserInfo.pictureUrl,
          line_display_name: lineUserInfo.displayName,
          line_user_id: lineUserInfo.lineUserId,
        },
      });

      if (authError) {
        console.error('Supabase認証エラー詳細:', authError);
        
        if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
          // メールアドレス重複の場合、既存ユーザーを取得
          console.log('既存メールアドレスを検出、既存ユーザーを検索');
          
          // auth.usersテーブルから該当メールアドレスのユーザーを検索
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers.users.find(user => user.email === lineUserInfo.email);
          
          if (existingUser) {
            console.log('既存ユーザーにLINE情報を追加:', existingUser.id);
            
            // 既存ユーザーのパスワードを更新
            const { error: updateError } = await supabase.auth.admin.updateUserById(
              existingUser.id,
              { password: tempPassword }
            );

            if (updateError) {
              console.error('既存ユーザーのパスワード更新エラー:', updateError);
              return NextResponse.redirect(new URL('/auth?error=password_update_error', baseUrl));
            }

            // プロフィールにLINE情報を追加
            await supabase
              .from('profiles')
              .update({
                line_user_id: lineUserInfo.lineUserId,
                line_display_name: lineUserInfo.displayName,
                name: lineUserInfo.displayName,
              })
              .eq('id', existingUser.id);

            // セッション情報を含むリダイレクト
            const redirectUrl = new URL('/dashboard', baseUrl);
            redirectUrl.searchParams.set('line_login', 'success');
            redirectUrl.searchParams.set('user_id', existingUser.id);
            redirectUrl.searchParams.set('email', existingUser.email!);
            redirectUrl.searchParams.set('temp_password', tempPassword);
            redirectUrl.searchParams.set('display_name', encodeURIComponent(lineUserInfo.displayName));

            return NextResponse.redirect(redirectUrl);
          } else {
            console.error('既存ユーザーが見つかりませんでした');
            return NextResponse.redirect(new URL('/auth?error=existing_user_not_found', baseUrl));
          }
        } else {
          console.error('Supabase認証エラー:', authError);
          return NextResponse.redirect(new URL('/auth?error=supabase_auth_error', baseUrl));
        }
      } else {
        if (!authData?.user?.id) {
          console.error('SupabaseユーザーIDが取得できませんでした');
          return NextResponse.redirect(new URL('/auth?error=no_supabase_user', baseUrl));
        }
        
        const userId = authData.user.id;
        console.log('新規Supabaseユーザー作成:', userId);

        // プロフィールテーブルにユーザー情報を保存
        const profileData = {
          id: userId,
          name: lineUserInfo.displayName,
          email: lineUserInfo.email,
          line_user_id: lineUserInfo.lineUserId,
          line_display_name: lineUserInfo.displayName,
        };

        const { error: profileError } = await supabase
          .from('profiles')
          .upsert(profileData, { onConflict: 'id' });

        if (profileError) {
          console.error('プロフィール保存エラー:', profileError);
          // カラムが見つからない場合でもログインは続行
          if (!profileError.message.includes('Could not find')) {
            return NextResponse.redirect(new URL('/auth?error=profile_save_error', baseUrl));
          }
        }

        console.log('LINEログイン完了 - ユーザーID:', userId);

        // セッション情報を含むリダイレクト
        const redirectUrl = new URL('/dashboard', baseUrl);
        redirectUrl.searchParams.set('line_login', 'success');
        redirectUrl.searchParams.set('user_id', userId);
        redirectUrl.searchParams.set('email', lineUserInfo.email);
        redirectUrl.searchParams.set('temp_password', tempPassword);
        redirectUrl.searchParams.set('display_name', encodeURIComponent(lineUserInfo.displayName));

        return NextResponse.redirect(redirectUrl);
      }
    }

  } catch (error) {
    console.error('LINEログイン処理エラー:', error);
    return NextResponse.redirect(new URL('/auth?error=unexpected_error', baseUrl));
  }
} 