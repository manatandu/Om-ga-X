"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENTION_ENTREPRENANT = void 0;
exports.mentionImmatriculation = mentionImmatriculation;
exports.immatriculationDesLivres = immatriculationDesLivres;
exports.numeroRegistreLiasse = numeroRegistreLiasse;
const client_1 = require("@prisma/client");
const mentions_societe_1 = require("./mentions-societe");
const estImmatriculeeObligatoirement = (forme) => mentions_societe_1.FORMES_SOCIETES_COMMERCIALES.includes(forme) ||
    forme === client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE ||
    forme === client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE ||
    forme === client_1.FormeJuridiqueSyscohada.SUCCURSALE;
exports.MENTION_ENTREPRENANT = 'Entreprenant dispensé d’immatriculation';
function mentionImmatriculation(t) {
    if (t.referentiel !== client_1.Referentiel.SYSCOHADA || !t.formeJuridiqueSyscohada)
        return { ligne: null, manquantes: [] };
    const forme = t.formeJuridiqueSyscohada;
    const renseigne = (v) => (v && v.trim() ? v.trim() : null);
    if (forme === client_1.FormeJuridiqueSyscohada.ENTREPRENANT) {
        const n = renseigne(t.numeroDeclarationActivite);
        return n
            ? { ligne: `N° de déclaration d’activité ${n} (RCCM) · ${exports.MENTION_ENTREPRENANT}`, manquantes: [] }
            : { ligne: exports.MENTION_ENTREPRENANT, manquantes: ['numéro de déclaration d’activité (AUDCG art. 62)'] };
    }
    if (forme === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE)
        return { ligne: null, manquantes: [] };
    const rccm = renseigne(t.rccm);
    const morceaux = [];
    const manquantes = [];
    if (forme === client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE)
        morceaux.push('Groupement d’intérêt économique');
    if (t.locataireGerantFonds === true)
        morceaux.push('Locataire-gérant du fonds de commerce');
    if (rccm)
        morceaux.push(`RCCM ${rccm}`);
    else if (estImmatriculeeObligatoirement(forme) || t.locataireGerantFonds === true) {
        manquantes.push('numéro et lieu d’immatriculation au RCCM (AUDCG art. 59)');
    }
    return { ligne: morceaux.length ? morceaux.join(' · ') : null, manquantes };
}
function immatriculationDesLivres(t) {
    const m = mentionImmatriculation(t);
    if (m.manquantes.length === 0)
        return m.ligne ?? '';
    if (t.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.ENTREPRENANT) {
        return `N° de déclaration d’activité non renseigné · ${exports.MENTION_ENTREPRENANT}`;
    }
    return `${m.ligne ? `${m.ligne} · ` : ''}RCCM non renseigné`;
}
function numeroRegistreLiasse(t) {
    if (t.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.ENTREPRENANT) {
        const n = t.numeroDeclarationActivite?.trim();
        return n ? `N° de déclaration d’activité ${n} · ${exports.MENTION_ENTREPRENANT}` : '';
    }
    if (t.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE) {
        const n = t.numeroRegistreCooperatives?.trim();
        return n ? `Registre des Sociétés Coopératives n° ${n}` : '';
    }
    return t.rccm?.trim() ?? '';
}
//# sourceMappingURL=mentions-immatriculation.js.map