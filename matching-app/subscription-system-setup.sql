-- ================================
-- 課金システム用データベース設定
-- いいね制限＋サブスクリプション管理
-- ================================

-- ================================
-- STEP 1: 新しいテーブル作成
-- ================================

-- 1. ユーザーサブスクリプション管理
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  plan_type VARCHAR(20) NOT NULL DEFAULT 'free', -- 'free', 'premium'
  status VARCHAR(20) NOT NULL DEFAULT 'active',  -- 'active', 'canceled', 'expired'
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id) -- 1ユーザー1サブスクリプション
);

-- 2. いいね使用履歴（アカウント単位・月単位）
CREATE TABLE IF NOT EXISTS like_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  month_year VARCHAR(7) NOT NULL, -- '2024-01' 形式
  used_count INTEGER NOT NULL DEFAULT 0,
  purchased_count INTEGER NOT NULL DEFAULT 0, -- 購入した追加いいね数
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, month_year)
);

-- 3. 購入履歴
CREATE TABLE IF NOT EXISTS purchase_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  purchase_type VARCHAR(20) NOT NULL, -- 'subscription', 'single_like'
  amount INTEGER NOT NULL, -- 円単位
  quantity INTEGER DEFAULT 1, -- いいね購入の場合の個数
  stripe_payment_intent_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ================================
-- STEP 2: 既存テーブルの修正
-- ================================

-- matchesテーブルにいいね消費フラグを追加
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS consumed_like BOOLEAN DEFAULT true;

-- ================================
-- STEP 3: インデックス作成
-- ================================

-- パフォーマンス最適化用インデックス
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_like_usage_user_month ON like_usage(user_id, month_year);
CREATE INDEX IF NOT EXISTS idx_purchase_history_user_id ON purchase_history(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_consumed ON matches(user_id, consumed_like);

-- ================================
-- STEP 4: データベース関数作成
-- ================================

-- 4-1. ユーザーのプラン取得
CREATE OR REPLACE FUNCTION get_user_plan(p_user_id UUID)
RETURNS TABLE(
  plan_type VARCHAR(20),
  is_premium BOOLEAN,
  period_end TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(us.plan_type, 'free') as plan_type,
    CASE 
      WHEN us.plan_type = 'premium' AND us.status = 'active' 
        AND (us.current_period_end IS NULL OR us.current_period_end > NOW())
      THEN true 
      ELSE false 
    END as is_premium,
    us.current_period_end as period_end
  FROM user_subscriptions us
  WHERE us.user_id = p_user_id
  UNION ALL
  SELECT 'free'::VARCHAR(20), false, NULL::TIMESTAMP WITH TIME ZONE
  WHERE NOT EXISTS (SELECT 1 FROM user_subscriptions WHERE user_id = p_user_id);
END;
$$;

-- 4-2. 今月のいいね使用状況取得
CREATE OR REPLACE FUNCTION get_like_usage_current_month(p_user_id UUID)
RETURNS TABLE(
  used_count INTEGER,
  purchased_count INTEGER,
  total_available INTEGER
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  current_month VARCHAR(7);
  user_plan RECORD;
BEGIN
  -- 現在の月を取得（'2024-01'形式）
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- ユーザーのプラン情報を取得
  SELECT * INTO user_plan FROM get_user_plan(p_user_id) LIMIT 1;
  
  -- 使用履歴を取得
  RETURN QUERY
  SELECT 
    COALESCE(lu.used_count, 0) as used_count,
    COALESCE(lu.purchased_count, 0) as purchased_count,
    CASE 
      WHEN user_plan.is_premium THEN 999999 -- プレミアムは実質無制限
      ELSE 1 + COALESCE(lu.purchased_count, 0) -- 無料プランは1回＋購入分
    END as total_available
  FROM (
    SELECT 
      lu.used_count,
      lu.purchased_count
    FROM like_usage lu
    WHERE lu.user_id = p_user_id AND lu.month_year = current_month
    UNION ALL
    SELECT 0, 0
    WHERE NOT EXISTS (
      SELECT 1 FROM like_usage 
      WHERE user_id = p_user_id AND month_year = current_month
    )
  ) lu
  LIMIT 1;
END;
$$;

-- 4-3. いいね制限チェック
CREATE OR REPLACE FUNCTION check_like_limit(p_user_id UUID)
RETURNS TABLE(
  allowed BOOLEAN,
  remaining_likes INTEGER,
  message TEXT
)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  usage_info RECORD;
BEGIN
  -- 現在の使用状況を取得
  SELECT * INTO usage_info FROM get_like_usage_current_month(p_user_id) LIMIT 1;
  
  -- 制限チェック
  IF usage_info.used_count >= usage_info.total_available THEN
    RETURN QUERY
    SELECT 
      false as allowed,
      0 as remaining_likes,
      '今月のいいね制限に達しました' as message;
  ELSE
    RETURN QUERY
    SELECT 
      true as allowed,
      (usage_info.total_available - usage_info.used_count) as remaining_likes,
      'いいね可能です' as message;
  END IF;
END;
$$;

-- 4-4. いいね消費処理
CREATE OR REPLACE FUNCTION consume_like(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  current_month VARCHAR(7);
  limit_check RECORD;
BEGIN
  -- 現在の月を取得
  current_month := TO_CHAR(NOW(), 'YYYY-MM');
  
  -- 制限チェック
  SELECT * INTO limit_check FROM check_like_limit(p_user_id) LIMIT 1;
  
  IF NOT limit_check.allowed THEN
    RETURN false;
  END IF;
  
  -- 使用履歴を更新またはINSERT
  INSERT INTO like_usage (user_id, month_year, used_count)
  VALUES (p_user_id, current_month, 1)
  ON CONFLICT (user_id, month_year)
  DO UPDATE SET 
    used_count = like_usage.used_count + 1,
    updated_at = NOW();
  
  RETURN true;
END;
$$;

-- ================================
-- STEP 5: 初期データ設定
-- ================================

-- 既存ユーザーにデフォルトのサブスクリプション情報を作成
INSERT INTO user_subscriptions (user_id, plan_type, status)
SELECT 
  p.id,
  'free',
  'active'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_subscriptions us WHERE us.user_id = p.id
);

-- ================================
-- STEP 6: RLSポリシー設定
-- ================================

-- user_subscriptions テーブルのRLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_subscriptions_own_select" 
ON user_subscriptions FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "user_subscriptions_own_update" 
ON user_subscriptions FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- like_usage テーブルのRLS
ALTER TABLE like_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "like_usage_own_select" 
ON like_usage FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

CREATE POLICY "like_usage_own_insert" 
ON like_usage FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "like_usage_own_update" 
ON like_usage FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- purchase_history テーブルのRLS
ALTER TABLE purchase_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_history_own_select" 
ON purchase_history FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- ================================
-- STEP 7: 動作確認用クエリ
-- ================================

-- 動作確認用（実行は任意）
/*
-- ユーザーのプラン確認
SELECT * FROM get_user_plan('ユーザーID');

-- 今月のいいね使用状況確認
SELECT * FROM get_like_usage_current_month('ユーザーID');

-- いいね制限チェック
SELECT * FROM check_like_limit('ユーザーID');

-- いいね消費テスト
SELECT consume_like('ユーザーID');
*/

-- ================================
-- 完了メッセージ
-- ================================

DO $$
BEGIN
  RAISE NOTICE '🎉 課金システムのデータベース設定が完了しました！';
  RAISE NOTICE '📊 新しいテーブル: user_subscriptions, like_usage, purchase_history';
  RAISE NOTICE '🔧 新しい関数: get_user_plan, get_like_usage_current_month, check_like_limit, consume_like';
  RAISE NOTICE '🔒 RLSポリシーが設定されました';
END $$; 