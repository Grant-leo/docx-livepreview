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
  const imageWrapper = $("imageWrapper");
  const pageCursor = $("pageCursor");
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
    pageImage.removeAttribute("src");
    pageImage.src = "data:image/png;base64," + imageBase64;
    currentPage = page;
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
      requestAnimationFrame(function () { showCursorsForPage(page); });
    }
  }

  function clampZoom(v) {
    if (isNaN(v) || v < 25) { return 25; }
    if (v > 500) { return 500; }
    return Math.round(v);
  }

  function applyZoom() {
    zoom = clampZoom(zoom);
    imageWrapper.style.transform = `scale(${zoom / 100})`;
    imageWrapper.style.transformOrigin = "top center";
    zoomSlider.value = String(zoom);
    zoomInput.value = String(zoom);
    zoomLabel.textContent = zoom + "%";
  }

  function goToPage(page, options) {
    if (page < 1 || page > totalPages) { return; }
    if (!options || !options.keepCursor) {
      hideAllCursors();
    }
    currentPage = page;
    if (pageImages.has(page)) {
      displayPage(pageImages.get(page), page);
      applyZoom();
    } else {
      showLoading();
      vscode.postMessage({ type: "requestPage", page });
    }
  }

  // ── Cursor indicators (SyncTeX bidirectional linking) ──

  /** Show a single cursor at PDF-coordinate (pdfX, pdfY) — used by forward search. */
  function showSingleCursor(pdfX, pdfY) {
    removeBookmarkCursors();
    cursorX = pdfX * (dpi / 72);
    cursorY = pdfY * (dpi / 72);
    pendingCursor = null;
    singleCursorActive = true;
    pageCursor.style.left = Math.round(cursorX) + "px";
    pageCursor.style.top = Math.round(cursorY - 12) + "px";
    pageCursor.style.height = "24px";
    pageCursor.classList.remove("hidden");
  }

  /** Show all bookmark cursors for a given page. */
  function showCursorsForPage(page) {
    if (singleCursorActive) { return; }
    hideAllCursors();
    var keys = Object.keys(bookmarkPositions);
    var shownAny = false;
    for (var i = 0; i < keys.length; i++) {
      var pos = bookmarkPositions[keys[i]];
      if (pos.page !== page) { continue; }
      var cx = pos.x * (dpi / 72);
      var cy = pos.y * (dpi / 72);
      var el = createCursorEl(cx, cy);
      imageWrapper.appendChild(el);
      cursorEls.push(el);
      shownAny = true;
    }
  }

  function createCursorEl(left, top) {
    var el = document.createElement("div");
    el.className = "bookmarkCursor";
    el.style.left = Math.round(left) + "px";
    el.style.top = Math.round(top - 12) + "px";
    el.style.height = "24px";
    return el;
  }

  function hideAllCursors() {
    pendingCursor = null;
    singleCursorActive = false;
    pageCursor.classList.add("hidden");
    removeBookmarkCursors();
  }

  function removeBookmarkCursors() {
    for (var i = 0; i < cursorEls.length; i++) {
      cursorEls[i].remove();
    }
    cursorEls = [];
  }

  var cursorX = 0;
  var cursorY = 0;
  var pendingCursor = null;
  var singleCursorActive = false;
  var bookmarkPositions = {};  // { sourceLine: { page, x, y } }
  var cursorEls = [];

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
          // Show all bookmarks for the target page
          requestAnimationFrame(function () { showCursorsForPage(msg.page); });
        }
        break;

      case "bookmarkPositions":
        bookmarkPositions = msg.positions || {};
        // Show cursors for the currently visible page
        if (pageImage.src && pageImage.naturalWidth > 0) {
          requestAnimationFrame(function () { showCursorsForPage(currentPage); });
        }
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

  // ── Image load error ──
  pageImage.addEventListener("error", () => {
    pageImage.removeAttribute("src");
    showError("Failed to load rendered page image.");
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
      zoom = clampZoom(zoom + (e.deltaY < 0 ? 10 : -10));
      applyZoom();
    }
  }, { passive: false });
})();
