# Trois questions tranchées par la loi (lecture du 2026-10-07, troisième lot)

Préfixe des compétences : `/root/.claude/skills/synced/80921ba8-…/` (abrégé `SK/`).
Ces trois questions avaient été présentées à Manasse comme non tranchées par le
corpus (`docs/decisions-par-la-loi-2026-10-07-bis.md`, point 3 ;
`docs/decisions-par-la-loi-paie-2026-10-07.md`, T2 et T9). Réponse de Manasse
du 2026-10-07 · « Réfère-toi toujours à la loi. » Aucun article ne les règle
mot pour mot ; chacune se tranche par ce que le texte dit à côté d'elle, par
sa structure, ou par l'analogie de la loi la plus proche. Chaque décision dit
lequel de ces moyens elle emploie.

---

## 1. Ordre d'imputation entre plusieurs pertes reportables (IS)

**Texte lu**
- Loi n° 23/053, art. 51, al. 1er (`SK/fiscalite-rdc/code-general-2026/references/04-loi23-053-titre2-impot-societes.md`) · « Les pertes constatées au cours d'un exercice sont considérées comme une charge déductible du bénéfice imposable de l'exercice suivant. Si ce bénéfice n'est pas suffisant pour que la déduction puisse être intégralement opérée, il est procédé à un report déficitaire sur les exercices suivants jusqu'au troisième exercice qui suit l'exercice déficitaire. »
- LPF, art. 43, al. 3 · les déficits reportables « s'imputent sur les résultats bénéficiaires du premier exercice non prescrit dont ils constituent des charges ».
- Code civil, Livre III, art. 154, al. 2 (`SK/code-civil-livre-iii-rdc/references/titre-01-des-contrats-ou-des-obligations-conven.md`) · « Si les dettes sont d'égale nature, l'imputation se fait sur la plus ancienne: toutes choses égales, elle se fait proportionnellement. »

**Décision · LA PLUS ANCIENNE D'ABORD.**
- Par la STRUCTURE de l'art. 51 · chaque perte reçoit un droit de déduction borné à sa propre fenêtre, et toutes les fenêtres ont la même longueur. La perte la plus ancienne s'éteint donc toujours la première. Imputer d'abord une perte plus récente sur un bénéfice qui pouvait absorber l'ancienne ferait perdre une déduction que la loi accorde, alors qu'un autre ordre la conservait. Entre deux lectures d'un même texte, on retient celle qui donne leur plein effet à tous les droits qu'il accorde.
- Par l'ANALOGIE de la loi la plus proche · le seul texte du corpus qui règle l'ordre d'imputation entre plusieurs sommes de même nature est l'art. 154 du Code civil, Livre III · « sur la plus ancienne ».
- La LPF, art. 43, al. 3 va dans le même sens · chaque déficit s'impute sur le premier exercice bénéficiaire qui le suit, et la perte ancienne a rencontré ce premier bénéfice avant la récente, ou en même temps qu'elle.

**Effet pour OmegaX** · aucun changement de calcul (`fiscalite/report-deficitaire.ts`). Le commentaire et tout message qui disaient « le texte ne fixe pas l'ordre » citent désormais ces trois fondements. La question sort de « Rendu à Manasse ».

---

## 2. Impôt plafonné (art. 118) et quotité pour charges de famille (art. 123)

**Texte lu** (`SK/fiscalite-rdc/code-general-2026/references/05-loi23-053-titre3-irpp.md`)
- Art. 118, al. 2 · « En aucun cas, l'impôt total ne peut excéder 30 % du revenu imposable. »
- Art. 123, al. 1er · « L'impôt établi par application de l'article 118 ci-dessus est réduit d'une quotité de 2 % pour chacun des membres de la famille à charge […] » ; al. 2 · « Aucune réduction n'est accordée sur l'impôt qui se rapporte à la partie du revenu imposable qui excède la troisième tranche du barème fixé à l'article 118 ci-dessus. »
- Le barème de l'art. 118 jusqu'au haut de la troisième tranche (43 200 000 FC annuels) donne 9 486 720 FC, soit 21,96 % · sous les 30 %. Seule la part du revenu qui excède la troisième tranche, taxée à 40 %, peut faire jouer le plafond.

**Décision · la réduction du plafond se rapporte à la part qui excède la troisième tranche.**
- L'art. 123, al. 2 rattache l'impôt aux parts du revenu. Or l'impôt qui se rapporte aux trois premières tranches ne peut jamais atteindre 30 % · il n'est jamais touché par le plafond. Le plafond ne mord qu'à cause de la quatrième tranche, et la réduction qu'il opère se rapporte donc à elle seule. C'est une lecture de la STRUCTURE du texte, pas une préférence.
- L'impôt qui se rapporte aux trois premières tranches reste celui que le barème leur impute (9 486 720 FC annuels au cas P03). C'est sur lui que la quotité de l'art. 123 s'applique. C'est la lecture qu'OmegaX applique déjà (2 216 800 FC par mois au cas P03).
- Les deux autres lectures sont écartées. Le prorata (2 219 700) et la borne basse (2 225 600) attribuent une part de la réduction du plafond aux trois premières tranches, que le plafond n'a jamais concernées.

**Effet pour OmegaX** · aucun changement de calcul (`personnel/bareme-irpp.ts`). La mention « LECTURE DE L'ÉDITEUR » devient la règle citée (art. 118, al. 2 ; art. 123) avec son fondement, sans « le texte ne dit pas ».

---

## 3. Indemnité de préavis d'un salaire mensuel pour un mois entamé

**Texte lu**
- Code du travail, art. 63, al. 3 (`SK/droit-travail-congolais/references/texte-loi-verbatim/04-titre-iv-du-contrat-de-travail.md`) · l'indemnité correspond « à la rémunération et aux avantages de toute nature dont aurait bénéficié le travailleur durant le délai de préavis qui n'a pas été effectivement respecté ».
- Art. 93 · « La rémunération est due pour le temps où le travailleur a effectivement fourni ses services […] ainsi que pour les jours fériés légaux ».
- Art. 7, point 9 · « Jour ouvrable : chaque jour de la semaine à l'exception du jour de repos hebdomadaire et des jours fériés légaux. » ; art. 121, al. 2 · le repos « a lieu le dimanche ».
- Arrêté n° 12/CAB.MIN/ETPS/042/2008 (livre de paie), art. 1er (`SK/droit-travail-congolais/references/livre-de-paie-decompte-ecrit/arrete-12-042-2008-modele-livre-de-paie.md`) · mention 5 « le salaire horaire, journalier ou mensuel » ; mention 6 « le nombre d'heures ou de jours pour lesquels le salaire est payé à 100 % ». Même un salaire MENSUEL se paie par JOURS PAYÉS.
- Décret n° 25/22 du 30 mai 2025, art. 7 · « La valeur hebdomadaire, mensuelle et annuelle du Salaire Minimum Interprofessionnel Garanti, de l'allocation familiale minimum et de la contre-valeur du logement s'obtient en multipliant par 6, 26 et 312. »

**Décision · mois entiers au salaire du mois, mois entamé à 1/26 du salaire mensuel par jour payable, du lundi au samedi, jours fériés compris.**
- Ce que le travailleur « aurait » reçu pendant un mois entamé, c'est le salaire des jours de ce mois compris dans le délai. Le livre de paie paie tout salaire, mensuel compris, par jours payés (mentions 5 et 6), et la rémunération est due pour les jours fériés (art. 93). Les jours payables sont donc ceux du lundi au samedi, fériés compris, le dimanche étant le repos (art. 7, point 9 ; art. 121).
- Le passage du mois au jour n'est écrit pour le salaire ordinaire nulle part ailleurs. La seule conversion légale entre valeur journalière et valeur mensuelle d'une rémunération est celle du décret n° 25/22, art. 7 · un mois vaut 26 jours. Elle s'applique ici par ANALOGIE de la loi la plus proche, et c'est dit.
- Contrôle de cohérence · un mois entier au salaire du mois (art. 63, al. 3) et 26 jours de 1/26 rendent la même somme. La règle ne crée ni ne retire rien au travailleur sur un mois plein.

**Effet pour OmegaX** · dans la ligne des corrections de la paie (`decompte-final.ts`), le mois entamé d'un salaire mensuel se chiffre par cette règle, citée. Ce n'est plus une réserve « à trancher par Manasse ».

---

## Ce qui reste à Manasse, et pourquoi ce ne sont pas des questions de droit

- **Ordonnance n° 84/186 du 15 octobre 1984** (modalités de paiement de la cotisation INPP). Le texte n'est pas au corpus · il s'agit de l'obtenir, pas de trancher.
- **Deux notes de compétences contraires au texte** (`fiscalite-rdc/irpp/NOTES.md` et son script ; `fiscalite-rdc/parafiscalite-sociale/NOTES.md`). Seul Manasse déploie les compétences (CLAUDE.md § 11).
- **Réglages GitHub** (secrets SMTP, clé Resend à révoquer, branches à supprimer) · gestes sur des comptes que seul Manasse tient.
