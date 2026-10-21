# AVANCEMENT · ligne k6-defauts

Branche de sauvegarde `travail/k6-defauts`, copie `/home/user/wt-caisse`, partie de
`origin/main` c3485f5 (après l'intégration de la ligne charge-k6). Demande de
Manasse du 2026-10-21, « Fais ça tout en cascade » · les défauts que
`docs/test-de-charge-k6.md` laisse ouverts (§ 4.4, 4.5, 4.11, 4.12), puis le
banc k6 en CI, puis les lignes Sage L3, L8, L9.

## Fait

1. **Pré-image illisible DITE sur le maillon** (§ 4.12, MINEUR) ·
   `src/common/audit/pre-image.ts` (`PRE_IMAGE_ILLISIBLE`, `preImageIllisible`),
   posé par `extension-audit.ts` quand la lecture tombe hors transaction ou
   sur une erreur de validation du client. Lecteurs · `fiche-immobilisation.service.ts`
   (`etaitClos` · l'inconnu est tenu pour une clôture, le doute fige) ;
   `taux-tva.service.ts` (`suppressionsSansCompte` · une suppression de lettrage
   au compte inconnu, postérieure à la liquidation, rend la reconstitution
   incertaine sur tout compte de tiers de la facture). Tests ·
   `journal-audit.spec.ts` (hors transaction, le marqueur ; validation, le
   marqueur), `fiche-immobilisation.service.spec.ts`, `tva-groupes-comme-main.spec.ts`.
2. **Deux sous-filtres `some: {}` bornés par le dossier** (§ 4.12) ·
   `reprise-subvention.service.ts` (`subventions: { some: { tenantId } }`),
   `controles.service.ts` (`journauxTresorerie: { some: { tenantId } }`).
   Tests · `reprise-subvention.spec.ts`, `controle-caisse.spec.ts`. Mesure
   `EXPLAIN` sur la base jetable locale, à reporter dans
   `docs/test-de-charge-k6.md` § 4.12 (voir la section Mesures ci-dessous).

3. **§ 4.11 · les deux gardes lisent par la transaction** ·
   `extension-cloisonnement.ts` et `extension-perimetre-journaux.ts`,
   `transactionAuditee() ?? base`, sous `horsCloisonnement` pour leur propre
   relecture (le client de la transaction porte les extensions). Tests dans
   `cloisonnement.spec.ts` (+ liste fermée) et
   `extension-perimetre-journaux.spec.ts`. Scénario sur vraie base
   `scratchpad/scenario-perimetre.mjs` · comptable restreint à la caisse,
   saisie, modification, validation, refus hors périmètre, pièce d'un autre
   dossier, à travers la clôture de N · passé (12 contrôles) sur le serveur
   compilé du 2026-10-21.
4. **§ 4.5 · le maillon suit l'acte** (décision par la loi · AUDCIF art. 22,
   5° et 6°, lus dans `audcif-acte-uniforme`, titre 1 ch. 2) · un acte audité
   hors transaction est rejoué par le client étendu dans une transaction
   courte avec son maillon (`extensionAudit(this, () => etendu)`,
   `intercepterEcriture(…, etendu)`) ; l'ancien chemin reste pour les appels
   sans client étendu. Cinq tests (`journal-audit.spec.ts`), CLAUDE.md § 5 et
   `docs/test-de-charge-k6.md` § 4.5 mis à jour. TROUVÉ AU REJEU SUR VRAIE
   BASE (le banc k6 tombait à la première inscription, « Unable to start a
   transaction ») · le rappel rendait une requête Prisma NON attendue, dont le
   `.then` est appelé par Prisma hors de la portée de
   `journaliserDansTransaction` · le crochet ne voyait plus la transaction et
   en rouvrait une à l'infini. Corrigé à la racine · `journaliserDansTransaction`
   appelle `.then` dans sa portée (comme `dansLaPortee` du cloisonnement),
   deux tests dans `transaction-journalisee.spec.ts`. Un rappel de
   `transactionJournalisee` qui rendait une requête nue avait le même défaut
   latent (maillon par la connexion à part).

## Reste

5. § 4.4 · conflits de sérialisation · côté client FAIT (`reprise-conflit.ts`,
   `api.ts`, deux reprises après délai aléatoire, test vitest) ; côté serveur
   la reprise à huit tentatives et délai plus aléatoire
   (`scratchpad/patch-retry.py`, à appliquer APRÈS la mesure « avant ») ;
   mesure au profil k6 palier (20 cabinets, 150 s, base neuve, serveur bridé
   un cœur / 460 Mio / pool 10, `scratchpad/banc-k6.sh`) avant et après.
6. Bloc § 3 des deux côtés, `silent-failure-hunter` et `typescript-reviewer`
   (deux tours), scénario sur vraie base à travers une clôture, intégration
   sur `main`, déploiement relu, fiche retirée.

## Mesures

Base jetable locale (PostgreSQL 16, 345 dossiers, 472 861 comptes, 1 750
journaux, 3 subventions rattachées), `EXPLAIN (ANALYZE, BUFFERS)` sur la
requête que Prisma engendre, trois passages à chaud chacun.

- Contrôle de caisse, sous-requête des journaux · AVANT, `Seq Scan on
  journaux` (703 lignes lues, 197 pages, 0,66 ms) ; APRÈS, `Bitmap Heap Scan`
  par l'index `(tenantId, code)` (2 lignes, 43 pages, 0,25 ms). Sur 1 750
  journaux l'écart est petit ; il croît avec chaque cabinet inscrit, comme le
  4.3.
- Reprise de subvention · AVANT, `Index Only Scan` sur la clé unique
  `(immobilisationId, compteSubventionId)` de toute la table ; APRÈS, `Index
  Scan` sur `(tenantId)`. Trois lignes dans cette base, rien de mesurable ·
  le plan seul change.

## Commandes de vérification

```bash
npx tsc --noEmit && npx jest src/common/audit src/modules/tva/tva-groupes-comme-main.spec.ts \
  src/modules/immobilisations/fiche-immobilisation.service.spec.ts \
  src/modules/immobilisations/reprise-subvention.spec.ts src/modules/controles/controle-caisse.spec.ts
```
