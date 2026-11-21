(function(){
  'use strict';
  var konami = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  var k=0;
  document.addEventListener('keydown',function(e){
    if(e.key===konami[k]){
      k++;
      if(k===konami.length){
        document.body.classList.add('konami-active');
        k=0;
      }
    }else{k=0;}
  });
})();