#!/usr/bin/env python3
"""Mobile (390px) regression tests for the Wire Tap waiver browser.

Covers three regressions:
  1. Hero card: no text overlapping the "Analyze my roster" button.
  2. Position selector: every position chip (incl. DST and K) is fully visible.
  3. Player cards: the "Top ... targets" list renders real player data.

Run:  python3 tests/e2e/mobile_waiver_browser.py [base_url]
Exits non-zero on the first failed assertion. Screenshots land in
/tmp/browser/wire-tap-mobile/.
"""

import asyncio
import os
import sys

from playwright.async_api import async_playwright

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
SHOT_DIR = "/tmp/browser/wire-tap-mobile"
VIEWPORT = {"width": 390, "height": 1400}

failures: list[str] = []


def check(ok: bool, label: str, detail: str = "") -> None:
    if ok:
        print(f"PASS  {label}")
    else:
        msg = f"{label}{' — ' + detail if detail else ''}"
        print(f"FAIL  {msg}")
        failures.append(msg)


async def box(locator):
    b = await locator.bounding_box()
    assert b, "element has no bounding box"
    return b


def overlaps(a, b) -> bool:
    return not (
        a["x"] + a["width"] <= b["x"]
        or b["x"] + b["width"] <= a["x"]
        or a["y"] + a["height"] <= b["y"]
        or b["y"] + b["height"] <= a["y"]
    )


async def test_hero_no_overlap(page):
    button = page.get_by_role("link", name="Analyze my roster")
    await button.wait_for(state="visible")
    btn = await box(button)

    hero = button.locator("xpath=ancestor::section[1]")
    texts = hero.locator("p, span, h2")
    bad = []
    for i in range(await texts.count()):
        node = texts.nth(i)
        if not await node.is_visible():
            continue
        content = (await node.inner_text()).strip()
        if not content:
            continue
        if overlaps(await box(node), btn):
            bad.append(content[:60])

    check(not bad, "hero text does not overlap the Analyze button", "; ".join(bad))


async def test_position_selector_visible(page):
    expected = ["QB", "RB", "WR", "TE", "FLEX", "DST", "K"]
    clipped = []
    for label in expected:
        chip = page.get_by_role("button", name=label, exact=True)
        if await chip.count() == 0:
            clipped.append(f"{label} missing")
            continue
        b = await box(chip.first)
        if b["x"] < 0 or b["x"] + b["width"] > VIEWPORT["width"] + 0.5:
            clipped.append(f"{label} clipped at x={b['x']:.0f}+{b['width']:.0f}")
        if b["width"] < 24 or b["height"] < 24:
            clipped.append(f"{label} too small")
    check(not clipped, "all position chips fit inside a 390px viewport", "; ".join(clipped))


async def test_player_cards_render(page):
    cards = page.locator('article[aria-label^="Open"]')
    try:
        await cards.first.wait_for(state="visible", timeout=30_000)
    except Exception:
        check(False, "player cards render with data", "no player cards appeared within 30s")
        return

    count = await cards.count()
    first = (await cards.first.inner_text()).lower()
    has_owned = "owned" in first
    has_proj = "proj" in first
    has_score = "/10" in first
    check(count >= 1, "at least one player card renders", f"count={count}")
    check(
        has_owned and has_proj and has_score,
        "first player card shows score, ownership and projection",
        first.replace("\n", " | ")[:160],
    )


async def main():
    os.makedirs(SHOT_DIR, exist_ok=True)
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport=VIEWPORT)
        page = await context.new_page()
        console_errors: list[str] = []
        page.on(
            "console",
            lambda m: console_errors.append(m.text) if m.type == "error" else None,
        )

        await page.goto(f"{BASE_URL}/", wait_until="domcontentloaded")
        await page.get_by_role("link", name="Analyze my roster").wait_for(state="visible")

        await test_hero_no_overlap(page)
        await test_position_selector_visible(page)
        await test_player_cards_render(page)

        await page.screenshot(path=f"{SHOT_DIR}/waiver-browser-390.png")
        check(not console_errors, "no console errors", "; ".join(console_errors[:3]))

        await browser.close()

    print()
    if failures:
        print(f"{len(failures)} check(s) failed")
        sys.exit(1)
    print("all checks passed")


if __name__ == "__main__":
    asyncio.run(main())
