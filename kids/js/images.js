// 진숲 어린이 마을 — 사진과 그림을 작게 줄여 JPEG로 만들기
// 서버는 JPEG만 받고 크기 한도가 있다 (필사 사진 450KB, 그림 320KB, 작은 그림 30~40KB).

export async function loadImageFile(file) {
  if (!file || !/^image\//.test(file.type || 'image/')) throw new Error('NOT_IMAGE');
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (e) { /* 아래 방법으로 */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

const sizeOf = (src) => ({ w: src.naturalWidth || src.width, h: src.naturalHeight || src.height });

// rotate: 0, 1, 2, 3 (90도씩 시계 방향)
export function drawScaled(src, maxSide, rotate = 0, bg = '#FFFFFF') {
  const { w, h } = sizeOf(src);
  const k = Math.min(1, maxSide / Math.max(w, h));
  const sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  const turn = rotate % 2 === 1;
  const c = document.createElement('canvas');
  c.width = turn ? sh : sw;
  c.height = turn ? sw : sh;
  const ctx = c.getContext('2d');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.translate(c.width / 2, c.height / 2);
  ctx.rotate((rotate * Math.PI) / 2);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, -sw / 2, -sh / 2, sw, sh);
  return c;
}

const b64Bytes = (b64) => Math.floor((b64.length * 3) / 4);

// 한도 안에 들어올 때까지 품질과 크기를 줄인다
export function toJpeg(src, { maxSide, quality = 0.75, maxBytes, rotate = 0 }) {
  let side = maxSide;
  for (let round = 0; round < 6; round++) {
    const c = drawScaled(src, side, rotate);
    for (let q = quality; q >= 0.42; q -= 0.08) {
      const url = c.toDataURL('image/jpeg', q);
      const b64 = url.slice(url.indexOf(',') + 1);
      if (b64Bytes(b64) <= maxBytes) return { b64, url, w: c.width, h: c.height };
    }
    side = Math.round(side * 0.8);
  }
  throw new Error('TOO_BIG');
}

export const jpegUrl = (b64) => (b64 ? `data:image/jpeg;base64,${b64}` : '');
