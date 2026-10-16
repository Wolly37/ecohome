// EcoHome steel-frame cutaway. Builds a two-storey light gauge steel (LGS)
// house procedurally and lets the visitor slice the finished cladding away
// in real time to reveal the frame. Mounts into every [data-eh-frame] element.
import * as THREE from './three.module.min.js';
import { OrbitControls } from './OrbitControls.js';

const STEEL = 0xC3C8CC, STEEL_DARK = 0x9EA4A9;
const BRICK = 0xA6613F, RENDER = 0xEFE9DC, SLATE = 0x3A4046, GLASS = 0x1F3240, OAK = 0xB07A3C, SLAB = 0xB9B6AE, FLOOR = 0xD9CDBA;

const W = 10, D = 8, H1 = 2.7, FLOOR_T = 0.3, H2 = 2.6, PITCH = 32 * Math.PI / 180;
const STUD = 0.09, FLANGE = 0.04, SPACING = 0.6;
const EAVE = H1 + FLOOR_T + H2;
const RIDGE = EAVE + (D / 2) * Math.tan(PITCH);

// openings per wall: { wall:'front'|'back'|'left'|'right', x:center along wall, w, y:bottom, h }
const OPENINGS = [
  { wall: 'front', x: -3.2, w: 1.8, y: 0.9, h: 1.5 }, { wall: 'front', x: 0, w: 1.1, y: 0, h: 2.1, door: true }, { wall: 'front', x: 3.2, w: 1.8, y: 0.9, h: 1.5 },
  { wall: 'front', x: -3.2, w: 1.6, y: H1 + FLOOR_T + 0.9, h: 1.4 }, { wall: 'front', x: 0.3, w: 1.2, y: H1 + FLOOR_T + 0.9, h: 1.4 }, { wall: 'front', x: 3.2, w: 1.6, y: H1 + FLOOR_T + 0.9, h: 1.4 },
  { wall: 'back', x: -2.6, w: 2.4, y: 0.1, h: 2.2 }, { wall: 'back', x: 2.4, w: 1.8, y: 0.9, h: 1.5 },
  { wall: 'back', x: -2.6, w: 1.6, y: H1 + FLOOR_T + 0.9, h: 1.4 }, { wall: 'back', x: 2.4, w: 1.6, y: H1 + FLOOR_T + 0.9, h: 1.4 },
  { wall: 'left', x: 1.5, w: 1.4, y: 0.9, h: 1.5 }, { wall: 'left', x: -1.5, w: 1.2, y: H1 + FLOOR_T + 0.9, h: 1.4 },
  { wall: 'right', x: -1.8, w: 1.4, y: 0.9, h: 1.5 }, { wall: 'right', x: 1.6, w: 1.2, y: H1 + FLOOR_T + 0.9, h: 1.4 }
];

function wallFrame(len, height, y0, openings, steelMat) {
  // Frame for one wall, built along local x from -len/2..len/2, studs vertical, in the x/y plane.
  const g = new THREE.Group();
  const box = (w, h, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), steelMat); m.position.set(x, y, z); g.add(m); return m; };
  // bottom and top tracks
  box(len, FLANGE, STUD, 0, y0 + FLANGE / 2, 0);
  box(len, FLANGE, STUD, 0, y0 + height - FLANGE / 2, 0);
  const inOpening = (x, y) => openings.find(o => x > o.x - o.w / 2 - 0.02 && x < o.x + o.w / 2 + 0.02 && y > o.y - 0.001 && y < o.y + o.h + 0.001);
  const n = Math.round(len / SPACING);
  for (let i = 0; i <= n; i++) {
    const x = -len / 2 + Math.min(i * SPACING, len);
    const op = inOpening(x, y0 + height / 2) || inOpening(x, y0 + 0.5) || inOpening(x, y0 + height - 0.4);
    if (!op) { box(FLANGE, height - 2 * FLANGE, STUD, x, y0 + height / 2, 0); continue; }
    // cripple studs above and below the opening
    const below = op.y - y0 - FLANGE; if (below > 0.1) box(FLANGE, below, STUD, x, y0 + FLANGE + below / 2, 0);
    const above = y0 + height - FLANGE - (op.y + op.h); if (above > 0.1) box(FLANGE, above, STUD, x, op.y + op.h + above / 2, 0);
  }
  // noggins
  for (let i = 0; i < n; i++) { const x = -len / 2 + i * SPACING + SPACING / 2; if (!inOpening(x, y0 + height / 2)) box(SPACING - FLANGE, FLANGE, STUD * 0.8, x, y0 + height / 2, 0); }
  // king studs, headers and sills
  for (const o of openings) {
    box(FLANGE * 1.4, o.h + 0.2, STUD, o.x - o.w / 2 - FLANGE, o.y + o.h / 2, 0);
    box(FLANGE * 1.4, o.h + 0.2, STUD, o.x + o.w / 2 + FLANGE, o.y + o.h / 2, 0);
    box(o.w + FLANGE * 4, 0.12, STUD, o.x, o.y + o.h + 0.06, 0);
    if (o.y > y0 + 0.05) box(o.w + FLANGE * 4, FLANGE, STUD, o.x, o.y - FLANGE / 2, 0);
  }
  return g;
}

function wallSkin(len, height, y0, openings, mat, glassMat, doorMat, frameMat) {
  // Solid wall panel with openings punched out, plus glazing / door panels.
  const shape = new THREE.Shape();
  shape.moveTo(-len / 2, y0); shape.lineTo(len / 2, y0); shape.lineTo(len / 2, y0 + height); shape.lineTo(-len / 2, y0 + height); shape.closePath();
  for (const o of openings) { const p = new THREE.Path(); p.moveTo(o.x - o.w / 2, o.y); p.lineTo(o.x + o.w / 2, o.y); p.lineTo(o.x + o.w / 2, o.y + o.h); p.lineTo(o.x - o.w / 2, o.y + o.h); p.closePath(); shape.holes.push(p); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.1, bevelEnabled: false });
  const g = new THREE.Group();
  const m = new THREE.Mesh(geo, mat); m.position.z = STUD / 2 + 0.01; g.add(m);
  for (const o of openings) {
    const pane = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.06, o.h - 0.06, 0.03), o.door ? doorMat : glassMat);
    pane.position.set(o.x, o.y + o.h / 2, 0); g.add(pane);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(o.w + 0.08, o.h + 0.08, 0.05), frameMat);
    frame.position.set(o.x, o.y + o.h / 2, -0.02); g.add(frame); // reveal frame behind pane
    const inner = new THREE.Mesh(new THREE.BoxGeometry(o.w - 0.02, o.h - 0.02, 0.06), o.door ? doorMat : glassMat); inner.position.set(o.x, o.y + o.h / 2, -0.02); g.add(inner);
  }
  return g;
}

function buildHouse(reveal) {
  const house = new THREE.Group();
  const steel = new THREE.MeshStandardMaterial({ color: STEEL, metalness: .75, roughness: .35 });
  const steelDark = new THREE.MeshStandardMaterial({ color: STEEL_DARK, metalness: .75, roughness: .4 });
  const skinMats = [];
  const clipMat = (opts) => { const m = new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide }, opts)); skinMats.push(m); return m; };
  const brick = clipMat({ color: BRICK, roughness: .9 });
  const render = clipMat({ color: RENDER, roughness: .85 });
  const slate = clipMat({ color: SLATE, roughness: .7, metalness: .05 });
  const glass = clipMat({ color: GLASS, roughness: .15, metalness: .4 });
  const oak = clipMat({ color: OAK, roughness: .6 });
  const floorMat = clipMat({ color: FLOOR, roughness: .9 });
  const winFrame = clipMat({ color: 0x1B2024, roughness: .7 });
  const slabMat = new THREE.MeshStandardMaterial({ color: SLAB, roughness: .95 });

  // slab
  const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.6, 0.18, D + 0.6), slabMat); slab.position.y = -0.09; house.add(slab);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(11, 11, 0.02, 64), new THREE.MeshStandardMaterial({ color: 0x22341F, roughness: 1 })); ring.position.y = -0.19; house.add(ring);

  const walls = [
    { name: 'front', len: W, pos: [0, 0, D / 2], rot: 0 },
    { name: 'back', len: W, pos: [0, 0, -D / 2], rot: Math.PI },
    { name: 'left', len: D, pos: [-W / 2, 0, 0], rot: -Math.PI / 2 },
    { name: 'right', len: D, pos: [W / 2, 0, 0], rot: Math.PI / 2 }
  ];
  const frameGroup = new THREE.Group(), skinGroup = new THREE.Group();
  for (const w of walls) {
    const ops = OPENINGS.filter(o => o.wall === w.name);
    const ops1 = ops.filter(o => o.y < H1), ops2 = ops.filter(o => o.y >= H1).map(o => Object.assign({}, o));
    const f1 = wallFrame(w.len, H1, 0, ops1, steel), f2 = wallFrame(w.len, H2, H1 + FLOOR_T, ops2, steel);
    const s1 = wallSkin(w.len, H1 + FLOOR_T, 0, ops1, brick, glass, oak, winFrame), s2 = wallSkin(w.len, H2, H1 + FLOOR_T, ops2, render, glass, oak, winFrame);
    for (const g of [f1, f2, s1, s2]) { g.position.set(...w.pos); g.rotation.y = w.rot; }
    frameGroup.add(f1, f2); skinGroup.add(s1, s2);
  }
  // first floor joists (C sections along z at 400 centres), rim tracks and floor deck
  const joists = new THREE.Group();
  for (let x = -W / 2 + 0.2; x <= W / 2 - 0.19; x += 0.4) { const j = new THREE.Mesh(new THREE.BoxGeometry(FLANGE, FLOOR_T - 0.06, D - 0.2), steelDark); j.position.set(x, H1 + FLOOR_T / 2, 0); joists.add(j); }
  for (const z of [-D / 2 + 0.08, D / 2 - 0.08]) { const t = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, FLOOR_T - 0.06, FLANGE), steel); t.position.set(0, H1 + FLOOR_T / 2, z); joists.add(t); }
  frameGroup.add(joists);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.04, D - 0.2), floorMat); deck.position.y = H1 + FLOOR_T - 0.02; skinGroup.add(deck);
  const gfloor = new THREE.Mesh(new THREE.BoxGeometry(W - 0.2, 0.04, D - 0.2), floorMat); gfloor.position.y = 0.02; skinGroup.add(gfloor);

  // roof trusses (gable along x), ridge, purlins
  const trusses = new THREE.Group();
  const rafterLen = (D / 2) / Math.cos(PITCH) + 0.5;
  const mkRafter = (x, side) => { const r = new THREE.Mesh(new THREE.BoxGeometry(FLANGE, STUD, rafterLen), steel); r.position.set(x, (EAVE + RIDGE) / 2 + 0.05, side * D / 4); r.rotation.x = side * PITCH; trusses.add(r); };
  for (let x = -W / 2; x <= W / 2 + 0.01; x += SPACING) {
    mkRafter(x, 1); mkRafter(x, -1);
    const chord = new THREE.Mesh(new THREE.BoxGeometry(FLANGE, STUD, D + 0.2), steel); chord.position.set(x, EAVE + STUD / 2, 0); trusses.add(chord);
    const king = new THREE.Mesh(new THREE.BoxGeometry(FLANGE, RIDGE - EAVE - 0.1, STUD * 0.8), steelDark); king.position.set(x, (EAVE + RIDGE) / 2, 0); trusses.add(king);
    for (const s of [-1, 1]) { const strut = new THREE.Mesh(new THREE.BoxGeometry(FLANGE, STUD * 0.8, 2.3), steelDark); strut.position.set(x, EAVE + 0.75, s * D / 4 * 0.9); strut.rotation.x = -s * 0.65; trusses.add(strut); }
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, STUD, FLANGE * 1.5), steel); ridge.position.set(0, RIDGE, 0); trusses.add(ridge);
  for (const s of [-1, 1]) for (const t of [0.3, 0.6]) { const p = new THREE.Mesh(new THREE.BoxGeometry(W + 0.2, FLANGE, STUD), steel); p.position.set(0, EAVE + (RIDGE - EAVE) * t + 0.1, s * (D / 2) * (1 - t)); p.rotation.x = s * PITCH; trusses.add(p); }
  frameGroup.add(trusses);
  // roof skin
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(W + 0.5, 0.06, rafterLen + 0.1), slate);
    panel.position.set(0, (EAVE + RIDGE) / 2 + 0.16, s * D / 4 * 1.02); panel.rotation.x = s * PITCH; skinGroup.add(panel);
    const gable = new THREE.Mesh(new THREE.ShapeGeometry((() => { const sh = new THREE.Shape(); sh.moveTo(-D / 2, EAVE); sh.lineTo(D / 2, EAVE); sh.lineTo(0, RIDGE); sh.closePath(); return sh; })()), render);
    gable.position.set(s * (W / 2 + 0.06), 0, 0); gable.rotation.y = s * Math.PI / 2; skinGroup.add(gable);
  }
  // chimney
  const chim = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.6), brick); chim.position.set(3.4, RIDGE - 0.1, -1.2); skinGroup.add(chim);
  house.add(frameGroup, skinGroup);
  return { house, skinMats, frameGroup, skinGroup };
}

function mount(root) {
  if (root.__ehFrame) return;
  root.__ehFrame = true;
  root.innerHTML = '';
  const host = document.createElement('div'); host.style.cssText = 'position:absolute;inset:0;touch-action:none'; root.appendChild(host);
  const ui = document.createElement('div');
  ui.style.cssText = "position:absolute;left:14px;right:14px;bottom:14px;display:flex;flex-direction:column;gap:10px;pointer-events:none";
  ui.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;font-family:'JetBrains Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:rgba(201,215,195,.85)">
      <span>Cut through the house</span>
      <span style="display:flex;gap:6px;pointer-events:auto">
        <button data-axis="x" style="font:inherit;letter-spacing:.12em;padding:6px 10px;border:1px solid rgba(201,215,195,.4);background:#4A6741;color:#fff;cursor:pointer">Side</button>
        <button data-axis="z" style="font:inherit;letter-spacing:.12em;padding:6px 10px;border:1px solid rgba(201,215,195,.4);background:transparent;color:#C9D7C3;cursor:pointer">Front</button>
        <button data-axis="y" style="font:inherit;letter-spacing:.12em;padding:6px 10px;border:1px solid rgba(201,215,195,.4);background:transparent;color:#C9D7C3;cursor:pointer">Top</button>
      </span>
    </div>
    <input type="range" min="0" max="1000" value="380" aria-label="Cutaway position" style="width:100%;pointer-events:auto;accent-color:#A9C09E;cursor:ew-resize;height:22px">`;
  root.appendChild(ui);
  const slider = ui.querySelector('input');
  const buttons = Array.from(ui.querySelectorAll('button'));

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block';

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  camera.position.set(14, 9, 15);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 3.2, 0); controls.enableDamping = true; controls.dampingFactor = .08;
  controls.minDistance = 9; controls.maxDistance = 34; controls.maxPolarAngle = Math.PI / 2 - 0.04; controls.minPolarAngle = 0.25;
  controls.enablePan = false; controls.autoRotate = true; controls.autoRotateSpeed = 0.55;
  controls.addEventListener('start', () => { controls.autoRotate = false; });

  scene.add(new THREE.HemisphereLight(0xFFF7EA, 0x2C3F2A, 1.1));
  const sun = new THREE.DirectionalLight(0xFFF1DC, 2.2); sun.position.set(12, 18, 8); scene.add(sun);
  const fill = new THREE.DirectionalLight(0xC9D7C3, 0.6); fill.position.set(-10, 6, -12); scene.add(fill);

  const { house, skinMats } = buildHouse();
  house.position.y = 0; scene.add(house);

  // clipping plane: skin only
  const plane = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  for (const m of skinMats) { m.clippingPlanes = [plane]; m.clipShadows = true; }
  let axis = 'x'; let t = 0.38; let userTouched = false; let dir = 1;
  const ranges = { x: [-W / 2 - 0.5, W / 2 + 0.5], z: [-D / 2 - 0.5, D / 2 + 0.5], y: [-0.3, RIDGE + 0.3] };
  function applyCut() {
    const [a, b] = ranges[axis];
    const v = a + (b - a) * t;
    if (axis === 'x') { plane.normal.set(-1, 0, 0); plane.constant = v; }        // keep x < v
    else if (axis === 'z') { plane.normal.set(0, 0, -1); plane.constant = v; }   // keep z < v
    else { plane.normal.set(0, -1, 0); plane.constant = v; }                     // keep y < v (top cut)
  }
  slider.addEventListener('input', () => { t = slider.value / 1000; userTouched = true; applyCut(); });
  buttons.forEach(b => b.addEventListener('click', () => {
    axis = b.dataset.axis; userTouched = true;
    buttons.forEach(o => { o.style.background = o === b ? '#4A6741' : 'transparent'; o.style.color = o === b ? '#fff' : '#C9D7C3'; });
    t = axis === 'y' ? 0.62 : 0.45; slider.value = String(Math.round(t * 1000)); applyCut();
  }));
  applyCut();

  function resize() {
    const w = host.clientWidth || 600, h = host.clientHeight || 500;
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  const ro = new ResizeObserver(resize); ro.observe(host);

  let visible = true, raf = 0, last = performance.now();
  const io = new IntersectionObserver(en => { visible = en[0].isIntersecting; if (visible && !raf) loop(); }, { threshold: 0.05 });
  io.observe(root);
  const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) controls.autoRotate = false;
  function loop() {
    if (!visible || !root.isConnected) { raf = 0; return; }
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!userTouched && !reduced) { // slow sweep until the visitor takes over
      t += dir * dt * 0.09; if (t > 0.9) { t = 0.9; dir = -1; } if (t < 0.2) { t = 0.2; dir = 1; }
      slider.value = String(Math.round(t * 1000)); applyCut();
    }
    controls.update(); renderer.render(scene, camera);
  }
  loop();
  const mo = new MutationObserver(() => { if (!root.isConnected) { mo.disconnect(); io.disconnect(); ro.disconnect(); cancelAnimationFrame(raf); renderer.dispose(); controls.dispose(); } });
  mo.observe(document.body, { childList: true, subtree: true });
}

function scan() { document.querySelectorAll('[data-eh-frame]').forEach(mount); }
scan();
new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
