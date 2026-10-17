"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTE_DU_TRANSFERT = void 0;
exports.phrasesTransfertDepreciation = phrasesTransfertDepreciation;
exports.rubriqueQuiLit = rubriqueQuiLit;
const client_1 = require("@prisma/client");
exports.NOTE_DU_TRANSFERT = {
    [client_1.JeuNotesAnnexes.SYSCOHADA_SYSTEME_NORMAL]: '28',
    [client_1.JeuNotesAnnexes.ASSOCIATIONS_ORDRES_PROFESSIONNELS]: '5F',
};
const EPSILON = 0.005;
const centimes = (x) => Math.round(x * 100) / 100;
const montant = (n) => centimes(n).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function estHao(m) {
    return m.nature === 'TRANSFERT_DOTATION' ? m.numeroContrepartie.startsWith('85') : m.numeroContrepartie.startsWith('86');
}
function niveaux(ms) {
    const hao = ms.some(estHao);
    const exploitation = ms.some((m) => !estHao(m));
    return hao && exploitation ? 'exploitation et H.A.O.' : hao ? 'H.A.O.' : 'exploitation';
}
function phrasesTransfertDepreciation(mouvements, ligneDe) {
    const phrases = [];
    const valides = mouvements.filter((m) => m.valide);
    const reprises = valides.filter((m) => m.nature === 'TRANSFERT_REPRISE');
    const dotations = valides.filter((m) => m.nature === 'TRANSFERT_DOTATION');
    const total = (ms) => centimes(ms.reduce((s, m) => s + m.montant, 0));
    const reprise = total(reprises);
    const dotation = total(dotations);
    if (reprise > EPSILON || dotation > EPSILON) {
        const lignes = (ms) => [...new Set(ms.map((m) => ligneDe(m.numeroCompteDepreciation)))];
        const lignesReprise = lignes(reprises);
        const lignesDotation = lignes(dotations);
        const memeLigne = lignesReprise.length === 1 &&
            lignesDotation.length === 1 &&
            lignesReprise[0] === lignesDotation[0];
        const nomme = (ls) => ls.every((l) => l !== null) && ls.length > 0
            ? ` sur la ligne ${ls.map((l) => `« ${l} »`).join(' et ')}`
            : '';
        const surReprise = memeLigne ? '' : nomme(lignesReprise);
        const surDotation = memeLigne ? '' : nomme(lignesDotation);
        phrases.push(`Dont transfert à la mise en service · ${montant(reprise)} en reprise${surReprise} et ${montant(dotation)} en ` +
            `dotation${surDotation} (${niveaux(valides)}), dépréciation déjà constatée sur l'immobilisation en cours, ` +
            'portée au compte du bien achevé, sans perte de valeur nouvelle.');
    }
    const auBrouillard = mouvements.filter((m) => !m.valide);
    if (auBrouillard.length > 0) {
        const r = total(auBrouillard.filter((m) => m.nature === 'TRANSFERT_REPRISE'));
        const d = total(auBrouillard.filter((m) => m.nature === 'TRANSFERT_DOTATION'));
        phrases.push(`Transfert à la mise en service au brouillard · ${montant(r)} en reprise et ${montant(d)} en dotation, hors des ` +
            'colonnes de la note tant que ses écritures ne sont pas validées.');
    }
    return phrases;
}
function rubriqueQuiLit(numero, rubriques, rattaches) {
    for (const r of rattaches) {
        if ((r.comptesRattaches ?? []).some((c) => numero.startsWith(c) || c.startsWith(numero)))
            return r.libelle;
    }
    let retenue = null;
    for (const r of rubriques) {
        if (r.totalDeRubriques)
            continue;
        for (const prefixe of r.comptes ?? []) {
            if (numero.startsWith(prefixe) && (!retenue || prefixe.length > retenue.longueur)) {
                retenue = { libelle: r.libelle, longueur: prefixe.length };
            }
        }
    }
    return retenue?.libelle ?? null;
}
//# sourceMappingURL=transfert-depreciation-note.js.map