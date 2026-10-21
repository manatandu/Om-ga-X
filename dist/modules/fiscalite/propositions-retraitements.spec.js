"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const fiscalite_service_1 = require("./fiscalite.service");
const compte_service_1 = require("../comptes/compte.service");
function service(options) {
    const prisma = {
        tenant: {
            findUnique: jest.fn().mockResolvedValue({ id: 't-1', referentiel: 'SYSCOHADA' }),
            findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't-1', referentiel: 'SYSCOHADA' }),
        },
        exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex-1', tenantId: 't-1' }) },
        compte: { findMany: jest.fn().mockResolvedValue(options.comptes ?? []) },
        ligneEcriture: {
            groupBy: jest.fn(async ({ where }) => {
                const parCompte = new Map();
                for (const m of options.mouvements ?? []) {
                    if (m.soldeDeGestion && where.ecriture.estSoldeDesComptesDeGestion === false)
                        continue;
                    const a = parCompte.get(m.compteId) ?? { debit: 0, credit: 0 };
                    a.debit += m.debit;
                    a.credit += m.credit;
                    parCompte.set(m.compteId, a);
                }
                return [...parCompte].map(([compteId, s]) => ({ compteId, _sum: s }));
            }),
        },
        retraitementFiscal: {
            findMany: jest.fn().mockResolvedValue((options.retraitements ?? []).map((r, i) => ({ id: `r${i}`, libelle: 'x', commentaire: null, ...r }))),
        },
    };
    const ecritures = {
        balance: jest.fn().mockResolvedValue({
            lignes: [
                {
                    numero: '70110000', intitule: 'Ventes', typeCompte: 'DETAIL',
                    solde: -(options.chiffreAffaires ?? 0), mouvementDebit: 0, mouvementCredit: options.chiffreAffaires ?? 0,
                },
                ...(options.chargesComptables
                    ? [{ numero: '60110000', intitule: 'Achats', typeCompte: 'DETAIL', solde: options.chargesComptables }]
                    : []),
            ],
        }),
    };
    const svc = new fiscalite_service_1.FiscaliteService(prisma, ecritures);
    return svc;
}
const compte = (id, numero, code) => ({
    id,
    numero,
    intitule: `Compte ${numero}`,
    codeRetraitementFiscal: code,
});
describe('propositions de retraitement', () => {
    it('un compte SANS plafond propose tout son mouvement net', async () => {
        const svc = service({
            comptes: [compte('c-1', '64710000', 'AMENDES_PENALITES')],
            mouvements: [{ compteId: 'c-1', debit: 1_200_000, credit: 0 }],
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions).toHaveLength(1);
        expect(propositions[0]).toMatchObject({
            numero: '64710000',
            code: 'AMENDES_PENALITES',
            sens: client_1.SensRetraitementFiscal.REINTEGRATION,
            mouvement: 1_200_000,
            montantAdmis: null,
            montant: 1_200_000,
        });
        expect(propositions[0].source).toContain('art.');
    });
    it('un compte PLAFONNÉ ne propose que l’EXCÉDENT', async () => {
        const svc = service({
            comptes: [compte('c-1', '65820000', 'DONS_EXCEDENT')],
            mouvements: [{ compteId: 'c-1', debit: 900_000, credit: 0 }],
            chiffreAffaires: 100_000_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions[0]).toMatchObject({
            mouvement: 900_000,
            montantAdmis: 500_000,
            montant: 400_000,
        });
        expect(propositions[0].plafondEnonce).toContain("0,5 % du chiffre d'affaires");
    });
    it('sous le plafond, AUCUNE proposition', async () => {
        const svc = service({
            comptes: [compte('c-1', '65820000', 'DONS_EXCEDENT')],
            mouvements: [{ compteId: 'c-1', debit: 200_000, credit: 0 }],
            chiffreAffaires: 100_000_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions).toEqual([]);
    });
    it('un compte au solde CRÉDITEUR ne propose rien', async () => {
        const svc = service({
            comptes: [compte('c-1', '64710000', 'AMENDES_PENALITES')],
            mouvements: [{ compteId: 'c-1', debit: 100_000, credit: 300_000 }],
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions).toEqual([]);
    });
    it('un compte sans mouvement de l’exercice ne propose rien', async () => {
        const svc = service({ comptes: [compte('c-1', '64710000', 'AMENDES_PENALITES')], mouvements: [] });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions).toEqual([]);
    });
    it('un code devenu INCONNU est ignoré, pas rendu sans libellé', async () => {
        const svc = service({
            comptes: [compte('c-1', '64710000', 'CODE_DISPARU')],
            mouvements: [{ compteId: 'c-1', debit: 500_000, credit: 0 }],
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions).toEqual([]);
    });
    it('un exercice CLOS propose encore sa réintégration · le solde de clôture n’annule pas le mouvement (régression de F4)', async () => {
        const svc = service({
            comptes: [compte('c-1', '64710000', 'AMENDES_PENALITES')],
            mouvements: [
                { compteId: 'c-1', debit: 500_000, credit: 0 },
                { compteId: 'c-1', debit: 0, credit: 500_000, soldeDeGestion: true },
            ],
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions.map((p) => p.montant)).toEqual([500_000]);
    });
    it('la lecture ne prend QUE le livre-journal', async () => {
        const svc = service({ comptes: [compte('c-1', '64710000', 'AMENDES_PENALITES')], mouvements: [] });
        await svc.propositionsRetraitements('t-1', 'ex-1');
        const prisma = svc.prisma;
        expect(prisma.ligneEcriture.groupBy.mock.calls[0][0].where.ecriture.statut).toBe('VALIDEE');
    });
});
describe('le code posé sur un compte est vérifié', () => {
    function compteService() {
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't-1', longueurCompte: 8 }) },
            compte: {
                findFirst: jest.fn().mockResolvedValue({ id: 'c-1', numero: '64710000' }),
                update: jest.fn().mockResolvedValue({ id: 'c-1' }),
            },
            ligneEcriture: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        return new compte_service_1.CompteService(prisma);
    }
    it('REFUSE un code absent du catalogue', async () => {
        await expect(compteService().modifier('t-1', 'c-1', { codeRetraitementFiscal: 'INVENTE' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('accepte un code du catalogue, et la chaîne vide qui l’efface', async () => {
        const svc = compteService();
        await expect(svc.modifier('t-1', 'c-1', { codeRetraitementFiscal: '' })).resolves.toBeDefined();
        await expect(svc.modifier('t-1', 'c-1', { codeRetraitementFiscal: 'AMENDES_PENALITES' })).resolves.toBeDefined();
    });
});
describe('plafond en pourcentage du chiffre d’affaires · global par nature', () => {
    it('cumule les comptes d’une MÊME nature avant d’appliquer le plafond', async () => {
        const svc = service({
            comptes: [compte('c-1', '65820000', 'DONS_EXCEDENT'), compte('c-2', '65830000', 'DONS_EXCEDENT')],
            mouvements: [
                { compteId: 'c-1', debit: 400_000, credit: 0 },
                { compteId: 'c-2', debit: 400_000, credit: 0 },
            ],
            chiffreAffaires: 100_000_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions).toHaveLength(2);
        expect(propositions.reduce((s, p) => s + p.montant, 0)).toBe(300_000);
        expect(propositions[0]).toMatchObject({
            mouvement: 400_000,
            mouvementNature: 800_000,
            montantAdmisNature: 500_000,
            montant: 150_000,
            montantAdmis: 250_000,
        });
        expect(propositions[0].plafondEnonce).toMatch(/plafond commun/);
    });
    it('répartit l’excédent au prorata, au centime près', async () => {
        const svc = service({
            comptes: [
                compte('c-1', '62340000', 'CADEAUX_EXCEDENT'),
                compte('c-2', '62341000', 'CADEAUX_EXCEDENT'),
                compte('c-3', '62342000', 'CADEAUX_EXCEDENT'),
            ],
            mouvements: [
                { compteId: 'c-1', debit: 333_333, credit: 0 },
                { compteId: 'c-2', debit: 333_333, credit: 0 },
                { compteId: 'c-3', debit: 333_334, credit: 0 },
            ],
            chiffreAffaires: 90_000_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions.reduce((s, p) => s + p.montant, 0)).toBe(820_000);
    });
    it('un seul compte porteur de la nature : le plafond entier, comme avant', async () => {
        const svc = service({
            comptes: [compte('c-1', '65820000', 'DONS_EXCEDENT'), compte('c-2', '64710000', 'AMENDES_PENALITES')],
            mouvements: [
                { compteId: 'c-1', debit: 900_000, credit: 0 },
                { compteId: 'c-2', debit: 50_000, credit: 0 },
            ],
            chiffreAffaires: 100_000_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        const dons = propositions.find((p) => p.code === 'DONS_EXCEDENT');
        expect(dons).toMatchObject({ mouvement: 900_000, montantAdmis: 500_000, montant: 400_000 });
        expect(dons.plafondEnonce).not.toMatch(/plafond commun/);
        expect(propositions.find((p) => p.code === 'AMENDES_PENALITES')).toMatchObject({ montant: 50_000 });
    });
    it('un plafond assis sur la CHARGE reste compte par compte · une fraction est linéaire', async () => {
        const svc = service({
            comptes: [
                compte('c-1', '62570000', 'REPRESENTATION_EXCEDENT'),
                compte('c-2', '62571000', 'REPRESENTATION_EXCEDENT'),
            ],
            mouvements: [
                { compteId: 'c-1', debit: 100_000, credit: 0 },
                { compteId: 'c-2', debit: 200_000, credit: 0 },
            ],
            chiffreAffaires: 100_000_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions.map((p) => p.montant)).toEqual([40_000, 80_000]);
        expect(propositions.map((p) => p.mouvementNature)).toEqual([null, null]);
    });
});
describe('condition d’ouverture du droit à déduction · art. 44, al. 2, 2°', () => {
    it('un dossier DÉFICITAIRE ne conserve AUCUN don en déduction · la totalité se réintègre', async () => {
        const svc = service({
            comptes: [compte('c-1', '65820000', 'DONS_EXCEDENT')],
            mouvements: [{ compteId: 'c-1', debit: 800_000, credit: 0 }],
            chiffreAffaires: 100_000_000,
            chargesComptables: 102_800_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions[0]).toMatchObject({
            mouvement: 800_000,
            montant: 800_000,
            montantAdmis: 0,
            montantAdmisNature: 0,
        });
        expect(propositions[0].plafondEnonce).toContain('SANS EFFET ICI');
        expect(propositions[0].plafondEnonce).toContain('le résultat net imposable avant déduction de ces versements soit positif');
    });
    it('le résultat se juge AVANT déduction des versements · des dons qui le rendent positif ouvrent le droit', async () => {
        const svc = service({
            comptes: [compte('c-1', '65820000', 'DONS_EXCEDENT')],
            mouvements: [{ compteId: 'c-1', debit: 900_000, credit: 0 }],
            chiffreAffaires: 100_000_000,
            chargesComptables: 100_300_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions[0]).toMatchObject({ montantAdmis: 500_000, montant: 400_000 });
        expect(propositions[0].plafondEnonce).not.toContain('SANS EFFET ICI');
    });
    it('ce qui a DÉJÀ été réintégré sous le même code ne compte pas deux fois', async () => {
        const svc = service({
            comptes: [compte('c-1', '65820000', 'DONS_EXCEDENT')],
            mouvements: [{ compteId: 'c-1', debit: 800_000, credit: 0 }],
            chiffreAffaires: 100_000_000,
            chargesComptables: 102_800_000,
            retraitements: [{ code: 'DONS_EXCEDENT', sens: client_1.SensRetraitementFiscal.REINTEGRATION, montant: 300_000 }],
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions[0].plafondEnonce.replace(/[\u202f\u00a0]/g, ' ')).toContain('-2 000 000');
        expect(propositions[0]).toMatchObject({ montantAdmis: 0, montant: 800_000 });
    });
    it('la condition ne touche QUE le code qui la porte · les cadeaux gardent leur plafond', async () => {
        const svc = service({
            comptes: [compte('c-1', '62340000', 'CADEAUX_EXCEDENT')],
            mouvements: [{ compteId: 'c-1', debit: 500_000, credit: 0 }],
            chiffreAffaires: 100_000_000,
            chargesComptables: 150_000_000,
        });
        const { propositions } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions[0]).toMatchObject({ montantAdmis: 200_000, montant: 300_000 });
    });
});
describe('propositions sans assiette · le module s’abstient et le dit', () => {
    it('un compte de DOTATIONS AUX AMORTISSEMENTS ne propose aucun montant', async () => {
        const svc = service({
            comptes: [compte('c-1', '68130000', 'AMORTISSEMENTS_EXCEDENT')],
            mouvements: [{ compteId: 'c-1', debit: 25_000_000, credit: 0 }],
            chiffreAffaires: 200_000_000,
        });
        const { propositions, avertissements } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions).toEqual([]);
        expect(avertissements).toHaveLength(1);
        expect(avertissements[0]).toMatchObject({ numero: '68130000', code: 'AMORTISSEMENTS_EXCEDENT', mouvement: 25_000_000 });
        expect(avertissements[0].motif).toContain('EXCÉDENT');
        expect(avertissements[0].source).toContain('art. 28');
    });
    it('le supplément d’annuité des immobilisations réévaluées non plus · art. 133', async () => {
        const svc = service({
            comptes: [compte('c-1', '68131000', 'REEVALUATION_SUPPLEMENT_ANNUITE')],
            mouvements: [{ compteId: 'c-1', debit: 8_000_000, credit: 0 }],
            chiffreAffaires: 200_000_000,
        });
        const { propositions, avertissements } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions).toEqual([]);
        expect(avertissements[0].source).toContain('art. 133');
    });
    it('un compte SANS assiette hors portée continue de proposer tout son mouvement', async () => {
        const svc = service({
            comptes: [compte('c-1', '64710000', 'AMENDES_PENALITES')],
            mouvements: [{ compteId: 'c-1', debit: 500_000, credit: 0 }],
        });
        const { propositions, avertissements } = await svc.propositionsRetraitements('t-1', 'ex-1');
        expect(propositions[0]).toMatchObject({ montant: 500_000 });
        expect(avertissements).toEqual([]);
    });
});
//# sourceMappingURL=propositions-retraitements.spec.js.map