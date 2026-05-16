# みん教ガチャ

小学館「[みんなの教育技術](https://kyoiku.sho.jp/)」の記事を，ガチャでランダムに表示する非公式アプリです。

- 🎰 レバーを引くと記事がカプセルから飛び出します
- 📚 引いた記事は「読んだ記事」に自動で残ります
- 🔄 1日1回，GitHub Actions が新着記事を自動取得して更新します
- 💰 すべて無料（GitHub Pages + GitHub Actions の無料枠で動きます）

## ファイル構成

```
みん教ガチャアプリ開発/
├── index.html                       … ガチャ画面のHTML
├── style.css                        … 見た目（ベースは「教室あそびガチャ」流用）
├── script.js                        … ガチャの動き＋記事リスト読み込み
├── articles.json                    … 記事リスト（自動更新される）
├── scripts/
│   └── fetch-articles.mjs           … RSSから記事を集めるNodeスクリプト
└── .github/workflows/
    ├── update-articles.yml          … 毎日 06:30 JST に articles.json を更新
    └── deploy-pages.yml             … main にpushされたら GitHub Pagesへデプロイ
```

## 動かしかた（ローカル確認）

ブラウザでそのまま `index.html` を開けばOKです。ただし `fetch()` でローカルファイルを読むため，
Chromeなどでは下記のように簡易サーバーを立てたほうが確実です。

```bash
# どちらかでOK
npx serve .
# または
python -m http.server 8000
```

→ `http://localhost:8000` を開く。

記事リストを手元で更新したいときは：

```bash
node scripts/fetch-articles.mjs
```

## GitHub にデプロイする手順（無料）

> 一度だけセットアップすれば，あとは GitHub が毎日勝手に更新します。

### 1. GitHub に新規リポジトリを作る

- 名前例： `minkyo-gacha`（おすすめ。短く・英数字で）
- 公開／非公開：**Public** を選ぶ（無料の GitHub Pages を使うため）
- 「Add a README」などはチェックしない（空のリポジトリでOK）

### 2. このフォルダを GitHub に上げる

PowerShell やターミナルで本フォルダに入って，下のコマンドを順に実行します。
`<あなたのGitHubユーザー名>` を自分のIDに置き換えてください。

```bash
git init -b main
git add .
git commit -m "init: みん教ガチャ"
git remote add origin https://github.com/<あなたのGitHubユーザー名>/minkyo-gacha.git
git push -u origin main
```

### 3. GitHub Pages を有効化する

1. GitHub のリポジトリページ → **Settings** → **Pages**
2. 「Build and deployment」の **Source** を **GitHub Actions** に変更
3. しばらく待つと，**Actions** タブの "Deploy to GitHub Pages" が成功します
4. もう一度 **Settings → Pages** を開くと公開URLが表示されます
   例：`https://<あなたのGitHubユーザー名>.github.io/minkyo-gacha/`

### 4. （確認用）記事更新のワークフローを手動で1回回す

1. **Actions** タブ → 左メニュー「Update articles.json」
2. 右上の **Run workflow** ボタンを押す → `main` を選択して実行
3. 1〜2分で完了。`articles.json` が更新されると自動で再デプロイされます

これで完成です。以降は **毎日 06:30（日本時間）** に自動で最新記事が取り込まれます。

## カスタマイズのヒント

| やりたいこと | 直すところ |
|---|---|
| ヘッダーのタイトル変更 | `index.html` の `🎰 みん教ガチャ` |
| 1回に集める記事数を増やす | `scripts/fetch-articles.mjs` の `MAX_PAGES` |
| 更新時刻を変える | `.github/workflows/update-articles.yml` の `cron` |
| カプセルの色 | `script.js` の `CAPSULE_COLORS` / `CAPSULE_COLORS_DARK` |
| 配色のベース（背景） | `style.css` 冒頭の `body` の linear-gradient |

## 注意

- 本アプリは「みんなの教育技術」公式のものではありません。
- 表示しているのは記事タイトルと公開URLのみで，本文はリンク先で読みます。
- RSS には全記事ではなく直近約300件が含まれます。古い記事を含めたい場合は
  `scripts/fetch-articles.mjs` の `MAX_PAGES` を増やすか，sitemap 取り込みを追加してください。
