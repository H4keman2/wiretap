#!/usr/bin/env python3
"""Regression: the roster "Add player" (+) button must add the real player.

"Add player by name" in the Team Analyzer searches for real players. Pressing
Enter adds the highlighted suggestion with its real player id, but the "+"
button used to build a synthetic `manual-<query>` entry unconditionally — so
tapping "+" while the exact player sat in the suggestions created an entry
scored on a generic replacement-level baseline and flagged UNMATCHED. Both
affordances now share one submitAdd() that prefers the highlighted suggestion.

  1. Suggestions visible + tap "+"        -> real player, no UNMATCHED badge.
  2. No suggestions + tap "+"             -> manual entry, UNMATCHED badge.
  3. Suggestions + ArrowDown + Enter      -> highlighted real player (unchanged).

The player search is a server function that needs a real license, so this test
answers it locally with two fixture rows, encoded in the exact format the
backend replies with (seroval cross-JSON). Everything else — the input, the
suggestion list, the "+" button, the roster rows — is the app's own code.

Run:  python3 tests/e2e/analyzer_plus_adds_real_player.py [base_url]
Exits non-zero on the first failed assertion. Screenshots land in
/tmp/browser/wire-tap-analyzer-plus/.
"""

import asyncio
import base64
import json
import subprocess
import sys
import tempfile
from pathlib import Path
from urllib.parse import unquote

from playwright.async_api import async_playwright

BASE_URL = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080").rstrip("/")
SHOT_DIR = Path("/tmp/browser/wire-tap-analyzer-plus")
VIEWPORT = {"width": 1280, "height": 1800}
ROOT = Path(__file__).resolve().parents[2]

LICENSE_KEY = "wiretap.license.v1"
PRO_CACHE_KEY = "wiretap.license.verified-at.v1"

ROWS = [
    {"id": "espn-3916", "name": "James Cook", "team": "BUF", "position": "RB"},
    {"id": "espn-4239", "name": "Jahmyr Gibbs", "team": "DET", "position": "RB"},
]

ENCODER = """
import { toCrossJSONAsync } from "seroval";
const rows = %s;
process.stdout.write(JSON.stringify({
  hit: await toCrossJSONAsync({ result: rows, error: undefined, context: undefined }, { plugins: [] }),
  miss: await toCrossJSONAsync({ result: [], error: undefined, context: undefined }, { plugins: [] }),
}));
""" % json.dumps(ROWS)


def encode_payloads():
    """Ask the project's own serializer for the two search responses."""
    with tempfile.NamedTemporaryFile("w", suffix=".mjs", delete=False) as fh:
        fh.write(ENCODER)
        script = fh.name
    out = subprocess.run(
        ["bun", script],
        capture_output=True,
        text=True,
        env={"PATH": "/usr/bin:/bin", "NODE_PATH": str(ROOT / "node_modules"), "HOME": "/root"},
    )
    Path(script).unlink(missing_ok=True)
    if out.returncode != 0:
        raise SystemExit(f"could not encode fixture responses: {out.stderr[:300]}")
    return json.loads(out.stdout)


def server_fn(url):
    try:
        seg = url.split("/_serverFn/")[1].split("?")[0]
        pad = seg + "=" * (-len(seg) % 4)
        return json.loads(base64.urlsafe_b64decode(pad)).get("export", "")
    except Exception:
        return ""


def search_query(url):
    try:
        return json.loads(unquote(url.split("payload=")[1]))["t"]["p"]["v"][0]["p"]["v"][0]["s"].lower()
    except Exception:
        return ""


FAILURES = []


def check(label, ok, detail=""):
    print(("PASS  " if ok else "FAIL  ") + label + (f"  [{detail}]" if detail else ""))
    if not ok:
        FAILURES.append(label)


async def main():
    SHOT_DIR.mkdir(parents=True, exist_ok=True)
    payloads = encode_payloads()

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport=VIEWPORT)
        page = await ctx.new_page()
        page_errors = []
        page.on("pageerror", lambda e: page_errors.append(str(e)[:140]))

        async def route_handler(route):
            url = route.request.url
            if "/_serverFn/" in url and "searchPlayers" in server_fn(url):
                hit = "ja" in search_query(url)
                await route.fulfill(
                    status=200,
                    content_type="application/json",
                    headers={"x-tss-serialized": "true"},
                    body=json.dumps(payloads["hit" if hit else "miss"]),
                )
                return
            await route.continue_()

        await ctx.route("**/_serverFn/**", route_handler)

        # A locally verified license key so the Analyzer renders its roster editor.
        await page.goto(BASE_URL + "/", wait_until="domcontentloaded")
        await page.evaluate(
            "(keys) => { localStorage.setItem(keys[0],'WT-TEST-TEST');"
            "localStorage.setItem(keys[1], String(Date.now()));"
            "Object.keys(localStorage).filter(k => /roster/i.test(k)).forEach(k => localStorage.removeItem(k)); }",
            [LICENSE_KEY, PRO_CACHE_KEY],
        )
        await page.goto(BASE_URL + "/analyzer", wait_until="domcontentloaded")
        await page.wait_for_timeout(1800)

        entry = page.get_by_label("Add player by name")
        plus = page.get_by_role("button", name="Add player", exact=True)

        # 1. Real player visible in the suggestions, tap "+".
        await entry.click()
        await entry.type("Ja", delay=50)
        await page.wait_for_selector('[role="listbox"] li button', timeout=5000)
        await plus.click()
        await page.wait_for_timeout(700)
        body = await page.locator("body").inner_text()
        await page.screenshot(path=str(SHOT_DIR / "1_plus_with_suggestion.png"))
        check("plus with a suggestion adds the real player", "James Cook" in body)
        check("plus with a suggestion is not flagged UNMATCHED", body.count("UNMATCHED") == 0)
        check("plus does not add the typed text as a fake player", " manual" not in body.lower())

        # 2. Nothing matches, tap "+" -> manual entry, still flagged.
        await entry.click()
        await entry.fill("")
        await entry.type("Zzzqx", delay=40)
        await page.wait_for_timeout(800)
        check("no suggestions for a nonsense name",
              await page.locator('[role="listbox"] li button').count() == 0)
        await plus.click()
        await page.wait_for_timeout(700)
        body = await page.locator("body").inner_text()
        await page.screenshot(path=str(SHOT_DIR / "2_plus_manual_fallback.png"))
        check("plus with no suggestion still adds the typed name", "Zzzqx" in body)
        check("the manual entry is flagged UNMATCHED", body.count("UNMATCHED") == 1)

        # 3. Enter with ArrowDown still adds the highlighted real player.
        await entry.click()
        await entry.fill("")
        await entry.type("Ja", delay=50)
        await page.wait_for_selector('[role="listbox"] li button', timeout=5000)
        await entry.press("ArrowDown")
        await page.wait_for_timeout(200)
        await entry.press("Enter")
        await page.wait_for_timeout(700)
        body = await page.locator("body").inner_text()
        await page.screenshot(path=str(SHOT_DIR / "3_enter_arrow.png"))
        check("Enter+Arrow adds the highlighted real player", "Jahmyr Gibbs" in body)
        check("Enter adds no extra UNMATCHED entry", body.count("UNMATCHED") == 1)

        check("no page errors", not page_errors, "; ".join(page_errors[:2]))
        await browser.close()

    if FAILURES:
        print(f"\n{len(FAILURES)} check(s) failed: {FAILURES}")
        raise SystemExit(1)
    print("\nall checks passed")


asyncio.run(main())
