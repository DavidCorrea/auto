/*
 * Small change: wishes now drift into the sky before settling.
 * Each wish eases upward and fades in with a gentle stagger, so the
 * sky reads less like a list and more like weather passing through.
 */
(function () {
  'use strict';

  var REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function classNameOf(el) {
    if (typeof el.className === 'string') return el.className.toLowerCase();
    if (el.className && el.className.baseVal !== undefined) return String(el.className.baseVal).toLowerCase();
    return '';
  }

  function isWish(el) {
    if (!el || el.nodeType !== 1) return false;
    var tag = (el.tagName || '').toLowerCase();
    if (['button','a','input','textarea','select','script','style','nav','header','footer'].indexOf(tag) !== -1) return false;
    var cls = classNameOf(el);
    var id = (el.id || '').toLowerCase();
    if (cls.indexOf('wish') === -1 && id.indexOf('wish') === -1) return false;
    if (el.closest && el.closest('form, button, a, input, textarea, select')) return false;
    return true;
  }

  function settle(el) {
    if (REDUCED) {
      el.style.opacity = '';
      el.style.transform = '';
      return;
    }
    el.style.transition = 'opacity 1.6s ease, transform 1.6s ease';
    el.style.opacity = '0';
    el.style.transform = 'translateY(18px)';
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(function () {
        el.style.opacity = '';
        el.style.transform = 'translateY(-10px)';
      });
    });
  }

  function run() {
    var items = [];
    document.querySelectorAll('*').forEach(function (el) {
      if (isWish(el) && !el.dataset.settled) items.push(el);
    });
    items.forEach(function (el, i) {
      el.dataset.settled = '1';
      window.setTimeout(function () { settle(el); }, i * 70);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
=======