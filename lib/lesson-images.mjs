function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;",
  })[character]);
}

export function isValidImage(image) {
  if (!image || typeof image.url !== "string" || !image.url.trim()
    || typeof image.alt !== "string"
    || (image.caption !== undefined && typeof image.caption !== "string")) return false;
  try {
    const url = new URL(image.url, "https://lesson.invalid/");
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export function validateImages(images, context) {
  if (images === undefined) return;
  if (!Array.isArray(images) || !images.every(isValidImage)) {
    throw new Error(`Images in ${context} must be an array of objects with an HTTP(S) or relative url, alt text, and an optional caption.`);
  }
}

export function imagesMarkup(images) {
  if (!Array.isArray(images)) return "";
  return images.filter(isValidImage).map((image) => `
    <figure class="lesson-image">
      <img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" loading="lazy" decoding="async">
      ${image.caption ? `<figcaption>${escapeHtml(image.caption)}</figcaption>` : ""}
    </figure>`).join("");
}
