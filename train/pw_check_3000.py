from playwright.sync_api import sync_playwright


def main() -> None:
    base = "http://localhost:3000"
    paths = ["/", "/train"]

    results = {}
    total_session_401 = 0

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1280, "height": 720})
        page = context.new_page()

        pageerrors = []

        def on_pageerror(exc):
            pageerrors.append(str(exc))

        page.on("pageerror", on_pageerror)

        def on_response(resp):
            nonlocal total_session_401
            try:
                url = resp.url
                if url.endswith("/api/v1/auth/session") and resp.status == 401:
                    total_session_401 += 1
            except Exception:
                # best-effort collection only
                pass

        page.on("response", on_response)

        for path in paths:
            url = base + path
            resp = page.goto(url, wait_until="domcontentloaded")
            page.wait_for_load_state("networkidle")
            results[path] = {
                "doc_status": (resp.status if resp else None),
                "pageerror_count": len(pageerrors),
            }
            # best-effort visual artifact for debugging
            safe_name = "home" if path == "/" else path.strip("/").replace("/", "_")
            page.screenshot(path=f"/tmp/pw_{safe_name}.png", full_page=True)

        browser.close()

    # Console-friendly output (single line per path + session 401 count)
    for path in paths:
        r = results[path]
        print(f"{path}: doc={r['doc_status']} pageerror={r['pageerror_count']}")
    print(f"/api/v1/auth/session 401 count: {total_session_401}")


if __name__ == "__main__":
    main()

