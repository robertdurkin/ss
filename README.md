# Lesson 8 — The Power of Christ's Resurrection

A dependency-free, mobile-friendly scripture reader. KJV text is bundled for immediate use. NIV, NKJV, and NLT are loaded through a licensed [API.Bible](https://api.bible) account so copyrighted translation text and API credentials are not committed to the site.

## Run locally

```bash
node server.mjs
```

Then open `http://localhost:4173`.

## Enable NIV, NKJV, and NLT

Create an API.Bible account with access to the desired translations, then start the server with the API key in the environment:

```bash
API_BIBLE_KEY=your_private_key node server.mjs
```

The key remains server-side. Translation availability depends on the Bibles licensed to that API.Bible account.

## Refresh the bundled KJV data

```bash
python3 scripts/fetch_kjv.py
```

Note: the supplied reference `Ephesians 1:19–29` extends beyond the end of Ephesians 1. The reader preserves the supplied label and clearly notes that verses 19–23 are displayed.
