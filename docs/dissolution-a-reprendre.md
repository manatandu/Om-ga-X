# Dissolution · ce qui reste à reprendre

Point 2 des décisions par la loi du 2026-10-07 (`docs/decisions-par-la-loi-2026-10-07.md`) · arrêt de
l'exercice à la date de dissolution, exercice de liquidation unique, cotisations spéciales. Codé sur la
branche `travail/decisions-loi-2` jusqu'au commit 4ef1bee, puis SORTI de cette ligne au premier tour de
relecture (six bloquants et des questions de droit ouvertes). Tout le travail est gardé sur la branche
`travail/dissolution` (même point de départ, 4ef1bee). Il deviendra une ligne à part, précédée d'une analyse
de droit qui tranche les questions ci-dessous.

Le comportement de `main` pour la dissolution (ligne F32, décision du 2026-10-04, point 4) reste en vigueur
tant que cette ligne n'est pas reprise.

## Constats de la relecture (premier tour)

Chaque constat est à corriger, ou à trancher par la loi, avant toute intégration.

1. **Arrêt refusé à vie dans trois cas.**
   - Un exercice postérieur existe déjà · ouvrir N+1 avant de clôturer N est la règle (arrêté dans les
     quatre mois, AUDCIF art. 23), et OmegaX ne retire pas un exercice.
   - Une écriture VALIDÉE est datée après la dissolution · elle ne se supprime pas (AUDCIF art. 22, 2°).
   - Une écriture au BROUILLARD tenue par un module (`detenteurs-ecriture.ts`) ne se supprime pas depuis
     le journal.
2. **Dissolution modifiable ou effaçable après l'arrêt, arrêt non annulable.** Une période se retrouve sans
   exercice possible · le dossier est enfermé.
3. **Exercice de liquidation non prolongeable.** Un exercice créé après lui bloque `modifierFinDeLiquidation`.
4. **Délais du planning comptés en mois depuis le mois de clôture**, faux hors d'une clôture au
   31 décembre. Une dissolution au 17/09 sert une assemblée au 31/03 au lieu du 17/03, et quarante-cinq jours
   francs au 15/02 au lieu du 30/01.
5. **Cotisations spéciales.**
   - Non servies sous procédure collective ni à la coopérative (LPF art. 16 ; AUPCAP art. 53).
   - L'IS annuel est servi au 31/10 sous un libellé « 30 avril ».
6. **Exercice civil « fantôme » créé par la clôture de la liquidation.** Planning, IS et acomptes servis à une
   société éteinte · la personnalité morale « subsiste pour les besoins de la liquidation et jusqu'à la
   publication de la clôture de celle-ci » (AUSCGIE art. 205), la dissolution d'une société à associé unique
   personne morale se fait « sans qu'il y ait lieu à liquidation » (art. 201 al. 4), et « après l'écriture du
   règlement des associés, tous les comptes de la société sont soldés » (AUDCIF Titre VIII ch. 40
   § 2.2.2.3).
7. **Clôture de l'exercice de liquidation au 31 décembre « par habitude »** · elle rompt l'AUDCIF art. 7
   al. 4 (« la durée des opérations de liquidation est comptée pour un seul exercice »).
8. **Cotisation qui disparaît** · clôture de la liquidation déclarée hors de l'exercice de liquidation, ou
   exercice non arrêté qui contient à la fois la dissolution et la clôture.
9. **Échéancier fiscal d'une société dissoute** · il sert l'IS annuel et les acomptes, jamais les
   cotisations spéciales (seul le planning de clôture les servait).
10. **Écriture hors de son exercice pendant l'arrêt** · `creerAvec` et `modifier` lisent l'exercice HORS de
    la transaction de l'arrêt · une écriture passée pendant l'arrêt peut sortir de son exercice (CLAUDE.md
    § 10 bis, « la date de l'écriture tombe dans son exercice »).
11. **Clôtures de journal et de période posées sur l'exercice arrêté** · non bornées à la nouvelle fin.
12. **Totalisation de l'art. 12 al. 4 absente** · « lorsqu'il est dressé des bilans successifs au cours d'une
    même année, les résultats en sont totalisés pour l'assiette de l'impôt » (loi n° 23/053). Sur un cas de
    la relecture, 320 000 d'impôt de trop.
13. **Dossier repris déjà en liquidation** · aucun chemin pour lui donner son exercice de liquidation
    (dissolution antérieure au premier exercice tenu).
14. **Clés React des jalons répétés** · `situationsAnnuelles` sert plusieurs jalons de même étape et même
    libellé, la clé `etape-libelle` est en double.
15. **Bouton « Arrêter » proposé alors que le serveur refusera** (exercice postérieur, écriture postérieure).
16. **Coopérative** · le comportement a changé pour elle, contrairement à ce que disait la fiche
    d'avancement (« comportement d'avant inchangé »).

## Questions non tranchées par le texte

À trancher par une analyse de droit, texte lu, avant de reprendre le code.

1. **Écriture validée datée après la dissolution.** La rattacher à l'exercice de liquidation, date et contenu
   inchangés, est-il compatible avec l'irréversibilité de l'AUDCIF art. 22, 2° (« interdise toute
   suppression, addition ou modification ultérieure ») ?
2. **Art. 12 al. 4 et art. 13 al. 1 et 3 de la loi n° 23/053.** La totalisation des bilans successifs de
   l'année et la cotisation spéciale « d'après les résultats de la période pendant laquelle l'activité a été
   exercée », « rattachée à l'exercice désigné par le millésime de l'année de la dissolution » · comment
   s'articulent-elles (une assiette totalisée, ou deux) ?
3. **Acomptes de la LPF art. 57 bis pendant la liquidation.** Une société en liquidation verse-t-elle encore
   les acomptes calculés sur l'impôt de l'exercice précédent ?
4. **Déclaration annuelle pendant une liquidation de plusieurs années.** Entre la cotisation de la période
   d'activité et celle du dernier bilan de liquidation, une déclaration annuelle est-elle due au titre des
   années intermédiaires (art. 11, 1°, bénéfices de la liquidation imposables) ?
5. **« Dans le mois » de la LPF art. 16** · date à date (30 juillet pour une dissolution au 30 juin) ou mois
   civil qui suit ?
6. **AUSCGIE art. 232 et « la clôture de chaque exercice ».** Dans un exercice de liquidation unique (AUDCIF
   art. 7 al. 4), à quelles dates courent les trois mois de l'art. 232 et les six mois de l'art. 233 · chaque
   31 décembre (situations annuelles provisoires) ou la seule clôture de la liquidation ?
7. **Coopérative et « société » de l'art. 13.** La cotisation spéciale vise « une société » · s'applique-t-elle
   à la société coopérative (AUSCOOP), que l'AUSCGIE ne régit pas ?

## Ce que la branche `travail/dissolution` contient

- Serveur · `POST /exercices/:id/arreter-a-la-dissolution`, `POST /exercices/:id/fin-de-liquidation`,
  `validerArticle7` (exercice de liquidation au lendemain seulement), `refuserSuivantCivilApresDissolution`,
  `cotisationsSpeciales` et `situationsAnnuelles` (`liquidation-societe.ts`), observation « BILANS
  SUCCESSIFS » au résultat fiscal, faits du dossier (clôture de la liquidation, dates des deux déclarations).
- Écrans · bloc « Dissolution et liquidation » de la fenêtre Exercices, champs de Paramètres du dossier.
- Scénario · `scripts/cas-chiffres/rejeu-decisions-loi-2026-10-07.mjs`, cas S1.
