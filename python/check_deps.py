"""
check_deps.py — standalone dependency checker for word-chat-livepreview.

Exits 0 if all dependencies are available, 1 otherwise.
Outputs JSON to stdout.
"""
import sys
import json


def main():
    result = {
        "python": f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}",
    }

    # Check pywin32
    try:
        import win32com.client  # noqa: F401
        result["win32com"] = True
    except ImportError:
        result["win32com"] = False

    # Check PyMuPDF (fitz)
    try:
        import fitz  # noqa: F401
        result["fitz"] = fitz.version  # type: ignore
    except ImportError:
        result["fitz"] = False

    # Check WPS
    wps_ok = False
    try:
        import pythoncom
        pythoncom.CoInitialize()
        for pid in ["Kwps.Application", "wps.Application", "WPS.Application"]:
            try:
                app = win32com.client.Dispatch(pid)  # type: ignore # noqa: F821
                app.Quit()
                wps_ok = True
                break
            except Exception:
                continue
    except Exception:
        pass
    result["wps"] = wps_ok

    all_ok = all([
        result.get("win32com", False),
        result.get("fitz", False),
        result.get("wps", False),
    ])

    print(json.dumps(result, ensure_ascii=False))
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
