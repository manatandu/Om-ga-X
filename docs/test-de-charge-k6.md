# Test de charge k6 · ce que le serveur d'OmegaX supporte quand beaucoup de cabinets travaillent ensemble

Mesuré le 17 octobre 2026 sur la branche `travail/charge-k6` (scénario `e2e/k6/usage-complet.js`, mode d'emploi `e2e/k6/README.md`). Toutes les mesures de ce document ont été relevées par un lancement réel ; ce qui n'a pas pu l'être est dit en section 6, et aucun chiffre n'y est inventé.

**À lire d'abord.** Le banc est un conteneur de développement de quatre cœurs avec une base PostgreSQL 16 locale. Ce n'est NI Cloud Run, NI Neon. Il reproduit les contraintes que le serveur subit en production (un cœur, un tas de 460 Mio, un pool de dix connexions, l'isolation SERIALIZABLE de Prisma, l'inscription publique ouverte) et il dit où est le goulot et comment le service casse. Il ne dit pas combien de cabinets Cloud Run servira : les chiffres ne se transposent pas tels quels, et les recommandations de la section 7 sont des hypothèses à vérifier en préproduction avant de toucher au workflow (que cette mission n'a pas modifié).

---

## 1. En bref

- **Un cabinet seul** : un tour complet (de l'inscription à la liasse, 134 requêtes) dure une dizaine de secondes ; toutes requêtes confondues p50 25 ms, p95 154 ms ; la liasse complète en 1 s.
- **Le nominal, 20 cabinets simultanés pendant cinq minutes** : 21,5 requêtes par seconde, 6,8 écritures par seconde, p50 0,38 s, p95 1,9 s, p99 3,4 s, **aucun 5xx**. Dix étapes sur quarante dépassent leur seuil de p95 (inscription, comptes retenus, contrôles, lettrage, saisie…). 1,4 % des gestes d'écriture reçoivent un premier refus 409 « trop d'écritures au même instant », 0,4 % le gardent après une reprise (3.3, 4.4).
- **La saturation d'un cœur** : entre 20 et 40 cabinets simultanés. Le débit plafonne autour de 20 requêtes par seconde ; à 40 cabinets p95 4,2 s et p99 12 s ; à 80, p95 7,2 s, 13 erreurs 5xx, plus aucun tour terminé ; en pointe à 150, 194 erreurs 5xx ou coupures, mais **le service ne tombe pas et revient** une minute après la fin de la pointe (3.2, 3.4).
- **Les inscriptions** (ouverture publique de l'essai) : de l'ordre de **2 par seconde et par cœur** sans erreur. Vingt inscriptions dans la même seconde passent toutes, mais la dernière attend 26 s. Avant correctif, dix inscriptions simultanées donnaient six erreurs 500 en 32 s (3.6, 3.7).
- **Où est le goulot** : le cœur de Node (92 à 95 % pendant l'endurance, 36 ms de cœur par requête, 4,6 s par cabinet complet), pas la base (0,6 connexion en état `active` sur 10 en moyenne). Au-delà de 40 cabinets, le pool de dix connexions ; et la latence vers la base multiplie le coût d'une requête (8 ms d'aller-retour : ×3 à ×27 selon l'étape) (3.8, 5).
- **Mémoire** : 338 à 354 Mo jusqu'à 20 cabinets, **467 Mo à 40 cabinets et 465 Mo en pointe, à 45 Mo du plafond d'un conteneur de 512 Mio**. Endurance de 15 minutes à 10 cabinets : plateau à environ 360 Mo, aucune dérive de latence, pas de fuite visible (une fuite lente resterait invisible) (3.11, 3.13).
- **Défauts** : aucun BLOQUANT. Trois MAJEURS **corrigés** et gelés par des tests : la pré-image du journal d'audit prenait une seconde connexion du pool (dix transactions simultanées gelaient le service 30 s) ; le maillon précédent du journal d'audit se lisait par un balayage de toute la table (coût croissant avec le nombre de cabinets, et conflits entre cabinets sans rapport) ; **chaque saisie balayait la table des comptes de tous les cabinets** (le temps de saisie multiplié par 3 à 4 à 500 cabinets, sans borne). Deux MAJEURS **ouverts** (conflits de sérialisation résiduels ; sous saturation, 500 et trous dans le journal d'audit) et six MINEURS consignés (4).
- **Cloisonnement et bouclage** : sur 42 lancements et 1 316 cabinets menés au bout, **aucune fuite entre dossiers** (le dossier sentinelle est resté intact à chaque épilogue) et **aucune balance fausse** (3.14).
- **Pour Cloud Run** (7) : la concurrence de 80 est trop haute pour un vCPU, **20 au plus** ; mémoire à relever à 1 Gio avec le tas fixé ; connexions à compter jusqu'à 18 par instance ; instances à relever si la base suit. Rien de cela n'a été mesuré sur Cloud Run.
- **Pas mesuré** : Neon et PgBouncer, Cloud Run, PostgreSQL 17 et 18, plus de 15 minutes d'endurance, plus d'une instance (6).

---

## 2. Le montage

### 2.1 Machine et versions

| | |
|---|---|
| Machine | conteneur de développement, 4 cœurs, 16 Go de mémoire, Linux 6.18 |
| Node | 22.22.2 (comme le `Dockerfile`) |
| PostgreSQL | 16.13 (Ubuntu), local, `max_connections=200`, `shared_buffers=128MB`, `fsync` et `synchronous_commit` à leur valeur par défaut (actifs), isolation par défaut READ COMMITTED (Prisma passe en SERIALIZABLE par transaction) |
| k6 | 2.3.0 (`go1.26.8`, linux/amd64), binaire installé hors du dépôt (`/home/user/bin/k6`) |
| k6, vérification | l'archive `k6-v2.3.0-linux-amd64.tar.gz` a été comparée à la ligne correspondante du fichier `k6-v2.3.0-checksums.txt` de la même publication (SHA-256 `39c3117b…8ab1`, identique). Les deux viennent du même dépôt de publication : cela prouve que le téléchargement est intact, pas que la publication est authentique par un tiers |
| Serveur | `dist/main.js` compilé par `npm run build`, voir 2.2 |

### 2.2 Les contraintes de production reproduites, et celles qui ne le sont pas

Reproduit :

- **un seul cœur** pour le serveur (`taskset -c 0`), PostgreSQL sur les cœurs 1 et 2, k6 sur le cœur 3 : le générateur de charge ne vole pas le processeur du serveur ;
- **tas de 460 Mio** (`node --max-old-space-size=460`), la taille de tas d'un conteneur Cloud Run à 512 Mio selon `docs/capacite-mesuree.md` ;
- **pool Prisma de 10 connexions** (`connection_limit=10`, la valeur que le workflow de déploiement pose par défaut) ;
- `NODE_ENV=production`, `INSCRIPTION_PUBLIQUE=true`, `PORT=8080`, serveur joint en direct sur `:8080` ;
- **deux relais de confiance** (`SAUTS_PROXY_CONFIANCE=2`, la valeur en ligne) et un `X-Forwarded-For` à deux sauts par cabinet virtuel, pour que chaque cabinet arrive d'une adresse différente comme le public réel (sinon la limitation de débit par adresse coupe la charge avant le serveur, voir 3.10) ;
- l'**essai public** (`INSCRIPTION_ESSAI=true`) avec un faux serveur SMTP local (`puits-courriel.mjs`, sans dépendance) qui rend le mot de passe provisoire au script.

Non reproduit, et c'est important :

- **Neon et son pooler PgBouncer** : la base est locale, en connexion directe. Seule l'expérience de la section 3.8 ajoute une latence (8 ms d'aller-retour simulés) ;
- **Cloud Run** : pas de limite de mémoire de conteneur, pas de quota de processeur partagé, pas d'autoscaling, pas de démarrage à froid, pas de sortie réseau vers l'extérieur ;
- **PostgreSQL 17 et 18** (la version de Neon et celle du sur site) : tout a tourné sur la 16.

La base de chaque série est créée neuve par clonage d'une base migrée et vide (`create database … template`), sauf mention contraire en 3.7 (série A).

### 2.3 Le scénario : un cabinet neuf, du premier clic à la liasse

Un tour de boucle d'un utilisateur virtuel (un « cabinet ») joue, dans l'ordre :

1. **entrée** : l'état de l'essai, puis l'inscription (`POST /auth/register`) ou l'essai public (`POST /auth/inscription-essai`, mot de passe provisoire lu au puits, `POST /auth/changer-mot-de-passe`), puis la connexion ;
2. **ouverture du dossier** : `/auth/me`, exercices, journaux, plan de comptes (retenus, puis complet), démarrage guidé ;
3. **structure** : adoption de quatre comptes du plan, création de quatre tiers (deux fournisseurs, deux clients) ;
4. **saisie** : 40 écritures équilibrées par cabinet en 8 lots de 5 (achat, règlement fournisseur, vente, encaissement client, paie), puis le brouillard ;
5. **validation par lots de 25, puis lettrage** des paires facture et règlement ;
6. **livres** : journal, balance (qui doit boucler et reprendre à l'unité près ce qui vient d'être saisi), grand livre, balance âgée, balance auxiliaire, échéancier, évolution des soldes ;
7. **états** : bilan (équilibré), compte de résultat, tableau des flux, notes annexes, déclaration de TVA, contrôles, tableau de bord ;
8. **immobilisation** : création d'un bien et dotation, tableaux ;
9. **exports Excel en flux** : journal, balance, grand livre, liasse complète (le contenu est vérifié : un classeur commence par `PK`) ;
10. **sondes de cloisonnement** (voir 2.6) puis déconnexion.

Un cabinet SYCEBNL sur deux, un SYSCOHADA sur deux (`REFERENTIEL=MIX`), 30 % d'entre eux entrent par l'essai public. Un tour représente 134 requêtes pour un cabinet seul (les reprises après un refus 409 s'ajoutent sous charge).

### 2.4 Profils et commandes exactes

Serveur (par `serveur.sh`, hors du dépôt, dont le contenu est celui-ci) :

```bash
export DATABASE_URL='postgresql://postgres@localhost:<port>/<base jetable>?schema=public&connection_limit=10'
export JWT_SECRET=<valeur jetable> NODE_ENV=production PORT=8080 INSCRIPTION_PUBLIQUE=true \
       CORS_ORIGIN=http://localhost:4173 JWT_EXPIRES_IN=8h SAUTS_PROXY_CONFIANCE=2 \
       INSCRIPTION_ESSAI=true SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=u SMTP_PASS=p \
       COURRIER_EXPEDITEUR=essai@omegax.test
taskset -c 0 node --max-old-space-size=460 dist/main.js
```

k6 (une ligne par essai ; `<nom>` est le nom de l'essai) :

```bash
taskset -c 3 k6 run --summary-export=<nom>.json -e RUN=<nom><heure> \
  -e PROFIL=<profil> [...] -e SINK=http://127.0.0.1:2526 e2e/k6/usage-complet.js
```

| Profil | Ce qu'il fait | Variables des essais de ce document |
|---|---|---|
| `fumee` | un cabinet, une fois | `-e THINK=0.2 -e REFERENTIEL=SYCEBNL -e ESSAI=0` (aussi SYSCOHADA, et l'essai public) |
| `palier` | N cabinets simultanés, montés en 30 s puis tenus | `-e VUS=<N> -e DUREE=150s -e THINK=1 -e REFERENTIEL=MIX`, N de 5 à 120 |
| `nominal` | 20 cabinets, 1 min de montée, 5 min, 30 s de descente | `-e THINK=1 -e REFERENTIEL=MIX` |
| `montee` | de 5 à 120 cabinets par paliers de 2 min | voir ci-dessous : remplacée par une série de `palier` |
| `stress` | pointe brutale à 150 cabinets pendant 90 s puis retour à 5 | `-e THINK=1` |
| `pic` | 20 cabinets sans temps de réflexion (débit brut) | `-e THINK=0` |
| `rafale` | N inscriptions dans la même seconde | `-e RAFALE=<N> -e THINK=0`, parcours `entree` (inscription, connexion, ouverture du dossier) |
| `inscriptions` | flux régulier d'inscriptions par paliers de 60 s | `-e TAUX=30,60,120,180,300` (par minute) |

Le temps de réflexion (`THINK=1`) est une moyenne de une seconde, tirée entre 0,5 et 1,5 s, placée entre les groupes de gestes (ouvrir le plan, passer un lot de cinq pièces, valider, lire un état). Les requêtes d'un même geste partent à la suite. Un cabinet virtuel produit ainsi environ une requête par seconde en moyenne (19,6 requêtes par seconde pour 20 cabinets au palier 20). **Un comptable réel est plus lent** : l'équivalence « un cabinet virtuel vaut tant d'utilisateurs humains » est une hypothèse de lecture, pas une mesure.

La série de `palier` a remplacé le profil `montee` : un lancement par nombre de cabinets (5, 10, 20, 40, 80, 120) donne une courbe lisible, un point par lancement, sans mélanger les paliers. Le profil `montee` reste dans le script ; il n'a pas été lancé tel quel.

### 2.5 Les seuils, posés avant la mesure

Chaque étape (40 étiquettes `etape`) a son seuil de p95, écrit en tête du script avec sa raison :

- **1 000 ms** pour une lecture ou un geste courant (au-delà d'une seconde le fil de la pensée se casse, Nielsen) ;
- **3 000 ms** pour la connexion et l'inscription, qui hachent un mot de passe (bcryptjs, 12 tours, un seul cœur) et, pour l'essai, parlent à SMTP, et pour les états lourds (notes annexes, tableau des flux, contrôles) ;
- **1 500 ms** pour les états de moyenne taille (bilan, balances, TVA, immobilisations) ;
- **10 000 ms** pour un export Excel en flux, **15 000 ms** pour la liasse complète.

Quatre compteurs de fond ont un seuil à zéro : `fuites_entre_dossiers`, `incoherences_comptables`, `reponses_5xx` et `refus_inattendus`. Un seuil de temps dépassé ne dit pas « le logiciel est en panne » : il dit « un utilisateur le sentirait ».

### 2.6 Ce qui a été surveillé pendant chaque essai

- **Serveur** (toutes les 2 s, `surveiller.sh`) : mémoire résidente et pic, part du cœur utilisée par le serveur, nombre de connexions ouvertes vers la base, dont celles dont l'état est `active` (la part de processeur de PostgreSQL est relevée aussi, mais en secondes entières par `ps` : trop grossière pour être citée, ce document ne s'en sert pas). Le journal du serveur de chaque essai est gardé et relu (erreurs, délais d'attente du pool, « maillon d'audit non écrit »).
- **Sonde de santé** (profils chargés) : un `GET /health` toutes les deux secondes, hors de la charge, qui joint la base (CLAUDE.md § 5) : elle voit un pool saturé avant n'importe quel écran, et dit si le service REVIENT après une pointe.
- **Cloisonnement** : un dossier sentinelle (une écriture, un tiers, une balance de 424 242 aux deux colonnes) est créé avant la charge ; chaque cabinet tente de le lire (9 lectures, un export, des écritures, une validation, une modification de compte, une suppression de tiers, un lettrage) et son propre `/tiers` et son propre journal ne doivent montrer que lui. Un seul franchissement ferait échouer l'essai. L'épilogue relit la sentinelle : balance, journal et tiers doivent être exactement ceux de départ.
- **Bouclage** : la balance doit boucler et reprendre le montant saisi, le bilan doit s'équilibrer, le lot validé doit l'être en entier, les exports doivent être de vrais classeurs.

---

## 3. Résultats

Chaque essai est un lancement unique, sauf ceux dont la section dit qu'ils ont été répétés (la rafale de 20 inscriptions, le palier de 20). La dispersion d'un lancement à l'autre n'est donc chiffrée qu'à ces endroits ; ailleurs, lire un écart de 20 à 30 % comme du bruit.

### 3.1 Un cabinet seul (fumée) et 20 cabinets pendant cinq minutes (le nominal), étape par étape

Colonne « seul » : le cabinet seul sur un serveur neuf (SYCEBNL, base locale). Colonnes suivantes : le profil `nominal`, 20 cabinets simultanés pendant cinq minutes (une minute de montée, 87 tours menés au bout, 10 995 requêtes), serveur C, base neuve. Les seuils sont ceux de la section 2.5.

| Étape | seul p50 | 20 cabinets, 5 min requêtes | p50 | p95 | p99 | max | seuil p95 | |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| etat_essai | 2,4 | 87 | 6,4 | 215 | 392 | 813 | 1000 | tenu |
| inscription | 699 | 66 | 3 428 | 7 923 | 8 727 | 9 769 | 3000 | dépassé |
| inscription_essai | · | 21 | 4 848 | 6 867 | 7 867 | 8 117 | 3000 | dépassé |
| connexion | 296 | 87 | 588 | 1 275 | 1 733 | 1 861 | 3000 | tenu |
| changer_mdp | · | 21 | 1 272 | 2 681 | 2 718 | 2 727 | 3000 | tenu |
| me | 16,6 | 87 | 108 | 417 | 606 | 675 | 1000 | tenu |
| exercices | 4,7 | 87 | 86,7 | 395 | 545 | 623 | 1000 | tenu |
| journaux | 4,6 | 87 | 111 | 350 | 511 | 573 | 1000 | tenu |
| plan_retenu | 220 | 87 | 2 363 | 4 235 | 4 859 | 4 869 | 1000 | dépassé |
| plan_complet | 50,1 | 87 | 161 | 452 | 708 | 911 | 2000 | tenu |
| demarrage | 12,6 | 87 | 105 | 522 | 942 | 1 111 | 1000 | tenu |
| adopter_compte | 15,5 | 348 | 280 | 965 | 1 211 | 1 568 | 1000 | tenu |
| creer_tiers | 44,1 | 348 | 797 | 2 457 | 2 957 | 3 344 | 1000 | dépassé |
| saisie_ecriture | 28,8 | 3480 | 566 | 1 686 | 2 194 | 2 856 | 1000 | dépassé |
| brouillard | 29,2 | 87 | 283 | 647 | 1 037 | 1 333 | 1000 | tenu |
| valider | 19,7 | 174 | 358 | 1 040 | 1 270 | 1 700 | 1500 | tenu |
| lettrer | 21,4 | 1465 | 549 | 2 063 | 3 378 | 5 145 | 1000 | dépassé |
| journal | 26,8 | 261 | 188 | 735 | 1 082 | 1 243 | 1000 | tenu |
| balance | 19,4 | 261 | 165 | 499 | 790 | 1 651 | 1000 | tenu |
| grand_livre | 16,3 | 87 | 206 | 591 | 721 | 1 052 | 1500 | tenu |
| grand_livre_compte | 10,8 | 87 | 266 | 832 | 1 006 | 1 064 | 1000 | tenu |
| balance_agee | 16,5 | 87 | 199 | 511 | 833 | 985 | 1500 | tenu |
| balance_auxiliaire | 38,5 | 87 | 161 | 552 | 723 | 740 | 1500 | tenu |
| echeancier | 20,8 | 87 | 245 | 596 | 787 | 1 171 | 1500 | tenu |
| evolution | 10,6 | 87 | 142 | 508 | 739 | 755 | 1500 | tenu |
| bilan | 78,3 | 87 | 433 | 980 | 1 222 | 1 275 | 1500 | tenu |
| resultat | 49,5 | 87 | 270 | 625 | 735 | 948 | 1500 | tenu |
| flux | 71,7 | 87 | 461 | 1 057 | 1 235 | 1 277 | 3000 | tenu |
| notes | 94,4 | 87 | 868 | 1 856 | 2 448 | 2 575 | 3000 | tenu |
| tva | 50,9 | 87 | 828 | 2 050 | 2 327 | 2 527 | 1500 | dépassé |
| controles | 152 | 87 | 1 811 | 4 318 | 4 703 | 4 926 | 3000 | dépassé |
| immo_creer | 56,8 | 87 | 953 | 2 286 | 2 428 | 2 486 | 1500 | dépassé |
| immo_dotation | 67,1 | 87 | 965 | 2 618 | 2 838 | 3 330 | 1500 | dépassé |
| immo_tableaux | 10,8 | 348 | 185 | 569 | 823 | 1 126 | 1500 | tenu |
| export_journal | 120 | 87 | 1 306 | 3 376 | 3 677 | 4 252 | 10000 | tenu |
| export_balance | 143 | 87 | 759 | 1 917 | 2 590 | 2 601 | 10000 | tenu |
| export_grand_livre | 82,5 | 87 | 640 | 1 461 | 2 344 | 2 378 | 10000 | tenu |
| export_liasse | 973 | 87 | 2 221 | 4 115 | 5 088 | 6 511 | 15000 | tenu |
| cloisonnement | 5,0 | 1479 | 93,0 | 424 | 703 | 1 317 | 1000 | tenu |
| deconnexion | 3,0 | 87 | 7,7 | 160 | 310 | 340 | 1000 | tenu |

Lecture :

- **Seul**, tout tient très largement : p50 de 25 ms toutes requêtes confondues, p95 de 154 ms, un tour complet en une dizaine de secondes. La liasse complète prend 973 ms (SYCEBNL), 1 340 ms (SYSCOHADA). L'essai public, seul, rend son mot de passe provisoire au puits en 7 ms.
- **À 20 cabinets**, dix étapes sur quarante dépassent leur seuil de p95. Les plus coûteuses : l'**inscription** (p50 3,4 s, p95 7,9 s ; l'essai public p50 4,8 s : hachage bcrypt et semis d'un plan de comptes, tous deux sur le cœur unique), la **liste des comptes retenus** `GET /comptes?retenus=true` (p50 2,4 s, p95 4,2 s, contre 0,22 s seule et 0,16 s pour le plan complet à 20 cabinets : voir 4.7), les **contrôles** (p50 1,8 s, p95 4,3 s), le **lettrage** (p95 2,1 s), la **saisie** d'une écriture (p50 0,57 s, p95 1,7 s), puis la TVA, la création d'un tiers, d'un bien et sa dotation.
- Les **lectures** (journal, balance, grand livre, balance âgée, bilan, résultat, tableau des flux, notes annexes) restent sous leur seuil à 20 cabinets : elles sont agrégées par la base (CLAUDE.md § 8 bis). Les trois exports Excel et la liasse (p50 2,2 s, p95 4,1 s) tiennent largement les leurs.
- **Aucun 5xx**, aucune fuite entre dossiers, aucune balance fausse.

### 3.2 Montée par paliers (serveur C)

Chaque ligne est un lancement de 150 s de palier (30 s de montée avant), `THINK=1`, base neuve pour le palier 5, base grossissante ensuite (la même base sert de 5 à 80, ce qui est l'état d'un service qui vit).

| Essai | req/s | écritures/s | 1ers refus 409 | refus après reprise | 5xx | p50 ms | p95 ms | p99 ms | CPU serveur moy / max % | RSS max Mo | connexions base max | cabinets menés au bout |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 5 cabinets | 13,2 | 4,1 | 1 | 0 | 0 | 53,7 | 491 | 1 322 | 49 / 99 | 338 | 10 | 31 |
| 10 cabinets | 17,8 | 5,6 | 24 | 2 | 0 | 128 | 930 | 1 803 | 63 / 100 | 338 | 11 | 42 |
| 20 cabinets | 19,6 | 6,1 | 89 | 21 | 0 | 319 | 1 783 | 3 042 | 67 / 100 | 354 | 11 | 46 |
| 20 cabinets (2e lancement, base neuve) | 17,4 | 5,3 | 188 | 82 | 1 | 329 | 1 947 | 4 549 | 67 / 100 | 352 | 11 | 40 |
| 40 cabinets | 17,4 | 5,4 | 7 | 1 | 1 | 767 | 4 208 | 12 123 | 63 / 100 | 467 | 11 | 41 |
| 80 cabinets | 23,0 | 10,5 | 5 | 18 | 13 | 2 554 | 7 217 | 26 240 | 85 / 102 | 410 | 17 | 0 |

Le palier de 20 cabinets a été joué deux fois (la seconde sur une base neuve) et le nominal en est une troisième mesure : **p50 319 et 329 ms, p95 1,8 et 1,9 s, p99 3,0 et 4,5 s, 19,6 et 17,4 requêtes par seconde**, mais la part des gestes d'écriture refusés une première fois varie de 1,4 % (nominal) à 3,1 % puis 7,3 % (188 sur 2 588) : un facteur cinq d'un lancement à l'autre, et un 500 sur la création d'un tiers dans le second (voir 4.5). Ce taux de conflits n'est donc pas une constante du logiciel, ni précisément mesurable ici.

« 1ers refus 409 » compte les premiers refus « trop d'écritures au même instant » (que le script reprend une fois, comme une personne qui recommencerait), « refus après reprise » ce qui résiste à cette reprise. « Cabinets menés au bout » compte les tours terminés dans la fenêtre : à 80 cabinets simultanés plus aucun n'arrive au bout dans le temps imparti.

Lecture, avec la loi de Little (requêtes en vol = débit × durée moyenne) pour parler le langage de Cloud Run, qui compte des requêtes simultanées et non des cabinets :

| Cabinets simultanés | Requêtes en vol (moyenne) | Verdict |
|---:|---:|---|
| 5 | 1,7 | tout tient, p95 sous 0,5 s |
| 10 | 4,5 | p95 0,9 s, p99 1,8 s : le confort |
| 20 | 10,2 | p95 1,8 s, p99 3,0 s, un cœur à 100 % par moments : **le point nominal** |
| 40 | 21,7 | p95 4,2 s, p99 12 s, premier 5xx : **dégradé**, mémoire à 467 Mo |
| 80 | 72,5 | p95 7,2 s, p99 26 s, 13 5xx, aucun tour terminé : **saturé** |

Les cinq premières lignes de ce tableau sont des mesures, la colonne « requêtes en vol » est un calcul à partir d'elles, et le verdict est un jugement posé sur les seuils de la section 2.5.

**Point de saturation** : entre 20 et 40 cabinets simultanés (10 à 22 requêtes en vol) sur un cœur. Le débit total plafonne autour de **17 à 20 requêtes par seconde** et de **5 à 6 écritures par seconde** quel que soit le nombre de cabinets ajoutés : au-delà, on ne sert pas plus, on fait attendre plus longtemps. La cause est le cœur unique (le processeur du serveur touche 100 %) puis, au-delà de 40 cabinets, le pool de 10 connexions : les transactions attendent une connexion libre, et après 10 s de pool (`connection pool timeout`) le serveur répond 500.

La durée d'un tour complet d'un cabinet (de l'inscription à la déconnexion, temps de réflexion compris) : 27 s à 5 cabinets, 44 s à 10, 81 s à 20, 172 s à 40.

### 3.3 Le nominal en chiffres

| Essai | req/s | écritures/s | 1ers refus 409 | refus après reprise | 5xx | p50 ms | p95 ms | p99 ms | CPU serveur moy / max % | RSS max Mo | connexions base max | cabinets menés au bout |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| nominal (20 cabinets, 5 min) | 21,5 | 6,8 | 73 | 22 | 0 | 379 | 1 856 | 3 385 | 79 / 100 | 353 | 11 | 87 |

Le débit plafonne à 21,5 requêtes par seconde (6,8 écritures par seconde). Toutes requêtes confondues : p50 379 ms, p95 1,86 s, p99 3,4 s, maximum 9,8 s (une inscription). Sur environ 5 300 gestes d'écriture (saisie, validation, lettrage, bien), **73 (1,4 %) ont reçu un premier refus 409** et **22 (0,4 %) l'ont gardé après une reprise** ; quatre cabinets ont fini avec un lettrage incomplet (voir 3.14). Un tour complet dure 91 s au p50 (100 s au p95). Le cœur du serveur est à 79 % en moyenne et touche 100 % ; la mémoire résidente culmine à 353 Mo ; 11 connexions ouvertes au plus, dont 5 actives. La sonde `/health` reste entre 25 et 100 ms au p50 (maximum 0,83 s), sans erreur. Les 1 305 sondes de cloisonnement ont toutes été refusées net.

### 3.4 Pointe et retour au calme (stress)

Profil `stress` : 5 cabinets pendant une minute, montée en 30 s à 150, tenue de 90 s, retour à 5 en 30 s, puis deux minutes à 5. Le serveur est le même, un cœur, pool de 10.

| Essai | req/s | écritures/s | 1ers refus 409 | refus après reprise | 5xx | p50 ms | p95 ms | p99 ms | CPU serveur moy / max % | RSS max Mo | connexions base max | cabinets menés au bout |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| stress (150 cabinets en pointe) | 14,7 | 2,0 | 0 | 166 | 194 | 176 | 22 956 | 43 367 | 66 / 100 | 465 | 16 | 20 |

Le tableau suivant est la sonde `/health` (appelée toutes les deux secondes, hors charge) par tranches de 30 s :

| t (s) | sondes | /health p50 ms | max ms | erreurs ou délais > 5 s |
|---:|---:|---:|---:|---:|
| 0 | 15 | 6,0 | 302 | 0 |
| 30 | 15 | 10,0 | 187 | 0 |
| 60 | 9 | 1 294 | 7 099 | 0 |
| 90 | 13 | 8 479 | 11 941 | 2 |
| 120 | 16 | 5 896 | 11 292 | 0 |
| 150 | 12 | 16 650 | 24 033 | 1 |
| 180 | 15 | 7 383 | 10 167 | 1 |
| 210 | 16 | 1 516 | 5 698 | 0 |
| 240 | 15 | 529 | 1 094 | 0 |
| 270 | 15 | 10,0 | 320 | 0 |
| 300 | 15 | 11,0 | 447 | 0 |
| 330 | 15 | 12,0 | 1 205 | 0 |
| 360 | 15 | 7,0 | 29,0 | 0 |
| 390 | 15 | 13,0 | 244 | 0 |
| 420 | 15 | 4,0 | 6,0 | 0 |

Lecture : pendant la pointe, `/health` met de 1 s à 24 s à répondre ; **le service ne s'effondre pas** (le processus survit, aucun redémarrage, mémoire à 465 Mo au plus) et **revient** : trente secondes après le retour à 5 cabinets (t = 240 s) `/health` met encore 0,5 s, à t = 270 s il répond de nouveau en une dizaine de millisecondes. Ce qui se perd pendant la pointe : des gestes (194 réponses 5xx ou coupures : 182 erreurs 500 dont le journal du serveur dit 179 délais d'attente du pool de dix connexions et 3 délais de démarrage de transaction, et 12 connexions coupées par le serveur) et des maillons du journal d'audit (voir 4.5). Quarante requêtes de plus, « context canceled », sont celles que k6 interrompt à l'arrêt de l'essai ; elles s'écrivent à la console et ne sont pas comptées. Aucune balance n'est fausse et aucun dossier n'est modifié.

### 3.5 Le débit maximal brut (pic)

20 cabinets sans temps de réflexion.

| Essai | req/s | écritures/s | 1ers refus 409 | refus après reprise | 5xx | p50 ms | p95 ms | p99 ms | CPU serveur moy / max % | RSS max Mo | connexions base max | cabinets menés au bout |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| pic (20 cabinets, sans temps de réflexion) | 15,3 | 4,8 | 0 | 0 | 0 | 640 | 2 322 | 5 729 | 61 / 103 | 375 | 18 | 40 |

Sans temps de réflexion, 20 cabinets ne tirent pas plus du serveur : **15,3 requêtes par seconde** (contre 19,6 avec une seconde de réflexion au palier de 20), p50 0,64 s, p95 2,3 s, p99 5,7 s, aucun 5xx, 40 tours menés au bout en 3,5 minutes. Le débit maximal d'un cœur pour ce mélange de requêtes est donc de l'ordre de **15 à 22 requêtes par seconde**. Le cœur n'est ici à 100 % que par moments (61 % en moyenne) et la base compte en moyenne 4 connexions « actives » sur 10 : ce plafond-là n'est pas expliqué par le seul processeur, je ne le tranche pas. Cet essai a tourné sur une base déjà grossie (421 dossiers au départ) : voir 3.12 pour l'absence de conflit de sérialisation.

### 3.6 Inscriptions : la rafale et le flux

C'est le scénario de l'ouverture publique de l'essai : beaucoup de personnes qui s'inscrivent en même temps. Le parcours est l'entrée seule (état de l'essai, inscription ou essai, connexion, ouverture du dossier).

**Rafale** (N inscriptions lancées dans la même seconde) :

| Essai | lancés ensemble | menés au bout | 5xx | inscription directe p50 / max (s) | essai public p50 / max (s) | connexion p50 (s) | dernier retour (s) |
|---|---:|---:|---:|---:|---:|---:|---:|
| A · 5 | 5 | 5 | 0 | 3,3 / 5,5 (4) | 4,2 / 4,2 (1) | 0,4 | 5,5 |
| A · 10 | 10 | 1 | 9 | 33,3 / 33,5 (8) | 33,5 / 33,5 (2) | 0,3 | 33,5 |
| A · 20 | 20 | 0 | 20 | 35,7 / 35,7 (14) | 16,5 / 16,5 (6) | · | 35,7 |
| A · 40 | 40 | 0 | 40 | 21,6 / 40,2 (27) | 21,6 / 21,7 (13) | · | 40,2 |
| B · 20 | 20 | 20 | 0 | 9,5 / 14,9 (14) | 17,2 / 21,2 (6) | 3,8 | 21,2 |
| B · 40 | 40 | 40 | 0 | 15,7 / 34,1 (32) | 21,1 / 36,5 (8) | 11,5 | 36,5 |
| C · 20 | 20 | 20 | 0 | 14,9 / 25,3 (17) | 26,1 / 26,5 (3) | 4,0 | 26,5 |
| C avec 8 ms de latence base · 10 | 10 | 10 | 0 | 7,7 / 11,6 (7) | 9,7 / 10,0 (3) | 1,5 | 11,6 |

A, B et C sont les trois états du serveur définis en 3.7 (A : état initial, B : premier correctif, C : correctifs 1 et 2). Dans les colonnes d'inscription, on lit la médiane, le maximum et, entre parenthèses, le nombre de requêtes ; la dernière colonne est l'instant de retour de la dernière inscription.

**La rafale de 20 inscriptions, jouée quatre fois sur le serveur C, chaque fois sur une base neuve :**

| Essai | lancés ensemble | menés au bout | 5xx | inscription directe p50 / max (s) | essai public p50 / max (s) | connexion p50 (s) | dernier retour (s) |
|---|---:|---:|---:|---:|---:|---:|---:|
| C · 20 (1er lancement) | 20 | 20 | 0 | 14,9 / 25,3 (17) | 26,1 / 26,5 (3) | 4,0 | 26,5 |
| C · 20 (2e) | 20 | 20 | 0 | 13,2 / 23,9 (15) | 23,0 / 25,0 (5) | 3,7 | 25,0 |
| C · 20 (3e) | 20 | 20 | 0 | 10,5 / 27,6 (14) | 17,9 / 27,3 (6) | 4,3 | 27,6 |
| C · 20 (4e) | 20 | 20 | 0 | 9,2 / 23,5 (13) | 19,1 / 24,4 (7) | 4,9 | 24,4 |

Les quatre lancements passent sans une erreur : 20 inscriptions sur 20 menées au bout, **la dernière revenue entre 24,4 et 27,6 s**, la médiane de l'inscription directe entre 9,2 et 14,9 s (le temps d'attente est celui du cœur unique qui hache vingt mots de passe et sème vingt plans de comptes à la suite). Le serveur B (21,2 s, un seul lancement) et le serveur C (24 à 28 s) ne se distinguent pas de manière établie : l'écart de 15 à 30 % est du même ordre que la dispersion entre les lancements de C (environ 6 % sur la dernière réponse, 30 % sur la médiane), et je ne lui attribue aucune cause.

**Flux régulier** (profil `inscriptions`, paliers de 60 s montant à 30, 60, 120, 180 puis 300 inscriptions par minute) :

| t (s) | sondes | /health p50 ms | max ms | erreurs ou délais > 5 s |
|---:|---:|---:|---:|---:|
| 0 | 30 | 8,0 | 270 | 0 |
| 60 | 30 | 49,5 | 488 | 0 |
| 120 | 27 | 829 | 5 779 | 0 |
| 180 | 26 | 4 625 | 9 963 | 0 |
| 240 | 27 | 9 167 | 11 914 | 2 |
| 300 | 34 | 8 680 | 19 717 | 9 |
| 360 | 30 | 3,0 | 806 | 0 |

Lecture : un cabinet qui s'inscrit demande à lui seul de l'ordre d'une seconde de cœur (hachage bcrypt à 12 tours, plusieurs centaines de comptes semés, journalisation d'audit dans la transaction, puis une connexion qui hache encore ; 0,7 à 0,9 s d'inscription et 0,3 s de connexion mesurées seules). Un cœur suit donc jusqu'à **environ 2 inscriptions par seconde** (120 par minute) sans erreur, mais la santé du service se dégrade avant : à 60 par minute elle est intacte (p50 de `/health` : 50 ms), entre 60 et 120 par minute elle passe à 0,8 s ; au-delà de 120 par minute, `/health` monte à 4,6 s puis 9 s et **les 500 apparaissent** : 125 inscriptions refusées (84 inscriptions directes et 41 essais), le journal du serveur y lisant des délais d'attente du pool.

### 3.7 Avant et après les correctifs

Deux défauts ont été corrigés pendant la mission et mesurés dans cette section (4.1 et 4.2) ; le troisième (4.3) l'est en 3.12. Trois états du serveur :

- **A** : l'état initial (`main`) ;
- **B** : correctif 1 seul (la pré-image du journal d'audit se lit par la connexion de la transaction) ;
- **C** : correctifs 1 et 2 (le maillon précédent du journal d'audit se lit par l'index du dossier). C'est le serveur de tous les essais de ce document, sauf le dernier de 3.12 ; le troisième correctif (4.3) est venu ensuite et n'a été rejoué qu'à cet endroit.

**Comparaison contrôlée** (même base, même machine, dix inscriptions simultanées de dix cabinets) :

| Serveur | Résultat de 10 inscriptions simultanées |
|---|---|
| A (état initial) | 4 réussies, **6 en erreur 500 au bout de 32 s** |
| B | 10 réussies en 4,6 à 4,8 s |
| B, 20 simultanées | 20 réussies en 6,5 à 10,4 s |

**Comparaison sur les essais de palier** (réserve : la série A a tourné sur une base qui contenait déjà 250 à 790 cabinets et leurs événements d'audit ; B et C sur une base neuve. L'écart mêle donc le correctif et la taille de la base. Les comparaisons contrôlées sont celles du paragraphe précédent et de la section 3.9) :

| Essai | req/s | écritures/s | 1ers refus 409 | refus après reprise | 5xx | p50 ms | p95 ms | p99 ms | CPU serveur moy / max % | RSS max Mo | connexions base max | cabinets menés au bout |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| A · 10 | 14,3 | 4,3 | 173 | 37 | 0 | 245 | 1 542 | 2 900 | 66 / 96 | 343 | 15 | 25 |
| B · 10 | 16,2 | 4,9 | 171 | 47 | 0 | 83,7 | 1 048 | 2 007 | 61 / 100 | 340 | 11 | 37 |
| C · 10 | 17,8 | 5,6 | 24 | 2 | 0 | 128 | 930 | 1 803 | 63 / 100 | 338 | 11 | 42 |
| A · 20 | 17,2 | 4,5 | 629 | 248 | 0 | 570 | 2 155 | 4 556 | 80 / 99 | 361 | 17 | 36 |
| B · 20 | 19,0 | 4,8 | 747 | 321 | 0 | 332 | 1 855 | 3 809 | 78 / 100 | 353 | 11 | 40 |
| C · 20 | 19,6 | 6,1 | 89 | 21 | 0 | 319 | 1 783 | 3 042 | 67 / 100 | 354 | 11 | 46 |
| A · 40 | 14,8 | 4,7 | 805 | 370 | 6 | 2 038 | 3 966 | 9 555 | 78 / 100 | 343 | 17 | 0 |
| C · 40 | 17,4 | 5,4 | 7 | 1 | 1 | 767 | 4 208 | 12 123 | 63 / 100 | 467 | 11 | 41 |

À lire : sans les correctifs, 10 cabinets simultanés donnaient déjà 173 premiers refus 409 (10 % des gestes d'écriture) et 37 refus après reprise ; 20 cabinets, 629 premiers refus (23 %) et 248 après reprise ; 40 cabinets, 6 réponses 5xx et plus aucun tour mené au bout ; 120 cabinets, 112 réponses 5xx et un p99 de 47 s. Le correctif 1 seul (B) ne change pas la part des refus (7 % à 10 cabinets, 25 % à 20) ; c'est le correctif 2 qui la ramène à **0,9 % à 10 cabinets et 3,1 % à 20** (1,4 % au nominal), à des tailles de base comparables (B : 0 à 38 dossiers au départ, C : 0 à 75). Avec les correctifs, 40 cabinets mènent 41 tours au bout.

### 3.8 Quand la base est à huit millisecondes

Neon n'est pas dans le même conteneur. Un petit relais TCP (`lat.mjs`) a ajouté 4 ms à chaque sens entre le serveur et la base (8 ms d'aller-retour) ; c'est une valeur de travail, `docs/temps-de-chargement.md` rappelle que la région de la base Neon n'est pas connue d'ici. Serveur C, même scénario.

| Étape | base locale p50 ms | 8 ms p50 ms | facteur |
|---|---:|---:|---:|
| inscription | 699 | 2 562 | ×4 |
| plan_retenu | 220 | 954 | ×4 |
| saisie_ecriture | 28,8 | 327 | ×11 |
| valider | 19,7 | 538 | ×27 |
| lettrer | 21,4 | 282 | ×13 |
| bilan | 78,3 | 507 | ×6 |
| notes | 94,4 | 712 | ×8 |
| controles | 152 | 3 120 | ×20 |
| export_journal | 120 | 1 609 | ×13 |
| export_liasse | 973 | 2 796 | ×3 |

| Essai | req/s | écritures/s | 1ers refus 409 | refus après reprise | 5xx | p50 ms | p95 ms | p99 ms | CPU serveur moy / max % | RSS max Mo | connexions base max | cabinets menés au bout |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 10 cabinets, base locale | 17,8 | 5,6 | 24 | 2 | 0 | 128 | 930 | 1 803 | 63 / 100 | 338 | 11 | 42 |
| 10 cabinets, 8 ms de latence | 8,6 | 2,6 | 28 | 4 | 0 | 383 | 1 718 | 4 363 | 39 / 99 | 356 | 10 | 20 |

Lecture : **le coût d'une requête est dominé par le nombre d'allers-retours vers la base**, pas par le calcul. Seul, une saisie d'écriture passe de 29 ms à 327 ms (environ 37 allers-retours enchaînés), les contrôles de 152 ms à 3,1 s, la liste des comptes retenus de 0,22 s à 0,95 s. Sous charge le serveur n'est plus à 100 % (39 % en moyenne) : il attend la base, et le débit tombe de 17,8 à 8,6 requêtes par seconde pour le même nombre de cabinets. L'explication la plus simple est que chaque transaction interactive garde sa connexion du pool pendant tous ses allers-retours ; je ne l'ai pas vérifié (les connexions « en transaction » ne sont pas relevées). **Plus la base est loin, moins un cœur et dix connexions servent de cabinets.** La rafale de 10 inscriptions passe sans erreur à cette latence (10 menées au bout, la dernière revenue en 11,6 s).

### 3.9 Une grosse table d'audit

Chaque écriture auditée lisait le dernier maillon du dossier par un balayage de toute la table des événements. Pour mesurer ce que cela devient avec le temps, 1,1 million d'événements d'audit synthétiques (insérés directement en base, répartis sur les 836 dossiers du banc) ont été ajoutés ; une inscription seule, puis dix simultanées :

| Serveur | 1 inscription seule | 10 inscriptions simultanées |
|---|---|---|
| B (balayage de la table) | 2,5 à 4,6 s | **24,8 à 26,8 s** |
| C (lecture par l'index du dossier) | 0,6 à 0,8 s | **5,3 à 5,8 s** |

Et le plan d'exécution de la requête, sur 50 584 événements : balayage séquentiel de la table, **12,2 ms**, contre lecture d'index, **0,35 ms** (l'écriture `IS NOT DISTINCT FROM` de la requête d'origine ne peut pas utiliser l'index). Sans le correctif, **chaque cabinet inscrit alourdissait toutes les écritures de tous les autres**.

### 3.10 Limitation de débit par adresse

Avec `IP=unique` (tous les cabinets virtuels partagent une seule adresse, comme derrière un même NAT) la limite de 300 requêtes par minute et par adresse, et celle de 30 inscriptions par heure, coupent la charge avant le serveur : 581 refus « trop de tentatives depuis cette adresse » sur 2 687 requêtes. C'est voulu, et c'est pourquoi tous les autres essais simulent une adresse par cabinet. À retenir pour le public : plusieurs personnes derrière une même adresse (réseau d'opérateur mobile, cybercafé, université) partagent ces plafonds (voir 4.9).

### 3.11 Endurance

Profil `palier` à 10 cabinets simultanés, `THINK=1`, **15 minutes** de palier (base neuve, serveur neuf, 30 s de montée avant, deux minutes de fin après), mélange SYCEBNL et SYSCOHADA, 30 % d'essais publics. Le but : voir si la mémoire, les connexions ou les temps de réponse dérivent.

| Mesure | Valeur |
|---|---|
| Requêtes | 23 009 (21,8 par seconde) |
| Cabinets menés au bout | 181 (de l'inscription à la liasse) |
| Écritures saisies | 7 240 (6,9 par seconde) |
| Réponses 5xx | **0** |
| Premiers refus 409 / refus après reprise | 104 / 15 |
| « Lettrage incomplet » (lettrage refusé après reprise) | 3 |
| Fuites entre dossiers, balances fausses | **0**, **0** |
| Durée de la requête p50 / p95 / p99 / max | 151 ms / 1 168 ms / 2 989 ms / 11,6 s |
| Durée d'un tour complet p50 / p95 | 52,2 s / 62,3 s |
| Processeur du serveur pendant la charge | 92 à 95 % (cœur quasi plein), 101 % au maximum |
| Connexions à la base | 10 à 11 (16 dans la dernière tranche, pendant l'arrêt des cabinets virtuels) |

Évolution par tranche de trois minutes :

| Tranche (min depuis le départ) | RSS moyen Mo | RSS pic Mo | CPU serveur moyen % | connexions base max | /health p50 ms | /health max ms |
|---:|---:|---:|---:|---:|---:|---:|
| 0 à 3 | 294 | 326 | 92 | 10 | 26,0 | 2 392 |
| 3 à 6 | 328 | 345 | 95 | 11 | 29,0 | 1 336 |
| 6 à 9 | 348 | 373 | 95 | 11 | 45,0 | 943 |
| 9 à 12 | 357 | 373 | 95 | 11 | 53,5 | 1 394 |
| 12 à 15 | 361 | 379 | 94 | 11 | 45,0 | 822 |
| 15 à 18 | 354 | 382 | 35 | 16 | 10,0 | 964 |

Lecture :

- **Pas de dérive de latence** : la sonde `/health` reste entre 26 et 54 ms au p50 sur quinze minutes et le p99 de la requête ne dépasse pas 3 s.
- **Mémoire** : la mémoire résidente monte vite en début d'essai (294 Mo en moyenne dans les trois premières minutes, 328, 348, 357 puis 361 Mo) : la croissance par tranche décroît (+34, +20, +9, +4 Mo) et le pic reste à 382 Mo, sous le plafond du tas de 460 Mio ; en fin de charge, la mémoire résidente retombe à 289 Mo. C'est l'allure d'un plateau (le ramasse-miettes qui se cale), pas celle d'une fuite linéaire. **Quinze minutes ne permettent pas d'exclure une fuite lente** (moins d'un mégaoctet par minute resterait invisible) : un essai de plusieurs heures reste à faire.
- **Connexions** : stables à 10 ou 11 (le pool) ; en moyenne 0,6 connexion en état `active` sur 10 (14 au plus, brièvement) pendant que le cœur du serveur est à 95 % : à ce rythme, **c'est le cœur de Node qui est plein, la base attend**.
- **Coût d'un cabinet** : 824 secondes de cœur serveur pour 181 cabinets menés au bout, soit **environ 4,6 s de cœur par tour complet** (borne haute : elle compte aussi les tours entamés) et **36 ms de cœur par requête en moyenne**, bcrypt compris. Un cœur plein sert donc au mieux de l'ordre de **13 tours complets par minute**, ce qui correspond au débit observé (0,17 par seconde).

### 3.12 Une base qui a grossi

Le palier de 20 cabinets (150 s, `THINK=1`) rejoué sur des bases de plus en plus grosses : la base neuve (0 dossier), celle de la série C au fil de son usage (75 puis 483, 524 et 568 dossiers, soit environ 560 000 à 740 000 comptes, 390 Mo). La dernière ligne est rejouée avec le correctif de 4.3.

| Essai | dossiers déjà dans la base | code | req/s | p50 ms | p95 ms | p99 ms | saisie p50 ms | connexions « actives » (moyenne sur 10) | charge de la machine | 1ers refus 409 (part des gestes) | cabinets menés au bout |
|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| C_palier20bis | 0 | avant le correctif des collectifs | 17,4 | 329 | 1 947 | 4 549 | 347 | 0,2 | 1,9 | 188 (7,3 %) | 40 |
| C_palier20 | 75 | avant le correctif des collectifs | 19,6 | 319 | 1 783 | 3 042 | 447 | 0,5 | 2,2 | 89 (3,1 %) | 46 |
| C_palier20gros | 483 | avant le correctif des collectifs | 16,5 | 608 | 2 900 | 9 126 | 1 339 | 5,2 | 7,7 | 0 (0,0 %) | 29 |
| C_palier20gros2 | 524 | avant le correctif des collectifs | 16,3 | 569 | 2 501 | 5 385 | 1 401 | 5,8 | 7,3 | 0 (0,0 %) | 39 |
| C_palier20gros3 | 568 | **après** le correctif des collectifs | 17,9 | 331 | 2 015 | 5 697 | 385 | 0,4 | 2,4 | 0 (0,0 %) | 43 |

Trois lectures, de la plus solide à la moins solide.

1. **Le coût d'une saisie grandissait avec le nombre de cabinets** (4.3). Sur les deux lancements à 483 et 524 dossiers, avant le correctif, le p50 passe de 0,32 à 0,57 à 0,61 s, la saisie d'une écriture de 0,35 à 1,3 à 1,4 s, la charge moyenne de la machine de 2 à plus de 7, et le nombre de connexions « actives » de 0,2 à 5,5 sur 10. Après le correctif, sur 568 dossiers : p50 331 ms, saisie 385 ms, charge 2,4, connexions actives 0,4 : on retrouve les valeurs de la base neuve. Les trois lancements sur grosse base sont concordants, le troisième est le seul à porter le correctif.
2. **Les conflits de sérialisation ont disparu sur les grosses bases** : 0 premier refus 409 sur 2 400, 2 340 et 2 580 gestes d'écriture, contre 3,1 % et 7,3 % sur les bases de 0 à 75 dossiers, et 1,4 % au nominal. Les deux essais antérieurs (pic à 421 dossiers, pointe à 251 dossiers) n'en montraient pas non plus. C'est compatible avec l'explication de 4.4 (des prédicats lus par page : plus la table a de pages, moins deux cabinets sans rapport en partagent), **mais** les profils diffèrent d'un lancement à l'autre et le taux varie déjà d'un facteur cinq entre trois lancements sur base neuve ; je ne tire pas de loi, je dis que les bases de 250 dossiers et plus n'ont montré aucun conflit sur cinq essais.
3. **Le plafond de connexions** : 17 connexions comptées sur les deux premiers lancements à grosse base, 11 sur le troisième. Les connexions en excédent de 4.10 accompagnaient donc, au moins en partie, des requêtes lentes.

Réserve : le profil des deux premiers lancements à grosse base ne dit pas ce qui dans PostgreSQL a ralenti avant que je relève les requêtes ; c'est la lecture du journal de PostgreSQL pendant un tour de cabinet sur cette base qui a désigné la requête de 4.3. D'autres lectures entre cabinets existent dans la même base (`pg_stat_user_tables` : `lignes_ecriture` 6 866 balayages séquentiels pour 99,9 millions de lignes lues, `journaux` 27 614 balayages pour 23,3 millions) ; je n'ai pas relevé les requêtes en cause, elles sont à chercher avec la même méthode.

### 3.13 Mémoire

| Essai | RSS maximal (Mo) |
|---|---:|
| 5 à 20 cabinets | 338 à 354 |
| 40 cabinets | **467** |
| 80 cabinets | 410 |
| stress (pointe 150) | **465** |
| inscriptions en flux (jusqu'à 300 par minute) | 426 |
| rafale de 20 inscriptions | 313 |

Le tas est borné à 460 Mio par le lancement ; la mémoire résidente (tas, tampons, code) atteint **467 Mo** à 40 cabinets et **465 Mo** pendant la pointe, c'est-à-dire presque exactement le plafond d'un conteneur Cloud Run de 512 Mio. Aucun arrêt par manque de mémoire n'a été observé ici (ce banc n'impose aucune limite de conteneur : on ne sait pas ce que Cloud Run aurait fait de 467 Mo). La marge est de l'ordre de 45 Mo. Voir la section 7.

### 3.14 Cloisonnement et bouclage

Sur l'ensemble des 42 lancements : 15 296 sondes de cloisonnement lancées par les 1 316 cabinets menés au bout, dont 14 565 refusées net (4xx) ; **aucune fuite entre dossiers** (0 `fuites_entre_dossiers`), le dossier sentinelle est resté **intact** à l'épilogue de chacun des 42 lancements ; **aucune balance fausse**, aucun bilan déséquilibré, aucune validation partielle, aucun export illisible. Les sondes non refusées par un 4xx : jusqu'à la dernière série, une sonde par cabinet portait sur `GET /immobilisations/tableau?exerciceId=<sentinelle>`, route qui ne lit aucun exercice et rend le registre du cabinet qui l'appelle (un 200 y est normal et ne prouve rien : elle est retirée du script, les derniers essais ne la comportent plus) ; les autres sont des coupures sous saturation. Le test lit le corps de chaque réponse pour y chercher le marqueur et l'identifiant de la sentinelle, et n'en a jamais trouvé.

Les « incohérences comptables » comptées par k6 dans certains essais (série B : B_palier10 : 13, B_palier20 : 35 ; série C : C_nominal : 4, C_palier20 : 1, C_palier20bis : 15 ; série latence 8 ms : D_palier10 : 1 ; série endurance : S_soak : 3 ; série A : ipunique : 9, nominal : 79, palier10 : 10, palier20 : 33, palier40 : 36, palier5 : 1, pic : 18, stress : 2) ne sont **pas** des balances fausses : toutes sont des « lettrage incomplet », c'est-à-dire un lettrage refusé par un conflit de sérialisation après la reprise, laissant des lignes ouvertes. Un lettrage manquant n'est pas un montant faux ; c'est un geste juste refusé sans issue automatique (voir 4.4).

---

## 4. Ce que le test a trouvé

Classement selon CLAUDE.md : **BLOQUANT** (montant faussé en silence, geste juste refusé sans issue, dossier enfermé, fuite entre dossiers), **MAJEUR**, **MINEUR**. Aucun BLOQUANT n'a été trouvé. Les défauts 4.1, 4.2 et 4.3 sont corrigés et gelés par des tests ; le reste est consigné.

### 4.1 [MAJEUR · corrigé] Dix transactions auditées simultanées bloquaient tout le pool

*Symptôme.* Dix inscriptions simultanées : quatre réussissent, six répondent 500 après 32 s. Une seule inscription avec un pool de une connexion : 500 après 30 s.

*Cause.* L'extension d'audit lisait la « pré-image » d'une ligne avant de la modifier ou de la supprimer par `base`, c'est-à-dire par une SECONDE connexion du pool, alors que la transaction en cours en tenait déjà une (`src/common/audit/extension-audit.ts`). Dix transactions simultanées tenaient les dix connexions et attendaient chacune une onzième : l'interblocage dure jusqu'au délai du pool (10 s), puis jusqu'au délai de transaction. C'est l'inverse exact de ce que CLAUDE.md § 8 (`transactionJournalisee`) veut éviter pour le maillon d'audit.

*Correctif.* La pré-image se lit par la transaction en cours (`transactionAuditee() ?? base`), hors transaction elle reste lue par `base`. Gelé par deux tests de `journal-audit.spec.ts` (lecture par la transaction, lecture hors transaction par `base`).

*Après correctif.* 10 inscriptions simultanées : 10 réussies en 4,6 à 4,8 s ; 20 : 20 réussies en 6,5 à 10,4 s. Preuve par construction sur le serveur C : avec un pool d'**une seule connexion** (`connection_limit=1`), une inscription passe en **0,8 s** (201). Sur le code initial (A) le même essai donnait un 500 après 30 s, le temps du délai du pool : la transaction tenait l'unique connexion et en réclamait une seconde.

*Pourquoi MAJEUR.* L'effet est un 500 propre sur le geste, sans donnée faussée, et un nouvel essai réussit. Mais le même schéma gèle le service entier pendant des dizaines de secondes dès que dix écritures auditées s'enchevêtrent sur une instance, soit bien en dessous de la concurrence de 80 que le workflow autorise. Il aurait frappé l'ouverture publique de l'essai.

### 4.2 [MAJEUR · corrigé] Le maillon précédent du journal d'audit se lisait par un balayage de toute la table

*Symptôme.* Le coût d'une écriture auditée grandit avec le nombre de cabinets inscrits (sur 1,1 million d'événements d'audit, une inscription seule dure 2,5 à 4,6 s avant correctif, 0,6 à 0,8 s après) ; et des cabinets sans aucun rapport se voient refuser des écritures avec « trop d'écritures enregistrées au même instant » (409) : 23 à 25 % des gestes d'écriture à 20 cabinets avant ce correctif.

*Cause.* `ecrireMaillon` lit le dernier maillon du dossier par `WHERE "tenantId" IS NOT DISTINCT FROM … ORDER BY rang DESC LIMIT 1`. Cette écriture ne peut pas utiliser l'index `(tenantId, rang)` : PostgreSQL balaie toute la table. Sous l'isolation SERIALIZABLE, un balayage séquentiel prend un **verrou de prédicat sur la relation entière** (vérifié dans `pg_locks`, `SIReadLock` de niveau relation sur `evenements_audit`) : toute transaction qui écrit un maillon, pour n'importe quel dossier, entre en conflit de sérialisation avec les autres.

*Correctif.* Lecture par `"tenantId" = $1::text` (index) pour un dossier, `IS NULL` pour la chaîne sans dossier, avec la raison écrite en commentaire. Gelé par deux tests de `journal-audit.spec.ts` (la requête est celle de l'index, sans `IS NOT DISTINCT FROM`, avec et sans dossier).

*Après correctif.* Plan d'exécution : 12,2 ms contre 0,35 ms sur 50 584 événements ; 1,1 million d'événements : 10 inscriptions simultanées de 24,8 à 26,8 s contre 5,3 à 5,8 s ; à 20 cabinets, la part des gestes d'écriture refusés une première fois passe de 25 % (747 sur 3 030, état B) à 3,1 % (89 sur 2 849, état C) et à 1,4 % au nominal (73 sur 5 293), sur des essais de même durée et de même profil, et sur des bases de taille comparable.

*Pourquoi MAJEUR.* La dégradation est silencieuse et proportionnelle à l'âge du service : chaque cabinet inscrit alourdit les écritures de tous.

### 4.3 [MAJEUR · corrigé] La saisie lisait la table des comptes de tous les cabinets

*Symptôme.* Le service ralentit à mesure que des cabinets s'inscrivent, sans que le volume d'aucun d'eux grossisse. Sur la base grossie (483 puis 524 dossiers, 737 000 comptes), le palier de 20 cabinets donne un p50 de 608 et 569 ms contre 319 et 329 ms sur base neuve, la saisie d'une écriture 1,3 à 1,4 s contre 0,35 à 0,45 s, et PostgreSQL passe de 0,2 à 5,5 connexions « actives » sur 10 en moyenne. Un seul cabinet qui travaille seul y fait exécuter 43 fois la même requête, 127 ms en moyenne (842 ms à froid) : 5,5 s de PostgreSQL sur les 7,7 s du tour.

*Cause.* `EcritureService.verifierComptesCollectifs` cherche à chaque saisie les comptes de la pièce qui sont des collectifs portant des comptes de tiers, par `individuels: { some: {} }`. Prisma traduit ce filtre en `id IN (SELECT collectifId FROM comptes WHERE collectifId IS NOT NULL)`, **sans borne de dossier** et sur une colonne **sans index** (`comptes.collectifId`) : PostgreSQL lit la table entière, celle de tous les cabinets (`EXPLAIN` : balayage parallèle, 33 000 pages lues, 280 ms pour 737 000 comptes ; le compteur du banc disait 62 302 balayages séquentiels de `comptes` pour 10,8 milliards de lignes lues). C'est le travers que le cloisonnement devait interdire, et il passe parce que la borne est dans la requête englobante, pas dans la sous-requête. Le coût est proportionnel au nombre total de comptes : il aurait grossi avec chaque cabinet inscrit, et aucun banc à un cabinet ni aucune base neuve ne le montre.

*Correctif.* Le sous-filtre porte le dossier (`individuels: { some: { tenantId, … } }`, `src/modules/comptabilite/ecriture.service.ts`) : la sous-requête se lit par l'index `(tenantId, numero)`, au plus les comptes du dossier. Résultat identique, puisque les individuels d'un collectif sont toujours du dossier du collectif. `EXPLAIN` après : 98 pages lues et 9 ms, quel que soit le nombre de cabinets. Gelé par deux tests de `compte-collectif-saisie.spec.ts` (le filtre envoyé porte `tenantId`, avec et sans compte qui s'endort).

*Après correctif.* Palier de 20 cabinets sur 568 dossiers : p50 331 ms (569 à 608 avant), saisie 385 ms (1,3 à 1,4 s avant), connexions actives 0,4 (5,2 à 5,8 avant), charge de la machine 2,4 (7,3 à 7,7 avant), 43 cabinets menés au bout (29 et 39 avant) ; voir 3.12.

*Non fait.* Un index sur `comptes.collectifId` : créé à la main sur la base d'essai, il ramène la requête d'origine de 280 à 3,3 ms. Ce serait une défense en profondeur, mais c'est une migration sur la table des comptes de la production (verrou à la création, vérification de dérive sur base jetable) : à décider par Manasse, non lancée.

*Pourquoi MAJEUR.* Aucun montant n'est faux. Mais la dégradation est sans borne avec le nombre de cabinets, ne se voit qu'avec le public réel, et frappe chaque saisie de chaque cabinet.

### 4.4 [MAJEUR · NON corrigé] Conflits de sérialisation résiduels sur la saisie et le lettrage

*Symptôme.* À 20 cabinets, de 1,4 % (73 sur 5 293 gestes d'écriture, nominal) à 3,1 % (89 sur 2 849, palier de 20) des gestes reçoivent un premier refus « Trop d'écritures enregistrées au même instant » ou « Trop de lettrages effectués au même instant », et 0,4 à 0,7 % le gardent après une reprise (22 et 21 gestes). Le message dit « veuillez réessayer » ; je n'ai trouvé aucune reprise automatique dans l'interface (`client/src/`), donc c'est à l'utilisateur de recommencer. Un lettrage refusé laisse des lignes ouvertes.

*Cause.* Le serveur essaie cinq fois (`avecRetrySerialisable`, délais de 20 à 100 ms) puis rend 409. Les conflits qui restent sont des conflits de prédicats SIREAD **au niveau page** des index et tables partagés par tous les dossiers (`comptes_pkey`, `ecritures_pkey`, `lignes_ecriture`, relevés dans `pg_locks` sur le serveur d'origine ; sur le serveur C, le journal de PostgreSQL attribue ses 2 547 échecs de sérialisation de la série C surtout à la mise à jour des lignes lors du lettrage (1 015), à l'insertion du lettrage (524), au COMMIT (416) et à l'insertion d'un maillon d'audit (255), la plupart absorbés par les cinq tentatives du serveur) : deux cabinets sans rapport s'écrivent sur les mêmes pages, PostgreSQL ne sait pas qu'ils ne se lisent pas. Ils croissent avec le nombre de transactions d'écriture qui se chevauchent.

*Ce qui est établi, et ce qui ne l'est pas.* Le taux varie d'un facteur cinq entre trois lancements de même profil sur base neuve (1,4 %, 3,1 %, 7,3 %), et il est nul sur les cinq essais commencés avec 250 dossiers ou plus (3.12). La lecture « les faux conflits par page se raréfient quand la table a plus de pages » est compatible avec cela, elle n'est pas démontrée. Sur la production, avec des tables bien plus grosses, le problème sera probablement plus petit que sur ce banc ; à vérifier en préproduction sur une base de taille réelle.

*Pourquoi non corrigé.* Les remèdes (index par dossier couvrant les lectures du lettrage et de la saisie, `FILLFACTOR`, `max_pred_locks_per_page`, passage de certaines transactions à REPEATABLE READ) touchent l'isolation des écritures comptables ; ce n'est ni petit, ni sûr à faire sans les relire à la lumière de CLAUDE.md § 10 bis. À traiter en ligne dédiée, avec un scénario sur vraie base à travers une clôture.

### 4.5 [MAJEUR · NON corrigé] Sous saturation, des erreurs 500 et des maillons d'audit manquants

*Symptôme.* À 20 cabinets, un 500 isolé dans un des trois lancements ; à 40 cabinets simultanés les 5xx s'installent (1) ; à 80, 13 ; à 150, 194. Le journal du serveur contient alors « Maillon d'audit NON écrit » (30 fois à 80 cabinets, 85 en pointe, 118 pendant le flux d'inscriptions à 300 par minute) et « Maillon de connexion non écrit ».

*Cause.* Trois délais de Prisma, dans cet ordre de fréquence : l'attente d'une connexion du pool (« Timed out fetching a new connection from the connection pool », 10 s : 179 des 182 erreurs 500 de la pointe), l'attente du début d'une transaction (2 s par défaut : 3), et la durée maximale d'une transaction interactive (5 s par défaut : un 500 sur la création d'un tiers au second palier de 20 cabinets, « Transaction already closed… 5005 ms passed »). Ils font échouer la transaction ou, quand l'échec survient après l'acte, l'écriture du maillon. CLAUDE.md § 5 prévoit que l'absence d'un maillon d'audit ne fait pas échouer la requête, et le journal du serveur le consigne : c'est le comportement voulu, mais cela veut dire **qu'un acte peut être fait sans que sa trace soit au journal d'audit** quand le service est saturé.

*Pourquoi MAJEUR et non BLOQUANT.* Aucun montant n'est faux ; la chaîne d'audit, elle, a des trous. Le remède est de ne pas laisser le service atteindre cette zone (concurrence, instances, section 7), pas de changer le comportement du maillon.

### 4.6 [MINEUR · NON corrigé] Le hachage du mot de passe tient le cœur

Une connexion dure 0,28 à 0,36 s seule et une inscription 0,7 à 0,9 s (bcryptjs, pur JavaScript, 12 tours, auxquels l'inscription ajoute le semis du plan de comptes), le tout sur le cœur unique du serveur. À 20 inscriptions simultanées sur un cœur, la dernière attend 26 s, et les autres requêtes de l'instance ralentissent (p50 de `/auth/me` à 0,4 s). Aucun remède sans nouvelle dépendance (le paquet natif `bcrypt` ou un fil de travail) ; consigné.

### 4.7 [MINEUR · NON corrigé] Les éléments d'entrée de tout cabinet coûtent des centaines de millisecondes

`GET /comptes?retenus=true` (la liste des comptes que chaque écran de choix appelle) prend 0,22 s seul contre 0,05 s pour le plan complet, 2,4 s à 20 cabinets (nominal). Les `contrôles` : 0,15 s seul, 1,8 s à 20 cabinets, 3,1 s seul avec 8 ms de latence base. Le coût vient du nombre de lectures enchaînées (CLAUDE.md § 6 sur `comptesUtilises` : l'usage de chaque compte se lit par regroupement en base). Cause probable, non isolée par une mesure dédiée.

### 4.8 [MINEUR · NON corrigé] Le dépôt versionne `node_modules` et `dist`

Le dépôt suit `node_modules/` et `dist/` : chaque `npm run build` modifie 151 fichiers suivis, et un lien symbolique posé dans `node_modules` pour accélérer un banc a créé des chemins parasites qui ont fait échouer 26 tests (des `instanceof` de classes chargées deux fois). Un fichier `.gitignore` plus strict est à envisager ; consigné pour Manasse.

### 4.9 [MINEUR · NON corrigé] Les plafonds par adresse

Trois plafonds s'appliquent par adresse IP et par instance (aucun stockage partagé n'est configuré dans `app.module.ts` : le compteur est celui du processus, non partagé entre instances) : 300 requêtes par minute, 30 inscriptions par heure, 5 essais par heure. Derrière une adresse partagée (très répandu sur les réseaux mobiles), des utilisateurs sans rapport se partagent ces plafonds. Le test a mesuré le refus (581), pas la fréquence de cette situation à Kinshasa, qui n'est pas connue d'ici.

### 4.10 [MINEUR · NON corrigé] Plus de connexions ouvertes que le plafond annoncé

PostgreSQL a compté de 16 à 18 connexions pour une instance au pool de 10 (80 cabinets : 17, pointe : 16, débit brut : 18), contre 10 à 11 hors saturation. Sur la base grossie, 17 avant le correctif de 4.3 et 11 après : l'excédent accompagne au moins en partie des requêtes lentes. Le service n'a qu'un client Prisma (`PrismaService`, dont les extensions partagent le pool) : la cause n'est pas établie. Hypothèse, non vérifiée : quand une connexion tarde, Prisma en ouvre une neuve avant que PostgreSQL ait retiré l'ancienne. Conséquence pratique : le budget de connexions de `docs/connexions-et-plafonds.md` (4 instances × 10 = 40) est un plancher ; en compter jusqu'à 18 par instance en direct.

### 4.11 [MINEUR · NON corrigé] Deux autres extensions lisent par une seconde connexion à l'intérieur d'une transaction

Même schéma que 4.1, dans deux gardes qui lisent par `base` (le client sans extension, donc une autre connexion du pool) au lieu de la transaction en cours : `src/common/cloisonnement/extension-cloisonnement.ts` (ligne 321, relecture du propriétaire d'une ligne avant une écriture unitaire dont le filtre ne porte pas le dossier) et `src/common/perimetre/extension-perimetre-journaux.ts` (lignes 92, 106 et 148, relecture du journal d'une écriture visée, pour les seuls utilisateurs à journaux restreints). Le scénario ne les atteint pas (cabinets administrateurs, écritures dont le filtre porte le dossier) : **aucune mesure ne les a déclenchés**, ce n'est qu'une lecture du code. Non corrigé : ce sont des gardes de sécurité (cloisonnement, périmètre), le correctif (`transactionAuditee() ?? base`, comme en 4.1) demande son propre scénario sur vraie base avec un utilisateur à journaux restreints, que je n'ai pas joué.

---

### 4.12 Relecture avant l'intégration (2026-10-21)

Deux relectures (échecs silencieux, TypeScript), sans BLOQUANT.

- **MAJEUR, introduit par le correctif 4.1, corrigé.** Lue dans la transaction, une pré-image dont la lecture échoue côté base invalide toute la transaction PostgreSQL ; le `catch` l'avalait, l'opération partait sur une transaction morte (« current transaction is aborted »), et un conflit de sérialisation que la reprise aurait rejoué devenait un 500 au motif trompeur. Désormais, dans une transaction, l'échec remonte tel quel (la reprise le reconnaît) ; seule l'erreur de VALIDATION du client Prisma, qui naît avant tout envoi et laisse la transaction saine, se rattrape (clé composée qu'un `findFirst` ne relit pas, `tenantId_nature`). Hors transaction, l'échec est consigné au journal du serveur et l'événement part sans pré-image. Deux tests le gèlent.
- **MINEUR, antérieur à la ligne, en partie corrigé.** La relecture des journaux du serveur, une fois l'échec consigné, a montré sa cause la plus fréquente · les `upsert` du semis visent une clé composée (`tenantId_code`) qu'un `findFirst` refuse, trente-deux fois par création de dossier. La clé se déplie désormais d'après le schéma (`filtrePreImage`), et le scénario sur vraie base ne laisse plus aucun avertissement. Reste qu'une pré-image absente se range vide, et deux lecteurs la prennent pour « rien avant » (`fiche-immobilisation.service.ts`, la clôture d'un exercice ; `taux-tva.service.ts`, la suppression d'un lettrage qui rend une reconstitution incertaine). Marquer le maillon « pré-image illisible » et relire une clé composée par `findUnique` est une ligne à part.
- **MINEUR, à mesurer.** Deux sous-filtres `some: {}` sans borne du dossier, jumeaux possibles de 4.3 · `reprise-subvention.service.ts` (`subventions`) et `controles.service.ts` (`journauxTresorerie`). Hors des chemins de saisie, coût non mesuré.

## 5. Ce que coûte un cabinet

Chiffres tirés de l'essai d'endurance (3.11), les seuls où le processeur a été mesuré sur une durée longue et stable :

- **4,6 s de cœur serveur par cabinet mené au bout** (824 s de cœur pour 181 tours de l'inscription à la liasse, de l'ordre de 130 requêtes chacun) ;
- **36 ms de cœur serveur par requête** en moyenne, bcrypt compris ;
- un cœur plein sert donc au mieux **de l'ordre de 13 tours complets par minute**, ou, pour du public, de l'ordre de **2 inscriptions par seconde** (3.6) ;
- environ **12 Ko de réponse par requête** en moyenne (73 Mo reçus pour 5 928 requêtes au palier de 20, exports Excel compris).

L'isolation SERIALIZABLE de Prisma est ce qui garantit qu'une balance boucle quand deux gestes se croisent, et elle explique les 409 de 4.3 : ce choix n'a pas été remis en cause.

---

## 6. Ce qui n'a pas été mesuré

- **Neon et PgBouncer** : aucune mesure derrière le pooler de Neon (`pgbouncer=true`). Les transactions interactives de Prisma sous PgBouncer en mode transaction n'ont pas été éprouvées ici ; seule une latence simulée de 8 ms l'a été.
- **Cloud Run** : pas de limite de mémoire de conteneur, pas de plafond de processeur de 1 vCPU garanti par le fournisseur (ici un cœur réservé par `taskset` sur un processeur dont la vitesse n'est pas celle d'un vCPU), pas d'autoscaling, pas de démarrage à froid, pas de `--cpu-boost`. Je ne sais pas combien d'instances Cloud Run lancerait pour le même trafic.
- **PostgreSQL 17 et 18** : tout a tourné sur la 16.
- **Un SMTP réel** : le puits répond en quelques millisecondes ; un vrai relais ajoutera une latence à chaque essai public, hors du chemin de calcul.
- **Des exports concurrents plus gros** : le test fait trois exports et la liasse d'un petit dossier (40 pièces) par cabinet. Les gros volumes mesurés par `docs/capacite-mesuree.md` (un million de lignes dans UN dossier) n'ont pas été rejoués avec la charge multi-cabinets.
- **Plusieurs heures d'endurance** : le plus long essai dure quinze minutes (3.11).
- **L'équivalence humaine** : un cabinet virtuel émet environ une requête par seconde. Un comptable réel en émet moins ; combien de comptables « valent » un cabinet virtuel est une hypothèse, pas une mesure.
- **Le test des sauvegardes, des migrations et des clôtures annuelles sous charge** : le scénario ne ferme pas d'exercice.
- **La dispersion d'un lancement à l'autre** : chaque essai n'a été lancé qu'une fois, sauf la rafale de 20 inscriptions et le palier de 20 (voir 3.6 et 3.12).

---

## 7. Recommandations pour Cloud Run

À lire avec les réserves de la section 6. Le workflow ne bouge pas : ce sont des propositions chiffrées à rejouer sur un environnement de préproduction.

Ce que le banc établit : **aux rythmes du script, le goulot d'un cœur est le processeur de Node, pas la base** (pendant le palier de 10 cabinets de l'endurance, le cœur du serveur est à 92 à 95 % alors que la base compte en moyenne 0,6 connexion en état `active` sur 10) ; **au-delà de 40 cabinets, c'est le pool de 10 connexions**, qui fait attendre puis échouer ; **la latence vers la base multiplie** le coût de chaque requête. Les propositions en découlent. Chacune dit la mesure qui la fonde et celle qui manque.

| Réglage | Aujourd'hui | Proposition | Mesure qui la fonde | Ce qui n'est pas mesuré |
|---|---|---|---|---|
| `--concurrency` | 80 | **20 au plus, 10 si l'on veut tenir un p95 sous 2 s** | À 10 requêtes en vol (20 cabinets) : p95 1,8 s. À 22 (40 cabinets) : p95 4,2 s, p99 12 s, premier 5xx. À 72 (80 cabinets) : p95 7,2 s, p99 26 s, 13 5xx, aucun tour terminé. Avec 80, une instance peut entrer dans cet état avant qu'une autre soit démarrée. | Le comportement réel de l'autoscaler de Cloud Run face à ce réglage. |
| `--max-instances` | 4 | **8**, à condition que la base tienne le nombre de connexions (ligne suivante) | Une instance d'un cœur tient de l'ordre de 20 cabinets au rythme du script (p95 1,8 s), soit environ 80 cabinets pour 4 instances et 160 pour 8 ; en inscriptions, environ 2 par seconde et par instance sans erreur, soit 8 par seconde pour 4 instances. Ce calcul suppose que la charge se répartit et que la base ne devient pas le goulot. | Le passage à plusieurs instances (aucune mesure à plus d'une instance), le délai de démarrage d'une instance neuve. |
| Connexions à la base | 4 × 10 = 40 annoncés | **compter jusqu'à 18 par instance** (10 en régime normal) | PostgreSQL a compté de 16 à 18 connexions pour un pool de 10 dans les essais saturés (80 cabinets, pointe, débit brut), 10 à 11 hors saturation. Cause non établie. Avec 8 instances, prévoir jusqu'à 144 connexions en direct ; par l'endpoint poolé de Neon, c'est PgBouncer qui les multiplexe. | Le comportement derrière PgBouncer en mode transaction. |
| Mémoire du conteneur | non posée (512 Mio par défaut de Cloud Run) | **1 Gio, avec le tas fixé explicitement à 460 Mio** (`--max-old-space-size=460`) pour que les plafonds de `docs/capacite-mesuree.md` restent vrais | La mémoire résidente a atteint 467 Mo (40 cabinets) et 465 Mo (pointe), à environ 45 Mo du plafond de 512 Mio. Sans limite de conteneur sur le banc, rien n'a été tué. | Le comportement de Cloud Run à 467 Mo résidents ; ce que fait Node, sans option, d'un conteneur de 1 Gio (son tas par défaut monterait et ferait mentir le document de capacité). |
| vCPU | 1 | **garder 1 et multiplier les instances** | Le cœur de Node est le goulot ; un processus Node n'exécute son JavaScript que sur un fil. | Le gain éventuel d'un deuxième vCPU (ramasse-miettes, hachage hors fil principal) : hypothèse, non mesurée. |
| Pool Prisma | 10 | **garder 10** | Le pool ne limite qu'à partir de 40 cabinets. Le relever ne servirait à rien tant que le cœur est plein, et ferait monter la charge sur la base. | |
| `--min-instances` | 1 | **à décider** pour l'ouverture publique de l'essai | Une rafale de 20 inscriptions simultanées met 26 s à passer sur une instance (hachage, semis du plan). | Le démarrage à froid d'une seconde instance. |
| Région de la base | non connue d'ici | **la même que Cloud Run** | Une inscription fait de l'ordre de 230 allers-retours vers la base, la saisie d'une écriture une quarantaine : à 8 ms d'aller-retour, ×3 à ×27 selon l'étape. | La latence réelle entre Cloud Run et Neon. |

À surveiller en production (le banc montre que c'est là que la saturation se voit d'abord) :

- le temps de réponse de `/health` : 8 ms au repos, 1 à 24 s pendant la pointe ; la sonde du workflow `surveillance.yml` tourne toutes les quinze minutes, elle ne verra qu'une saturation durable ;
- dans le journal du serveur, les lignes « Timed out fetching a new connection from the connection pool » et « Maillon d'audit NON écrit » : la première annonce les 500, la seconde un trou dans le journal d'audit ;
- le nombre de refus « Trop d'écritures enregistrées au même instant » (409), seul signe visible des conflits de 4.4.

Ordre de grandeur, à ne pas lire comme une promesse : avec `--concurrency 20` et `--max-instances 8`, le banc suggère de l'ordre de **150 cabinets au rythme du script** (une requête par seconde chacun), sous réserve de la section 6. Un comptable humain émet moins de requêtes qu'un cabinet virtuel ; combien de moins n'est pas mesuré.

---

## 8. Relancer

`e2e/k6/README.md` donne le mode d'emploi complet et ce qu'il ne faut JAMAIS viser (la production, une base non jetable, une chaîne de connexion réelle). En résumé, depuis la racine du dépôt, sur un poste à quatre cœurs :

```bash
# base jetable (PostgreSQL 16 à 18), serveur compilé comme en 2.4, puits de courriel
node e2e/k6/puits-courriel.mjs &
k6 run -e PROFIL=palier -e VUS=20 -e DUREE=150s -e THINK=1 -e SINK=http://127.0.0.1:2526 e2e/k6/usage-complet.js
```

Les résultats bruts (`--summary-export`, journaux du serveur, séries de surveillance) ne sont pas versionnés.
