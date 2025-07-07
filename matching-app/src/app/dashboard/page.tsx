'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function Dashboard() {
  const [user, setUser] = useState<any>(null);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newInviteName, setNewInviteName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState('');
  
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    async function handleLineLogin() {
      // URLパラメータからLINEログイン情報を取得
      const lineLogin = searchParams.get('line_login');
      const userId = searchParams.get('user_id');
      const email = searchParams.get('email');
      const tempPassword = searchParams.get('temp_password');
      const displayName = searchParams.get('display_name');
      const loginType = searchParams.get('login_type');

      if (lineLogin === 'success' && email && userId) {
        console.log('LINEログイン自動ログイン開始...');
        
        // displayNameを安全にデコード
        let decodedDisplayName = '';
        if (displayName) {
          try {
            decodedDisplayName = decodeURIComponent(displayName);
          } catch (decodeError) {
            console.error('displayNameのデコードエラー:', decodeError);
            decodedDisplayName = displayName || 'LINEユーザー';
          }
        }
        
        console.log('ログイン情報:', {
          email: email,
          userId: userId,
          displayName: decodedDisplayName,
          loginType: loginType
        });
        
        try {
          // 既存ユーザーでも新規ユーザーでも一時パスワードでログイン
          console.log('LINEユーザーの一時パスワードログイン（' + (loginType === 'line_existing' ? '既存' : '新規') + '）');
          
          if (!tempPassword) {
            console.error('一時パスワードが見つかりません');
            setError('ログイン情報が不足しています。');
            router.push('/auth');
            return;
          }
          
          // 一時パスワードを使ってログイン
          const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
            email: email,
            password: tempPassword,
          });

          if (signInError) {
            console.error('自動ログインエラー:', signInError);
            console.error('エラーの詳細:', {
              message: signInError.message,
              code: signInError.code,
              status: signInError.status
            });
            console.error('使用したログイン情報:', {
              email: email,
              passwordLength: tempPassword.length
            });
            setError('自動ログインに失敗しました: ' + signInError.message + ' 再度ログインしてください。');
            router.push('/auth');
            return;
          }

          console.log('自動ログイン成功');
          console.log('ログイン結果:', signInData);
          
          // URLパラメータをクリア
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('line_login');
          newUrl.searchParams.delete('user_id');
          newUrl.searchParams.delete('email');
          newUrl.searchParams.delete('temp_password');
          newUrl.searchParams.delete('display_name');
          newUrl.searchParams.delete('login_type');
          
          window.history.replaceState({}, '', newUrl.toString());
          
          // ダッシュボードデータの取得へ続く
          await fetchDashboardData();
          
        } catch (err) {
          console.error('自動ログインエラー:', err);
          setError('自動ログインに失敗しました。');
          router.push('/auth');
        }
      } else {
        console.log('通常のセッションチェック開始');
        // 通常のセッションチェック
        await fetchDashboardData();
      }
    }

    async function fetchDashboardData() {
      try {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          router.push('/auth');
          return;
        }
        
        setUser(session.user);
        
        // ユーザーの招待リストを取得
        const { data: invitesData, error: invitesError } = await supabase
          .from('invites')
          .select('*')
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });
        
        if (invitesError) {
          console.error('招待データの取得エラー:', invitesError);
        } else {
          setInvites(invitesData || []);
        }
        
        setLoading(false);
      } catch (err) {
        console.error('エラー:', err);
        setLoading(false);
      }
    }
    
    handleLineLogin();
  }, [router, searchParams]);
  
  // 新しい招待リンクを作成
  async function createInvite() {
    if (!newInviteName.trim()) {
      alert('グループ名を入力してください');
      return;
    }
    
    try {
      setIsCreating(true);
      
      // 新しい招待作成APIを使用
      const response = await fetch('/api/invites/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          groupName: newInviteName
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '招待リンクの作成に失敗しました');
      }

      const result = await response.json();
      console.log('招待作成結果:', result);
      
      // 招待リストを更新
      setInvites([result.invite, ...invites]);
      setNewInviteName('');
      
    } catch (err: any) {
      console.error('招待作成エラー:', err);
      alert(err.message || '招待リンクの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  }
  
  // 招待リンクをコピー
  function copyInviteLink(inviteCode: string) {
    const url = `${window.location.origin}/invite/${inviteCode}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('招待リンクをコピーしました！');
    });
  }
  
  // ログアウト
  async function handleLogout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('ログアウトエラー:', error);
    } else {
      router.push('/');
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-red-100 border border-red-300 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
        <button
          onClick={() => router.push('/auth')}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
        >
          ログインページに戻る
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold">ダッシュボード</h1>
        <button
          onClick={handleLogout}
          className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600"
        >
          ログアウト
        </button>
      </div>
      
      {/* 新しい招待作成 */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">新しいグループを作成</h2>
        <div className="flex mb-4">
          <input
            type="text"
            value={newInviteName}
            onChange={(e) => setNewInviteName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md"
            placeholder="グループ名（例: 大学の同期会）"
          />
          <button
            onClick={createInvite}
            disabled={isCreating}
            className="bg-blue-500 text-white px-6 py-2 rounded-r-md hover:bg-blue-600 disabled:bg-blue-300"
          >
            {isCreating ? '作成中...' : '作成'}
          </button>
        </div>
        <p className="text-sm text-gray-600">
          グループを作成すると、招待リンクが生成されます。このリンクを共有して、参加者を招待しましょう。
        </p>
      </div>
      
      {/* 招待リスト */}
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold mb-4">あなたのグループ</h2>
        {invites.length > 0 ? (
          <div className="space-y-4">
            {invites.map(invite => (
              <div key={invite.id} className="border border-gray-200 p-4 rounded-md">
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-semibold text-lg">{invite.name}</h3>
                  <span className="text-sm text-gray-500">
                    {new Date(invite.created_at).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="text-sm text-gray-600 mb-3">
                  招待コード: <code className="bg-gray-100 px-2 py-1 rounded">{invite.invite_code}</code>
                </div>
                
                <div className="flex flex-wrap gap-2 mb-3">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-sm">
                    クリック数: {invite.clicks}
                  </span>
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-sm">
                    参加者数: {invite.signups}
                  </span>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => copyInviteLink(invite.invite_code)}
                    className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
                  >
                    招待リンクをコピー
                  </button>
                  <button
                    onClick={() => router.push(`/group/${invite.invite_code}`)}
                    className="bg-green-500 text-white px-3 py-1 rounded text-sm hover:bg-green-600"
                  >
                    グループに参加
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">まだグループが作成されていません。上のフォームから新しいグループを作成してみましょう。</p>
        )}
      </div>
    </div>
  );
} 