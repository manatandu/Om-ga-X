"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.montantFiscal = exports.LONGUEUR_MIN_ATTESTATION = exports.CONDITIONS_A_DECLARER = exports.COMPTES_IMPOT_RESULTAT = void 0;
exports.motifsRefusConstat = motifsRefusConstat;
exports.imputationAcomptes = imputationAcomptes;
exports.compteDeLaCharge = compteDeLaCharge;
exports.lignesConstat = lignesConstat;
const correspondance_retenues_1 = require("../retenues/correspondance-retenues");
exports.COMPTES_IMPOT_RESULTAT = {
    charge: '89110000',
    chargeMinimum: '89500000',
    dette: '44100000',
    acomptes: '44920000',
    annulationPertesRetroactives: '89940000',
};
exports.CONDITIONS_A_DECLARER = {
    SOCIETE_NOM_COLLECTIF: "société de personnes · l'impôt sur les sociétés ne s'applique que sur OPTION irrévocable, levée en assemblée générale et notifiée dans les trois mois du début de l'exercice (loi n° 23/053, art. 4)",
    SOCIETE_COMMANDITE_SIMPLE: "société de personnes · l'impôt sur les sociétés ne s'applique que sur OPTION irrévocable, levée en assemblée générale et notifiée dans les trois mois du début de l'exercice (loi n° 23/053, art. 4)",
    GROUPEMENT_INTERET_ECONOMIQUE: "groupement d'intérêt économique · exonéré pour la quote-part de bénéfice distribuée à ses membres personnes physiques (loi n° 23/053, art. 6), à retrancher par une déduction avant de constater l'impôt",
    SOCIETE_COOPERATIVE: "société coopérative · exemptée si elle produit, transforme, conserve ou vend des produits agricoles, de l'élevage ou de la pêche et revêt la forme civile (loi n° 23/053, art. 5, 2°)",
    ENTITE_PUBLIQUE: "entité publique · exemptée si c'est un établissement public en vertu de ses statuts ou un organisme dont les ressources proviennent uniquement de subventions budgétaires (loi n° 23/053, art. 5, 1°)",
    SUCCURSALE: "succursale · imposable en RDC si son propriétaire est une société non-résidente (loi n° 23/053, art. 7 et 8) ; la forme ne dit pas qui la possède (AUSCGIE, art. 116 et 118)",
};
exports.LONGUEUR_MIN_ATTESTATION = 10;
const montantFiscal = (n) => n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
exports.montantFiscal = montantFiscal;
function motifsRefusConstat(e) {
    const motifs = [];
    if (e.formeJuridique === null) {
        motifs.push("La forme juridique du dossier n'est pas renseignée (Structure > Paramètres du dossier). Le calcul la suppose à l'impôt sur les sociétés, mais une entreprise individuelle ou un entreprenant n'y est pas soumis · l'impôt ne se constate pas sur une supposition.");
        return motifs;
    }
    if (correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES.includes(e.formeJuridique)) {
        motifs.push("Une personne physique (entreprise individuelle, entreprenant) n'est pas redevable de l'impôt sur les sociétés (loi n° 23/053, art. 3) · son bénéfice entre dans le revenu de l'exploitant à l'impôt sur le revenu des personnes physiques, qui n'est pas une charge de l'entreprise au compte 89 · l'impôt personnel de l'exploitant payé par l'entreprise va au 1043 « Rémunérations, impôts et autres charges personnelles » (AUDCIF, Titre VII, compte 104).");
        return motifs;
    }
    if (e.regime !== 'IMPOT_SOCIETES') {
        motifs.push("Le régime calculé n'est pas l'impôt sur les sociétés · aucune écriture d'impôt sur les sociétés ne se propose.");
        return motifs;
    }
    if (e.simulationAvantLaLoi) {
        motifs.push("L'exercice ouvre avant le 1er janvier 2026 · l'impôt affiché est une SIMULATION sous la loi n° 23/053, qui ne régissait pas cet exercice (art. 153). L'impôt réellement dû se constate à la main, sur le texte de l'époque.");
    }
    if (e.exerciceClos) {
        motifs.push("L'exercice est clôturé · aucune écriture ne s'y passe plus (AUDCIF art. 22, 2°).");
    }
    const condition = exports.CONDITIONS_A_DECLARER[e.formeJuridique];
    if (condition && e.attestationRegime !== undefined && (e.attestationRegime ?? '').trim().length < exports.LONGUEUR_MIN_ATTESTATION) {
        motifs.push(`Assujettissement à déclarer · ${condition}. Écrivez ce qui fonde l'impôt (option levée et sa date, nature de l'activité, propriétaire) avant de le constater.`);
    }
    if (e.brouillardGestion > 0) {
        motifs.push(`${e.brouillardGestion} écriture(s) au brouillard touchent les classes 6 à 8 de l'exercice · le résultat fiscal ne lit que le livre-journal (AUDCIF art. 22, 2°), l'impôt serait calculé sans elles. Validez-les ou retirez-les d'abord.`);
    }
    if (Math.abs(e.impotDejaConstate) >= 0.005) {
        motifs.push(`Le 891 ou le 895 porte déjà ${(0, exports.montantFiscal)(e.impotDejaConstate)} au livre-journal hors de cette fenêtre · l'impôt de l'exercice semble déjà constaté. Une seconde écriture le doublerait ; corrigez la première (AUDCIF art. 20) avant de passer par ici.`);
    }
    else if (Math.abs(e.impotConstateAu89 - e.reintegrationsImpot) >= 0.005) {
        motifs.push(`Les 891, 892 et 895 portent ${(0, exports.montantFiscal)(e.impotConstateAu89)} au débit du livre-journal et les réintégrations « Impôt sur les sociétés et impôt minimum comptabilisés en charges » valent ${(0, exports.montantFiscal)(e.reintegrationsImpot)} · l'impôt n'est pas déductible de son propre calcul (loi n° 23/053, art. 45 et art. 50, 2°), et l'écart de ${(0, exports.montantFiscal)(Math.abs(e.impotConstateAu89 - e.reintegrationsImpot))} fausse la base. Ajustez la réintégration pour qu'elle égale ces débits ; un impôt comptabilisé hors du 89 et réintégré à raison se range sous une ligne libre, ou sa charge se reclasse au 89.`);
    }
    if (e.periodeCreation && e.impotDu !== null && (e.periodeCreation.impotDu === null || e.periodeCreation.impotDu > 0.005)) {
        const p = e.periodeCreation;
        const jour = (d) => d.toISOString().slice(0, 10);
        const ligneExercice = `D ${compteDeLaCharge(e.minimumApplique)} ${(0, exports.montantFiscal)(e.impotDu)} au ${jour(p.dateFinExercice)} (premier exercice clos)`;
        motifs.push(p.impotDu === null
            ? `Premier exercice long (loi n° 23/053, art. 12, al. 3) · la période de création, close le ${jour(p.dateFin)}, est imposée à part sous le texte qui la régissait, que le dossier ne contient pas. L'impôt de l'exercice comptable réunit les deux impositions · passez les écritures à la main : ${ligneExercice} / C ${exports.COMPTES_IMPOT_RESULTAT.dette} du même montant, et l'impôt déclaré pour la période de création au ${jour(p.dateFin)}, au crédit du 441.`
            : `Premier exercice long (loi n° 23/053, art. 12, al. 3) · deux impositions pour un seul exercice comptable, et le compte 891 doit porter « le montant total de l'impôt dû de l'exercice » (fiche du compte 89). Passez les écritures à la main : D ${compteDeLaCharge(p.minimumApplique)} ${(0, exports.montantFiscal)(p.impotDu)} / C ${exports.COMPTES_IMPOT_RESULTAT.dette} au ${jour(p.dateFin)} (période de création), puis ${ligneExercice} / C ${exports.COMPTES_IMPOT_RESULTAT.dette}, soit ${(0, exports.montantFiscal)(Math.round((p.impotDu + e.impotDu) * 100) / 100)} au 441 en tout.`);
    }
    if (e.motifTotalisation) {
        motifs.push(`Exercice de liquidation · son impôt est la seconde cotisation spéciale, l'impôt calculé sur le total des bilans successifs de l'année moins la première (loi n° 23/053, art. 12, al. 4, et 13) · ${e.motifTotalisation}`);
    }
    if (e.impotDu === null) {
        motifs.push("L'impôt n'est pas chiffré · rien ne se constate tant qu'il ne l'est pas.");
    }
    else if (e.impotDu <= 0.005 && (e.tropPaye ?? 0) <= 0.005) {
        motifs.push("L'impôt dû de l'exercice est nul (résultat fiscal nul ou déficitaire et chiffre d'affaires nul) · aucune écriture à passer.");
    }
    return motifs;
}
function imputationAcomptes(e) {
    if (e.declares <= 0.005) {
        return { montant: 0, motifRefus: "Aucun acompte n'est déclaré dans la fenêtre Résultat fiscal pour cet exercice." };
    }
    if (e.impot <= 0.005) {
        return {
            montant: 0,
            motifRefus: "Aucun impôt de l'exercice à éteindre · les acomptes restent au 4492, crédit au compte courant fiscal (LPF art. 57 ter, « peuvent, à sa demande, servir au paiement d'autres impôts et droits dus »).",
        };
    }
    if (e.solde4492 <= 0.005) {
        return {
            montant: 0,
            motifRefus: "Le compte 4492 n'a pas de solde débiteur au livre-journal · aucun acompte versé n'y est inscrit, rien ne s'impute (fiche du compte 44). Acomptes passés au 441 (Guide, Partie 1 ch. 3 § 2.3) : rien à imputer, ils soldent déjà la dette.",
        };
    }
    if (e.declares - e.solde4492 >= 0.005) {
        return {
            montant: 0,
            motifRefus: `Les acomptes déclarés (${(0, exports.montantFiscal)(e.declares)}) dépassent le solde débiteur du 4492 (${(0, exports.montantFiscal)(e.solde4492)}) · imputer le déclaré rendrait le 4492 créditeur. Rapprochez d'abord la déclaration du compte.`,
        };
    }
    const montant = Math.round(Math.min(e.declares, e.impot) * 100) / 100;
    return { montant, motifRefus: null };
}
function compteDeLaCharge(minimumApplique) {
    return minimumApplique ? exports.COMPTES_IMPOT_RESULTAT.chargeMinimum : exports.COMPTES_IMPOT_RESULTAT.charge;
}
function lignesConstat(impot, minimumApplique, impute, tropPaye = 0) {
    const lignes = [];
    if (impot > 0.005) {
        lignes.push({
            numero: compteDeLaCharge(minimumApplique),
            debit: impot,
            credit: 0,
            libelle: minimumApplique ? "Impôt minimum de l'exercice" : "Impôt sur les bénéfices de l'exercice",
        }, { numero: exports.COMPTES_IMPOT_RESULTAT.dette, debit: 0, credit: impot, libelle: 'État, impôt sur les bénéfices' });
    }
    if (impute > 0.005) {
        lignes.push({ numero: exports.COMPTES_IMPOT_RESULTAT.dette, debit: impute, credit: 0, libelle: 'Imputation des acomptes provisionnels' }, { numero: exports.COMPTES_IMPOT_RESULTAT.acomptes, debit: 0, credit: impute, libelle: 'Acomptes provisionnels imputés' });
    }
    if (tropPaye > 0.005) {
        lignes.push({ numero: exports.COMPTES_IMPOT_RESULTAT.dette, debit: tropPaye, credit: 0, libelle: 'État · trop-payé de la première cotisation spéciale' }, {
            numero: exports.COMPTES_IMPOT_RESULTAT.annulationPertesRetroactives,
            debit: 0,
            credit: tropPaye,
            libelle: 'Annulation de la première cotisation au-delà de l’impôt de l’année',
        });
    }
    return lignes;
}
//# sourceMappingURL=ecriture-impot-resultat.js.map