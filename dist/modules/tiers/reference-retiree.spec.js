"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const reference_retiree_1 = require("./reference-retiree");
const tiers_service_1 = require("./tiers.service");
const p2003 = (champ) => new client_1.Prisma.PrismaClientKnownRequestError('fk', { code: 'P2003', clientVersion: 'x', meta: { field_name: champ } });
describe('conflitSiReferenceRetiree', () => {
    it('une clé étrangère refusée devient un 409 qui nomme la référence', () => {
        const e = (0, reference_retiree_1.conflitSiReferenceRetiree)(p2003('tiers_modeReglementId_fkey (index)'));
        expect(e).toBeInstanceOf(common_1.ConflictException);
        expect(e.message).toBe("Le mode de règlement choisi vient d'être retiré par une autre saisie · relisez la fiche et choisissez-en un autre.");
        expect((0, reference_retiree_1.motifReferenceRetiree)('tiers_modeleImpressionRappelId_fkey')).toMatch(/^Le modèle d'impression choisi/);
        expect((0, reference_retiree_1.motifReferenceRetiree)('echeances_reglement_modeleReglementId_fkey')).toMatch(/^Le modèle de règlement choisi/);
        expect((0, reference_retiree_1.motifReferenceRetiree)('inconnu')).toMatch(/^Un élément choisi/);
    });
    it('toute autre erreur repart telle', () => {
        const autre = new client_1.Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'x' });
        expect((0, reference_retiree_1.conflitSiReferenceRetiree)(autre)).toBe(autre);
        const brute = new Error('panne');
        expect((0, reference_retiree_1.conflitSiReferenceRetiree)(brute)).toBe(brute);
    });
});
describe('TiersService · le mode retiré pendant la retouche de la fiche', () => {
    it('la retouche du tiers rend un 409 nommé, jamais une erreur 500', async () => {
        const prisma = {
            tiers: {
                findFirst: jest.fn().mockResolvedValue({ id: 't1', tenantId: 't', type: 'FOURNISSEUR', code: 'F1', nom: 'Fournisseur' }),
                update: jest.fn().mockRejectedValue(p2003('tiers_modeReglementId_fkey (index)')),
            },
            modeReglement: {
                findFirst: jest.fn().mockResolvedValue({ id: 'm1', tenantId: 't', code: 'VIR', nature: 'VIREMENT', estActif: true }),
            },
        };
        const service = new tiers_service_1.TiersService(prisma);
        const refus = service.modifier('t', 't1', { modeReglementId: 'm1' });
        await expect(refus).rejects.toBeInstanceOf(common_1.ConflictException);
        await expect(refus).rejects.toThrow('Le mode de règlement choisi vient');
    });
});
//# sourceMappingURL=reference-retiree.spec.js.map