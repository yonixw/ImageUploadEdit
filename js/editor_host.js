/**
 * Image Editor - Host Communication & Integration Bridge
 * Handles bi-directional communication via postMessage, window.opener/parent callbacks,
 * query parameters, and fallback file downloads.
 */

window.EditorHost = (function () {
  const urlParams = new URLSearchParams(window.location.search);

  const config = {
    token: urlParams.get("token") || "",
    autoClose:
      urlParams.get("autoClose") === "true" ||
      urlParams.get("autoClose") === "1",
    format: (urlParams.get("format") || "webp").toLowerCase(),
    maxSize: parseInt(urlParams.get("maxSize"), 10) || 0,
    quality: parseFloat(urlParams.get("quality")) || 0.85,
  };

  const isPopup = Boolean(window.opener && window.opener !== window);
  const isIframe = Boolean(window.parent && window.parent !== window);
  const isEmbedded = isPopup || isIframe;

  function init() {
    // Show close button if opened in popup/modal
    const closeBtn = document.getElementById("btnCloseWindow");
    if (closeBtn && isEmbedded) {
      closeBtn.style.display = "inline-flex";
      closeBtn.addEventListener("click", () => {
        if (isPopup) {
          window.close();
        } else if (isIframe) {
          window.parent.postMessage(
            { type: "EDITOR_CLOSE", token: config.token },
            "*",
          );
        }
      });
    }

    // Dispatch ready handshake
    sendHandshake();

    // Listen to inbound messages
    window.addEventListener("message", handleInboundMessage);
  }

  function sendHandshake() {
    const readyPayload = {
      type: "EDITOR_READY",
      token: config.token,
    };

    if (isPopup) {
      try {
        window.opener.postMessage(readyPayload, "*");
      } catch (e) {
        console.warn("Could not postMessage to opener:", e);
      }
    }

    if (isIframe) {
      try {
        window.parent.postMessage(readyPayload, "*");
      } catch (e) {
        console.warn("Could not postMessage to parent:", e);
      }
    }
  }

  function handleInboundMessage(event) {
    const data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.action === "INIT") {
      if (data.token) config.token = data.token;
      if (data.config) {
        Object.assign(config, data.config);
      }
    } else if (data.action === "UPLOAD_STATUS") {
      if (
        window.EditorQueue &&
        typeof window.EditorQueue.updateItemStatus === "function"
      ) {
        window.EditorQueue.updateItemStatus(
          data.id,
          data.status,
          data.progress,
        );
      }
    }
  }

  /**
   * Dispatch an individual edited image item payload to host or download fallback
   * @param {Object} payload EditedImagePayload
   */
  async function sendImageItem(payload) {
    payload.token = config.token;
    let delivered = false;

    // 1. Check direct JavaScript callbacks
    if (isPopup && window.opener) {
      if (typeof window.opener.edited_upload === "function") {
        try {
          window.opener.edited_upload(payload);
          delivered = true;
        } catch (e) {
          console.warn("Error invoking opener.edited_upload:", e);
        }
      } else if (typeof window.opener.upload === "function") {
        try {
          window.opener.upload(payload);
          delivered = true;
        } catch (e) {
          console.warn("Error invoking opener.upload:", e);
        }
      }
    }

    if (isIframe && window.parent) {
      if (typeof window.parent.edited_upload === "function") {
        try {
          window.parent.edited_upload(payload);
          delivered = true;
        } catch (e) {
          console.warn("Error invoking parent.edited_upload:", e);
        }
      } else if (typeof window.parent.upload === "function") {
        try {
          window.parent.upload(payload);
          delivered = true;
        } catch (e) {
          console.warn("Error invoking parent.upload:", e);
        }
      }
    }

    if (typeof window.edited_upload === "function") {
      try {
        window.edited_upload(payload);
        delivered = true;
      } catch (e) {
        console.warn("Error invoking window.edited_upload:", e);
      }
    }

    // 2. Dispatch via postMessage
    const messagePayload = {
      type: "IMAGE_UPLOAD_ITEM",
      payload: payload,
    };

    if (isPopup && window.opener) {
      try {
        window.opener.postMessage(messagePayload, "*");
        delivered = true;
      } catch (e) {
        console.warn("Error postMessage to opener:", e);
      }
    }

    if (isIframe && window.parent) {
      try {
        window.parent.postMessage(messagePayload, "*");
        delivered = true;
      } catch (e) {
        console.warn("Error postMessage to parent:", e);
      }
    }

    // 3. Fallback: Standalone browser download
    if (!delivered && !isEmbedded) {
      downloadBlobLocally(payload.blob, payload.name);
    }
  }

  function downloadBlobLocally(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 200);
  }

  /**
   * Dispatch batch completion notification and close if requested
   */
  function sendDone() {
    const donePayload = {
      type: "EDITOR_DONE",
      token: config.token,
    };

    if (isPopup && window.opener) {
      try {
        window.opener.postMessage(donePayload, "*");
      } catch (e) {}
    }

    if (isIframe && window.parent) {
      try {
        window.parent.postMessage(donePayload, "*");
      } catch (e) {}
    }

    if (config.autoClose && isPopup) {
      setTimeout(() => {
        window.close();
      }, 300);
    }
  }

  return {
    config,
    isPopup,
    isIframe,
    isEmbedded,
    init,
    sendHandshake,
    sendImageItem,
    sendDone,
  };
})();
