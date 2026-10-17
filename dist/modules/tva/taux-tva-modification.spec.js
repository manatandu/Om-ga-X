"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const taux_tva_service_1 = require("./taux-tva.service");
function service(o = {}) {
    const prisma = {
        tauxTva: {
            findFirst: jest.fn(({ where }) => Promise.resolve(where.tenantId === 't' && where.id === 'tx16' ? { id: 'tx16', code: 'TVA16', taux: 16 } : null)),
            update: jest.fn(({ data }) => Promise.resolve({ id: 'tx16', ...data })),
        },
        ligneEcriture: { count: jest.fn(({ where }) => Promise.resolve(where.ecriture.tenantId === 't' ? (o.lignesEcriture ?? 0) : 0)) },
        ligneFacture: { count: jest.fn(({ where }) => Promise.resolve(where.facture.tenantId === 't' ? (o.lignesFacture ?? 0) : 0)) },
        compte: { findFirst: jest.fn(({ where }) => Promise.resolve(where.tenantId === 't' ? { id: where.id } : null)) },
    };
    return { svc: new taux_tva_service_1.TauxTvaService(prisma, {}), prisma };
}
describe('F121 · le pourcentage d’un taux mouvementé ne change plus', () => {
    it('refuse de passer 16 % à 18 % quand une ligne d’écriture ou de facture le porte', async () => {
        for (const o of [{ lignesEcriture: 3 }, { lignesFacture: 1 }]) {
            const { svc, prisma } = service(o);
            await expect(svc.modifier('t', 'tx16', { taux: 18 })).rejects.toThrow(common_1.ConflictException);
            expect(prisma.tauxTva.update).not.toHaveBeenCalled();
        }
    });
    it('un taux libre change de pourcentage, et le même pourcentage renvoyé ne compte pas pour un changement', async () => {
        const libre = service();
        await expect(libre.svc.modifier('t', 'tx16', { taux: 18 })).resolves.toMatchObject({ taux: 18 });
        const inchange = service({ lignesEcriture: 5 });
        await expect(inchange.svc.modifier('t', 'tx16', { taux: 16, intitule: 'Taux normal' })).resolves.toMatchObject({ intitule: 'Taux normal' });
    });
});
describe('F122 · les comptes d’un taux mouvementé se complètent', () => {
    it('rattacher un compte collecté ou déductible ne demande aucune ligne libre', async () => {
        const { svc, prisma } = service({ lignesEcriture: 12 });
        await expect(svc.modifier('t', 'tx16', { compteCollecteId: 'c4431', compteDeductibleId: 'c4452' })).resolves.toMatchObject({
            compteCollecteId: 'c4431',
        });
        expect(prisma.ligneEcriture.count).not.toHaveBeenCalled();
    });
    it('un compte d’un autre dossier est refusé', async () => {
        const { svc, prisma } = service();
        prisma.compte.findFirst.mockResolvedValueOnce(null);
        await expect(svc.modifier('t', 'tx16', { compteCollecteId: 'ailleurs' })).rejects.toThrow(/Compte introuvable/);
    });
});
describe('La déduction admise se répartit au centime entre les comptes', () => {
    it('la somme rendue vaut le total arrondi une fois, le reste allant au compte le plus lourd', () => {
        const bruts = new Map([
            ['a', 100.01],
            ['b', 200.01],
            ['c', 300.01],
        ]);
        const total = Math.round(600.03 * 0.37 * 100) / 100;
        const r = (0, taux_tva_service_1.repartirAuCentime)(total, bruts, 0.37);
        const somme = Math.round([...r.values()].reduce((s, x) => s + x, 0) * 100) / 100;
        expect(somme).toBe(total);
        expect(r.get('c')).toBe(111.01);
        expect(r.get('a')).toBe(37);
    });
    it('à 100 %, chaque compte garde exactement son montant', () => {
        const r = (0, taux_tva_service_1.repartirAuCentime)(-50, new Map([['a', 150], ['b', -200]]), 1);
        expect([...r]).toEqual([
            ['a', 150],
            ['b', -200],
        ]);
    });
    it('un écart au-delà de la poussière d’arrondi est un défaut du moteur, jamais logé sur un compte', () => {
        expect(() => (0, taux_tva_service_1.repartirAuCentime)(100, new Map([['a', 116]]), 1)).toThrow(/incohérente/);
    });
});
//# sourceMappingURL=taux-tva-modification.spec.js.map