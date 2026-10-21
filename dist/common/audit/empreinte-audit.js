"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EMPREINTE_ORIGINE = void 0;
exports.calculerEmpreinte = calculerEmpreinte;
const node_crypto_1 = require("node:crypto");
exports.EMPREINTE_ORIGINE = 'origine';
function serialiserStable(valeur) {
    if (valeur === null || valeur === undefined)
        return 'null';
    if (Array.isArray(valeur))
        return `[${valeur.map(serialiserStable).join(',')}]`;
    if (valeur instanceof Date)
        return JSON.stringify(valeur.toISOString());
    if (typeof valeur === 'object') {
        const o = valeur;
        const cles = Object.keys(o).sort();
        return `{${cles.map((c) => `${JSON.stringify(c)}:${serialiserStable(o[c])}`).join(',')}}`;
    }
    if (typeof valeur === 'bigint')
        return `"${valeur.toString()}"`;
    return JSON.stringify(valeur);
}
function calculerEmpreinte(contenu) {
    const corps = serialiserStable({
        rang: contenu.rang,
        tenantId: contenu.tenantId,
        horodatage: contenu.horodatage.toISOString(),
        acteurId: contenu.acteurId,
        acteurEmail: contenu.acteurEmail,
        adresseIp: contenu.adresseIp,
        action: contenu.action,
        entite: contenu.entite,
        entiteId: contenu.entiteId,
        avant: contenu.avant ?? null,
        apres: contenu.apres ?? null,
        precedente: contenu.empreintePrecedente,
    });
    return (0, node_crypto_1.createHash)('sha256').update(corps, 'utf8').digest('hex');
}
//# sourceMappingURL=empreinte-audit.js.map