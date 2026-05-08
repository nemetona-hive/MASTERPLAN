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
      '--text': '#d7dde2',
      '--text-muted': '#92a1ad',
      '--brand': '#d0bd86',
      '--accent': '#4fa3c7',
      '--accent-2': '#79b88f',
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
      '--text': '#e1e3e6',
      '--text-muted': '#a0a7af',
      '--brand': '#d2bd83',
      '--accent': '#56a7c2',
      '--accent-2': '#84b782',
    }
  },
  verdant: {
    name: 'verdant',
    label: 'Verdant',
    icon: '⎈',
    colors: {
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
