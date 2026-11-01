# AVANCEMENT · ligne multi-dossiers

Rattachement d'un collaborateur à plusieurs dossiers (décision de Manasse du
2026-10-30, D9, gel levé le 2026-11-01, « Enchaîne le point 3 et 4 »).
Branche de sauvegarde `travail/multi-dossiers`, partie d'`origin/main`
(9a89d8dfc).

## 1. Conception retenue

### 1.1 Deux voies examinées

- **Voie A · une table d'appartenance** (personne × dossier, qui porte rôle,
  profil, journaux, logiciels, actif). La ligne `User` resterait l'identité et
  l'appartenance au dossier d'origine. Défaut décisif · TOUT ce qui, dans un
  dossier, lit ses utilisateurs par `user.findMany({ where: { tenantId } })`
  (liste des collaborateurs, dernier administrateur actif, « Saisie par » des
  journaux exportés, circuit de visa, présence, messagerie interne,
  préférences, notifications, auteur des actes) ne verrait pas les rattachés,
  et chaque écriture d'un rattaché dans le dossier B pointerait une ligne
  `User` du dossier A, que la garde de cloisonnement rend inexistante. Une
  vingtaine de lecteurs à reprendre, chacun une occasion d'oubli.
- **Voie C · le compte gardé par dossier, une identité commune** · RETENUE.
  Chaque appartenance EST une ligne `User` de son dossier, comme aujourd'hui ·
  rôle, profil de fonctions, journaux autorisés, logiciels attribués, actif,
  révocation (`sessionsInvalidesAvant`, `sessionsFermees`), présence,
  préférences, messages, auteur des écritures restent par dossier sans qu'un
  seul lecteur change. Ce qui est COMMUN à la personne (adresse de connexion,
  mot de passe, second facteur, verrou, mot de passe provisoire) vit sur UNE
  ligne, le **compte de connexion** · la première ligne de la personne
  (`compteDeConnexionId` nul). Une appartenance ajoutée dans un autre dossier
  est une ligne `User` de ce dossier qui pointe ce compte
  (`compteDeConnexionId`).

### 1.2 Modèle de données (migration `20270248000000_comptes_rattaches`)

- `User.compteDeConnexionId String?` · relation vers `User`
  (`ComptesRattaches`, `onDelete: Restrict`), index. Nul pour toute ligne
  existante · CHAQUE UTILISATEUR EXISTANT EST SON PROPRE COMPTE DE CONNEXION ET
  SON APPARTENANCE À SON DOSSIER · aucune donnée déplacée, aucune perte.
- `User.email` n'est plus unique sur la plateforme · unique PAR DOSSIER
  (`@@unique([tenantId, email])`), une personne ne s'y rattache qu'une fois.
- `User.courrielDeConnexion String? @unique` · l'adresse du COMPTE DE
  CONNEXION seulement, nulle sur une appartenance rattachée. Posée par un
  déclencheur de la base (`omegax_courriel_de_connexion`, avant insertion ou
  mise à jour) · égale à `email` quand `compteDeConnexionId` est nul, nulle
  sinon · aucun chemin de création (inscription, console, siège, essai,
  démonstration, sur site) n'a à s'en souvenir, et l'unicité de l'adresse de
  connexion sur toute la plateforme reste tenue par la base. Le même
  déclencheur refuse une chaîne (un rattaché qui pointerait un rattaché) et
  une ligne qui se pointe elle-même.
- `compteDeConnexionId` et `courrielDeConnexion` sont HORS du journal d'audit
  et de la restitution · ils diraient au dossier B que la personne existe
  ailleurs.

### 1.3 Session

- Le jeton porte `sub` = la ligne `User` du dossier COURANT, comme aujourd'hui.
  `JwtStrategy` relit cette ligne · `tenantId`, rôle, journaux, logiciels,
  actif, révocation de CE dossier. Elle relit en plus, par la même requête
  (`include`), le compte de connexion d'une ligne rattachée · révocation du
  compte (`sessionsInvalidesAvant` · mot de passe changé, réinitialisé,
  second facteur, « fermer toutes mes sessions »), mot de passe provisoire,
  second facteur (console).
- Le cloisonnement lit `request.user.tenantId`, c'est-à-dire le dossier de la
  ligne de la session, et RIEN D'AUTRE · aucun paramètre de requête ne le
  change.
- **Changer de dossier** · `POST /auth/changer-dossier` (cookie, CSRF,
  `JwtAuthGuard`), dossier visé dans le corps. Le serveur cherche une
  appartenance ACTIVE du même compte de connexion dans ce dossier, sinon 404
  sans rien dire. Il FERME la session en cours sur sa ligne
  (`sessionsFermees`) et en émet une neuve sur la ligne visée, sous un jeton
  CSRF neuf, en recopiant régime, origine, échéance courte, dernière
  authentification et connexion complète · changer de dossier n'est pas une
  authentification. Une appartenance dont les sessions ont été fermées après
  cette authentification (administrateur du dossier) est refusée en 403
  nommé · « reconnectez-vous ».
- **Connexion** · l'adresse trouve le compte de connexion
  (`courrielDeConnexion`). Mot de passe, second facteur et verrou se jugent
  sur lui, comme aujourd'hui. Les appartenances actives sont relues · aucune,
  « Ce compte a été désactivé » comme aujourd'hui ; la session s'ouvre sur le
  compte de connexion s'il est actif, sinon sur l'appartenance la plus
  ancienne. La réponse dit `plusieursDossiers` · l'écran montre alors la liste
  avant l'écran des logiciels. Un seul dossier · rien ne change.
- **Retrait** · désactiver l'appartenance (route existante) ferme ses
  sessions aussitôt (`estActif`, `sessionsInvalidesAvant`), dans ce dossier
  seulement.

### 1.4 Qui rattache (refait après la relecture de sécurité)

Le premier jet rattachait une adresse connue AILLEURS à réponse identique, en
posant sur la ligne le mot de passe saisi par l'administrateur. La relecture
de sécurité (C1, E1, E2) l'a fait tomber · l'administrateur du dossier
d'origine pouvait réinitialiser le compte de connexion et entrer dans B, et
un tiers « squattait » une adresse. Décision appliquée ·

- **Mode INVITATION** dès qu'une messagerie est configurée (en ligne) ·
  `POST /utilisateurs` n'écrit aucune ligne, il crée une `InvitationDossier`
  (jeton tiré au sort, empreinte SHA-256 seule en base, quatorze jours) et
  envoie le jeton par `envoyerUnSecret` (la file ne garde que le texte sans
  lui). Même réponse et même courriel pour une adresse connue ou neuve. La
  personne accepte avec le code ET sa session dont le compte porte l'adresse
  (`POST /auth/invitations/accepter`), ou refuse ; une adresse neuve crée son
  compte avec SON mot de passe (`POST /auth/invitations/creer-compte`,
  publique, limitée). Une nouvelle invitation à la même adresse annule la
  précédente ; l'administrateur peut l'annuler.
- **Mode DIRECT** sans messagerie · sur site (un seul organisme, aucun tiers à
  protéger) une adresse connue est rattachée avec son propre mot de passe,
  celui saisi n'étant pas haché ; en ligne elle est refusée en 503 « la
  messagerie est requise pour ce geste ». Limite écrite · ce refus dit à
  l'administrateur que l'adresse existe (l'oracle ne se ferme qu'avec la
  messagerie) ; une adresse neuve est créée comme avant.
- Adresse déjà utilisatrice de CE dossier · 409, comme avant.

### 1.5 Ce que devient chaque garde et service

| Lecteur | Ce qu'il lit | Devient |
|---|---|---|
| `JwtStrategy.validate` | ligne `sub` | idem, plus le compte de connexion d'un rattaché (révocation, mot de passe provisoire, second facteur) |
| `JwtAuthGuard` (rôle cantonné, fonctions, logiciels) | `request.user` | inchangé · valeurs de la ligne du dossier courant |
| `RolesGuard`, `ReferentielGuard`, `LicenceGuard` | `request.user` | inchangés |
| `MotDePasseAChangerGuard` | `doitChangerMotDePasse` | lu sur le compte de connexion |
| `OperateurPlateformeGuard` | drapeau de la ligne + second facteur | drapeau de la LIGNE (jamais posé sur un rattaché), second facteur du compte de connexion |
| `AdministrateurInstallationGuard` | ligne | inchangé |
| extension de cloisonnement, audit, périmètre des journaux | acteur = `request.user` | inchangés |
| `UtilisateurService` (liste, rôle, fonctions, journaux, logiciels, désactivation, déconnexion, dernier administrateur) | lignes du dossier | inchangés · un rattaché est une ligne du dossier |
| `UtilisateurService.creer` | unicité de l'adresse | rattachement (§ 1.4) |
| `AuthService.login` | ligne par `email` | compte de connexion par `courrielDeConnexion`, appartenances |
| changer mot de passe, adresse, second facteur, autres appareils, toutes mes sessions | ligne `sub` | compte de connexion · l'adresse se recopie sur les appartenances |
| `AuthService.me` | ligne `sub` | idem, plus `plusieursDossiers` |
| inscription, essai, console, siège (unicité de l'adresse) | `findUnique({ email })` | `courrielDeConnexion` |
| réinitialisation par l'opérateur | administrateur du dossier | si la ligne est rattachée, le COMPTE DE CONNEXION (le courriel part à la même adresse) |
| suppression des essais échus | lignes du dossier | un dossier dont un compte de connexion porte des appartenances ailleurs est « non concerné » |

### 1.6 Points de la demande (5)

- Console et opérateur · `estOperateurPlateforme` est sur la ligne du dossier
  de l'éditeur, jamais sur une appartenance rattachée (la création ne le pose
  pas, la promotion au démarrage vise le dossier de l'éditeur) ; la console
  exige le second facteur du compte de connexion et une connexion complète de
  moins de huit heures, que le changement de dossier recopie sans la
  renouveler.
- Installation sur site · inchangée (dossier d'installation, son
  administrateur) ; un collaborateur peut être rattaché aux dossiers du poste.
- Essai, inscription · créent un compte de connexion ; adresse déjà compte de
  connexion · même réponse que jusqu'ici.
- Réinitialisation par l'administrateur d'un dossier · refusée en 403 sur une
  appartenance rattachée et sur un compte que d'autres dossiers pointent
  (§ 2 bis) ; une personne d'un seul dossier se réinitialise comme avant.

## 2. Fait

- Schéma et migration `20270248000000_comptes_rattaches` (§ 1.2), déclencheur
  `omegax_courriel_de_connexion`. `prisma migrate diff` contre une base
  d'ombre · aucune différence (le déclencheur n'est pas lu par Prisma).
- `auth/compte-de-connexion.ts` · seule sortie de cloisonnement de la ligne,
  gelée par `cloisonnement.spec.ts`.
- `JwtStrategy` · compte de connexion relu pour une appartenance rattachée.
- `AuthService` · connexion (appartenances, `plusieursDossiers`), mot de
  passe, adresse (recopiée sur les appartenances), second facteur, autres
  appareils, toutes mes sessions, `/auth/me`, `mesDossiers`,
  `changerDeDossier` ; routes `GET /auth/mes-dossiers`,
  `POST /auth/changer-dossier`.
- `UtilisateurService.creer` et `InvitationsService` · invitation, ou
  création directe sans messagerie (§ 1.4).
- Console · réinitialisation de l'administrateur sur le compte de connexion,
  promotion des opérateurs sur un compte de connexion seulement. Essais
  échus · un dossier qui touche un rattachement n'est jamais concerné.
- Journal d'audit et restitution · `compteDeConnexionId`,
  `courrielDeConnexion` exclus.
- Une appartenance rattachée ne porte jamais de mot de passe provisoire
  (`creerAppartenance`) · celui du compte de connexion seul compte.
- Écran · `ChoixDossierPage` (après le mot de passe provisoire, avant les
  logiciels), Fichier > Changer de dossier (`ModaleChangerDossier`), liste
  partagée `ListeDesDossiers`, `lib/dossiers-personne.ts`,
  `lib/entree-dossier.ts` (la page repart neuve sur l'accueil).
- Tests · `multi-dossiers.spec.ts` (connexion, session, changement, liste,
  compte tenu depuis un autre dossier, rattachement), `dossier-de-la-session.spec.ts`
  (le dossier ne se lit que dans la session), `dossiers-personne.spec.ts`
  (client), `e2e/tests/multi-dossiers.e2e.ts`, et
  `scripts/rejouer-multi-dossiers.cjs` (base peuplée par le serveur
  d'`origin/main`, migration appliquée, comptes existants qui se connectent
  comme avant, rattachement, changement, saisie et clôture traversée dans B,
  banque reportée à 2 500 000 en N+1, retrait qui coupe l'accès, mot de passe
  changé depuis B valable partout).

### 2 bis. Relectures (sécurité, puis échecs silencieux)

- C1, E2 · `connexionTenueParLaPersonne` · réinitialiser et déverrouiller un
  compte que d'autres dossiers pointent, ou une ligne rattachée, sont refusés
  en **403** nommé, sans dire lesquels (le second message parlait de 409 ;
  403 est retenu, c'est un geste interdit et non un état concurrent).
  L'opérateur tire au sort et n'efface jamais le second facteur d'un compte à
  appartenances. La liste du dossier sert `connexionTenueParLaPersonne`, le
  second facteur lu sur le compte, aucun verrou de ligne.
- E1, M1 · § 1.4. Aucune ligne rattachée ne porte `doitChangerMotDePasse`.
- M2 · renvoi d'inscription d'essai refusé sous la même réponse quand la
  connexion est tenue par la personne. M1 (essais) · commentaire.
- F1 · le déclencheur refuse tout changement de `compteDeConnexionId` à la
  mise à jour · plus de course entre le contrôle « des appartenances le
  pointent » et un rattachement concurrent. F3 · second facteur lu sur le
  compte.
- B1 · en-tête `X-Dossier` (`lib/dossier-de-l-ecran.ts`) ; 409
  `dossierChange` par `JwtAuthGuard`. **En-tête absent** · admis si la
  session ne porte pas `plusieursDossiers` (une personne d'un seul dossier, un
  client d'avant la ligne, un jeton par en-tête `Authorization`) ; refusé
  sinon. Justification · sans plusieurs dossiers, aucun autre onglet ne peut
  avoir changé le dossier de la session. Écouteur `storage` qui recharge
  l'onglet.
- B2 · § 2 bis, C1.
- M2 (adresse) · `recopierLAdresse` en mises à jour unitaires, chacune au
  journal de SON dossier. m1 · acteur résolu dans le dossier de la ligne.
- m2 · **décision** · l'administrateur d'un dossier ne ferme que les sessions
  de SON dossier (`sessionsInvalidesAvant` de la ligne) ; la personne ferme
  tout (`sessionsDuCompteInvalidesAvant`). Un administrateur n'a pas la main
  sur l'accès d'une personne aux dossiers d'un autre client.
- m3 · liste bornée à 200, `total`, `tronque`, dossiers introuvables comptés.
  m4 · licence échue (lecture seule) ou suspendue dite par ligne. m5 · course
  de création relue sur P2002. m6 · « Se déconnecter » sur le 403 du
  changement de dossier.
- Migration renommée `20270248000000_comptes_rattaches` (collision avec
  `20270247000000_verrou_garnissage_demonstration` de `main`).

## 3. Limites écrites, reste

- En ligne SANS messagerie, l'ajout d'une adresse connue est refusé en 503 ·
  ce refus révèle qu'elle existe. Fermé dès que la messagerie est posée.
- Le parcours navigateur complet (invitation acceptée, changement de
  dossier par le menu, 409 d'un autre onglet) ne tourne pas en CI, qui n'a
  pas de messagerie · rejoué en local avec une boîte SMTP de poche
  (`OMEGAX_SMTP_POCHE_PORT`), et par `scripts/rejouer-multi-dossiers.cjs`. La
  CI rejoue le refus sans messagerie.
- La messagerie interne, les notifications et la présence restent par
  dossier (une ligne par appartenance) · voulu.
- Un compte de connexion dont l'appartenance d'origine est désactivée garde
  son mot de passe et son second facteur · il entre par ses autres dossiers.
- WebKit non lancé en local (non installé) · Chromium seul.

## 4. Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
# vraie base · PHASE=ancien (dist d'origin/main, base sans la migration), puis
# migration, puis PHASE=nouveau (boîte SMTP de poche intégrée) · en-tête du script
node scripts/rejouer-multi-dossiers.cjs
# navigateur · serveur démarré avec SMTP_HOST=127.0.0.1 SMTP_PORT=<p>, puis
OMEGAX_SMTP_POCHE_PORT=<p> npx playwright test tests/multi-dossiers.e2e.ts
```
