/* ============================================================
   PC · 태블릿 · 모바일 화면 미리보기
   오른쪽 아래 아이콘을 누르면 그 기기 크기로 홈페이지를 보여 줍니다.
   (같은 페이지를 기기 크기의 창 안에 한 번 더 띄우는 방식)
   ============================================================ */
(function () {
  const FRAME_NAME = "bonchodam-device-frame";
  if (window.name === FRAME_NAME) return;          // 미리보기 창 안에서는 아이콘을 띄우지 않음

  const DEVICES = {
    pc:     { label: "PC",     width: null, icon: '<rect x="2" y="3" width="20" height="13" rx="2"/><path d="M8 21h8M12 16v5"/>' },
    tablet: { label: "태블릿", width: 820,  icon: '<rect x="4" y="2" width="16" height="20" rx="2.5"/><path d="M11 18h2"/>' },
    mobile: { label: "모바일", width: 390,  icon: '<rect x="6.5" y="2" width="11" height="20" rx="2.5"/><path d="M11 18h2"/>' }
  };
  const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;

  function start(){
    const bar = document.createElement("div");
    bar.className = "device-bar"; bar.setAttribute("role", "group"); bar.setAttribute("aria-label", "화면 크기로 보기");
    bar.innerHTML = Object.entries(DEVICES).map(([k, d]) =>
      `<button type="button" data-device="${k}" aria-pressed="${k === "pc"}" title="${d.label} 화면으로 보기" aria-label="${d.label} 화면으로 보기">${svg(d.icon)}</button>`).join("");
    document.body.appendChild(bar);

    let stage = null;
    function show(kind){
      bar.querySelectorAll("button").forEach(b => b.setAttribute("aria-pressed", b.dataset.device === kind));
      stage?.remove(); stage = null;
      document.documentElement.style.overflow = "";
      const d = DEVICES[kind];
      if (!d.width) return;                         // PC = 원래 화면
      stage = document.createElement("div");
      stage.className = "device-stage";
      stage.innerHTML = `<div class="device-shell ${kind}">
          <iframe name="${FRAME_NAME}" title="${d.label} 화면 미리보기" style="width:${d.width}px"></iframe>
          <div class="device-label">${d.label} 화면 · 가로 ${d.width}px · 바깥을 누르면 닫힙니다</div></div>`;
      stage.querySelector("iframe").src = location.href.split("#")[0];
      stage.addEventListener("click", e => { if (e.target === stage) show("pc"); });
      document.body.appendChild(stage);
      document.documentElement.style.overflow = "hidden";
    }
    bar.addEventListener("click", e => { const b = e.target.closest("[data-device]"); if (b) show(b.dataset.device); });
    document.addEventListener("keydown", e => { if (e.key === "Escape" && stage) show("pc"); });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
