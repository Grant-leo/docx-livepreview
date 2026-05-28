/**
 * viewer.js — Frontend JavaScript for the DOCX preview webview.
 *
 * Zero dependencies. Handles page display, zoom, keyboard
 * navigation, and auto-refresh communication with the
 * VSCode extension host.
 */
(function () {
  const vscode = acquireVsCodeApi();
  const savedState = vscode.getState() || {};

  // ── State ──
  let currentPage = 1;
  let totalPages = 0;
  let zoom = isValidZoom(savedState.zoom) ? clampZoom(savedState.zoom) : 100;
  let zoomMode = savedState.zoomMode === "fitWidth" ? "fitWidth" : "manual";
  let hasHostZoom = isValidZoom(savedState.zoom) || zoomMode === "fitWidth";
  let pageImages = new Map(); // pageNum -> base64 string
  let dpi = 200;
  let nextRequestId = 1;
  let latestRequestId = 0;
  let pendingPageRequests = new Map(); // requestId -> pageNum
  const maxCachedPages = 5;

  // ── DOM refs ──
  const $ = (id) => document.getElementById(id);
  const pageImage = $("pageImage");
  const imageWrapper = $("imageWrapper");
  const pageCursor = $("pageCursor");
  const loading = $("loading");
  const loadingText = $("loadingText");
  const errorBox = $("error");
  const errorMsg = $("errorMessage");
  const canvasArea = $("canvasArea");
  const pageContainer = $("pageContainer");
  const currentPageSpan = $("currentPage");
  const totalPagesSpan = $("totalPages");
  const zoomSlider = $("zoomSlider");
  const zoomInput = $("zoomInput");
  const zoomLabel = $("zoomLabel");
  const fitWidthButton = $("btnFitWidth");

  // ── Display helpers ──
  function showLoading(message) {
    loadingText.textContent = message || "Loading document...";
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
    currentPage = page;
    cachePageImage(page, imageBase64);
    pageImage.removeAttribute("src");
    pageImage.src = "data:image/png;base64," + imageBase64;
    showPage();
    if (pendingCursor) {
      var c = pendingCursor;
      pendingCursor = null;
      // Wait for image to load before positioning cursor
      var onLoad = function () {
        pageImage.removeEventListener("load", onLoad);
        showSingleCursor(c.x, c.y);
      };
      if (pageImage.complete && pageImage.naturalWidth > 0) {
        showSingleCursor(c.x, c.y);
      } else {
        pageImage.addEventListener("load", onLoad);
      }
    } else {
      hideAllCursors();
    }
  }

  function clampZoom(v) {
    if (isNaN(v) || v < 25) { return 25; }
    if (v > 500) { return 500; }
    return Math.round(v);
  }

  function isValidZoom(v) {
    return typeof v === "number" && !isNaN(v);
  }

  function applyZoom() {
    if (zoomMode === "fitWidth") {
      zoom = calculateFitWidthZoom();
    }
    zoom = clampZoom(zoom);
    const scale = zoom / 100;
    if (pageImage.naturalWidth > 0 && pageImage.naturalHeight > 0) {
      pageImage.style.width = Math.round(pageImage.naturalWidth * scale) + "px";
      pageImage.style.height = Math.round(pageImage.naturalHeight * scale) + "px";
      imageWrapper.style.width = pageImage.style.width;
      imageWrapper.style.height = pageImage.style.height;
    }
    zoomSlider.value = String(zoom);
    zoomInput.value = String(zoom);
    zoomLabel.textContent = zoom + "%";
    fitWidthButton.classList.toggle("active", zoomMode === "fitWidth");
    fitWidthButton.setAttribute("aria-pressed", zoomMode === "fitWidth" ? "true" : "false");
  }

  function setZoom(value, options) {
    zoomMode = "manual";
    zoom = clampZoom(value);
    hideAllCursors();
    applyZoom();
    if (!options || options.persist !== false) {
      persistViewState();
    }
  }

  function fitWidth() {
    zoomMode = "fitWidth";
    hideAllCursors();
    applyZoom();
    persistViewState();
  }

  function calculateFitWidthZoom() {
    if (pageImage.naturalWidth <= 0) { return zoom; }
    const style = window.getComputedStyle(canvasArea);
    const padding = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
    const availableWidth = Math.max(1, pageContainer.clientWidth - padding);
    return clampZoom((availableWidth / pageImage.naturalWidth) * 100);
  }

  function persistViewState() {
    const state = vscode.getState() || {};
    vscode.setState({ ...state, zoom, zoomMode });
  }

  function cachePageImage(page, imageBase64) {
    if (pageImages.has(page)) {
      pageImages.delete(page);
    }
    pageImages.set(page, imageBase64);
    while (pageImages.size > maxCachedPages) {
      const oldestPage = pageImages.keys().next().value;
      pageImages.delete(oldestPage);
    }
  }

  function goToPage(page, options) {
    if (page < 1 || page > totalPages) { return; }
    if (!options || !options.keepCursor) {
      hideAllCursors();
    }
    currentPage = page;
    if (pageImages.has(page)) {
      cancelPendingPageRequests();
      displayPage(pageImages.get(page), page);
      applyZoom();
    } else {
      showLoading("Rendering page " + page + "...");
      var requestId = beginPageRequest(page);
      vscode.postMessage({ type: "requestPage", page, requestId });
    }
  }

  function beginPageRequest(page) {
    latestRequestId = nextRequestId++;
    pendingPageRequests.set(latestRequestId, page);
    return latestRequestId;
  }

  function cancelPendingPageRequests() {
    latestRequestId = nextRequestId++;
    pendingPageRequests.clear();
  }

  function shouldAcceptPageMessage(msg) {
    if (typeof msg.requestId === "number") {
      const requestedPage = pendingPageRequests.get(msg.requestId);
      pendingPageRequests.delete(msg.requestId);
      if (msg.requestId !== latestRequestId) {
        return false;
      }
      if (requestedPage !== undefined && msg.page !== requestedPage) {
        return false;
      }
      if (typeof msg.page === "number" && msg.page !== currentPage) {
        return false;
      }
      return true;
    }
    if (typeof msg.requestId !== "number" &&
        typeof msg.page === "number" &&
        msg.page !== currentPage &&
        pageImages.size > 0) {
      return false;
    }
    return true;
  }

  // ── Cursor indicator ──

  /** Show a single cursor at PDF-coordinate (pdfX, pdfY) — used by forward search. */
  function showSingleCursor(pdfX, pdfY) {
    clearCursorTimer();
    var cursorX = pdfX * (dpi / 72);
    var cursorY = pdfY * (dpi / 72);
    var scale = zoom / 100;
    pendingCursor = null;
    pageCursor.style.left = Math.round(cursorX * scale) + "px";
    pageCursor.style.top = Math.round((cursorY - 12) * scale) + "px";
    pageCursor.style.height = Math.max(12, Math.round(24 * scale)) + "px";
    pageCursor.classList.remove("hidden");
    cursorHideTimer = setTimeout(function () {
      pageCursor.classList.add("hidden");
      cursorHideTimer = null;
    }, 1600);
  }

  function hideAllCursors() {
    pendingCursor = null;
    clearCursorTimer();
    pageCursor.classList.add("hidden");
  }

  function clearCursorTimer() {
    if (cursorHideTimer) {
      clearTimeout(cursorHideTimer);
      cursorHideTimer = null;
    }
  }

  var pendingCursor = null;
  var bookmarkPositions = {};  // { sourceLine: { page, x, y } }
  var cursorHideTimer = null;

  // ── Message handler ──
  window.addEventListener("message", (event) => {
    const msg = event.data;

    switch (msg.type) {
      case "setPage":
        if (!shouldAcceptPageMessage(msg)) { return; }
        totalPages = msg.totalPages;
        dpi = msg.dpi || dpi;
        if (msg.resetCache) {
          pageImages.clear();
          pendingPageRequests.clear();
          hideAllCursors();
        }
        if (!hasHostZoom && msg.zoom !== undefined) {
          zoom = msg.zoom;
          hasHostZoom = true;
        }
        displayPage(msg.image, msg.page);
        applyZoom();
        break;

      case "navigateToPage":
        hideAllCursors();
        if (msg.x !== undefined && msg.y !== undefined) {
          // Single-cursor mode (from forward search)
          pendingCursor = { x: msg.x, y: msg.y };
          goToPage(msg.page, { keepCursor: true });
          if (pageImage.src && pageImage.naturalWidth > 0) {
            requestAnimationFrame(function () {
              if (pendingCursor) showSingleCursor(pendingCursor.x, pendingCursor.y);
            });
          }
        } else {
          goToPage(msg.page);
        }
        break;

      case "bookmarkPositions":
        bookmarkPositions = msg.positions || {};
        break;

      case "requestReverseSearch":
        // Command-palette reverse search: prefer the nearest source bookmark
        // to the visible page center, then fall back to PDF text hit-testing.
        if (pageImage.naturalWidth > 0 && pageImage.naturalHeight > 0) {
          var center = visibleCenterDocCoords();
          var sourceLine = nearestBookmarkLine(center.docX, center.docY);
          if (sourceLine !== null) {
            vscode.postMessage({
              type: "reverseSearchLine",
              sourceLine: sourceLine,
            });
            break;
          }
          vscode.postMessage({
            type: "reverseSearch",
            page: currentPage,
            x: center.docX,
            y: center.docY,
          });
        }
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
    showLoading("Refreshing preview...");
    pageImages.clear();
    var requestId = beginPageRequest(currentPage);
    vscode.postMessage({ type: "refresh", page: currentPage, requestId });
  });
  $("btnRetry").addEventListener("click", () => {
    showLoading("Refreshing preview...");
    var requestId = beginPageRequest(currentPage);
    vscode.postMessage({ type: "refresh", page: currentPage, requestId });
  });

  $("btnZoomOut").addEventListener("click", () => {
    setZoom(zoom - 10);
  });
  $("btnZoomIn").addEventListener("click", () => {
    setZoom(zoom + 10);
  });
  zoomSlider.addEventListener("input", () => {
    setZoom(parseInt(zoomSlider.value, 10));
  });
  zoomInput.addEventListener("change", () => {
    setZoom(parseInt(zoomInput.value, 10));
  });
  zoomInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      setZoom(parseInt(zoomInput.value, 10));
      zoomInput.blur();
    }
  });
  $("btnZoom100").addEventListener("click", () => {
    setZoom(100);
  });
  fitWidthButton.addEventListener("click", () => {
    fitWidth();
  });

  // ── Image load error ──
  pageImage.addEventListener("error", () => {
    pageImage.removeAttribute("src");
    showError("Failed to load rendered page image.");
  });
  pageImage.addEventListener("load", () => {
    applyZoom();
    if (zoomMode === "fitWidth") {
      persistViewState();
    }
  });

  // ── Ctrl+Click reverse search ──
  function clickToDocCoords(clientX, clientY) {
    const rect = pageImage.getBoundingClientRect();
    const imgX = clientX - rect.left;
    const imgY = clientY - rect.top;
    // Invert CSS scale and DPI: display px → PDF points (1/72 inch)
    const docX = (imgX / (zoom / 100)) * (72 / dpi);
    const docY = (imgY / (zoom / 100)) * (72 / dpi);
    return { docX: Math.round(docX), docY: Math.round(docY) };
  }

  function visibleCenterDocCoords() {
    const imageRect = pageImage.getBoundingClientRect();
    const areaRect = canvasArea.getBoundingClientRect();
    const centerX = Math.min(
      Math.max(areaRect.left + areaRect.width / 2, imageRect.left),
      imageRect.right
    );
    const centerY = Math.min(
      Math.max(areaRect.top + areaRect.height / 2, imageRect.top),
      imageRect.bottom
    );
    return clickToDocCoords(centerX, centerY);
  }

  function nearestBookmarkLine(docX, docY) {
    var bestLine = null;
    var bestDist = Infinity;
    var keys = Object.keys(bookmarkPositions);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var pos = bookmarkPositions[key];
      if (!pos || Number(pos.page) !== currentPage) { continue; }
      var dx = Number(pos.x) - docX;
      var dy = Number(pos.y) - docY;
      var dist = dx * dx + dy * dy;
      if (dist < bestDist) {
        bestDist = dist;
        bestLine = Number(key);
      }
    }
    return bestLine;
  }

  pageImage.addEventListener("click", function (e) {
    if (!e.ctrlKey && !e.metaKey) { return; }
    e.preventDefault();
    var coords = clickToDocCoords(e.clientX, e.clientY);
    vscode.postMessage({
      type: "reverseSearch",
      page: currentPage,
      x: coords.docX,
      y: coords.docY,
      zoom: zoom,
      dpi: dpi,
    });
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
      setZoom(zoom + (e.deltaY < 0 ? 10 : -10));
    }
  }, { passive: false });

  window.addEventListener("resize", () => {
    if (zoomMode === "fitWidth") {
      applyZoom();
      persistViewState();
    }
  });
})();
