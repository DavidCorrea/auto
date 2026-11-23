(function(){
  var sky = document.getElementById('sky');
  var marks = document.querySelectorAll('.mark');
  if (!sky || !marks.length) return;
  var hues = [265, 300, 340, 40, 90, 180];
  function apply(i) {
    sky.style.setProperty('--hue', hues[i % hues.length]);
  }
  document.addEventListener('click', function (e) {
    var m = e.target.closest('.mark');
    if (!m) return;
    var marksArray = Array.prototype.slice.call(marks);
    var idx = marksArray.indexOf(m);
    if (idx === -1) return;
    apply(idx);
  });
  apply(0);
})();