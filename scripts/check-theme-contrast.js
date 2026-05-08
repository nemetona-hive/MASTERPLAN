"use strict";

const THEMES = {
  naviPro: {
    '--bg': '#0b1117',
    '--surface-1': '#111a22',
    '--surface-2': '#17232d',
    '--surface-hover': '#1d2b36',
    '--border': '#263846',
    '--border-strong': '#365064',
    '--text': '#d7dde2',
    '--text-muted': '#92a1ad',
    '--text-subtle': '#7a8f9e',
    '--brand': '#d0bd86',
    '--accent': '#4fa3c7',
    '--accent-2': '#79b88f',
    '--success': '#72bf83',
    '--warning': '#d9a441',
    '--danger': '#ef6b73',
    '--sys-s0': '#d0bd86',
    '--sys-s1': '#4fa3c7',
    '--sys-s2': '#8da0ad',
    '--sys-s3': '#79b88f',
    '--sys-s4': '#b48ed8',
    '--viz-cut': '#9aa8b3',
    '--viz-offcut': '#6e7f8c',
    '--viz-edge': '#d0bd86',
  },
  graphite: {
    '--bg': '#18191b',
    '--surface-1': '#222427',
    '--surface-2': '#2b2e32',
    '--surface-hover': '#34383d',
    '--border': '#41464d',
    '--border-strong': '#5a626b',
    '--text': '#e1e3e6',
    '--text-muted': '#a0a7af',
    '--text-subtle': '#7a8289',
    '--brand': '#d4c07a',
    '--accent': '#7e9fa8',
    '--accent-2': '#84b782',
    '--success': '#73b381',
    '--warning': '#d4a84e',
    '--danger': '#eb737b',
    '--sys-s0': '#d4c07a',
    '--sys-s1': '#7e9fa8',
    '--sys-s2': '#919ba3',
    '--sys-s3': '#84b782',
    '--sys-s4': '#b592d6',
    '--viz-cut': '#a1abb2',
    '--viz-offcut': '#748089',
    '--viz-edge': '#d4c07a',
  },
  verdant: {
    '--bg': '#f0f4f2',
    '--surface-1': '#ffffff',
    '--surface-2': '#e6ebe9',
    '--surface-hover': '#dde4e1',
    '--border': '#ccd4d1',
    '--border-strong': '#a3b2ac',
    '--text': '#1a2622',
    '--text-muted': '#54635e',
    '--text-subtle': '#7d8c87',
    '--brand': '#9e813a',
    '--accent': '#1c7b69',
    '--accent-2': '#327396',
    '--success': '#2e8c4a',
    '--warning': '#b8860b',
    '--danger': '#d13b46',
    '--sys-s0': '#9e813a',
    '--sys-s1': '#1c7b69',
    '--sys-s2': '#546b7a',
    '--sys-s3': '#30804a',
    '--sys-s4': '#7950a3',
    '--viz-cut': '#5e707a',
    '--viz-offcut': '#87969e',
    '--viz-edge': '#9e813a',
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
