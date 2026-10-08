# AVANCEMENT · ligne tva-decisions

Branche de sauvegarde `travail/tva-decisions` (jamais `main`). Fiche retirée à
l'intégration.

## Fait

- (C) Délai de la récupération de TVA d'une créance irrécouvrable · décision
  par la loi du 2026-10-08 (`creances-douteuses/recuperation-tva.ts`,
  `derniereDateEcriture`, refus et message, proposition servie à l'écran).
  Paragraphe A7 bis partie 2 de CLAUDE.md NON retouché (consigne du
  coordinateur · il sera réécrit avec D) · la phrase « après le 31 décembre de
  l'année qui suit » y est à remplacer par la règle ci-dessous à l'intégration.
- (A) Négatif d'une facture (vente et achat) lu au signe près, à la date de la
  facture corrigée ; reprise une fois au premier jour non liquidé, nommée
  (`negatifsDeFactures`) ; liquidation à collecte négative ; facture lettrée
  avec son propre négatif jamais « encaissée » (`datesDuGroupeDeMain`).
- (B) Ligne validée après la liquidation qui devait la lire · rattachée au
  premier jour non liquidé (`rattachementTardif`, `recuperationTardive`),
  nommée (`rattachementsTardifs`). Spec
  `tva/tva-negatifs-et-rattachements-tardifs.spec.ts` (14 cas). Paragraphe
  nouveau de CLAUDE.md après « TVA · le livre-journal seul ».

- (E) Liquidation · réglé au-delà séparé (`bilansSuccessifsDe` ·
  `cotisationDeLExercice`, `tropPayePremiereCotisation`, `excedentAcomptes`) ;
  l'écriture de l'impôt (A11) constate dans l'exercice de liquidation la
  seconde cotisation et le trop-payé D 441 / C 8994
  (`ConstatImpotService.impotDeLExercice`, colonne `tropPayeLiquidation`,
  migration `20270161000000_trop_paye_liquidation`). CLAUDE.md, paragraphe
  « Liquidation d'une société commerciale » mis à jour.

## Reste

- (D) EN ATTENTE · Manasse a refusé le montant négatif au 651 ; rien codé,
  récupération identique à `main`, paragraphe A7 bis partie 2 intact.
- Bloc du § 3 des deux côtés ; scénario sur vraie base.

## Décisions prises, avec leurs articles

### (C) Délai de l'art. 37, al. 2, par le renvoi de l'art. 126

- Le délai COURT de la constatation du non-paiement (décret n° 011/42,
  art. 126, « constatation [...] de non-paiement »), qui tient la place de
  l'exigibilité de l'art. 37, al. 1 (« dans les conditions prévues pour
  exercer le droit à déduction »). OmegaX la constate par la perte validée
  (D 651 / C 416) ; la DERNIÈRE, la récupération ne s'ouvrant qu'à la créance
  éteinte (O.-L. n° 10/001, art. 52, al. 3, « définitivement »). Ni l'envoi du
  duplicata (forme de la rectification, art. 52 al. 3, décret art. 127 al. 2,
  comme la facture de l'art. 38 dont la réception ne déplace pas le délai,
  lecture d'A21), ni l'irrécouvrabilité comme fait distinct.
- Le délai SE JUGE à la déclaration qui inscrit la récupération (art. 37,
  al. 2, « exercé » ; art. 126, « inscrite dans les déductions afférentes à la
  déclaration ») · déclaration mensuelle (décret art. 102), période lue comme
  pour la déchéance de la déduction (`limiteDecheance`). OmegaX l'inscrit au
  mois qui suit son écriture · l'écriture se date au plus tard le 30 novembre
  de l'année qui suit la constatation. La date du geste n'entre pas en compte.

### (A) Négatif d'une facture

- La taxe se déclare pour la période où elle est exigible (O.-L. n° 10/001,
  art. 25) · une vente annulée par inscription en négatif (AUDCIF art. 20,
  al. 2) n'a pas de taxe à porter · le négatif se lit à la date de la facture
  corrigée, dans sa période tant qu'elle n'est pas liquidée.
- Période liquidée · la taxe déclarée se récupère par imputation (art. 52,
  al. 1 ; décret n° 011/42, art. 126, « inscrite dans les déductions »), une
  fois, au premier jour non liquidé à partir du négatif (AUDCIF art. 22, 4°).
  Pour un achat, reprise de la déduction (décret, art. 127). Note de crédit
  (art. 52, al. 2) dite, non exigée (OmegaX ne la voit pas sur un négatif).
- À l'encaissement (art. 25, 2°) · rien n'était exigible, le négatif retire
  de l'attente.

### (B) Ligne validée après une liquidation

- La taxe exigible reste due (art. 25), la déduction s'exerce jusqu'au
  31 décembre de l'année qui suit (art. 37, al. 2), l'avoir s'inscrit dans
  « la déclaration du ou des mois suivants » (décret, art. 126) · rien ne
  tombe parce qu'une déclaration est passée ; une période liquidée ne se
  redéclare pas · rattachement au premier jour non liquidé (AUDCIF art. 22,
  4°), nommé avec la date d'origine. Une liquidation postérieure à la
  validation a vu la ligne · rien ne bouge.

### (E) Trop-payé de la liquidation (décision de Manasse du 2026-10-08)

- L'impôt de l'année s'éteint d'abord par la première cotisation, puis par les
  acomptes. Excédent d'ACOMPTES · au 4492 (LPF art. 57 ter, « Si les acomptes
  provisionnels versés [...] sont supérieurs à l'impôt dû »). Première
  cotisation (loi n° 23/053, art. 13, al. 1) au-delà de l'impôt totalisé
  (art. 12, al. 4) · dette de l'État, D 441 (fiche du compte 44, « Débité lors
  de la constatation de la dette de l'État envers l'entité [...] par le crédit
  des comptes [...] des classes 7 et 8 ») / C 8994 (fiche du compte 89, 899
  « Dégrèvements et annulations d'impôts sur résultats antérieurs »), semé au
  SYSCOHADA (89940000, détail) ; 441 débiteur rangé en BJ « Autres créances »
  (solde débiteur par compte), 8994 au poste RS (comptes 89).
- Dans l'exercice de liquidation, A11 constate la seconde cotisation
  (impôt totalisé moins la première) et non l'impôt de la seule liquidation
  (défaut d'avant, l'A11 ignorait la totalisation) ; totalisation non
  calculée · refus nommé.

## Commandes de vérification

```bash
npx jest src/modules/creances-douteuses/recuperation-tva.spec.ts
npx jest src/modules/tva
npx jest src/modules/fiscalite src/modules/exercice/echeancier-dissolution.spec.ts
```

## Relevés non bloquants

- Le négatif d'une facture À L'ENCAISSEMENT déjà en partie encaissée · la
  taxe des règlements reste déclarée (figée) ; la restitution au client
  relève de la note de crédit (art. 52, al. 2), non chiffrée.
- Les compteurs descriptifs (biens datés à la facture, services aux débits,
  acomptes imputés) restent lus à la date d'écriture · une ligne rattachée
  tard y figure dans sa période d'origine, pas dans celle qui la déclare.
- (E) Le crédit du 8994 entre au résultat comptable de l'exercice de
  liquidation · tant que le cabinet ne le déduit pas (doctrine du 899 d'A11,
  `observationDegrevement`), la totalisation recalculée après validation
  l'inclut, et le constat dit l'écart du trop-payé. Neutralisation d'office
  non codée (aucun texte exprès, même parti que le dégrèvement).
