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

  // Auto-run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', addGraveyardLink);
  } else {
    addGraveyardLink();
  }
})();