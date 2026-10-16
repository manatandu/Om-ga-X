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

## Relectures du 2026-10-16 · à corriger AVANT intégration
- BLOQUANT · l'à-nouveau PROVISOIRE est lu comme une ouverture qui fait foi
  (`caisse-provisionnee.ts`, `lireLignes` et condition d'arrêt de `lignesDOuverture`).
  Correctif · exclure `estANouveauProvisoire: true` des deux, remonter dans le
  précédent ouvert, brouillard compris (règle A7 ter B1 de CLAUDE.md). Scénario ·
  provisoire lancé, puis recette de décembre au brouillard, sortie de janvier.
- MAJEUR · une OD du premier jour qui ne touche pas la caisse arrête la remontée ·
  n'arrêter que sur une ouverture qui porte une ligne sur CETTE caisse.
- MAJEUR · lecture · agréger par jour en base au lieu de rapatrier les lignes (§ 8 bis).
- MAJEUR · chemins non jugés · réimputation, transfert depuis la situation,
  acquisition d'immobilisation et bouquet de rente payés en caisse ; la baisse
  d'une entrée refusée alors que sa suppression passe (trancher).
- mineurs · `idApres` au lieu de `pageApres`, centimes entiers, `tenantId` sur la
  devise, jugement à la date inscrite (art. 22, 4°), contrôle de caisse APRÈS les
  contrôles propres de creer et modifier, JSDoc de `verifierComptesEnSommeil` à
  remettre, journal relu deux fois dans le règlement.
