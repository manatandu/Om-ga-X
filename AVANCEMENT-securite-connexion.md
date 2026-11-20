# Avancement · ligne securite-connexion

Branche de sauvegarde `travail/securite-connexion`, partie de `origin/main`
(`bcd6db5e5`). Cinq corrections demandées par Manasse (« Go ») après l'audit
de sécurité par lecture (`/root/security-audit-skill/omegax/run-1/`) et le
rejeu `scripts/rejouer-attaques-connexion.cjs`. Rien d'autre.

## Fait

- (4) `validate-env.ts` refuse en production un secret absent, connu ou de
  moins de 32 caractères, message nommé sans la valeur ni sa longueur
  (`validate-env.spec.ts`) ; étape « Contrôle du secret de session » de
  `deploy-cloud-run.yml` avant les migrations, secret par l'environnement de
  l'étape, verdict seul (`chaine-de-livraison.spec.ts`). Valeurs jetables
  relues · workflows (toutes ≥ 32), scripts de rejeu (`rejouer-attaques-connexion`
  allongé), k6 README (allongé), paquet sur site (64 hexadécimaux, `Aleatoire 32`).
- (5) `POST /auth/logout` exige l'en-tête `application/json` (415,
  `MOTIF_DECONNEXION_EN_JSON`), corps facultatif ; l'écran et les tests
  navigateur envoient `{}`.
- (3) Les six gestes au mot de passe actuel (mot de passe, adresse, autres
  appareils, activer, retirer, renouveler la double authentification) passent
  par `exigerLeMotDePasseActuel` · même compteur et même verrou que la
  connexion (`decompteApresEchec`), relu `FOR UPDATE` ; compte fermé, le geste
  est refusé (bon mot de passe compris, sans prolonger), message qui dit que
  la session reste ouverte. Codes faux du retrait et du renouvellement
  comptés aussi ; le code d'ACTIVATION non (secret neuf, rien à deviner).
  Spec `mot-de-passe-actuel-au-verrou.spec.ts`.
- (1) Compte fermé · réponse STRICTEMENT celle d'un mot de passe faux. (a) bon
  mot de passe + code valide d'un compte à double authentification · entrée,
  compteur à zéro ; sans code, aucune demande de code (elle dirait le mot de
  passe juste) ; code faux compté APRÈS la réponse. (b) bon mot de passe ·
  lien à usage unique (60 min, empreinte `User.empreinteDeverrouillage`,
  `deverrouillageExpireLe`, `deverrouillageEnvoyePour` = un envoi par
  verrou), `envoyerUnSecret`, APRÈS la réponse (`apresLaReponse`, la durée ne
  trahit rien) ; `POST /auth/deverrouiller` (JSON, sans session) lève le
  verrou au journal d'audit sous la personne, page client `#/deverrouiller`
  qui ramène à la connexion. Sans messagerie · rien, l'administrateur
  déverrouille. Écran · « Ajouter le code de la double authentification »
  après tout refus. `MOTIF_IDENTIFIANTS_INVALIDES` dit les deux portes.
- (2) `EssaiConnexionAdresse` (hors dossier, HMAC de l'adresse, au plus 11
  instants, fenêtre glissante de 10 min, purge toutes les 10 min par
  instance) · 10 essais par adresse e-mail, connue ou non ; au-delà 429 sans
  bcrypt, même phrase. Jeton d'appareil (HMAC, 90 jours, lié au compte) rendu
  par la connexion réussie, gardé par l'écran (`lib/appareil-reconnu.ts`) ·
  l'appareil reconnu n'est pas freiné (sans quoi la limite rouvrait le refus
  de service que (1) ferme). `trust proxy` intouché.
  Migration `20270249000000_securite_connexion`, `prisma migrate diff` sans
  différence. Spec `verrou-et-limite.spec.ts`, client `appareil-reconnu.spec.ts`.

- Rejeu `scripts/rejouer-attaques-connexion.cjs` étendu (sections 6 à 10,
  second serveur compilé et boîte SMTP de poche) · 72 prouvées, 0 non
  prouvée, PostgreSQL 16 jetable.
- Suivi · `docs/suivi-immobilisations-verrouille.md`, relevés en attente
  (constats sur site 6 et 7, TOTP en clair, écart de durée, limites).
  CLAUDE.md § 8 tenu à jour.

- Relecture (grilles de `silent-failure-hunter`, `typescript-reviewer`,
  `react-reviewer`, appliquées par la session faute d'outil de délégation)
  · deux corrections · la place du lien ne se libère que si rien n'est parti
  (503 ou 409 d'`envoyerUnSecret`), sans quoi un échec d'écriture de la file
  APRÈS l'envoi effaçait le lien reçu ; le déverrouillage fait ne rend plus
  d'erreur si la remise à zéro de la limite échoue (consignée). Rejeu
  relancé · 72 prouvées.

- RELECTURE DE TROIS RELECTEURS (2026-11-20), décisions A à F, toutes faites ·
  (A) code de double authentification pendant le verrou · au plus cinq codes
  faux par période (`codesFauxSousVerrou`, `codesFauxSousVerrouPour`, porté
  sur l'échéance prolongée), lien réservé sur l'échéance relue AVANT le
  décompte du code (le lien ne partait jamais), réservation sans effet
  consignée ; (B) le verrou relu sous `FOR UPDATE` après le verrou du dossier
  avant d'accepter le bon mot de passe, aux six gestes et à la connexion ;
  (C) au-delà de la limite par adresse, bcrypt tourne ; faux · 429 et
  compté ; juste et ouvert · la connexion suit ; juste et fermé · le même
  429, lien après la réponse ; un essai par connexion pour la double
  authentification ; fenêtre vidée par les déverrouillages et
  réinitialisations ; 429 sans durée ; (D) lien réservé, libéré, levé par
  `update` unitaires après relecture sous verrou ; (E) page de
  déverrouillage au clic (signal d'abandon, `<main>`, spec), code ajouté
  après un refus d'identifiants seulement et retirable, confidentialité § 4,
  carnet oublié à 90 jours, spec de déconnexion ancré sur l'en-tête ; (F)
  secret exigé, workflow jugeant le secret sans espaces (rejoué par bash
  dans `chaine-de-livraison.spec.ts`), lien effacé, aucun lien sur site,
  jeton d'appareil révoqué avec les sessions, tri des erreurs d'envoi,
  journal après la réponse avec le compte et la pile. Limites écrites au
  suivi (travail après la réponse perdu à l'arrêt d'une instance, 415 d'un
  appelant non JSON, budget lu avant la relecture, délai d'envoi ambigu).
  Migration `20270249000000_securite_connexion` complétée (branche jamais
  intégrée), `prisma migrate diff` sans différence. Rejeu sur base neuve
  PostgreSQL 16 · 83 prouvées, 0 non prouvée.

## Reste

- Intégration sur `main` par le coordinateur (bloc § 3, tests navigateur,
  relire le déploiement). Rien d'autre dans cette ligne.

## Décisions

- (C, 2026-11-20) Au-delà de la limite, le bon mot de passe d'un compte
  ouvert passe · le verrou du compte (paliers 1 à 60 minutes, oubli à douze
  heures) est plus strict que dix essais par dix minutes, il borne la force
  brute ; la limite garde la limite par IP et l'uniformité des adresses.
- (2) Une limite par adresse sans exemption se retournait en refus de
  service (dix essais toutes les dix minutes suffisaient à tenir le titulaire
  dehors) · d'où le jeton d'appareil (« device cookie » de l'OWASP), porté
  dans le corps, Firebase Hosting retirant tout témoin autre que `__session`.
  Limite écrite · sur un appareil jamais reconnu, un tiers qui dépasse sans
  relâche la limite garde l'adresse freinée à ce poste.
- (1) Pendant le verrou, bcrypt tourne pour tous ; tout travail qui
  distinguerait le bon mot de passe (courriel, compteur d'un code faux) part
  après la réponse. Limite écrite · en ligne, Cloud Run n'alloue le
  processeur qu'aux requêtes, ce travail peut attendre la requête suivante.
- (5) L'EN-TÊTE est lu, pas le corps (`req.is` rend null sans corps) · un
  formulaire d'un autre site ne peut poser `application/json` sans contrôle
  CORS préalable.

## Commandes de vérification

```bash
# serveur
npx tsc --noEmit && npx jest && npm run build
# client
cd client && npx tsc --noEmit && npm test && npm run build
# rejeu (base jetable PostgreSQL 16)
pg_ctlcluster 16 main start
DATABASE_URL=postgresql://reprise:reprise-jetable@127.0.0.1:5432/<base> node scripts/rejouer-attaques-connexion.cjs
```
