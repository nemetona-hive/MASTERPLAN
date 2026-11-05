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

## Pattern Layouts tool

The default route (`pattern-layout`, served by the fallback): four row layouts
compared over one surface and one material, from `simulation.js` through
`Controls.jsx`'s `LAYOUT_REGISTRY`. App holds the page's values (`sh`) and the
four panels' open state (`layoutPanelsOpen`).

- **Presets are the shared preset system** (`components/PresetLibrary.jsx`),
  as `MATERIAL_LIBRARY` and `SURFACE_LIBRARY` in `SurfaceLayout.jsx`. The two
  cards (`MaterialCard`, `SurfaceCard`) are one `DimensionCard` over a library
  each. It used to be two hand-written cards, a hand-written Material dialog
  beside a `DimensionPresetManager` for Inputs, and plain component state:
  - the lists and applied presets were lost on leaving the page and never
    reached a project; they are drafts now (`SurfaceLayout.jsx:materialPresets`,
    `:surfacePresets`, `:activeMaterial`, `:activeSurface`);
  - a refused preset's message rendered outside the control column, as an
    extra column in the page's flex row, and hid behind the dialog it came
    from; it now shows under its own card, and in the dialog;
  - the dropdown was given the applied preset's place in the full list but
    shown only the named ones, so an unnamed preset before it moved the
    highlight to the wrong row.
- The save keys (`materialPresets`, `surfacePresets`) and the table's id
  prefixes (`mat-preset-*`, `surface-preset-*`) are the ones the page always
  used; the Material table's width and length ids are now `mat-preset-width-N`
  and `mat-preset-length-N`, like the Inputs table's.
- An applied preset stays named while the fields still hold its sizes
  (`dimensionsMatch`), and an apply is an undo step.

## Axial Alignment tool

`symmetric-layout`: full panels on an axis, edge pieces resolved
(`computeS0` in `simulation.js`). App holds the page's values (`sym`).

- **Two preset lists, on the shared preset system** (`AXIAL_PRODUCT_LIBRARY`,
  `AXIAL_AREA_LIBRARY` in `SymmetricLayout.jsx`): products for the panel
  width, inputs for the area width. Only a preset's width is used.
- **Kept apart from Pattern Layouts' lists, by the user's choice (2026-11-04).**
  Both start from the same `config.js` defaults, but an edit made on Pattern
  Layouts stays there, so each page stands on its own. With no Manage dialog
  here, a list is read from its defaults and not kept (`draftKey: null`);
  which preset is applied is kept, with the page's values.
- An applied preset stays named, above the Inputs card, while its field holds
  its width. The page used to clear the product preset on every commit, so a
  blur that re-committed the same value dropped it, and never cleared the area
  preset at all. A preset without a usable width is refused with a message.

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
  - **Every room is laid out on every render, but only once per change.**
    Each room's take-off is remembered against the room object and the three
    preset lists (a `WeakMap` in `SheetGypsum`). An edit replaces only its own
    room's object, so typing in one room does not lay the others out again;
    editing a preset list lays them all out, since product names come from it.
    Keep room updates immutable, or the cache serves a stale take-off.
- **Each surface's head counts its boards**: `3 full · 1 cut · 4 boards
  each`. Boards is what one such wall takes on its own, every layer
  (`layout.boards`: its pieces packed with only its own offcuts). The room's
  sheets pack every surface together, so they can be fewer than the heads
  added up (four walls at 4 + 3 each are 14 alone, 12 together). The printed
  Surfaces table has the same figure as a Boards column, times the surface's
  count, and its note says why the column can add up to more than the order.
- **Rows can be left out.** A row label (R1, R2…) in a surface's 2D drawing
  is a switch (`LayoutVisualization`'s optional `onRowToggle`): click or
  Enter leaves that lane out of the job — already boarded, or someone
  else's — and again puts it back. Kept per room by surface id and lane
  (`excluded: { "wall-ac": [3] }`); a surface whose id changes (a wall split
  from its twin by an opening) starts with none left out. A left-out lane
  stays in `rows`/`pieces` marked `excluded`, drawn dashed and unfilled (2D,
  print) or not at all (3D), and every count drops it: sheets, its own
  boards, full/cut, end joints. Its long-edge joint stays where it meets a
  lane still in. Its area less any opening in it (`excludedArea`) comes off
  net, so screws, adhesive and skim follow; Calculation Details and the
  printed facts show it as *Rows left out*.
- **Selecting a board names it.** Clicking a piece in a surface's 2D
  drawing names it in that surface's head, after the surface name: lane,
  full or cut, and its size across × up the surface (`R4 · cut · 400 × 2600
  mm`). The counts stay at the head's right end. Clicking the board again, or
  the empty drawing, clears it. The
  drawing reports the selection through `LayoutVisualization`'s optional
  `onSelect`, again whenever the drawing changes, and drops a selection whose
  piece is no longer drawn.
- **Control cards fold.** Each card in the control column (Rooms, Surface,
  Openings, Board, Adhesive, Joint Filler) collapses from its header. Which
  are closed is the page's, not a room's (`Gypsum.jsx:closed`, card id →
  `true`), so switching rooms keeps the column as it was, and being session
  state a local-mode project autosaves it. A folded card's header keeps its
  preset name. A collapsible form card's header takes the field step
  (`--form-control-h`), so a card is the same height folded or not.
- **The layout is the count.** Each surface is cut into lanes of board width
  (vertical fixing: columns up the wall; horizontal: rows along it), each lane
  into pieces, and the pieces are packed first-fit-decreasing back into stock
  sheets, per lane width — a ripped strip's sheet cannot also supply a full
  width piece, but two 600 strips come from one 1200 sheet. Waste % goes on
  top for breakage, not cutting, so it defaults to **5**, not the reference
  site's 10 (that 10 stood in for cutting it did not model).
- **Cut pieces: Reuse offcuts / Full board each** (per room, `fullBoards`).
  Full board each buys a whole board for every piece in the layout, the cut
  first and last ones included: no offcut reuse, no doubling up of strips
  (`packSheets(…, { fullBoards })`). The drawing is unchanged; only the count
  is. The on-screen and printed notes say which rule the count used.
- **Row order** (per room, `rowStart`, Pattern Layouts' control): R1 top or
  bottom fixed horizontally, R1 left or right fixed vertically. R1 is the first
  full lane; the ripped last lane lands on the other side, and a first panel
  offset strip starts from R1's side. The model places the lanes
  (`layoutSurface({ rowStart })`), so openings, the 3D view and the printed
  drawing follow; the 2D view reads `meta.rowStart`. Same count either way
  unless an opening covers a different piece.
- **Wall start: Trim first / Full panel** (per room, `fullStart`). A lane end
  under `MIN_END_PIECE` is made up from another piece. Trim first (the
  default) takes it from the lane's first piece, so a 5130 wall in 2500
  boards is 2330 · 2500 · 300. Full panel keeps the first piece and trims the
  last whole board: 2500 · 2330 · 300. Staggered lanes still start half a
  board in, a first panel offset still sets the first piece, and a lane with
  no whole board to trim falls back to trimming the first
  (`lanePieces(…, fullStart)`).
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
  strip that wide at R1's corner (left with R1 left, as seen from inside). Fixed
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
- **No joint filler, no joint figures.** A room with no filler rate (no
  per-metre or per-mm rate typed or picked) shows no filler rows and no tape,
  on screen and on its printed sheet. `tape.needed` in the model is the one
  test; the project's tape adds only rooms where it is true, and its row
  (screen and print) goes when no room has a filler.
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
  one hook and the components in `components/PresetLibrary.jsx` serve all of
  them, and Concrete's too (below): `usePresetLibrary`
  (presets, the applied one, apply/save), `PresetField` (a field with the
  shared `MaterialPresetDropdown`, which takes a `describe` for presets that
  are not sizes), `ManagePresetsButton` (local mode only, as on Pattern
  Layouts) and `PresetManager` (the table, in a `Modal`). A card header names
  the applied preset through the shared `SelectedPresetDetail`, which takes a
  `detail` string for the same reason. The server keeps each library to its
  own fields (`gypsumLibraryValidator`), so a board preset saved before the
  split drops the filler and adhesive figures it used to carry.

## Concrete tool

Self-levelling and screed consumption: area (typed, or length × width),
thickness (an average, or four corners averaged), then kilograms and bags from
the product's rate. All figures come from `utils/take-off.js`; the page and
`TakeOffSheet` render it.

- **Product presets are on the shared preset system** (`components/PresetLibrary.jsx`,
  the one Gypsum's three libraries use), as `CONCRETE_LIBRARY` in
  `Concrete.jsx`. The consumption field opens the product list; applying one
  fills consumption, bag weight and bag price, and the product is named above
  the Consumption & Packaging section, and on the printed take-off. A hand
  edit of any of the three stops naming it. A preset missing its rate or bag
  weight is refused with a message, not applied half-way.
- **Manage Presets** opens the table in a dialog, and shows only where Save
  Defaults can write (local mode), as on Gypsum and Pattern Layouts. It
  replaced a collapsible table that sat on the page everywhere, GitHub Pages
  included, where its Save Defaults could not save.
- The keys did not change: `DEFAULT_CONCRETE_PRESETS` / `concretePresets`
  (name, rate, bagKg, bagPrice), and the drafts `Concrete.jsx:presets` and
  `Concrete.jsx:activePreset`, so saved defaults and projects carry over.
- **One `job` object** (`Concrete.jsx:job`) holds both switches and every
  typed field, as Gypsum's does, so reset, the model call and the "anything
  typed yet" check read one list. It replaced thirteen drafts of a field each;
  a project saved with those opens with them gathered into `job`
  (`legacyJob`), and the old keys are dropped. Reset clears the fields and
  leaves the two switches. A field is empty only when nothing is in it: 0 is
  a value, so a 0 mm corner is not marked as missing.
- **The screen shows the model's rounding**, the figures the printed sheet
  states: area to 2 decimals, average thickness and fall to 1. It used to
  round again (20.25 m² read 20.3 on screen, 12.5 mm read 13).
- **Bags round up with a tolerance** (`EPS` in `take-off.js`), as Gypsum's
  sheets do: 10 m² × 10 mm × 2.2 kg is 220.00000000000003 kg in floating
  point, and a plain ceiling bought 12 bags for a pour that fills 11.
- Gone with the old system: its own copy of the dropdown, the "updated" tag
  that flashed in the section head, `NumInput`'s `note` (the preset's name
  under the field, Concrete's only), and `DetailSection`, which nothing else
  used.

## Pipe Wrap tool

Wrap length round an insulated pipe: π × (pipe Ø + 2 × thickness), plus an
overlap, less a gap. The figures come from `utils/pipe-wrap.js`
(`buildPipeWrap`), which the page and its diagram both read; it takes typed
text or numbers alike, and the page stores numbers only (the sliders included).

- **The diagram** (`WrapDiagram` in the page) is drawn only once there is a
  pipe: before that every figure in it would be a zero nobody entered. The
  outer ring always fills the frame and the pipe is drawn in proportion
  inside it, never above 80% of the ring (`PIPE_MAX`), so thin material still
  shows as a band and its gap and overlap are visible. A pipe drawn too small
  for its label inside is labelled under the ring.
- **The gap and overlap** are wedges of the ring, each its share of the
  circumference, and together never more than one turn (the model clamps
  them): 150 mm of overlap on a 62.8 mm wrap is the full ring, not 2.4 turns
  drawn out of sight.
- **The sum** beside the ring is monospaced, so its width is known from its
  length; a line too long for the frame is drawn condensed
  (`lengthAdjust="spacingAndGlyphs"`) rather than cut off at the edge.
- **Adjustments** start closed, since most wraps need neither. Closed, the
  heading still says what is applied ("+30 mm overlap · −10 mm gap"), so an
  overlap left from the last pipe cannot apply out of sight. Its number fields
  are named by the labels beside them.
- **Global Reset** asks first and clears all four fields, as on Concrete.
- Colours and type are classes (`.pw-diag-*` in `92-pipe-wrap.css`), not
  inline styles.

## Golden Ratio tool

Seven descending steps, `base / φ^n`, from `utils/golden-ratio.js`
(`buildSeries`; `PHI` is (1 + √5) / 2, shown as 1.6180339887499). The page
reads every figure from it.

- **Entries** are `{ id, value, suffix }` in App's `grItems`, one card each
  (A, B, C: the tone system, `getLinkedCardTone` / `getLinkedCardMarker`).
  The value is a shared `NumInput` labelled "Value A (mm)", so each field and
  its apply button carry the card's letter; the label is "Custom label A".
- **A base under 1 is refused**, not clamped up to 1: the field keeps what was
  typed and says why, and no series is drawn for a number nobody entered.
- **The base shows as entered** (12.5), the steps in whole millimetres, since
  they are marked out. The base used to show rounded (13) while its series was
  worked from 12.5.
- **No per-entry Save (2026-11-04).** Each card had a Save that only painted
  a stripe while the entry matched its saved copy; the series always came from
  the typed value, and Save Defaults ignored the copy. With per-page projects
  keeping the values, the user had it removed, and with it the `saved` and
  `savedCommitted` fields (`DEFAULT_GR`, and the server's validator, which
  drops them from a list saved with them). Reset clears a card's value and
  label, and is an undo step.
- `useLinkedCardHighlight` links control cards to preview cards on click.

## Guider tool

Reference/guide page. The left column holds one `ControlPanel` per category,
built from the module-level `CATEGORIES` in `components/Guider.jsx` (each with
its own `panelId` and open state); the right column shows the selected entry.
An entry names the component it opens (`View`), so adding one is one line in
its category's `entries`, and there is no routing branch to forget.

- **The open entry is a draft** (`Guider.page:selected`), so leaving the page
  and coming back, or opening a project, shows the guide its values belong to.
  It used to be plain state: a Guider project opened on "No entry selected",
  its pipe values hidden behind an entry. The entry buttons carry
  `aria-pressed`.
- **Electrism** (`control-guider-list`): `Lihtlüliti`, `Veksellüliti` — inline
  SVG schematics: square dashed switch boxes with open-circle contacts and a
  floating lever, consistent stroke widths (`r=4.5`, `strokeWidth=2`). Both are
  a `WiringGuide`: the page head, the diagram in a "Skeem" card and the
  numbered "Ühendused" list, with the card head the pipe calculator uses
  (`.guider-card-head`). A connection names its `wire` (`phase`, `neutral`,
  `traveller`), which picks its dot's colour, the one the diagram draws it in.
  Diagram text and the list are classes (`.guider-wire-*`, `.guider-conn-*`
  in `50-preview.css`); each SVG is a named `role="img"`.
- The page's frame (title, empty state, the "Electrism" heading) is in
  English and the guides in Estonian: the user's choice, kept as it is.
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

## Timesheet tool

Rows of start, end and lunch, each worked out by `rowResult` in
`utils/timesheet.js` beside the parsers it uses (`parseTime`, `parseLunch`):
H:MM, a quarter-hour decimal, and a status (`empty`, `partial`, `ok`, `warn`,
`error`). Only `ok` rows count toward the total, and the total is the summed
minutes, rounded to a quarter hour once.

- **Rounding is the user's open question, and stays as it is until they
  decide.** Each row rounds its own decimal, and the total rounds the summed
  minutes, so two 8:07 days read 8.00 + 8.00 against a 16.25 total (and Copy
  decimal copies 16.25). The other choice is to add the rounded rows.
- **Tab** walks Start, End and Lunch and rolls into the next row; off a
  filled last row it adds one. Off an empty last row it carries on to the
  row's remove button and the presets: adding a row on every Tab was a trap a
  keyboard could never leave. Arrow keys move across the grid
  (`utils/grid-nav.js`).
- **Labels follow the row's place on screen** ("Start time, row 1", "Remove
  row 1"), not its id, which never renumbers after a removal.
- **Clear all** is one click and an undo step, unlike the other pages' two-click
  resets: kept as it is.
- Copy decimal is a `.ts-copy` on the control scale, laid out across the card
  by `.result-card-print`, like the other pages' Take-off buttons.
