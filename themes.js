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
    /* Synced to MONEYFLOW's verdant ("Sage & Ink") — the two had drifted to
       different palettes under the same name. --sys-s0/--sys-s1 are kept in
       step with the new --brand/--accent, matching the pattern graphite
       already follows; --sys-s2..s4 and --viz-* have no MONEYFLOW
       counterpart to sync to and are unchanged. */
    colors: {
      '--bg':            '#e4e8e2',
      '--surface-1':     '#f4f6f2',
      '--surface-2':     '#ebeee8',
      '--surface-hover': '#dce2d9',
      '--border':        '#c4cdc1',
      '--border-strong': '#95a396',
      '--text':          '#191d1b',
      '--text-muted':    '#464e49',
      '--text-subtle':   '#69716c',
      '--brand':         '#775e22',
      '--accent':        '#2b7a6b',
      '--accent-2':      '#4a6b52',
      '--success':       '#2c7a45',
      '--warning':       '#8f6a10',
      '--danger':        '#b0303f',
      // Control tiers -- see the button system in the developer guide.
      '--btn-active-bg':  '#293241',
      '--btn-active-fg':  '#f4f6f2',
      '--edge-hi':        'rgba(255, 255, 255, 0.95)',
      '--shadow-rgb':     '24 38 34',
      '--sys-s0':        '#775e22',
      '--sys-s1':        '#2b7a6b',
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
