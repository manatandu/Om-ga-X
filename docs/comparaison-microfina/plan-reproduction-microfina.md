# Microfina++ · plan de reproduction des douze idées (2026-10-25)

**Décision de Manasse du 2026-10-25** · « pouvons-nous attaquer les
fonctionnalités de microfina ? », puis les douze idées du tableau « Les idées
les plus utiles » de `audit-manuel-microfina-306-pages.md`, toutes cochées.
La demande expresse lève le gel pour ces douze idées seules (CLAUDE.md § 5).

Le détail de chaque idée (page du manuel, état dans OmegaX, texte qui la
régirait) est dans l'audit, à la partie citée. Ce document ne fait que les
ranger en lignes et fixer l'ordre. Il ne décide aucune règle comptable · chaque
ligne lit ses textes avant d'écrire du code (§ 1), tranche par la loi, et
n'envoie à Manasse que ce que le corpus ne tranche pas.

## Les quatre lignes

| Ligne | Idées | Famille de fichiers | Points à lire avant tout code |
|---|---|---|---|
| **M1 · circuit d'approbation et concordance** | 1 · visa puis validation, objet par objet (écriture, OD, facture, règlement, puis commande quand M2 l'apporte), fiche « Saisie par / Approuvée par » ; 12 · écran unique de concordance des modules avec la comptabilité | `comptabilite/`, `facturation/`, `reglements/`, un module de lecture pour la concordance | AUDCIF art. 22, 2° et art. 69 ; SYCEBNL art. 16, 2) (l'art. 69 lui est exclu par son art. 3) ; § 10 ter (double regard, une OPTION, défaut faux) ; modèle de `tiers/visa-rib.ts`. La concordance ne CORRIGE rien · elle relit les confrontations que les modules tiennent déjà et dit « non calculé » plutôt qu'un zéro. |
| **M2 · achats et trésorerie** | 2 · bon de commande fournisseur qui crée l'engagement, exécuté par la facture ; 5 · arrêté de caisse par coupures et plafond d'encaisse ; 9 · registre des chèques émis | `analytique/` (engagement existant), `inventaire/` (procès-verbal de caisse), `banques/`, `rapprochement/` | SYCEBNL, Guide, Application 22 (engagement) ; fiche du compte 57 des deux plans ; AUDCIF art. 17 (pièce justificative) ; aucun texte lu pour le plafond d'encaisse ni le chéquier · conventions d'OmegaX, dites. Un plafond AVERTIT, il ne refuse pas sans texte. |
| **M3 · personnel** | 6 · retenue étalée, reprise d'office au bulletin ; 3 · missions et frais de mission ; 7 · demande de congé validée, titre de congé ; 10 · échéancier des fins de CDD et de période d'essai ; 8 · plan et suivi de la formation ; 11 · déclaration annuelle de la main-d'œuvre, chiffres seuls | `personnel/` | Code du travail art. 112 (liste fermée), 140 al. 4, 42 et 43 al. 4, 8, 218 et 219 (formulaire absent du corpus, dit) ; loi n° 23/053 art. 68, 1° et O.-L. n° 10/001 art. 41, 1° (frais de mission) ; ordonnance n° 84/186 art. 1er, al. 2 (réduction INPP). En deux lots dans l'ordre du tableau, la retenue et les missions d'abord (elles touchent le bulletin). |
| **M4 · détenteur d'un bien** | 4 · affectation à un salarié, transfert, libération, reçu signé, suivi sur une période | `immobilisations/` | aucun texte ne l'impose · aucune écriture ; lien avec `Salarie` et `LieuBien`, droits du registre du personnel (rôles cantonnés). |

## Ordre

1. **M1 et M2 d'abord**, en parallèle (familles disjointes). La ligne en
   cours `partiels-sage` (fonctions n° 73 et 78) touche `personnel/` et
   `immobilisations/` · M3 et M4 attendent son intégration sur `main`.
2. **M3 et M4 ensuite**, en parallèle.
3. La commande de M2 entre au circuit de visa de M1 par la ligne qui
   s'intègre la seconde.

Au plus trois agents à la fois (CLAUDE.md § 11), l'audit de sécurité en cours
compris.

## Ce que chaque ligne doit (définition de fini)

- branche de sauvegarde `travail/microfina-mN`, fiche `AVANCEMENT-microfina-mN.md`
  (fait, reste, décisions avec leur article, commandes), un commit par étape
  finie (§ 5) ;
- chaque règle cite sa source en commentaire, chaque convention d'OmegaX est
  dite comme telle, aucune règle du manuel contraire à un texte reprise
  (R1 à R4 de la partie C) ;
- refus serveur et masquage écran aux deux endroits ; `@Roles` sur toute
  route qui écrit (`ecritures-reservees.spec.ts`) ; journal d'audit sur les
  actes ; aucune collection sans borne (§ 8 bis) ;
- un scénario sur VRAIE base, par l'API du serveur compilé, à travers une
  clôture (§ 10), chaque solde touché lu contre le montant calculé à la main ;
- le bloc du § 3 des deux côtés, les tests navigateur, puis deux tours de
  relecture (relecteur comptable, `silent-failure-hunter`,
  `typescript-reviewer`, `react-reviewer`) ;
- intégration sur `main` l'une après l'autre, déploiement relu.

## Suivi

| Ligne | État |
|---|---|
| M1 | à lancer |
| M2 | à lancer |
| M3 | attend l'intégration de `partiels-sage` |
| M4 | attend l'intégration de `partiels-sage` |
