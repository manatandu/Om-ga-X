"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const heures_majorees_1 = require("./heures-majorees");
const majorations_heures_service_1 = require("./majorations-heures.service");
const personnel_service_1 = require("./personnel.service");
const majoration = (p = {}) => ({
    id: 'm-1',
    tenantId: 't',
    nature: 'HEURES_SUPPLEMENTAIRES',
    libelle: 'Heures supplémentaires',
    tauxPourCent: new client_1.Prisma.Decimal(30),
    source: 'Convention collective de la branche, art. 18',
    dateEffet: new Date('2026-01-01T00:00:00Z'),
    actif: true,
    ...p,
});
const db = (majorations) => ({
    majorationHeures: { findMany: jest.fn(async (a) => majorations.filter((m) => a.where.id.in.includes(m.id))) },
    rubriquePaie: { findMany: jest.fn().mockResolvedValue([]) },
});
describe('le montant des heures majorées', () => {
    it("l'heure supplémentaire se paie entière et majorée · 10 h × 3 750 × 1,30 = 48 750", () => {
        expect((0, heures_majorees_1.montantDesHeures)({ nature: 'HEURES_SUPPLEMENTAIRES', heures: 10, tauxHoraire: 3_750, tauxPourCent: 30 })).toBe(48_750);
    });
    it('la nuit, le samedi, le dimanche et le férié ne paient que le supplément · 8 h × 3 750 × 25 % = 7 500', () => {
        expect((0, heures_majorees_1.montantDesHeures)({ nature: 'TRAVAIL_DE_NUIT', heures: 8, tauxHoraire: 3_750, tauxPourCent: 25 })).toBe(7_500);
        expect((0, heures_majorees_1.montantDesHeures)({ nature: 'TRAVAIL_REPOS_OU_FERIE', heures: 8, tauxHoraire: 3_750, tauxPourCent: 100 })).toBe(30_000);
    });
    it('le libellé dit les heures, le taux horaire et la majoration (livre de paie, mentions 8 à 11)', () => {
        const l = (0, heures_majorees_1.libelleDesHeures)({ nature: 'HEURES_SUPPLEMENTAIRES', heures: 10, tauxHoraire: 3_750, tauxPourCent: 30, libelleMajoration: 'Heures supplémentaires' });
        expect(l).toContain('10 h');
        expect(l).toContain('majorées de 30 %');
    });
});
describe('un taux de majoration se déclare avec sa source', () => {
    const base = { nature: 'HEURES_SUPPLEMENTAIRES', libelle: 'Heures supplémentaires', tauxPourCent: 30, source: 'Convention collective', dateEffet: '2026-01-01' };
    it('sans source, avec un taux nul ou une nature inconnue, refus nommé', () => {
        expect((0, heures_majorees_1.motifRefusMajoration)(base)).toBeNull();
        expect((0, heures_majorees_1.motifRefusMajoration)({ ...base, source: '' })).toContain('art. 120, e)');
        expect((0, heures_majorees_1.motifRefusMajoration)({ ...base, tauxPourCent: 0 })).toContain('strictement positif');
        expect((0, heures_majorees_1.motifRefusMajoration)({ ...base, nature: 'PRIME' })).toContain('inconnue');
    });
});
describe('les heures que le bulletin porte, rejouées au serveur', () => {
    it('relit la majoration du dossier · désactivée, future ou inconnue, refusée', async () => {
        const [h] = await (0, majorations_heures_service_1.heuresAPorter)(db([majoration()]), 't', '2026-08', [{ majorationId: 'm-1', heures: 10, tauxHoraire: 3_750 }]);
        expect(h).toMatchObject({ montant: 48_750, tauxPourCent: 30, nature: 'HEURES_SUPPLEMENTAIRES' });
        await expect((0, majorations_heures_service_1.heuresAPorter)(db([majoration({ actif: false })]), 't', '2026-08', [{ majorationId: 'm-1', heures: 1, tauxHoraire: 1 }])).rejects.toThrow('désactivée');
        await expect((0, majorations_heures_service_1.heuresAPorter)(db([majoration({ dateEffet: new Date('2026-09-01T00:00:00Z') })]), 't', '2026-08', [{ majorationId: 'm-1', heures: 1, tauxHoraire: 1 }])).rejects.toThrow('après 2026-08');
        await expect((0, majorations_heures_service_1.heuresAPorter)(db([]), 't', '2026-08', [{ majorationId: 'm-1', heures: 1, tauxHoraire: 1 }])).rejects.toThrow('introuvable');
    });
    it("ajoute UNE prestation supplémentaire, même relue une seconde fois par l'émission", async () => {
        const svc = new personnel_service_1.PersonnelService(db([majoration()]));
        const saisie = {
            moisDePaie: '2026-08',
            elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }],
            heuresMajorees: [{ majorationId: 'm-1', heures: 10, tauxHoraire: 3_750 }],
        };
        const premiere = await svc.resoudreSaisie('t', null, saisie);
        const seconde = await svc.resoudreSaisie('t', null, premiere.dto);
        const heures = seconde.dto.elements.filter((e) => e.nature === 'PRESTATION_SUPPLEMENTAIRE');
        expect(heures).toHaveLength(1);
        expect(heures[0].montantFc).toBe(48_750);
    });
});
//# sourceMappingURL=heures-majorees.spec.js.map