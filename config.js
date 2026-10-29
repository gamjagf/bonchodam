/* ============================================================
   본초담 공통 설정 — 모든 페이지가 이 파일을 함께 씁니다.
   - SUPABASE_URL : 우리 데이터 창고의 주소
   - SUPABASE_KEY : "방문자용 출입증" (공개되어도 괜찮은 키)
     창고에 RLS 보안 잠금이 걸려 있어서, 이 키로는
     정해진 일(보기·후기쓰기·내 장바구니 등)만 할 수 있습니다.
   ============================================================ */
const SUPABASE_URL = "https://mxiilctpchgtncqxlmtq.supabase.co";
const SUPABASE_KEY = "sb_publishable_ZJc_dzSLMHCW2EcZCNa7jA_SJ2Xl-cL";

// Supabase 연결 도구 만들기 (로그인 상태도 이 도구가 기억합니다)
const sb = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : undefined;

// 자주 쓰는 작은 도구들
const $ = s => document.querySelector(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const won = n => Number(n).toLocaleString("ko-KR") + "원";
const stars = r => "★".repeat(r) + "☆".repeat(5 - r);
const date = d => new Date(d).toLocaleDateString("ko-KR");
const dateTime = d => new Date(d).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" });
const ORDER_STEPS = ["주문접수", "배송준비", "배송중", "배송완료", "주문취소"];

// 영어 오류 메시지를 알아듣기 쉬운 한국어로 바꾸기
function friendlyError(err){
  const m = (err && (err.message || err.msg || String(err))) || "";
  if (/Invalid login credentials/i.test(m)) return "이메일 또는 비밀번호가 맞지 않습니다.";
  if (/Email not confirmed/i.test(m)) return "가입 확인 메일의 링크를 먼저 눌러 주세요.";
  if (/already registered|already exists/i.test(m)) return "이미 가입된 이메일입니다. 로그인해 주세요.";
  if (/Password should be at least/i.test(m)) return "비밀번호는 6자 이상으로 정해 주세요.";
  if (/rate limit/i.test(m)) return "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.";
  if (/duplicate key/i.test(m)) return "이미 등록된 정보입니다.";
  if (/check constraint/i.test(m)) return "입력한 내용의 길이나 형식을 확인해 주세요.";
  if (/[가-힣]/.test(m)) return m;          // 우리가 만든 한국어 메시지는 그대로
  return "처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
