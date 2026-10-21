# Test de charge k6 · l'usage complet d'un cabinet

Ce dossier contient le test de charge d'OmegaX. Les résultats, les chiffres et
les constats sont dans `docs/test-de-charge-k6.md` ; ce fichier dit seulement
**comment relancer le test** et **ce qu'il ne faut jamais viser**.

## Ce qu'il ne faut JAMAIS viser

- **Jamais la production** : ni `oomega.web.app`, ni `*.run.app`, ni la base
  Neon. Le script crée des dizaines de dossiers par minute et les laisse en
  place ; sur la production il fabriquerait des cabinets fantômes et pourrait
  mettre le service à genoux pour de vrais clients (CLAUDE.md § 5).
- **Jamais une base qui n'est pas jetable.** Montez un PostgreSQL à vous, sur
  votre poste, et jetez-le après.
- Ne donnez au serveur d'essai **aucune** chaîne `DATABASE_URL` réelle : ni dans
  une commande, ni dans une sortie, ni dans un fichier (CLAUDE.md § 4).
- Ne pointez le puits de courriel vers aucun serveur de courrier réel, et ne
  donnez ses variables `SMTP_*` à aucun serveur autre que celui d'essai.

## Les fichiers

| Fichier | Rôle |
|---|---|
| `usage-complet.js` | le scénario k6 (inscription, saisie, validation, lettrage, états, exports, cloisonnement) et ses profils |
| `puits-courriel.mjs` | faux serveur SMTP local, sans dépendance, qui rend le mot de passe provisoire de l'essai public au script |
| `surveiller.sh` | échantillonne la mémoire du serveur et les connexions à la base pendant l'essai |

## Relancer

1. **Base jetable** (PostgreSQL 16 à 18) puis serveur compilé, à la racine du
   dépôt, avec les contraintes de la production : un seul cœur
   (`taskset -c 0`), un tas de 460 Mio, un pool de 10 connexions.

   ```bash
   npm ci && npm run build
   export DATABASE_URL='postgresql://<utilisateur>@localhost:<port>/<base jetable>?schema=public&connection_limit=10'
   npx prisma migrate deploy
   JWT_SECRET=jetable NODE_ENV=production PORT=8080 \
   INSCRIPTION_PUBLIQUE=true CORS_ORIGIN=http://localhost:4173 \
   taskset -c 0 node --max-old-space-size=460 dist/main.js
   ```

   Pour parcourir aussi l'**essai public**, ajouter au serveur
   `INSCRIPTION_ESSAI=true SMTP_HOST=127.0.0.1 SMTP_PORT=2525 SMTP_USER=u
   SMTP_PASS=p COURRIER_EXPEDITEUR=essai@omegax.test` et lancer le puits :
   `node e2e/k6/puits-courriel.mjs`.

2. **Lancer k6** (version 2.x, binaire installé hors du dépôt), de préférence
   sur un autre cœur que le serveur :

   ```bash
   # fumée : un cabinet, pour vérifier que le scénario passe
   k6 run -e PROFIL=fumee -e THINK=0.2 e2e/k6/usage-complet.js
   # palier : N cabinets simultanés tenus 150 s (un point de courbe par lancement)
   k6 run -e PROFIL=palier -e VUS=20 -e DUREE=150s -e SINK=http://127.0.0.1:2526 e2e/k6/usage-complet.js
   # nominal : 20 cabinets simultanés, 5 minutes
   k6 run -e PROFIL=nominal -e SINK=http://127.0.0.1:2526 e2e/k6/usage-complet.js
   # montée jusqu'à 120 cabinets, puis stress, puis débit maximal brut
   k6 run -e PROFIL=montee e2e/k6/usage-complet.js
   k6 run -e PROFIL=stress e2e/k6/usage-complet.js
   k6 run -e PROFIL=pic -e THINK=0 e2e/k6/usage-complet.js
   # inscriptions : 20 cabinets dans la même seconde, ou un flux régulier
   k6 run -e PROFIL=rafale -e RAFALE=20 e2e/k6/usage-complet.js
   k6 run -e PROFIL=inscriptions -e TAUX=30,60,120,180 e2e/k6/usage-complet.js
   ```

   `--summary-export=resultat.json` garde les chiffres bruts (ne les committez
   pas). Les variables du script sont documentées en tête de `usage-complet.js`.

3. **Surveiller** le serveur pendant l'essai :
   `PGHOST=localhost PGPORT=<port> PGUSER=<u> PGDATABASE=<base> e2e/k6/surveiller.sh <pid du serveur> memoire.csv`.

## Relancer en CI

Le workflow manuel `.github/workflows/charge-k6.yml` (Actions → « Banc de
charge k6 » → *Run workflow*) fait les trois étapes ci-dessus dans un coureur
GitHub, sur une base jetable en PostgreSQL 18, 17 ou les deux, avec le
serveur bridé comme en production, et range les chiffres bruts en artefacts.
Il ne vise jamais la production (section du haut) · la base est celle du job,
jetée avec lui.

## Deux manières de simuler les visiteurs, et pourquoi la différence compte

- `IP=distinctes` (défaut) : chaque cabinet arrive d'une adresse différente
  (en-tête `X-Forwarded-For` à deux relais, comme Firebase puis Cloud Run).
  C'est le public réel : chaque cabinet a SON adresse, la limitation de débit
  par adresse ne les compte pas ensemble.
- `IP=unique` : tous partagent une seule adresse. C'est un cabinet derrière un
  NAT, ou un test qui ne sait pas se faire passer pour plusieurs visiteurs.
  La limitation de débit (30 inscriptions par heure et par adresse, 20
  connexions par minute) coupe alors la charge **avant** le serveur : mesure à
  ne pas prendre pour la capacité du logiciel.

## Ce que le résultat vaut et ne vaut pas

Un conteneur de développement à quatre cœurs n'est pas Cloud Run, et une base
locale n'est pas Neon (aucune latence réseau vers us-east1). Les chiffres
disent où se trouve le goulot et comment il se comporte ; ils ne se
transposent pas tels quels en production.
