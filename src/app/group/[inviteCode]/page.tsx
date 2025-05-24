'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function GroupPage() {
  // useParamsを使ってパラメータを取得
  const params = useParams();
  const inviteCode = params.inviteCode as string;
  
  const [user, setUser] = useState<any>(null);
  const [inviteData, setInviteData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [targetName, setTargetName] = useState('');
  const [myMatches, setMyMatches] = useState<any[]>([]);
  const [successMessage, setSuccessMessage] = useState('');
  
  const router = useRouter();

  // ユーザー情報とグループ情報を取得
  useEffect(() => {
    async function fetchData() {
      try {
        // ユーザーがログイン済みかチェック
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          router.push(`/invite/${inviteCode}`);
          return;
        }
        
        setUser(session.user);
        
        // 招待情報を取得
        const { data: inviteData, error: inviteError } = await supabase
          .from('invites')
          .select('*')
          .eq('invite_code', inviteCode)
          .single();
        
        if (inviteError) {
          setError('招待リンクが無効です');
          setLoading(false);
          return;
        }
        
        setInviteData(inviteData);
        
        // このグループの自分のマッチング情報を取得
        await fetchMyMatches(session.user.id, inviteData.id);
        
        setLoading(false);
      } catch (err) {
        console.error('エラー:', err);
        setError('エラーが発生しました');
        setLoading(false);
      }
    }
    
    fetchData();
  }, [inviteCode, router]);
  
  // このグループの自分のマッチング情報を取得
  async function fetchMyMatches(userId: string, inviteId: string) {
    try {
      console.log('=== fetchMyMatches開始 ===');
      console.log('userId:', userId);
      console.log('inviteId:', inviteId);
      
      // まずマッチデータを取得
      const { data: matchesData, error: matchesError } = await supabase
        .from('matches')
        .select('*')
        .eq('user_id', userId)
        .eq('invite_id', inviteId);
      
      if (matchesError) {
        console.error('マッチング情報の取得エラー（詳細）:');
        console.error('エラーコード:', matchesError.code);
        console.error('エラーメッセージ:', matchesError.message);
        console.error('エラー詳細:', matchesError.details);
        console.error('エラーヒント:', matchesError.hint);
        console.error('完全なエラーオブジェクト:', JSON.stringify(matchesError, null, 2));
        throw matchesError;
      }
      
      console.log('取得したマッチデータ:', matchesData);
      
      // マッチデータがある場合、関連するプロフィール情報を取得
      if (matchesData && matchesData.length > 0) {
        // ユニークなユーザーIDを収集
        const userIds = [...new Set(matchesData.map(m => m.user_id))];
        console.log('プロフィール取得対象のユーザーID:', userIds);
        
        // プロフィール情報を取得
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('id, name, email')
          .in('id', userIds);
        
        if (profilesError) {
          console.error('プロフィール情報の取得エラー:');
          console.error('エラーコード:', profilesError.code);
          console.error('エラーメッセージ:', profilesError.message);
          console.error('完全なエラーオブジェクト:', JSON.stringify(profilesError, null, 2));
        }
        
        console.log('取得したプロフィールデータ:', profilesData);
        
        // マッチデータにプロフィール情報を結合
        const enrichedMatches = matchesData.map(match => {
          const profile = profilesData?.find(p => p.id === match.user_id);
          return {
            ...match,
            profile: profile || null
          };
        });
        
        setMyMatches(enrichedMatches);
      } else {
        setMyMatches([]);
      }
    } catch (err) {
      console.error('マッチング情報の取得エラー:');
      console.error('エラータイプ:', typeof err);
      console.error('エラー内容:', err);
      if (err && typeof err === 'object') {
        console.error('エラーの文字列化:', JSON.stringify(err, null, 2));
      }
      // エラーでもアプリを続行できるように空配列をセット
      setMyMatches([]);
    }
  }
  
  // 会いたい人を登録
  async function handleAddTarget() {
    if (!targetName.trim()) {
      alert('名前を入力してください');
      return;
    }
    
    try {
      setSuccessMessage('');
      
      // 既に同じ名前で登録していないかチェック（このグループ内で）
      const existingMatch = myMatches.find(
        match => match.target_name.toLowerCase() === targetName.toLowerCase()
      );
      
      if (existingMatch) {
        alert('すでに同じ名前で登録されています');
        return;
      }
      
      // 会いたい人を登録
      const { data, error } = await supabase
        .from('matches')
        .insert([
          {
            user_id: user.id,
            target_name: targetName,
            matched: false,
            notified: false,
            invite_id: inviteData.id
          }
        ])
        .select('*');  // 簡略化: 外部キー参照を削除
      
      if (error) {
        console.error('登録エラー（詳細）:', error);
        throw error;
      }
      
      // 相手も自分を会いたいと思っているかチェック
      await checkForMatch(targetName);
      
      // マッチング情報を再取得
      await fetchMyMatches(user.id, inviteData.id);
      
      setTargetName('');
      setSuccessMessage('会いたい人を登録しました！');
      
      // 3秒後にメッセージを消す
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (err) {
      console.error('登録エラー:', err);
      alert('登録に失敗しました');
    }
  }
  
  // マッチングをチェック（同じグループ内でのみ）
  async function checkForMatch(targetName: string) {
    try {
      // 自分のプロフィール情報を取得
      const { data: myProfile, error: profileError } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('id', user.id)
        .single();
      
      if (profileError) throw profileError;
      
      const myName = myProfile.name || myProfile.email?.split('@')[0] || 'unknown';
      console.log('=== グループ内限定マッチングチェック開始 ===');
      console.log('自分の名前:', myName);
      console.log('登録した相手の名前:', targetName);
      console.log('グループID:', inviteData.id);
      
      // ✅ 修正: 同じグループの参加者のみから検索
      // 1. 同じinvite_idを持つmatchesからuser_idを取得（グループ参加者）
      const { data: groupMembers, error: groupMembersError } = await supabase
        .from('matches')
        .select('user_id')
        .eq('invite_id', inviteData.id);
      
      if (groupMembersError) throw groupMembersError;
      
      // ユニークなuser_idを取得
      const memberUserIds = [...new Set(groupMembers.map(m => m.user_id))];
      console.log('グループ参加者のuser_id:', memberUserIds);
      
      if (memberUserIds.length === 0) {
        console.log('グループに参加者が見つかりません');
        return;
      }
      
      // 2. グループ参加者の中から名前がマッチするユーザーを検索
      const { data: targetProfiles, error: targetProfileError } = await supabase
        .from('profiles')
        .select('id, name, email')
        .in('id', memberUserIds)  // ✅ グループ参加者に限定
        .ilike('name', targetName); // 大文字小文字を区別しない検索
      
      if (targetProfileError) throw targetProfileError;
      
      console.log('グループ内で見つかった相手のプロフィール:', targetProfiles);
      
      if (!targetProfiles || targetProfiles.length === 0) {
        console.log('グループ内に該当する相手が見つかりません');
        return;
      }
      
      // 3. 相手が自分の名前を登録しているかチェック
      for (const targetProfile of targetProfiles) {
        console.log('チェック中の相手:', targetProfile);
        
        const { data: reverseMatches, error: reverseMatchError } = await supabase
          .from('matches')
          .select('id, user_id, target_name, matched')
          .eq('user_id', targetProfile.id)
          .eq('target_name', myName)
          .eq('invite_id', inviteData.id)
          .eq('matched', false);
        
        if (reverseMatchError) throw reverseMatchError;
        
        console.log('相手からの逆マッチング:', reverseMatches);
        
        if (reverseMatches && reverseMatches.length > 0) {
          console.log('🎉 相互マッチング発見！');
          
          // 4. 両方のマッチレコードをmatched=trueに更新
          
          // 自分のマッチを更新
          const { error: myUpdateError } = await supabase
            .from('matches')
            .update({ matched: true })
            .eq('user_id', user.id)
            .eq('target_name', targetName)
            .eq('invite_id', inviteData.id)
            .eq('matched', false);  // ✅ まだマッチしていないもののみ
          
          if (myUpdateError) {
            console.error('自分のマッチ更新エラー:', myUpdateError);
            throw myUpdateError;
          }
          
          // 相手のマッチを更新
          const { error: theirUpdateError } = await supabase
            .from('matches')
            .update({ matched: true })
            .eq('id', reverseMatches[0].id);
          
          if (theirUpdateError) {
            console.error('相手のマッチ更新エラー:', theirUpdateError);
            throw theirUpdateError;
          }
          
          console.log('✅ グループ内マッチング更新完了');
          break; // 同姓同名の場合は最初のマッチのみ
        }
      }
    } catch (err) {
      console.error('マッチングチェックエラー:', err);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p>読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-md">
      <h1 className="text-2xl font-bold mb-2 text-center">
        {inviteData?.name || 'グループ'}
      </h1>
      <p className="text-center text-gray-600 mb-8">
        会いたい人を登録して、マッチングを待ちましょう
      </p>
      
      {error && (
        <div className="bg-red-100 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 text-green-700 p-4 rounded-md mb-6">
          {successMessage}
        </div>
      )}
      
      {/* 会いたい人登録フォーム */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">会いたい人を登録</h2>
        <div className="flex mb-4">
          <input
            type="text"
            value={targetName}
            onChange={(e) => setTargetName(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-l-md"
            placeholder="会いたい人の名前"
          />
          <button
            onClick={handleAddTarget}
            className="bg-blue-500 text-white px-4 py-2 rounded-r-md hover:bg-blue-600"
          >
            追加
          </button>
        </div>
        <p className="text-sm text-gray-600">
          ※相手も同様にあなたの名前を登録すると、マッチングが成立します
        </p>
      </div>
      
      {/* 登録した会いたい人リスト */}
      <div className="bg-white p-6 rounded-lg shadow-md mb-8">
        <h2 className="text-xl font-semibold mb-4">あなたが会いたい人</h2>
        {myMatches.length > 0 ? (
          <ul className="space-y-2">
            {myMatches.map(match => (
              <li 
                key={match.id} 
                className={`p-3 rounded-md ${match.matched ? 'bg-pink-100' : 'bg-gray-100'}`}
              >
                <div className="font-medium">{match.target_name}</div>
                {match.matched && (
                  <div className="text-sm text-pink-600 font-medium mt-1">
                    マッチングしました！
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">まだ登録されていません</p>
        )}
      </div>
      
      {/* マッチング結果 */}
      {myMatches.some(match => match.matched) && (
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-xl font-semibold mb-4">マッチング成立！</h2>
          <p className="mb-4">以下の人もあなたに会いたいと思っています:</p>
          <ul className="space-y-2">
            {myMatches
              .filter(match => match.matched)
              .map(match => (
                <li key={match.id} className="p-3 bg-pink-100 rounded-md">
                  <div className="font-medium">{match.target_name}</div>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
} 