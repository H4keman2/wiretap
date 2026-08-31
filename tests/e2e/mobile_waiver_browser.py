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
import json
import os
import re
import sys
import urllib.parse

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


async def owned_pct(card) -> float | None:
    text = await card.inner_text()
    m = re.search(r"owned[^\d]*(\d+)%", text, re.IGNORECASE)
    return float(m.group(1)) if m else None


async def card_names(page) -> list[str]:
    cards = page.locator('article[aria-label^="Open"]')
    return [await cards.nth(i).get_attribute("aria-label") for i in range(await cards.count())]


async def wait_cards(page, timeout=30_000):
    cards = page.locator('article[aria-label^="Open"]')
    await cards.first.wait_for(state="visible", timeout=timeout)
    return cards


async def set_threshold(page, value: int):
    """Drive the Radix slider to an exact value with End/Home + arrow keys."""
    thumb = page.get_by_role("slider")
    await thumb.wait_for(state="attached")
    await thumb.focus()
    await page.keyboard.press("Home" if value <= 40 else "End")
    for _ in range(30):
        now = int(await thumb.get_attribute("aria-valuenow"))
        if now == value:
            break
        await page.keyboard.press("ArrowRight" if value > now else "ArrowLeft")
    assert int(await thumb.get_attribute("aria-valuenow")) == value


async def test_ownership_threshold_filters(page):
    cards = page.locator('article[aria-label^="Open"]')

    # Wide net: 80% threshold.
    await set_threshold(page, 80)
    await wait_cards(page)
    await page.wait_for_function(
        "([...document.querySelectorAll('article[aria-label^=\"Open\"] dd')]"
        "  .some(d => /owned/i.test(d.previousElementSibling?.textContent ?? '')))",
        timeout=30_000,
    )
    wide_names = await card_names(page)
    wide_count = await cards.count()
    wide_owned = [await owned_pct(cards.nth(i)) for i in range(wide_count)]

    check(wide_count >= 1, "cards render at 80% threshold", f"count={wide_count}")
    check(
        all(o is not None for o in wide_owned),
        "every card at 80% exposes an ownership %",
        str(wide_owned),
    )
    check(
        any(o is not None and o > 40 for o in wide_owned),
        "80% threshold surfaces players above the 40% default",
        str(wide_owned),
    )

    # Tight net: 10% threshold — list must refresh and respect the filter.
    await set_threshold(page, 10)
    await page.wait_for_function(
        "document.querySelectorAll('article[aria-label^=\"Open\"]').length >= 0"
    )
    try:
        await wait_cards(page, timeout=30_000)
    except Exception:
        # No players under 10% owned is a valid outcome; the empty-state copy must show.
        empty = page.get_by_text(re.compile(r"No \w+ options under 10% rostered"))
        check(
            await empty.count() >= 1,
            "10% threshold shows either filtered cards or the empty state",
        )
        return

    tight_names = await card_names(page)
    tight_count = await cards.count()
    tight_owned = [await owned_pct(cards.nth(i)) for i in range(tight_count)]

    check(tight_count >= 1, "cards render at 10% threshold", f"count={tight_count}")
    check(
        tight_names != wide_names or tight_count != wide_count,
        "changing the threshold updates the list",
        f"wide={wide_names} tight={tight_names}",
    )
    check(
        all(o is not None and o < 10 for o in tight_owned),
        "every card at 10% is under 10% owned",
        str(tight_owned),
    )


async def test_empty_state_no_stale_cards(page):
    """Even the tightest slider setting (10%) still matches deep players, so we
    force the genuine "no matches" case by rewriting the request the UI sends to
    an unmatchable threshold. The response is real server output for an empty
    pool: the UI must show the empty state and drop every stale card."""
    cards = page.locator('article[aria-label^="Open"]')

    # Baseline: a populated list, so we can prove the cards actually get cleared.
    await set_threshold(page, 80)
    await wait_cards(page)
    before = await cards.count()
    check(before >= 1, "baseline list is populated before forcing the empty state", f"count={before}")

    def is_waivers_call(url: str) -> bool:
        return "/_serverFn/" in url and "d2Fpdm" in url  # base64 of "…/waivers…"

    async def starve(route):
        url = route.request.url
        query = urllib.parse.parse_qs(urllib.parse.urlparse(url).query)
        payload = json.loads(query["payload"][0])
        # data.maxOwnership -> 0; `ownership < 0` can never match a player.
        payload["t"]["p"]["v"][0]["p"]["v"][2]["s"] = 0
        starved = f"{url.split('?')[0]}?payload={urllib.parse.quote(json.dumps(payload))}"
        await route.fulfill(response=await route.fetch(url=starved))

    await page.route(is_waivers_call, starve)
    try:
        await set_threshold(page, 75)  # any change re-issues the (starved) query
        empty = page.get_by_text(re.compile(r"No \w+ options under 75% rostered", re.IGNORECASE))
        try:
            await empty.first.wait_for(state="visible", timeout=20_000)
            shown = True
        except Exception:
            shown = False
        check(shown, "empty state copy is shown when no players match the threshold")
        leftover = await cards.count()
        check(leftover == 0, "no stale player cards remain", f"leftover={leftover}")
        skeletons = page.locator('[data-slot="skeleton"]')
        check(await skeletons.count() == 0, "no loading skeletons remain in the empty state",
              f"skeletons={await skeletons.count()}")
        await page.screenshot(path=f"{SHOT_DIR}/empty-state-390.png")
    finally:
        await page.unroute(is_waivers_call, starve)

    # Recovery: with live results back, the list repopulates.
    await set_threshold(page, 80)
    try:
        await wait_cards(page)
        recovered = await cards.count()
    except Exception:
        recovered = 0
    check(recovered >= 1, "list recovers once matching players come back", f"count={recovered}")


async def section_label(page) -> str:
    return (await page.get_by_text(re.compile(r"^Top \w+ targets$")).first.inner_text()).strip()


async def test_position_switch_updates_list(page):
    cards = page.locator('article[aria-label^="Open"]')
    cards_ready = (
        "([...document.querySelectorAll('article[aria-label^=\"Open\"] dd')]"
        "  .some(d => /owned/i.test(d.previousElementSibling?.textContent ?? '')))"
    )

    # Baseline: RB list at the default 40% threshold.
    await wait_cards(page)
    await page.wait_for_function(cards_ready, timeout=30_000)
    rb_names = await card_names(page)
    rb_label = await section_label(page)
    check("RB" in rb_label, "section starts on Top RB targets", rb_label)
    check(len(rb_names) >= 1, "rb baseline list is non-empty", f"count={len(rb_names)}")

    # Switch to WR: heading and list must change, threshold still applies.
    await page.get_by_role("button", name="WR", exact=True).first.click()
    await wait_cards(page)
    await page.wait_for_function(cards_ready, timeout=30_000)
    wr_label = await section_label(page)
    wr_names = await card_names(page)
    wr_owned = [await owned_pct(cards.nth(i)) for i in range(await cards.count())]

    check("WR" in wr_label, "section label updates to Top WR targets", wr_label)
    check(
        wr_names != rb_names and len(wr_names) >= 1,
        "switching RB -> WR changes the player list",
        f"rb={rb_names[:3]} wr={wr_names[:3]}",
    )
    check(
        all(o is not None and o < 40 for o in wr_owned) and len(wr_owned) >= 1,
        "WR cards respect the active 40% ownership threshold",
        str(wr_owned),
    )
    wr_bodies = [(await cards.nth(i).inner_text()) for i in range(await cards.count())]
    check(
        all("• WR" in body for body in wr_bodies),
        "every card after the switch is a WR",
        "; ".join(b.splitlines()[1] if len(b.splitlines()) > 1 else b[:40] for b in wr_bodies[:3]),
    )

    # Edge case: FLEX mixes RB/WR/TE — list must change and stay threshold-bound.
    await page.get_by_role("button", name="FLEX", exact=True).first.click()
    await wait_cards(page)
    await page.wait_for_function(cards_ready, timeout=30_000)
    flex_label = await section_label(page)
    flex_names = await card_names(page)
    flex_bodies = [(await cards.nth(i).inner_text()) for i in range(await cards.count())]
    flex_owned = [await owned_pct(cards.nth(i)) for i in range(await cards.count())]
    flex_positions = {
        m.group(1)
        for body in flex_bodies
        for m in [re.search(r"•\s*(QB|RB|WR|TE|DST|K)\b", body)]
        if m
    }

    check("FLEX" in flex_label, "section label updates to Top FLEX targets", flex_label)
    check(
        flex_names != wr_names and len(flex_names) >= 1,
        "switching WR -> FLEX changes the player list",
        f"wr={wr_names[:3]} flex={flex_names[:3]}",
    )
    check(
        len(flex_bodies) == len(flex_names) and flex_positions <= {"RB", "WR", "TE"} and len(flex_positions) >= 1,
        "every FLEX card is an RB, WR or TE",
        f"positions={sorted(flex_positions)}",
    )
    check(
        all(o is not None and o < 40 for o in flex_owned) and len(flex_owned) >= 1,
        "FLEX cards respect the active 40% ownership threshold",
        str(flex_owned),
    )

    # Switch back so later tests start from RB.
    await page.get_by_role("button", name="RB", exact=True).first.click()
    await wait_cards(page)


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
        await test_position_switch_updates_list(page)
        await test_ownership_threshold_filters(page)
        await test_empty_state_no_stale_cards(page)

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
