"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LIEUX_SERVIS_PAR_CLIENT = exports.LONGUEUR_INTITULE_LIEU = void 0;
exports.motifRefusTypeLieu = motifRefusTypeLieu;
exports.intituleDuLieu = intituleDuLieu;
exports.motifRefusIntitule = motifRefusIntitule;
exports.principalApres = principalApres;
exports.intituleRenomme = intituleRenomme;
exports.renommagesALaFusion = renommagesALaFusion;
exports.LONGUEUR_INTITULE_LIEU = 35;
exports.LIEUX_SERVIS_PAR_CLIENT = 200;
function motifRefusTypeLieu(type) {
    return type === 'CLIENT'
        ? null
        : 'Un lieu de livraison se rattache à un client · un fournisseur, un salarié ou un autre tiers garde son adresse sur sa fiche.';
}
function intituleDuLieu(v) {
    return v.replace(/\s+/g, ' ').trim();
}
function motifRefusIntitule(intitule, autres, idCourant) {
    if (intitule === '')
        return "L'intitulé du lieu de livraison est obligatoire · il le nomme sur les documents.";
    if (intitule.length > exports.LONGUEUR_INTITULE_LIEU)
        return `L'intitulé du lieu compte au plus ${exports.LONGUEUR_INTITULE_LIEU} caractères.`;
    const pris = autres.find((a) => a.id !== idCourant && a.intitule.toLocaleLowerCase('fr') === intitule.toLocaleLowerCase('fr'));
    return pris ? `Ce client a déjà un lieu « ${pris.intitule} » · deux lieux de même nom ne se distinguent plus sur un document.` : null;
}
function principalApres(p) {
    if (p.demande === true && !p.actifApres) {
        return { motif: 'Un lieu en sommeil ne peut pas être le lieu principal · réactivez-le d’abord.' };
    }
    if (!p.actifApres)
        return { estPrincipal: false };
    if (p.demande !== undefined)
        return { estPrincipal: p.demande };
    return { estPrincipal: p.actuel || p.autresLieuxActifs === 0 };
}
function intituleRenomme(intitule, codeDoublon) {
    const suffixe = ` · ${codeDoublon}`;
    return `${intitule.slice(0, Math.max(1, exports.LONGUEUR_INTITULE_LIEU - suffixe.length)).trimEnd()}${suffixe}`.slice(0, exports.LONGUEUR_INTITULE_LIEU);
}
function renommagesALaFusion(conserves, duDoublon, codeDoublon) {
    const cle = (x) => x.toLocaleLowerCase('fr');
    const intitulesConserves = new Set(conserves.map(cle));
    const enCollision = duDoublon.filter((l) => intitulesConserves.has(cle(l.intitule)));
    const pris = new Set([...intitulesConserves, ...duDoublon.filter((l) => !intitulesConserves.has(cle(l.intitule))).map((l) => cle(l.intitule))]);
    const renommes = new Map();
    for (const l of enCollision) {
        let rang = 1;
        let nom = intituleRenomme(l.intitule, codeDoublon);
        while (pris.has(cle(nom))) {
            rang += 1;
            nom = intituleRenomme(l.intitule, `${codeDoublon}-${rang}`);
        }
        pris.add(cle(nom));
        renommes.set(l.id, nom);
    }
    return renommes;
}
//# sourceMappingURL=lieux-livraison.js.map