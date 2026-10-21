"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FORMAT_DATE_COMPTAGE = void 0;
exports.compteApresLaCloture = compteApresLaCloture;
exports.auPlusTardLe = auPlusTardLe;
exports.filtreExercicesSuivants = filtreExercicesSuivants;
exports.exercicesDuComptage = exercicesDuComptage;
exports.especesReconstitueesALaCloture = especesReconstitueesALaCloture;
exports.valeurAPorterSurLaFiche = valeurAPorterSurLaFiche;
exports.fenetresDuComptage = fenetresDuComptage;
exports.uniteDeLaCaisse = uniteDeLaCaisse;
exports.sommesDansLUnite = sommesDansLUnite;
exports.lireSoldeCaisseAuComptage = lireSoldeCaisseAuComptage;
exports.luesParLePv = luesParLePv;
exports.valideesDepuisLePv = valideesDepuisLePv;
exports.mentionsDuPv = mentionsDuPv;
const client_1 = require("@prisma/client");
const echeance_1 = require("../../common/echeance");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const JOUR_MS = 24 * 60 * 60 * 1000;
const arrondi = (n) => Number(n.toFixed(2));
const jour = (d) => (0, echeance_1.jourUtc)(d).toISOString().slice(0, 10);
exports.FORMAT_DATE_COMPTAGE = /^\d{4}-\d{2}-\d{2}$/;
function compteApresLaCloture(dateComptage, dateFin) {
    return (0, echeance_1.jourUtc)(dateComptage).getTime() > (0, echeance_1.jourUtc)(dateFin).getTime();
}
const lendemain = (j) => new Date((0, echeance_1.jourUtc)(j).getTime() + JOUR_MS);
function auPlusTardLe(jourJ) {
    const l = lendemain(jourJ);
    return { OR: [{ dateValeur: null, date: { lt: l } }, { dateValeur: { lt: l } }] };
}
function apresLe(jourJ) {
    const l = lendemain(jourJ);
    return { OR: [{ dateValeur: null, date: { gte: l } }, { dateValeur: { gte: l } }] };
}
function filtreExercicesSuivants(tenantId, dateFin, dateComptage) {
    return { tenantId, dateDebut: { gt: dateFin, lt: lendemain(dateComptage) } };
}
function exercicesDuComptage(dateFin, dateComptage, suivants) {
    const tries = [...suivants].sort((a, b) => a.dateDebut.getTime() - b.dateDebut.getTime());
    let attendu = (0, echeance_1.jourUtc)(dateFin).getTime() + JOUR_MS;
    const ids = [];
    for (const e of tries) {
        if ((0, echeance_1.jourUtc)(e.dateDebut).getTime() > attendu)
            break;
        if ((0, echeance_1.jourUtc)(e.dateDebut).getTime() < attendu)
            continue;
        ids.push(e.id);
        attendu = (0, echeance_1.jourUtc)(e.dateFin).getTime() + JOUR_MS;
        if (attendu > (0, echeance_1.jourUtc)(dateComptage).getTime())
            return { ids };
    }
    const premierJourNonCouvert = jour(new Date(attendu));
    return {
        motif: `Le comptage est daté du ${jour(dateComptage)}, après la clôture du ${jour(dateFin)}, et aucun exercice du ` +
            `dossier ne couvre le ${premierJourNonCouvert}. Les encaissements et paiements de la caisse entre la clôture ` +
            "et le comptage ne peuvent donc pas être au livre-journal, et le solde à la date du comptage n'est pas " +
            "calculable · ouvrez l'exercice suivant, saisissez-y et validez ces mouvements, puis établissez le " +
            'procès-verbal (fiche du compte 57, « le solde du compte caisse doit toujours correspondre exactement à la ' +
            'somme disponible réellement » ; AUDCIF art. 16, al. 2).',
    };
}
function especesReconstitueesALaCloture(especesComptees, r) {
    return arrondi(especesComptees - r.encaissementsPosterieurs + r.decaissementsPosterieurs);
}
const FORMAT_MONTANT_PV = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function valeurAPorterSurLaFiche(pv, dateCloture) {
    const m = (n) => `${FORMAT_MONTANT_PV.format(arrondi(n))}${pv.unite ? ` ${pv.unite}` : ''}`;
    const devise = pv.unite
        ? ` · le procès-verbal compte en ${pv.unite}, la fiche se valorise en francs, comme le solde du livre-journal auquel elle se rapproche`
        : '';
    const cloture = dateCloture ? ` du ${jour(dateCloture)}` : '';
    if (pv.soldeALaCloture !== null && pv.encaissementsPosterieurs !== null && pv.decaissementsPosterieurs !== null) {
        const reconstituees = especesReconstitueesALaCloture(pv.especesComptees, {
            encaissementsPosterieurs: pv.encaissementsPosterieurs,
            decaissementsPosterieurs: pv.decaissementsPosterieurs,
        });
        return (`${pv.numero}, comptée le ${jour(pv.dateComptage)} après la clôture${cloture} · portez sur sa fiche la valeur ` +
            `reconstituée à la clôture, figée sur le procès-verbal, ${m(reconstituees)} (${m(pv.especesComptees)} comptés, ` +
            `moins ${m(pv.encaissementsPosterieurs)} d'encaissements et plus ${m(pv.decaissementsPosterieurs)} de ` +
            'décaissements postérieurs), jamais les espèces comptées · la fiche se rapproche du solde de clôture, et les ' +
            `mouvements d'après la clôture y feraient un écart qui n'existe pas${devise}`);
    }
    if (dateCloture && compteApresLaCloture(pv.dateComptage, dateCloture)) {
        return (`${pv.numero}, comptée le ${jour(pv.dateComptage)} après la clôture${cloture} · le procès-verbal ne porte pas la ` +
            'reconstitution vers la clôture (établi avant la règle) · portez sur sa fiche les espèces existant à la clôture, ' +
            "reconstituées des mouvements d'après la clôture, jamais les espèces comptées, qui y feraient un écart qui " +
            `n'existe pas${devise}`);
    }
    if (dateCloture && (0, echeance_1.jourUtc)(pv.dateComptage).getTime() < (0, echeance_1.jourUtc)(dateCloture).getTime()) {
        return (`${pv.numero} · portez sur sa fiche les espèces comptées, ${m(pv.especesComptees)} ; comptée le ` +
            `${jour(pv.dateComptage)}, avant la clôture${cloture}, ses mouvements jusqu'à la clôture ne sont pas ` +
            `reconstitués et entrent dans l'écart du rapprochement${devise}`);
    }
    return `${pv.numero} · portez sur sa fiche les espèces comptées, ${m(pv.especesComptees)}${devise}`;
}
function fenetresDuComptage(tenantId, exercice, dateComptage, idsSuivants) {
    const apres = compteApresLaCloture(dateComptage, exercice.dateFin);
    const dansExercice = apres
        ? { tenantId, exerciceId: exercice.id }
        : { tenantId, exerciceId: exercice.id, ...auPlusTardLe(dateComptage) };
    if (!apres || idsSuivants === null)
        return { exercice: dansExercice, suivants: null, intercales: null, valeurAvantCloture: null };
    const suivants = {
        tenantId,
        exerciceId: { in: idsSuivants },
        estGenereeParCloture: false,
        estANouveauProvisoire: false,
        ...auPlusTardLe(dateComptage),
    };
    return {
        exercice: dansExercice,
        suivants,
        intercales: { AND: [suivants, apresLe(exercice.dateFin)] },
        valeurAvantCloture: { AND: [suivants, { dateValeur: { lt: lendemain(exercice.dateFin) } }] },
    };
}
const HORS_ECARTS_DE_REEVALUATION = { reevaluationEcarts: { is: null } };
async function uniteDeLaCaisse(prisma, compteId, fenetres) {
    const deviseIds = new Set();
    let sansMontant = 0;
    for (const f of fenetres) {
        const ecriture = { AND: [f, { statut: client_1.StatutEcriture.VALIDEE }, HORS_ECARTS_DE_REEVALUATION] };
        const groupes = await prisma.ligneEcriture.groupBy({ by: ['deviseId'], where: { compteId, ecriture } });
        for (const g of groupes)
            deviseIds.add(g.deviseId ?? null);
        sansMontant += await prisma.ligneEcriture.count({
            where: { compteId, ecriture, deviseId: { not: null }, montantDevise: null },
        });
    }
    if (deviseIds.size === 0 || (deviseIds.size === 1 && deviseIds.has(null))) {
        return { mode: client_1.ModeComparaisonCaisse.FRANCS, devise: null };
    }
    const [seule] = [...deviseIds];
    if (deviseIds.size === 1 && seule !== null && sansMontant === 0) {
        const devise = await prisma.devise.findFirst({ where: { id: seule }, select: { id: true, code: true } });
        if (devise)
            return { mode: client_1.ModeComparaisonCaisse.DEVISE, devise };
    }
    return { mode: client_1.ModeComparaisonCaisse.FRANCS_COURS_HISTORIQUES, devise: null };
}
async function sommesDansLUnite(prisma, compteId, ecriture, unite) {
    const lue = (0, ecritures_de_situation_1.avecStatut)(ecriture);
    if (unite.mode === client_1.ModeComparaisonCaisse.DEVISE) {
        const e = { AND: [lue, HORS_ECARTS_DE_REEVALUATION] };
        const somme = (filtre) => prisma.ligneEcriture
            .aggregate({ where: { compteId, ecriture: e, ...filtre }, _sum: { montantDevise: true } })
            .then((r) => Number(r._sum?.montantDevise ?? 0));
        const [dPlus, dMoins, cPlus, cMoins, n] = await Promise.all([
            somme({ debit: { gt: 0 } }),
            somme({ debit: { lt: 0 } }),
            somme({ credit: { gt: 0 } }),
            somme({ credit: { lt: 0 } }),
            prisma.ligneEcriture.count({ where: { compteId, ecriture: e } }),
        ]);
        return { debit: dPlus - dMoins, credit: cPlus - cMoins, nombre: n };
    }
    const s = await prisma.ligneEcriture.aggregate({
        where: { compteId, ecriture: lue },
        _sum: { debit: true, credit: true },
        _count: { _all: true },
    });
    return { debit: Number(s._sum?.debit ?? 0), credit: Number(s._sum?.credit ?? 0), nombre: s._count?._all ?? 0 };
}
const valide = (e) => ({ AND: [e, { statut: client_1.StatutEcriture.VALIDEE }] });
async function lireSoldeCaisseAuComptage(prisma, tenantId, compteId, exercice, dateComptage, maintenant = new Date()) {
    if ((0, echeance_1.jourUtc)(dateComptage).getTime() < (0, echeance_1.jourUtc)(exercice.dateDebut).getTime()) {
        return {
            lisible: false,
            motif: `Le comptage est daté du ${jour(dateComptage)}, avant l'ouverture de l'exercice de la campagne ` +
                `(${jour(exercice.dateDebut)}) · il ne compte pas la caisse de cet exercice.`,
        };
    }
    if ((0, echeance_1.jourUtc)(dateComptage).getTime() > (0, echeance_1.jourDeKinshasa)(maintenant).getTime()) {
        return {
            lisible: false,
            motif: `Le comptage est daté du ${jour(dateComptage)}, dans le futur · un procès-verbal constate un comptage fait.`,
        };
    }
    const apres = compteApresLaCloture(dateComptage, exercice.dateFin);
    const ouvertureProvisoire = await prisma.ligneEcriture.count({
        where: { compteId, ecriture: { tenantId, exerciceId: exercice.id, estANouveauProvisoire: true } },
    });
    if (ouvertureProvisoire > 0) {
        return {
            lisible: false,
            motif: "Le solde d'ouverture de cette caisse est un report à-nouveau PROVISOIRE · il n'est pas au livre-journal " +
                "(AUDCIF art. 22, 2°), et le solde à la date du comptage en dépend. Clôturez l'exercice précédent, qui " +
                "pose le report définitif, puis établissez le procès-verbal.",
        };
    }
    let idsSuivants = null;
    if (apres) {
        const suivants = await prisma.exercice.findMany({
            where: filtreExercicesSuivants(tenantId, exercice.dateFin, dateComptage),
            select: { id: true, dateDebut: true, dateFin: true },
            orderBy: { dateDebut: 'asc' },
        });
        const couverture = exercicesDuComptage(exercice.dateFin, dateComptage, suivants);
        if ('motif' in couverture)
            return { lisible: false, motif: couverture.motif };
        idsSuivants = couverture.ids;
    }
    const f = fenetresDuComptage(tenantId, exercice, dateComptage, idsSuivants);
    const brouillard = async (e) => prisma.ligneEcriture.count({ where: { compteId, ecriture: { AND: [e, { statut: client_1.StatutEcriture.BROUILLARD }] } } });
    const auBrouillard = (await brouillard(f.exercice)) + (f.suivants ? await brouillard(f.suivants) : 0);
    if (auBrouillard > 0)
        return refusBrouillard(auBrouillard, dateComptage);
    const unite = await uniteDeLaCaisse(prisma, compteId, f.suivants ? [f.exercice, f.suivants] : [f.exercice]);
    const exerciceLu = await sommesDansLUnite(prisma, compteId, valide(f.exercice), unite);
    if (!apres || !f.intercales || !f.valeurAvantCloture) {
        return { lisible: true, soldeComptable: arrondi(exerciceLu.debit - exerciceLu.credit), unite, reconstitution: null };
    }
    const intercales = await sommesDansLUnite(prisma, compteId, valide(f.intercales), unite);
    const avant = await sommesDansLUnite(prisma, compteId, valide(f.valeurAvantCloture), unite);
    const soldeALaCloture = arrondi(exerciceLu.debit - exerciceLu.credit);
    const mouvementsValeurAvantCloture = arrondi(avant.debit - avant.credit);
    const encaissementsPosterieurs = arrondi(intercales.debit);
    const decaissementsPosterieurs = arrondi(intercales.credit);
    return {
        lisible: true,
        soldeComptable: arrondi(soldeALaCloture + mouvementsValeurAvantCloture + encaissementsPosterieurs - decaissementsPosterieurs),
        unite,
        reconstitution: {
            dateCloture: exercice.dateFin,
            soldeALaCloture,
            mouvementsValeurAvantCloture,
            encaissementsPosterieurs,
            decaissementsPosterieurs,
            mouvementsPosterieurs: intercales.nombre,
        },
    };
}
function refusBrouillard(nombre, dateComptage) {
    return {
        lisible: false,
        motif: `${nombre} ligne(s) au brouillard sur cette caisse, datée(s) au plus tard du comptage (${jour(dateComptage)}) · ` +
            'les valider ou les supprimer avant d’établir le procès-verbal. Le solde figé se lit au livre-journal ' +
            "(AUDCIF art. 22, 2°) · lue, une ligne provisoire figerait un solde que la validation peut changer ; " +
            "ignorée, un paiement réel deviendrait un manquant.",
    };
}
function luesParLePv(e, etabliLe) {
    return {
        AND: [
            e,
            { statut: client_1.StatutEcriture.VALIDEE },
            { OR: [{ valideeAt: { lte: etabliLe } }, { valideeAt: null, createdAt: { lte: etabliLe } }] },
        ],
    };
}
function valideesDepuisLePv(e, etabliLe) {
    return {
        AND: [
            e,
            { statut: client_1.StatutEcriture.VALIDEE },
            { OR: [{ valideeAt: { gt: etabliLe } }, { valideeAt: null, createdAt: { gt: etabliLe } }] },
        ],
    };
}
function mentionsDuPv(pv) {
    const m = [];
    const apres = compteApresLaCloture(pv.dateComptage, pv.dateCloture);
    if (pv.mode === client_1.ModeComparaisonCaisse.FRANCS_COURS_HISTORIQUES) {
        m.push("Comparaison en francs, au cours historique de chaque mouvement · l'écart comprend l'effet de change.");
    }
    if (apres) {
        m.push("Écart constaté au jour du comptage · son rattachement à l'exercice clos ou en cours est à apprécier.");
        m.push('Solde à la clôture lu au livre-journal à l’établissement · une réévaluation passée depuis n’y figure pas.');
    }
    else if ((0, echeance_1.jourUtc)(pv.dateComptage).getTime() < (0, echeance_1.jourUtc)(pv.dateCloture).getTime()) {
        m.push(`Compté avant la clôture · mouvements jusqu'au ${jour(pv.dateCloture)} non reconstitués.`);
    }
    if (pv.soldeComptable < 0 || (pv.soldeALaCloture !== null && pv.soldeALaCloture < 0)) {
        m.push('Solde de caisse lu créditeur · « un solde créditeur du compte caisse constitue une présomption ' +
            "d'irrégularité de la comptabilité » (fiche du compte 57).");
    }
    if (pv.especesReconstituees !== null && pv.especesReconstituees < 0) {
        m.push('Espèces reconstituées à la clôture négatives · les mouvements intercalés dépassent les espèces comptées, à examiner.');
    }
    if (pv.mouvementsValeurAvantCloture !== null && pv.mouvementsValeurAvantCloture !== 0) {
        m.push("Opérations de l'exercice suivant à date de valeur antérieure à la clôture · comptées au solde du jour du " +
            'comptage, hors des mouvements intercalés, à examiner.');
    }
    return m;
}
//# sourceMappingURL=solde-caisse-au-comptage.js.map