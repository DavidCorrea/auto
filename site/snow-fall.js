// snow-fall.js
// Simple script to draw a faint falling snowflake near the mouse cursor.
(function () {
  var canvas = document.createElement('canvas');
  canvas.style.position = 'fixed';
  canvas.style.pointerEvents = 'none';
  canvas.width = 120;
  canvas.height = 80;
  var ctx = canvas.getContext('2d');

  // Draw initial snowflake
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(60, 40, 4, 0, Math.PI * 2);
  ctx.fill();

  // Animation loop
  var frames = 0;
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Spawn a new snowflake at random position
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, 2, 0, Math.PI * 2);
    ctx.fill();
    // Draw a falling streak
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.random() * canvas.width, Math.random() * canvas.height + 15);
    ctx.lineTo(Math.random() * canvas.width, Math.random() * canvas.height + 35);
    ctx.stroke();
    frames++;
    if (frames > 30) { frames = 0; } // reset after a while
    requestAnimationFrame(animate);
  }
  animate();
})();