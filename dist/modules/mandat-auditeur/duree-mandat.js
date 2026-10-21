"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.dureeMandat = dureeMandat;
exports.dernierExerciceCouvert = dernierExerciceCouvert;
exports.regleDeProrogation = regleDeProrogation;
exports.estDansLaProrogation = estDansLaProrogation;
exports.motifRefusDuree = motifRefusDuree;
exports.motifRefusOrgane = motifRefusOrgane;
exports.successionOuverte = successionOuverte;
exports.motifRefusSuccession = motifRefusSuccession;
exports.fondementInscription = fondementInscription;
exports.mandatCouvrant = mandatCouvrant;
exports.commissaireCouvreLExercice = commissaireCouvreLExercice;
const client_1 = require("@prisma/client");
const SOURCE_DESIGNATION_JUDICIAIRE_SA = 'AUSCGIE art. 708 et 730 · le mandat prend fin à la nomination (art. 708), ou à l’entrée en fonction (art. 730, ' +
    'après récusation), du commissaire désigné par l’assemblée · aucune durée en exercices, elle se saisit';
const SOURCE_ORGANE_INCONNU_SA = 'AUSCGIE art. 703 · le commissaire d’une société anonyme est désigné dans les statuts, par l’assemblée ' +
    'générale constitutive ou par l’assemblée générale ordinaire, et à défaut en justice (art. 708, 730)';
function dureeMandat(referentiel, formeJuridique, organe, gieEmetDesObligations = null) {
    if (referentiel === client_1.Referentiel.SYCEBNL) {
        return {
            exercices: 3,
            mandatsMaximum: 2,
            source: 'SYCEBNL art. 21',
        };
    }
    switch (formeJuridique) {
        case client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME:
            switch (organe) {
                case 'STATUTS_OU_AG_CONSTITUTIVE':
                    return { exercices: 2, mandatsMaximum: null, source: 'AUSCGIE art. 704, premier alinéa' };
                case 'ASSEMBLEE_GENERALE_ORDINAIRE':
                    return { exercices: 6, mandatsMaximum: null, source: 'AUSCGIE art. 704, second alinéa' };
                case 'JURIDICTION':
                    return { exercices: null, mandatsMaximum: null, source: SOURCE_DESIGNATION_JUDICIAIRE_SA };
                default:
                    return { exercices: null, mandatsMaximum: null, source: SOURCE_ORGANE_INCONNU_SA };
            }
        case client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE:
            switch (organe) {
                case 'STATUTS_OU_AG_CONSTITUTIVE':
                    return {
                        exercices: 2,
                        mandatsMaximum: null,
                        source: 'AUSCGIE art. 853-3, renvoi à l’art. 704, premier alinéa, « dans la mesure où [les règles de la SA] ' +
                            'sont compatibles »',
                    };
                case 'ASSEMBLEE_GENERALE_ORDINAIRE':
                case 'ASSOCIES':
                    return {
                        exercices: 6,
                        mandatsMaximum: null,
                        source: 'AUSCGIE art. 853-3, renvoi à l’art. 704, second alinéa, « dans la mesure où [les règles de la SA] ' +
                            'sont compatibles » · lecture d’OmegaX : la décision collective des associés (art. 853-11, al. 2) ' +
                            'tient lieu de l’assemblée générale ordinaire, que l’art. 853-3 exclut',
                    };
                case 'JURIDICTION':
                    return {
                        exercices: null,
                        mandatsMaximum: null,
                        source: `AUSCGIE art. 853-3, renvoi aux art. 708 et 730 · ${SOURCE_DESIGNATION_JUDICIAIRE_SA}`,
                    };
                default:
                    return {
                        exercices: null,
                        mandatsMaximum: null,
                        source: 'Aucun texte lu ne fixe de durée de mandat pour un commissaire désigné par cet organe · la durée est ' +
                            'celle de l’acte de désignation, à saisir.',
                    };
            }
        case client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE:
            return { exercices: 3, mandatsMaximum: null, source: 'AUSCGIE art. 379' };
        case client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE:
            if (gieEmetDesObligations) {
                return { exercices: 6, mandatsMaximum: null, source: 'AUSCGIE art. 880, quatrième alinéa (GIE émetteur d’obligations)' };
            }
            return {
                exercices: null,
                mandatsMaximum: null,
                source: 'AUSCGIE art. 880 · la durée est celle du contrat du groupement, sauf émission d’obligations (art. 875), ' +
                    'où le commissaire aux comptes est nommé pour six exercices · à saisir.',
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF:
            return {
                exercices: 3,
                mandatsMaximum: null,
                source: 'AUSCGIE art. 379, applicable par l’art. 289-1, dernier alinéa',
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE:
            return {
                exercices: 3,
                mandatsMaximum: null,
                source: 'AUSCGIE art. 379, applicable par l’art. 289-1, dernier alinéa, et l’art. 293-1',
            };
        case client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE:
            return { exercices: 3, mandatsMaximum: null, source: 'AUSCOOP art. 121, al. 2' };
        default:
            return {
                exercices: null,
                mandatsMaximum: null,
                source: 'Aucun texte lu ne fixe de durée de mandat pour cette forme · la durée est celle de l’acte de ' +
                    'désignation, à saisir.',
            };
    }
}
function dernierExerciceCouvert(premierExercice, exercices) {
    return premierExercice + exercices - 1;
}
function regleDeProrogation(referentiel, formeJuridique) {
    if (referentiel === client_1.Referentiel.SYCEBNL) {
        return {
            source: 'SYCEBNL art. 22',
            citation: '« si l’assemblée […] ne procède pas au renouvellement du mandat de l’auditeur ou à son remplacement à ' +
                'l’expiration de son mandat, la mission de l’auditeur est PROROGÉE, sauf refus exprès de sa part », ' +
                'jusqu’à « la plus prochaine assemblée générale […] statuant sur les comptes »',
        };
    }
    if (formeJuridique === client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE) {
        return {
            source: 'AUSCGIE art. 853-3 et 709',
            citation: 'par le renvoi de l’art. 853-3 aux règles de la société anonyme, « dans la mesure où elles sont ' +
                'compatibles » : « Si l’assemblée omet de renouveler le mandat d’un commissaire aux comptes ou de le ' +
                'remplacer à l’expiration de son mandat et, sauf refus exprès du commissaire, sa mission est prorogée ' +
                'jusqu’à la plus prochaine assemblée générale ordinaire annuelle » (art. 709), c’est-à-dire jusqu’à la ' +
                'prochaine décision collective des associés sur les comptes (art. 853-11, al. 2 · lecture d’OmegaX)',
        };
    }
    if (formeJuridique === client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME) {
        return {
            source: 'AUSCGIE art. 709',
            citation: '« Si l’assemblée omet de renouveler le mandat d’un commissaire aux comptes ou de le remplacer à ' +
                'l’expiration de son mandat et, sauf refus exprès du commissaire, sa mission est prorogée jusqu’à la ' +
                'plus prochaine assemblée générale ordinaire annuelle. »',
        };
    }
    return null;
}
function estDansLaProrogation(premierExercice, exercices, anneeExercice) {
    return anneeExercice === dernierExerciceCouvert(premierExercice, exercices) + 1;
}
function motifRefusDuree(referentiel, duree, saisie) {
    if (duree === null)
        return null;
    if (referentiel === client_1.Referentiel.SYCEBNL) {
        return Number.isInteger(saisie) && saisie >= 1 && saisie <= duree ? null : `au plus ${duree} exercice(s)`;
    }
    return saisie === duree ? null : `${duree} exercice(s)`;
}
function motifRefusOrgane(referentiel, formeJuridique, organe) {
    if (referentiel !== client_1.Referentiel.SYSCOHADA || formeJuridique !== client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)
        return null;
    if (organe === 'ASSOCIES' || organe === 'BAILLEUR_OU_ETAT') {
        return ('Cet organe ne désigne pas le commissaire aux comptes d’une société anonyme · « Le premier commissaire aux ' +
            'comptes et son suppléant sont désignés dans les statuts ou par l’assemblée générale constitutive. En cours ' +
            'de vie sociale, le commissaire aux comptes et son suppléant sont désignés par l’assemblée générale ' +
            'ordinaire » (AUSCGIE art. 703), et à défaut en justice (art. 708 et 730).');
    }
    return null;
}
function successionOuverte(referentiel, forme) {
    return (referentiel === client_1.Referentiel.SYSCOHADA &&
        (forme === client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME || forme === client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE));
}
function motifRefusSuccession(nature, origine, premierExercice, nombreExercices) {
    const finOrigine = dernierExerciceCouvert(origine.premierExercice, origine.nombreExercices);
    const fin = dernierExerciceCouvert(premierExercice, nombreExercices);
    if (premierExercice < origine.premierExercice || premierExercice > finOrigine) {
        return `le premier exercice couvert doit tomber dans le mandat d’origine (${origine.premierExercice} à ${finOrigine})`;
    }
    if (nature === 'REMPLACEMENT' && fin !== finOrigine) {
        return (`le remplaçant « ne demeure en fonction que jusqu’à l’expiration du mandat de son prédécesseur » ` +
            `(AUSCGIE art. 706) · dernier exercice couvert ${finOrigine}, soit ${finOrigine - premierExercice + 1} ` +
            'exercice(s) à compter du premier');
    }
    if (nature === 'SUPPLEANT' && fin > finOrigine) {
        return ('le suppléant exerce au plus « jusqu’à l’expiration du mandat du commissaire au compte empêché » ' +
            `(AUSCGIE art. 728) · dernier exercice couvert ${finOrigine} au plus`);
    }
    return null;
}
function fondementInscription(referentiel, formeJuridique) {
    if (referentiel === client_1.Referentiel.SYCEBNL) {
        return {
            source: 'SYCEBNL art. 20',
            texte: 'l’auditeur est choisi « parmi les experts-comptables inscrits au tableau de l’ordre des experts-comptables ' +
                'ou de l’organe qui en tient lieu dans chaque État partie » (l’ONEC en RDC)',
        };
    }
    const auscgie = formeJuridique === client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME
        ? ' · AUSCGIE art. 695'
        : formeJuridique === client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE
            ? ' · AUSCGIE art. 695, par l’art. 377'
            : '';
    return {
        source: `Loi n° 15/002, art. 59${auscgie}`,
        texte: '« Nul ne peut exercer le mandat ou la fonction de Commissaire aux comptes s’il n’est inscrit au tableau de ' +
            'l’Ordre des Experts-comptables » (loi n° 15/002, art. 59)' +
            (auscgie
                ? ' ; « seuls les experts-comptables inscrits au tableau de l’ordre peuvent exercer les fonctions de ' +
                    'commissaires aux comptes » (AUSCGIE art. 695)'
                : ''),
    };
}
function mandatCouvrant(mandats, anneeExercice) {
    return mandats.find((m) => m.premierExercice <= anneeExercice && dernierExerciceCouvert(m.premierExercice, m.nombreExercices) >= anneeExercice);
}
function commissaireCouvreLExercice(mandats, anneeExercice, referentiel, formeJuridique, dateFinExercice) {
    const enFonction = mandats.filter((m) => !m.finAnticipeeLe || (dateFinExercice !== undefined && m.finAnticipeeLe.getTime() > dateFinExercice.getTime()));
    if (mandatCouvrant(enFonction, anneeExercice))
        return true;
    const echu = mandats
        .filter((m) => !m.finAnticipeeLe)
        .find((m) => dernierExerciceCouvert(m.premierExercice, m.nombreExercices) < anneeExercice);
    return (!!echu &&
        !echu.refusDeProrogation &&
        regleDeProrogation(referentiel, formeJuridique) !== null &&
        estDansLaProrogation(echu.premierExercice, echu.nombreExercices, anneeExercice));
}
//# sourceMappingURL=duree-mandat.js.map