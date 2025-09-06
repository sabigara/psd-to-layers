import { existsSync } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { PSDLayerExtractor } from "./src/psd-extractor.ts";

/**
 * CLI版PSDレイヤーエクストラクタ
 */
class CLIExtractor {
	constructor(
		private psdPath: string,
		private outputDir = "./output",
	) {}

	/**
	 * ファイルからレイヤーを抽出してPNGファイルとして保存
	 */
	async extract(): Promise<void> {
		try {
			console.log(`📁 PSDファイルを読み込み中: ${this.psdPath}`);

			// PSDファイルの存在確認
			if (!existsSync(this.psdPath)) {
				throw new Error(`PSDファイルが見つかりません: ${this.psdPath}`);
			}

			// 出力ディレクトリの作成
			await fs.mkdir(this.outputDir, { recursive: true });
			console.log(`📂 出力ディレクトリを作成: ${this.outputDir}`);

			// PSDファイルをArrayBufferとして読み込み
			const fileBuffer = await fs.readFile(this.psdPath);
			// 明示的にArrayBufferを作成
			const arrayBuffer = new ArrayBuffer(fileBuffer.length);
			const view = new Uint8Array(arrayBuffer);
			view.set(fileBuffer);

			// PSDLayerExtractorを使用してレイヤーを抽出
			const extractor = new PSDLayerExtractor(
				// 進捗コールバック
				(current: number, total: number) => {
					console.log(`[${current}/${total}] 処理中...`);
				},
				// ログコールバック
				(message: string) => {
					console.log(message);
				},
			);

			// レイヤー抽出
			const layers = await extractor.extractLayers(new Uint8Array(arrayBuffer));

			// 各レイヤーをファイルとして保存
			let savedCount = 0;
			for (const layer of layers) {
				try {
					const fileName = `${layer.name}.png`;
					const outputPath = path.join(this.outputDir, fileName);
					await fs.writeFile(outputPath, layer.pngBuffer);
					savedCount++;
					console.log(
						`✅ 保存完了: ${outputPath} (${layer.pngBuffer.length} bytes)`,
					);
				} catch (error) {
					const errorMessage =
						error instanceof Error ? error.message : String(error);
					console.error(`❌ 保存失敗: ${layer.name} - ${errorMessage}`);
				}
			}

			console.log(`\\n🎉 完了! ${savedCount}個のレイヤーを保存しました。`);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : String(error);
			console.error(`💥 処理中にエラーが発生しました: ${errorMessage}`);
			throw error;
		}
	}
}

/**
 * コマンドライン引数の処理
 */
function parseArguments(): { psdPath: string; outputDir: string } {
	const args = process.argv.slice(2);

	if (args.length === 0) {
		console.error(`
使用方法: node cli.js <PSDファイルパス> [出力ディレクトリ]

例:
  node cli.js sample.psd
  node cli.js sample.psd ./extracted_layers
  npm run cli sample.psd
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
async function main(): Promise<void> {
	try {
		const { psdPath, outputDir } = parseArguments();

		console.log("🚀 PSD Layer Extractor CLI を開始...\\n");

		const extractor = new CLIExtractor(psdPath, outputDir);
		await extractor.extract();
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		console.error(`\\n💥 処理中にエラーが発生しました: ${errorMessage}`);
		process.exit(1);
	}
}

// スクリプトが直接実行された場合のみmain関数を実行
if (import.meta.url === `file://${process.argv[1]}`) {
	main();
}
