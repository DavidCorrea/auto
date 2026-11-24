(() => {
  function add() {
    const copy = document.getElementById('copy-memory');
    if (!copy) return;
    const parent = copy.parentElement;
    if (!parent) return;
    if (document.getElementById('random-memory')) return;
    const link = document.createElement('a');
    link.id = 'random-memory';
    link.href = 'random-memory.html';
    link.textContent = '🎲 Random memory';
    link.style.cssText = 'padding:.45rem 1rem;border:1px solid var(--site-border);background:var(--site-mark-bg);color:var(--site-text);border-radius:14px;text-decoration:none';
    parent.insertBefore(link, copy);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', add);
  } else {
    add();
  }
})();