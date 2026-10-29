/* ============================================================
   본초담 관리자 페이지
   - 관리자(role = admin)로 로그인한 사람만 데이터를 볼 수 있습니다.
   - 화면을 숨기는 것만이 아니라, Supabase 보안 잠금(RLS)이
     관리자가 아니면 데이터 자체를 내주지 않습니다.
   ============================================================ */
let products = [], ingredients = [];
const STATUS_INQ = ["접수", "처리중", "답변완료"];

function toast(t){ const el = $("#toast"); el.textContent = t; el.hidden = false; clearTimeout(toast.k); toast.k = setTimeout(() => el.hidden = true, 2400); }
const empty = (cols, text) => `<tr><td colspan="${cols}" class="muted" style="text-align:center;padding:28px">${text}</td></tr>`;

/* ---------- 관리자 확인 ---------- */
async function boot(){
  const { data: { session } } = await sb.auth.getSession();
  if (!session){
    $("#gate").innerHTML = `<p style="margin:0">관리자 계정으로 로그인해 주세요.</p>
      <form id="adLogin" style="max-width:340px;margin:20px auto 0;text-align:left">
        <label for="adEmail">이메일<input id="adEmail" type="email" required autocomplete="email"></label>
        <label for="adPw">비밀번호<input id="adPw" type="password" required autocomplete="current-password"></label>
        <div class="btns"><button class="btn" type="submit">로그인</button></div>
        <p class="msg" id="adOut" role="status"></p></form>`;
    $("#adLogin").addEventListener("submit", async e => {
      e.preventDefault();
      const { error } = await sb.auth.signInWithPassword({ email: $("#adEmail").value.trim(), password: $("#adPw").value });
      if (error){ $("#adOut").className = "msg err"; $("#adOut").textContent = friendlyError(error); return; }
      boot();
    });
    return;
  }
  const { data: profile } = await sb.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
  if (profile?.role !== "admin"){
    $("#gate").innerHTML = `<p style="margin:0">${esc(session.user.email)} 계정은 관리자 권한이 없습니다.</p>
      <div class="btns"><a class="btn" href="index.html">쇼핑몰로 돌아가기</a>
      <button class="btn ghost" type="button" id="swBtn">다른 계정으로 로그인</button></div>`;
    $("#swBtn").addEventListener("click", async () => { await sb.auth.signOut(); boot(); });
    return;
  }
  $("#acct").innerHTML = `<span class="who">${esc(profile.name)} 관리자님</span>
    <a class="mini" href="index.html">쇼핑몰로 가기</a><button class="mini" type="button" id="outBtn">로그아웃</button>`;
  $("#outBtn").addEventListener("click", async () => { await sb.auth.signOut(); location.href = "index.html"; });
  $("#gate").hidden = true; $("#app").hidden = false;
  await Promise.all([loadDash(), loadProducts()]);
}

/* ---------- 탭 ---------- */
const loaders = { dash: loadDash, orders: loadOrders, products: loadProducts, inquiries: loadInquiries, reviews: loadReviews, members: loadMembers };
$("#tabs").addEventListener("click", e => {
  const b = e.target.closest("[data-view]"); if (!b) return;
  document.querySelectorAll("#tabs button").forEach(x => x.setAttribute("aria-selected", x === b));
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== "v-" + b.dataset.view);
  loaders[b.dataset.view]();
});

/* ---------- 한눈에 보기 ---------- */
async function loadDash(){
  const [o, i, m, r] = await Promise.all([
    sb.from("orders").select("id, created_at, recipient, total, status, order_items(product_name, quantity)").order("created_at", { ascending: false }),
    sb.from("inquiries").select("id", { count: "exact", head: true }).eq("status", "접수"),
    sb.from("profiles").select("id", { count: "exact", head: true }),
    sb.from("reviews").select("rating")
  ]);
  const orders = o.data ?? [];
  const valid = orders.filter(x => x.status !== "주문취소");
  const sales = valid.reduce((s, x) => s + x.total, 0);
  const waiting = orders.filter(x => x.status === "주문접수").length;
  const avg = r.data?.length ? (r.data.reduce((s, x) => s + x.rating, 0) / r.data.length).toFixed(1) : "-";
  $("#kpis").innerHTML = [
    ["누적 매출 (교육용)", won(sales)], ["전체 주문", valid.length + "건"],
    ["처리 대기 주문", waiting + "건", waiting > 0], ["새 문의", (i.count ?? 0) + "건", i.count > 0],
    ["회원 수", (m.count ?? 0) + "명"], ["평균 별점", avg]
  ].map(([k, v, alert]) => `<div class="kpi ${alert ? "alert" : ""}"><small>${k}</small><b>${v}</b></div>`).join("");
  $("#recentOrders").innerHTML = orders.slice(0, 8).map(x => `<tr><td>${x.id}</td><td>${dateTime(x.created_at)}</td><td>${esc(x.recipient)}</td>
    <td>${esc(x.order_items.map(it => it.product_name + "×" + it.quantity).join(", "))}</td><td class="num">${won(x.total)}</td>
    <td><span class="status" data-s="${esc(x.status)}">${esc(x.status)}</span></td></tr>`).join("") || empty(6, "아직 주문이 없습니다.");
}

/* ---------- 주문 관리 ---------- */
async function loadOrders(){
  const { data, error } = await sb.from("orders").select("*, order_items(product_name, quantity, price)").order("created_at", { ascending: false });
  if (error){ toast(friendlyError(error)); return; }
  $("#orderRows").innerHTML = data.map(o => `<tr><td>${o.id}</td><td>${dateTime(o.created_at)}</td>
    <td>${esc(o.recipient)}<br><span class="muted">${esc(o.phone)}</span></td>
    <td>${esc(o.address)}${o.memo ? `<br><span class="muted">${esc(o.memo)}</span>` : ""}</td>
    <td>${o.order_items.map(i => `${esc(i.product_name)} × ${i.quantity}`).join("<br>")}</td>
    <td class="num">${won(o.total)}</td>
    <td><select data-order="${o.id}" aria-label="주문 ${o.id} 상태">${ORDER_STEPS.map(s => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")
    || empty(7, "아직 주문이 없습니다.");
}
$("#orderRows").addEventListener("change", async e => {
  const s = e.target.closest("[data-order]"); if (!s) return;
  const { error } = await sb.from("orders").update({ status: s.value }).eq("id", s.dataset.order);
  toast(error ? friendlyError(error) : `주문 ${s.dataset.order}번 → ${s.value}`);
});

/* ---------- 제품 관리 ---------- */
async function loadProducts(){
  const [p, i] = await Promise.all([
    sb.from("products").select("*, product_ingredients(ingredient_id)").order("sort_order"),
    sb.from("ingredients").select("id, name, hanja").order("sort_order")
  ]);
  products = p.data ?? []; ingredients = i.data ?? [];
  $("#productRows").innerHTML = products.map(x => `<tr><td class="num">${x.sort_order}</td>
    <td>${x.image_url
        ? `<img src="${esc(x.image_url)}" alt="" width="36" height="36" style="width:36px;height:36px;object-fit:cover;vertical-align:middle;margin-right:10px;border:1px solid var(--line)">`
        : `<span class="dot" style="--c:${esc(x.color)};width:14px;height:14px;display:inline-block;vertical-align:middle;margin-right:8px"></span>`}${esc(x.name)}${x.is_featured ? ' <span class="badge">추천</span>' : ""}</td>
    <td>${esc(x.category)}</td><td class="num">${won(x.price)}</td>
    <td><label class="check"><input type="checkbox" data-active="${x.id}" ${x.is_active ? "checked" : ""}> ${x.is_active ? "판매 중" : "숨김"}</label></td>
    <td><button class="mini" type="button" data-edit="${x.id}">수정</button></td></tr>`).join("") || empty(6, "등록된 제품이 없습니다.");
  renderIngChecks([]);
}

function renderIngChecks(selected){
  $("#pfIngs").innerHTML = `<span class="muted" style="width:100%">주요 원료</span>` + ingredients.map(i =>
    `<label class="check"><input type="checkbox" value="${i.id}" ${selected.includes(i.id) ? "checked" : ""}> ${esc(i.name)} ${esc(i.hanja)}</label>`).join("");
}

function fillForm(p){
  $("#pfId").value = p?.id ?? ""; $("#pfName").value = p?.name ?? ""; $("#pfCat").value = p?.category ?? "";
  $("#pfPrice").value = p?.price ?? ""; $("#pfVol").value = p?.volume ?? ""; $("#pfColor").value = p?.color ?? "#B8925A";
  $("#pfStep").value = p?.routine_step ?? ""; $("#pfSort").value = p?.sort_order ?? 10;
  $("#pfImg").value = p?.image_url ?? "";
  showPreview(p?.image_url);
  $("#pfUpMsg").className = "muted"; $("#pfUpMsg").textContent = "사진을 고르면 800×800 크기로 줄여서 Supabase 사진 보관함에 올립니다.";
  $("#pfSummary").value = p?.summary ?? ""; $("#pfDesc").value = p?.description ?? ""; $("#pfHow").value = p?.how_to_use ?? "";
  $("#pfFeat").checked = !!p?.is_featured; $("#pfActive").checked = p ? p.is_active : true;
  renderIngChecks(p ? p.product_ingredients.map(x => x.ingredient_id) : []);
  $("#pfTitle").textContent = p ? `제품 수정 · ${p.name}` : "새 제품 등록";
  $("#pfSubmit").textContent = p ? "수정 저장" : "등록하기"; $("#pfOut").textContent = "";
}

$("#productRows").addEventListener("click", e => {
  const b = e.target.closest("[data-edit]"); if (!b) return;
  fillForm(products.find(p => p.id === Number(b.dataset.edit)));
  $("#productForm").scrollIntoView({ behavior: "smooth" });
});
$("#productRows").addEventListener("change", async e => {
  const c = e.target.closest("[data-active]"); if (!c) return;
  const { error } = await sb.from("products").update({ is_active: c.checked }).eq("id", c.dataset.active);
  toast(error ? friendlyError(error) : (c.checked ? "쇼핑몰에 다시 보입니다." : "쇼핑몰에서 숨겼습니다."));
  loadProducts();
});
$("#pfReset").addEventListener("click", () => fillForm(null));

$("#productForm").addEventListener("submit", async e => {
  e.preventDefault();
  const out = $("#pfOut"), id = $("#pfId").value;
  const row = {
    name: $("#pfName").value.trim(), category: $("#pfCat").value.trim(), price: Number($("#pfPrice").value),
    volume: $("#pfVol").value.trim(), color: $("#pfColor").value, routine_step: $("#pfStep").value ? Number($("#pfStep").value) : null,
    sort_order: Number($("#pfSort").value || 0), image_url: $("#pfImg").value.trim() || null, summary: $("#pfSummary").value.trim(), description: $("#pfDesc").value.trim(),
    how_to_use: $("#pfHow").value.trim(), is_featured: $("#pfFeat").checked, is_active: $("#pfActive").checked
  };
  out.className = "msg"; out.textContent = "저장하는 중…";
  const res = id ? await sb.from("products").update(row).eq("id", id).select("id").single()
                 : await sb.from("products").insert(row).select("id").single();
  if (res.error){ out.className = "msg err"; out.textContent = friendlyError(res.error); return; }
  const pid = res.data.id;
  const chosen = [...document.querySelectorAll("#pfIngs input:checked")].map(x => ({ product_id: pid, ingredient_id: Number(x.value) }));
  await sb.from("product_ingredients").delete().eq("product_id", pid);
  if (chosen.length) await sb.from("product_ingredients").insert(chosen);
  toast(id ? "제품 정보를 수정했습니다." : "새 제품을 등록했습니다. 쇼핑몰에 바로 보입니다.");
  fillForm(null); loadProducts();
});

/* ---------- 제품 사진 올리기 (Supabase 사진 보관함) ---------- */
const BUCKET = "product-images";

function showPreview(url){
  const img = $("#pfPreview");
  img.hidden = !url; if (url) img.src = url;
  $("#pfImgClear").hidden = !url;
}
$("#pfImg").addEventListener("input", e => showPreview(e.target.value.trim()));

// 큰 사진을 800×800 정사각형으로 잘라서 줄이기 (가운데 기준)
async function shrinkImage(file, size = 800){
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const canvas = document.createElement("canvas"); canvas.width = canvas.height = size;
  canvas.getContext("2d").drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
  const blob = await new Promise(r => canvas.toBlob(r, "image/webp", 0.8));
  if (blob && blob.type === "image/webp") return blob;
  return new Promise(r => canvas.toBlob(r, "image/jpeg", 0.85));   // WebP를 못 만드는 브라우저용
}

$("#pfFile").addEventListener("change", async e => {
  const file = e.target.files[0]; e.target.value = "";
  if (!file) return;
  const msg = $("#pfUpMsg");
  if (!file.type.startsWith("image/")){ msg.className = "msg err"; msg.textContent = "사진 파일(PNG, JPG, WebP)만 올릴 수 있습니다."; return; }
  if (file.size > 20 * 1024 * 1024){ msg.className = "msg err"; msg.textContent = "20MB보다 큰 사진은 올릴 수 없습니다."; return; }
  try{
    msg.className = "muted"; msg.textContent = "사진 크기를 줄이는 중…";
    const blob = await shrinkImage(file);
    const ext = blob.type === "image/webp" ? "webp" : "jpg";
    const path = `products/${Date.now()}.${ext}`;
    msg.textContent = `올리는 중… (${Math.round(file.size / 1024)}KB → ${Math.round(blob.size / 1024)}KB)`;
    const { error } = await sb.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, upsert: false });
    if (error) throw error;
    const url = sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
    $("#pfImg").value = url; showPreview(url);
    const id = $("#pfId").value;
    if (id){   // 이미 있는 제품이면 바로 반영
      const { error: upErr } = await sb.from("products").update({ image_url: url }).eq("id", id);
      if (upErr) throw upErr;
      await loadProducts(); fillForm(products.find(p => p.id === Number(id)));
      $("#pfUpMsg").className = "msg ok"; $("#pfUpMsg").textContent = "사진을 올렸습니다. 쇼핑몰에 바로 반영되었습니다.";
      toast("제품 사진을 바꿨습니다.");
    } else {
      msg.className = "msg ok"; msg.textContent = `사진을 올렸습니다 (${Math.round(blob.size / 1024)}KB). 아래 '등록하기'를 누르면 제품과 함께 저장됩니다.`;
    }
  }catch(err){
    console.error(err);
    msg.className = "msg err"; msg.textContent = "사진을 올리지 못했습니다. " + friendlyError(err);
  }
});

$("#pfImgClear").addEventListener("click", () => {
  $("#pfImg").value = ""; showPreview("");
  $("#pfUpMsg").className = "muted"; $("#pfUpMsg").textContent = "사진을 뺐습니다. 저장 버튼을 누르면 병 그림으로 바뀝니다.";
});

/* ---------- 문의 ---------- */
async function loadInquiries(){
  const { data } = await sb.from("inquiries").select("*").order("created_at", { ascending: false });
  $("#inqRows").innerHTML = (data ?? []).map(q => `<tr><td>${dateTime(q.created_at)}</td><td>${esc(q.name)}</td><td>${esc(q.contact)}</td>
    <td style="max-width:360px;white-space:pre-wrap">${esc(q.message)}</td>
    <td><select data-inq="${q.id}" aria-label="문의 상태">${STATUS_INQ.map(s => `<option ${s === q.status ? "selected" : ""}>${s}</option>`).join("")}</select></td></tr>`).join("")
    || empty(5, "들어온 문의가 없습니다.");
}
$("#inqRows").addEventListener("change", async e => {
  const s = e.target.closest("[data-inq]"); if (!s) return;
  const { error } = await sb.from("inquiries").update({ status: s.value }).eq("id", s.dataset.inq);
  toast(error ? friendlyError(error) : "문의 상태를 바꿨습니다.");
});

/* ---------- 후기 ---------- */
async function loadReviews(){
  const { data } = await sb.from("reviews").select("*, products(name)").order("created_at", { ascending: false });
  $("#rvRows").innerHTML = (data ?? []).map(r => `<tr><td>${date(r.created_at)}</td><td>${esc(r.products?.name)}</td><td>${esc(r.author)}</td>
    <td style="color:var(--gold);white-space:nowrap">${stars(r.rating)}</td><td style="max-width:360px">${esc(r.content)}</td>
    <td><label class="check"><input type="checkbox" data-rv="${r.id}" ${r.is_visible ? "checked" : ""}> ${r.is_visible ? "공개" : "숨김"}</label></td></tr>`).join("")
    || empty(6, "후기가 없습니다.");
}
$("#rvRows").addEventListener("change", async e => {
  const c = e.target.closest("[data-rv]"); if (!c) return;
  const { error } = await sb.from("reviews").update({ is_visible: c.checked }).eq("id", c.dataset.rv);
  toast(error ? friendlyError(error) : (c.checked ? "후기를 다시 공개했습니다." : "후기를 숨겼습니다."));
  loadReviews();
});

/* ---------- 회원·구독 ---------- */
async function loadMembers(){
  const [m, n] = await Promise.all([
    sb.from("profiles").select("*").order("created_at", { ascending: false }),
    sb.from("newsletter").select("*").order("created_at", { ascending: false })
  ]);
  $("#memRows").innerHTML = (m.data ?? []).map(x => `<tr><td>${date(x.created_at)}</td><td>${esc(x.name)}</td><td>${esc(x.email)}</td>
    <td>${x.role === "admin" ? '<span class="badge">관리자</span>' : "고객"}</td></tr>`).join("") || empty(4, "아직 회원이 없습니다.");
  $("#nlRows").innerHTML = (n.data ?? []).map(x => `<tr><td>${date(x.created_at)}</td><td>${esc(x.email)}</td></tr>`).join("") || empty(2, "구독자가 없습니다.");
}

boot();
