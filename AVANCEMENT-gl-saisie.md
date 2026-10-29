# Avancement · ligne gl-saisie

Gel levé par Manasse le 2026-10-29 (`docs/plan-gel-leve-2026-10-29.md`, § 4).
Fonctions du tri · 2, 13, 15, 33, 34, 35, 56, 57, 58, 64, 97. Branche de
sauvegarde `travail/gl-saisie`, partie de `origin/main` (92c8b5810).

## Fait

| # | Fonction | Où |
|---|---|---|
| 2 | Échéance obligatoire sur la ligne d'une facture de tiers, option du dossier (faux par défaut) | `comptabilite/echeance-obligatoire.ts`, `Tenant.echeanceObligatoireTiers`, `PATCH /dossier/echeance-obligatoire`, Paramètres du dossier |
| 13 | Interroger le compte depuis la saisie · solde (livre-journal, brouillard, à-nouveau provisoire) et dernières lignes | `comptabilite/interrogation-compte.service.ts`, `GET /interrogation-compte/:compteId`, `ModaleInterrogationCompte` (F2 ou double-clic dans la saisie) |
| 15 | Créer un modèle de saisie depuis la pièce en cours | `client/src/lib/modele-depuis-piece.ts`, `ModaleModeleDepuisPiece` (bouton « Créer un modèle… » de la saisie), route existante `POST /modeles-saisie` |
| 97 | Aller à une fonction par son nom · F7, ou Fenêtre > Aller à une fonction… | `client/src/components/chrome/commandes-du-menu.ts`, `AllerAFonction.tsx`, `AppShell.tsx` |
| 57 | Filtres de la balance des tiers · tous, mouvementés dans la période, soldés, non soldés | `client/src/lib/filtre-balance-tiers.ts`, `BalanceAuxiliairePage` |
| 58 | Filtre du rapprochement · toutes les lignes, rapprochées, non rapprochées | `client/src/lib/filtre-rapprochement.ts`, `RapprochementDetailPage` |
| 56 | Grand livre avec ou sans les écritures lettrées (vue de travail de l'écran) | `client/src/lib/grand-livre-sans-lettrees.ts`, onglet Grand livre de `JournalPage` |
| 64 | Révision par écriture · marquer revue (auteur, date, commentaire), retirer, filtrer revues ou à revoir | `RevueEcriture` (`revues_ecritures`), `comptabilite/revue-ecritures.service.ts`, `POST /revues-ecritures`, `DELETE /revues-ecritures/:ecritureId`, `GET /ecritures?revue=oui\|non` (et son export), fenêtre Journal |
| 33 | Recouvrement · exclure UNE ligne de la relance (motif), décaler son échéance (motif) ; pénalités et frais écartés | `DecisionRelanceLigne` (`decisions_relance_lignes`), `relances/decision-relance-ligne.ts`, `PATCH /relances/lignes/:ligneId/exclusion` et `/echeance`, fenêtre Rappel et relevé |
| 34 | Alertes sur les échéances proches des tiers au tableau de bord · à encaisser, à payer dans trente jours, déjà échu | `comptabilite/echeances-tiers.service.ts`, `GET /echeances-tiers`, panneau « Échéances des tiers » de `DashboardPage` |
| 35 | Avis de règlement envoyé au tiers par la messagerie existante | `reglements/envoi-avis-reglement.service.ts`, `POST /ordres-virement/:id/avis-reglement/envoi`, origine `AVIS_REGLEMENT` de la file, bouton « Envoyer par courriel » des ordres de virement |
| rejeu | Rejeu sur vraie base à travers la clôture de 2026 (fonctions 2, 13, 33, 34, 64) | `scripts/rejouer-gl-saisie.cjs` · seize contrôles, tous conformes |

## Reste

Relecture adverse (deux tours), puis intégration par Manasse.

## Décisions, avec leur fondement

- **2 · la ligne jugée est celle de la FACTURE**, la même que celle qui reçoit
  l'échéancier du modèle de règlement (`motifSansEcheancierDuModele`, une seule
  règle) · fournisseur crédité (40), client débité (41), fiches des comptes 40
  et 41 des deux plans ; hors 408, 418, 409, 419, 416 et hors journal de
  trésorerie. Aucun texte n'impose l'échéance sur la pièce (AUDCIF art. 17,
  19) · option d'organisation, fausse par défaut. Jugée à la SAISIE seule, au
  contrôleur, comme le collectif · ni modules, ni clôture, ni imports.
- **13 · trois sommes, jamais fondues sans le dire** · livre-journal (validées, AUDCIF art. 22, 2°), brouillard, à-nouveau provisoire ; simulations et solde des comptes de gestion hors de tout (balance à trois colonnes) ; bornée aux quinze lignes les plus récentes, le total dit. Ce n'est pas le grand livre.
- **15 · aucune règle à part** · la pièce se traduit en modèle (taxe en « Calculer » avec son taux, dernière ligne hors taxe en « Équilibrer » sur demande, montants figés sur demande seulement) et part par la route des modèles, qui garde ses refus ; un spec rejoue la traduction contre `motifRefusFonctions` du serveur.
- **97 · la liste est celle du menu affiché**, jamais une seconde table · tirée des menus déjà filtrés (référentiel, profil, modules, rôle, logiciel), ouverte par le même geste que le menu, donc par le même aiguillage (masquer n'est pas refuser). Le menu Fenêtre n'y est pas. Le Ctrl+J de Sage (tiers suivant) est écarté · la fiche du tiers n'a pas de parcours séquentiel à servir.
- **57 · le filtre se dit, le total général reste** · « mouvementé » = un débit ou un crédit dans la période, le report seul ne mouvemente pas ; « soldé » = solde nul au centime (définitions d'OmegaX, dites dans la bulle). Le total des comptes retenus s'affiche à part sous son nom, le total de tous les comptes demeure, l'en-tête imprimé nomme le filtre ; l'export porte toujours la balance entière.
- **58 · la liste se restreint, les soldes non** · lignes du compte et en-cours d'ouverture, le nombre caché dit ; sur une liste déjà tronquée par le serveur, le filtre ne lit que la tranche servie, et c'est dit.
- **56 · une vue de travail, jamais le livre** · le grand livre porte tous les mouvements de l'exercice (AUDCIF art. 19) ; la case retire les seules lignes lettrées (groupe soldé), les dit avec leurs montants sous chaque compte, garde les totaux du livre entier et le vrai solde progressif. L'export Excel reste le livre entier · aucune version filtrée d'un livre obligatoire ne sort en fichier. Devise et regroupement par mois écartés au tri.
- **64 · une marque à côté de l'écriture validée, jamais en elle** · l'écriture validée est irréversible (AUDCIF art. 22, 2°) et la marque ne touche ni origine, ni contenu, ni imputation (art. 22, 1°) ; le brouillard est ÉCARTÉ et nommé, jamais revu (sa pièce change encore) ; la première revue ne se réécrit pas ; une création et un retrait unitaires, au journal d'audit ; revoir est le geste du comptable (`@ReserveAuComptable`, fonction REVISION). Un journal filtré sur la revue est une RECHERCHE · il ne s'enregistre pas comme imprimé (`estUneRecherche`).
- **33 · la décision vit à côté de la ligne, seule la relance la lit** · la ligne validée ne se réécrit pas (AUDCIF art. 22, 2°) ; EXCLURE porte sur le courrier, jamais sur la créance (la ligne se montre, dite exclue, hors du dû, du retard et de la lettre) ; DÉCALER recule le terme accordé au débiteur, « ce qui n'est dû qu'à terme ne peut être exigé avant l'échéance du terme » (Code civil, Livre III, art. 84), jamais ne l'avance, le terme étant présumé en faveur du débiteur (art. 85). Balance âgée, notes et échéancier gardent l'échéance de la pièce (limite écrite). Sur une facture VALIDÉE, non lettrée, d'un 40 ou d'un 41 ; motif exigé, auteur et date posés par le serveur ; la décision SUIT LE REPORT (pièce d'origine retrouvée par `originesDesReports`). Pénalités de retard et frais d'impayés écartés au tri (aucun taux au corpus).
- **34 · deux alertes, aucune affirmation** · factures ouvertes des 40 et 41 au sens normal (`estEcheanceAReglerSur`), une facture réglée en partie pour son reste (`poidsDesLignesLues`, la lecture de l'échéancier) ; à échoir dans trente jours (convention d'OmegaX, comme le panneau fiscal) et déjà échu, comptés sur tout le périmètre, la liste bornée aux vingt plus proches et dite ; une ligne sans échéance n'alerte pas, elle est comptée à part ; jour de Kinshasa pris par le serveur ; jamais « à jour ».
- **35 · la file, jamais un second chemin d'envoi** · le texte est celui de l'avis imprimé (même lecture, modèle du tiers, signature, imputation déclarée en payant, Code civil, Livre III, art. 151) ; mêmes refus (ordre annulé ou non imprimé) ; écrit en file sans envoi tenté (comme les relances, F241), parti par la reprise bornée ; un avis en file, en échec retenté ou envoyé ne repart pas (verrou du dossier, une transaction), un avis abandonné se renvoie ; un tiers sans adresse est nommé.
- **Relecture adverse (deux tours, faite en interne · aucun agent relecteur disponible dans cette session)** · aucun BLOQUANT ; retenus et corrigés · la relation de la décision de relance vers sa ligne passe de CASCADE à RESTRICT, comme les autres décisions posées sur une ligne validée (`RELATIONS_VERS_UNE_LIGNE`) ; un journal filtré sur la revue est une recherche (jamais enregistré comme imprimé) ; le retrait d'une revue se confirme ; la décision d'un groupe lu en bloc vaut pour la ligne qui porte son net (limite écrite). Écartés · pénalités de retard et frais d'impayés (fonction 33, aucun taux au corpus) ; devise et regroupement par mois du grand livre (fonction 56) ; Ctrl+J, tiers suivant (fonction 97).

## Commandes de vérification

```bash
npx tsc --noEmit && npx jest && npm run build
(cd client && npx tsc --noEmit && npm test && npm run build)
npx prisma migrate diff --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url <base jetable> --exit-code
```
