# PSD to Layers

PSD ファイルからすべてのレイヤーを抽出して PNG 形式で書き出す Node スクリプトです。

## 機能

- PSD ファイルの全レイヤーを個別の PNG ファイルとして書き出し
- グループ階層を考慮したファイル名付け
- 非表示レイヤーのスキップ（オプション）
- ファイル名の自動サニタイズ
- 詳細な進行状況表示

## 必要環境

- Node.js 14.0.0 以上
- macOS/Linux/Windows

## インストール

```bash
# 依存関係をインストール
npm install
```

## 使用方法

### 基本的な使用方法

```bash
# PSDファイルを指定して実行（outputフォルダに書き出し）
node index.js sample.psd

# または
npm start sample.psd
```

### 出力ディレクトリを指定

```bash
# カスタム出力ディレクトリを指定
node index.js sample.psd ./my_layers

# または
npm start sample.psd ./my_layers
```

## 出力結果

- 各レイヤーは個別の PNG ファイルとして書き出されます
- グループ内のレイヤーは `グループ名_レイヤー名.png` の形式で命名されます
- ファイル名に使用できない文字は自動的に `_` に置換されます

### 出力例

```txt
output/
├── background.png
├── header_logo.png
├── header_navigation.png
├── content_main_text.png
├── content_sidebar.png
└── footer_copyright.png
```

## 注意事項

- 大きな PSD ファイルの処理には時間がかかる場合があります
- 一部の複雑なレイヤー効果は正確に再現されない場合があります
- 非表示レイヤーはデフォルトでスキップされます
