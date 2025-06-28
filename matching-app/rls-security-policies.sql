-- ================================
-- マッチングアプリ用RLSポリシー
-- ================================

-- RLSを有効化
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- ================================
-- 1. profiles テーブルのポリシー
-- ================================

-- 読み取り: すべての認証済みユーザーがプロフィールを閲覧可能
CREATE POLICY "profiles_select_policy" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- 作成: 自分のプロフィールのみ作成可能
CREATE POLICY "profiles_insert_policy" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- 更新: 自分のプロフィールのみ更新可能
CREATE POLICY "profiles_update_policy" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- 削除: 自分のプロフィールのみ削除可能
CREATE POLICY "profiles_delete_policy" 
ON profiles FOR DELETE 
TO authenticated 
USING (auth.uid() = id);

-- ================================
-- 2. invites テーブルのポリシー
-- ================================

-- 読み取り: すべての認証済みユーザーが招待情報を閲覧可能（招待リンク参加のため）
CREATE POLICY "invites_select_policy" 
ON invites FOR SELECT 
TO authenticated 
USING (true);

-- 作成: 自分のuser_idでのみ招待を作成可能
CREATE POLICY "invites_insert_policy" 
ON invites FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 更新: 自分が作成した招待のみ更新可能
CREATE POLICY "invites_update_policy" 
ON invites FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 削除: 自分が作成した招待のみ削除可能
CREATE POLICY "invites_delete_policy" 
ON invites FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- ================================
-- 3. matches テーブルのポリシー（最重要）
-- ================================

-- 読み取り: 同じグループの参加者のみアクセス可能
CREATE POLICY "matches_select_policy" 
ON matches FOR SELECT 
TO authenticated 
USING (
  -- 自分のマッチレコード、または自分が参加しているグループのマッチレコード
  auth.uid() = user_id 
  OR 
  invite_id IN (
    SELECT DISTINCT invite_id 
    FROM matches 
    WHERE user_id = auth.uid()
  )
);

-- 作成: 自分のuser_idでのみマッチを作成可能
CREATE POLICY "matches_insert_policy" 
ON matches FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 更新: 特殊なマッチング更新ロジック
CREATE POLICY "matches_update_policy" 
ON matches FOR UPDATE 
TO authenticated 
USING (
  -- 自分のマッチレコード
  auth.uid() = user_id
  OR
  -- マッチング成立時の相手のレコード更新（相互マッチングの場合のみ）
  (
    EXISTS (
      SELECT 1 FROM matches m2 
      WHERE m2.user_id = auth.uid() 
      AND m2.invite_id = matches.invite_id 
      AND m2.target_name = (
        SELECT name FROM profiles WHERE id = matches.user_id
      )
      AND m2.matched = false
    )
  )
)
WITH CHECK (
  -- 更新後も同じ条件を満たす必要がある
  auth.uid() = user_id
  OR
  EXISTS (
    SELECT 1 FROM matches m2 
    WHERE m2.user_id = auth.uid() 
    AND m2.invite_id = matches.invite_id 
    AND m2.target_name = (
      SELECT name FROM profiles WHERE id = matches.user_id
    )
  )
);

-- 削除: 自分が作成したマッチのみ削除可能
CREATE POLICY "matches_delete_policy" 
ON matches FOR DELETE 
TO authenticated 
USING (auth.uid() = user_id);

-- ================================
-- 4. 追加のセキュリティ設定
-- ================================

-- 匿名ユーザーからのアクセスを完全に遮断
REVOKE ALL ON profiles FROM anon;
REVOKE ALL ON invites FROM anon;
REVOKE ALL ON matches FROM anon;

-- パブリックアクセスを制限
REVOKE ALL ON profiles FROM public;
REVOKE ALL ON invites FROM public;
REVOKE ALL ON matches FROM public;

-- ================================
-- 5. グループ隔離を強化する関数
-- ================================

-- グループメンバーチェック関数
CREATE OR REPLACE FUNCTION is_group_member(target_invite_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM matches 
    WHERE user_id = auth.uid() 
    AND invite_id = target_invite_id
  );
END;
$$;

-- ================================
-- 6. ポリシーの検証用クエリ
-- ================================

-- 自分のプロフィールのみ更新可能か確認
-- SELECT * FROM profiles WHERE id = auth.uid();

-- 自分の招待のみ表示されるか確認
-- SELECT * FROM invites WHERE user_id = auth.uid();

-- 自分が参加しているグループのマッチのみ表示されるか確認
-- SELECT * FROM matches WHERE invite_id IN (
--   SELECT DISTINCT invite_id FROM matches WHERE user_id = auth.uid()
-- ); 