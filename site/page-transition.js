(function(){
  var links = document.querySelectorAll('nav a');
  links.forEach(function(link) {
    link.addEventListener('click', function() {
      document.body.style.transition = 'opacity 0.5s';
      document.body.style.opacity = 0;
      setTimeout(function() {}, 500);
    });
  });
})();