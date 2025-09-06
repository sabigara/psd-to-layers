import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import PSD from "psd";

/**
 * PSDファイルからすべてのレイヤーを抽出してPNG形式で保存する
 */
class PSDLayerExtractor {
	constructor(psdPath, outputDir = "./output") {
		this.psdPath = psdPath;
		this.outputDir = outputDir;
		this.layerCount = 0;
	}

	/**
	 * メイン処理
	 */
	async extract() {
		try {
			console.log(`📁 PSDファイルを読み込み中: ${this.psdPath}`);

			// PSDファイルの存在確認
			if (!existsSync(this.psdPath)) {
				throw new Error(`PSDファイルが見つかりません: ${this.psdPath}`);
			}

			// 出力ディレクトリの作成
			await fs.mkdir(this.outputDir, { recursive: true });
			console.log(`📂 出力ディレクトリを作成: ${this.outputDir}`);

			// PSDファイルを開く
			const psd = PSD.fromFile(this.psdPath);
			await psd.parse();

			console.log("📊 PSDファイル情報:");
			console.log(`   サイズ: ${psd.tree().width} x ${psd.tree().height}px`);
			console.log(`   カラーモード: ${psd.header.colorMode}`);

			// レイヤーを再帰的に処理
			await this.processNode(psd.tree(), "");

			console.log(`✅ 完了! ${this.layerCount}個のレイヤーを書き出しました。`);
		} catch (error) {
			console.error("❌ エラーが発生しました:", error.message);
			throw error;
		}
	}

	/**
	 * ノード（レイヤーまたはグループ）を再帰的に処理
	 */
	async processNode(node, parentPath = "") {
		if (node.isRoot()) {
			// ルートノードの場合、子ノードを処理
			console.log(
				`📁 ルートノードを処理中 (子ノード数: ${node.children().length})`,
			);
			for (const child of node.children()) {
				await this.processNode(child, parentPath);
			}
		} else if (node.isGroup()) {
			// グループの場合
			const groupName = this.sanitizeFilename(node.name);
			const groupPath = parentPath ? `${parentPath}_${groupName}` : groupName;

			console.log(
				`📁 グループを処理中: ${node.name} (子ノード数: ${node.children().length})`,
			);

			// グループ内の子ノードを処理
			for (const child of node.children()) {
				await this.processNode(child, groupPath);
			}
		} else if (node.isLayer()) {
			// レイヤーの場合
			console.log(`🏷️  レイヤー情報: ${node.name}`);
			console.log(`     可視性: ${node.visible}`);
			console.log(`     位置: x=${node.left}, y=${node.top}`);
			console.log(`     サイズ: ${node.width}x${node.height}px`);

			await this.exportLayer(node, parentPath);
		}
	}

	/**
	 * 個別のレイヤーをPNGとして書き出し
	 */
	async exportLayer(layer, parentPath) {
		try {
			// 非表示レイヤーをスキップ（オプション）
			if (!layer.visible) {
				console.log(`⏭️  非表示レイヤーをスキップ: ${layer.name}`);
				return;
			}

			const layerName = this.sanitizeFilename(layer.name);
			const fileName = parentPath ? `${parentPath}_${layerName}` : layerName;
			const outputPath = path.join(this.outputDir, `${fileName}.png`);

			console.log(`🖼️  レイヤーを書き出し中: ${layer.name}`);

			try {
				// レイヤーの画像データを取得
				const png = layer.toPng();

				if (png) {
					if (typeof png.pack === "function") {
						// pngがストリームの場合
						const buffer = await this.streamToBuffer(png.pack());
						if (buffer && buffer.length > 0) {
							await fs.writeFile(outputPath, buffer);
							this.layerCount++;
							console.log(
								`   ✅ 保存完了: ${outputPath} (${buffer.length} bytes)`,
							);
						} else {
							console.log(`   ⚠️  空の画像データ: ${layer.name}`);
						}
					} else if (Buffer.isBuffer(png)) {
						// pngが既にBufferの場合
						await fs.writeFile(outputPath, png);
						this.layerCount++;
						console.log(`   ✅ 保存完了: ${outputPath} (${png.length} bytes)`);
					} else if (png.pipe) {
						// pngがストリームの場合
						const buffer = await this.streamToBuffer(png);
						if (buffer && buffer.length > 0) {
							await fs.writeFile(outputPath, buffer);
							this.layerCount++;
							console.log(
								`   ✅ 保存完了: ${outputPath} (${buffer.length} bytes)`,
							);
						} else {
							console.log(`   ⚠️  空の画像データ: ${layer.name}`);
						}
					} else {
						console.log(
							`   ⚠️  未対応の画像データ形式: ${layer.name} (${typeof png})`,
						);
					}
				} else {
					console.log(`   ⚠️  画像データが取得できませんでした: ${layer.name}`);
				}
			} catch (pngError) {
				console.log(`   ⚠️  PNG変換エラー: ${layer.name} - ${pngError.message}`);

				// 代替方法: saveAsPngメソッドを試す
				try {
					if (typeof layer.saveAsPng === "function") {
						await layer.saveAsPng(outputPath);
						this.layerCount++;
						console.log(`   ✅ 代替方法で保存完了: ${outputPath}`);
					}
				} catch (altError) {
					console.log(
						`   ❌ 代替方法も失敗: ${layer.name} - ${altError.message}`,
					);
				}
			}
		} catch (error) {
			console.error(
				`   ❌ レイヤーの書き出しに失敗: ${layer.name}`,
				error.message,
			);
		}
	}

	/**
	 * StreamをBufferに変換
	 */
	async streamToBuffer(stream) {
		return new Promise((resolve, reject) => {
			const chunks = [];

			stream.on("data", (chunk) => {
				chunks.push(chunk);
			});

			stream.on("end", () => {
				resolve(Buffer.concat(chunks));
			});

			stream.on("error", (error) => {
				reject(error);
			});
		});
	}

	/**
	 * ファイル名に使用できない文字を除去・置換
	 */
	sanitizeFilename(filename) {
		return filename
			.replace(/[<>:"/\\|?*]/g, "_") // 無効な文字を_に置換
			.replace(/\s+/g, "_") // スペースを_に置換
			.replace(/_{2,}/g, "_") // 連続する_を1つに
			.replace(/^_|_$/g, ""); // 先頭と末尾の_を除去
	}
}

/**
 * コマンドライン引数の処理
 */
function parseArguments() {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error(`
使用方法: node index.js <PSDファイルパス> [出力ディレクトリ]

例:
  node index.js sample.psd
  node index.js sample.psd ./extracted_layers
  npm start sample.psd
`);
		process.exit(1);
	}

	const psdPath = args[0];
	const outputDir = args[1] || "./output";

	return { psdPath, outputDir };
}

/**
 * メイン実行部分
 */
async function main() {
	try {
		const { psdPath, outputDir } = parseArguments();

		console.log("🚀 PSD Layer Extractor を開始...\n");

		const extractor = new PSDLayerExtractor(psdPath, outputDir);
		await extractor.extract();

		console.log("\n🎉 すべての処理が完了しました！");
	} catch (error) {
		console.error("\n💥 処理中にエラーが発生しました:", error.message);
		process.exit(1);
	}
}

// スクリプトが直接実行された場合のみmain関数を実行
if (process.argv[1] === new URL(import.meta.url).pathname) {
	main();
}

export { PSDLayerExtractor };
