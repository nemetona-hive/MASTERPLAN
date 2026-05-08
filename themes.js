/**
 * THEME DEFINITIONS
 * ─────────────────────────────────────────────────────────────
 * Define all themes here. Each theme is a map of CSS variable names
 * to color values. These are applied dynamically via document.documentElement.
 * 
 * To add a new theme:
 * 1. Add a new object below with a unique key
 * 2. Include all color variables you want to override
 * 3. The theme will automatically be available in the toggle button
 */

const THEMES = {
  naviPro: {
    name: 'naviPro',
    label: 'Navi Pro',
    icon: '◇',
    colors: {
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
  },
  graphite: {
    name: 'graphite',
    label: 'Graphite',
    icon: '⟐',
    colors: {
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
    }
  },
  verdant: {
    name: 'verdant',
    label: 'Verdant',
    icon: '⎈',
    colors: {
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
  }
};

/**
 * Get ordered list of theme names
 */
const getThemeOrder = () => Object.keys(THEMES);

/**
 * Get the next theme in the sequence
 */
const getNextTheme = (currentTheme) => {
  const order = getThemeOrder();
  const currentIndex = order.indexOf(currentTheme);
  const nextIndex = (currentIndex + 1) % order.length;
  return order[nextIndex];
};

/**
 * Apply theme by name
 */
const applyTheme = (themeName) => {
  const theme = THEMES[themeName];
  if (!theme) {
    console.warn(`Theme "${themeName}" not found. Available themes:`, getThemeOrder());
    return;
  }
  
  // Apply colors to CSS custom properties
  Object.entries(theme.colors).forEach(([key, value]) => {
    document.documentElement.style.setProperty(key, value);
  });
  
  // Store current theme for reference
  document.documentElement.setAttribute('data-theme', themeName);
};
