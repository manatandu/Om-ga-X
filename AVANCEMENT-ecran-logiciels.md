# AVANCEMENT · ligne ecran-logiciels

Branche de sauvegarde : `travail/ecran-logiciels` (aucun workflow ne la déploie).
Gel levé par Manasse pour cette ligne seule (demande du 2026-10-25) : après la
connexion, l'utilisateur voit des « logiciels » (tuiles) et choisit ce qui le
concerne.

## Fait

1. **Serveur, attribution par utilisateur**
   - `User.restreindreLogiciels` (booléen, faux) et `User.logicielsAutorises`
     (liste) · Prisma n'admet pas de liste NULLABLE, le « null = toutes » du
     sens se porte donc par le drapeau, comme `restreindreJournaux` et
     `restreindreFonctions`. Les utilisateurs existants ne changent pas.
   - Migration écrite à la main `20270190001000_logiciels_autorises`, rejouée
     sur base jetable : `prisma migrate diff ... --exit-code` rend « No
     difference detected ».
   - Colonnes ADMISES au journal d'audit (`liste-exclusion-fermee.spec.ts`).
   - `src/modules/utilisateurs/logiciels.ts` : liste fermée des neuf clés et
     `logicielsDeLaSession` (administrateur jamais restreint, clé inconnue
     écartée).
   - `PUT /utilisateurs/:id/logiciels` : `@Roles(ADMIN_CABINET)` sur la route,
     cloisonné par dossier, refus d'un administrateur restreint, d'une clé
     inconnue et d'une restriction sans aucune tuile ; AUCUNE session fermée
     (c'est un affichage).
   - `/auth/me` rend `logicielsAutorises` (null = toutes), relu à chaque appel.
2. **Client, table unique et écran**
   - `client/src/lib/logiciels.ts` : la SEULE table logiciel -> chemins de
     fenêtre, `logicielsServis` (une tuile est servie si une de ses commandes
     survit au menu déjà filtré par référentiel, profil, modules et rôle : rien
     n'est recopié), `filtrerParLogiciel`, `etatDuChoix`, préférence du poste
     (localStorage, try/catch ; marque « écran déjà vu » en sessionStorage,
     oubliée à la déconnexion).
   - `EcranLogiciels` : tuiles au registre de Sage, sans paragraphe (aide dans
     la bulle), posé SUR l'espace de travail sans démonter les fenêtres.
   - Barre de menus restreinte au logiciel choisi, accueil restreint de même,
     bouton « Logiciels » dans le chrome (rappel), une seule tuile servie =
     entrée directe, aucune tuile = message qui le dit. Le gestionnaire de paie
     (menu propre) ne suit pas les logiciels.
   - Fenêtre Utilisateurs : bouton « Logiciels » par collaborateur
     (`ModaleLogiciels`, jamais pour un administrateur).
3. **Tests**
   - Serveur : `logiciels.spec.ts` (null = tout, administrateur jamais
     restreint, cloisonnement, aucune session fermée, route sous `@Roles`).
   - Client : `lib/logiciels.spec.ts` confronte la table au menu RÉEL
     (`AppShell.tsx`), à l'accueil et aux tâches par métier, aux clés du
     serveur, et rejoue les cas « tuile non servie sans la fonction ».
   - e2e : `entrerDansUnLogiciel` (outils) traverse l'écran comme un
     utilisateur dans `seConnecter`, `rester-connecte`, `visa-rib` ; le balayage
     `ecrans.e2e.ts` n'est pas affaibli (il ouvre toujours chaque chemin lu dans
     AppShell) ; `ecran-logiciels.e2e.ts` prouve choix, rappel, attribution,
     entrée directe, et que la fenêtre hors logiciel s'ouvre encore.

4. **Relecture (React, échecs silencieux), premier tour corrigé**
   - Utilisateur enfermé : le serveur ne juge PAS qu'une tuile soit servie (il
     recopierait la règle du menu) ; la modale marque « non servi par ce
     dossier », avertit et refuse l'enregistrement quand aucune tuile cochée
     n'est servie ; l'écran NOMME les logiciels attribués sans être servis et
     les clés mortes (`logicielsRetires` rendu par /auth/me), avec l'issue.
   - Restriction qui ressuscite : un passage au rôle administrateur ou
     gestionnaire de paie efface l'attribution (`ROLES_SANS_LOGICIELS`, test).
     Le gestionnaire de paie est refusé en 400 nommé, son bouton masqué.
   - Couche sur les fenêtres : marqueur `ATTRIBUT_COUCHE_ECRAN` lu par
     `echapPourLaFenetre`, Échap = retour au logiciel en cours, `inert` sur
     l'accueil et les fenêtres, fenêtres dans leur propre contexte
     d'empilement (`z-0`) sous l'écran (`z-10`), quelle que soit la valeur du
     compteur `ordre` ; une commande commune choisie depuis l'écran l'écarte ;
     le démarrage guidé attend sa fermeture.
   - Effet : /auth/me relu au retour sur l'onglet (au plus toutes les trente
     secondes, un échec ne ferme pas la session). La bulle dit « à sa
     prochaine ouverture, à un rechargement, ou en revenant sur son onglet »,
     jamais « immédiat ».
   - Mineurs : `@ArrayMaxSize`, liste facultative si `restreindre` est faux,
     modale en dialogue (Échap, focus initial, fermeture tenue pendant
     l'envoi), valeur du contexte mémorisée, e2e d'une commande ouverte par la
     barre après « Tiers et trésorerie » et d'Échap sous l'écran.

## Au suivi (hors périmètre)

- `journauxAutorises` et `fonctionsAutorisees` ont le même défaut d'origine :
  un utilisateur promu administrateur garde en base sa restriction, qui
  ressusciterait s'il redevenait comptable (`UtilisateurService.modifier`
  n'efface ni `restreindreJournaux` ni `restreindreFonctions`). Non corrigé
  ici.

## Reste (NIVEAU 3, hors de cette ligne)

**Masquer n'est pas refuser.** Aucune route n'est refusée sur le fondement d'un
logiciel : une adresse tapée ouvre toujours sa fenêtre, et le serveur ne
connaît l'attribution que pour la rendre à l'écran. Pour que « ce qui ne
concerne pas l'utilisateur ne soit pas accessible », il reste, module par
module, à poser le refus au serveur (un garde qui relit `logicielsAutorises`
sur chaque contrôleur rangé dans une tuile, sur le modèle de
`@ReferentielsAutorises` + `ReferentielGuard`), et à l'aiguillage client
(`fenetreOuverteAuRole`). À noter au suivi, pas à coder avant décision :
une commande rangée dans plusieurs tuiles (paramètres du dossier, journal
d'écritures exportées, contrôles) doit être autorisée si l'une des tuiles
l'est. Aucune fonction n'est marquée « bientôt disponible ».

## Décisions prises

- Prisma ne sait pas porter une liste nulle : drapeau + liste (voir ci-dessus).
  Écart à la lettre de la demande (« colonne nullable »), sans écart de sens.
- Une restriction sans aucun logiciel est REFUSÉE (400 nommé) : l'utilisateur
  n'aurait aucune porte. Pour ne rien lui laisser saisir, c'est le rôle.
- Courriers sortants, impressions différées, console de l'éditeur et aide
  restent au menu quel que soit le logiciel (`CHEMINS_COMMUNS`).
- Aucun « Tous les logiciels » : l'écran est rappelable en un clic.
- Aucun source de droit n'est invoquée : organisation d'affichage d'OmegaX,
  aucun texte lu ne régit la présentation des menus.

## Vérification

```bash
npx prisma generate && npx tsc --noEmit && npx jest   # racine
npm run build
cd client && npx tsc --noEmit && npx vitest run && npm run build
# migration (base jetable) :
npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --shadow-database-url "$URL_JETABLE" --exit-code
# navigateur (montage de CLAUDE.md § 10) : e2e/tests/ecran-logiciels.e2e.ts, ecrans.e2e.ts, rester-connecte.e2e.ts, visa-rib.e2e.ts
```

## Risques

- Les tests Playwright n'ont pas pu être rejoués dans cette copie (aucun
  navigateur installé) : ils sont écrits sur le modèle des parcours voisins et
  typés, mais restent à constater sur le job `tests-navigateur.yml`.
- Tout futur chemin de menu doit entrer dans une tuile : le spec client tombe
  sinon, c'est voulu.
- Ce que « le dossier sert » est lu sur le menu de la session de
  l'administrateur : une tuile servie à lui et pas au rôle du collaborateur
  (rare, les fenêtres réservées sont rangées en Administration) n'est pas
  marquée dans la modale ; l'écran du collaborateur la nomme alors.
