import test from "node:test";
import assert from "node:assert/strict";
import { sanitizeQuoteHtml } from "../lib/quote-html.mjs";

test("preserves approved quote formatting tags", () => {
  const input = "<b>Bold</b> <u>underlined</u> <i>italic</i> <em>emphasis</em><br>Next line";
  assert.equal(sanitizeQuoteHtml(input), input);
});

test("treats string as an alias for strong", () => {
  assert.equal(sanitizeQuoteHtml("<string>Strong</string>"), "<strong>Strong</strong>");
  assert.equal(sanitizeQuoteHtml("<strong>Strong</strong>"), "<strong>Strong</strong>");
});

test("removes unapproved tags and all tag attributes", () => {
  const input = '<script>alert("unsafe")</script><b onclick="unsafe()">Not bold</b><b>Bold</b>';
  assert.equal(sanitizeQuoteHtml(input), "alert(&quot;unsafe&quot;)<b>Not bold</b><b>Bold</b>");
});

test("escapes ordinary text", () => {
  assert.equal(sanitizeQuoteHtml("Faith & hope < 3"), "Faith &amp; hope &lt; 3");
});
