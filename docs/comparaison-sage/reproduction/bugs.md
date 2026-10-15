# Défauts relevés par les essais de parité

Seul ce qui a été REPRODUIT figure ici. Gravité de la compétence de
réplication · S1 perte de données, faille, montant faux, parcours principal
bloqué ; S2 fonction cassée sans contournement ; S3 cassée avec
contournement, ou visiblement fausse ; S4 cosmétique. Classement du dépôt
(CLAUDE.md § 11) en regard · BLOQUANT seulement pour un montant faussé en
silence, un geste juste refusé sans issue, un dossier enfermé.

### B-PAR-01 : deux lettrages envoyés en même temps sur un même compte, le second rend une 500

- Gravité : S3 (contournement · relancer le geste) · pas BLOQUANT au sens du
  dépôt (aucun montant faux, aucune donnée touchée, le geste réussit au
  second essai)
- Flux / cas : F16 / F16-E2
- Écran : Lettrage (et toute route qui pose un groupe manuel sur un compte)
- Construction : `a503f49` · Navigateur : Chromium, appels par l'API de la page

Étapes
1. Sur un compte fournisseur, passer quatre pièces qui forment deux couples
   soldés (facture et avoir de même montant, deux fois).
2. Envoyer en même temps `POST /comptes/:compteId/lettrage` pour le premier
   couple et pour le second, avec la même lettre choisie (`{ lettre: 'Q' }`),
   ou sans lettre (la lettre proposée).

Attendu : un groupe est posé, l'autre envoi est refusé par un message nommé
(4xx), comme le dit déjà le libellé « Trop de lettrages effectués au même
instant sur ce compte · veuillez réessayer. ».
Constaté : le premier passe (200), le second rend une 500. Sur trois envois
simultanés sans lettre, 200, 500, 200. La base reste juste · la contrainte
unique (`compteId`, `code`) refuse le doublon, et aucune lettre n'est
portée deux fois.
Preuve : journal du serveur, `PrismaClientKnownRequestError · Unique
constraint failed on the fields: (compteId, code)` levée par
`ExceptionsHandler` ; sonde jetable du 2026-10-15 (retirée du dépôt, elle
ferait tomber le portillon), « SONDE choisie 200,500 · proposée 200,500 ·
proposée x3 200,500,200 ».
Cause présumée : le lettrage manuel tourne dans une transaction sérialisable
(`common/prisma-retry.util.ts`), qui ne reprend que l'échec de
sérialisation (P2034). Deux transactions qui posent la même lettre se
heurtent sur la contrainte unique, P2002, qu'elle ne reconnaît pas. Le
défaut est antérieur à la ligne sage-l1 (la lettre proposée l'a aussi) ;
la lettre choisie en hérite.
Correction proposée, non faite : reconnaître dans ce garde la violation de
la contrainte unique du groupe de lettrage comme un conflit, rejouée ou
rendue en 409 avec le même libellé ; un test navigateur à deux envois
simultanés l'éprouve.
Statut : ouvert · noté au suivi (`docs/suivi-reprises.md`) sous le gel des
nouveautés, qui n'admet que BLOQUANT et MAJEUR.

## À vérifier (non reproduit)

- Une même lettre DANS le même compte posée par un lettrage AUTOMATIQUE et un
  lettrage manuel simultanés · même garde, même contrainte, vraisemblablement
  même 500 ; non rejoué.
- Un intitulé de séquence de 35 caractères dont l'un est un émoji · la
  longueur est comptée en unités UTF-16 (`intitule.length`), si bien qu'un
  émoji compte pour deux et que « 35 caractères » peut être refusé à 34
  caractères visibles. Sage ne connaît pas l'émoji ; S4 au plus, non rejoué.
