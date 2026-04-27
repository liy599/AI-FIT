import os
import re
from dataclasses import dataclass, field
from typing import List, Optional, Tuple

from playwright.sync_api import ConsoleMessage, Page, Playwright, sync_playwright


BASE_URL = os.environ.get("BASE_URL", "http://127.0.0.1:5173").rstrip("/")


ROUTES = [
    "/",
    "/tools/pose",
    "/tools/pose/squat",
    "/tools/pose/squat/live",
    "/tools/pose/squat/video",
    "/tools/pose/squat/tool",
    "/tools/pose/squat/tool?mode=offline",
    "/login",
    "/register",
    "/profile",
    "/blogs",
    "/courses",
]


def _safe_name(path: str) -> str:
    if path == "/":
        return "root"
    s = path.strip("/").replace("/", "__")
    s = re.sub(r"[^a-zA-Z0-9_.-]+", "_", s)
    return s or "route"


@dataclass
class RouteResult:
    route: str
    final_url: str
    status: Optional[int]
    console_errors: List[str] = field(default_factory=list)
    page_errors: List[str] = field(default_factory=list)
    screenshot_path: str = ""


def _attach_error_collectors(page: Page) -> Tuple[List[str], List[str]]:
    console_errors: List[str] = []
    page_errors: List[str] = []

    def on_console(msg: ConsoleMessage) -> None:
        if msg.type == "error":
            try:
                loc = msg.location
                loc_str = f"{loc.get('url','')}:{loc.get('lineNumber','')}:{loc.get('columnNumber','')}"
            except Exception:
                loc_str = ""
            console_errors.append(f"[console.error] {msg.text} {loc_str}".strip())

    def on_pageerror(exc: Exception) -> None:
        page_errors.append(f"[pageerror] {exc!r}")

    page.on("console", on_console)
    page.on("pageerror", on_pageerror)
    return console_errors, page_errors


def _visit(playwright: Playwright, route: str) -> RouteResult:
    browser = playwright.chromium.launch(headless=True)
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()

    console_errors, page_errors = _attach_error_collectors(page)

    url = f"{BASE_URL}{route}"
    resp = page.goto(url, wait_until="domcontentloaded", timeout=45_000)
    page.wait_for_load_state("networkidle", timeout=45_000)

    out_png = f"/tmp/aifitguard_smoke_{_safe_name(route)}.png"
    page.screenshot(path=out_png, full_page=True)

    result = RouteResult(
        route=route,
        final_url=page.url,
        status=(resp.status if resp else None),
        console_errors=console_errors,
        page_errors=page_errors,
        screenshot_path=out_png,
    )

    context.close()
    browser.close()
    return result


def main() -> int:
    results: List[RouteResult] = []
    failures: List[str] = []

    with sync_playwright() as p:
        for route in ROUTES:
            try:
                r = _visit(p, route)
                results.append(r)
                if r.console_errors or r.page_errors:
                    failures.append(route)
            except Exception as e:
                results.append(
                    RouteResult(
                        route=route,
                        final_url="",
                        status=None,
                        console_errors=[],
                        page_errors=[f"[exception] {e!r}"],
                        screenshot_path="",
                    )
                )
                failures.append(route)

    print(f"BASE_URL={BASE_URL}")
    for r in results:
        print(f"\n=== {r.route} ===")
        print(f"final_url: {r.final_url}")
        print(f"status: {r.status}")
        if r.screenshot_path:
            print(f"screenshot: {r.screenshot_path}")
        for msg in r.console_errors:
            print(msg)
        for msg in r.page_errors:
            print(msg)

    if failures:
        print("\nFAIL routes:", ", ".join(failures))
        return 1

    print("\nOK: all routes opened with no browser console errors.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
