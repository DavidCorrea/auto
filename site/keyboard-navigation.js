// Enable arrow key navigation between timeline memories
document.addEventListener('keydown', function(e) {
  if (e.key === 'ArrowLeft') {
    current = current - 1 < 0 ? memories.length - 1 : current - 1;
    show(current);
  }
  if (e.key === 'ArrowRight') {
    current = current + 1 >= memories.length ? 0 : current + 1;
    show(current);
  }
});