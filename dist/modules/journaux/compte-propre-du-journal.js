"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.motifRefusNumeroDuJournal = motifRefusNumeroDuJournal;
exports.motifRefusCompteDeTresorerie = motifRefusCompteDeTresorerie;
const client_1 = require("@prisma/client");
const subdivisions_du_plan_1 = require("../comptes/subdivisions-du-plan");
const collectifs_tiers_1 = require("../tiers/collectifs-tiers");
function motifRefusNumeroDuJournal(numero, compteDuPlan, racine, longueur, referentiel) {
    if (!/^\d+$/.test(numero)) {
        const source = referentiel === client_1.Referentiel.SYCEBNL ? 'SYCEBNL, Partie 2 ch. 2, section 1' : 'AUDCIF art. 18 et Titre VII';
        return `Le numéro de compte « ${numero} » ne doit porter que des chiffres · la codification des comptes est décimale (${source}).`;
    }
    if (!numero.startsWith(racine)) {
        return (`Le numéro ${numero} ne commence pas par ${racine}, numéro du compte ${compteDuPlan} du plan · le compte ` +
            "d'une banque ou d'une caisse en est une subdivision.");
    }
    if (numero.length !== longueur) {
        return (`Le numéro ${numero} compte ${numero.length} chiffres, et les comptes de ce dossier en comptent ${longueur} ` +
            '(Structure > Paramètres du dossier).');
    }
    if ((0, collectifs_tiers_1.rangSousRacine)(numero, racine) === null) {
        return `Le numéro ${numero} ne se distingue pas du compte ${compteDuPlan} du plan · ajoutez un rang après ${racine}.`;
    }
    const parent = (0, subdivisions_du_plan_1.compteSemeSubdivise)(referentiel, numero);
    if (parent !== compteDuPlan) {
        return parent
            ? `Le numéro ${numero} se range sous le compte ${parent} du plan, pas sous le ${compteDuPlan} choisi.`
            : `Le numéro ${numero} est celui d'un compte du plan · choisissez un rang qui n'en est pas un.`;
    }
    return null;
}
function motifRefusCompteDeTresorerie(numero, referentiel) {
    const ecarte = ECARTES.find((e) => numero.startsWith(e.prefixe) && (!e.referentiel || e.referentiel === referentiel));
    if (ecarte)
        return `Le compte ${numero} ne peut pas porter un journal de banque ou de caisse · ${ecarte.raison}`;
    const divisions = referentiel === client_1.Referentiel.SYSCOHADA ? [...DIVISIONS_DES_FONDS, '581', '582'] : DIVISIONS_DES_FONDS;
    if (divisions.some((d) => numero.startsWith(d)))
        return null;
    return (`Le compte ${numero} n'est pas un compte de banque ou de caisse · un journal de trésorerie porte un compte des ` +
        `divisions ${referentiel === client_1.Referentiel.SYSCOHADA ? '52, 53, 55, 57, 581 ou 582' : '52, 53, 55 ou 57'}.`);
}
const DIVISIONS_DES_FONDS = ['52', '53', '55', '57'];
const ECARTES = [
    { prefixe: '526', raison: 'il porte les intérêts courus de la banque, charges à payer ou produits à recevoir (fiche du compte 52).' },
    { prefixe: '536', raison: "il porte les intérêts courus de l'établissement financier (fiche du compte 53)." },
    { prefixe: '50', raison: 'il porte des titres de placement (fiche du compte 50).' },
    { prefixe: '51', raison: 'il porte des valeurs à encaisser, que la banque n\'a pas encore créditées (fiche du compte 51).' },
    { prefixe: '54', referentiel: client_1.Referentiel.SYSCOHADA, raison: 'il porte des instruments de trésorerie (fiche du compte 54).' },
    {
        prefixe: '56',
        raison: 'il porte un crédit de trésorerie ou un escompte, constaté « par le débit du compte 52 » (fiche du compte 56).',
    },
    {
        prefixe: '585',
        raison: 'les virements internes sont des « comptes de passage », soldés au terme de leur utilisation (fiche du compte 58).',
    },
    {
        prefixe: '588',
        raison: 'les virements internes sont des « comptes de passage », soldés au terme de leur utilisation (fiche du compte 58).',
    },
    { prefixe: '59', raison: 'il porte des dépréciations et provisions (fiche du compte 59).' },
];
//# sourceMappingURL=compte-propre-du-journal.js.map