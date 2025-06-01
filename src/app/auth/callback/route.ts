import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  
  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data?.session) {
      // ユーザー情報を取得
      const userId = data.session.user.id;
      const email = data.session.user.email || '';
      const userData = data.session.user.user_metadata || {};
      
      console.log('認証成功:', { userId, email });
      
      // プロフィールが存在するか確認
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .single();
      
      // プロフィールが存在しない場合は作成
      if ((profileError || !profileData) && userId) {
        console.log('プロフィールを作成します:', userId);
        
        const name = userData.name || email?.split('@')[0] || '名無しユーザー';
        
        const { error: insertError } = await supabase
          .from('profiles')
          .insert([
            {
              id: userId,
              email: email,
              name: name
            }
          ]);
        
        if (insertError) {
          console.error('プロフィール作成エラー:', insertError);
          console.log('エラー詳細:', JSON.stringify(insertError, null, 2));
        } else {
          console.log('プロフィール作成成功');
        }
      }
    }
  }
  
  return NextResponse.redirect(new URL('/dashboard', request.url));
}