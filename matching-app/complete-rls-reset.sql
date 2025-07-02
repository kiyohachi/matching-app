-- ================================
-- 完全RLSリセット＋再構築
-- 全ポリシー削除→最小限再構築
-- ================================

-- ================================
-- STEP 1: 全RLSポリシーを完全削除
-- ================================

-- profilesテーブルの全ポリシー削除
DROP POLICY IF EXISTS "profiles_select_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_policy" ON profiles;
DROP POLICY IF EXISTS "LINE users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "LINE users can update their own profile" ON profiles;

-- invitesテーブルの全ポリシー削除
DROP POLICY IF EXISTS "invites_select_policy" ON invites;
DROP POLICY IF EXISTS "invites_public_select_policy" ON invites;
DROP POLICY IF EXISTS "invites_insert_policy" ON invites;
DROP POLICY IF EXISTS "invites_update_policy" ON invites;
DROP POLICY IF EXISTS "invites_delete_policy" ON invites;

-- matchesテーブルの全ポリシー削除
DROP POLICY IF EXISTS "matches_select_policy" ON matches;
DROP POLICY IF EXISTS "matches_select_simple" ON matches;
DROP POLICY IF EXISTS "matches_insert_policy" ON matches;
DROP POLICY IF EXISTS "matches_update_policy" ON matches;
DROP POLICY IF EXISTS "matches_update_simple" ON matches;
DROP POLICY IF EXISTS "matches_delete_policy" ON matches;

-- ================================
-- STEP 2: RLS一時無効化
-- ================================

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE matches DISABLE ROW LEVEL SECURITY;

-- ================================
-- STEP 3: RLS再有効化
-- ================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- ================================
-- STEP 4: 最小限ポリシー再構築
-- ================================

-- === profiles テーブル ===

-- プロフィール読み取り：全認証済みユーザー
CREATE POLICY "profiles_select" 
ON profiles FOR SELECT 
TO authenticated 
USING (true);

-- プロフィール作成：自分のIDのみ
CREATE POLICY "profiles_insert" 
ON profiles FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = id);

-- プロフィール更新：自分のプロフィールのみ
CREATE POLICY "profiles_update" 
ON profiles FOR UPDATE 
TO authenticated 
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- === invites テーブル（重要：パブリックアクセス） ===

-- 招待情報読み取り：誰でもOK（未認証ユーザー含む）
CREATE POLICY "invites_public_read" 
ON invites FOR SELECT 
TO anon, authenticated 
USING (true);

-- 招待情報作成：認証済みユーザーが自分のuser_idで
CREATE POLICY "invites_auth_insert" 
ON invites FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- 招待情報更新：自分が作成したもののみ
CREATE POLICY "invites_auth_update" 
ON invites FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- === matches テーブル（シンプル版） ===

-- マッチ情報読み取り：自分のもののみ
CREATE POLICY "matches_own_select" 
ON matches FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- マッチ情報作成：自分のuser_idでのみ
CREATE POLICY "matches_own_insert" 
ON matches FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

-- マッチ情報更新：自分のもののみ
CREATE POLICY "matches_own_update" 
ON matches FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- ================================
-- STEP 5: アクセス権限再設定
-- ================================

-- 匿名ユーザーに招待情報の読み取り権限を付与
GRANT SELECT ON invites TO anon;

-- 認証済みユーザーに基本権限を付与
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE ON invites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON matches TO authenticated;

-- ================================
-- STEP 6: 確認クエリ
-- ================================

-- 現在のポリシー状況確認
SELECT 
  '🔒 RLS確認' as check_type,
  tablename,
  CASE 
    WHEN rowsecurity = true THEN '✅ 有効'
    ELSE '❌ 無効'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'invites', 'matches')
ORDER BY tablename;

-- ポリシー一覧確認
SELECT 
  '📝 ポリシー一覧' as check_type,
  tablename,
  policyname,
  CASE 
    WHEN roles = '{anon,authenticated}' THEN '🌍 パブリック'
    WHEN roles = '{authenticated}' THEN '🔐 認証済み'
    ELSE '❓ その他'
  END as access_level,
  cmd as operation
FROM pg_policies 
WHERE tablename IN ('profiles', 'invites', 'matches')
ORDER BY tablename, cmd;

-- テーブル権限確認
SELECT 
  '👥 テーブル権限' as check_type,
  table_name,
  grantee,
  privilege_type
FROM information_schema.table_privileges 
WHERE table_name IN ('profiles', 'invites', 'matches')
  AND grantee IN ('anon', 'authenticated')
ORDER BY table_name, grantee; 