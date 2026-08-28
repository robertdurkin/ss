const approvedTags = new Map([
  ["b", "b"],
  ["u", "u"],
  ["i", "i"],
  ["string", "strong"],
  ["strong", "strong"],
  ["em", "em"],
  ["br", "br"],
]);

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;",
  })[character]);
}

export function sanitizeQuoteHtml(value) {
  return String(value)
    .split(/(<\/?[a-z][^>]*>)/gi)
    .map((part) => {
      if (!part.startsWith("<")) return escapeHtml(part);

      const match = part.match(/^<\s*(\/?)\s*([a-z]+)(?:\s+[^>]*)?\s*(\/?)\s*>$/i);
      if (!match) return "";

      const closing = match[1] === "/";
      const selfClosing = match[3] === "/";
      const inputTag = match[2].toLowerCase();
      const outputTag = approvedTags.get(inputTag);
      if (!outputTag || (outputTag === "br" && closing) || (outputTag !== "br" && selfClosing)) return "";
      if (outputTag === "br") return "<br>";
      return `<${closing ? "/" : ""}${outputTag}>`;
    })
    .join("");
}
