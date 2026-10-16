# Avancement · caisse provisionnée

Demande de Manasse du 2026-10-16 · « on ne peut pas payer un tiers par caisse
pour un montant supérieur au solde de cette caisse. Idem pour les virements.
[…] Pour la banque, la banque peut être négative ça passe ».

## Fait
- `src/modules/comptabilite/caisse-provisionnee.ts` · règle et message (fiche du
  compte 57 des deux plans, SYCEBNL Partie 2 ch. 3 classe 5 ; AUDCIF Titre VII).
- Branchée · contrôleur des écritures (saisie, modification), règlement des tiers,
  virement de fonds, paiement des salaires, avant la première pièce.
- `caisse-provisionnee.spec.ts` · 21 tests ; doublures des modules complétées.
- CLAUDE.md · § 5 (levée du gel) et paragraphe au § 6.

## Décisions
- 57 seul refusé ; 52 et 53 libres (découvert) ; 55 garde son avertissement
  (fiche 55, « débiteur ou nul » sans présomption).
- Dossier déjà créditeur non enfermé · seul ce qui l'enfonce est refusé.

## Reste
- Bloc § 3 complet, scénario sur vraie base à travers une clôture, intégration
  sur main après la ligne virement-natures, déploiement vérifié.

## Vérifier
npx tsc --noEmit ; npx jest src/modules/comptabilite src/modules/reglements src/modules/virements-fonds src/modules/personnel src/common
