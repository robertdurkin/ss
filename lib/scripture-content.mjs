const ignoredNodeNames = new Set(["note", "reference"]);
const ignoredStyles = new Set([
  "f", "fe", "ef", "efe", "fr", "fk", "fq", "fqa", "fl", "fw", "fp", "ft", "fdc", "fv", "fm",
  "x", "xo", "xop", "xt", "xta", "xk", "xq", "xot", "xnt", "xdc", "rq",
]);

function verseNumberFromId(verseId) {
  if (typeof verseId !== "string") return null;
  return verseId.split(".").at(-1) || null;
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

export function contentToVerses(content) {
  const blocks = typeof content === "string" ? JSON.parse(content) : content;
  if (!Array.isArray(blocks)) throw new Error("API.Bible returned an unexpected scripture format.");

  const verses = [];
  let currentVerse = null;

  function startVerse(number) {
    const normalizedNumber = String(number).trim();
    if (!normalizedNumber) return;
    if (currentVerse?.verse === normalizedNumber) return;

    currentVerse = { verse: normalizedNumber, text: "" };
    verses.push(currentVerse);
  }

  function visit(nodes) {
    if (!Array.isArray(nodes)) return;

    for (const node of nodes) {
      const style = node?.attrs?.style?.toLowerCase();
      if (!node || ignoredNodeNames.has(node.name) || ignoredStyles.has(style)) continue;

      if (node.name === "verse" && node.attrs?.number != null) {
        startVerse(node.attrs.number);
        continue;
      }

      if (node.type === "text" && typeof node.text === "string") {
        if (!currentVerse) {
          const number = verseNumberFromId(node.attrs?.verseId);
          if (number) startVerse(number);
        }
        if (currentVerse) currentVerse.text += node.text;
      }

      visit(node.items);
    }
  }

  visit(blocks);
  return verses
    .map(({ verse, text }) => ({ verse, text: normalizeText(text) }))
    .filter(({ text }) => text.length > 0);
}
