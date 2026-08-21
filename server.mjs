import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { basename, dirname, extname, join, normalize, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { contentToVerses } from "./lib/scripture-content.mjs";

const host = process.env.HOST || "127.0.0.1";
const port = Number(process.env.PORT || 4173);
const root = dirname(fileURLToPath(import.meta.url));
const apiKey = process.env.API_BIBLE_KEY;
const supportedTranslations = ["KJV", "NIV", "NKJV", "NLT"];
const cache = new Map();
const lessonCache = new Map();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, "utf8"));
}

function validateManifest(manifest) {
  if (!manifest || !Array.isArray(manifest.lessons) || manifest.lessons.length === 0) {
    throw new Error("The lesson manifest must contain at least one lesson.");
  }

  const ids = new Set();
  const files = new Set();
  for (const entry of manifest.lessons) {
    const validId = typeof entry.id === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(entry.id);
    const validFile = typeof entry.file === "string" && entry.file === basename(entry.file) && entry.file.endsWith(".json");
    if (!validId || !Number.isInteger(entry.number) || !entry.title || !validFile) {
      throw new Error("Every lesson manifest entry needs a valid id, number, title, and JSON filename.");
    }
    if (ids.has(entry.id) || files.has(entry.file)) {
      throw new Error(`Duplicate lesson manifest entry: ${entry.id}.`);
    }
    ids.add(entry.id);
    files.add(entry.file);
  }
  if (!ids.has(manifest.defaultLesson)) {
    throw new Error("defaultLesson must identify a lesson in the manifest.");
  }
  return manifest;
}

function validateLesson(lesson, entry) {
  if (!lesson || lesson.id !== entry.id || lesson.number !== entry.number || !lesson.title || !lesson.intro || !lesson.heroQuote || !lesson.footer || !Array.isArray(lesson.themes) || lesson.themes.length === 0) {
    throw new Error(`Lesson definition ${entry.file} is invalid.`);
  }

  const passageIds = new Set();
  for (const theme of lesson.themes) {
    if (!theme.id || !theme.title || !theme.summary || !Array.isArray(theme.passages) || theme.passages.length === 0) {
      throw new Error(`A theme in ${entry.file} is invalid.`);
    }
    for (const passage of theme.passages) {
      const validApiPassages = Array.isArray(passage.apiPassages)
        && passage.apiPassages.length > 0
        && passage.apiPassages.every((passageId) => typeof passageId === "string" && passageId.length > 0);
      if (!passage.id || !passage.reference || !validApiPassages || passageIds.has(passage.id)) {
        throw new Error(`Passage definitions in ${entry.file} must have unique IDs, references, and API passage IDs.`);
      }
      passageIds.add(passage.id);
    }
  }
  return lesson;
}

async function getManifest() {
  if (!lessonCache.has("manifest")) {
    const manifest = await readJson(join(root, "data", "lessons", "manifest.json"));
    lessonCache.set("manifest", validateManifest(manifest));
  }
  return lessonCache.get("manifest");
}

async function getLesson(lessonId) {
  const cacheKey = `lesson:${lessonId}`;
  if (lessonCache.has(cacheKey)) return lessonCache.get(cacheKey);

  const manifest = await getManifest();
  const entry = manifest.lessons.find((lesson) => lesson.id === lessonId);
  if (!entry) {
    const error = new Error("The requested lesson is not included in this study.");
    error.code = "LESSON_NOT_FOUND";
    throw error;
  }

  const lesson = validateLesson(await readJson(join(root, "data", "lessons", entry.file)), entry);
  lessonCache.set(cacheKey, lesson);
  return lesson;
}

async function apiFetch(path) {
  const response = await fetch(`https://rest.api.bible/v1${path}`, {
    headers: { "api-key": apiKey },
  });
  if (!response.ok) throw new Error(`API.Bible returned ${response.status}.`);
  return response.json();
}

async function getBibleId(translation) {
  const cacheKey = `bible:${translation}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  let bibles = cache.get("bibles:english");
  if (!bibles) {
    const result = await apiFetch("/bibles?language=eng&include-full-details=false");
    bibles = result.data;
    cache.set("bibles:english", bibles);
  }

  const match = bibles.find((bible) => {
    const local = bible.abbreviationLocal?.toUpperCase();
    const abbreviation = bible.abbreviation?.toUpperCase();
    return local === translation || abbreviation === translation || abbreviation?.endsWith(translation);
  });
  if (!match) throw new Error(`${translation} is not included in this API.Bible account.`);
  cache.set(cacheKey, match.id);
  return match.id;
}

async function loadApiPassage(bibleId, passageId) {
  const cacheKey = `passage:${bibleId}:${passageId}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const request = apiFetch(`/bibles/${bibleId}/passages/${passageId}?content-type=json&include-notes=false&include-titles=false&include-chapter-numbers=false&include-verse-numbers=true`)
    .then(({ data }) => contentToVerses(data.content))
    .catch((error) => {
      cache.delete(cacheKey);
      throw error;
    });
  cache.set(cacheKey, request);
  return request;
}

async function loadPassages(lessonId, translation) {
  const cacheKey = `lesson:${lessonId}:${translation}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);

  const lesson = await getLesson(lessonId);
  const bibleId = await getBibleId(translation);
  const passageDefinitions = lesson.themes.flatMap((theme) => theme.passages);
  const entries = await Promise.all(passageDefinitions.map(async (passage) => {
    const groups = await Promise.all(passage.apiPassages.map((passageId) => loadApiPassage(bibleId, passageId)));
    return [passage.id, { verses: groups.flat() }];
  }));
  const passages = Object.fromEntries(entries);
  cache.set(cacheKey, passages);
  return passages;
}

function sendJson(response, status, body) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(body));
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host || `${host}:${port}`}`);
    if (url.pathname === "/api/passages") {
      const lessonId = url.searchParams.get("lesson");
      const translation = url.searchParams.get("translation")?.toUpperCase();
      if (!apiKey) return sendJson(response, 503, { message: "Add an API_BIBLE_KEY on the server to enable scripture text." });
      if (!lessonId) return sendJson(response, 400, { message: "A lesson ID is required." });
      if (!supportedTranslations.includes(translation)) return sendJson(response, 400, { message: "Unsupported translation." });

      try {
        return sendJson(response, 200, { lessonId, passages: await loadPassages(lessonId, translation) });
      } catch (error) {
        console.error(`Unable to load ${lessonId} in ${translation}:`, error.message);
        const status = error.code === "LESSON_NOT_FOUND" ? 404 : 502;
        return sendJson(response, status, { message: error.message });
      }
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8", "Allow": "GET, HEAD" });
      return response.end("Method not allowed");
    }

    const requested = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname).replace(/^[/\\]+/, "");
    const safePath = normalize(requested);
    const filePath = join(root, safePath);
    if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) throw new Error("Not found");
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) throw new Error("Not found");
    response.writeHead(200, { "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream" });
    if (request.method === "HEAD") return response.end();
    response.end(await readFile(filePath));
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, host, () => {
  console.log(`Scripture study running at http://${host}:${port}`);
});

process.on("SIGTERM", () => {
  server.close(() => process.exit(0));
});
