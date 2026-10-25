Tu construis la ligne M2 (achats et trésorerie) des idées Microfina++ d'OmegaX, logiciel comptable SYCEBNL et SYSCOHADA (NestJS 10, Prisma 5, PostgreSQL, React 18).

Décision de Manasse du 2026-10-25 : les douze idées sont levées du gel. Lis D'ABORD, en entier :
- /home/user/Comptaflow/CLAUDE.md (le règlement du dépôt : il prime sur tout, en particulier § 1 aucune règle de mémoire, § 4 interdits, § 5 sauvegarde, § 10 tests, § 10 bis ce qui casse en silence) ;
- docs/comparaison-microfina/plan-reproduction-microfina.md (ta ligne, ses points à lire, la définition de fini) ;
- dans docs/comparaison-microfina/audit-manuel-microfina-306-pages.md, la partie et l'idée citées pour chaque idée de ta ligne (page du manuel, ce que Microfina++ fait, ce qu'OmegaX a déjà).

Ta ligne : idée 2 · bon de commande fournisseur qui crée l'engagement budgétaire (prolonge src/modules/analytique/engagement.service.ts, model EngagementDepense ; SYCEBNL, Guide, Application 22), exécuté par la facture d'achat, reste à facturer dit ; aucune écriture comptable à la commande ; idée 5 · arrêté de caisse par coupures et plafond d'encaisse (prolonge le procès-verbal de comptage par caisse et CoupureComptee d'inventaire/, fiche du compte 57 des deux plans ; le plafond est une convention d'OmegaX qui AVERTIT, jamais ne refuse) ; idée 9 · registre des chèques émis (chéquier par RIB, numéros, état émis, annulé, encaissé lu au rapprochement bancaire ; le lien avec le règlement des tiers et l'ordre de virement existants).

Copie de travail : crée-la toi-même depuis main à jour, jamais dans /home/user/Comptaflow :
  cd /home/user/Comptaflow && git fetch origin main && git worktree add /home/user/wt-microfina-m2 -b travail/microfina-m2 origin/main
Travaille seulement là. Une autre ligne avance en parallèle dans d'autres fichiers (M1 · comptabilite/ (validation des écritures), facturation/ côté visa, reglements/ côté visa, un module de concordance ; et la ligne partiels-sage · personnel, immobilisations. Si tu dois toucher facturation/ pour relier la facture à la commande, garde la modification petite et dis-la) ; ne touche pas aux siens.

Méthode, dans l'ordre :
1. Lis le code existant que l'audit nomme pour chaque idée (ce qui existe déjà se prolonge, rien ne se refait à côté).
2. Lis les textes de ta ligne dans les compétences installées (Skill : sycebnl, syscohada, audcif-acte-uniforme, droit-travail-congolais, fiscalite-rdc, organisation-comptable-cpcc, selon le sujet) et tranche chaque question PAR LA LOI, avec l'article, dans ta fiche AVANCEMENT. Là où aucun texte ne régit (convention d'organisation), écris « convention d'OmegaX » et choisis la règle la plus prudente : un seuil sans texte AVERTIT, il ne refuse pas. Ce que le corpus ne tranche pas vraiment, note-le comme question pour Manasse et continue sur la lecture la plus protectrice, dite.
3. Construis idée par idée : schéma Prisma et migration SQL écrite à la main (vérifie la dérive comme le dit CLAUDE.md § 6, « Migrations écrites à la main », sur une base jetable), service, contrôleur (@Roles sur toute route qui écrit, cloisonnement par tenantId, journal d'audit sur les actes, aucune collection sans borne), écran client au registre de Sage (§ 9 ter : aucun paragraphe explicatif, bulle Aide, titres formels, peutEcrire/peutValider, null n'est pas vide), menu à sa place.
4. Tests qui gèlent ce qui casserait en silence, serveur et client.
5. Après chaque idée finie : bloc du § 3 complet (npx tsc --noEmit, npx jest, npm run build à la racine ; npx tsc --noEmit, npm test, npm run build dans client/), commit signé, push sur travail/microfina-m2. Pied de commit : la seule ligne « Claude-Session: https://claude.ai/code/session_01XonhesEbcpnMXwsv6QWBB2 », aucun nom de modèle, aucun tiret cadratin.
6. Fin de ligne : un scénario sur VRAIE base PostgreSQL jetable, par l'API du serveur compilé, à travers une clôture d'exercice (§ 10), chaque solde touché lu contre le calcul à la main ; puis relis tout ton diff avec les agents silent-failure-hunter et typescript-reviewer (et react-reviewer pour les écrans), corrige les BLOQUANTS et MAJEURS, un second tour au plus.

Interdits rappelés : jamais DATABASE_URL affichée ; jamais --no-gpg-sign ; jamais de push sur main (c'est moi qui intègre) ; pas de pull request ; au plus deux agents relecteurs lancés par toi à la fois.

Rends-moi à la fin, en français : ce qui est fait idée par idée (fichiers, routes, écrans), les décisions par la loi avec leurs articles, les conventions d'OmegaX, les questions pour Manasse, le résultat exact du bloc § 3 (nombres de tests), le scénario sur vraie base (soldes attendus et lus), les constats de relecture et ce qui en a été fait, et le dernier commit poussé.
