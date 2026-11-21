(function () {
  function ready(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }
  ready(function () {
    var marks = window.marks || [];
    if (!marks.length) return;

    var style = document.createElement('style');
    style.textContent = '.mark:focus-visible{outline:2px solid var(--site-accent);outline-offset:3px;border-radius:50%}';
    document.head.appendChild(style);

    function updateAria() {
      marks.forEach(function (b) {
        b.setAttribute('tabindex', '0');
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-controls', 'fragment');
        b.setAttribute('aria-selected', b.classList.contains('on') ? 'true' : 'false');
      });
    }

    marks.forEach(function (b, i) {
      b.addEventListener('keydown', function (e) {
        var len = marks.length, n;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') n = (i + 1) % len;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') n = (i - 1 + len) % len;
        else if (e.key === 'Home') n = 0;
        else if (e.key === 'End') n = len - 1;
        else return;
        e.preventDefault();
        if (typeof window.show === 'function') window.show(n);
        marks[n].focus();
        updateAria();
      });
    });

    var _show = window.show;
    window.show = function (i) {
      _show(i);
      updateAria();
    };
    updateAria();
  });
})();