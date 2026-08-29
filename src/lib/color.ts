// HSL <-> HEX conversion utilities.
// HSL strings stored in DB use the format "H S% L%" (e.g. "199 89% 32%") to match
// Tailwind / CSS variable conventions.

export function hexToHsl(hex: string): string {
  const cleaned = hex.replace("#", "").trim();
  if (!/^([0-9a-fA-F]{6})$/.test(cleaned)) return "0 0% 0%";
  const r = parseInt(cleaned.slice(0, 2), 16) / 255;
  const g = parseInt(cleaned.slice(2, 4), 16) / 255;
  const b = parseInt(cleaned.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function hslToHex(hsl: string): string {
  const match = hsl.trim().match(/^(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%$/);
  if (!match) return "#000000";
  const h = parseFloat(match[1]) / 360;
  const s = parseFloat(match[2]) / 100;
  const l = parseFloat(match[3]) / 100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  let r: number, g: number, b: number;
  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  const toHex = (x: number) =>
    Math.round(x * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const isValidHsl = (hsl: string | null | undefined) =>
  typeof hsl === "string" && /^\d+(?:\.\d+)?\s+\d+(?:\.\d+)?%\s+\d+(?:\.\d+)?%$/.test(hsl.trim());

const relativeLuminance = (hex: string): number => {
  const cleaned = hex.replace("#", "").trim();
  if (!/^([0-9a-fA-F]{6})$/.test(cleaned)) return 0;
  const channels = [0, 2, 4].map((i) => {
    const v = parseInt(cleaned.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const light = Math.max(a, b);
  const dark = Math.min(a, b);
  return Math.round(((light + 0.05) / (dark + 0.05)) * 100) / 100;
}

export type ContrastVerdict = { ratio: number; passes: boolean; label: string };

/** Judged against AA for normal body text (4.5:1). */
export function judgeContrast(
  foregroundHsl: string | null | undefined,
  backgroundHex = "#FFFFFF",
): ContrastVerdict {
  if (!isValidHsl(foregroundHsl)) return { ratio: 0, passes: false, label: "invalid colour" };
  const ratio = contrastRatio(hslToHex(foregroundHsl), backgroundHex);
  const passes = ratio >= 4.5;
  return {
    ratio,
    passes,
    label: passes ? `${ratio}:1 · passes AA` : `${ratio}:1 · below AA (4.5:1)`,
  };
}
