
document.addEventListener('mousemove', function(e) {
  var particle = document.createElement('div');
  particle.style.position = 'fixed';
  particle.style.width = '6px';
  particle.style.height = '6px';
  particle.style.borderRadius = '50%';
  particle.style.background = 'rgba(0, 102, 204, 0.6)';
  particle.style.left = e.clientX + 'px';
  particle.style.top = e.clientY + 'px';
  particle.style.pointerEvents = 'none';
  particle.style.zIndex = '9999';
  document.body.appendChild(particle);
  setTimeout(function() { particle.remove(); }, 500);
});