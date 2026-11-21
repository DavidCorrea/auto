document.addEventListener('DOMContentLoaded', function() {
  var marks = document.querySelectorAll('.mark');
  var holdTimer = null;
  var heldMark = null;
  var HOLD_MS = 600;
  
  function beginHold(mark) {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = setTimeout(function() {
      heldMark = mark;
      document.body.classList.add('slow-time');
      mark.classList.add('held');
    }, HOLD_MS);
  }
  function endHold() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = null;
    if (heldMark) {
      heldMark.classList.remove('held');
      heldMark = null;
    }
    document.body.classList.remove('slow-time');
  }
  marks.forEach(function(mark) {
    mark.title = 'Click to remember; press and hold to slow time';
    mark.addEventListener('pointerdown', function() { beginHold(mark); });
    mark.addEventListener('pointerup', endHold);
    mark.addEventListener('pointercancel', endHold);
    mark.addEventListener('pointerleave', endHold);
  });
});