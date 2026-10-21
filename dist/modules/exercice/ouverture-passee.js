"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLAFOND_LIGNES_JUGEMENT_OUVERTURE = void 0;
exports.filtreOuverturePasseeAuPremierJour = filtreOuverturePasseeAuPremierJour;
exports.lignesDeContrePassationDeclaree = lignesDeContrePassationDeclaree;
exports.negatifsTardifs = negatifsTardifs;
exports.negatifsTardifsLisibles = negatifsTardifsLisibles;
exports.ouverturePasseeNonNulle = ouverturePasseeNonNulle;
exports.positionDOuverturePassee = positionDOuverturePassee;
const client_1 = require("@prisma/client");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const contre_passation_manuelle_1 = require("../devises/contre-passation-manuelle");
const ecarts_disponibilites_1 = require("../devises/ecarts-disponibilites");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const portefeuille_etat_1 = require("./portefeuille-etat");
const report_a_nouveau_1 = require("./report-a-nouveau");
const ESTUNE_OUVERTURE = { OR: [{ estGenereeParCloture: true }, { journal: { type: client_1.TypeJournal.GENERAL } }] };
const HORS_CONTRE_PASSATION_DU_MODULE = {
    reevaluationExtourne: { is: null },
    OR: [{ corrigeEcritureId: null }, { corrigeEcriture: { is: { reevaluationExtourne: { is: null } } } }],
};
const DATEE_DU_PREMIER_JOUR = (debut) => ({ OR: [{ date: debut }, { dateValeur: debut }] });
function filtreOuverturePasseeAuPremierJour(tenantId, exercice) {
    return {
        tenantId,
        exerciceId: exercice.id,
        estANouveauProvisoire: false,
        estSoldeDesComptesDeGestion: false,
        ...ecritures_de_situation_1.HORS_SITUATION,
        AND: [
            { OR: [DATEE_DU_PREMIER_JOUR(exercice.dateDebut), { corrigeEcriture: { is: DATEE_DU_PREMIER_JOUR(exercice.dateDebut) } }] },
            { OR: [ESTUNE_OUVERTURE, { corrigeEcriture: { is: ESTUNE_OUVERTURE } }] },
            HORS_CONTRE_PASSATION_DU_MODULE,
        ],
        lignes: { none: { compte: { classe: { in: [client_1.ClasseCompte.CLASSE_6, client_1.ClasseCompte.CLASSE_7, client_1.ClasseCompte.CLASSE_8] } } } },
    };
}
function lignesDeContrePassationDeclaree(ecritures) {
    const horsOuverture = new Map();
    for (const e of ecritures) {
        const r = e.reevaluationContrePassationDeclaree;
        if (!r || r.annuleeLe || !r.ecritureEcarts)
            continue;
        const lignes = r.ecritureEcarts.lignes.map((l) => ({ compteId: l.compteId, compteNumero: l.compte.numero, debit: Number(l.debit), credit: Number(l.credit) }));
        const comptes = (0, contre_passation_manuelle_1.montantsAContrePasser)((0, ecarts_disponibilites_1.partagerLignesDEcarts)(lignes).aContrePasser).map((m) => m.compteId);
        if (comptes.length > 0)
            horsOuverture.set(e.id, new Set(comptes));
    }
    return horsOuverture;
}
function negatifsTardifs(ecritures, premierJour) {
    const jour = premierJour.getTime();
    const tardifs = [];
    for (const e of ecritures) {
        if (!e.corrigeEcritureId || !(e.date instanceof Date))
            continue;
        if (e.date.getTime() === jour || (e.dateValeur instanceof Date && e.dateValeur.getTime() === jour))
            continue;
        tardifs.push({ piece: `${e.journal.code} n° ${e.numeroPiece ?? '·'}`, date: e.date });
    }
    return tardifs;
}
function negatifsTardifsLisibles(tardifs) {
    const noms = tardifs.slice(0, 5).map((t) => `${t.piece} du ${(0, portefeuille_etat_1.jourFr)(t.date)}`);
    return noms.join(', ') + (tardifs.length > 5 ? ` et ${tardifs.length - 5} autre(s)` : '');
}
exports.PLAFOND_LIGNES_JUGEMENT_OUVERTURE = 50_000;
async function ouverturePasseeNonNulle(db, tenantId, exercice, options) {
    const position = await positionDOuverturePassee(db, tenantId, exercice, options);
    return position.etat === 'NON_NULLE' ? { nombre: position.nombre, pieces: position.pieces } : null;
}
async function positionDOuverturePassee(db, tenantId, exercice, options) {
    const filtre = {
        ...filtreOuverturePasseeAuPremierJour(tenantId, exercice),
        ...(options.validees ? { statut: client_1.StatutEcriture.VALIDEE } : {}),
    };
    const nombreLignes = await db.ligneEcriture.count({ where: { ecriture: filtre } });
    if (nombreLignes === 0)
        return { etat: 'AUCUNE' };
    const lues = await db.ecriture.findMany({
        where: { ...filtre, tenantId },
        select: {
            id: true,
            numeroPiece: true,
            date: true,
            dateValeur: true,
            corrigeEcritureId: true,
            journal: { select: { code: true } },
            reevaluationContrePassationDeclaree: {
                select: { annuleeLe: true, ecritureEcarts: { select: { lignes: { select: { compteId: true, debit: true, credit: true, compte: { select: { numero: true } } } } } } },
            },
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        take: exports.PLAFOND_LIGNES_JUGEMENT_OUVERTURE,
    });
    const piece = (e) => `${e.journal.code} n° ${e.numeroPiece ?? '·'}`;
    if (nombreLignes > exports.PLAFOND_LIGNES_JUGEMENT_OUVERTURE) {
        return { etat: 'NON_NULLE', nombre: lues.length, pieces: lues.slice(0, 5).map(piece) };
    }
    const horsOuverture = lignesDeContrePassationDeclaree(lues);
    const retenues = new Set();
    const lignes = [];
    await (0, lecture_par_lots_1.lireParLots)((curseur) => db.ligneEcriture.findMany({
        where: { ecriture: filtre },
        select: { id: true, ecritureId: true, compteId: true, debit: true, credit: true, deviseId: true, montantDevise: true },
        ...(0, lecture_par_lots_1.pageApres)(curseur, lecture_par_lots_1.LOT_LECTURE),
    }), (l) => {
        if (horsOuverture.get(l.ecritureId)?.has(l.compteId))
            return;
        retenues.add(l.ecritureId);
        lignes.push({
            compteId: l.compteId,
            debit: Number(l.debit),
            credit: Number(l.credit),
            libelle: null,
            dateEcheance: null,
            deviseId: l.deviseId,
            montantDevise: l.montantDevise === null ? null : Number(l.montantDevise),
            coursApplique: null,
        });
    }, lecture_par_lots_1.LOT_LECTURE);
    const portees = lues.filter((e) => retenues.has(e.id));
    if (lignes.length === 0 || (0, report_a_nouveau_1.ouvertureNulle)(lignes))
        return { etat: 'NULLE', negatifsTardifs: negatifsTardifs(portees, exercice.dateDebut) };
    return { etat: 'NON_NULLE', nombre: portees.length, pieces: portees.slice(0, 5).map(piece) };
}
//# sourceMappingURL=ouverture-passee.js.map