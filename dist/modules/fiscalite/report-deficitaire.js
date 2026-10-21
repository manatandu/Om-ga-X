"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.finDeFenetre = finDeFenetre;
exports.deficitsReportables = deficitsReportables;
exports.dateFinPrudente = dateFinPrudente;
exports.rejouerReport = rejouerReport;
exports.partImputableDeLaSaisie = partImputableDeLaSaisie;
exports.originesHorsFenetre = originesHorsFenetre;
exports.avertissementsReportDeclare = avertissementsReportDeclare;
exports.avertissementExercicesNonJointifs = avertissementExercicesNonJointifs;
exports.avertissementDeficitsSimules = avertissementDeficitsSimules;
const entree_en_vigueur_loi_23_053_1 = require("../../common/entree-en-vigueur-loi-23-053");
const arrondir = (n) => Math.round(n * 100) / 100;
function finDeFenetre(dateFinExerciceDeficitaire, exercicesReport) {
    return new Date(Date.UTC(dateFinExerciceDeficitaire.getUTCFullYear() + exercicesReport, dateFinExerciceDeficitaire.getUTCMonth(), dateFinExerciceDeficitaire.getUTCDate()));
}
function imputable(d, exercice, exercicesReport) {
    return exercice.dateDebut.getTime() <= finDeFenetre(d.dateFin, exercicesReport).getTime();
}
function deficitsReportables(precedents, cible, exercicesReport) {
    return rejouerReport(precedents, cible, exercicesReport).detail;
}
function dateFinPrudente(dateDebutDeclaration, exercicesReport) {
    return new Date(Date.UTC(dateDebutDeclaration.getUTCFullYear() - exercicesReport, dateDebutDeclaration.getUTCMonth(), dateDebutDeclaration.getUTCDate()));
}
function rejouerReport(precedents, cible, exercicesReport) {
    const chronologiques = [...precedents].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
    let enCours = [];
    for (const ex of chronologiques) {
        if (ex.ouvertureDeclaree) {
            const o = ex.ouvertureDeclaree;
            const origines = o.origines && o.origines.length
                ? o.origines.map((x) => ({ dateFin: x.dateFin, montant: x.montant, prudente: false }))
                : [{ dateFin: dateFinPrudente(ex.dateDebut, exercicesReport), montant: o.montant, prudente: true }];
            enCours = origines
                .filter((x) => x.montant > 0.005)
                .map((x) => ({
                exerciceId: ex.exerciceId,
                dateDebut: x.dateFin,
                dateFin: x.dateFin,
                restant: arrondir(x.montant),
                simulation: false,
                declare: true,
                bornePrudente: x.prudente,
                declarationId: ex.exerciceId,
                dateDebutDeclaration: ex.dateDebut,
            }));
        }
        if (ex.base < 0) {
            enCours.push({
                exerciceId: ex.exerciceId,
                dateDebut: ex.dateDebut,
                dateFin: ex.dateFin,
                restant: -ex.base,
                simulation: (ex.debutImposable ?? ex.dateDebut).getTime() < entree_en_vigueur_loi_23_053_1.ENTREE_EN_VIGUEUR_LOI_23_053.getTime(),
                declare: false,
                bornePrudente: false,
                declarationId: null,
                dateDebutDeclaration: null,
            });
            continue;
        }
        let benefice = ex.base;
        for (const d of [...enCours].sort((a, b) => a.dateFin.getTime() - b.dateFin.getTime())) {
            if (benefice <= 0)
                break;
            if (d.restant <= 0 || !imputable(d, ex, exercicesReport))
                continue;
            const impute = Math.min(d.restant, benefice);
            d.restant = arrondir(d.restant - impute);
            benefice = arrondir(benefice - impute);
        }
    }
    const perdusParPrudence = enCours
        .filter((d) => d.bornePrudente && d.restant > 0.005 && !imputable(d, cible, exercicesReport))
        .map((d) => ({
        exerciceDeclarationId: d.declarationId,
        dateDebutDeclaration: d.dateDebutDeclaration,
        montant: arrondir(d.restant),
    }));
    const detail = enCours
        .filter((d) => d.restant > 0.005 && imputable(d, cible, exercicesReport))
        .sort((a, b) => a.dateFin.getTime() - b.dateFin.getTime())
        .map((d) => ({
        exerciceId: d.exerciceId,
        dateFin: d.dateFin,
        montant: arrondir(d.restant),
        simulation: d.simulation,
        declare: d.declare,
        bornePrudente: d.bornePrudente,
    }));
    return { detail, perdusParPrudence };
}
function partImputableDeLaSaisie(montant, origines, exercice, exercicesReport) {
    if (!origines || !origines.length)
        return { imputable: arrondir(montant), horsFenetre: [] };
    const horsFenetre = origines
        .filter((o) => !imputable(o, exercice, exercicesReport))
        .map((o) => ({ ...o, finDeFenetre: finDeFenetre(o.dateFin, exercicesReport) }));
    const exclu = horsFenetre.reduce((t, o) => t + o.montant, 0);
    return { imputable: arrondir(Math.max(montant - exclu, 0)), horsFenetre };
}
function originesHorsFenetre(origines, exercice, exercicesReport) {
    return origines
        .filter((o) => !imputable(o, exercice, exercicesReport))
        .map((o) => ({ dateFin: o.dateFin, finDeFenetre: finDeFenetre(o.dateFin, exercicesReport) }));
}
function avertissementsReportDeclare(detail, perdus, exercicesClos = new Set()) {
    const avertissements = [];
    const bornes = detail.filter((d) => d.bornePrudente);
    if (bornes.length) {
        avertissements.push(`REPORT DÉCLARÉ SANS ORIGINE · ${bornes.map((d) => d.montant.toLocaleString('fr-FR')).join(', ')} vient d'un report saisi à l'ouverture d'un exercice antérieur sans dire de quels exercices viennent les pertes. ` +
            "Chacune garde sa fenêtre de l'art. 51 (jusqu'au troisième exercice qui suit l'exercice déficitaire) · faute de la connaître, OmegaX la borne par PRUDENCE à la plus courte, comme si la perte venait du plus ancien exercice encore imputable. Déclarez l'origine des pertes avec le report saisi pour lui rendre sa vraie fenêtre.");
    }
    for (const p of perdus) {
        avertissements.push(`REPORT PERDU PAR PRUDENCE · ${p.montant.toLocaleString('fr-FR')} du report déclaré à l'ouverture du ${p.dateDebutDeclaration.toISOString().slice(0, 10)} ne s'impute plus ici, sa fenêtre ayant été bornée faute d'origine déclarée. ` +
            (exercicesClos.has(p.exerciceDeclarationId)
                ? "L'exercice de cette saisie est clôturé et ne se retouche plus · si ces pertes viennent d'exercices plus récents, déclarez à l'ouverture de l'exercice OUVERT suivant le report qui y reste disponible, avec son origine · elles y retrouvent leur fenêtre de l'art. 51."
                : "Si ces pertes viennent d'exercices plus récents, déclarez leur origine sur l'exercice de la saisie · elles retrouvent alors leur fenêtre de l'art. 51."));
    }
    return avertissements;
}
function avertissementExercicesNonJointifs(precedents, cible, exercicesReport) {
    const debutFenetre = dateFinPrudente(cible.dateDebut, exercicesReport);
    const suite = [...precedents, { dateDebut: cible.dateDebut, dateFin: cible.dateDebut }].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
    const trous = [];
    for (let i = 1; i < suite.length; i++) {
        const fin = suite[i - 1].dateFin;
        const lendemain = new Date(Date.UTC(fin.getUTCFullYear(), fin.getUTCMonth(), fin.getUTCDate() + 1));
        if (suite[i].dateDebut.getTime() > lendemain.getTime() && suite[i].dateDebut.getTime() > debutFenetre.getTime()) {
            const veille = new Date(suite[i].dateDebut.getTime() - 86_400_000);
            trous.push(`du ${lendemain.toISOString().slice(0, 10)} au ${veille.toISOString().slice(0, 10)}`);
        }
    }
    if (!trous.length)
        return null;
    return (`EXERCICES NON JOINTIFS DANS LA FENÊTRE DU REPORT · aucune comptabilité n'est tenue ici ${trous.join(', ')}. ` +
        "Le report de l'art. 51 se compte jusqu'au troisième exercice qui suit l'exercice déficitaire, et un exercice absent du dossier a pu consommer une perte (ou en créer une) que le rejeu ne voit pas · le déficit affiché peut être trop fort ou trop faible. Saisissez le report réellement disponible à l'ouverture de cet exercice.");
}
function avertissementDeficitsSimules(detail, saisi) {
    if (saisi)
        return null;
    const simules = detail.filter((d) => d.simulation);
    if (!simules.length)
        return null;
    const liste = simules
        .map((d) => `${d.montant.toLocaleString('fr-FR')} de l'exercice clos le ${d.dateFin.toISOString().slice(0, 10)}`)
        .join(', ');
    return (`DÉFICIT D'AVANT LA LOI, RECALCULÉ · ${liste}. L'exercice qui l'a subi ouvre avant le 1er janvier 2026 ; OmegaX l'a ` +
        "recalculé sous la loi n° 23/053, qui ne le régissait pas (art. 153). Ce qui s'impute est la perte CONSTATÉE pour cet " +
        "exercice (art. 51, al. 1er), sous le texte de l'époque, que le dossier ne contient pas ; son imputation suit, elle, " +
        "l'art. 51 en vigueur. Le montant affiché est une SIMULATION · saisissez dans « Déficits antérieurs » le reste à " +
        "reporter à l'ouverture de cet exercice, il prime sur le calcul et fait foi pour les exercices suivants.");
}
//# sourceMappingURL=report-deficitaire.js.map