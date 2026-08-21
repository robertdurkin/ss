const translationNames = {
  KJV: "King James Version",
  NIV: "New International Version",
  NKJV: "New King James Version",
  NLT: "New Living Translation",
};

const state = {
  manifest: null,
  lesson: null,
  lessonId: null,
  lessonRequestId: 0,
  translation: "KJV",
  requestId: 0,
};

const content = document.querySelector("#passage-content");
const translationTitle = document.querySelector("#translation-title");
const lessonPicker = document.querySelector("#lesson-picker");
const notice = document.querySelector("#notice");

function renderNavigation() {
  document.querySelector("#theme-nav").innerHTML = state.lesson.themes
    .map((theme, index) => `<li><a href="#theme-${index + 1}"><span>${String(index + 1).padStart(2, "0")}</span>${escapeHtml(theme.title)}</a></li>`)
    .join("");
}

function renderLessonShell() {
  const { lesson } = state;
  const passageCount = lesson.themes.reduce((total, theme) => total + theme.passages.length, 0);
  const lessonNumber = String(lesson.number).padStart(2, "0");

  document.querySelector("#hero-lesson-number").textContent = `Lesson ${lessonNumber}`;
  document.querySelector("#hero-title").innerHTML = lessonTitleMarkup(lesson.title, lesson.titleAccent);
  document.querySelector("#hero-intro").textContent = lesson.intro;
  document.querySelector("#theme-count").textContent = String(lesson.themes.length).padStart(2, "0");
  document.querySelector("#passage-count").textContent = String(passageCount).padStart(2, "0");
  document.querySelector("#focus-value").textContent = lesson.focus?.value || "";
  document.querySelector("#focus-label").textContent = lesson.focus?.label || "";
  document.querySelector("#hero-quote").textContent = `“${lesson.heroQuote}”`;
  document.querySelector("#footer-quote").textContent = `“${lesson.footer.text}”`;
  document.querySelector("#footer-reference").textContent = `${lesson.footer.reference} · ${lesson.footer.translation}`;
  document.querySelector("#meta-description").content = `Scripture references for Lesson ${lesson.number}: ${lesson.title}.`;
  document.title = `Lesson ${lesson.number} — ${lesson.title}`;
  renderNavigation();
}

function lessonTitleMarkup(title, accent) {
  if (!accent) return escapeHtml(title);
  const accentIndex = title.lastIndexOf(accent);
  if (accentIndex < 0) return escapeHtml(title);
  const before = title.slice(0, accentIndex);
  const after = title.slice(accentIndex + accent.length);
  return `${escapeHtml(before)}<em>${escapeHtml(accent)}</em>${escapeHtml(after)}`;
}

function verseMarkup(verses) {
  return verses
    .map(({ verse, text }) => `<span class="verse"><sup>${verse}</sup>${escapeHtml(text)}</span>`)
    .join(" ");
}

function renderThemes(data, translation) {
  content.innerHTML = state.lesson.themes
    .map((theme, themeIndex) => {
      const cards = theme.passages
        .map((passage, passageIndex) => {
          const result = data[passage.id];
          const body = result?.verses?.length
            ? `<p class="scripture-text">${verseMarkup(result.verses)}</p>`
            : `<p class="passage-error">This passage could not be loaded. Please try again.</p>`;
          return `
            <article class="passage-card ${passageIndex === 0 ? "featured" : ""}">
              <div class="passage-heading">
                <h4>${escapeHtml(passage.reference)}</h4>
                <span>${translation}</span>
              </div>
              ${passage.note ? `<p class="reference-note">${escapeHtml(passage.note)}</p>` : ""}
              ${body}
            </article>`;
        })
        .join("");

      return `
        <section class="theme-section" id="theme-${themeIndex + 1}">
          <div class="theme-intro">
            <span class="theme-number">${String(themeIndex + 1).padStart(2, "0")}</span>
            <div>
              <h3>${escapeHtml(theme.title)}</h3>
              <p>${escapeHtml(theme.summary)}</p>
            </div>
          </div>
          <div class="passage-list">${cards}</div>
        </section>`;
    })
    .join("");
}

function renderLoading(message) {
  content.innerHTML = `<div class="loading-state"><span class="spinner" aria-hidden="true"></span><p>${escapeHtml(message)}</p></div>`;
}

async function loadTranslation(translation) {
  if (!state.lesson) return;

  const requestId = ++state.requestId;
  state.translation = translation;
  translationTitle.textContent = translationNames[translation];
  document.querySelectorAll(".translation-button").forEach((button) => {
    const active = button.dataset.translation === translation;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  renderLoading(`Loading ${translationNames[translation]}…`);

  try {
    const params = new URLSearchParams({ lesson: state.lessonId, translation });
    const response = await fetch(`/api/passages?${params}`);
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

async function selectLesson(lessonId, { updateUrl = true } = {}) {
  const lessonEntry = state.manifest.lessons.find((lesson) => lesson.id === lessonId);
  if (!lessonEntry) {
    showNotice("Lesson unavailable", "The requested lesson is not included in this study.");
    return;
  }

  const lessonRequestId = ++state.lessonRequestId;
  ++state.requestId;
  renderLoading(`Loading Lesson ${lessonEntry.number}…`);

  try {
    const response = await fetch(`/data/lessons/${encodeURIComponent(lessonEntry.file)}`);
    if (!response.ok) throw new Error(`Lesson ${lessonEntry.number} could not be loaded.`);
    const lesson = await response.json();
    if (lessonRequestId !== state.lessonRequestId) return;

    state.lessonId = lessonEntry.id;
    state.lesson = lesson;
    lessonPicker.value = lessonEntry.id;
    renderLessonShell();

    if (updateUrl) {
      const url = new URL(window.location);
      url.searchParams.set("lesson", lessonEntry.id);
      history.pushState({ lessonId: lessonEntry.id }, "", url);
    }

    await loadTranslation(state.translation);
  } catch (error) {
    if (lessonRequestId !== state.lessonRequestId) return;
    showNotice("Lesson unavailable", error.message);
    content.innerHTML = `<div class="loading-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

async function initializeLessons() {
  try {
    const response = await fetch("/data/lessons/manifest.json");
    if (!response.ok) throw new Error("The lesson catalog could not be loaded.");
    state.manifest = await response.json();

    lessonPicker.innerHTML = state.manifest.lessons
      .map((lesson) => `<option value="${escapeHtml(lesson.id)}">Lesson ${String(lesson.number).padStart(2, "0")} · ${escapeHtml(lesson.title)}</option>`)
      .join("");
    lessonPicker.disabled = false;

    const requestedLesson = new URLSearchParams(window.location.search).get("lesson");
    const initialLesson = state.manifest.lessons.some((lesson) => lesson.id === requestedLesson)
      ? requestedLesson
      : state.manifest.defaultLesson;
    const url = new URL(window.location);
    url.searchParams.set("lesson", initialLesson);
    history.replaceState({ lessonId: initialLesson }, "", url);
    await selectLesson(initialLesson, { updateUrl: false });
  } catch (error) {
    showNotice("Lessons unavailable", error.message);
    content.innerHTML = `<div class="loading-state"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function showNotice(heading, message) {
  document.querySelector("#notice-title").textContent = heading;
  document.querySelector("#notice-copy").textContent = message;
  notice.hidden = false;
  requestAnimationFrame(() => notice.classList.add("visible"));
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;",
  })[character]);
}

lessonPicker.addEventListener("change", () => selectLesson(lessonPicker.value));

document.querySelectorAll(".translation-button").forEach((button) => {
  button.addEventListener("click", () => loadTranslation(button.dataset.translation));
});

document.querySelector("#notice-close").addEventListener("click", () => {
  notice.classList.remove("visible");
  setTimeout(() => { notice.hidden = true; }, 220);
});

window.addEventListener("popstate", () => {
  if (!state.manifest) return;
  const lessonId = new URLSearchParams(window.location.search).get("lesson") || state.manifest.defaultLesson;
  if (lessonId !== state.lessonId) selectLesson(lessonId, { updateUrl: false });
});

window.addEventListener("scroll", () => {
  const height = document.documentElement.scrollHeight - window.innerHeight;
  const progress = height > 0 ? (window.scrollY / height) * 100 : 0;
  document.querySelector("#reading-progress").style.width = `${progress}%`;
}, { passive: true });

initializeLessons();
