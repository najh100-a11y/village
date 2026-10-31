// 진숲 어린이 마을 — 놀이기구 타기: 회전목마, 대관람차, 바이킹, 범퍼카
// 놀이기구는 마을 시계로 계속 움직이고, 아이는 빈자리에 올라탄다. 친구 화면에서도 같은 자리에 타고 있다.
import * as THREE from './three.module.min.js';
import { RIDES, ARENA, CAR_SEAT, CAR_COLORS, ridePose, resetLimbs } from './park.js';
import { sfx } from './sound.js';
import { toast } from './ui.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TEXT = {
  ferris: { intro: '대관람차에 탔어요! 천천히 올라가요. 꼭대기에서 마을을 내려다봐요.', main: '손 흔들기', shout: 'wave' },
  carousel: { intro: '빙글빙글 회전목마! 말이 오르락내리락해요. 친구에게 손을 흔들어 봐요.', main: '손 흔들기', shout: 'wave' },
  viking: { intro: '바이킹에 탔어요! 손잡이를 꽉 잡아요.', main: '만세!', shout: 'yay' },
};
const VIKING_SAY = {
  wait: '곧 출발해요! 손잡이를 꽉 잡아요.',
  up: '올라간다~! 점점 높이 올라가요.',
  full: '와아아! 하늘까지 닿겠어요! 만세를 눌러 봐요.',
  down: '천천히 내려와요.',
};

export function createRides({ v, ui, begin, stopAll, portrait, shout }) {
  function takenSeats(kind) {
    const s = new Set();
    for (const r of v.remotes.values()) if (r.pin && r.pin.kind === kind && Number.isInteger(r.pin.seat)) s.add(r.pin.seat);
    return s;
  }
  function exitAt(kind, pl) {
    const d = RIDES[kind].door;
    pl.root.position.set(d[0], 0, d[1]);
    pl.root.rotation.set(0, 0, 0);
  }

  function ride(kind) {
    stopAll();
    if (kind === 'bumper') return bumper();
    const park = v.park;
    const seat = park.pickSeat(kind, takenSeats(kind));
    if (seat < 0) { toast('자리가 다 찼어요. 조금 있다가 다시 타 봐요!'); return; }
    const anchor = park.seats[kind][seat];
    const pl = v.player;
    const st = { wave: 0 };
    const P = V(), Q = new THREE.Quaternion(), F = V(), U = V();
    const far = () => (portrait() ? 1.3 : 1);
    const game = { cam: { pos: V(), look: V(), map: true }, camSpeed: 7 };
    const C = RIDES[kind];
    let lastSay = '', topSeen = false;
    const follow = () => {
      anchor.getWorldPosition(P);
      anchor.getWorldQuaternion(Q);
      pl.root.position.copy(P);
      pl.root.quaternion.copy(Q);
      const k = far();
      if (kind === 'ferris') {
        // 곤돌라 앞(남쪽) 조금 옆에서 아이와 관람차, 둘레 바다를 함께 본다
        game.cam.look.set(P.x, P.y + 1.0, P.z);
        game.cam.pos.set(P.x + 4.0 * k, P.y + 3.6 * k, P.z + 15.5 * k);
      } else if (kind === 'viking') {
        // 바이킹 앞에서 배 전체가 흔들리는 모습을 본다
        game.cam.look.set(C.x + (P.x - C.x) * 0.3, 2.9 + (P.y - 2.6) * 0.25, C.z);
        game.cam.pos.set(C.x + (P.x - C.x) * 0.15, 7.2 * k, C.z + 18 * k);
      } else {
        // 회전목마: 바깥에서 지붕 아래로 들여다보며 말과 함께 돈다
        F.set(0, 0, 1).applyQuaternion(Q);
        U.set(P.x - C.x, 0, P.z - C.z).normalize();
        game.cam.look.set(P.x, P.y + 1.15, P.z);
        game.cam.pos.set(P.x + (U.x * 9.5 + F.x * 3.5) * k, P.y + 2.4 * k, P.z + (U.z * 9.5 + F.z * 3.5) * k);
      }
    };
    game.update = (dt) => {
      st.wave = Math.max(0, st.wave - dt);
      follow();
      if (kind === 'viking') {
        const ph = park.vik.phase;
        if (VIKING_SAY[ph] && VIKING_SAY[ph] !== lastSay) { lastSay = VIKING_SAY[ph]; ui.say(lastSay); if (ph === 'full') sfx.whoosh(); }
        if (park.vik.peak && !st.peak) { st.peak = true; if (Math.random() < 0.5) sfx.whoosh(); }
        if (!park.vik.peak) st.peak = false;
      } else if (kind === 'ferris') {
        const top = P.y > 8.4; // 곤돌라 자리 높이는 0.6(맨 아래)에서 9.0(꼭대기)까지
        if (top && !topSeen) { topSeen = true; ui.banner('꼭대기예요!', '마을이 한눈에 보여요', 2600); }
        if (P.y < 2.5) topSeen = false;
      }
    };
    game.stop = () => {
      pl.pose = null;
      resetLimbs(pl);
      exitAt(kind, pl);
      v.noFade = null;
    };
    pl.pose = ridePose(kind, park, st);
    v.noFade = park.fade[kind];
    follow();
    begin(kind, C.name, game, [], seat);
    ui.say(TEXT[kind].intro);
    ui.setMain(TEXT[kind].main, { onClick: () => { st.wave = 1.6; pl.celebrate(); shout(TEXT[kind].shout); } });
    sfx.open();
  }

  // ---------- 범퍼카: 직접 몬다 ----------
  function bumper() {
    const park = v.park, B = RIDES.bumper, A = ARENA;
    const pl = v.player;
    const color = CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)];
    const car = park.makeCar(color);
    car.position.y = -CAR_SEAT;
    pl.root.add(car);
    // 다른 차와 떨어진 자리에서 시작
    const others = park.otherCars();
    const spots = [[-6.0, -2.4], [6.0, -2.4], [-6.0, 2.4], [6.0, 2.4], [0, 0], [-2.8, 1.2], [2.8, -1.2]];
    let best = spots[0], bd = -1;
    for (const [sx, sz] of spots) {
      const d = Math.min(9, ...others.map((o) => Math.hypot(o.x - (B.x + sx), o.z - (B.z + sz))));
      if (d > bd) { bd = d; best = [sx, sz]; }
    }
    const pos = V(B.x + best[0], 0, B.z + best[1]);
    const vel = V();
    let heading = best[0] < 0 ? Math.PI / 2 : -Math.PI / 2;
    const st = { wave: 0 };
    pl.pose = ridePose('bumper', park, st);
    let held = false;
    const aim = V();
    const keys = new Set();
    const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
    const kd = (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); e.preventDefault(); }
      if (e.code === 'Space') { e.preventDefault(); honk(); }
    };
    const ku = (e) => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); };
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -A.y);
    const ground = (x, y) => { const p = V(); return v.rayAt(x, y).ray.intersectPlane(plane, p) ? p : null; };
    const game = { cam: { pos: V(), look: V(), map: true }, camSpeed: 5, ownsDrag: () => true };
    game.onPointer = (type, x, y) => {
      if (type === 'down' || (type === 'move' && held)) { const p = ground(x, y); if (p) { aim.copy(p); held = true; } }
      else if (type === 'up') held = false;
    };
    // 부딪힌 자리에 '쿵!'
    const pops = [];
    let bumpT = 0, shake = 0, sendT = 0, moving = false;
    function bump(x, z, hard) {
      if (bumpT > 0) return;
      bumpT = 0.28;
      shake = hard ? 0.3 : 0.18;
      sfx.bonk();
      pl.celebrate();
      const el = ui.label(hard ? '쿵!' : '콩!');
      el.classList.add('bonk');
      pops.push({ el, p: V(x, 1.4, z), life: 0.8 });
    }
    function honk() { sfx.honk(); st.wave = 1.0; shout('beep'); }
    const MAXV = 3.8;
    game.update = (dt) => {
      bumpT = Math.max(0, bumpT - dt);
      st.wave = Math.max(0, st.wave - dt);
      // 어디로 갈지: 누르고 있는 곳, 또는 화살표(화면 방향)
      let thrust = 0, want = null;
      if (keys.size) {
        let kx = 0, kz = 0;
        if (keys.has('u')) kz -= 1;
        if (keys.has('d')) kz += 1;
        if (keys.has('l')) kx -= 1;
        if (keys.has('r')) kx += 1;
        const yw = v.view.game.yaw, c = Math.cos(yw), sn = Math.sin(yw);
        const dx = kx * c + kz * sn, dz = -kx * sn + kz * c;
        if (dx || dz) { want = Math.atan2(dx, dz); thrust = 1; }
      } else if (held) {
        const dx = aim.x - pos.x, dz = aim.z - pos.z;
        if (Math.hypot(dx, dz) > 0.45) { want = Math.atan2(dx, dz); thrust = 1; }
      }
      if (want != null) {
        let d = want - heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        heading += Math.max(-3.6 * dt, Math.min(3.6 * dt, d));
        // 거의 반대쪽이면 천천히 출발
        if (Math.abs(d) > 2.0) thrust *= 0.35;
      }
      vel.x += Math.sin(heading) * 7.5 * thrust * dt;
      vel.z += Math.cos(heading) * 7.5 * thrust * dt;
      vel.multiplyScalar(Math.exp(-dt * (thrust ? 1.1 : 2.4)));
      const sp = Math.hypot(vel.x, vel.z);
      if (sp > MAXV) vel.multiplyScalar(MAXV / sp);
      pos.x += vel.x * dt;
      pos.z += vel.z * dt;
      // 벽
      const mx = A.hw - A.car, mz = A.hd - A.car;
      if (pos.x > B.x + mx) { pos.x = B.x + mx; if (vel.x > 0) { if (vel.x > 0.7) bump(pos.x + A.car, pos.z, vel.x > 2.2); vel.x *= -0.7; } }
      if (pos.x < B.x - mx) { pos.x = B.x - mx; if (vel.x < 0) { if (vel.x < -0.7) bump(pos.x - A.car, pos.z, vel.x < -2.2); vel.x *= -0.7; } }
      if (pos.z > B.z + mz) { pos.z = B.z + mz; if (vel.z > 0) { if (vel.z > 0.7) bump(pos.x, pos.z + A.car, vel.z > 2.2); vel.z *= -0.7; } }
      if (pos.z < B.z - mz) { pos.z = B.z - mz; if (vel.z < 0) { if (vel.z < -0.7) bump(pos.x, pos.z - A.car, vel.z < -2.2); vel.z *= -0.7; } }
      // 다른 차 (곰 친구 차, 범퍼카를 타는 친구)
      const min = A.car * 2;
      for (const o of park.otherCars()) {
        const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz);
        if (d >= min || d < 1e-4) continue;
        const nx = dx / d, nz = dz / d;
        pos.x = o.x + nx * min;
        pos.z = o.z + nz * min;
        const vn = vel.x * nx + vel.z * nz;
        if (vn < 0) { vel.x -= 1.7 * vn * nx; vel.z -= 1.7 * vn * nz; }
        vel.x += nx * 1.3;
        vel.z += nz * 1.3;
        bump(o.x + nx * A.car, o.z + nz * A.car, Math.abs(vn) > 1.6);
        if (o.npc) o.npc.spin = 1;
      }
      park.clampArena(pos);
      pl.root.position.set(pos.x, A.y + CAR_SEAT, pos.z);
      pl.root.rotation.set(0, heading, 0);
      // 친구들에게 알리기
      sendT -= dt;
      const speed = Math.hypot(vel.x, vel.z);
      if (speed > 0.25 && sendT <= 0) { v.reportMove(pos.x + vel.x * 0.6, pos.z + vel.z * 0.6); sendT = 0.3; moving = true; }
      else if (speed <= 0.25 && moving) { v.reportStop(); moving = false; }
      // 카메라: 범퍼카 장 앞(남쪽) 위에서 내려다본다
      const k = portrait() ? 1.3 : 1;
      shake = Math.max(0, shake - dt);
      const sx = shake ? (Math.random() - 0.5) * shake : 0, sy = shake ? (Math.random() - 0.5) * shake : 0;
      game.cam.look.set(B.x + (pos.x - B.x) * 0.7 + sx, 0.4 + sy, B.z + (pos.z - B.z) * 0.55);
      game.cam.pos.set(B.x + (pos.x - B.x) * 0.45, 11 * k, B.z + 4 + (pos.z - B.z) * 0.3 + 9.5 * k);
      for (let i = pops.length - 1; i >= 0; i--) {
        const q = pops[i];
        q.life -= dt;
        q.p.y += dt * 1.2;
        if (q.life <= 0) { q.el.remove(); pops.splice(i, 1); continue; }
        q.el.style.opacity = String(Math.min(1, q.life / 0.3));
        ui.place(q.el, q.p, 0);
      }
    };
    game.stop = () => {
      document.body.classList.remove('pad-game');
      v.noFade = null;
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      for (const q of pops) q.el.remove();
      car.removeFromParent();
      pl.pose = null;
      resetLimbs(pl);
      exitAt('bumper', pl);
    };
    pl.root.position.set(pos.x, A.y + CAR_SEAT, pos.z);
    pl.root.rotation.set(0, heading, 0);
    game.update(0);
    begin('bumper', '범퍼카', game, [], -1);
    document.body.classList.add('pad-game'); // 휴대폰에서는 방향 단추로도 몬다
    v.noFade = park.fade.bumper; // 범퍼카 장은 흐리게 하지 않는다
    const fine = matchMedia('(pointer: fine)').matches;
    ui.say(fine ? '화면을 누르고 있거나 화살표 자판을 누르면 그쪽으로 달려요. 다른 차에 쿵! 부딪혀 봐요.' : '화면을 누르고 있거나 방향 단추를 누르면 그쪽으로 달려요. 다른 차에 쿵! 부딪혀 봐요.');
    ui.setMain('빵빵!', { onClick: honk });
    sfx.open();
  }

  return { ride };
}
