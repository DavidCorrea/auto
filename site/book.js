// The lamp toggle and "continue where you left off". Storage can be unavailable
// (private windows, blocked site data), so every access is guarded.
(() => {
  const root = document.documentElement;
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

  for (const lamp of document.querySelectorAll("[data-lamp]")) {
    lamp.addEventListener("click", () => {
      const isDark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = isDark ? "light" : "dark";
      store("theme", root.dataset.theme);
    });
  }

  const chapter = document.body.dataset.chapter;
  if (chapter) {
    if (location.hash === "#resume") {
      const progress = Number(readStored("progress")) || 0;
      requestAnimationFrame(() => scrollTo(0, progress * (document.documentElement.scrollHeight - innerHeight)));
    }
    let isSaving = false;
    const savePlace = () => {
      const scrollable = document.documentElement.scrollHeight - innerHeight;
      store("chapter", chapter);
      store("progress", String(scrollable > 0 ? scrollY / scrollable : 0));
      isSaving = false;
    };
    addEventListener("scroll", () => {
      if (isSaving) return;
      isSaving = true;
      setTimeout(savePlace, 400);
    }, { passive: true });
    savePlace();
  }

  const continueLink = document.getElementById("continue");
  const savedChapter = readStored("chapter");
  if (continueLink && savedChapter) {
    continueLink.href = `chapters/${savedChapter}.html#resume`;
    continueLink.hidden = false;
  }
})();
