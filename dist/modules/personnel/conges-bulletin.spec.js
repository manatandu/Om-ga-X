"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const personnel_service_1 = require("./personnel.service");
const conges_service_1 = require("./conges.service");
const conge = (p = {}) => ({
    id: 'c-1',
    tenantId: 't',
    salarieId: 's-1',
    du: new Date('2026-08-03T00:00:00Z'),
    au: new Date('2026-08-15T00:00:00Z'),
    joursVoyage: 0,
    moisDePaie: '2026-08',
    deviseAllocation: 'CDF',
    remunerationJournaliere: new client_1.Prisma.Decimal(20_000),
    moyenneMensuelleArticle142: new client_1.Prisma.Decimal(52_000),
    annuleLe: null,
    bulletin: null,
    ...p,
});
function prismaAvec(conges) {
    return {
        congeSalarie: {
            findMany: jest.fn(async (args) => conges.filter((c) => args.where.id.in.includes(c.id))),
        },
        rubriquePaie: { findMany: jest.fn().mockResolvedValue([]) },
        absenceSalarie: { findMany: jest.fn().mockResolvedValue([]) },
        contratTravail: { findMany: jest.fn().mockResolvedValue([]) },
    };
}
const saisie = (p = {}) => ({
    moisDePaie: '2026-08',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 300_000 }],
    allocationsConge: [{ congeId: 'c-1' }],
    ...p,
});
describe('le bulletin porte l’allocation de congé, rejouée au serveur', () => {
    it('ajoute UNE ligne, au montant du moteur · 12 jours × (20 000 + 52 000 / 26) = 264 000', async () => {
        const svc = new personnel_service_1.PersonnelService(prismaAvec([conge()]));
        const { dto } = await svc.resoudreSaisie('t', 's-1', saisie());
        const allocations = dto.elements.filter((e) => e.nature === 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE');
        expect(allocations).toHaveLength(1);
        expect(allocations[0].montantFc).toBe(264_000);
        expect(allocations[0].libelle).toContain('12 jour(s)');
    });
    it("relue une seconde fois (l'émission rejoue la simulation), la saisie n'ajoute pas l'allocation deux fois", async () => {
        const svc = new personnel_service_1.PersonnelService(prismaAvec([conge()]));
        const premiere = await svc.resoudreSaisie('t', 's-1', saisie());
        const seconde = await svc.resoudreSaisie('t', 's-1', premiere.dto);
        expect(seconde.dto.elements.filter((e) => e.nature === 'ALLOCATION_OU_INDEMNITE_COMPENSATOIRE_DE_CONGE')).toHaveLength(1);
        expect(seconde.dto.allocationsCongePortees).toHaveLength(1);
    });
    it('refuse un congé déjà porté par un bulletin actif, un congé d’un autre mois, un congé annulé', async () => {
        const porte = conge({ bulletin: { numero: 7, statut: client_1.StatutBulletinPaie.EMIS } });
        await expect((0, conges_service_1.allocationsAPorter)(prismaAvec([porte]), 't', 's-1', '2026-08', ['c-1'], 'CDF')).rejects.toThrow('bulletin n° 7');
        await expect((0, conges_service_1.allocationsAPorter)(prismaAvec([conge({ moisDePaie: '2026-07' })]), 't', 's-1', '2026-08', ['c-1'], 'CDF')).rejects.toThrow('rattachée au bulletin de 2026-07');
        await expect((0, conges_service_1.allocationsAPorter)(prismaAvec([conge({ annuleLe: new Date() })]), 't', 's-1', '2026-08', ['c-1'], 'CDF')).rejects.toThrow('annulé');
    });
    it("libère le congé d'un bulletin ANNULÉ · le bulletin réémis peut le porter", async () => {
        const libere = conge({ bulletin: { numero: 7, statut: client_1.StatutBulletinPaie.ANNULE } });
        const portees = await (0, conges_service_1.allocationsAPorter)(prismaAvec([libere]), 't', 's-1', '2026-08', ['c-1'], 'CDF');
        expect(portees).toHaveLength(1);
    });
    it('refuse une allocation non chiffrée, jamais un zéro, et une autre monnaie que le bulletin', async () => {
        await expect((0, conges_service_1.allocationsAPorter)(prismaAvec([conge({ moyenneMensuelleArticle142: null })]), 't', 's-1', '2026-08', ['c-1'], 'CDF')).rejects.toThrow('non chiffrée');
        await expect((0, conges_service_1.allocationsAPorter)(prismaAvec([conge()]), 't', 's-1', '2026-08', ['c-1'], 'USD')).rejects.toThrow('une seule monnaie');
    });
    it("refuse le congé d'un autre salarié", async () => {
        await expect((0, conges_service_1.allocationsAPorter)(prismaAvec([conge({ salarieId: 'autre' })]), 't', 's-1', '2026-08', ['c-1'], 'CDF')).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it("lie le congé au bulletin par une mise à jour unitaire, et refuse s'il a été porté entre-temps", async () => {
        const update = jest.fn().mockResolvedValue({});
        const tx = {
            congeSalarie: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', annuleLe: null, bulletin: null }), update },
        };
        const a = { congeId: 'c-1', du: '2026-08-03', au: '2026-08-15', jours: 12, tauxJournalier: 22_000, devise: 'CDF', montant: 264_000 };
        await (0, conges_service_1.lierCongesAuBulletin)(tx, 't', 'b-9', [a]);
        expect(update).toHaveBeenCalledWith({ where: { id: 'c-1' }, data: { bulletinId: 'b-9' } });
        const pris = {
            congeSalarie: { findFirst: jest.fn().mockResolvedValue({ id: 'c-1', annuleLe: null, bulletin: { numero: 3, statut: 'EMIS' } }), update },
        };
        await expect((0, conges_service_1.lierCongesAuBulletin)(pris, 't', 'b-9', [a])).rejects.toBeInstanceOf(common_1.ConflictException);
    });
});
describe('les propositions · jamais substituées', () => {
    it('ramène la rémunération au jour par les multiplicateurs du décret n° 25/22, art. 7', () => {
        const base = (montant, periodicite) => ({
            remunerationBase: new client_1.Prisma.Decimal(montant),
            periodiciteRemuneration: periodicite,
            deviseRemuneration: 'CDF',
        });
        expect((0, conges_service_1.tauxJournalierPropose)(base(520_000, 'MOIS'))).toMatchObject({ valeur: 20_000 });
        expect((0, conges_service_1.tauxJournalierPropose)(base(120_000, 'SEMAINE'))).toMatchObject({ valeur: 20_000 });
        expect((0, conges_service_1.tauxJournalierPropose)(base(6_240_000, 'ANNEE'))).toMatchObject({ valeur: 20_000 });
        expect((0, conges_service_1.tauxJournalierPropose)(base(20_000, 'JOUR'))).toMatchObject({ valeur: 20_000 });
        expect((0, conges_service_1.tauxJournalierPropose)({ ...base(520_000, 'MOIS'), periodiciteRemuneration: null })).toMatchObject({ valeur: null });
        expect((0, conges_service_1.tauxJournalierPropose)({ ...base(520_000, 'MOIS'), deviseRemuneration: null })).toMatchObject({ valeur: null });
    });
    it('un renouvellement ou un contrat qui suit sans un jour d’écart prolonge le service ; une interruption en ouvre un autre', () => {
        const c = (id, du, fin, renouvelleDeId = null) => ({
            id,
            dateEntreeEnVigueur: new Date(`${du}T00:00:00Z`),
            dateFin: fin ? new Date(`${fin}T00:00:00Z`) : null,
            renouvelleDeId,
            remunerationBase: null,
            periodiciteRemuneration: null,
            deviseRemuneration: null,
        });
        expect((0, conges_service_1.serviceEnCours)([c('a', '2024-01-01', '2024-12-31'), c('b', '2025-01-01', null)])?.origine.toISOString().slice(0, 10)).toBe('2024-01-01');
        expect((0, conges_service_1.serviceEnCours)([c('a', '2024-01-01', '2024-06-30'), c('b', '2025-01-01', null)])?.origine.toISOString().slice(0, 10)).toBe('2025-01-01');
        expect((0, conges_service_1.serviceEnCours)([c('a', '2024-01-01', '2024-06-30'), c('b', '2024-09-01', null, 'a')])?.origine.toISOString().slice(0, 10)).toBe('2024-01-01');
    });
});
//# sourceMappingURL=conges-bulletin.spec.js.map