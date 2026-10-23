// Page publique d'OmegaX · aucune donnée du dossier, un seul appel en lecture (l'état de l'essai).
// Le script ne fait que deux choses : annoncer l'essai quand sa porte est lue ouverte, et rendre
// la pièce de journal modifiable. Aucun effet de défilement (charte § 9 bis) : sans script,
// la page est complète et lisible, seuls les deux boutons de la pièce restent cachés.
(function () {
  'use strict';

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
      // Seul le bouton marqué `essai-duree` (première vue) porte la durée ; celui de l'appel garde son libellé.
      if (a.classList.contains('essai-duree')) a.textContent = 'Essayer gratuitement ' + jours + ' jours';
    });
    tous('[data-jours]').forEach(function (s) { s.textContent = String(jours); });
    tous('[data-avec-essai]').forEach(function (b) { b.hidden = false; });
    tous('[data-sans-essai]').forEach(function (b) { b.hidden = true; });
    var appel = document.querySelector('.appel');
    if (appel) appel.setAttribute('aria-labelledby', 't-appel-essai');
    var connexion = document.querySelector('.tete .actions [data-connexion]');
    if (connexion) connexion.classList.remove('bouton-plein');
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
})();
