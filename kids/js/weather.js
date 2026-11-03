// 진숲 어린이 마을 — 대구 지금 날씨
// 날씨 자료: Open-Meteo.com (Attribution 4.0 International, CC BY 4.0). 비영리 무료 API이고 열쇠(키)가 필요 없다.
// 보내는 것은 대구 시청 둘레 좌표(위도 35.8714, 경도 128.6014)뿐이다. 아이 이름이나 기기 위치는 보내지 않는다.
// 15분마다(화면을 다시 볼 때도 15분이 지났으면) 새로 받고, 받은 값은 이 기기에 40분 동안 기억해 둔다.
// 값은 기상 모델로 계산한 '지금 날씨'라서 실제 하늘과 조금 다를 수 있다.
export const WEATHER_URL = 'https://api.open-meteo.com/v1/forecast?latitude=35.8714&longitude=128.6014'
  + '&current=temperature_2m,weather_code,is_day,precipitation,cloud_cover,wind_speed_10m&wind_speed_unit=ms&timezone=Asia%2FSeoul';
export const WEATHER_CREDIT = { text: 'Weather data by Open-Meteo.com', url: 'https://open-meteo.com/', license: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/' };

// 마을에서 보이는 날씨 여덟 가지
export const KINDS = {
  clear: { name: '맑음', icon: '☀️', night: '🌙', line: '해가 반짝, 마을도 맑아요.' },
  partly: { name: '구름 조금', icon: '⛅', night: '☁️', line: '구름이 조금 떠 있어요.' },
  cloudy: { name: '흐림', icon: '☁️', line: '구름이 잔뜩 끼어 마을 하늘도 흐려요.' },
  fog: { name: '안개', icon: '🌫️', line: '안개가 껴서 멀리 있는 곳이 뿌옇게 보여요.' },
  drizzle: { name: '이슬비', icon: '🌦️', line: '이슬비가 보슬보슬 내려요.' },
  rain: { name: '비', icon: '🌧️', line: '마을에도 비가 주룩주룩 내려요.' },
  snow: { name: '눈', icon: '🌨️', line: '마을에도 하얀 눈이 펑펑 내려요.' },
  storm: { name: '천둥번개', icon: '⛈️', line: '번쩍! 우르릉! 천둥번개가 쳐요. 진짜로 천둥이 치면 밖에 나가지 말고 집 안에 있어요.' },
};
export const KIND_IDS = Object.keys(KINDS);

// WMO 날씨 코드 (Open-Meteo 문서의 표) → 마을 날씨, 세기, 한국어 이름
const CODES = {
  0: ['clear', 0, '맑음'], 1: ['clear', 0, '대체로 맑음'], 2: ['partly', 0, '구름 조금'], 3: ['cloudy', 0, '흐림'],
  45: ['fog', 0, '안개'], 48: ['fog', 0, '안개(서리)'],
  51: ['drizzle', 0.3, '약한 이슬비'], 53: ['drizzle', 0.45, '이슬비'], 55: ['drizzle', 0.6, '짙은 이슬비'],
  56: ['drizzle', 0.35, '어는 이슬비'], 57: ['drizzle', 0.6, '어는 이슬비'],
  61: ['rain', 0.45, '약한 비'], 63: ['rain', 0.7, '비'], 65: ['rain', 1, '강한 비'], 66: ['rain', 0.5, '어는 비'], 67: ['rain', 0.9, '강한 어는 비'],
  71: ['snow', 0.45, '약한 눈'], 73: ['snow', 0.7, '눈'], 75: ['snow', 1, '많은 눈'], 77: ['snow', 0.35, '싸락눈'],
  80: ['rain', 0.5, '약한 소나기'], 81: ['rain', 0.75, '소나기'], 82: ['rain', 1, '아주 센 소나기'],
  85: ['snow', 0.55, '약한 눈 소나기'], 86: ['snow', 0.9, '센 눈 소나기'],
  95: ['storm', 0.85, '뇌우'], 96: ['storm', 0.9, '우박이 섞인 뇌우'], 97: ['storm', 1, '강한 뇌우'], 99: ['storm', 1, '큰 우박이 섞인 뇌우'],
};
export function fromCode(code) {
  const c = CODES[code];
  if (c) return { kind: c[0], level: c[1], label: c[2] };
  // 표에 없는 코드는 가까운 무리로
  if (code >= 95) return { kind: 'storm', level: 0.9, label: '뇌우' };
  if (code >= 70 && code < 80) return { kind: 'snow', level: 0.6, label: '눈' };
  if (code >= 50) return { kind: 'rain', level: 0.6, label: '비' };
  return { kind: 'cloudy', level: 0, label: '흐림' };
}
export function iconOf(w) {
  const k = KINDS[w.kind] || KINDS.clear;
  return w.isDay === false && k.night ? k.night : k.icon;
}

const STORE = 'kv.weather.v1';
const EVERY = 15 * 60 * 1000;
const KEEP = 40 * 60 * 1000;

// onChange(w): w = { kind, level, label, code, temp, wind, isDay, time, fetchedAt, preview } 또는 null(아직 모름)
export function createWeather({ onChange, fetchImpl = (u, o) => fetch(u, o) }) {
  let cur = null, preview = null, timer = 0, busy = false;
  const emit = () => onChange(preview ? { ...(cur || { temp: null, wind: 0, isDay: true }), ...preview, preview: true } : cur);
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || 'null');
    if (s && Date.now() - s.fetchedAt < KEEP && Number.isFinite(s.code)) cur = { ...fromCode(s.code), ...s };
  } catch (e) { cur = null; }
  async function load() {
    if (busy) return;
    busy = true;
    const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const to = setTimeout(() => ac && ac.abort(), 8000);
    try {
      const r = await fetchImpl(WEATHER_URL, { cache: 'no-store', signal: ac ? ac.signal : undefined });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json();
      const c = j && j.current;
      if (!c || !Number.isFinite(c.weather_code)) throw new Error('NO_CURRENT');
      const w = {
        code: c.weather_code, temp: Number.isFinite(c.temperature_2m) ? c.temperature_2m : null,
        wind: Number.isFinite(c.wind_speed_10m) ? c.wind_speed_10m : 0, isDay: c.is_day !== 0,
        time: typeof c.time === 'string' ? c.time : '', fetchedAt: Date.now(),
      };
      cur = { ...fromCode(w.code), ...w };
      try { localStorage.setItem(STORE, JSON.stringify(w)); } catch (e) { /* 다음에 다시 받는다 */ }
      emit();
    } catch (e) {
      // 날씨를 못 받으면 하던 날씨를 그대로 둔다 (처음부터 못 받으면 맑은 마을)
    } finally { clearTimeout(to); busy = false; }
  }
  const stale = () => !cur || Date.now() - cur.fetchedAt > EVERY - 5000;
  const onVis = () => { if (!document.hidden && stale()) load(); };
  return {
    start() {
      if (cur || preview) emit();
      if (stale()) load();
      clearInterval(timer);
      timer = setInterval(() => { if (!document.hidden) load(); }, EVERY);
      document.addEventListener('visibilitychange', onVis);
    },
    stop() { clearInterval(timer); document.removeEventListener('visibilitychange', onVis); },
    now() { return preview ? { ...(cur || {}), ...preview, preview: true } : cur; },
    // 체험판: 날씨를 골라 미리 보기 (null이면 진짜 대구 날씨로)
    preview(kind) {
      preview = kind ? { kind, level: kind === 'drizzle' ? 0.4 : kind === 'rain' || kind === 'snow' ? 0.75 : kind === 'storm' ? 0.9 : 0, label: KINDS[kind].name } : null;
      emit();
    },
    refresh: load,
  };
}
