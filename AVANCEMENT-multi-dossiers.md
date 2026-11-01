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

### 1.2 Modèle de données (migration `20270247000000_comptes_rattaches`)

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

### 1.4 Qui rattache

`POST /utilisateurs` (administrateur du dossier, inchangé) ·
- adresse inconnue · le compte se crée comme aujourd'hui ;
- adresse déjà compte de connexion AILLEURS · une appartenance est créée dans
  CE dossier (même rôle, mot de passe provisoire haché sur la ligne et jamais
  lu, `doitChangerMotDePasse` posé comme une création), et la RÉPONSE EST LA
  MÊME qu'une création (mêmes champs, même statut, une empreinte bcrypt de
  même coût) · le dossier n'apprend pas que l'adresse existe ailleurs, ni où ;
- adresse déjà utilisateur de CE dossier · 409, comme aujourd'hui (le dossier
  voit déjà ses utilisateurs).
Jusqu'ici une adresse prise ailleurs rendait 409 « Un compte existe déjà avec
cet email » · c'était la divulgation que la ligne supprime.

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
- Réinitialisation par l'administrateur d'un dossier · sur une appartenance
  rattachée, la ligne est réinitialisée et ses sessions dans CE dossier
  fermées, le mot de passe du compte de connexion ne change pas (un
  administrateur ne prend jamais la main sur l'accès d'une personne aux
  dossiers d'un autre client). Limite écrite.

## 2. Fait

(rempli au fil des commits)

## 3. Reste

## 4. Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
```
