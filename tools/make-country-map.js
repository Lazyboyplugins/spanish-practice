// Rebuilds countries-map.js. Run: npm i world-atlas@2.0.2 topojson-client@3.1.0 d3-geo@3.1.1 && node tools/make-country-map.js countries-map.js
const topo = require("topojson-client"), d3 = require("d3-geo"), fs = require("fs");
const w = require("world-atlas/countries-50m.json");
const feats = topo.feature(w, w.objects.countries).features.filter(f => f.id !== "010");
const want = "724 484 840 124 826 250 380 276 620 032 170 604 152 862 192 076 156 392 036 372 218 068 858 600 320 340 222 558 188 591 214 630 300 756 528 056 643 356 504 818 792 752 578 410 710 554 616 208 246 040 352 804 348 203 642 191 376 682 364 368 586 764 704 608 360 566 404 012 388 332 084 226 408".split(" ");
const W = 2000, proj = d3.geoNaturalEarth1().fitWidth(W, { type: "Sphere" });
const H = Math.ceil(d3.geoPath(proj).bounds({ type: "Sphere" })[1][1]);
const ringsOf = geom => { const rings = []; let ring; d3.geoPath(proj, { moveTo(x, y) { ring = [[x, y]]; rings.push(ring); }, lineTo(x, y) { ring.push([x, y]); }, closePath() {}, arc() {}, beginPath() {} })(geom); return rings; };
function dp(pts, eps) {
  if (pts.length < 4) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) { const [a, b] = st.pop(); let mx = 0, mi = -1; const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1e-9;
    for (let i = a + 1; i < b; i++) { const d = Math.abs(dy * (pts[i][0] - x1) - dx * (pts[i][1] - y1)) / L; if (d > mx) { mx = d; mi = i; } }
    if (mx > eps) { keep[mi] = 1; st.push([a, mi], [mi, b]); } }
  return pts.filter((_, i) => keep[i]);
}
const areaOf = r => { let s = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length]; s += x1 * y2 - x2 * y1; } return Math.abs(s / 2); };
function enc(rings, eps, dec, minA) {
  const k = 10 ** dec; let out = "";
  for (const r0 of rings) {
    if (areaOf(r0) < minA) continue;
    const r = dp(r0, eps); if (r.length < 4) { if (r0.length >= 4 && areaOf(r0) >= minA) { /* keep a tiny island as a little triangle */ } else continue; }
    const rr = r.length >= 4 ? r : r0;
    let px = Math.round(rr[0][0] * k), py = Math.round(rr[0][1] * k), parts = [];
    for (let i = 1; i < rr.length; i++) { const x = Math.round(rr[i][0] * k), y = Math.round(rr[i][1] * k); if (x === px && y === py) continue; parts.push(`${(x - px) / k} ${(y - py) / k}`); px = x; py = y; }
    if (parts.length < 2) continue;
    out += `M${Math.round(rr[0][0] * k) / k} ${Math.round(rr[0][1] * k) / k}l` + parts.join(" ").replace(/ -/g, "-") + "z";
  }
  return out;
}
const bbox = rs => { let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9; for (const r of rs) for (const [x, y] of r) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } return [x0, y0, x1, y1]; };
const cen = r => { let a = 0, cx = 0, cy = 0; for (let i = 0; i < r.length; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % r.length], f = x1 * y2 - x2 * y1; a += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f; } return [cx / (3 * a), cy / (3 * a)]; };
const out = { W, H, c: {}, rest: "" }, used = new Set(), r1 = v => Math.round(v * 10) / 10;
for (const id of want) {
  const f = feats.filter(f => f.id === id).sort((a, b) => d3.geoPath(proj).area(b) - d3.geoPath(proj).area(a))[0]; used.add(f);
  const rings = ringsOf(f.geometry).map(r => ({ r, a: areaOf(r), b: bbox([r]) })).sort((a, b) => b.a - a.a), big = rings[0];
  const s = Math.max(big.b[2] - big.b[0], big.b[3] - big.b[1]);
  const near = q => { const dx = Math.max(0, q.b[0] - big.b[2], big.b[0] - q.b[2]), dy = Math.max(0, q.b[1] - big.b[3], big.b[1] - q.b[3]); return dx < s * 0.12 && dy < s * 0.12; };
  const main = rings.filter(q => q === big || (q.a > big.a * 0.003 && near(q) && !(id === "840" && q.b[3] < big.b[1] + 10)));
  const bb = bbox(main.map(q => q.r)), size = Math.max(bb[2] - bb[0], bb[3] - bb[1]);
  const epsShape = Math.max(0.02, size / 260), epsMap = Math.max(0.15, Math.min(0.9, size / 90));
  out.c[id] = { d: enc(rings.map(q => q.r), epsMap, size > 150 ? 0 : 1, epsMap * epsMap), s: enc(main.map(q => q.r), epsShape, size < 30 ? 2 : 1, 0), b: bb.map(r1), c: cen(big.r).map(r1) };
}
let rest = ""; for (const f of feats) if (!used.has(f)) rest += enc(ringsOf(f.geometry), 0.9, 0, 3);
out.rest = rest;
const R = { eu: [-25, 34, 45, 71], na: [-170, 13, -50, 75], ca: [-118, 6, -59, 33], sa: [-85, -56, -33, 13], af: [-20, -36, 62, 40], as: [25, -11, 150, 60], oc: [94, -48, 180, 9] };
out.R = {};
for (const [k, [x0, y0, x1, y1]] of Object.entries(R)) {
  const pts = []; for (let i = 0; i <= 20; i++) { const x = x0 + (x1 - x0) * i / 20, y = y0 + (y1 - y0) * i / 20; pts.push(proj([x, y0]), proj([x, y1]), proj([x0, y]), proj([x1, y])); }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  out.R[k] = [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)].map(v => Math.round(v));
}
const js = "/* Country shapes for the Countries tab. Map data: Natural Earth (public domain), via the world-atlas package (ISC licence). Natural Earth projection, simplified. Made by tools/ (see README). */\nwindow.CO_MAP=" + JSON.stringify(out) + ";\nif(window.onCoMap)window.onCoMap();\n";
fs.writeFileSync(process.argv[2] || "countries-map.js", js);
console.log("bytes", js.length, "rest", rest.length, "shapes", Object.values(out.c).reduce((a, c) => a + c.s.length, 0), "maps", Object.values(out.c).reduce((a, c) => a + c.d.length, 0));
