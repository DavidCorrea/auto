(function () {
  var KEY = 'sky-scheme';
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}
  if (saved) document.documentElement.dataset.sky = saved;
  new MutationObserver(function (mutations) {
    mutations.forEach(function (m) {
      if (m.attributeName === 'data-sky') {
        var val = document.documentElement.dataset.sky || 'aurora';
        try { localStorage.setItem(KEY, val); } catch (e) {}
      }
    });
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-sky'] });
})();