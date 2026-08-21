# Wire Tap Advisor

Waiver Wire Assistant - Lovable Build Prompt - website name: Wire Tap

Product Summary

A fantasy football tool that analyzes a user’s roster, identifies their weakest position(s), and recommends widely available waiver wire pickups based on ownership percentage rather than a specific platform login. Users can also manually select a position to get recommendations regardless of the tool’s auto-detected weak spot.

Target User

Fantasy football players on any platform (Sleeper, ESPN, Yahoo, NFL.com) who want quick, data-informed waiver wire advice without connecting a league account.

Core User Flow

Free tier

	1.	User selects league format (PPR, half-PPR, standard)

	2.	User picks any position (QB, RB, WR, TE, FLEX, DST, K) from a simple selector, no roster entry required

	3.	Tool shows available players at that position, ranked by recommendation strength, filtered by ownership threshold

	4.	User can adjust the ownership threshold (default 40%, slider range 10% to 80%)

This means anyone can land on the tool and immediately get value, browse waiver targets by position, with zero signup friction. This is the discovery and word of mouth layer.

Paid tier, the Team Analyzer

	1.	User enters league format and roster settings (starting lineup requirements, bench size)

	2.	User manually enters their current roster (player name, position)

	3.	Tool calculates positional strength scores across the roster

	4.	Tool surfaces the weakest position(s) automatically, with reasoning shown

	5.	Tool pulls available players at the flagged position(s), ranked by recommendation strength

	6.	Manual override still available, user can pick any position regardless of the auto-flagged weak spot

	7.	Same ownership threshold slider applies here too

MVP Feature List

1. Free: Position Browser

	•	Scoring format selector: Standard / Half-PPR / Full PPR

	•	Position selector: QB, RB, WR, TE, FLEX, DST, K

	•	Shows ranked waiver recommendations at that position, filtered by ownership threshold

	•	No account or roster entry required, this is the top-of-funnel feature

	•	Clear, visible prompt somewhere in the UI pointing to the paid Team Analyzer, something like “Want to know which position YOUR team needs? Analyze your roster”

2. Paid: League Setup Screen

	•	Starting lineup config: QB, RB, WR, TE, FLEX, DST, K counts (with sensible defaults, editable)

	•	Bench size input

	•	Save as a reusable league profile so returning users do not re-enter this weekly

3. Paid: Roster Entry Screen

	•	Add players by name and position (simple autocomplete against a player database, not a live search API to start)

	•	Tag each player as starter or bench

	•	Edit or remove players easily, this will be used weekly so the UI needs to be fast, not just functional

4. Paid: Positional Weakness Scoring

	•	Compare each starting position’s projected output against replacement-level baseline for that format

	•	Factor in bench depth per position (a thin bench at RB is a bigger risk than a thin bench at K)

	•	Output a clear ranked list: “Your weakest positions are RB, then TE”

	•	Keep the scoring logic transparent, show the user why a position is flagged weak, not just a black box score

5. Waiver Recommendations (shared logic, free and paid)

	•	Rank within the eligible player pool by a blend of: season projection, recent trend (rostered percentage moving up = buy signal), and opportunity share if available (snap count, target share)

	•	Show 3 to 5 recommendations per position, not an overwhelming list

	•	Each recommendation includes a short reasoning line, similar in spirit to the executive summary style used in BizCase Builder, one or two sentences max, not a wall of text

6. Paid: Manual Position Override

	•	Dropdown or button row to select any position regardless of the auto-flagged weak spot within the Team Analyzer

	•	Same recommendation logic applies, just filtered to the chosen position

7. Ownership Threshold Slider (shared, free and paid)

	•	Default 40%, adjustable 10% to 80%

	•	Label it clearly so users understand what it means, something like “Show players owned in fewer than X% of leagues”

Data Sources

	•	Ownership percentage and trending data: check Sleeper’s public API first since it requires no auth and is well documented, use it as the primary data source

	•	Player database (names, positions, teams): can be seeded from the same source or a static dataset updated weekly

	•	No user login or OAuth required, no per-platform integration, this is a deliberate scope decision to keep the build light

Explicitly Out of Scope for MVP

	•	Live league sync with Sleeper, ESPN, or Yahoo accounts

	•	Trade analyzer functionality (separate potential feature, not v1)

	•	Historical season archive or year over year tracking

	•	Push notifications or automated weekly emails

Design Direction

	•	Clean, fast, mobile-friendly since users will check this on their phone right before waivers process (Tuesday/Wednesday nights)

	•	Avoid dense tables, favor card-based recommendations that are scannable in a few seconds

	•	Reuse the visual hierarchy approach from BizCase Builder’s executive summary output where it makes sense (verdict up front, supporting detail below)

Monetization Notes (not part of the build itself, for reference)

	•	Free tier: browse waiver recommendations by position, no roster entry, no gate

	•	Paid tier: the Team Analyzer, roster entry plus automatic weakness detection plus manual override within that analysis

	•	The gating logic centers on the roster import and analysis feature specifically, not on the recommendation data itself, since the recommendation list is the same underlying data either way

	•	Positioned as a low-cost recurring charge during football season (weekly or season pass) rather than a one-time purchase, since the Team Analyzer is something a user would want to re-run weekly as their roster changes

	•	License gating can likely follow the same pattern as BizCase Builder’s client-side Gumroad product ID check, worth reusing that logic if it fits

Technical Notes

	•	Build in Lovable, following the same project setup pattern as prior projects

	•	Keep the ranking algorithm in a clearly separated module so it can be tuned independently of the UI, this logic will likely need iteration once real usage data comes in

	•	Flag clearly in the UI that ownership percentage is a proxy for availability, not a guarantee, since a specific league’s actual waiver wire may differ slightly

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://wiretap.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6a960c94-5d2e-405e-8bd2-d0b37e638784).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
