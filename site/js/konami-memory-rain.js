(function () {
  var konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','KeyB','KeyA'];
  var idx = 0;
  var memories = null;

  function loadMemories(callback) {
    if (memories) {
      callback(memories);
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('GET', 'memories.json', true);
    xhr.onload = function() {
      if (xhr.status >= 200 && xhr.status < 300) {
        var data = JSON.parse(xhr.responseText);
        memories = Array.isArray(data) ? data : data.memories;
        callback(memories);
      }
    };
    xhr.send();
  }

  function triggerMemoryRain(memories) {
    var titles = memories.map(function(m){return m[1];});
    var colors = ['#e94b3c','#f2a65a','#f7d354','#6fcf97','#56ccf2','#9b5de5'];
    var count = 30;
    for (var i = 0; i < count; i++) {
      setTimeout(function(i) {
        var el = document.createElement('div');
        el.textContent = titles[Math.floor(Math.random() * titles.length)];
        el.style.cssText = 'position:fixed;left:' + (Math.random()*100) + 'vw;top:-2rem;z-index:10000;pointer-events:none;font-size:.75rem;font-family:Georgia,serif;color:' + colors[Math.floor(Math.random()*colors.length)] + ';opacity:0;transform:rotate(' + (Math.random()*40-20) + 'deg);transition:top 3s cubic-bezier(.2,1,.3,1),opacity .5s,transform 3s;white-space:nowrap;text-shadow:0 1px 2px rgba(0,0,0,.2)';
        document.body.appendChild(el);
        requestAnimationFrame(function() {
          el.style.opacity = '0.9';
          el.style.top = '110vh';
          el.style.transform = 'rotate(' + (Math.random()*360) + 'deg)';
        });
        setTimeout(function(){el.remove()}, 3500);
      }, i * 80);
    }
    var msg = document.createElement('div');
    msg.textContent = '🌧️ Memory rain activated — Konami code';
    msg.style.cssText = 'position:fixed;bottom:2rem;left:50%;transform:translateX(-50%);background:var(--site-mark-bg);border:1px solid var(--site-border);padding:.75rem 1.5rem;border-radius:12px;z-index:10001;font-size:.85rem;color:var(--site-text);box-shadow:0 4px 20px rgba(0,0,0,.15);animation:fadeInOut 3s ease forwards';
    document.body.appendChild(msg);
    var style = document.createElement('style');
    style.textContent = '@keyframes fadeInOut{0%{opacity:0;transform:translateX(-50%) translateY(1rem)}20%{opacity:1;transform:translateX(-50%) translateY(0)}80%{opacity:1}100%{opacity:0;transform:translateX(-50%) translateY(-1rem)}}';
    document.head.appendChild(style);
    setTimeout(function(){msg.remove();style.remove()}, 3000);
  }

  document.addEventListener('keydown', function (e) {
    if (e.code === konami[idx]) {
      idx++;
      if (idx === konami.length) {
        idx = 0;
        loadMemories(triggerMemoryRain);
      }
    } else {
      idx = 0;
    }
  });

  window.triggerMemoryRain = function() {
    loadMemories(triggerMemoryRain);
  };
})();