// Site du cabinet VMG Consulting · le formulaire PRÉPARE un message dans la messagerie du visiteur ;
// il n'envoie rien lui-même et ne contacte aucun serveur. Sans script, l'adresse reste affichée.
(function () {
  'use strict';
  var an = document.getElementById('annee');
  if (an) an.textContent = String(new Date().getFullYear());

  // Mouvement sobre, jamais indispensable : sans script ou sous prefers-reduced-motion, tout est déjà visible.
  var calme = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var mots = document.querySelectorAll('.mot');
  for (var m = 0; m < mots.length; m++) mots[m].style.setProperty('--i', String(m));
  var entete = document.getElementById('entete');
  var barre = document.getElementById('progres');
  function defile() {
    var haut = window.pageYOffset || document.documentElement.scrollTop;
    if (entete && !document.body.classList.contains('page-texte')) entete.classList.toggle('pleine', haut > 24);
    if (barre) {
      var total = document.documentElement.scrollHeight - window.innerHeight;
      barre.style.width = (total > 0 ? Math.min(100, (haut / total) * 100) : 0) + '%';
    }
  }
  var haut = document.getElementById('haut');
  if (haut) {
    haut.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: calme ? 'auto' : 'smooth' });
    });
  }
  function montreHaut() {
    if (haut) haut.classList.toggle('visible', (window.pageYOffset || document.documentElement.scrollTop) > 300);
  }
  window.addEventListener('scroll', montreHaut, { passive: true });
  montreHaut();
  window.addEventListener('scroll', defile, { passive: true });
  defile();
  var revele = document.querySelectorAll('.revele, .chemin');
  if (calme || !('IntersectionObserver' in window)) {
    for (var r = 0; r < revele.length; r++) revele[r].classList.add('vu');
  } else {
    var obs = new IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('vu'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    for (var k = 0; k < revele.length; k++) {
      revele[k].style.setProperty('--d', ((k % 3) * 0.08) + 's');
      obs.observe(revele[k]);
    }
  }
  // Onglets de situation (clavier : flèches, début, fin).
  var onglets = Array.prototype.slice.call(document.querySelectorAll('[role=tab]'));
  function choisir(o, focus) {
    onglets.forEach(function (t) {
      var actif = t === o;
      t.setAttribute('aria-selected', actif ? 'true' : 'false');
      t.tabIndex = actif ? 0 : -1;
      document.getElementById(t.getAttribute('aria-controls')).hidden = !actif;
    });
    if (focus) o.focus();
  }
  onglets.forEach(function (t, i) {
    t.addEventListener('click', function () { choisir(t, false); });
    t.addEventListener('keydown', function (e) {
      var j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % onglets.length;
      else if (e.key === 'ArrowLeft') j = (i + onglets.length - 1) % onglets.length;
      else if (e.key === 'Home') j = 0;
      else if (e.key === 'End') j = onglets.length - 1;
      if (j !== null) { e.preventDefault(); choisir(onglets[j], true); }
    });
  });
  var form = document.getElementById('demande');
  var retour = document.getElementById('retour');
  if (!form || !retour) return;
  var DESTINATAIRE = 'admin@vmgconsulting.net';
  function dire(texte, erreur) {
    retour.textContent = texte;
    retour.className = erreur ? 'retour ko' : 'retour';
    retour.hidden = false;
  }
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var courriel = document.getElementById('courriel');
    var message = document.getElementById('message');
    if (!courriel.value || !courriel.checkValidity()) {
      dire('Indiquez un courriel valide pour que nous puissions vous répondre.', true);
      courriel.focus();
      return;
    }
    if (!message.value.trim()) {
      dire('Écrivez votre message.', true);
      message.focus();
      return;
    }
    var champ = function (id) { return document.getElementById(id).value.trim(); };
    var corps = 'Entité : ' + champ('entite') + '\nNom : ' + champ('nom') + '\nCourriel : ' + champ('courriel') + '\n\n' + message.value.trim();
    var lien = 'mailto:' + DESTINATAIRE + '?subject=' + encodeURIComponent(champ('type')) + '&body=' + encodeURIComponent(corps);
    window.location.href = lien;
    dire('Votre messagerie doit s\'ouvrir avec le message prêt. Si rien ne s\'ouvre, écrivez directement à ' + DESTINATAIRE + '.', false);
  });
})();
