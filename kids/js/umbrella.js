// 진숲 어린이 마을 — 우산 (주민이 손에 들고 쓰는 우산 모양)
// 우산 무늬는 옷장의 '우산' 칸에서 고르고(js/face.js PARTS.umbrella), 색은 umbrellaColor(옷 색 팔레트)다.
// 모양: 살이 여덟 개인 둥근 지붕, 가는 대, 아래쪽 손잡이. 손잡이 잡는 곳이 (0, 0, 0)이고 대는 +y로 len만큼 올라간다.
import * as THREE from './three.module.min.js';
import { toon, toonGradient } from './avatar.js';
import { mergeColored, mergeStatic } from './merge.js';

const TAU = Math.PI * 2;
const PANELS = 8;
export const UMB_R = 1.12; // 우산 지붕 반지름
const RAINBOW = ['#EF6461', '#F49A4C', '#F6D55C', '#7FCB5B', '#6FD3C0', '#4D7DDB', '#A07FE3', '#F6A2C4'];
// 지붕 옆모습 (가장자리 → 꼭대기). 살 사이 여덟 조각을 이것을 돌려서 만든다
const PROFILE = [[1, 0], [0.93, 0.13], [0.78, 0.25], [0.55, 0.34], [0.28, 0.39], [0, 0.4]];
let VC2 = null, VC1 = null;
function vcMats() {
  if (!VC2) {
    VC2 = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient(), side: THREE.DoubleSide });
    VC1 = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: toonGradient() });
  }
  return [VC2, VC1];
}
const clearMat = () => toon('#DDF2FF', { transparent: true, opacity: 0.5, side: THREE.DoubleSide });

// design: solid(한 가지 색), stripe(줄무늬), dots(물방울), rainbow(무지개), clear(투명), frog(개구리)
export function makeUmbrella(design, color, len = 1.6) {
  const [vc2, vc1] = vcMats();
  const g = new THREE.Group();
  const top = new THREE.Group(); // 지붕 (안쪽도 보이게 양면)
  top.position.y = len;
  const pts = PROFILE.map(([r, y]) => new THREE.Vector2(r * UMB_R, y * UMB_R));
  const clear = design === 'clear';
  const base = design === 'frog' ? '#5DBE48' : color;
  for (let i = 0; i < PANELS; i++) {
    const c = design === 'rainbow' ? RAINBOW[i] : design === 'stripe' && i % 2 ? '#FFFDF7' : base;
    const geo = new THREE.LatheGeometry(pts, 1, (i / PANELS) * TAU, TAU / PANELS);
    top.add(new THREE.Mesh(geo, clear ? clearMat() : toon(c, { side: THREE.DoubleSide })));
  }
  if (design === 'dots') { // 조각마다 하얀 물방울 두 개
    const disc = new THREE.CylinderGeometry(0.085, 0.085, 0.012, 14);
    const wm = toon('#FFFDF7', { side: THREE.DoubleSide });
    for (let i = 0; i < PANELS; i++) {
      for (const [k, t] of [[0.25, 2], [0.75, 4]]) { // 조각 안 자리(각도 비율), 옆모습 점 번호
        const a = ((i + k) / PANELS) * TAU;
        const [r0, y0] = PROFILE[t - 1], [r1, y1] = PROFILE[t];
        const r = (r0 + r1) / 2 * UMB_R * Math.cos(Math.PI / PANELS), y = (y0 + y1) / 2 * UMB_R;
        const nr = (y1 - y0), ny = -(r1 - r0); // 바깥쪽 수직
        const n = new THREE.Vector3(Math.sin(a) * nr, ny, Math.cos(a) * nr).normalize();
        const d = new THREE.Mesh(disc, wm);
        d.position.set(Math.sin(a) * r, y, Math.cos(a) * r).addScaledVector(n, 0.012);
        d.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
        top.add(d);
      }
    }
  }
  // 살 끝 (가장자리 여덟 군데)과 꼭지
  const tipC = toon(clear ? '#8FA9BD' : '#5A4A42');
  for (let i = 0; i < PANELS; i++) {
    const a = (i / PANELS) * TAU;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), tipC);
    m.position.set(Math.sin(a) * UMB_R, 0, Math.cos(a) * UMB_R);
    top.add(m);
  }
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.14, 8), tipC);
  knob.position.y = PROFILE[PROFILE.length - 1][1] * UMB_R + 0.06;
  top.add(knob);
  if (design === 'frog') { // 개구리 눈 두 개 (앞쪽 꼭대기 가까이)
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), toon('#FFFFFF', { side: THREE.DoubleSide }));
      e.position.set(s * 0.2, 0.4, 0.42);
      top.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), toon('#2E2A2A', { side: THREE.DoubleSide }));
      p.position.set(s * 0.21, 0.42, 0.53);
      top.add(p);
    }
  }
  mergeColored(top, vc2);
  mergeStatic(top); // 투명 조각, 살 끝처럼 남은 것끼리
  g.add(top);
  // 대와 손잡이
  const stick = new THREE.Group();
  const shaftC = toon(clear ? '#B8C7D3' : '#6B5A50');
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, len, 8), shaftC);
  shaft.position.y = len / 2;
  stick.add(shaft);
  const hook = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.026, 8, 14, Math.PI), toon(clear ? '#4D7DDB' : '#8E603E'));
  hook.position.set(0.075, -0.02, 0);
  hook.rotation.z = Math.PI;
  stick.add(hook);
  mergeColored(stick, vc1);
  g.add(stick);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } }); // 얼굴이 그늘에 가려 어두워지지 않게 그림자는 드리우지 않는다
  g.userData.top = top;
  return g;
}
