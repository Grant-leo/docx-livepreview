/**
 * wpsRenderer.ts — High-level WPS rendering API.
 *
 * Wraps PythonManager with convenient methods:
 * open, renderPage, renderAllPages, close.
 */
import { PythonManager } from "./pythonManager";
import { getRenderDpi } from "./config";

export interface PageImage {
  page: number;
  image: string; // base64 PNG
}

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
    });
    this.currentPath = path;
    this._pageCount = result.page_count;
    return this._pageCount;
  }

  /** Render a single page (1-based). Optional dpi override. Returns base64 PNG string. */
  async renderPage(page: number, dpi?: number): Promise<string> {
    const params: Record<string, any> = { page };
    if (dpi !== undefined) { params.dpi = dpi; }
    const result = await this.python.send("render_page", params);
    return result.image;
  }

  /** Render all pages. Optional dpi override. Returns array of {page, image}. */
  async renderAllPages(dpi?: number): Promise<PageImage[]> {
    const params: Record<string, any> = {};
    if (dpi !== undefined) { params.dpi = dpi; }
    const result = await this.python.send("render_all_pages", params);
    return result.pages;
  }

  get pageCount(): number {
    return this._pageCount;
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
