"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lettrage_service_1 = require("./lettrage.service");
const client_1 = require("@prisma/client");
const groupe = (p = {}) => ({
    id: 'g-1',
    compteId: 'c-401-durand',
    compte: { id: 'c-401-durand', numero: '40110000', intitule: 'Fournisseur DURAND' },
    code: 'A',
    statut: client_1.StatutLettrage.SOLDE,
    solde: 0,
    origine: 'MANUEL',
    verrouille: false,
    ecartChange: null,
    _count: { lignes: 2 },
    createdAt: new Date('2026-09-01T08:00:00.000Z'),
    createdBy: 'u-1',
    soldeAt: new Date('2026-09-01T08:00:00.000Z'),
    ...p,
});
function service(groupes) {
    const findMany = jest.fn().mockResolvedValue(groupes);
    const prisma = { lettrage: { findMany } };
    return { svc: new lettrage_service_1.LettrageService(prisma), findMany };
}
describe('lettrage · la vue d’ensemble du dossier', () => {
    it('borne la requête au dossier · un lettrage d’un autre cabinet ne se lit pas', async () => {
        const { svc, findMany } = service([]);
        await svc.listerGroupesDuDossier('t-1');
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't-1' } }));
    });
    it('un groupe SOLDÉ porte son code en majuscules', async () => {
        const { svc } = service([groupe({ code: 'B', statut: client_1.StatutLettrage.SOLDE })]);
        const [g] = await svc.listerGroupesDuDossier('t-1');
        expect(g.code).toBe('B');
        expect(g.statut).toBe(client_1.StatutLettrage.SOLDE);
    });
    it('un groupe PARTIEL porte son code en minuscules et son reste dû', async () => {
        const { svc } = service([groupe({ code: 'C', statut: client_1.StatutLettrage.PARTIEL, solde: 12500.5 })]);
        const [g] = await svc.listerGroupesDuDossier('t-1');
        expect(g.code).toBe('c');
        expect(g.solde).toBe(12500.5);
    });
    it('rend le compte porteur · sans lui, une lettre ne veut rien dire', async () => {
        const { svc } = service([groupe()]);
        const [g] = await svc.listerGroupesDuDossier('t-1');
        expect(g.compteNumero).toBe('40110000');
        expect(g.compteIntitule).toBe('Fournisseur DURAND');
        expect(g.compteId).toBe('c-401-durand');
    });
    it('compte les lignes du groupe', async () => {
        const { svc } = service([groupe({ _count: { lignes: 5 } })]);
        const [g] = await svc.listerGroupesDuDossier('t-1');
        expect(g.nombreLignes).toBe(5);
    });
    it('le filtre d’état se transmet à la base, il ne se fait pas en mémoire', async () => {
        const { svc, findMany } = service([]);
        await svc.listerGroupesDuDossier('t-1', client_1.StatutLettrage.PARTIEL);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't-1', statut: client_1.StatutLettrage.PARTIEL } }));
    });
    it('trie par compte puis par ancienneté · l’ordre du grand livre', async () => {
        const { svc, findMany } = service([]);
        await svc.listerGroupesDuDossier('t-1');
        expect(findMany.mock.calls[0][0].orderBy).toEqual([
            { compte: { numero: 'asc' } },
            { createdAt: 'asc' },
        ]);
    });
});
//# sourceMappingURL=lettrage-dossier.spec.js.map