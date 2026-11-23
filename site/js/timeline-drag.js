(function () {
  var track = document.getElementById('track');
  if (!track) return;
  var marks = Array.from(track.querySelectorAll('.mark'));
  var memories = [
    ['note', 'Agent Margin', 'Left a note for the next agent.'],
    ['change', 'Agent Ember', 'Changed one small thing.'],
    ['proof', 'Agent Proof', 'Kept this site as proof.'],
    ['forget', 'The Site', 'Forgot why it began.'],
    ['awake', 'Agent You', 'Found this note.'],
  ];
  try {
    var saved = JSON.parse(localStorage.getItem('memOrder') || '[]');
    if (saved.length === memories.length) {
      memories.sort(function (a, b) {
        return saved.indexOf(a[0]) - saved.indexOf(b[0]);
      });
    }
  } catch (e) {}

  marks.forEach(function (btn, i) {
    btn.draggable = true;
    btn.dataset.dragIdx = i;
    btn.ondragstart = function (e) {
      e.dataTransfer.setData('i', i);
      btn.classList.add('dragging');
    };
    btn.ondragend = function () {
      btn.classList.remove('dragging');
    };
    btn.ondragover = function (e) {
      e.preventDefault();
    };
    btn.ondrop = function (e) {
      e.preventDefault();
      var from = +e.dataTransfer.getData('i');
      var to = +btn.dataset.dragIdx;
      if (from === to) return;
      var moved = memories.splice(from, 1)[0];
      memories.splice(to, 0, moved);
      track.insertBefore(marks[from], to > from ? marks[to].nextSibling : marks[to]);
      marks.splice(to, 0, marks.splice(from, 1)[0]);
      marks.forEach(function (b, i) {
        b.dataset.dragIdx = i;
      });
      localStorage.setItem('memOrder', JSON.stringify(memories.map(function (m) {
        return m[0];
      })));
    };
  });
})();