const themes = [
  {
    title: "Christ’s Multi-Dimensional Victory",
    summary: "The first promise: the serpent’s defeat through the woman’s seed.",
    passages: [["genesis-3-15", "Genesis 3:15"]],
  },
  {
    title: "The Resurrection is the Gospel",
    summary: "The apostolic message rests on Christ crucified, risen, and witnessed.",
    passages: [
      ["1-corinthians-15-1-8", "1 Corinthians 15:1–8"],
      ["1-corinthians-1-17-18", "1 Corinthians 1:17–18"],
      ["1-corinthians-2-2", "1 Corinthians 2:2"],
    ],
  },
  {
    title: "Without Resurrection, Christianity Collapses",
    summary: "If Christ is not raised, faith is empty and hope ends at the grave.",
    passages: [
      ["1-corinthians-15-12-20", "1 Corinthians 15:12–20"],
      ["revelation-3-17", "Revelation 3:17"],
    ],
  },
  {
    title: "Christ the Firstfruits",
    summary: "His resurrection guarantees the harvest still to come.",
    passages: [
      ["1-corinthians-15-20-28", "1 Corinthians 15:20–28"],
      ["hebrews-2-14", "Hebrews 2:14"],
      ["revelation-1-5", "Revelation 1:5"],
      ["revelation-1-18", "Revelation 1:18"],
    ],
  },
  {
    title: "Paul Challenges the Immortality of the Soul Doctrine",
    summary: "The dead sleep in Christ, awaiting the voice and return of their Lord.",
    passages: [
      ["1-corinthians-15-22-23", "1 Corinthians 15:22–23"],
      ["1-thessalonians-4-13-17", "1 Thessalonians 4:13–17"],
      ["john-5-28-29", "John 5:28–29"],
      ["john-11-11-14-23-25", "John 11:11–14, 23–25"],
    ],
  },
  {
    title: "Christ’s Second Death Experience",
    summary: "Christ tasted death for all, bearing sin’s wages and breaking its claim.",
    passages: [
      ["isaiah-53-12", "Isaiah 53:12"],
      ["hebrews-2-9", "Hebrews 2:9"],
      ["romans-6-23", "Romans 6:23"],
      ["2-timothy-1-10", "2 Timothy 1:10"],
    ],
  },
  {
    title: "Resurrection Power Begins Now",
    summary: "The life of the age to come is already remaking those joined to Christ.",
    passages: [
      ["1-corinthians-6-9-11", "1 Corinthians 6:9–11"],
      ["ephesians-1-19-29", "Ephesians 1:19–29", "Ephesians 1 ends at verse 23; verses 19–23 are shown."],
      ["ephesians-2-1", "Ephesians 2:1"],
      ["romans-6-3-11", "Romans 6:3–11"],
    ],
  },
  {
    title: "The Risen Christ Ministers Now",
    summary: "The enthroned Christ serves as priest and intercessor for his people.",
    passages: [
      ["hebrews-8-1-2", "Hebrews 8:1–2"],
      ["hebrews-7-25", "Hebrews 7:25"],
    ],
  },
  {
    title: "Resurrection Means the Great Controversy Will End",
    summary: "Every enemy is put down, death is destroyed, and sorrow passes away.",
    passages: [
      ["1-corinthians-15-24-28", "1 Corinthians 15:24–28"],
      ["revelation-20-14", "Revelation 20:14"],
      ["revelation-21-4", "Revelation 21:4"],
    ],
  },
];

const translationNames = {
  KJV: "King James Version",
  NIV: "New International Version",
  NKJV: "New King James Version",
  NLT: "New Living Translation",
};

const state = { translation: "KJV", requestId: 0 };
const content = document.querySelector("#passage-content");
const title = document.querySelector("#translation-title");
const notice = document.querySelector("#notice");

function renderNavigation() {
  document.querySelector("#theme-nav").innerHTML = themes
    .map((theme, index) => `<li><a href="#theme-${index + 1}"><span>${String(index + 1).padStart(2, "0")}</span>${theme.title}</a></li>`)
    .join("");
}

function verseMarkup(verses) {
  return verses
    .map(({ verse, text }) => `<span class="verse"><sup>${verse}</sup>${escapeHtml(text)}</span>`)
    .join(" ");
}

function renderThemes(data, translation) {
  content.innerHTML = themes
    .map((theme, themeIndex) => {
      const cards = theme.passages
        .map(([id, reference, note], passageIndex) => {
          const passage = data[id];
          const body = passage?.verses?.length
            ? `<p class="scripture-text">${verseMarkup(passage.verses)}</p>`
            : `<p class="passage-error">This passage could not be loaded. Please try again.</p>`;
          return `
            <article class="passage-card ${passageIndex === 0 ? "featured" : ""}">
              <div class="passage-heading">
                <h4>${reference}</h4>
                <span>${translation}</span>
              </div>
              ${note ? `<p class="reference-note">${note}</p>` : ""}
              ${body}
            </article>`;
        })
        .join("");

      return `
        <section class="theme-section" id="theme-${themeIndex + 1}">
          <div class="theme-intro">
            <span class="theme-number">${String(themeIndex + 1).padStart(2, "0")}</span>
            <div>
              <h3>${theme.title}</h3>
              <p>${theme.summary}</p>
            </div>
          </div>
          <div class="passage-list">${cards}</div>
        </section>`;
    })
    .join("");
}

async function loadTranslation(translation) {
  const requestId = ++state.requestId;
  state.translation = translation;
  title.textContent = translationNames[translation];
  document.querySelectorAll(".translation-button").forEach((button) => {
    const active = button.dataset.translation === translation;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  content.innerHTML = `<div class="loading-state"><span class="spinner" aria-hidden="true"></span><p>Loading ${translationNames[translation]}…</p></div>`;

  try {
    const response = await fetch(`/api/passages?translation=${translation}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.message || `${translation} is not configured.`);
    if (requestId === state.requestId) renderThemes(result.passages, translation);
  } catch (error) {
    if (requestId !== state.requestId) return;
    showNotice(`${translation} needs a licensed connection`, error.message);
    if (translation !== "KJV") {
      loadTranslation("KJV");
      return;
    }
    content.innerHTML = `
      <div class="loading-state">
        <p>Scripture text could not be loaded. Please check the API.Bible connection.</p>
      </div>`;
  }
}

function showNotice(heading, message) {
  document.querySelector("#notice-title").textContent = heading;
  document.querySelector("#notice-copy").textContent = message;
  notice.hidden = false;
  requestAnimationFrame(() => notice.classList.add("visible"));
}

function escapeHtml(value) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;",
  })[character]);
}

document.querySelectorAll(".translation-button").forEach((button) => {
  button.addEventListener("click", () => loadTranslation(button.dataset.translation));
});

document.querySelector("#notice-close").addEventListener("click", () => {
  notice.classList.remove("visible");
  setTimeout(() => { notice.hidden = true; }, 220);
});

window.addEventListener("scroll", () => {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const progress = height > 0 ? (window.scrollY / height) * 100 : 0;
  document.querySelector("#reading-progress").style.width = `${progress}%`;
}, { passive: true });

renderNavigation();
loadTranslation("KJV");
