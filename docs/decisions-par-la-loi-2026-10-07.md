# Six questions tranchées par la loi (lecture du 2026-10-07)

Préfixe des compétences : `/root/.claude/skills/synced/80921ba8-…/` (abrégé `SK/`).
Les six questions sont celles que la ligne F32 avait laissées ouvertes
(`docs/suivi-immobilisations-verrouille.md`, relevé du 2026-10-07). Règle
appliquée : décision de Manasse du 2026-10-03, « réfère-toi toujours à la loi ».
Chaque décision cite le texte lu ; ce qu'aucun texte ne dit est écrit comme tel.

---

## 1. Associé unique personne morale et procédure collective

**Texte lu**
- AUSCGIE, art. 200 (`SK/auscgie-acte-uniforme/references/partie1-livre7-dissolution-liquidation.md`) · « La société prend fin : […] 6°) par l'effet d'un jugement ordonnant la liquidation des biens de la société ».
- AUSCGIE, art. 201, al. 4 · « La dissolution d'une société dans laquelle tous les titres sont détenus par un seul associé entraîne la transmission universelle du patrimoine de la société à cet associé, sans qu'il y ait lieu à liquidation. » Al. 5 · non applicable quand l'associé unique est une personne physique.
- AUSCGIE, art. 203, al. 2 · les dispositions de la liquidation « ne s'appliquent pas lorsque la liquidation intervient dans le cadre des dispositions de l'Acte uniforme portant organisation des procédures collectives d'apurement du passif ».
- AUPCAP, art. 53 (`SK/aupcap-acte-uniforme/references/titre-3-ch3-effets-debiteur.md`) · « La décision qui prononce la liquidation des biens d'une personne morale emporte, de plein droit, dissolution de celle-ci. » Elle emporte « dessaisissement pour le débiteur de l'administration et de la disposition de ses biens » ; les actes « sont accomplis ou exercés […] par le syndic agissant seul ».

**Décision**
- La transmission universelle de l'art. 201, al. 4 suppose une dissolution hors procédure collective. Quand la dissolution résulte d'un jugement de liquidation des biens (art. 200, 6°), le patrimoine est sous le dessaisissement de l'AUPCAP, art. 53 · il est réalisé par le syndic pour les créanciers, il ne peut pas passer à l'associé. L'art. 203, al. 2 renvoie lui-même à l'AUPCAP. Les deux textes ne se contredisent pas, ils se succèdent · l'AUPCAP régit le cas qu'il vise.
- Le régime « procédure collective » est donc ADMIS avec un associé unique personne morale. Seuls la nomination d'un liquidateur et le régime amiable ou judiciaire de l'AUSCGIE restent refusés (art. 201, al. 4).

**Effet pour OmegaX**
- Lever le refus du régime PROCÉDURE_COLLECTIVE quand l'associé unique est une personne morale.
- Rien d'autre ne change · sous procédure collective, le planning le dit et ne calcule rien, la mention de l'art. 204 n'est pas servie (art. 203, al. 2 écarte le chapitre qui la porte).

---

## 2. La période du 1er janvier à la date de dissolution

**Non codé dans cette ligne** · sorti le 2026-10-07 après le premier tour de relecture, repris sur la branche `travail/dissolution` avec les constats et les questions de droit restées ouvertes (`docs/dissolution-a-reprendre.md`). Le comportement de `main` (ligne F32) reste celui du dossier.

**Texte lu**
- AUDCIF, art. 7 (`SK/audcif-acte-uniforme/references/titre-1-ch1-3-champ-organisation-etats.md`) · « L'exercice coïncide avec l'année civile. » Al. 4 · « En cas de cessation d'activité, pour quelque cause que ce soit, la durée des opérations de liquidation est comptée pour un seul exercice, sous réserve de l'établissement de situations annuelles provisoires. »
- AUDCIF, Titre VIII ch. 40 § 2.1 · « le début de la liquidation : inventaire du patrimoine, solde des amortissements et des provisions existants, établissement du bilan avant liquidation ».
- AUSCGIE, art. 204 · « La société est en liquidation dès l'instant de sa dissolution » ; art. 205 · la personnalité morale subsiste jusqu'à la publication de la clôture ; art. 232 et 233 · pendant la liquidation, états annuels dans les trois mois de la clôture de chaque exercice, assemblée dans les six mois.
- Loi n° 23/053, art. 12, al. 1 (`SK/fiscalite-rdc/code-general-2026/references/04-loi23-053-titre2-impot-societes.md`) · « Les contribuables sont tenus d'arrêter chaque année leurs comptes à la date du 31 décembre, sauf en cas de cession ou de cessation d'activité en cours d'année. » Al. 4 · « Lorsqu'il est dressé des bilans successifs au cours d'une même année, les résultats en sont totalisés pour l'assiette de l'impôt dû au titre de ladite année. »
- Loi n° 23/053, art. 13 · « En cas de dissolution d'une société […], une cotisation spéciale est réglée immédiatement par chaque société d'après les résultats de la période pendant laquelle l'activité a été exercée. En cas de dissolution de la société suivie de liquidation, une autre cotisation spéciale est réglée d'après les résultats accusés par le dernier bilan de liquidation. Cette cotisation est rattachée à l'exercice désigné par le millésime de l'année de la dissolution. » Art. 11, 1° · les bénéfices de la liquidation sont imposables.
- LPF, art. 16 (`SK/fiscalite-rdc/code-general-2026/references/17-procedures-titre1-obligations-declaratives.md`) · « En cas de dissolution, de liquidation de société ou de cessation d'affaires, la déclaration doit être remise dans le mois et, en tout cas, avant que le dirigeant ne quitte la République Démocratique du Congo. »

**Décision**
- La période du 1er janvier à la dissolution est un exercice ARRÊTÉ à la date de dissolution. La loi fiscale l'exige expressément · arrêté des comptes hors du 31 décembre en cas de cessation (art. 12, al. 1), cotisation spéciale sur « les résultats de la période pendant laquelle l'activité a été exercée » (art. 13, al. 1), déclaration dans le mois (LPF, art. 16). Le bilan de cet arrêté est le « bilan avant liquidation » de l'AUDCIF, ch. 40 § 2.1.
- La liquidation forme ensuite UN SEUL exercice, du lendemain de la dissolution à la clôture de la liquidation, quelle que soit sa durée (AUDCIF, art. 7, al. 4), avec une situation provisoire à chaque fin d'année civile (même alinéa). Dans les cas de l'art. 223 de l'AUSCGIE, ces situations sont les états annuels des art. 232 et 233.
- Une seconde cotisation spéciale se déclare sur le dernier bilan de liquidation (art. 13, al. 2), dans le mois (LPF, art. 16).

**Effet pour OmegaX**
- Un dossier qui déclare une date de dissolution peut arrêter l'exercice en cours à cette date (refusé aujourd'hui hors du 31 décembre) et ouvrir un exercice de liquidation du lendemain à la clôture de la liquidation, sans plafond de durée.
- Jalon « Déclaration de la cotisation spéciale (période d'activité) » au plus tard un mois après la dissolution, date à date (LPF, art. 16), avec la mention « et avant que le dirigeant ne quitte la RDC ».
- Jalon « Déclaration de la cotisation spéciale (dernier bilan de liquidation) » un mois après la clôture de la liquidation.
- Les « situations annuelles provisoires » au 31 décembre restent sans délai au texte hors des cas de l'art. 223.
- Hors périmètre de cette décision · liquidation d'une association ou d'une ONG (loi n° 004/2001, non relue pour ce point).

---

## 3. Dividende prioritaire des entreprises minières du portefeuille

**Texte lu**
- Arrêté interministériel n° 005/CAB/MIN/PF/2025 et n° 159bis/CAB/MIN/FINANCES/2025 du 10 décembre 2025 (`SK/rgcp-comptabilite-publique/portefeuille-etat-fonds-speciaux/references/arrete-interministeriel-2025-taux-droits-taxes-redevances-portefeuille.md`), en vigueur à sa signature (art. 9). Transcription OCR, « non revérifiée mot à mot » selon la compétence.
  - Art. 2 · « Lorsqu'un bénéfice net comptable est réalisé par les entreprises minières du portefeuille de l'État, le dividende dû à l'État est prioritaire et intangible : il doit être versé au Trésor public avant toute autre affectation du bénéfice net comptable. Déclaré au plus tard le 15 mai de chaque année, indépendamment de la tenue de l'Assemblée Générale Ordinaire ; paiement dans les huit jours de la réception de la note de perception. »
  - Art. 3 · redevables · toutes les entreprises du portefeuille du secteur minier, « y compris celles réputées avoir cédé à l'État des parts/actions en vertu des art. 71d, 82h et 104 du Code Minier ».
  - Art. 1er, point 2 · montant du dividende d'une entreprise du portefeuille · « correspondant à la quote-part de l'État ».
  - Art. 5 · procès-verbaux d'AGO et de CA transmis au Secrétariat Général du Portefeuille ET à la DGRAD dans les dix jours de leur tenue ; point 11 du barème · astreinte de 100 USD par jour de retard.
- Concordent sur le 15 mai et les huit jours · les deux résumés de la LF n° 25/060 (2026) seuls (`SK/rgcp-comptabilite-publique/finances-publiques/references/lf-2026.md`, art. 63-64 ; `SK/fiscalite-rdc/lois-de-finances-annuelles/references/lf-2026-mesures-fiscales.md`, art. 52).
- La LF n° 24/011 (2025), art. 73, résumée (`SK/rgcp-comptabilite-publique/finances-publiques/references/lf-2025.md`), insère l'art. 112 quater à l'O.-L. n° 13/003 · elle porte la PRIORITÉ (« prioritaire et intangible », « avant toute autre affectation ») et la quote-part (« taux égal à la quote-part de l'État dans le capital »), ni le 15 mai ni les huit jours (correction du premier tour de relecture).

**Décision**
- Le 15 mai n'est plus une corroboration · il est écrit dans un arrêté en vigueur, lu, que les deux résumés d'une même loi de finances (n° 25/060) confirment. La décision du 2026-10-04 (« à confirmer sur le texte même de la LF 2026 ») est levée par ce texte.
- Le jalon vaut pour une entreprise du portefeuille DU SECTEUR MINIER (fait déclaré, oui, non, pas encore dit), qui a réalisé un bénéfice net comptable · déclaration au plus tard le 15 mai de l'année qui suit l'exercice, quelle que soit la date de l'assemblée.
- Montant · bénéfice net comptable × quote-part de l'État dans le capital, la quote-part DÉCLARÉE avec sa source, jamais présumée. Sans quote-part, le montant n'est pas calculé et le dit. C'est une LECTURE de l'arrêté (art. 1er, point 2) et du résumé de la LF n° 24/011 (art. 73) · aucun texte lu n'écrit la formule, et le jalon le dit. La distribution reste soumise à l'AUSCGIE, art. 143 (capitaux propres jamais rendus inférieurs au capital augmenté des réserves indisponibles) et 144 (dividende fictif) · le jalon avertit d'un report à nouveau débiteur ou de capitaux propres sous le capital.
- Après la dissolution déclarée, aucun dividende prioritaire · ce que l'État reçoit est un boni ou produit de liquidation (arrêté, art. 1er, point 4 ; loi n° 08/010, art. 7).
- Paiement · dans les huit jours de la réception de la note de perception, date déclarée ; sans elle, non calculé.
- Le procès-verbal d'AGO et celui du conseil d'administration vont aussi au Secrétariat Général du Portefeuille, dans les mêmes dix jours (art. 5), astreinte de 100 USD par jour dite, jamais calculée (monnaie hors tenue).

**Effet pour OmegaX**
- Fait déclaré « entreprise du secteur minier » sous le portefeuille, et quote-part de l'État déclarée (pourcentage, source).
- Jalon du 15 mai et jalon du paiement ; mention du Secrétariat Général du Portefeuille sur le jalon du procès-verbal, CA compris.
- Relevé, non décidé ici · la quotité de 25 % sur les dividendes de coentreprise d'une entreprise publique minière (art. 4 de l'arrêté), qui suppose d'autres faits déclarés.

---

## 4. Fiche R2 · le siège et le critère du contrôle

**Texte lu**
- AUDCIF, Titre IX ch. 2, fiche R2 (`SK/audcif-acte-uniforme/references/titre-9-ch1-5-bilan-resultat-flux.md`) · ZN « Nombre d'établissements dans le pays » ; ZO « Nombre d'établissements hors du pays pour lesquels une comptabilité distincte est tenue » ; ZQ, ZQ, ZS · contrôle public, privé national, privé étranger. La fiche ne définit aucun des deux mots.
- AUDCIF, Titre VIII ch. 34 § 1 · « Le terme « établissement » s'applique à toute division de l'entité disposant d'une comptabilité autonome (succursales, usines, ateliers…). » § 3 · « le siège étant considéré lui-même comme un établissement ».
- AUDCIF, art. 78 (`SK/audcif-acte-uniforme/references/titre-2-consolidation-combinaison.md`) · le contrôle exclusif « résulte soit de la détention directe ou indirecte de la majorité des droits de vote ; soit de la désignation, pendant deux exercices successifs, de la majorité des membres des organes d'administration ou de direction » (présumée au-delà de 40 % sans détenteur plus fort) ; « soit du droit d'exercer une influence dominante en vertu d'un contrat ou de clauses statutaires ».
- Loi n° 08/010, art. 3 · l'entreprise PUBLIQUE est l'entreprise du portefeuille où l'État détient « la totalité ou la majorité absolue des actions ou parts sociales ».

**Décision**
- Le SIÈGE COMPTE comme établissement · le ch. 34 § 3 le dit en toutes lettres. Les autres établissements comptés en ZN sont les divisions qui tiennent une comptabilité autonome, seule définition du mot dans l'Acte (ch. 34 § 1). La précision de ZO ne crée pas une seconde définition, elle répète la première pour l'étranger.
- Le CONTRÔLE de ZQ à ZS se lit par l'art. 78, seule définition du mot dans l'Acte · celui qui détient la majorité des droits de vote, ou désigne la majorité des organes depuis deux exercices, ou exerce une influence dominante par contrat ou statuts. Contrôle public · l'État ou une personne morale de droit public ; c'est le cas de l'entreprise publique de la loi n° 08/010, art. 3. Privé national ou étranger · selon la nationalité de la personne qui contrôle.
- Contrôle conjoint ou sans détenteur de contrôle · le texte ne range pas ce cas · la case reste au cabinet, jamais déduite.

**Effet pour OmegaX**
- Bulle d'aide de ZN · « le siège compte » (ch. 34 § 3) et la définition du ch. 34 § 1.
- Bulle d'aide de ZQ à ZS · les trois critères de l'art. 78.
- Proposition, jamais substitution · ZQ « contrôle public » proposé quand le dossier déclare l'entreprise du portefeuille et une quote-part de l'État supérieure à 50 % (point 3).

---

## 5. « SA à participation publique » (code 00) et entreprise du portefeuille

**Texte lu**
- AUDCIF, NOTE 36, table des codes de forme juridique (`SK/audcif-acte-uniforme/references/titre-9-ch6-7-notes-annexes-correspondance.md`) · « 0 0 Société Anonyme (SA) à participation publique », « 0 1 Société Anonyme (SA) » ; renvoi (1) · « Remplacer le premier 0 par 1 si l'entité bénéficie d'un agrément prioritaire. »
- Loi n° 08/010, art. 3 · entreprise du portefeuille · « toute société dans laquelle l'État ou toute personne morale de droit public détient la totalité des actions ou une participation » ; art. 4 · elle prend l'une des formes des sociétés commerciales.

**Décision**
- Une SA du portefeuille de l'État est une « SA à participation publique » · l'État y détient une participation (art. 3). Son code ZK est 00 (10 sous agrément prioritaire).
- L'inverse n'est pas vrai · la note 36 ne dit pas quelle personne publique, une participation d'un État étranger donne aussi 00 sans faire une entreprise du portefeuille congolais. Le code ne se lit donc jamais pour en déduire la qualité.
- Pour une autre forme (SARL, SAS, SNC, SCS), la table n'a pas de code « à participation publique » · le code reste celui de la forme.

**Effet pour OmegaX**
- Proposer 00 en ZK pour une SA qui déclare « entreprise du portefeuille », jamais l'imposer ; le cabinet confirme. Rien dans l'autre sens.

---

## 6. « Quarante-cinq jours au moins avant » · délai franc ou non

**Texte lu**
- AUSCGIE, art. 140 · « quarante-cinq (45) jours au moins avant la date de l'assemblée générale ordinaire » ; art. 288 et 306 · « au moins quinze (15) jours avant la tenue de l'assemblée » ; art. 345 · « durant les quinze (15) jours précédant la tenue de l'assemblée générale ». AUDCIF, art. 71, al. 3 · « quarante-cinq jours au moins avant ».
- L'AUSCGIE ne porte AUCUNE règle de computation des délais (livres 1 à 10 et dispositions finales relus sur le mot).
- Les deux seules règles de computation du droit OHADA au corpus excluent les deux bornes · AUPSRVE, art. 1-14 (« le jour qui en constitue le point de départ et celui de l'échéance ne sont pas pris en compte ») ; AUPCAP, art. 218, limité à ses procédures (« le jour de l'acte […] d'une part, et le dernier jour, d'autre part, ne sont pas comptés »).
- Le Code de procédure civile congolais écrit « jours francs » quand il les veut (art. 9, « huit jours francs »).

**Décision**
- Aucun texte ne règle le calcul pour l'AUSCGIE. Les deux lectures diffèrent d'UN jour. Le délai protège ceux qui reçoivent les documents (commissaires aux comptes, associés) · règle du dépôt, « une règle de protection ne se tranche pas contre celui qu'elle protège » (CLAUDE.md, P5). Les deux règles OHADA de computation excluent d'ailleurs les deux bornes.
- OmegaX sert la date qui satisfait LES DEUX lectures · quarante-cinq jours FRANCS, soit l'assemblée moins 46 jours (13 février pour une assemblée au 31 mars, 14 février en année bissextile) ; quinze jours francs pour les art. 288 et 306 (assemblée moins 16 jours). L'art. 345 (« durant les quinze jours précédant ») ouvre la communication à l'assemblée moins 15 jours.
- Le détail du jalon dit l'autre lecture (« un jour plus tard si le délai n'est pas franc »). Un geste fait le jour suivant n'est jamais dit hors délai sans cette mention.
- Ne change pas · les délais « dans les dix jours qui suivent » (O.-L. n° 13/003, art. 112 ; LPF, art. 13 bis) restent comptés date plus dix, qui satisfait lui aussi les deux lectures.

---

## Constat relevé à la lecture · LPF, art. 13 bis

- Texte · « Les sociétés et les autres personnes morales soumises à l'impôt sur les sociétés sont tenues de déposer auprès de l'Administration des impôts, dans les dix jours de la tenue de l'Assemblée générale ordinaire approuvant les états financiers CERTIFIÉS PAR LES COMMISSAIRES AUX COMPTES, le procès-verbal de l'Assemblée générale. »
- Décision (périmètre du texte, CLAUDE.md § 10 bis) · le jalon ne vaut que si un commissaire aux comptes certifie les états de l'exercice (mandat enregistré qui couvre l'exercice, y compris un mandat terminé par anticipation après la clôture de cet exercice). Sans mandat, OmegaX ne le présente pas comme dû et dit pourquoi.
- Exception, la société anonyme (premier tour de relecture) · le commissaire y est OBLIGATOIRE (AUSCGIE, art. 694, « Le contrôle est exercé, dans chaque société anonyme, par un ou plusieurs commissaires aux comptes » ; art. 702, « Les sociétés anonymes ne faisant pas publiquement appel à l'épargne sont tenues de designer un commissaire aux comptes et un suppléant »). Sans mandat enregistré, le jalon reste servi, « à confirmer · mandat de commissaire non enregistré », sans quoi l'absence d'une saisie ferait disparaître une obligation.
- La forme lue est celle qui s'applique à l'exercice (`formeApplicable`), jamais celle du jour.
