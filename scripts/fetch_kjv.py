#!/usr/bin/env python3
"""Download the lesson's public-domain KJV passages for offline use."""

import json
from pathlib import Path
from urllib.parse import quote
from urllib.request import Request, urlopen


PASSAGES = [
    ("genesis-3-15", "Genesis 3:15"),
    ("1-corinthians-15-1-8", "1 Corinthians 15:1-8"),
    ("1-corinthians-1-17-18", "1 Corinthians 1:17-18"),
    ("1-corinthians-2-2", "1 Corinthians 2:2"),
    ("1-corinthians-15-12-20", "1 Corinthians 15:12-20"),
    ("revelation-3-17", "Revelation 3:17"),
    ("1-corinthians-15-20-28", "1 Corinthians 15:20-28"),
    ("hebrews-2-14", "Hebrews 2:14"),
    ("revelation-1-18", "Revelation 1:18"),
    ("1-corinthians-15-22-23", "1 Corinthians 15:22-23"),
    ("1-thessalonians-4-13-17", "1 Thessalonians 4:13-17"),
    ("john-5-28-29", "John 5:28-29"),
    ("john-11-11-14-23-25", "John 11:11-14"),
    ("john-11-11-14-23-25", "John 11:23-25"),
    ("isaiah-53-12", "Isaiah 53:12"),
    ("hebrews-2-9", "Hebrews 2:9"),
    ("romans-6-23", "Romans 6:23"),
    ("2-timothy-1-10", "2 Timothy 1:10"),
    ("1-corinthians-6-9-11", "1 Corinthians 6:9-11"),
    ("ephesians-1-19-29", "Ephesians 1:19-23"),
    ("ephesians-2-1", "Ephesians 2:1"),
    ("romans-6-3-11", "Romans 6:3-11"),
    ("hebrews-8-1-2", "Hebrews 8:1-2"),
    ("hebrews-7-25", "Hebrews 7:25"),
    ("1-corinthians-15-24-28", "1 Corinthians 15:24-28"),
    ("revelation-20-14", "Revelation 20:14"),
    ("revelation-21-4", "Revelation 21:4"),
]


query = ",".join(reference for _, reference in PASSAGES)
url = f"https://api.midvash.com/v1/passages?refs={quote(query)}&version=kjv"
request = Request(url, headers={"User-Agent": "LessonScriptureReader/1.0"})
with urlopen(request, timeout=60) as response:
    payload = json.load(response)

if payload.get("meta", {}).get("failed"):
    raise RuntimeError(f"Some passages could not be resolved: {payload['meta']}")

result = {}
for (passage_id, reference), data in zip(PASSAGES, payload["data"]):
    passage = result.setdefault(passage_id, {"reference": reference, "verses": []})
    passage["verses"].extend(
        {"verse": data["verse"] + index, "text": text.strip()}
        for index, text in enumerate(data["verses"])
    )
    print(f"Fetched {reference}")

output = Path("public/data/kjv.json")
output.parent.mkdir(parents=True, exist_ok=True)
output.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
