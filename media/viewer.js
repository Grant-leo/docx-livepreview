/**
 * viewer.js — Frontend JavaScript for the DOCX preview webview.
 *
 * Zero dependencies. Handles page display, zoom, keyboard
 * navigation, and auto-refresh communication with the
 * VSCode extension host.
 */
(function () {
  const vscode = acquireVsCodeApi();

  // ── State ──
  let currentPage = 1;
  let totalPages = 0;
  let zoom = 100;
  let pageImages = new Map(); // pageNum -> base64 string
  let dpi = 200;

  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);
  const pageImage = $("pageImage");
  const loading = $("loading");
  const errorBox = $("error");
  const errorMsg = $("errorMessage");
  const canvasArea = $("canvasArea");
  const currentPageSpan = $("currentPage");
  const totalPagesSpan = $("totalPages");
  const zoomSlider = $("zoomSlider");
  const zoomInput = $("zoomInput");
  const zoomLabel = $("zoomLabel");

  // ── Display helpers ──
  function showLoading() {
    loading.classList.remove("hidden");
    errorBox.classList.add("hidden");
    canvasArea.classList.add("hidden");
  }

  function showError(msg) {
    loading.classList.add("hidden");
    errorBox.classList.remove("hidden");
    canvasArea.classList.add("hidden");
    errorMsg.textContent = msg;
  }

  function showPage() {
    loading.classList.add("hidden");
    errorBox.classList.add("hidden");
    canvasArea.classList.remove("hidden");
    updatePageInfo();
  }

  function updatePageInfo() {
    currentPageSpan.textContent = String(currentPage);
    totalPagesSpan.textContent = totalPages > 0 ? String(totalPages) : "-";
  }

  function displayPage(imageBase64, page) {
    pageImages.set(page, imageBase64);
    pageImage.src = "data:image/png;base64," + imageBase64;
    currentPage = page;
    showPage();
  }

  function clampZoom(v) {
    if (isNaN(v) || v < 25) { return 25; }
    if (v > 500) { return 500; }
    return Math.round(v);
  }

  function applyZoom() {
    zoom = clampZoom(zoom);
    console.log("[viewer] applyZoom: zoom=" + zoom + "% naturalWidth=" + pageImage.naturalWidth + "px");
    pageImage.style.transform = `scale(${zoom / 100})`;
    pageImage.style.transformOrigin = "top center";
    zoomSlider.value = String(zoom);
    zoomInput.value = String(zoom);
    zoomLabel.textContent = zoom + "%";
  }

  function goToPage(page) {
    if (page < 1 || page > totalPages) { return; }
    currentPage = page;
    if (pageImages.has(page)) {
      displayPage(pageImages.get(page), page);
      applyZoom();
    } else {
      showLoading();
      vscode.postMessage({ type: "requestPage", page });
    }
  }

  // ── Message handler ──
  window.addEventListener("message", (event) => {
    const msg = event.data;
    console.log("[viewer] msg:", msg.type, "zoom:", msg.zoom, "dpi:", msg.dpi, "page:", msg.page);

    switch (msg.type) {
      case "setPage":
        totalPages = msg.totalPages;
        dpi = msg.dpi || dpi;
        if (msg.zoom !== undefined) {
          zoom = msg.zoom;
        }
        displayPage(msg.image, msg.page);
        applyZoom();
        break;

      case "setAllPages":
        totalPages = msg.totalPages;
        if (msg.zoom !== undefined) { zoom = msg.zoom; }
        dpi = msg.dpi || dpi;
        msg.pages.forEach((p) => {
          pageImages.set(p.page, p.image);
        });
        if (pageImages.has(currentPage)) {
          displayPage(pageImages.get(currentPage), currentPage);
        } else {
          displayPage(msg.pages[0].image, 1);
        }
        applyZoom();
        break;

      case "error":
        showError(msg.message);
        break;
    }
  });

  // ── Toolbar events ──
  $("btnPrev").addEventListener("click", () => goToPage(currentPage - 1));
  $("btnNext").addEventListener("click", () => goToPage(currentPage + 1));
  $("btnRefresh").addEventListener("click", () => {
    showLoading();
    pageImages.clear();
    vscode.postMessage({ type: "refresh" });
  });
  $("btnRetry").addEventListener("click", () => {
    showLoading();
    vscode.postMessage({ type: "refresh" });
  });

  $("btnZoomOut").addEventListener("click", () => {
    zoom = clampZoom(zoom - 10);
    applyZoom();
  });
  $("btnZoomIn").addEventListener("click", () => {
    zoom = clampZoom(zoom + 10);
    applyZoom();
  });
  zoomSlider.addEventListener("input", () => {
    zoom = parseInt(zoomSlider.value, 10);
    applyZoom();
  });
  zoomInput.addEventListener("change", () => {
    zoom = clampZoom(parseInt(zoomInput.value, 10));
    applyZoom();
  });
  zoomInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      zoom = clampZoom(parseInt(zoomInput.value, 10));
      applyZoom();
      zoomInput.blur();
    }
  });
$("btnZoom100").addEventListener("click", () => {
    zoom = 100;
    applyZoom();
  });

  // ── Keyboard shortcuts ──
  window.addEventListener("keydown", (e) => {
    if (e.target.tagName === "INPUT") { return; }
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        goToPage(currentPage - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        goToPage(currentPage + 1);
        break;
      case "Home":
        e.preventDefault();
        goToPage(1);
        break;
      case "End":
        e.preventDefault();
        goToPage(totalPages);
        break;
    }
  });

  // ── Ctrl+Wheel zoom ──
  canvasArea.addEventListener("wheel", (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      zoom = clampZoom(zoom + (e.deltaY < 0 ? 10 : -10));
      applyZoom();
    }
  }, { passive: false });
})();
