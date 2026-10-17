"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const report_periode_close_1 = require("./report-periode-close");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const J = (s) => new Date(`${s}T00:00:00.000Z`);
const periode = (limite) => ({ granularite: client_1.GranulariteCloture.PERIODE, journalId: null, dateLimite: J(limite) });
const partielle = (journalId, limite) => ({
    granularite: client_1.GranulariteCloture.PARTIELLE,
    journalId,
    dateLimite: J(limite),
});
describe('premier jour de la période non encore clôturée', () => {
    it('une date hors de toute clôture reste elle-même', () => {
        expect((0, report_periode_close_1.premierJourNonCloture)([periode('2026-03-31')], 'j1', J('2026-04-10'))).toEqual(J('2026-04-10'));
    });
    it('une facture de mars, mars clos pour tous les journaux, va au 1er avril', () => {
        expect((0, report_periode_close_1.premierJourNonCloture)([periode('2026-03-31')], 'j1', J('2026-03-15'))).toEqual(J('2026-04-01'));
    });
    it('les clôtures s’enchaînent · partielle au 31 mars puis période au 30 avril', () => {
        const c = [partielle('j1', '2026-03-31'), periode('2026-04-30')];
        expect((0, report_periode_close_1.premierJourNonCloture)(c, 'j1', J('2026-03-15'))).toEqual(J('2026-05-01'));
    });
    it('la clôture partielle d’un AUTRE journal ne bloque pas celui-ci', () => {
        expect((0, report_periode_close_1.premierJourNonCloture)([partielle('j2', '2026-03-31')], 'j1', J('2026-03-15'))).toEqual(J('2026-03-15'));
    });
    it('une clôture TOTALE porte sur une période du journal · janvier clos, la facture va au 1er février', () => {
        const totale = { granularite: client_1.GranulariteCloture.TOTALE, journalId: 'j1', dateLimite: J('2026-01-31') };
        expect((0, report_periode_close_1.premierJourNonCloture)([totale], 'j1', J('2026-01-15'))).toEqual(J('2026-02-01'));
        expect((0, report_periode_close_1.premierJourNonCloture)([totale], 'j1', J('2026-02-10'))).toEqual(J('2026-02-10'));
        expect((0, report_periode_close_1.premierJourNonCloture)([totale], 'j2', J('2026-01-15'))).toEqual(J('2026-01-15'));
    });
});
function service(premier) {
    const cree = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
    const tx = {
        ecriture: { create: cree },
        exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: J('2026-01-01'), dateFin: J('2026-12-31'), statut: 'OUVERT' }) },
    };
    const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: J('2026-01-01'), dateFin: J('2026-12-31'), statut: 'OUVERT' }) },
        compte: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id.in.map((id) => ({ id, numero: '60100000', typeCompte: 'DETAIL', tenantId: 't1' })))),
        },
        tauxTva: { findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn().mockImplementation((f) => f(tx)),
    };
    const exerciceService = {
        verifierEcritureAutorisee: jest.fn().mockResolvedValue(undefined),
        premierJourOuvert: jest.fn().mockResolvedValue(premier),
    };
    const svc = new ecriture_service_1.EcritureService(prisma, { trouver: jest.fn().mockResolvedValue({ id: 'j1', code: 'OD', estActif: true }), prochainNumeroPiece: jest.fn().mockResolvedValue(null) }, exerciceService, { verifierVentilationObligatoire: jest.fn().mockResolvedValue(undefined) });
    return { svc, cree, exerciceService };
}
const DTO = {
    exerciceId: 'ex',
    journalId: 'j1',
    date: '2026-03-15',
    libelle: 'Facture de mars reçue en mai',
    lignes: [
        { compteId: 'c1', debit: 100, credit: 0 },
        { compteId: 'c2', debit: 0, credit: 100 },
    ],
};
describe('création · le report est demandé, jamais fait d’office', () => {
    it('sur demande, l’écriture est datée du premier jour ouvert et garde sa date de valeur', async () => {
        const { svc, cree, exerciceService } = service(J('2026-04-01'));
        await svc.creer('t1', 'u1', { ...DTO, reporterAuPremierJourOuvert: true });
        const data = cree.mock.calls[0][0].data;
        expect(data.date).toEqual(J('2026-04-01'));
        expect(data.dateValeur).toEqual(J('2026-03-15'));
        expect(exerciceService.verifierEcritureAutorisee).toHaveBeenCalledWith('t1', 'j1', J('2026-04-01'));
    });
    it('sans demande, rien n’est reporté ni calculé', async () => {
        const { svc, cree, exerciceService } = service(J('2026-04-01'));
        await svc.creer('t1', 'u1', DTO);
        expect(exerciceService.premierJourOuvert).not.toHaveBeenCalled();
        expect(cree.mock.calls[0][0].data.dateValeur).toBeNull();
    });
    it('jamais au-delà de l’exercice · la charge changerait d’exercice', async () => {
        const { svc, cree } = service(J('2027-01-01'));
        await expect(svc.creer('t1', 'u1', { ...DTO, reporterAuPremierJourOuvert: true })).rejects.toThrow(/hors de l'exercice/);
        expect(cree).not.toHaveBeenCalled();
    });
});
describe('le refus nomme la voie que le texte ouvre', () => {
    it('une date en période close est refusée, et le message dit comment la reporter', async () => {
        const { ExerciceService } = require('./exercice.service');
        const prisma = {
            cloture: { findMany: jest.fn().mockResolvedValue([periode('2026-03-31')]) },
            journal: { findFirst: jest.fn().mockResolvedValue({ type: 'GENERAL' }) },
        };
        const svc = new ExerciceService(prisma, {});
        await expect(svc.verifierEcritureAutorisee('t1', 'j1', J('2026-03-15'))).rejects.toThrow(/art\. 22, 4°/);
        await expect(svc.premierJourOuvert('t1', 'j1', J('2026-03-15'))).resolves.toEqual(J('2026-04-01'));
    });
    it('une clôture de période ne vise pas un journal de situation', async () => {
        const { ExerciceService } = require('./exercice.service');
        const findMany = jest.fn().mockResolvedValue([]);
        const prisma = { cloture: { findMany }, journal: { findFirst: jest.fn().mockResolvedValue({ type: 'SITUATION' }) } };
        const svc = new ExerciceService(prisma, {});
        await expect(svc.verifierEcritureAutorisee('t1', 'jSit', J('2026-03-15'))).resolves.toBeUndefined();
        expect(findMany.mock.calls[0][0].where.OR).toEqual([{ journalId: 'jSit' }]);
    });
});
describe('la clôture totale est bornée à sa date limite (Sage i7, « pour le mois de janvier »)', () => {
    const { ExerciceService } = require('./exercice.service');
    const totale = (limite) => ({ granularite: client_1.GranulariteCloture.TOTALE, journalId: 'j1', dateLimite: J(limite) });
    it('refuse la saisie jusqu’à la date, pas après, et pas dans un autre journal', async () => {
        const prisma = {
            cloture: { findMany: jest.fn().mockResolvedValue([totale('2026-01-31')]) },
            journal: { findFirst: jest.fn().mockResolvedValue({ type: 'VENTES' }) },
        };
        const svc = new ExerciceService(prisma, {});
        await expect(svc.verifierEcritureAutorisee('t1', 'j1', J('2026-01-15'))).rejects.toThrow(/clôturé totalement jusqu'au 2026-01-31/);
        await expect(svc.verifierEcritureAutorisee('t1', 'j1', J('2026-02-01'))).resolves.toBeUndefined();
        await expect(svc.verifierEcritureAutorisee('t1', 'j1', J('2027-01-10'))).resolves.toBeUndefined();
    });
    function monterCloture() {
        const cree = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex', dateDebut: J('2026-01-01'), dateFin: J('2026-12-31') }) },
            cloture: { findFirst: jest.fn().mockResolvedValue(null), create: cree },
            tenant: { findUnique: jest.fn().mockResolvedValue({ refusClotureJournalNonImprime: false }) },
        };
        const journaux = { trouver: jest.fn().mockResolvedValue({ id: 'j1', code: 'VTE' }) };
        return { svc: new ExerciceService(prisma, journaux), cree };
    }
    it('sans date, elle va jusqu’à la fin de l’exercice ; avec une date, jusqu’à elle', async () => {
        const { svc, cree } = monterCloture();
        await svc.cloreTotale('t1', 'ex', 'u1', { journalId: 'j1' });
        expect(cree.mock.calls[0][0].data.dateLimite).toEqual(J('2026-12-31'));
        await svc.cloreTotale('t1', 'ex', 'u1', { journalId: 'j1', dateLimite: '2026-01-31' });
        expect(cree.mock.calls[1][0].data.dateLimite).toEqual(J('2026-01-31'));
    });
    it('refuse une date hors de l’exercice', async () => {
        const { svc, cree } = monterCloture();
        await expect(svc.cloreTotale('t1', 'ex', 'u1', { journalId: 'j1', dateLimite: '2027-01-31' })).rejects.toThrow(/hors de l'exercice/);
        expect(cree).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=report-periode-close.spec.js.map