import test from "node:test";
import assert from "node:assert/strict";
import { contentToVerses } from "../lib/scripture-content.mjs";

test("uses explicit API.Bible verse nodes and ignores numeric footnotes", () => {
  const content = [
    {
      name: "para",
      type: "tag",
      attrs: { style: "p" },
      items: [
        { name: "verse", type: "tag", attrs: { number: "9", style: "v" }, items: [{ type: "text", text: "9" }] },
        { type: "text", text: "Know ye not that the unrighteous shall not inherit the kingdom of God? ", attrs: { verseId: "1CO.6.9" } },
        { name: "note", type: "tag", attrs: { style: "f" }, items: [{ type: "text", text: "2" }] },
        { name: "char", type: "tag", attrs: { style: "fr" }, items: [{ type: "text", text: "3" }] },
        { name: "verse", type: "tag", attrs: { number: "10", style: "v" }, items: [{ type: "text", text: "10" }] },
        { type: "text", text: "Nor thieves, nor covetous, nor drunkards shall inherit the kingdom of God. ", attrs: { verseId: "1CO.6.10" } },
        { name: "note", type: "tag", attrs: { style: "f" }, items: [{ type: "text", text: "4" }] },
        { name: "verse", type: "tag", attrs: { number: "11", style: "v" }, items: [{ type: "text", text: "11" }] },
        { type: "text", text: "And such were some of you: but ye are washed.", attrs: { verseId: "1CO.6.11" } },
      ],
    },
  ];

  assert.deepEqual(contentToVerses(content), [
    { verse: "9", text: "Know ye not that the unrighteous shall not inherit the kingdom of God?" },
    { verse: "10", text: "Nor thieves, nor covetous, nor drunkards shall inherit the kingdom of God." },
    { verse: "11", text: "And such were some of you: but ye are washed." },
  ]);
});

test("does not mistake numbers in scripture text for verse boundaries", () => {
  const content = [{
    name: "para",
    type: "tag",
    items: [
      { name: "verse", type: "tag", attrs: { number: "4" }, items: [{ type: "text", text: "4" }] },
      { type: "text", text: "And I heard the number: 144,000 were sealed." },
    ],
  }];

  assert.deepEqual(contentToVerses(content), [
    { verse: "4", text: "And I heard the number: 144,000 were sealed." },
  ]);
});
