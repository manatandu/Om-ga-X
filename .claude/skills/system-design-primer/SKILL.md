---
name: system-design-primer
description: Guide de conception de systèmes à grande échelle (The System Design Primer, Donne Martin). À employer pour raisonner sur la capacité, la répartition de charge, le cache, les files de messages, la cohérence et la disponibilité d'un service, ou pour relire l'architecture d'OmegaX sous cet angle. Ne sert jamais de source comptable, fiscale ou juridique.
---

# The System Design Primer

Recueil organisé de notions et d'exercices de conception de systèmes, de Donne Martin
(licence CC BY 4.0, jointe en `LICENSE.txt`). Les textes sont COPIÉS tels quels dans
`references/` ; rien n'y est exécuté, et rien ne s'en importe dans le code d'OmegaX.

## Quand l'employer

- Dimensionner ou expliquer une limite de capacité (pool de connexions, mémoire, nombre
  d'instances, plafond de fenêtre).
- Choisir ou relire une stratégie de cache et son invalidation.
- Décider si un traitement long relève d'une file de tâches ou reste dans la requête.
- Poser un compromis cohérence contre disponibilité, ou une reprise après sinistre.
- Préparer une revue d'architecture : montrer ce qu'OmegaX fait déjà, et ce qui ne lui
  convient pas.

## Où lire

| Besoin | Fichier |
|---|---|
| Table des matières, notions, tableaux de chiffres à connaître, questions d'entretien | `references/README.md` |
| Exercices corrigés de conception (pastebin, Twitter, crawler, cache de requêtes, agrégation de comptes bancaires `mint`, graphe social, classement des ventes, mise à l'échelle sur AWS) | `references/solutions/system_design/<exercice>/README.md`, et les `.py` du même dossier |
| Exercices de conception orientée objet | `references/solutions/object_oriented_design/<exercice>/` |

Les images et schémas ne sont pas dans la compétence ; ils sont dans la source entière,
`.claude/amont/system-design-primer/images/` et `.../solutions/`. Les traductions
(japonais, chinois) ne sont pas reprises.

## Comment s'en servir ici

1. LIRE la section concernée AVANT d'en citer une règle, un chiffre ou un nom de motif ;
   ne jamais citer de mémoire.
2. Confronter chaque idée à ce qu'OmegaX tient déjà, lu dans `CLAUDE.md` (§ 5 pour le
   déploiement et les plafonds, § 8 bis pour les volumes, § 10 bis pour ce qui casse en
   silence) et dans `docs/capacite-mesuree.md`, `docs/connexions-et-plafonds.md`,
   `docs/temps-de-chargement.md`. Un chiffre du primer est un ordre de grandeur, jamais
   une mesure d'OmegaX.
3. Ce que le primer conseille pour des millions d'utilisateurs n'est pas un défaut
   d'OmegaX. La contrainte d'OmegaX est la JUSTESSE et l'AUDITABILITÉ des écritures
   (AUDCIF art. 22), pas le débit. Écarter d'office pour le livre-journal, le grand
   livre, la balance et la numérotation des pièces : la cohérence éventuelle, le
   partitionnement qui sépare une écriture de ses lignes, toute lecture périmée servie
   comme un solde.
4. Une proposition se dit comme une proposition. Aucune ligne n'entre sur `main` sans la
   demande de Manasse (gel des nouveautés, `CLAUDE.md` § 5).

## Ce que cette compétence ne fait pas

- Elle ne dit rien du plan de comptes, des états, des taux ni du droit : voir `sycebnl`,
  `syscohada`, `audcif-acte-uniforme`, `droit-asbl-ong-rdc`, `fiscalite-rdc`.
- Elle ne remplace pas `sage-i7` pour les patterns d'un logiciel de gestion.
- Elle ne prime jamais sur `CLAUDE.md`.
