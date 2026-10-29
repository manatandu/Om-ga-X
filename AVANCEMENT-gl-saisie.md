# Avancement · ligne gl-saisie

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`, § 4).
Fonctions du tri · 2, 13, 15, 33, 34, 35, 56, 57, 58, 64, 97. Branche de
sauvegarde `travail/gl-saisie`, partie de `origin/main` (92c8b5810).

## Fait

| # | Fonction | Où |
|---|---|---|
| 2 | Échéance obligatoire sur la ligne d'une facture de tiers, option du dossier (faux par défaut) | `comptabilite/echeance-obligatoire.ts`, `Tenant.echeanceObligatoireTiers`, `PATCH /dossier/echeance-obligatoire`, Paramètres du dossier |

## Reste

13, 15, 33, 34, 35, 56, 57, 58, 64, 97 (dans cet ordre de travail, à peu près).

## Décisions, avec leur fondement

- **2 · la ligne jugée est celle de la FACTURE**, la même que celle qui reçoit
  l'échéancier du modèle de règlement (`motifSansEcheancierDuModele`, une seule
  règle) · fournisseur crédité (40), client débité (41), fiches des comptes 40
  et 41 des deux plans ; hors 408, 418, 409, 419, 416 et hors journal de
  trésorerie. Aucun texte n'impose l'échéance sur la pièce (AUDCIF art. 17,
  19) · option d'organisation, fausse par défaut. Jugée à la SAISIE seule, au
  contrôleur, comme le collectif · ni modules, ni clôture, ni imports.

## Commandes de vérification

```bash
npx tsc --noEmit && npx jest && npm run build
(cd client && npx tsc --noEmit && npm test && npm run build)
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url <base jetable> --exit-code
```
