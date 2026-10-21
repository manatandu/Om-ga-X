"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.libelleEcartNonPasse = libelleEcartNonPasse;
exports.candidatsSoldesEnDevise = candidatsSoldesEnDevise;
exports.groupesSoldesEnDevise = groupesSoldesEnDevise;
const ecart_change_realise_1 = require("../reglements/ecart-change-realise");
const centimes = (x) => Math.round(Number(x ?? 0) * 100);
function libelleEcartNonPasse(ecart) {
    const montant = Math.abs(ecart).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(/\u202f/g, ' ');
    return `${(0, ecart_change_realise_1.libelleEcartRealise)(ecart)} de ${montant} non passé · facture soldée dans sa devise, rien n'est réclamé ; passer l'écart au lettrage du compte (AUDCIF art. 55)`;
}
function candidatsSoldesEnDevise(lues) {
    const groupes = new Map();
    for (const l of lues)
        if (l.lettrageId)
            groupes.set(l.lettrageId, [...(groupes.get(l.lettrageId) ?? []), l]);
    const candidats = new Map();
    for (const [id, membres] of groupes) {
        if (membres.length < 2)
            continue;
        if (!membres.every((l) => l.deviseId !== null && l.montantDevise !== null))
            continue;
        const r = (0, ecart_change_realise_1.ecartDuGroupe)(membres.map((l) => ({
            debit: Number(l.debit),
            credit: Number(l.credit),
            deviseId: l.deviseId,
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
        })));
        if (!r)
            continue;
        const ecart = membres.reduce((t, l) => t + centimes(l.debit) - centimes(l.credit), 0);
        if (ecart === 0)
            continue;
        candidats.set(id, { lignes: membres.length, ecart: ecart / 100 });
    }
    return candidats;
}
async function groupesSoldesEnDevise(db, tenantId, lues) {
    const candidats = candidatsSoldesEnDevise(lues);
    const resultat = new Map();
    if (candidats.size === 0)
        return resultat;
    const groupes = (await db.lettrage.findMany({
        where: { tenantId, id: { in: [...candidats.keys()] } },
        select: { id: true, code: true, compteId: true, _count: { select: { lignes: true } } },
    }));
    for (const g of groupes) {
        const c = candidats.get(g.id);
        if (!c || g._count.lignes !== c.lignes)
            continue;
        resultat.set(g.id, { lettrageId: g.id, code: g.code.toLowerCase(), compteId: g.compteId, ecart: c.ecart, libelle: libelleEcartNonPasse(c.ecart) });
    }
    return resultat;
}
//# sourceMappingURL=groupes-soldes-en-devise.js.map