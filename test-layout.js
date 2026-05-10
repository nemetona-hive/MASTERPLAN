const isV = false;
const surfaceW = 5600;
const surfaceH = 2500;
const PPi = 2500; // panel width? wait, I said PPi=2500, PLa=1250
const PLa = 1250;

const result = {
  meta: { surfaceW, surfaceH, PPi, PLa, direction: "H" },
  rows: [
    { h: 1250, segs: [{x: 0, w: 2500}, {x: 2500, w: 2500}, {x: 5000, w: 600}] },
    { h: 1250, segs: [{x: 0, w: 1900}, {x: 1900, w: 2500}, {x: 4400, w: 1200}] }
  ]
};

const rowStart = "bottom";

const stdRowH = isV ? PPi : PLa;
  
const orderedRows = rowStart === "bottom"
  ? result.rows.map((row, idx) => ({ row, idx })).reverse()
  : result.rows.map((row, idx) => ({ row, idx }));

let physicalCursor = 0;
let visualCursor = 0;
const rects = [];

orderedRows.forEach(({ row, idx }) => {
  const rowSize = Number.isFinite(row.h) && row.h > 0 ? row.h : 1;
  const visualRowSize = !isV ? stdRowH : rowSize; // Only horizontal gets uniform lanes

  row.segs.forEach((seg, segIndex) => {
    const rect = {};
    if (isV) {
      // ...
    } else {
      rect.x = seg.x;
      rect.y = visualCursor + (visualRowSize - rowSize); 
      rect.w = seg.w;
      rect.h = rowSize; 
    }
    rects.push(rect);
  });

  physicalCursor += rowSize;
  visualCursor += visualRowSize;
});

const yOffset = (!isV && visualCursor < surfaceH) ? (surfaceH - visualCursor) : 0;
if (yOffset > 0) {
  rects.forEach(r => r.y += yOffset);
}

console.log("vH:", surfaceH);
console.log("visualCursor:", visualCursor);
console.log("rects:", rects);
