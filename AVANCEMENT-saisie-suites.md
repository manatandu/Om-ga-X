# Avancement · ligne saisie-suites

Branche de sauvegarde `travail/saisie-suites`, partie de `origin/main`
(`476a1df39`). Corrections de défaut seulement, aucune fonction nouvelle.

## Fait

1. **Interblocage rendu en 500.** Trente-quatre `SELECT … FOR UPDATE` (ou
   `FOR SHARE`) de `src/` verrouillaient une ligne AVANT le verrou du dossier
   que tout acte audité prend ensuite · cycle possible avec une transaction
   qui tient déjà le dossier (clôture, saisie, autre geste audité sur la même
   ligne), PostgreSQL abattait l'une (40P01) et l'utilisateur recevait une 500.
   Racine · le verrou du dossier (`prendreLeVerrouDuDossierBorne`) est pris
   avant chacun (fiches de bien, détention, RIB des tiers et des salariés,
   salariés, rappels, missions, feuilles de temps, formations, demandes de
   congé, organigramme, avances, bilan social, campagnes d'inventaire,
   budgets et grilles analytiques, plan analytique, visa des factures,
   impressions différées, titres et opérations de trésorerie ; puis, à la
   relecture, la suppression d'un dossier d'essai, qui ne tenait qu'un
   verrou consultatif à clé préfixée). Garde ·
   `src/common/ordre-des-verrous.spec.ts`, relu par STRUCTURE (la fonction
   qui écrit le verrou de ligne doit prendre le verrou du dossier avant lui ;
   un verrou consultatif à clé préfixée, `cheques:…`, ne compte pas).
   Dernier rempart · `FiltrePannes` traduit un interblocage ou un conflit
   d'écriture qui s'échapperait (P2034, 40001, 40P01, enveloppés compris) en
   409 nommé `GESTE_CONCURRENT`, jamais rejoué d'office par l'interface
   (`reprise-conflit.ts` ne rejoue que ses trois codes), toujours signalé à
   Sentry. La saisie garde sa reprise propre (`transactionDeSaisie`).
2. **Code mort.** `avecRetrySerialisable` retirée de `prisma-retry.util.ts`
   avec ses tests ; mentions devenues fausses corrigées (extension d'audit,
   `reprise-conflit.ts`, deux scripts de rejeu, `docs/suivi-reprises.md`,
   CLAUDE.md § 6).
3. **Rejeu `scripts/rejouer-dossier-l9.cjs` · reproduit, cause dans
   l'application, corrigée.** Sur PostgreSQL 16 jetable (base neuve copiée
   d'un modèle migré à chaque passage, serveur compilé), 6 échecs sur 18
   passages, toujours « la session déconnectée quitte la liste ». Cause ·
   le collaborateur se connecte au mot de passe provisoire et le change dans
   la même seconde ; le changement révoque le compte
   (`sessionsInvalidesAvant`, comparé à la SECONDE) et repose une session
   sous un jeton CSRF neuf, mais la session provisoire, authentifiée dans la
   même seconde, n'était pas tenue pour antérieure · son jeton restait
   valable et la fenêtre des utilisateurs connectés la montrait encore après
   la déconnexion de la session neuve (relevé en base · deux présences, la
   provisoire non fermée). Correction · les cinq actes qui révoquent puis
   reposent une session (mot de passe, adresse, poser ou retirer la double
   authentification, autres appareils) nomment aussi la session qui les
   présente fermée par son empreinte (`revoquerEtFermerLaSession`, dans la
   transaction de l'acte, verrou du dossier puis ligne du compte). Après · 10
   passages sur 10 verts. Test · `changer-mot-de-passe.spec.ts` (session
   provisoire nommée fermée), attentes de `session-longue.spec.ts` et
   `changer-adresse.spec.ts` mises à jour.

Preuve sur vraie base du point 1 (deux transactions Prisma sur PostgreSQL
16) · ancien ordre, ligne puis dossier contre dossier puis ligne ·
interblocage, reconnu comme conflit et rendu en 409 par le filtre ; ordre
unique · les deux passent.

## Reste

- Rien de la ligne. Le banc de charge et les tests navigateur tournent au
  portillon de l'intégration.

## Décisions

- Le 409 du dernier rempart porte un code PROPRE (`GESTE_CONCURRENT`) et non
  `CONFLIT_SERIALISATION` · une demande à plusieurs étapes a pu en commettre
  une, et l'interface ne doit pas la rejouer d'office.
- Une mise à jour ordinaire (Prisma `update` d'un modèle non audité) avant le
  premier acte audité pose aussi un verrou de ligne ; elle n'est pas
  recensée · c'est le dernier rempart qui en répond.

## Vérification

```bash
npx tsc --noEmit && npx jest && npm run build
cd client && npx tsc --noEmit && npm test && npm run build
npx jest src/common/ordre-des-verrous.spec.ts src/common/telemetrie
```
