import { type Psd, readPsd } from "ag-psd";
// Node.js環境でのCanvas初期化（ag-psdが自動でcanvasライブラリを検出）
import "ag-psd/initialize-canvas";

export interface LayerData {
	name: string;
	pngBuffer: Uint8Array;
}

export type ProgressCallback = (current: number, total: number) => void;
export type LogCallback = (message: string) => void;

interface PsdLayer {
	name?: string;
	hidden?: boolean;
	canvas?: HTMLCanvasElement;
	children?: PsdLayer[];
}

export class PSDLayerExtractor {
	constructor(
		private progressCallback?: ProgressCallback,
		private logCallback?: LogCallback,
	) {}

	private log(message: string): void {
		if (this.logCallback) {
			this.logCallback(message);
		}
	}

	private updateProgress(current: number, total: number): void {
		if (this.progressCallback) {
			this.progressCallback(current, total);
		}
	}

	async extractLayers(psdBuffer: Uint8Array): Promise<LayerData[]> {
		this.log("PSDファイルを読み込み中...");

		// Uint8ArrayからArrayBufferを正しく作成
		const arrayBuffer = psdBuffer.buffer.slice(
			psdBuffer.byteOffset,
			psdBuffer.byteOffset + psdBuffer.byteLength,
		) as ArrayBuffer;
		const psd: Psd = readPsd(arrayBuffer);

		if (!psd.children) {
			this.log("レイヤーが見つかりませんでした");
			return [];
		}

		const layers = this.flattenLayers(psd.children);
		const visibleLayers = layers.filter((layer) => !layer.hidden);

		this.log(`${visibleLayers.length}個の表示可能なレイヤーを発見しました`);

		const results: LayerData[] = [];

		for (let i = 0; i < visibleLayers.length; i++) {
			const layer = visibleLayers[i];
			const layerName = layer.name || `Layer_${i + 1}`;

			this.log(`レイヤー "${layerName}" を処理中...`);
			this.updateProgress(i + 1, visibleLayers.length);

			try {
				if (layer.canvas) {
					// ag-psdはcanvas要素を提供するので、それをPNGに変換
					const canvas = layer.canvas;

					// Canvas to PNG buffer
					let pngBuffer: Uint8Array;

					if (typeof window !== "undefined") {
						// ブラウザ環境
						const blob = await new Promise<Blob>((resolve) => {
							canvas.toBlob((blob: Blob | null) => {
								if (blob) resolve(blob);
							}, "image/png");
						});

						const arrayBuffer = await blob.arrayBuffer();
						pngBuffer = new Uint8Array(arrayBuffer);
					} else {
						// Node.js環境
						// READMEによると、ag-psdのcanvasはNode.js環境でも直接toBuffer()を呼び出せる
						pngBuffer = (
							canvas as unknown as { toBuffer: (type: string) => Uint8Array }
						).toBuffer("image/png");
					}

					results.push({
						name: layerName,
						pngBuffer,
					});

					this.log(`レイヤー "${layerName}" の変換が完了しました`);
				} else {
					this.log(`レイヤー "${layerName}" にはキャンバスデータがありません`);
				}
			} catch (error) {
				this.log(
					`レイヤー "${layerName}" の処理中にエラーが発生しました: ${error}`,
				);
			}
		}

		this.log(`変換完了: ${results.length}個のレイヤーを抽出しました`);
		return results;
	}

	private flattenLayers(layers: PsdLayer[]): PsdLayer[] {
		const result: PsdLayer[] = [];

		for (const layer of layers) {
			result.push(layer);
			if (layer.children) {
				result.push(...this.flattenLayers(layer.children));
			}
		}

		return result;
	}
}
