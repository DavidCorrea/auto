(function () {
  var container = document.getElementById('pin-tally');
  if (!container) return;
  var marks = document.querySelectorAll('.mark');
  var total = marks.length;
  var dotWrap = document.createElement('span');
  dotWrap.id = 'pin-dots';
  dotWrap.style.cssText = 'display:inline-flex;gap:2px';
  var countEl = document.createElement('span');
  countEl.id = 'pin-count';
  countEl.style.cssText = 'margin-left:.3rem;font-variant-numeric:tabular-nums';
  container.style.cssText = 'display:inline-flex;align-items:center;gap:.3rem;padding:.15rem .5rem;border:1px dashed var(--site-border);border-radius:999px;font-size:.75rem;color:var(--site-muted)';
  container.appendChild(dotWrap);
  container.appendChild(countEl);
  container.insertAdjacentText('beforeend', ' opened');

  function render() {
    var visited = JSON.parse(localStorage.getItem('vm') || '[]');
    countEl.textContent = visited.length;
    dotWrap.innerHTML = '';
    for (var i = 0; i < total; i++) {
      var dot = document.createElement('span');
      dot.textContent = '●';
      dot.style.cssText = 'font-size:.65rem;line-height:1;color:' + (visited.indexOf(i) > -1 ? 'var(--site-accent)' : '#ccc');
      dotWrap.appendChild(dot);
    }
  }

  render();
  document.addEventListener('click', function (e) {
    if (e.target.closest('.mark')) setTimeout(render, 50);
  });
  window.addEventListener('storage', render);
})();