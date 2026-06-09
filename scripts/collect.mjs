/**
 * 네이버 뉴스 옴부즈만 정정·고침 기사 수집 스크립트
 * 실행: node scripts/collect.mjs  (프로젝트 루트에서)
 *
 * 1. 두 목록 페이지에서 최근 100일치 기사 수집
 * 2. 각 기사 본문에서 original_clue + 검색 키워드 추출
 * 3. 네이버 검색으로 원본 기사 후보 자동 탐색
 * 4. data/cases.json 저장 (기존 original_candidates 보존)
 *
 * API 라우트에서 import 시: collectData(log) 사용
 */

import * as cheerio from "cheerio";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

// ROOT: process.cwd() 사용
// - CLI: `node scripts/collect.mjs` 를 프로젝트 루트에서 실행 가정
// - API 라우트: Next.js가 process.cwd()를 프로젝트 루트로 설정
const ROOT = process.cwd();

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  "Accept-Language": "ko-KR,ko;q=0.9",
};

const COLLECTION_DAYS = 90;
const DELAY_MS = process.env.VERCEL ? 200 : 450; // Vercel: 딜레이 단축
const MAX_CANDIDATES = 3;
// Vercel에서는 최근 30일 항목만 본문·원본 검색 (타임아웃 방지)
// 로컬에서는 COLLECTION_DAYS 전체 범위에 대해 상세 수집
const DETAIL_FETCH_DAYS = process.env.VERCEL ? 30 : COLLECTION_DAYS;

const today = new Date();
const cutoff = new Date(today);
cutoff.setDate(today.getDate() - COLLECTION_DAYS);
const cutoffStr = cutoff.toISOString().slice(0, 10);
const todayStr = today.toISOString().slice(0, 10);
const detailCutoff = new Date(today);
detailCutoff.setDate(today.getDate() - DETAIL_FETCH_DAYS);
const detailCutoffStr = detailCutoff.toISOString().slice(0, 10);

const PUBLISHER_SLUG = {
  조선일보: "chosun", 중앙일보: "joongang", 동아일보: "donga",
  한겨레: "hani", 경향신문: "khan", KBS: "kbs", MBC: "mbc",
  SBS: "sbs", YTN: "ytn", TV조선: "tvchosun", 연합뉴스: "yonhap",
  "연합뉴스TV": "yonhaptv", 블로터: "bloter", 한국경제: "hankyung",
  매일경제: "mk", 파이낸셜뉴스: "fnnews", 서울경제: "sedaily",
  데일리안: "dailian", 오마이뉴스: "ohmynews", 뉴스1: "news1",
  뉴시스: "newsis", 머니투데이: "mt", 아시아경제: "asiae",
  헤럴드경제: "herald", 이데일리: "edaily", 세계일보: "segye",
  국민일보: "kmib", 문화일보: "munhwa", 한국일보: "hankook",
  "한겨레21": "hani21", 시사IN: "sisain", JTBC: "jtbc", MBN: "mbn",
  채널A: "channela", 뉴데일리: "newdaily", 미디어오늘: "mediatoday",
  한국경제TV: "wowtv", 비즈니스워치: "bizwatch", 노컷뉴스: "nocutnews",
  프레시안: "pressian", 여성신문: "womennews", 뉴스타파: "newstapa",
  아이뉴스24: "inews24", "SBS연예뉴스": "sbsent", 주간조선: "chosunweekly",
  경기일보: "kyeonggi", 부산일보: "busan",
};

function slugify(p) {
  return PUBLISHER_SLUG[p] || p.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function detectType(title) {
  if (/바로잡습니다/.test(title)) return "바로잡습니다";
  if (/\[고침\]/.test(title)) return "고침";
  if (/정정보도/.test(title)) return "정정보도";
  if (/반론보도/.test(title)) return "반론보도";
  if (/추후보도/.test(title)) return "추후보도";
  if (/알립니다|알려드립니다/.test(title)) return "알립니다";
  return "고침";
}

// ─── 본문 파싱 ────────────────────────────────────────────────────────────────

function parseBody(body, correctionDateStr) {
  const corrYear = parseInt(correctionDateStr.slice(0, 4));
  const corrMonth = parseInt(correctionDateStr.slice(5, 7));

  let refDate = null;

  const recentFullRe = /지난\s*(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;
  const rf = body.match(recentFullRe);
  if (rf) {
    refDate = `${rf[1]}-${rf[2].padStart(2, "0")}-${rf[3].padStart(2, "0")}`;
  }

  if (!refDate) {
    const fullPubRe = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일자/;
    const fp = body.match(fullPubRe);
    if (fp) {
      refDate = `${fp[1]}-${fp[2].padStart(2, "0")}-${fp[3].padStart(2, "0")}`;
    }
  }

  if (!refDate) {
    const lastYearRe = /(?:지난해|작년)\s*(\d{1,2})월\s*(\d{1,2})일/;
    const ly = body.match(lastYearRe);
    if (ly) {
      const m = parseInt(ly[1]), d = parseInt(ly[2]);
      refDate = `${corrYear - 1}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (!refDate) {
    const partPubRe = /(\d{1,2})월\s*(\d{1,2})일자/;
    const pp = body.match(partPubRe);
    if (pp) {
      const m = parseInt(pp[1]), d = parseInt(pp[2]);
      const year = m > corrMonth ? corrYear - 1 : corrYear;
      refDate = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (!refDate) {
    const recentPartRe = /지난\s*(\d{1,2})월\s*(\d{1,2})일/;
    const rp = body.match(recentPartRe);
    if (rp) {
      const m = parseInt(rp[1]), d = parseInt(rp[2]);
      const year = m > corrMonth ? corrYear - 1 : corrYear;
      refDate = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (!refDate) {
    const fullDateRe = /(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/;
    const fd = body.match(fullDateRe);
    if (fd) {
      refDate = `${fd[1]}-${fd[2].padStart(2, "0")}-${fd[3].padStart(2, "0")}`;
    }
  }

  if (!refDate) {
    const partRe = /[▲]\s*(\d{1,2})월\s*(\d{1,2})일/;
    const pm = body.match(partRe);
    if (pm) {
      const m = parseInt(pm[1]), d = parseInt(pm[2]);
      const year = m > corrMonth ? corrYear - 1 : corrYear;
      refDate = `${year}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  if (refDate && isNaN(new Date(refDate).getTime())) refDate = null;

  const titleRe = [
    /[「《＜〈<]([^」》＞〉>\n]{5,80})[」》＞〉>]/,
    /'([^'\n]{5,80})'/,
    /'([^'\n]{5,80})'/,
    /"([^"\n]{5,80})"/,
    /"([^"\n]{5,80})"/,
  ];

  let titleKeywords = "";
  for (const re of titleRe) {
    const m = body.match(re);
    if (m) {
      titleKeywords = m[1]
        .replace(/^\[단독\]\s*/, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50);
      break;
    }
  }

  let clue = "";
  if (refDate && titleKeywords) {
    const d = new Date(refDate);
    clue = `${d.getMonth() + 1}월 ${d.getDate()}일자 '${titleKeywords}' 기사`;
  } else if (refDate) {
    const d = new Date(refDate);
    clue = `${d.getMonth() + 1}월 ${d.getDate()}일자 기사`;
  } else if (titleKeywords) {
    clue = `'${titleKeywords}' 기사`;
  }

  return { refDate, keywords: titleKeywords, clue };
}

function extractKeywordsFromCorrectionTitle(correctionTitle) {
  const titleRe = [
    /[「《＜〈<]([^」》＞〉>\n]{5,80})[」》＞〉>]/,
    /'([^'\n]{5,80})'/,
    /'([^'\n]{5,80})'/,
    /"([^"\n]{5,80})"/,
  ];
  for (const re of titleRe) {
    const m = correctionTitle.match(re);
    if (m) {
      return m[1]
        .replace(/^\[단독\]\s*/, "")
        .replace(/\s*관련\s*$/, "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 50);
    }
  }
  return "";
}

// ─── 네이버 검색 ─────────────────────────────────────────────────────────────

function fmtDate8(dateStr) {
  return dateStr.replace(/-/g, "");
}

function buildDateRange(refDate, corrDate) {
  const base = refDate || corrDate;
  const d = new Date(base);
  if (isNaN(d.getTime())) return buildDateRange(null, corrDate);
  const from = new Date(d); from.setDate(d.getDate() - 10);
  const to = new Date(d);   to.setDate(d.getDate() + 3);
  const corrD = new Date(corrDate);
  return {
    start: fmtDate8(from.toISOString().slice(0, 10)),
    end:   fmtDate8((to > corrD ? corrD : to).toISOString().slice(0, 10)),
  };
}

function tokenOverlap(keywords, text) {
  if (!keywords || !text) return 0;
  const tokens = keywords
    .replace(/[^\w가-힣]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
  if (!tokens.length) return 0;
  const hits = tokens.filter((t) => text.includes(t)).length;
  return hits / tokens.length;
}

function scoreConfidence(keywords, articleTitle, refDate, articleDate) {
  const overlap = tokenOverlap(keywords, articleTitle);
  const dayDiff = refDate && articleDate
    ? Math.abs(
        (new Date(articleDate) - new Date(refDate)) / (1000 * 60 * 60 * 24)
      )
    : 999;

  if (overlap >= 0.5 && dayDiff <= 5) return "high";
  if (overlap >= 0.3 || dayDiff <= 7) return "medium";
  return "low";
}

async function getArticleInfo(url) {
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const rawTitle = $("title").first().text().trim();
  const title = rawTitle
    .replace(/\s*[:\-|]\s*네이버\s*뉴스.*$/i, "")
    .replace(/\s*:\s*$/, "")
    .trim();

  const dateTimeAttr = $("._ARTICLE_DATE_TIME, .media_end_head_info_datestamp_time")
    .first()
    .attr("data-date-time");
  const date = dateTimeAttr ? dateTimeAttr.slice(0, 10) : "";

  $("script, style").remove();
  $("#dic_area br").replaceWith("\n");
  const snippet = $("#dic_area")
    .text()
    .replace(/[ \t]+/g, " ")
    .replace(/\n{2,}/g, " ")
    .trim()
    .slice(0, 180);

  return { title, date, snippet };
}

async function searchOriginals(correctionUrl, body, correctionDate, fallbackKeywords = "") {
  const pressMatch = correctionUrl.match(/\/article\/(\d+)\//);
  if (!pressMatch) return [];
  const pressCode = pressMatch[1];

  const { refDate, keywords: bodyKeywords } = parseBody(body, correctionDate);
  const keywords = bodyKeywords || fallbackKeywords;
  if (!keywords) return [];

  const { start, end } = buildDateRange(refDate, correctionDate);

  const attempts = [
    [keywords.slice(0, 60), true],
    [keywords.split(/\s+/).slice(0, 4).join(" "), true],
    [keywords.slice(0, 40), false],
  ];

  for (const [q, filterByPress] of attempts) {
    if (!q.trim()) continue;
    const searchUrl =
      `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(q)}` +
      `&nso=so%3Ar%2Cp%3Afrom${start}to${end}%2Ca%3Aall`;

    const html = await fetchHtml(searchUrl);
    await sleep(DELAY_MS);

    const urlRe = filterByPress
      ? new RegExp(`n\\.news\\.naver\\.com/mnews/article/${pressCode}/(\\d+)`, "g")
      : /n\.news\.naver\.com\/mnews\/article\/(\d+)\/(\d+)/g;

    const ids = new Set();
    let m;
    if (filterByPress) {
      while ((m = urlRe.exec(html)) !== null) ids.add(m[1]);
    } else {
      while ((m = urlRe.exec(html)) !== null) ids.add(`${m[1]}/${m[2]}`);
    }

    if (!ids.size) continue;

    const candidates = [];
    for (const idStr of [...ids].slice(0, MAX_CANDIDATES)) {
      const [pc, articleId] = filterByPress
        ? [pressCode, idStr]
        : idStr.split("/");
      const url = `https://n.news.naver.com/article/${pc}/${articleId}`;
      try {
        const info = await getArticleInfo(url);
        if (!info.title) continue;
        candidates.push({
          url,
          title: info.title,
          date: info.date,
          snippet: info.snippet,
          confidence: scoreConfidence(keywords, info.title, refDate, info.date),
        });
        await sleep(DELAY_MS);
      } catch {
        // 개별 기사 실패는 무시
      }
    }

    if (candidates.length) {
      const order = { high: 0, medium: 1, low: 2 };
      candidates.sort((a, b) => order[a.confidence] - order[b.confidence]);
      return candidates;
    }
  }

  return [];
}

// ─── 공통 유틸 ────────────────────────────────────────────────────────────────

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchHtml(url) {
  // cache: "no-store" — Next.js inline import 시 fetch 캐시 우회
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.text();
}

/**
 * 목록 페이지에서 기사 항목을 수집한다.
 * @param {string} baseUrl
 * @param {string} label
 * @param {(line: string) => void} log
 */
async function collectListPage(baseUrl, label, log) {
  const items = [];
  let page = 1;
  while (true) {
    log(`  ${label} p.${page}...`);
    const html = await fetchHtml(`${baseUrl}?page=${page}`);
    const $ = cheerio.load(html);
    let foundOld = false;

    for (const el of $(".omc_item").toArray()) {
      const $el = $(el);
      const $link = $el.find(".omc_title");
      const title = $link.text().replace(/\s+/g, " ").trim();
      const url = $link.attr("href") || "";
      const infos = $el.find(".omc_info").map((_, e) => $(e).text().trim()).get();
      const date = infos[0] || "";
      const publisher = infos[1] || "";

      if (!date || date < cutoffStr) { foundOld = true; continue; }
      if (url) items.push({ title, url, date, publisher });
    }

    if (foundOld) break;
    const total = parseInt($(".omp_total_page").text().trim()) || 1;
    if (page >= total) break;
    page++;
    await sleep(DELAY_MS);
  }
  return items;
}

/**
 * @param {string} url
 * @param {(line: string) => void} log
 */
async function fetchArticleBody(url, log) {
  try {
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    $("script, style, .u_likeit, .u_cbox, .nds_error").remove();
    $("#dic_area br").replaceWith("\n");
    return $("#dic_area")
      .text()
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch (e) {
    log(`⚠ 본문 실패: ${url}`);
    return "";
  }
}

// ─── 메인 (export) ────────────────────────────────────────────────────────────

/**
 * 데이터 수집 실행. 진행 상황을 log 콜백으로 전달하고 cases 배열을 반환한다.
 * API 라우트에서 import하여 사용하거나, CLI 엔트리 포인트에서 호출한다.
 *
 * @param {(line: string) => void} [log] - 진행 메시지 콜백 (기본: stdout)
 * @returns {Promise<object[]>} 수집된 케이스 배열
 */
export async function collectData(log = (line) => process.stdout.write(line + "\n")) {
  const isVercel = !!process.env.VERCEL;
  const casesPath = isVercel ? "/tmp/cases.json" : join(ROOT, "data", "cases.json");

  // Vercel /tmp이 비어 있을 경우 번들된 data/cases.json 폴백
  let existing = [];
  try { existing = JSON.parse(readFileSync(casesPath, "utf-8")); } catch {}
  if (!existing.length && isVercel) {
    try { existing = JSON.parse(readFileSync(join(ROOT, "data", "cases.json"), "utf-8")); } catch {}
  }
  const prevByUrl = new Map(existing.map((c) => [c.correction.url, c]));

  log(`수집 기간: ${cutoffStr} ~ ${todayStr} (최근 ${COLLECTION_DAYS}일)`);
  log("=".repeat(60));

  log("[1/2] 고침·바로잡습니다 목록");
  const errorList = await collectListPage(
    "https://news.naver.com/ombudsman/errorArticleList", "고침", log
  );
  log(`  → ${errorList.length}건`);

  await sleep(DELAY_MS * 2);

  log("[2/2] 정정·반론·추후보도 목록");
  const revisionList = await collectListPage(
    "https://news.naver.com/ombudsman/revisionArticleList", "정정/반론", log
  );
  log(`  → ${revisionList.length}건`);

  const seen = new Set();
  const allItems = [...errorList, ...revisionList]
    .filter((i) => { if (seen.has(i.url)) return false; seen.add(i.url); return true; })
    .sort((a, b) => b.date.localeCompare(a.date));

  log(`총 ${allItems.length}건 — 본문 + 원본 검색 시작`);
  log("=".repeat(60));

  const cases = [];
  const idCount = {};

  for (const [i, item] of allItems.entries()) {
    const prog = `[${String(i + 1).padStart(3, " ")}/${allItems.length}]`;
    // Vercel: DETAIL_FETCH_DAYS 이내 항목만 본문·원본 검색 수행 (타임아웃 방지)
    const isRecent = item.date >= detailCutoffStr;
    log(`${prog} ${item.date} ${item.publisher} — ${item.title.slice(0, 30)}${!isRecent ? " [목록만]" : ""}`);

    const prev = prevByUrl.get(item.url);

    let body = prev?.correction?.body || "";
    if (!body && isRecent) {
      body = await fetchArticleBody(item.url, log);
      await sleep(DELAY_MS);
    }

    const { clue, keywords: bodyKeywords } = parseBody(body, item.date);
    const keywords = bodyKeywords || extractKeywordsFromCorrectionTitle(item.title);
    const type = detectType(item.title);

    let candidates = prev?.original_candidates ?? [];
    if (candidates.length === 0 && keywords && isRecent) {
      log(`       🔍 원본 검색 중...`);
      try {
        candidates = await searchOriginals(item.url, body, item.date, keywords);
        await sleep(DELAY_MS);
      } catch (e) {
        log(`⚠ 검색 실패: ${e.message}`);
      }
      if (candidates.length) {
        log(`       → 후보 ${candidates.length}건 (${candidates.map((c) => c.confidence).join(", ")})`);
      }
    }

    const pubSlug = slugify(item.publisher);
    const dateKey = `${item.date}-${pubSlug}`;
    idCount[dateKey] = (idCount[dateKey] || 0) + 1;
    const id =
      prev?.id ||
      `${item.date}-${pubSlug}-${String(idCount[dateKey]).padStart(3, "0")}`;

    cases.push({
      id,
      correction: {
        publisher: item.publisher,
        type,
        date: item.date,
        url: item.url,
        title: item.title,
        body,
      },
      original_candidates: candidates,
      original_clue: clue || (keywords ? `'${keywords}' 기사` : "") || prev?.original_clue || "",
    });
  }

  const withCandidates = cases.filter((c) => c.original_candidates.length > 0).length;
  log(`✓ ${cases.length}건 수집 완료`);
  log(`  원본 후보 있음: ${withCandidates}건 / 없음: ${cases.length - withCandidates}건`);

  return cases;
}

// ─── CLI 엔트리 포인트 ────────────────────────────────────────────────────────
// webpack 번들 컨텍스트에서는 import.meta.url이 다르게 해석되므로 try/catch 사용

let _isCLI = false;
try { _isCLI = process.argv[1] === fileURLToPath(import.meta.url); } catch { /* webpack context */ }

if (_isCLI) {
  collectData()
    .then((cases) => {
      const isVercel = !!process.env.VERCEL;
      const outPath = isVercel ? "/tmp/cases.json" : join(ROOT, "data", "cases.json");
      writeFileSync(outPath, JSON.stringify(cases, null, 2), "utf-8");
      process.stdout.write(`\n✓ ${outPath} 저장 완료 (${cases.length}건)\n`);
    })
    .catch((e) => { console.error("수집 실패:", e); process.exit(1); });
}
