# PSD to Layers

PSD ファイルからすべてのレイヤーを抽出して PNG 形式で書き出す Node スクリプトです。

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
