import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 4173);
const root = process.cwd();
const apiKey = process.env.API_BIBLE_KEY;
const cache = new Map();

const references = {
  "genesis-3-15": "GEN.3.15",
  "1-corinthians-15-1-8": "1CO.15.1-1CO.15.8",
  "1-corinthians-1-17-18": "1CO.1.17-1CO.1.18",
  "1-corinthians-2-2": "1CO.2.2",
  "1-corinthians-15-12-20": "1CO.15.12-1CO.15.20",
  "revelation-3-17": "REV.3.17",
  "1-corinthians-15-20-28": "1CO.15.20-1CO.15.28",
  "hebrews-2-14": "HEB.2.14",
  "revelation-1-18": "REV.1.18",
  "1-corinthians-15-22-23": "1CO.15.22-1CO.15.23",
  "1-thessalonians-4-13-17": "1TH.4.13-1TH.4.17",
  "john-5-28-29": "JHN.5.28-JHN.5.29",
  "john-11-11-14-23-25": ["JHN.11.11-JHN.11.14", "JHN.11.23-JHN.11.25"],
  "isaiah-53-12": "ISA.53.12",
  "hebrews-2-9": "HEB.2.9",
  "romans-6-23": "ROM.6.23",
  "2-timothy-1-10": "2TI.1.10",
  "1-corinthians-6-9-11": "1CO.6.9-1CO.6.11",
  "ephesians-1-19-29": "EPH.1.19-EPH.1.23",
  "ephesians-2-1": "EPH.2.1",
  "romans-6-3-11": "ROM.6.3-ROM.6.11",
  "hebrews-8-1-2": "HEB.8.1-HEB.8.2",
  "hebrews-7-25": "HEB.7.25",
  "1-corinthians-15-24-28": "1CO.15.24-1CO.15.28",
  "revelation-20-14": "REV.20.14",
  "revelation-21-4": "REV.21.4",
};

const mimeTypes = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json" };

async function apiFetch(path) {
  const response = await fetch(`https://rest.api.bible/v1${path}`, { headers: { "api-key": apiKey } });
  if (!response.ok) throw new Error(`API.Bible returned ${response.status}.`);
  return response.json();
}

async function getBibleId(translation) {
  const cached = cache.get(`bible:${translation}`);
  if (cached) return cached;
  const { data } = await apiFetch(`/bibles?language=eng&abbreviation=${encodeURIComponent(translation)}&include-full-details=false`);
  const match = data.find((bible) => bible.abbreviationLocal?.toUpperCase() === translation || bible.abbreviation?.toUpperCase().endsWith(translation));
  if (!match) throw new Error(`${translation} is not included in this API.Bible account.`);
  cache.set(`bible:${translation}`, match.id);
  return match.id;
}

function contentToVerses(html) {
  const normalized = html
    .replace(/<span[^>]*class="[^"]*v[^"]*"[^>]*>(\d+)<\/span>/gi, "\n$1\t")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  const parts = normalized.split(/(?=\d+\s)/).map((part) => part.trim()).filter(Boolean);
  return parts.map((part, index) => {
    const match = part.match(/^(\d+)\s+(.*)$/);
    return match ? { verse: Number(match[1]), text: match[2] } : { verse: index + 1, text: part };
  });
}

async function loadPassages(translation) {
  const cacheKey = `passages:${translation}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  const bibleId = await getBibleId(translation);
  const entries = await Promise.all(Object.entries(references).map(async ([id, passageIds]) => {
    const ids = Array.isArray(passageIds) ? passageIds : [passageIds];
    const responses = await Promise.all(ids.map((passageId) => apiFetch(`/bibles/${bibleId}/passages/${passageId}?content-type=html&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true`)));
    return [id, { verses: responses.flatMap(({ data }) => contentToVerses(data.content)) }];
  }));
  const passages = Object.fromEntries(entries);
  cache.set(cacheKey, passages);
  return passages;
}

function sendJson(response, status, body) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === "/api/passages") {
      const translation = url.searchParams.get("translation")?.toUpperCase();
      if (!apiKey) return sendJson(response, 503, { message: "Add an API_BIBLE_KEY on the server to enable licensed NIV, NKJV, and NLT text." });
      if (!["NIV", "NKJV", "NLT"].includes(translation)) return sendJson(response, 400, { message: "Unsupported translation." });
      return sendJson(response, 200, { passages: await loadPassages(translation) });
    }

    const requested = url.pathname === "/" ? "/index.html" : url.pathname;
    const safePath = normalize(requested).replace(/^(\.\.[/\\])+/, "");
    const filePath = join(root, safePath);
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not found");
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Not found");
  }
}).listen(port, () => console.log(`Scripture study running at http://localhost:${port}`));
