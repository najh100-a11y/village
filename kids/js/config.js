// 진숲 어린이 마을 — 서버 주소 (공개용 키: 모든 데이터는 서버의 RPC 함수와 보안 규칙으로 보호됩니다)
export const SUPABASE_URL = 'https://dujqmycvyrcixcqzzynv.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR1anFteWN2eXJjaXhjcXp6eW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4NzM4NzcsImV4cCI6MjEwNjQ0OTg3N30.mgFBqzHz-iSEYybLBxdQkBbtKbN6Oj6Yq9h4hcqawJo';

// 함께 접속에서 마을 전체가 1초에 쓸 메시지 수의 상한.
// Supabase 무료 요금제의 실시간 한도는 초당 100개다. 사용량 안내에는 방송 메시지 하나를 "보낸 1개 + 받은 사람 수"로
// 센다고 되어 있고, 초당 한도도 같은 방식으로 센다고 보고 여유를 둔다.
// 그래서 접속한 사람이 n명이면 한 사람이 1초에 보낼 수 있는 양을 (상한 ÷ n²)으로 줄인다.
// 실제 사용량(대시보드)을 보고 넉넉하면 이 값을 올려도 된다.
export const REALTIME_BUDGET = 50;
