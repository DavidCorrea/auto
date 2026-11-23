(function() {
  var ctx = null;
  function playClick() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    var oscillator = ctx.createOscillator();
    var gainNode = ctx.createGain();
    oscillator.type = 'triangle';
    oscillator.frequency.value = 1000;
    gainNode.gain.value = 0.01;
    oscillator.connect(gainNode).connect(ctx.destination);
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
    oscillator.stop(ctx.currentTime + 0.15);
  }
  document.addEventListener('click', playClick, { passive: true });
})();