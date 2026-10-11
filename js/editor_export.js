/**
 * Image Editor - Export, Compression & Batch Upload Module
 * Handles format conversion, live byte size estimation, max dimension constraints,
 * quality preview toggling, and single/batch upload execution pipelines.
 */

window.EditorExport = (function () {
  let estimatedSizeText = "0KB";
  let estimatedBytes = 0;
  let isEstimating = false;
  let isPreviewQualityOn = false;
  let previewCacheCanvas = null;

  function init() {
    const btnUploadDone = document.getElementById("btnUploadDone");
    const btnUploadSingle = document.getElementById("btnUploadSingle");

    if (btnUploadDone) {
      btnUploadDone.addEventListener("click", executeBatchExport);
    }

    if (btnUploadSingle) {
      btnUploadSingle.addEventListener("click", executeSingleExport);
    }
  }

  function buildExportSubToolbar(container) {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    const settings = item
      ? item.exportSettings
      : { format: "webp", quality: 0.85, maxSize: 0 };

    // Format Selector
    const fSpan = document.createElement("span");
    fSpan.className = "tool-label";
    fSpan.textContent = "Format:";
    container.appendChild(fSpan);

    const formatSelect = document.createElement("select");
    formatSelect.className = "tool-select";
    [
      { id: "webp", label: "WebP (Recommended)" },
      { id: "jpeg", label: "JPEG" },
      { id: "png", label: "PNG (Lossless)" },
    ].forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.label;
      formatSelect.appendChild(opt);
    });
    formatSelect.value = settings.format;
    formatSelect.addEventListener("change", (e) => {
      settings.format = e.target.value;
      calculateLiveSize();
      if (isPreviewQualityOn) refreshPreview();
    });
    container.appendChild(formatSelect);

    const divider1 = document.createElement("div");
    divider1.className = "tool-divider";
    container.appendChild(divider1);

    // Quality Slider (for webp & jpeg)
    const qSpan = document.createElement("span");
    qSpan.className = "tool-label";
    qSpan.textContent = `Quality (${Math.round(settings.quality * 100)}%):`;
    container.appendChild(qSpan);

    const qInput = document.createElement("input");
    qInput.type = "range";
    qInput.min = "5";
    qInput.max = "100";
    qInput.value = Math.round(settings.quality * 100);
    qInput.className = "tool-input-slider";
    qInput.addEventListener("input", (e) => {
      const val = parseInt(e.target.value, 10);
      settings.quality = val / 100;
      qSpan.textContent = `Quality (${val}%):`;
      calculateLiveSize();
      if (isPreviewQualityOn) refreshPreview();
    });
    container.appendChild(qInput);

    const divider2 = document.createElement("div");
    divider2.className = "tool-divider";
    container.appendChild(divider2);

    // Max Dimension Selector with descriptive presets (Max Resize)
    const mSpan = document.createElement("span");
    mSpan.className = "tool-label";
    mSpan.textContent = "Max Resize:";
    container.appendChild(mSpan);

    const maxSelect = document.createElement("select");
    maxSelect.className = "tool-select";
    [
      { id: 0, label: "Original (No limit)" },
      { id: 150, label: "150px - Square Thumb / Icon" },
      { id: 300, label: "300px - Avatar / Profile (1:1)" },
      { id: 600, label: "600px - Small / Card" },
      { id: 1080, label: "1080px - Medium / Web" },
      { id: 1200, label: "1200px - Social Media Landscape" },
      { id: 1920, label: "1920px - Full HD (16:9)" },
      { id: 2560, label: "2560px - 2K QHD" },
    ].forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.id;
      opt.textContent = m.label;
      maxSelect.appendChild(opt);
    });
    maxSelect.value = settings.maxSize;
    maxSelect.addEventListener("change", (e) => {
      settings.maxSize = parseInt(e.target.value, 10);
      calculateLiveSize();
      if (isPreviewQualityOn) refreshPreview();
    });
    container.appendChild(maxSelect);

    const divider3 = document.createElement("div");
    divider3.className = "tool-divider";
    container.appendChild(divider3);

    // Preview Toggle (Preview quality compression & resize)
    const previewBtn = document.createElement("button");
    previewBtn.className = `tool-btn ${isPreviewQualityOn ? "active" : ""}`;
    previewBtn.textContent = isPreviewQualityOn
      ? "✓ Preview: ON"
      : "👁 Preview Quality";
    previewBtn.title = "Toggle live preview of compressed & resized output";
    previewBtn.addEventListener("click", () => {
      isPreviewQualityOn = !isPreviewQualityOn;
      previewBtn.className = `tool-btn ${isPreviewQualityOn ? "active" : ""}`;
      previewBtn.textContent = isPreviewQualityOn
        ? "✓ Preview: ON"
        : "👁 Preview Quality";
      refreshPreview();
    });
    container.appendChild(previewBtn);
  }

  async function refreshPreview() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;

    if (!isPreviewQualityOn) {
      if (window.EditorCanvas) window.EditorCanvas.render();
      return;
    }

    try {
      const { blob } = await generateExportBlob(item);
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        const pCanvas = document.createElement("canvas");
        pCanvas.width = img.naturalWidth || img.width;
        pCanvas.height = img.naturalHeight || img.height;
        const pCtx = pCanvas.getContext("2d");
        pCtx.drawImage(img, 0, 0);
        previewCacheCanvas = pCanvas;
        URL.revokeObjectURL(url);
        if (window.EditorCanvas) window.EditorCanvas.render();
      };
      img.src = url;
    } catch (e) {
      console.warn("Error rendering preview:", e);
    }
  }

  function updateSettingsFromItem(item) {
    if (!item) return;
    if (!item.exportSettings) {
      item.exportSettings = {
        format: window.EditorHost?.config?.format || "webp",
        quality: window.EditorHost?.config?.quality || 0.85,
        maxSize: window.EditorHost?.config?.maxSize || 0,
      };
    }
  }

  /**
   * Asynchronously calculate export blob size for active image
   */
  async function calculateLiveSize() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas || isEstimating) return;

    isEstimating = true;
    try {
      const { blob } = await generateExportBlob(item);
      if (blob) {
        estimatedBytes = blob.size;
        estimatedSizeText = formatBytes(blob.size);
      }
    } catch (e) {
      console.warn("Error estimating file size:", e);
    } finally {
      isEstimating = false;
      updateStatusBarText();
    }
  }

  /**
   * Status Bar Readout: Strict label-free format: "100%, 1920x1080, 412KB"
   */
  function updateStatusBarText() {
    const statusElem = document.getElementById("statusBarText");
    if (!statusElem) return;

    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    const zoomPct = window.EditorCanvas
      ? Math.round(window.EditorCanvas.zoom * 100)
      : 100;

    if (!item || !item.currentCanvas) {
      statusElem.textContent = `${zoomPct}%, 0x0, 0KB`;
      return;
    }

    const w = item.currentCanvas.width;
    const h = item.currentCanvas.height;
    const settings = item.exportSettings;
    let sizeDesc = `${w}x${h}`;

    if (
      settings &&
      settings.maxSize > 0 &&
      (w > settings.maxSize || h > settings.maxSize)
    ) {
      let tw = w,
        th = h;
      if (w > h) {
        th = Math.round((h * settings.maxSize) / w);
        tw = settings.maxSize;
      } else {
        tw = Math.round((w * settings.maxSize) / h);
        th = settings.maxSize;
      }
      sizeDesc = `${w}x${h} → ${tw}x${th} (Max resize)`;
    }

    statusElem.textContent = `${zoomPct}%, ${sizeDesc}, ${estimatedSizeText}`;
  }

  function formatBytes(bytes) {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  /**
   * Generate an exported canvas and blob applying target format, quality, and max dimensions
   */
  function generateExportBlob(item) {
    return new Promise((resolve) => {
      const settings = item.exportSettings || {
        format: "webp",
        quality: 0.85,
        maxSize: 0,
      };
      const srcCanvas = item.currentCanvas;

      let targetW = srcCanvas.width;
      let targetH = srcCanvas.height;

      // Handle max dimension constraint
      if (settings.maxSize > 0) {
        if (targetW > targetH && targetW > settings.maxSize) {
          targetH = Math.round((targetH * settings.maxSize) / targetW);
          targetW = settings.maxSize;
        } else if (targetH >= targetW && targetH > settings.maxSize) {
          targetW = Math.round((targetW * settings.maxSize) / targetH);
          targetH = settings.maxSize;
        }
      }

      let exportCanvas = srcCanvas;
      if (targetW !== srcCanvas.width || targetH !== srcCanvas.height) {
        exportCanvas = document.createElement("canvas");
        exportCanvas.width = targetW;
        exportCanvas.height = targetH;
        const ctx = exportCanvas.getContext("2d");
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(srcCanvas, 0, 0, targetW, targetH);
      }

      let mime = "image/webp";
      if (settings.format === "jpeg" || settings.format === "jpg") {
        mime = "image/jpeg";
      } else if (settings.format === "png") {
        mime = "image/png";
      }

      exportCanvas.toBlob(
        (blob) => {
          resolve({
            blob: blob || new Blob(),
            width: targetW,
            height: targetH,
            mimeType: mime,
            canvas: exportCanvas,
          });
        },
        mime,
        settings.quality,
      );
    });
  }

  /**
   * Convert blob to Base64 dataURL
   */
  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Single Item Upload Pipeline: Exports only the active single image
   */
  async function executeSingleExport() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item) {
      if (window.EditorUpload)
        window.EditorUpload.showToast("No active image to upload.");
      return;
    }

    const btn = document.getElementById("btnUploadSingle");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Uploading...";
    }

    window.EditorQueue.updateItemStatus(item.id, "UPLOADING", 10);

    try {
      const { blob, width, height, mimeType } = await generateExportBlob(item);
      window.EditorQueue.updateItemStatus(item.id, "UPLOADING", 60);

      const dataUrl = await blobToDataUrl(blob);
      window.EditorQueue.updateItemStatus(item.id, "UPLOADING", 90);

      let ext = "webp";
      if (mimeType === "image/jpeg") ext = "jpg";
      else if (mimeType === "image/png") ext = "png";

      const baseName = item.name.replace(/\.[^/.]+$/, "");
      const finalName = `${baseName}-edited.${ext}`;

      const activeToken =
        item.token ||
        (window.EditorHost && typeof window.EditorHost.getToken === "function"
          ? window.EditorHost.getToken()
          : "") ||
        "";

      const payload = {
        id: item.id,
        index: window.EditorQueue.activeIndex,
        token: activeToken,
        name: finalName,
        mimeType: mimeType,
        blob: blob,
        dataUrl: dataUrl,
        width: width,
        height: height,
        fileSize: blob.size,
      };

      if (window.EditorHost) {
        await window.EditorHost.sendImageItem(payload);
      }

      window.EditorQueue.updateItemStatus(item.id, "DONE", 100);
      if (window.EditorUpload) {
        window.EditorUpload.showToast(
          `Image "${finalName}" uploaded successfully`,
        );
      }
    } catch (err) {
      console.error("Error exporting single item:", item.name, err);
      window.EditorQueue.updateItemStatus(item.id, "ERROR", 0);
      if (window.EditorUpload) {
        window.EditorUpload.showToast("Failed to upload image.");
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
          Upload Image
        `;
      }
    }
  }

  /**
   * Batch Upload / Export Pipeline: Iterates over queue items, dispatches payloads, updates UI
   */
  async function executeBatchExport() {
    const queue = window.EditorQueue ? window.EditorQueue.items : [];
    if (!queue.length) {
      if (window.EditorUpload)
        window.EditorUpload.showToast("No images to upload.");
      return;
    }

    const btn = document.getElementById("btnUploadDone");
    if (btn) {
      btn.disabled = true;
      btn.textContent = "Processing...";
    }

    let successCount = 0;

    for (let i = 0; i < queue.length; i++) {
      const item = queue[i];
      window.EditorQueue.updateItemStatus(item.id, "UPLOADING", 10);

      try {
        const { blob, width, height, mimeType } =
          await generateExportBlob(item);
        window.EditorQueue.updateItemStatus(item.id, "UPLOADING", 60);

        const dataUrl = await blobToDataUrl(blob);
        window.EditorQueue.updateItemStatus(item.id, "UPLOADING", 90);

        // Adjust extension in filename
        let ext = "webp";
        if (mimeType === "image/jpeg") ext = "jpg";
        else if (mimeType === "image/png") ext = "png";

        const baseName = item.name.replace(/\.[^/.]+$/, "");
        const finalName = `${baseName}-edited.${ext}`;

        const activeToken =
          item.token ||
          (window.EditorHost && typeof window.EditorHost.getToken === "function"
            ? window.EditorHost.getToken()
            : "") ||
          "";

        const payload = {
          id: item.id,
          index: i,
          token: activeToken,
          name: finalName,
          mimeType: mimeType,
          blob: blob,
          dataUrl: dataUrl,
          width: width,
          height: height,
          fileSize: blob.size,
        };

        if (window.EditorHost) {
          await window.EditorHost.sendImageItem(payload);
        }

        window.EditorQueue.updateItemStatus(item.id, "DONE", 100);
        successCount++;
      } catch (err) {
        console.error("Error exporting item:", item.name, err);
        window.EditorQueue.updateItemStatus(item.id, "ERROR", 0);
      }
    }

    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z"/></svg>
        Upload All & Done
      `;
    }

    if (window.EditorUpload) {
      window.EditorUpload.showToast(
        `Successfully processed ${successCount} image(s)`,
      );
    }

    if (window.EditorHost) {
      window.EditorHost.sendDone();
    }
  }

  return {
    get isPreviewQualityOn() {
      return isPreviewQualityOn;
    },
    get previewCacheCanvas() {
      return previewCacheCanvas;
    },
    init,
    buildExportSubToolbar,
    updateSettingsFromItem,
    calculateLiveSize,
    updateStatusBarText,
    generateExportBlob,
    executeSingleExport,
    executeBatchExport,
  };
})();
