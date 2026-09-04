/**
 * NFL team brand colors keyed by Sleeper team abbreviation.
 * Used to tint player cards with a per-team highlight glow.
 */

export const TEAM_COLORS: Record<string, string> = {
  ARI: "#97233F",
  ATL: "#A71930",
  BAL: "#241773",
  BUF: "#00338D",
  CAR: "#0085CA",
  CHI: "#0B162A",
  CIN: "#FB4F14",
  CLE: "#311D00",
  DAL: "#003594",
  DEN: "#FB4F14",
  DET: "#0076B6",
  GB: "#203731",
  HOU: "#03202F",
  IND: "#002C5F",
  JAX: "#101820",
  KC: "#E31837",
  LV: "#000000",
  LAC: "#0080C6",
  LAR: "#003594",
  MIA: "#008E97",
  MIN: "#4F2683",
  NE: "#002244",
  NO: "#D3BC8D",
  NYG: "#0B2265",
  NYJ: "#125740",
  PHI: "#004C54",
  PIT: "#FFB612",
  SF: "#AA0000",
  SEA: "#002244",
  TB: "#D50A0A",
  TEN: "#0C2340",
  WAS: "#5A1414",
};

/**
 * Returns a usable brand color for known teams, or a clear on-theme
 * fallback (the app's `action` accent green) for free agents and unknown
 * abbreviations — so the glow stays visible instead of dropping to mud.
 */
export const FALLBACK_TEAM_COLOR = "#00d2a1"; // matches --action (oklch(0.723 0.192 149.58))

export function teamColor(team: string | null | undefined): string {
  if (!team) return FALLBACK_TEAM_COLOR;
  return TEAM_COLORS[team] ?? FALLBACK_TEAM_COLOR;
}

function hexToRgb(hex: string) {
  const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!m) return { r: 0, g: 210, b: 161 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    switch (max) {
      case r:
        h = ((g - b) / d) % 6;
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, s, l] as const;
}

function hslToRgb(h: number, s: number, l: number) {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0,
    g = 0,
    b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ] as const;
}

/**
 * Glow color for a player's team. Floors the lightness so dark brands
 * (Raiders black, Patriots navy, Browns brown) still emit a visible glow,
 * and holds saturation so the team identity reads in the hue.
 * `alpha` is 0-255.
 */
export function teamGlowColor(
  team: string | null | undefined,
  alpha = 180,
): string {
  const { r, g, b } = hexToRgb(teamColor(team));
  const [h, s, l] = rgbToHsl(r, g, b);
  const boostedL = Math.max(l, 0.58);
  const boostedS = Math.max(s, 0.45);
  const [R, G, B] = hslToRgb(h, boostedS, boostedL);
  return `rgba(${R}, ${G}, ${B}, ${alpha / 255})`;
}
