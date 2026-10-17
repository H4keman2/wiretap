#!/usr/bin/env python3
"""Regression: a throwing localStorage must not break license activation.

Private-browsing / quota failures make localStorage calls throw. Every other
store in the app guards those calls, and usePro() must do the same:

  1. Mount read: getItem throwing for the license keys must still render the
     Settings page with the license field (no crash, no blank Pro section).
  2. Activation: removeItem throwing for the license keys must still surface
     the server's real reason ("not recognized") — not the generic
     "Could not reach the license server" that a swallowing outer catch
     would produce.

Run:  python3 tests/e2e/license_storage_failure_survives.py [base_url]
Exits non-zero on the first failed assertion. Screenshots land in
/tmp/browser/wire-tap-license-storage/.
"""

import asyncio
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
SHOT_DIR = Path("/tmp/browser/wire-tap-license-storage")
VIEWPORT = {"width": 1280, "height": 1800}

failures: list[str] = []

# Only license keys throw, so the rest of the app's storage keeps working and a
# failure here is unambiguously about the license guard.
GUARD = """
(() => {
  const mode = new URLSearchParams(location.hash.slice(1)).get("break");
  const isLic = (k) => typeof k === "string" && k.startsWith("wiretap.license");
  const g = Storage.prototype.getItem, s = Storage.prototype.setItem, r = Storage.prototype.removeItem;
  const boom = () => { const e = new Error("QuotaExceededError"); e.name = "QuotaExceededError"; throw e; };
  Storage.prototype.getItem = function(k){ if (mode === "get" && isLic(k)) boom(); return g.call(this,k); };
  Storage.prototype.setItem = function(k,v){ if (mode === "set" && isLic(k)) boom(); return s.call(this,k,v); };
  Storage.prototype.removeItem = function(k){ if (mode === "remove" && isLic(k)) boom(); return r.call(this,k); };
})();
"""


def check(ok: bool, label: str, detail: str = "") -> None:
    if ok:
        print(f"PASS  {label}")
    else:
        msg = f"{label}{' — ' + detail if detail else ''}"
        print(f"FAIL  {msg}")
        failures.append(msg)


async def open_settings(browser, mode: str):
    """Fresh context with the storage break installed before any app script."""
    ctx = await browser.new_context(viewport=VIEWPORT)
    await ctx.add_init_script(GUARD)
    page = await ctx.new_page()
    pageerrors: list[str] = []
    page.on("pageerror", lambda e: pageerrors.append(str(e)))
    await page.goto(f"{BASE_URL}/settings#break={mode}", wait_until="domcontentloaded")
    await page.wait_for_timeout(2500)
    return ctx, page, pageerrors


async def test_mount_read_survives(browser) -> None:
    ctx, page, pageerrors = await open_settings(browser, "get")
    field = await page.locator("label[for='license']").count()
    check(field > 0, "settings renders the license field when getItem throws")
    check(not pageerrors, "no uncaught error when getItem throws", "; ".join(pageerrors[:2]))
    await page.screenshot(path=str(SHOT_DIR / "mount_read.png"))
    await ctx.close()


async def test_activation_reports_real_reason(browser) -> None:
    ctx, page, pageerrors = await open_settings(browser, "remove")
    await page.fill("#license", "WT-TEST-TEST")
    await page.get_by_role("button", name="Activate").click()
    alert = page.locator("[role='alert']").first
    shown = False
    try:
        await alert.wait_for(state="visible", timeout=25000)
        shown = True
    except Exception:
        pass
    text = (await alert.inner_text()).strip() if shown else ""
    check(shown, "activation still shows an error when removeItem throws")
    check("not recognized" in text.lower(), "activation names the real reason", text)
    check(
        "could not reach the license server" not in text.lower(),
        "storage failure is not reported as a network failure",
        text,
    )
    check(not pageerrors, "no uncaught error during activation", "; ".join(pageerrors[:2]))
    await page.screenshot(path=str(SHOT_DIR / "activation.png"))
    await ctx.close()


async def main() -> None:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            await test_mount_read_survives(browser)
            await test_activation_reports_real_reason(browser)
        finally:
            await browser.close()
    if failures:
        print(f"\n{len(failures)} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")


asyncio.run(main())
