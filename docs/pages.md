# Pages and routing

*Part of the [MASTERPLAN developer guide](../MASTERPLAN_DEVELOPER_GUIDE.md).*

## Pages & routing

Hash-based routing (`#page-id`). Home = no hash.
Page render is handled in `MainPageContent` in App.jsx — add new pages there.
Nav items come from `PAGES` global — add new pages in config (outside src/).
The list is **flat**: there is no nested or grouped nav, and none should be
added without a real grouped page to build it against.

`App.jsx` reads the page from `location.hash` on load (`getHashPage`, which
falls back to `home` for an unknown id), `setPage` calls `history.pushState`,
and a `popstate` listener restores the page on back/forward. In
`MainPageContent` any `PAGES` id without its own branch renders
`SheetSurfaceLayout` (this is how `pattern-layout` is served), so a new page
needs its own branch. `setPage` ignores the page already shown, so it adds no history entry, and an
effect sets `document.title` from `PAGES`. The routed page sits inside
`PageErrorBoundary` (`components/PageErrorBoundary.jsx`), keyed by page: a render
error shows a message with "Try again" and leaves the nav, header and theme
control working. Hash links need no server support, so deep links work
under the `/MASTERPLAN/` base path on Pages.

Current pages: `home`, `pattern-layout`, `symmetric-layout`, `concrete`, `gypsum`,
`golden-ratio`, `pipe-wrap`, `guider`, `timesheet`.

Sidebar interaction (Nav.jsx): Ctrl/Cmd+B toggles collapse globally (App.jsx);
double-clicking any nav button does the same. Arrow keys rove the list on both
axes — Down/Right step forward, Up/Left step back — over `.nav-btn` elements
found in the DOM. Roving
deliberately stops at both ends rather than wrapping.

Collapsed-nav tooltips mount
into `document.body` via a portal on hover/focus rather than sitting inside
`.nav` — that container is `overflow-y: auto`, and a tooltip parked inside it
either clips or forces the sidebar itself into horizontal scroll. Home stays
out of the ordinary list: HIVE is the expanded Home action, while the collapsed
rail renders its own icon-only Home button. This preserves one current-page mark
in either state and keeps the header toggle independent of navigation.

## Page components

All calculators and pages are stored as standalone files inside `src/components/`:

| Page ID | Component | Location | Description |
|---|---|---|---|
| `home` | `SheetHome` | `components/Home.jsx` | Main landing page menu |
| `pattern-layout` | `SheetSurfaceLayout` | `components/SurfaceLayout.jsx` | Compares straight, shifted, stepped, and long-short layout strategies |
| `symmetric-layout` | `SheetSymmetricLayout` | `components/SymmetricLayout.jsx` | Equal edge pieces with full panels in the center |
| `golden-ratio` | `SheetGoldenRatio` | `components/GoldenRatio.jsx` | Calculates Phi sequences |
| `pipe-wrap` | `PipeWrapCalculator` | `components/PipeWrapCalculator.jsx` | Pipe wrap length calculator with SVG diagram |
| `concrete` | `SheetConcrete` | `components/Concrete.jsx` | Concrete consumption estimator |
| `gypsum` | `SheetGypsum` | `components/Gypsum.jsx` | Plasterboard layout and take-off: sheets, screws, joint filler, tape |
| `guider` | `SheetGuider` | `components/Guider.jsx` | Reference/guide pages (e.g. electrical wiring diagrams) with an entry list panel |
| `timesheet` | `SheetTimesheet` | `components/Timesheet.jsx` | Work hours calculator |

## Gypsum tool

Metric plasterboard estimator, modelled on the inputs of layoutdrywall.org
(room or single wall, ceiling, doors and windows, sheet size, fixing
direction, waste, price) and extended with a layout diagram per surface and
a second layer. All figures, and the diagrams, come from
`utils/gypsum-take-off.js`; the page and `GypsumTakeOffSheet` only render it.

- **Pattern Layouts' shell, not the calculator card.** The page is served in
  `main-data`: inputs in the 384px `.data-control` column, and the result card,
  2D/3D layout and calculation details in `.data-preview`, so
  the diagrams get the full remaining width (it was capped by `.page-inner`'s
  1024px). The preview holds a one-column `.layout-split` whose second child is
  the result card: that keeps the phone's bottom results bar, which is keyed to
  `.layout-split > :nth-child(2)`; on a desktop it is moved first and laid out
  in a row. The 3D stage measures itself and scales the room (and its
  perspective) to the shorter side, so it fills the larger stage too.

- **Rooms and walls: a list, one on screen.** The page holds every room and
  single wall of a job (`Gypsum.jsx:rooms`, which one is open in
  `Gypsum.jsx:room`), so a project carries the whole job rather than the last
  room typed. Each entry owns everything about itself: mode, dimensions,
  openings, ceiling, fixing, layers, the job's product fields, and which
  preset each library has applied (`activePreset` / `activeFiller` /
  `activeAdhesive`). A bathroom on glued moisture board and a bedroom on
  screwed standard board are an ordinary job. The preset *lists* stay shared:
  they are the project's catalogue, so `usePresetLibrary` takes `active` and
  `setActive` from the page instead of storing them itself.
  - The Rooms card: the list (once there are two), the name, `+ Room`,
    `+ Wall`, Duplicate, Delete (two clicks, never the last one). An unnamed
    entry is called "Room 2" or "Wall 1" (`roomLabel`), worked out, not
    stored, so switching an entry's mode renames it. An added entry keeps the
    materials of the one on screen and starts its size and openings empty
    (`roomFrom`): rooms are rarely one size and usually one order. Duplicate
    copies everything.
  - The field cards are keyed by the room, so switching remounts them. Each
    field reads the new room's value, and field undo cannot carry one room's
    typing into another.
  - Reset clears the room on screen only, and says so ("Reset Room") once
    there is a list. Wiping every room behind one button would be the one
    irreversible action on the page.
  - A project saved before the list kept one room under `Gypsum.jsx:mode`,
    `:job` and so on. It opens as a list of one (`legacyRoom`), and the old
    keys are dropped from the drafts so they are not saved again beside it.
  - **All Rooms** (once there are two) is `buildGypsumProjectTakeOff`: each
    room's sheets, then the order across them. Boards are grouped by product,
    size and price, filler and adhesive by product and bag. Sheets add the
    rooms' *exact* counts, waste included, and round up once, so the order
    can be less than the rooms' own counts added (13 + 4 rooms, 16 to buy).
    Offcuts are not shared between rooms. An unfinished room is listed and
    left out of the total, with a line saying so. Its Take-off prints the
    project sheet: rooms table and order first, then each finished room's own
    sheet on a page of its own (`GypsumProjectSheet`, `.gyp-print-room`).
    Both sheets carry the open project's name.
- **The layout is the count.** Each surface is cut into lanes of board width
  (vertical fixing: columns up the wall; horizontal: rows along it), each lane
  into pieces, and the pieces are packed first-fit-decreasing back into stock
  sheets, per lane width — a ripped strip's sheet cannot also supply a full
  width piece, but two 600 strips come from one 1200 sheet. Waste % goes on
  top for breakage, not cutting, so it defaults to **5**, not the reference
  site's 10 (that 10 stood in for cutting it did not model).
- **End joints** only exist where a lane is longer than a sheet. Alternate
  lanes start half a sheet apart; a remainder under `MIN_END_PIECE` (300 mm)
  moves the lane's joint instead of leaving a sliver.
- **Openings** are a list (`+ Door` / `+ Window`): wall A–D, `x` from the
  wall's left end *as seen from inside*, width, height, and a sill for a
  window. Room walls are A back, then clockwise seen from above (B right, C
  front, D left), the order the 3D view folds them in. Labels (D1, W1…) are
  the model's (`readOpenings`). Every opening comes off the *area* (screws).
  Position is optional: an unplaced one only does that. A placed
  one is drawn in 2D, 3D and print, and drops any piece lying **wholly**
  inside it from the drawing and the sheet count; a piece it only crosses is
  hung whole and cut out. One that runs off its wall is left out and named in
  the warning.
- **First panel offset (mm)** keeps the first full board off the corner, so
  its edge lands on a stud: with studs at 600 centres, 600 puts it on the
  first stud after the corner stud. Fixed vertically, each wall starts with a
  strip that wide at its left corner (as seen from inside). Fixed
  horizontally, every row's first piece is that long, and alternate rows
  still start half a board further on, counted from it (600, then 1900 with
  2600 boards), so end joints stay staggered; the 300 mm sliver rule still
  applies. Walls only (a ceiling's joists are another grid). An offset as
  long as the board side it cuts — the width vertically, the length
  horizontally — is left out with a warning. Strips and short pieces pack
  into boards like any other cut piece (`layoutSurface({ firstLane })`,
  `lanePieces(span, sheetL, lane, start)`).
- Walls are grouped (drawn once, labelled `Walls A, C`) only while identical:
  same size and the same openings in the same places.
- **Screwed or glued.** Glued ("dot and dab") sticks the boards straight onto
  masonry: walls only, one layer. Walls then take adhesive on their net area
  (`takeOff.adhesive`: kg and bags) and no screws; a boarded ceiling is still
  screwed, so `screws` counts the ceiling only (`screws.area`). The page hides
  the layer choice rather than offer one the model ignores. Joint filler and
  tape do not change. Rates: Knauf Perlfix approx. 5 kg/m², 25 kg bag (Knauf
  data sheet); Gyproc DriWall one 25 kg bag per two 1200×2400 boards (British
  Gypsum) ≈ 4.3 kg/m². Both rise on an uneven wall.
- **A filler given per 1 mm.** Knauf states Fill & Finish Light, Super Finish
  and the like as kg/m² per mm of skim, with no per-metre figure. The filler
  library carries that as `skimRate`; with `compoundRate` blank, the rate per
  metre of joint is worked out as `skimRate × JOINT_FILL_MM_M` (0.34 mm·m:
  a joint filled and finished is worth 1 mm over a 340 mm strip). The 0.34 is
  Knauf's own figure for Fill & Finish Light on the joints of 1250 mm board,
  0.2 + 0.1 kg/m² over about 0.8 m of joint per m² = 0.375 kg/m, divided by
  its 1.1 kg/m² per mm. The page says the worked-out rate under the field.
  A stated per-metre rate always wins (`jointFillerRate`).
- **Surface skim (mm)** is a job field: a full-surface skim (Knauf's Q4, at
  least 1 mm) over the face layer's net area at `skimRate`. It adds to the
  joint filler, in the same bags. Knauf's quality levels stop at Q4.
- **Joint filler is per metre of joint**, as Knauf states Uniflott (0.25 kg/m),
  not per m² of board: `compound.length` is every board joint on every layer
  (the layer underneath is filled, not taped) plus the corners, and `kg` is
  that times the rate. Openings change it only through the joints of the
  pieces they remove.
- **Two layers** double sheets and screws, and the board joints filled. Tape is face layer only.
  Tape = board joints from the layout, plus four internal corners and, with a
  ceiling, the ceiling angle.
- The diagram is `LayoutVisualization`; the model emits rows in the
  `simulation.js` shape with `meta.exactRows`, which draws each lane at its
  real width so a ripped last lane is narrow.
- **3D view** (`components/GypsumRoom3D.jsx`, the 2D/3D switch in the Layout
  header). CSS 3D transforms, no library: each boarded surface is a flat
  panel folded around the room's centre, drawing the model's `layout.pieces`
  in the 2D diagram's classes. Every wall panel faces *into* the room and
  `backface-visibility: hidden` culls the ones facing away, so the near walls
  drop out with no code deciding which. `roomFaces()` is the pure placement
  function the tests read; the model supplies `room` (L, W, H, ceiling).
  - The ceiling is drawn **lifted** (exploded, 0.55 × H) and double-sided,
    seen from above like a reflected ceiling plan. A camera below the floor
    looking up was tried at several angles and always read as a box seen from
    outside — do not bring a "Below" view back.
  - Drag turns it (horizontal on touch: `touch-action: pan-y` keeps vertical
    swipes scrolling the page); arrow keys turn it; Above / Level / Reset ease
    there, a drag does not. End walls and ceiling are shaded with
    `filter: brightness`, not a colour, so depth reads in every theme.
  - Each wall panel carries its letter (bottom centre: the corners are
    overlapped by the neighbouring wall, the top by the lid) and draws its own
    openings, so a door on C is on C only.
- **Printed take-off** = surfaces table, order, then one ink drawing per
  surface (`GypsumTakeOffSheet`). It draws `layout.pieces` — rectangles the
  model places in surface mm — and labels each with the model's `len`, so the
  sheet places nothing itself. All drawings share the widest surface's scale,
  so a short wall prints short. A drawing never splits: one that does not fit
  moves to the next page whole. Colours live in `99-print.css`.
- **Three preset libraries**, because a board, a joint filler and an
  adhesive are bought separately and mixed freely (a Gyproc board with Knauf
  filler is an ordinary job), and one table carrying all three got too wide
  to manage. Each has its own card, list and Manage dialog:

  | Library | Constant / save key | Fields | Defaults |
  |---|---|---|---|
  | Board | `DEFAULT_GYPSUM_PRESETS` / `gypsumPresets` | sheet W, L, screws/m², € per sheet | Knauf GKB 12.5 (20/m²), Gyproc GN 13 (13/m²) |
  | Joint filler | `DEFAULT_GYPSUM_FILLER_PRESETS` / `gypsumFillerPresets` | kg per m of joint, bag kg | Knauf Uniflott 0.25 kg/m |
  | Adhesive | `DEFAULT_GYPSUM_ADHESIVE_PRESETS` / `gypsumAdhesivePresets` | kg/m², bag kg | Knauf Perlfix 5, Gyproc DriWall 4.3 |

  Gyproc has no filler entry: it publishes its filler per m² of board, not
  per metre of joint, and a converted figure would be a guess. "Joint filler"
  is the taping filler, not adhesive; the data keeps the older name
  `compoundRate` / `compound`, since saved projects carry it. Sources are in
  `config.js`.

  The libraries are data (`LIBRARIES` in `components/GypsumPresets.jsx`), and
  one hook and three components serve all of them: `usePresetLibrary`
  (presets, the applied one, apply/save), `PresetField` (a field with the
  shared `MaterialPresetDropdown`, which takes a `describe` for presets that
  are not sizes), `ManagePresetsButton` (local mode only, as on Pattern
  Layouts) and `PresetManager` (the table, in a `Modal`). A card header names
  the applied preset through the shared `SelectedPresetDetail`, which takes a
  `detail` string for the same reason. The server keeps each library to its
  own fields (`gypsumLibraryValidator`), so a board preset saved before the
  split drops the filler and adhesive figures it used to carry.

## Golden Ratio tool

PHI = 1.6180339887499. Builds 7 descending steps: `base / PHI^n`.
Cards use tone system (a/b/c/d) for visual identity.
`useLinkedCardHighlight` hook links control cards to preview cards on click.

## Guider tool

Reference/guide page. The left column holds one `ControlPanel` per category,
built from the `CATEGORIES` array in `SheetGuider` (each with its own `panelId`
and open state); the right column shows the selected entry. Add an entry to a
category's `entries` and route its id in the preview branch. An entry with no
branch shows a placeholder card.

- **Electrism** (`control-guider-list`): `Lihtlüliti`, `Veksellüliti` — inline
  SVG schematics inside `components/Guider.jsx`: square dashed switch boxes
  with open-circle contacts and a floating lever, consistent stroke widths
  (`r=4.5`, `strokeWidth=2`), and a legend/Ühendused list below each diagram.
- **Ruukki** (`control-guider-ruukki`): `Vihmaveesüsteemid` opens
  Toru põlv 70° (`components/guider/ToruPolv70.jsx`), a two-way calculator
  for a pipe offset made of two 70° elbows: `B = L·sin α + C`. B is measured
  from the **wall**, as the manufacturer's chart measures it, so the lower
  pipe's ~30 mm stand-off is inside C and is not added on top. C = 152 mm was
  fitted to that chart (±5 mm); outside L 100–1150 the answer carries an
  extrapolation warning. The maths is in `utils/downpipe-offset.js`.
  - **Entry.** B is first and is the entered field by default (it is what gets
    measured on site); whichever of B or L was typed last stays fixed and the
    other follows as you type (`NumInput live`), shown in `--accent`. α and C
    are folded into a summary cell and open from **Muuda**, because they are
    rarely changed. An empty page shows no prompt — only real errors and the
    extrapolation warning are drawn.
  - **Layout** is a datasheet: the B / L / parameters strip, the schematic and
    the graph side by side at one height, and a footer with the formula and the
    chart's limits. Breakpoints are container queries on `.guider-sheet`,
    because the preview's width depends on the sidebar and the control column,
    not the viewport.
  - **Schematic** is the manufacturer's drawing, deliberately not scaled to the
    input; its B and L labels carry the current values, and the wall line
    stands clear of the pipe.
  - **Graph** of L against B (B 200–1250, L 50–1150, 100 mm grid) draws the
    line for the current α and C and marks the result; pressing or dragging
    sets the value through the entered field. It is drawn at its measured pixel
    width (ResizeObserver), not a scaled viewBox, so tick labels stay legible on
    a phone.
