import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Supabaseクライアント作成
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  
  if (!code) {
    console.error('認可コードが取得できませんでした');
    return NextResponse.redirect(new URL('/auth?error=no_code', request.url));
  }

  try {
    console.log('=== LINEログインコールバック処理開始 ===');
    console.log('認可コード:', code);
    console.log('State:', state);

    const redirectUri = `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/auth/line/callback`;
    console.log('使用するredirect_uri (callback):', redirectUri);

    // Step 1: アクセストークンとIDトークンを取得
    const tokenResponse = await fetch('https://api.line.me/oauth2/v2.1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
        client_id: process.env.LINE_CHANNEL_ID!,
        client_secret: process.env.LINE_CHANNEL_SECRET!,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('LINEトークン取得エラー:', errorData);
      return NextResponse.redirect(new URL('/auth?error=token_error', request.url));
    }

    const tokenData = await tokenResponse.json();
    console.log('LINEトークン取得成功');
    
    // Step 2: IDトークンからユーザー情報を抽出
    const idToken = tokenData.id_token;
    if (!idToken) {
      console.error('IDトークンが取得できませんでした');
      return NextResponse.redirect(new URL('/auth?error=no_id_token', request.url));
    }

    // IDトークンをデコード（簡易版 - 本番環境では検証も必要）
    const base64Payload = idToken.split('.')[1];
    const decodedPayload = JSON.parse(Buffer.from(base64Payload, 'base64').toString());
    
    const lineUserInfo = {
      lineUserId: decodedPayload.sub,
      displayName: decodedPayload.name || 'LINEユーザー',
      pictureUrl: decodedPayload.picture || null,
      email: decodedPayload.email || null,
    };

    console.log('LINEユーザー情報:', lineUserInfo);

    // Step 3: Supabaseで認証 - カスタムJWT方式
    const customPayload = {
      sub: lineUserInfo.lineUserId,
      email: lineUserInfo.email || `${lineUserInfo.lineUserId}@line.local`,
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
      role: 'authenticated',
    };

    // Step 4: 既存ユーザーの確認（LINE_USER_IDとメールアドレス両方で確認）
    const { data: existingProfile, error: fetchError } = await supabase
      .from('profiles')
      .select('id')
      .eq('line_user_id', lineUserInfo.lineUserId)
      .single();

    let supabaseUserId: string;

    if (existingProfile) {
      // 既存LINEユーザーの場合
      console.log('既存LINEユーザーを検出:', existingProfile.id);
      supabaseUserId = existingProfile.id;
    } else {
      // 新規ユーザーかメールアドレス重複の場合
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: customPayload.email,
        email_confirm: true,
        app_metadata: customPayload.app_metadata,
        user_metadata: customPayload.user_metadata,
      });

      if (authError) {
        if (authError.message.includes('already been registered') || authError.code === 'email_exists') {
          // メールアドレス重複の場合、既存ユーザーを取得
          console.log('既存メールアドレスを検出、既存ユーザーを検索');
          
          // auth.usersテーブルから該当メールアドレスのユーザーを検索
          const { data: existingUsers } = await supabase.auth.admin.listUsers();
          const existingUser = existingUsers.users.find(user => user.email === customPayload.email);
          
          if (existingUser) {
            console.log('既存ユーザーにLINE情報を追加:', existingUser.id);
            supabaseUserId = existingUser.id;
          } else {
            console.error('既存ユーザーが見つかりませんでした');
            return NextResponse.redirect(new URL('/auth?error=existing_user_not_found', request.url));
          }
        } else {
          console.error('Supabase認証エラー:', authError);
          return NextResponse.redirect(new URL('/auth?error=supabase_auth_error', request.url));
        }
      } else {
        if (!authData?.user?.id) {
          console.error('SupabaseユーザーIDが取得できませんでした');
          return NextResponse.redirect(new URL('/auth?error=no_supabase_user', request.url));
        }
        supabaseUserId = authData.user.id;
        console.log('新規Supabaseユーザー作成:', supabaseUserId);
      }
    }

    // Step 5: profilesテーブルにユーザー情報を保存/更新（updated_atを除外）
    const profileData = {
      id: supabaseUserId,
      name: lineUserInfo.displayName,
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
        return NextResponse.redirect(new URL('/auth?error=profile_save_error', request.url));
      }
    }

    console.log('LINEログイン完了 - ユーザーID:', supabaseUserId);

    // Step 6: セッション情報を含むリダイレクト
    const redirectUrl = new URL('/dashboard', request.url);
    redirectUrl.searchParams.set('line_login', 'success');
    redirectUrl.searchParams.set('user_id', supabaseUserId);
    redirectUrl.searchParams.set('display_name', encodeURIComponent(lineUserInfo.displayName));

    return NextResponse.redirect(redirectUrl);

  } catch (error) {
    console.error('LINEログイン処理エラー:', error);
    return NextResponse.redirect(new URL('/auth?error=unexpected_error', request.url));
  }
} 