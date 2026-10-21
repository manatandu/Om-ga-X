"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORMULES_DU_CONTRAT = exports.A_ARRETER = exports.OFFRE = exports.RECLAMATIONS = exports.EDITEUR = exports.LANGUE_DU_CONTRAT = exports.VERSION_CONDITIONS_LICENCE = void 0;
exports.mentionsAArreter = mentionsAArreter;
exports.articlesDesConditions = articlesDesConditions;
exports.texteBrutDesConditions = texteBrutDesConditions;
exports.VERSION_CONDITIONS_LICENCE = { numero: 1, date: '2026-10-15', dateLisible: '15 octobre 2026' };
exports.LANGUE_DU_CONTRAT = 'français';
exports.EDITEUR = {
    denomination: 'VMG Consulting',
    siege: null,
    courriel: null,
    telephone: null,
    immatriculation: null,
};
exports.RECLAMATIONS = { courriel: null, telephone: null, modalites: null };
exports.OFFRE = { modalitesPaiement: null, droitRetractation: null, garantiesLegales: null };
exports.A_ARRETER = 'à arrêter par VMG Consulting';
function mentionsAArreter(editeur = exports.EDITEUR, reclamations = exports.RECLAMATIONS, offre = exports.OFFRE) {
    const manque = [];
    if (!editeur.siege)
        manque.push('l’adresse complète du siège social de l’éditeur (Code du numérique, art. 52, 3°)');
    if (!editeur.courriel)
        manque.push('l’adresse de courrier électronique de l’éditeur (art. 52, 3°)');
    if (!editeur.telephone)
        manque.push('le numéro de téléphone de l’éditeur (art. 52, 3°)');
    if (editeur.immatriculation === null) {
        manque.push('l’immatriculation de l’éditeur (RCCM, forme juridique, identification nationale, numéro d’impôt, capital social), ou la déclaration qu’il n’y est pas assujetti (art. 52, 4°)');
    }
    if (!reclamations.courriel || !reclamations.telephone) {
        manque.push('le téléphone et l’adresse électronique où adresser une réclamation (art. 53, 13°)');
    }
    if (!reclamations.modalites)
        manque.push('les modalités de traitement des réclamations (art. 53, 14°)');
    if (!offre.modalitesPaiement)
        manque.push('les modalités de paiement, notamment les moyens de paiement acceptés (art. 53, 6°)');
    if (!offre.droitRetractation) {
        manque.push('l’existence ou l’absence d’un droit de rétractation et ses conditions d’exercice (art. 53, 16°)');
    }
    if (!offre.garantiesLegales) {
        manque.push('les garanties légales de conformité, des vices cachés et d’éviction (art. 53, 20°)');
    }
    return manque;
}
exports.FORMULES_DU_CONTRAT = [
    { code: 'ESSENTIEL', libelle: 'Essentiel', contenu: '1 dossier, 2 utilisateurs · tenue, états financiers, notes' },
    { code: 'STANDARD', libelle: 'Standard', contenu: 'Essentiel + analytique et budgets, paie, TVA, immobilisations · 5 utilisateurs' },
    { code: 'CABINET', libelle: 'Cabinet', contenu: 'Paquet de dossiers, utilisateurs illimités' },
    { code: 'PAIE', libelle: 'Option paie', contenu: 'La paie en supplément de la formule Essentiel' },
    { code: 'GROUPE', libelle: 'Option groupe', contenu: 'Consolidation et IFRS, en supplément de Standard ou Cabinet' },
    { code: 'DOSSIER_SUPPLEMENTAIRE', libelle: 'Dossier supplémentaire', contenu: 'Au-delà du paquet de la formule Cabinet, prix par dossier' },
];
const CODE_NUMERIQUE = 'ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique';
const DROIT_AUTEUR = 'ordonnance-loi n° 86-033 du 5 avril 1986 portant protection des droits d’auteurs et des droits voisins';
function ouAArreter(valeur) {
    return valeur ?? `(${exports.A_ARRETER})`;
}
function identiteDeLEditeur(e) {
    const imm = e.immatriculation;
    const immatriculation = imm === null
        ? `Immatriculation (RCCM, forme juridique, identification nationale, numéro d’impôt, capital social) · (${exports.A_ARRETER}).`
        : imm === 'NON_ASSUJETTIE'
            ? 'VMG Consulting n’est pas assujettie aux formalités d’inscription au registre du commerce.'
            : `${imm.formeJuridique} · RCCM ${imm.rccm} · identification nationale ${imm.idNat} · numéro d’impôt ${imm.numeroImpot} · capital social ${imm.capitalSocial}.`;
    return [
        `L’éditeur est ${e.denomination}, qui exploite et vend OmegaX. Les informations qui suivent sont celles que le Code du numérique (art. 52) veut accessibles de façon permanente.`,
        {
            liste: [
                `Dénomination · ${e.denomination}.`,
                `Siège social · ${ouAArreter(e.siege)}.`,
                `Courrier électronique · ${ouAArreter(e.courriel)}.`,
                `Téléphone · ${ouAArreter(e.telephone)}.`,
                immatriculation,
            ],
        },
        'Le client est l’entité dont un ou plusieurs dossiers comptables sont tenus dans OmegaX · association, organisation non gouvernementale, ordre professionnel, projet, entreprise ou cabinet. Il agit par l’administrateur de son dossier, qui accepte les présentes conditions en son nom.',
    ];
}
function articlesDesConditions(editeur = exports.EDITEUR, reclamations = exports.RECLAMATIONS, offre = exports.OFFRE) {
    return [
        {
            numero: 1,
            titre: 'Les parties',
            alineas: identiteDeLEditeur(editeur),
        },
        {
            numero: 2,
            titre: 'Définitions',
            alineas: [
                {
                    liste: [
                        'OmegaX · le logiciel de comptabilité édité par VMG Consulting, ses mises à jour et sa documentation.',
                        'Dossier · le fichier comptable d’une entité, avec ses exercices, ses écritures, ses tiers et ses utilisateurs.',
                        'Administrateur du dossier · l’utilisateur qui gère les accès du dossier et agit pour le client.',
                        'Version en ligne · OmegaX servi par VMG Consulting et utilisé dans un navigateur, à l’adresse oomega.web.app.',
                        'Installation sur site · OmegaX installé sur un ordinateur Windows du client, avec sa propre base de données.',
                        'Licence · le droit d’utiliser OmegaX que le présent contrat concède ; pour une installation sur site, le fichier signé par VMG Consulting qui le constate.',
                    ],
                },
            ],
        },
        {
            numero: 3,
            titre: 'Objet et caractéristiques du service',
            alineas: [
                'Le présent contrat fixe les conditions auxquelles VMG Consulting concède au client le droit d’utiliser OmegaX et lui en rend le service.',
                'OmegaX tient la comptabilité d’entités de la République démocratique du Congo dans l’un des deux référentiels de l’OHADA · le système comptable des entités à but non lucratif (SYCEBNL), pour les associations et ordres professionnels, les projets de développement ou en système minimal de trésorerie, et le système comptable OHADA révisé (SYSCOHADA), en système normal ou en système minimal de trésorerie. Il produit les livres, la balance, les états financiers et les notes annexes du référentiel du dossier.',
                'L’interface d’OmegaX, ses documents et le présent contrat sont en français, seule langue proposée.',
            ],
        },
        {
            numero: 4,
            titre: 'Droits de VMG Consulting sur OmegaX',
            alineas: [
                `Les logiciels sont des œuvres de l’esprit protégées par l’${DROIT_AUTEUR} (${CODE_NUMERIQUE}, art. 47). L’auteur d’une œuvre de l’esprit jouit sur elle, du seul fait de sa création, d’un droit de propriété incorporelle exclusif et opposable à tous (ordonnance-loi n° 86-033, art. 1er).`,
                'OmegaX est publié sous le nom de VMG Consulting, qui en détient les droits. Le présent contrat ne transfère au client aucun de ces droits · il lui en concède seulement l’usage, dans les limites de l’article 5.',
                'Toute atteinte méchante ou frauduleuse portée en connaissance de cause aux droits d’auteur constitue l’infraction de contrefaçon (ordonnance-loi n° 86-033, art. 96).',
                'Les données que le client saisit dans ses dossiers lui appartiennent. VMG Consulting n’acquiert sur elles aucun droit.',
            ],
        },
        {
            numero: 5,
            titre: 'Licence concédée au client',
            alineas: [
                'VMG Consulting concède au client, pour la durée du contrat, une licence non exclusive et non transférable d’utilisation d’OmegaX, pour la tenue de ses propres dossiers et dans le périmètre de sa formule ou de son fichier de licence.',
                'Le client ne peut, sauf accord écrit de VMG Consulting :',
                {
                    liste: [
                        'copier, modifier, traduire, adapter ou décompiler OmegaX, ni en extraire le code ;',
                        'le revendre, le louer, le sous-licencier ou le mettre à la disposition d’un tiers qui n’est pas l’un de ses utilisateurs ;',
                        'contourner ou neutraliser la vérification de la licence, notamment l’empreinte du poste et la signature du fichier de licence d’une installation sur site.',
                    ],
                },
            ],
        },
        {
            numero: 6,
            titre: 'Formules, prix et facturation',
            alineas: [
                'La version en ligne s’utilise par abonnement, sous l’une des formules suivantes, avec ses options :',
                { liste: exports.FORMULES_DU_CONTRAT.map((f) => `${f.libelle} · ${f.contenu}.`) },
                'Le prix de chaque formule et de chaque option est fixé en dollars des États-Unis, au mois ou à l’année, et communiqué par écrit au client avant la souscription. Le prix applicable à un dossier est rappelé avant son acceptation en ligne (article 18).',
                'Chaque période donne lieu à une facture (Code du numérique, art. 56, al. 2). La facture est établie en francs congolais, au cours du dollar du jour de la facture ; la taxe sur la valeur ajoutée y figure lorsque VMG Consulting y est assujettie. Un abonnement annuel se facture au premier mois facturable, puis tous les douze mois. Le mois entamé au début de l’abonnement n’est pas facturé, et aucune période n’est facturée au prorata.',
            ],
        },
        {
            numero: 7,
            titre: 'Essai, paiement et lecture seule',
            alineas: [
                'Un abonnement peut commencer par un essai gratuit de trente jours. Tout mois qui commence avant la fin de l’essai n’est pas facturé.',
                'Le client dispose de quinze jours après la fin de l’essai, puis après la fin de chaque période payée, pour régler la facture suivante. Passé ce délai sans paiement constaté par VMG Consulting, la licence du dossier arrive à échéance.',
                `Les modalités de paiement, notamment les moyens de paiement acceptés · ${ouAArreter(offre.modalitesPaiement)} (${CODE_NUMERIQUE}, art. 53, 6°).`,
                'Un dossier dont la licence est échue passe en LECTURE SEULE · ses utilisateurs le consultent et en téléchargent les états et les livres, mais aucune saisie, aucune modification ni aucune impression numérotée du journal n’y est plus admise. Le paiement constaté rouvre l’écriture aussitôt.',
                `Un utilisateur qui respecte les conditions contractuelles et financières souscrites ne subit pas d’interruption de fourniture du service, sauf demande expresse de sa part, force majeure ou raisons de sécurité publique (${CODE_NUMERIQUE}, art. 30, al. 3). VMG Consulting ne suspend donc entièrement un dossier que dans ces cas, ou lorsque le client manque à ses obligations.`,
            ],
        },
        {
            numero: 8,
            titre: 'Installation sur site',
            alineas: [
                'Une installation sur site fonctionne sans connexion à Internet. Sa licence est un fichier signé par VMG Consulting, qui nomme le titulaire, l’empreinte du poste serveur, le nombre de dossiers que l’installation peut ouvrir, la date de fin de maintenance et, s’il y a lieu, la date d’expiration. Copié sur un autre poste, le fichier ne vaut rien.',
                {
                    liste: [
                        'La date de fin de maintenance borne les VERSIONS · le client garde la version qu’il a, mais une version publiée après cette date refuse de démarrer sous cette licence.',
                        'La date d’expiration borne l’USAGE · une licence sans date d’expiration est perpétuelle.',
                        'Une horloge du poste reculée de plus d’un jour sous la date la plus tardive déjà vue suspend l’usage, jusqu’à ce qu’elle soit remise à l’heure.',
                    ],
                },
                'Sur une installation sur site, les données restent sur l’ordinateur du client, qui en assure la garde et la sauvegarde. VMG Consulting n’y a pas accès.',
            ],
        },
        {
            numero: 9,
            titre: 'Données du client et traitement pour son compte',
            alineas: [
                'La politique de confidentialité d’OmegaX, publiée à côté du présent contrat, décrit les données traitées, leurs hébergeurs, leur durée de conservation et les droits des personnes. Elle fait partie du contrat (Code du numérique, art. 53, 10°).',
                `Pour la version en ligne, le client est responsable du traitement des données personnelles de ses dossiers, et VMG Consulting traite ces données pour son compte, comme sous-traitant (${CODE_NUMERIQUE}, art. 229). À ce titre, et pour la durée du contrat :`,
                {
                    liste: [
                        'objet et finalité · la tenue de la comptabilité du client, les éditions, les sauvegardes et les courriers que le client fait partir du logiciel ;',
                        'données et personnes · celles que le client saisit · tiers, membres, donateurs, salariés, utilisateurs ;',
                        'VMG Consulting ne traite ces données que sur instruction documentée du client, y compris pour leur transfert hors de la République démocratique du Congo · l’usage du logiciel selon le présent contrat vaut cette instruction ;',
                        'les personnes autorisées à traiter ces données sont tenues à la confidentialité ;',
                        'VMG Consulting aide le client à répondre aux demandes des personnes concernées et à respecter ses obligations, et met à sa disposition les informations nécessaires pour démontrer le respect de ces obligations et pour permettre des audits ;',
                        'le client autorise VMG Consulting à recourir aux prestataires nommés par la politique de confidentialité ; VMG Consulting l’informe de tout ajout ou remplacement de l’un d’eux avant qu’il ne prenne effet, et le client peut s’y opposer.',
                    ],
                },
                `Le transfert de données personnelles hors de la République démocratique du Congo reste régi par les articles 201 et 202 du Code du numérique · la politique de confidentialité dit où en est la qualification de sa base juridique.`,
                `VMG Consulting est tenue à la confidentialité des données qu’elle traite, sauf réquisition judiciaire (${CODE_NUMERIQUE}, art. 37). Elle ne consulte pas le contenu des dossiers · ses accès techniques à la base se limitent à la sauvegarde chiffrée, dont elle détient la clé, à la restauration de contrôle automatique qui l’éprouve et ne rend que des décomptes, et aux requêtes de maintenance, qui ne rendent que des identifiants et des nombres. Sa console d’exploitation ne montre d’un dossier que sa fiche commerciale et sa licence.`,
                'À tout moment, et même lorsque le dossier est en lecture seule, l’administrateur du dossier en obtient une archive de ses données, un fichier CSV par table, par la commande Restituer le dossier complet, et chaque utilisateur en exporte les états et les livres. Cette archive porte cinq réserves, qu’elle écrit elle-même · elle ne remplace pas la conservation des pièces justificatives, n’a pas la force probante d’un écrit légalisé, ne se recharge pas entière dans OmegaX, n’est pas un instantané pris d’un seul coup, et ses fichiers ne sont pas le livre-journal.',
                `Ce que deviennent les données d’un dossier après la fin du contrat, au-delà des obligations légales de conservation · (${exports.A_ARRETER}).`,
            ],
        },
        {
            numero: 10,
            titre: 'Accès, sécurité et obligations du client',
            alineas: [
                'Le client désigne ses utilisateurs et leur rôle par l’administrateur de son dossier. Chaque utilisateur garde son mot de passe secret et ne le partage pas ; la double authentification lui est offerte, et elle est recommandée.',
                'Le client répond de ce que ses utilisateurs saisissent, valident et éditent. Il reste seul juge des écritures qu’il passe et des états qu’il arrête · OmegaX applique les règles des référentiels qu’il cite, il ne remplace pas le jugement du comptable.',
                'Le client utilise OmegaX dans le respect de la loi, et ne s’en sert à aucune fin illicite.',
            ],
        },
        {
            numero: 11,
            titre: 'Mises à jour, disponibilité et assistance',
            alineas: [
                'VMG Consulting met à jour la version en ligne sans intervention du client. Une installation sur site se met à jour par l’installation d’une nouvelle version, dans les limites de sa fin de maintenance (article 8) ; une copie de la base est prise avant chaque mise à jour.',
                `VMG Consulting publie sans délai les prévisions d’interruption du service, notamment pour installation, réparation ou changement d’équipement (${CODE_NUMERIQUE}, art. 29, 4°). Le moyen de cette publication · (${exports.A_ARRETER}).`,
                `L’assistance après-vente, son canal et ses horaires · (${exports.A_ARRETER}). VMG Consulting ne consent, à la date de la présente version, aucune garantie commerciale ni aucun engagement de disponibilité chiffré.`,
            ],
        },
        {
            numero: 12,
            titre: 'Responsabilité et force majeure',
            alineas: [
                `VMG Consulting est responsable de plein droit, à l’égard du client, de la bonne exécution des obligations résultant du présent contrat. Elle en est exonérée en apportant la preuve que l’inexécution, l’exécution tardive ou la mauvaise exécution est imputable soit au client, soit à un cas de force majeure, soit à un tiers à la fourniture des prestations prévues au contrat (${CODE_NUMERIQUE}, art. 51).`,
                'Il n’y a lieu à aucuns dommages-intérêts lorsque, par suite d’une force majeure ou d’un cas fortuit, une partie a été empêchée de faire ce à quoi elle était obligée (Code civil, Livre III, art. 46). Hors le cas du dol, une partie n’est tenue que des dommages-intérêts qui ont été prévus ou qu’on a pu prévoir lors du contrat (art. 48).',
                `Les garanties légales de conformité, des vices cachés et d’éviction · ${ouAArreter(offre.garantiesLegales)} (${CODE_NUMERIQUE}, art. 53, 20°).`,
                `Un plafond de responsabilité · (${exports.A_ARRETER}).`,
            ],
        },
        {
            numero: 13,
            titre: 'Droit de rétractation',
            alineas: [
                `Le Code du numérique n’ouvre un droit de rétractation que dans un contrat conclu entre un professionnel et un non-professionnel (${CODE_NUMERIQUE}, art. 61), et ce droit se perd une fois le service fourni (art. 64, 2°). Le présent contrat est conclu avec une entité, pour la tenue de sa comptabilité.`,
                `L’existence ou l’absence d’un droit de rétractation pour le présent contrat, et ses conditions d’exercice · ${ouAArreter(offre.droitRetractation)} (art. 53, 16°).`,
            ],
        },
        {
            numero: 14,
            titre: 'Durée et fin du contrat',
            alineas: [
                'Le contrat dure tant que l’abonnement du dossier ou sa licence sur site est en vigueur.',
                'Les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites ; elles ne peuvent être révoquées que de leur consentement mutuel ou pour les causes que la loi autorise, et elles doivent être exécutées de bonne foi (Code civil, Livre III, art. 33). Si l’une des parties ne satisfait point à son engagement, l’autre peut la forcer à l’exécution lorsqu’elle est possible, ou en demander la résolution avec dommages-intérêts (art. 82).',
                `La résiliation à l’initiative de chaque partie et son préavis · (${exports.A_ARRETER}).`,
            ],
        },
        {
            numero: 15,
            titre: 'Modification des conditions',
            alineas: [
                `VMG Consulting ne modifie unilatéralement les présentes conditions que pour les raisons qu’elles indiquent, ou à la suite d’un changement de la législation ou d’une décision de l’Autorité de Régulation du Numérique (${CODE_NUMERIQUE}, art. 34). Les raisons que le présent contrat admet · (${exports.A_ARRETER}).`,
                'Le projet de modification est communiqué au client par écrit ou sur un autre support durable au moins trente jours ouvrables avant son entrée en vigueur. Tant qu’il n’a pas expressément accepté les nouvelles conditions, le client peut résilier le contrat sans pénalité ni droit au dédommagement, jusqu’à soixante jours ouvrables après l’entrée en vigueur de la modification, qui ne prend effet qu’à l’issue de ce délai (art. 34).',
                'Chaque version porte un numéro, une date et l’empreinte de son texte (SHA-256). Une version publiée n’est jamais réécrite · un changement fait une version nouvelle, et le texte de chaque version publiée reste consultable dans OmegaX.',
            ],
        },
        {
            numero: 16,
            titre: 'Réclamations',
            alineas: [
                `Le client adresse ses réclamations à VMG Consulting · téléphone ${ouAArreter(reclamations.telephone)}, courrier électronique ${ouAArreter(reclamations.courriel)} (${CODE_NUMERIQUE}, art. 53, 13°).`,
                `Modalités de traitement des réclamations · ${ouAArreter(reclamations.modalites)} (art. 53, 14°).`,
            ],
        },
        {
            numero: 17,
            titre: 'Confidentialité entre les parties',
            alineas: [
                'Chaque partie garde confidentielles les informations de l’autre qu’elle reçoit pour l’exécution du contrat, sauf obligation légale de les communiquer.',
            ],
        },
        {
            numero: 18,
            titre: 'Conclusion du contrat en ligne',
            alineas: [
                'Le contrat se conclut dans OmegaX, en quatre étapes (Code du numérique, art. 53, 2°) :',
                {
                    liste: [
                        'l’administrateur du dossier ouvre le présent texte depuis le menu « ? » ; la version, sa date et l’abonnement du dossier y sont rappelés ;',
                        'il vérifie ces éléments, et peut se retirer sans rien accepter · tant qu’il n’a pas confirmé, rien n’est enregistré (art. 53, 3°, et art. 55, al. 1er) ;',
                        'il coche la case qui dit avoir lu les conditions, puis confirme l’acceptation au nom du client · OmegaX vérifie que le texte lu est celui que le service tient en vigueur, même version et même empreinte, et sinon demande de recharger la page ;',
                        'OmegaX en accuse aussitôt réception à l’écran · version acceptée, date, heure et auteur · et met en file, à l’adresse de l’administrateur, un courriel qui porte le même accusé et, en pièce jointe, le texte accepté (art. 55, al. 2, et art. 56, al. 1er).',
                    ],
                },
                'L’acceptation est enregistrée dans le dossier, avec la version et l’empreinte du texte accepté, son auteur, sa date et l’adresse réseau d’où elle a été faite, au journal d’audit. Le texte de chaque version acceptée reste consultable et imprimable (art. 53, 9°).',
                `L’offre est valable tant qu’elle est accessible en ligne (art. 53, al. 2, et art. 53, 4°). Le contrat ne se forme que par le consentement de la partie qui s’oblige (Code civil, Livre III, art. 8) · sans acceptation, le présent texte ne lie pas le client, et son accès au dossier n’en est pas interrompu (${CODE_NUMERIQUE}, art. 30, al. 3).`,
            ],
        },
        {
            numero: 19,
            titre: 'Droit applicable et litiges',
            alineas: [
                `Le Code du numérique régit les activités et services numériques exercés à partir ou à destination du territoire de la République démocratique du Congo (${CODE_NUMERIQUE}, art. 3). Les contrats sont soumis aux règles générales du Code civil congolais, Livre III (art. 7).`,
                `La juridiction compétente en cas de litige · (${exports.A_ARRETER}).`,
            ],
        },
    ];
}
function texteBrutDesConditions(editeur = exports.EDITEUR, reclamations = exports.RECLAMATIONS, offre = exports.OFFRE) {
    const v = exports.VERSION_CONDITIONS_LICENCE;
    const lignes = [
        'CONDITIONS DE LICENCE D’OMEGAX',
        `Version ${v.numero} du ${v.dateLisible} · langue du contrat · ${exports.LANGUE_DU_CONTRAT}`,
        '',
    ];
    for (const a of articlesDesConditions(editeur, reclamations, offre)) {
        lignes.push(`${a.numero}. ${a.titre}`, '');
        for (const al of a.alineas) {
            if (typeof al === 'string')
                lignes.push(al, '');
            else
                lignes.push(...al.liste.map((l) => `  - ${l}`), '');
        }
    }
    return lignes.join('\n');
}
//# sourceMappingURL=conditions-de-licence.js.map