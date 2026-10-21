"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const reprise_subvention_1 = require("./reprise-subvention");
const reprise_subvention_service_1 = require("./reprise-subvention.service");
const subvention_rattachee_service_1 = require("./subvention-rattachee.service");
const subvention_rattachee_1 = require("./subvention-rattachee");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
describe('reprise prospective · décision D-12', () => {
    it('Application 3 · entrepôt de 100 000 000 sur vingt ans, six mois · 2 500 000', () => {
        const p = (0, reprise_subvention_1.proposerReprise)({
            subvention: 100_000_000,
            valeurOrigine: 100_000_000,
            amortissable: true,
            dotationExercice: 2_500_000,
            cumulRepris: 0,
            sorti: false,
            resteAAmortirOuverture: 100_000_000,
            exercicesRepris: 0,
        });
        expect(p.montant).toBe(2_500_000);
    });
    it('Application 3 · terrain de 20 000 000 sans clause · le dixième, sans prorata', () => {
        const p = (0, reprise_subvention_1.proposerReprise)({ subvention: 20_000_000, valeurOrigine: 20_000_000, amortissable: false, dotationExercice: null, cumulRepris: 0, sorti: false, exercicesRepris: 0 });
        expect(p.montant).toBe(2_000_000);
        expect((0, reprise_subvention_1.proposerReprise)({ subvention: 20_000_000, valeurOrigine: 20_000_000, amortissable: false, dotationExercice: null, cumulRepris: 2_000_000, sorti: false, exercicesRepris: 1 }).montant).toBe(2_000_000);
    });
    it('sans événement, la formule prospective rend exactement celle du § 3.2', () => {
        for (let k = 0; k < 5; k++) {
            const p = (0, reprise_subvention_1.proposerReprise)({
                subvention: 400_000,
                valeurOrigine: 1_000_000,
                amortissable: true,
                dotationExercice: 200_000,
                cumulRepris: 80_000 * k,
                sorti: false,
                resteAAmortirOuverture: 1_000_000 - 200_000 * k,
            });
            expect(p.montant).toBe(80_000);
        }
    });
    it('après un remboursement (§ 4.3.1), le solde réduit finit repris au terme du plan, sans rattrapage', () => {
        const annee3 = (0, reprise_subvention_1.proposerReprise)({
            subvention: 400_000,
            valeurOrigine: 1_000_000,
            amortissable: true,
            dotationExercice: 200_000,
            cumulRepris: 160_000,
            reductions: 100_000,
            sorti: false,
            resteAAmortirOuverture: 600_000,
        });
        expect(annee3.montant).toBe(46_666.67);
        const derniere = (0, reprise_subvention_1.proposerReprise)({
            subvention: 400_000,
            valeurOrigine: 1_000_000,
            amortissable: true,
            dotationExercice: 200_000,
            cumulRepris: 253_333.33,
            reductions: 100_000,
            sorti: false,
            resteAAmortirOuverture: 200_000,
        });
        expect(derniere.montant).toBe(46_666.67);
    });
    it('§ 3.2 · la dotation est globale · le dérogatoire net de l’exercice s’ajoute', () => {
        const p = (0, reprise_subvention_1.proposerReprise)({
            subvention: 500_000,
            valeurOrigine: 1_000_000,
            amortissable: true,
            dotationExercice: 200_000,
            derogatoireNetExercice: 100_000,
            cumulRepris: 0,
            sorti: false,
            resteAAmortirOuverture: 1_000_000,
        });
        expect(p.montant).toBe(150_000);
    });
    it('§ 4.5 · à la sortie, le solde non repris, réductions déduites', () => {
        const p = (0, reprise_subvention_1.proposerReprise)({ subvention: 400_000, valeurOrigine: 1_000_000, amortissable: true, dotationExercice: 0, cumulRepris: 160_000, reductions: 40_000, sorti: true });
        expect(p).toMatchObject({ montant: 200_000, nature: 'SORTIE' });
    });
});
describe('§ 4.6 · dépréciation d’un bien subventionné · décision D-11', () => {
    const base = {
        subvention: 12_000_000,
        valeurOrigine: 20_000_000,
        amortissable: true,
        dotationExercice: 0,
        cumulRepris: 0,
        sorti: false,
        resteAAmortirOuverture: 20_000_000,
    };
    it('deuxième méthode · dépréciation de 14 000 000, le 14 repris à hauteur, borné à 12 000 000', () => {
        expect((0, reprise_subvention_1.proposerReprise)({ ...base, depreciationExercice: 14_000_000, methodeDepreciation: 'VNC_ENTIERE' }).montant).toBe(12_000_000);
    });
    it('première méthode · le rythme de reprise n’est pas modifié', () => {
        expect((0, reprise_subvention_1.proposerReprise)({ ...base, depreciationExercice: 2_000_000, methodeDepreciation: 'VNC_MINOREE_DES_SUBVENTIONS' }).montant).toBe(0);
    });
    it('méthode non déclarée · rien d’ajouté, et c’est dit', () => {
        const p = (0, reprise_subvention_1.proposerReprise)({ ...base, depreciationExercice: 2_000_000, methodeDepreciation: null });
        expect(p.montant).toBe(0);
        expect(p.reserve).toBe(reprise_subvention_1.RESERVE_METHODE_DEPRECIATION_NON_DECLAREE);
    });
});
describe('règles du rattachement', () => {
    it('le compte de la subvention est un 14 de détail', () => {
        expect((0, subvention_rattachee_1.motifRefusCompteSubvention)('14170000', true)).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusCompteSubvention)('16200000', true)).toMatch(/compte 14/);
        expect((0, subvention_rattachee_1.motifRefusCompteSubvention)('141', false)).toMatch(/détail/);
    });
    it('§ 4.4 · ventilation au prorata des valeurs d’entrée, le dernier prend le reste au centime', () => {
        expect((0, subvention_rattachee_1.ventilerAuProrata)(100, [
            { id: 'a', valeurOrigine: 1 },
            { id: 'b', valeurOrigine: 1 },
            { id: 'c', valeurOrigine: 1 },
        ])).toEqual([
            { immobilisationId: 'a', montant: 33.33 },
            { immobilisationId: 'b', montant: 33.33 },
            { immobilisationId: 'c', montant: 33.34 },
        ]);
    });
    it('§ 4.4 · la subvention laissée sur la structure exige son motif écrit (décision D-13)', () => {
        expect((0, subvention_rattachee_1.motifRefusSansVentilation)({ principalAvecComposants: true, composantsRattaches: 0, motif: '' })).toMatch(/§ 4\.4/);
        expect((0, subvention_rattachee_1.motifRefusSansVentilation)({ principalAvecComposants: true, composantsRattaches: 0, motif: 'Montant non significatif' })).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusSansVentilation)({ principalAvecComposants: true, composantsRattaches: 2, motif: null })).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusSansVentilation)({ principalAvecComposants: false, composantsRattaches: 0, motif: null })).toBeNull();
    });
    it('remboursement · un numéro, deux sens au 4739 (décision D-14)', () => {
        expect((0, subvention_rattachee_1.motifRefusContrepartieReduction)('SYCEBNL', 'REMBOURSEMENT', '47390000')).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusContrepartieReduction)('SYSCOHADA', 'REMBOURSEMENT', '47390000')).toMatch(/fonds global d'allocation/);
        expect((0, subvention_rattachee_1.motifRefusContrepartieReduction)('SYSCOHADA', 'REMBOURSEMENT', '44900000')).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusContrepartieReduction)('SYSCOHADA', 'NON_VERSEE', '52110000')).toMatch(/classe 4/);
        expect((0, subvention_rattachee_1.contrepartieRemboursementProposee)('SYCEBNL')).toBe('47390000');
        expect((0, subvention_rattachee_1.contrepartieRemboursementProposee)('SYSCOHADA')).toBeNull();
    });
    it('les semis portent ce que les deux textes nomment', () => {
        const sy = new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => [c.numero, c.intitule]));
        const eb = new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c.intitule]));
        for (const plan of [sy, eb]) {
            expect(plan.has('65150000')).toBe(true);
            expect(plan.has('79900000')).toBe(true);
        }
        expect(eb.get('47390000')).toMatch(/reverser/);
        expect(sy.get('47390000')).toMatch(/fonds global/);
    });
    it('la réduction ne dépasse ni le rattachement ni le solde non repris du bien', () => {
        expect((0, subvention_rattachee_1.motifRefusReduction)({ montant: 50, resteRattachement: 100, soldeNonReprisBien: 60 })).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusReduction)({ montant: 70, resteRattachement: 100, soldeNonReprisBien: 60 })).toMatch(/excédent/);
        expect((0, subvention_rattachee_1.motifRefusReduction)({ montant: 0, resteRattachement: 100, soldeNonReprisBien: 60 })).toMatch(/positif/);
    });
    it('écritures · remboursement D 14 / C tiers ; non versée D 6515 / C créance et D 14 / C 799', () => {
        expect((0, subvention_rattachee_1.lignesReduction)({ nature: 'REMBOURSEMENT', montant: 10, compte14Id: 'c14', contrepartieId: 'c4739' })).toEqual([
            { compteId: 'c14', debit: 10, credit: 0 },
            { compteId: 'c4739', debit: 0, credit: 10 },
        ]);
        expect((0, subvention_rattachee_1.lignesReduction)({ nature: 'NON_VERSEE', montant: 10, compte14Id: 'c14', contrepartieId: 'c4494', compte6515Id: 'c6515', compte799Id: 'c799' })).toEqual([
            { compteId: 'c6515', debit: 10, credit: 0 },
            { compteId: 'c4494', debit: 0, credit: 10 },
            { compteId: 'c14', debit: 10, credit: 0 },
            { compteId: 'c799', debit: 0, credit: 10 },
        ]);
    });
});
describe('le service du rattachement', () => {
    function monter(o = {}) {
        const creees = [];
        const prisma = {
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    referentiel: client_1.Referentiel.SYCEBNL,
                    jeuEtatsFinanciersSycebnl: o.jeu ?? client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
                }),
            },
            compte: { findFirst: jest.fn().mockResolvedValue({ id: 'c1417', numero: o.numero14 ?? '14170000', typeCompte: 'DETAIL' }) },
            immobilisation: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'b1',
                        designation: 'Entrepôt',
                        valeurOrigine: o.valeurOrigine ?? 100_000_000,
                        statut: client_1.StatutImmobilisation.EN_SERVICE,
                        immobilisationPrincipaleId: null,
                        _count: { composants: o.composants ?? 0 },
                        subventions: [],
                        ecritureAcquisition: {
                            lignes: o.acquisitionParFonds
                                ? [{ credit: 100_000_000, compte: { numero: '14170000' } }]
                                : [{ credit: 100_000_000, compte: { numero: '48120000' } }],
                        },
                    },
                ]),
            },
            ligneEcriture: { aggregate: jest.fn().mockResolvedValue({ _sum: { credit: o.credits14 ?? 120_000_000 } }) },
            subventionImmobilisation: {
                aggregate: jest.fn().mockResolvedValue({ _sum: { montant: 20_000_000 } }),
                create: jest.fn(({ data }) => {
                    creees.push(data);
                    return Promise.resolve(data);
                }),
            },
            $transaction: jest.fn((f) => f(prisma)),
        };
        return { svc: new subvention_rattachee_service_1.SubventionRattacheeService(prisma, {}), creees, prisma };
    }
    const dto = { compteSubventionId: 'c1417', dateOctroi: '2026-05-10', reference: 'Convention UE', lignes: [{ immobilisationId: 'b1', montant: 100_000_000 }] };
    it('Application 3 · 100 000 000 rattachés à l’entrepôt, le terrain portant déjà 20 000 000', async () => {
        const { svc, creees } = monter();
        await svc.rattacher('t', 'u', dto);
        expect(creees).toEqual([expect.objectContaining({ immobilisationId: 'b1', compteSubventionId: 'c1417', montant: 100_000_000, reference: 'Convention UE' })]);
    });
    it('refus · plus que l’octroi passé au 14', async () => {
        await expect(monter({ credits14: 110_000_000 }).svc.rattacher('t', 'u', dto)).rejects.toThrow(/n'a été crédité que de/);
    });
    it('refus · au-delà de la valeur d’entrée du bien', async () => {
        await expect(monter({ valeurOrigine: 90_000_000 }).svc.rattacher('t', 'u', dto)).rejects.toThrow(/valeur d'entrée/);
    });
    it('refus · bien entré par un fonds, compte hors 14, projet de développement, composants sans motif', async () => {
        await expect(monter({ acquisitionParFonds: true }).svc.rattacher('t', 'u', dto)).rejects.toThrow(/seconde fois/);
        await expect(monter({ numero14: '16200000' }).svc.rattacher('t', 'u', dto)).rejects.toThrow(/compte 14/);
        await expect(monter({ jeu: client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT }).svc.rattacher('t', 'u', dto)).rejects.toThrow(/fonds du bailleur/);
        await expect(monter({ composants: 2 }).svc.rattacher('t', 'u', dto)).rejects.toThrow(/§ 4\.4/);
        const { svc, creees } = monter({ composants: 2 });
        await svc.rattacher('t', 'u', { ...dto, motifSansVentilation: 'Montant non significatif' });
        expect(creees[0]).toMatchObject({ motifSansVentilation: 'Montant non significatif' });
    });
});
describe('les réductions · § 4.3.1 et § 4.7', () => {
    function monter(o = {}) {
        const creer = jest.fn().mockResolvedValue({ id: 'ec' });
        const retirer = jest.fn();
        const prisma = {
            subventionImmobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 's1',
                    montant: 400_000,
                    compteSubventionId: 'c14',
                    reductions: [],
                    immobilisation: {
                        id: 'b1',
                        designation: 'Véhicule',
                        reprisesSubvention: [{ montant: o.reprises ?? 160_000 }],
                        subventions: [{ montant: 400_000, reductions: [] }],
                    },
                }),
            },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: o.referentiel ?? client_1.Referentiel.SYSCOHADA }) },
            compte: {
                findFirst: jest.fn().mockResolvedValue({ id: 'cp', numero: o.numero ?? '44940000', typeCompte: 'DETAIL' }),
                findUnique: jest.fn(({ where }) => Promise.resolve({ id: `n${where.tenantId_numero.numero}` })),
            },
            reductionSubventionImmobilisation: { create: jest.fn(({ data }) => Promise.resolve(data)) },
        };
        return { svc: new subvention_rattachee_service_1.SubventionRattacheeService(prisma, { creer, retirerCompensation: retirer }), creer, prisma };
    }
    const corps = { nature: 'NON_VERSEE', exerciceId: 'e', journalId: 'j', date: '2026-09-30', montant: 100_000, compteContrepartieId: 'cp', motif: 'Concédant défaillant' };
    it('non versée · D 6515 / C créance, D 14 / C 799, dans une même pièce', async () => {
        const { svc, creer, prisma } = monter();
        await svc.reduire('t', 'u', 's1', corps);
        expect(creer.mock.calls[0][2].lignes).toEqual([
            { compteId: 'n65150000', debit: 100_000, credit: 0 },
            { compteId: 'cp', debit: 0, credit: 100_000 },
            { compteId: 'c14', debit: 100_000, credit: 0 },
            { compteId: 'n79900000', debit: 0, credit: 100_000 },
        ]);
        expect(prisma.reductionSubventionImmobilisation.create.mock.calls[0][0].data).toMatchObject({ nature: 'NON_VERSEE', montant: 100_000, ecritureId: 'ec' });
    });
    it('remboursement au SYSCOHADA · le 4739 refusé, un numéro deux sens', async () => {
        await expect(monter({ numero: '47390000' }).svc.reduire('t', 'u', 's1', { ...corps, nature: 'REMBOURSEMENT' })).rejects.toThrow(/fonds global/);
    });
    it('au-delà du solde non repris · refusé avant toute écriture', async () => {
        const { svc, creer } = monter({ reprises: 350_000 });
        await expect(svc.reduire('t', 'u', 's1', corps)).rejects.toThrow(/excédent/);
        expect(creer).not.toHaveBeenCalled();
    });
});
describe('la reprise lit la subvention rattachée', () => {
    const E = { id: 'e26', dateDebut: new Date('2026-01-01T00:00:00Z'), dateFin: new Date('2026-12-31T00:00:00Z') };
    const E25 = { dateDebut: new Date('2025-01-01T00:00:00Z') };
    function monter(o = {}) {
        const creer = jest.fn().mockResolvedValue({ id: 'ec' });
        const prisma = {
            immobilisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'b1',
                    designation: 'Véhicule',
                    valeurOrigine: 1_000_000,
                    statut: client_1.StatutImmobilisation.EN_SERVICE,
                    dateSortie: null,
                    ecritureAcquisitionId: 'acq',
                    amortissementAnterieur: 0,
                    degressifFiscal: o.degressif ?? false,
                    compteImmobilisation: { numero: '24510000' },
                    dotations: [
                        { montant: 200_000, exerciceId: 'e25', exercice: E25 },
                        { montant: 200_000, exerciceId: 'e26', exercice: E },
                    ],
                    depreciations: [],
                    derogatoires: o.derogatoire ? [{ nature: 'EXERCICE', dotation: 50_000, reprise: 0, exerciceId: 'e26', exercice: E }] : [],
                    reprisesSubvention: [{ exerciceId: 'e25', montant: 80_000, nature: 'EXERCICE' }],
                    subventions: [
                        {
                            compteSubventionId: 'c1417',
                            montant: 400_000,
                            dureeInalienabiliteAns: null,
                            compteSubvention: { numero: '14170000' },
                            reductions: o.reductions ? [{ montant: o.reductions, exercice: E }] : [],
                        },
                        ...(o.second
                            ? [{ compteSubventionId: 'c1411', montant: 200_000, dureeInalienabiliteAns: null, compteSubvention: { numero: '14110000' }, reductions: [] }]
                            : []),
                    ],
                }),
            },
            exercice: { findFirst: jest.fn().mockResolvedValue(E) },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA, methodeDepreciationBienSubventionne: null }) },
            ligneEcriture: { findMany: jest.fn().mockResolvedValue([{ compteId: 'c481', credit: 1_000_000, debit: 0, compte: { numero: '48120000' } }]) },
            compte: { findUnique: jest.fn().mockResolvedValue({ id: 'c799' }) },
            repriseSubventionImmobilisation: { create: jest.fn(({ data }) => Promise.resolve(data)) },
        };
        return { svc: new reprise_subvention_service_1.RepriseSubventionService(prisma, { creer, retirerCompensation: jest.fn() }), creer };
    }
    const corps = { exerciceId: 'e26', journalId: 'j' };
    it('D 14 du rattachement / C 799 · 80 000, le § 3.2 retrouvé', async () => {
        const { svc, creer } = monter();
        await svc.passer('t', 'u', 'b1', corps);
        expect(creer.mock.calls[0][2].lignes).toEqual([
            { compteId: 'c1417', debit: 80_000, credit: 0 },
            { compteId: 'c799', debit: 0, credit: 80_000 },
        ]);
    });
    it('après une réduction de 100 000 · le solde de 220 000 sur 800 000 restant à amortir', async () => {
        const { svc, creer } = monter({ reductions: 100_000 });
        await svc.passer('t', 'u', 'b1', corps);
        expect(creer.mock.calls[0][2].lignes.at(-1)).toEqual({ compteId: 'c799', debit: 0, credit: 55_000 });
    });
    it('deux 14 rattachés · le débit suit ce qui reste à chacun, réduction déduite', async () => {
        const { svc, creer } = monter({ second: true, reductions: 100_000 });
        await svc.passer('t', 'u', 'b1', corps);
        expect(creer.mock.calls[0][2].lignes).toEqual([
            { compteId: 'c1417', debit: 63_000, credit: 0 },
            { compteId: 'c1411', debit: 42_000, credit: 0 },
            { compteId: 'c799', debit: 0, credit: 105_000 },
        ]);
    });
    it('bien au dégressif · le dérogatoire de l’exercice se passe d’abord, puis entre dans la dotation globale', async () => {
        await expect(monter({ degressif: true }).svc.passer('t', 'u', 'b1', corps)).rejects.toThrow(/dérogatoire/);
        const { svc, creer } = monter({ degressif: true, derogatoire: true });
        await svc.passer('t', 'u', 'b1', corps);
        expect(creer.mock.calls[0][2].lignes.at(-1)).toEqual({ compteId: 'c799', debit: 0, credit: 100_000 });
    });
});
describe('l’octroi · le choix du 14 propose ce qui s’y trouve (fiche du compte 14)', () => {
    it('contrepartie · 4731 au SYCEBNL, la classe 4 hors 473 au SYSCOHADA', () => {
        expect((0, subvention_rattachee_1.motifRefusContrepartieOctroi)('SYCEBNL', '47310000')).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusContrepartieOctroi)('SYCEBNL', '44940000')).toMatch(/4731/);
        expect((0, subvention_rattachee_1.motifRefusContrepartieOctroi)('SYCEBNL', '52110000')).toMatch(/4731/);
        expect((0, subvention_rattachee_1.motifRefusContrepartieOctroi)('SYSCOHADA', '44940000')).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusContrepartieOctroi)('SYSCOHADA', '45820000')).toBeNull();
        expect((0, subvention_rattachee_1.motifRefusContrepartieOctroi)('SYSCOHADA', '52110000')).toMatch(/classe 4/);
        expect((0, subvention_rattachee_1.motifRefusContrepartieOctroi)('SYSCOHADA', '47310000')).toMatch(/intermédiaires/);
    });
    it('les comptes proposés sont ouverts au semis de leur référentiel, sous l’intitulé qui les justifie', () => {
        const intitule = (plan, numero) => {
            const ligne = plan.find((l) => Array.isArray(l) ? l[0] === numero : l.numero === numero);
            return ligne === undefined ? undefined : Array.isArray(ligne) ? String(ligne[1]) : ligne.intitule;
        };
        expect(subvention_rattachee_1.CONTREPARTIES_OCTROI_PROPOSEES.SYCEBNL).toEqual(['47310000']);
        expect(intitule(compte_seed_1.PLAN_COMPTES_SYCEBNL, '47310000')).toMatch(/subventions à recevoir.*investissement/i);
        expect(intitule(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA, '44940000')).toMatch(/subventions investissement à recevoir/i);
        expect(intitule(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA, '45820000')).toMatch(/subventions à recevoir/i);
    });
    function monter(o = {}) {
        const creer = jest.fn().mockResolvedValue({ id: 'ec' });
        const comptes = {
            c14: { id: 'c14', numero: o.numero14 ?? '14170000', typeCompte: 'DETAIL' },
            cp: { id: 'cp', numero: o.contrepartie ?? '47310000', typeCompte: 'DETAIL' },
        };
        const prisma = {
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    referentiel: o.referentiel ?? client_1.Referentiel.SYCEBNL,
                    jeuEtatsFinanciersSycebnl: o.jeu ?? client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
                }),
            },
            compte: {
                findFirst: jest.fn(({ where }) => Promise.resolve(comptes[where.id] ?? null)),
                findMany: jest.fn(({ where }) => Promise.resolve(where.numero.in.map((numero) => ({ id: `n${numero}`, numero, intitule: numero })))),
            },
            ligneEcriture: {
                findMany: jest.fn().mockResolvedValue([
                    { id: 'l1', credit: 120_000_000, libelle: '', ecriture: { id: 'e1', date: new Date('2026-02-01'), libelle: 'Notification UE', reference: 'Convention UE', numeroPiece: 'OD-1' } },
                ]),
                aggregate: jest.fn().mockResolvedValue({ _sum: { credit: 120_000_000 } }),
            },
            subventionImmobilisation: { aggregate: jest.fn().mockResolvedValue({ _sum: { montant: 20_000_000 } }) },
        };
        return { svc: new subvention_rattachee_service_1.SubventionRattacheeService(prisma, { creer }), creer, prisma };
    }
    it('lire les octrois · la ligne créditée, le reste à rattacher, la contrepartie du référentiel', async () => {
        const { svc, prisma } = monter();
        const r = await svc.octrois('t', 'c14');
        expect(r.octrois).toEqual([expect.objectContaining({ ligneId: 'l1', montant: 120_000_000, reference: 'Convention UE', libelle: 'Notification UE' })]);
        expect(r.resteARattacher).toBe(100_000_000);
        expect(r.contrepartiesProposees.map((c) => c.numero)).toEqual(['47310000']);
        expect(r.autresTiersAdmis).toBe(false);
        expect(prisma.ligneEcriture.findMany.mock.calls[0][0].where).toMatchObject({ compteId: 'c14', credit: { gt: 0 }, ecriture: { tenantId: 't', estGenereeParCloture: false } });
        const s = await monter({ referentiel: client_1.Referentiel.SYSCOHADA }).svc.octrois('t', 'c14');
        expect(s.contrepartiesProposees.map((c) => c.numero)).toEqual(['44940000', '45820000']);
        expect(s.autresTiersAdmis).toBe(true);
    });
    it('lire les octrois d’un compte hors 14 · refusé', async () => {
        await expect(monter({ numero14: '16200000' }).svc.octrois('t', 'c14')).rejects.toThrow(/compte 14/);
    });
    const corps = { compteSubventionId: 'c14', compteContrepartieId: 'cp', exerciceId: 'e', journalId: 'j', date: '2026-02-01', montant: 120_000_000, reference: 'Convention UE' };
    it('enregistrer l’octroi · D 4731 / C 14, au brouillard, référence portée', async () => {
        const { svc, creer } = monter();
        await svc.enregistrerOctroi('t', 'u', corps);
        expect(creer.mock.calls[0][2]).toMatchObject({
            date: '2026-02-01',
            reference: 'Convention UE',
            lignes: [
                { compteId: 'cp', debit: 120_000_000, credit: 0 },
                { compteId: 'c14', debit: 0, credit: 120_000_000 },
            ],
        });
    });
    it('refus avant toute écriture · contrepartie hors texte, compte hors 14, projet de développement', async () => {
        for (const m of [
            monter({ contrepartie: '52110000' }),
            monter({ numero14: '16200000' }),
            monter({ referentiel: client_1.Referentiel.SYSCOHADA, contrepartie: '47310000' }),
            monter({ jeu: client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT }),
        ]) {
            await expect(m.svc.enregistrerOctroi('t', 'u', corps)).rejects.toThrow();
            expect(m.creer).not.toHaveBeenCalled();
        }
    });
});
describe('liste des rattachements · le compte de remboursement que le texte nomme', () => {
    function monter(referentiel, ouvert) {
        const findFirst = jest.fn().mockResolvedValue(ouvert ? { id: 'c4739', numero: '47390000', intitule: 'Subventions à reverser' } : null);
        const prisma = {
            subventionImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel, methodeDepreciationBienSubventionne: null }) },
            compte: { findFirst },
        };
        return { svc: new subvention_rattachee_service_1.SubventionRattacheeService(prisma, {}), findFirst };
    }
    it('SYCEBNL · le 4739 est lu dans TOUT le plan, retenu ou non, pour rester dans la liste de choix', async () => {
        const { svc, findFirst } = monter('SYCEBNL', true);
        const r = await svc.lister('t1');
        expect(r.compteRemboursementPropose).toEqual({ id: 'c4739', numero: '47390000', intitule: 'Subventions à reverser' });
        const where = findFirst.mock.calls[0][0].where;
        expect(where).toEqual({ tenantId: 't1', numero: '47390000', typeCompte: 'DETAIL', estActif: true });
        expect(where).not.toHaveProperty('estRetenu');
    });
    it('absent du plan, il est nul et le numéro reste dit ; au SYSCOHADA rien n’est proposé ni lu', async () => {
        const absent = monter('SYCEBNL', false);
        const r = await absent.svc.lister('t1');
        expect(r.compteRemboursementPropose).toBeNull();
        expect(r.contrepartieRemboursementProposee).toBe('47390000');
        const sy = monter('SYSCOHADA', true);
        expect((await sy.svc.lister('t1')).compteRemboursementPropose).toBeNull();
        expect(sy.findFirst).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=subvention-rattachee.spec.js.map