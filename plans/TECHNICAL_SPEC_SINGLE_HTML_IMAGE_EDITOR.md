# Technical Specification: Standalone Single-File Image Uploader & Editor (`image-editor.html`)

## 1. Overview & Architecture

### 1.1 Objective
Deliver a single, zero-dependency, self-contained HTML5 file (`image-editor.html`) encompassing HTML, CSS, and vanilla JavaScript. The application can run standalone, in an iframe, or as a popup window/tab invoked by any parent host web application to acquire, batch-process, edit, and return optimized images.

### 1.2 Target Compatibility & Constraints
* **Target Platforms:** Modern evergreen desktop browsers (Chrome, Firefox, Safari, Edge) and mobile browsers (iOS Safari, Android Chrome).
* **Zero External Dependencies:** No external CDNs, JS libraries, or remote CSS files. All icons must be inline SVGs or Unicode/Canvas drawings.
* **Client-Side Only Processing:** All decoding, rasterization, filtering, manipulation, and encoding operate in memory via HTML5 Canvas 2D API.

---

## 2. Host Communication & Pluggable Integration Contract

### 2.1 Invocation Modes
1. **Popup / New Tab:** Opened via `window.open('image-editor.html', 'ImageEditor', '...')`.
2. **Iframe / Modal Dialog:** Embedded directly in host page DOM.
3. **Standalone Direct Access:** Operates with built-in download/fallback export when running without a host frame.

### 2.2 Host Protocol Specification
The editor establishes bi-directional communication using `window.postMessage` and direct `window.opener` / `window.parent` callback fallback inspection:

```typescript
// Payload sent to host per uploaded image
interface EditedImagePayload {
  id: string;              // Unique item identifier
  index: number;           // Queue index
  token?: string;          // Session/Context token passed in query string (?token=xyz)
  name: string;            // File name (e.g. "photo-edited.webp")
  mimeType: string;        // "image/jpeg" | "image/png" | "image/webp"
  blob: Blob;              // Binary image blob
  dataUrl: string;         // Base64 data URL
  width: number;           // Final width in px
  height: number;          // Final height in px
  fileSize: number;        // Size in bytes
}

// Host message events
type HostInboundMessage = 
  | { action: 'INIT'; token?: string; config?: EditorConfig }
  | { action: 'UPLOAD_STATUS'; id: string; status: 'NONE' | 'PROGRESS' | 'DONE' | 'ERROR'; progress?: number };
```

#### Dispatch Flow:
1. Parse query parameters on load (e.g., `?token=abc&autoClose=true&format=webp&maxSize=2048`).
2. Dispatch handshake on ready:
   * `window.opener?.postMessage({ type: 'EDITOR_READY', token }, '*')`
   * `window.parent?.postMessage({ type: 'EDITOR_READY', token }, '*')`
3. When returning an edited image:
   * **Callback Method:** Check and invoke `window.opener.edited_upload(payload)` or `window.parent.edited_upload(payload)` or `window.edited_upload(payload)`.
   * **PostMessage Method:** `target.postMessage({ type: 'IMAGE_UPLOAD_ITEM', payload }, '*')`.
   * **Async Polling / Status Check:** Support asynchronous progress polling: `opener.upload(payload)` and check state via `opener.check(id)`.
4. When finished / batch completed:
   * Dispatch `type: 'EDITOR_DONE'` and optionally trigger `window.close()` if configured.

---

## 3. UI/UX Layout Structure

A responsive, touch-friendly UI adapting to both desktop split-panes and mobile vertical layouts:

```
+-------------------------------------------------------------------------+
| [Header] Logo/Title | Token / Session Info | [Upload All & Done] [Close] |
+------------------+----------------------------------+-------------------+
| [Gallery Drawer] | [Main Viewport Canvas]           | [Primary Toolbar] |
| - Thumb 1 [Del]  |                                  | - Crop            |
| - Thumb 2 (Active| - Interactive Canvas Layer       | - Rotate/Flip     |
| - Thumb 3 [Prog] | - Pan & Pinch/Wheel Zoom overlay | - Filters         |
|                  | - Marquee / Crop HUD             | - Brush & Shapes  |
| [+ Add Files]    | - Text & Stamp Transform HUD     | - Censor / Blur   |
| [+ Camera]       |                                  | - Text / Emoji    |
|                  |                                  | - Quality / Export|
|                  |----------------------------------| - Undo / Redo     |
|                  | [Secondary Contextual Toolbar]   |                   |
|                  | (Dynamic controls for active op) |                   |
+------------------+----------------------------------+-------------------+
| [Status Bar] Zoom: 100% | Dimensions: 1920x1080 | Est Size: 412 KB      |
+-------------------------------------------------------------------------+
```

---

## 4. Module & Feature Specifications

### 4.1 Ingestion & Input Pipeline
* **File Upload:** `<input type="file" multiple accept="image/*,.svg,.webp,.png,.jpeg,.jpg">`.
* **Folder Upload:** `<input type="file" webkitdirectory directory>`.
  * *Constraint Check:* If files count > 10, display a confirmation dialog showing count with "Proceed" and "Cancel" buttons.
* **Drag & Drop Upload:**
  * Global and gallery-specific drag-and-drop zone with animated visual drop overlay scrim on `dragover` / `dragenter`.
  * Supports dropping single or multiple image files as well as dropped folders (traversing entries recursively via `DataTransferItem.webkitGetAsEntry()` / `FileSystemDirectoryReader`).
  * Enforces the same > 10 files batch confirmation safeguard when dragging folders.
  * Clipboard paste support (`paste` event listener on document) to instantly ingest images copied from screenshot tools or other tabs.
* **Camera Capture with Device Switcher:**
  * Modal/Sheet interface enumerating media devices via `navigator.mediaDevices.enumerateDevices()`.
  * Filter for `kind === 'videoinput'`.
  * Provide dropdown/toggle for front/back cameras (`facingMode: 'user' | 'environment'`) and discrete device IDs.
  * Preview `<video playsinline autoplay>` stream with snap shutter button, torch toggle (if supported by track capabilities), and zoom slider (if supported by track `zoom` constraint).
  * Convert snapped frame to Canvas and append to queue.
* **Vector & Standard Format Decoding:**
  * Support `image/jpeg`, `image/png`, `image/webp`, `image/bmp`, `image/gif`, `image/svg+xml`.
  * For SVG: Read as text/DataURL, draw onto an off-screen `HTMLCanvasElement` at natural or bounded viewport dimensions to rasterize fully in-memory without external libraries.

### 4.2 Multi-Image Queue & Gallery Management
* Maintain queue state `items: Array<EditorItem>` where each item maintains:
  * `id`: Unique UUID.
  * `name`: Source filename.
  * `originalCanvas`: Source resolution raster buffer.
  * `currentCanvas`: Active edited raster buffer.
  * `thumbnailUrl`: Downscaled preview URL for the sidebar.
  * `historyStack`: Array of `ImageData` snapshots for undo/redo (max depth: 5-10).
  * `historyIndex`: Pointer to active historical state.
  * `status`: `'PENDING' | 'EDITING' | 'UPLOADING' | 'DONE' | 'ERROR'`.
  * `exportSettings`: Target format, quality ratio, resize limits.
* Visual indicators on thumbnails:
  * Active selection highlight.
  * Uploading status spinner indicator overlay.
  * Done (checkmark) and delete badge.

### 4.3 Viewport, Zoom & Pan Navigation
* **Hardware-Accelerated Interaction:** Dual-layer canvas architecture:
  1. *Backing Buffer Canvas:* Maintains exact pixel data of the image.
  2. *Display Viewport Canvas:* Renders zoomed/panned view with overlays (guides, masks, handles).
* **Zoom:** 10% to 1000% scale via mouse wheel, zoom buttons (+ / - / 1:1 / Fit), and multi-touch pinch-to-zoom.
* **Pan:** Middle-click drag, Space+Left click drag, or two-finger touch pan.

### 4.4 Editing Tools & Functionalities

#### A. Crop & Masking Tool
* **Ratios:** Freeform, 1:1, 4:3, 16:9, 3:2, 9:16.
* **Visual Masks:** 
  * Darkened outer scrim overlay.
  * Circle / Avatar guide mask inside 1:1 crop box (ideal for profile photos).
  * Rule-of-thirds grid lines.
* Interactive 8-point corner/edge resize handles with touch hit-box expansion (min 44px).

#### B. Transform (Rotate & Flip)
* 90° Clockwise and Counter-Clockwise rotation.
* 180° rotation.
* Flip Horizontal and Flip Vertical.
* Auto-canvas dimension recalculation on 90°/270° orientation changes.

#### C. Color Palette & Image Adjustments
* **Preset Filters:**
  * Grayscale: Luminance weighted `0.299R + 0.587G + 0.114B`.
  * High-Contrast Black & White: Threshold binarization.
  * Sepia / Vintage: Warm matrix color transform + vignette gradient.
  * Invert: `255 - channel`.
* **Dynamic Sliders:** Brightness, Contrast, Saturation, Warmth.

#### D. Privacy Censor / Blur / Pixelate
* **Pixelate Tool:** Grid down-sampling filter across brush radius or selected bounding rectangle.
* **Gaussian / Box Blur Tool:** Smooth blurring over sensitive data (credit cards, faces, license plates).
* Keeps surrounding tone intact while obfuscating text and details.

#### E. Brush & Annotation Drawing
* Freehand drawing with customizable brush size (1px to 100px) and opacity.
* Stamp / Shape tools: Circle, Rectangle, Square, Star, Arrow, Straight Line.
* Stroked vs Solid Filled modes.

#### F. Text & Emoji Engine
* Add text layer with Unicode / Emoji support.
* Drag to position, scale handle, rotate handle.
* Custom font family, font size, bold/italic, text color, background fill plate, text stroke/shadow.
* "Apply / Rasterize" button to burn text into active canvas layer.

#### G. Vector Shapes
* Rectangle, Rounded Rectangle, Ellipse/Circle.
* Border style (Solid, Dashed, Dotted), border width, border color.
* Fill style (Transparent / None, Solid Color, Semi-transparent).

#### H. Advanced Integrated Color Chooser
* **Palette Swatches:** Standard palette of 16 common web-safe & vibrant colors.
* **Recent Colors Cache:** Stores last 8 used colors in browser `localStorage`.
* **Full Range Picker:** Hex input, HSV/RGB sliders, and Alpha channel / Transparency slider (0.00 to 1.00).
* Eye-dropper color sampler from canvas if `window.EyeDropper` is available, with canvas pixel fallback.

#### I. History Stack (Undo / Redo)
* Snapshot memory management: store raw `ImageData` or compact canvas clones up to 5 steps per image to prevent memory exhaustion on mobile devices.
* Keyboard shortcuts: `Ctrl+Z` (Undo), `Ctrl+Y` / `Ctrl+Shift+Z` (Redo).

### 4.5 Export, Compression & File Size Optimization
* **Live File Size Calculator:** Dynamically measures export byte size via `canvas.toBlob()` asynchronously on quality slider changes.
* **Export Controls:**
  * Format selector: JPEG, WebP, PNG.
  * Quality slider (1% to 100%).
  * Max dimension constraint scaler (e.g. downscale 4K image to 1920px max edge).
* Real-time readouts: "Original: 2.4 MB" -> "Optimized: 284 KB (-88%)".

---

## 5. JavaScript Architecture & Component Breakdown

Single-file structure divided into clear, clean modular classes/namespaces:

```javascript
/* === NAMESPACE: ImageEditorApp === */
const ImageEditor = {
  State: {
    queue: [],
    activeIndex: 0,
    activeTool: null,
    zoom: 1.0,
    pan: { x: 0, y: 0 },
    colorPicker: { currentColor: 'rgba(255,0,0,1)', recentColors: [] },
    config: { token: '', maxBatchWarning: 10 }
  },
  
  Modules: {
    HostBridge: {},      // Handles postMessage, window.opener, iframe protocol
    InputHandler: {},    // Drag-drop, file picker, folder traversal, camera capture
    QueueManager: {},    // Thumbnail list, selection, progress tracking
    CanvasViewport: {},  // Viewport transforms, zoom, pan, event coordinate mapping
    ToolEngine: {        // Individual tool strategies
      Crop: {},
      Transform: {},
      Filters: {},
      Brush: {},
      Censor: {},
      TextEmoji: {},
      Shapes: {}
    },
    ColorPicker: {},     // Palette, alpha slider, localStorage persistence
    HistoryManager: {},  // Undo/Redo stack handling
    Exporter: {}         // Blob generation, size estimation, upload execution
  },

  Init() { /* Setup DOM listeners, check URL params, init camera list, post handshake */ }
};
```

---

## 6. Implementation Checklist & Acceptance Criteria

- [ ] **Cross-Browser & Responsive:** Tested and functional on desktop & mobile screen breakpoints (touch interactions verified).
- [ ] **Zero Dependencies:** Single `.html` file with embedded `<style>` and `<script>`, zero CDN dependencies.
- [ ] **Drag & Drop & Clipboard Ingestion:** Supports drag-and-drop for files and folders (with visual drop target), plus clipboard paste.
- [ ] **Folder Upload & Count Alert:** Prompts user when selecting or dropping folders with > 10 images.
- [ ] **Camera Device Selector:** Streams video from front/back mobile cameras and snaps directly to editor.
- [ ] **Vector SVG Rasterization:** Correctly renders `.svg` into canvas without remote servers.
- [ ] **All Manipulation Tools Function:** Crop (with avatar circle mask), 90° rotate/flip, filters, blur/pixelate censor, brush stamps, text with emoji, geometric shapes.
- [ ] **Color Picker with Alpha & History:** Supports transparency, quick presets, and `localStorage` recent colors.
- [ ] **Real-Time Size Meter:** Shows live bytes estimation as quality slider is adjusted.
- [ ] **Host Integration:** Implements `postMessage`, `opener.edited_upload`, `opener.upload`, and standalone file download fallbacks.
- [ ] **Undo/Redo:** Retains minimum 5 steps of history per item.
