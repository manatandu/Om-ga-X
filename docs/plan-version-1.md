# Plan de la version 1 · stabiliser avant de vendre (2026-10-08)

Décision de Manasse du 2026-10-08 : « Geler les nouveautés et se concentrer sur
les plus importants ». Le logiciel s'est élargi plus vite qu'il n'a été éprouvé
sur ce qui sert tous les jours. Avant la vente, l'ordre s'inverse : on éprouve
ce qu'un client fait chaque mois et chaque année, on corrige ce qui bloque ou
fausse un montant, et rien de neuf n'entre.

## 1. Le gel

- Aucune nouvelle fonction et aucune nouvelle ligne de cas limite n'entrent sur
  `main` avant la version 1.
- Entrent seulement :
  - les deux lignes en cours au moment du gel, `lettrage-cloture` (lettrage
    partiel reconduit à la clôture) et `tva-decisions` (TVA des factures
    annulées, perte d'une créance avec duplicata, trop-payé de liquidation) ;
  - la correction d'un défaut BLOQUANT ou MAJEUR trouvé sur un parcours du
    périmètre ci-dessous.
- Une demande nouvelle, ou un relevé hors périmètre, se note au suivi
  (`docs/suivi-immobilisations-verrouille.md`), il ne se code pas.

## 2. Le périmètre de la version 1 · à valider par Manasse

Trois dossiers types, chacun tenu sur deux exercices complets, clôture comprise.

### Parcours communs aux trois dossiers

1. Création du dossier depuis la console, utilisateurs et rôles, double
   authentification.
2. Reprise · import de la balance ou du bilan d'ouverture, devises comprises.
3. Saisie · journaux, pièces, modèles de saisie, brouillard, validation.
4. Tiers · comptes individuels, lettrage (manuel, automatique, pré-lettrage),
   Règlement des tiers, relances.
5. Trésorerie · comptes en francs et en dollars, rapprochement bancaire avec
   relevé importé, procès-verbal de comptage de caisse.
6. Immobilisations · acquisition, amortissement linéaire, sortie.
7. Paie · salariés et contrats, bulletins, retenues (CNSS, INPP, ONEM, IRPP),
   passation au journal, échéancier des reversements.
8. Clôture · charges à payer et produits à recevoir, charges et produits
   constatés d'avance, dépréciation d'une créance douteuse, réévaluation des
   devises, clôture annuelle, à-nouveaux, affectation du résultat.
9. États · bilan, compte de résultat, flux de trésorerie, notes annexes,
   liasse Excel, balance, grand livre et journal exportés.
10. Contrôles de clôture et restitution complète du dossier.

### Propre à chaque dossier type

- **Association (SYCEBNL, jeu associations)** · cotisations et méthode déclarée,
  dons et legs, registre des donateurs, fonds affectés, subvention
  d'investissement, bien reçu en don, notes 1 à 35.
- **Projet de développement (SYCEBNL)** · fonds du bailleur, budget par
  rubrique, achats d'équipement, tableau emplois-ressources, exécution
  budgétaire, réconciliation de trésorerie, notes 1 à 24.
- **SARL (SYSCOHADA, système normal, assujettie à la TVA)** · factures de vente
  et d'achat avec TVA, acompte client, facture en dollars réglée en partie,
  stocks en inventaire intermittent, cession d'un bien, déclaration et
  liquidation de la TVA, résultat fiscal, acomptes et écriture d'impôt, notes
  1 à 36.

## 3. Hors version 1 · laissé éteint pour les premiers clients

Rien n'est retiré du logiciel. Ces fonctions restent dans le code, mais elles
ne sont ni activées ni présentées aux premiers clients, et aucune passe ne les
éprouve avant la version 1 :

- modules activables (`tenant/modules-optionnels.ts`) · consolidation, IFRS,
  révision approfondie (circularisation, faiblesses du contrôle interne) et
  gestion commerciale (devis), laissés éteints à la création du dossier ;
- groupe (siège et cellules), dissolution et liquidation d'une société,
  réévaluation légale des immobilisations, couverture de change (non construite).

Ce qu'un texte impose à tous reste toujours au menu : facturation, inventaire
physique, provisions, documents obligatoires, registre des donateurs.

## 4. Les passes

- Une passe, c'est les trois dossiers joués de bout en bout sur une base
  PostgreSQL jetable par l'API du serveur compilé, puis les parcours principaux
  dans le navigateur. Chaque solde est lu contre le montant calculé à la main.
- Après chaque passe, on corrige les défauts BLOQUANT ou MAJEUR du périmètre,
  avec leur test, et le reste va au suivi.
- **La version 1 est prête quand deux passes de suite ne trouvent aucun défaut
  BLOQUANT ni MAJEUR.**

## 5. Le pilote

Un ou deux dossiers réels de VMG Consulting, tenus dans OmegaX en parallèle de
l'outil actuel pendant un à deux mois. À chaque fin de mois, on compare les
balances et les états. La vente commence après un pilote sans écart.
