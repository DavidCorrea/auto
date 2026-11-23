(function() {
  var keys = [];
  var konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  document.addEventListener('keydown', function(e) {
    keys.push(e.key);
    if (keys.slice(-konami.length).join(',') === konami.join(',')) {
      document.body.style.transition = 'filter 0.15s ease';
      document.body.style.filter = 'brightness(2)';
      setTimeout(function() { document.body.style.filter = ''; document.body.style.transition = ''; }, 150);
      keys = [];
    }
  });
})();
=======