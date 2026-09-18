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
    setupToolbarOverflow("toolbar1Scroll", "tb1ArrowLeft", "tb1ArrowRight");
    setupToolbarOverflow("toolbar2Scroll", "tb2ArrowLeft", "tb2ArrowRight");

    // Default view state
    switchTab("upload");
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
            window.EditorUpload.showToast(
              "Please upload or capture an image first.",
            );
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

    if (tabName === "gallery" && window.EditorQueue) {
      window.EditorQueue.renderGallery();
    }

    if (tabName === "edit") {
      if (window.EditorCanvas) {
        window.EditorCanvas.resize();
        window.EditorCanvas.fitToScreen();
      }
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
      const scrollLeft = scrollEl.scrollLeft;
      const maxScroll = scrollEl.scrollWidth - scrollEl.clientWidth;

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
    init,
    switchTab,
    setupToolbarOverflow,
  };
})();

// Bootstrap when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", window.EditorApp.init);
} else {
  window.EditorApp.init();
}
