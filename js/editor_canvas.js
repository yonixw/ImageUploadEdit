/**
 * Image Editor - Canvas Viewport & Navigation Engine
 * Dual-layer canvas system with high-DPI scaling, zoom (10%-1000%), pan, and coordinate mapping.
 */

window.EditorCanvas = (function () {
  let displayCanvas = null;
  let displayCtx = null;
  let wrapper = null;

  let currentItem = null;
  let zoom = 1.0;
  let pan = { x: 0, y: 0 };

  let isSpacePressed = false;
  let isPanning = false;
  let startPan = { x: 0, y: 0 };
  let lastTouchDist = null;
  let lastTouchCenter = null;

  // Custom tool overlay callback hook
  let overlayRenderer = null;

  function init() {
    displayCanvas = document.getElementById("displayCanvas");
    wrapper = document.getElementById("canvasWrapper");
    if (!displayCanvas || !wrapper) return;

    displayCtx = displayCanvas.getContext("2d");

    resize();
    window.addEventListener("resize", resize);

    bindEvents();
  }

  function resize() {
    if (!displayCanvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    displayCanvas.width = rect.width * dpr;
    displayCanvas.height = rect.height * dpr;
    displayCanvas.style.width = rect.width + "px";
    displayCanvas.style.height = rect.height + "px";

    render();
  }

  function loadItem(item) {
    currentItem = item;
    if (!item || !item.currentCanvas) {
      render();
      return;
    }
    fitToScreen();
    render();
    updateStatusBar();
  }

  function clear() {
    currentItem = null;
    zoom = 1.0;
    pan = { x: 0, y: 0 };
    render();
    updateStatusBar();
  }

  function fitToScreen() {
    if (!currentItem || !currentItem.currentCanvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const imgW = currentItem.currentCanvas.width;
    const imgH = currentItem.currentCanvas.height;

    // Leave 40px margin
    const availW = Math.max(50, rect.width - 40);
    const availH = Math.max(50, rect.height - 40);

    const scaleW = availW / imgW;
    const scaleH = availH / imgH;
    zoom = Math.min(scaleW, scaleH, 1.0); // fit within bounds, up to 100%

    // Center image
    pan.x = (rect.width - imgW * zoom) / 2;
    pan.y = (rect.height - imgH * zoom) / 2;

    render();
    updateStatusBar();
  }

  function resetZoom() {
    if (!currentItem || !currentItem.currentCanvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const imgW = currentItem.currentCanvas.width;
    const imgH = currentItem.currentCanvas.height;

    zoom = 1.0;
    pan.x = (rect.width - imgW) / 2;
    pan.y = (rect.height - imgH) / 2;

    render();
    updateStatusBar();
  }

  function setZoom(newZoom, centerX, centerY) {
    newZoom = Math.min(Math.max(newZoom, 0.1), 10.0); // 10% to 1000%
    if (!wrapper) return;
    const rect = wrapper.getBoundingClientRect();

    const cx = centerX !== undefined ? centerX : rect.width / 2;
    const cy = centerY !== undefined ? centerY : rect.height / 2;

    // Preserve cursor focus point
    const imgX = (cx - pan.x) / zoom;
    const imgY = (cy - pan.y) / zoom;

    zoom = newZoom;
    pan.x = cx - imgX * zoom;
    pan.y = cy - imgY * zoom;

    render();
    updateStatusBar();
  }

  /**
   * Convert viewport client coordinate to backing image coordinate
   */
  function viewportToImage(clientX, clientY) {
    if (!wrapper) return { x: 0, y: 0 };
    const rect = wrapper.getBoundingClientRect();
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;

    const imgX = (vx - pan.x) / zoom;
    const imgY = (vy - pan.y) / zoom;
    return { x: imgX, y: imgY };
  }

  /**
   * Convert backing image coordinate to viewport client coordinate
   */
  function imageToViewport(imgX, imgY) {
    const vx = imgX * zoom + pan.x;
    const vy = imgY * zoom + pan.y;
    return { x: vx, y: vy };
  }

  function setOverlayRenderer(fn) {
    overlayRenderer = fn;
    render();
  }

  /**
   * Main viewport render pipeline
   */
  function render() {
    if (!displayCanvas || !displayCtx || !wrapper) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = wrapper.getBoundingClientRect();

    displayCtx.save();
    displayCtx.scale(dpr, dpr);

    // Clear background
    displayCtx.clearRect(0, 0, rect.width, rect.height);

    if (currentItem && currentItem.currentCanvas) {
      const srcCanvas = currentItem.currentCanvas;
      const drawX = Math.round(pan.x);
      const drawY = Math.round(pan.y);
      const drawW = Math.round(srcCanvas.width * zoom);
      const drawH = Math.round(srcCanvas.height * zoom);

      // Draw transparency checkerboard behind image
      drawCheckerboard(displayCtx, drawX, drawY, drawW, drawH);

      // Draw image pixel backing buffer
      displayCtx.imageSmoothingQuality = "high";
      displayCtx.drawImage(srcCanvas, drawX, drawY, drawW, drawH);

      // Draw active tool interactive overlays (crop handles, shapes, text, etc.)
      if (typeof overlayRenderer === "function") {
        overlayRenderer(displayCtx, {
          zoom,
          pan,
          imageWidth: srcCanvas.width,
          imageHeight: srcCanvas.height,
          viewportWidth: rect.width,
          viewportHeight: rect.height,
          imageToViewport,
          viewportToImage,
        });
      }
    }

    displayCtx.restore();
  }

  function drawCheckerboard(ctx, x, y, width, height) {
    const size = 12;
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, width, height);
    ctx.clip();

    ctx.fillStyle = "#1c1f26";
    ctx.fillRect(x, y, width, height);

    ctx.fillStyle = "#252932";
    for (let py = y; py < y + height; py += size) {
      for (let px = x; px < x + width; px += size) {
        if (
          (Math.floor((px - x) / size) + Math.floor((py - y) / size)) % 2 ===
          0
        ) {
          ctx.fillRect(px, py, size, size);
        }
      }
    }
    ctx.restore();
  }

  function updateStatusBar() {
    if (
      window.EditorExport &&
      typeof window.EditorExport.updateStatusBarText === "function"
    ) {
      window.EditorExport.updateStatusBarText();
    }
  }

  // --- Interaction Event Listeners ---
  function bindEvents() {
    // Keyboard Space panning
    window.addEventListener("keydown", (e) => {
      if (e.code === "Space" && !isSpacePressed && !isInputFocused()) {
        isSpacePressed = true;
        wrapper.classList.add("panning");
      }
    });

    window.addEventListener("keyup", (e) => {
      if (e.code === "Space") {
        isSpacePressed = false;
        if (!isPanning) {
          wrapper.classList.remove("panning");
        }
      }
    });

    // Mouse Wheel Zoom
    wrapper.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        const rect = wrapper.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const delta = e.deltaY < 0 ? 1.15 : 0.85;
        setZoom(zoom * delta, cursorX, cursorY);
      },
      { passive: false },
    );

    // Mouse Pan & Interaction Dispatch
    wrapper.addEventListener("mousedown", (e) => {
      const isMiddle = e.button === 1;
      const isLeft = e.button === 0;

      if (isMiddle || (isLeft && isSpacePressed)) {
        isPanning = true;
        startPan = { x: e.clientX - pan.x, y: e.clientY - pan.y };
        wrapper.classList.add("is-panning");
        e.preventDefault();
        return;
      }

      // Pass forward to active tool engine
      if (
        isLeft &&
        window.EditorTools &&
        typeof window.EditorTools.onMouseDown === "function"
      ) {
        const handled = window.EditorTools.onMouseDown(e);
        if (handled) render();
      }
    });

    window.addEventListener("mousemove", (e) => {
      if (isPanning) {
        pan.x = e.clientX - startPan.x;
        pan.y = e.clientY - startPan.y;
        render();
        return;
      }

      if (
        window.EditorTools &&
        typeof window.EditorTools.onMouseMove === "function"
      ) {
        const handled = window.EditorTools.onMouseMove(e);
        if (handled) render();
      }
    });

    window.addEventListener("mouseup", (e) => {
      if (isPanning) {
        isPanning = false;
        wrapper.classList.remove("is-panning");
        if (!isSpacePressed) {
          wrapper.classList.remove("panning");
        }
        return;
      }

      if (
        window.EditorTools &&
        typeof window.EditorTools.onMouseUp === "function"
      ) {
        const handled = window.EditorTools.onMouseUp(e);
        if (handled) render();
      }
    });

    // Touch Pinch-to-zoom and Pan
    wrapper.addEventListener(
      "touchstart",
      (e) => {
        if (e.touches.length === 2) {
          e.preventDefault();
          lastTouchDist = getTouchDistance(e.touches);
          lastTouchCenter = getTouchCenter(e.touches);
        } else if (e.touches.length === 1) {
          if (
            window.EditorTools &&
            typeof window.EditorTools.onTouchStart === "function"
          ) {
            const handled = window.EditorTools.onTouchStart(e);
            if (handled) render();
          }
        }
      },
      { passive: false },
    );

    wrapper.addEventListener(
      "touchmove",
      (e) => {
        if (e.touches.length === 2 && lastTouchDist) {
          e.preventDefault();
          const dist = getTouchDistance(e.touches);
          const center = getTouchCenter(e.touches);
          const scaleChange = dist / lastTouchDist;

          const rect = wrapper.getBoundingClientRect();
          const cx = center.x - rect.left;
          const cy = center.y - rect.top;

          setZoom(zoom * scaleChange, cx, cy);

          // Also Pan with two fingers
          pan.x += center.x - lastTouchCenter.x;
          pan.y += center.y - lastTouchCenter.y;

          lastTouchDist = dist;
          lastTouchCenter = center;
          render();
        } else if (e.touches.length === 1) {
          if (
            window.EditorTools &&
            typeof window.EditorTools.onTouchMove === "function"
          ) {
            const handled = window.EditorTools.onTouchMove(e);
            if (handled) render();
          }
        }
      },
      { passive: false },
    );

    wrapper.addEventListener("touchend", (e) => {
      if (e.touches.length < 2) {
        lastTouchDist = null;
        lastTouchCenter = null;
      }
      if (
        window.EditorTools &&
        typeof window.EditorTools.onTouchEnd === "function"
      ) {
        const handled = window.EditorTools.onTouchEnd(e);
        if (handled) render();
      }
    });
  }

  function getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  function getTouchCenter(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  function isInputFocused() {
    const tag = document.activeElement
      ? document.activeElement.tagName.toLowerCase()
      : "";
    return tag === "input" || tag === "textarea" || tag === "select";
  }

  return {
    get zoom() {
      return zoom;
    },
    get pan() {
      return pan;
    },
    get currentItem() {
      return currentItem;
    },
    init,
    resize,
    loadItem,
    clear,
    render,
    fitToScreen,
    resetZoom,
    setZoom,
    viewportToImage,
    imageToViewport,
    setOverlayRenderer,
  };
})();
