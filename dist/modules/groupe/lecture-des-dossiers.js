"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TRANCHE_DOSSIERS = void 0;
exports.balancesDesDossiers = balancesDesDossiers;
exports.comptagesDesDossiers = comptagesDesDossiers;
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const client_1 = require("@prisma/client");
const balance_trois_colonnes_1 = require("../comptabilite/balance-trois-colonnes");
exports.TRANCHE_DOSSIERS = 20;
function enTranches(elements) {
    const tranches = [];
    for (let i = 0; i < elements.length; i += exports.TRANCHE_DOSSIERS) {
        tranches.push(elements.slice(i, i + exports.TRANCHE_DOSSIERS));
    }
    return tranches;
}
function verifierCouples(couples) {
    if (new Set(couples.map((c) => c.tenantId)).size !== couples.length) {
        throw new Error('Lecture du groupe · un dossier ne se lit que pour un seul exercice à la fois, ses comptes réuniraient sinon deux exercices.');
    }
}
async function balancesDesDossiers(prisma, couples) {
    verifierCouples(couples);
    const balances = new Map();
    for (const tranche of enTranches(couples)) {
        const dossiers = tranche.map((c) => c.tenantId);
        const ecrituresDeLaTranche = {
            tenantId: { in: dossiers },
            OR: tranche.map((c) => ({ tenantId: c.tenantId, exerciceId: c.exerciceId })),
        };
        const filtres = (0, balance_trois_colonnes_1.filtresDesTroisColonnes)(ecrituresDeLaTranche);
        const [comptes, reports, mouvements, clotures] = await Promise.all([
            prisma.compte.findMany({
                where: { tenantId: { in: dossiers } },
                orderBy: { numero: 'asc' },
                select: { id: true, tenantId: true, numero: true, intitule: true, classe: true, typeCompte: true },
            }),
            prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: filtres.reports },
                _sum: { debit: true, credit: true },
            }),
            prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: filtres.mouvements },
                _sum: { debit: true, credit: true },
            }),
            prisma.ligneEcriture.groupBy({
                by: ['compteId'],
                where: { ecriture: filtres.clotures },
                _sum: { debit: true, credit: true },
            }),
        ]);
        const parCompte = (0, balance_trois_colonnes_1.agregatsParCompte)(reports, mouvements, clotures);
        const comptesParDossier = new Map(dossiers.map((d) => [d, []]));
        for (const c of comptes)
            comptesParDossier.get(c.tenantId)?.push(c);
        for (const [dossier, comptesDuDossier] of comptesParDossier) {
            const lignes = (0, balance_trois_colonnes_1.lignesDeBalance)(comptesDuDossier, parCompte);
            balances.set(dossier, { lignes, totaux: (0, balance_trois_colonnes_1.totauxDeBalance)(lignes) });
        }
    }
    return balances;
}
async function comptagesDesDossiers(prisma, couples) {
    verifierCouples(couples);
    const comptages = new Map(couples.map((c) => [
        c.tenantId,
        { nbEcritures: 0, nbBrouillard: 0, nbProvisoiresAuBrouillard: 0, derniereEcriture: null },
    ]));
    for (const tranche of enTranches(couples)) {
        const groupes = await prisma.ecriture.groupBy({
            by: ['tenantId', 'exerciceId', 'statut', 'estANouveauProvisoire'],
            where: {
                tenantId: { in: tranche.map((c) => c.tenantId) },
                OR: tranche.map(({ tenantId, exerciceId }) => ({ tenantId, exerciceId })),
                ...ecritures_de_situation_1.HORS_SITUATION,
            },
            _count: { _all: true },
            _max: { date: true },
        });
        for (const g of groupes) {
            const comptage = comptages.get(g.tenantId);
            if (!comptage)
                continue;
            const nombre = g._count._all;
            comptage.nbEcritures += nombre;
            if (g.statut === client_1.StatutEcriture.BROUILLARD) {
                comptage.nbBrouillard += nombre;
                if (g.estANouveauProvisoire)
                    comptage.nbProvisoiresAuBrouillard += nombre;
            }
            const derniere = g._max.date;
            if (derniere && (!comptage.derniereEcriture || derniere.getTime() > comptage.derniereEcriture.getTime())) {
                comptage.derniereEcriture = derniere;
            }
        }
    }
    return comptages;
}
//# sourceMappingURL=lecture-des-dossiers.js.map