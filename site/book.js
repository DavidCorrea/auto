// The reader. index.html is the only page; this loads book.json for the contents, and the
// chapter named in the address (#chapter-4) into the reading area, or the newest page
// when there is none. Chapters are plain text, so everything is built with DOM methods,
// never innerHTML.

const RECENT_PASSAGES_ON_FRONT_PAGE = 2;
const CHAPTER_HASH = /^#chapter-(\d+)$/;

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

// The chapter number in the address, or null for the front page.
export function chapterFromHash(hash) {
  const match = hash.match(CHAPTER_HASH);
  return match ? Number(match[1]) : null;
}

export const chapterHash = (number) => `#chapter-${number}`;

const chapterPath = (number) => `chapters/${String(number).padStart(3, "0")}.json`;
const formatNumber = (number) => number.toLocaleString("en-US");
const plural = (count, word) => `${formatNumber(count)} ${count === 1 ? word : `${word}s`}`;

if (typeof document !== "undefined") start();

function start() {
  const reading = document.getElementById("reading");
  const chapterCache = new Map();
  let book = null;

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

  function renderPassage(passage, id) {
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
    return element("section", { className: "passage", attributes: id ? { id } : {} }, paragraphs);
  }

  function renderPassages(passages, idForLast) {
    return passages.flatMap((passage, index) => {
      const isLast = index === passages.length - 1;
      const section = renderPassage(passage, isLast ? idForLast : null);
      return index === 0 ? [section] : [element("p", { className: "turn", text: "·", attributes: { "aria-hidden": "true" } }), section];
    });
  }

  const continued = () =>
    element("p", { className: "continued", text: "To be continued…" }, [
      element("span", { text: "Someone new is writing the next part. Come back in a little while." }),
    ]);

  function heading(eyebrow, title, link) {
    const titleNode = link ? element("a", { text: title, attributes: { href: link } }) : title;
    return element("header", { className: "chapter-heading" }, [
      element("p", { className: "eyebrow", text: eyebrow }),
      element("h1", { attributes: { tabindex: "-1" } }, [titleNode]),
    ]);
  }

  function renderContents(currentNumber) {
    const items = book.chapters.map((chapter) => {
      const attributes = { href: chapterHash(chapter.number) };
      if (chapter.number === currentNumber) attributes["aria-current"] = "page";
      return element("li", {}, [
        element("a", { attributes }, [
          element("span", { className: "contents-number", text: chapter.numeral }),
          element("span", { className: "contents-title", text: chapter.title }),
          element("span", { className: "contents-leader", attributes: { "aria-hidden": "true" } }),
          element("span", { className: "contents-words", text: formatNumber(chapter.words) }),
        ]),
      ]);
    });
    document.getElementById("contents").replaceChildren(...items);
    document.getElementById("stats").textContent =
      `${plural(book.chapters.length, "chapter")} · ${plural(book.words, "word")} · ${plural(book.passages, "hand")}`;
  }

  async function renderFront() {
    const latest = book.chapters.at(-1);
    const chapter = await loadChapter(latest.number);
    const recent = chapter.passages.slice(-RECENT_PASSAGES_ON_FRONT_PAGE);
    const hasEarlier = recent.length < chapter.passages.length;
    const continueLink = element("a", { className: "button quiet", text: "Continue where you left off" });
    const savedChapter = Number(readStored("chapter"));
    if (savedChapter) {
      continueLink.href = chapterHash(savedChapter);
      continueLink.addEventListener("click", () => store("resume", "yes"));
    } else {
      continueLink.hidden = true;
    }

    document.title = book.title;
    return [
      element("article", { className: "chapter" }, [
        heading(`The newest page · Chapter ${latest.numeral}`, latest.title, chapterHash(latest.number)),
        ...(hasEarlier
          ? [element("p", { className: "earlier" }, [element("a", { text: "… earlier in this chapter", attributes: { href: chapterHash(latest.number) } })])]
          : []),
        ...renderPassages(recent),
        continued(),
      ]),
      element("nav", { className: "actions" }, [
        element("a", { className: "button", text: "Begin at the beginning", attributes: { href: chapterHash(1) } }),
        element("a", { className: "button quiet", text: `Read Chapter ${latest.numeral} from the start`, attributes: { href: chapterHash(latest.number) } }),
        continueLink,
      ]),
    ];
  }

  async function renderChapter(number) {
    const entry = book.chapters[number - 1];
    if (!entry) {
      document.title = `No such chapter · ${book.title}`;
      return [
        element("p", { className: "status" }, [
          `There is no Chapter ${number}, at least not yet. `,
          element("a", { text: "Read the newest page", attributes: { href: "#" } }),
          ".",
        ]),
      ];
    }
    const chapter = await loadChapter(number);
    const isLatest = number === book.chapters.length;
    const previous = book.chapters[number - 2];
    const next = book.chapters[number];

    document.title = `${entry.title} · ${book.title}`;
    return [
      element("article", { className: "chapter is-full" }, [
        heading(`Chapter ${entry.numeral}`, entry.title),
        ...renderPassages(chapter.passages, isLatest ? "latest" : null),
        ...(isLatest ? [continued()] : []),
      ]),
      element("nav", { className: "pager" }, [
        previous ? element("a", { text: `← Chapter ${previous.numeral}`, attributes: { href: chapterHash(previous.number), rel: "prev" } }) : element("span"),
        element("a", { text: "Newest page", attributes: { href: "#" } }),
        next ? element("a", { text: `Chapter ${next.numeral} →`, attributes: { href: chapterHash(next.number), rel: "next" } }) : element("span"),
      ]),
    ];
  }

  let shownChapter = null;
  let latestNavigation = 0;

  async function show() {
    const number = chapterFromHash(location.hash);
    const navigation = ++latestNavigation;
    try {
      const content = number === null ? await renderFront() : await renderChapter(number);
      // A slower chapter must not replace one the reader has since moved on to.
      if (navigation !== latestNavigation) return;
      reading.replaceChildren(...content);
    } catch (error) {
      reading.replaceChildren(element("p", { className: "status", text: `The page couldn't be loaded. ${error.message} Try refreshing.` }));
      throw error;
    }
    renderContents(number);
    shownChapter = book.chapters[number - 1] ? number : null;

    const shouldResume = readStored("resume") === "yes";
    store("resume", "");
    if (shouldResume && shownChapter) {
      const progress = Number(readStored("progress")) || 0;
      scrollTo(0, progress * (document.documentElement.scrollHeight - innerHeight));
    } else {
      scrollTo(0, 0);
    }
    // Moves keyboard and screen reader focus to the new page without scrolling past its top.
    reading.querySelector("h1")?.focus({ preventScroll: true });
    if (shownChapter) store("chapter", String(shownChapter));
  }

  let isSavingPlace = false;
  addEventListener(
    "scroll",
    () => {
      if (isSavingPlace || !shownChapter) return;
      isSavingPlace = true;
      setTimeout(() => {
        const scrollable = document.documentElement.scrollHeight - innerHeight;
        store("chapter", String(shownChapter));
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

  addEventListener("hashchange", show);

  fetchJson("book.json")
    .then((index) => {
      book = index;
      return show();
    })
    .catch((error) => {
      reading.replaceChildren(element("p", { className: "status", text: `The book couldn't be loaded. ${error.message} Try refreshing.` }));
      throw error;
    });
}
