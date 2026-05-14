"""
render_server.py — JSON-line IPC WPS COM renderer.

Reads JSON requests from stdin, writes JSON responses to stdout.
Protocol: one JSON object per line, newline-terminated.

Usage (VSCode extension launches this as a child process):
    python -u render_server.py
"""
import sys
import json
import base64
import tempfile
import os
import signal
import traceback
from pathlib import Path

# Lazy imports — checked explicitly for clear error messages
try:
    import pythoncom
    import win32com.client
except ImportError:
    win32com = None

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


class WpsRenderer:
    """Manages WPS Office COM automation for docx-to-image rendering."""

    PDF_FORMAT = 17  # wdExportFormatPDF

    def __init__(self):
        self.app = None
        self.doc = None
        self.pdf_path = None
        self.page_count = 0
        self.document_open = False
        self._dpi = 200

    def _ensure_wps(self):
        """Start WPS COM server (lazy, first use)."""
        if self.app is not None:
            return
        if win32com is None:
            raise RuntimeError(
                "pywin32 is not installed. Run: pip install pywin32"
            )
        if fitz is None:
            raise RuntimeError(
                "PyMuPDF is not installed. Run: pip install PyMuPDF"
            )

        pythoncom.CoInitialize()
        prog_ids = ["Kwps.Application", "wps.Application", "WPS.Application"]
        last_err = None
        for pid in prog_ids:
            try:
                self.app = win32com.client.Dispatch(pid)
                break
            except Exception as e:
                last_err = e
        if self.app is None:
            raise RuntimeError(
                f"WPS Office COM not found (tried {prog_ids}). "
                f"Install WPS Office from https://www.wps.com. "
                f"Last error: {last_err}"
            )
        self.app.Visible = False
        self.app.DisplayAlerts = 0  # wdAlertsNone — suppress all dialogs

    def warm_up(self):
        """Pre-start WPS COM so first open_document is instant."""
        self._ensure_wps()
        return {"wps_ready": True}

    def check_deps(self):
        """Check all dependencies. Returns dict."""
        result = {
            "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
        }
        try:
            import win32com.client  # noqa: F811
            result["win32com"] = True
        except ImportError:
            result["win32com"] = False
        try:
            import fitz  # noqa: F811
            result["fitz"] = fitz.version
        except ImportError:
            result["fitz"] = False
        # Check WPS availability
        try:
            self._ensure_wps()
            result["wps"] = True
        except Exception as e:
            result["wps"] = str(e)
        return result

    def open(self, docx_path, dpi=200):
        """Open docx in WPS and determine page count.

        Returns page_count on success.
        """
        self._ensure_wps()
        self._dpi = dpi

        path = Path(docx_path)
        if not path.exists():
            raise FileNotFoundError(f"DOCX file not found: {docx_path}")

        # Close previous document
        if self.doc is not None:
            try:
                self.close()
            except Exception:
                pass

        abs_path = str(path.absolute())
        try:
            self.doc = self.app.Documents.Open(abs_path)
        except Exception as e:
            msg = str(e)
            if "password" in msg.lower() or "encrypt" in msg.lower():
                raise RuntimeError("Document is password-protected. Cannot preview encrypted files.") from e
            if "repair" in msg.lower() or "corrupt" in msg.lower():
                raise RuntimeError(f"Document appears to be corrupted: {msg}") from e
            raise RuntimeError(f"WPS failed to open document: {msg}") from e

        if self.doc is None:
            raise RuntimeError("WPS returned no document object — file may be protected or corrupted")

        # Get page count — try multiple methods for robustness
        try:
            self.page_count = self.doc.ComputeStatistics(2)  # wdStatisticPages
        except Exception:
            try:
                self.page_count = self.doc.Content.Information(4)  # wdNumberOfPagesInDocument
            except Exception:
                self.page_count = self.doc.ActiveWindow.ActivePane.Pages.Count

        self.document_open = True
        return self.page_count

    def _export_pdf(self):
        """Export current document to temporary PDF. Returns path."""
        if not self.document_open or self.doc is None:
            raise RuntimeError("No document open. Call open() first.")

        # Reuse cached PDF if it exists
        if self.pdf_path and os.path.exists(self.pdf_path):
            return self.pdf_path

        fd, pdf_path = tempfile.mkstemp(suffix=".pdf", prefix="wps_preview_")
        os.close(fd)

        # 17 = wdExportFormatPDF
        self.doc.ExportAsFixedFormat(pdf_path, self.PDF_FORMAT)
        self.pdf_path = pdf_path
        return pdf_path

    def render_page(self, page_num, dpi=None):
        """Render single page to base64 PNG string.

        Args:
            page_num: 1-based page number
            dpi: override default DPI (None = use value from open())
        """
        if dpi is None:
            dpi = self._dpi

        if not self.pdf_path or not os.path.exists(self.pdf_path):
            self._export_pdf()

        pdf_doc = fitz.open(self.pdf_path)
        try:
            if page_num < 1 or page_num > len(pdf_doc):
                raise IndexError(
                    f"Page {page_num} out of range (1-{len(pdf_doc)})"
                )
            page = pdf_doc[page_num - 1]  # PyMuPDF is 0-indexed
            zoom = dpi / 72.0
            matrix = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=matrix)
            img_bytes = pix.tobytes("png")
            return base64.b64encode(img_bytes).decode("ascii")
        finally:
            pdf_doc.close()

    def render_all_pages(self, dpi=None):
        """Render all pages. Returns list of {page, image} dicts."""
        if dpi is None:
            dpi = self._dpi

        if not self.pdf_path or not os.path.exists(self.pdf_path):
            self._export_pdf()

        pdf_doc = fitz.open(self.pdf_path)
        try:
            pages = []
            zoom = dpi / 72.0
            matrix = fitz.Matrix(zoom, zoom)
            for i in range(len(pdf_doc)):
                page = pdf_doc[i]
                pix = page.get_pixmap(matrix=matrix)
                img_bytes = pix.tobytes("png")
                pages.append({
                    "page": i + 1,
                    "image": base64.b64encode(img_bytes).decode("ascii"),
                })
            return pages
        finally:
            pdf_doc.close()

    def close(self):
        """Close document and clean up temp file."""
        if self.doc is not None:
            try:
                self.doc.Close()
            except Exception:
                pass
            self.doc = None
        if self.pdf_path and os.path.exists(self.pdf_path):
            try:
                os.unlink(self.pdf_path)
            except Exception:
                pass
            self.pdf_path = None
        self.page_count = 0
        self.document_open = False

    def quit(self):
        """Shut down WPS COM and clean up."""
        self.close()
        if self.app is not None:
            try:
                self.app.Quit()
            except Exception:
                pass
            self.app = None


# ═══════════════════════════════════════════════════════════════════════════
#  JSON-line IPC main loop
# ═══════════════════════════════════════════════════════════════════════════

def main():
    renderer = WpsRenderer()

    # Graceful shutdown on signals
    def _shutdown(_sig, _frame):
        renderer.quit()
        sys.exit(0)
    signal.signal(signal.SIGINT, _shutdown)
    signal.signal(signal.SIGTERM, _shutdown)

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            msg = json.loads(line)
        except json.JSONDecodeError as e:
            resp = {"id": None, "error": {"code": -32700, "message": f"Parse error: {e}"}}
            sys.stdout.write(json.dumps(resp, ensure_ascii=False) + "\n")
            sys.stdout.flush()
            continue

        msg_id = msg.get("id")
        method = msg.get("method", "")
        params = msg.get("params", {})

        try:
            if method == "ping":
                result = {"version": "1.0.0"}
            elif method == "warm_up":
                result = renderer.warm_up()
            elif method == "check_deps":
                result = renderer.check_deps()
            elif method == "open_document":
                dpi = params.get("dpi", 200)
                count = renderer.open(params["path"], dpi)
                result = {"page_count": count}
            elif method == "render_page":
                dpi = params.get("dpi")
                image = renderer.render_page(params["page"], dpi)
                result = {"image": image}
            elif method == "render_all_pages":
                dpi = params.get("dpi")
                pages = renderer.render_all_pages(dpi)
                result = {"pages": pages}
            elif method == "get_page_count":
                result = {"page_count": renderer.page_count}
            elif method == "close_document":
                renderer.close()
                result = {"ok": True}
            elif method == "shutdown":
                renderer.quit()
                result = {"ok": True}
                response = {"id": msg_id, "result": result}
                sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
                sys.stdout.flush()
                sys.exit(0)
            else:
                raise ValueError(f"Unknown method: {method}")

            response = {"id": msg_id, "result": result}

        except Exception as e:
            tb = traceback.format_exc()
            response = {
                "id": msg_id,
                "error": {"code": -1, "message": str(e), "traceback": tb},
            }

        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


if __name__ == "__main__":
    main()
