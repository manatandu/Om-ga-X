# Avancement · ligne gl-saisie

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`, § 4).
Fonctions du tri · 2, 13, 15, 33, 34, 35, 56, 57, 58, 64, 97. Branche de
sauvegarde `travail/gl-saisie`, partie de `origin/main` (92c8b5810).

## Fait

| # | Fonction | Où |
|---|---|---|
| 2 | Échéance obligatoire sur la ligne d'une facture de tiers, option du dossier (faux par défaut) | `comptabilite/echeance-obligatoire.ts`, `Tenant.echeanceObligatoireTiers`, `PATCH /dossier/echeance-obligatoire`, Paramètres du dossier |
| 13 | Interroger le compte depuis la saisie · solde (livre-journal, brouillard, à-nouveau provisoire) et dernières lignes | `comptabilite/interrogation-compte.service.ts`, `GET /interrogation-compte/:compteId`, `ModaleInterrogationCompte` (F2 ou double-clic dans la saisie) |
| 15 | Créer un modèle de saisie depuis la pièce en cours | `client/src/lib/modele-depuis-piece.ts`, `ModaleModeleDepuisPiece` (bouton « Créer un modèle… » de la saisie), route existante `POST /modeles-saisie` |
| 97 | Aller à une fonction par son nom · F7, ou Fenêtre > Aller à une fonction… | `client/src/components/chrome/commandes-du-menu.ts`, `AllerAFonction.tsx`, `AppShell.tsx` |

## Reste

33, 34, 35, 56, 57, 58, 64.

## Décisions, avec leur fondement

- **2 · la ligne jugée est celle de la FACTURE**, la même que celle qui reçoit
  l'échéancier du modèle de règlement (`motifSansEcheancierDuModele`, une seule
  règle) · fournisseur crédité (40), client débité (41), fiches des comptes 40
  et 41 des deux plans ; hors 408, 418, 409, 419, 416 et hors journal de
  trésorerie. Aucun texte n'impose l'échéance sur la pièce (AUDCIF art. 17,
  19) · option d'organisation, fausse par défaut. Jugée à la SAISIE seule, au
  contrôleur, comme le collectif · ni modules, ni clôture, ni imports.
- **13 · trois sommes, jamais fondues sans le dire** · livre-journal (validées, AUDCIF art. 22, 2°), brouillard, à-nouveau provisoire ; simulations et solde des comptes de gestion hors de tout (balance à trois colonnes) ; bornée aux quinze lignes les plus récentes, le total dit. Ce n'est pas le grand livre.
- **15 · aucune règle à part** · la pièce se traduit en modèle (taxe en « Calculer » avec son taux, dernière ligne hors taxe en « Équilibrer » sur demande, montants figés sur demande seulement) et part par la route des modèles, qui garde ses refus ; un spec rejoue la traduction contre `motifRefusFonctions` du serveur.
- **97 · la liste est celle du menu affiché**, jamais une seconde table · tirée des menus déjà filtrés (référentiel, profil, modules, rôle, logiciel), ouverte par le même geste que le menu, donc par le même aiguillage (masquer n'est pas refuser). Le menu Fenêtre n'y est pas. Le Ctrl+J de Sage (tiers suivant) est écarté · la fiche du tiers n'a pas de parcours séquentiel à servir.

## Commandes de vérification

```bash
npx tsc --noEmit && npx jest && npm run build
(cd client && npx tsc --noEmit && npm test && npm run build)
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url <base jetable> --exit-code
```
