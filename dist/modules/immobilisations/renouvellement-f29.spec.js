"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const PRINCIPAL = {
    id: 'machine',
    dateAcquisition: new Date('2020-01-10'),
    dureeAmortissementAns: 10,
    compteImmobilisation: { numero: '24110000', intitule: 'Matériel industriel' },
};
const PIECE = {
    familleId: 'f1',
    designation: 'Pièce de sécurité · moteur de secours',
    dateAcquisition: '2026-04-01',
    dateMiseEnService: '2026-04-01',
    valeurOrigine: 5_000_000,
    dureeAmortissementAns: 5,
    compteContrepartieId: 'ctreso',
    exerciceId: 'exN',
    journalId: 'j1',
    immobilisationPrincipaleId: 'machine',
    typeComposant: client_1.TypeComposant.PIECE_DE_SECURITE,
    justificationDecomposition: 'Moteur de secours tenu en réserve · durée distincte de la machine',
};
function harnais(options = {}) {
    const ecrituresSupprimees = [];
    const ecrituresPostees = [];
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const prisma = {
        familleImmobilisation: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'f1',
                estActif: true,
                compteImmobilisationId: 'cimmo',
                compteAmortissementId: 'camort',
                compteDotationId: 'cdot',
                dureeAmortissementAns: 10,
                modeAmortissement: options.modeFamille ?? 'LINEAIRE',
            }),
        },
        compte: { findFirst: jest.fn().mockResolvedValue({ id: 'ctreso', numero: '52110000' }) },
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'exN' && where.tenantId === 't1' ? { dateDebut: new Date('2026-01-01') } : null)),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: client_1.Referentiel.SYSCOHADA,
                systemeComptableSyscohada: 'NORMAL',
                jeuEtatsFinanciersSycebnl: null,
            }),
        },
        immobilisation: {
            findFirst: jest.fn().mockImplementation(({ where }) => {
                if (where.id === 'machine')
                    return Promise.resolve(PRINCIPAL);
                if (where.id === 'nouveau')
                    return Promise.resolve({ ecritureAcquisitionId: 'eAcq' });
                return Promise.resolve({
                    id: 'ancien',
                    designation: 'Ancien moteur de secours',
                    statut: 'EN_SERVICE',
                    familleId: 'f1',
                    immobilisationPrincipaleId: 'machine',
                    typeComposant: client_1.TypeComposant.PIECE_DE_SECURITE,
                    justificationDecomposition: 'Moteur de secours',
                });
            }),
            create: jest.fn().mockImplementation(({ data }) => options.createEchoue
                ? Promise.reject(new Error('contrainte'))
                : Promise.resolve({ ...data, id: 'nouveau', valeurOrigine: 0, valeurResiduelle: 0, prixCession: null, dotations: [] })),
            deleteMany,
        },
        ligneEcriture: { deleteMany: jest.fn().mockResolvedValue({ count: 2 }) },
        ecriture: {
            delete: jest.fn().mockImplementation(({ where }) => {
                ecrituresSupprimees.push(where.id);
                return Promise.resolve({});
            }),
        },
    };
    const ecritures = {
        creer: jest.fn().mockImplementation(() => {
            ecrituresPostees.push('eAcq');
            return Promise.resolve({ id: 'eAcq' });
        }),
    };
    return {
        svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures),
        deleteMany,
        ecrituresSupprimees,
        ecrituresPostees,
    };
}
const RENOUVELLEMENT = {
    dateRenouvellement: '2026-04-01',
    designation: 'Nouveau moteur de secours',
    coutRenouvellement: 5_000_000,
    dureeAmortissementAns: 5,
    compteContrepartieId: 'ctreso',
    exerciceId: 'exN',
    journalId: 'j1',
};
describe('F29 · la pièce de sécurité qui en remplace une autre', () => {
    it('s’amortit dès SA propre acquisition · le renouvellement n’est plus refusé', async () => {
        const { svc } = harnais();
        await expect(svc.creer('t1', 'u1', PIECE, {
            composantRemplaceId: 'ancien',
        })).resolves.toBeDefined();
    });
    it('refuse un remplaçant qui ne démarrerait qu’à son intégration · c’est une pièce de rechange', async () => {
        const { svc } = harnais();
        await expect(svc.creer('t1', 'u1', { ...PIECE, dateMiseEnService: '2026-09-01' }, { composantRemplaceId: 'ancien' })).rejects.toThrow(/dès son acquisition/);
    });
    it('hors renouvellement, la pièce de sécurité démarre toujours à l’acquisition du principal', async () => {
        const { svc } = harnais();
        await expect(svc.creer('t1', 'u1', PIECE)).rejects.toThrow(/acquisition de l'immobilisation principale/);
    });
});
describe('F29 · le remplaçant d’abord, la sortie ensuite', () => {
    it('crée le remplaçant AVANT de sortir l’ancien', async () => {
        const { svc } = harnais();
        const creer = jest.spyOn(svc, 'creer');
        const sortir = jest.spyOn(svc, 'sortir').mockResolvedValue({});
        await svc.renouveler('t1', 'u1', 'ancien', RENOUVELLEMENT);
        expect(creer.mock.invocationCallOrder[0]).toBeLessThan(sortir.mock.invocationCallOrder[0]);
    });
    it('une sortie refusée retire le remplaçant et son écriture d’acquisition', async () => {
        const { svc, deleteMany, ecrituresSupprimees } = harnais();
        jest.spyOn(svc, 'sortir').mockRejectedValue(new Error('compte 81200000 introuvable'));
        await expect(svc.renouveler('t1', 'u1', 'ancien', RENOUVELLEMENT)).rejects.toThrow(/81200000/);
        expect(deleteMany).toHaveBeenCalledWith({ where: { id: 'nouveau', tenantId: 't1' } });
        expect(ecrituresSupprimees).toEqual(['eAcq']);
    });
    it('un composant déjà sorti ne se renouvelle pas · rien n’est créé', async () => {
        const { svc } = harnais();
        const trouver = svc.prisma.immobilisation
            .findFirst;
        trouver.mockResolvedValueOnce({ id: 'ancien', statut: 'CEDEE', immobilisationPrincipaleId: 'machine' });
        const creer = jest.spyOn(svc, 'creer');
        await expect(svc.renouveler('t1', 'u1', 'ancien', RENOUVELLEMENT)).rejects.toThrow(/déjà sorti/);
        expect(creer).not.toHaveBeenCalled();
    });
});
describe('F29 · la création d’un bien ne laisse jamais une écriture sans fiche', () => {
    it('un refus de mode tombe AVANT l’écriture d’acquisition', async () => {
        const { svc, ecrituresPostees } = harnais();
        const { immobilisationPrincipaleId: _p, typeComposant: _t, justificationDecomposition: _j, ...structure } = PIECE;
        await expect(svc.creer('t1', 'u1', { ...structure, modeAmortissement: client_1.ModeAmortissement.UNITES_DOEUVRE })).rejects.toThrow(/TOTAL D'UNITÉS PRÉVUES/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('une fiche refusée par la base retire l’écriture d’acquisition déjà posée', async () => {
        const { svc, ecrituresSupprimees } = harnais({ createEchoue: true });
        const { immobilisationPrincipaleId: _p, typeComposant: _t, justificationDecomposition: _j, ...structure } = PIECE;
        await expect(svc.creer('t1', 'u1', structure)).rejects.toThrow(/contrainte/);
        expect(ecrituresSupprimees).toEqual(['eAcq']);
    });
});
describe('F128 · le bien hérite du mode de sa famille', () => {
    it('une famille aux unités d’œuvre impose son mode, et ses préalables, au bien qui n’en déclare pas', async () => {
        const { svc, ecrituresPostees } = harnais({ modeFamille: 'UNITES_DOEUVRE' });
        const { immobilisationPrincipaleId: _p, typeComposant: _t, justificationDecomposition: _j, ...structure } = PIECE;
        await expect(svc.creer('t1', 'u1', structure)).rejects.toThrow(/TOTAL D'UNITÉS PRÉVUES/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('le bien peut déclarer un autre mode que sa famille', async () => {
        const { svc } = harnais({ modeFamille: 'UNITES_DOEUVRE' });
        const { immobilisationPrincipaleId: _p, typeComposant: _t, justificationDecomposition: _j, ...structure } = PIECE;
        await expect(svc.creer('t1', 'u1', { ...structure, modeAmortissement: 'LINEAIRE' })).resolves.toBeDefined();
    });
});
describe('F129 · une famille en sommeil ne reçoit plus de bien', () => {
    it('la création est refusée avant toute écriture', async () => {
        const { svc, ecrituresPostees } = harnais();
        const familles = svc.prisma.familleImmobilisation;
        familles.findFirst.mockResolvedValueOnce({ id: 'f1', intitule: 'Mobilier', estActif: false, dureeAmortissementAns: 10, modeAmortissement: 'LINEAIRE' });
        const { immobilisationPrincipaleId: _p, typeComposant: _t, justificationDecomposition: _j, ...structure } = PIECE;
        await expect(svc.creer('t1', 'u1', structure)).rejects.toThrow(/Mobilier.*en sommeil/);
        expect(ecrituresPostees).toEqual([]);
    });
});
//# sourceMappingURL=renouvellement-f29.spec.js.map