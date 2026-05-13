# ポートフォリオ管理アプリ

PythonとFlaskで作るシンプルなポートフォリオ管理Webアプリです。
証券会社ごとに銘柄を管理し、yfinance経由で現在値を取得して損益を表示します。

## 機能

- 証券会社の追加・編集・削除
- 銘柄ごとに「銘柄コード・銘柄名・取得価格・保有株数」を登録／編集／削除
- 日本株（`.T` 自動付与）と米国株の両対応
- 株価は5分ごとに自動更新（手動更新ボタンもあり）
- 銘柄ごと・証券会社ごと・全体合計で損益金額と損益率を表示
- 含み益は緑、含み損は赤で色分け
- データはブラウザの `localStorage` に保存（サーバー側に保存しません）
- 米ドル/円レートを画面上で変更可能
- JSON でエクスポート／インポートが可能

## ローカル起動

```bash
pip install -r requirements.txt
python app.py
```

→ http://localhost:5000 を開きます。

## Render へのデプロイ

1. このディレクトリを GitHub のリポジトリに push します。
2. Render のダッシュボードから「New + → Web Service」でリポジトリを選択します。
3. 設定はそのままで OK です。`requirements.txt` と `Procfile` が自動認識されます。
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn app:app --bind 0.0.0.0:$PORT --workers 2 --timeout 120`
4. デプロイ完了後、表示された URL にアクセスします。

## 構成

```
portfolio-app/
├── app.py              # Flaskサーバー（yfinanceで価格取得）
├── templates/
│   └── index.html      # 画面テンプレート
├── static/
│   ├── style.css       # スタイル
│   └── app.js          # フロントエンドロジック（localStorage管理）
├── requirements.txt
├── Procfile
├── runtime.txt
└── README.md
```

## 注意点

- yfinance は Yahoo Finance の非公式インターフェースのため、長時間使うと一時的に取得失敗する場合があります。
- 米国株は USD 建てで取得した株価を、画面上の為替レート（既定 150 円/USD）で円換算しています。
- データはブラウザに保存されるため、別端末・別ブラウザでは引き継がれません。バックアップにはエクスポート機能を利用してください。
