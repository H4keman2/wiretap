#!/usr/bin/env python3
"""Regression: clearing planned bids must be confirmed, not one accidental tap.

The planned-bids "Clear" button used to call clear() on click — one stray tap
deleted every saved bid with only a toast afterwards. It now opens a
confirmation dialog (same pattern as the watchlist "Clear all" and the
Settings "Remove key" dialogs):

  1. Clicking "Clear" opens the dialog and changes nothing yet.
  2. "Cancel" leaves every planned bid in place.
  3. The destructive "Clear all" action empties storage and reports back.

Run:  python3 tests/e2e/bids_clear_requires_confirm.py [base_url]
Exits non-zero on the first failed assertion. Screenshots land in
/tmp/browser/wire-tap-bids-clear/.
"""

import asyncio
import json
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
SHOT_DIR = Path("/tmp/browser/wire-tap-bids-clear")
VIEWPORT = {"width": 1280, "height": 1800}

ESPN_KEY = "wiretap.espn-league.v1"
BIDS_KEY = "wiretap.bids.v1"

# A connected league so the page renders the planned-bids section at all.
CONNECTION = {
    "leagueId": "90273659",
    "espnS2": "x",
    "swid": "{x}",
    "teamId": 1,
    "summary": {"format": "ppr", "teams": []},
}
BIDS = [
    {"id": "p1", "name": "James Cook", "position": "RB", "team": "BUF", "amount": 20, "suggested": 13, "at": 1},
    {"id": "p2", "name": "Trey Benson", "position": "RB", "team": "ARI", "amount": 10, "suggested": 8, "at": 2},
]

failures: list[str] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    if ok:
        print(f"PASS  {label}")
    else:
        msg = f"{label}{' — ' + detail if detail else ''}"
        print(f"FAIL  {msg}")
        failures.append(msg)


async def stored_bids(page) -> list:
    raw = await page.evaluate(f"() => localStorage.getItem({json.dumps(BIDS_KEY)})")
    return json.loads(raw) if raw else []


async def row_count(page) -> int:
    return await page.locator("li:has(button[aria-label^='Remove bid on'])").count()


async def open_bids(browser):
    """Fresh context with a connected league and two planned bids saved."""
    ctx = await browser.new_context(viewport=VIEWPORT)
    page = await ctx.new_page()
    pageerrors: list[str] = []
    page.on("pageerror", lambda e: pageerrors.append(str(e)))
    await page.goto(f"{BASE_URL}/bids", wait_until="domcontentloaded")
    await page.evaluate(
        "([espnKey, conn, bidsKey, bids]) => {"
        " sessionStorage.setItem(espnKey, JSON.stringify(conn));"
        " localStorage.setItem(bidsKey, JSON.stringify(bids)); }",
        [ESPN_KEY, CONNECTION, BIDS_KEY, BIDS],
    )
    await page.reload(wait_until="domcontentloaded")
    await page.wait_for_selector("text=Your planned bids", timeout=15000)
    await page.wait_for_timeout(600)
    return ctx, page, pageerrors


async def test_clear_requires_confirm(browser) -> None:
    ctx, page, pageerrors = await open_bids(browser)
    check(await row_count(page) == 2, "two planned bids are on screen")
    check(await page.locator("[role=alertdialog]").count() == 0, "no dialog before the tap")

    await page.get_by_role("button", name="Clear", exact=True).click()
    await page.wait_for_selector("[role=alertdialog]", timeout=5000)
    dlg = page.locator("[role=alertdialog]")
    await dlg.screenshot(path=str(SHOT_DIR / "confirm.png"))
    title = await dlg.locator("h2").first.inner_text()
    check("Clear all planned bids?" in title, "dialog asks before wiping", f"title={title!r}")
    check(await row_count(page) == 2, "the tap alone removes nothing")
    check(len(await stored_bids(page)) == 2, "storage untouched while the dialog is open")

    await dlg.get_by_role("button", name="Cancel").click()
    await page.wait_for_timeout(500)
    check(await page.locator("[role=alertdialog]").count() == 0, "Cancel closes the dialog")
    check(await row_count(page) == 2, "Cancel keeps both bids on screen")
    check(len(await stored_bids(page)) == 2, "Cancel keeps both bids saved")
    await page.screenshot(path=str(SHOT_DIR / "cancelled.png"))

    await page.get_by_role("button", name="Clear", exact=True).click()
    await page.wait_for_selector("[role=alertdialog]", timeout=5000)
    await page.locator("[role=alertdialog]").get_by_role("button", name="Clear all").click()
    toast = page.locator("text=Planned bids cleared.")
    await toast.wait_for(timeout=5000)
    check(True, "confirming reports 'Planned bids cleared.'")
    await page.wait_for_timeout(600)
    check(await stored_bids(page) == [], "confirming empties the saved list")
    check(await row_count(page) == 0, "confirming clears the rows")
    check(
        await page.locator("text=Your planned bids").count() == 0,
        "the section is gone once it is empty",
    )
    await page.screenshot(path=str(SHOT_DIR / "cleared.png"))
    check(not pageerrors, "no page errors", "; ".join(pageerrors[:3]))
    await ctx.close()


async def main() -> None:
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            await test_clear_requires_confirm(browser)
        finally:
            await browser.close()
    if failures:
        print(f"\n{len(failures)} check(s) failed")
        sys.exit(1)
    print("\nall checks passed")


asyncio.run(main())
