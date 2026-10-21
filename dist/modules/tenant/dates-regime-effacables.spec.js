"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const parametres_dossier_dto_1 = require("./dto/parametres-dossier.dto");
const date_effacable_1 = require("./date-effacable");
const tenant_service_1 = require("./tenant.service");
const CHAMPS = ['dateOptionTva', 'dateAutorisationDebitsTva'];
const erreursSur = async (corps, champ) => (await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierRegimeDto, corps))).filter((e) => e.property === champ);
describe('F237 · la validation laisse passer l’effacement', () => {
    for (const champ of CHAMPS) {
        it(`${champ} · la chaîne vide passe, une date ISO aussi, un texte libre non`, async () => {
            expect(await erreursSur({ [champ]: '' }, champ)).toHaveLength(0);
            expect(await erreursSur({ [champ]: '2026-03-01' }, champ)).toHaveLength(0);
            expect(await erreursSur({ [champ]: '1er mars' }, champ)).not.toHaveLength(0);
            expect(await erreursSur({ [champ]: '   ' }, champ)).not.toHaveLength(0);
        });
    }
});
describe('F237 · la conversion au service', () => {
    it('absent = inchangé, vide ou null = effacé, sinon la date saisie', () => {
        expect((0, date_effacable_1.dateSaisieOuEffacement)(undefined)).toBeUndefined();
        expect((0, date_effacable_1.dateSaisieOuEffacement)('')).toBeNull();
        expect((0, date_effacable_1.dateSaisieOuEffacement)('  ')).toBeNull();
        expect((0, date_effacable_1.dateSaisieOuEffacement)(null)).toBeNull();
        expect((0, date_effacable_1.dateSaisieOuEffacement)('2026-03-01').toISOString()).toBe('2026-03-01T00:00:00.000Z');
    });
    it('une date que `new Date` ne lit pas est refusée en 400, jamais transmise', () => {
        for (const illisible of ['2026-W05', '2026-032', '20260101']) {
            expect(() => (0, date_effacable_1.dateSaisieOuEffacement)(illisible)).toThrow(common_1.BadRequestException);
        }
    });
    it('un jour absent du calendrier est refusé, jamais reporté au mois suivant', () => {
        expect(() => (0, date_effacable_1.dateSaisieOuEffacement)('2026-02-30')).toThrow(common_1.BadRequestException);
        expect(() => (0, date_effacable_1.dateSaisieOuEffacement)('2026-04-31T00:00:00.000Z')).toThrow(common_1.BadRequestException);
        expect(() => (0, date_effacable_1.dateSaisieOuEffacement)('2025-02-29')).toThrow(common_1.BadRequestException);
        expect((0, date_effacable_1.dateSaisieOuEffacement)('2028-02-29').toISOString()).toBe('2028-02-29T00:00:00.000Z');
        expect((0, date_effacable_1.dateSaisieOuEffacement)('2026-03-01T00:30:00+01:00').toISOString()).toBe('2026-02-28T23:30:00.000Z');
    });
});
describe('F237 · ce que le DTO laisse passer, le service doit le lire', () => {
    for (const champ of CHAMPS) {
        it(`${champ} · les formes que new Date ne lit pas franchissent la validation`, async () => {
            for (const forme of ['2026-W05', '2026-02-30']) {
                expect(await erreursSur({ [champ]: forme }, champ)).toHaveLength(0);
            }
        });
    }
});
describe('F237 · câblage de modifierRegime', () => {
    const service = () => {
        const appels = [];
        const prisma = {
            tenant: {
                findUnique: async ({ where }) => (where.id === 't1' ? { id: 't1' } : null),
                update: async (args) => {
                    appels.push(args);
                    return { id: 't1' };
                },
            },
        };
        const s = new tenant_service_1.TenantService(prisma);
        s.parametres = async () => null;
        return { s, appels };
    };
    it('la chaîne vide écrit null sur les deux dates', async () => {
        const { s, appels } = service();
        await s.modifierRegime('t1', { dateOptionTva: '', dateAutorisationDebitsTva: '' });
        expect(appels).toHaveLength(1);
        expect(appels[0].where).toEqual({ id: 't1' });
        expect(appels[0].data.dateOptionTva).toBeNull();
        expect(appels[0].data.dateAutorisationDebitsTva).toBeNull();
    });
    it('null écrit null, jamais le 1er janvier 1970', async () => {
        const { s, appels } = service();
        await s.modifierRegime('t1', { dateOptionTva: null, dateAutorisationDebitsTva: null });
        expect(appels[0].data.dateOptionTva).toBeNull();
        expect(appels[0].data.dateAutorisationDebitsTva).toBeNull();
    });
    it('une date ISO est posée telle quelle', async () => {
        const { s, appels } = service();
        await s.modifierRegime('t1', { dateOptionTva: '2025-07-01', dateAutorisationDebitsTva: '2026-02-16' });
        expect(appels[0].data.dateOptionTva.toISOString().slice(0, 10)).toBe('2025-07-01');
        expect(appels[0].data.dateAutorisationDebitsTva.toISOString().slice(0, 10)).toBe('2026-02-16');
    });
    it('une date non transmise n’est pas touchée', async () => {
        const { s, appels } = service();
        await s.modifierRegime('t1', { effectifPermanent: 12 });
        expect(appels[0].data).not.toHaveProperty('dateOptionTva');
        expect(appels[0].data).not.toHaveProperty('dateAutorisationDebitsTva');
        expect(appels[0].data.effectifPermanent).toBe(12);
    });
    it('une date illisible est refusée en 400 avant toute écriture', async () => {
        const { s, appels } = service();
        await expect(s.modifierRegime('t1', { dateOptionTva: '2026-W05' })).rejects.toThrow(common_1.BadRequestException);
        await expect(s.modifierRegime('t1', { dateAutorisationDebitsTva: '2026-02-30' })).rejects.toThrow(common_1.BadRequestException);
        expect(appels).toHaveLength(0);
    });
    it('un autre dossier est introuvable, rien n’est écrit', async () => {
        const { s, appels } = service();
        await expect(s.modifierRegime('t2', { dateOptionTva: '' })).rejects.toThrow('Dossier introuvable');
        expect(appels).toHaveLength(0);
    });
});
describe('F237 · le jumeau · les deux dates de l’identité (audit de cohérence du lot)', () => {
    const service = (referentiel = 'SYCEBNL') => {
        const appels = [];
        const prisma = {
            tenant: {
                findUnique: async ({ where }) => (where.id === 't1' ? { id: 't1', referentiel } : null),
                update: async (args) => {
                    appels.push(args);
                    return { id: 't1' };
                },
            },
        };
        const s = new tenant_service_1.TenantService(prisma);
        s.parametres = async () => null;
        return { s, appels };
    };
    it('une date illisible ou absente du calendrier est refusée en 400, avant toute écriture', async () => {
        const { s, appels } = service();
        await expect(s.modifierIdentite('t1', { dateActePersonnalite: '2026-W05' })).rejects.toThrow(common_1.BadRequestException);
        await expect(s.modifierIdentite('t1', { dateAttestationExemptionIs: '2026-02-30' })).rejects.toThrow(common_1.BadRequestException);
        expect(appels).toHaveLength(0);
    });
    it('vide ou null efface, une date ISO se pose, absente ne touche à rien', async () => {
        const { s, appels } = service();
        await s.modifierIdentite('t1', { dateActePersonnalite: '', dateAttestationExemptionIs: null });
        expect(appels[0].data.dateActePersonnalite).toBeNull();
        expect(appels[0].data.dateAttestationExemptionIs).toBeNull();
        await s.modifierIdentite('t1', { dateActePersonnalite: '2025-06-30' });
        expect(appels[1].data.dateActePersonnalite.toISOString()).toBe('2025-06-30T00:00:00.000Z');
        expect(appels[1].data.dateAttestationExemptionIs).toBeUndefined();
    });
    it('un identifiant à null s’efface au lieu de lever une TypeError, et ne passe pas pour renseigné', async () => {
        const { s, appels } = service('SYSCOHADA');
        await s.modifierIdentite('t1', { numeroImpot: null, dateActePersonnalite: null });
        expect(appels[0].data.numeroImpot).toBeNull();
        expect(appels[0].data.dateActePersonnalite).toBeNull();
    });
});
//# sourceMappingURL=dates-regime-effacables.spec.js.map