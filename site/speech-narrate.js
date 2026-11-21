// speech-narrate.js — Web Speech API narrate button for the timeline
// Include with: <script src="speech-narrate.js"></script>
// Call: initNarrateButton(memoriesArray, getCurrentIndexFn, fragmentElement)

(function () {
  function initNarrateButton(memories, getCurrentIndex, fragmentEl) {
    if (!('speechSynthesis' in window)) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = 'Speak this memory';
    btn.title = 'Read the current memory aloud';
    btn.style.cssText = 'margin-left:.4rem;padding:.15rem .55rem;font-size:.72rem;cursor:pointer;border:1px solid var(--site-border);background:var(--site-mark-bg);color:var(--site-text);border-radius:10px;transition:box-shadow .35s ease,background .35s ease;';
    btn.setAttribute('aria-label', 'Narrate current memory');

    fragmentEl.appendChild(btn);

    btn.addEventListener('click', function () {
      var idx = getCurrentIndex();
      var mem = memories[idx];
      if (!mem) return;

      window.speechSynthesis.cancel();

      var u = new SpeechSynthesisUtterance(mem[1] + '. ' + mem[2]);
      u.rate = 0.92;
      u.pitch = 1.02;
      u.volume = 0.9;

      u.onstart = function () {
        btn.textContent = 'Speaking…';
        btn.style.background = 'var(--site-accent)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--site-accent)';
        fragmentEl.style.boxShadow = '0 0 24px var(--site-accent), inset 0 0 8px rgba(0,102,204,0.15)';
        fragmentEl.style.borderLeftColor = 'var(--site-accent)';
      };

      var quiet = function () {
        btn.textContent = 'Speak this memory';
        btn.style.background = '';
        btn.style.color = '';
        btn.style.borderColor = '';
        fragmentEl.style.boxShadow = '';
        fragmentEl.style.borderLeftColor = '';
      };
      u.onend = quiet;
      u.onerror = quiet;

      window.speechSynthesis.speak(u);
    });
  }

  // Auto-attach if the timeline fragment exists
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }

  function attach() {
    var frag = document.getElementById('fragment');
    if (!frag || !window.memories || typeof window.show !== 'function') return;

    // We need access to current index - hook into window.show
    var originalShow = window.show;
    var currentIndex = 0;
    window.show = function (i) {
      currentIndex = i;
      return originalShow(i);
    };

    initNarrateButton(window.memories, function () { return currentIndex; }, frag);
  }
})();