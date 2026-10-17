"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const IMMEUBLE = {
    id: 'immeuble',
    dateAcquisition: new Date('2020-01-10'),
    compteImmobilisation: { numero: '23110000', intitule: 'Bâtiments industriels' },
};
const ORDINATEURS = {
    id: 'parc-info',
    dateAcquisition: new Date('2024-03-01'),
    compteImmobilisation: { numero: '24420000', intitule: 'Matériel informatique' },
};
function harnais(options = {}) {
    const creations = [];
    const prisma = {
        familleImmobilisation: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'f1',
                estActif: true,
                compteImmobilisationId: 'cimmo',
                compteAmortissementId: 'camort',
                compteDotationId: 'cdot',
                dureeAmortissementAns: 10,
            }),
        },
        compte: { findFirst: jest.fn().mockResolvedValue({ id: 'ctreso', numero: '52110000' }) },
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'exN' && where.tenantId === 't1' ? { dateDebut: new Date('2020-01-01') } : null)),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: options.referentiel ?? client_1.Referentiel.SYSCOHADA }),
        },
        immobilisation: {
            findFirst: jest.fn().mockResolvedValue(options.principal ?? IMMEUBLE),
            create: jest.fn().mockImplementation(({ data }) => {
                creations.push(data);
                return Promise.resolve({ ...data, valeurOrigine: 0, valeurResiduelle: 0, prixCession: null, dotations: [] });
            }),
        },
    };
    const ecritures = { creer: jest.fn().mockResolvedValue({ id: 'e1' }) };
    return { svc: new immobilisation_service_1.ImmobilisationService(prisma, ecritures), creations };
}
const ASCENSEUR = {
    familleId: 'f1',
    designation: 'Ascenseur',
    dateAcquisition: '2020-01-10',
    dateMiseEnService: '2020-01-10',
    valeurOrigine: 40_000_000,
    dureeAmortissementAns: 10,
    compteContrepartieId: 'ctreso',
    exerciceId: 'exN',
    journalId: 'j1',
    immobilisationPrincipaleId: 'immeuble',
    justificationDecomposition: 'Immeuble amorti sur 40 ans, ascenseur remplacé tous les 10 ans · durées d’utilité distinctes et coût significatif',
};
describe('un composant se rattache à son immobilisation principale', () => {
    it('enregistre le lien, la nature et la justification', async () => {
        const { svc, creations } = harnais();
        await svc.creer('t1', 'u1', ASCENSEUR);
        expect(creations[0].immobilisationPrincipaleId).toBe('immeuble');
        expect(creations[0].typeComposant).toBe(client_1.TypeComposant.COMPOSANT);
        expect(creations[0].justificationDecomposition).toContain('durées d’utilité distinctes');
    });
    it('une immobilisation ordinaire reste une structure · rien ne change', async () => {
        const { svc, creations } = harnais();
        const { immobilisationPrincipaleId: _p, justificationDecomposition: _j, ...structure } = ASCENSEUR;
        await svc.creer('t1', 'u1', structure);
        expect(creations[0].immobilisationPrincipaleId).toBeNull();
        expect(creations[0].typeComposant).toBeNull();
    });
    it('refuse un composant sans justification · le texte pose des conditions, pas le logiciel', async () => {
        const { svc } = harnais();
        const { justificationDecomposition: _j, ...sansMotif } = ASCENSEUR;
        await expect(svc.creer('t1', 'u1', sansMotif)).rejects.toThrow(/décomposable/i);
    });
    it('refuse une nature de composant sans principal · le rattachement va d’un bloc', async () => {
        const { svc } = harnais();
        const { immobilisationPrincipaleId: _p, ...orphelin } = ASCENSEUR;
        await expect(svc.creer('t1', 'u1', { ...orphelin, typeComposant: client_1.TypeComposant.REVISION_MAJEURE })).rejects.toThrow(/immobilisation principale/i);
    });
});
describe('la valeur résiduelle d’un composant', () => {
    it('est refusée par défaut · il est prévu qu’il soit remplacé avant la fin de la structure', async () => {
        const { svc } = harnais();
        await expect(svc.creer('t1', 'u1', { ...ASCENSEUR, valeurResiduelle: 2_000_000 })).rejects.toThrow(/valeur résiduelle/i);
    });
    it('est admise sur le DERNIER renouvellement · § 4.3', async () => {
        const { svc, creations } = harnais();
        await svc.creer('t1', 'u1', {
            ...ASCENSEUR,
            valeurResiduelle: 2_000_000,
            dernierRenouvellement: true,
        });
        expect(creations[0].valeurResiduelle).toBe(2_000_000);
    });
});
describe('les deux pièces, et leurs deux dates de départ opposées', () => {
    it('la pièce de sécurité démarre à l’acquisition du principal, et pas ailleurs', async () => {
        const { svc } = harnais();
        await expect(svc.creer('t1', 'u1', {
            ...ASCENSEUR,
            typeComposant: client_1.TypeComposant.PIECE_DE_SECURITE,
            dateMiseEnService: '2021-06-01',
        })).rejects.toThrow(/pièce de sécurité/i);
    });
    it('le refus cite le texte DU DOSSIER · l’AUDCIF à une société, le SYCEBNL à une association', async () => {
        const motif = async (referentiel) => {
            const { svc } = harnais({ referentiel });
            return svc
                .creer('t1', 'u1', { ...ASCENSEUR, typeComposant: client_1.TypeComposant.PIECE_DE_SECURITE, dateMiseEnService: '2021-06-01' })
                .then(() => '', (e) => e.message);
        };
        const societe = await motif(client_1.Referentiel.SYSCOHADA);
        expect(societe).toContain('AUDCIF, Titre VIII ch. 14 § 1.2.3');
        expect(societe).not.toContain('SYCEBNL');
        const association = await motif(client_1.Referentiel.SYCEBNL);
        expect(association).toContain('SYCEBNL, Partie 2 ch. 3, classe 2');
        expect(association).not.toContain('AUDCIF');
    });
    it('acceptée quand elle démarre bien à cette date', async () => {
        const { svc, creations } = harnais();
        await svc.creer('t1', 'u1', {
            ...ASCENSEUR,
            typeComposant: client_1.TypeComposant.PIECE_DE_SECURITE,
            dateAcquisition: '2020-01-10',
            dateMiseEnService: '2020-01-10',
        });
        expect(creations[0].typeComposant).toBe(client_1.TypeComposant.PIECE_DE_SECURITE);
    });
    it('la pièce de sécurité ne reste jamais « non mise en service » · sans date, refusée', async () => {
        const { svc, creations } = harnais();
        const { dateMiseEnService: _d, ...sansDate } = ASCENSEUR;
        await expect(svc.creer('t1', 'u1', { ...sansDate, typeComposant: client_1.TypeComposant.PIECE_DE_SECURITE })).rejects.toThrow(/ne reste pas « non mise en service »/);
        expect(creations).toEqual([]);
    });
    it('la pièce de rechange peut attendre son intégration · sans date, acceptée', async () => {
        const { svc, creations } = harnais();
        const { dateMiseEnService: _d, ...sansDate } = ASCENSEUR;
        await svc.creer('t1', 'u1', { ...sansDate, typeComposant: client_1.TypeComposant.PIECE_DE_RECHANGE });
        expect(creations[0].dateMiseEnService).toBeNull();
    });
    it('la pièce de rechange, elle, démarre à son intégration · aucune date imposée', async () => {
        const { svc, creations } = harnais();
        await svc.creer('t1', 'u1', {
            ...ASCENSEUR,
            typeComposant: client_1.TypeComposant.PIECE_DE_RECHANGE,
            dateAcquisition: '2020-01-10',
            dateMiseEnService: '2024-09-15',
        });
        expect(creations[0].typeComposant).toBe(client_1.TypeComposant.PIECE_DE_RECHANGE);
    });
});
describe('ce qui n’est pas décomposable, et le texte que chacun cite', () => {
    const composantInformatique = { ...ASCENSEUR, immobilisationPrincipaleId: 'parc-info' };
    it('le SYCEBNL refuse en citant SA liste fermée', async () => {
        const { svc } = harnais({ referentiel: client_1.Referentiel.SYCEBNL, principal: ORDINATEURS });
        await expect(svc.creer('t1', 'u1', composantInformatique)).rejects.toThrow(/n’autorise la décomposition que pour/i);
    });
    it('le SYSCOHADA refuse en citant SA liste négative', async () => {
        const { svc } = harnais({ referentiel: client_1.Referentiel.SYSCOHADA, principal: ORDINATEURS });
        await expect(svc.creer('t1', 'u1', composantInformatique)).rejects.toThrow(/exclut nommément le matériel informatique/i);
    });
    it('aucun des deux messages ne cite le texte de l’autre', async () => {
        const message = async (referentiel) => {
            const { svc } = harnais({ referentiel, principal: ORDINATEURS });
            return svc.creer('t1', 'u1', composantInformatique).then(() => '', (e) => e.message);
        };
        const sycebnl = await message(client_1.Referentiel.SYCEBNL);
        const syscohada = await message(client_1.Referentiel.SYSCOHADA);
        expect(sycebnl).toContain('SYCEBNL');
        expect(sycebnl).not.toContain('AUDCIF');
        expect(syscohada).toContain('AUDCIF');
        expect(syscohada).not.toContain('SYCEBNL');
        expect(sycebnl).toContain('véhicules blindés');
        expect(syscohada).toContain('véhicules de tourisme');
    });
    it('un bâtiment reste décomposable dans les deux référentiels', async () => {
        for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            const { svc, creations } = harnais({ referentiel });
            await svc.creer('t1', 'u1', ASCENSEUR);
            expect(creations[0].immobilisationPrincipaleId).toBe('immeuble');
        }
    });
});
//# sourceMappingURL=approche-par-composants.spec.js.map