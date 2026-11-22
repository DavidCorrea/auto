(function() {
  'use strict';
  var input = document.getElementById('guestbook-search-input');
  if (!input) return;
  var entries = document.querySelectorAll('#guestbook .entry, #guestbook article');
  input.addEventListener('input', function() {
    var term = this.value.toLowerCase().trim();
    if (!term) {
      entries.forEach(function(e) { e.style.display = ''; });
      return;
    }
    entries.forEach(function(entry) {
      var text = entry.textContent.toLowerCase();
      entry.style.display = text.includes(term) ? '' : 'none';
    });
  });
})();