/**
 * Image Editor - Host Communication & Integration Bridge
 * Handles bi-directional communication via postMessage, window.opener/parent callbacks,
 * query parameters, and fallback file downloads.
 */

window.EditorHost = (function () {
  function getUrlParameter(key) {
    try {
      if (window.location && window.location.search) {
        const params = new URLSearchParams(window.location.search);
        if (params.has(key)) return params.get(key);
      }
    } catch (e) {}

    try {
      if (window.location && window.location.hash) {
        const hash = window.location.hash.replace(/^#[?]?/, "");
        const params = new URLSearchParams(hash);
        if (params.has(key)) return params.get(key);
      }
    } catch (e) {}

    try {
      if (window.frameElement) {
        const src =
          window.frameElement.getAttribute("src") ||
          window.frameElement.src ||
          "";
        const qIdx = src.indexOf("?");
        if (qIdx !== -1) {
          const params = new URLSearchParams(src.substring(qIdx));
          if (params.has(key)) return params.get(key);
        }
        const hIdx = src.indexOf("#");
        if (hIdx !== -1) {
          const hash = src.substring(hIdx + 1).replace(/^[?]?/, "");
          const params = new URLSearchParams(hash);
          if (params.has(key)) return params.get(key);
        }
      }
    } catch (e) {}

    try {
      const href = window.location.href || document.URL || "";
      const qIdx = href.indexOf("?");
      if (qIdx !== -1) {
        const endIdx = href.indexOf("#");
        const qStr =
          endIdx !== -1 ? href.substring(qIdx, endIdx) : href.substring(qIdx);
        const params = new URLSearchParams(qStr);
        if (params.has(key)) return params.get(key);
      }
      const hIdx = href.indexOf("#");
      if (hIdx !== -1) {
        const hash = href.substring(hIdx + 1).replace(/^[?]?/, "");
        const params = new URLSearchParams(hash);
        if (params.has(key)) return params.get(key);
      }
    } catch (e) {}

    return null;
  }

  const rawTheme = (getUrlParameter("theme") || "dark").toLowerCase();
  const validThemes = [
    "dark",
    "glass",
    "dark-orange",
    "light",
    "warm-light",
    "midnight",
    "emerald",
  ];

  const config = {
    token: getUrlParameter("token") || "",
    title: getUrlParameter("title") || "",
    theme: validThemes.includes(rawTheme) ? rawTheme : "dark",
    autoClose:
      getUrlParameter("autoClose") === "true" ||
      getUrlParameter("autoClose") === "1",
    format: (getUrlParameter("format") || "webp").toLowerCase(),
    maxSize: parseInt(getUrlParameter("maxSize"), 10) || 0,
    quality: parseFloat(getUrlParameter("quality")) || 0.85,
  };

  const isPopup = Boolean(window.opener && window.opener !== window);
  const isIframe = Boolean(window.parent && window.parent !== window);
  const isEmbedded = isPopup || isIframe;

  function setTitle(title) {
    if (!title) return;
    config.title = title;
    document.title = title;
    const headerTitle = document.getElementById("appHeaderTitle");
    if (headerTitle) {
      headerTitle.textContent = title;
      headerTitle.title = title;
      headerTitle.style.display = "block";
    }
  }

  function init() {
    // Apply requested theme stylesheet
    setTheme(config.theme);

    // Set custom title if provided
    if (config.title) {
      setTitle(config.title);
    }

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
      const newToken = data.token || (data.config && data.config.token);
      if (newToken) {
        config.token = newToken;
        if (window.EditorQueue && Array.isArray(window.EditorQueue.items)) {
          window.EditorQueue.items.forEach((item) => {
            if (!item.token) item.token = newToken;
          });
        }
      }
      if (data.config) {
        Object.assign(config, data.config);
        if (data.config.theme) setTheme(data.config.theme);
        if (data.config.title) setTitle(data.config.title);
      }
    } else if (data.action === "SET_THEME") {
      if (data.theme) setTheme(data.theme);
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

  function getToken() {
    return config.token || getUrlParameter("token") || "";
  }

  /**
   * Dispatch an individual edited image item payload to host or download fallback
   * @param {Object} payload EditedImagePayload
   */
  async function sendImageItem(payload) {
    payload.token = getToken();
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

  function setTheme(themeName) {
    const validThemes = [
      "dark",
      "glass",
      "dark-orange",
      "light",
      "warm-light",
      "midnight",
      "emerald",
    ];
    const theme = validThemes.includes(themeName) ? themeName : "dark";
    config.theme = theme;
    document.documentElement.setAttribute("data-theme", theme);
    if (document.body) {
      document.body.setAttribute("data-theme", theme);
    }
  }

  return {
    config,
    isPopup,
    isIframe,
    isEmbedded,
    init,
    getToken,
    getUrlParameter,
    setTitle,
    setTheme,
    sendHandshake,
    sendImageItem,
    sendDone,
  };
})();
