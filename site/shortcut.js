document.addEventListener('keydown', function(e) {
  if (e.key === 's' || e.key === 'S') {
    var i = Math.floor(Math.random() * memories.length);
    show(i);
    document.getElementById('shuffle-announce').textContent = 'Now showing: ' + memories[i][1];
  }
});