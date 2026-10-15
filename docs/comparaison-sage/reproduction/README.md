# Reproduction des fonctions de Sage cochées le 2026-10-14

Manasse a trié les 103 absences de la comparaison (`../15-absents-a-trier.md`)
et coché 41 fonctions « À faire ». Ce dossier conduit leur reproduction
dans OmegaX, selon la méthode du paquet replica (carte, architecture,
construction, essais, écart), ramenée à un logiciel qui existe déjà.

| Fichier | Rôle |
|---|---|
| `recon.md` | Ce que Sage fait, fonction par fonction, d'après les manuels lus, et ce qu'OmegaX fait aujourd'hui. |
| `architecture.md` | Les règles, les décisions prises par la loi avant de coder, la place de chaque fonction dans les menus et dans le code, les lignes de travail et leur ordre. |
| `features.csv` | La matrice : une ligne par fonction, sa ligne de travail, sa priorité, et la colonne `clone` (no, partial, yes) tenue à jour. |
| `build-log.md` | Le journal de construction : une entrée par fonction finie ou partielle, ce qui manque, ce qui a été plus dur que prévu. |
| `test-plan.md` | Les essais des fonctions construites, cas par cas (parcours, bords, refus), ce qui les éprouve et ce qui a tourné. |
| `bugs.md` | Les défauts reproduits par ces essais, au format de la compétence de réplication, et ceux qui restent à vérifier. |
| `parity.md` | Le score de parité sur la matrice, ce qui reste dans l'ordre de construction, les différences de comportement gardées à dessein. |

Priorité : `must` pour les quatorze fonctions conseillées « À faire » avant
le tri, `could` pour les trois plus lourdes (gestion commerciale complète,
langue, personnalisation), `should` pour les autres. Rien n'est écrit de
mémoire : chaque compte, article ou taux se lit dans sa source au moment
de le coder (CLAUDE.md, § 1).
