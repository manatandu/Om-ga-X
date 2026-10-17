// Page publique · aucune donnée, aucun appel. Le cachet se pose une fois la
// pièce à l'écran, les blocs se révèlent à la lecture ; sans mouvement
// (prefers-reduced-motion) ou sans IntersectionObserver, tout est déjà visible.
(function () {
  var reduit = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var an = document.getElementById('annee');
  if (an) an.textContent = String(new Date().getFullYear());

  var piece = document.querySelector('.piece-corps');
  if (piece) {
    if (reduit) piece.classList.add('pose');
    else window.setTimeout(function () { piece.classList.add('pose'); }, 650);
  }

  var blocs = document.querySelectorAll('.bloc > *, .appel > *');
  if (reduit || !('IntersectionObserver' in window)) return;
  blocs.forEach(function (b) { b.setAttribute('data-reveal', ''); });
  var obs = new IntersectionObserver(function (items) {
    items.forEach(function (i) {
      if (i.isIntersecting) { i.target.classList.add('vu'); obs.unobserve(i.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  blocs.forEach(function (b) { obs.observe(b); });
})();
