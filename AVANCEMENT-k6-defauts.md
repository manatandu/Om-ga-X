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

## Reste

3. § 4.11 · `extension-cloisonnement.ts` (l. 321) et
   `extension-perimetre-journaux.ts` (l. 92, 106, 148) lisent par
   `transactionAuditee() ?? base` ; scénario sur vraie base avec un
   utilisateur à journaux restreints, à travers une clôture.
4. § 4.5 · le maillon d'audit hors transaction · décision par la loi (AUDCIF
   art. 22, 5° et 6°) à écrire ; si le maillon doit suivre l'acte, le dire
   dans CLAUDE.md § 5 (qui écrit aujourd'hui le choix inverse).
5. § 4.4 · conflits de sérialisation · mesures sûres (reprises serveur plus
   nombreuses et plus espacées dans `avecRetrySerialisable`, reprise
   automatique côté client sur les deux 409), mesurées au profil k6 nominal
   avant et après, en local.
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
