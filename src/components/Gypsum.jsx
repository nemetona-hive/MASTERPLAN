import { SessionDraftContext, useSessionState } from "../utils/session-state.js";
import { React } from "../react-globals.js";
import { ControlPanel, Icon, NumInput, Row, SegGroup, Stack, useTimedState } from "../shared.jsx";
import { LIBRARIES, ManagePresetsButton, PresetField, PresetManager, libraryFields, presetHeader, usePresetLibrary } from "./GypsumPresets.jsx";
import { LayoutVisualization } from "../Visualization.jsx";
import { GypsumProjectSheet, GypsumTakeOffSheet } from "./GypsumTakeOffSheet.jsx";
import { GypsumRoom3D } from "./GypsumRoom3D.jsx";
import { buildGypsumProjectTakeOff, buildGypsumTakeOff, jointFillerRate, WALLS } from "../utils/gypsum-take-off.js";
import { eur } from "../utils/format.js";
import { ProjectSection } from "./ProjectMenu.jsx";

// ── Gypsum board estimator ────────────────────────────────────────────────────

const KEY = name => `Gypsum.jsx:${name}`;
/* Every product field, across the board, filler and adhesive libraries. */
const PRODUCT_FIELDS = Object.values(LIBRARIES).flatMap(libraryFields);
/* The fields that describe the surface itself, by mode. A room added from
   another keeps everything else — board, fixing, filler, waste — and starts
   these empty, since two rooms are rarely one size but are usually one order. */
const DIMS = { room: ["lenMm", "widMm", "heightMm"], wall: ["wallW", "wallH"] };
const SURFACE_FIELDS = [...DIMS.room, ...DIMS.wall];

/* Fields that begin empty, and those that begin at a sensible value. Opening
   sizes are standard enough to prefill; job dimensions never are. */
const EMPTY = [...SURFACE_FIELDS, "skimMm", "firstOffset", ...PRODUCT_FIELDS];
const PREFILLED = { waste: "5" };
/* A new opening starts at a common size; its position starts empty, and an
   opening with no position still comes off the area — it is just not drawn. */
const NEW_OPENING = {
  door: { kind: "door", wall: "A", x: "", w: "900", h: "2100" },
  window: { kind: "window", wall: "A", x: "", w: "1200", h: "1200", sill: "900" }
};

/* A room or wall's own settings, beside its `job` of typed fields. */
const SETTINGS = { mode: "room", ceiling: false, orientation: "V", layers: "1", fixing: "screw", fullBoards: false };
/* Which preset each library has applied: per room (see usePresetLibrary). */
const ACTIVE = Object.values(LIBRARIES).map(lib => lib.activeKey);

const blankJob = () => ({ ...Object.fromEntries(EMPTY.map(name => [name, ""])), ...PREFILLED, openings: [] });
export const newRoom = (id, mode = "room") =>
  ({ id, name: "", ...SETTINGS, mode, job: blankJob(), ...Object.fromEntries(ACTIVE.map(key => [key, null])) });
export const roomFrom = (source, id, mode) => ({
  ...newRoom(id, mode),
  orientation: source.orientation, layers: source.layers, fixing: source.fixing, fullBoards: Boolean(source.fullBoards),
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
const presetName = (presets, idx) => (idx !== null && idx !== undefined ? presets[idx]?.name || "" : "");

// ── Pieces of the page ────────────────────────────────────────────────────────

/* The job's rooms and walls. The list shows once there is a second entry;
   until then the card is the name and the ways to add one. */
function RoomsPanel({ rooms, entries, room, roomIndex, onSelect, onRename, onAdd, onDuplicate, onDelete, deleteArmed, disarmDelete }) {
  const name = entries[roomIndex].name;
  return (
    <ControlPanel id="control-gyp-rooms" title="Rooms" noToggle className="form-section-card">
      <Stack gap={3} className="ctrl-list">
        {rooms.length > 1 && (
          <div className="gyp-room-list" role="group" aria-label="Rooms and walls">
            {entries.map(e => (
              <button key={e.id} type="button" className={"ctrl-dir gyp-room-btn" + (e.id === room.id ? " on" : "")}
                aria-pressed={e.id === room.id} onClick={() => onSelect(e.id)}>
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
            onChange={e => onRename(e.target.value)} />
        </div>
        <div className="gyp-room-actions">
          <button type="button" className="ctrl-dir" onClick={() => onAdd("room")}><Icon name="plus" /> Room</button>
          <button type="button" className="ctrl-dir" onClick={() => onAdd("wall")}><Icon name="plus" /> Wall</button>
          <button type="button" className="ctrl-dir" onClick={onDuplicate} aria-label={`Duplicate ${name}`}>Duplicate</button>
          {rooms.length > 1 && (
            <button type="button" className={"ctrl-dir ctl-danger" + (deleteArmed ? " is-armed" : "")}
              onClick={onDelete} onBlur={disarmDelete}
              aria-label={deleteArmed ? `Confirm delete ${name}` : `Delete ${name}`}>
              {deleteArmed ? "Delete?" : "Delete"}
            </button>
          )}
        </div>
      </Stack>
    </ControlPanel>
  );
}

/* Doors and windows. Labels (D1, W1…) and each one's status are the model's
   (`readOpenings`), in the list's own order. */
function OpeningsPanel({ openings, read, onWall, onAdd, onUpdate, onRemove }) {
  return (
    <ControlPanel id="control-gyp-openings" title="Openings (mm)" noToggle className="form-section-card">
      <Stack gap={3} className="ctrl-list">
        {openings.map((o, i) => {
          const { label, status } = read[i] || {};
          const field = (key, text) => (
            <div className="gyp-open-field">
              <label className="gyp-open-lbl" htmlFor={`gyp-open-${o.id}-${key}`}>{text}</label>
              <input id={`gyp-open-${o.id}-${key}`} type="text" inputMode="decimal" autoComplete="off"
                className="num-input" value={o[key] ?? ""}
                aria-invalid={status === "misfit" || status === "invalid" ? true : undefined}
                onChange={e => onUpdate(o.id, key, e.target.value)} />
            </div>
          );
          return (
            <div key={o.id} className="gyp-open-row">
              <span className="gyp-open-tag">{label}</span>
              {onWall && (
                <SegGroup inline label={`${label} wall`} value={o.wall} onChange={v => onUpdate(o.id, "wall", v)}
                  options={WALLS.map(w => [w, w])} />
              )}
              <button type="button" className="num-btn ctl-ghost ctl-sm ctl-icon ctl-danger gyp-open-del"
                aria-label={`Remove ${label}`} title={`Remove ${label}`} onClick={() => onRemove(o.id)}>
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
          <button type="button" className="ctrl-dir" onClick={() => onAdd("door")}><Icon name="plus" /> Door</button>
          <button type="button" className="ctrl-dir" onClick={() => onAdd("window")}><Icon name="plus" /> Window</button>
        </Stack>
      </Stack>
    </ControlPanel>
  );
}

/* The 2D drawings or the 3D room, of the room on screen. */
function LayoutSection({ takeOff, view3d, setView3d }) {
  const drawn = takeOff.surfaces.filter(s => s.layout);
  if (!drawn.length) return null;
  return (
    <div className="section unboxed">
      <div className="section-head">
        <span>Layout</span>
        <SegGroup inline label="Layout view" value={view3d ? "3d" : "2d"} onChange={v => setView3d(v === "3d")}
          options={[["2d", "2D"], ["3d", "3D"]]} />
      </div>
      <div className="section-body">
        <Stack className="section-pad" gap={4}>
          {view3d && <GypsumRoom3D room={takeOff.room} surfaces={takeOff.surfaces} />}
          {!view3d && drawn.map(s => (
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
  );
}

/* The room's figures, every one read from the model. */
function CalculationDetails({ takeOff, room }) {
  const { area, sheets, screws, compound, tape, adhesive } = takeOff;
  const glued = takeOff.fixing === "glue";
  const isRoom = room.mode === "room";
  const fillerRate = compound.rate !== null ? ` (${compound.rate} kg/m)` : "";
  return (
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
          {adhesive && <Row label="Adhesive" value={adhesive.kg.toFixed(1)} unit="kg" />}
          {adhesive?.bagKg && <Row label={`Adhesive bags (${adhesive.bagKg} kg)`} value={adhesive.bags} unit="pcs" />}
          <Row label="Joints filled" value={compound.length.toFixed(1)} unit="m" />
          {compound.skim && <>
            <Row label={`Filler for joints${fillerRate}`} value={compound.jointKg.toFixed(1)} unit="kg" />
            <Row label={`Surface skim ${compound.skim.mm} mm (${compound.skim.area.toFixed(2)} m²)`} value={compound.skim.kg.toFixed(1)} unit="kg" />
          </>}
          <Row label={compound.skim ? "Joint filler, total" : `Joint filler${fillerRate}`} value={compound.kg.toFixed(1)} unit="kg" />
          {compound.bagKg && <Row label={`Filler bags (${compound.bagKg} kg)`} value={compound.bags} unit="pcs" />}
          <Row label="Joint tape" value={tape.total.toFixed(1)} unit="m" />

          <div className="pw-formula-wrap pw-formula-wrap--lead">
            <span className="pw-formula-text">
              Sheets are counted from the layout{takeOff.sheets.fullBoards ? ", a full board for every piece, cut or not," : ", offcuts reused,"} then waste added. Openings reduce screws; a placed one also drops any piece wholly inside it. Joint filler is per metre of joint: every board joint (each layer) plus the corners. A filler given only per 1 mm is counted as 1 mm over a 340 mm strip of joint; a surface skim covers the net area at that thickness.
            </span>
          </div>
          <div className="pw-formula-wrap">
            <span className="pw-formula-text">
              Tape covers board joints on the face layer{isRoom ? ", internal corners" : ""}{isRoom && room.ceiling ? " and the ceiling angle" : ""}.
            </span>
          </div>
          {glued && (
            <div className="pw-formula-wrap">
              <span className="pw-formula-text">
                Glued: boards stuck in dabs straight onto masonry, one layer. Adhesive covers the walls' net area; a ceiling is still screwed. An uneven wall takes more.
              </span>
            </div>
          )}
        </Stack>
      </div>
    </div>
  );
}

/* Every room, added up (buildGypsumProjectTakeOff). */
function ProjectTotals({ project, onPrint }) {
  const bagged = (g, fallback) => ({
    label: `${g.product || fallback}${g.bagKg ? ` (${g.bagKg} kg bags)` : ""}`,
    value: g.bagKg ? g.bags : g.kg.toFixed(1),
    unit: g.bagKg ? "bags" : "kg"
  });
  return (
    <div className="section unboxed">
      <div className="section-head">
        <span>All Rooms</span>
        <button type="button" className="ts-btn ctl-ghost ctl-sm" disabled={!project.ready} onClick={onPrint}
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
          {project.adhesive.map(a => <Row key={`a|${a.product}|${a.bagKg}`} {...bagged(a, "Adhesive")} />)}
          {project.filler.map(f => <Row key={`f|${f.product}|${f.bagKg}`} {...bagged(f, "Joint filler")} />)}
          <Row label="Joint tape" value={project.tape.total.toFixed(1)} unit="m" />
          {project.cost && (
            <Row label={project.cost.partial ? "Sheet cost (priced boards)" : "Sheet cost"} value={`€${eur(project.cost.total)}`} />
          )}
          {project.readyCount < project.count && (
            <p className="pw-formula-text gyp-total-note">
              {project.count - project.readyCount} of {project.count} not finished and left out of the total.
            </p>
          )}
        </Stack>
      </div>
    </div>
  );
}

/* The room's headline: sheets to buy and what they cost. The phone's bottom
   bar is this card (it is the layout-split's second child). */
function ResultCard({ takeOff, onPrint }) {
  const { sheets, ready } = takeOff;
  return (
    <div className="gyp-result-wrap">
      <div className="result-card result-card--concrete gyp-result">
        <div className="result-card-primary">
          <span className="result-card-title">Sheets Needed</span>
          <span className="result-card-value">
            {sheets.toBuy}
            <span className="result-card-unit">pcs</span>
          </span>
          <span className="result-card-note">layout: {sheets.layout} · +{sheets.waste}% waste</span>
        </div>
        <div className="result-card-split">
          <span className="result-card-title">Sheet Cost</span>
          <span className="result-card-value">
            {sheets.total !== null ? (<><span className="result-card-currency">€</span><span>{eur(sheets.total)}</span></>) : "—"}
          </span>
        </div>
        <button type="button" className="ts-btn ctl-ghost result-card-print" onClick={onPrint} disabled={!ready}
          title={ready ? "Take-off sheet — opens the print dialog, where Save as PDF is" : "Enter the surface and sheet size first"}>
          <Icon name="print" /> Take-off
        </button>
      </div>
    </div>
  );
}

// ── The page ──────────────────────────────────────────────────────────────────

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
  const [fullBoards, setFullBoards] = roomState("fullBoards");
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
  const appliedIn = lib => {
    const [active, setActive] = roomState(lib.activeKey);
    return { onApply: merge, active: active ?? null, setActive };
  };
  const board = usePresetLibrary(LIBRARIES.board, appliedIn(LIBRARIES.board));
  const filler = usePresetLibrary(LIBRARIES.filler, appliedIn(LIBRARIES.filler));
  const adhesive = usePresetLibrary(LIBRARIES.adhesive, appliedIn(LIBRARIES.adhesive));
  const libraries = [board, filler, adhesive];
  const [resetArmed, armReset, disarmReset] = useTimedState(false, 4000);
  const [deleteArmed, armDelete, disarmDelete] = useTimedState(false, 4000);

  /* Reset clears the room on screen, never the others: with a list, wiping
     every room behind one button would be the one irreversible thing here. */
  const handleReset = () => {
    if (!resetArmed) { armReset(true); return; }
    disarmReset();
    updateRoom(room.id, r => ({ ...newRoom(r.id), name: r.name }));
    setView3d(false);
  };

  // ── The list: add, duplicate, delete, switch ───────────────────────────────
  const nextId = () => rooms.reduce((m, r) => Math.max(m, r.id), 0) + 1;
  const insertRoom = (made, at = rooms.length) => {
    setRooms([...rooms.slice(0, at), made, ...rooms.slice(at)]);
    setCurrentId(made.id);
  };
  const addRoom = kind => insertRoom(roomFrom(room, nextId(), kind));
  const duplicateRoom = () => insertRoom({ ...JSON.parse(JSON.stringify(room)), id: nextId(),
    name: room.name.trim() ? `${room.name.trim()} copy` : "" }, roomIndex + 1);
  const deleteRoom = () => {
    if (rooms.length < 2) return;
    if (!deleteArmed) { armDelete(true); return; }
    disarmDelete();
    const rest = rooms.filter(r => r.id !== room.id);
    setRooms(rest);
    setCurrentId(rest[Math.min(roomIndex, rest.length - 1)].id);
  };
  const selectRoom = id => { disarmDelete(); setCurrentId(id); };

  /* A hand edit of a product field means the values are no longer the
     preset's, so its name stops showing. */
  const productChange = (lib, name) => v => { if (v !== val(name)) lib.edited(); set(name)(v); };

  // ── Derived values: all of it from the model ───────────────────────────────
  /* Every room's take-off, so the list and the project total read the same
     figures as the room's own card. Remembered per room object and preset
     lists: an edit replaces only its own room's object, so typing in one room
     does not lay every other room out again. */
  const cache = React.useRef(new WeakMap());
  const lists = [board.presets, filler.presets, adhesive.presets];
  const takeOffOf = r => {
    const hit = cache.current.get(r);
    if (hit && hit.lists.every((list, i) => list === lists[i])) return hit.takeOff;
    const takeOff = buildGypsumTakeOff({
      ...r.job, mode: r.mode, ceiling: r.ceiling, orientation: r.orientation, layers: r.layers, fixing: r.fixing, fullBoards: r.fullBoards,
      product: presetName(board.presets, r.activePreset),
      fillerProduct: presetName(filler.presets, r.activeFiller),
      adhesiveProduct: presetName(adhesive.presets, r.activeAdhesive)
    });
    cache.current.set(r, { lists, takeOff });
    return takeOff;
  };
  const entries = rooms.map((r, i) => ({ id: r.id, name: roomLabel(r, i, rooms), takeOff: takeOffOf(r) }));
  const takeOff = entries[roomIndex].takeOff;
  const roomName = entries[roomIndex].name;
  const project = rooms.length > 1 ? buildGypsumProjectTakeOff(entries) : null;
  const derivedJoint = jointFillerRate(val("compoundRate"), val("skimRate"));

  /* One document at a time: the room's sheet or the project's. Both are
     portalled to <body>, and print shows every .doc-sheet it finds. Any edit
     drops what was staged, so a sheet never prints figures since changed. */
  const [printing, setPrinting] = React.useState(null);
  React.useEffect(() => {
    if (!printing) return;
    const frame = requestAnimationFrame(() => window.print());
    return () => cancelAnimationFrame(frame);
  }, [printing]);
  React.useEffect(() => { setPrinting(null); }, [storedRooms, room.id, board.presets, filler.presets, adhesive.presets]);

  const hasAnyInput = [...DIMS[mode === "wall" ? "wall" : "room"], ...PRODUCT_FIELDS].some(name => val(name) !== "");
  const req = name => hasAnyInput && val(name) === "";
  const setOpenings = update => setJob(current => ({ ...current, openings: update(current.openings || []) }));

  const num = (name, label, extra = {}) => (
    <NumInput id={`input-gyp-${name}`} label={label} value={val(name)} min={0} onChange={set(name)} req={extra.req ?? false} {...extra} />
  );
  /* A product field outside its library's dropdown: it flashes with the
     library when a preset fills it, and a hand edit stops naming the preset. */
  const productNum = (lib, name, label, extra = {}) => (
    <div className={lib.fieldFlash ? "num-input-flash" : ""}>
      <NumInput id={`input-gyp-${name}`} label={label} value={val(name)} min={0} onChange={productChange(lib, name)} {...extra} />
    </div>
  );
  const libraryError = lib => lib.error && !lib.managing && <p role="alert" className="input-error">{lib.error}</p>;

  /* Pattern Layouts' shape: the inputs in the fixed control column, and the
     results, layout views and reference tables across the rest of the width,
     so the 2D and 3D views get the room. Inside the preview, a layout-split
     with one column keeps the result card's mobile bottom bar (the split's
     second child), which the desktop shows first instead. */
  return (
    <>
      <Stack id="data-control" className="data-control" gap={4}>
        <ProjectSection />
        <RoomsPanel rooms={rooms} entries={entries} room={room} roomIndex={roomIndex}
          onSelect={selectRoom} onRename={name => updateRoom(room.id, () => ({ name }))}
          onAdd={addRoom} onDuplicate={duplicateRoom} onDelete={deleteRoom}
          deleteArmed={deleteArmed} disarmDelete={disarmDelete} />

        {/* Keyed by the room, so switching remounts the fields: each reads the
            new room's values, and field undo cannot carry one room's typing
            into another. */}
        <React.Fragment key={room.id}>
        <ControlPanel id="control-gyp-surface" title="Surface" noToggle className="form-section-card">
          <Stack gap={3} className="ctrl-list">
            <SegGroup label="What to board" value={mode} onChange={setMode}
              options={[["room", "Room"], ["wall", "Single wall"]]} />
            <div className="pw-grid-2col">
              {mode === "room" ? <>
                {num("lenMm", "Length (mm)", { min: 1, req: req("lenMm") })}
                {num("widMm", "Width (mm)", { min: 1, req: req("widMm") })}
              </> : <>
                {num("wallW", "Width (mm)", { min: 1, req: req("wallW") })}
                {num("wallH", "Height (mm)", { min: 1, req: req("wallH") })}
              </>}
            </div>
            {mode === "room" && <>
              <SegGroup label="Ceiling" value={ceiling ? "on" : "off"} onChange={v => setCeiling(v === "on")}
                options={[["off", "Walls only"], ["on", "Walls + ceiling"]]} />
              {num("heightMm", "Wall height (mm)", { min: 1, req: req("heightMm") })}
            </>}
          </Stack>
        </ControlPanel>

        <OpeningsPanel openings={job.openings || []} read={takeOff.openings.list} onWall={mode === "room"}
          onAdd={kind => setOpenings(list => [...list, { ...NEW_OPENING[kind], id: list.reduce((m, o) => Math.max(m, o.id), 0) + 1 }])}
          onUpdate={(id, key, value) => setOpenings(list => list.map(o => (o.id === id ? { ...o, [key]: value } : o)))}
          onRemove={id => setOpenings(list => list.filter(o => o.id !== id))} />

        <ControlPanel id="control-gyp-board" title="Board" noToggle className="form-section-card"
          headerDetail={presetHeader(board)}>
          <Stack gap={3} className="ctrl-list">
            <PresetField library={board} field="sheetW" id="input-gyp-sheetW" label="Sheet width (mm)" labelIcon="arrow-h"
              value={val("sheetW")} min={100} onChange={productChange(board, "sheetW")} req={req("sheetW")} />
            <PresetField library={board} field="sheetL" id="input-gyp-sheetL" label="Sheet length (mm)" labelIcon="arrow-v"
              value={val("sheetL")} min={100} onChange={productChange(board, "sheetL")} req={req("sheetL")} />
            <SegGroup label="Fixing direction" value={orientation} onChange={setOrientation}
              options={[["V", "Vertical"], ["H", "Horizontal"]]} />
            {/* Vertical: a strip at the corner. Horizontal: each row's first piece. */}
            {num("firstOffset", "First panel offset (mm)", { max: 10000 })}
            {/* Full boards: every piece, cut or not, is a board bought. */}
            <SegGroup label="Cut pieces" value={fullBoards ? "full" : "reuse"} onChange={v => setFullBoards(v === "full")}
              options={[["reuse", "Reuse offcuts"], ["full", "Full board each"]]} />
            {/* Glued is one layer on walls; the model enforces it, so the choice
                is not offered rather than offered and ignored. */}
            <SegGroup label="Fixing method" value={fixing} onChange={setFixing}
              options={[["screw", "Screwed"], ["glue", "Glued"]]} />
            {!glued && (
              <SegGroup label="Layers" value={layers} onChange={setLayers}
                options={[["1", "1 layer"], ["2", "2 layers"]]} />
            )}
            {/* Glued walls take no screws; a boarded ceiling still does. */}
            {(!glued || (mode === "room" && ceiling)) &&
              productNum(board, "screwRate", glued ? "Ceiling screws (pcs/m²)" : "Screws (pcs/m²)")}
            <div className="pw-grid-2col">
              {productNum(board, "sheetPrice", "Sheet price (€)")}
              {num("waste", "Waste (%)", { max: 100 })}
            </div>
            <ManagePresetsButton library={board} />
          </Stack>
        </ControlPanel>
        {libraryError(board)}

        {glued && <>
          <ControlPanel id="control-gyp-adhesive" title="Adhesive" noToggle className="form-section-card"
            headerDetail={presetHeader(adhesive)}>
            <Stack gap={3} className="ctrl-list">
              <PresetField library={adhesive} field="adhesiveRate" id="input-gyp-adhesiveRate" label="Adhesive (kg/m²)"
                value={val("adhesiveRate")} onChange={productChange(adhesive, "adhesiveRate")} />
              {productNum(adhesive, "adhesiveBagKg", "Adhesive bag (kg)", { min: 0.1 })}
              <ManagePresetsButton library={adhesive} />
            </Stack>
          </ControlPanel>
          {libraryError(adhesive)}
        </>}

        <ControlPanel id="control-gyp-filler" title="Joint Filler" noToggle className="form-section-card"
          headerDetail={presetHeader(filler)}>
          <Stack gap={3} className="ctrl-list">
            <PresetField library={filler} field="compoundRate" id="input-gyp-compoundRate" label="Joint filler (kg/m of joint)"
              value={val("compoundRate")} onChange={productChange(filler, "compoundRate")} />
            <div className="pw-grid-2col">
              {productNum(filler, "skimRate", "Per 1 mm (kg/m²)")}
              {productNum(filler, "bagKg", "Filler bag (kg)", { min: 0.1 })}
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
        {libraryError(filler)}
        </React.Fragment>

        <div className="form-action">
          <button onClick={handleReset} onBlur={disarmReset}
            className={"ts-btn ctl-ghost ctl-danger" + (resetArmed ? " is-armed" : "")}
            aria-label={rooms.length > 1
              ? (resetArmed ? `Confirm reset — clears every field of ${roomName}` : `Reset ${roomName} — clears its fields, asks first`)
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
            <LayoutSection takeOff={takeOff} view3d={view3d} setView3d={setView3d} />
            <CalculationDetails takeOff={takeOff} room={room} />
            {project && <ProjectTotals project={project} onPrint={() => setPrinting({ project, entries })} />}
          </Stack>
          <ResultCard takeOff={takeOff} onPrint={() => setPrinting({ takeOff })} />
        </div>
      </div>
      {libraries.map(lib => <PresetManager key={lib.lib.id} library={lib} />)}
      <GypsumTakeOffSheet takeOff={printing?.takeOff || null} title={rooms.length > 1 ? roomName : ""} projectName={projectName} />
      <GypsumProjectSheet project={printing?.project || null} entries={printing?.entries || null} projectName={projectName} />
    </>
  );
}
