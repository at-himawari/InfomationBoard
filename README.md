# Sub Display HUD

サブディスプレイに置くためのElectron HUDです。

## 起動

```bash
npm install
npm run dev
```

サブディスプレイに自動配置し、フルスクリーンで起動する場合:

```bash
HUD_FULLSCREEN=1 npm run dev
```

`F11` または `control + command + F`、画面のダブルクリックでフルスクリーンを切り替えられます。

## 実行ファイル化

macOSアプリとして固める場合:

```bash
npm run package
```

作成先:

```text
dist/mac/Sub Display HUD.app
```

配布用DMGを作る場合:

```bash
npm run dist
```

## 機能

- 左側のNOWパネルに時刻、日付、マーケットニュース、トップニュース、地震ウォッチを表示
- NHK RSSのニュースを1件ずつ自動送りで表示
- USD/JPY、EUR/JPY、日経平均、S&P 500、Apple、Teslaの値動き表示。10秒ごとに更新
- P2P地震情報APIの直近地震表示
- Open-Meteoの天気予報表示。10分ごとに更新

## 天気の場所

デフォルトは札幌です。場所を変える場合は緯度・経度・表示名を指定してください。

```bash
HUD_WEATHER_CITY=大阪 HUD_WEATHER_LAT=34.6937 HUD_WEATHER_LON=135.5023 npm run dev
```

画面キャプチャ要約は現在使っていないため、macOSの画面収録権限は不要です。
