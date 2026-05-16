/**
 * みんなの教育技術（kyoiku.sho.jp）の記事URLを RSS から収集して
 * articles.json を書き出すスクリプト。
 *
 * - 依存ゼロ（Node 22 の標準 fetch のみ）
 * - WordPress の通常RSSは1ページ10件。?paged=2,3... で過去記事も取得。
 * - GitHub Actions から毎日呼ばれる想定。
 */

import { writeFile, readFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "..", "articles.json");

const FEED_BASE = "https://kyoiku.sho.jp/feed/";
const MAX_PAGES = 30;          // 過去300件まで（10件 × 30ページ）
const FETCH_TIMEOUT_MS = 20000;
const USER_AGENT =
  "MinkyoGachaBot/1.0 (+https://github.com/) static-rss-aggregator";

async function fetchWithTimeout(url, timeout = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    return await fetch(url, {
      headers: { "User-Agent": USER_AGENT, "Accept": "application/rss+xml, application/xml, text/xml" },
      signal: ctrl.signal,
      redirect: "follow",
    });
  } finally {
    clearTimeout(t);
  }
}

/** RSS（XML）文字列から記事を抜き出す。正規表現ベースの軽量パーサ。 */
function parseFeed(xml) {
  const items = [];
  const itemRe = /<item\b[\s\S]*?<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    const chunk = m[0];
    const title = pickCData(chunk, "title");
    const link = pickText(chunk, "link");
    const pubDate = pickText(chunk, "pubDate");
    // category は複数あり得る。最初の一つを採用。
    const category = pickCData(chunk, "category");
    if (!link) continue;
    items.push({
      title: cleanText(title),
      url: cleanText(link),
      date: pubDate ? new Date(cleanText(pubDate)).toISOString() : "",
      category: cleanText(category),
    });
  }
  return items;
}

function pickText(chunk, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = chunk.match(re);
  return m ? m[1] : "";
}
function pickCData(chunk, tag) {
  const raw = pickText(chunk, tag);
  const m = raw.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m ? m[1] : raw;
}
function cleanText(s) {
  return (s || "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function urlToId(url) {
  // https://kyoiku.sho.jp/123456/ → "123456"。フォールバックは末尾セグメント。
  const m = url.match(/kyoiku\.sho\.jp\/(\d+)/);
  if (m) return m[1];
  const cleaned = url.replace(/[/?#].*$/, "").split("/").filter(Boolean).pop();
  return cleaned || url;
}

async function loadExisting() {
  try {
    const txt = await readFile(OUT_PATH, "utf8");
    const data = JSON.parse(txt);
    return Array.isArray(data.articles) ? data.articles : [];
  } catch {
    return [];
  }
}

async function main() {
  console.log("Fetching RSS feed pages...");
  const collected = new Map(); // id -> article

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = page === 1 ? FEED_BASE : `${FEED_BASE}?paged=${page}`;
    let res;
    try {
      res = await fetchWithTimeout(url);
    } catch (e) {
      console.warn(`  page ${page}: fetch error`, e.message);
      break;
    }
    if (!res.ok) {
      // 末尾を超えるとフィードは 404 か空 channel を返す → 終了
      console.log(`  page ${page}: HTTP ${res.status} — stop`);
      break;
    }
    const xml = await res.text();
    const items = parseFeed(xml);
    if (items.length === 0) {
      console.log(`  page ${page}: 0 items — stop`);
      break;
    }
    let added = 0;
    for (const it of items) {
      const id = urlToId(it.url);
      if (collected.has(id)) continue;
      collected.set(id, { id, ...it });
      added++;
    }
    console.log(`  page ${page}: +${added} (total ${collected.size})`);
    // 礼儀正しく少しだけ待つ
    await new Promise((r) => setTimeout(r, 400));
  }

  // 既存の記事もマージ（過去にRSSから消えた記事もコレクションとして残す）
  const existing = await loadExisting();
  for (const a of existing) {
    if (!collected.has(a.id)) collected.set(a.id, a);
  }

  const articles = Array.from(collected.values())
    // 日付の新しい順
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  const data = {
    source: "https://kyoiku.sho.jp/",
    updated: new Date().toISOString(),
    count: articles.length,
    articles,
  };

  await mkdir(dirname(OUT_PATH), { recursive: true });
  await writeFile(OUT_PATH, JSON.stringify(data, null, 2) + "\n", "utf8");
  console.log(`Wrote ${articles.length} articles → ${OUT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
