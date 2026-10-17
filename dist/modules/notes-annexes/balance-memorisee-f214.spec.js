"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const etats_financiers_projet_budget_service_1 = require("../etats-financiers/etats-financiers-projet-budget.service");
const etats_financiers_service_1 = require("../etats-financiers/etats-financiers.service");
const note_annexe_service_1 = require("./note-annexe.service");
function ligne(numero, classe, reportDebit, reportCredit, mouvementDebit, mouvementCredit) {
    return {
        compteId: `id-${numero}`,
        numero,
        intitule: `Compte ${numero}`,
        classe,
        typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
        reportDebit,
        reportCredit,
        mouvementDebit,
        mouvementCredit,
        totalDebit: reportDebit + mouvementDebit,
        totalCredit: reportCredit + mouvementCredit,
        solde: reportDebit + mouvementDebit - reportCredit - mouvementCredit,
    };
}
const BALANCES = {
    e2: [
        ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 800_000, 0, 0),
        ligne('23110000', client_1.ClasseCompte.CLASSE_2, 600_000, 0, 150_000, 0),
        ligne('28310000', client_1.ClasseCompte.CLASSE_2, 0, 100_000, 0, 50_000),
        ligne('40110000', client_1.ClasseCompte.CLASSE_4, 0, 0, 145_000, 190_000),
        ligne('52110000', client_1.ClasseCompte.CLASSE_5, 300_000, 0, 600_000, 415_000),
        ligne('60410000', client_1.ClasseCompte.CLASSE_6, 0, 0, 190_000, 0),
        ligne('66110000', client_1.ClasseCompte.CLASSE_6, 0, 0, 120_000, 0),
        ligne('68110000', client_1.ClasseCompte.CLASSE_6, 0, 0, 50_000, 0),
        ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 400_000),
        ligne('71110000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 200_000),
    ],
    e1: [
        ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 800_000, 0, 0),
        ligne('23110000', client_1.ClasseCompte.CLASSE_2, 500_000, 0, 100_000, 0),
        ligne('28310000', client_1.ClasseCompte.CLASSE_2, 0, 60_000, 0, 40_000),
        ligne('52110000', client_1.ClasseCompte.CLASSE_5, 360_000, 0, 250_000, 310_000),
        ligne('60410000', client_1.ClasseCompte.CLASSE_6, 0, 0, 140_000, 0),
        ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 180_000),
    ],
    e0: [
        ligne('10110000', client_1.ClasseCompte.CLASSE_1, 0, 800_000, 0, 0),
        ligne('23110000', client_1.ClasseCompte.CLASSE_2, 0, 0, 500_000, 0),
        ligne('52110000', client_1.ClasseCompte.CLASSE_5, 0, 0, 800_000, 440_000),
        ligne('70110000', client_1.ClasseCompte.CLASSE_7, 0, 0, 0, 60_000),
    ],
};
const EXERCICES = [
    { id: 'e2', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') },
    { id: 'e1', dateDebut: new Date('2025-01-01T00:00:00Z'), dateFin: new Date('2025-12-31T00:00:00Z') },
    { id: 'e0', dateDebut: new Date('2024-01-01T00:00:00Z'), dateFin: new Date('2024-12-31T00:00:00Z') },
];
function balanceComptee() {
    return {
        balance: jest.fn((_t, exerciceId) => {
            const lignes = BALANCES[exerciceId] ?? [];
            return Promise.resolve({
                lignes,
                totaux: {
                    debit: lignes.reduce((s, l) => s + l.totalDebit, 0),
                    credit: lignes.reduce((s, l) => s + l.totalCredit, 0),
                },
            });
        }),
        virementsDeMiseEnService: jest.fn().mockResolvedValue(new Map()),
        mouvementsDeCoutsEmpruntIncorpores: jest.fn().mockResolvedValue(new Map()),
        mouvementsDeReevaluation: jest.fn().mockResolvedValue(new Map()),
    };
}
function exercices() {
    return { lister: jest.fn().mockResolvedValue([...EXERCICES]) };
}
function prisma() {
    return {
        rattachementNote: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        provisionRisqueCharge: { findMany: jest.fn().mockResolvedValue([]) },
        saisieNote: { findMany: jest.fn().mockResolvedValue([]) },
        exercice: {
            findFirst: jest.fn(({ where }) => Promise.resolve(EXERCICES.find((e) => e.id === where.id) ?? null)),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    };
}
const sansBudget = {
    executionBudgetaire: jest.fn().mockRejectedValue(new etats_financiers_projet_budget_service_1.AucunPlanABudgetsException('aucun plan à budgets')),
};
function notesAvecEtatsReels(ecriture) {
    const exercice = exercices();
    return new note_annexe_service_1.NoteAnnexeService(ecriture, exercice, prisma(), sansBudget, new etats_financiers_service_1.EtatsFinanciersService(ecriture, exercice));
}
function notesSansMemoire(ecriture) {
    const exercice = exercices();
    const reel = new etats_financiers_service_1.EtatsFinanciersService(ecriture, exercice);
    const enveloppe = {
        bilan: (t, e) => reel.bilan(t, e),
        compteDeResultat: (t, e) => reel.compteDeResultat(t, e),
        tableauFluxTresorerie: (t, e) => reel.tableauFluxTresorerie(t, e),
    };
    return new note_annexe_service_1.NoteAnnexeService(ecriture, exercice, prisma(), sansBudget, enveloppe);
}
const exercicesLus = (ecriture) => ecriture.balance.mock.calls.map((appel) => appel[1]).sort();
describe('notes du jeu associations · une balance par exercice (audit final F214)', () => {
    it('lit N, N-1 et N-2 une fois chacun, et pas neuf fois', async () => {
        const ecriture = balanceComptee();
        await notesAvecEtatsReels(ecriture).notesAssociations('t', 'e2');
        expect(exercicesLus(ecriture)).toEqual(['e0', 'e1', 'e2']);
    });
    it('la référence sans mémoire relit bien neuf fois · la comparaison qui suit porte sur l’état d’avant', async () => {
        const ecriture = balanceComptee();
        await notesSansMemoire(ecriture).notesAssociations('t', 'e2');
        expect(exercicesLus(ecriture)).toEqual(['e0', 'e1', 'e1', 'e1', 'e1', 'e2', 'e2', 'e2', 'e2']);
    });
    it('ne change AUCUNE valeur · notes, fiche et note 33 identiques à la lecture sans mémoire', async () => {
        const [avec, sans] = await Promise.all([
            notesAvecEtatsReels(balanceComptee()).notesAssociations('t', 'e2'),
            notesSansMemoire(balanceComptee()).notesAssociations('t', 'e2'),
        ]);
        expect(avec).toEqual(sans);
        const n33 = avec.notes.find((n) => n.code === '33');
        expect(n33.lignes.some((l) => (l.saisie ?? []).some((v) => typeof v === 'number' && Math.abs(v) > 0.005))).toBe(true);
    });
    it('la mémoire ne survit pas à l’appel · un second appel relit la base', async () => {
        const ecriture = balanceComptee();
        const service = notesAvecEtatsReels(ecriture);
        await service.notesAssociations('t', 'e2');
        await service.notesAssociations('t', 'e2');
        expect(exercicesLus(ecriture)).toEqual(['e0', 'e0', 'e1', 'e1', 'e2', 'e2']);
    });
    it('le service des états injecté garde sa propre balance · la mémoire ne lui est que prêtée', async () => {
        const ecriture = balanceComptee();
        const exercice = exercices();
        const etats = new etats_financiers_service_1.EtatsFinanciersService(ecriture, exercice);
        const service = new note_annexe_service_1.NoteAnnexeService(ecriture, exercice, prisma(), sansBudget, etats);
        await service.notesAssociations('t', 'e2');
        ecriture.balance.mockClear();
        await etats.bilan('t', 'e2');
        expect(exercicesLus(ecriture)).toEqual(['e1', 'e2']);
    });
});
describe('notes du jeu associations · la mémoire garde les options de la lecture (paquet 1, B1)', () => {
    const lignesCompletes = [ligne('13100000', client_1.ClasseCompte.CLASSE_1, 2_000_000, 0, 0, 0)];
    const lignesAvantCloture = [ligne('13100000', client_1.ClasseCompte.CLASSE_1, 0, 2_000_000, 0, 0)];
    function balanceQuiHonoreLOption() {
        return {
            balance: jest.fn((_t, _e, _b, _a, options) => Promise.resolve({
                lignes: options?.avantLaCloture ? lignesAvantCloture : lignesCompletes,
                totaux: { debit: 0, credit: 0 },
            })),
        };
    }
    it('deux lectures qui ne diffèrent que par avantLaCloture ne partagent pas leur résultat', async () => {
        const reelle = balanceQuiHonoreLOption();
        const memoire = (0, note_annexe_service_1.balanceMemorisee)(reelle);
        const complete = await memoire.balance('t', 'e2', false);
        const avant = await memoire.balance('t', 'e2', false, undefined, { avantLaCloture: true });
        expect(complete.lignes).toBe(lignesCompletes);
        expect(avant.lignes).toBe(lignesAvantCloture);
        expect(reelle.balance.mock.calls[1]).toEqual(['t', 'e2', false, undefined, { avantLaCloture: true }]);
    });
    it('la même lecture répétée, options comprises, n’interroge la base qu’une fois', async () => {
        const reelle = balanceQuiHonoreLOption();
        const memoire = (0, note_annexe_service_1.balanceMemorisee)(reelle);
        await memoire.balance('t', 'e2', false, undefined, { avantLaCloture: true });
        await memoire.balance('t', 'e2', false, undefined, { avantLaCloture: true });
        expect(reelle.balance.mock.calls).toHaveLength(1);
    });
    it('la clé porte chaque paramètre, options triées comprises', () => {
        const date = new Date('2026-06-30T00:00:00Z');
        expect((0, note_annexe_service_1.cleDeLectureDeBalance)(['t', 'e', false, date, { avantLaCloture: true }])).not.toBe((0, note_annexe_service_1.cleDeLectureDeBalance)(['t', 'e', false, date]));
        expect((0, note_annexe_service_1.cleDeLectureDeBalance)(['t', 'e', false, date, { avantLaCloture: true }])).not.toBe((0, note_annexe_service_1.cleDeLectureDeBalance)(['t', 'e', false, date, { avantLaCloture: false }]));
        expect((0, note_annexe_service_1.cleDeLectureDeBalance)(['t', 'e', true])).not.toBe((0, note_annexe_service_1.cleDeLectureDeBalance)(['t', 'e', false]));
    });
    it('les notes d’un exercice sans N-1 lisent l’ouverture AVANT la clôture, à travers la mémoire', async () => {
        const ecriture = balanceComptee();
        const exercice = { lister: jest.fn().mockResolvedValue([EXERCICES[0]]) };
        const service = new note_annexe_service_1.NoteAnnexeService(ecriture, exercice, prisma(), sansBudget, new etats_financiers_service_1.EtatsFinanciersService(ecriture, exercice));
        await service.notesAssociations('t', 'e2');
        const appels = ecriture.balance.mock.calls;
        expect(appels.some((a) => a[1] === 'e2' && a[4]?.avantLaCloture === true)).toBe(true);
    });
});
//# sourceMappingURL=balance-memorisee-f214.spec.js.map