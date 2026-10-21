"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MENTION_ASBL = exports.FORMES_ASBL_ARTICLE_16 = exports.SELECT_IDENTITE_SOCIETE = exports.FORMES_CAPITAL_VARIABLE = exports.FORMES_A_ASSOCIE_UNIQUE_DECLARE = exports.FORMES_SOCIETES_COMMERCIALES = void 0;
exports.motifRefusCapitalVariable = motifRefusCapitalVariable;
exports.motifRefusCapital = motifRefusCapital;
exports.mentionsArticle17 = mentionsArticle17;
exports.identiteSociete = identiteSociete;
exports.mentionsRecopiees = mentionsRecopiees;
exports.mentionsCooperative = mentionsCooperative;
exports.mentionsAsbl = mentionsAsbl;
exports.mentionsEmetteur = mentionsEmetteur;
exports.mentionLiquidation = mentionLiquidation;
const client_1 = require("@prisma/client");
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
const mentions_immatriculation_1 = require("./mentions-immatriculation");
exports.FORMES_SOCIETES_COMMERCIALES = [
    client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
    client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
    client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
    client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
    client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE,
];
exports.FORMES_A_ASSOCIE_UNIQUE_DECLARE = [
    client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
    client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
    client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
];
const FORME_SOCIALE = {
    SOCIETE_ANONYME: 'Société anonyme',
    SOCIETE_PAR_ACTIONS_SIMPLIFIEE: 'Société par actions simplifiée',
    SOCIETE_RESPONSABILITE_LIMITEE: 'Société à responsabilité limitée',
    SOCIETE_NOM_COLLECTIF: 'Société en nom collectif',
    SOCIETE_COMMANDITE_SIMPLE: 'Société en commandite simple',
};
exports.FORMES_CAPITAL_VARIABLE = [
    client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
    client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE,
];
function motifRefusCapitalVariable(forme) {
    if (forme && exports.FORMES_SOCIETES_COMMERCIALES.includes(forme) && !exports.FORMES_CAPITAL_VARIABLE.includes(forme)) {
        return "Le capital variable n'est ouvert qu'à la société anonyme ne faisant pas appel public à l'épargne et à la société par actions simplifiée (AUSCGIE art. 269-1).";
    }
    return null;
}
function motifRefusCapital(referentiel, forme) {
    if (referentiel === client_1.Referentiel.SYCEBNL) {
        return "Une entité à but non lucratif n'a pas de capital social · ses fonds propres se lisent au compte 10 (dotation), pas dans un capital.";
    }
    if (forme && correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES.includes(forme)) {
        return "Un commerçant personne physique ou un entreprenant n'a pas de capital social · il n'y a pas de société.";
    }
    return null;
}
exports.SELECT_IDENTITE_SOCIETE = {
    referentiel: true,
    formeJuridiqueSyscohada: true,
    nom: true,
    capitalSocial: true,
    capitalVariable: true,
    adresse: true,
    ville: true,
    rccm: true,
    devise: true,
    numeroDeclarationActivite: true,
    locataireGerantFonds: true,
    formeJuridique: true,
    droitEtranger: true,
    numeroRegistreCooperatives: true,
    varianteCooperative: true,
    modeAdministrationSa: true,
    associeUnique: true,
    dateDissolution: true,
    liquidateurs: true,
    associeUniquePersonneMorale: true,
    regimeLiquidation: true,
};
const montant = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ | /g, ' ');
function ligneSiege(t) {
    const renseigne = (v) => !!v && v.trim() !== '';
    return {
        texte: [t.adresse, t.ville].filter((v) => renseigne(v)).join(', '),
        adresse: renseigne(t.adresse),
    };
}
function mentionsArticle17(t) {
    if (t.referentiel !== client_1.Referentiel.SYSCOHADA || !t.formeJuridiqueSyscohada)
        return { ligne: null, manquantes: [] };
    if (!exports.FORMES_SOCIETES_COMMERCIALES.includes(t.formeJuridiqueSyscohada))
        return { ligne: null, manquantes: [] };
    const morceaux = [];
    const manquantes = [];
    let forme = FORME_SOCIALE[t.formeJuridiqueSyscohada];
    if (t.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME) {
        if (t.modeAdministrationSa === 'CONSEIL_ADMINISTRATION')
            forme = 'Société anonyme avec conseil d’administration';
        else if (t.modeAdministrationSa === 'ADMINISTRATEUR_GENERAL')
            forme = 'Société anonyme avec administrateur général';
        else
            manquantes.push('mode d’administration de la société anonyme (AUSCGIE art. 386 et 414)');
    }
    if (t.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE) {
        if (t.associeUnique === true)
            forme = 'Société par actions simplifiée unipersonnelle';
        else if (t.associeUnique !== false)
            manquantes.push('associé unique ou non (AUSCGIE art. 853-2)');
    }
    const variableAdmis = exports.FORMES_CAPITAL_VARIABLE.includes(t.formeJuridiqueSyscohada);
    morceaux.push(t.capitalVariable && variableAdmis ? `${forme} à capital variable` : forme);
    if (t.capitalVariable && !variableAdmis) {
        manquantes.push('« à capital variable » non imprimé · réservé à la SA et à la SAS (AUSCGIE art. 269-1)');
    }
    if (t.capitalSocial !== null) {
        morceaux.push(`au capital de ${montant(t.capitalSocial)} ${t.devise ?? ''}`.trim());
    }
    else {
        manquantes.push('montant du capital social');
    }
    const siege = ligneSiege(t);
    if (siege.texte)
        morceaux.push(`siège social : ${siege.texte}`);
    if (!siege.adresse)
        manquantes.push('adresse du siège social');
    if (t.rccm)
        morceaux.push(`RCCM ${t.rccm}`);
    else
        manquantes.push("numéro d'immatriculation au RCCM");
    return { ligne: morceaux.join(' · '), manquantes };
}
function identiteSociete(t) {
    return { ...t, capitalSocial: t.capitalSocial === null ? null : Number(t.capitalSocial) };
}
function mentionsRecopiees(t, datePiece = new Date()) {
    return { denomination: t.nom, ...mentionsEmetteur(t, datePiece) };
}
const EXPRESSION_COOPERATIVE = {
    SCOOPS: 'Société Coopérative Simplifiée · SCOOPS',
    COOP_CA: "Société Coopérative avec Conseil d'Administration · COOP-CA",
};
function mentionsCooperative(t, datePiece = new Date()) {
    const morceaux = [];
    const manquantes = [];
    const renseigne = (v) => (v && v.trim() ? v.trim() : null);
    if (t.dateDissolution && t.dateDissolution.getTime() <= datePiece.getTime()) {
        const liquidateurs = renseigne(t.liquidateurs);
        morceaux.push(liquidateurs ? `Société en liquidation · liquidateur : ${liquidateurs}` : 'Société en liquidation');
        if (!liquidateurs)
            manquantes.push('nom du ou des liquidateurs (AUSCOOP art. 183)');
    }
    if (t.varianteCooperative)
        morceaux.push(EXPRESSION_COOPERATIVE[t.varianteCooperative]);
    else
        manquantes.push('forme de la société coopérative (AUSCOOP art. 19, 205 ou 268)');
    const siege = ligneSiege(t);
    if (siege.texte)
        morceaux.push(`siège social : ${siege.texte}`);
    if (!siege.adresse)
        manquantes.push('adresse du siège social (AUSCOOP art. 19)');
    const numero = renseigne(t.numeroRegistreCooperatives);
    if (numero)
        morceaux.push(`Registre des Sociétés Coopératives n° ${numero}`);
    else
        manquantes.push("numéro d'immatriculation au Registre des Sociétés Coopératives (AUSCOOP art. 19 et 74)");
    return { ligne: morceaux.length ? morceaux.join(' · ') : null, manquantes };
}
exports.FORMES_ASBL_ARTICLE_16 = [
    client_1.FormeJuridiqueEbnl.ASSOCIATION,
    client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE,
    client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE,
];
exports.MENTION_ASBL = 'Association sans but lucratif · A.S.B.L.';
function mentionsAsbl(t) {
    if (t.referentiel !== client_1.Referentiel.SYCEBNL || !t.formeJuridique || t.droitEtranger)
        return { ligne: null, manquantes: [] };
    if (!exports.FORMES_ASBL_ARTICLE_16.includes(t.formeJuridique))
        return { ligne: null, manquantes: [] };
    const portee = /association\s+sans\s+but\s+lucratif|\ba\.?\s*s\.?\s*b\.?\s*l\b/i.test(t.nom);
    return { ligne: portee ? null : exports.MENTION_ASBL, manquantes: [] };
}
function mentionsEmetteur(t, datePiece = new Date()) {
    if (t.referentiel === client_1.Referentiel.SYCEBNL)
        return mentionsAsbl(t);
    if (t.formeJuridiqueSyscohada === client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE)
        return mentionsCooperative(t, datePiece);
    const art17 = mentionsArticle17(t);
    if (art17.ligne === null)
        return (0, mentions_immatriculation_1.mentionImmatriculation)(t);
    const liquidation = mentionLiquidation(t, datePiece);
    const locataire = t.locataireGerantFonds === true ? 'Locataire-gérant du fonds de commerce · ' : '';
    return {
        ligne: `${liquidation.ligne ? `${liquidation.ligne} · ` : ''}${locataire}${art17.ligne}`,
        manquantes: [...liquidation.manquantes, ...art17.manquantes],
    };
}
function mentionLiquidation(t, datePiece = new Date()) {
    if (!t.dateDissolution ||
        t.dateDissolution.getTime() > datePiece.getTime() ||
        !t.formeJuridiqueSyscohada ||
        !exports.FORMES_SOCIETES_COMMERCIALES.includes(t.formeJuridiqueSyscohada) ||
        (t.associeUniquePersonneMorale === true && t.regimeLiquidation !== client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE) ||
        t.regimeLiquidation === client_1.RegimeLiquidation.PROCEDURE_COLLECTIVE) {
        return { ligne: null, manquantes: [] };
    }
    const liquidateurs = t.liquidateurs?.trim();
    return liquidateurs
        ? { ligne: `Société en liquidation · liquidateur(s) : ${liquidateurs}`, manquantes: [] }
        : { ligne: 'Société en liquidation', manquantes: ['nom du ou des liquidateurs (AUSCGIE art. 204)'] };
}
//# sourceMappingURL=mentions-societe.js.map