// 진숲 어린이 마을 — 아바타 꾸미기 목록과 얼굴 그리기 (three.js 없이 쓰는 부분)

export const PALETTE = {
  skin: [['#FFE4CF', '뽀얀'], ['#F9D3B4', '밝은'], ['#EDBB92', '살구'], ['#D49B6E', '구릿빛'], ['#A9724E', '갈색'], ['#7B5037', '진한 갈색']],
  hair: [['#2E2624', '검정'], ['#5B3A29', '진갈색'], ['#8C5B37', '갈색'], ['#C88A4E', '밤색'], ['#EBC66C', '금발'], ['#E4834A', '주황'],
    ['#C2453A', '빨강'], ['#F2A0BD', '분홍'], ['#83C5EA', '하늘'], ['#9D82DB', '보라'], ['#78CDB0', '민트'], ['#A3A7AD', '회색']],
  eye: [['#2B2525', '검정'], ['#6B4428', '갈색'], ['#3A70D6', '파랑'], ['#3F9A58', '초록'], ['#7D52C8', '보라'], ['#6E7581', '회색']],
  cloth: [['#EF6461', '빨강'], ['#F49A4C', '주황'], ['#F6D55C', '노랑'], ['#A2D86E', '연두'], ['#4FA36C', '초록'], ['#6FD3C0', '민트'],
    ['#7EC8F2', '하늘'], ['#4D7DDB', '파랑'], ['#30477F', '남색'], ['#A07FE3', '보라'], ['#F6A2C4', '분홍'], ['#FAF6EC', '흰색'],
    ['#9EA4AB', '회색'], ['#8E603E', '갈색'], ['#3B3B42', '검정']],
  bottom: [['#4B6FA6', '청바지'], ['#30477F', '남색'], ['#3B3B42', '검정'], ['#8E603E', '갈색'], ['#D9C4A0', '베이지'], ['#9EA4AB', '회색'],
    ['#4FA36C', '초록'], ['#EF6461', '빨강']],
  shoe: [['#EF6461', '빨강'], ['#4D7DDB', '파랑'], ['#F6D55C', '노랑'], ['#FAF6EC', '흰색'], ['#3B3B42', '검정'], ['#8E603E', '갈색'],
    ['#F6A2C4', '분홍'], ['#4FA36C', '초록']],
};

export const PARTS = {
  eyes: [['dot', '콩알'], ['round', '동글'], ['sparkle', '반짝'], ['big', '초롱'], ['smile', '웃는 눈'], ['sleepy', '졸린 눈'],
    ['lash', '속눈썹'], ['wink', '윙크'], ['star', '별 눈']],
  brows: [['soft', '기본'], ['thick', '진한'], ['arch', '동그란'], ['flat', '일자'], ['worried', '걱정'], ['brave', '씩씩'], ['none', '없음']],
  nose: [['dot', '점'], ['round', '동그란'], ['button', '콧구멍'], ['tri', '오똑'], ['line', '선'], ['none', '없음']],
  mouth: [['smile', '미소'], ['grin', '활짝'], ['cat', '고양이'], ['open', '아~'], ['o', '오!'], ['tongue', '메롱'],
    ['teeth', '이 보여요'], ['small', '쪼끔'], ['flat', '일자']],
  cheek: [['none', '없음'], ['pink', '분홍 볼'], ['peach', '살구 볼'], ['freckle', '주근깨']],
  hair: [['short', '짧은 머리'], ['side', '옆가르마'], ['buzz', '까까머리'], ['spiky', '삐죽 머리'], ['curly', '곱슬 머리'],
    ['bob', '단발'], ['long', '긴 머리'], ['pigtails', '양갈래'], ['ponytail', '포니테일'], ['bun', '똥머리'], ['braids', '땋은 머리']],
  outfit: [['tee', '새싹 티'], ['stripe', '줄무늬 티'], ['star', '별무늬 티'], ['check', '체크 셔츠'], ['hoodie', '후드티'],
    ['sweater', '니트'], ['sporty', '운동복'], ['overall', '멜빵바지'], ['dress', '원피스'], ['robe', '성경 옷'], ['pajama', '잠옷'],
    ['sailor', '세일러복'], ['raincoat', '비옷'], ['hero', '영웅 옷']],
  hat: [['none', '없음'], ['cap', '야구 모자'], ['beanie', '털모자'], ['straw', '밀짚모자'], ['bucket', '벙거지'], ['ribbon', '리본'],
    ['flower', '꽃핀'], ['bear', '곰돌이 머리띠'], ['sprout', '새싹'], ['party', '고깔모자'], ['crown', '왕관'],
    ['halo', '천사 고리'], ['bunny', '토끼 머리띠'], ['catband', '고양이 머리띠'], ['chef', '요리사 모자']],
  // 열매 상점 꾸미기 물건 (js/wardrobe.js): 안경과 등에 메는 것
  face: [['none', '없음'], ['glasses', '동그란 안경'], ['sunglasses', '선글라스'], ['heart', '하트 안경']],
  back: [['none', '없음'], ['angel', '천사 날개'], ['butterfly', '나비 날개'], ['cape', '망토'], ['backpack', '책가방']],
};

const KEYS = {
  eyes: 'eyes', brows: 'brows', nose: 'nose', mouth: 'mouth', cheek: 'cheek', hair: 'hair', outfit: 'outfit', hat: 'hat', face: 'face', back: 'back',
};
const COLOR_KEYS = { skin: 'skin', hairColor: 'hair', eyeColor: 'eye', outfitColor: 'cloth', bottomColor: 'bottom', shoeColor: 'shoe', hatColor: 'cloth', backColor: 'cloth' };
// 상점에서 사야 하는 값 (무작위 꾸미기와 처음 모습에서는 고르지 않는다)
const SHOP_VALUES = { outfit: ['sailor', 'raincoat', 'hero'], hat: ['halo', 'bunny', 'catband', 'chef'], face: ['glasses', 'sunglasses', 'heart'], back: ['angel', 'butterfly', 'cape', 'backpack'] };

export function defaultAvatar() {
  return {
    v: 1, skin: 1, eyes: 'round', eyeColor: 0, brows: 'soft', nose: 'dot', mouth: 'smile', cheek: 'pink',
    hair: 'short', hairColor: 1, outfit: 'tee', outfitColor: 4, bottomColor: 0, shoeColor: 0, hat: 'none', hatColor: 0,
    face: 'none', back: 'none', backColor: 0,
  };
}

export function normalizeAvatar(a) {
  const d = defaultAvatar();
  if (!a || typeof a !== 'object') return d;
  const out = { v: 1 };
  for (const [k, part] of Object.entries(KEYS)) {
    const ok = PARTS[part].some(([id]) => id === a[k]);
    out[k] = ok ? a[k] : d[k];
  }
  for (const [k, pal] of Object.entries(COLOR_KEYS)) {
    const n = Number(a[k]);
    out[k] = Number.isInteger(n) && n >= 0 && n < PALETTE[pal].length ? n : d[k];
  }
  return out;
}

export function randomAvatar(rand = Math.random) {
  const pick = (arr) => arr[Math.floor(rand() * arr.length)];
  const a = {};
  for (const [k, part] of Object.entries(KEYS)) a[k] = pick(PARTS[part].filter(([id]) => !(SHOP_VALUES[k] || []).includes(id)))[0];
  for (const [k, pal] of Object.entries(COLOR_KEYS)) a[k] = Math.floor(rand() * PALETTE[pal].length);
  if (rand() < 0.45) a.hat = 'none';
  a.face = 'none'; a.back = 'none';
  if (rand() < 0.6) a.hairColor = Math.floor(rand() * 5);
  return normalizeAvatar(a);
}

export function colorOf(av, key) {
  return PALETTE[COLOR_KEYS[key]][av[key]][0];
}

// ---------- 색 도우미 ----------
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, amt) {
  // amt > 0 어둡게, amt < 0 밝게
  const [r, g, b] = hexToRgb(hex);
  const f = (c) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? c * (1 - amt) : c + (255 - c) * -amt)));
  return '#' + [f(r), f(g), f(b)].map((c) => c.toString(16).padStart(2, '0')).join('');
}
export function isLight(hex) {
  const [r, g, b] = hexToRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 170;
}

// ---------- 얼굴 부품 그리기 ----------
const INK = '#3A2C28';

function ellipse(ctx, x, y, rx, ry, fill) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}
function strokeStyle(ctx, color, w) {
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}
function star(ctx, x, y, r, fill) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.48;
    ctx.lineTo(x + Math.cos(ang) * rr, y + Math.sin(ang) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}
function sparkle4(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.quadraticCurveTo(x, y, x, y + r);
  ctx.quadraticCurveTo(x, y, x - r, y);
  ctx.quadraticCurveTo(x, y, x, y - r);
  ctx.fillStyle = fill;
  ctx.fill();
}

function closedEye(ctx, x, y, u) {
  strokeStyle(ctx, INK, u * 0.17);
  ctx.beginPath();
  ctx.arc(x, y - u * 0.25, u * 0.5, Math.PI * 0.2, Math.PI * 0.8);
  ctx.stroke();
}

// side: -1 = 보는 사람 왼쪽 눈, 1 = 오른쪽 눈
export function drawEye(ctx, x, y, u, style, eyeColor, side, blink) {
  const dark = shade(eyeColor, 0.55);
  if (blink && !['smile', 'sleepy'].includes(style)) return closedEye(ctx, x, y, u);
  switch (style) {
    case 'dot':
      ellipse(ctx, x, y, u * 0.4, u * 0.56, eyeColor === '#2B2525' ? INK : dark);
      ellipse(ctx, x + u * 0.12, y - u * 0.22, u * 0.14, u * 0.14, '#fff');
      break;
    case 'round':
      ellipse(ctx, x, y, u * 0.6, u * 0.78, dark);
      ellipse(ctx, x, y + u * 0.12, u * 0.48, u * 0.58, eyeColor);
      ellipse(ctx, x, y + u * 0.08, u * 0.3, u * 0.42, INK);
      ellipse(ctx, x + u * 0.2, y - u * 0.3, u * 0.2, u * 0.2, '#fff');
      ellipse(ctx, x - u * 0.2, y + u * 0.32, u * 0.09, u * 0.09, '#fff');
      break;
    case 'sparkle': {
      const g = ctx.createLinearGradient(x, y - u, x, y + u);
      g.addColorStop(0, INK);
      g.addColorStop(1, shade(eyeColor, -0.25));
      ctx.beginPath();
      ctx.ellipse(x, y, u * 0.68, u * 0.9, 0, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ellipse(ctx, x + u * 0.22, y - u * 0.34, u * 0.26, u * 0.24, '#fff');
      ellipse(ctx, x - u * 0.24, y + u * 0.3, u * 0.12, u * 0.12, '#fff');
      sparkle4(ctx, x - u * 0.12, y - u * 0.05, u * 0.22, 'rgba(255,255,255,.9)');
      break;
    }
    case 'big':
      ellipse(ctx, x, y, u * 0.76, u * 0.92, '#fff');
      strokeStyle(ctx, INK, u * 0.1);
      ctx.beginPath();
      ctx.ellipse(x, y, u * 0.76, u * 0.92, 0, 0, Math.PI * 2);
      ctx.stroke();
      ellipse(ctx, x, y + u * 0.14, u * 0.52, u * 0.62, eyeColor);
      ellipse(ctx, x, y + u * 0.16, u * 0.28, u * 0.34, INK);
      ellipse(ctx, x + u * 0.2, y - u * 0.12, u * 0.18, u * 0.18, '#fff');
      strokeStyle(ctx, INK, u * 0.22);
      ctx.beginPath();
      ctx.arc(x, y + u * 0.2, u * 0.86, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      break;
    case 'smile':
      strokeStyle(ctx, INK, u * 0.2);
      ctx.beginPath();
      ctx.arc(x, y + u * 0.3, u * 0.52, Math.PI * 1.12, Math.PI * 1.88);
      ctx.stroke();
      break;
    case 'sleepy':
      ctx.save();
      ctx.beginPath();
      ctx.rect(x - u, y - u * 0.05, u * 2, u);
      ctx.clip();
      ellipse(ctx, x, y, u * 0.55, u * 0.5, INK);
      ellipse(ctx, x + u * 0.18, y + u * 0.14, u * 0.11, u * 0.1, '#fff');
      ctx.restore();
      strokeStyle(ctx, INK, u * 0.15);
      ctx.beginPath();
      ctx.moveTo(x - u * 0.62, y - u * 0.04);
      ctx.lineTo(x + u * 0.62, y - u * 0.04);
      ctx.stroke();
      break;
    case 'lash': {
      drawEye(ctx, x, y, u, 'round', eyeColor, side, false);
      strokeStyle(ctx, INK, u * 0.12);
      const ox = side * -1;
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + ox * (0.55 + i * 0.32);
        const sx = x + Math.cos(a) * u * 0.6;
        const sy = y + Math.sin(a) * u * 0.78;
        ctx.beginPath();
        ctx.moveTo(sx, sy);
        ctx.lineTo(sx + Math.cos(a) * u * 0.3, sy + Math.sin(a) * u * 0.3);
        ctx.stroke();
      }
      break;
    }
    case 'wink':
      if (side > 0) {
        strokeStyle(ctx, INK, u * 0.18);
        ctx.beginPath();
        ctx.moveTo(x - u * 0.45, y - u * 0.3);
        ctx.lineTo(x + u * 0.25, y);
        ctx.lineTo(x - u * 0.45, y + u * 0.3);
        ctx.stroke();
      } else drawEye(ctx, x, y, u, 'round', eyeColor, side, false);
      break;
    case 'star':
      star(ctx, x, y + u * 0.05, u * 0.8, eyeColor === '#2B2525' ? '#F2B632' : eyeColor);
      ctx.save();
      ctx.globalAlpha = 0.9;
      strokeStyle(ctx, INK, u * 0.08);
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rr = i % 2 === 0 ? u * 0.8 : u * 0.38;
        ctx.lineTo(x + Math.cos(ang) * rr, y + u * 0.05 + Math.sin(ang) * rr);
      }
      ctx.closePath();
      ctx.stroke();
      ctx.restore();
      ellipse(ctx, x + u * 0.12, y - u * 0.1, u * 0.12, u * 0.12, '#fff');
      break;
    default:
      drawEye(ctx, x, y, u, 'dot', eyeColor, side, blink);
  }
}

export function drawBrow(ctx, x, y, u, style, color, side) {
  if (style === 'none') return;
  const inner = -side; // 안쪽 방향
  strokeStyle(ctx, color, u * (style === 'thick' ? 0.3 : 0.17));
  ctx.beginPath();
  const L = u * 0.46;
  switch (style) {
    case 'arch':
      ctx.moveTo(x - L, y + u * 0.12);
      ctx.quadraticCurveTo(x, y - u * 0.42, x + L, y + u * 0.12);
      break;
    case 'flat':
      ctx.moveTo(x - L, y);
      ctx.lineTo(x + L, y);
      break;
    case 'worried':
      ctx.moveTo(x - L, y + (inner < 0 ? -u * 0.18 : u * 0.1));
      ctx.lineTo(x + L, y + (inner > 0 ? -u * 0.18 : u * 0.1));
      break;
    case 'brave':
      ctx.moveTo(x - L, y + (inner < 0 ? u * 0.16 : -u * 0.14));
      ctx.lineTo(x + L, y + (inner > 0 ? u * 0.16 : -u * 0.14));
      break;
    default:
      ctx.moveTo(x - L, y + u * 0.06);
      ctx.quadraticCurveTo(x, y - u * 0.2, x + L, y + u * 0.06);
  }
  ctx.stroke();
}

export function drawNose(ctx, x, y, u, style, skin) {
  const c = shade(skin, 0.32);
  switch (style) {
    case 'dot':
      ellipse(ctx, x, y, u * 0.13, u * 0.1, c);
      break;
    case 'round':
      ellipse(ctx, x, y, u * 0.24, u * 0.2, shade(skin, 0.12));
      ellipse(ctx, x - u * 0.07, y - u * 0.07, u * 0.07, u * 0.06, 'rgba(255,255,255,.55)');
      break;
    case 'button':
      ellipse(ctx, x - u * 0.1, y, u * 0.06, u * 0.07, c);
      ellipse(ctx, x + u * 0.1, y, u * 0.06, u * 0.07, c);
      break;
    case 'tri':
      strokeStyle(ctx, c, u * 0.08);
      ctx.beginPath();
      ctx.moveTo(x + u * 0.02, y - u * 0.26);
      ctx.lineTo(x - u * 0.12, y + u * 0.08);
      ctx.lineTo(x + u * 0.1, y + u * 0.08);
      ctx.stroke();
      break;
    case 'line':
      strokeStyle(ctx, c, u * 0.08);
      ctx.beginPath();
      ctx.arc(x, y - u * 0.05, u * 0.14, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      break;
    default:
  }
}

export function drawMouth(ctx, x, y, u, style) {
  const line = '#7A3B33', inner = '#B5473E', tongue = '#F08A8A';
  switch (style) {
    case 'grin':
    case 'teeth': {
      const w = style === 'teeth' ? 0.58 : 0.46;
      ctx.beginPath();
      ctx.moveTo(x - u * w, y - u * 0.12);
      ctx.quadraticCurveTo(x, y + u * 0.95, x + u * w, y - u * 0.12);
      ctx.closePath();
      ctx.fillStyle = inner;
      ctx.fill();
      ctx.save();
      ctx.clip();
      if (style === 'teeth') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(x - u, y - u * 0.2, u * 2, u * 0.26);
      } else ellipse(ctx, x, y + u * 0.42, u * 0.28, u * 0.2, tongue);
      ctx.restore();
      strokeStyle(ctx, line, u * 0.09);
      ctx.beginPath();
      ctx.moveTo(x - u * w, y - u * 0.12);
      ctx.quadraticCurveTo(x, y + u * 0.95, x + u * w, y - u * 0.12);
      ctx.closePath();
      ctx.stroke();
      break;
    }
    case 'cat':
      strokeStyle(ctx, line, u * 0.11);
      ctx.beginPath();
      ctx.arc(x - u * 0.19, y, u * 0.19, Math.PI * 0.05, Math.PI * 0.95);
      ctx.moveTo(x + u * 0.38, y);
      ctx.arc(x + u * 0.19, y, u * 0.19, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
      break;
    case 'open':
      ellipse(ctx, x, y + u * 0.1, u * 0.26, u * 0.32, inner);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, y + u * 0.1, u * 0.26, u * 0.32, 0, 0, Math.PI * 2);
      ctx.clip();
      ellipse(ctx, x, y + u * 0.36, u * 0.2, u * 0.14, tongue);
      ctx.restore();
      break;
    case 'o':
      ellipse(ctx, x, y + u * 0.04, u * 0.15, u * 0.17, inner);
      strokeStyle(ctx, line, u * 0.07);
      ctx.beginPath();
      ctx.ellipse(x, y + u * 0.04, u * 0.15, u * 0.17, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    case 'tongue':
      ellipse(ctx, x + u * 0.1, y + u * 0.2, u * 0.15, u * 0.2, tongue);
      strokeStyle(ctx, '#D36A6A', u * 0.05);
      ctx.beginPath();
      ctx.moveTo(x + u * 0.1, y + u * 0.08);
      ctx.lineTo(x + u * 0.1, y + u * 0.26);
      ctx.stroke();
      strokeStyle(ctx, line, u * 0.11);
      ctx.beginPath();
      ctx.arc(x, y - u * 0.32, u * 0.42, Math.PI * 0.22, Math.PI * 0.78);
      ctx.stroke();
      break;
    case 'small':
      strokeStyle(ctx, line, u * 0.1);
      ctx.beginPath();
      ctx.arc(x, y - u * 0.15, u * 0.2, Math.PI * 0.2, Math.PI * 0.8);
      ctx.stroke();
      break;
    case 'flat':
      strokeStyle(ctx, line, u * 0.1);
      ctx.beginPath();
      ctx.moveTo(x - u * 0.24, y);
      ctx.lineTo(x + u * 0.24, y);
      ctx.stroke();
      break;
    default: // smile
      strokeStyle(ctx, line, u * 0.12);
      ctx.beginPath();
      ctx.arc(x, y - u * 0.36, u * 0.44, Math.PI * 0.22, Math.PI * 0.78);
      ctx.stroke();
  }
}

export function drawCheeks(ctx, xl, xr, y, u, style) {
  if (style === 'pink' || style === 'peach') {
    const c = style === 'pink' ? 'rgba(255,118,140,.42)' : 'rgba(255,150,92,.42)';
    ellipse(ctx, xl, y, u * 0.42, u * 0.26, c);
    ellipse(ctx, xr, y, u * 0.42, u * 0.26, c);
  } else if (style === 'freckle') {
    for (const cx of [xl, xr]) {
      for (const [dx, dy] of [[-0.18, -0.06], [0.06, 0.06], [0.24, -0.08]]) {
        ellipse(ctx, cx + dx * u, y + dy * u, u * 0.055, u * 0.055, 'rgba(140,84,58,.7)');
      }
    }
  }
}

// 3D 얼굴 텍스처 한 장 (머리 구 앞쪽에 감싸지는 부분)
// 안경 (얼굴 그림 위에 그린다). cx: 얼굴 가운데, ey: 눈 높이, ex: 가운데에서 눈까지, u: 크기
export function drawGlasses(ctx, cx, ey, ex, u, style) {
  if (!style || style === 'none') return;
  const r = u * 1.02;
  ctx.save();
  if (style === 'heart') {
    const heart = (x, y) => {
      ctx.beginPath();
      ctx.moveTo(x, y + r * 0.95);
      ctx.bezierCurveTo(x - r * 1.5, y - r * 0.05, x - r * 0.75, y - r * 1.2, x, y - r * 0.45);
      ctx.bezierCurveTo(x + r * 0.75, y - r * 1.2, x + r * 1.5, y - r * 0.05, x, y + r * 0.95);
      ctx.closePath();
    };
    for (const s of [-1, 1]) {
      heart(cx + s * ex, ey);
      ctx.fillStyle = 'rgba(246,140,180,.38)';
      ctx.fill();
      strokeStyle(ctx, '#E8467F', u * 0.15);
      ctx.stroke();
    }
    strokeStyle(ctx, '#E8467F', u * 0.13);
  } else if (style === 'sunglasses') {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.roundRect(cx + s * ex - r * 1.12, ey - r * 0.78, r * 2.24, r * 1.6, r * 0.62);
      ctx.fillStyle = '#26262E';
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      ctx.beginPath();
      ctx.ellipse(cx + s * ex - r * 0.4, ey - r * 0.3, r * 0.34, r * 0.16, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    strokeStyle(ctx, '#26262E', u * 0.16);
  } else {
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(cx + s * ex, ey, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(214,236,250,.22)';
      ctx.fill();
      strokeStyle(ctx, '#6B4428', u * 0.14);
      ctx.stroke();
    }
    strokeStyle(ctx, '#6B4428', u * 0.13);
  }
  // 코걸이와 다리
  const gap = style === 'sunglasses' ? r * 1.12 : r;
  ctx.beginPath();
  ctx.moveTo(cx - ex + gap, ey - r * 0.2);
  ctx.quadraticCurveTo(cx, ey - r * 0.6, cx + ex - gap, ey - r * 0.2);
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(cx + s * (ex + gap), ey - r * 0.25);
    ctx.lineTo(cx + s * (ex + gap + u * 0.9), ey - r * 0.45);
    ctx.stroke();
  }
  ctx.restore();
}

export const FACE_TEX = { w: 640, h: 404, phiWidth: 2.3, thetaStart: 0.95, thetaLength: 1.45 };

export function drawFace(ctx, av, { blink = false, w = FACE_TEX.w, h = FACE_TEX.h } = {}) {
  const k = w / FACE_TEX.w;
  const u = 44 * k;
  const cx = w / 2;
  const skin = colorOf(av, 'skin');
  const eyeC = colorOf(av, 'eyeColor');
  const browC = shade(colorOf(av, 'hairColor'), 0.2);
  ctx.clearRect(0, 0, w, h);
  const ex = 100 * k, ey = 180 * k;
  drawCheeks(ctx, cx - 158 * k, cx + 158 * k, 244 * k, u, av.cheek);
  drawBrow(ctx, cx - ex, ey - 74 * k, u, av.brows, browC, -1);
  drawBrow(ctx, cx + ex, ey - 74 * k, u, av.brows, browC, 1);
  drawEye(ctx, cx - ex, ey, u, av.eyes, eyeC, -1, blink);
  drawEye(ctx, cx + ex, ey, u, av.eyes, eyeC, 1, blink);
  drawNose(ctx, cx, 236 * k, u, av.nose, skin);
  drawMouth(ctx, cx, 280 * k, u, av.mouth);
  drawGlasses(ctx, cx, ey, ex, u, av.face);
}

// 2D 얼굴 아이콘 (선생님 화면 목록, 마을 HUD 등)
export function drawFaceIcon(canvas, av) {
  const ctx = canvas.getContext('2d');
  const s = canvas.width;
  ctx.clearRect(0, 0, s, s);
  const skin = colorOf(av, 'skin');
  const hair = colorOf(av, 'hairColor');
  // 뒷머리
  if (['bob', 'long', 'pigtails', 'braids'].includes(av.hair)) {
    ctx.fillStyle = hair;
    ctx.beginPath();
    ctx.ellipse(s / 2, s * 0.52, s * 0.44, s * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(s / 2, s * 0.55, s * 0.38, s * 0.36, 0, 0, Math.PI * 2);
  ctx.fill();
  // 앞머리
  ctx.fillStyle = hair;
  ctx.beginPath();
  if (av.hair === 'buzz') {
    ctx.ellipse(s / 2, s * 0.43, s * 0.37, s * 0.24, 0, Math.PI, Math.PI * 2);
  } else {
    ctx.ellipse(s / 2, s * 0.45, s * 0.4, s * 0.3, 0, Math.PI * 1.02, Math.PI * 1.98);
    ctx.lineTo(s * 0.86, s * 0.42);
    ctx.quadraticCurveTo(s / 2, s * 0.3, s * 0.14, s * 0.42);
  }
  ctx.fill();
  const u = s * 0.075;
  const ex = s * 0.14, ey = s * 0.56;
  const eyeC = colorOf(av, 'eyeColor');
  drawCheeks(ctx, s / 2 - s * 0.23, s / 2 + s * 0.23, s * 0.66, u, av.cheek);
  drawEye(ctx, s / 2 - ex, ey, u, av.eyes, eyeC, -1, false);
  drawEye(ctx, s / 2 + ex, ey, u, av.eyes, eyeC, 1, false);
  drawMouth(ctx, s / 2, s * 0.73, u, av.mouth);
  drawGlasses(ctx, s / 2, ey, ex, u * 0.82, av.face);
}

// 꾸미기 화면의 부품 미리보기 타일
export function drawPartTile(canvas, av, part, value) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.clearRect(0, 0, w, h);
  const skin = colorOf(av, 'skin');
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.ellipse(w / 2, h / 2, w * 0.44, h * 0.42, 0, 0, Math.PI * 2);
  ctx.fill();
  const u = h * 0.2;
  const eyeC = colorOf(av, 'eyeColor');
  const browC = shade(colorOf(av, 'hairColor'), 0.2);
  if (part === 'eyes') {
    drawEye(ctx, w / 2 - w * 0.2, h / 2, u, value, eyeC, -1, false);
    drawEye(ctx, w / 2 + w * 0.2, h / 2, u, value, eyeC, 1, false);
  } else if (part === 'brows') {
    drawBrow(ctx, w / 2 - w * 0.2, h / 2, u * 1.1, value, browC, -1);
    drawBrow(ctx, w / 2 + w * 0.2, h / 2, u * 1.1, value, browC, 1);
  } else if (part === 'nose') {
    drawNose(ctx, w / 2, h / 2, u * 1.6, value, skin);
  } else if (part === 'mouth') {
    drawMouth(ctx, w / 2, h / 2 - u * 0.1, u * 1.5, value);
  } else if (part === 'cheek') {
    drawCheeks(ctx, w / 2 - w * 0.2, w / 2 + w * 0.2, h / 2, u * 1.3, value);
  }
}
