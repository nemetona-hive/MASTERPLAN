"use strict";

const THEMES = {
  naviPro: {
    '--bg': '#0b1117',
    '--surface-1': '#111a22',
    '--surface-2': '#17232d',
    '--surface-hover': '#1d2b36',
    '--border': '#263846',
    '--text': '#d7dde2',
    '--text-muted': '#92a1ad',
    '--brand': '#d0bd86',
    '--accent': '#4fa3c7',
    '--accent-2': '#79b88f',
    '--success': '#72bf83',
    '--danger': '#ef6b73'
  },
  graphite: {
    '--bg': '#18191b',
    '--surface-1': '#222427',
    '--surface-2': '#2b2e32',
    '--surface-hover': '#34383d',
    '--border': '#41464d',
    '--text': '#e1e3e6',
    '--text-muted': '#a0a7af',
    '--brand': '#d2bd83',
    '--accent': '#56a7c2',
    '--accent-2': '#84b782',
    '--success': '#72bf83',
    '--danger': '#ef6b73'
  },
  verdant: {
    '--bg': '#07110f',
    '--surface-1': '#0e1c19',
    '--surface-2': '#142822',
    '--surface-hover': '#1a332b',
    '--border': '#28483e',
    '--text': '#d8e3de',
    '--text-muted': '#94a9a1',
    '--brand': '#d4bd80',
    '--accent': '#55b6a4',
    '--accent-2': '#7ca9d8',
    '--success': '#72bf83',
    '--danger': '#ef6b73'
  }
};

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function luminance(r, g, b) {
  const a = [r, g, b].map(v => {
    v /= 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function contrastRatio(hex1, hex2) {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  const lum1 = luminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = luminance(rgb2.r, rgb2.g, rgb2.b);
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  return (brightest + 0.05) / (darkest + 0.05);
}

const pairsToTest = [
  { fg: '--text', bg: '--bg', target: 7 },
  { fg: '--text', bg: '--surface-1', target: 4.5 },
  { fg: '--text-muted', bg: '--surface-1', target: 4.5 },
  { fg: '--brand', bg: '--bg', target: 3 },
  { fg: '--accent', bg: '--bg', target: 3 },
  { fg: '--danger', bg: '--surface-1', target: 3 },
  { fg: '--success', bg: '--surface-1', target: 3 }
];

for (const [themeName, colors] of Object.entries(THEMES)) {
  console.log(`\n=== Theme: ${themeName} ===`);
  for (const { fg, bg, target } of pairsToTest) {
    const fgColor = colors[fg];
    const bgColor = colors[bg];
    if (!fgColor || !bgColor) continue;
    
    const ratio = contrastRatio(fgColor, bgColor);
    const pass = ratio >= target;
    const marker = pass ? "✅" : "❌";
    console.log(`${marker} ${fg} on ${bg}: ${ratio.toFixed(2)}:1 (Target: ${target}:1)`);
  }
}
