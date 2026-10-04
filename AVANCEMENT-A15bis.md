# AVANCEMENT · ligne A15 bis (sortie d'un bien réévalué, décisions du 2026-10-04)

## Fait
- 154 repris EN ENTIER au 861 à TOUTE sortie, aux deux référentiels (`sortDesEcarts`, plus de « non passé »).
  Textes · AUDCIF Titre VII fiche du compte 15 ; SYCEBNL Partie 2 ch. 3 fiche 15 ; loi n° 23/053 art. 132 al. 1er,
  133 al. 2 et 3 ; AUDCIF Titre VIII ch. 28 § 4.2.4.1, § 4.2.4.2, § 6.
- 106 du SYCEBNL transféré au 118 « Autres réserves » IMPOSÉ (11800000), aucun choix, autre compte refusé en 400
  nommé · décision de Manasse du 2026-10-04, dans le silence du texte SYCEBNL, par analogie avec l'AUDCIF ch. 28 § 6.
  SYSCOHADA inchangé (111, 112, 1138 au choix).
- 1062 « avec droit de reprise » · aucun texte de la compétence sycebnl ne dit son sort à la sortie (fiche 10,
  Partie 3 ch. 1 § 2.1.1.3, plan) · même règle.
- Écran · encadré de sortie sans type, réserve imposée montrée sans liste au SYCEBNL, message après sortie.
- CLAUDE.md, paragraphe « SUITES DE LA RÉÉVALUATION » mis à jour.

## Reste
- Rejeu sur vraie base (N réévaluation à la clôture, N+1 sortie), bloc § 3 complet.

## Vérification
- `npx jest src/modules/immobilisations` ; client `npx vitest run src/lib/reevaluation-suites.spec.ts`.
