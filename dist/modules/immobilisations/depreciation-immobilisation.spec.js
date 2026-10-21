"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const comptes_du_bien_1 = require("./comptes-du-bien");
function harnais(b, options = {}) {
    const exercice = b.exercice ?? { dateDebut: '2026-01-01', dateFin: '2026-12-31' };
    const ecrituresPostees = [];
    const creations = [];
    const immo = {
        id: 'i1',
        designation: 'Matériel industriel',
        statut: 'EN_SERVICE',
        valeurOrigine: b.valeurOrigine,
        valeurResiduelle: b.valeurResiduelle ?? 0,
        dureeAmortissementAns: b.dureeAns,
        dateMiseEnService: new Date(b.dateMiseEnService),
        amortissementAnterieur: b.amortissementAnterieur ?? 0,
        compteImmobilisationId: 'cimmo',
        compteImmobilisation: {
            id: 'cimmo',
            numero: options.compteImmobilisation ?? '24110000',
            intitule: 'Matériel industriel',
        },
        compteDotationId: 'cd',
        compteAmortissementId: 'ca',
        dotations: (b.dotations ?? []).map((m, i) => ({
            montant: m,
            exerciceId: new Date(b.dateMiseEnService).getUTCFullYear() + i === new Date(exercice.dateFin).getUTCFullYear()
                ? 'exN'
                : `exAnt${i}`,
            exercice: { dateFin: new Date(`${new Date(b.dateMiseEnService).getUTCFullYear() + i}-12-31`) },
        })),
        depreciations: (b.depreciations ?? []).map((d) => ({
            sens: d.sens,
            montant: d.montant,
            compteDepreciationId: 'c29',
            compteContrepartieId: d.contrepartie ?? 'c69',
            exercice: { dateFin: new Date(d.dateFin) },
        })),
    };
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: options.referentiel ?? client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: (options.referentiel ?? client_1.Referentiel.SYSCOHADA) === client_1.Referentiel.SYSCOHADA
                    ? options.smt
                        ? client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE
                        : client_1.SystemeComptableSyscohada.NORMAL
                    : null,
                jeuEtatsFinanciersSycebnl: options.referentiel === client_1.Referentiel.SYCEBNL
                    ? options.smt
                        ? 'SYSTEME_MINIMAL_TRESORERIE'
                        : options.projets
                            ? 'PROJETS_DEVELOPPEMENT'
                            : 'ASSOCIATIONS_ORDRES_PROFESSIONNELS'
                    : null,
            }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue(immo),
            findMany: jest.fn().mockResolvedValue([]),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
            update: jest.fn().mockResolvedValue({ ...immo, dotations: immo.dotations }),
        },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'exN',
                dateDebut: new Date(exercice.dateDebut),
                dateFin: new Date(exercice.dateFin),
            }),
            findMany: jest.fn().mockImplementation(({ where }) => {
                const premiere = new Date(b.dateMiseEnService).getUTCFullYear();
                const derniere = new Date(exercice.dateFin).getUTCFullYear();
                return Promise.resolve(Array.from({ length: derniere - premiere + 1 }, (_, i) => premiere + i)
                    .map((a) => ({
                    id: a === derniere ? 'exN' : `ex${a}`,
                    dateDebut: new Date(`${a}-01-01`),
                    dateFin: new Date(`${a}-12-31`),
                }))
                    .filter((e) => e.dateFin <= where.dateFin.lte));
            }),
        },
        compte: {
            findUnique: jest
                .fn()
                .mockImplementation(({ where }) => Promise.resolve({
                id: `n${where.tenantId_numero.numero}`,
                numero: where.tenantId_numero.numero,
                intitule: where.tenantId_numero.numero,
            })),
            findFirst: jest.fn().mockImplementation(({ where, select }) => Promise.resolve(where.id === 'c164dort'
                ? { id: 'c164dort', numero: '16400000', intitule: 'Fonds affectés · autres organismes', ...(select?.estActif ? { estActif: false } : {}) }
                : where.id === 'c29'
                    ? { id: 'c29', numero: options.compte29 ?? '29410000', intitule: 'Dépréciations du matériel' }
                    : where.id === 'c69'
                        ? { id: 'c69', numero: '69130000', intitule: 'Dotations pour dépréciation' }
                        : where.id === 'c79'
                            ? { id: 'c79', numero: '79140000', intitule: 'Reprises de dépréciations des immobilisations corporelles' }
                            : where.id === 'c681'
                                ? { id: 'c681', numero: '68130000', intitule: 'Dotations aux amortissements' }
                                : where.id === 'c853'
                                    ? { id: 'c853', numero: '85300000', intitule: 'Dotations H.A.O. aux dépréciations' }
                                    : where.id === 'c162'
                                        ? { id: 'c162', numero: '16200000', intitule: 'Fonds affectés aux investissements · bailleurs' }
                                        : where.id === 'c165'
                                            ? { id: 'c165', numero: '16500000', intitule: 'Fonds non consommés' }
                                            : { id: where.id, numero: '81200000', intitule: 'Valeur comptable des cessions' })),
        },
        dotationAmortissement: {
            findUnique: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockResolvedValue({ id: 'd1' }),
        },
        ligneReevaluationBilan: { findFirst: jest.fn().mockResolvedValue(null), findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: {
            create: jest.fn().mockImplementation(({ data }) => {
                creations.push(data);
                return Promise.resolve({ id: 'dep1', ...data });
            }),
        },
    };
    prisma.$transaction = jest.fn((f) => f(prisma));
    prisma.$queryRaw = jest.fn().mockResolvedValue([]);
    const ecritures = {
        creer: jest
            .fn()
            .mockImplementation((_t, _u, dto) => {
            ecrituresPostees.push({ libelle: dto.libelle, lignes: dto.lignes });
            return Promise.resolve({ id: `e${ecrituresPostees.length}` });
        }),
    };
    return {
        svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures),
        ecrituresPostees,
        creations,
    };
}
const DEPRECIATION = {
    exerciceId: 'exN',
    journalId: 'j1',
    sens: client_1.SensDepreciation.DOTATION,
    montant: 1_600_000,
    compteDepreciationId: 'c29',
    compteContrepartieId: 'c69',
    indice: 'Baisse du prix du marché du matériel neuf, de 10 000 000 à 6 000 000',
};
describe('la base amortissable se ré-étale après la perte de valeur', () => {
    const materiel = {
        valeurOrigine: 10_000_000,
        dureeAns: 5,
        dateMiseEnService: '2023-01-15',
        dotations: [2_000_000, 2_000_000, 2_000_000],
        exercice: { dateDebut: '2026-01-01', dateFin: '2026-12-31' },
    };
    it('1 200 000 par an sur les deux années restantes, et non 2 000 000', async () => {
        const { svc, ecrituresPostees } = harnais({
            ...materiel,
            depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 1_600_000, dateFin: '2025-12-31' }],
        });
        await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' });
        expect(ecrituresPostees[0].lignes[0].debit).toBe(1_200_000);
    });
    it('sans dépréciation, l’annuité ne bouge pas · le plan ne se ré-étale que là', async () => {
        const { svc, ecrituresPostees } = harnais(materiel);
        await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' });
        expect(ecrituresPostees[0].lignes[0].debit).toBe(2_000_000);
    });
    it('la dernière annuité absorbe exactement ce qui reste', async () => {
        const { svc, ecrituresPostees } = harnais({
            ...materiel,
            dotations: [2_000_000, 2_000_000, 2_000_000, 2_000_000],
            depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 1_600_000, dateFin: '2025-12-31' }],
            exercice: { dateDebut: '2027-01-01', dateFin: '2027-12-31' },
        });
        await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' });
        expect(ecrituresPostees[0].lignes[0].debit).toBe(400_000);
    });
});
describe('l’écriture de dépréciation, dans le sens que la fiche du COMPTE 29 écrit', () => {
    const bien = { valeurOrigine: 10_000_000, dureeAns: 5, dateMiseEnService: '2023-01-15', dotations: [6_000_000] };
    it('la dotation CRÉDITE le 29 par le débit du 69', async () => {
        const { svc, ecrituresPostees, creations } = harnais(bien);
        await svc.enregistrerDepreciation('t1', 'u1', 'i1', DEPRECIATION);
        expect(ecrituresPostees[0].lignes).toEqual([
            { compteId: 'c69', debit: 1_600_000, credit: 0 },
            { compteId: 'c29', debit: 0, credit: 1_600_000 },
        ]);
        expect(creations[0].indice).toContain('Baisse du prix du marché');
    });
    it('la reprise DÉBITE le 29 par le crédit du 79', async () => {
        const { svc, ecrituresPostees } = harnais({
            ...bien,
            depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 1_600_000, dateFin: '2025-12-31' }],
        });
        await svc.enregistrerDepreciation('t1', 'u1', 'i1', {
            ...DEPRECIATION,
            sens: client_1.SensDepreciation.REPRISE,
            montant: 600_000,
            compteContrepartieId: 'c79',
        });
        expect(ecrituresPostees[0].lignes).toEqual([
            { compteId: 'c29', debit: 600_000, credit: 0 },
            { compteId: 'c79', debit: 0, credit: 600_000 },
        ]);
    });
    it('refuse une reprise supérieure à la dépréciation encore inscrite', async () => {
        const { svc } = harnais({
            ...bien,
            depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 1_600_000, dateFin: '2025-12-31' }],
        });
        await expect(svc.enregistrerDepreciation('t1', 'u1', 'i1', {
            ...DEPRECIATION,
            sens: client_1.SensDepreciation.REPRISE,
            montant: 2_000_000,
            compteContrepartieId: 'c79',
        })).rejects.toThrow(/reprise ne peut pas dépasser/i);
    });
    it('refuse une dépréciation qui ferait descendre la valeur nette sous zéro', async () => {
        const { svc } = harnais(bien);
        await expect(svc.enregistrerDepreciation('t1', 'u1', 'i1', { ...DEPRECIATION, montant: 5_000_000 })).rejects.toThrow(/valeur comptable nette/i);
    });
    it('refuse un compte qui n’est pas un 29 · le 39, le 49 et le 59 sont exclus', async () => {
        for (const numero of ['39310000', '49100000', '59100000', '68110000']) {
            const { svc } = harnais(bien, { compte29: numero });
            await expect(svc.enregistrerDepreciation('t1', 'u1', 'i1', DEPRECIATION)).rejects.toThrow(/compte 29/i);
        }
    });
});
describe('la sortie solde le compte 29 par une REPRISE, sans toucher au compte 81', () => {
    const sortie = {
        dateSortie: '2026-06-30',
        type: 'MISE_HORS_SERVICE',
        exerciceId: 'exN',
        journalId: 'j1',
    };
    const BIEN_DEPRECIE = {
        valeurOrigine: 10_000_000,
        dureeAns: 5,
        dateMiseEnService: '2023-01-15',
        dotations: [2_000_000, 2_000_000, 2_000_000],
        depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 1_600_000, dateFin: '2025-12-31' }],
    };
    async function lignesDeSortie(bien, options = {}) {
        const { svc, ecrituresPostees } = harnais(bien, options);
        await svc.sortir('t1', 'u1', 'i1', sortie);
        return ecrituresPostees.find((e) => e.libelle.startsWith('Mise hors service')).lignes;
    }
    it('porte au 81 la valeur d’entrée diminuée des SEULS amortissements', async () => {
        const lignes = await lignesDeSortie(BIEN_DEPRECIE);
        expect(lignes.find((l) => l.compteId === 'n81200000')).toEqual({
            compteId: 'n81200000',
            debit: 3_400_000,
            credit: 0,
        });
    });
    it('débite le 29 pour solde ET crédite sa reprise · jamais l’un sans l’autre', async () => {
        const lignes = await lignesDeSortie(BIEN_DEPRECIE);
        expect(lignes.find((l) => l.compteId === 'c29')).toEqual({ compteId: 'c29', debit: 1_600_000, credit: 0 });
        expect(lignes.find((l) => l.compteId === 'n79140000')).toEqual({
            compteId: 'n79140000',
            debit: 0,
            credit: 1_600_000,
        });
    });
    it('l’écriture reste équilibrée · c’est pourquoi le défaut ne se voyait pas', async () => {
        const lignes = await lignesDeSortie(BIEN_DEPRECIE);
        const total = (cle) => lignes.reduce((t, l) => t + (l[cle] ?? 0), 0);
        expect(total('debit')).toBe(total('credit'));
        expect(total('debit')).toBe(11_600_000);
    });
    it('un bien jamais déprécié sort exactement comme avant', async () => {
        const lignes = await lignesDeSortie({
            valeurOrigine: 10_000_000,
            dureeAns: 5,
            dateMiseEnService: '2023-01-15',
            dotations: [2_000_000, 2_000_000, 2_000_000],
        });
        expect(lignes.some((l) => l.compteId === 'c29')).toBe(false);
        expect(lignes.some((l) => l.compteId.startsWith('n79'))).toBe(false);
        expect(lignes.find((l) => l.compteId === 'n81200000').debit).toBe(3_000_000);
    });
    it('une dépréciation dotée en H.A.O. se reprend en 863, pas en 79', async () => {
        const lignes = await lignesDeSortie({
            ...BIEN_DEPRECIE,
            depreciations: [
                { sens: client_1.SensDepreciation.DOTATION, montant: 1_600_000, dateFin: '2025-12-31', contrepartie: 'c853' },
            ],
        });
        expect(lignes.find((l) => l.compteId === 'n86300000')).toEqual({
            compteId: 'n86300000',
            debit: 0,
            credit: 1_600_000,
        });
        expect(lignes.some((l) => l.compteId === 'n79140000')).toBe(false);
    });
    it('au SYCEBNL, un bien légué destiné à la vente sort en 818 et se reprend en 7952', async () => {
        const lignes = await lignesDeSortie({ ...BIEN_DEPRECIE, dotations: [] }, {
            compteImmobilisation: '20300000',
            referentiel: client_1.Referentiel.SYCEBNL,
        });
        expect(lignes.find((l) => l.compteId === 'n81800000').debit).toBe(10_000_000);
        expect(lignes.find((l) => l.compteId === 'n79520000').credit).toBe(1_600_000);
    });
});
describe('le Système minimal de trésorerie n’a pas de poste de dépréciation', () => {
    const bien = { valeurOrigine: 10_000_000, dureeAns: 5, dateMiseEnService: '2023-01-15', dotations: [6_000_000] };
    it.each([client_1.Referentiel.SYSCOHADA, client_1.Referentiel.SYCEBNL])('%s · la dotation est refusée, rien n’est posté', async (referentiel) => {
        const { svc, ecrituresPostees } = harnais(bien, { referentiel, smt: true });
        await expect(svc.enregistrerDepreciation('t1', 'u1', 'i1', DEPRECIATION)).rejects.toThrow(referentiel === client_1.Referentiel.SYCEBNL ? /Partie 4 ch\. 4/ : /Titre X ch\. 2/);
        expect(ecrituresPostees).toHaveLength(0);
    });
    it('la reprise d’une dépréciation antérieure au passage au SMT reste ouverte', async () => {
        const { svc, ecrituresPostees } = harnais({ ...bien, depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 1_600_000, dateFin: '2025-12-31' }] }, { smt: true });
        await svc.enregistrerDepreciation('t1', 'u1', 'i1', {
            ...DEPRECIATION,
            sens: client_1.SensDepreciation.REPRISE,
            montant: 500_000,
            compteContrepartieId: 'c79',
        });
        expect(ecrituresPostees).toHaveLength(1);
    });
});
describe('les comptes du bien · passe R1 (A1, A4, A5) et R5 (B1)', () => {
    const bien = { valeurOrigine: 10_000_000, dureeAns: 5, dateMiseEnService: '2023-01-15', dotations: [6_000_000] };
    it('SYSCOHADA · le 29 suit la division du bien (Titre VII ch. 2)', async () => {
        const { svc, ecrituresPostees } = harnais(bien, { compte29: '29310000' });
        await expect(svc.enregistrerDepreciation('t1', 'u1', 'i1', DEPRECIATION)).rejects.toThrow(/attendu un 294/);
        expect(ecrituresPostees).toHaveLength(0);
    });
    it('SYSCOHADA · la contrepartie est celle que la fiche du compte 29 nomme', async () => {
        const { svc, ecrituresPostees } = harnais(bien);
        await expect(svc.enregistrerDepreciation('t1', 'u1', 'i1', { ...DEPRECIATION, compteContrepartieId: 'c681' })).rejects.toThrow(/nomme 691, 697, 853/);
        expect(ecrituresPostees).toHaveLength(0);
        const h = harnais(bien);
        await h.svc.enregistrerDepreciation('t1', 'u1', 'i1', { ...DEPRECIATION, compteContrepartieId: 'c853' });
        expect(h.ecrituresPostees).toHaveLength(1);
    });
    it('SYCEBNL · un bien reçu en don destiné à la vente ne se dote pas, il se déprécie', async () => {
        const { svc, ecrituresPostees } = harnais(bien, {
            compteImmobilisation: '20300000',
            referentiel: client_1.Referentiel.SYCEBNL,
            compte29: '29020000',
        });
        await expect(svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' })).rejects.toThrow(/ne doivent pas être amortis/);
        expect(ecrituresPostees).toHaveLength(0);
    });
    it('SYSCOHADA · un terrain nu ne se dote pas', async () => {
        const { svc, ecrituresPostees } = harnais(bien, { compteImmobilisation: '22210000', compte29: '29220000' });
        await expect(svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' })).rejects.toThrow(/2824 travaux de mise en valeur/);
        expect(ecrituresPostees).toHaveLength(0);
    });
});
describe('usufruit temporaire (2011) · rétrocession sans 818, reprise au 7951', () => {
    const USUFRUIT = { compteImmobilisation: '20110000', referentiel: client_1.Referentiel.SYCEBNL, compte29: '29010000' };
    const AU_TERME = {
        valeurOrigine: 5_000_000,
        dureeAns: 5,
        dateMiseEnService: '2022-01-01',
        dotations: [1_000_000, 1_000_000, 1_000_000, 1_000_000],
    };
    const retrocession = (date, type = 'MISE_HORS_SERVICE') => ({
        dateSortie: date,
        type,
        exerciceId: 'exN',
        journalId: 'j1',
        ...(type === 'CESSION' ? { prixCession: 1, compteContrepartieId: 'c52' } : {}),
    });
    it('au terme, la sortie solde le 280 contre le 2011, sans aucun compte 81', async () => {
        const { svc, ecrituresPostees } = harnais(AU_TERME, USUFRUIT);
        await svc.sortir('t1', 'u1', 'i1', retrocession('2026-12-31'));
        const lignes = ecrituresPostees.find((e) => e.libelle.startsWith('Mise hors service')).lignes;
        expect(lignes).toEqual([
            { compteId: 'cimmo', debit: 0, credit: 5_000_000 },
            { compteId: 'ca', debit: 5_000_000, credit: 0 },
        ]);
        expect(lignes.some((l) => l.compteId.startsWith('n81'))).toBe(false);
    });
    it('une cession est refusée · l’usufruit se rétrocède', async () => {
        const { svc, ecrituresPostees } = harnais(AU_TERME, USUFRUIT);
        await expect(svc.sortir('t1', 'u1', 'i1', retrocession('2026-12-31', 'CESSION'))).rejects.toThrow(/rétrocédé au donateur/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('avant le terme, la valeur nette qui subsiste est refusée, aucune écriture', async () => {
        const { svc, ecrituresPostees } = harnais(AU_TERME, USUFRUIT);
        await expect(svc.sortir('t1', 'u1', 'i1', retrocession('2026-06-30'))).rejects.toThrow(/valeur nette de 500000\.00/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('un bien destiné à la vente (20300000) garde le 818', () => {
        expect((0, immobilisation_service_1.natureImmobilisation)('20300000', client_1.Referentiel.SYCEBNL)).toBe('DONS_LEGS_VENTE');
        expect((0, immobilisation_service_1.natureImmobilisation)('20110000', client_1.Referentiel.SYCEBNL)).toBe('USUFRUIT');
    });
    it('la dépréciation d’un usufruit au 6913 est refusée · le texte écrit 6951', async () => {
        const { svc, ecrituresPostees } = harnais(AU_TERME, USUFRUIT);
        await expect(svc.enregistrerDepreciation('t1', 'u1', 'i1', DEPRECIATION)).rejects.toThrow(/6951/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('6951 et 7951 seuls, et rien n’est imposé hors du 2011 ni au SYSCOHADA', () => {
        expect((0, comptes_du_bien_1.motifRefusContrepartieUsufruit)(client_1.Referentiel.SYCEBNL, '20110000', client_1.SensDepreciation.DOTATION, '69510000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieUsufruit)(client_1.Referentiel.SYCEBNL, '20110000', client_1.SensDepreciation.REPRISE, '79510000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieUsufruit)(client_1.Referentiel.SYCEBNL, '20110000', client_1.SensDepreciation.REPRISE, '79520000')).toContain('7951');
        expect((0, comptes_du_bien_1.motifRefusContrepartieUsufruit)(client_1.Referentiel.SYCEBNL, '20300000', client_1.SensDepreciation.REPRISE, '79520000')).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusContrepartieUsufruit)(client_1.Referentiel.SYSCOHADA, '20110000', client_1.SensDepreciation.REPRISE, '79140000')).toBeNull();
        expect(immobilisation_service_1.REPRISE_DEPRECIATION_SORTIE[client_1.Referentiel.SYCEBNL].USUFRUIT).toBe('79510000');
    });
});
describe('projet de développement · aucune dotation', () => {
    const BIEN = { valeurOrigine: 5_000_000, dureeAns: 5, dateMiseEnService: '2025-01-01', dotations: [] };
    const OPTIONS = { referentiel: client_1.Referentiel.SYCEBNL, projets: true, compteImmobilisation: '24410000' };
    it('la dotation est refusée, motif nommé, aucune écriture', async () => {
        const { svc, ecrituresPostees } = harnais(BIEN, OPTIONS);
        await expect(svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' })).rejects.toThrow(/art\. 7 et 9/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('une association du même référentiel se dote toujours', async () => {
        const { svc, ecrituresPostees } = harnais(BIEN, { ...OPTIONS, projets: false });
        await svc.passerDotation('t1', 'u1', 'i1', { exerciceId: 'exN', journalId: 'j1' });
        expect(ecrituresPostees).toHaveLength(1);
    });
    it('la sortie ne passe aucun complément de dotation', async () => {
        const { svc, ecrituresPostees } = harnais(BIEN, OPTIONS);
        await svc.sortir('t1', 'u1', 'i1', { dateSortie: '2026-06-30', type: 'MISE_HORS_SERVICE', exerciceId: 'exN', journalId: 'j1', compteFondsProjetId: 'c162' });
        expect(ecrituresPostees.some((e) => e.libelle.startsWith('Dotation complémentaire'))).toBe(false);
    });
});
describe('fin de projet de développement · le fonds reprend le bien', () => {
    const BIEN = { valeurOrigine: 8_000_000, dureeAns: 5, dateMiseEnService: '2025-01-01', dotations: [] };
    const OPTIONS = { referentiel: client_1.Referentiel.SYCEBNL, projets: true, compteImmobilisation: '24410000' };
    const sortie = (type, extra = {}) => ({
        dateSortie: '2026-06-30', type, exerciceId: 'exN', journalId: 'j1', compteFondsProjetId: 'c162', ...extra,
    });
    it('restitution, vol ou remise gratuite · D 162 / C 2, rien d’autre', async () => {
        const { svc, ecrituresPostees } = harnais(BIEN, OPTIONS);
        await svc.sortir('t1', 'u1', 'i1', sortie('MISE_HORS_SERVICE'));
        expect(ecrituresPostees).toHaveLength(1);
        expect(ecrituresPostees[0].libelle).toMatch(/^Fin de projet/);
        expect(ecrituresPostees[0].lignes).toEqual([
            { compteId: 'cimmo', debit: 0, credit: 8_000_000 },
            { compteId: 'c162', debit: 8_000_000, credit: 0 },
        ]);
    });
    it('cession · la même sortie, et le prix au 82 par la contrepartie', async () => {
        const { svc, ecrituresPostees } = harnais(BIEN, OPTIONS);
        await svc.sortir('t1', 'u1', 'i1', sortie('CESSION', { prixCession: 1_500_000, compteContrepartieId: 'c485' }));
        expect(ecrituresPostees[0].lignes.some((l) => l.compteId.startsWith('n81'))).toBe(false);
        expect(ecrituresPostees[1].lignes).toEqual([
            { compteId: 'c485', debit: 1_500_000, credit: 0 },
            { compteId: 'n82200000', debit: 0, credit: 1_500_000 },
        ]);
    });
    it('sans compte de fonds, ou avec un autre que 162 à 164, refusé sans écriture', async () => {
        for (const fonds of [undefined, 'c165']) {
            const { svc, ecrituresPostees } = harnais(BIEN, OPTIONS);
            await expect(svc.sortir('t1', 'u1', 'i1', sortie('MISE_HORS_SERVICE', { compteFondsProjetId: fonds }))).rejects.toThrow(/162, 163/);
            expect(ecrituresPostees).toEqual([]);
        }
    });
    it('un fonds en sommeil est refusé au serveur comme il est écarté de la liste (décision D3), sans écriture', async () => {
        const { svc, ecrituresPostees } = harnais(BIEN, OPTIONS);
        await expect(svc.sortir('t1', 'u1', 'i1', sortie('MISE_HORS_SERVICE', { compteFondsProjetId: 'c164dort' }))).rejects.toThrow(/16400000 est en sommeil/);
        expect(ecrituresPostees).toEqual([]);
        expect((0, comptes_du_bien_1.motifRefusSortieProjet)({ projet: true, numeroCompteFonds: '16400000', cumulAmorti: 0, cumulDepreciation: 0, compteFondsEnSommeil: true })).toContain('Plan comptable');
        expect((0, comptes_du_bien_1.motifRefusSortieProjet)({ projet: true, numeroCompteFonds: '16400000', cumulAmorti: 0, cumulDepreciation: 0, compteFondsEnSommeil: false })).toBeNull();
    });
    it('une association ne reçoit pas de compte de fonds, et sort toujours par le 81', async () => {
        const { svc } = harnais(BIEN, { ...OPTIONS, projets: false });
        await expect(svc.sortir('t1', 'u1', 'i1', sortie('MISE_HORS_SERVICE'))).rejects.toThrow(/projet de développement/);
    });
    it('un bien de projet déjà amorti est refusé · art. 7 et 9', () => {
        expect((0, comptes_du_bien_1.motifRefusSortieProjet)({ projet: true, numeroCompteFonds: '16200000', cumulAmorti: 100, cumulDepreciation: 0 })).toContain('art. 7 et 9');
        expect((0, comptes_du_bien_1.motifRefusSortieProjet)({ projet: true, numeroCompteFonds: '16300000', cumulAmorti: 0, cumulDepreciation: 0 })).toBeNull();
        expect((0, comptes_du_bien_1.motifRefusSortieProjet)({ projet: false, numeroCompteFonds: null, cumulAmorti: 5, cumulDepreciation: 0 })).toBeNull();
    });
});
describe('lot 12 · le plafond de reprise, plan d’origine rejoué (ch. 12 § 2.4.2)', () => {
    const pont = {
        valeurOrigine: 30_000_000,
        dureeAns: 10,
        dateMiseEnService: '2024-01-02',
        dotations: [3_000_000, 3_000_000, 2_500_000, 2_500_000],
        depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 4_000_000, dateFin: '2025-12-31' }],
        exercice: { dateDebut: '2027-01-01', dateFin: '2027-12-31' },
    };
    const reprise = (montant) => ({ ...DEPRECIATION, sens: client_1.SensDepreciation.REPRISE, montant, compteContrepartieId: 'c79' });
    it('les trois valeurs du texte · 15 000 000, 18 000 000, 3 000 000 au plus', async () => {
        const { svc } = harnais(pont);
        await expect(svc.plafondReprise('t1', 'i1', 'exN')).resolves.toEqual({
            cumulDepreciation: 4_000_000,
            valeurNette: 15_000_000,
            valeurSansDepreciation: 18_000_000,
            plafond: 3_000_000,
        });
    });
    it('2 000 000 et 3 000 000 passent, 3 000 001 est refusé · le cumul du 29 (4 000 000) ne suffit plus', async () => {
        for (const montant of [2_000_000, 3_000_000]) {
            const { svc, ecrituresPostees } = harnais(pont);
            await svc.enregistrerDepreciation('t1', 'u1', 'i1', reprise(montant));
            expect(ecrituresPostees[0].lignes[0]).toEqual({ compteId: 'c29', debit: montant, credit: 0 });
        }
        const { svc, ecrituresPostees } = harnais(pont);
        await expect(svc.enregistrerDepreciation('t1', 'u1', 'i1', reprise(3_000_001))).rejects.toThrow(/plafonnée à 3000000\.00.*18000000\.00.*15000000\.00.*§ 2\.4\.2/);
        expect(ecrituresPostees).toHaveLength(0);
    });
    it('la dotation de l’exercice non encore passée compte comme le texte l’écrit (« après amortissement et reprise »)', async () => {
        const { svc } = harnais({ ...pont, dotations: [3_000_000, 3_000_000, 2_500_000] });
        const v = await svc.plafondReprise('t1', 'i1', 'exN');
        expect(v.valeurNette).toBeCloseTo(15_000_000, 2);
        expect(v.plafond).toBeCloseTo(3_000_000, 2);
    });
    it('l’année même de la perte, rien ne se reprend au-delà de ce que le plan d’origine aurait laissé', async () => {
        const { svc } = harnais({ ...pont, dotations: [3_000_000, 3_000_000], exercice: { dateDebut: '2025-01-01', dateFin: '2025-12-31' } });
        await expect(svc.plafondReprise('t1', 'i1', 'exN')).resolves.toMatchObject({ valeurNette: 20_000_000, valeurSansDepreciation: 24_000_000, plafond: 4_000_000 });
    });
    it('un terrain ne s’amortit pas · son plafond est le cumul du 29', async () => {
        const { svc } = harnais({ valeurOrigine: 50_000_000, dureeAns: 20, dateMiseEnService: '2024-01-02', depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 8_000_000, dateFin: '2025-12-31' }] }, { compteImmobilisation: '22310000', compte29: '29230000' });
        await expect(svc.plafondReprise('t1', 'i1', 'exN')).resolves.toMatchObject({ valeurSansDepreciation: 50_000_000, plafond: 8_000_000 });
    });
    it('une durée nulle ne divise pas par zéro · le bien garde sa valeur, le plafond est le cumul', async () => {
        const { svc } = harnais({ valeurOrigine: 50_000_000, dureeAns: 0, dateMiseEnService: '2024-01-02', depreciations: [{ sens: client_1.SensDepreciation.DOTATION, montant: 8_000_000, dateFin: '2025-12-31' }] }, { compteImmobilisation: '22110000', compte29: '29210000' });
        await expect(svc.plafondReprise('t1', 'i1', 'exN')).resolves.toMatchObject({ valeurSansDepreciation: 50_000_000, plafond: 8_000_000 });
    });
});
//# sourceMappingURL=depreciation-immobilisation.spec.js.map