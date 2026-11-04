import { SessionDraftContext, useSessionState } from "../utils/session-state.js";
import { React } from "../react-globals.js";
import { ControlPanel, Icon, NumInput, Row, Stack, useTimedState } from "../shared.jsx";
import { LIBRARIES, ManagePresetsButton, PresetField, PresetManager, libraryFields, presetHeader, usePresetLibrary } from "./GypsumPresets.jsx";
import { LayoutVisualization } from "../Visualization.jsx";
import { GypsumProjectSheet, GypsumTakeOffSheet } from "./GypsumTakeOffSheet.jsx";
import { GypsumRoom3D } from "./GypsumRoom3D.jsx";
import { buildGypsumProjectTakeOff, buildGypsumTakeOff, jointFillerRate, WALLS } from "../utils/gypsum-take-off.js";

// ── Gypsum board estimator ────────────────────────────────────────────────────

const KEY = name => `Gypsum.jsx:${name}`;
/* Every product field, across the board, filler and adhesive libraries. */
const PRODUCT_FIELDS = Object.values(LIBRARIES).flatMap(libraryFields);

/* Fields that begin empty, and those that begin at a sensible value. Opening
   sizes are standard enough to prefill; job dimensions never are. */
const EMPTY = ["lenMm", "widMm", "heightMm", "wallW", "wallH", "skimMm", "firstOffset", ...PRODUCT_FIELDS];
const PREFILLED = { waste: "5" };
/* A new opening starts at a common size; its position starts empty, and an
   opening with no position still comes off the area — it is just not drawn. */
const NEW_OPENING = {
  door: { kind: "door", wall: "A", x: "", w: "900", h: "2100" },
  window: { kind: "window", wall: "A", x: "", w: "1200", h: "1200", sill: "900" }
};

function Seg({ value, options, onChange, label, inline = false }) {
  return (
    <div className={"seg-group" + (inline ? " seg-group--inline" : "")} role="group" aria-label={label}>
      {options.map(([id, text]) => (
        <button key={id} type="button" className={"ctrl-dir" + (value === id ? " on" : "")}
          aria-pressed={value === id} onClick={() => onChange(id)}>{text}</button>
      ))}
    </div>
  );
}

/* A room or wall's own settings, beside its `job` of typed fields. */
const SETTINGS = { mode: "room", ceiling: false, orientation: "V", layers: "1", fixing: "screw" };
/* Which preset each library has applied: per room (see usePresetLibrary). */
const ACTIVE = Object.values(LIBRARIES).map(lib => lib.draftKeys[1]);
/* The fields that describe the surface itself. A room added from another
   keeps everything else — board, fixing, filler, waste — and starts these
   empty, since two rooms are rarely one size but are usually one order. */
const SURFACE_FIELDS = ["lenMm", "widMm", "heightMm", "wallW", "wallH"];

const blankJob = () => ({ ...Object.fromEntries(EMPTY.map(name => [name, ""])), ...PREFILLED, openings: [] });
export const newRoom = (id, mode = "room") =>
  ({ id, name: "", ...SETTINGS, mode, job: blankJob(), ...Object.fromEntries(ACTIVE.map(key => [key, null])) });
export const roomFrom = (source, id, mode) => ({
  ...newRoom(id, mode),
  orientation: source.orientation, layers: source.layers, fixing: source.fixing,
  ...Object.fromEntries(ACTIVE.map(key => [key, source[key] ?? null])),
  job: { ...source.job, ...Object.fromEntries(SURFACE_FIELDS.map(name => [name, ""])), openings: [] }
});

/* An unnamed entry is called by its kind and its place among that kind —
   "Room 2", "Wall 1" — worked out rather than stored, so switching an entry
   between room and wall renames it too. */
export const roomLabel = (room, index, rooms) => room.name.trim() ||
  `${room.mode === "wall" ? "Wall" : "Room"} ${rooms.slice(0, index + 1).filter(r => r.mode === room.mode).length}`;

/* Before the page held a list it kept one room under these keys. A project
   saved then opens as a list of one, and the old keys are dropped from the
   drafts so they are not saved again beside it. */
const LEGACY = [...Object.keys(SETTINGS), "job", ...ACTIVE];
function legacyRoom(drafts) {
  if (!drafts || !LEGACY.some(name => drafts.has(KEY(name)))) return null;
  const room = newRoom(1);
  for (const name of [...Object.keys(SETTINGS), ...ACTIVE]) if (drafts.has(KEY(name))) room[name] = drafts.get(KEY(name));
  if (drafts.has(KEY("job"))) room.job = { ...blankJob(), ...drafts.get(KEY("job")) };
  return room;
}
const validRooms = list => Array.isArray(list) && list.length > 0 && list.every(r => r && r.job);

export function SheetGypsum({ projectName = "" }) {
  /* Every room and wall of the job. Which one is on screen is `currentId`;
     the controls below read and write that entry only. */
  const drafts = React.useContext(SessionDraftContext);
  const [storedRooms, setRooms] = useSessionState(KEY("rooms"), () => [legacyRoom(drafts) || newRoom(1)]);
  React.useEffect(() => { if (drafts) for (const name of LEGACY) drafts.delete(KEY(name)); }, [drafts]);
  const rooms = validRooms(storedRooms) ? storedRooms : [newRoom(1)];
  const [currentId, setCurrentId] = useSessionState(KEY("room"), null);
  const room = rooms.find(r => r.id === currentId) || rooms[0];
  const roomIndex = rooms.indexOf(room);

  const updateRoom = (id, change) => setRooms(current =>
    (validRooms(current) ? current : rooms).map(r => (r.id === id ? { ...r, ...change(r) } : r)));
  /* One room field as a [value, setter] pair, so the controls below read as
     they did when each was its own piece of state. */
  const roomState = name => [room[name], value =>
    updateRoom(room.id, r => ({ [name]: typeof value === "function" ? value(r[name]) : value }))];

  const [mode, setMode] = roomState("mode");                 // "room" | "wall"
  const [ceiling, setCeiling] = roomState("ceiling");
  const [orientation, setOrientation] = roomState("orientation");
  const [layers, setLayers] = roomState("layers");
  const [fixing, setFixing] = roomState("fixing");          // "screw" | "glue"
  const glued = fixing === "glue";
  const [view3d, setView3d] = useSessionState(KEY("view3d"), false);

  /* Every typed field in one object, so reset and the model call do not repeat
     the list. A setter per field is derived from it. */
  const [job, setJob] = roomState("job");
  const val = name => job[name];
  const set = name => value => setJob(current => ({ ...current, [name]: value }));

  /* Three preset libraries, each filling its own fields (GypsumPresets.jsx).
     The lists are the project's; the applied preset is the room's. */
  const merge = values => setJob(current => ({ ...current, ...values }));
  const [activeBoard, setActiveBoard] = roomState(LIBRARIES.board.draftKeys[1]);
  const [activeFiller, setActiveFiller] = roomState(LIBRARIES.filler.draftKeys[1]);
  const [activeAdhesive, setActiveAdhesive] = roomState(LIBRARIES.adhesive.draftKeys[1]);
  const board = usePresetLibrary(LIBRARIES.board, { onApply: merge, active: activeBoard ?? null, setActive: setActiveBoard });
  const filler = usePresetLibrary(LIBRARIES.filler, { onApply: merge, active: activeFiller ?? null, setActive: setActiveFiller });
  const adhesive = usePresetLibrary(LIBRARIES.adhesive, { onApply: merge, active: activeAdhesive ?? null, setActive: setActiveAdhesive });
  const libraries = [board, filler, adhesive];
  const [resetArmed, armReset, disarmReset] = useTimedState(false, 4000);
  const [deleteArmed, armDelete, disarmDelete] = useTimedState(false, 4000);

  /* Reset clears the room on screen, never the others: with a list, wiping
     every room behind one button would be the one irreversible thing here. */
  const resetAll = () => {
    updateRoom(room.id, r => ({ ...newRoom(r.id), name: r.name }));
    setView3d(false);
  };
  const handleReset = () => {
    if (!resetArmed) { armReset(true); return; }
    disarmReset();
    resetAll();
  };

  // ── The list: add, duplicate, delete, switch ───────────────────────────────
  const nextId = () => rooms.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const addRoom = kind => {
    const id = nextId();
    setRooms([...rooms, roomFrom(room, id, kind)]);
    setCurrentId(id);
  };
  const duplicateRoom = () => {
    const id = nextId();
    const copy = { ...JSON.parse(JSON.stringify(room)), id, name: room.name.trim() ? `${room.name.trim()} copy` : "" };
    setRooms([...rooms.slice(0, roomIndex + 1), copy, ...rooms.slice(roomIndex + 1)]);
    setCurrentId(id);
  };
  const deleteRoom = () => {
    if (rooms.length < 2) return;
    if (!deleteArmed) { armDelete(true); return; }
    disarmDelete();
    const rest = rooms.filter(r => r.id !== room.id);
    setRooms(rest);
    setCurrentId(rest[Math.min(roomIndex, rest.length - 1)].id);
  };

  /* A hand edit of a product field means the values are no longer the
     preset's, so its name stops showing. */
  const productChange = (library, name) => v => { if (v !== val(name)) library.edited(); set(name)(v); };

  // ── Derived values: all of it from the model ───────────────────────────────
  /* Every room's take-off, so the list and the project total read the same
     figures as the room's own card. The product names come from the shared
     lists by each room's own choice. */
  const nameIn = (library, idx) => (idx !== null && idx !== undefined ? library.presets[idx]?.name || "" : "");
  const entries = React.useMemo(() => rooms.map((r, i) => ({
    id: r.id,
    name: roomLabel(r, i, rooms),
    takeOff: buildGypsumTakeOff({
      ...r.job, mode: r.mode, ceiling: r.ceiling, orientation: r.orientation, layers: r.layers, fixing: r.fixing,
      product: nameIn(board, r.activePreset),
      fillerProduct: nameIn(filler, r.activeFiller),
      adhesiveProduct: nameIn(adhesive, r.activeAdhesive)
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [rooms, board.presets, filler.presets, adhesive.presets]);
  const takeOff = entries[roomIndex].takeOff;
  const project = rooms.length > 1 ? buildGypsumProjectTakeOff(entries) : null;
  const { area, sheets, screws, compound, tape } = takeOff;
  const derivedJoint = jointFillerRate(val("compoundRate"), val("skimRate"));

  /* One document at a time: the room's sheet or the project's. Both are
     portalled to <body>, and print shows every .doc-sheet it finds. */
  const [printing, setPrinting] = React.useState(null);
  React.useEffect(() => {
    if (!printing) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printing]);
  const fieldKey = JSON.stringify([rooms, room.id, ...libraries.map(l => l.presets)]);
  React.useEffect(() => { setPrinting(null); }, [fieldKey]);

  const dimsKeys = mode === "room" ? ["lenMm", "widMm", "heightMm"] : ["wallW", "wallH"];
  const hasAnyInput = [...dimsKeys, ...PRODUCT_FIELDS].some(name => val(name) !== "");
  const req = name => hasAnyInput && val(name) === "";
  const fmtEur = n => n.toLocaleString("et-EE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const openingRows = job.openings || [];
  const setOpenings = update => setJob(current => ({ ...current, openings: update(current.openings || []) }));
  const addOpening = kind => setOpenings(list =>
    [...list, { ...NEW_OPENING[kind], id: list.reduce((m, o) => Math.max(m, o.id), 0) + 1 }]);
  const updateOpening = (id, key, value) => setOpenings(list => list.map(o => (o.id === id ? { ...o, [key]: value } : o)));
  const removeOpening = id => setOpenings(list => list.filter(o => o.id !== id));

  const num = (name, label, extra = {}) => (
    <NumInput id={`input-gyp-${name}`} label={label} value={val(name)} min={0} onChange={set(name)} req={extra.req ?? false} {...extra} />
  );

  /* Pattern Layouts' shape: the inputs in the fixed control column, and the
     results, layout views and reference tables across the rest of the width,
     so the 2D and 3D views get the room. Inside the preview, a layout-split
     with one column keeps the result card's mobile bottom bar (the split's
     second child), which the desktop shows first instead. */
  return (
    <>
      <Stack id="data-control" className="data-control gyp-control" gap={4}>
        {/* The job's rooms and walls. The list shows once there is a second
            entry; until then the card is the name and the ways to add one. */}
        <ControlPanel id="control-gyp-rooms" title="Rooms" noToggle className="form-section-card">
          <Stack gap={3} className="ctrl-list">
            {rooms.length > 1 && (
              <div className="gyp-room-list" role="group" aria-label="Rooms and walls">
                {entries.map(e => (
                  <button key={e.id} type="button" className={"ctrl-dir gyp-room-btn" + (e.id === room.id ? " on" : "")}
                    aria-pressed={e.id === room.id} onClick={() => { disarmDelete(); setCurrentId(e.id); }}>
                    <span className="gyp-room-name">{e.name}</span>
                    <span className="gyp-room-meta">{e.takeOff.ready ? `${e.takeOff.sheets.toBuy} pcs` : "—"}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="num-wrap">
              <label htmlFor="input-gyp-room-name" className="num-lbl">Name</label>
              <input id="input-gyp-room-name" className="num-input" type="text" autoComplete="off" maxLength={60}
                placeholder={roomLabel({ ...room, name: "" }, roomIndex, rooms)} value={room.name}
                onChange={e => updateRoom(room.id, () => ({ name: e.target.value }))} />
            </div>
            <div className="gyp-room-actions">
              <button type="button" className="ctrl-dir" onClick={() => addRoom("room")}><Icon name="plus" /> Room</button>
              <button type="button" className="ctrl-dir" onClick={() => addRoom("wall")}><Icon name="plus" /> Wall</button>
              <button type="button" className="ctrl-dir" onClick={duplicateRoom}
                aria-label={`Duplicate ${entries[roomIndex].name}`}>Duplicate</button>
              {rooms.length > 1 && (
                <button type="button" className={"ctrl-dir ctl-danger" + (deleteArmed ? " is-armed" : "")}
                  onClick={deleteRoom} onBlur={disarmDelete}
                  aria-label={deleteArmed ? `Confirm delete ${entries[roomIndex].name}` : `Delete ${entries[roomIndex].name}`}>
                  {deleteArmed ? "Delete?" : "Delete"}
                </button>
              )}
            </div>
          </Stack>
        </ControlPanel>

        {/* Keyed by the room, so switching remounts the fields: each reads the
            new room's values, and field undo cannot carry one room's typing
            into another. */}
        <React.Fragment key={room.id}>
        <ControlPanel id="control-gyp-surface" title="Surface" noToggle className="form-section-card">
          <Stack gap={3} className="ctrl-list">
            <Seg label="What to board" value={mode} onChange={setMode}
              options={[["room", "Room"], ["wall", "Single wall"]]} />
            <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
              {mode === "room" ? <>
                {num("lenMm", "Length (mm)", { min: 1, req: req("lenMm") })}
                {num("widMm", "Width (mm)", { min: 1, req: req("widMm") })}
              </> : <>
                {num("wallW", "Width (mm)", { min: 1, req: req("wallW") })}
                {num("wallH", "Height (mm)", { min: 1, req: req("wallH") })}
              </>}
            </div>
            {mode === "room" && <>
              <Seg label="Ceiling" value={ceiling ? "on" : "off"} onChange={v => setCeiling(v === "on")}
                options={[["off", "Walls only"], ["on", "Walls + ceiling"]]} />
              {num("heightMm", "Wall height (mm)", { min: 1, req: req("heightMm") })}
            </>}
          </Stack>
        </ControlPanel>

        <ControlPanel id="control-gyp-openings" title="Openings (mm)" noToggle className="form-section-card">
          <Stack gap={3} className="ctrl-list">
          {openingRows.map((o, i) => {
            const read = takeOff.openings.list[i];
            const field = (key, label) => (
              <div className="gyp-open-field">
                <label className="gyp-open-lbl" htmlFor={`gyp-open-${o.id}-${key}`}>{label}</label>
                <input id={`gyp-open-${o.id}-${key}`} type="text" inputMode="decimal" autoComplete="off"
                  className="num-input" value={o[key] ?? ""}
                  aria-invalid={read?.status === "misfit" || read?.status === "invalid" ? true : undefined}
                  onChange={e => updateOpening(o.id, key, e.target.value)} />
              </div>
            );
            return (
              <div key={o.id} className="gyp-open-row">
                <span className="gyp-open-tag">{read?.label}</span>
                {mode === "room" && (
                  <Seg inline label={`${read?.label} wall`} value={o.wall} onChange={v => updateOpening(o.id, "wall", v)}
                    options={WALLS.map(w => [w, w])} />
                )}
                <button type="button" className="num-btn ctl-ghost ctl-sm ctl-icon ctl-danger gyp-open-del"
                  aria-label={`Remove ${read?.label}`} title={`Remove ${read?.label}`}
                  onClick={() => removeOpening(o.id)}>
                  <Icon name="close" />
                </button>
                <div className="gyp-open-fields">
                  {field("x", "From left")}
                  {field("w", "Width")}
                  {field("h", "Height")}
                  {o.kind === "window" ? field("sill", "Sill") : <div className="gyp-open-field" />}
                </div>
              </div>
            );
          })}
          <Stack direction="row" gap={2}>
            <button type="button" className="ctrl-dir" onClick={() => addOpening("door")}>
              <Icon name="plus" /> Door
            </button>
            <button type="button" className="ctrl-dir" onClick={() => addOpening("window")}>
              <Icon name="plus" /> Window
            </button>
          </Stack>
          </Stack>
        </ControlPanel>

        <ControlPanel id="control-gyp-board" title="Board" noToggle className="form-section-card"
          headerDetail={presetHeader(board)}>
          <Stack gap={3} className="ctrl-list">
            <PresetField library={board} field="sheetW" id="input-gyp-sheetW" label="Sheet width (mm)" labelIcon="arrow-h"
              value={val("sheetW")} min={100} onChange={productChange(board, "sheetW")} req={req("sheetW")} />
            <PresetField library={board} field="sheetL" id="input-gyp-sheetL" label="Sheet length (mm)" labelIcon="arrow-v"
              value={val("sheetL")} min={100} onChange={productChange(board, "sheetL")} req={req("sheetL")} />
            <Seg label="Fixing direction" value={orientation} onChange={setOrientation}
              options={[["V", "Vertical"], ["H", "Horizontal"]]} />
            {/* Vertical: a strip at the corner. Horizontal: each row's first piece. */}
            {num("firstOffset", "First panel offset (mm)", { max: 10000 })}
            {/* Glued is one layer on walls; the model enforces it, so the choice
                is not offered rather than offered and ignored. */}
            <Seg label="Fixing method" value={fixing} onChange={setFixing}
              options={[["screw", "Screwed"], ["glue", "Glued"]]} />
            {!glued && (
              <Seg label="Layers" value={layers} onChange={setLayers}
                options={[["1", "1 layer"], ["2", "2 layers"]]} />
            )}
            {/* Glued walls take no screws; a boarded ceiling still does. */}
            {(!glued || (mode === "room" && ceiling)) && (
              <div className={board.fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-screwRate" label={glued ? "Ceiling screws (pcs/m²)" : "Screws (pcs/m²)"}
                  value={val("screwRate")} min={0} onChange={productChange(board, "screwRate")} />
              </div>
            )}
            <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
              <div className={board.fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-sheetPrice" label="Sheet price (€)" value={val("sheetPrice")} min={0} onChange={productChange(board, "sheetPrice")} />
              </div>
              {num("waste", "Waste (%)", { max: 100 })}
            </div>
            <ManagePresetsButton library={board} />
          </Stack>
        </ControlPanel>
        {board.error && !board.managing && <p role="alert" className="input-error">{board.error}</p>}

        {glued && (
          <ControlPanel id="control-gyp-adhesive" title="Adhesive" noToggle className="form-section-card"
            headerDetail={presetHeader(adhesive)}>
            <Stack gap={3} className="ctrl-list">
              <PresetField library={adhesive} field="adhesiveRate" id="input-gyp-adhesiveRate" label="Adhesive (kg/m²)"
                value={val("adhesiveRate")} onChange={productChange(adhesive, "adhesiveRate")} />
              <div className={adhesive.fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-adhesiveBagKg" label="Adhesive bag (kg)" value={val("adhesiveBagKg")} min={0.1}
                  onChange={productChange(adhesive, "adhesiveBagKg")} />
              </div>
              <ManagePresetsButton library={adhesive} />
            </Stack>
          </ControlPanel>
        )}
        {glued && adhesive.error && !adhesive.managing && <p role="alert" className="input-error">{adhesive.error}</p>}

        <ControlPanel id="control-gyp-filler" title="Joint Filler" noToggle className="form-section-card"
          headerDetail={presetHeader(filler)}>
          <Stack gap={3} className="ctrl-list">
            <PresetField library={filler} field="compoundRate" id="input-gyp-compoundRate" label="Joint filler (kg/m of joint)"
              value={val("compoundRate")} onChange={productChange(filler, "compoundRate")} />
            <div className="pw-grid-2col" style={{ marginBottom: 0 }}>
              <div className={filler.fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-skimRate" label="Per 1 mm (kg/m²)" value={val("skimRate")} min={0} onChange={productChange(filler, "skimRate")} />
              </div>
              <div className={filler.fieldFlash ? "num-input-flash" : ""}>
                <NumInput id="input-gyp-bagKg" label="Filler bag (kg)" value={val("bagKg")} min={0.1} onChange={productChange(filler, "bagKg")} />
              </div>
            </div>
            {/* Worked out, not typed: said once, under the field it stands in for. */}
            {derivedJoint.derived && (
              <p className="gyp-derived" role="status">
                ≈ {derivedJoint.rate} kg per m of joint, from {val("skimRate")} kg/m² per 1 mm
              </p>
            )}
            {num("skimMm", "Surface skim (mm)", { max: 10 })}
            <ManagePresetsButton library={filler} />
          </Stack>
        </ControlPanel>
        {filler.error && !filler.managing && <p role="alert" className="input-error">{filler.error}</p>}
        </React.Fragment>

        <div className="form-action">
          <button onClick={handleReset} onBlur={disarmReset}
            className={"ts-btn ctl-ghost ctl-danger" + (resetArmed ? " is-armed" : "")}
            aria-label={rooms.length > 1
              ? (resetArmed ? `Confirm reset — clears every field of ${entries[roomIndex].name}` : `Reset ${entries[roomIndex].name} — clears its fields, asks first`)
              : (resetArmed ? "Confirm global reset — clears every field" : "Global reset — clears every field, asks first")}>
            <Icon name="refresh-cw" /> {resetArmed ? "Confirm reset?" : rooms.length > 1 ? `Reset ${mode === "wall" ? "Wall" : "Room"}` : "Global Reset"}
          </button>
        </div>
      </Stack>

      <div id="data-preview" className="data-preview gyp-preview" role="region" aria-label="Gypsum results">
        <div className="layout-split gyp-split">
          <Stack gap={5}>
            {!takeOff.ready && hasAnyInput && <p role="status" className="input-error">{takeOff.issue}</p>}
            {takeOff.warning && <p role="status" className="input-error">{takeOff.warning}</p>}

            {/* ── Layout ── */}
            {takeOff.surfaces.some(s => s.layout) && (
              <div className="section unboxed">
                <div className="section-head">
                  <span>Layout</span>
                  <Seg inline label="Layout view" value={view3d ? "3d" : "2d"} onChange={v => setView3d(v === "3d")}
                    options={[["2d", "2D"], ["3d", "3D"]]} />
                </div>
                <div className="section-body">
                  <Stack className="section-pad" gap={4}>
                    {view3d && <GypsumRoom3D room={takeOff.room} surfaces={takeOff.surfaces} />}
                    {!view3d && takeOff.surfaces.filter(s => s.layout).map(s => (
                      <Stack key={s.id} gap={2} className="gyp-surface">
                        <div className="gyp-surface-head">
                          <span className="gyp-surface-name">{s.label}</span>
                          <span className="gyp-surface-meta">
                            {s.layout.full} full · {s.layout.cut} cut{s.count > 1 ? " each" : ""}
                          </span>
                        </div>
                        <LayoutVisualization result={{ ...s.layout, stats: { full: s.layout.full, cut: s.layout.cut } }} maxHeight={460} />
                      </Stack>
                    ))}
                  </Stack>
                </div>
              </div>
            )}

            {/* ── Calculation details ── */}
            <div className="section unboxed">
              <div className="section-head"><span>Calculation Details</span></div>
              <div className="section-body">
                <Stack className="section-pad" gap={1}>
                  <Row label="Surface area" value={area.gross.toFixed(2)} unit="m²" />
                  {area.openings > 0 && <Row label="Openings" value={`−${area.openings.toFixed(2)}`} unit="m²" />}
                  <Row label="Net area" value={area.net.toFixed(2)} unit="m²" />
                  {takeOff.layers > 1 && <Row label="Boarded area (2 layers)" value={area.boarded.toFixed(2)} unit="m²" />}
                  <Row label="Sheets from layout" value={sheets.layout} unit="pcs" />
                  <Row label={`With ${sheets.waste}% waste`} value={sheets.exact.toFixed(1)} unit="pcs" />
                  {(!glued || screws.area > 0) && <Row label={glued ? "Ceiling screws" : "Screws"} value={screws.count} unit="pcs" />}
                  {takeOff.adhesive && <Row label="Adhesive" value={takeOff.adhesive.kg.toFixed(1)} unit="kg" />}
                  {takeOff.adhesive?.bagKg && <Row label={`Adhesive bags (${takeOff.adhesive.bagKg} kg)`} value={takeOff.adhesive.bags} unit="pcs" />}
                  <Row label="Joints filled" value={compound.length.toFixed(1)} unit="m" />
                  {compound.skim && <>
                    <Row label={`Filler for joints${compound.rate !== null ? ` (${compound.rate} kg/m)` : ""}`} value={compound.jointKg.toFixed(1)} unit="kg" />
                    <Row label={`Surface skim ${compound.skim.mm} mm (${compound.skim.area.toFixed(2)} m²)`} value={compound.skim.kg.toFixed(1)} unit="kg" />
                  </>}
                  <Row label={compound.skim ? "Joint filler, total" : `Joint filler${compound.rate !== null ? ` (${compound.rate} kg/m)` : ""}`} value={compound.kg.toFixed(1)} unit="kg" />
                  {compound.bagKg && <Row label={`Filler bags (${compound.bagKg} kg)`} value={compound.bags} unit="pcs" />}
                  <Row label="Joint tape" value={tape.total.toFixed(1)} unit="m" />

                  <div className="pw-formula-wrap" style={{ marginTop: "1rem" }}>
                    <span className="pw-formula-text">
                      Sheets are counted from the layout, offcuts reused, then waste added. Openings reduce screws; a placed one also drops any piece wholly inside it. Joint filler is per metre of joint: every board joint (each layer) plus the corners. A filler given only per 1 mm is counted as 1 mm over a 340 mm strip of joint; a surface skim covers the net area at that thickness.
                    </span>
                  </div>
                  <div className="pw-formula-wrap" style={{ paddingBottom: "1rem" }}>
                    <span className="pw-formula-text">
                      Tape covers board joints on the face layer{mode === "room" ? ", internal corners" : ""}{mode === "room" && ceiling ? " and the ceiling angle" : ""}.
                    </span>
                  </div>
                  {glued && (
                    <div className="pw-formula-wrap" style={{ paddingBottom: "1rem" }}>
                      <span className="pw-formula-text">
                        Glued: boards stuck in dabs straight onto masonry, one layer. Adhesive covers the walls' net area; a ceiling is still screwed. An uneven wall takes more.
                      </span>
                    </div>
                  )}
                </Stack>
              </div>
            </div>

            {/* ── Every room, added up (buildGypsumProjectTakeOff) ── */}
            {project && (
              <div className="section unboxed">
                <div className="section-head">
                  <span>All Rooms</span>
                  <button type="button" className="ts-btn ctl-ghost ctl-sm" disabled={!project.ready}
                    onClick={() => setPrinting({ project, entries })}
                    title={project.ready ? "Take-off for every room — opens the print dialog" : "Finish a room first"}>
                    <Icon name="print" /> Take-off
                  </button>
                </div>
                <div className="section-body">
                  <Stack className="section-pad" gap={1}>
                    {project.rooms.map(r => (
                      <Row key={r.id} label={r.name} value={r.ready ? r.sheets : "—"} unit={r.ready ? "sheets" : ""} />
                    ))}
                    <div className="gyp-total-rule" />
                    <Row label="Net area" value={project.area.net.toFixed(2)} unit="m²" />
                    {project.boards.map(b => (
                      <Row key={`${b.product}|${b.width}|${b.length}|${b.price}`} hi
                        label={`${b.product || "Board"} ${b.width} × ${b.length}`} value={b.toBuy} unit="sheets" />
                    ))}
                    {project.screws.count > 0 && <Row label="Screws" value={project.screws.count} unit="pcs" />}
                    {project.adhesive.map(a => (
                      <Row key={`a|${a.product}|${a.bagKg}`} label={`${a.product || "Adhesive"}${a.bagKg ? ` (${a.bagKg} kg bags)` : ""}`}
                        value={a.bagKg ? a.bags : a.kg.toFixed(1)} unit={a.bagKg ? "bags" : "kg"} />
                    ))}
                    {project.filler.map(f => (
                      <Row key={`f|${f.product}|${f.bagKg}`} label={`${f.product || "Joint filler"}${f.bagKg ? ` (${f.bagKg} kg bags)` : ""}`}
                        value={f.bagKg ? f.bags : f.kg.toFixed(1)} unit={f.bagKg ? "bags" : "kg"} />
                    ))}
                    <Row label="Joint tape" value={project.tape.total.toFixed(1)} unit="m" />
                    {project.cost && (
                      <Row label={project.cost.partial ? "Sheet cost (priced boards)" : "Sheet cost"} value={`€${fmtEur(project.cost.total)}`} />
                    )}
                    {project.readyCount < project.count && (
                      <p className="pw-formula-text gyp-total-note">
                        {project.count - project.readyCount} of {project.count} not finished and left out of the total.
                      </p>
                    )}
                  </Stack>
                </div>
              </div>
            )}
          </Stack>

          <div className="gyp-result-wrap">
            <div className="result-card result-card--concrete gyp-result">
              <div className="result-card-primary">
                <span className="result-card-title">Sheets Needed</span>
                <span className="result-card-value">
                  {sheets.toBuy}
                  <span style={{ fontSize: "var(--fs-md)", fontWeight: "var(--fw-reg)", marginLeft: "4px" }}>pcs</span>
                </span>
                <span className="result-card-note">layout: {sheets.layout} · +{sheets.waste}% waste</span>
              </div>
              <div className="result-card-split">
                <span className="result-card-title">Sheet Cost</span>
                <span className="result-card-value">
                  {sheets.total !== null ? (<><span style={{ fontSize: "var(--fs-lg)" }}>€</span><span>{fmtEur(sheets.total)}</span></>) : "—"}
                </span>
              </div>
              <button type="button" className="ts-btn ctl-ghost result-card-print"
                onClick={() => setPrinting({ takeOff })} disabled={!takeOff.ready}
                title={takeOff.ready ? "Take-off sheet — opens the print dialog, where Save as PDF is" : "Enter the surface and sheet size first"}>
                <Icon name="print" /> Take-off
              </button>
            </div>
          </div>
        </div>
      </div>
      {libraries.map(library => <PresetManager key={library.lib.id} library={library} />)}
      <GypsumTakeOffSheet takeOff={printing?.takeOff || null} title={rooms.length > 1 ? entries[roomIndex].name : ""} projectName={projectName} />
      <GypsumProjectSheet project={printing?.project || null} entries={printing?.entries || null} projectName={projectName} />
    </>
  );
}
