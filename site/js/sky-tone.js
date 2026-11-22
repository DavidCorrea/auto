function updateHue(){
  var now = new Date();
  var hour = now.getHours() + now.getMinutes()/60 + now.getSeconds()/3600;
  var hue = 265 + ((hour) / 24) * 360;
  sky.style.setProperty('--hue', hue);
  // play tone
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!window.__beepCtx) window.__beepCtx = new AC();
    var ctx = window.__beepCtx;
    if (ctx.state === 'suspended') ctx.resume();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 132;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 1.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 1.2);
  } catch (e) {}
}