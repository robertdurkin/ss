# Scripture Study

A dependency-free, mobile-friendly scripture lesson reader. Readers can select a lesson and display its passages in KJV, NIV, NKJV, or NLT. Scripture text is loaded through a server-side [API.Bible](https://api.bible) connection, so Bible text and API credentials are not committed to the site.

Lesson content is data-driven:

- `data/lessons/manifest.json` is the lesson catalog and identifies the default lesson.
- Each lesson has its own JSON file in `data/lessons/`.
- `app.js` builds the page from the selected lesson.
- `server.mjs` reads that same lesson definition to request its passages from API.Bible.

## Run locally

```bash
node server.mjs
```

Then open `http://localhost:4173`.

Run the verse-content parser regression tests with:

```bash
node --test
```

You can link directly to a lesson with its ID:

```text
http://localhost:4173/?lesson=lesson-08
```

## Configure scripture translations

Create an API.Bible account with access to the desired translations, then start the server with the API key in the environment:

```bash
API_BIBLE_KEY=your_private_key node server.mjs
```

The key remains server-side. All translations, including KJV, require this connection. Translation availability depends on the Bibles licensed to that API.Bible account.

## Add a lesson

1. Copy an existing lesson file, such as `data/lessons/lesson-08.json`, to a new filename such as `lesson-09.json`.
2. Give the lesson a unique `id` and update its number, display copy, themes, and passages.
3. Add the lesson to `data/lessons/manifest.json`. The `file` value must be the lesson JSON filename.
4. Restart the Node service so its in-memory lesson catalog is refreshed.

Each passage needs a unique ID within its lesson, a reader-facing reference, and one or more API.Bible passage IDs:

```json
{
  "id": "john-3-16-17",
  "reference": "John 3:16–17",
  "apiPassages": ["JHN.3.16-JHN.3.17"]
}
```

Use multiple `apiPassages` values for a non-contiguous reference:

```json
{
  "id": "john-11-11-14-23-25",
  "reference": "John 11:11–14, 23–25",
  "apiPassages": ["JHN.11.11-JHN.11.14", "JHN.11.23-JHN.11.25"]
}
```

To make a different lesson load by default, change `defaultLesson` in the manifest. The selector and bookmarkable `?lesson=` URL require no HTML or JavaScript changes.

## API endpoint

The browser requests a complete lesson in one translation:

```text
GET /api/passages?lesson=lesson-08&translation=KJV
```

Both query parameters are required. Apache only needs to proxy the `/api/` path to the Node service; lesson JSON and other static assets can be served normally.

Note: the supplied reference `Ephesians 1:19–29` extends beyond the end of Ephesians 1. The reader preserves the supplied label and clearly notes that verses 19–23 are displayed.
