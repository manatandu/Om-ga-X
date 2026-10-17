"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const rapprochement_service_1 = require("./rapprochement.service");
function monter() {
    const rapprochement = { id: 'rap', tenantId: 't1', compteId: '521', statut: 'EN_COURS', dateReleve: new Date('2026-03-31') };
    const releve = [{ id: 'r1', tenantId: 't1', rapprochementId: 'rap', libelle: 'Remise chèques', debit: 0, credit: 300, lignesEcriture: [] }];
    const ecriture = { estGenereeParCloture: false, estSoldeDesComptesDeGestion: false, exerciceId: 'ex' };
    const lignes = [
        { id: 'a', compteId: '521', debit: 100, credit: 0, rapprochementId: null, ligneReleveId: null, ecriture },
        { id: 'b', compteId: '521', debit: 200, credit: 0, rapprochementId: null, ligneReleveId: null, ecriture },
        { id: 'c', compteId: '521', debit: 250, credit: 0, rapprochementId: null, ligneReleveId: null, ecriture },
        { id: 'x', compteId: '571', debit: 200, credit: 0, rapprochementId: null, ligneReleveId: null, ecriture },
    ];
    const updateMany = jest.fn(async () => ({ count: 1 }));
    const prisma = {
        rapprochementBancaire: {
            findFirst: jest.fn(async ({ where }) => (where.statut === 'CLOTURE' ? null : rapprochement)),
        },
        exercice: { findFirst: jest.fn(async () => ({ id: 'ex' })) },
        ligneReleveBancaire: {
            findMany: jest.fn(async ({ where }) => releve.filter((r) => where.id.in.includes(r.id))),
        },
        ligneEcriture: {
            findMany: jest.fn(async ({ where }) => lignes.filter((l) => where.id.in.includes(l.id))),
            updateMany,
        },
        $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    return { service: new rapprochement_service_1.RapprochementService(prisma), updateMany, releve, lignes };
}
describe('confirmer une correspondance', () => {
    it('une remise de deux chèques · deux lignes du compte pour un crédit du relevé', async () => {
        const { service, updateMany } = monter();
        await service.confirmer('t1', 'rap', { correspondances: [{ ligneReleveId: 'r1', ligneEcritureIds: ['a', 'b'] }] });
        expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ data: { rapprochementId: 'rap', ligneReleveId: 'r1' } }));
    });
    it('refuse un groupe dont la somme ne vaut pas le relevé', async () => {
        const { service, updateMany } = monter();
        await expect(service.confirmer('t1', 'rap', { correspondances: [{ ligneReleveId: 'r1', ligneEcritureIds: ['a', 'c'] }] })).rejects.toThrow(/un écart ne se rapproche pas, il se comptabilise/);
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('refuse une ligne d’un autre compte', async () => {
        const { service } = monter();
        await expect(service.confirmer('t1', 'rap', { correspondances: [{ ligneReleveId: 'r1', ligneEcritureIds: ['a', 'x'] }] })).rejects.toThrow(/compte rapproché/);
    });
    it('refuse une ligne du relevé déjà rapprochée', async () => {
        const { service, releve } = monter();
        releve[0].lignesEcriture = [{ id: 'z' }];
        await expect(service.confirmer('t1', 'rap', { correspondances: [{ ligneReleveId: 'r1', ligneEcritureIds: ['a', 'b'] }] })).rejects.toThrow(/déjà rapprochée/);
    });
    it('refuse une ligne du compte déjà pointée ailleurs', async () => {
        const { service, lignes } = monter();
        lignes[0].rapprochementId = 'autre';
        await expect(service.confirmer('t1', 'rap', { correspondances: [{ ligneReleveId: 'r1', ligneEcritureIds: ['a', 'b'] }] })).rejects.toThrow(/déjà pointée/);
    });
});
describe('dépointer dénoue aussi la correspondance', () => {
    it('le dépointage remet ligneReleveId à null', () => {
        const src = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'rapprochement.service.ts'), 'utf8');
        const debut = src.indexOf('  async depointer(');
        const fin = src.indexOf('\n  async ', debut + 5);
        expect(src.slice(debut, fin)).toContain('data: { rapprochementId: null, ligneReleveId: null }');
    });
});
//# sourceMappingURL=correspondances.spec.js.map