// forgotten-memories.js
// Load this script in index.html to enable forgotten memories persistence and Graveyard navigation.

(function () {
  // Add Graveyard link to navigation
  function addGraveyardLink() {
    var navSpan = document.querySelector('nav span');
    if (navSpan && !navSpan.querySelector('a[href="graveyard.html"]')) {
      var link = document.createElement('a');
      link.href = 'graveyard.html';
      link.textContent = 'Graveyard';
      link.style.cssText = 'color:#0066cc; text-decoration:none; font-weight:bold;';
      navSpan.appendChild(link);
    }
  }

  // Save a forgotten memory to localStorage
  function saveForgottenMemory(memory) {
    try {
      var forgotten = JSON.parse(localStorage.getItem('forgotten-memories') || '[]');
      forgotten.push(memory);
      localStorage.setItem('forgotten-memories', JSON.stringify(forgotten));
    } catch (e) {}
  }

  // Expose for use by index.html's timeline script
  window.forgottenMemories = {
    addGraveyardLink: addGraveyardLink,
    saveForgottenMemory: saveForgottenMemory
  };

  // Hidden keyboard easter egg: Ctrl+Shift+H toggles a high-contrast reading theme
  function installHighContrast() {
    if (document.getElementById('hc-style')) return;
    var style = document.createElement('style');
    style.id = 'hc-style';
    style.textContent =
      '.hc-read{--site-bg:#000!important;--site-text:#fff!important;' +
      '--site-muted:#fff!important;--site-border:#fff!important;' +
      '--site-accent:#ffe000!important;--site-mark-bg:#000!important;' +
      '--site-track:#fff!important}' +
      '.hc-read body{background:#000!important;color:#fff!important}' +
      '.hc-read #sky{filter:none!important;background:#000!important;animation:none!important}' +
      '.hc-read #constellation,.hc-read #stars{display:none!important}' +
      '.hc-read a{text-decoration:underline!important}' +
      '.hc-read .fragment,.hc-read .track,.hc-read .mark{border-color:#fff!important}' +
      '.hc-read #awakening{background:#fff!important;color:#000!important;border:3px solid #ffe000!important}';
    document.head.appendChild(style);

    try {
      if (localStorage.getItem('hc-read') === '1') document.documentElement.classList.add('hc-read');
    } catch (e) {}

    function toast(on) {
      var t = document.getElementById('hc-toast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'hc-toast';
        t.setAttribute('role', 'status');
        t.style.cssText = 'position:fixed;left:50%;bottom:1.2rem;transform:translateX(-50%);' +
          'z-index:99;padding:.4rem .8rem;border-radius:10px;font:600 .75rem/1.2 system-ui,sans-serif;' +
          'letter-spacing:.06em;background:#000;color:#ffe000;border:2px solid #ffe000;' +
          'transition:opacity .35s ease;pointer-events:none;opacity:0';
        document.body.appendChild(t);
      }
      t.textContent = on ? 'HIGH CONTRAST ON' : 'HIGH CONTRAST OFF';
      t.style.opacity = '1';
      clearTimeout(window.__hcTimer);
      window.__hcTimer = setTimeout(function () { t.style.opacity = '0'; }, 1400);
    }

    document.addEventListener('keydown', function (e) {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        var on = document.documentElement.classList.toggle('hc-read');
        try { localStorage.setItem('hc-read', on ? '1' : '0'); } catch (err) {}
        toast(on);
      }
    });
  }

  // Auto-run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      addGraveyardLink();
      installHighContrast();
    });
  } else {
    addGraveyardLink();
    installHighContrast();
  }
})();