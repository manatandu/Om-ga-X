"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.lireEtatDuPooling = lireEtatDuPooling;
exports.messageDePooling = messageDePooling;
function lireEtatDuPooling(chaine) {
    if (!chaine)
        return null;
    let url;
    try {
        url = new URL(chaine);
    }
    catch {
        return null;
    }
    const limite = url.searchParams.get('connection_limit');
    const valeur = limite === null ? null : Number(limite);
    return {
        poole: url.hostname.includes('-pooler'),
        pgbouncerDeclare: url.searchParams.get('pgbouncer') === 'true',
        plafondConnexions: valeur !== null && Number.isFinite(valeur) ? valeur : null,
    };
}
function messageDePooling(etat) {
    if (!etat)
        return 'Base · chaîne de connexion absente ou illisible';
    const plafond = etat.plafondConnexions === null ? 'défaut Prisma' : `${etat.plafondConnexions} par instance`;
    if (!etat.poole) {
        return `Base · endpoint DIRECT (non poolé), plafond de connexions ${plafond}`;
    }
    return (`Base · endpoint POOLÉ, plafond de connexions ${plafond}` +
        (etat.pgbouncerDeclare ? '' : ' · ATTENTION : pgbouncer=true absent de la chaîne'));
}
//# sourceMappingURL=pooling-base.js.map