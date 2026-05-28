/**
 * wpsRenderer.ts — High-level WPS rendering API.
 *
 * Wraps PythonManager with convenient methods:
 * open, renderPage, close.
 */
import { PythonManager } from "./pythonManager";
import { getRenderDpi } from "./config";

const OPEN_DOCUMENT_TIMEOUT_MS = 180000;
const RENDER_PAGE_TIMEOUT_MS = 120000;
const BOOKMARK_TIMEOUT_MS = 120000;

export class WpsRenderer {
  private python: PythonManager;
  private currentPath: string | null = null;
  private _pageCount = 0;
  private _dpi: number;

  constructor(python: PythonManager) {
    this.python = python;
    this._dpi = getRenderDpi();
  }

  /** Open a DOCX file. Returns page count. */
  async open(path: string): Promise<number> {
    if (this.currentPath) {
      await this.close();
    }

    const result = await this.python.send("open_document", {
      path,
      dpi: this._dpi,
    }, OPEN_DOCUMENT_TIMEOUT_MS);
    this.currentPath = path;
    this._pageCount = result.page_count;
    return this._pageCount;
  }

  /** Render a single page (1-based). Optional dpi override. Returns base64 PNG string. */
  async renderPage(page: number, dpi?: number): Promise<string> {
    const params: Record<string, any> = { page };
    if (dpi !== undefined) { params.dpi = dpi; }
    const result = await this.python.send("render_page", params, RENDER_PAGE_TIMEOUT_MS);
    return result.image;
  }

  get pageCount(): number {
    return this._pageCount;
  }

  /** Forward search: navigate to _src_L{line} bookmark, return page + position in PDF points. */
  async forwardSearch(sourceLine: number): Promise<{ page: number; x: number; y: number } | null> {
    const result = await this.python.send("forward_search", { source_line: sourceLine });
    return result.found ? { page: result.page, x: result.x, y: result.y } : null;
  }

  /** Reverse search: find nearest _src_L bookmark to (x,y) in PDF points. */
  async reverseSearch(
    pageNum: number, x: number, y: number
  ): Promise<{ sourceLine: number } | null> {
    const result = await this.python.send("reverse_search", {
      page_num: pageNum, x, y,
    });
    return result.found ? { sourceLine: result.source_line } : null;
  }

  /** Get page + position for all _src_L bookmarks. Returns {sourceLine: {page, x, y}}. */
  async getAllBookmarkPositions(): Promise<Record<string, { page: number; x: number; y: number }>> {
    const result = await this.python.send("get_bookmark_positions", {}, BOOKMARK_TIMEOUT_MS);
    return result.positions || {};
  }

  /** Close the current document. */
  async close(): Promise<void> {
    if (this.currentPath) {
      try {
        await this.python.send("close_document", {});
      } catch {
        // Ignore close errors
      }
      this.currentPath = null;
      this._pageCount = 0;
    }
  }
}
