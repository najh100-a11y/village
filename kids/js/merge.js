// 진숲 어린이 마을 — 움직이지 않는 모양 합치기 (그리기 횟수 줄이기)
import * as THREE from './three.module.min.js';

// 같은 재질끼리 하나로 합쳐 그리기 횟수를 줄인다 (움직이지 않는 물건용)
export function mergeGeos(items) {
  let vc = 0, ic = 0;
  for (const { geo } of items) {
    vc += geo.attributes.position.count;
    ic += geo.index ? geo.index.count : geo.attributes.position.count;
  }
  const P = new Float32Array(vc * 3), N = new Float32Array(vc * 3), U = new Float32Array(vc * 2), I = new Uint32Array(ic);
  const v = new THREE.Vector3(), nm = new THREE.Matrix3();
  let vo = 0, io = 0;
  for (const { geo, m } of items) {
    nm.getNormalMatrix(m);
    const pos = geo.attributes.position, nor = geo.attributes.normal, uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      P[(vo + i) * 3] = v.x; P[(vo + i) * 3 + 1] = v.y; P[(vo + i) * 3 + 2] = v.z;
      if (nor) {
        v.fromBufferAttribute(nor, i).applyMatrix3(nm).normalize();
        N[(vo + i) * 3] = v.x; N[(vo + i) * 3 + 1] = v.y; N[(vo + i) * 3 + 2] = v.z;
      }
      if (uv) { U[(vo + i) * 2] = uv.getX(i); U[(vo + i) * 2 + 1] = uv.getY(i); }
    }
    if (geo.index) { for (let j = 0; j < geo.index.count; j++) I[io + j] = geo.index.getX(j) + vo; io += geo.index.count; } else {
      for (let j = 0; j < pos.count; j++) I[io + j] = vo + j;
      io += pos.count;
    }
    vo += pos.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  out.setAttribute('uv', new THREE.BufferAttribute(U, 2));
  out.setIndex(new THREE.BufferAttribute(I, 1));
  out.computeBoundingSphere();
  return out;
}
export function mergeStatic(root, { shallow = false } = {}) {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const buckets = new Map();
  const victims = [];
  const visit = (o) => {
    if (o === root) return;
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.userData.noMerge) return;
    if (!o.visible) { victims.push(o); return; }
    const key = o.material.uuid;
    if (!buckets.has(key)) buckets.set(key, { mat: o.material, items: [], cast: false });
    const b = buckets.get(key);
    b.items.push({ geo: o.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) });
    b.cast = b.cast || o.castShadow;
    victims.push(o);
  };
  if (shallow) [...root.children].forEach(visit); else root.traverse(visit);
  for (const o of victims) { o.parent.remove(o); o.geometry.dispose(); }
  for (const { mat, items, cast } of buckets.values()) {
    const mesh = new THREE.Mesh(mergeGeos(items), mat);
    mesh.castShadow = cast;
    mesh.receiveShadow = true;
    root.add(mesh);
  }
}
// 여러 그루의 나무처럼 같은 모양을 여러 번 그릴 때
export class Instancer {
  constructor(scene) { this.scene = scene; this.map = new Map(); }
  addGroup(group) {
    group.updateMatrixWorld(true);
    group.traverse((o) => {
      if (!o.isMesh) return;
      const k = o.geometry.uuid + o.material.uuid;
      if (!this.map.has(k)) this.map.set(k, { geo: o.geometry, mat: o.material, ms: [], cast: o.castShadow });
      this.map.get(k).ms.push(o.matrixWorld.clone());
    });
  }
  build() {
    for (const { geo, mat, ms, cast } of this.map.values()) {
      const im = new THREE.InstancedMesh(geo, mat, ms.length);
      ms.forEach((mm, i) => im.setMatrixAt(i, mm));
      im.castShadow = cast;
      im.receiveShadow = true;
      im.computeBoundingSphere();
      this.scene.add(im);
    }
  }
}

