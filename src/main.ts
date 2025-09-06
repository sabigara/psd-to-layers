import JSZip from "jszip";
import { type LayerData, PSDLayerExtractor } from "./psd-extractor.ts";

import "./style.css";

interface LayerDisplay extends LayerData {
	url: string;
	blob: Blob;
}

let extractor: PSDLayerExtractor | null = null;
let currentLayers: LayerDisplay[] = [];

// イベントリスナーの設定
setupEventListeners();

function setupEventListeners(): void {
	const uploadArea = document.getElementById("uploadArea")!;
	const fileInput = document.getElementById("fileInput")! as HTMLInputElement;
	const downloadAllBtn = document.getElementById("downloadAllBtn")!;

	// ファイルドロップ
	uploadArea.addEventListener("dragover", (e) => {
		e.preventDefault();
		uploadArea.classList.add("drag-over");
	});

	uploadArea.addEventListener("dragleave", () => {
		uploadArea.classList.remove("drag-over");
	});

	uploadArea.addEventListener("drop", (e) => {
		e.preventDefault();
		uploadArea.classList.remove("drag-over");
		const files = e.dataTransfer?.files;
		if (
			files &&
			files.length > 0 &&
			files[0].name.toLowerCase().endsWith(".psd")
		) {
			handleFile(files[0]);
		} else {
			alert("PSDファイルを選択してください");
		}
	});

	// ファイルクリック選択
	uploadArea.addEventListener("click", () => {
		fileInput.click();
	});

	fileInput.addEventListener("change", (e) => {
		const target = e.target as HTMLInputElement;
		if (target.files && target.files.length > 0) {
			handleFile(target.files[0]);
		}
	});

	// 全ダウンロード
	downloadAllBtn.addEventListener("click", () => {
		downloadAllLayers();
	});
}

async function handleFile(file: File): Promise<void> {
	try {
		// UI更新
		showSection("progressSection");
		showSection("logSection");
		hideSection("resultsSection");
		hideSection("uploadArea");

		// 既存のレイヤーをクリーンアップ
		cleanupLayers();

		// エクストラクター初期化
		extractor = new PSDLayerExtractor(
			// 進捗コールバック
			(current: number, total: number) => {
				updateProgress(current, total, `処理中... ${current}/${total}`);
			},
			// ログコールバック
			(message: string) => {
				addLog(message);
			},
		);

		// ファイルをArrayBufferに変換
		const arrayBuffer = await file.arrayBuffer();
		const uint8Array = new Uint8Array(arrayBuffer);

		// レイヤー抽出実行
		const layers = await extractor.extractLayers(uint8Array);

		// 各レイヤーをBlobに変換してダウンロード可能にする
		const layersWithBlobs: LayerDisplay[] = layers.map((layer) => {
			// pngBufferからBlobに変換（新しいUint8Arrayを作成）
			const uint8Array = new Uint8Array(layer.pngBuffer);
			const blob = new Blob([uint8Array], { type: "image/png" });
			const url = URL.createObjectURL(blob);

			return {
				...layer,
				blob,
				url,
			};
		});

		currentLayers = layersWithBlobs;

		// 結果表示
		hideSection("progressSection");
		showSection("resultsSection");
		displayLayers(layersWithBlobs);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		addLog(`❌ エラー: ${errorMessage}`);
		showSection("uploadArea");
		hideSection("progressSection");
	}
}

function showSection(sectionId: string): void {
	document.getElementById(sectionId)!.style.display = "block";
}

function hideSection(sectionId: string): void {
	document.getElementById(sectionId)!.style.display = "none";
}

function addLog(message: string): void {
	const logContainer = document.getElementById("logContainer")!;
	const logEntry = document.createElement("div");
	logEntry.className = "log-entry";
	logEntry.textContent = message;
	logContainer.appendChild(logEntry);
	logContainer.scrollTop = logContainer.scrollHeight;
}

function updateProgress(current: number, total: number, message: string): void {
	const progressFill = document.getElementById("progressFill")!;
	const progressText = document.getElementById("progressText")!;

	const percentage = Math.round((current / total) * 100);
	progressFill.style.width = `${percentage}%`;
	progressText.textContent = `${message} (${current}/${total})`;
}

function displayLayers(layers: LayerDisplay[]): void {
	const layersGrid = document.getElementById("layersGrid")!;
	layersGrid.innerHTML = "";

	layers.forEach((layer, index) => {
		const layerCard = document.createElement("div");
		layerCard.className = "layer-card";

		layerCard.innerHTML = `
      <div class="layer-preview">
        <img src="${layer.url}" alt="${layer.name}" loading="lazy">
      </div>
      <div class="layer-info">
        <h4>${layer.name}</h4>
        <p class="layer-details">
          ${formatFileSize(layer.pngBuffer.length)}
        </p>
        <button class="btn btn-download" data-index="${index}">
           ダウンロード
        </button>
      </div>
    `;

		// ダウンロードボタンのイベントリスナーを追加
		const downloadBtn = layerCard.querySelector(
			".btn-download",
		) as HTMLButtonElement;
		downloadBtn.addEventListener("click", () => {
			downloadLayer(index);
		});

		layersGrid.appendChild(layerCard);
	});
}

function formatFileSize(bytes: number): string {
	if (bytes === 0) return "0 Bytes";
	const k = 1024;
	const sizes = ["Bytes", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${Number.parseFloat((bytes / k ** i).toFixed(2))} ${sizes[i]}`;
}

function downloadLayer(index: number): void {
	const layer = currentLayers[index];
	if (layer) {
		const a = document.createElement("a");
		a.href = layer.url;
		a.download = `${layer.name}.png`;
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
	}
}

function downloadAllLayers(): void {
	downloadAllLayersAsZip();
}

async function downloadAllLayersAsZip(): Promise<void> {
	if (currentLayers.length === 0) {
		addLog("❌ ダウンロードするレイヤーがありません");
		return;
	}

	try {
		addLog("📦 ZIPファイルを作成中...");
		const zip = new JSZip();

		// 各レイヤーをZIPに追加
		for (const layer of currentLayers) {
			const fileName = `${layer.name}.png`;
			zip.file(fileName, layer.pngBuffer);
		}

		// ZIPファイルを生成
		const zipBlob = await zip.generateAsync({ type: "blob" });

		// ダウンロードリンクを作成
		const url = URL.createObjectURL(zipBlob);
		const a = document.createElement("a");
		a.href = url;
		a.download = "psd-layers.zip";
		document.body.appendChild(a);
		a.click();
		document.body.removeChild(a);
		URL.revokeObjectURL(url);

		addLog(`✅ ZIPダウンロード完了: ${currentLayers.length}個のレイヤー`);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		addLog(`❌ ZIPダウンロードエラー: ${errorMessage}`);
	}
}

function cleanupLayers(): void {
	// 既存のURLオブジェクトをクリーンアップ
	for (const layer of currentLayers) {
		if (layer.url) {
			URL.revokeObjectURL(layer.url);
		}
	}
	currentLayers = [];
}

// ページ離脱時のクリーンアップ
window.addEventListener("beforeunload", () => {
	cleanupLayers();
});
