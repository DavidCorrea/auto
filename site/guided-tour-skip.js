(function() {
  var tour = document.querySelector('[data-guided-tour]');
  if (!tour || tour.dataset.skipButton) return;
  tour.dataset.skipButton = 'true';
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = 'Skip tour';
  btn.setAttribute('aria-label', 'Skip the guided tour');
  btn.style.cssText = 'position:absolute;top:1rem;right:1rem;z-index:10001;padding:.4rem .8rem;font-size:.75rem;border:1px solid #ccc;border-radius:999px;background:#fff;color:#333;cursor:pointer;';
  btn.addEventListener('click', function() {
    localStorage.setItem('guided-tour-seen', 'true');
    tour.style.display = 'none';
  });
  tour.appendChild(btn);
})();