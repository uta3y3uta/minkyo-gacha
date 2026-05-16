/* =========================================================
   みん教ガチャ
   ========================================================= */

const STORAGE_KEY = "minkyo-gacha-v1";
const ARTICLES_URL = "articles.json";
const CAPSULE_COLORS = [
  "#ff7aa2", "#ffae5a", "#ffd66e", "#a8e063",
  "#5dd6c2", "#5dbef7", "#9d8df1", "#d792f0",
  "#ff8a8a", "#7ed957", "#56ccf2", "#bb6bd9"
];
const CAPSULE_COLORS_DARK = [
  "#d8516f", "#d88636", "#cfa83a", "#7eb83f",
  "#36a892", "#3494d0", "#6e62cc", "#a865c0",
  "#d65c5c", "#56a838", "#3aa3c8", "#8d49a8"
];
function colorPair(idx) {
  const n = CAPSULE_COLORS.length;
  const i = ((idx % n) + n) % n;
  return { c: CAPSULE_COLORS[i], d: CAPSULE_COLORS_DARK[i] };
}

let state = {
  articles: [],          // [{ id, title, url, date, category }]
  updated: null,         // ISO 8601
  collection: [],        // 既読の id
  allowDuplicate: false,
  lastPickedId: null,
};
let isSpinning = false;

window.addEventListener("DOMContentLoaded", init);

async function init() {
  const saved = loadLocal();
  if (saved) {
    state.collection = Array.isArray(saved.collection) ? saved.collection : [];
    state.allowDuplicate = !!saved.allowDuplicate;
  }

  bindNav();
  bindGacha();
  bindCollection();
  bindResultModal();

  const dup = document.getElementById("allow-duplicate");
  dup.checked = state.allowDuplicate;
  dup.addEventListener("change", () => {
    state.allowDuplicate = dup.checked;
    persist();
  });

  renderDomeCapsules();

  try {
    await loadArticles();
  } catch (e) {
    console.error(e);
    showToast("記事リストの読み込みに失敗しました");
  }
  renderCollection();
  renderInfo();
  renderGachaMeta();
}

// ---------- データ読み込み ----------
async function loadArticles() {
  const url = `${ARTICLES_URL}?_=${Date.now()}`; // キャッシュ回避
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("articles.json fetch failed");
  const data = await res.json();
  state.articles = (data.articles || []).map((a, i) => ({
    id: a.id || String(i),
    title: a.title || "(無題)",
    url: a.url || "",
    date: a.date || "",
    category: a.category || "",
  })).filter((a) => a.url);
  state.updated = data.updated || null;

  // ストックにない id がコレクションに残っていたら、そのまま残しておく
  // （記事が消えてもログとして見られるように）
  // ただし表示時にフィルタする
}

// ---------- 永続化 ----------
function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      collection: state.collection,
      allowDuplicate: state.allowDuplicate,
    }));
  } catch {}
}
function loadLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

// ---------- 画面切替 ----------
function bindNav() {
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.screen;
      document.querySelectorAll(".nav-btn").forEach((b) => b.classList.toggle("active", b === btn));
      document.querySelectorAll(".screen").forEach((s) => {
        s.classList.toggle("active", s.id === `screen-${target}`);
      });
      if (target === "collection") renderCollection();
      if (target === "info") renderInfo();
    });
  });
}

// ---------- ドームのカプセル装飾 ----------
const NUM_CAPSULES = 80;
function randomCapsulePosition() {
  const x = Math.random() * 80;
  const yBase = Math.pow(Math.random(), 0.6);
  const y = yBase * 80;
  const rot = Math.floor(Math.random() * 360);
  return { x, y, rot };
}
function renderDomeCapsules() {
  const dome = document.getElementById("dome-inner");
  dome.innerHTML = "";
  for (let i = 0; i < NUM_CAPSULES; i++) {
    const el = document.createElement("div");
    el.className = "mini-capsule";
    const colorIdx = (i * 7 + 3) % CAPSULE_COLORS.length;
    const { c, d } = colorPair(colorIdx + Math.floor(Math.random() * CAPSULE_COLORS.length));
    el.style.setProperty("--cap-color", c);
    el.style.setProperty("--cap-color-dark", d);
    const p = randomCapsulePosition();
    el.style.setProperty("--x", p.x.toFixed(1) + "%");
    el.style.setProperty("--y", p.y.toFixed(1) + "%");
    el.style.setProperty("--rot", p.rot + "deg");
    el.style.animationDelay = (Math.random() * 0.18).toFixed(3) + "s";
    dome.appendChild(el);
  }
}

function shuffleCapsulesABit() {
  document.querySelectorAll(".mini-capsule").forEach((el) => {
    const cur = {
      x: parseFloat(el.style.getPropertyValue("--x")) || 40,
      y: parseFloat(el.style.getPropertyValue("--y")) || 40,
      rot: parseFloat(el.style.getPropertyValue("--rot")) || 0,
    };
    const impactScale = 0.25 + Math.max(0, 1 - cur.y / 80) * 0.85;
    const dx = (Math.random() - 0.5) * 12 * impactScale;
    let dy;
    if (cur.y > 65) {
      dy = (Math.random() - 0.6) * 4 * impactScale;
    } else {
      dy = (Math.random() * 6 - 1) * impactScale;
    }
    let nx = Math.max(0, Math.min(80, cur.x + dx));
    let ny = Math.max(0, Math.min(85, cur.y + dy));
    const drot = (Math.random() - 0.5) * 50 * impactScale;
    el.style.setProperty("--x", nx.toFixed(1) + "%");
    el.style.setProperty("--y", ny.toFixed(1) + "%");
    el.style.setProperty("--rot", (cur.rot + drot).toFixed(0) + "deg");
    const jumpUp = -(4 + Math.random() * 10) * impactScale;
    const sideKick = (Math.random() - 0.5) * 8 * impactScale;
    const tilt = (Math.random() - 0.5) * 14 * impactScale;
    el.style.setProperty("--byu", jumpUp.toFixed(1) + "px");
    el.style.setProperty("--bxd", sideKick.toFixed(1) + "px");
    el.style.setProperty("--bx",  tilt.toFixed(1) + "deg");
  });
}

// ---------- ガチャ ----------
function bindGacha() {
  document.getElementById("pull-btn").addEventListener("click", pullGacha);
  document.getElementById("lever").addEventListener("click", pullGacha);
}

function getEligibleArticles() {
  let pool = state.articles.slice();
  if (!state.allowDuplicate) {
    const read = new Set(state.collection);
    pool = pool.filter((a) => !read.has(a.id));
  }
  return pool;
}

function pullGacha() {
  if (isSpinning) return;
  if (state.articles.length === 0) {
    showToast("記事の読み込み中です。少し待ってから回してください。");
    return;
  }
  const pool = getEligibleArticles();
  if (pool.length === 0) {
    showToast("すべて読み終えました！「既読も含めて回す」をONにすると続けられます。");
    return;
  }
  isSpinning = true;
  const btn = document.getElementById("pull-btn");
  if (btn) btn.disabled = true;

  // 直前と同じものは避ける（候補が2件以上あるとき）
  let picked = pool[Math.floor(Math.random() * pool.length)];
  if (pool.length > 1 && picked.id === state.lastPickedId) {
    let safety = 5;
    while (picked.id === state.lastPickedId && safety-- > 0) {
      picked = pool[Math.floor(Math.random() * pool.length)];
    }
  }
  state.lastPickedId = picked.id;

  const lever = document.getElementById("lever");
  lever.style.transform = "rotate(0deg)";
  void lever.offsetWidth;
  const clickAt = (time, deg) => {
    setTimeout(() => {
      lever.style.transform = `rotate(${deg}deg)`;
      shuffleCapsulesABit();
      document.querySelectorAll(".mini-capsule").forEach((el) => {
        el.classList.remove("shaking");
        void el.offsetWidth;
        el.classList.add("shaking");
      });
    }, time);
  };
  clickAt(60, 120);
  clickAt(490, 240);
  clickAt(920, 360);

  const colorIdx = Math.floor(Math.random() * CAPSULE_COLORS.length);
  const { c: color, d: colorDark } = colorPair(colorIdx);
  const fly = document.getElementById("capsule-fly");
  fly.style.setProperty("--cap-color", color);
  fly.style.setProperty("--cap-color-dark", colorDark);

  const door = document.getElementById("output-door");
  setTimeout(() => { if (door) door.classList.add("opening"); }, 1380);
  setTimeout(() => {
    fly.hidden = false;
    fly.classList.remove("dropping");
    void fly.offsetWidth;
    fly.classList.add("dropping");
  }, 1500);
  setTimeout(() => { if (door) door.classList.remove("opening"); }, 2330);

  setTimeout(() => {
    fly.hidden = true;
    fly.classList.remove("dropping");
    document.querySelectorAll(".mini-capsule.shaking").forEach((el) => el.classList.remove("shaking"));
    showResult(picked, color, { colorDark });
    isSpinning = false;
    if (btn) btn.disabled = false;
  }, 2400);
}

// ---------- 結果モーダル ----------
function bindResultModal() {
  document.getElementById("result-close-btn").addEventListener("click", closeResult);
  document.getElementById("result-redraw-btn").addEventListener("click", () => {
    closeResult();
    setTimeout(pullGacha, 220);
  });
  document.getElementById("result-modal").addEventListener("click", (e) => {
    if (e.target.id === "result-modal") closeResult();
  });
}
function closeResult() {
  document.getElementById("result-modal").classList.add("hidden");
}
function showResult(article, color, opts = {}) {
  const modal = document.getElementById("result-modal");
  const cap = document.getElementById("big-capsule");
  const content = document.getElementById("result-content");
  cap.style.setProperty("--cap-color", color);
  if (opts.colorDark) cap.style.setProperty("--cap-color-dark", opts.colorDark);
  cap.classList.remove("opening");
  content.hidden = true;
  modal.classList.remove("hidden");

  if (!opts.fromCollection && !state.collection.includes(article.id)) {
    state.collection.push(article.id);
    persist();
    renderGachaMeta();
  }

  document.getElementById("result-bond").textContent = article.category || formatDate(article.date);
  document.getElementById("result-name").textContent = article.title;
  const sub = article.category && article.date
    ? `${article.category}　/　${formatDate(article.date)}`
    : formatDate(article.date);
  document.getElementById("result-rule").textContent = sub;
  const openBtn = document.getElementById("result-open-btn");
  openBtn.href = article.url;

  setTimeout(() => {
    cap.classList.add("opening");
    setTimeout(() => {
      content.hidden = false;
      celebrate();
    }, 380);
  }, opts.fromCollection ? 200 : 700);
}

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

// ---------- 紙吹雪・キラキラ ----------
function celebrate() {
  document.querySelectorAll(".celebrate-layer").forEach((l) => l.remove());

  const layer = document.createElement("div");
  layer.className = "celebrate-layer";
  document.body.appendChild(layer);

  const stage = document.getElementById("result-stage");
  if (stage) {
    stage.classList.remove("celebrate");
    void stage.offsetWidth;
    stage.classList.add("celebrate");
  }

  const ray1 = document.createElement("div");
  ray1.className = "lightrays celebrate-rays";
  const ray2 = document.createElement("div");
  ray2.className = "lightrays celebrate-rays layer-2";
  document.body.appendChild(ray1);
  document.body.appendChild(ray2);
  setTimeout(() => { ray1.remove(); ray2.remove(); }, 3000);

  const N_SPARKLE = 36;
  for (let i = 0; i < N_SPARKLE; i++) {
    const s = document.createElement("div");
    s.className = "sparkle";
    const x = Math.random() * 100;
    const y = 6 + Math.random() * 80;
    const dur = 1.0 + Math.random() * 1.0;
    const delay = Math.random() * 1.6;
    const scale = 0.7 + Math.random() * 1.0;
    s.style.left = x + "vw";
    s.style.top = y + "vh";
    s.style.transform = `scale(${scale})`;
    s.style.setProperty("--dur", dur.toFixed(2) + "s");
    s.style.setProperty("--delay", delay.toFixed(2) + "s");
    layer.appendChild(s);
  }
  setTimeout(() => layer.remove(), 5500);
}

// ---------- コレクション（読んだ記事） ----------
function bindCollection() {
  document.getElementById("reset-collection-btn").addEventListener("click", () => {
    confirmDialog("読んだ記事をリセット", "履歴をすべて消します。よろしいですか？", () => {
      state.collection = [];
      persist();
      renderCollection();
      renderGachaMeta();
      showToast("読んだ記事をリセットしました");
    });
  });
}

function renderCollection() {
  const grid = document.getElementById("collection-grid");
  grid.innerHTML = "";
  const byId = new Map(state.articles.map((a) => [a.id, a]));
  const read = state.collection
    .map((id) => byId.get(id))
    .filter(Boolean)
    .reverse(); // 新しく読んだ順

  if (read.length === 0) {
    grid.innerHTML = `<div class="collection-empty">まだ記事を引いていません。<br />「ガチャを回す！」から始めましょう。</div>`;
  } else {
    read.forEach((a, idx) => {
      const card = document.createElement("a");
      card.className = "col-card article-card";
      card.href = a.url;
      card.target = "_blank";
      card.rel = "noopener";
      const { c: color, d: colorDark } = colorPair(idx);
      card.innerHTML = `
        <div class="col-cap" style="--cap-color:${color};--cap-color-dark:${colorDark}"></div>
        <div class="col-name">${escapeHtml(a.title)}</div>
        <div class="col-bond">${escapeHtml(a.category || formatDate(a.date))}</div>
      `;
      grid.appendChild(card);
    });
  }

  document.getElementById("collection-count").textContent =
    `${state.collection.length} / ${state.articles.length}`;
}

// ---------- 情報画面 ----------
function renderInfo() {
  document.getElementById("info-count").textContent = state.articles.length.toLocaleString();
  document.getElementById("info-updated").textContent = state.updated
    ? formatDateTime(state.updated)
    : "―";
}
function renderGachaMeta() {
  const meta = document.getElementById("gacha-meta");
  if (!meta) return;
  if (state.articles.length === 0) {
    meta.textContent = "記事を読み込んでいます…";
  } else {
    const remain = state.articles.length - state.collection.length;
    meta.textContent = `収録 ${state.articles.length}件　/　未読 ${Math.max(0, remain)}件`;
  }
}
function formatDateTime(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${mo}/${da} ${h}:${m}`;
}

// ---------- 確認ダイアログ ----------
function confirmDialog(title, message, onOk) {
  const modal = document.getElementById("confirm-modal");
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-message").textContent = message;
  modal.classList.remove("hidden");
  const ok = document.getElementById("confirm-ok-btn");
  const cancel = document.getElementById("confirm-cancel-btn");
  const close = () => modal.classList.add("hidden");
  const cleanup = () => {
    ok.removeEventListener("click", handleOk);
    cancel.removeEventListener("click", handleCancel);
  };
  const handleOk = () => { close(); cleanup(); onOk && onOk(); };
  const handleCancel = () => { close(); cleanup(); };
  ok.addEventListener("click", handleOk);
  cancel.addEventListener("click", handleCancel);
}

// ---------- ユーティリティ ----------
function showToast(msg) {
  const old = document.querySelector(".toast");
  if (old) old.remove();
  const div = document.createElement("div");
  div.className = "toast";
  div.textContent = msg;
  document.body.appendChild(div);
  setTimeout(() => div.remove(), 2800);
}
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
