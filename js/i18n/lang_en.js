/**
 * English (source of truth). Every key used by the editor must exist here;
 * other languages fall back to these strings for any key they are missing.
 */
window.EditorI18n.register("en", {
  // App / header
  "app.documentTitle": "Image Uploader & Editor",
  "header.title": "Image Editor",
  "header.uploadImage": "Upload Image",
  "header.uploadImage.tooltip": "Upload this image",
  "header.uploadAll": "Upload All",
  "header.uploadAll.tooltip": "Export & upload batch",
  "common.close": "Close",
  "common.cancel": "Cancel",
  "common.reset": "Reset",
  "common.size": "Size:",
  "nav.scrollLeft": "Scroll left",
  "nav.scrollRight": "Scroll right",

  // Mode tabs
  "tabs.addMore": "Add more",
  "tabs.addMore.tooltip": "Add More Images",
  "tabs.gallery": "Gallery",
  "tabs.gallery.tooltip": "View Image Queue",
  "tabs.edit": "Edit",
  "tabs.edit.tooltip": "Active Editor",

  // Primary toolbar
  "tools.undo.tooltip": "Undo (Ctrl+Z)",
  "tools.redo.tooltip": "Redo (Ctrl+Y)",
  "tools.crop": "Crop",
  "tools.crop.tooltip": "Crop & Mask",
  "tools.transform": "Rotate & Flip",
  "tools.transform.tooltip": "Rotate & Flip",
  "tools.filter": "Filters",
  "tools.filter.tooltip": "Presets & Adjustments",
  "tools.censor": "Censor",
  "tools.censor.tooltip": "Blur & Pixelate",
  "tools.brush": "Brush",
  "tools.brush.tooltip": "Brush & Pencil",
  "tools.text": "Text & Emoji",
  "tools.text.tooltip": "Text & Emoji",
  "tools.shapes": "Shapes",
  "tools.shapes.tooltip": "Vector Shapes",
  "tools.export": "Quality & Format",
  "tools.export.tooltip": "Export & Quality",
  "tools.selectHint": "Select a tool above to begin editing",

  // Upload view
  "upload.dropHere": "Drop Images or Folders Here",
  "upload.heading": "Add Images to Editor",
  "upload.subheading": "Choose an ingestion method below, or paste from clipboard (Ctrl+V)",
  "upload.dropzone": "Drag & Drop Image Files or Folders Here",
  "upload.supports": "Supports JPG, PNG, WebP, SVG, BMP, GIF",
  "upload.chooseFiles": "Choose Files",
  "upload.chooseFolder": "Choose Folder",
  "upload.useCamera": "Use Camera",

  // Gallery view
  "gallery.title": "Image Queue",
  "gallery.clearAll": "Clear All",
  "gallery.confirmClearAll": "Are you sure you want to remove all images from the queue?",
  "gallery.removeImage": "Remove Image",
  "gallery.status.done": "Done",
  "gallery.status.uploading": "Uploading",
  "gallery.status.error": "Error",

  // Status bar
  "status.centerFit": "Center / Fit",
  "status.centerFit.tooltip": "Center & Fit image to screen",
  "status.zoom100.tooltip": "100% Zoom (Actual Size)",
  "status.zoomIn.tooltip": "Zoom In (+)",
  "status.zoomOut.tooltip": "Zoom Out (-)",
  "status.maxResize": "Max resize",

  // Batch confirm modal
  "batch.title": "Batch Ingestion Safeguard",
  "batch.message": "You selected {count} images. Loading and rendering a large batch may take some memory. Do you want to proceed?",
  "batch.proceed": "Proceed",

  // Camera modal
  "camera.title": "Capture Photo",
  "camera.switch": "Switch Camera",
  "camera.snap": "Snap Photo",
  "camera.device": "Camera {n}",

  // Color picker
  "color.palette": "PALETTE",
  "color.recent": "RECENT COLORS",
  "color.opacity": "Opacity",

  // Toasts
  "toast.noValidImages": "No valid image files found.",
  "toast.loadedFromClipboard_one": "Loaded {count} image from clipboard",
  "toast.loadedFromClipboard_other": "Loaded {count} images from clipboard",
  "toast.photoCaptured": "Photo captured and added to queue",
  "toast.cameraUnsupported": "Camera not supported in this browser.",
  "toast.cameraDenied": "Camera access denied or unavailable.",
  "toast.loaded_one": "Loaded {count} image",
  "toast.loaded_other": "Loaded {count} images",
  "toast.uploadFirst": "Please upload or capture an image first.",
  "toast.noActiveImage": "No active image to upload.",
  "toast.uploadedOne": "Image \"{name}\" uploaded successfully",
  "toast.uploadFailed": "Failed to upload image.",
  "toast.noImages": "No images to upload.",
  "toast.processed_one": "Successfully processed {count} image",
  "toast.processed_other": "Successfully processed {count} images",

  // Export / quality sub-toolbar
  "export.format": "Format:",
  "export.format.webp": "WebP (Recommended)",
  "export.format.jpeg": "JPEG",
  "export.format.png": "PNG (Lossless)",
  "export.quality": "Quality ({pct}%):",
  "export.maxResize": "Max Resize:",
  "export.max.0": "Original (No limit)",
  "export.max.150": "150px - Square Thumb / Icon",
  "export.max.300": "300px - Avatar / Profile (1:1)",
  "export.max.600": "600px - Small / Card",
  "export.max.1080": "1080px - Medium / Web",
  "export.max.1200": "1200px - Social Media Landscape",
  "export.max.1920": "1920px - Full HD (16:9)",
  "export.max.2560": "2560px - 2K QHD",
  "export.previewOn": "✓ Preview: ON",
  "export.previewOff": "👁 Preview Quality",
  "export.preview.tooltip": "Toggle live preview of compressed & resized output",
  "export.uploading": "Uploading...",
  "export.processing": "Processing...",

  // Crop
  "crop.free": "Free",
  "crop.square": "1:1 Square",
  "crop.avatar": "Avatar Circle",
  "crop.apply": "Apply Crop",

  // Transform
  "transform.cw": "90° CW",
  "transform.ccw": "90° CCW",
  "transform.flipH": "Flip Horiz",
  "transform.flipV": "Flip Vert",
  "transform.freeRotate": "Free Rotate:",
  "transform.bg": "BG:",
  "transform.bg.transparent": "Transparent",
  "transform.bg.white": "White",
  "transform.bg.black": "Black",
  "transform.apply": "Apply Rotate",

  // Filters
  "filter.normal": "Normal",
  "filter.grayscale": "Grayscale",
  "filter.bw": "B & W",
  "filter.sepia": "Sepia",
  "filter.invert": "Invert",
  "filter.brightness": "Bright:",
  "filter.contrast": "Contrast:",
  "filter.saturation": "Sat:",
  "filter.apply": "Apply Filters",

  // Censor
  "censor.pixelate": "Pixelate",
  "censor.blur": "Blur",
  "censor.box": "Box Selection",
  "censor.brush": "Brush",
  "censor.freehandIn": "Freehand-In",
  "censor.freehandOut": "Freehand-Out",
  "censor.radius": "Intensity / Radius:",

  // Brush
  "brush.color.tooltip": "Change Color & Opacity",

  // Text
  "text.default": "Double click or edit text",
  "text.color.tooltip": "Text Color",
  "text.bold.tooltip": "Bold",
  "text.italic.tooltip": "Italic",
  "text.badge": "Badge BG",
  "text.rotate": "Rotate:",
  "text.rotate.tooltip": "Rotate Text (0° to 360°)",
  "text.rotateMinus.tooltip": "Rotate -45°",
  "text.rotatePlus.tooltip": "Rotate +45°",
  "text.rotateReset.tooltip": "Reset Rotation to 0°",
  "text.burn": "Burn Text",

  // Shapes
  "shapes.rect": "Rectangle",
  "shapes.roundedRect": "Rounded Rect",
  "shapes.circle": "Circle / Ellipse",
  "shapes.line": "Line",
  "shapes.arrow": "Arrow",
  "shapes.star": "Star",
  "shapes.color.tooltip": "Shape Color",
  "shapes.border": "Border:",
  "shapes.fill.none": "Transparent Fill",
  "shapes.fill.solid": "Solid Fill",
  "shapes.fill.semi": "Semi Fill",
});
