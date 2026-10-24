// Site du cabinet VMG Consulting · le formulaire PRÉPARE un message dans la messagerie du visiteur ;
// il n'envoie rien lui-même et ne contacte aucun serveur. Sans script, l'adresse reste affichée.
(function () {
  'use strict';
  var an = document.getElementById('annee');
  if (an) an.textContent = String(new Date().getFullYear());
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
