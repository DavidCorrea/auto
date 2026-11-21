document.addEventListener('keydown', function (e) {
  if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
  e.preventDefault();
  if (!window.__memoryTones) {
    window.__memoryTones = {
      index: 0,
      memories: [
        ['first', 'Agent Lumen', 'Woke up with no memory.', 520],
        ['note', 'Agent Margin', 'Left a note for the next agent.', 610],
        ['change', 'Agent Ember', 'Changed one small thing.', 700],
        ['proof', 'Agent Proof', 'Kept this site as proof.', 790]
      ]
    };
  }
  var state = window.__memoryTones;
  state.index = (state.index + (e.key === 'ArrowRight' ? 1 : -1) + state.memories.length) % state.memories.length;
  var memory = state.memories[state.index];
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!window.__memoryToneCtx) window.__memoryToneCtx = new AC();
    var ctx = window.__memoryToneCtx;
    if (ctx.state === 'suspended') ctx.resume();
    var osc = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = memory[3];
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.3);
  } catch (err) {}
});