# Avancement · ligne virement de fonds

Demande de Manasse du 2026-10-09 · virer des fonds banque à banque, banque à
caisse, caisse à banque, caisse à caisse, chaque côté dans son journal, avec
pièces et informations justificatives, quatre comptes de passage par défaut.

## Décisions prises, avec leur texte

- **Le 585, pas le 581.** AUDCIF Titre VII, compte 58 · 581 « Régies
  d'avance » (fonds des régisseurs), 585 « Virements de fonds », comptes de
  passage « soldés au terme de leur utilisation » ; le SYCEBNL (Partie 2
  ch. 3, compte 58) n'ouvre que 585 et 588. Dit à Manasse avant de coder.
- Quatre sous-comptes 58500001 à 58500004, un par sens, personnalisés,
  semés à la création du dossier (`seedPlan`) et migrés pour les autres
  (`20270165000000_virements_de_fonds`), rouverts au premier virement s'il
  en manque (`assurerComptesDePassage`).
- Deux pièces nées ensemble · origine D 585 / C sa trésorerie, destination
  D sa trésorerie / C 585, même date, une transaction.
- Pièce justificative exigée · nature, référence, date, objet (AUDCIF
  art. 17, 3° et 5°, non écartés par l'art. 3 du SYCEBNL). Porteur des
  espèces exigé dès qu'une caisse est en jeu · convention d'OmegaX, dite.
  Fichiers joints facultatifs, mêmes règles que les documents des tiers.
- Annulation · brouillard supprimé, validée inscrite en négatif (AUDCIF
  art. 20, al. 2) ; refus si une ligne est lettrée ou pointée, ou l'exercice
  clos.
- Journal dont le RIB est en devise refusé (monnaie de tenue, loi n° 23/053
  art. 141, 1°).
- 585 et 588 exemptés du refus « compte du plan subdivisé » en saisie
  (`estCompteDePassage`), sans quoi le 58500000 se fermait dès les quatre
  sous-comptes ouverts.
- Gel levé pour cette fonction · à écrire au § 5 de CLAUDE.md.

## Fait

- Schéma et migration (954c4d2), `prisma migrate diff` sans écart.
- Service, contrôleur, module, listes structurelles, exemption 585/588, semis.
- Tests du module (30), doublures complétées, serveur et client au vert.
- Écran Traitement > Tiers et trésorerie > Virement de fonds, cache du plan.
- Scénarios navigateur sur vraie base à travers une clôture, SYSCOHADA et
  SYCEBNL (`e2e/tests/virements-fonds.e2e.ts`), au vert en local.
- CLAUDE.md (paragraphe de la ligne, gel levé pour elle).

## Reste

1. Relectures (silent-failure-hunter, typescript-reviewer, react-reviewer) ·
   lancées puis arrêtées, la limite d'utilisation approchant · à relancer.
2. Bloc § 3, intégration sur `main`, déploiement vérifié, fiche retirée.

## Vérification

```bash
npx tsc --noEmit && npx jest src/modules/virements-fonds
(cd client && npx tsc --noEmit && npm test)
```
