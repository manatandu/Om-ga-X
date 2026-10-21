"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const exonerations_service_1 = require("./exonerations.service");
const correspondance_exonerations_1 = require("./correspondance-exonerations");
function dossier(o) {
    return {
        id: `d-${o.type}`,
        tenantId: 't1',
        type: o.type,
        statut: o.statut ?? 'EN_PREPARATION',
        objet: 'Lot de médicaments',
        referenceArrete: null,
        dateArrete: null,
        dateDebutValidite: null,
        dateFinValidite: o.dateFinValidite === undefined ? null : o.dateFinValidite ? new Date(o.dateFinValidite) : null,
        lettreTransport: null,
        valeurBiens: null,
        franchiseDouaniere: null,
        piecesFournies: o.piecesFournies ?? [],
        observations: null,
        createdAt: new Date('2026-01-01'),
        createdBy: 'u1',
        updatedAt: new Date('2026-01-01'),
    };
}
function service(dossiers, creation) {
    const prisma = {
        exoneration: {
            findMany: jest.fn().mockResolvedValue(dossiers),
            count: jest.fn().mockResolvedValue(dossiers.length),
            create: creation ?? jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
            findFirst: jest.fn().mockResolvedValue(dossiers[0] ?? null),
            update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
            delete: jest.fn().mockResolvedValue({}),
        },
    };
    return new exonerations_service_1.ExonerationsService(prisma);
}
describe('Référentiel des demandes (note circulaire n° 003/2013)', () => {
    it('porte les trois dossiers du texte, avec le nombre de pièces de chacun', () => {
        const types = correspondance_exonerations_1.MODELES_DEMANDE.map((m) => m.type);
        expect(types).toEqual(['PONCTUEL', 'PREVISIONNEL', 'RENOUVELLEMENT']);
        expect(correspondance_exonerations_1.MODELES_DEMANDE[0].pieces).toHaveLength(13);
        expect(correspondance_exonerations_1.MODELES_DEMANDE[1].pieces).toHaveLength(11);
        expect(correspondance_exonerations_1.MODELES_DEMANDE[2].pieces).toHaveLength(4);
    });
    it('seul l’arrêté prévisionnel (et son renouvellement) a une durée de validité', () => {
        expect(correspondance_exonerations_1.MODELES_DEMANDE.find((m) => m.type === 'PONCTUEL').validiteMois).toBeNull();
        expect(correspondance_exonerations_1.MODELES_DEMANDE.find((m) => m.type === 'PREVISIONNEL').validiteMois).toBe(24);
        expect(correspondance_exonerations_1.MODELES_DEMANDE.find((m) => m.type === 'RENOUVELLEMENT').validiteMois).toBe(24);
    });
    it('rappelle qu’aucune franchise ne se présume (code des douanes, art. 338)', () => {
        const r = service([]).referentiel();
        expect(r.avertissement).toContain('art. 338');
        expect(r.avertissement).toContain('ne se présume');
    });
});
describe('Pièces manquantes', () => {
    it('un dossier vide manque toutes les pièces NON conditionnelles', async () => {
        const r = await service([dossier({ type: 'RENOUVELLEMENT' })]).lister('t1', '2026-06-01');
        expect(r.dossiers[0].complet).toBe(false);
        expect(r.dossiers[0].piecesManquantes).toHaveLength(4);
        expect(r.incomplets).toBe(1);
    });
    it('une pièce CONDITIONNELLE non fournie ne rend pas le dossier incomplet', async () => {
        const toutesSaufConditionnelles = correspondance_exonerations_1.MODELES_DEMANDE.find((m) => m.type === 'PONCTUEL')
            .pieces.filter((p) => !p.conditionnelle)
            .map((p) => p.cle);
        const r = await service([
            dossier({ type: 'PONCTUEL', piecesFournies: toutesSaufConditionnelles }),
        ]).lister('t1', '2026-06-01');
        expect(r.dossiers[0].complet).toBe(true);
        expect(r.dossiers[0].piecesManquantes).toHaveLength(0);
        expect(r.dossiers[0].conditionnellesAVerifier).toHaveLength(2);
        expect(r.dossiers[0].conditionnellesAVerifier[0].condition).toBeTruthy();
    });
});
describe('Échéance de renouvellement', () => {
    it('alerte soixante jours avant l’expiration, pas trente', async () => {
        expect(correspondance_exonerations_1.JOURS_ALERTE_RENOUVELLEMENT).toBe(60);
        const r = await service([
            dossier({ type: 'PREVISIONNEL', statut: 'ACCORDE', dateFinValidite: '2026-07-15' }),
        ]).lister('t1', '2026-06-01');
        expect(r.dossiers[0].alerte).toBe('A_RENOUVELER');
        expect(r.dossiers[0].joursAvantExpiration).toBe(44);
        expect(r.aRenouveler).toBe(1);
    });
    it('un arrêté encore loin de son terme ne déclenche rien', async () => {
        const r = await service([
            dossier({ type: 'PREVISIONNEL', statut: 'ACCORDE', dateFinValidite: '2027-01-15' }),
        ]).lister('t1', '2026-06-01');
        expect(r.dossiers[0].alerte).toBeNull();
        expect(r.aRenouveler).toBe(0);
    });
    it('un arrêté périmé est signalé comme tel, avec un compte à rebours négatif', async () => {
        const r = await service([
            dossier({ type: 'PREVISIONNEL', statut: 'ACCORDE', dateFinValidite: '2026-05-01' }),
        ]).lister('t1', '2026-06-01');
        expect(r.dossiers[0].alerte).toBe('EXPIRE');
        expect(r.dossiers[0].joursAvantExpiration).toBeLessThan(0);
        expect(r.expires).toBe(1);
    });
    it('un dossier NON ACCORDÉ n’a pas d’échéance · il n’y a pas de titre à renouveler', async () => {
        const r = await service([
            dossier({ type: 'PREVISIONNEL', statut: 'DEPOSE', dateFinValidite: '2026-06-10' }),
        ]).lister('t1', '2026-06-01');
        expect(r.dossiers[0].alerte).toBeNull();
        expect(r.dossiers[0].joursAvantExpiration).toBeNull();
    });
});
describe('Création', () => {
    it('déduit la fin de validité du début et de la durée du texte (deux ans)', async () => {
        const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
        const s = service([], create);
        await s.creer('t1', 'u1', {
            type: 'PREVISIONNEL',
            objet: 'Importations récurrentes 2026',
            dateDebutValidite: '2026-03-01',
        });
        const data = create.mock.calls[0][0].data;
        expect(data.dateFinValidite.toISOString().slice(0, 10)).toBe('2028-03-01');
    });
    it('borne la fin de validité au dernier jour du mois', async () => {
        const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
        await service([], create).creer('t1', 'u1', {
            type: 'PREVISIONNEL',
            objet: 'Importations récurrentes 2024',
            dateDebutValidite: '2024-02-29',
        });
        expect(create.mock.calls[0][0].data.dateFinValidite.toISOString().slice(0, 10)).toBe('2026-02-28');
    });
    it('un arrêté ponctuel n’a pas de fin de validité · il s’épuise avec son opération', async () => {
        const create = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
        await service([], create).creer('t1', 'u1', {
            type: 'PONCTUEL',
            objet: 'Conteneur de vivres',
            dateDebutValidite: '2026-03-01',
        });
        expect(create.mock.calls[0][0].data.dateFinValidite).toBeNull();
    });
});
describe('F123 · un arrêté accordé se dit par sa référence et ses dates', () => {
    it('refuse le passage à ACCORDÉ sans référence, sans date d’arrêté ou, à durée, sans début de validité', async () => {
        const s = service([dossier({ type: 'PREVISIONNEL' })]);
        await expect(s.modifier('t1', 'd-PREVISIONNEL', { statut: 'ACCORDE' })).rejects.toThrow(/référence de l’arrêté.*date de l’arrêté.*début de validité/);
        await expect(s.modifier('t1', 'd-PREVISIONNEL', { statut: 'ACCORDE', referenceArrete: 'n° 12/2026', dateArrete: '2026-03-01' })).rejects.toThrow(/début de validité/);
    });
    it('au passage à ACCORDÉ, la fin de validité se déduit du début · l’alerte de renouvellement s’arme', async () => {
        const update = jest.fn().mockImplementation(({ data }) => Promise.resolve(data));
        const s = service([dossier({ type: 'PREVISIONNEL' })]);
        (s.prisma.exoneration.update = update);
        await s.modifier('t1', 'd-PREVISIONNEL', {
            statut: 'ACCORDE',
            referenceArrete: 'n° 12/2026',
            dateArrete: '2026-03-01',
            dateDebutValidite: '2026-03-01',
        });
        expect(update.mock.calls[0][0].data.dateFinValidite.toISOString().slice(0, 10)).toBe('2028-03-01');
    });
    it('un arrêté ponctuel s’accorde sans début de validité, et une pièce cochée sur un dossier accordé n’est pas refusée', async () => {
        const s = service([dossier({ type: 'PONCTUEL' })]);
        await expect(s.modifier('t1', 'd-PONCTUEL', { statut: 'ACCORDE', referenceArrete: 'n° 3/2026', dateArrete: '2026-03-01' })).resolves.toBeDefined();
        const accorde = service([dossier({ type: 'PREVISIONNEL', statut: 'ACCORDE' })]);
        await expect(accorde.modifier('t1', 'd-PREVISIONNEL', { piecesFournies: ['requete'] })).resolves.toBeDefined();
    });
    it('à la création aussi, un dossier ne naît pas ACCORDÉ sans son arrêté', async () => {
        await expect(service([]).creer('t1', 'u1', { type: 'PONCTUEL', objet: 'x', statut: 'ACCORDE' })).rejects.toThrow(/référence de l’arrêté/);
    });
});
//# sourceMappingURL=exonerations.spec.js.map