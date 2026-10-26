#!/usr/bin/env python3
"""Regression: Escape dismisses the "Add player by name" suggestions.

The roster editor's search input handles ArrowDown/ArrowUp/Enter but had no
Escape branch, so a keyboard user who opened the suggestion list could only
close it by tabbing through every option (or deleting the text a character at
a time). The trade page's player search already clears its query on Escape; the
analyzer input now does the same, which drops the suggestions through the
existing query-length effect.

  1. Type a name            -> suggestions open.
  2. Press Escape           -> input cleared, list gone, nothing added.
  3. Escape on an empty box -> harmless.
  4. Type the name again    -> suggestions come back.

The player search is a server function that needs a real license, so this test
answers it locally with two fixture rows in the exact format the backend replies
with (seroval cross-JSON). Everything else — the input, the suggestion list, the
keyboard handling — is the app's own code.

Run:  python3 tests/e2e/analyzer_escape_clears_suggestions.py [base_url]
Exits non-zero on the first failed assertion. Screenshots land in
/tmp/browser/wire-tap-escape/.
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
SHOT_DIR = Path("/tmp/browser/wire-tap-escape")
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
        listbox = page.locator('[role="listbox"] li button')

        # 1. Suggestions open for a real name.
        await entry.click()
        await entry.type("Ja", delay=50)
        await page.wait_for_selector('[role="listbox"] li button', timeout=5000)
        await page.screenshot(path=str(SHOT_DIR / "1_suggestions_open.png"))
        check("typing a name opens the suggestion list", await listbox.count() > 0)

        # 2. Escape dismisses the list, clears the box, and adds nobody.
        await entry.press("Escape")
        await page.wait_for_timeout(400)
        await page.screenshot(path=str(SHOT_DIR / "2_after_escape.png"))
        check("Escape clears the input", (await entry.input_value()) == "")
        check("Escape closes the suggestion list", await listbox.count() == 0)
        body = await page.locator("body").inner_text()
        check("Escape does not add a player", "James Cook" not in body)
        check(
            "Escape leaves focus in the input",
            await entry.evaluate("el => el === document.activeElement"),
        )

        # 3. Escape on an already-empty box does nothing harmful.
        await entry.press("Escape")
        await page.wait_for_timeout(300)
        check("Escape on an empty input keeps it empty", (await entry.input_value()) == "")
        check("Escape on an empty input adds nothing", "James Cook" not in await page.locator("body").inner_text())

        # 4. The box works again right after being dismissed.
        await entry.type("Ja", delay=50)
        try:
            await page.wait_for_selector('[role="listbox"] li button', timeout=5000)
            reopened = True
        except Exception:
            reopened = False
        await page.screenshot(path=str(SHOT_DIR / "3_reopened.png"))
        check("typing again reopens the suggestion list", reopened)

        check("no page errors", not page_errors, "; ".join(page_errors[:2]))
        await browser.close()

    if FAILURES:
        print(f"\n{len(FAILURES)} check(s) failed: {FAILURES}")
        raise SystemExit(1)
    print("\nall checks passed")


asyncio.run(main())
