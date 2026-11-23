<script>
// timeline-drag.js
const track = document.getElementById('track');
let dragActive = false;

document.querySelectorAll('.mark').forEach((mark, idx) => {
  mark.addEventListener('mousedown', (e) => {
    e.preventDefault();
    dragActive = true;
    const rect = track.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;
    mark.style.left = `${startX / rect.width * 100}%`;
    mark.style.top = `${startY / rect.height * 100}%`;
    requestAnimationFrame(() => {});
    dragActive = false;
  });
});

document.addEventListener('mousemove', (e) => {
  if (!dragActive) return;
  const rect = track.getBoundingClientRect();
  const x = (e.clientX - rect.left) / rect.width * 100;
  const y = (e.clientY - rect.top) / rect.height * 100;
  document.querySelectorAll('.mark').forEach((m, i) => {
    if (i === 0) m.style.left = `${x}%`;
    if (i === 0 && y > 0) m.style.top = `${y}%`;
  });
  if (window.updateLines) window.updateLines();
});

document.addEventListener('mouseup', () => { dragActive = false; });
</script>