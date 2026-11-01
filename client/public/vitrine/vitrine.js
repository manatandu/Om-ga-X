// Page publique d'OmegaX · aucune donnée du dossier. Une lecture (l'état de l'essai) et un seul
// envoi, la demande d'information que le visiteur écrit lui-même.
// Le script fait quatre choses : le mouvement de la page (charte § 9 ter), l'annonce de l'essai
// quand sa porte est lue ouverte, la pièce de journal modifiable, et l'envoi de la demande. Sans
// script, la page est complète et lisible ; seuls les boutons de la pièce et l'envoi de la
// demande restent cachés, et la page le dit.
(function () {
  'use strict';

  function tous(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }

  var an = document.getElementById('annee');
  if (an) an.textContent = String(new Date().getFullYear());

  // ---- Le mouvement · jamais indispensable. La classe `js` arme les apparitions ; sous
  // prefers-reduced-motion, ou sans IntersectionObserver, tout est marqué vu d'emblée.
  var racine = document.documentElement;
  var calme = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (racine && racine.classList) racine.classList.add('js');
  tous('.mot').forEach(function (m, i) { m.style.setProperty('--i', String(i)); });
  var entete = document.getElementById('entete');
  var barre = document.getElementById('progres');
  var haut = document.getElementById('haut');
  function defilement() { return window.pageYOffset || (racine && racine.scrollTop) || 0; }
  function suivre() {
    var y = defilement();
    if (entete) entete.classList.toggle('pleine', y > 24);
    if (haut) haut.classList.toggle('visible', y > 400);
    if (barre && racine) {
      var total = (racine.scrollHeight || 0) - (window.innerHeight || 0);
      barre.style.width = (total > 0 ? Math.min(100, (y / total) * 100) : 0) + '%';
    }
  }
  window.addEventListener('scroll', suivre, { passive: true });
  suivre();
  if (haut) {
    haut.addEventListener('click', function (e) {
      e.preventDefault();
      window.scrollTo({ top: 0, behavior: calme ? 'auto' : 'smooth' });
    });
  }
  var aReveler = tous('.revele, .chemin');
  if (calme || !('IntersectionObserver' in window)) {
    aReveler.forEach(function (el) { el.classList.add('vu'); });
  } else {
    var obs = new window.IntersectionObserver(function (entrees) {
      entrees.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('vu'); obs.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    aReveler.forEach(function (el, k) {
      el.style.setProperty('--d', ((k % 3) * 0.08) + 's');
      obs.observe(el);
    });
  }

  // ---- L'essai · le lien ne s'offre que sur une porte lue ouverte (comme l'écran de connexion).
  // Une lecture qui échoue le tait : le libellé par défaut reste vrai dans les deux cas.
  function essaiOuvert(e) {
    return !!e && e.ouverte === true && typeof e.joursEssai === 'number' && e.joursEssai > 0;
  }
  function montrerEssai(jours) {
    tous('[data-essai]').forEach(function (a) {
      a.hidden = false;
      // Seul le bouton marqué `essai-duree` (première vue) porte la durée ; celui de l'appel garde son libellé.
      if (a.classList.contains('essai-duree')) a.textContent = 'Essayer gratuitement ' + jours + ' jours';
    });
    tous('[data-jours]').forEach(function (s) { s.textContent = String(jours); });
    tous('[data-avec-essai]').forEach(function (b) { b.hidden = false; });
    tous('[data-sans-essai]').forEach(function (b) { b.hidden = true; });
    var appel = document.querySelector('.appel');
    if (appel) appel.setAttribute('aria-labelledby', 't-appel-essai');
    // Sur le bandeau, l'essai devient le bouton plein ; la connexion passe au bouton clair.
    var connexion = document.querySelector('.heros .actions [data-connexion]');
    if (connexion) { connexion.classList.remove('bouton-plein'); connexion.classList.add('bouton-clair'); }
  }
  if (window.fetch) {
    fetch('/api/auth/inscription-essai/etat', { method: 'GET', credentials: 'omit', cache: 'no-store', headers: { Accept: 'application/json' } })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (e) { if (essaiOuvert(e)) montrerEssai(e.joursEssai); })
      .catch(function () { /* lecture impossible : l'essai n'est pas annoncé */ });
  }

  // ---- La pièce de journal · un exemple fictif qui refuse ce qui ne boucle pas.
  var feuille = document.querySelector('.feuille');
  var form = document.getElementById('piece');
  var champD = document.getElementById('m-debit');
  var champC = document.getElementById('m-credit');
  var VALEUR_DEPART = '1 250 000,00';
  var format = window.Intl ? new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : null;

  // « 1 250 000,5 » ou « 1250000.50 » → nombre de centimes ; null si illisible ou négatif.
  function enCentimes(texte) {
    var t = String(texte).replace(/[\s  ]/g, '').replace(',', '.');
    if (t === '' || !/^\d+(\.\d{0,2})?$/.test(t)) return null;
    var c = Math.round(Number(t) * 100);
    // Au-delà de 2^53 centimes deux montants distincts se confondent : illisible, jamais « boucle ».
    return Number.isSafeInteger(c) ? c : null;
  }
  function ecrire(c) { return format.format(c / 100); }

  if (feuille && form && champD && champC && format) {
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
      illisible: 'Saisissez un montant positif à deux décimales au plus, par exemple 1 250 000,00.',
      nul: 'Dans cet exemple, une pièce à zéro ne se valide pas.',
      validee: 'Pièce validée pour l\'exemple. Dans OmegaX, elle serait inscrite au livre-journal et ne se modifierait plus.'
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

  // ---- La demande d'information · envoyée en JSON à la route publique du serveur, qui la met
  // en file pour l'équipe d'OmegaX. Sans script, le formulaire se lit mais ne part pas (bouton
  // caché et désactivé, la page le dit) · jamais un envoi natif qui écrirait les champs dans
  // l'adresse de la page. Le serveur juge tout de nouveau ; ce contrôle-ci ne sert qu'à dire plus tôt.
  var demande = document.getElementById('demande-form');
  var envoyer = document.getElementById('demande-envoyer');
  var etatDemande = document.getElementById('demande-etat');
  var COURRIEL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  var TELEPHONE = /^[0-9+().\s-]*$/;

  function champ(id) { return document.getElementById(id); }
  function dire(texte, genre) {
    etatDemande.textContent = texte;
    etatDemande.classList.toggle('erreur', genre === 'erreur');
    etatDemande.classList.toggle('reussite', genre === 'reussite');
  }
  // Ce que le serveur rend d'un refus · son message, en français, jamais un code nu.
  function motifDuServeur(r, corps) {
    var m = corps && corps.message;
    // Le plafond global du serveur se dit en français ; celui du limiteur par adresse, non.
    if (r.status === 429 && !(typeof m === 'string' && /^Trop de demandes/.test(m))) return 'Trop de demandes depuis cette adresse. Réessayez plus tard.';
    if (Array.isArray(m)) m = m.join(' ');
    if (typeof m === 'string' && m.length > 0) return m;
    return 'La demande n\'a pas pu être enregistrée (erreur ' + r.status + '). Réessayez plus tard.';
  }

  if (demande && envoyer && etatDemande && window.fetch && window.JSON) {
    var nom = champ('d-nom');
    var organisation = champ('d-organisation');
    var courriel = champ('d-email');
    var telephone = champ('d-telephone');
    var message = champ('d-message');
    var consentement = champ('d-consentement');
    dire('', null);
    envoyer.hidden = false;
    envoyer.disabled = false;
    var enCours = false;

    function verifier() {
      var fautes = [
        [nom, nom.value.trim().length >= 2, 'Indiquez votre nom.'],
        [organisation, organisation.value.trim().length >= 2, 'Indiquez votre organisation.'],
        [courriel, COURRIEL.test(courriel.value.trim()), 'Indiquez une adresse électronique valide.'],
        [telephone, TELEPHONE.test(telephone.value), 'Le téléphone ne porte que des chiffres, des espaces et les signes + ( ) . -'],
        [message, message.value.trim().length >= 10, 'Écrivez votre message (dix caractères au moins).'],
        [consentement, consentement.checked === true, 'Cochez la case d\'acceptation · sans elle, la demande ne peut pas être traitée.']
      ];
      var premiere = null;
      fautes.forEach(function (f) {
        if (f[0].type !== 'checkbox') f[0].setAttribute('aria-invalid', f[1] ? 'false' : 'true');
        if (!f[1] && !premiere) premiere = f;
      });
      return premiere;
    }

    demande.addEventListener('submit', function (e) {
      e.preventDefault();
      if (enCours) return;
      var faute = verifier();
      if (faute) {
        dire(faute[2], 'erreur');
        try { faute[0].focus(); } catch (x) { /* sans effet */ }
        return;
      }
      var corps = {
        nom: nom.value.trim(),
        organisation: organisation.value.trim(),
        email: courriel.value.trim(),
        message: message.value.trim(),
        consentement: true
      };
      if (telephone.value.trim()) corps.telephone = telephone.value.trim();
      // Le champ piège · une personne ne le voit pas, un robot le remplit ; le serveur l'écarte sans rien écrire.
      var piege = champ('d-site');
      if (piege && piege.value) corps.site = piege.value;
      enCours = true;
      envoyer.disabled = true;
      dire('Envoi en cours…', null);
      window.fetch('/api/demandes/information', {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(corps)
      })
        .then(function (r) {
          return r.json().then(function (j) { return j; }, function () { return null; }).then(function (j) {
            if (r.ok && j && j.recue === true) {
              dire(typeof j.message === 'string' ? j.message : 'Votre demande est enregistrée.', 'reussite');
              demande.reset();
              return;
            }
            dire(motifDuServeur(r, j), 'erreur');
            envoyer.disabled = false;
          });
        })
        .catch(function () {
          dire('La demande n\'est pas partie : le service n\'a pas pu être joint. Vérifiez votre connexion et réessayez.', 'erreur');
          envoyer.disabled = false;
        })
        .then(function () { enCours = false; });
    });
  }
})();
