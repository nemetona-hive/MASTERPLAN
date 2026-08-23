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
  graphite: {
    name: 'graphite',
    label: 'Graphite',
    icon: '⚫',
    colors: {
      '--bg': '#161718',
      '--surface-1': '#1e2023',
      '--surface-2': '#272a2e',
      '--surface-hover': '#32363b',
      '--border': '#3f444b',
      '--border-strong': '#586069',
      '--text': '#e1e3e6',
      '--text-muted': '#a0a7af',
      '--text-subtle': '#758086',
      '--brand': '#d4c07a',
      '--accent': '#7e9fa8',
      '--accent-2': '#7a8a92',
      '--success': '#73b381',
      '--warning': '#c4a04a',
      '--danger': '#eb737b',
      // Control tiers -- see the button system in the developer guide.
      '--btn-active-bg':  '#b3a684',
      '--btn-active-fg':  '#161718',
      '--edge-hi':        'rgba(255, 255, 255, 0.07)',
      '--shadow-rgb':     '0 0 0',
      '--sys-s0': '#d4c07a',
      '--sys-s1': '#7e9fa8',
      '--sys-s2': '#8d969e',
      '--sys-s3': '#84b782',
      '--sys-s4': '#b592d6',
      '--viz-cut': '#9ba4ab',
      '--viz-offcut': '#6f7a82',
      '--viz-edge': '#d4c07a',
      '--viz-carry': '#c49830',
    }
  },
  verdant: {
    name: 'verdant',
    label: 'Verdant',
    icon: '🍃',
    colors: {
      '--bg':            '#e8f5e8',
      '--surface-1':     '#f2f8f4',
      '--surface-2':     '#ccd8d0',
      '--surface-hover': '#b8ccbf',
      '--border':        '#9ab0a4',
      '--border-strong': '#748f82',
      '--text':          '#1a2622',
      '--text-muted':    '#4a5a55',
      '--text-subtle':   '#6b7a75',
      '--brand':         '#a0853a',
      '--accent':        '#1c7b69',
      '--accent-2':      '#2e7d6b',
      '--success':       '#2a7f43',
      '--warning':       '#896b12',
      '--danger':        '#cf3440',
      // Control tiers -- see the button system in the developer guide.
      '--btn-active-bg':  '#26332c',
      '--btn-active-fg':  '#f4f6f2',
      '--edge-hi':        'rgba(255, 255, 255, 0.95)',
      '--shadow-rgb':     '0 0 0',
      '--sys-s0':        '#a0853a',
      '--sys-s1':        '#1c7b69',
      '--sys-s2':        '#5a7a6a',
      '--sys-s3':        '#30804a',
      '--sys-s4':        '#7950a3',
      '--viz-cut':       '#5a7d6a',
      '--viz-offcut':    '#d1ded7',
      '--viz-edge':      '#b69d5a',
      '--viz-carry':     '#d4a25c',
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
