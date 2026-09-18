# Task Breakdown: Standalone Image Uploader & Editor (`editor.html` & `example_using_editor.html`)

Based on specification [`plans/v1-TODO-18092026.md`](plans/v1-TODO-18092026.md), this document outlines a step-by-step implementation plan that can be executed sequentially, item by item.

---

## Architecture & File Structure Overview

* **[`editor.html`](editor.html):** Main self-contained / modular image editor application.
* **[`js/editor_host.js`](js/editor_host.js):** Host communication bridge (`postMessage`, `opener`/`parent` callbacks, query params, tokens).
* **[`js/editor_upload.js`](js/editor_upload.js):** File/folder ingestion, drag & drop, clipboard paste, camera stream & device selector, SVG rasterizer.
* **[`js/editor_queue.js`](js/editor_queue.js):** Queue manager, thumbnail grid, image state, status indicators.
* **[`js/editor_canvas.js`](js/editor_canvas.js):** Dual-layer canvas viewport, coordinate mapping, pan/zoom (10%-1000%), touch pinch/pan.
* **[`js/editor_tools.js`](js/editor_tools.js):** Editing tools (Crop + Avatar mask, Rotate/Flip, Filters, Blur/Pixelate, Brush, Text/Emoji, Shapes, Color Picker, Undo/Redo).
* **[`js/editor_export.js`](js/editor_export.js):** Format conversion (WebP, JPEG, PNG), live file-size meter, max-dimension downscaler, batch exporter.
* **[`js/editor_main.js`](js/editor_main.js):** Main controller, UI event wiring, toolbar overflow scroll managers, tab navigation.
* **[`example_using_editor.html`](example_using_editor.html):** Host integration test harness demonstrating Popup, Iframe modal, `postMessage`, and `edited_upload` callbacks.

---

## Phase 1: Project Setup & Core Shell Layout

- [ ] **Task 1.1: Create HTML structure in [`editor.html`](editor.html)**
  - Establish strict single-column vertical layout container.
  - Setup Header with Mode Tabs: `Upload`, `List / Gallery`, `Edit`, and `Upload All & Done` action button.
  - Setup Toolbar 1 (Primary tools) container with Left (`<`) and Right (`>`) scroll overflow arrow buttons.
  - Setup Toolbar 2 (Contextual sub-tools / options) container with Left (`<`) and Right (`>`) scroll overflow arrow buttons.
  - Setup Main Viewport container (configured for 60%–80% viewport height).
  - Setup Compact Status Bar container at bottom with label-free format (`100%, 1920x1080, 412KB`).

- [ ] **Task 1.2: Base Responsive CSS Styling**
  - Implement zero-dependency styling using CSS variables (dark theme / clean UI).
  - Ensure mobile & desktop responsiveness without unwanted page-level scrolling during canvas operations.
  - Implement smooth horizontal scrolling for toolbars and auto-visibility logic for scroll arrows (`<` / `>`) using `ResizeObserver` / scroll listeners.

---

## Phase 2: Host Communication & Integration Bridge

- [ ] **Task 2.1: Implement [`js/editor_host.js`](js/editor_host.js)**
  - Parse URL query parameters (`token`, `autoClose`, `format`, `maxSize`, `quality`).
  - Send handshake on initialization: `window.opener?.postMessage({ type: 'EDITOR_READY', token }, '*')` and `window.parent?.postMessage(...)`.
  - Implement `sendImageItem(payload)` handling:
    1. Direct callback check: `window.opener.edited_upload(payload)`, `window.parent.edited_upload(payload)`, or `window.edited_upload(payload)`.
    2. `postMessage` fallback: `target.postMessage({ type: 'IMAGE_UPLOAD_ITEM', payload }, '*')`.
    3. Standalone browser fallback (local file download when no opener/parent exists).
  - Implement `sendDone()` dispatching `{ type: 'EDITOR_DONE', token }` and executing `window.close()` if configured.
  - Listen for inbound host events (`INIT`, `UPLOAD_STATUS`).

---

## Phase 3: Ingestion & Input Pipeline

- [ ] **Task 3.1: Standard File & Folder Ingestion in [`js/editor_upload.js`](js/editor_upload.js)**
  - File picker `<input type="file" multiple accept="image/*,.svg,.webp,.png,.jpeg,.jpg">`.
  - Folder picker `<input type="file" webkitdirectory directory>`.
  - Batch confirmation modal: if selected files count > 10, prompt user with "Proceed" and "Cancel" buttons.

- [ ] **Task 3.2: Drag & Drop and Clipboard Paste Handlers**
  - Animated visual drop overlay scrim on `dragover` / `dragenter`.
  - Recursive folder traversal via `DataTransferItem.webkitGetAsEntry()` / `FileSystemDirectoryReader`.
  - Batch confirmation safeguard for dropped folders with > 10 files.
  - Global clipboard `paste` event listener decoding pasted image data from screenshots or other tabs.

- [ ] **Task 3.3: Camera Capture with Device Switching**
  - Camera modal with live `<video playsinline autoplay>` feed.
  - Enumerate media devices via `navigator.mediaDevices.enumerateDevices()` filtered for `videoinput`.
  - Device switcher dropdown and front/back toggle (`facingMode: 'user' | 'environment'`).
  - Shutter snapshot capture converting current video frame directly to offscreen canvas and queue.
  - Support torch toggle and zoom slider if media track capabilities permit.

- [ ] **Task 3.4: Vector SVG & Image Format In-Memory Rasterization**
  - Support raster formats (`image/jpeg`, `image/png`, `image/webp`, `image/bmp`, `image/gif`).
  - Native in-memory vector SVG rasterization via offscreen `<canvas>` and Data URL decoding.

---

## Phase 4: Multi-Image Queue & Gallery Management

- [ ] **Task 4.1: State Management in [`js/editor_queue.js`](js/editor_queue.js)**
  - Maintain `items: Array<EditorItem>` with `id`, `name`, `originalCanvas`, `currentCanvas`, `thumbnailUrl`, `historyStack`, `historyIndex`, `status`, `exportSettings`.
  - Thumbnail generator creating downscaled preview for the Gallery/List view.

- [ ] **Task 4.2: Gallery View & Navigation**
  - Render thumbnail grid with status badges (Pending, Editing, Uploading spinner, Done checkmark, Error).
  - Item selection to switch active image into Edit mode.
  - Item deletion and clear-all actions.
  - Mode tab switching (`Upload` -> `List / Gallery` -> `Edit`).

---

## Phase 5: Canvas Viewport & Navigation Engine

- [ ] **Task 5.1: Dual-Layer Canvas Engine in [`js/editor_canvas.js`](js/editor_canvas.js)**
  - Backing buffer canvas (exact pixel data).
  - Interactive display viewport canvas (handles, transforms, guides, overlays).
  - Dynamic viewport sizing accommodating 60%–80% viewport height with automatic resize management.

- [ ] **Task 5.2: Zoom & Pan System**
  - Zoom range from 10% to 1000% via mouse wheel, toolbar zoom buttons (+, -, 1:1, Fit), and multi-touch pinch.
  - Pan navigation via middle-click drag, Space+Left click drag, or two-finger touch pan.
  - Real-time coordinate transformation between screen/viewport coordinates and image pixel coordinates.

---

## Phase 6: Editing Tools Implementation

- [ ] **Task 6.1: Color Chooser Module in [`js/editor_tools.js`](js/editor_tools.js)**
  - 16-color preset swatches.
  - Recent 8 colors stored in `localStorage`.
  - Full-range HEX / RGB / HSV sliders and Alpha/Transparency slider (0.00 to 1.00).
  - Eye-dropper sampler (`window.EyeDropper` API with canvas pixel fallback).

- [ ] **Task 6.2: History Manager (Undo / Redo)**
  - Manage snapshot stack (max 5–10 steps per item).
  - Undo / Redo buttons and keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y` / `Ctrl+Shift+Z`).

- [ ] **Task 6.3: Crop & Masking Tool**
  - Aspect ratio presets: Freeform, 1:1, 4:3, 16:9, 3:2, 9:16.
  - Darkened outer scrim overlay.
  - Circular / Avatar guide mask inside 1:1 crop mode.
  - Rule-of-thirds grid lines.
  - Interactive 8-point corner/edge resize handles with touch hit-box expansion (min 44px).
  - Apply & Cancel crop operations.

- [ ] **Task 6.4: Transform Tool (Rotate & Flip)**
  - 90° Clockwise and Counter-Clockwise rotation.
  - 180° rotation.
  - Horizontal flip and Vertical flip.
  - Dynamic backing canvas dimension recalculation.

- [ ] **Task 6.5: Color Adjustments & Preset Filters**
  - Presets: Grayscale, High-Contrast Black & White, Sepia/Vintage, Invert.
  - Dynamic adjustment sliders: Brightness, Contrast, Saturation, Warmth.
  - Real-time preview with Commit/Revert options.

- [ ] **Task 6.6: Privacy Censor Tool (Blur & Pixelate)**
  - Pixelate down-sampling filter across brush radius or bounding box.
  - Gaussian / Box blur filter across brush radius or bounding box.
  - Obfuscation while preserving surrounding aesthetic tone.

- [ ] **Task 6.7: Brush & Annotation Tool**
  - Freehand drawing with adjustable brush size (1px to 100px) and opacity.
  - Quick stamp/arrow markers (Arrow, Line, Star, Circle, Rectangle).
  - Stroked vs Solid filled mode.

- [ ] **Task 6.8: Text & Emoji Tool**
  - Add customizable text/emoji layer.
  - Move, scale handle, and rotate handle.
  - Font family, size, bold/italic, text color, background fill badge, stroke/shadow.
  - Rasterize / Burn text into active canvas layer.

- [ ] **Task 6.9: Vector Shapes Tool**
  - Rectangle, Rounded Rectangle, Ellipse/Circle.
  - Border styles (Solid, Dashed, Dotted), border width, border color.
  - Fill options (Transparent, Solid color, Semi-transparent).

---

## Phase 7: Export, Compression & Status Bar

- [ ] **Task 7.1: Live File Size Calculator & Compression in [`js/editor_export.js`](js/editor_export.js)**
  - Format selectors: WebP, JPEG, PNG.
  - Quality slider (1% to 100%).
  - Max dimension downscaling constraint (e.g., downscale to 1920px max edge).
  - Real-time asynchronous byte estimation via `canvas.toBlob()`.

- [ ] **Task 7.2: Compact Status Bar Readout**
  - Minimalist label-free readout formatted strictly as: `100%, 1920x1080, 412KB`.
  - Automatic updates on zoom, image switch, canvas modification, or quality slider change.

- [ ] **Task 7.3: Batch Upload / Export Execution**
  - "Upload All & Done" processing pipeline: iterating through queue items, applying individual export settings, dispatching through HostBridge, updating thumbnail statuses, and closing/signaling completion.

---

## Phase 8: Main App Controller & Integration

- [ ] **Task 8.1: Controller Assembly in [`js/editor_main.js`](js/editor_main.js) & [`editor.html`](editor.html)**
  - Wire all modules together (`HostBridge`, `InputHandler`, `QueueManager`, `CanvasViewport`, `ToolEngine`, `Exporter`).
  - Connect toolbar UI interactions and contextual Toolbar 2 sub-tool switching.
  - Keyboard shortcut manager (`Ctrl+Z`, `Ctrl+Y`, `Space`, `Delete`, `Esc`, etc.).
  - Ensure zero external dependencies (embed scripts or reference local modules).

---

## Phase 9: Host Example Application

- [ ] **Task 9.1: Create [`example_using_editor.html`](example_using_editor.html)**
  - **Popup Mode Integration:** Button to trigger `window.open('editor.html?token=demo123', 'ImageEditor', 'width=1100,height=800')`.
  - **Iframe / Modal Integration:** Button to embed `editor.html` in a modal dialog.
  - **Callback Implementation:** Define `window.edited_upload = function(payload) { ... }` logging payload and displaying uploaded images in a host gallery.
  - **Message Listener:** Implement `window.addEventListener('message', ...)` to handle `EDITOR_READY`, `IMAGE_UPLOAD_ITEM`, and `EDITOR_DONE`.
  - **Status Feedback Demo:** Send mock `UPLOAD_STATUS` events back to the editor.

---

## Phase 10: Verification & Acceptance Testing

- [ ] **Task 10.1: Functional Testing**
  - Verify strict single-column layout across desktop & mobile resolutions.
  - Verify horizontal toolbars with `<` and `>` scroll overflow indicators.
  - Test file picker, folder upload (>10 confirmation prompt), drag & drop, clipboard paste, and camera switcher.
  - Test all editing tools: Crop (with circle mask), Rotate/Flip, Filters, Censor, Brush, Text/Emoji, Shapes, Color Picker, Undo/Redo.
  - Test live file size readout and format conversion.
  - Test popup and iframe integration flows in [`example_using_editor.html`](example_using_editor.html).
