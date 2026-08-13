/**
 * Contrast audit for the semantic token layer (dev-only).
 * Checks each foreground token against the surface it is used on, in both
 * themes, at the WCAG 2.1 AA thresholds.
 */
const hex = (h) => {
  const v = h.replace('#', '');
  const n = v.length === 3 ? v.split('').map((c) => c + c).join('') : v;
  return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
};

const luminance = (rgb) => {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const ratio = (a, b) => {
  const [l1, l2] = [luminance(hex(a)), luminance(hex(b))].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
};

const THEMES = {
  dark: {
    canvas: '#0b0f14',
    surface: '#121821',
    surfaceSunken: '#070a0e',
    text: '#e6edf3',
    textMuted: '#8b9aab',
    textSubtle: '#62717f',
    accentText: '#34d399',
    accent: '#10b981',
    accentOn: '#04231a',
    danger: '#fb7185',
    success: '#34d399',
    border: '#27333f',
  },
  light: {
    canvas: '#f1f4f8',
    surface: '#ffffff',
    surfaceSunken: '#f7f9fb',
    text: '#0f1720',
    textMuted: '#55636f',
    textSubtle: '#7d8b98',
    accentText: '#047857',
    accent: '#047857',
    accentOn: '#ffffff',
    danger: '#e11d48',
    success: '#047857',
    border: '#d6dee7',
  },
};

// [foreground, background, minimum, description]
const CHECKS = (t) => [
  [t.text, t.surface, 4.5, 'body text on surface'],
  [t.text, t.canvas, 4.5, 'body text on canvas'],
  [t.textMuted, t.surface, 4.5, 'muted text on surface'],
  [t.textMuted, t.canvas, 4.5, 'muted text on canvas'],
  [t.textSubtle, t.surface, 3.0, 'subtle text on surface (non-essential)'],
  [t.accentText, t.surface, 4.5, 'accent text on surface'],
  [t.accentOn, t.accent, 4.5, 'button label on accent fill'],
  [t.danger, t.surface, 4.5, 'error text on surface'],
  [t.success, t.surface, 4.5, 'success text on surface'],
  [t.border, t.surface, 1.3, 'border against surface (visible edge)'],
];

let failures = 0;
for (const [name, tokens] of Object.entries(THEMES)) {
  console.log(`\n${name.toUpperCase()}`);
  for (const [fg, bg, min, label] of CHECKS(tokens)) {
    const r = ratio(fg, bg);
    const ok = r >= min;
    if (!ok) failures += 1;
    console.log(
      `  ${ok ? 'pass' : 'FAIL'}  ${r.toFixed(2).padStart(6)} (min ${min})  ${label}`,
    );
  }
}

console.log(failures === 0 ? '\nAll contrast checks pass.' : `\n${failures} failing.`);
process.exit(failures === 0 ? 0 : 1);
