document.addEventListener('keydown', function(e) {
  if (e.key === 's' || e.key === 'S') {
    var i = Math.floor(Math.random() * memories.length);
    show(i);
    document.getElementById('shuffle-announce').textContent = 'Now showing: ' + memories[i][1];
    var sky = document.getElementById('sky');
    if (sky) sky.style.setProperty('--hue', Math.floor(Math.random() * 360));
  }
});