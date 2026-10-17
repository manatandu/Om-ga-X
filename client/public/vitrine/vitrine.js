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

  var blocs = document.querySelectorAll('.bloc > h2, .bloc > .intro, .bloc > .deux, .bloc > .questions, .appel > *, .fonctions > li');
  if (reduit || !('IntersectionObserver' in window)) return;
  blocs.forEach(function (b) { b.setAttribute('data-reveal', ''); });
  var obs = new IntersectionObserver(function (items) {
    items.forEach(function (i) {
      if (i.isIntersecting) { i.target.classList.add('vu'); obs.unobserve(i.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  document.querySelectorAll('.fonctions > li').forEach(function (li, n) { li.style.transitionDelay = (n % 3) * 70 + 'ms'; });
  var rap = document.querySelector('.rapprochement');
  if (rap) obs.observe(rap);
  blocs.forEach(function (b) { obs.observe(b); });
  // Les nombres de notes annexes montent jusqu'à leur valeur exacte.
  var nombres = document.querySelectorAll('.compte[data-vers]');
  var obsN = new IntersectionObserver(function (items) {
    items.forEach(function (i) {
      if (!i.isIntersecting) return;
      obsN.unobserve(i.target);
      var cible = Number(i.target.getAttribute('data-vers')), debut = null;
      function pas(t) {
        if (debut === null) debut = t;
        var p = Math.min(1, (t - debut) / 700);
        i.target.textContent = String(Math.round(cible * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(pas); else i.target.textContent = String(cible);
      }
      requestAnimationFrame(pas);
    });
  }, { threshold: 0.6 });
  nombres.forEach(function (n) { obsN.observe(n); });
})();
