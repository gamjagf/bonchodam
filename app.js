/* ============================================================
   본초담 쇼핑몰 동작 코드
   ① 공개 데이터(제품·원료·후기) 불러오기
   ② 회원가입 · 로그인
   ③ 장바구니 담기 · 수량 변경
   ④ 주문하기 · 내 주문 보기
   ============================================================ */

let products = [], reviews = [], activeCat = "전체";
let user = null, profile = null, cart = [];

function toast(text){
  const t = $("#toast"); t.textContent = text; t.hidden = false;
  clearTimeout(toast.timer); toast.timer = setTimeout(() => t.hidden = true, 2600);
}
function setLive(state, text){
  const el = $("#live"); el.className = "live " + state; el.querySelector("span").textContent = text;
}

/* ---------- ① 공개 데이터 ---------- */
async function loadReviews(){
  const { data, error } = await sb.from("reviews").select("*").order("created_at", { ascending: false });
  if (error) throw error; reviews = data;
}

async function loadPublic(){
  try{
    const [p, i] = await Promise.all([
      sb.from("products").select("*, product_ingredients(ingredients(name,hanja))").eq("is_active", true).order("sort_order"),
      sb.from("ingredients").select("*").order("sort_order"),
      loadReviews()
    ]);
    if (p.error) throw p.error; if (i.error) throw i.error;
    products = p.data;
    renderFilters(); renderProducts(); renderRoutine(); renderReviews();
    $("#ingList").innerHTML = i.data.map(x => `
      <div class="ing" style="--c:${ING_COLORS[x.name] ?? "var(--blush)"}">
        <div class="en">${esc(x.english)}</div>
        <h3>${esc(x.name)}</h3><p>${esc(x.story)}</p>
        <div class="origin">산지 · ${esc(x.origin)}</div></div>`).join("");
    setLive("ok", `Supabase 실시간 연결됨 · 제품 ${products.length}개 · 원료 ${i.data.length}개`);
  }catch(err){
    console.error(err);
    setLive("err", "데이터 창고에 연결하지 못했습니다. 새로고침해 주세요.");
    $("#productGrid").innerHTML = `<div class="empty">제품 정보를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 새로고침해 주세요.</div>`;
  }
}

function renderFilters(){
  const cats = ["전체", ...new Set(products.map(p => p.category))];
  $("#filters").innerHTML = cats.map(c =>
    `<button class="chip" type="button" aria-pressed="${c === activeCat}" data-cat="${esc(c)}">${esc(c)}</button>`).join("");
}

// 원료마다 어울리는 파스텔 색 (원료 카드 오른쪽 위 동그라미)
const ING_COLORS = { "홍삼": "#F6D3CC", "쑥": "#DCEBD3", "감초": "#F7E8C2", "당귀": "#EEDDD0",
  "대추": "#F7D1D9", "녹차": "#D6ECDA", "오미자": "#F4CCD8" };

// 제품 사진이 있으면 사진을, 없으면 병 그림을 보여 줍니다
function productVisual(p, hanja){
  return p.image_url
    ? `<div class="pimg"><img src="${esc(p.image_url)}" alt="${esc(p.name)}" loading="lazy" width="800" height="800"></div>`
    : `<div class="bottle"><span style="--c:${esc(p.color)}" data-h="${esc(hanja)}"></span></div>`;
}

function renderProducts(){
  const list = activeCat === "전체" ? products : products.filter(p => p.category === activeCat);
  $("#productGrid").innerHTML = list.length ? list.map(p => {
    const h = p.product_ingredients[0]?.ingredients?.hanja ?? "";
    return `<button class="prod" type="button" data-id="${p.id}">
      ${productVisual(p, h)}
      <div class="cat">${esc(p.category)}${p.is_featured ? '<span class="badge">추천</span>' : ""}</div>
      <h3>${esc(p.name)}</h3><p>${esc(p.summary)}</p>
      <div class="foot"><span class="price">${won(p.price)}</span><small>${esc(p.volume)}</small></div>
    </button>`; }).join("") : `<div class="empty">이 분류에는 아직 제품이 없습니다.</div>`;
}

function renderRoutine(){
  const steps = products.filter(p => p.routine_step).sort((a, b) => a.routine_step - b.routine_step);
  $("#routineList").innerHTML = steps.map(p => `
    <div class="step"><b>${String(p.routine_step).padStart(2, "0")}</b>
      <h3>${esc(p.category)} · ${esc(p.name)}</h3><p>${esc(p.how_to_use)}</p></div>`).join("");
}

function renderReviews(){
  const name = id => products.find(p => p.id === id)?.name ?? "";
  $("#reviewList").innerHTML = reviews.slice(0, 6).map(r => `
    <article class="rv"><div class="stars" aria-label="별점 ${r.rating}점">${stars(r.rating)}</div>
      <p>${esc(r.content)}</p><small>${esc(r.author)} · ${esc(name(r.product_id))} · ${date(r.created_at)}</small></article>`).join("")
    || `<p class="note">아직 후기가 없습니다.</p>`;
}

function openDetail(id){
  const p = products.find(x => x.id === id); if (!p) return;
  const ings = p.product_ingredients.map(x => x.ingredients);
  const rvs = reviews.filter(r => r.product_id === id);
  const avg = rvs.length ? (rvs.reduce((s, r) => s + r.rating, 0) / rvs.length).toFixed(1) : "-";
  $("#detailBody").innerHTML = `
    <button class="close" type="button" aria-label="닫기" data-close>×</button>
    ${p.image_url ? `<img class="dlg-img" src="${esc(p.image_url)}" alt="${esc(p.name)}" width="800" height="800">` : ""}
    <div><div class="eyebrow">${esc(p.category)}</div><h2>${esc(p.name)}</h2></div>
    <div class="tags">${ings.map(i => `<span class="tag">${esc(i.name)}</span>`).join("")}</div>
    <p style="margin:0">${esc(p.description)}</p>
    <dl><dt>가격</dt><dd>${won(p.price)}</dd><dt>용량</dt><dd>${esc(p.volume)}</dd>
        <dt>사용법</dt><dd>${esc(p.how_to_use)}</dd><dt>평균 별점</dt><dd>${avg} (${rvs.length}개)</dd></dl>
    <div class="add-row">
      <label for="addQty">수량<select id="addQty">${Array.from({ length: 10 }, (_, i) => `<option>${i + 1}</option>`).join("")}</select></label>
      <button class="btn" type="button" id="addCartBtn">장바구니 담기</button>
    </div>
    <div style="display:grid;gap:12px">${rvs.map(r => `<div class="rv"><div class="stars">${stars(r.rating)}</div><p>${esc(r.content)}</p><small>${esc(r.author)} · ${date(r.created_at)}</small></div>`).join("")}</div>
    <form id="reviewForm" style="border-top:1px solid var(--line);padding-top:18px">
      <h3 style="font-size:18px">후기 남기기</h3>
      <label for="rvAuthor">이름(닉네임)<input id="rvAuthor" maxlength="20" required value="${esc(profile?.name ?? "")}"></label>
      <label for="rvRating">별점<select id="rvRating">${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${stars(n)} ${n}점</option>`).join("")}</select></label>
      <label for="rvContent">내용<textarea id="rvContent" minlength="5" maxlength="500" required></textarea></label>
      <div class="btns"><button class="btn ghost" type="submit">후기 등록</button></div>
      <p class="msg" id="rvOut" role="status"></p>
    </form>`;
  $("#addCartBtn").addEventListener("click", () => addToCart(id, Number($("#addQty").value)));
  $("#reviewForm").addEventListener("submit", async e => {
    e.preventDefault();
    const btn = e.target.querySelector("button[type=submit]"), out = $("#rvOut");
    btn.disabled = true; out.className = "msg"; out.textContent = "저장하는 중…";
    const { error } = await sb.from("reviews").insert({ product_id: id, author: $("#rvAuthor").value.trim(),
      rating: Number($("#rvRating").value), content: $("#rvContent").value.trim() });
    if (error){ out.className = "msg err"; out.textContent = "이름과 내용(5자 이상)을 확인해 주세요."; btn.disabled = false; return; }
    await loadReviews(); renderReviews(); openDetail(id);
    $("#rvOut").className = "msg ok"; $("#rvOut").textContent = "후기가 등록되었습니다. 감사합니다!";
  });
  if (!$("#detail").open) $("#detail").showModal();
}

/* ---------- ② 회원가입 · 로그인 ---------- */
let authMode = "login";
function openAuth(mode){
  authMode = mode;
  const signup = mode === "signup";
  $("#tabLogin").setAttribute("aria-selected", !signup);
  $("#tabSignup").setAttribute("aria-selected", signup);
  $("#auNameWrap").hidden = !signup;
  $("#auSubmit").textContent = signup ? "가입하기" : "로그인";
  $("#auPw").autocomplete = signup ? "new-password" : "current-password";
  $("#auOut").textContent = "";
  if (!$("#authDlg").open) $("#authDlg").showModal();
}

$("#authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const out = $("#auOut"), btn = $("#auSubmit");
  const email = $("#auEmail").value.trim(), password = $("#auPw").value;
  btn.disabled = true; out.className = "msg"; out.textContent = "확인하는 중…";
  let result;
  if (authMode === "signup"){
    result = await sb.auth.signUp({ email, password, options: { data: { name: $("#auName").value.trim() || email.split("@")[0] } } });
  } else {
    result = await sb.auth.signInWithPassword({ email, password });
  }
  btn.disabled = false;
  if (result.error){ out.className = "msg err"; out.textContent = friendlyError(result.error); return; }
  if (authMode === "signup" && !result.data.session){
    out.className = "msg ok"; out.textContent = "가입 확인 메일을 보냈습니다. 메일의 링크를 누른 뒤 로그인해 주세요."; return;
  }
  $("#authDlg").close(); e.target.reset();
  toast(authMode === "signup" ? "가입을 환영합니다!" : "로그인되었습니다.");
});

async function logout(){ await sb.auth.signOut(); toast("로그아웃되었습니다."); }

// 로그인 상태가 바뀔 때마다 화면을 새로 그립니다
sb.auth.onAuthStateChange((_event, session) => {
  const newUser = session?.user ?? null;
  if (newUser?.id === user?.id && profile) return;
  user = newUser;
  setTimeout(refreshMember, 0);
});

async function refreshMember(){
  profile = null; cart = [];
  if (user){
    const { data } = await sb.from("profiles").select("*").eq("id", user.id).maybeSingle();
    profile = data;
    await loadCart();
  }
  renderAccount(); renderCart(); loadOrders();
}

function renderAccount(){
  const count = cart.reduce((s, c) => s + c.quantity, 0);
  const cartLink = `<a class="mini" href="#cart">장바구니 <span class="count">${count}</span></a>`;
  $("#acct").innerHTML = user
    ? `<span class="who">${esc(profile?.name ?? user.email)}님</span>
       ${profile?.role === "admin" ? '<a class="mini dark" href="admin.html">관리자</a>' : ""}
       ${cartLink}<button class="mini" type="button" id="logoutBtn">로그아웃</button>`
    : `${cartLink}<button class="mini" type="button" data-open-auth="signup">회원가입</button>
       <button class="mini dark" type="button" data-open-auth="login">로그인</button>`;
  $("#logoutBtn")?.addEventListener("click", logout);
}

function loginGate(text){
  return `<div class="panel gate"><p style="margin:0">${text}</p>
    <div class="btns"><button class="btn" type="button" data-open-auth="login">로그인</button>
    <button class="btn ghost" type="button" data-open-auth="signup">회원가입</button></div></div>`;
}

/* ---------- ③ 장바구니 ---------- */
async function loadCart(){
  const { data, error } = await sb.from("cart_items")
    .select("product_id, quantity, products(name, price, volume, color, image_url, is_active)").order("created_at");
  cart = error ? [] : data.filter(c => c.products?.is_active);
}

async function addToCart(productId, qty){
  if (!user){ $("#detail").close(); openAuth("login"); toast("장바구니는 로그인 후 쓸 수 있습니다."); return; }
  const existing = cart.find(c => c.product_id === productId);
  const quantity = Math.min(99, (existing?.quantity ?? 0) + qty);
  const { error } = await sb.from("cart_items").upsert({ user_id: user.id, product_id: productId, quantity });
  if (error){ toast(friendlyError(error)); return; }
  await loadCart(); renderAccount(); renderCart();
  $("#detail").close(); toast("장바구니에 담았습니다.");
}

async function changeQty(productId, quantity){
  const q = quantity < 1
    ? sb.from("cart_items").delete().eq("product_id", productId)
    : sb.from("cart_items").update({ quantity: Math.min(99, quantity) }).eq("product_id", productId);
  const { error } = await q;
  if (error){ toast(friendlyError(error)); return; }
  await loadCart(); renderAccount(); renderCart();
}

function renderCart(){
  const area = $("#cartArea");
  if (!user){ area.innerHTML = loginGate("로그인하면 장바구니에 담은 제품을 볼 수 있습니다."); return; }
  if (!cart.length){
    area.innerHTML = `<div class="panel gate"><p style="margin:0">장바구니가 비어 있습니다.</p>
      <div class="btns"><a class="btn" href="#products">제품 보러 가기</a></div></div>`; return;
  }
  const total = cart.reduce((s, c) => s + c.products.price * c.quantity, 0);
  area.innerHTML = `<div class="cart-wrap">
    <div class="panel">${cart.map(c => `
      <div class="line">${c.products.image_url
          ? `<img class="dot" src="${esc(c.products.image_url)}" alt="" width="44" height="44">`
          : `<div class="dot" style="--c:${esc(c.products.color)}"></div>`}
        <div style="min-width:0"><h4>${esc(c.products.name)}</h4><small>${won(c.products.price)} · ${esc(c.products.volume)}</small><br>
          <button class="rm" type="button" data-rm="${c.product_id}">빼기</button></div>
        <div style="text-align:right"><div class="qty">
          <button type="button" aria-label="하나 줄이기" data-q="${c.product_id}" data-d="-1">−</button>
          <span>${c.quantity}</span>
          <button type="button" aria-label="하나 늘리기" data-q="${c.product_id}" data-d="1">+</button></div>
          <small>${won(c.products.price * c.quantity)}</small></div>
      </div>`).join("")}
      <div class="sum"><span>합계</span><b>${won(total)}</b></div>
    </div>
    <form class="panel" id="orderForm">
      <h3 style="font-size:20px">주문서</h3>
      <p class="edu">교육용 주문입니다. 실제 결제와 배송은 없으니 가상의 정보를 입력해 주세요.</p>
      <label for="odName">받는 분<input id="odName" maxlength="30" required value="${esc(profile?.name ?? "")}"></label>
      <label for="odPhone">연락처<input id="odPhone" inputmode="tel" minlength="8" maxlength="20" required placeholder="010-0000-0000"></label>
      <label for="odAddr">주소<input id="odAddr" minlength="5" maxlength="200" required placeholder="경남 창원시 진해구 ○○로 00"></label>
      <label for="odMemo">배송 메모 (선택)<input id="odMemo" maxlength="200"></label>
      <div class="btns"><button class="btn" type="submit">${won(total)} 주문하기</button></div>
      <p class="msg" id="odOut" role="status"></p>
    </form></div>`;
}

$("#cartArea").addEventListener("click", e => {
  const q = e.target.closest("[data-q]"), rm = e.target.closest("[data-rm]");
  if (q){ const c = cart.find(x => x.product_id === Number(q.dataset.q)); changeQty(c.product_id, c.quantity + Number(q.dataset.d)); }
  if (rm) changeQty(Number(rm.dataset.rm), 0);
});

/* ---------- ④ 주문하기 · 내 주문 ---------- */
$("#cartArea").addEventListener("submit", async e => {
  if (e.target.id !== "orderForm") return;
  e.preventDefault();
  const out = $("#odOut"), btn = e.target.querySelector("button[type=submit]");
  btn.disabled = true; out.className = "msg"; out.textContent = "주문하는 중…";
  // 금액 계산은 서버(place_order 함수)가 직접 합니다 → 화면에서 가격을 바꿔도 소용없음
  const { data: orderId, error } = await sb.rpc("place_order", {
    p_recipient: $("#odName").value.trim(), p_phone: $("#odPhone").value.trim(),
    p_address: $("#odAddr").value.trim(), p_memo: $("#odMemo").value.trim() });
  if (error){ out.className = "msg err"; out.textContent = friendlyError(error); btn.disabled = false; return; }
  await loadCart(); renderAccount(); renderCart(); await loadOrders();
  toast(`주문번호 ${orderId}번 주문이 접수되었습니다.`);
  location.hash = "orders";
});

async function loadOrders(){
  const area = $("#ordersArea");
  if (!user){ area.innerHTML = loginGate("로그인하면 주문 내역과 배송 상태를 볼 수 있습니다."); return; }
  const { data, error } = await sb.from("orders")
    .select("*, order_items(product_name, price, quantity)").eq("user_id", user.id).order("created_at", { ascending: false });
  if (error){ area.innerHTML = `<p class="msg err">주문 내역을 불러오지 못했습니다.</p>`; return; }
  if (!data.length){ area.innerHTML = `<div class="panel gate"><p style="margin:0">아직 주문 내역이 없습니다.</p></div>`; return; }
  area.innerHTML = `<div class="orders">${data.map(o => {
    const stepIdx = ORDER_STEPS.indexOf(o.status);
    return `<article class="order">
      <div class="order-head"><b>주문번호 ${o.id}</b><span class="status" data-s="${esc(o.status)}">${esc(o.status)}</span></div>
      ${o.status !== "주문취소" ? `<div class="track" aria-label="배송 진행 ${stepIdx + 1}/4">${[0, 1, 2, 3].map(i => `<i class="${i <= stepIdx ? "on" : ""}"></i>`).join("")}</div>` : ""}
      <ul>${o.order_items.map(i => `<li>${esc(i.product_name)} × ${i.quantity} · ${won(i.price * i.quantity)}</li>`).join("")}</ul>
      <div class="order-head"><small style="color:var(--meok-soft)">${dateTime(o.created_at)} · ${esc(o.recipient)} · ${esc(o.address)}</small>
        <span><b style="font-size:15px">${won(o.total)}</b>
        ${o.status === "주문접수" ? `<button class="mini" type="button" data-cancel="${o.id}" style="margin-left:8px">주문 취소</button>` : ""}</span></div>
    </article>`; }).join("")}</div>`;
}

$("#ordersArea").addEventListener("click", async e => {
  const b = e.target.closest("[data-cancel]"); if (!b) return;
  if (b.dataset.confirm !== "1"){ b.dataset.confirm = "1"; b.textContent = "정말 취소할까요?"; return; }
  const { error } = await sb.rpc("cancel_order", { p_order_id: Number(b.dataset.cancel) });
  if (error){ toast(friendlyError(error)); return; }
  toast("주문을 취소했습니다."); loadOrders();
});

/* ---------- 공통 버튼 동작 ---------- */
document.addEventListener("click", e => {
  const a = e.target.closest("[data-open-auth]");
  if (a){ $("#detail").open && $("#detail").close(); openAuth(a.dataset.openAuth); }
  const c = e.target.closest("[data-close]"); if (c) c.closest("dialog").close();
  if (e.target.tagName === "DIALOG") e.target.close();
});
$("#tabLogin").addEventListener("click", () => openAuth("login"));
$("#tabSignup").addEventListener("click", () => openAuth("signup"));
$("#filters").addEventListener("click", e => {
  const b = e.target.closest(".chip"); if (!b) return;
  activeCat = b.dataset.cat; renderFilters(); renderProducts();
});
$("#productGrid").addEventListener("click", e => {
  const b = e.target.closest(".prod"); if (b) openDetail(Number(b.dataset.id));
});
document.querySelector(".moments").addEventListener("click", e => {
  const b = e.target.closest(".moment"); if (b) openDetail(Number(b.dataset.id));
});

$("#inquiryForm").addEventListener("submit", async e => {
  e.preventDefault();
  const out = $("#iqOut"), btn = e.target.querySelector("button");
  btn.disabled = true; out.className = "msg"; out.textContent = "보내는 중…";
  const { error } = await sb.from("inquiries").insert({ name: $("#iqName").value.trim(),
    contact: $("#iqContact").value.trim(), message: $("#iqMsg").value.trim() });
  btn.disabled = false;
  if (error){ out.className = "msg err"; out.textContent = "접수하지 못했습니다. 입력 내용을 확인해 주세요."; return; }
  e.target.reset(); out.className = "msg ok"; out.textContent = "문의가 접수되었습니다. 곧 연락드리겠습니다.";
});

$("#newsForm").addEventListener("submit", async e => {
  e.preventDefault();
  const out = $("#nlOut"), btn = e.target.querySelector("button");
  btn.disabled = true; out.className = "msg"; out.textContent = "신청하는 중…";
  const { error } = await sb.from("newsletter").insert({ email: $("#nlEmail").value.trim() });
  btn.disabled = false;
  if (error){ out.className = "msg err"; out.textContent = error.code === "23505" ? "이미 구독 중인 이메일입니다." : "이메일 주소를 확인해 주세요."; return; }
  e.target.reset(); out.className = "msg ok"; out.textContent = "구독 신청이 완료되었습니다.";
});

/* ---------- 시작 ---------- */
loadPublic();
renderCart(); loadOrders();
