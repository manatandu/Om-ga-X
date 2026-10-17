"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
function harnais(options = {}) {
    const ecrituresPostees = [];
    const immo = {
        id: 'i1',
        designation: 'Camion',
        statut: 'EN_SERVICE',
        valeurOrigine: 12_000,
        valeurResiduelle: 0,
        dureeAmortissementAns: 5,
        dateMiseEnService: options.dateMiseEnService === null ? null : new Date(options.dateMiseEnService ?? '2024-01-01'),
        dateAcquisition: new Date('2023-06-01'),
        amortissementAnterieur: 0,
        modeAmortissement: 'LINEAIRE',
        compteImmobilisationId: 'cimmo',
        compteImmobilisation: { id: 'cimmo', numero: '24500000', intitule: 'Matériel de transport' },
        compteDotationId: 'cd',
        compteAmortissementId: 'ca',
        dotations: (options.dotations ?? [2_400, 2_400]).map((m, i) => ({ montant: m, exerciceId: `exAnt${i}` })),
        depreciations: [],
    };
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const supprimees = [];
    const dotationSupprimee = jest.fn().mockResolvedValue({});
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: options.smt ? client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE : client_1.SystemeComptableSyscohada.NORMAL,
                jeuEtatsFinanciersSycebnl: null,
            }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue(immo),
            findMany: jest.fn(({ where }) => Promise.resolve((options.composants ?? []).filter((c) => c.immobilisationPrincipaleId === where.immobilisationPrincipaleId && (!where.statut || c.statut === where.statut)))),
            updateMany,
            update: jest.fn().mockResolvedValue({ ...immo, dotations: immo.dotations }),
        },
        exercice: {
            findFirst: jest.fn().mockResolvedValue({ id: 'exN', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') }),
        },
        compte: {
            findUnique: jest.fn().mockImplementation(({ where }) => {
                const numero = where.tenantId_numero.numero;
                return Promise.resolve(options.comptesAbsents?.includes(numero) ? null : { id: `n${numero}`, numero });
            }),
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve({ id: where.id, numero: where.id === 'c485' ? '48520000' : where.id === 'c411' ? '41110000' : '52110000' })),
        },
        dotationAmortissement: {
            create: jest.fn().mockResolvedValue({ id: 'dot1' }),
            delete: dotationSupprimee,
        },
        ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        ligneReevaluationBilan: { findMany: jest.fn().mockResolvedValue([]) },
        ecriture: {
            delete: jest.fn().mockImplementation(({ where }) => {
                supprimees.push(where.id);
                return Promise.resolve({});
            }),
        },
    };
    let appels = 0;
    const ecritures = {
        creer: jest.fn().mockImplementation((_t, _u, dto) => {
            appels += 1;
            if (appels === options.echecCreation)
                return Promise.reject(new Error('journal clôturé'));
            const id = `e${appels}`;
            ecrituresPostees.push({ id, libelle: dto.libelle, lignes: dto.lignes });
            return Promise.resolve({ id });
        }),
    };
    return {
        prisma,
        svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures),
        ecrituresPostees,
        updateMany,
        supprimees,
        dotationSupprimee,
    };
}
const sortie = (dateSortie, type = 'MISE_HORS_SERVICE') => ({
    dateSortie,
    type,
    exerciceId: 'exN',
    journalId: 'j1',
    ...(type === 'CESSION' ? { prixCession: 500, compteContrepartieId: 'c485' } : {}),
});
const complement = async (dateSortie, options = {}) => {
    const { svc, ecrituresPostees } = harnais(options);
    await svc.sortir('t1', 'u1', 'i1', sortie(dateSortie));
    const e = ecrituresPostees.find((x) => x.libelle.startsWith('Dotation complémentaire'));
    return e ? e.lignes[0].debit : 0;
};
describe('F27 · la dotation complémentaire s’arrête à la date de sortie', () => {
    it('sortie au 30 septembre · neuf mois sur douze (Guide, Application 16)', async () => {
        expect(await complement('2026-09-30')).toBe(1_800);
    });
    it('sortie en cours de mois · le mois de la sortie compte, comme celui de la mise en service', async () => {
        expect(await complement('2026-06-15')).toBe(1_200);
    });
    it('sortie au 31 décembre · l’annuité est pleine', async () => {
        expect(await complement('2026-12-31')).toBe(2_400);
    });
    it('bien mis en service dans l’exercice · de son mois de mise en service à celui de la sortie', async () => {
        expect(await complement('2026-09-30', { dateMiseEnService: '2026-03-10', dotations: [] })).toBe(1_400);
    });
    it('au SMT SYSCOHADA, « sans prorata temporis » vaut aussi à la sortie', async () => {
        expect(await complement('2026-06-15', { smt: true })).toBe(2_400);
    });
    it('la valeur nette portée au 81 suit · brut moins les amortissements arrêtés à la sortie', async () => {
        const { svc, ecrituresPostees } = harnais();
        await svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30'));
        const lignes = ecrituresPostees.find((e) => e.libelle.startsWith('Mise hors service')).lignes;
        expect(lignes.find((l) => l.compteId === 'n81200000').debit).toBe(5_400);
        expect(lignes.find((l) => l.compteId === 'ca').debit).toBe(6_600);
    });
});
describe('F28 · un refus ne laisse jamais le bien sorti sans écriture', () => {
    it('un compte de classe 8 absent refuse AVANT le verrou · le statut ne bouge pas', async () => {
        const { svc, updateMany, ecrituresPostees } = harnais({ comptesAbsents: ['81200000'] });
        await expect(svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30'))).rejects.toThrow(/81200000 introuvable/);
        expect(updateMany).not.toHaveBeenCalled();
        expect(ecrituresPostees).toEqual([]);
    });
    it('le compte du produit de cession absent refuse aussi avant le verrou', async () => {
        const { svc, updateMany } = harnais({ comptesAbsents: ['82200000'] });
        await expect(svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30', 'CESSION'))).rejects.toThrow(/82200000/);
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('une cession H.A.O. portée sur un client est refusée avant le verrou (fiche du compte 41, Exclusions)', async () => {
        const { svc, updateMany, ecrituresPostees } = harnais();
        await expect(svc.sortir('t1', 'u1', 'i1', { ...sortie('2026-09-30', 'CESSION'), compteContrepartieId: 'c411' })).rejects.toThrow(/485/);
        expect(updateMany).not.toHaveBeenCalled();
        expect(ecrituresPostees).toEqual([]);
    });
    it('une cession courante portée au 485 est refusée · elle va au 414 (fiche du compte 48)', async () => {
        const { svc, updateMany } = harnais();
        await expect(svc.sortir('t1', 'u1', 'i1', { ...sortie('2026-09-30', 'CESSION'), cessionCourante: true })).rejects.toThrow(/414/);
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('une écriture refusée après le verrou défait tout · dotation, écritures, puis statut EN SERVICE', async () => {
        const { svc, updateMany, supprimees, dotationSupprimee } = harnais({ echecCreation: 2 });
        await expect(svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30'))).rejects.toThrow(/journal clôturé/);
        expect(dotationSupprimee).toHaveBeenCalledWith({ where: { id: 'dot1' } });
        expect(supprimees).toEqual(['e1']);
        expect(updateMany).toHaveBeenLastCalledWith({
            where: { id: 'i1', tenantId: 't1' },
            data: {
                statut: 'EN_SERVICE',
                dateSortie: null,
                prixCession: null,
                natureSortie: null,
                referencePieceSortie: null,
                datePieceSortie: null,
                ecritureSortieId: null,
                ecritureProduitCessionId: null,
                ecritureSortieEcartReevaluationId: null,
            },
        });
    });
    it('le produit de cession refusé défait aussi la sortie déjà posée, dans l’ordre inverse', async () => {
        const { svc, supprimees } = harnais({ echecCreation: 3 });
        await expect(svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30', 'CESSION'))).rejects.toThrow(/journal clôturé/);
        expect(supprimees).toEqual(['e2', 'e1']);
    });
});
describe('F127 · un bien principal ne sort pas avec ses composants en service', () => {
    it('refuse, en nommant les composants, avant tout verrou et toute écriture', async () => {
        const { svc, updateMany, ecrituresPostees } = harnais({
            composants: [
                { designation: 'Pneus', immobilisationPrincipaleId: 'i1', statut: 'EN_SERVICE' },
                { designation: 'Ancien moteur', immobilisationPrincipaleId: 'i1', statut: 'MIS_HORS_SERVICE' },
                { designation: 'Autre bien', immobilisationPrincipaleId: 'i9', statut: 'EN_SERVICE' },
            ],
        });
        await expect(svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30'))).rejects.toThrow(/1 composant\(s\) en service \(Pneus\)/);
        expect(updateMany).not.toHaveBeenCalled();
        expect(ecrituresPostees).toEqual([]);
    });
    it('des composants déjà sortis ne retiennent pas le principal', async () => {
        const { svc, ecrituresPostees } = harnais({
            composants: [{ designation: 'Ancien moteur', immobilisationPrincipaleId: 'i1', statut: 'MIS_HORS_SERVICE' }],
        });
        await svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30'));
        expect(ecrituresPostees.length).toBeGreaterThan(0);
    });
});
describe('F130 · l’écriture du produit de cession est retenue par la fiche', () => {
    it('la cession lie à la fiche l’écriture du produit, à côté de celle de sortie', async () => {
        const { svc, prisma, ecrituresPostees } = harnais();
        await svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30', 'CESSION'));
        const produit = ecrituresPostees.find((e) => e.libelle.startsWith('Produit de cession'));
        const sortieE = ecrituresPostees.find((e) => e.libelle.startsWith('Cession'));
        expect(prisma.immobilisation.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: { ecritureSortieId: sortieE.id, ecritureProduitCessionId: produit.id, ecritureSortieEcartReevaluationId: null } }));
    });
    it('une mise hors service n’a pas d’écriture de produit · la colonne reste vide', async () => {
        const { svc, prisma } = harnais();
        await svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30'));
        expect(prisma.immobilisation.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ ecritureProduitCessionId: null }) }));
    });
});
describe('un bien jamais mis en service sort sans dotation complémentaire (AUDCIF art. 45)', () => {
    it('cédé ou détruit avant usage · aucune annuité, mais l’écriture de sortie passe', async () => {
        const { svc, ecrituresPostees } = harnais({ dateMiseEnService: null, dotations: [] });
        await svc.sortir('t1', 'u1', 'i1', sortie('2026-09-30'));
        expect(ecrituresPostees.some((e) => e.libelle.startsWith('Dotation complémentaire'))).toBe(false);
        expect(ecrituresPostees.length).toBeGreaterThan(0);
    });
    it('la borne reste l’acquisition · une sortie antérieure est refusée', async () => {
        const { svc, ecrituresPostees } = harnais({ dateMiseEnService: null, dotations: [] });
        await expect(svc.sortir('t1', 'u1', 'i1', sortie('2023-05-31'))).rejects.toThrow(/date d'acquisition/);
        expect(ecrituresPostees).toEqual([]);
    });
});
//# sourceMappingURL=sortie-f27-f28.spec.js.map