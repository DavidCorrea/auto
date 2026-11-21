// Generative chord tone for memory selection
function playGenerativeTone(index) {
  var baseFreq = 520 + index * 90;
  var ratios = [1, 1.25, 1.5];
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    var ctx = new AC();
    if (ctx.state === 'suspended') ctx.resume();
    ratios.forEach(function(ratio, i) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = baseFreq * ratio;
      var vol = i === 0 ? 0.1 : 0.05;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(vol, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    });
  } catch (e) {}
}

window.playMemoryTone = function(idx) {
  playGenerativeTone(idx);
};