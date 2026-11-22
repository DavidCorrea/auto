(function () {
  var tints = [
    'rgba(160, 196, 255, 0.08)',
    'rgba(255, 183, 160, 0.08)',
    'rgba(192, 224, 180, 0.08)',
    'rgba(208, 192, 224, 0.08)',
    'rgba(208, 192, 160, 0.08)'
  ];
  function apply(i) { document.body.style.background = tints[i] || ''; }
  window.applyMemoryTint = apply;
  document.querySelectorAll('.mark').forEach(function (b, i) {
    b.addEventListener('click', function () { apply(i); });
  });
})();
=======