"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const ecriture_service_1 = require("./ecriture.service");
function service(prisma, exerciceService = {}) {
    return new ecriture_service_1.EcritureService(prisma, { trouver: jest.fn().mockResolvedValue({ id: 'j1', code: 'ACH', estActif: true }) }, exerciceService, { verifierVentilationObligatoire: jest.fn().mockResolvedValue(undefined) });
}
const MODELES_DETENTEURS = [
    'immobilisation', 'dotationAmortissement', 'depreciationImmobilisation', 'reclassementImmobilisation', 'reevaluation', 'regularisation',
    'echeanceAbonnement', 'liquidationTva', 'donation', 'affectationResultat', 'executionEngagement',
    'mouvementStock', 'bulletinPaie', 'amortissementDerogatoire', 'ligneOrdreVirement', 'consignation',
    'ecartInventaire', 'clotureLocationAcquisition', 'repriseSubventionImmobilisation', 'reductionSubventionImmobilisation', 'revisionPlanAmortissement', 'coutEmpruntIncorpore', 'reevaluationBilan', 'repriseProvisionReevaluation', 'mouvementDemantelement', 'creanceDouteuse', 'ajustementCreanceDouteuse', 'mouvementCreanceDouteuse', 'recuperationTvaCreance', 'declarationDeviseANouveau', 'constatImpotResultat', 'virementFonds', 'paiementSalaires', 'annulationTraitementImmobilisation',
];
function detenteurs(tenus = {}) {
    return {
        ...Object.fromEntries(MODELES_DETENTEURS.map((m) => [m, { count: jest.fn().mockResolvedValue(tenus[m] ?? 0) }])),
        facture: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(tenus.facture && where.tenantId === 't1' && where.ecritureId === 'e1' ? { numeroSerie: 'FV-0007' } : null)),
        },
    };
}
const exerciceOuvert = { statut: 'OUVERT', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
function ecriture(surcharge = {}) {
    return {
        id: 'e1',
        numeroPiece: 12,
        statut: 'BROUILLARD',
        date: new Date('2026-05-10'),
        journalId: 'j1',
        exercice: exerciceOuvert,
        journal: { code: 'ACH' },
        lignes: [
            { id: 'l1', debit: 1000, credit: 0, lettre: null, rapprochementId: null },
            { id: 'l2', debit: 0, credit: 1000, lettre: null, rapprochementId: null },
        ],
        ...surcharge,
    };
}
describe('brouillard · ce qui se modifie et ce qui ne se modifie plus', () => {
    it('refuse de modifier une écriture validée, et nomme l’article 20', async () => {
        const prisma = { ecriture: { findFirst: jest.fn().mockResolvedValue(ecriture({ statut: 'VALIDEE' })) } };
        await expect(service(prisma).modifier('t1', 'e1', { libelle: 'x' })).rejects.toBeInstanceOf(common_1.ForbiddenException);
        await expect(service(prisma).modifier('t1', 'e1', { libelle: 'x' })).rejects.toThrow(/article 20/i);
    });
    it('refuse de modifier une écriture dont une ligne est lettrée', async () => {
        const prisma = {
            ecriture: {
                findFirst: jest.fn().mockResolvedValue(ecriture({ lignes: [{ id: 'l1', lettre: 'A', rapprochementId: null }] })),
            },
        };
        await expect(service(prisma).modifier('t1', 'e1', { libelle: 'x' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse de modifier une écriture dont une ligne est pointée', async () => {
        const prisma = {
            ecriture: {
                findFirst: jest.fn().mockResolvedValue(ecriture({ lignes: [{ id: 'l1', lettre: null, rapprochementId: 'r1' }] })),
            },
        };
        await expect(service(prisma).modifier('t1', 'e1', { libelle: 'x' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse de supprimer une écriture validée', async () => {
        const prisma = { ecriture: { findFirst: jest.fn().mockResolvedValue(ecriture({ statut: 'VALIDEE' })) } };
        await expect(service(prisma).supprimer('t1', 'e1')).rejects.toBeInstanceOf(common_1.ForbiddenException);
    });
    it('refuse une modification qui déséquilibrerait l’écriture', async () => {
        const prisma = {
            ecriture: { findFirst: jest.fn().mockResolvedValue(ecriture()) },
            exercice: { findFirst: jest.fn().mockResolvedValue(exerciceOuvert) },
            compte: { findMany: jest.fn().mockResolvedValue([{ id: 'c1', typeCompte: 'DETAIL' }]) },
            ...detenteurs(),
        };
        const exercices = { verifierEcritureAutorisee: jest.fn().mockResolvedValue(undefined) };
        await expect(service(prisma, exercices).modifier('t1', 'e1', {
            lignes: [
                { compteId: 'c1', debit: 900 },
                { compteId: 'c1', credit: 1000 },
            ],
        })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
});
describe('modifier · les mêmes contrôles et les mêmes champs que creer', () => {
    function monde(tenus = {}, ecritureEnPlace = ecriture()) {
        const update = jest.fn().mockResolvedValue({ id: 'e1' });
        const deleteMany = jest.fn().mockResolvedValue({});
        const tx = {
            ligneEcriture: { deleteMany },
            ecriture: { update, findFirst: jest.fn().mockResolvedValue({ exerciceId: 'ex1' }) },
            pieceJointeEcriture: { count: jest.fn().mockResolvedValue(0) },
            exercice: { findFirst: jest.fn().mockResolvedValue(exerciceOuvert) },
        };
        const tauxTva = { findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.tenantId === 't1' ? [] : [{ id: 'tva-voisin' }])) };
        const prisma = {
            ecriture: { findFirst: jest.fn().mockResolvedValue(ecritureEnPlace) },
            exercice: { findFirst: jest.fn().mockResolvedValue(exerciceOuvert) },
            compte: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 'c1', typeCompte: 'DETAIL' },
                    { id: 'c2', typeCompte: 'DETAIL' },
                ]),
            },
            tauxTva,
            devise: {
                findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.tenantId === 't1' ? [{ id: 'usd', code: 'USD' }] : [])),
            },
            sectionAnalytique: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 's1', planId: 'p1', code: 'PRJ', type: 'DETAIL', estActive: true, plan: { code: 'PROJETS' } },
                ]),
            },
            modeReglement: {
                findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.tenantId === 't1'
                    ? [
                        { id: 'chq', code: 'CHQ', estActif: true },
                        { id: 'dormant', code: 'ESP', estActif: false },
                    ].filter((m) => where.id.in.includes(m.id))
                    : [])),
            },
            ...detenteurs(tenus),
            $transaction: jest.fn().mockImplementation((f) => f(tx)),
        };
        const exercices = { verifierEcritureAutorisee: jest.fn().mockResolvedValue(undefined) };
        return { svc: service(prisma, exercices), update, deleteMany, tauxTva, tx };
    }
    const LIGNES = [
        {
            compteId: 'c1',
            debit: 655_000,
            deviseId: 'usd',
            montantDevise: 250,
            coursApplique: 2620,
            ventilations: [{ sectionId: 's1', debit: 655_000 }],
        },
        { compteId: 'c2', credit: 655_000 },
    ];
    it('recrée les lignes AVEC la devise, le cours et la ventilation', async () => {
        const { svc, update, deleteMany } = monde();
        await svc.modifier('t1', 'e1', { lignes: LIGNES });
        expect(deleteMany).toHaveBeenCalledWith({ where: { ecritureId: 'e1' } });
        const cree = update.mock.calls[0][0].data.lignes.create;
        expect(['ligne en devise', cree[0]]).toEqual([
            'ligne en devise',
            expect.objectContaining({
                deviseId: 'usd',
                montantDevise: 250,
                coursApplique: 2620,
                ventilations: { create: [{ sectionId: 's1', planId: 'p1', debit: 655_000, credit: 0 }] },
            }),
        ]);
    });
    it('la description des pièces jointes suit la date et le libellé, dans la transaction', async () => {
        const { svc, tx } = monde();
        tx.ecriture.findFirst
            .mockResolvedValueOnce({ exerciceId: 'ex1' })
            .mockResolvedValueOnce({
            statut: 'BROUILLARD', estANouveauProvisoire: false, numeroPiece: 3, date: new Date('2026-03-15'),
            libelle: 'Loyer de mars', journalId: 'j1', journal: { code: 'ACH' },
        });
        tx.pieceJointeEcriture.count.mockResolvedValue(1);
        Object.assign(tx.pieceJointeEcriture, {
            findMany: jest.fn().mockResolvedValueOnce([{ id: 'pj-1' }]).mockResolvedValue([]),
            update: jest.fn().mockResolvedValue({}),
        });
        await svc.modifier('t1', 'e1', { libelle: 'Loyer de mars' });
        expect(tx.pieceJointeEcriture.update).toHaveBeenCalledWith({
            where: { id: 'pj-1' },
            data: { ecritureDecrite: 'ACH n° 3 du 15/03/2026 · Loyer de mars' },
            select: { id: true, ecritureId: true, ecritureDecrite: true },
        });
    });
    it('recrée la ligne AVEC son mode de règlement (ligne sage-l2, fonction 1)', async () => {
        const { svc, update } = monde();
        await svc.modifier('t1', 'e1', {
            lignes: [
                { compteId: 'c1', debit: 100, modeReglementId: 'chq' },
                { compteId: 'c2', credit: 100 },
            ],
        });
        const cree = update.mock.calls[0][0].data.lignes.create;
        expect(cree[0]).toEqual(expect.objectContaining({ modeReglementId: 'chq' }));
        expect(cree[1]).not.toHaveProperty('modeReglementId');
    });
    it("refuse un mode de règlement d'un autre dossier, et un mode en sommeil (ligne sage-l2)", async () => {
        const { svc, update } = monde();
        await expect(svc.modifier('t1', 'e1', {
            lignes: [
                { compteId: 'c1', debit: 100, modeReglementId: 'voisin' },
                { compteId: 'c2', credit: 100 },
            ],
        })).rejects.toThrow(/modes de règlement sont introuvables/);
        await expect(svc.modifier('t1', 'e1', {
            lignes: [
                { compteId: 'c1', debit: 100, modeReglementId: 'dormant' },
                { compteId: 'c2', credit: 100 },
            ],
        })).rejects.toThrow(/ESP est en sommeil/);
        expect(update).not.toHaveBeenCalled();
    });
    it('garde un mode en sommeil que la pièce portait déjà, et refuse seulement celui qui est nouveau (M2)', async () => {
        const enPlace = ecriture({
            lignes: [
                { id: 'l1', debit: 100, credit: 0, lettre: null, rapprochementId: null, modeReglementId: 'dormant' },
                { id: 'l2', debit: 0, credit: 100, lettre: null, rapprochementId: null, modeReglementId: null },
            ],
        });
        const garde = monde({}, enPlace);
        await garde.svc.modifier('t1', 'e1', {
            lignes: [
                { compteId: 'c1', debit: 100, modeReglementId: 'dormant' },
                { compteId: 'c2', credit: 100 },
            ],
        });
        expect(garde.update.mock.calls[0][0].data.lignes.create[0]).toEqual(expect.objectContaining({ modeReglementId: 'dormant' }));
        const neuf = monde();
        await expect(neuf.svc.modifier('t1', 'e1', {
            lignes: [
                { compteId: 'c1', debit: 100, modeReglementId: 'dormant' },
                { compteId: 'c2', credit: 100 },
            ],
        })).rejects.toThrow(/ESP est en sommeil/);
        expect(neuf.update).not.toHaveBeenCalled();
    });
    it("refuse un taux de TVA d'un autre dossier, comme creer", async () => {
        const { svc, update, tauxTva } = monde();
        await expect(svc.modifier('t1', 'e1', {
            lignes: [
                { compteId: 'c1', debit: 100, tauxTvaId: 'tva-voisin' },
                { compteId: 'c2', credit: 100 },
            ],
        })).rejects.toThrow(/taux de TVA sont introuvables/);
        expect(tauxTva.findMany).toHaveBeenCalledWith({ where: { id: { in: ['tva-voisin'] }, tenantId: 't1' } });
        expect(update).not.toHaveBeenCalled();
    });
    it("refuse de modifier l'écriture d'une facture, et dit le chemin (audit final F65)", async () => {
        const { svc, update, deleteMany } = monde({ facture: 1 });
        await expect(svc.modifier('t1', 'e1', { lignes: LIGNES })).rejects.toThrow(/enregistre la facture FV-0007 · elle ne se modifie pas d'ici.*Supprimez-la au brouillard/);
        expect(deleteMany).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });
    it("une écriture sans facture se modifie", async () => {
        const { svc, update } = monde();
        await svc.modifier('t1', 'e1', { libelle: 'autre' });
        expect(update).toHaveBeenCalled();
    });
    it("refuse de modifier l'écriture qu'un module tient, et nomme le module", async () => {
        const { svc, update, deleteMany } = monde({ liquidationTva: 1 });
        await expect(svc.modifier('t1', 'e1', { libelle: 'x' })).rejects.toThrow(/liquidation de TVA · elle ne se modifie pas/);
        expect(deleteMany).not.toHaveBeenCalled();
        expect(update).not.toHaveBeenCalled();
    });
});
describe('validation', () => {
    it('refuse de valider une écriture déséquilibrée', async () => {
        const prisma = {
            ecriture: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'e1',
                        numeroPiece: 3,
                        statut: 'BROUILLARD',
                        exercice: { statut: 'OUVERT' },
                        journal: { code: 'ACH' },
                        lignes: [
                            { debit: 500, credit: 0 },
                            { debit: 0, credit: 400 },
                        ],
                    },
                ]),
            },
        };
        await expect(service(prisma).valider('t1', 'u1', ['e1'])).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse de valider sur un exercice clôturé', async () => {
        const prisma = {
            ecriture: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'e1',
                        numeroPiece: 3,
                        statut: 'BROUILLARD',
                        exercice: { statut: 'CLOTURE' },
                        journal: { code: 'ACH' },
                        lignes: [
                            { debit: 500, credit: 0 },
                            { debit: 0, credit: 500 },
                        ],
                    },
                ]),
            },
        };
        await expect(service(prisma).valider('t1', 'u1', ['e1'])).rejects.toBeInstanceOf(common_1.ForbiddenException);
    });
    it('valide ce qui peut l’être et compte ce qui l’était déjà', async () => {
        const updateMany = jest.fn().mockResolvedValue({ count: 1 });
        const prisma = {
            ecriture: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'e1',
                        statut: 'BROUILLARD',
                        numeroPiece: 1,
                        exercice: { statut: 'OUVERT' },
                        journal: { code: 'ACH' },
                        lignes: [
                            { debit: 100, credit: 0 },
                            { debit: 0, credit: 100 },
                        ],
                    },
                    {
                        id: 'e2',
                        statut: 'VALIDEE',
                        numeroPiece: 2,
                        exercice: { statut: 'OUVERT' },
                        journal: { code: 'ACH' },
                        lignes: [],
                    },
                ]),
                updateMany,
            },
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    doubleRegardValidation: false,
                    referentiel: 'SYCEBNL',
                }),
            },
        };
        const resultat = await service(prisma).valider('t1', 'u1', ['e1', 'e2']);
        expect(resultat).toEqual({
            validees: 1,
            dejaValidees: 1,
            refuseesSecondRegard: 0,
            sousDerogation: 0,
            motifRefus: null,
            ecarteesJournalDeSituation: 0,
        });
        expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: { in: ['e1'] }, tenantId: 't1' } }));
    });
});
describe('état du brouillard · retard de centralisation', () => {
    function prismaAvec(createdAt, referentiel = 'SYCEBNL', statutExercice = 'OUVERT') {
        return {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel }) },
            exercice: {
                findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'ex1' && where.tenantId === 't1' ? { statut: statutExercice } : null)),
            },
            ecriture: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'e1',
                        date: new Date('2026-05-10'),
                        createdAt,
                        numeroPiece: 4,
                        libelle: 'Achat fournitures',
                        reference: 'F-12',
                        journal: { code: 'ACH', intitule: 'Achats' },
                        lignes: [
                            { debit: 100, credit: 0, libelle: null, compte: { numero: '60410000', intitule: 'Achats' } },
                            { debit: 0, credit: 100, libelle: null, compte: { numero: '40110000', intitule: 'Fournisseurs' } },
                        ],
                    },
                ]),
            },
        };
    }
    it('signale une écriture en brouillard depuis plus de sept jours', async () => {
        const vieille = new Date(Date.now() - 9 * 86_400_000);
        const r = await service(prismaAvec(vieille)).brouillard('t1', { exerciceId: 'ex1' });
        expect(r.delaiCentralisationJours).toBe(7);
        expect(r.lignes[0].ancienneteJours).toBe(9);
        expect(r.lignes[0].retardCentralisation).toBe(true);
        expect(r.totaux.enRetard).toBe(1);
    });
    it('ne réclame pas le brouillard que personne ne peut valider (audit final F77)', async () => {
        const vieille = new Date(Date.now() - 90 * 86_400_000);
        const clos = prismaAvec(vieille, 'SYCEBNL', 'CLOTURE');
        const ecr = clos.ecriture.findMany;
        const [modele] = await ecr();
        ecr.mockResolvedValue([{ ...modele, estGenereeParCloture: true, estANouveauProvisoire: false }]);
        const r = await service(clos).brouillard('t1', { exerciceId: 'ex1' });
        expect(r.lignes[0]).toMatchObject({ invalidable: true, retardCentralisation: false });
        expect(r.totaux.enRetard).toBe(0);
        const ouvert = prismaAvec(vieille);
        const ecr2 = ouvert.ecriture.findMany;
        ecr2.mockResolvedValue([{ ...modele, estGenereeParCloture: true, estANouveauProvisoire: true }]);
        const r2 = await service(ouvert).brouillard('t1', { exerciceId: 'ex1' });
        expect(r2.lignes[0]).toMatchObject({ invalidable: true, retardCentralisation: false });
        const ecr3 = ouvert.ecriture.findMany;
        ecr3.mockResolvedValue([{ ...modele, estGenereeParCloture: true, estANouveauProvisoire: false }]);
        const r3 = await service(ouvert).brouillard('t1', { exerciceId: 'ex1' });
        expect(r3.lignes[0]).toMatchObject({ invalidable: false, retardCentralisation: true });
    });
    it('rend tout ce que la modification doit renvoyer · devise, cours et ventilation', async () => {
        const prisma = prismaAvec(new Date());
        (prisma.ecriture.findMany).mockResolvedValue([
            {
                id: 'e1',
                date: new Date('2026-05-10'),
                createdAt: new Date(),
                numeroPiece: 4,
                libelle: 'Achat',
                reference: null,
                journal: { code: 'ACH', intitule: 'Achats' },
                lignes: [
                    {
                        compteId: 'c1',
                        debit: 1000,
                        credit: 0,
                        libelle: null,
                        deviseId: 'usd',
                        montantDevise: 400,
                        coursApplique: 2.5,
                        ventilations: [{ sectionId: 's1', debit: 1000, credit: 0 }],
                        compte: { numero: '60410000', intitule: 'Achats' },
                    },
                ],
            },
        ]);
        const r = await service(prisma).brouillard('t1', { exerciceId: 'ex1' });
        const l = r.lignes[0].lignes[0];
        expect([l.compteId, l.deviseId, l.montantDevise, l.coursApplique]).toEqual(['c1', 'usd', 400, 2.5]);
        expect(l.ventilations).toEqual([{ sectionId: 's1', debit: 1000, credit: 0 }]);
        const appels = (prisma.ecriture.findMany).mock.calls.map((c) => c[0]);
        const requete = appels.find((a) => a.include);
        expect(requete.include.lignes.include.ventilations).toBeTruthy();
    });
    it('ne signale rien en deçà de sept jours', async () => {
        const recente = new Date(Date.now() - 2 * 86_400_000);
        const r = await service(prismaAvec(recente)).brouillard('t1', { exerciceId: 'ex1' });
        expect(r.lignes[0].retardCentralisation).toBe(false);
        expect(r.totaux.enRetard).toBe(0);
    });
    it('laisse un mois à un dossier SYSCOHADA, comme le veut l’article 19', async () => {
        const vieille = new Date(Date.now() - 9 * 86_400_000);
        const r = await service(prismaAvec(vieille, 'SYSCOHADA')).brouillard('t1', { exerciceId: 'ex1' });
        expect(r.delaiCentralisationJours).toBe(30);
        expect(r.lignes[0].retardCentralisation).toBe(false);
        expect(r.totaux.enRetard).toBe(0);
    });
    it('signale tout de même une écriture qui dépasse le mois en SYSCOHADA', async () => {
        const tresVieille = new Date(Date.now() - 40 * 86_400_000);
        const r = await service(prismaAvec(tresVieille, 'SYSCOHADA')).brouillard('t1', { exerciceId: 'ex1' });
        expect(r.lignes[0].retardCentralisation).toBe(true);
        expect(r.totaux.enRetard).toBe(1);
    });
    it('compte les écritures déséquilibrées du brouillard', async () => {
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYCEBNL' }) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ statut: 'OUVERT' }) },
            ecriture: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'e1',
                        date: new Date('2026-05-10'),
                        createdAt: new Date(),
                        numeroPiece: 4,
                        libelle: 'Bancale',
                        reference: null,
                        journal: { code: 'OD', intitule: 'Opérations diverses' },
                        lignes: [{ debit: 100, credit: 0, libelle: null, compte: { numero: '6', intitule: 'x' } }],
                    },
                ]),
            },
        };
        const r = await service(prisma).brouillard('t1', { exerciceId: 'ex1' });
        expect(r.lignes[0].equilibree).toBe(false);
        expect(r.totaux.desequilibrees).toBe(1);
    });
});
describe('état du brouillard · une tranche qui se dit, des totaux entiers (audit final F185)', () => {
    it('au-delà du plafond, la liste s’arrête, les totaux portent tout le brouillard, et tronque le dit', async () => {
        const n = ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE + 3;
        const ecritures = Array.from({ length: n }, (_, i) => ({
            id: `e-${String(i).padStart(6, '0')}`,
            date: new Date('2026-05-10'),
            createdAt: new Date(),
            numeroPiece: i + 1,
            libelle: 'Achat',
            reference: 'F',
            estGenereeParCloture: false,
            estANouveauProvisoire: false,
            journal: { code: 'ACH', intitule: 'Achats' },
            lignes: [
                { debit: 10, credit: 0, libelle: null, compte: { numero: '60410000', intitule: 'Achats' } },
                { debit: 0, credit: i === n - 1 ? 7 : 10, libelle: null, compte: { numero: '40110000', intitule: 'F' } },
            ],
        }));
        const findMany = jest.fn(async (args) => {
            let debut = 0;
            if (args.cursor)
                debut = ecritures.findIndex((e) => e.id === args.cursor.id) + (args.skip ?? 0);
            return ecritures.slice(debut, args.take === undefined ? undefined : debut + args.take);
        });
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYCEBNL' }) },
            exercice: { findFirst: jest.fn().mockResolvedValue({ statut: 'OUVERT' }) },
            ecriture: { findMany },
        };
        const r = await service(prisma).brouillard('t1', { exerciceId: 'ex1' });
        expect(r.lignes).toHaveLength(ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
        expect(r.tronque).toBe(true);
        expect(r.totaux.nombre).toBe(n);
        expect(r.totaux.debit).toBe(10 * n);
        expect(r.totaux.desequilibrees).toBe(1);
    });
});
//# sourceMappingURL=brouillard.spec.js.map