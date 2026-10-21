# Avancement · immo-formulaire (demande de Manasse du 2026-10-16)

## Fait
- Un seul classeur « Tableaux des immobilisations », trois feuilles · Immobilisations,
  Amortissements, Réévaluations (`ExportService.tableauxImmobilisationsExcel`,
  `GET /exports/tableaux-immobilisations`). Spec · `formules-excel.spec.ts`.
- Formulaire de création · la nature du barème vient AVANT le compte du bien ; compte
  proposé non personnalisé · « Le personnaliser et le choisir » (administrateur).
- Lieu vide · le message dit quoi faire, bouton vers l'onglet Lieux.
- Journal de l'écriture d'acquisition choisi à l'écran (AUDCIF art. 22, 2°).
- SYSCOHADA · « Amortissement fiscal » (dégressif fiscal ou exceptionnel) choisi à la
  création, ouvre la fiche fiscale après l'enregistrement (fiche du compte 68 ; loi
  n° 23/053, art. 31 à 38). Le mode comptable reste linéaire ou unités d'œuvre.

- Relecture (deux tours) faite · constats corrigés le 2026-10-21 · feuille Réévaluations à
  douze colonnes, total en formule hors du filtre, pièce nommée, coefficient à dix
  décimales ; date d'arrêté bornée à l'exercice (400 nommé) ; la nature reste quand elle
  couvre le compte choisi (sous-compte compris) ; personnalisation refusée sur un compte
  subdivisé ou en sommeil, réponse périmée jetée ; option fiscale ni au Système minimal,
  ni à un incorporel, ni sans mise en service, retirée à la fermeture du formulaire ;
  journal de situation écarté de l'écriture d'acquisition ; l'export n'envoie que la date
  montrée à l'écran.

## Reste
- Scénario sur vraie base à travers une clôture, intégration sur main, déploiement vérifié.

## Vérification
- `npx tsc --noEmit` des deux côtés, `npx jest src/modules/exports`, `npx vitest run src/pages`.
