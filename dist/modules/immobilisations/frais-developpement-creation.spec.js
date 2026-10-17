"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const immobilisation_service_1 = require("./immobilisation.service");
const frais_developpement_1 = require("./frais-developpement");
function harnais(referentiel = 'SYSCOHADA', numeroBien = '21100000', regime = {}) {
    const creations = [];
    const ecrituresPostees = [];
    const prisma = {
        familleImmobilisation: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'f1',
                estActif: true,
                compteImmobilisationId: 'cimmo',
                compteAmortissementId: 'camort',
                compteDotationId: 'cdot',
                dureeAmortissementAns: 5,
            }),
        },
        exercice: { findFirst: jest.fn().mockResolvedValue({ dateDebut: new Date('2026-01-01') }) },
        compte: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'c721'
                ? { id: 'c721', numero: '72100000' }
                : where.id === 'c1984'
                    ? { id: 'c1984', numero: '19840000' }
                    : where.id === 'cimmo'
                        ? { id: 'cimmo', numero: numeroBien }
                        : null)),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel, ...regime }) },
        immobilisation: {
            create: jest.fn().mockImplementation(({ data }) => {
                creations.push(data);
                return Promise.resolve({ ...data, id: 'i1', valeurOrigine: 0, valeurResiduelle: 0, prixCession: null, dotations: [] });
            }),
        },
    };
    const ecritures = {
        creer: jest.fn().mockImplementation((_t, _u, dto) => {
            ecrituresPostees.push(dto);
            return Promise.resolve({ id: 'eAcq' });
        }),
    };
    return { svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures), creations, ecrituresPostees };
}
const P1 = {
    familleId: 'f1',
    designation: 'Médicament P1 · développement',
    dateAcquisition: '2026-12-31',
    dateMiseEnService: '2026-12-31',
    valeurOrigine: 110_000_000,
    exerciceId: 'ex2026',
    compteContrepartieId: 'c721',
    journalId: 'j1',
};
const SIX = Object.fromEntries(frais_developpement_1.CRITERES_FRAIS_DEVELOPPEMENT.map((c) => [c.cle, `Démontré · ${c.rang}`]));
describe('frais de développement · câblage à la création (lot 15)', () => {
    it('les six critères justifiés et la date de réunion · inscrit au 211 par le 721, justifications gardées', async () => {
        const { svc, creations, ecrituresPostees } = harnais();
        await svc.creer('t1', 'u1', { ...P1, criteresFraisDeveloppement: SIX, dateReunionCriteresDeveloppement: '2026-05-01' });
        expect(ecrituresPostees).toHaveLength(1);
        expect(creations[0]).toMatchObject({
            criteresFraisDeveloppement: SIX,
            dateReunionCriteresDeveloppement: new Date('2026-05-01'),
        });
    });
    it('un critère manquant · refusé avant toute écriture, le critère nommé', async () => {
        const { svc, creations, ecrituresPostees } = harnais();
        const { RESSOURCES: _retire, ...cinq } = SIX;
        await expect(svc.creer('t1', 'u1', { ...P1, criteresFraisDeveloppement: cinq, dateReunionCriteresDeveloppement: '2026-05-01' })).rejects.toThrow(/Critère 5 non démontré/);
        expect(ecrituresPostees).toEqual([]);
        expect(creations).toEqual([]);
    });
    it('inscrit avant la réunion des critères · refusé (pas de rétroactivité)', async () => {
        const { svc, ecrituresPostees } = harnais();
        await expect(svc.creer('t1', 'u1', { ...P1, dateAcquisition: '2026-04-30', dateMiseEnService: '2026-04-30', criteresFraisDeveloppement: SIX, dateReunionCriteresDeveloppement: '2026-05-01' })).rejects.toThrow(/ne peuvent plus être activées/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('un autre incorporel n’est pas touché, et rien n’est gardé', async () => {
        const { svc, creations } = harnais('SYSCOHADA', '21310000');
        await svc.creer('t1', 'u1', { ...P1, valeurOrigine: 1_000_000 });
        expect(creations[0]).toMatchObject({ criteresFraisDeveloppement: undefined, dateReunionCriteresDeveloppement: null });
    });
});
describe('composant démantèlement · paramètres gardés sur lui seul (lot 15)', () => {
    it('un coût attendu et un taux sur un bien qui n’est pas un composant démantèlement · refusés avant toute écriture', async () => {
        const { svc, ecrituresPostees } = harnais('SYSCOHADA', '24110000');
        await expect(svc.creer('t1', 'u1', { ...P1, valeurOrigine: 1_000_000, coutFuturDemantelement: 10_000_000, tauxActualisationDemantelementPourcent: 12 })).rejects.toThrow(/composant démantèlement/);
        expect(ecrituresPostees).toEqual([]);
    });
});
describe('provision pour démantèlement · refusée au Système minimal de trésorerie (lot 15)', () => {
    const SMT_SYSCOHADA = { systemeComptableSyscohada: 'MINIMAL_TRESORERIE' };
    const SMT_SYCEBNL = { jeuEtatsFinanciersSycebnl: 'SYSTEME_MINIMAL_TRESORERIE' };
    it.each([
        ['SYSCOHADA', SMT_SYSCOHADA],
        ['SYCEBNL', SMT_SYCEBNL],
    ])('%s au SMT · le 1984 en contrepartie est refusé avant toute écriture', async (ref, regime) => {
        const { svc, ecrituresPostees } = harnais(ref, '24110000', regime);
        await expect(svc.creer('t1', 'u1', { ...P1, valeurOrigine: 1_000_000, compteContrepartieId: 'c1984' })).rejects.toThrow(/Système minimal de trésorerie/);
        expect(ecrituresPostees).toEqual([]);
    });
    it('au SMT · coût attendu et taux refusés, ils n’auraient aucune provision à suivre', async () => {
        const { svc, ecrituresPostees } = harnais('SYSCOHADA', '24110000', SMT_SYSCOHADA);
        await expect(svc.creer('t1', 'u1', { ...P1, valeurOrigine: 1_000_000, coutFuturDemantelement: 10_000_000, tauxActualisationDemantelementPourcent: 12 })).rejects.toThrow(/Système minimal de trésorerie/);
        expect(ecrituresPostees).toEqual([]);
    });
});
//# sourceMappingURL=frais-developpement-creation.spec.js.map