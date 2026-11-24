// The reader. index.html is the only page and its address never changes: this loads
// book.json for the contents and shows one chapter (or the newest page) in the reading
// area. What's open, and how far down, is remembered in local storage, so a returning
// reader picks up where they left off and a new one starts at Chapter I.
// Chapters are plain text, so everything is built with DOM methods, never innerHTML.

const RECENT_PASSAGES_ON_FRONT_PAGE = 2;
export const NEWEST = "newest";

// Blank lines separate paragraphs, single newlines are line breaks, and *asterisks* mark italics.
export function parseProse(text) {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) =>
      paragraph.split("\n").map((line) =>
        line
          .split(/(\*[^*\n]+\*)/)
          .filter(Boolean)
          .map((piece) => {
            const isItalic = /^\*[^*\n]+\*$/.test(piece);
            return { text: isItalic ? piece.slice(1, -1) : piece, isItalic };
          }),
      ),
    );
}

// What to open on arrival: the remembered view if it still exists, otherwise Chapter I.
export function viewToOpen(storedView, chapterCount) {
  if (storedView === NEWEST) return NEWEST;
  const number = Number(storedView);
  return Number.isInteger(number) && number >= 1 && number <= chapterCount ? number : 1;
}

const chapterPath = (number) => `chapters/${String(number).padStart(3, "0")}.json`;
const formatNumber = (number) => number.toLocaleString("en-US");
const plural = (count, word) => `${formatNumber(count)} ${count === 1 ? word : `${word}s`}`;

if (typeof document !== "undefined") start();

function start() {
  const reading = document.getElementById("reading");
  const chapterCache = new Map();
  let book = null;
  let shownView = null;
  let latestNavigation = 0;

  // Storage can be unavailable (private windows, blocked site data), so every access is guarded.
  const readStored = (key) => {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  };
  const store = (key, value) => {
    try {
      localStorage.setItem(key, value);
    } catch {}
  };

  // GitHub Pages caches files briefly; "no-cache" revalidates so new passages show up.
  async function fetchJson(path) {
    const response = await fetch(path, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Loading ${path} failed with ${response.status}.`);
    return response.json();
  }

  async function loadChapter(number) {
    if (!chapterCache.has(number)) chapterCache.set(number, fetchJson(chapterPath(number)));
    try {
      return await chapterCache.get(number);
    } catch (error) {
      chapterCache.delete(number);
      throw error;
    }
  }

  function element(tag, { className, text, attributes = {} } = {}, children = []) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    node.append(...children);
    return node;
  }

  // Every way of moving around the book is a button naming where it goes; one click handler serves them all.
  const goTo = (view, { text, className = "link", children = [], attributes = {} }) =>
    element("button", {
      className,
      text,
      attributes: { type: "button", ...(view === NEWEST ? { "data-newest": "" } : { "data-chapter": String(view) }), ...attributes },
    }, children);

  function renderPassage(passage) {
    const paragraphs = parseProse(passage).map((lines) => {
      const paragraph = element("p");
      lines.forEach((pieces, index) => {
        if (index > 0) paragraph.append(element("br"));
        for (const piece of pieces) {
          paragraph.append(piece.isItalic ? element("em", { text: piece.text }) : piece.text);
        }
      });
      return paragraph;
    });
    return element("section", { className: "passage" }, paragraphs);
  }

  function renderPassages(passages) {
    return passages.flatMap((passage, index) => {
      const section = renderPassage(passage);
      return index === 0 ? [section] : [element("p", { className: "turn", text: "·", attributes: { "aria-hidden": "true" } }), section];
    });
  }

  const continued = () =>
    element("p", { className: "continued", text: "To be continued…" }, [
      element("span", { text: "Someone new is writing the next part. Come back in a little while." }),
    ]);

  function heading(eyebrow, title, view) {
    const titleNode = view ? goTo(view, { text: title, className: "link heading-link" }) : title;
    return element("header", { className: "chapter-heading" }, [
      element("p", { className: "eyebrow", text: eyebrow }),
      element("h1", { attributes: { tabindex: "-1" } }, [titleNode]),
    ]);
  }

  function renderContents() {
    const items = book.chapters.map((chapter) =>
      element("li", {}, [
        goTo(chapter.number, {
          className: "link contents-entry",
          attributes: chapter.number === shownView ? { "aria-current": "page" } : {},
          children: [
            element("span", { className: "contents-number", text: chapter.numeral }),
            element("span", { className: "contents-title", text: chapter.title }),
            element("span", { className: "contents-leader", attributes: { "aria-hidden": "true" } }),
            element("span", { className: "contents-words", text: formatNumber(chapter.words) }),
          ],
        }),
      ]),
    );
    document.getElementById("contents").replaceChildren(...items);
    document.getElementById("stats").textContent =
      `${plural(book.chapters.length, "chapter")} · ${plural(book.words, "word")} · ${plural(book.passages, "hand")}`;
  }

  async function renderNewest() {
    const latest = book.chapters.at(-1);
    const chapter = await loadChapter(latest.number);
    const recent = chapter.passages.slice(-RECENT_PASSAGES_ON_FRONT_PAGE);
    const hasEarlier = recent.length < chapter.passages.length;

    document.title = book.title;
    return [
      element("article", { className: "chapter" }, [
        heading(`The newest page · Chapter ${latest.numeral}`, latest.title, latest.number),
        ...(hasEarlier ? [element("p", { className: "earlier" }, [goTo(latest.number, { text: "… earlier in this chapter" })])] : []),
        ...renderPassages(recent),
        continued(),
      ]),
      element("nav", { className: "actions" }, [
        goTo(1, { text: "Begin at the beginning", className: "button" }),
        goTo(latest.number, { text: `Read Chapter ${latest.numeral} from the start`, className: "button quiet" }),
      ]),
    ];
  }

  async function renderChapter(number) {
    const entry = book.chapters[number - 1];
    const chapter = await loadChapter(number);
    const isLatest = number === book.chapters.length;
    const previous = book.chapters[number - 2];
    const next = book.chapters[number];

    document.title = `${entry.title} · ${book.title}`;
    return [
      element("article", { className: "chapter is-full" }, [
        heading(`Chapter ${entry.numeral}`, entry.title),
        ...renderPassages(chapter.passages),
        ...(isLatest ? [continued()] : []),
      ]),
      element("nav", { className: "pager" }, [
        previous ? goTo(previous.number, { text: `← Chapter ${previous.numeral}`, attributes: { rel: "prev" } }) : element("span"),
        goTo(NEWEST, { text: "Newest page" }),
        next ? goTo(next.number, { text: `Chapter ${next.numeral} →`, attributes: { rel: "next" } }) : element("span"),
      ]),
    ];
  }

  // Shows a view. `progress` (0–1) restores a scroll position; otherwise the view opens at its top.
  async function show(view, { progress = 0 } = {}) {
    const navigation = ++latestNavigation;
    try {
      const content = view === NEWEST ? await renderNewest() : await renderChapter(view);
      // A slower chapter must not replace one the reader has since moved on to.
      if (navigation !== latestNavigation) return;
      shownView = view;
      reading.replaceChildren(...content);
    } catch (error) {
      reading.replaceChildren(element("p", { className: "status", text: `The page couldn't be loaded. ${error.message} Try refreshing.` }));
      throw error;
    }
    renderContents();
    store("view", String(view));
    scrollTo(0, progress * (document.documentElement.scrollHeight - innerHeight));
    store("progress", String(progress));
    // Moves keyboard and screen reader focus to the new page without scrolling past its top.
    reading.querySelector("h1")?.focus({ preventScroll: true });
  }

  // The address stays the same; history entries only let the back button step through a visit.
  function navigate(view) {
    if (view === shownView) {
      scrollTo(0, 0);
      return;
    }
    history.pushState({ view }, "");
    show(view);
  }

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-chapter], [data-newest]");
    if (!target) return;
    navigate(target.hasAttribute("data-newest") ? NEWEST : Number(target.dataset.chapter));
  });

  addEventListener("popstate", (event) => {
    if (event.state?.view !== undefined) show(event.state.view);
  });

  let isSavingPlace = false;
  addEventListener(
    "scroll",
    () => {
      if (isSavingPlace || shownView === null) return;
      isSavingPlace = true;
      setTimeout(() => {
        const scrollable = document.documentElement.scrollHeight - innerHeight;
        store("progress", String(scrollable > 0 ? scrollY / scrollable : 0));
        isSavingPlace = false;
      }, 400);
    },
    { passive: true },
  );

  for (const lamp of document.querySelectorAll("[data-lamp]")) {
    lamp.addEventListener("click", () => {
      const root = document.documentElement;
      const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = isDark ? "light" : "dark";
      store("theme", root.dataset.theme);
    });
  }

  fetchJson("book.json")
    .then((index) => {
      book = index;
      const view = viewToOpen(readStored("view"), book.chapters.length);
      const isSameView = readStored("view") === String(view);
      history.replaceState({ view }, "");
      return show(view, { progress: isSameView ? Number(readStored("progress")) || 0 : 0 });
    })
    .catch((error) => {
      reading.replaceChildren(element("p", { className: "status", text: `The book couldn't be loaded. ${error.message} Try refreshing.` }));
      throw error;
    });
}
