/**
 * Japanese (日本語) - LTR
 */
window.EditorI18n.register("ja", {
  // App / header
  "app.documentTitle": "画像アップローダー＆エディター",
  "header.title": "画像エディター",
  "header.uploadImage": "画像をアップロード",
  "header.uploadImage.tooltip": "この画像をアップロード",
  "header.uploadAll": "すべてアップロード",
  "header.uploadAll.tooltip": "まとめて書き出し＆アップロード",
  "common.close": "閉じる",
  "common.cancel": "キャンセル",
  "common.reset": "リセット",
  "common.size": "サイズ:",
  "nav.scrollLeft": "左へスクロール",
  "nav.scrollRight": "右へスクロール",

  // Mode tabs
  "tabs.addMore": "追加",
  "tabs.addMore.tooltip": "画像を追加",
  "tabs.gallery": "ギャラリー",
  "tabs.gallery.tooltip": "画像キューを表示",
  "tabs.edit": "編集",
  "tabs.edit.tooltip": "編集中の画像",

  // Primary toolbar
  "tools.undo.tooltip": "元に戻す (Ctrl+Z)",
  "tools.redo.tooltip": "やり直す (Ctrl+Y)",
  "tools.crop": "切り抜き",
  "tools.crop.tooltip": "切り抜き＆マスク",
  "tools.transform": "回転・反転",
  "tools.transform.tooltip": "回転・反転",
  "tools.filter": "フィルター",
  "tools.filter.tooltip": "プリセット＆補正",
  "tools.censor": "モザイク",
  "tools.censor.tooltip": "ぼかし＆モザイク",
  "tools.brush": "ブラシ",
  "tools.brush.tooltip": "ブラシ＆鉛筆",
  "tools.text": "テキスト・絵文字",
  "tools.text.tooltip": "テキスト・絵文字",
  "tools.shapes": "図形",
  "tools.shapes.tooltip": "ベクター図形",
  "tools.export": "画質・形式",
  "tools.export.tooltip": "書き出し＆画質",
  "tools.selectHint": "上のツールを選択して編集を開始してください",

  // Upload view
  "upload.dropHere": "画像またはフォルダーをここにドロップ",
  "upload.heading": "エディターに画像を追加",
  "upload.subheading": "下の方法から選ぶか、クリップボードから貼り付けてください (Ctrl+V)",
  "upload.dropzone": "画像ファイルまたはフォルダーをここにドラッグ＆ドロップ",
  "upload.supports": "対応形式: JPG, PNG, WebP, SVG, BMP, GIF",
  "upload.chooseFiles": "ファイルを選択",
  "upload.chooseFolder": "フォルダーを選択",
  "upload.useCamera": "カメラを使用",

  // Gallery view
  "gallery.title": "画像キュー",
  "gallery.clearAll": "すべて削除",
  "gallery.confirmClearAll": "キューからすべての画像を削除してもよろしいですか？",
  "gallery.removeImage": "画像を削除",
  "gallery.status.done": "完了",
  "gallery.status.uploading": "アップロード中",
  "gallery.status.error": "エラー",

  // Status bar
  "status.centerFit": "中央 / 全体表示",
  "status.centerFit.tooltip": "画像を中央に配置して画面に合わせる",
  "status.zoom100.tooltip": "100% ズーム (実寸)",
  "status.zoomIn.tooltip": "拡大 (+)",
  "status.zoomOut.tooltip": "縮小 (-)",
  "status.maxResize": "最大サイズに縮小",

  // Batch confirm modal
  "batch.title": "一括読み込みの確認",
  "batch.message": "{count} 枚の画像が選択されました。大量の画像の読み込みと描画には多くのメモリを使用する場合があります。続行しますか？",
  "batch.proceed": "続行",

  // Camera modal
  "camera.title": "写真を撮影",
  "camera.switch": "カメラ切り替え",
  "camera.snap": "撮影",
  "camera.rotate": "表示を回転",
  "camera.device": "カメラ {n}",

  // Color picker
  "color.palette": "パレット",
  "color.recent": "最近使った色",
  "color.opacity": "不透明度",

  // Toasts
  "toast.noValidImages": "有効な画像ファイルが見つかりません。",
  "toast.loadedFromClipboard_other": "クリップボードから {count} 枚の画像を読み込みました",
  "toast.photoCaptured": "写真を撮影してキューに追加しました",
  "toast.cameraUnsupported": "このブラウザーはカメラに対応していません。",
  "toast.cameraDenied": "カメラへのアクセスが拒否されたか、利用できません。",
  "toast.loaded_other": "{count} 枚の画像を読み込みました",
  "toast.uploadFirst": "先に画像をアップロードまたは撮影してください。",
  "toast.noActiveImage": "アップロードする画像がありません。",
  "toast.uploadedOne": "画像「{name}」をアップロードしました",
  "toast.uploadFailed": "画像のアップロードに失敗しました。",
  "toast.noImages": "アップロードする画像がありません。",
  "toast.processed_other": "{count} 枚の画像を処理しました",

  // Export / quality sub-toolbar
  "export.format": "形式:",
  "export.format.webp": "WebP (推奨)",
  "export.format.jpeg": "JPEG",
  "export.format.png": "PNG (可逆圧縮)",
  "export.quality": "画質 ({pct}%):",
  "export.maxResize": "最大サイズ:",
  "export.max.0": "オリジナル (制限なし)",
  "export.max.150": "150px - 正方形サムネイル / アイコン",
  "export.max.300": "300px - アバター / プロフィール (1:1)",
  "export.max.600": "600px - 小 / カード",
  "export.max.1080": "1080px - 中 / Web",
  "export.max.1200": "1200px - SNS 横長",
  "export.max.1920": "1920px - フル HD (16:9)",
  "export.max.2560": "2560px - 2K QHD",
  "export.previewOn": "✓ プレビュー: オン",
  "export.previewOff": "👁 画質をプレビュー",
  "export.preview.tooltip": "圧縮・リサイズ後の出力をライブプレビュー",
  "export.uploading": "アップロード中...",
  "export.processing": "処理中...",

  // Crop
  "crop.free": "自由",
  "crop.square": "1:1 正方形",
  "crop.avatar": "アバター円形",
  "crop.apply": "切り抜きを適用",

  // Transform
  "transform.cw": "右に90°",
  "transform.ccw": "左に90°",
  "transform.flipH": "左右反転",
  "transform.flipV": "上下反転",
  "transform.freeRotate": "自由回転:",
  "transform.bg": "背景:",
  "transform.bg.transparent": "透明",
  "transform.bg.white": "白",
  "transform.bg.black": "黒",
  "transform.apply": "回転を適用",

  // Filters
  "filter.normal": "標準",
  "filter.grayscale": "グレースケール",
  "filter.bw": "白黒",
  "filter.sepia": "セピア",
  "filter.invert": "色反転",
  "filter.brightness": "明るさ:",
  "filter.contrast": "コントラスト:",
  "filter.saturation": "彩度:",
  "filter.apply": "フィルターを適用",

  // Censor
  "censor.pixelate": "モザイク",
  "censor.blur": "ぼかし",
  "censor.box": "矩形選択",
  "censor.brush": "ブラシ",
  "censor.freehandIn": "フリーハンド (内側)",
  "censor.freehandOut": "フリーハンド (外側)",
  "censor.radius": "強さ / 半径:",

  // Brush
  "brush.color.tooltip": "色と不透明度を変更",

  // Text
  "text.default": "ダブルクリックまたはテキストを編集",
  "text.color.tooltip": "文字色",
  "text.bold.tooltip": "太字",
  "text.italic.tooltip": "斜体",
  "text.badge": "背景プレート",
  "text.rotate": "回転:",
  "text.rotate.tooltip": "テキストを回転 (0°〜360°)",
  "text.rotateMinus.tooltip": "-45° 回転",
  "text.rotatePlus.tooltip": "+45° 回転",
  "text.rotateReset.tooltip": "回転を 0° にリセット",
  "text.burn": "テキストを確定",

  // Shapes
  "shapes.rect": "四角形",
  "shapes.roundedRect": "角丸四角形",
  "shapes.circle": "円 / 楕円",
  "shapes.line": "直線",
  "shapes.arrow": "矢印",
  "shapes.star": "星",
  "shapes.color.tooltip": "図形の色",
  "shapes.border": "線の太さ:",
  "shapes.fill.none": "塗りなし",
  "shapes.fill.solid": "塗りつぶし",
  "shapes.fill.semi": "半透明の塗り",
});
