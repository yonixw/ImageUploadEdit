/**
 * Image Editor - Multi-Image Queue & Gallery Management
 * Manages queue state, item lifecycle, thumbnail generation, status tracking, and gallery view.
 */

window.EditorQueue = (function () {
  const items = [];
  let activeIndex = -1;

  function init() {
    const btnAddMore = document.getElementById("btnGalleryAddMore");
    const btnClearAll = document.getElementById("btnGalleryClearAll");
    const fileInput = document.getElementById("fileInput");

    if (btnAddMore && fileInput) {
      btnAddMore.addEventListener("click", () => {
        fileInput.click();
      });
    }

    if (btnClearAll) {
      btnClearAll.addEventListener("click", () => {
        if (items.length === 0) return;
        if (
          confirm("Are you sure you want to remove all images from the queue?")
        ) {
          clearAll();
        }
      });
    }

    updateBadge();
  }

  function generateUUID() {
    return (
      "img_" +
      Math.random().toString(36).substring(2, 9) +
      "_" +
      Date.now().toString(36)
    );
  }

  function cloneCanvas(sourceCanvas) {
    const canvas = document.createElement("canvas");
    canvas.width = sourceCanvas.width;
    canvas.height = sourceCanvas.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(sourceCanvas, 0, 0);
    return canvas;
  }

  function generateThumbnail(sourceCanvas, maxDimension = 160) {
    const thumbCanvas = document.createElement("canvas");
    let w = sourceCanvas.width;
    let h = sourceCanvas.height;

    if (w > h) {
      if (w > maxDimension) {
        h = Math.round((h * maxDimension) / w);
        w = maxDimension;
      }
    } else {
      if (h > maxDimension) {
        w = Math.round((w * maxDimension) / h);
        h = maxDimension;
      }
    }

    thumbCanvas.width = Math.max(1, w);
    thumbCanvas.height = Math.max(1, h);
    const ctx = thumbCanvas.getContext("2d");
    ctx.drawImage(sourceCanvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
    return thumbCanvas.toDataURL("image/jpeg", 0.8);
  }

  /**
   * Add a new decoded canvas to the editor queue
   */
  function addItem(name, sourceCanvas, mimeType = "image/png") {
    const initialCanvas = cloneCanvas(sourceCanvas);
    const originalCanvas = cloneCanvas(sourceCanvas);

    // Initial history snapshot
    const ctx = initialCanvas.getContext("2d");
    const initialSnapshot = ctx.getImageData(
      0,
      0,
      initialCanvas.width,
      initialCanvas.height,
    );

    const defaultFormat = window.EditorHost?.config?.format || "webp";
    const defaultQuality = window.EditorHost?.config?.quality || 0.85;
    const defaultMaxSize = window.EditorHost?.config?.maxSize || 0;

    const item = {
      id: generateUUID(),
      name: name || "untitled.png",
      mimeType: mimeType,
      originalCanvas: originalCanvas,
      currentCanvas: initialCanvas,
      thumbnailUrl: generateThumbnail(initialCanvas),
      historyStack: [initialSnapshot],
      historyIndex: 0,
      status: "PENDING", // 'PENDING' | 'EDITING' | 'UPLOADING' | 'DONE' | 'ERROR'
      progress: 0,
      exportSettings: {
        format: defaultFormat,
        quality: defaultQuality,
        maxSize: defaultMaxSize,
      },
    };

    items.push(item);
    updateBadge();
    renderGallery();

    if (activeIndex === -1 || items.length === 1) {
      selectItem(items.length - 1);
    }

    return item;
  }

  function selectItem(index) {
    if (index < 0 || index >= items.length) return;
    activeIndex = index;
    const item = items[activeIndex];

    // Load active canvas into Viewport & Exporter
    if (
      window.EditorCanvas &&
      typeof window.EditorCanvas.loadItem === "function"
    ) {
      window.EditorCanvas.loadItem(item);
    }

    if (
      window.EditorTools &&
      typeof window.EditorTools.updateHistoryButtons === "function"
    ) {
      window.EditorTools.updateHistoryButtons();
    }

    if (
      window.EditorExport &&
      typeof window.EditorExport.updateSettingsFromItem === "function"
    ) {
      window.EditorExport.updateSettingsFromItem(item);
      window.EditorExport.calculateLiveSize();
    }

    renderGallery();
  }

  function removeItem(id) {
    const idx = items.findIndex((item) => item.id === id);
    if (idx === -1) return;

    items.splice(idx, 1);
    if (activeIndex >= items.length) {
      activeIndex = items.length - 1;
    }

    updateBadge();
    renderGallery();

    if (items.length > 0 && activeIndex >= 0) {
      selectItem(activeIndex);
    } else {
      activeIndex = -1;
      if (
        window.EditorCanvas &&
        typeof window.EditorCanvas.clear === "function"
      ) {
        window.EditorCanvas.clear();
      }
      if (
        window.EditorApp &&
        typeof window.EditorApp.switchTab === "function"
      ) {
        window.EditorApp.switchTab("upload");
      }
    }
  }

  function clearAll() {
    items.length = 0;
    activeIndex = -1;
    updateBadge();
    renderGallery();

    if (
      window.EditorCanvas &&
      typeof window.EditorCanvas.clear === "function"
    ) {
      window.EditorCanvas.clear();
    }

    if (window.EditorApp && typeof window.EditorApp.switchTab === "function") {
      window.EditorApp.switchTab("upload");
    }
  }

  function refreshItemThumbnail(item) {
    if (!item || !item.currentCanvas) return;
    item.thumbnailUrl = generateThumbnail(item.currentCanvas);
    renderGallery();
  }

  function updateItemStatus(id, status, progress = 0) {
    const item = items.find((it) => it.id === id);
    if (item) {
      item.status = status;
      item.progress = progress;
      renderGallery();
    }
  }

  function updateBadge() {
    const badge = document.getElementById("queueBadge");
    const galleryCount = document.getElementById("galleryCount");
    if (badge) badge.textContent = items.length;
    if (galleryCount) galleryCount.textContent = items.length;
  }

  function renderGallery() {
    const grid = document.getElementById("galleryGrid");
    if (!grid) return;

    grid.innerHTML = "";
    items.forEach((item, index) => {
      const card = document.createElement("div");
      card.className = `gallery-item ${index === activeIndex ? "active" : ""}`;
      card.title = item.name;

      // Thumbnail Image
      const img = document.createElement("img");
      img.className = "gallery-thumb";
      img.src = item.thumbnailUrl;
      img.alt = item.name;
      card.appendChild(img);

      // Status Badge
      let statusColor = "#6b7280";
      let statusText = "";
      if (item.status === "DONE") {
        statusColor = "#10b981";
        statusText = "✓ Done";
      } else if (item.status === "UPLOADING" || item.status === "PROGRESS") {
        statusColor = "#3b82f6";
        statusText = `⏳ ${item.progress ? item.progress + "%" : "Uploading"}`;
      } else if (item.status === "ERROR") {
        statusColor = "#ef4444";
        statusText = "✕ Error";
      }

      if (statusText) {
        const badge = document.createElement("div");
        badge.className = "gallery-status-badge";
        badge.style.backgroundColor = statusColor;
        badge.style.color = "#fff";
        badge.textContent = statusText;
        card.appendChild(badge);
      }

      // Filename label
      const nameTag = document.createElement("div");
      nameTag.className = "gallery-item-name";
      nameTag.textContent = `${index + 1}. ${item.name}`;
      card.appendChild(nameTag);

      // Delete button
      const delBtn = document.createElement("button");
      delBtn.className = "gallery-item-delete";
      delBtn.innerHTML = "&times;";
      delBtn.title = "Remove Image";
      delBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        removeItem(item.id);
      });
      card.appendChild(delBtn);

      // Click to select & open in editor
      card.addEventListener("click", () => {
        selectItem(index);
        if (
          window.EditorApp &&
          typeof window.EditorApp.switchTab === "function"
        ) {
          window.EditorApp.switchTab("edit");
        }
      });

      grid.appendChild(card);
    });
  }

  function getActiveItem() {
    if (activeIndex >= 0 && activeIndex < items.length) {
      return items[activeIndex];
    }
    return null;
  }

  return {
    items,
    get activeIndex() {
      return activeIndex;
    },
    init,
    addItem,
    selectItem,
    removeItem,
    clearAll,
    refreshItemThumbnail,
    updateItemStatus,
    renderGallery,
    getActiveItem,
  };
})();
