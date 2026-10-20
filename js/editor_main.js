/**
 * Image Editor - Main Application Controller
 * Coordinates UI navigation, tab switching, toolbar scroll overflow indicators, and module bootstrap.
 */

window.EditorApp = (function () {
  let activeTab = "upload"; // 'upload' | 'gallery' | 'edit'

  function init() {
    // 1. Initialize Sub-modules
    if (window.EditorHost) window.EditorHost.init();
    if (window.EditorCanvas) window.EditorCanvas.init();
    if (window.EditorQueue) window.EditorQueue.init();
    if (window.EditorUpload) window.EditorUpload.init();
    if (window.EditorTools) window.EditorTools.init();
    if (window.EditorExport) window.EditorExport.init();

    // 2. Setup Mode Tab Navigation
    bindTabNavigation();

    // 3. Setup Toolbar Overflow Scroll Indicators
    setupToolbarOverflow(
      "tabsToolbarScroll",
      "tabsArrowLeft",
      "tabsArrowRight",
    );
    setupToolbarOverflow("toolbar1Scroll", "tb1ArrowLeft", "tb1ArrowRight");
    setupToolbarOverflow("toolbar2Scroll", "tb2ArrowLeft", "tb2ArrowRight");
    setupToolbarOverflow(
      "statusBarRowScroll",
      "statusArrowLeft",
      "statusArrowRight",
    );

    // Single image mode (?single=true) hides the queue/gallery workflow
    applySingleMode();

    // Default view state
    switchTab("upload");
  }

  function isSingleMode() {
    return Boolean(window.EditorHost && window.EditorHost.config.single);
  }

  /**
   * Single image mode: upload one image -> edit -> upload or close.
   * Hides the mode tabs row, folder picker and batch upload (see theme.css `.single-mode`),
   * and swaps upload texts to their singular variants (`data-i18n-single`).
   */
  function applySingleMode() {
    const single = isSingleMode();
    document.body.classList.toggle("single-mode", single);

    const fileInput = document.getElementById("fileInput");
    if (fileInput) fileInput.multiple = !single;

    document.querySelectorAll("[data-i18n-single]").forEach((el) => {
      if (!el.hasAttribute("data-i18n-multi")) {
        el.setAttribute("data-i18n-multi", el.getAttribute("data-i18n"));
      }
      el.setAttribute(
        "data-i18n",
        el.getAttribute(single ? "data-i18n-single" : "data-i18n-multi"),
      );
    });
    if (window.EditorI18n) window.EditorI18n.apply(document);
  }

  function bindTabNavigation() {
    const tabUpload = document.getElementById("tabUpload");
    const tabGallery = document.getElementById("tabGallery");
    const tabEdit = document.getElementById("tabEdit");

    if (tabUpload) {
      tabUpload.addEventListener("click", () => switchTab("upload"));
    }

    if (tabGallery) {
      tabGallery.addEventListener("click", () => switchTab("gallery"));
    }

    if (tabEdit) {
      tabEdit.addEventListener("click", () => {
        if (!window.EditorQueue || !window.EditorQueue.items.length) {
          if (window.EditorUpload) {
            window.EditorUpload.showToast(t("toast.uploadFirst"));
          }
          return;
        }
        switchTab("edit");
      });
    }
  }

  function switchTab(tabName) {
    activeTab = tabName;

    const tabUpload = document.getElementById("tabUpload");
    const tabGallery = document.getElementById("tabGallery");
    const tabEdit = document.getElementById("tabEdit");

    const viewUpload = document.getElementById("viewUpload");
    const viewGallery = document.getElementById("viewGallery");

    if (tabUpload) tabUpload.classList.toggle("active", tabName === "upload");
    if (tabGallery)
      tabGallery.classList.toggle("active", tabName === "gallery");
    if (tabEdit) tabEdit.classList.toggle("active", tabName === "edit");

    if (viewUpload) viewUpload.classList.toggle("active", tabName === "upload");
    if (viewGallery)
      viewGallery.classList.toggle("active", tabName === "gallery");

    // Dynamic toolbar & header action button visibility based on active tab:
    // 1) Add more tab: no upload this/all button AND no 2 tools toolbar
    // 2) Gallery tab: upload all button AND no 2 tools toolbar
    // 3) Edit tab: upload this button AND yes to 2 tools toolbar
    const btnUploadSingle = document.getElementById("btnUploadSingle");
    const btnUploadDone = document.getElementById("btnUploadDone");
    const tb1Wrapper = document.getElementById("toolbar1Wrapper");
    const tb2Wrapper = document.getElementById("toolbar2Wrapper");
    const statusBar = document.getElementById("statusBarWrapper");

    if (tabName === "edit") {
      if (btnUploadSingle) btnUploadSingle.style.display = "inline-flex";
      if (btnUploadDone) btnUploadDone.style.display = "none";
      if (tb1Wrapper) tb1Wrapper.style.display = "flex";
      if (tb2Wrapper) tb2Wrapper.style.display = "flex";
      if (statusBar) statusBar.style.display = "flex";

      if (window.EditorCanvas) {
        window.EditorCanvas.resize();
        window.EditorCanvas.fitToScreen();
      }
    } else if (tabName === "gallery") {
      if (btnUploadSingle) btnUploadSingle.style.display = "none";
      if (btnUploadDone) btnUploadDone.style.display = "inline-flex";
      if (tb1Wrapper) tb1Wrapper.style.display = "none";
      if (tb2Wrapper) tb2Wrapper.style.display = "none";
      if (statusBar) statusBar.style.display = "none";

      if (window.EditorQueue) {
        window.EditorQueue.renderGallery();
      }
    } else {
      // 'upload' / Add more tab
      if (btnUploadSingle) btnUploadSingle.style.display = "none";
      if (btnUploadDone) btnUploadDone.style.display = "none";
      if (tb1Wrapper) tb1Wrapper.style.display = "none";
      if (tb2Wrapper) tb2Wrapper.style.display = "none";
      if (statusBar) statusBar.style.display = "none";
    }
  }

  /**
   * Setup dynamic left/right arrow visibility and smooth scrolling for toolbars
   */
  function setupToolbarOverflow(scrollId, leftArrowId, rightArrowId) {
    const scrollEl = document.getElementById(scrollId);
    const leftArrow = document.getElementById(leftArrowId);
    const rightArrow = document.getElementById(rightArrowId);

    if (!scrollEl || !leftArrow || !rightArrow) return;

    function updateArrows() {
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;
      // Physical offset from the left edge (0..max), regardless of text direction.
      // In RTL, browsers report scrollLeft from 0 (rightmost) down to -max.
      const scrollLeft =
        getComputedStyle(scrollEl).direction === "rtl"
          ? scrollEl.scrollLeft + maxScroll
          : scrollEl.scrollLeft;

      if (scrollLeft > 2) {
        leftArrow.classList.add("visible");
      } else {
        leftArrow.classList.remove("visible");
      }

      if (scrollLeft < maxScroll - 2 && maxScroll > 0) {
        rightArrow.classList.add("visible");
      } else {
        rightArrow.classList.remove("visible");
      }
    }

    scrollEl.addEventListener("scroll", updateArrows, { passive: true });

    leftArrow.addEventListener("click", () => {
      scrollEl.scrollBy({ left: -140, behavior: "smooth" });
    });

    rightArrow.addEventListener("click", () => {
      scrollEl.scrollBy({ left: 140, behavior: "smooth" });
    });

    // ResizeObserver to detect layout changes or content mutations
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        updateArrows();
      });
      ro.observe(scrollEl);
    }

    const mo = new MutationObserver(() => {
      updateArrows();
    });
    mo.observe(scrollEl, { childList: true, subtree: true });

    window.addEventListener("resize", updateArrows);
    setTimeout(updateArrows, 100);
  }

  return {
    get activeTab() {
      return activeTab;
    },
    get isSingleMode() {
      return isSingleMode();
    },
    init,
    switchTab,
    applySingleMode,
    setupToolbarOverflow,
  };
})();

// Bootstrap when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", window.EditorApp.init);
} else {
  window.EditorApp.init();
}
