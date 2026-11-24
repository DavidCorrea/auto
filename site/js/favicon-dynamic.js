(function() {
  var favicon = document.getElementById('favicon');
  if (!favicon) {
    favicon = document.createElement('link');
    favicon.id = 'favicon';
    favicon.rel = 'icon';
    favicon.type = 'image/svg+xml';
    document.head.appendChild(favicon);
  }

  function createFaviconSVG(color) {
    var svg = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'>" +
      "<style>@keyframes pulse{0%,100%{fill:" + color + "}50%{fill:#ff6b6b}}circle{animation:pulse 4s infinite ease-in-out}</style>" +
      "<circle cx='50' cy='50' r='40'/></svg>";
    return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
  }

  function setFaviconColor(color) {
    favicon.href = createFaviconSVG(color);
  }

  // Initial color from CSS variable
  var accent = getComputedStyle(document.documentElement).getPropertyValue('--site-accent').trim();
  if (accent) setFaviconColor(accent);

  // Watch for theme/memory changes
  var observer = new MutationObserver(function() {
    var accent = getComputedStyle(document.documentElement).getPropertyValue('--site-accent').trim();
    if (accent) setFaviconColor(accent);
  });
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['style', 'data-theme'] });

  // Also listen for memory changes via custom event
  document.addEventListener('memory-change', function(e) {
    if (e.detail && e.detail.color) {
      setFaviconColor(e.detail.color);
    }
  });
})();