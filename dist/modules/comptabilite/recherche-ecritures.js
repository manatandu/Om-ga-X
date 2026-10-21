"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lireCriteres = lireCriteres;
exports.filtreRecherche = filtreRecherche;
exports.criteresOuRefus = criteresOuRefus;
const common_1 = require("@nestjs/common");
function lireCriteres(q) {
    const criteres = {};
    const nombre = (s) => Number(s.replace(/\s/g, '').replace(',', '.'));
    if (q.compte?.trim()) {
        const c = q.compte.replace(/\s/g, '');
        if (!/^\d+$/.test(c))
            return { motif: 'Le compte se cherche par son numéro ou sa racine (chiffres seulement).' };
        criteres.compte = c;
    }
    if (q.montant?.trim()) {
        const m = nombre(q.montant);
        if (!Number.isFinite(m) || m < 0)
            return { motif: 'Montant illisible.' };
        criteres.montantMin = m;
    }
    if (q.montantMax?.trim()) {
        const m = nombre(q.montantMax);
        if (!Number.isFinite(m) || m < 0)
            return { motif: 'Montant maximal illisible.' };
        if (criteres.montantMin === undefined)
            return { motif: 'Une fourchette de montants commence par le montant minimal.' };
        if (m < criteres.montantMin)
            return { motif: 'Le montant maximal est inférieur au minimal.' };
        criteres.montantMax = m;
    }
    if (q.numeroPiece?.trim()) {
        const n = Number(q.numeroPiece.trim());
        if (!Number.isInteger(n) || n <= 0)
            return { motif: 'Le numéro de pièce est un entier positif.' };
        criteres.numeroPiece = n;
    }
    if (q.reference?.trim())
        criteres.reference = q.reference.trim();
    return { criteres };
}
function filtreRecherche(c) {
    const et = [];
    if (c.recherche) {
        const contient = { contains: c.recherche, mode: 'insensitive' };
        et.push({ OR: [{ libelle: contient }, { lignes: { some: { libelle: contient } } }] });
    }
    if (c.numeroPiece !== undefined)
        et.push({ numeroPiece: c.numeroPiece });
    if (c.reference)
        et.push({ reference: { contains: c.reference, mode: 'insensitive' } });
    const ligne = {};
    if (c.compte)
        ligne.compte = { numero: { startsWith: c.compte } };
    if (c.montantMin !== undefined) {
        const borne = { gte: c.montantMin, lte: c.montantMax ?? c.montantMin };
        ligne.OR = [{ debit: borne }, { credit: borne }];
    }
    if (Object.keys(ligne).length > 0)
        et.push({ lignes: { some: ligne } });
    return et.length ? { AND: et } : {};
}
function criteresOuRefus(q) {
    const r = lireCriteres(q);
    if ('motif' in r)
        throw new common_1.BadRequestException(r.motif);
    return r.criteres;
}
//# sourceMappingURL=recherche-ecritures.js.map