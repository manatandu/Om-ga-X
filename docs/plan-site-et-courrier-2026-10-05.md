# Plan · site de présentation et de vente, courrier, domaine (2026-10-05)

Décisions de Manasse du 2026-10-05. Rien n'est construit par ce document : il
fixe ce qu'on construit, dans quel ordre, et ce qui reste à trancher.

## 1. Ce qui est en place (vérifié par Manasse)

- Domaine **vmgconsulting.net**, acheté chez Cloudflare, au nom de Manasse,
  renouvellement automatique, confidentialité WHOIS active.
- Réception : Cloudflare Email Routing, `admin@vmgconsulting.net` vers la boîte
  Gmail du cabinet (`vmgconsulting.cabinet@gmail.com`), règle active, catch-all
  désactivé. Test de réception réussi.
- Envoi : domaine vérifié chez Resend (DKIM, SPF par les CNAME `send` et
  `rsend`, DMARC `p=none`). Envoi depuis Gmail en tant que admin@ réussi.
- Secret GitHub `API_RESEND_CLE` posé par Manasse, jamais montré à une session.
  Aucune référence à Resend dans le code à cette date : les courriels d'OmegaX
  restent « en file » (`SANS_TRANSPORT`), et c'est dit à l'écran.

## 2. Décisions

1. **Un seul domaine, vmgconsulting.net.** Le .com n'est pas retenu (lapsus
   de la conversation, corrigé le même jour).
   - `vmgconsulting.net` : site de présentation et de vente.
   - `app.vmgconsulting.net` : le logiciel, plus tard (voir § 5).
   - `admin@vmgconsulting.net` : courriel, déjà en place.
2. **Vente sur demande d'abord.** Formulaire, devis, dossier créé par l'éditeur.
   L'inscription publique reste fermée (`INSCRIPTION_PUBLIQUE`). Le paiement
   en ligne et la création automatique du dossier viennent après les premiers
   clients.
3. **Paiement hors ligne d'abord.** Virement ou mobile money sur facture ; la
   licence suit l'encaissement déclaré (déjà en place, `PlateformeService.echeanceAbonnement`).
   Le choix des moyens de paiement relève de la connaissance du marché par
   Manasse, non d'un texte.

## 3. Courrier d'OmegaX : le code est le même pour tous, la configuration change

- Le serveur lit son adresse d'expédition et sa clé **dans la configuration de
  l'installation**, jamais dans le code, les journaux ou les sauvegardes.
- **En ligne** : la clé `API_RESEND_CLE` de l'éditeur. Les courriels de l'éditeur
  (licence, facture d'abonnement, sécurité) partent de `admin@vmgconsulting.net`.
  Ceux d'un cabinet à ses propres clients partent avec le NOM du cabinet affiché
  et son adresse en « Répondre à » ; sans adresse de réponse renseignée, l'envoi
  est REFUSÉ avec un motif, jamais parti en silence.
- **Sur site** : la clé de l'éditeur ne voyage JAMAIS chez un client. Le cabinet
  fournit son propre service d'envoi ; sans lui, le courrier reste « en file » et
  le logiciel le dit.
- Un cabinet n'envoie jamais au nom d'un autre. Envois tracés (qui, quand, à qui),
  plafond d'envois par cabinet, possibilité de suspendre un cabinet.
- Option avancée, plus tard : domaine propre du cabinet (lignes DNS vérifiées
  chez Resend), offert, jamais exigé.
- Écran de réglages « Courrier » pour les clients, clé chiffrée et jamais
  réaffichée : à construire, il n'existe pas.
- Limite connue : le quota d'envoi de tous les cabinets en ligne passe par le
  compte Resend de l'éditeur ; à surveiller et à chiffrer dans le prix.

## 4. Ordre de construction

1. **Envoi réel** par Resend, lecture de la configuration, déclaration du secret
   dans le workflow de déploiement (Cloud Run reçoit ses variables par le seul
   workflow), repli « en file » si la clé manque. Scénario sur vraie base, envoi
   d'essai vers l'éditeur.
2. **Écran « Courrier »** des cabinets (adresse de réponse, clé propre sur site).
3. **Vitrine** statique, Cloudflare Pages, sur `vmgconsulting.net` : présentation,
   formules et prix, formulaire de demande relié à la messagerie. Les
   enregistrements de courrier du domaine ne sont pas touchés.
4. **Téléchargement du paquet sur site**, réservé aux acheteurs, avec leur licence
   signée ; jamais de lien public du paquet.
5. **Paiement en ligne et création automatique du dossier**, quand la demande
   est prouvée.

## 5. Hébergement du logiciel : à ne pas défaire

Le client est servi par Firebase Hosting, qui relaie `/api` vers Cloud Run
(`client/firebase.json`). Le nom du cookie `__session` est imposé par Firebase,
et le serveur compte deux relais de confiance en ligne (§ 8 de CLAUDE.md). Donc :
**le logiciel n'est pas déménagé chez Cloudflare.** Un nom `app.vmgconsulting.net`
s'ajoute sur Firebase Hosting (enregistrements DNS « DNS uniquement »), ce qui
touche `CORS_ORIGIN`, les adresses imprimées dans les courriels, le déploiement et
les tests navigateur : ligne de travail à part, avec scénario réel avant annonce.

## 6. Restent à trancher (rien n'est inventé)

- **Textes obligatoires** de la vitrine : conditions de vente, confidentialité,
  mentions légales. À lire et à faire valider avant publication ; aucune version
  n'est rédigée de mémoire.
- **Boîte de réception dans OmegaX** (messagerie intégrée) : non prévue. Gmail
  fait le travail. Si Manasse la veut, ligne séparée : VMG seule d'abord (conseil),
  puis cabinets.
- **Moyens de paiement** des premiers clients.
- **Support** : adresse, heures, délai de réponse tenables.
- **Quota Resend** : forfait actuel à vérifier dans le compte, avant tout volume.

## 7. Nettoyage de sécurité en cours (côté Manasse)

Suppression de l'alias admin@ dans l'ancien Gmail, suppression de l'ancienne
clé Resend `gmail-envoi`, validation en deux étapes et codes de secours du
nouveau Gmail.
