"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ecriture_service_1 = require("./ecriture.service");
function comptes() {
    return [
        { id: 'c10', numero: '10', intitule: 'Dotation', classe: 'CLASSE_1', typeCompte: 'TOTAL' },
        { id: 'c101', numero: '101', intitule: 'Dotation · sous-total', classe: 'CLASSE_1', typeCompte: 'TOTAL' },
        { id: 'c1011', numero: '10110000', intitule: 'Dotation numéraire', classe: 'CLASSE_1', typeCompte: 'DETAIL' },
        { id: 'c1015', numero: '10150000', intitule: 'Dotation nature', classe: 'CLASSE_1', typeCompte: 'DETAIL' },
        { id: 'c52', numero: '52', intitule: 'Banques', classe: 'CLASSE_5', typeCompte: 'TOTAL' },
        { id: 'c521', numero: '52100000', intitule: 'Banque locale', classe: 'CLASSE_5', typeCompte: 'DETAIL' },
        { id: 'c60', numero: '60', intitule: 'Achats', classe: 'CLASSE_6', typeCompte: 'TOTAL' },
        { id: 'c601', numero: '60100000', intitule: 'Achats de marchandises', classe: 'CLASSE_6', typeCompte: 'DETAIL' },
        { id: 'c131', numero: '13100000', intitule: 'Résultat net : bénéfice', classe: 'CLASSE_1', typeCompte: 'DETAIL' },
    ];
}
function service(reports, mouvements, clotures = []) {
    const groupe = (l) => l.map((x) => ({ compteId: x.compteId, _sum: { debit: x.debit, credit: x.credit } }));
    const groupBy = jest.fn().mockImplementation(({ where }) => Promise.resolve(groupe(where.ecriture.estSoldeDesComptesDeGestion === true
        ? clotures
        : where.ecriture.estGenereeParCloture
            ? reports
            : mouvements)));
    const prisma = {
        compte: { findMany: jest.fn().mockResolvedValue(comptes()) },
        ligneEcriture: { groupBy },
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'e1' && where.tenantId === 't1' ? { dateFin: new Date('2026-12-31') } : null)),
        },
    };
    const svc = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
    return { svc, groupBy };
}
const lignes = (r) => r.lignes;
const ligne = (r, numero) => lignes(r).find((l) => l.numero === numero);
describe('Balance générale', () => {
    it('sépare le report à-nouveau du mouvement de l’exercice', async () => {
        const { svc } = service([{ compteId: 'c1011', debit: 500_000, credit: 0 }], [{ compteId: 'c1011', debit: 0, credit: 120_000 }]);
        const r = await svc.balance('t1', 'e1');
        const l = ligne(r, '10110000');
        expect(l.reportDebit).toBe(500_000);
        expect(l.mouvementCredit).toBe(120_000);
        expect(l.totalDebit).toBe(500_000);
        expect(l.totalCredit).toBe(120_000);
        expect(l.solde).toBe(380_000);
    });
    it('ligne à ligne, ouverture + mouvements = clôture · l’identité des six colonnes', async () => {
        const { svc } = service([
            { compteId: 'c1011', debit: 500_000, credit: 0 },
            { compteId: 'c521', debit: 0, credit: 80_000 },
        ], [
            { compteId: 'c1011', debit: 0, credit: 120_000 },
            { compteId: 'c521', debit: 300_000, credit: 45_000 },
        ]);
        const r = await svc.balance('t1', 'e1');
        for (const l of lignes(r)) {
            expect(l.reportDebit - l.reportCredit + l.mouvementDebit - l.mouvementCredit).toBe(l.solde);
        }
        const c = ligne(r, '10110000');
        expect(c.reportDebit - c.reportCredit).toBe(500_000);
        expect(c.solde).toBe(380_000);
    });
    it('ne porte AUCUNE ligne de sous-totalisation par compte principal', async () => {
        const { svc } = service([], [
            { compteId: 'c1011', debit: 300_000, credit: 0 },
            { compteId: 'c1015', debit: 200_000, credit: 0 },
        ]);
        const r = await svc.balance('t1', 'e1');
        expect(r.lignes.map((l) => l.numero)).toEqual(['10110000', '10150000']);
        expect(r.lignes.every((l) => l.typeCompte === 'DETAIL')).toBe(true);
    });
    it('liste les comptes dans l’ordre croissant de leur numéro', async () => {
        const { svc } = service([], [
            { compteId: 'c521', debit: 400_000, credit: 0 },
            { compteId: 'c1011', debit: 0, credit: 400_000 },
        ]);
        const r = await svc.balance('t1', 'e1');
        expect(r.lignes.map((l) => l.numero)).toEqual(['10110000', '52100000']);
    });
    it('totalise sur toutes les lignes rendues, sans rien à écarter', async () => {
        const { svc } = service([], [
            { compteId: 'c1011', debit: 0, credit: 400_000 },
            { compteId: 'c521', debit: 400_000, credit: 0 },
        ]);
        const r = await svc.balance('t1', 'e1');
        expect(r.totaux.debit).toBe(400_000);
        expect(r.totaux.credit).toBe(400_000);
    });
    it('garde un compte mouvementé dont le solde retombe à zéro', async () => {
        const { svc } = service([], [{ compteId: 'c521', debit: 400_000, credit: 400_000 }]);
        const r = await svc.balance('t1', 'e1');
        expect(r.lignes.map((l) => l.numero)).toEqual(['52100000']);
        expect(ligne(r, '52100000').solde).toBe(0);
        expect(r.totaux).toEqual({ debit: 400_000, credit: 400_000 });
    });
    it('un compte sans mouvement disparaît de la balance', async () => {
        const { svc } = service([], [{ compteId: 'c521', debit: 90_000, credit: 0 }]);
        const r = await svc.balance('t1', 'e1');
        expect(r.lignes.map((l) => l.numero)).toEqual(['52100000']);
        expect(ligne(r, '60')).toBeUndefined();
    });
    it('ne rapatrie pas les lignes · trois agrégations en base, pas une par compte', async () => {
        const { svc, groupBy } = service([], [{ compteId: 'c521', debit: 10, credit: 0 }]);
        await svc.balance('t1', 'e1');
        expect(groupBy).toHaveBeenCalledTimes(3);
    });
    it('range l’écriture de solde des classes 6 à 8 à part, ni en ouverture ni en mouvement', async () => {
        const { svc, groupBy } = service([{ compteId: 'c521', debit: 50_000, credit: 0 }], [
            { compteId: 'c601', debit: 30_000, credit: 0 },
            { compteId: 'c521', debit: 0, credit: 30_000 },
        ], [
            { compteId: 'c601', debit: 0, credit: 30_000 },
            { compteId: 'c131', debit: 30_000, credit: 0 },
        ]);
        const r = await svc.balance('t1', 'e1');
        const achats = ligne(r, '60100000');
        expect({ ouverture: achats.reportDebit - achats.reportCredit, mouvement: achats.mouvementDebit, cloture: achats.clotureCredit, solde: achats.solde }).toEqual({
            ouverture: 0,
            mouvement: 30_000,
            cloture: 30_000,
            solde: 0,
        });
        const filtreOuverture = groupBy.mock.calls.map((c) => c[0].where.ecriture).find((e) => e.estGenereeParCloture === true);
        expect(filtreOuverture.estSoldeDesComptesDeGestion).toBe(false);
        for (const l of lignes(r)) {
            expect(l.reportDebit - l.reportCredit + l.mouvementDebit - l.mouvementCredit + l.clotureDebit - l.clotureCredit).toBe(l.solde);
        }
    });
    it('exclut le brouillard quand on le demande', async () => {
        const { svc, groupBy } = service([], []);
        await svc.balance('t1', 'e1', false);
        expect(groupBy.mock.calls[0][0].where.ecriture.statut).toBe('VALIDEE');
        const { svc: svc2, groupBy: g2 } = service([], []);
        await svc2.balance('t1', 'e1');
        expect(g2.mock.calls[0][0].where.ecriture.statut).toEqual({ not: 'SITUATION' });
    });
    it('avantLaCloture borne les trois colonnes avant la date de fin de l’exercice', async () => {
        const { svc, groupBy } = service([], []);
        await svc.balance('t1', 'e1', false, undefined, { avantLaCloture: true });
        expect(groupBy).toHaveBeenCalledTimes(3);
        for (const [arg] of groupBy.mock.calls) {
            expect(arg.where.ecriture.tenantId).toBe('t1');
            expect(arg.where.ecriture.AND).toEqual([{ date: { lt: new Date('2026-12-31') } }]);
        }
        const { svc: svc2, groupBy: g2 } = service([], []);
        await svc2.balance('t1', 'e1', false, new Date('2026-06-30'), { avantLaCloture: true });
        expect(g2.mock.calls[0][0].where.ecriture.date).toEqual({ lte: new Date('2026-06-30') });
        expect(g2.mock.calls[0][0].where.ecriture.AND).toEqual([{ date: { lt: new Date('2026-12-31') } }]);
        const { svc: svc3, groupBy: g3 } = service([], []);
        await svc3.balance('t1', 'e1', false);
        expect(g3.mock.calls[0][0].where.ecriture.AND).toBeUndefined();
    });
    it('avantLaCloture refuse un exercice que le dossier ne porte pas, plutôt que de lire sans borne', async () => {
        const { svc, groupBy } = service([], []);
        await expect(svc.balance('t1', 'autre', false, undefined, { avantLaCloture: true })).rejects.toThrow('Exercice introuvable pour ce dossier.');
        expect(groupBy).not.toHaveBeenCalled();
    });
});
describe('nombreAuBrouillard', () => {
    it('compte le brouillard du dossier et de l’exercice, sans l’à-nouveau provisoire', async () => {
        const count = jest.fn().mockResolvedValue(3);
        const svc = new ecriture_service_1.EcritureService({ ecriture: { count } }, {}, {}, {});
        await expect(svc.nombreAuBrouillard('t1', 'e1')).resolves.toBe(3);
        expect(count).toHaveBeenCalledWith({
            where: { tenantId: 't1', exerciceId: 'e1', statut: 'BROUILLARD', estANouveauProvisoire: false },
        });
    });
});
//# sourceMappingURL=balance.spec.js.map