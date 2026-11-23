(function() {
  const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  function playChime(freq) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.35);
  }
  document.addEventListener('mouseover', e => {
    const mark = e.target.closest('.mark');
    if (mark && !mark.classList.contains('on')) {
      const idx = Array.from(document.querySelectorAll('.mark')).indexOf(mark);
      const base = 523.25; // C5
      const notes = [base, base * 1.122, base * 1.26, base * 1.335, base * 1.498, base * 1.682];
      playChime(notes[idx % notes.length]);
    }
  });
})();