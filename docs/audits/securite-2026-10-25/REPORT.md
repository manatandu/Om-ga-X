# Audit de sécurité d'OmegaX · rapport (2026-10-25)

## 1. Cadre de la passe

- **Méthode** · compétence `security-audit` de Cloudflare (commit `c1c8a8c`), profil
  `quick` · une vague de douze chercheurs, une critique finale de couverture,
  un vérificateur indépendant par piste.
- **Cible** · dépôt `manatandu/Om-ga-X`, révision `d1e16b3` de `main`, lue dans
  une copie détachée en lecture seule.
- **Périmètre** · `src`, `client/src`, `prisma`, `installation`, `scripts`,
  `.github/workflows`, `Dockerfile`, `client/firebase.json`, `client/public`.
- **Budget** · aucun fixé par Manasse ; la session s'en est donné un de 24
  agents, relevé à 32 avant la validation pour que chaque piste ait son
  vérificateur. Environ 29 dépensés.
- **Exécution** · AUCUNE. Aucun bac à sable imposé par le système n'était
  disponible (réseau coupé, montages en lecture seule, limites), si bien que
  la règle de la compétence interdit de lancer le code d'OmegaX. L'audit est
  une LECTURE DU SOURCE. Rien n'a été envoyé au service en ligne.
- **Antériorité** · aucun audit antérieur dans ce format ; les campagnes de
  sécurité internes du 2026-10-22 et du 2026-10-23 n'ont pas été reprises.
- **C'est une passe partielle.** Le profil `quick` ne lance pas de seconde
  vague · la critique finale a nommé quatre zones non couvertes, consignées
  « différées » (§ 7).

## 2. Posture en une phrase

Les protections de fond sont sérieuses (cloisonnement par dossier vérifié par
la valeur, session en cookie httpOnly avec jeton CSRF, révocation, double
authentification, journal d'audit chaîné) ; les pistes relevées se logent
surtout AUX BORDS · l'identité de l'opérateur de la console, la portée des
secrets de déploiement, et quelques clés étrangères que le cloisonnement ne
relit pas.

## 3. Constats confirmés

Aucun. Sans exécution, la compétence n'admet aucun verdict « confirmé ».

## 4. Pistes à valider (sans gravité attribuée)

L'ordre est une priorité de vérification. Le détail de chacune (chemin dans
le code, éléments relus, ce qui manque, vérification locale et vérification
par le propriétaire) est dans `NEEDS-VALIDATION.md`.

| N° | Piste | Où | Ce qui manque pour trancher | Vérification sûre par le propriétaire |
|---|---|---|---|---|
| 1 | Un administrateur du dossier de VMG peut réinitialiser le mot de passe de l'opérateur, ce qui efface sa double authentification, puis ouvrir la console | `utilisateurs/utilisateur.service.ts` (réinitialisation), `plateforme/operateur-plateforme.guard.ts` | le dossier qui porte le compte opérateur a-t-il un autre administrateur ? | compter, par compte opérateur, les autres administrateurs actifs du même dossier |
| 2 | Le drapeau d'opérateur s'accorde au démarrage à QUICONQUE porte une adresse listée, sans preuve que l'adresse lui appartient | `plateforme/plateforme.service.ts` (`onModuleInit`), `auth/auth.service.ts` (`changerAdresse`) | une adresse de `OPERATEURS_PLATEFORME` est-elle libre (aucun compte) ? | pour chaque adresse listée, compter les comptes qui la portent |
| 3 | Les secrets de production sont lisibles depuis un workflow lancé hors de `main` (aucun environnement GitHub protégé) | `.github/workflows/*` | portée réelle des secrets, et qui peut pousser une autre branche | Réglages > Secrets · portée de chaque secret ; liste des comptes et jetons qui poussent |
| 4 | La console peut rattacher un dossier client à un groupe que l'opérateur contrôle, et lire ainsi sa balance | `plateforme/plateforme.service.ts` (`modifierGroupe`), `groupe/groupe.service.ts` | est-ce voulu, face à la règle « VMG ne voit jamais les informations d'un client » ? | décision de Manasse ; relire au journal d'audit les rattachements faits depuis la console |
| 5 | Le double regard se contourne en réécrivant le brouillard d'un collègue avant de le valider | `comptabilite/ecriture.service.ts` (`valider`, `modifier`) | aucune donnée de déploiement · seulement l'exécution locale | sans objet ; repris dans la ligne Microfina M1 |
| 6 | Une demande de circularisation accepte le tiers d'un autre dossier et en rend le code et le nom | `circularisation/circularisation.service.ts` | comment l'identifiant d'un tiers étranger parviendrait-il à l'utilisateur ? | compter les demandes dont le tiers appartient à un autre dossier |
| 7 | Le service Cloud Run reçoit le trafic direct alors que le serveur fait confiance à deux relais, si bien que l'appelant choisit son adresse IP (limitation de débit, journal d'audit) | `deploy-cloud-run.yml`, `common/sauts-de-confiance.ts` | réglage d'entrée réel du service | `gcloud run services describe` · valeur de l'entrée |
| 8 | Un classeur Excel importé est décompressé sans borne de taille | `import/lecture-fichier.ts`, `groupe/groupe.service.ts` | comportement d'ExcelJS et mémoire réelle de l'instance | mémoire configurée de la révision Cloud Run |
| 9 | Un formulaire d'un autre site peut connecter le navigateur de la victime au dossier de l'attaquant | `auth/auth.controller.ts`, `auth/session.constants.ts` (SameSite=None) | comportement du relais Firebase et des navigateurs | essai sur un canal de prévisualisation avec un compte factice |
| 10 | Le compteur d'échecs de connexion se lit puis s'écrit sans verrou · des essais simultanés le font moins monter | `auth/auth.service.ts` | taille réelle d'une rafale sur une instance à un cœur | relire les journaux pour des rafales d'échecs sur un même compte |
| 11 | Sur site, la copie externe accepte un chemin réseau que le service touche sous le compte système (authentification de la machine envoyée à un hôte choisi) | `sur-site/sauvegarde-sur-site.service.ts` | comportement Windows et réseau, et si l'administrateur d'installation est aussi administrateur Windows | services.msc · compte du service ; politique de signature SMB |

## 5. Renforcements relevés (hors pistes)

- **Chaîne de livraison** · `npm ci` lancé dans l'étape qui porte la chaîne de
  connexion directe ; clé de compte de service GCP à longue durée (préférer la
  fédération d'identité liée à `main`) ; actions tierces citées par étiquette
  mobile plutôt que par empreinte ; prévisualisation Firebase avec la même
  identité que le déploiement réel ; `requetes-production.yml` mériterait un
  rôle de base en lecture seule.
- **Session** · cookie hébergé en SameSite=None alors que l'API est servie sous
  l'adresse du site (Lax suffirait) ; `POST /auth/logout` sans contrôle
  d'origine ; `validate-env.ts` ne fait qu'avertir sur un `JWT_SECRET` court.
- **Cloisonnement** · l'extension ne relit ni les clés étrangères scalaires, ni
  les écritures imbriquées, ni les lignes rendues par `include` (cause commune
  des pistes 4 et 6) ; `CompteService` recopie `tauxTvaDefautId` sans le
  vérifier.
- **Console** · `reinitialiserAdmin` n'exclut pas les comptes opérateurs ; le
  drapeau d'opérateur n'est jamais retiré au démarrage.
- **Droits** · les tuiles de logiciels masquent sans refuser (déjà au suivi) ;
  certaines annulations de module inscrivent un négatif validé hors du profil
  de fonctions de validation.
- **Gabarits** · les relances et bordereaux remplacent des jetons par
  `String.replace` avec des valeurs saisies (motifs `$&` interprétés).
- **Sur site** · la licence se remplace par toute licence VMG plus récente du
  même poste ; `GET /sur-site/etat` dit à tout le réseau local le titulaire et
  le numéro de licence.
- **Client** · `style-src 'unsafe-inline'` ; les cinq derniers dossiers et
  adresses restent dans le stockage local du poste.

## 6. Ce qui tient (relu et couvert)

Jeton de session et CSRF, routes authentifiées qui écrivent (rôles, licence),
export et restitution du dossier, gabarits et courriel sortant, client
navigateur · cinq unités couvertes sans piste.

## 7. Couverture

Seize unités au registre · 5 couvertes, 7 porteuses d'une piste (toutes
vérifiées), 4 différées par la critique finale, qu'aucune vague ne pouvait
reprendre en profil `quick` :

1. les identifiants de relation portés par les DTO (environ 270 écritures
   `xxxId: dto.xxxId`) et les lignes rendues par `include` · la piste 6 n'en est
   qu'un échantillon ;
2. les routes `GET` qui écrivent un état (numérotation des impressions et des
   extraits), exemptées du contrôle CSRF ;
3. la suppression des dossiers d'essai échus (`essais-echus`, seule requête SQL
   brute non paramétrée du serveur, hors cloisonnement) ;
4. les lectures de tout un dossier déclenchées par un cabinet (restitution,
   impressions différées, exports de 200 000 lignes) face au tas et au pool de
   connexions partagés.

Exclus avec motif · mémoire et binaires (aucun code natif), IA (aucun modèle
dans le produit), RPC et messagerie entrante (aucune), application de bureau
(le sur-site est un serveur web local).

Une passe `standard` ou `deep` couvrirait ces quatre zones, et une exécution
dans un bac à sable isolé trancherait les onze pistes.
