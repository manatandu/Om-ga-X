// Page publique d'OmegaX · aucune donnée du dossier, un seul appel en lecture (l'état de l'essai).
// Tout ce qui bouge est une amélioration : sans script, sans IntersectionObserver ou sous
// prefers-reduced-motion, la page est complète et lisible dans son état final.
// Les effets s'inspirent des composants Magic UI (MIT) : blur-fade, text-reveal, number-ticker,
// scroll-progress, animated-beam, border-beam. Écrits à neuf, sans dépendance.
(function () {
  'use strict';
  var racine = document.documentElement;
  racine.classList.add('js');
  var reduit = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  var observable = 'IntersectionObserver' in window;

  function tous(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var an = document.getElementById('annee');
  if (an) an.textContent = String(new Date().getFullYear());

  // ---- L'essai · le lien ne s'offre que sur une porte lue ouverte (comme l'écran de connexion).
  // Une lecture qui échoue le tait : le libellé par défaut reste vrai dans les deux cas.
  function essaiOuvert(e) {
    return !!e && e.ouverte === true && typeof e.joursEssai === 'number' && e.joursEssai > 0;
  }
  function montrerEssai(jours) {
    tous('[data-essai]').forEach(function (a) {
      a.hidden = false;
      if (a.classList.contains('bouton-plein')) a.textContent = 'Essayer gratuitement ' + jours + ' jours';
    });
    tous('[data-jours]').forEach(function (s) { s.textContent = String(jours); });
    tous('[data-avec-essai]').forEach(function (b) { b.hidden = false; });
    tous('[data-sans-essai]').forEach(function (b) { b.hidden = true; });
    var connexion = document.querySelector('.tete .actions [data-connexion]');
    if (connexion) connexion.classList.remove('bouton-plein');
  }
  if (window.fetch) {
    fetch('/api/auth/inscription-essai/etat', { method: 'GET', credentials: 'omit', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (e) { if (essaiOuvert(e)) montrerEssai(e.joursEssai); })
      .catch(function () { /* lecture impossible : l'essai n'est pas annoncé */ });
  }

  // ---- Blur-fade · les blocs sous la ligne de flottaison se révèlent à la lecture.
  if (!reduit && observable) {
    var vus = new IntersectionObserver(function (items) {
      items.forEach(function (i) {
        if (i.isIntersecting) { i.target.classList.add('vu'); vus.unobserve(i.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px' });
    var bas = window.innerHeight || 800;
    tous('.bloc > h2, .bloc > .intro, .cycle-texte, .fig, .registre li, .bascule, .plans, .partage-deux article, .questions, .appel-corps').forEach(function (b, n) {
      if (b.getBoundingClientRect().top > bas) {
        b.setAttribute('data-reveal', '');
        if (b.matches('.registre li')) b.style.transitionDelay = (n % 2) * 60 + 'ms';
        vus.observe(b);
      }
    });
    // Les figures dont l'animation est propre (faisceaux, lien de clôture) se lancent à la vue.
    tous('.fig-rap, .fig-cloture, .registre li').forEach(function (f) {
      if (!f.classList.contains('vu') || f.matches('.registre li')) vus.observe(f);
    });
  } else {
    tous('.fig-rap, .fig-cloture, .registre li').forEach(function (f) { f.classList.add('vu'); });
  }

  // ---- Text-reveal · les mots de l'affirmation passent à l'encre au fil du défilement.
  var mots = document.getElementById('mots');
  var motsListe = [];
  if (mots && !reduit) {
    var texte = mots.textContent.trim().split(/\s+/);
    mots.setAttribute('aria-label', texte.join(' '));
    mots.textContent = '';
    texte.forEach(function (m, i) {
      var s = document.createElement('span');
      s.className = 'm';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = m;
      mots.appendChild(s);
      if (i < texte.length - 1) mots.appendChild(document.createTextNode(' '));
      motsListe.push(s);
    });
  }

  // ---- Scroll-progress, avancée du cycle, mots lus · un seul écouteur, une image à la fois.
  var barre = document.querySelector('.progres span');
  var cycle = document.getElementById('cycle-liste');
  var etapes = cycle ? tous('li', cycle) : [];
  var enAttente = false;
  function majDefilement() {
    enAttente = false;
    var h = window.innerHeight || 800;
    var haut = window.pageYOffset || racine.scrollTop || 0;
    var total = (racine.scrollHeight - h) || 1;
    if (barre) barre.style.transform = 'scaleX(' + Math.min(1, Math.max(0, haut / total)).toFixed(4) + ')';
    if (cycle) {
      var r = cycle.getBoundingClientRect();
      var p = (h * 0.55 - r.top) / (r.height || 1);
      p = Math.min(1, Math.max(0, p));
      cycle.style.setProperty('--avance', p.toFixed(4));
      etapes.forEach(function (li) {
        var b = li.getBoundingClientRect();
        li.classList.toggle('actif', b.top < h * 0.55);
      });
    }
    if (motsListe.length) {
      var m = mots.getBoundingClientRect();
      var q = (h * 0.85 - m.top) / (m.height + h * 0.4);
      q = Math.min(1, Math.max(0, q));
      var jusque = Math.round(q * motsListe.length);
      motsListe.forEach(function (s, i) { s.classList.toggle('lu', i < jusque); });
    }
  }
  function planifier() {
    if (!enAttente) { enAttente = true; window.requestAnimationFrame(majDefilement); }
  }
  window.addEventListener('scroll', planifier, { passive: true });
  window.addEventListener('resize', planifier);
  majDefilement();

  // ---- La feuille de journal · un exemple fictif qui refuse ce qui ne boucle pas.
  var feuille = document.querySelector('.feuille');
  var form = document.getElementById('piece');
  var champD = document.getElementById('m-debit');
  var champC = document.getElementById('m-credit');
  var VALEUR_DEPART = '1 250 000,00';
  var format = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  // « 1 250 000,5 » ou « 1250000.50 » → nombre de centimes ; null si illisible ou négatif.
  function enCentimes(texte) {
    var t = String(texte).replace(/[\s  ]/g, '').replace(',', '.');
    if (t === '' || !/^\d+(\.\d{0,2})?$/.test(t)) return null;
    return Math.round(Number(t) * 100);
  }
  function ecrire(c) { return format.format(c / 100); }

  if (feuille && form && champD && champC && window.Intl) {
    var tD = document.getElementById('t-debit');
    var tC = document.getElementById('t-credit');
    var ecart = document.getElementById('ecart');
    var etatTexte = document.getElementById('etat-texte');
    var valider = document.getElementById('valider');
    var remettre = document.getElementById('remettre');
    var validee = false;

    [champD, champC].forEach(function (c) { c.removeAttribute('readonly'); });
    valider.hidden = false;
    remettre.hidden = false;

    var MESSAGES = {
      boucle: 'La pièce boucle : le débit égale le crédit. Elle peut être validée.',
      illisible: 'Saisissez un montant lisible, par exemple 1 250 000,00.',
      nul: 'Une pièce sans montant n\'est pas enregistrée.',
      validee: 'Pièce validée. Elle est inscrite au livre-journal et ne se modifie plus.'
    };

    function majPiece() {
      var d = enCentimes(champD.value);
      var c = enCentimes(champC.value);
      tD.textContent = d === null ? '·' : ecrire(d);
      tC.textContent = c === null ? '·' : ecrire(c);
      var libre = d !== null && c !== null;
      var ec = libre ? Math.abs(d - c) : null;
      ecart.textContent = libre ? ecrire(ec) : '·';
      var boucle = libre && ec === 0 && d > 0;
      feuille.classList.toggle('desequilibre', !boucle);
      if (validee) return;
      if (!libre) etatTexte.textContent = MESSAGES.illisible;
      else if (ec !== 0) etatTexte.textContent = 'Écart de ' + ecrire(ec) + ' : OmegaX refuse une écriture dont le débit et le crédit diffèrent.';
      else if (d === 0) etatTexte.textContent = MESSAGES.nul;
      else etatTexte.textContent = MESSAGES.boucle;
      valider.disabled = !boucle;
    }
    function formater(champ) {
      var v = enCentimes(champ.value);
      if (v !== null) champ.value = ecrire(v);
    }
    [champD, champC].forEach(function (c) {
      c.addEventListener('input', majPiece);
      c.addEventListener('blur', function () { formater(c); majPiece(); });
      c.addEventListener('focus', function () { try { c.select(); } catch (e) { /* sans effet */ } });
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (validee || valider.disabled) return;
      validee = true;
      feuille.classList.add('valide');
      champD.readOnly = true;
      champC.readOnly = true;
      valider.hidden = true;
      etatTexte.textContent = MESSAGES.validee;
      remettre.focus();
    });
    remettre.addEventListener('click', function () {
      validee = false;
      feuille.classList.remove('valide');
      champD.readOnly = false;
      champC.readOnly = false;
      champD.value = VALEUR_DEPART;
      champC.value = VALEUR_DEPART;
      valider.hidden = false;
      majPiece();
      champD.focus();
    });
    majPiece();
  }

  // ---- Number-ticker · le nombre de notes monte jusqu'à sa valeur exacte, jamais approchée.
  function compter(bloc) {
    var cible = Number(bloc.getAttribute('data-vers'));
    var affiche = bloc.querySelector('[aria-hidden]');
    if (!affiche || !isFinite(cible)) return;
    if (reduit) { affiche.textContent = String(cible); return; }
    var debut = null;
    function pas(t) {
      if (debut === null) debut = t;
      var p = Math.min(1, (t - debut) / 650);
      affiche.textContent = String(Math.round(cible * (1 - Math.pow(1 - p, 3))));
      if (p < 1) window.requestAnimationFrame(pas); else affiche.textContent = String(cible);
    }
    window.requestAnimationFrame(pas);
  }

  // ---- Les deux plans de comptes · une bascule, et la page n'en montre qu'un.
  var bascule = document.getElementById('bascule');
  var plans = tous('.plan');
  function montrerPlan(ref, animer) {
    plans.forEach(function (p) {
      var cible = p.getAttribute('data-ref') === ref;
      p.hidden = !cible;
      if (cible && animer) {
        p.classList.remove('entre');
        void p.offsetWidth;
        p.classList.add('entre');
        tous('.nb', p).forEach(compter);
      }
    });
  }
  if (bascule && plans.length === 2) {
    bascule.hidden = false;
    montrerPlan('SYCEBNL', false);
    tous('input[name="ref"]', bascule).forEach(function (r) {
      r.addEventListener('change', function () { if (r.checked) montrerPlan(r.value, true); });
    });
    if (!reduit && observable) {
      var vuPlans = new IntersectionObserver(function (items) {
        items.forEach(function (i) {
          if (!i.isIntersecting) return;
          vuPlans.unobserve(i.target);
          tous('.plan:not([hidden]) .nb').forEach(compter);
        });
      }, { threshold: 0.4 });
      var zone = document.querySelector('.plans');
      if (zone) vuPlans.observe(zone);
    }
  }
})();
