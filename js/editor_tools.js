/**
 * Image Editor - Editing Tools Implementation
 * Includes Color Chooser, History Manager, Crop (with avatar mask), Transform,
 * Preset Filters & Color Adjustments, Censor (Blur/Pixelate), Brush, Text/Emoji, and Vector Shapes.
 */

window.EditorTools = (function () {
  let activeTool = null; // 'crop' | 'transform' | 'filter' | 'censor' | 'brush' | 'text' | 'shapes' | 'export'
  let currentColor = "rgba(59, 130, 246, 1)";
  let currentAlpha = 1.0;
  let currentHex = "#3b82f6";
  let recentColors = [];

  // Tool Specific State
  const cropState = {
    ratio: "free", // 'free' | '1:1' | '4:3' | '16:9' | '3:2' | '9:16'
    isAvatarMask: false,
    rect: { x: 0, y: 0, w: 100, h: 100 },
    isDragging: false,
    dragHandle: null, // 'nw','ne','se','sw','n','e','s','w','move'
    startPos: { x: 0, y: 0 },
    startRect: { x: 0, y: 0, w: 0, h: 0 },
  };

  const filterState = {
    preset: "none",
    brightness: 0, // -100 to 100
    contrast: 0,
    saturation: 0,
    warmth: 0,
    previewCanvas: null,
  };

  const censorState = {
    type: "pixelate", // 'pixelate' | 'blur'
    mode: "box", // 'box' | 'brush'
    radius: 16,
    brushPoints: [],
    boxRect: null,
    isInteracting: false,
  };

  const brushState = {
    type: "freehand", // 'freehand' | 'line' | 'arrow' | 'star' | 'circle' | 'rect'
    size: 8,
    fillMode: "stroke", // 'stroke' | 'fill'
    points: [],
    isDrawing: false,
    startPoint: null,
    currentPoint: null,
  };

  const textState = {
    text: "Double click or edit text",
    font: "sans-serif",
    size: 36,
    bold: false,
    italic: false,
    fillBg: false,
    bgColor: "rgba(0,0,0,0.6)",
    x: 50,
    y: 50,
    rotation: 0,
    isDragging: false,
    isRotating: false,
    dragOffset: { x: 0, y: 0 },
  };

  const shapeState = {
    type: "rect", // 'rect' | 'rounded-rect' | 'circle'
    strokeWidth: 4,
    strokeStyle: "solid", // 'solid' | 'dashed'
    fillStyle: "none", // 'none' | 'solid' | 'semi'
    startPos: null,
    currentPos: null,
    isDrawing: false,
  };

  function init() {
    loadRecentColors();
    initColorPicker();
    initHistoryButtons();
    bindPrimaryToolButtons();

    if (window.EditorCanvas) {
      window.EditorCanvas.setOverlayRenderer(renderToolOverlays);
    }
  }

  // --- 1. Color Picker Module ---
  function loadRecentColors() {
    try {
      const saved = localStorage.getItem("img_editor_recent_colors");
      recentColors = saved
        ? JSON.parse(saved)
        : [
            "#3b82f6",
            "#ef4444",
            "#10b981",
            "#f59e0b",
            "#8b5cf6",
            "#ffffff",
            "#000000",
            "#ec4899",
          ];
    } catch (e) {
      recentColors = [
        "#3b82f6",
        "#ef4444",
        "#10b981",
        "#f59e0b",
        "#8b5cf6",
        "#ffffff",
        "#000000",
        "#ec4899",
      ];
    }
  }

  function saveRecentColor(hex) {
    if (!hex) return;
    recentColors = [
      hex,
      ...recentColors.filter((c) => c.toLowerCase() !== hex.toLowerCase()),
    ].slice(0, 8);
    try {
      localStorage.setItem(
        "img_editor_recent_colors",
        JSON.stringify(recentColors),
      );
    } catch (e) {}
    renderColorSwatches();
  }

  function initColorPicker() {
    const defaultPalette = [
      "#ffffff",
      "#000000",
      "#ef4444",
      "#f97316",
      "#f59e0b",
      "#10b981",
      "#06b6d4",
      "#3b82f6",
      "#6366f1",
      "#8b5cf6",
      "#ec4899",
      "#64748b",
      "#78350f",
      "#14532d",
      "#1e3a8a",
      "#4c1d95",
    ];

    const paletteContainer = document.getElementById("paletteSwatches");
    if (paletteContainer) {
      paletteContainer.innerHTML = "";
      defaultPalette.forEach((col) => {
        const sw = document.createElement("div");
        sw.className = "color-swatch";
        sw.style.backgroundColor = col;
        sw.title = col;
        sw.addEventListener("click", () => {
          setColorFromHex(col);
          saveRecentColor(col);
        });
        paletteContainer.appendChild(sw);
      });
    }

    renderColorSwatches();

    const nativePicker = document.getElementById("nativeColorInput");
    const hexInput = document.getElementById("hexColorInput");
    const alphaSlider = document.getElementById("alphaSlider");
    const alphaText = document.getElementById("alphaValueText");

    if (nativePicker) {
      nativePicker.addEventListener("input", (e) => {
        setColorFromHex(e.target.value);
      });
      nativePicker.addEventListener("change", (e) => {
        saveRecentColor(e.target.value);
      });
    }

    if (hexInput) {
      hexInput.addEventListener("change", (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith("#")) val = "#" + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          setColorFromHex(val);
          saveRecentColor(val);
        }
      });
    }

    if (alphaSlider && alphaText) {
      alphaSlider.addEventListener("input", (e) => {
        currentAlpha = parseInt(e.target.value, 10) / 100;
        alphaText.textContent = `${e.target.value}%`;
        updateCompositeColor();
      });
    }
  }

  function renderColorSwatches() {
    const recentContainer = document.getElementById("recentSwatches");
    if (!recentContainer) return;
    recentContainer.innerHTML = "";
    recentColors.forEach((col) => {
      const sw = document.createElement("div");
      sw.className = "color-swatch";
      sw.style.backgroundColor = col;
      sw.title = col;
      sw.addEventListener("click", () => {
        setColorFromHex(col);
      });
      recentContainer.appendChild(sw);
    });
  }

  function setColorFromHex(hex) {
    currentHex = hex;
    const nativePicker = document.getElementById("nativeColorInput");
    const hexInput = document.getElementById("hexColorInput");
    if (nativePicker) nativePicker.value = hex;
    if (hexInput) hexInput.value = hex;
    updateCompositeColor();
  }

  function updateCompositeColor() {
    const rgb = hexToRgb(currentHex);
    currentColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${currentAlpha})`;
    // Update active color triggers in toolbar 2
    const trigger = document.getElementById("activeColorBtn");
    if (trigger) {
      trigger.style.backgroundColor = currentColor;
    }
    if (window.EditorCanvas) window.EditorCanvas.render();
  }

  function hexToRgb(hex) {
    let c = hex.replace("#", "");
    if (c.length === 3)
      c = c
        .split("")
        .map((x) => x + x)
        .join("");
    const num = parseInt(c, 16);
    return {
      r: (num >> 16) & 255,
      g: (num >> 8) & 255,
      b: num & 255,
    };
  }

  function toggleColorPicker(anchorElement) {
    const pop = document.getElementById("colorPickerPopover");
    if (!pop) return;
    if (pop.classList.contains("active")) {
      pop.classList.remove("active");
      return;
    }
    const rect = anchorElement.getBoundingClientRect();
    pop.style.top = rect.bottom + 6 + "px";
    pop.style.left = Math.min(rect.left, window.innerWidth - 260) + "px";
    pop.classList.add("active");

    const closeHandler = (e) => {
      if (!pop.contains(e.target) && e.target !== anchorElement) {
        pop.classList.remove("active");
        window.removeEventListener("mousedown", closeHandler);
      }
    };
    setTimeout(() => {
      window.addEventListener("mousedown", closeHandler);
    }, 50);
  }

  // --- 2. History Manager (Undo / Redo) ---
  function initHistoryButtons() {
    const btnUndo = document.getElementById("btnUndo");
    const btnRedo = document.getElementById("btnRedo");

    if (btnUndo) btnUndo.addEventListener("click", undo);
    if (btnRedo) btnRedo.addEventListener("click", redo);

    window.addEventListener("keydown", (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          redo();
        }
      }
    });
  }

  function pushHistorySnapshot() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;

    const ctx = item.currentCanvas.getContext("2d");
    const snapshot = ctx.getImageData(
      0,
      0,
      item.currentCanvas.width,
      item.currentCanvas.height,
    );

    // Truncate any forward history if we are in the middle of the stack
    item.historyStack = item.historyStack.slice(0, item.historyIndex + 1);
    item.historyStack.push(snapshot);

    // Keep max 10 steps
    if (item.historyStack.length > 10) {
      item.historyStack.shift();
    } else {
      item.historyIndex++;
    }

    updateHistoryButtons();
    if (window.EditorQueue) window.EditorQueue.refreshItemThumbnail(item);
    if (window.EditorCanvas) window.EditorCanvas.render();
    if (window.EditorExport) window.EditorExport.calculateLiveSize();
  }

  function undo() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || item.historyIndex <= 0) return;

    item.historyIndex--;
    const snapshot = item.historyStack[item.historyIndex];

    // Check if canvas dimensions changed (e.g., crop or transform)
    if (
      item.currentCanvas.width !== snapshot.width ||
      item.currentCanvas.height !== snapshot.height
    ) {
      item.currentCanvas.width = snapshot.width;
      item.currentCanvas.height = snapshot.height;
    }

    const ctx = item.currentCanvas.getContext("2d");
    ctx.putImageData(snapshot, 0, 0);

    updateHistoryButtons();
    if (window.EditorQueue) window.EditorQueue.refreshItemThumbnail(item);
    if (window.EditorCanvas) {
      window.EditorCanvas.fitToScreen();
      window.EditorCanvas.render();
    }
    if (window.EditorExport) window.EditorExport.calculateLiveSize();
  }

  function redo() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || item.historyIndex >= item.historyStack.length - 1) return;

    item.historyIndex++;
    const snapshot = item.historyStack[item.historyIndex];

    if (
      item.currentCanvas.width !== snapshot.width ||
      item.currentCanvas.height !== snapshot.height
    ) {
      item.currentCanvas.width = snapshot.width;
      item.currentCanvas.height = snapshot.height;
    }

    const ctx = item.currentCanvas.getContext("2d");
    ctx.putImageData(snapshot, 0, 0);

    updateHistoryButtons();
    if (window.EditorQueue) window.EditorQueue.refreshItemThumbnail(item);
    if (window.EditorCanvas) {
      window.EditorCanvas.fitToScreen();
      window.EditorCanvas.render();
    }
    if (window.EditorExport) window.EditorExport.calculateLiveSize();
  }

  function updateHistoryButtons() {
    const btnUndo = document.getElementById("btnUndo");
    const btnRedo = document.getElementById("btnRedo");
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;

    if (!btnUndo || !btnRedo) return;

    if (!item) {
      btnUndo.style.opacity = "0.4";
      btnRedo.style.opacity = "0.4";
      return;
    }

    btnUndo.style.opacity = item.historyIndex > 0 ? "1" : "0.4";
    btnRedo.style.opacity =
      item.historyIndex < item.historyStack.length - 1 ? "1" : "0.4";
  }

  // --- 3. Primary Tool Selector & Toolbar 2 Switcher ---
  function bindPrimaryToolButtons() {
    const buttons = document.querySelectorAll("#toolbar1Scroll [data-tool]");
    buttons.forEach((btn) => {
      btn.addEventListener("click", () => {
        const tool = btn.getAttribute("data-tool");
        selectTool(tool);
      });
    });
  }

  function selectTool(toolName) {
    if (activeTool === toolName) {
      // Toggle off
      activeTool = null;
    } else {
      activeTool = toolName;
    }

    // Update button active state
    document.querySelectorAll("#toolbar1Scroll [data-tool]").forEach((btn) => {
      btn.classList.toggle(
        "active",
        btn.getAttribute("data-tool") === activeTool,
      );
    });

    populateSubToolbar();

    // Tool specific initialization
    if (activeTool === "crop") {
      initCropBox();
    } else if (activeTool === "filter") {
      initFilterState();
    } else if (activeTool === "text") {
      initTextPosition();
    }

    if (window.EditorCanvas) window.EditorCanvas.render();
  }

  function populateSubToolbar() {
    const tb2Scroll = document.getElementById("toolbar2Scroll");
    if (!tb2Scroll) return;
    tb2Scroll.innerHTML = "";

    if (!activeTool) {
      tb2Scroll.innerHTML =
        '<span class="tool-label">Select a tool above to begin editing</span>';
      return;
    }

    switch (activeTool) {
      case "crop":
        buildCropSubToolbar(tb2Scroll);
        break;
      case "transform":
        buildTransformSubToolbar(tb2Scroll);
        break;
      case "filter":
        buildFilterSubToolbar(tb2Scroll);
        break;
      case "censor":
        buildCensorSubToolbar(tb2Scroll);
        break;
      case "brush":
        buildBrushSubToolbar(tb2Scroll);
        break;
      case "text":
        buildTextSubToolbar(tb2Scroll);
        break;
      case "shapes":
        buildShapesSubToolbar(tb2Scroll);
        break;
      case "export":
        if (window.EditorExport)
          window.EditorExport.buildExportSubToolbar(tb2Scroll);
        break;
    }
  }

  // --- Sub Toolbar Builders ---

  // A. Crop Sub Toolbar
  function buildCropSubToolbar(container) {
    const ratios = [
      { id: "free", label: "Free" },
      { id: "1:1", label: "1:1 Square" },
      { id: "4:3", label: "4:3" },
      { id: "16:9", label: "16:9" },
      { id: "3:2", label: "3:2" },
      { id: "9:16", label: "9:16" },
    ];

    ratios.forEach((r) => {
      const btn = document.createElement("button");
      btn.className = `tool-btn ${cropState.ratio === r.id ? "active" : ""}`;
      btn.textContent = r.label;
      btn.addEventListener("click", () => {
        cropState.ratio = r.id;
        applyCropRatio();
        populateSubToolbar();
      });
      container.appendChild(btn);
    });

    const divider = document.createElement("div");
    divider.className = "tool-divider";
    container.appendChild(divider);

    // Avatar Circle Mask toggle (for 1:1)
    const avatarBtn = document.createElement("button");
    avatarBtn.className = `tool-btn ${cropState.isAvatarMask ? "active" : ""}`;
    avatarBtn.textContent = "Avatar Circle";
    avatarBtn.addEventListener("click", () => {
      cropState.isAvatarMask = !cropState.isAvatarMask;
      if (cropState.isAvatarMask) cropState.ratio = "1:1";
      applyCropRatio();
      populateSubToolbar();
    });
    container.appendChild(avatarBtn);

    const divider2 = document.createElement("div");
    divider2.className = "tool-divider";
    container.appendChild(divider2);

    // Apply & Cancel
    const applyBtn = document.createElement("button");
    applyBtn.className = "btn btn-primary";
    applyBtn.style.height = "28px";
    applyBtn.style.fontSize = "12px";
    applyBtn.textContent = "Apply Crop";
    applyBtn.addEventListener("click", executeCrop);
    container.appendChild(applyBtn);

    const cancelBtn = document.createElement("button");
    cancelBtn.className = "btn";
    cancelBtn.style.height = "28px";
    cancelBtn.style.fontSize = "12px";
    cancelBtn.textContent = "Cancel";
    cancelBtn.addEventListener("click", () => selectTool(null));
    container.appendChild(cancelBtn);
  }

  function initCropBox() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;
    const w = item.currentCanvas.width;
    const h = item.currentCanvas.height;
    cropState.rect = {
      x: Math.round(w * 0.1),
      y: Math.round(h * 0.1),
      w: Math.round(w * 0.8),
      h: Math.round(h * 0.8),
    };
    applyCropRatio();
  }

  function applyCropRatio() {
    const r = cropState.ratio;
    if (r === "free") return;

    let targetRatio = 1;
    if (r === "1:1") targetRatio = 1;
    else if (r === "4:3") targetRatio = 4 / 3;
    else if (r === "16:9") targetRatio = 16 / 9;
    else if (r === "3:2") targetRatio = 3 / 2;
    else if (r === "9:16") targetRatio = 9 / 16;

    const currentW = cropState.rect.w;
    cropState.rect.h = Math.round(currentW / targetRatio);

    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (item && item.currentCanvas) {
      if (cropState.rect.y + cropState.rect.h > item.currentCanvas.height) {
        cropState.rect.h = item.currentCanvas.height - cropState.rect.y;
        cropState.rect.w = Math.round(cropState.rect.h * targetRatio);
      }
    }
    if (window.EditorCanvas) window.EditorCanvas.render();
  }

  function executeCrop() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;

    const rx = Math.max(0, Math.round(cropState.rect.x));
    const ry = Math.max(0, Math.round(cropState.rect.y));
    const rw = Math.min(
      item.currentCanvas.width - rx,
      Math.round(cropState.rect.w),
    );
    const rh = Math.min(
      item.currentCanvas.height - ry,
      Math.round(cropState.rect.h),
    );

    if (rw <= 0 || rh <= 0) return;

    const croppedCanvas = document.createElement("canvas");
    croppedCanvas.width = rw;
    croppedCanvas.height = rh;
    const ctx = croppedCanvas.getContext("2d");

    if (cropState.isAvatarMask) {
      ctx.save();
      ctx.beginPath();
      ctx.arc(rw / 2, rh / 2, Math.min(rw, rh) / 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(item.currentCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
      ctx.restore();
    } else {
      ctx.drawImage(item.currentCanvas, rx, ry, rw, rh, 0, 0, rw, rh);
    }

    item.currentCanvas = croppedCanvas;
    pushHistorySnapshot();
    selectTool(null);
  }

  // B. Transform Sub Toolbar (Rotate & Flip)
  function buildTransformSubToolbar(container) {
    const actions = [
      { label: "90° CW", fn: () => rotateCanvas(90) },
      { label: "90° CCW", fn: () => rotateCanvas(-90) },
      { label: "180°", fn: () => rotateCanvas(180) },
      { label: "Flip Horiz", fn: () => flipCanvas(true, false) },
      { label: "Flip Vert", fn: () => flipCanvas(false, true) },
    ];

    actions.forEach((a) => {
      const btn = document.createElement("button");
      btn.className = "tool-btn";
      btn.textContent = a.label;
      btn.addEventListener("click", a.fn);
      container.appendChild(btn);
    });
  }

  function rotateCanvas(degrees) {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;

    const src = item.currentCanvas;
    const rad = (degrees * Math.PI) / 180;
    const sin = Math.abs(Math.sin(rad));
    const cos = Math.abs(Math.cos(rad));

    const newW = Math.round(src.width * cos + src.height * sin);
    const newH = Math.round(src.width * sin + src.height * cos);

    const rotated = document.createElement("canvas");
    rotated.width = newW;
    rotated.height = newH;
    const ctx = rotated.getContext("2d");

    ctx.translate(newW / 2, newH / 2);
    ctx.rotate(rad);
    ctx.drawImage(src, -src.width / 2, -src.height / 2);

    item.currentCanvas = rotated;
    pushHistorySnapshot();
    if (window.EditorCanvas) window.EditorCanvas.fitToScreen();
  }

  function flipCanvas(horizontal, vertical) {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;

    const src = item.currentCanvas;
    const flipped = document.createElement("canvas");
    flipped.width = src.width;
    flipped.height = src.height;
    const ctx = flipped.getContext("2d");

    ctx.save();
    ctx.translate(horizontal ? src.width : 0, vertical ? src.height : 0);
    ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
    ctx.drawImage(src, 0, 0);
    ctx.restore();

    item.currentCanvas = flipped;
    pushHistorySnapshot();
  }

  // C. Filter Sub Toolbar
  function buildFilterSubToolbar(container) {
    const presets = [
      { id: "none", label: "Normal" },
      { id: "grayscale", label: "Grayscale" },
      { id: "bw", label: "B & W" },
      { id: "sepia", label: "Sepia" },
      { id: "invert", label: "Invert" },
    ];

    presets.forEach((p) => {
      const btn = document.createElement("button");
      btn.className = `tool-btn ${filterState.preset === p.id ? "active" : ""}`;
      btn.textContent = p.label;
      btn.addEventListener("click", () => {
        filterState.preset = p.id;
        applyFiltersToPreview();
        populateSubToolbar();
      });
      container.appendChild(btn);
    });

    const divider = document.createElement("div");
    divider.className = "tool-divider";
    container.appendChild(divider);

    // Brightness Slider
    const bSpan = document.createElement("span");
    bSpan.className = "tool-label";
    bSpan.textContent = "Bright:";
    container.appendChild(bSpan);

    const bInput = document.createElement("input");
    bInput.type = "range";
    bInput.min = "-100";
    bInput.max = "100";
    bInput.value = filterState.brightness;
    bInput.className = "tool-input-slider";
    bInput.addEventListener("input", (e) => {
      filterState.brightness = parseInt(e.target.value, 10);
      applyFiltersToPreview();
    });
    container.appendChild(bInput);

    // Contrast Slider
    const cSpan = document.createElement("span");
    cSpan.className = "tool-label";
    cSpan.textContent = "Contrast:";
    container.appendChild(cSpan);

    const cInput = document.createElement("input");
    cInput.type = "range";
    cInput.min = "-100";
    cInput.max = "100";
    cInput.value = filterState.contrast;
    cInput.className = "tool-input-slider";
    cInput.addEventListener("input", (e) => {
      filterState.contrast = parseInt(e.target.value, 10);
      applyFiltersToPreview();
    });
    container.appendChild(cInput);

    // Saturation Slider
    const sSpan = document.createElement("span");
    sSpan.className = "tool-label";
    sSpan.textContent = "Sat:";
    container.appendChild(sSpan);

    const sInput = document.createElement("input");
    sInput.type = "range";
    sInput.min = "-100";
    sInput.max = "100";
    sInput.value = filterState.saturation;
    sInput.className = "tool-input-slider";
    sInput.addEventListener("input", (e) => {
      filterState.saturation = parseInt(e.target.value, 10);
      applyFiltersToPreview();
    });
    container.appendChild(sInput);

    const divider2 = document.createElement("div");
    divider2.className = "tool-divider";
    container.appendChild(divider2);

    const applyBtn = document.createElement("button");
    applyBtn.className = "btn btn-primary";
    applyBtn.style.height = "28px";
    applyBtn.style.fontSize = "12px";
    applyBtn.textContent = "Apply Filters";
    applyBtn.addEventListener("click", commitFilterChanges);
    container.appendChild(applyBtn);

    const resetBtn = document.createElement("button");
    resetBtn.className = "btn";
    resetBtn.style.height = "28px";
    resetBtn.style.fontSize = "12px";
    resetBtn.textContent = "Reset";
    resetBtn.addEventListener("click", resetFilters);
    container.appendChild(resetBtn);
  }

  function initFilterState() {
    filterState.preset = "none";
    filterState.brightness = 0;
    filterState.contrast = 0;
    filterState.saturation = 0;
    filterState.warmth = 0;
  }

  function resetFilters() {
    initFilterState();
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (item && item.historyStack[item.historyIndex]) {
      const ctx = item.currentCanvas.getContext("2d");
      ctx.putImageData(item.historyStack[item.historyIndex], 0, 0);
    }
    populateSubToolbar();
    if (window.EditorCanvas) window.EditorCanvas.render();
  }

  function applyFiltersToPreview() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;

    const baseSnapshot = item.historyStack[item.historyIndex];
    if (!baseSnapshot) return;

    const ctx = item.currentCanvas.getContext("2d");
    const imgData = new ImageData(
      new Uint8ClampedArray(baseSnapshot.data),
      baseSnapshot.width,
      baseSnapshot.height,
    );

    const d = imgData.data;
    const len = d.length;

    const bVal = filterState.brightness * 1.28;
    const cVal = (filterState.contrast + 100) / 100; // factor
    const sVal = (filterState.saturation + 100) / 100;
    const preset = filterState.preset;

    for (let i = 0; i < len; i += 4) {
      let r = d[i];
      let g = d[i + 1];
      let b = d[i + 2];

      // 1. Presets
      if (preset === "grayscale") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = g = b = gray;
      } else if (preset === "bw") {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const bw = gray > 128 ? 255 : 0;
        r = g = b = bw;
      } else if (preset === "sepia") {
        const sr = 0.393 * r + 0.769 * g + 0.189 * b;
        const sg = 0.349 * r + 0.686 * g + 0.168 * b;
        const sb = 0.272 * r + 0.534 * g + 0.131 * b;
        r = sr;
        g = sg;
        b = sb;
      } else if (preset === "invert") {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      // 2. Brightness
      if (bVal !== 0) {
        r += bVal;
        g += bVal;
        b += bVal;
      }

      // 3. Contrast
      if (cVal !== 1) {
        r = (r - 128) * cVal + 128;
        g = (g - 128) * cVal + 128;
        b = (b - 128) * cVal + 128;
      }

      // 4. Saturation
      if (sVal !== 1) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * sVal;
        g = gray + (g - gray) * sVal;
        b = gray + (b - gray) * sVal;
      }

      d[i] = Math.min(255, Math.max(0, r));
      d[i + 1] = Math.min(255, Math.max(0, g));
      d[i + 2] = Math.min(255, Math.max(0, b));
    }

    ctx.putImageData(imgData, 0, 0);
    if (window.EditorCanvas) window.EditorCanvas.render();
  }

  function commitFilterChanges() {
    pushHistorySnapshot();
    selectTool(null);
  }

  // D. Censor Sub Toolbar (Blur & Pixelate)
  function buildCensorSubToolbar(container) {
    const types = [
      { id: "pixelate", label: "Pixelate" },
      { id: "blur", label: "Blur" },
    ];

    types.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = `tool-btn ${censorState.type === t.id ? "active" : ""}`;
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        censorState.type = t.id;
        populateSubToolbar();
      });
      container.appendChild(btn);
    });

    const divider = document.createElement("div");
    divider.className = "tool-divider";
    container.appendChild(divider);

    const modes = [
      { id: "box", label: "Box Selection" },
      { id: "brush", label: "Brush" },
    ];

    modes.forEach((m) => {
      const btn = document.createElement("button");
      btn.className = `tool-btn ${censorState.mode === m.id ? "active" : ""}`;
      btn.textContent = m.label;
      btn.addEventListener("click", () => {
        censorState.mode = m.id;
        populateSubToolbar();
      });
      container.appendChild(btn);
    });

    const divider2 = document.createElement("div");
    divider2.className = "tool-divider";
    container.appendChild(divider2);

    const rSpan = document.createElement("span");
    rSpan.className = "tool-label";
    rSpan.textContent = "Intensity / Radius:";
    container.appendChild(rSpan);

    const rInput = document.createElement("input");
    rInput.type = "range";
    rInput.min = "4";
    rInput.max = "50";
    rInput.value = censorState.radius;
    rInput.className = "tool-input-slider";
    rInput.addEventListener("input", (e) => {
      censorState.radius = parseInt(e.target.value, 10);
    });
    container.appendChild(rInput);
  }

  function applyCensorToRect(rect, type, radius) {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;

    const rx = Math.max(0, Math.min(rect.x, rect.x + rect.w));
    const ry = Math.max(0, Math.min(rect.y, rect.y + rect.h));
    const rw = Math.min(item.currentCanvas.width - rx, Math.abs(rect.w));
    const rh = Math.min(item.currentCanvas.height - ry, Math.abs(rect.h));

    if (rw <= 2 || rh <= 2) return;

    const ctx = item.currentCanvas.getContext("2d");
    const imgData = ctx.getImageData(rx, ry, rw, rh);
    const d = imgData.data;

    if (type === "pixelate") {
      const blockSize = Math.max(4, radius);
      for (let y = 0; y < rh; y += blockSize) {
        for (let x = 0; x < rw; x += blockSize) {
          // Calculate average color in block
          let r = 0,
            g = 0,
            b = 0,
            a = 0,
            count = 0;
          for (let by = 0; by < blockSize && y + by < rh; by++) {
            for (let bx = 0; bx < blockSize && x + bx < rw; bx++) {
              const idx = ((y + by) * rw + (x + bx)) * 4;
              r += d[idx];
              g += d[idx + 1];
              b += d[idx + 2];
              a += d[idx + 3];
              count++;
            }
          }
          r = Math.round(r / count);
          g = Math.round(g / count);
          b = Math.round(b / count);
          a = Math.round(a / count);

          // Fill block with average
          for (let by = 0; by < blockSize && y + by < rh; by++) {
            for (let bx = 0; bx < blockSize && x + bx < rw; bx++) {
              const idx = ((y + by) * rw + (x + bx)) * 4;
              d[idx] = r;
              d[idx + 1] = g;
              d[idx + 2] = b;
              d[idx + 3] = a;
            }
          }
        }
      }
    } else {
      // Box blur
      const passes = 3;
      const bRad = Math.max(2, Math.floor(radius / 3));
      for (let p = 0; p < passes; p++) {
        boxBlurH(d, rw, rh, bRad);
        boxBlurT(d, rw, rh, bRad);
      }
    }

    ctx.putImageData(imgData, rx, ry);
    pushHistorySnapshot();
  }

  function boxBlurH(scl, w, h, r) {
    const arr = new Uint8ClampedArray(scl);
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        let valR = 0,
          valG = 0,
          valB = 0,
          valA = 0,
          count = 0;
        for (let ix = j - r; ix <= j + r; ix++) {
          if (ix >= 0 && ix < w) {
            const idx = (i * w + ix) * 4;
            valR += arr[idx];
            valG += arr[idx + 1];
            valB += arr[idx + 2];
            valA += arr[idx + 3];
            count++;
          }
        }
        const curIdx = (i * w + j) * 4;
        scl[curIdx] = valR / count;
        scl[curIdx + 1] = valG / count;
        scl[curIdx + 2] = valB / count;
        scl[curIdx + 3] = valA / count;
      }
    }
  }

  function boxBlurT(scl, w, h, r) {
    const arr = new Uint8ClampedArray(scl);
    for (let i = 0; i < h; i++) {
      for (let j = 0; j < w; j++) {
        let valR = 0,
          valG = 0,
          valB = 0,
          valA = 0,
          count = 0;
        for (let iy = i - r; iy <= i + r; iy++) {
          if (iy >= 0 && iy < h) {
            const idx = (iy * w + j) * 4;
            valR += arr[idx];
            valG += arr[idx + 1];
            valB += arr[idx + 2];
            valA += arr[idx + 3];
            count++;
          }
        }
        const curIdx = (i * w + j) * 4;
        scl[curIdx] = valR / count;
        scl[curIdx + 1] = valG / count;
        scl[curIdx + 2] = valB / count;
        scl[curIdx + 3] = valA / count;
      }
    }
  }

  // E. Brush Sub Toolbar
  function buildBrushSubToolbar(container) {
    const types = [
      { id: "freehand", label: "Freehand" },
      { id: "line", label: "Line" },
      { id: "arrow", label: "Arrow" },
      { id: "star", label: "Star" },
    ];

    types.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = `tool-btn ${brushState.type === t.id ? "active" : ""}`;
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        brushState.type = t.id;
        populateSubToolbar();
      });
      container.appendChild(btn);
    });

    const divider = document.createElement("div");
    divider.className = "tool-divider";
    container.appendChild(divider);

    // Color Swatch Trigger
    const colorBtn = document.createElement("button");
    colorBtn.className = "tool-btn";
    colorBtn.id = "activeColorBtn";
    colorBtn.style.backgroundColor = currentColor;
    colorBtn.style.border = "2px solid #fff";
    colorBtn.style.width = "24px";
    colorBtn.style.height = "24px";
    colorBtn.style.borderRadius = "50%";
    colorBtn.title = "Change Color & Opacity";
    colorBtn.addEventListener("click", () => toggleColorPicker(colorBtn));
    container.appendChild(colorBtn);

    // Size Slider
    const sizeSpan = document.createElement("span");
    sizeSpan.className = "tool-label";
    sizeSpan.textContent = "Size:";
    container.appendChild(sizeSpan);

    const sizeInput = document.createElement("input");
    sizeInput.type = "range";
    sizeInput.min = "1";
    sizeInput.max = "100";
    sizeInput.value = brushState.size;
    sizeInput.className = "tool-input-slider";
    sizeInput.addEventListener("input", (e) => {
      brushState.size = parseInt(e.target.value, 10);
    });
    container.appendChild(sizeInput);
  }

  // F. Text & Emoji Sub Toolbar
  function buildTextSubToolbar(container) {
    const input = document.createElement("input");
    input.type = "text";
    input.value = textState.text;
    input.style.height = "26px";
    input.style.background = "var(--bg-surface)";
    input.style.border = "1px solid var(--border-color)";
    input.style.color = "#fff";
    input.style.borderRadius = "4px";
    input.style.padding = "0 6px";
    input.style.fontSize = "12px";
    input.style.width = "140px";
    input.addEventListener("input", (e) => {
      textState.text = e.target.value;
      if (window.EditorCanvas) window.EditorCanvas.render();
    });
    container.appendChild(input);

    // Font Select
    const fontSelect = document.createElement("select");
    fontSelect.className = "tool-select";
    ["sans-serif", "serif", "monospace", "cursive", "Impact"].forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f;
      opt.textContent = f;
      fontSelect.appendChild(opt);
    });
    fontSelect.value = textState.font;
    fontSelect.addEventListener("change", (e) => {
      textState.font = e.target.value;
      if (window.EditorCanvas) window.EditorCanvas.render();
    });
    container.appendChild(fontSelect);

    // Font Size
    const sizeSelect = document.createElement("select");
    sizeSelect.className = "tool-select";
    [16, 24, 32, 40, 48, 64, 80, 100].forEach((s) => {
      const opt = document.createElement("option");
      opt.value = s;
      opt.textContent = s + "px";
      sizeSelect.appendChild(opt);
    });
    sizeSelect.value = textState.size;
    sizeSelect.addEventListener("change", (e) => {
      textState.size = parseInt(e.target.value, 10);
      if (window.EditorCanvas) window.EditorCanvas.render();
    });
    container.appendChild(sizeSelect);

    // Color Swatch
    const colorBtn = document.createElement("button");
    colorBtn.className = "tool-btn";
    colorBtn.id = "activeColorBtn";
    colorBtn.style.backgroundColor = currentColor;
    colorBtn.style.border = "2px solid #fff";
    colorBtn.style.width = "24px";
    colorBtn.style.height = "24px";
    colorBtn.style.borderRadius = "50%";
    colorBtn.title = "Text Color";
    colorBtn.addEventListener("click", () => toggleColorPicker(colorBtn));
    container.appendChild(colorBtn);

    // Bold / Italic
    const boldBtn = document.createElement("button");
    boldBtn.className = `tool-btn ${textState.bold ? "active" : ""}`;
    boldBtn.textContent = "B";
    boldBtn.style.fontWeight = "bold";
    boldBtn.addEventListener("click", () => {
      textState.bold = !textState.bold;
      populateSubToolbar();
      if (window.EditorCanvas) window.EditorCanvas.render();
    });
    container.appendChild(boldBtn);

    const italicBtn = document.createElement("button");
    italicBtn.className = `tool-btn ${textState.italic ? "active" : ""}`;
    italicBtn.textContent = "I";
    italicBtn.style.fontStyle = "italic";
    italicBtn.addEventListener("click", () => {
      textState.italic = !textState.italic;
      populateSubToolbar();
      if (window.EditorCanvas) window.EditorCanvas.render();
    });
    container.appendChild(italicBtn);

    // Fill Plate Badge Toggle
    const bgPlateBtn = document.createElement("button");
    bgPlateBtn.className = `tool-btn ${textState.fillBg ? "active" : ""}`;
    bgPlateBtn.textContent = "Badge BG";
    bgPlateBtn.addEventListener("click", () => {
      textState.fillBg = !textState.fillBg;
      populateSubToolbar();
      if (window.EditorCanvas) window.EditorCanvas.render();
    });
    container.appendChild(bgPlateBtn);

    const divider = document.createElement("div");
    divider.className = "tool-divider";
    container.appendChild(divider);

    // Burn / Rasterize text
    const burnBtn = document.createElement("button");
    burnBtn.className = "btn btn-primary";
    burnBtn.style.height = "28px";
    burnBtn.style.fontSize = "12px";
    burnBtn.textContent = "Burn Text";
    burnBtn.addEventListener("click", burnTextToCanvas);
    container.appendChild(burnBtn);
  }

  function initTextPosition() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (item && item.currentCanvas) {
      textState.x = Math.round(item.currentCanvas.width / 2);
      textState.y = Math.round(item.currentCanvas.height / 2);
    }
  }

  function burnTextToCanvas() {
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas || !textState.text) return;

    const ctx = item.currentCanvas.getContext("2d");
    ctx.save();
    ctx.translate(textState.x, textState.y);
    ctx.rotate((textState.rotation * Math.PI) / 180);

    const fontStyle = `${textState.italic ? "italic " : ""}${textState.bold ? "bold " : ""}${textState.size}px ${textState.font}`;
    ctx.font = fontStyle;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(textState.text);
    const tw = metrics.width;
    const th = textState.size;

    if (textState.fillBg) {
      ctx.fillStyle = textState.bgColor;
      ctx.fillRect(-tw / 2 - 12, -th / 2 - 8, tw + 24, th + 16);
    }

    ctx.fillStyle = currentColor;
    ctx.fillText(textState.text, 0, 0);
    ctx.restore();

    pushHistorySnapshot();
    selectTool(null);
  }

  // G. Shapes Sub Toolbar
  function buildShapesSubToolbar(container) {
    const types = [
      { id: "rect", label: "Rectangle" },
      { id: "rounded-rect", label: "Rounded Rect" },
      { id: "circle", label: "Circle / Ellipse" },
    ];

    types.forEach((t) => {
      const btn = document.createElement("button");
      btn.className = `tool-btn ${shapeState.type === t.id ? "active" : ""}`;
      btn.textContent = t.label;
      btn.addEventListener("click", () => {
        shapeState.type = t.id;
        populateSubToolbar();
      });
      container.appendChild(btn);
    });

    const divider = document.createElement("div");
    divider.className = "tool-divider";
    container.appendChild(divider);

    // Color Swatch
    const colorBtn = document.createElement("button");
    colorBtn.className = "tool-btn";
    colorBtn.id = "activeColorBtn";
    colorBtn.style.backgroundColor = currentColor;
    colorBtn.style.border = "2px solid #fff";
    colorBtn.style.width = "24px";
    colorBtn.style.height = "24px";
    colorBtn.style.borderRadius = "50%";
    colorBtn.title = "Shape Color";
    colorBtn.addEventListener("click", () => toggleColorPicker(colorBtn));
    container.appendChild(colorBtn);

    // Border Width
    const wSpan = document.createElement("span");
    wSpan.className = "tool-label";
    wSpan.textContent = "Border:";
    container.appendChild(wSpan);

    const wInput = document.createElement("input");
    wInput.type = "range";
    wInput.min = "1";
    wInput.max = "40";
    wInput.value = shapeState.strokeWidth;
    wInput.className = "tool-input-slider";
    wInput.addEventListener("input", (e) => {
      shapeState.strokeWidth = parseInt(e.target.value, 10);
    });
    container.appendChild(wInput);

    // Fill Mode
    const fillSelect = document.createElement("select");
    fillSelect.className = "tool-select";
    [
      { id: "none", label: "Transparent Fill" },
      { id: "solid", label: "Solid Fill" },
      { id: "semi", label: "Semi Fill" },
    ].forEach((f) => {
      const opt = document.createElement("option");
      opt.value = f.id;
      opt.textContent = f.label;
      fillSelect.appendChild(opt);
    });
    fillSelect.value = shapeState.fillStyle;
    fillSelect.addEventListener("change", (e) => {
      shapeState.fillStyle = e.target.value;
    });
    container.appendChild(fillSelect);
  }

  // --- 4. Interactive Overlay Renderer Hook ---
  function renderToolOverlays(ctx, viewState) {
    if (!activeTool) return;

    if (activeTool === "crop") {
      renderCropOverlay(ctx, viewState);
    } else if (
      activeTool === "censor" &&
      censorState.mode === "box" &&
      censorState.boxRect
    ) {
      renderCensorBoxOverlay(ctx, viewState);
    } else if (activeTool === "brush" && brushState.isDrawing) {
      renderBrushOverlay(ctx, viewState);
    } else if (activeTool === "text") {
      renderTextOverlay(ctx, viewState);
    } else if (activeTool === "shapes" && shapeState.isDrawing) {
      renderShapeOverlay(ctx, viewState);
    }
  }

  function renderCropOverlay(
    ctx,
    { imageToViewport, imageWidth, imageHeight, viewportWidth, viewportHeight },
  ) {
    const r = cropState.rect;
    const tl = imageToViewport(r.x, r.y);
    const br = imageToViewport(r.x + r.w, r.y + r.h);
    const vx = tl.x;
    const vy = tl.y;
    const vw = br.x - tl.x;
    const vh = br.y - tl.y;

    ctx.save();

    // Darkened scrim overlay outside crop rect
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    ctx.fillRect(0, 0, viewportWidth, vy);
    ctx.fillRect(0, vy + vh, viewportWidth, viewportHeight - (vy + vh));
    ctx.fillRect(0, vy, vx, vh);
    ctx.fillRect(vx + vw, vy, viewportWidth - (vx + vw), vh);

    // Crop box outline
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.strokeRect(vx, vy, vw, vh);

    // Rule of thirds grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vx + vw / 3, vy);
    ctx.lineTo(vx + vw / 3, vy + vh);
    ctx.moveTo(vx + (2 * vw) / 3, vy);
    ctx.lineTo(vx + (2 * vw) / 3, vy + vh);
    ctx.moveTo(vx, vy + vh / 3);
    ctx.lineTo(vx + vw, vy + vh / 3);
    ctx.moveTo(vx, vy + (2 * vh) / 3);
    ctx.lineTo(vx + vw, vy + (2 * vh) / 3);
    ctx.stroke();

    // Avatar circular guide mask
    if (cropState.isAvatarMask) {
      ctx.strokeStyle = "#10b981";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(vx + vw / 2, vy + vh / 2, Math.min(vw, vh) / 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 8 resize handles
    const handleSize = 10;
    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;

    const handles = [
      { x: vx, y: vy },
      { x: vx + vw / 2, y: vy },
      { x: vx + vw, y: vy },
      { x: vx + vw, y: vy + vh / 2 },
      { x: vx + vw, y: vy + vh },
      { x: vx + vw / 2, y: vy + vh },
      { x: vx, y: vy + vh },
      { x: vx, y: vy + vh / 2 },
    ];

    handles.forEach((h) => {
      ctx.fillRect(
        h.x - handleSize / 2,
        h.y - handleSize / 2,
        handleSize,
        handleSize,
      );
      ctx.strokeRect(
        h.x - handleSize / 2,
        h.y - handleSize / 2,
        handleSize,
        handleSize,
      );
    });

    ctx.restore();
  }

  function renderCensorBoxOverlay(ctx, { imageToViewport }) {
    const r = censorState.boxRect;
    if (!r) return;
    const tl = imageToViewport(Math.min(r.x1, r.x2), Math.min(r.y1, r.y2));
    const br = imageToViewport(Math.max(r.x1, r.x2), Math.max(r.y1, r.y2));

    ctx.save();
    ctx.strokeStyle = "#ef4444";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    ctx.restore();
  }

  function renderBrushOverlay(ctx, { imageToViewport, zoom }) {
    if (!brushState.points.length && !brushState.startPoint) return;
    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = Math.max(1, brushState.size * zoom);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (brushState.type === "freehand" && brushState.points.length > 1) {
      ctx.beginPath();
      const p0 = imageToViewport(
        brushState.points[0].x,
        brushState.points[0].y,
      );
      ctx.moveTo(p0.x, p0.y);
      for (let i = 1; i < brushState.points.length; i++) {
        const pt = imageToViewport(
          brushState.points[i].x,
          brushState.points[i].y,
        );
        ctx.lineTo(pt.x, pt.y);
      }
      ctx.stroke();
    } else if (
      brushState.type === "line" &&
      brushState.startPoint &&
      brushState.currentPoint
    ) {
      const p1 = imageToViewport(
        brushState.startPoint.x,
        brushState.startPoint.y,
      );
      const p2 = imageToViewport(
        brushState.currentPoint.x,
        brushState.currentPoint.y,
      );
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();
    } else if (
      brushState.type === "arrow" &&
      brushState.startPoint &&
      brushState.currentPoint
    ) {
      const p1 = imageToViewport(
        brushState.startPoint.x,
        brushState.startPoint.y,
      );
      const p2 = imageToViewport(
        brushState.currentPoint.x,
        brushState.currentPoint.y,
      );
      drawArrow(ctx, p1.x, p1.y, p2.x, p2.y, brushState.size * zoom);
    }
    ctx.restore();
  }

  function drawArrow(ctx, fromX, fromY, toX, toY, size) {
    const headLen = Math.max(12, size * 2);
    const angle = Math.atan2(toY - fromY, toX - fromX);

    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(
      toX - headLen * Math.cos(angle - Math.PI / 6),
      toY - headLen * Math.sin(angle - Math.PI / 6),
    );
    ctx.lineTo(
      toX - headLen * Math.cos(angle + Math.PI / 6),
      toY - headLen * Math.sin(angle + Math.PI / 6),
    );
    ctx.closePath();
    ctx.fill();
  }

  function renderTextOverlay(ctx, { imageToViewport, zoom }) {
    if (!textState.text) return;
    const pos = imageToViewport(textState.x, textState.y);

    ctx.save();
    ctx.translate(pos.x, pos.y);
    ctx.rotate((textState.rotation * Math.PI) / 180);

    const scaledSize = Math.max(10, textState.size * zoom);
    ctx.font = `${textState.italic ? "italic " : ""}${textState.bold ? "bold " : ""}${scaledSize}px ${textState.font}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    const metrics = ctx.measureText(textState.text);
    const tw = metrics.width;
    const th = scaledSize;

    if (textState.fillBg) {
      ctx.fillStyle = textState.bgColor;
      ctx.fillRect(-tw / 2 - 10, -th / 2 - 6, tw + 20, th + 12);
    }

    ctx.fillStyle = currentColor;
    ctx.fillText(textState.text, 0, 0);

    // Bounding interactive box
    ctx.strokeStyle = "#3b82f6";
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    ctx.strokeRect(-tw / 2 - 12, -th / 2 - 8, tw + 24, th + 16);

    // Rotation Handle (top)
    ctx.setLineDash([]);
    ctx.fillStyle = "#10b981";
    ctx.beginPath();
    ctx.arc(0, -th / 2 - 22, 6, 0, Math.PI * 2);
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(0, -th / 2 - 8);
    ctx.lineTo(0, -th / 2 - 16);
    ctx.stroke();

    ctx.restore();
  }

  function renderShapeOverlay(ctx, { imageToViewport, zoom }) {
    if (!shapeState.startPos || !shapeState.currentPos) return;

    const p1 = imageToViewport(shapeState.startPos.x, shapeState.startPos.y);
    const p2 = imageToViewport(
      shapeState.currentPos.x,
      shapeState.currentPos.y,
    );

    const sx = Math.min(p1.x, p2.x);
    const sy = Math.min(p1.y, p2.y);
    const sw = Math.abs(p2.x - p1.x);
    const sh = Math.abs(p2.y - p1.y);

    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = Math.max(1, shapeState.strokeWidth * zoom);
    if (shapeState.strokeStyle === "dashed") ctx.setLineDash([6, 6]);

    if (shapeState.fillStyle === "solid") {
      ctx.fillStyle = currentColor;
    } else if (shapeState.fillStyle === "semi") {
      ctx.fillStyle = currentColor.replace(/[\d.]+\)$/, "0.3)");
    }

    if (shapeState.type === "rect") {
      if (shapeState.fillStyle !== "none") ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeRect(sx, sy, sw, sh);
    } else if (shapeState.type === "rounded-rect") {
      const radius = 12 * zoom;
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, radius);
      if (shapeState.fillStyle !== "none") ctx.fill();
      ctx.stroke();
    } else if (shapeState.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
      if (shapeState.fillStyle !== "none") ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }

  // --- 5. Interactive Mouse/Touch Event Handlers ---
  function onMouseDown(e) {
    if (!activeTool || !window.EditorCanvas) return false;
    const imgCoords = window.EditorCanvas.viewportToImage(e.clientX, e.clientY);

    if (activeTool === "crop") {
      return handleCropMouseDown(imgCoords, e);
    } else if (activeTool === "censor") {
      return handleCensorMouseDown(imgCoords, e);
    } else if (activeTool === "brush") {
      return handleBrushMouseDown(imgCoords, e);
    } else if (activeTool === "text") {
      return handleTextMouseDown(imgCoords, e);
    } else if (activeTool === "shapes") {
      return handleShapeMouseDown(imgCoords, e);
    }

    return false;
  }

  function onMouseMove(e) {
    if (!activeTool || !window.EditorCanvas) return false;
    const imgCoords = window.EditorCanvas.viewportToImage(e.clientX, e.clientY);

    if (activeTool === "crop" && cropState.isDragging) {
      return handleCropMouseMove(imgCoords);
    } else if (activeTool === "censor" && censorState.isInteracting) {
      return handleCensorMouseMove(imgCoords);
    } else if (activeTool === "brush" && brushState.isDrawing) {
      return handleBrushMouseMove(imgCoords);
    } else if (
      activeTool === "text" &&
      (textState.isDragging || textState.isRotating)
    ) {
      return handleTextMouseMove(imgCoords);
    } else if (activeTool === "shapes" && shapeState.isDrawing) {
      return handleShapeMouseMove(imgCoords);
    }

    return false;
  }

  function onMouseUp(e) {
    if (!activeTool) return false;

    if (activeTool === "crop" && cropState.isDragging) {
      cropState.isDragging = false;
      cropState.dragHandle = null;
      return true;
    } else if (activeTool === "censor" && censorState.isInteracting) {
      censorState.isInteracting = false;
      if (censorState.mode === "box" && censorState.boxRect) {
        applyCensorToRect(
          {
            x: Math.min(censorState.boxRect.x1, censorState.boxRect.x2),
            y: Math.min(censorState.boxRect.y1, censorState.boxRect.y2),
            w: Math.abs(censorState.boxRect.x2 - censorState.boxRect.x1),
            h: Math.abs(censorState.boxRect.y2 - censorState.boxRect.y1),
          },
          censorState.type,
          censorState.radius,
        );
        censorState.boxRect = null;
      }
      return true;
    } else if (activeTool === "brush" && brushState.isDrawing) {
      commitBrushStroke();
      return true;
    } else if (
      activeTool === "text" &&
      (textState.isDragging || textState.isRotating)
    ) {
      textState.isDragging = false;
      textState.isRotating = false;
      return true;
    } else if (activeTool === "shapes" && shapeState.isDrawing) {
      commitShape();
      return true;
    }

    return false;
  }

  // --- Tool Event Implementations ---

  function handleCropMouseDown(pos, e) {
    const r = cropState.rect;
    const hitMargin = 16 / window.EditorCanvas.zoom;

    // Check 8 handles
    let handle = null;
    if (Math.abs(pos.x - r.x) < hitMargin && Math.abs(pos.y - r.y) < hitMargin)
      handle = "nw";
    else if (
      Math.abs(pos.x - (r.x + r.w)) < hitMargin &&
      Math.abs(pos.y - r.y) < hitMargin
    )
      handle = "ne";
    else if (
      Math.abs(pos.x - (r.x + r.w)) < hitMargin &&
      Math.abs(pos.y - (r.y + r.h)) < hitMargin
    )
      handle = "se";
    else if (
      Math.abs(pos.x - r.x) < hitMargin &&
      Math.abs(pos.y - (r.y + r.h)) < hitMargin
    )
      handle = "sw";
    else if (
      Math.abs(pos.y - r.y) < hitMargin &&
      pos.x >= r.x &&
      pos.x <= r.x + r.w
    )
      handle = "n";
    else if (
      Math.abs(pos.x - (r.x + r.w)) < hitMargin &&
      pos.y >= r.y &&
      pos.y <= r.y + r.h
    )
      handle = "e";
    else if (
      Math.abs(pos.y - (r.y + r.h)) < hitMargin &&
      pos.x >= r.x &&
      pos.x <= r.x + r.w
    )
      handle = "s";
    else if (
      Math.abs(pos.x - r.x) < hitMargin &&
      pos.y >= r.y &&
      pos.y <= r.y + r.h
    )
      handle = "w";
    else if (
      pos.x >= r.x &&
      pos.x <= r.x + r.w &&
      pos.y >= r.y &&
      pos.y <= r.y + r.h
    )
      handle = "move";

    if (handle) {
      cropState.isDragging = true;
      cropState.dragHandle = handle;
      cropState.startPos = { x: pos.x, y: pos.y };
      cropState.startRect = { ...r };
      return true;
    }

    return false;
  }

  function handleCropMouseMove(pos) {
    const dx = pos.x - cropState.startPos.x;
    const dy = pos.y - cropState.startPos.y;
    const sr = cropState.startRect;

    switch (cropState.dragHandle) {
      case "move":
        cropState.rect.x = sr.x + dx;
        cropState.rect.y = sr.y + dy;
        break;
      case "se":
        cropState.rect.w = Math.max(20, sr.w + dx);
        cropState.rect.h = Math.max(20, sr.h + dy);
        break;
      case "nw":
        cropState.rect.x = sr.x + dx;
        cropState.rect.y = sr.y + dy;
        cropState.rect.w = Math.max(20, sr.w - dx);
        cropState.rect.h = Math.max(20, sr.h - dy);
        break;
      case "ne":
        cropState.rect.y = sr.y + dy;
        cropState.rect.w = Math.max(20, sr.w + dx);
        cropState.rect.h = Math.max(20, sr.h - dy);
        break;
      case "sw":
        cropState.rect.x = sr.x + dx;
        cropState.rect.w = Math.max(20, sr.w - dx);
        cropState.rect.h = Math.max(20, sr.h + dy);
        break;
      case "e":
        cropState.rect.w = Math.max(20, sr.w + dx);
        break;
      case "s":
        cropState.rect.h = Math.max(20, sr.h + dy);
        break;
      case "w":
        cropState.rect.x = sr.x + dx;
        cropState.rect.w = Math.max(20, sr.w - dx);
        break;
      case "n":
        cropState.rect.y = sr.y + dy;
        cropState.rect.h = Math.max(20, sr.h - dy);
        break;
    }

    if (cropState.ratio !== "free") {
      applyCropRatio();
    }
    return true;
  }

  function handleCensorMouseDown(pos) {
    censorState.isInteracting = true;
    if (censorState.mode === "box") {
      censorState.boxRect = { x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y };
    } else {
      applyCensorToRect(
        {
          x: pos.x - censorState.radius / 2,
          y: pos.y - censorState.radius / 2,
          w: censorState.radius,
          h: censorState.radius,
        },
        censorState.type,
        censorState.radius,
      );
    }
    return true;
  }

  function handleCensorMouseMove(pos) {
    if (censorState.mode === "box" && censorState.boxRect) {
      censorState.boxRect.x2 = pos.x;
      censorState.boxRect.y2 = pos.y;
    } else if (censorState.mode === "brush") {
      applyCensorToRect(
        {
          x: pos.x - censorState.radius / 2,
          y: pos.y - censorState.radius / 2,
          w: censorState.radius,
          h: censorState.radius,
        },
        censorState.type,
        censorState.radius,
      );
    }
    return true;
  }

  function handleBrushMouseDown(pos) {
    brushState.isDrawing = true;
    brushState.startPoint = { x: pos.x, y: pos.y };
    brushState.currentPoint = { x: pos.x, y: pos.y };
    brushState.points = [{ x: pos.x, y: pos.y }];
    return true;
  }

  function handleBrushMouseMove(pos) {
    brushState.currentPoint = { x: pos.x, y: pos.y };
    brushState.points.push({ x: pos.x, y: pos.y });
    return true;
  }

  function commitBrushStroke() {
    brushState.isDrawing = false;
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (!item || !item.currentCanvas) return;

    const ctx = item.currentCanvas.getContext("2d");
    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.fillStyle = currentColor;
    ctx.lineWidth = brushState.size;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (brushState.type === "freehand" && brushState.points.length > 0) {
      ctx.beginPath();
      ctx.moveTo(brushState.points[0].x, brushState.points[0].y);
      for (let i = 1; i < brushState.points.length; i++) {
        ctx.lineTo(brushState.points[i].x, brushState.points[i].y);
      }
      ctx.stroke();
    } else if (
      brushState.type === "line" &&
      brushState.startPoint &&
      brushState.currentPoint
    ) {
      ctx.beginPath();
      ctx.moveTo(brushState.startPoint.x, brushState.startPoint.y);
      ctx.lineTo(brushState.currentPoint.x, brushState.currentPoint.y);
      ctx.stroke();
    } else if (
      brushState.type === "arrow" &&
      brushState.startPoint &&
      brushState.currentPoint
    ) {
      drawArrow(
        ctx,
        brushState.startPoint.x,
        brushState.startPoint.y,
        brushState.currentPoint.x,
        brushState.currentPoint.y,
        brushState.size,
      );
    } else if (
      brushState.type === "star" &&
      brushState.startPoint &&
      brushState.currentPoint
    ) {
      const rad = Math.hypot(
        brushState.currentPoint.x - brushState.startPoint.x,
        brushState.currentPoint.y - brushState.startPoint.y,
      );
      drawStar(
        ctx,
        brushState.startPoint.x,
        brushState.startPoint.y,
        5,
        rad,
        rad / 2,
      );
    }

    ctx.restore();
    brushState.points = [];
    brushState.startPoint = null;
    brushState.currentPoint = null;

    pushHistorySnapshot();
  }

  function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
    let rot = (Math.PI / 2) * 3;
    let x = cx;
    let y = cy;
    const step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
      x = cx + Math.cos(rot) * outerRadius;
      y = cy + Math.sin(rot) * outerRadius;
      ctx.lineTo(x, y);
      rot += step;

      x = cx + Math.cos(rot) * innerRadius;
      y = cy + Math.sin(rot) * innerRadius;
      ctx.lineTo(x, y);
      rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  function handleTextMouseDown(pos) {
    // Check rotation handle or drag text
    const dist = Math.hypot(pos.x - textState.x, pos.y - textState.y);
    if (dist < 80) {
      textState.isDragging = true;
      textState.dragOffset = { x: pos.x - textState.x, y: pos.y - textState.y };
      return true;
    }
    return false;
  }

  function handleTextMouseMove(pos) {
    if (textState.isDragging) {
      textState.x = pos.x - textState.dragOffset.x;
      textState.y = pos.y - textState.dragOffset.y;
      return true;
    }
    return false;
  }

  function handleShapeMouseDown(pos) {
    shapeState.isDrawing = true;
    shapeState.startPos = { x: pos.x, y: pos.y };
    shapeState.currentPos = { x: pos.x, y: pos.y };
    return true;
  }

  function handleShapeMouseMove(pos) {
    shapeState.currentPos = { x: pos.x, y: pos.y };
    return true;
  }

  function commitShape() {
    shapeState.isDrawing = false;
    const item = window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
    if (
      !item ||
      !item.currentCanvas ||
      !shapeState.startPos ||
      !shapeState.currentPos
    )
      return;

    const ctx = item.currentCanvas.getContext("2d");
    const p1 = shapeState.startPos;
    const p2 = shapeState.currentPos;

    const sx = Math.min(p1.x, p2.x);
    const sy = Math.min(p1.y, p2.y);
    const sw = Math.abs(p2.x - p1.x);
    const sh = Math.abs(p2.y - p1.y);

    if (sw < 2 || sh < 2) return;

    ctx.save();
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = shapeState.strokeWidth;
    if (shapeState.strokeStyle === "dashed") ctx.setLineDash([8, 8]);

    if (shapeState.fillStyle === "solid") {
      ctx.fillStyle = currentColor;
    } else if (shapeState.fillStyle === "semi") {
      ctx.fillStyle = currentColor.replace(/[\d.]+\)$/, "0.3)");
    }

    if (shapeState.type === "rect") {
      if (shapeState.fillStyle !== "none") ctx.fillRect(sx, sy, sw, sh);
      ctx.strokeRect(sx, sy, sw, sh);
    } else if (shapeState.type === "rounded-rect") {
      ctx.beginPath();
      ctx.roundRect(sx, sy, sw, sh, 16);
      if (shapeState.fillStyle !== "none") ctx.fill();
      ctx.stroke();
    } else if (shapeState.type === "circle") {
      ctx.beginPath();
      ctx.ellipse(sx + sw / 2, sy + sh / 2, sw / 2, sh / 2, 0, 0, Math.PI * 2);
      if (shapeState.fillStyle !== "none") ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
    shapeState.startPos = null;
    shapeState.currentPos = null;

    pushHistorySnapshot();
  }

  // Touch wrappers mapping directly to mouse methods
  function onTouchStart(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      return onMouseDown({
        clientX: touch.clientX,
        clientY: touch.clientY,
        button: 0,
      });
    }
    return false;
  }

  function onTouchMove(e) {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      return onMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
    }
    return false;
  }

  function onTouchEnd(e) {
    return onMouseUp({});
  }

  return {
    get activeTool() {
      return activeTool;
    },
    get currentColor() {
      return currentColor;
    },
    init,
    selectTool,
    undo,
    redo,
    pushHistorySnapshot,
    updateHistoryButtons,
    onMouseDown,
    onMouseMove,
    onMouseUp,
    onTouchStart,
    onTouchMove,
    onTouchEnd,
  };
})();
