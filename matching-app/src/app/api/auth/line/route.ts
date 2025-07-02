import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    console.log('=== LINE認証開始 ===');
    console.log('NEXT_PUBLIC_BASE_URL:', process.env.NEXT_PUBLIC_BASE_URL);
    console.log('LINE_CHANNEL_ID:', process.env.LINE_CHANNEL_ID ? '設定済み' : '未設定');
    
    // 現在のホストとポートを取得
    const host = request.headers.get('host') || 'localhost:3000';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || `${protocol}://${host}`;
    
    // LINE認証URL生成
    const lineAuthUrl = new URL('https://access.line.me/oauth2/v2.1/authorize');
    
    const redirectUri = `${baseUrl}/api/auth/line/callback`;
    console.log('使用するredirect_uri:', redirectUri);
    
    const params = {
      response_type: 'code',
      client_id: process.env.LINE_CHANNEL_ID!,
      redirect_uri: redirectUri,
      state: generateRandomState(),
      scope: 'profile openid email',
      nonce: generateRandomNonce(),
    };

    Object.entries(params).forEach(([key, value]) => {
      lineAuthUrl.searchParams.append(key, value);
    });

    console.log('LINE認証URLにリダイレクト:', lineAuthUrl.toString());
    
    return NextResponse.redirect(lineAuthUrl.toString());

  } catch (error) {
    console.error('LINE認証開始エラー:', error);
    return NextResponse.redirect(new URL('/auth?error=line_auth_start_error', request.url));
  }
}

// ランダムなstate値を生成（CSRF攻撃防止）
function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}

// ランダムなnonce値を生成（リプレイ攻撃防止）
function generateRandomNonce(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
} 