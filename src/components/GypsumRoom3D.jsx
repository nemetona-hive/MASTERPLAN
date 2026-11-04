import { React } from "../react-globals.js";

/*
 * The gypsum room in 3D, with CSS transforms and no 3D library.
 *
 * Each boarded surface is a flat panel folded into place around the room's
 * centre. Every panel faces INTO the room, because that is the side the board
 * is on, and `backface-visibility: hidden` drops any panel facing away from
 * the viewer. So the near walls vanish and you look into the room. Nothing
 * decides which wall to hide.
 *
 * The ceiling is the exception: it is drawn LIFTED above the room and seen
 * from either side, an exploded view. A camera below the floor looking up was
 * tried and reads as a box seen from outside, because that is how eyes read a
 * shape from below. From above, the lid shows the layout as a reflected
 * ceiling plan does: in the same orientation as the floor plan.
 *
 * The panels draw the model's own `layout.pieces`, in the same classes as the
 * 2D diagram, so the three pictures of one job (2D, 3D, paper) cannot
 * disagree.
 */

/* The room is scaled so its bounding sphere fills a little under half of the
   stage's shorter side. The stage measures itself; this is the size before it
   has, and in jsdom, which has no layout. */
const STAGE = 300;
const VIEWS = { above: -32, level: -8 };
/* How far the ceiling floats above the walls, as a share of the height. */
const LIFT = 0.55;
const DEFAULT_YAW = -35;
const clampPitch = v => Math.max(-85, Math.min(85, v));

/**
 * Where each panel goes. Returns faces in px with a CSS transform; pure, so it
 * is tested without a browser.
 *
 * CSS y points down, so the ceiling is at −H/2. A panel starts facing +z
 * (towards the viewer); each transform translates it out along its normal and
 * rotates it to its wall. Read right to left: translate first, then rotate.
 */
export function roomFaces(room, surfaces, stage = STAGE) {
  if (!room) return { faces: [], scale: 0 };
  const { length: L, width: W, height: H, ceiling } = room;
  const lift = ceiling ? H * LIFT : 0;
  const radius = Math.hypot(L, W, H + lift) / 2 || 1;
  const s = (stage * 0.45) / radius;
  const drawn = surfaces.filter(x => x.layout);
  /* Each wall finds its own drawing by letter: walls with different openings
     are different surfaces even when they are the same size. */
  const wall = letter => drawn.find(x => x.walls && x.walls.includes(letter));
  const ceilingSurface = drawn.find(x => x.id === "ceiling");

  /* With a lid the whole model is taller than the room, so everything drops by
     half the lift: the view turns around the middle of what is drawn. */
  const centre = lift ? `translateY(${lift / 2 * s}px) ` : "";
  const face = (id, surface, w, h, transform, tag = null) => ({ id, surface, w: w * s, h: h * s, transform: centre + transform, tag });
  if (W === 0) {
    const only = wall("A");
    return { scale: s, faces: only ? [face("wall", only, L, H, "translateZ(0px)")] : [] };
  }
  const faces = [
    /* A is the back wall and the letters go clockwise seen from above, the
       order the model names them in. Each panel's left edge is its wall's
       left end as seen from inside, which is where an opening's `x` runs
       from — a panel is only ever seen from inside, so it is never mirrored. */
    face("back", wall("A"), L, H, `translateZ(${-W / 2 * s}px)`, "A"),
    face("right", wall("B"), W, H, `rotateY(-90deg) translateZ(${-L / 2 * s}px)`, "B"),
    face("front", wall("C"), L, H, `rotateY(180deg) translateZ(${-W / 2 * s}px)`, "C"),
    face("left", wall("D"), W, H, `rotateY(90deg) translateZ(${-L / 2 * s}px)`, "D"),
    /* Not boarded: drawn as an outline so the room has somewhere to stand. */
    face("floor", null, L, W, `rotateX(90deg) translateZ(${-H / 2 * s}px)`)
  ];
  if (ceiling && ceilingSurface) {
    faces.push(face("ceiling", ceilingSurface, L, W, `rotateX(-90deg) translateZ(${-(H / 2 + lift) * s}px)`));
  }
  return { scale: s, faces: faces.filter(f => f.id === "floor" || f.surface) };
}

function Panel({ face }) {
  const { surface } = face;
  return (
    <div className={`gyp3d-face gyp3d-face--${face.id}`}
      style={{ width: face.w, height: face.h, marginLeft: -face.w / 2, marginTop: -face.h / 2, transform: face.transform }}>
      {surface && (
        <svg viewBox={`0 0 ${surface.width} ${surface.height}`} preserveAspectRatio="none" aria-hidden="true" className="gyp3d-svg">
          {surface.layout.pieces.map((p, i) => (
            <rect key={i} x={p.x} y={p.y} width={p.w} height={p.h}
              className={`layout-svg-seg ${p.type === "full" ? "color-s1" : "color-cut"}`} />
          ))}
          {(surface.openings || []).map(o => (
            <rect key={o.label} x={o.x} y={o.y} width={o.w} height={o.h} className="layout-svg-opening" />
          ))}
        </svg>
      )}
      {face.tag && <span className="gyp3d-face-tag" aria-hidden="true">{face.tag}</span>}
    </div>
  );
}

export function GypsumRoom3D({ room, surfaces }) {
  const [pitch, setPitch] = React.useState(VIEWS.above);
  const [yaw, setYaw] = React.useState(DEFAULT_YAW);
  /* Eased only when a button sets the view; a drag or a key follows at once. */
  const [animate, setAnimate] = React.useState(false);
  const drag = React.useRef(null);
  const stageRef = React.useRef(null);
  const [stage, setStage] = React.useState(STAGE);
  const { faces } = roomFaces(room, surfaces, stage);
  const shown = faces.length > 0;
  React.useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const side = Math.min(entry.contentRect.width, entry.contentRect.height);
      if (side > 0) setStage(Math.round(side));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);
  if (!shown) return null;

  const onPointerDown = e => {
    drag.current = { x: e.clientX, y: e.clientY, pitch, yaw };
    setAnimate(false);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = e => {
    if (!drag.current) return;
    setYaw(drag.current.yaw + (e.clientX - drag.current.x) * 0.4);
    setPitch(clampPitch(drag.current.pitch - (e.clientY - drag.current.y) * 0.4));
  };
  const endDrag = () => { drag.current = null; };
  const onKeyDown = e => {
    const step = { ArrowLeft: [0, -10], ArrowRight: [0, 10], ArrowUp: [-10, 0], ArrowDown: [10, 0] }[e.key];
    if (!step) return;
    e.preventDefault();
    setAnimate(false);
    setPitch(p => clampPitch(p + step[0]));
    setYaw(y => y + step[1]);
  };

  const view = Object.entries(VIEWS).find(([, v]) => v === pitch)?.[0];
  const { length: L, width: W, height: H } = room;
  const label = W
    ? `Room in 3D, ${L} by ${W} mm, ${H} mm high. Arrow keys turn it.`
    : `Wall in 3D, ${L} by ${H} mm. Arrow keys turn it.`;

  return (
    <div className="gyp3d">
      {/* Perspective in step with the size, so a bigger stage is the same
          view enlarged rather than a flatter one. */}
      <div ref={stageRef} className="gyp3d-stage" tabIndex={0} role="img" aria-label={label}
        style={{ perspective: `${stage * 3}px` }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove}
        onPointerUp={endDrag} onPointerCancel={endDrag} onKeyDown={onKeyDown}>
        <div className={"gyp3d-scene" + (animate ? " is-animated" : "")}
          style={{ transform: `rotateX(${pitch}deg) rotateY(${yaw}deg)` }}>
          {faces.map(f => <Panel key={f.id} face={f} />)}
        </div>
      </div>
      <div className="gyp3d-controls">
        <div className="seg-group seg-group--inline" role="group" aria-label="View from">
          {[["above", "Above"], ["level", "Level"]].map(([id, text]) => (
            <button key={id} type="button" className={"ctrl-dir" + (view === id ? " on" : "")} aria-pressed={view === id}
              onClick={() => { setAnimate(true); setPitch(VIEWS[id]); }}>{text}</button>
          ))}
        </div>
        <button type="button" className="ts-btn ctl-ghost" onClick={() => { setAnimate(true); setPitch(VIEWS.above); setYaw(DEFAULT_YAW); }}>
          Reset
        </button>
      </div>
    </div>
  );
}
