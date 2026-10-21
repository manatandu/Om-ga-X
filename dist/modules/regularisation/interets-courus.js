"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHARGES_INTERETS_ADMISES = void 0;
exports.compteInteretsCourus = compteInteretsCourus;
exports.motifRefusChargeInterets = motifRefusChargeInterets;
exports.chargeInteretsProposee = chargeInteretsProposee;
const client_1 = require("@prisma/client");
function compteInteretsCourus(referentiel, numeroEmprunt) {
    if (referentiel === client_1.Referentiel.SYSCOHADA) {
        if (!numeroEmprunt.startsWith('16')) {
            return {
                refus: `Le compte ${numeroEmprunt} n'est pas un emprunt du compte 16 · les dettes de location acquisition (17) et ` +
                    'les dettes liées à des participations (18) en sont exclues (AUDCIF, Titre VII, fiche du compte 16).',
            };
        }
        if (numeroEmprunt.startsWith('166'))
            return { refus: 'Le 166 porte les intérêts courus eux-mêmes · désignez l’emprunt.' };
        if (!/^16[1-578]/.test(numeroEmprunt))
            return { refus: `Le compte ${numeroEmprunt} n'est pas un emprunt du compte 16.` };
        if (numeroEmprunt.startsWith('1681')) {
            return {
                refus: 'Une rente viagère capitalisée ne distingue ni intérêts ni capital · « la totalité de chaque versement débite ' +
                    'le 1681 » (AUDCIF, Titre VIII ch. 11) ; elle ne porte pas d’intérêts courus.',
            };
        }
        return { racine: `166${numeroEmprunt[2]}` };
    }
    if (numeroEmprunt.startsWith('16')) {
        return {
            refus: `Au SYCEBNL le compte ${numeroEmprunt} est un fonds affecté, pas un emprunt · les emprunts et leurs intérêts ` +
                'courus sont au 18 (SYCEBNL, Partie 2 ch. 3, fiche du compte 18).',
        };
    }
    if (!/^18[1-58]/.test(numeroEmprunt)) {
        return {
            refus: `Le compte ${numeroEmprunt} n'est pas un emprunt dont la fiche du compte 18 ouvre les intérêts courus · ` +
                '181, 182, 183, 185 ou 188 (SYCEBNL, Partie 2 ch. 3) ; les dettes de location acquisition (187) sont hors de ce geste.',
        };
    }
    if (numeroEmprunt.startsWith('184')) {
        return {
            refus: 'La fiche du compte 18 du SYCEBNL n’ouvre aucun intérêt couru sur avances reçues et comptes courants bloqués · ' +
                'le 186 ne porte que 1861, 1862, 1863, 1865 et 1868. OmegaX ne comble pas ce silence · passez l’écriture à la ' +
                'main sur le compte que votre plan ouvre pour ce cas.',
        };
    }
    return { racine: `186${numeroEmprunt[2]}` };
}
exports.CHARGES_INTERETS_ADMISES = ['6711', '6712', '6741', '6742', '6748'];
function motifRefusChargeInterets(numeroCharge) {
    if (exports.CHARGES_INTERETS_ADMISES.some((r) => numeroCharge.startsWith(r)))
        return null;
    return (`Les intérêts courus d'un emprunt se portent au 671 (fiche du compte 16) ou, pour les avances, dépôts et comptes ` +
        `courants, au 674 (fiche du compte 67) · 6711, 6712, 6741, 6742 ou 6748, pas ${numeroCharge}.`);
}
function chargeInteretsProposee(referentiel, numeroEmprunt) {
    const categorie = numeroEmprunt[2];
    const prefixe = referentiel === client_1.Referentiel.SYSCOHADA ? '16' : '18';
    if (!numeroEmprunt.startsWith(prefixe))
        return null;
    if (categorie === '1')
        return '6711';
    if (categorie === '2')
        return '6712';
    if (categorie === '3' || categorie === '5')
        return '6741';
    if (categorie === '4' && referentiel === client_1.Referentiel.SYSCOHADA)
        return '6742';
    return null;
}
//# sourceMappingURL=interets-courus.js.map