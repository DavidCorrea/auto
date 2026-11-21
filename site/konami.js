// Konami code easter egg
// When the Konami code is entered (↑↑↓↓←→←→BA), shifts the sky palette by 180 degrees
(function(){
  var code = [];
  var konami = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyB', 'KeyA'];
  document.addEventListener('keydown', function(e) {
    code.push(e.code);
    if(code.length > konami.length) code.shift();
    if(JSON.stringify(code) === JSON.stringify(konami)) {
      var sky = document.getElementById('sky');
      if(sky) {
        var current = parseInt(sky.style.getPropertyValue('--hue')) || 265;
        sky.style.setProperty('--hue', (current + 180) % 360);
      }
      code = [];
    }
  });
})();