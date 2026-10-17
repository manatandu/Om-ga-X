"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NATURES_PAR_DEFAUT = exports.LIBELLES_NATURE = void 0;
exports.dansFourchette = dansFourchette;
exports.natureDe = natureDe;
exports.motifRefusFourchettes = motifRefusFourchettes;
exports.lireFourchettes = lireFourchettes;
exports.incoherencesDeReport = incoherencesDeReport;
const client_1 = require("@prisma/client");
exports.LIBELLES_NATURE = {
    STOCK: 'Stock',
    CLIENT: 'Clients',
    FOURNISSEUR: 'Fournisseurs',
    BANQUE: 'Banque',
    CAISSE: 'Caisse',
    CHARGE: 'Charges',
    PRODUIT: 'Produits',
};
exports.NATURES_PAR_DEFAUT = [
    { nature: client_1.NatureCompteType.STOCK, fourchettes: [{ du: '3', au: '3' }], modeReportANouveau: client_1.ModeReportANouveau.SOLDE, lettrable: false },
    { nature: client_1.NatureCompteType.CLIENT, fourchettes: [{ du: '41', au: '41' }], modeReportANouveau: client_1.ModeReportANouveau.DETAIL, lettrable: true },
    { nature: client_1.NatureCompteType.FOURNISSEUR, fourchettes: [{ du: '40', au: '40' }], modeReportANouveau: client_1.ModeReportANouveau.DETAIL, lettrable: true },
    { nature: client_1.NatureCompteType.BANQUE, fourchettes: [{ du: '52', au: '52' }], modeReportANouveau: client_1.ModeReportANouveau.SOLDE, lettrable: false },
    { nature: client_1.NatureCompteType.CAISSE, fourchettes: [{ du: '57', au: '57' }], modeReportANouveau: client_1.ModeReportANouveau.SOLDE, lettrable: false },
    { nature: client_1.NatureCompteType.CHARGE, fourchettes: [{ du: '6', au: '6' }], modeReportANouveau: client_1.ModeReportANouveau.AUCUN, lettrable: false },
    { nature: client_1.NatureCompteType.PRODUIT, fourchettes: [{ du: '7', au: '7' }], modeReportANouveau: client_1.ModeReportANouveau.AUCUN, lettrable: false },
];
function dansFourchette(numero, f) {
    const n = Math.max(f.du.length, f.au.length);
    const tete = numero.slice(0, n);
    return tete >= f.du.padEnd(n, '0') && tete <= f.au.padEnd(n, '9');
}
function natureDe(numero, natures) {
    return natures.find((n) => n.fourchettes.some((f) => dansFourchette(numero, f))) ?? null;
}
function motifRefusFourchettes(nature, fourchettes, autres) {
    if (fourchettes.length === 0)
        return `La nature ${exports.LIBELLES_NATURE[nature]} doit garder au moins une fourchette.`;
    for (const f of fourchettes) {
        if (!/^\d{1,13}$/.test(f.du) || !/^\d{1,13}$/.test(f.au)) {
            return `Fourchette « ${f.du} à ${f.au} » · des chiffres seulement, comme les racines du plan.`;
        }
        const n = Math.max(f.du.length, f.au.length);
        if (f.du.padEnd(n, '0') > f.au.padEnd(n, '9'))
            return `Fourchette « ${f.du} à ${f.au} » · le début dépasse la fin.`;
    }
    for (const autre of autres.filter((a) => a.nature !== nature)) {
        for (const f of fourchettes) {
            for (const g of autre.fourchettes) {
                const n = Math.max(f.du.length, f.au.length, g.du.length, g.au.length);
                const [a1, a2] = [f.du.padEnd(n, '0'), f.au.padEnd(n, '9')];
                const [b1, b2] = [g.du.padEnd(n, '0'), g.au.padEnd(n, '9')];
                if (a1 <= b2 && b1 <= a2) {
                    return `La fourchette « ${f.du} à ${f.au} » chevauche « ${g.du} à ${g.au} » de la nature ${exports.LIBELLES_NATURE[autre.nature]}.`;
                }
            }
        }
    }
    return null;
}
function lireFourchettes(json) {
    if (!Array.isArray(json))
        return [];
    return json.filter((f) => typeof f === 'object' && f !== null && typeof f.du === 'string' && typeof f.au === 'string');
}
function incoherencesDeReport(comptes, natures) {
    const sortie = [];
    for (const c of comptes) {
        if (c.typeCompte === 'TOTAL')
            continue;
        const n = natureDe(c.numero, natures);
        if (n && n.modeReportANouveau !== c.modeReportANouveau) {
            sortie.push({ ...c, nature: n.nature, modeAttendu: n.modeReportANouveau });
        }
    }
    return sortie;
}
//# sourceMappingURL=natures-compte.js.map