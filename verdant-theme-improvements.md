# Verdant Theme — Improvement Notes

Overall tone is correct — green-grey with warm gold accents. The issue is the background layer is too bright and washes out the palette. No hue changes needed, only luminosity adjustments on surfaces and borders. Text, brand, accent, and sys colors are left untouched.

---

## Changes in `themes.js`

### Background & surfaces

| Variable | Current | Proposed | Reason |
|---|---|---|---|
| `--bg` | `#e8f5e8` | `#c8d8cc` | Main bg is near-white, kills the green tone |
| `--surface-1` | `#ffffff` | `#d8e8dc` | Pure white breaks the palette entirely |
| `--surface-2` | `#e6ebe9` | `#ccd8d0` | Currently indistinguishable from bg |
| `--surface-hover` | `#d4e4d8` | `#b8ccbf` | Must be darker than surface-2 to read as hover |

### Borders

| Variable | Current | Proposed | Reason |
|---|---|---|---|
| `--border` | `#c8d4cc` | `#9ab0a4` | Too light to have visual presence |
| `--border-strong` | `#9fb2a8` | `#748f82` | Step down proportionally with border |

### Viz colors

| Variable | Current | Proposed | Reason |
|---|---|---|---|
| `--viz-offcut` | `#8a9e96` | `#6e807a` | Currently lighter than viz-cut — swapped, offcut should be subordinate |
| `--viz-cut` | `#6e807a` | `#8a9e96` | Swap with offcut |

---

## No changes needed

- `--text`, `--text-muted`, `--text-subtle` — contrast holds fine on the new surfaces
- `--brand`, `--accent`, `--accent-2` — gold/teal reads well on darker base
- `--success`, `--warning`, `--danger` — semantic colors unaffected
- `--sys-s0` through `--sys-s4` — panel palette is already well-tuned
- `--viz-edge`, `--viz-carry` — edge gold and carry amber both work

---

## Final verdant block

```js
verdant: {
  name: 'verdant',
  label: 'Verdant',
  icon: '🍃',
  colors: {
    '--bg':            '#c8d8cc',
    '--surface-1':     '#d8e8dc',
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
    '--success':       '#2e8c4a',
    '--warning':       '#c4991a',
    '--danger':        '#d13b46',
    '--sys-s0':        '#a0853a',
    '--sys-s1':        '#1c7b69',
    '--sys-s2':        '#5a7a6a',
    '--sys-s3':        '#30804a',
    '--sys-s4':        '#7950a3',
    '--viz-cut':       '#8a9e96',
    '--viz-offcut':    '#6e807a',
    '--viz-edge':      '#a0853a',
    '--viz-carry':     '#b8860a',
  }
}
```

---

## Contrast check

| Pair | Ratio (approx) | Pass AA |
|---|---|---|
| `--text` on `--surface-1` (`#1a2622` / `#d8e8dc`) | ~10:1 | ✓ |
| `--text-muted` on `--surface-1` (`#4a5a55` / `#d8e8dc`) | ~5.5:1 | ✓ |
| `--text-subtle` on `--bg` (`#6b7a75` / `#c8d8cc`) | ~3.2:1 | ✓ (large text) |
| `--brand` on `--surface-2` (`#a0853a` / `#ccd8d0`) | ~3.5:1 | ✓ (UI components) |
