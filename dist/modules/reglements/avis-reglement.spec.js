"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const avis_reglement_1 = require("./avis-reglement");
const ordres_virement_service_1 = require("./ordres-virement.service");
const ORDRE = { numero: 7, date: new Date('2026-10-14T00:00:00Z') };
describe('le document', () => {
    it('dit l’ordre, la somme, la banque, la référence et l’imputation déclarée, et le signe', () => {
        const texte = (0, avis_reglement_1.documentAvisReglement)({ montant: 1_160_000, banque: 'Rawbank', reference: 'FAC-2026-14', imputationDeclaree: 'Factures payées · pièce 12 : 1 160 000,00' }, ORDRE, 'SARL Kin\nRCCM CD/KIN/RCCM/26-B-1');
        expect(texte).toContain('ordre de virement n° 7 du 14/10/2026');
        expect(texte).toMatch(/la somme de 1\s160\s000,00 CDF, au crédit de votre compte ouvert auprès de Rawbank\./);
        expect(texte).toContain('Référence du paiement : FAC-2026-14.');
        expect(texte).toContain('Factures payées · pièce 12 : 1 160 000,00.');
        expect(texte.endsWith('SARL Kin\nRCCM CD/KIN/RCCM/26-B-1')).toBe(true);
    });
    it('sans référence ni imputation déclarée, rien n’est inventé', () => {
        const texte = (0, avis_reglement_1.documentAvisReglement)({ montant: 500, banque: 'Equity', reference: null, imputationDeclaree: null }, ORDRE, 'SARL Kin');
        expect(texte).not.toContain('Référence du paiement');
        expect(texte).not.toContain('Factures payées');
    });
    it('un avis suit un ordre remis · ni annulé, ni en attente d’impression', () => {
        expect((0, avis_reglement_1.motifRefusAvis)('ANNULE')).toMatch(/ne paie personne/);
        expect((0, avis_reglement_1.motifRefusAvis)('A_IMPRIMER')).toMatch(/Imprimez l'ordre d'abord/);
        expect((0, avis_reglement_1.motifRefusAvis)('IMPRIME')).toBeNull();
    });
    it('le cadre par défaut porte le document une fois', () => {
        expect(avis_reglement_1.CADRE_AVIS_PAR_DEFAUT.split('{document}')).toHaveLength(2);
    });
});
describe('le service', () => {
    function monter(statut, fiches) {
        const lignes = [
            { id: 'l-1', tiersId: 't-1', salarieId: null, beneficiaire: 'Imprimerie du Fleuve', banque: 'Rawbank', montant: new client_1.Prisma.Decimal(250_000), reference: null, imputationDeclaree: 'Factures payées · pièce 3 : 250 000,00' },
            { id: 'l-2', tiersId: 't-2', salarieId: null, beneficiaire: 'Garage Lemba', banque: 'Equity', montant: new client_1.Prisma.Decimal(80_000), reference: 'VIR-9', imputationDeclaree: null },
            { id: 'l-3', tiersId: null, salarieId: 's-1', beneficiaire: 'M. Kabila', banque: 'TMB', montant: new client_1.Prisma.Decimal(400_000), reference: null, imputationDeclaree: null },
        ];
        const prisma = {
            ordreVirement: {
                findFirst: jest.fn(async ({ where }) => where.tenantId === 'd' && where.id === 'o-1' ? { id: 'o-1', numero: 7, date: ORDRE.date, statut, lignes } : null),
            },
            tenant: { findUnique: jest.fn(async () => ({ nom: 'SARL Kin' })) },
            tiers: {
                findMany: jest.fn(async ({ where }) => fiches
                    .filter((f) => where.id.in.includes(f.id))
                    .map((f) => ({
                    ...f,
                    nom: f.id === 't-1' ? 'Imprimerie du Fleuve' : 'Garage Lemba',
                    code: f.id,
                    qualite: null,
                    contact: null,
                    adresse: 'Av. 1',
                    boitePostale: null,
                    ville: 'Kinshasa',
                    pays: null,
                    modeleImpressionExtraitId: null,
                    modeleImpressionRappelId: null,
                }))),
            },
            modeleImpressionTiers: {
                findMany: jest.fn(async ({ where }) => where.nature === 'REGLEMENT' && where.id.in.includes('m-avis') ? [{ id: 'm-avis', intitule: 'Avis groupe', texte: 'Service fournisseurs\n{document}\nCopie : direction' }] : []),
            },
        };
        return new ordres_virement_service_1.OrdresVirementService(prisma);
    }
    it('refuse l’avis d’un ordre pas encore imprimé', async () => {
        await expect(monter('A_IMPRIMER', []).avisReglement('d', 'o-1')).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('un avis par tiers, habillé de SON modèle ou du cadre par défaut ; aucun pour un salaire, compté', async () => {
        const r = await monter('IMPRIME', [
            { id: 't-1', modeleImpressionReglementId: 'm-avis' },
            { id: 't-2', modeleImpressionReglementId: null },
        ]).avisReglement('d', 'o-1');
        expect(r.avis.map((a) => [a.ligneId, a.modele])).toEqual([
            ['l-1', 'Avis groupe'],
            ['l-2', null],
        ]);
        expect(r.avis[0].texte).toMatch(/^Service fournisseurs\nMadame, Monsieur,[\s\S]*Factures payées · pièce 3 : 250 000,00\.[\s\S]*SARL Kin\nCopie : direction$/);
        expect(r.avis[1].texte.startsWith('Garage Lemba\nAv. 1\nKinshasa\n\nLe ')).toBe(true);
        expect(r.avis[1].texte).toContain('Objet : avis de règlement');
        expect(r.avis[1].texte).toContain('Référence du paiement : VIR-9.');
        expect(r.lignesDeSalaires).toBe(1);
    });
    it('un ordre de salaires reste fermé à qui le personnel est fermé', async () => {
        await expect(monter('IMPRIME', []).avisReglement('d', 'o-1', false)).rejects.toBeInstanceOf(common_1.ForbiddenException);
    });
    it('l’ordre d’un autre dossier est introuvable', async () => {
        await expect(monter('IMPRIME', []).avisReglement('autre', 'o-1')).rejects.toThrow(/introuvable/);
    });
});
//# sourceMappingURL=avis-reglement.spec.js.map