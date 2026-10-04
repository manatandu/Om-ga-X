# AVANCEMENT · ligne A5 ter

Branche de sauvegarde `travail/a5ter`, partie de `main` 7e4aaa4. Fiche retirée
à l'intégration.

## Périmètre

Ligne A5 ter de `docs/suivi-immobilisations-verrouille.md`, plus les relevés
d'A5 bis renvoyés vers elle.

1. SYCEBNL · risque de change à moins d'un an hors du 194.
2. Titres de placement (50) et titres immobilisés (274) hors réévaluation.
3. Subdivisions 478 / 479 au SYCEBNL.
4. Le 54 en 4786 / 4797.
5. Message d'annulation dont l'issue ne lève rien.
6. Relevés d'A5 bis · (a) L1 et la contre-passation déjà juste ; (b) L1
   borné à l'exercice cible ; (c) contre-passation déclarée et
   `reevaluation-et-ecart-realise.ts` ; (d) contrôle 32 et OD déclarée qui
   inverse la banque ; (e) contre-passation sans à-nouveau qui fait foi.

## Fait

- Points 1 à 4 · familles de provision du SYCEBNL, subdivisions 478 / 479
  aux deux plans, 54 au 4786 / 4797, titres 274 et 50 hors réévaluation
  (`devises.service.ts`, `perimetre-reevaluation.ts`, specs
  `provision-change-ajustee`, `reevaluation`, `perimetre-reevaluation`,
  lexique client, CLAUDE.md).

## Décisions, avec leur article

1. SYCEBNL, risque de change à moins d'un an · LE TEXTE TRANCHE, la règle
   « 194 seul » de CLAUDE.md était fausse. Fiche SYCEBNL du compte 19
   (Partie 2 ch. 3) · contenu « réalisation prévisible à plus d'un an » ;
   exclusions « les provisions correspondant à des risques à moins d'un an
   (utiliser 499 – Provisions pour risques à court terme) ». Fiche du 49 ·
   « 499 Provisions pour risques et charges à court terme (4991 sur
   opérations d'exploitation, 4998 sur opérations H.A.O.) », crédité par le
   659 (exploitation) ou le 839 (H.A.O.), repris par le 759 ou le 849. Fiche
   du 59 · 599 « Provisions pour risques à court terme à caractère
   financier », « exemple : provisions pour pertes de change », par le 679,
   repris par le 779. D'où, au SYCEBNL · exploitation 6591 / 4991 / 7591 ;
   H.A.O. (48) 839 / 4998 / 849 ; financier court (56) 6791 / 599 / 7791 ;
   financier long (18, 27) 6971 / 194 / 7971. Phrase de CLAUDE.md corrigée
   avec la citation. Une provision passée au 194 avant la ligne pour une
   créance se reprend d'elle-même au 7971 à la réévaluation suivante (rien
   à déclarer).
2. Titres 274 et 50 · TRANCHÉ. AUDCIF Titre VIII ch. 22 § 1.3 vise « les
   titres » sans distinction de classe (« prix d'acquisition, converti au
   cours du jour de l'opération ») ; la fiche du compte 50 range les titres
   aux 26, 274 et 50. Hors réévaluation, motif « § 1.3 ». Restent réévalués
   506 et 276 (intérêts courus · des créances de revenus, fiches 50 et 27).
   Le 508 « Autres titres de placement et créances assimilées » est lu comme
   titre (rangé sous « Titres de placement »).
3. Subdivisions 478 / 479 au SYCEBNL · TRANCHÉ par son plan (Partie 2 ch. 2,
   compte 47 · 4781 [47811, 47818], 4782, 4783 [47831, 47838], 4784, 4786,
   4788 ; 479 « 4791 à 4798, symétrique »), semés en détail. La racine
   générique rendait 47811000 / 47911000 pour tout. Le 48 est H.A.O. au
   SYCEBNL (47818 / 47838 / 47918 / 47938) ; au SYSCOHADA, dont le plan
   n'ouvre que 4781 « d'exploitation », il reste d'exploitation.
4. 54 · TRANCHÉ. Ch. 22 § 3.2.2 et fiche AUDCIF du compte 47 · « 4786 … et
   4797 … enregistrent les différences d'évaluation en contrepartie du compte
   54 » ; art. 58-2 · perte à l'actif, gain au passif, « provision
   financière » pour la perte latente · la provision reste 6791 / 4997
   (§ 2.3, court terme financier). Le SYCEBNL n'a pas de 54.

## Reste

- Point 5 (message d'annulation), relevés (a), (b), (c), (d), (e).
- Bloc du § 3 complet, scénario sur vraie base aux deux référentiels.

## Vérification

```bash
npx tsc --noEmit
npx jest src/modules/devises src/modules/controles
cd client && npx tsc --noEmit && npx vitest run
```
