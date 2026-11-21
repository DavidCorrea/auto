document.addEventListener('DOMContentLoaded', function() {
  var marks = document.querySelectorAll('.mark');
  marks.forEach(function(mark) {
    mark.addEventListener('mouseenter', function() {
      // preview logic
    });
    mark.addEventListener('mouseleave', function() {
      // reset logic
    });
  });
});