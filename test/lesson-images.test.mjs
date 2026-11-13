import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { imagesMarkup, validateImages } from "../lib/lesson-images.mjs";

test("supports remote and local images while keeping legacy lessons valid", () => {
  validateImages(undefined, "legacy lesson");
  for (const url of ["https://example.com/map.jpg", "http://example.com/map.png", "/public/map.webp", "public/map.svg"]) {
    validateImages([{ url, alt: "Map" }], "lesson");
    assert.ok(imagesMarkup([{ url, alt: "Map" }]).includes(`src="${url}"`));
  }
  assert.equal(imagesMarkup(undefined), "");
});

test("rejects malformed images and unsafe URL schemes", () => {
  for (const images of [null, {}, [null], [{ url: "" , alt: "" }], [{ url: "/map.jpg" }],
    [{ url: "/map.jpg", alt: "Map", caption: {} }],
    ...["javascript:alert(1)", "data:text/html,test", "file:///tmp/map.jpg"].map(url => [{ url, alt: "" }])]) {
    assert.throws(() => validateImages(images, "lesson"), /Images in lesson/);
    assert.equal(imagesMarkup(images), "");
  }
});

test("escapes image attributes and captions and supports decorative images", () => {
  const html = imagesMarkup([{ url: '/map.jpg?label=" onerror="alert(1)', alt: '<Map "title">', caption: '<script>alert(1)</script>' }]);
  assert.ok(html.includes('src="/map.jpg?label=&quot; onerror=&quot;alert(1)"'));
  assert.ok(html.includes('alt="&lt;Map &quot;title&quot;&gt;"'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  const decorative = imagesMarkup([{ url: "/map.jpg", alt: "" }]);
  assert.ok(decorative.includes('alt=""'));
  assert.ok(!decorative.includes("figcaption"));
});

test("renders lesson and theme images in order even when Scripture loading fails", async () => {
  const elements = new Map();
  const element = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { innerHTML: "", addEventListener() {}, classList: { add() {} } });
    return elements.get(selector);
  };
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8")
    .replace(/^import .*;\n/gm, "")
    .replace(/initializeLessons\(\);\s*$/, "");
  const context = {
    imagesMarkup, validateImages, URLSearchParams,
    document: { querySelector: element, querySelectorAll: () => [] },
    window: { addEventListener() {} },
    requestAnimationFrame: (callback) => callback(),
    fetch: async () => { throw new Error("Offline"); },
  };
  await runInNewContext(source + `
    state.lesson = { images: [{ url: '/cover.jpg', alt: 'Cover' }], themes: [{
      title: 'Theme', summary: 'Summary', images: [{ url: '/map.jpg', alt: 'Map' }],
      passages: [{ id: 'passage', reference: 'Genesis 1:1' }]
    }] };
    loadTranslation('KJV');
  `, context);
  const html = element("#passage-content").innerHTML;
  assert.ok(html.indexOf('/cover.jpg') < html.indexOf('theme-section'));
  assert.ok(html.indexOf('Summary') < html.indexOf('/map.jpg'));
  assert.ok(html.indexOf('/map.jpg') < html.indexOf('passage-card'));
  assert.ok(html.includes('This passage could not be loaded'));
});
