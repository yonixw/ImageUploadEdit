/**
 * Image Editor - AI Background Blur
 * Tap the item(s) to keep sharp; everything else gets blurred.
 * Uses MediaPipe Interactive Segmenter (magic_touch model), loaded lazily from
 * jsDelivr + Google Storage the first time the tool is opened. Runs fully in the
 * browser — the image never leaves the device.
 */

window.EditorBgBlur = (function () {
  const MP_VERSION = "0.10.35";
  const MP_BASE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MP_VERSION}`;
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/1/magic_touch.tflite";

  // Segmentation runs on a downscaled copy; the mask is upscaled (and softened) on apply
  const SEG_MAX_DIM = 1024;

  let segmenter = null;
  let loadPromise = null;
  let status = "idle"; // 'idle' | 'loading' | 'ready' | 'error'
  let isBusy = false;

  const state = {
    mode: "add", // 'add' | 'remove'
    strength: 25, // slider 0..100, mapped to a blur radius by blurRadiusFor()
    item: null,
    versionKey: null, // history snapshot the mask was computed against
    segCanvas: null,
    mask: null, // Float32Array at segCanvas resolution, 1 = keep sharp
    overlayCanvas: null,
    points: [], // { x, y, add, mask } in image coordinates; mask = that tap's result
  };

  const MAX_BLUR_FRACTION = 0.25;

  const KEEP_COLOR = "#10b981";
  const REMOVE_COLOR = "#ef4444";

  // --- Model loading ---
  function ensureLoaded() {
    if (segmenter) return Promise.resolve(segmenter);
    if (loadPromise) return loadPromise;

    status = "loading";
    loadPromise = (async () => {
      const vision = await import(`${MP_BASE}/vision_bundle.mjs`);
      const fileset = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      const create = (delegate) =>
        vision.InteractiveSegmenter.createFromOptions(fileset, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate },
          outputCategoryMask: false,
          outputConfidenceMasks: true,
        });
      try {
        segmenter = await create("GPU");
      } catch (e) {
        console.warn("[BgBlur] GPU delegate failed, falling back to CPU", e);
        segmenter = await create("CPU");
      }
      status = "ready";
      refreshToolbar();
      return segmenter;
    })().catch((err) => {
      console.error("[BgBlur] Failed to load segmenter", err);
      status = "error";
      loadPromise = null;
      refreshToolbar();
      toast(t("bgblur.loadFailed"));
      throw err;
    });

    refreshToolbar();
    return loadPromise;
  }

  // --- Session (mask) bookkeeping ---
  function getItem() {
    return window.EditorQueue ? window.EditorQueue.getActiveItem() : null;
  }

  function currentVersionKey(item) {
    return item.historyStack[item.historyIndex];
  }

  function resetSelection() {
    state.item = null;
    state.versionKey = null;
    state.segCanvas = null;
    state.mask = null;
    state.overlayCanvas = null;
    state.points = [];
  }

  // Drop the selection if the image was switched or edited since it was made
  function syncWithItem() {
    const item = getItem();
    if (
      !item ||
      state.item !== item ||
      state.versionKey !== currentVersionKey(item)
    ) {
      resetSelection();
    }
    return item;
  }

  function prepareSession(item) {
    const src = item.currentCanvas;
    const scale = Math.min(1, SEG_MAX_DIM / Math.max(src.width, src.height));
    const seg = document.createElement("canvas");
    seg.width = Math.max(1, Math.round(src.width * scale));
    seg.height = Math.max(1, Math.round(src.height * scale));
    const sctx = seg.getContext("2d");
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(src, 0, 0, seg.width, seg.height);

    state.item = item;
    state.versionKey = currentVersionKey(item);
    state.segCanvas = seg;
    state.mask = new Float32Array(seg.width * seg.height);
    state.points = [];
  }

  // Union of "keep" taps minus "remove" taps, applied in tap order
  function recomputeMask() {
    const m = state.mask;
    m.fill(0);
    for (const p of state.points) {
      const d = p.mask;
      if (p.add) {
        for (let i = 0; i < m.length; i++) {
          const v = d[i] / 255;
          if (v > m[i]) m[i] = v;
        }
      } else {
        for (let i = 0; i < m.length; i++) m[i] = Math.min(m[i], 1 - d[i] / 255);
      }
    }
    if (state.points.some((p) => p.add)) rebuildOverlay();
    else state.overlayCanvas = null;
  }

  function undoLastTap() {
    if (isBusy || !state.points.length) return;
    state.points.pop();
    if (!state.points.length) resetSelection();
    else recomputeMask();
    refreshToolbar();
    if (window.EditorCanvas) window.EditorCanvas.render();
  }

  // Same look as the tap markers drawn on the canvas
  function markerIconSvg(add) {
    const bar = add ? "M8 12h8M12 8v8" : "M8 12h8";
    return (
      `<svg viewBox="0 0 24 24" aria-hidden="true">` +
      `<circle cx="12" cy="12" r="9" fill="${add ? KEEP_COLOR : REMOVE_COLOR}" stroke="#ffffff" stroke-width="2"/>` +
      `<path d="${bar}" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none"/>` +
      `</svg>`
    );
  }

  // --- Segmentation ---
  function segmentAt(seg, nx, ny) {
    return new Promise((resolve, reject) => {
      try {
        segmenter.segment(seg, { keypoint: { x: nx, y: ny } }, (result) => {
          const masks = result.confidenceMasks || [];
          if (!masks.length) return resolve(null);
          // Masks are only valid inside the callback, so copy the data out.
          // Pick whichever mask is "high" at the tapped point (the foreground).
          const w = masks[0].width;
          const h = masks[0].height;
          const idx =
            Math.min(h - 1, Math.floor(ny * h)) * w +
            Math.min(w - 1, Math.floor(nx * w));
          let best = null;
          for (const m of masks) {
            const data = m.getAsFloat32Array();
            if (!best || data[idx] > best[idx]) best = data;
          }
          let out = new Float32Array(best);
          if (out[idx] < 0.5) out = out.map((v) => 1 - v);
          resolve({ data: out, width: w, height: h });
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  async function handleTap(pos) {
    const item = syncWithItem();
    if (!item || isBusy) return;
    const w = item.currentCanvas.width;
    const h = item.currentCanvas.height;
    if (pos.x < 0 || pos.y < 0 || pos.x >= w || pos.y >= h) return;

    if (status !== "ready") {
      if (status === "error") ensureLoaded().catch(() => {});
      toast(t("bgblur.stillLoading"));
      return;
    }

    if (!state.mask) prepareSession(item);
    const add = state.mode === "add";
    if (!add && !state.points.some((p) => p.add)) {
      toast(t("bgblur.addFirst"));
      return;
    }

    isBusy = true;
    refreshToolbar();
    try {
      const res = await segmentAt(state.segCanvas, pos.x / w, pos.y / h);
      // The image may have changed while the model was running
      if (!res || state.item !== item || !state.mask) return;
      if (
        res.width !== state.segCanvas.width ||
        res.height !== state.segCanvas.height
      ) {
        console.warn("[BgBlur] Unexpected mask size", res.width, res.height);
        return;
      }

      // Keep each tap's own mask (8-bit is plenty) so taps can be undone
      const tapMask = new Uint8Array(res.data.length);
      for (let i = 0; i < tapMask.length; i++) {
        tapMask[i] = Math.round(res.data[i] * 255);
      }
      state.points.push({ x: pos.x, y: pos.y, add, mask: tapMask });
      recomputeMask();
    } catch (e) {
      console.error("[BgBlur] Segmentation failed", e);
      toast(t("bgblur.segmentFailed"));
    } finally {
      isBusy = false;
      refreshToolbar();
      if (window.EditorCanvas) window.EditorCanvas.render();
    }
  }

  function blurRadiusFor(w, h) {
    // Squared curve: fine control over subtle blurs at the low end,
    // 0 = no blur, 100 = radius of a quarter of the image (nearly one color)
    const s = state.strength / 100;
    return Math.max(w, h) * MAX_BLUR_FRACTION * s * s;
  }

  // Live preview: the blurred background (computed at segmentation resolution)
  // with the kept subject cut out, drawn over the full-res image. The subject
  // therefore shows through at full quality.
  function rebuildOverlay() {
    const seg = state.segCanvas;
    const c = document.createElement("canvas");
    c.width = seg.width;
    c.height = seg.height;
    const ctx = c.getContext("2d");
    ctx.drawImage(blurredCopy(seg, blurRadiusFor(seg.width, seg.height)), 0, 0);
    ctx.globalCompositeOperation = "destination-out";
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(maskToAlphaCanvas(), 0, 0);
    state.overlayCanvas = c;
  }

  // Coalesce rapid slider input into one rebuild per frame
  let previewFrame = 0;
  function schedulePreview() {
    if (previewFrame || !state.mask || !state.points.some((p) => p.add)) return;
    previewFrame = requestAnimationFrame(() => {
      previewFrame = 0;
      if (!state.mask) return;
      rebuildOverlay();
      if (window.EditorCanvas) window.EditorCanvas.render();
    });
  }

  // Mask as an alpha-only canvas at segmentation resolution
  function maskToAlphaCanvas() {
    const seg = state.segCanvas;
    const c = document.createElement("canvas");
    c.width = seg.width;
    c.height = seg.height;
    const ctx = c.getContext("2d");
    const img = ctx.createImageData(c.width, c.height);
    const px = img.data;
    const m = state.mask;
    for (let i = 0, j = 3; i < m.length; i++, j += 4) {
      px[j] = Math.round(m[i] * 255);
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }

  // --- Applying the blur ---
  function blurredCopy(src, radius) {
    const w = src.width;
    const h = src.height;
    const supportsFilter = "filter" in document.createElement("canvas").getContext("2d");

    // Blur a downscaled copy (fast even for 12MP photos), then upscale.
    // The small copy is padded with a stretched version of the image so the
    // blur doesn't pull transparent pixels in from the borders.
    // Small radii blur at full size; larger ones downscale so the inner blur stays ≤ 6px
    const k = Math.max(1, radius / (supportsFilter ? 6 : 2));
    const innerBlur = supportsFilter ? radius / k : 0;
    const sw = Math.max(2, Math.round(w / k));
    const sh = Math.max(2, Math.round(h / k));
    const pad = Math.ceil(innerBlur * 3);

    const small = document.createElement("canvas");
    small.width = sw + pad * 2;
    small.height = sh + pad * 2;
    const sctx = small.getContext("2d");
    sctx.imageSmoothingQuality = "high";
    sctx.drawImage(src, 0, 0, small.width, small.height);
    sctx.drawImage(src, pad, pad, sw, sh);

    let source = small;
    if (supportsFilter) {
      const blurred = document.createElement("canvas");
      blurred.width = small.width;
      blurred.height = small.height;
      const bctx = blurred.getContext("2d");
      bctx.filter = `blur(${innerBlur}px)`;
      bctx.drawImage(small, 0, 0);
      source = blurred;
    }

    const out = document.createElement("canvas");
    out.width = w;
    out.height = h;
    const octx = out.getContext("2d");
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = "high";
    octx.drawImage(source, pad, pad, sw, sh, 0, 0, w, h);
    return out;
  }

  function applyBlur() {
    const item = syncWithItem();
    if (!item || !state.mask || !state.points.some((p) => p.add)) {
      toast(t("bgblur.addFirst"));
      return;
    }

    const src = item.currentCanvas;
    const w = src.width;
    const h = src.height;
    const radius = blurRadiusFor(w, h);

    const background = blurredCopy(src, radius);

    // Subject layer: original pixels, alpha = upscaled + slightly feathered mask
    const subject = document.createElement("canvas");
    subject.width = w;
    subject.height = h;
    const sctx = subject.getContext("2d");
    sctx.imageSmoothingEnabled = true;
    sctx.imageSmoothingQuality = "high";
    if ("filter" in sctx) {
      sctx.filter = `blur(${Math.max(1, Math.round(Math.max(w, h) / 1000))}px)`;
    }
    sctx.drawImage(maskToAlphaCanvas(), 0, 0, w, h);
    sctx.filter = "none";
    sctx.globalCompositeOperation = "source-in";
    sctx.drawImage(src, 0, 0);

    const ctx = src.getContext("2d", { willReadFrequently: true });
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(background, 0, 0);
    ctx.drawImage(subject, 0, 0);
    ctx.restore();

    resetSelection();
    if (window.EditorTools) window.EditorTools.pushHistorySnapshot();
    refreshToolbar();
  }

  // --- Sub toolbar ---
  function buildSubToolbar(container) {
    syncWithItem();
    // Retry after an error happens on the next tap, not on every rebuild
    if (status === "idle") ensureLoaded().catch(() => {});

    const statusSpan = document.createElement("span");
    statusSpan.className = "tool-label";
    if (status === "loading") statusSpan.textContent = t("bgblur.loading");
    else if (status === "error") statusSpan.textContent = t("bgblur.loadFailed");
    else if (isBusy) statusSpan.textContent = t("bgblur.working");
    else statusSpan.textContent = t("bgblur.hint");
    container.appendChild(statusSpan);

    const divider = document.createElement("div");
    divider.className = "tool-divider";
    container.appendChild(divider);

    [
      { id: "add", label: t("bgblur.keep") },
      { id: "remove", label: t("bgblur.remove") },
    ].forEach((m) => {
      const btn = document.createElement("button");
      btn.className = `tool-btn ${state.mode === m.id ? "active" : ""}`;
      btn.innerHTML = markerIconSvg(m.id === "add");
      const label = document.createElement("span");
      label.textContent = m.label;
      btn.appendChild(label);
      btn.addEventListener("click", () => {
        state.mode = m.id;
        refreshToolbar();
      });
      container.appendChild(btn);
    });

    const undoBtn = document.createElement("button");
    undoBtn.className = "tool-btn";
    undoBtn.title = t("bgblur.undoTap");
    undoBtn.setAttribute("aria-label", t("bgblur.undoTap"));
    undoBtn.innerHTML =
      '<svg viewBox="0 0 24 24"><path d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z"/></svg>';
    undoBtn.disabled = !state.points.length || isBusy;
    undoBtn.addEventListener("click", undoLastTap);
    container.appendChild(undoBtn);

    const divider2 = document.createElement("div");
    divider2.className = "tool-divider";
    container.appendChild(divider2);

    const sLabel = document.createElement("span");
    sLabel.className = "tool-label";
    sLabel.textContent = t("bgblur.strength");
    container.appendChild(sLabel);

    const sInput = document.createElement("input");
    sInput.type = "range";
    sInput.min = "0";
    sInput.max = "100";
    sInput.style.width = "135px";
    sInput.value = state.strength;
    sInput.className = "tool-input-slider";
    sInput.addEventListener("input", (e) => {
      state.strength = parseInt(e.target.value, 10);
      schedulePreview();
    });
    container.appendChild(sInput);

    const divider3 = document.createElement("div");
    divider3.className = "tool-divider";
    container.appendChild(divider3);

    const hasSelection = state.points.some((p) => p.add);

    const clearBtn = document.createElement("button");
    clearBtn.className = "tool-btn";
    clearBtn.textContent = t("bgblur.clear");
    clearBtn.disabled = !state.points.length;
    clearBtn.addEventListener("click", () => {
      resetSelection();
      refreshToolbar();
      if (window.EditorCanvas) window.EditorCanvas.render();
    });
    container.appendChild(clearBtn);

    const applyBtn = document.createElement("button");
    applyBtn.className = "btn btn-primary";
    applyBtn.textContent = t("bgblur.apply");
    applyBtn.disabled = !hasSelection || isBusy;
    applyBtn.addEventListener("click", applyBlur);
    container.appendChild(applyBtn);
  }

  function refreshToolbar() {
    if (window.EditorTools && window.EditorTools.activeTool === "bgblur") {
      window.EditorTools.refreshSubToolbar();
    }
  }

  // --- Overlay ---
  function renderOverlay(ctx, { imageToViewport, imageWidth, imageHeight }) {
    const item = getItem();
    if (!item || state.item !== item || state.versionKey !== currentVersionKey(item)) {
      return;
    }

    const tl = imageToViewport(0, 0);
    const br = imageToViewport(imageWidth, imageHeight);

    ctx.save();
    if (state.overlayCanvas) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(state.overlayCanvas, tl.x, tl.y, br.x - tl.x, br.y - tl.y);
    }

    state.points.forEach((p) => {
      const v = imageToViewport(p.x, p.y);
      ctx.beginPath();
      ctx.arc(v.x, v.y, 9, 0, Math.PI * 2);
      ctx.fillStyle = p.add ? KEEP_COLOR : REMOVE_COLOR;
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(v.x - 4, v.y);
      ctx.lineTo(v.x + 4, v.y);
      if (p.add) {
        ctx.moveTo(v.x, v.y - 4);
        ctx.lineTo(v.x, v.y + 4);
      }
      ctx.stroke();
    });
    ctx.restore();
  }

  // --- Pointer ---
  function onPointerDown(pos) {
    handleTap(pos);
    return true;
  }

  function toast(msg) {
    if (window.EditorUpload) window.EditorUpload.showToast(msg);
  }

  return {
    buildSubToolbar,
    renderOverlay,
    onPointerDown,
  };
})();
