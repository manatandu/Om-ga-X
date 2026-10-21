"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.COLONNES_A_REMPLIR = exports.TITRE_PV_CAISSE = exports.TITRE_PV_INVENTAIRE = exports.TITRE_FICHES_DE_COMPTAGE = void 0;
exports.sousCommissionPourEdition = sousCommissionPourEdition;
exports.editionFichesVierges = editionFichesVierges;
exports.editionPvInventaire = editionPvInventaire;
exports.editionPvCaisse = editionPvCaisse;
const client_1 = require("@prisma/client");
exports.TITRE_FICHES_DE_COMPTAGE = 'Fiches de comptage';
exports.TITRE_PV_INVENTAIRE = "Procès-verbal d'inventaire physique";
exports.TITRE_PV_CAISSE = 'Procès-verbal de comptage de caisse';
exports.COLONNES_A_REMPLIR = ["Quantité comptée", "Valeur d'inventaire", 'Pièce de référence'];
const LIEU_NON_RENSEIGNE = 'Lieu non renseigné';
const nombreOuNull = (v) => (v === null || v === undefined ? null : Number(v));
const sommeAuCentime = (valeurs) => Math.round(valeurs.reduce((t, v) => t + Math.round(v * 100), 0)) / 100;
const libelleCompte = (c) => `${c.numero} · ${c.intitule}`;
function sousCommissionPourEdition(sc) {
    const membre = (m) => ({ nom: m.nom, fonction: m.fonction });
    return {
        id: sc.id,
        nom: sc.nom,
        perimetre: sc.perimetre,
        inventoriants: sc.membres.filter((m) => m.role === client_1.RoleMembreInventaire.INVENTORIANT).map(membre),
        temoins: sc.membres.filter((m) => m.role === client_1.RoleMembreInventaire.TEMOIN).map(membre),
    };
}
function comparerFiches(a, b) {
    const la = a.emplacement?.trim() || null;
    const lb = b.emplacement?.trim() || null;
    if (la !== lb) {
        if (la === null)
            return 1;
        if (lb === null)
            return -1;
        const c = la.localeCompare(lb, 'fr');
        if (c !== 0)
            return c;
    }
    return a.compte.numero.localeCompare(b.compte.numero) || a.designation.localeCompare(b.designation, 'fr');
}
function editionFichesVierges(entree) {
    const restreinte = entree.sousCommissionId
        ? entree.sousCommissions.filter((sc) => sc.id === entree.sousCommissionId)
        : [...entree.sousCommissions].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
    const fiches = entree.sousCommissionId
        ? entree.fiches.filter((f) => f.sousCommissionId === entree.sousCommissionId)
        : entree.fiches;
    const ligne = (f) => ({
        ficheId: f.id,
        designation: f.designation,
        compte: libelleCompte(f.compte),
        lieu: f.emplacement?.trim() || LIEU_NON_RENSEIGNE,
        unite: f.uniteMesure,
    });
    const sections = restreinte.map((sc) => ({
        sousCommission: sousCommissionPourEdition(sc),
        lignes: fiches.filter((f) => f.sousCommissionId === sc.id).sort(comparerFiches).map(ligne),
    }));
    const connues = new Set(restreinte.map((sc) => sc.id));
    const orphelines = entree.sousCommissionId
        ? []
        : fiches.filter((f) => !f.sousCommissionId || !connues.has(f.sousCommissionId));
    if (orphelines.length > 0) {
        sections.push({ sousCommission: null, lignes: orphelines.sort(comparerFiches).map(ligne) });
    }
    const nombreFiches = sections.reduce((t, s) => t + s.lignes.length, 0);
    const dejaComptees = fiches.filter((f) => f.quantiteComptee != null || f.valeurInventaire != null).length;
    const quoi = entree.sousCommissionId
        ? `Sous-commission « ${restreinte[0]?.nom ?? ''} »`
        : 'Toutes les sous-commissions';
    const perimetre = `${quoi} · ${nombreFiches} fiche${nombreFiches > 1 ? 's' : ''}` +
        (dejaComptees > 0 ? ` · dont ${dejaComptees} déjà comptée${dejaComptees > 1 ? 's' : ''} (feuille de recomptage)` : '');
    return {
        nature: 'FICHES_DE_COMPTAGE',
        titre: exports.TITRE_FICHES_DE_COMPTAGE,
        campagne: entree.campagne,
        perimetre,
        colonnesARemplir: exports.COLONNES_A_REMPLIR,
        sections,
        nombreFiches,
        dejaComptees,
    };
}
function editionPvInventaire(entree) {
    const sousCommissions = [...entree.sousCommissions]
        .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
        .map(sousCommissionPourEdition);
    const nomSc = new Map(entree.sousCommissions.map((sc) => [sc.id, sc.nom]));
    const fiches = [...entree.fiches].sort(comparerFiches);
    const releve = fiches.map((f) => ({
        designation: f.designation,
        compte: libelleCompte(f.compte),
        lieu: f.emplacement?.trim() || LIEU_NON_RENSEIGNE,
        unite: f.uniteMesure,
        quantite: nombreOuNull(f.quantiteComptee),
        valeur: nombreOuNull(f.valeurInventaire),
        piece: f.referencePiece,
        sousCommission: f.sousCommissionId ? (nomSc.get(f.sousCommissionId) ?? null) : null,
    }));
    const parCompte = new Map();
    for (const f of fiches) {
        const acc = parCompte.get(f.compte.numero) ?? { compte: libelleCompte(f.compte), valeurs: [] };
        acc.valeurs.push(nombreOuNull(f.valeurInventaire));
        parCompte.set(f.compte.numero, acc);
    }
    const totauxParCompte = [...parCompte.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, v]) => {
        const nonValorisees = v.valeurs.filter((x) => x === null).length;
        return {
            compte: v.compte,
            nombreFiches: v.valeurs.length,
            valeurInventaire: nonValorisees > 0 ? null : sommeAuCentime(v.valeurs),
            nonValorisees,
        };
    });
    const ecarts = [...entree.ecarts]
        .sort((a, b) => a.compte.numero.localeCompare(b.compte.numero))
        .map((e) => {
        const ecart = Number(e.ecart);
        return {
            compte: libelleCompte(e.compte),
            valeurInventaire: Number(e.valeurInventaire),
            soldeComptable: Number(e.soldeComptable),
            ecart,
            sens: ecart < 0 ? 'MANQUANT' : ecart > 0 ? 'EXCEDENT' : 'SANS_ECART',
            nombreFiches: e.nombreFiches,
            rapprocheLe: e.rapprocheLe,
            decision: e.decision,
            responsable: e.responsable,
            explication: e.explication,
            arbitreLe: e.arbitreLe,
        };
    });
    const rapprochee = entree.campagne.statut === client_1.StatutCampagneInventaire.ARBITRAGE ||
        entree.campagne.statut === client_1.StatutCampagneInventaire.CLOTUREE;
    const caisses = [...entree.pvCaisses]
        .sort((a, b) => a.compte.numero.localeCompare(b.compte.numero))
        .map((p) => ({
        pvId: p.id,
        caisse: libelleCompte(p.compte),
        dateComptage: p.dateComptage,
        heureComptage: p.heureComptage,
        sousCommission: p.sousCommission.nom,
        unite: p.unite,
        especesComptees: Number(p.especesComptees),
        soldeComptable: Number(p.soldeComptableFige),
        ecart: Number(p.ecart),
    }));
    const signataires = { inventoriants: [], temoins: [] };
    for (const sc of sousCommissions) {
        for (const m of sc.inventoriants)
            signataires.inventoriants.push({ ...m, sousCommission: sc.nom });
        for (const m of sc.temoins)
            signataires.temoins.push({ ...m, sousCommission: sc.nom });
    }
    const mentions = [];
    if (!entree.etabli)
        mentions.push('Procès-verbal non établi dans OmegaX · document de travail.');
    if (signataires.inventoriants.length === 0)
        mentions.push('Aucun inventoriant enregistré.');
    if (signataires.temoins.length === 0)
        mentions.push('Aucun témoin enregistré.');
    const nonComptees = releve.filter((l) => l.quantite === null).length;
    if (nonComptees > 0)
        mentions.push(`${nonComptees} fiche${nonComptees > 1 ? 's' : ''} sans quantité comptée.`);
    const nonValorisees = releve.filter((l) => l.valeur === null).length;
    if (nonValorisees > 0)
        mentions.push(`${nonValorisees} fiche${nonValorisees > 1 ? 's' : ''} sans valeur d'inventaire.`);
    if (!rapprochee)
        mentions.push('Écarts non encore rapprochés de la balance.');
    const sansDecision = ecarts.filter((e) => e.decision === null).length;
    if (sansDecision > 0)
        mentions.push(`${sansDecision} écart${sansDecision > 1 ? 's' : ''} sans décision.`);
    return {
        nature: 'PROCES_VERBAL_INVENTAIRE',
        titre: exports.TITRE_PV_INVENTAIRE,
        campagne: entree.campagne,
        etabli: entree.etabli,
        sousCommissions,
        releve,
        totauxParCompte,
        rapprochee,
        ecarts,
        caisses,
        signataires,
        mentions,
    };
}
function editionPvCaisse(entree) {
    const pv = entree.pv;
    const reconstitution = pv.compteApresLaCloture && pv.soldeALaCloture != null && pv.encaissementsPosterieurs != null && pv.decaissementsPosterieurs != null
        ? {
            dateCloture: pv.dateCloture,
            soldeALaCloture: Number(pv.soldeALaCloture),
            mouvementsValeurAvantCloture: nombreOuNull(pv.mouvementsValeurAvantCloture),
            encaissementsPosterieurs: Number(pv.encaissementsPosterieurs),
            decaissementsPosterieurs: Number(pv.decaissementsPosterieurs),
            mouvementsPosterieurs: pv.mouvementsPosterieurs,
            especesReconstitueesALaCloture: pv.especesReconstitueesALaCloture,
        }
        : null;
    const coupures = [...pv.coupures]
        .map((c) => {
        const valeurUnitaire = Number(c.valeurUnitaire);
        return { valeurUnitaire, nombre: c.nombre, total: Math.round(valeurUnitaire * 100 * c.nombre) / 100 };
    })
        .sort((a, b) => b.valeurUnitaire - a.valeurUnitaire);
    return {
        nature: 'PROCES_VERBAL_CAISSE',
        titre: exports.TITRE_PV_CAISSE,
        campagne: entree.campagne,
        pvId: pv.id,
        caisse: libelleCompte(pv.compte),
        sousCommission: sousCommissionPourEdition(entree.sousCommission),
        dateComptage: pv.dateComptage,
        heureComptage: pv.heureComptage,
        unite: pv.unite,
        modeComparaison: pv.modeComparaison,
        especesComptees: Number(pv.especesComptees),
        soldeComptable: Number(pv.soldeComptableFige),
        ecart: Number(pv.ecart),
        reconstitution,
        compteApresLaCloture: pv.compteApresLaCloture,
        reconstitutionManquante: pv.reconstitutionManquante,
        coupures,
        totalCoupures: coupures.length > 0 ? sommeAuCentime(coupures.map((c) => c.total)) : null,
        attestation: pv.attestationEtablieLe ? { le: pv.attestationEtablieLe, par: pv.attestationPar } : null,
        observations: pv.observations,
        etabli: { le: pv.etabliLe, par: entree.etabliPar },
        mentions: pv.mentions,
    };
}
//# sourceMappingURL=editions-inventaire.js.map