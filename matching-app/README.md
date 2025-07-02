# 旧友再会マッチングアプリ

LINEログインとメール認証の両方に対応した旧友再会マッチングアプリです。

## 🎯 主な機能

- **LINEログイン**: 簡単・安全なLINE認証
- **メール認証**: 従来のメール＋パスワード認証
- **招待リンク生成**: グループごとの招待リンク作成
- **マッチング機能**: 参加者同士のマッチング

## 🚀 セットアップ手順

### 1. 依存関係のインストール

```bash
npm install
```

### 2. 環境変数の設定

`matching-app/.env.local`ファイルを作成し、以下の環境変数を設定してください：

```env
# Supabase設定
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# LINE Login設定
LINE_CHANNEL_ID=your_line_channel_id
LINE_CHANNEL_SECRET=your_line_channel_secret

# アプリケーション設定
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

### 3. データベーススキーマの更新

SupabaseのSQL Editorで以下のファイルを実行してください：

```bash
# 基本的なRLSポリシー
matching-app/rls-security-policies.sql

# LINEログイン対応
matching-app/line-login-migration.sql
```

### 4. LINE Developersコンソールの設定

1. [LINE Developers](https://developers.line.biz/)にアクセス
2. 新しいチャンネルを作成（LINE Login）
3. Callback URLを設定: `http://localhost:3000/api/auth/line/callback`
4. Channel IDとChannel Secretを`.env.local`に設定

### 5. 開発サーバーの起動

```bash
npm run dev
```

## 📁 プロジェクト構造

```
matching-app/
├── src/
│   ├── app/
│   │   ├── api/auth/line/       # LINE認証APIルート
│   │   ├── auth/               # 認証ページ
│   │   └── dashboard/          # ダッシュボード
│   ├── components/
│   │   └── LineLoginButton.tsx # LINEログインボタン
│   └── lib/
│       ├── supabase.ts         # Supabaseクライアント
│       └── lineAuth.ts         # LINE認証ヘルパー
├── line-login-migration.sql    # データベーススキーマ更新
└── rls-security-policies.sql   # 基本RLSポリシー
```

## 🔧 技術スタック

- **フロントエンド**: Next.js 15.3.2, React 19, TypeScript
- **スタイリング**: Tailwind CSS
- **バックエンド**: Supabase (認証・データベース)
- **認証**: LINE Login + Supabase Auth

## 🔐 セキュリティ機能

- Row Level Security (RLS) による適切なアクセス制御
- CSRF攻撃防止 (state, nonce)
- JWT トークン検証
- 適切な環境変数管理

## 🚀 本番環境デプロイ

1. `NEXT_PUBLIC_BASE_URL`を本番URLに変更
2. LINE DevelopersのCallback URLを本番URLに更新
3. Supabaseの本番環境設定を適用

---

**開発者**: プログラミング学習中 🌱
**更新日**: 2024年12月28日
