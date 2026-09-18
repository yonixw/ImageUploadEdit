/**
 * Image Editor - Ingestion & Input Pipeline
 * Supports file/folder pickers, drag & drop, clipboard paste, camera capture, and SVG rasterization.
 */

window.EditorUpload = (function () {
  let pendingFilesToProcess = [];
  let cameraStream = null;
  let currentFacingMode = "environment"; // default to back camera

  function init() {
    bindFileInputs();
    bindDragAndDrop();
    bindClipboardPaste();
    bindCameraModal();
    bindBatchConfirmModal();
  }

  // --- 1. File & Folder Input Handlers ---
  function bindFileInputs() {
    const fileInput = document.getElementById("fileInput");
    const folderInput = document.getElementById("folderInput");
    const btnPickFiles = document.getElementById("btnPickFiles");
    const btnPickFolder = document.getElementById("btnPickFolder");
    const dropzoneBox = document.getElementById("dropzoneBox");

    if (btnPickFiles && fileInput) {
      btnPickFiles.addEventListener("click", () => fileInput.click());
    }
    if (dropzoneBox && fileInput) {
      dropzoneBox.addEventListener("click", () => fileInput.click());
    }
    if (btnPickFolder && folderInput) {
      btnPickFolder.addEventListener("click", () => folderInput.click());
    }

    if (fileInput) {
      fileInput.addEventListener("change", (e) => {
        handleFileList(Array.from(e.target.files || []));
        fileInput.value = "";
      });
    }

    if (folderInput) {
      folderInput.addEventListener("change", (e) => {
        handleFileList(Array.from(e.target.files || []));
        folderInput.value = "";
      });
    }
  }

  // --- 2. Batch Ingestion Confirmation Safeguard (> 10 files) ---
  function handleFileList(files) {
    const imageFiles = files.filter((file) => isImageFile(file));
    if (!imageFiles.length) {
      if (files.length > 0) {
        showToast("No valid image files found.");
      }
      return;
    }

    if (imageFiles.length > 10) {
      pendingFilesToProcess = imageFiles;
      showBatchConfirmModal(imageFiles.length);
    } else {
      processFiles(imageFiles);
    }
  }

  function showBatchConfirmModal(count) {
    const modal = document.getElementById("modalBatchConfirm");
    const msg = document.getElementById("batchConfirmMessage");
    if (msg) {
      msg.textContent = `You selected ${count} images. Loading and rendering a large batch may take some memory. Do you want to proceed?`;
    }
    if (modal) modal.classList.add("active");
  }

  function bindBatchConfirmModal() {
    const modal = document.getElementById("modalBatchConfirm");
    const btnProceed = document.getElementById("btnBatchProceed");
    const btnCancel = document.getElementById("btnBatchCancel");

    if (btnProceed) {
      btnProceed.addEventListener("click", () => {
        if (modal) modal.classList.remove("active");
        if (pendingFilesToProcess.length > 0) {
          processFiles(pendingFilesToProcess);
          pendingFilesToProcess = [];
        }
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener("click", () => {
        if (modal) modal.classList.remove("active");
        pendingFilesToProcess = [];
      });
    }
  }

  // --- 3. Drag & Drop Pipeline with Folder Traversal ---
  function bindDragAndDrop() {
    const scrim = document.getElementById("dragScrim");
    const dropzone = document.getElementById("dropzoneBox");
    let dragCounter = 0;

    window.addEventListener("dragenter", (e) => {
      e.preventDefault();
      dragCounter++;
      if (scrim) scrim.classList.add("active");
    });

    window.addEventListener("dragleave", (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        dragCounter = 0;
        if (scrim) scrim.classList.remove("active");
      }
    });

    window.addEventListener("dragover", (e) => {
      e.preventDefault();
    });

    window.addEventListener("drop", async (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (scrim) scrim.classList.remove("active");

      const items = e.dataTransfer.items;
      if (items && items.length > 0) {
        const files = await traverseDataTransferItems(items);
        handleFileList(files);
      } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFileList(Array.from(e.dataTransfer.files));
      }
    });
  }

  async function traverseDataTransferItems(items) {
    const fileList = [];
    const queue = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (typeof item.webkitGetAsEntry === "function") {
        const entry = item.webkitGetAsEntry();
        if (entry) queue.push(entry);
      } else if (item.kind === "file") {
        const file = item.getAsFile();
        if (file) fileList.push(file);
      }
    }

    while (queue.length > 0) {
      const entry = queue.shift();
      if (entry.isFile) {
        const file = await new Promise((resolve) =>
          entry.file(resolve, () => resolve(null)),
        );
        if (file) fileList.push(file);
      } else if (entry.isDirectory) {
        const reader = entry.createReader();
        const entries = await readAllDirectoryEntries(reader);
        for (const subEntry of entries) {
          queue.push(subEntry);
        }
      }
    }

    return fileList;
  }

  async function readAllDirectoryEntries(reader) {
    const entries = [];
    let readBatch = async () => {
      return new Promise((resolve) => {
        reader.readEntries(
          (batch) => {
            resolve(batch);
          },
          () => resolve([]),
        );
      });
    };

    let batch = await readBatch();
    while (batch && batch.length > 0) {
      entries.push(...batch);
      batch = await readBatch();
    }
    return entries;
  }

  // --- 4. Clipboard Paste Handlers ---
  function bindClipboardPaste() {
    window.addEventListener("paste", (e) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;

      const items = clipboardData.items;
      const files = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const file = new File([blob], `pasted-image-${timestamp}.png`, {
              type: blob.type || "image/png",
            });
            files.push(file);
          }
        }
      }

      if (files.length > 0) {
        handleFileList(files);
        showToast(`Loaded ${files.length} image(s) from clipboard`);
      }
    });
  }

  // --- 5. Camera Capture with Device Switching ---
  function bindCameraModal() {
    const btnLaunch = document.getElementById("btnLaunchCamera");
    const modal = document.getElementById("modalCamera");
    const btnClose = document.getElementById("btnCameraClose");
    const btnSnap = document.getElementById("btnCameraSnap");
    const btnFacing = document.getElementById("btnCameraFacing");
    const deviceSelect = document.getElementById("cameraDeviceSelect");
    const video = document.getElementById("cameraVideo");

    if (btnLaunch) {
      btnLaunch.addEventListener("click", async () => {
        if (modal) modal.classList.add("active");
        await enumerateCameraDevices();
        await startCameraStream();
      });
    }

    if (btnClose) {
      btnClose.addEventListener("click", () => {
        stopCameraStream();
        if (modal) modal.classList.remove("active");
      });
    }

    if (btnFacing) {
      btnFacing.addEventListener("click", async () => {
        currentFacingMode =
          currentFacingMode === "user" ? "environment" : "user";
        await startCameraStream();
      });
    }

    if (deviceSelect) {
      deviceSelect.addEventListener("change", async () => {
        await startCameraStream(deviceSelect.value);
      });
    }

    if (btnSnap && video) {
      btnSnap.addEventListener("click", () => {
        if (!video.videoWidth || !video.videoHeight) return;

        const offCanvas = document.createElement("canvas");
        offCanvas.width = video.videoWidth;
        offCanvas.height = video.videoHeight;
        const ctx = offCanvas.getContext("2d");
        ctx.drawImage(video, 0, 0);

        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `photo-capture-${timestamp}.jpg`;

        if (window.EditorQueue) {
          window.EditorQueue.addItem(filename, offCanvas, "image/jpeg");
          showToast("Photo captured and added to queue");
        }

        stopCameraStream();
        if (modal) modal.classList.remove("active");
      });
    }
  }

  async function enumerateCameraDevices() {
    const select = document.getElementById("cameraDeviceSelect");
    if (
      !select ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.enumerateDevices
    )
      return;

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      select.innerHTML = "";

      videoDevices.forEach((device, idx) => {
        const opt = document.createElement("option");
        opt.value = device.deviceId;
        opt.textContent = device.label || `Camera ${idx + 1}`;
        select.appendChild(opt);
      });
    } catch (e) {
      console.warn("Could not enumerate video devices:", e);
    }
  }

  async function startCameraStream(deviceId = null) {
    stopCameraStream();
    const video = document.getElementById("cameraVideo");
    if (
      !video ||
      !navigator.mediaDevices ||
      !navigator.mediaDevices.getUserMedia
    ) {
      showToast("Camera not supported in this browser.");
      return;
    }

    const constraints = {
      video: deviceId
        ? { deviceId: { exact: deviceId } }
        : {
            facingMode: currentFacingMode,
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
    };

    try {
      cameraStream = await navigator.mediaDevices.getUserMedia(constraints);
      video.srcObject = cameraStream;
      video.play();
    } catch (e) {
      console.warn("Error starting camera stream:", e);
      // Fallback simple video constraint
      try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
        video.srcObject = cameraStream;
        video.play();
      } catch (err2) {
        showToast("Camera access denied or unavailable.");
      }
    }
  }

  function stopCameraStream() {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      cameraStream = null;
    }
    const video = document.getElementById("cameraVideo");
    if (video) {
      video.srcObject = null;
    }
  }

  // --- 6. File Decoding & Vector SVG In-Memory Rasterization ---
  async function processFiles(fileList) {
    let addedCount = 0;
    for (const file of fileList) {
      try {
        const canvas = await decodeFileToCanvas(file);
        if (canvas && window.EditorQueue) {
          window.EditorQueue.addItem(
            file.name,
            canvas,
            file.type || "image/png",
          );
          addedCount++;
        }
      } catch (err) {
        console.error("Error decoding file:", file.name, err);
      }
    }

    if (addedCount > 0) {
      showToast(`Loaded ${addedCount} image(s)`);
      if (
        window.EditorApp &&
        typeof window.EditorApp.switchTab === "function"
      ) {
        // If queue was empty or has items, open Gallery / Edit view
        if (window.EditorQueue.items.length === 1) {
          window.EditorApp.switchTab("edit");
        } else {
          window.EditorApp.switchTab("gallery");
        }
      }
    }
  }

  function decodeFileToCanvas(file) {
    return new Promise((resolve, reject) => {
      const isSvg =
        file.type === "image/svg+xml" ||
        file.name.toLowerCase().endsWith(".svg");

      if (isSvg) {
        // SVG text reading & rasterization
        const reader = new FileReader();
        reader.onload = (e) => {
          const svgText = e.target.result;
          const blob = new Blob([svgText], {
            type: "image/svg+xml;charset=utf-8",
          });
          const url = URL.createObjectURL(blob);
          const img = new Image();

          img.onload = () => {
            const canvas = document.createElement("canvas");
            canvas.width = img.naturalWidth || 800;
            canvas.height = img.naturalHeight || 600;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);
            resolve(canvas);
          };

          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to rasterize SVG"));
          };

          img.src = url;
        };
        reader.onerror = reject;
        reader.readAsText(file);
      } else {
        // Standard raster image loading
        const url = URL.createObjectURL(file);
        const img = new Image();

        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth || img.width;
          canvas.height = img.naturalHeight || img.height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          URL.revokeObjectURL(url);
          resolve(canvas);
        };

        img.onerror = () => {
          URL.revokeObjectURL(url);
          reject(new Error("Failed to load image"));
        };

        img.src = url;
      }
    });
  }

  function isImageFile(file) {
    if (file.type && file.type.startsWith("image/")) return true;
    const ext = file.name.split(".").pop().toLowerCase();
    return ["jpg", "jpeg", "png", "webp", "svg", "bmp", "gif"].includes(ext);
  }

  function showToast(msg) {
    const container = document.getElementById("toastContainer");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast-msg";
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 2600);
  }

  return {
    init,
    processFiles,
    decodeFileToCanvas,
    showToast,
  };
})();
