"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estDu4428 = exports.RACINES_CHARGE_INPP_ONEM = exports.RACINE_4428 = void 0;
exports.partagerLe4428 = partagerLe4428;
exports.mentionDu4428Mele = mentionDu4428Mele;
exports.RACINE_4428 = '4428';
exports.RACINES_CHARGE_INPP_ONEM = ['6413', '6415'];
const estDu4428 = (numero) => numero.startsWith(exports.RACINE_4428);
exports.estDu4428 = estDu4428;
function partagerLe4428(lignes) {
    const du4428 = lignes.filter((l) => (0, exports.estDu4428)(l.compte.numero));
    const structurelle = (l) => l.ecriture.estDePaie === true || l.ecriture.porteUneChargeInppOnem === true;
    const rattachees = new Set(du4428.filter(structurelle));
    const groupes = new Set([...rattachees].map((l) => l.lettrageId).filter((g) => typeof g === 'string' && g.length > 0));
    for (const l of du4428) {
        if (l.lettrageId && groupes.has(l.lettrageId))
            rattachees.add(l);
    }
    const etrangers = du4428.filter((l) => !rattachees.has(l) && Number(l.credit) > 0);
    const pur = etrangers.length === 0;
    const centimes = (v) => Math.round(v * 100) / 100;
    if (pur) {
        return { pur, lues: new Set(du4428), creditsEtrangersFc: 0, reversementsNonRattachesFc: 0 };
    }
    const nonRattaches = du4428.filter((l) => !rattachees.has(l) && Number(l.debit) > 0);
    return {
        pur,
        lues: rattachees,
        creditsEtrangersFc: centimes(etrangers.reduce((s, l) => s + Number(l.credit), 0)),
        reversementsNonRattachesFc: centimes(nonRattaches.reduce((s, l) => s + Number(l.debit), 0)),
    };
}
function mentionDu4428Mele(p, soldeOuverture4428Fc) {
    if (p.pur)
        return null;
    return (`LE 4428 PORTE D'AUTRES IMPÔTS ET TAXES · ${p.creditsEtrangersFc.toFixed(2)} FC crédités cet exercice ne viennent ni de la paie ni d'une charge d'INPP (6415) ou d'ONEM (6413), et ne sont pas comptés ici. ` +
        (Math.abs(soldeOuverture4428Fc) > 0.005
            ? `Son solde d'ouverture (${soldeOuverture4428Fc.toFixed(2)} FC), qu'un report à-nouveau ne ventile pas, ne l'est pas non plus. `
            : '') +
        (p.reversementsNonRattachesFc > 0.005
            ? `${p.reversementsNonRattachesFc.toFixed(2)} FC de reversements au 4428 ne sont rattachés à aucune dette · tant qu'ils ne sont pas lettrés avec celle qu'ils éteignent, aucun mois de l'INPP et de l'ONEM n'est dit en retard.`
            : 'Les reversements comptés ici sont ceux que la paie ou un lettrage rattache.'));
}
//# sourceMappingURL=inpp-onem-du-4428.js.map