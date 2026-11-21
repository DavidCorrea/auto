(function () {
  var items = document.querySelectorAll('[data-unfinished]');
  var AC = window.AudioContext || window.webkitAudioContext;
  var ctx = null;
  function getCtx() {
    if (!AC) return null;
    if (!ctx) ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function play() {
    var ac = getCtx();
    if (!ac) return;
    var osc = ac.createOscillator();
    var gain = ac.createGain();
    var t = ac.currentTime;
    osc.type = 'sine';
    osc.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.06, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    osc.connect(gain);
    gain.connect(ac.destination);
    osc.start(t);
    osc.stop(t + 0.14);
  }
  items.forEach(function (el) {
    el.addEventListener('mouseenter', play);
  });
})();