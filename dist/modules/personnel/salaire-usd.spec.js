"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const personnel_service_1 = require("./personnel.service");
const conversion_usd_1 = require("./conversion-usd");
const TARD_LE_24_UTC = new Date('2026-09-24T23:30:00Z');
const MIDI_LE_24_UTC = new Date('2026-09-24T12:00:00Z');
function service(cours) {
    const lectures = [];
    const prisma = {
        salarie: { findFirst: jest.fn().mockResolvedValue(null) },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        versionBaremePaie: { findFirst: jest.fn().mockResolvedValue(null) },
        coursDevise: {
            findFirst: jest.fn(async (args) => {
                lectures.push(args.where);
                const cle = args.where.date.toISOString().slice(0, 10);
                return cle in cours ? { cours: cours[cle], source: 'BCC' } : null;
            }),
        },
    };
    return { svc: new personnel_service_1.PersonnelService(prisma), lectures };
}
const enUsd = (montantUsd) => ({
    moisDePaie: '2026-09',
    deviseStipulation: 'USD',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantUsd }],
});
const enFc = (montantFc) => ({
    moisDePaie: '2026-09',
    elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc }],
});
describe('salaire en USD · le cours du jour, et lui seul', () => {
    it('convertit au centime, sans arrondir au franc', () => {
        expect((0, conversion_usd_1.usdEnFc)(1234.57, 2850.33)).toBe(3518931.91);
    });
    it('le jour de Kinshasa bascule à 23 h UTC', () => {
        expect((0, conversion_usd_1.jourDeKinshasa)(TARD_LE_24_UTC).toISOString()).toBe('2026-09-25T00:00:00.000Z');
        expect((0, conversion_usd_1.jourDeKinshasa)(MIDI_LE_24_UTC).toISOString()).toBe('2026-09-24T00:00:00.000Z');
    });
    it('convertit au cours du jour, élément par élément, et le rend', async () => {
        const { svc, lectures } = service({ '2026-09-24': 2850.5 });
        const res = await svc.simulerPaie('t-1', null, enUsd(1200), MIDI_LE_24_UTC);
        expect(lectures[0]).toEqual({ date: new Date('2026-09-24T00:00:00Z'), devise: { tenantId: 't-1', code: 'USD' } });
        expect(res.conversion).toMatchObject({
            devise: 'USD',
            cours: 2850.5,
            dateCours: '2026-09-24',
            sourceCours: 'BCC',
            elements: [{ libelle: 'Salaire', montantUsd: 1200, montantFc: 3_420_600 }],
        });
        expect(res.conversion.avertissement).toContain('art. 89');
        expect(res.net.totalVerseFc).toBe(3_420_600);
    });
    it('donne exactement le calcul du même salaire saisi en francs', async () => {
        const { svc } = service({ '2026-09-24': 2850.5 });
        const usd = await svc.simulerPaie('t-1', null, enUsd(1200), MIDI_LE_24_UTC);
        const fc = await svc.simulerPaie('t-1', null, enFc((0, conversion_usd_1.usdEnFc)(1200, 2850.5)), MIDI_LE_24_UTC);
        const { conversion, ...resteUsd } = usd;
        const { conversion: aucune, ...resteFc } = fc;
        expect(conversion).not.toBeNull();
        expect(aucune).toBeNull();
        expect(resteUsd).toEqual(resteFc);
    });
    it('refuse sans cours du jour, même si le cours de la veille existe', async () => {
        const { svc } = service({ '2026-09-24': 2850.5 });
        const echec = svc.simulerPaie('t-1', null, enUsd(1200), TARD_LE_24_UTC);
        await expect(echec).rejects.toThrow(common_1.BadRequestException);
        await expect(svc.simulerPaie('t-1', null, enUsd(1200), TARD_LE_24_UTC)).rejects.toThrow(/Aucun cours du dollar américain \(USD\) n'est renseigné pour aujourd'hui, 25\/09\/2026/);
    });
    it('refuse un élément sans montant en dollars, et un montant en dollars hors stipulation USD', async () => {
        const { svc } = service({ '2026-09-24': 2850.5 });
        await expect(svc.simulerPaie('t-1', null, { ...enUsd(1200), elements: [{ nature: 'PRIME', libelle: 'Prime', montantFc: 10 }] }, MIDI_LE_24_UTC)).rejects.toThrow(/élément\(s\) sans montant en dollars : Prime/);
        await expect(svc.simulerPaie('t-1', null, { ...enUsd(1200), deviseStipulation: undefined }, MIDI_LE_24_UTC)).rejects.toThrow(/sans montant en francs : Salaire/);
    });
    it('T8 · arrondit au CENTIME SUPÉRIEUR dès qu’une fraction reste, jamais sur un produit exact', () => {
        expect((0, conversion_usd_1.usdEnFc)(100.01, 2850.33)).toBe(285_061.51);
        expect((0, conversion_usd_1.usdEnFc)(120.5, 2850.25)).toBe(343_455.13);
        expect((0, conversion_usd_1.usdEnFc)(0.1, 3)).toBe(0.3);
        expect((0, conversion_usd_1.usdEnFc)(500, 2850.25)).toBe(1_425_125);
    });
    it('T8 · lit le cours de la DATE DE MISE À DISPOSITION déclarée, et le dit', async () => {
        const { svc, lectures } = service({ '2026-09-24': 2850.5, '2026-09-30': 2900 });
        const res = await svc.simulerPaie('t-1', null, { ...enUsd(1200), dateMiseADisposition: '2026-09-30' }, MIDI_LE_24_UTC);
        expect(lectures[0]).toEqual({ date: new Date('2026-09-30T00:00:00Z'), devise: { tenantId: 't-1', code: 'USD' } });
        expect(res.conversion).toMatchObject({ cours: 2900, dateCours: '2026-09-30', origineDateCours: 'MISE_A_DISPOSITION' });
        expect(res.conversion.avertissementDate).toBeNull();
    });
    it('T8 · sans date de mise à disposition, le jour du calcul, avec l’avertissement', async () => {
        const { svc } = service({ '2026-09-24': 2850.5 });
        const res = await svc.simulerPaie('t-1', null, enUsd(1200), MIDI_LE_24_UTC);
        expect(res.conversion.origineDateCours).toBe('JOUR_DU_CALCUL');
        expect(res.conversion.avertissementDate).toContain('mise à disposition');
    });
    it('T8 · refuse une date de mise à disposition sans cours, sans reprendre un autre jour', async () => {
        const { svc } = service({ '2026-09-24': 2850.5 });
        await expect(svc.simulerPaie('t-1', null, { ...enUsd(1200), dateMiseADisposition: '2026-09-29' }, MIDI_LE_24_UTC)).rejects.toThrow(/pour le 29\/09\/2026, date de mise à disposition déclarée/);
    });
    it('un salaire en francs ne lit aucun cours', async () => {
        const { svc, lectures } = service({});
        const res = await svc.simulerPaie('t-1', null, enFc(1_000_000), MIDI_LE_24_UTC);
        expect(lectures).toEqual([]);
        expect(res.conversion).toBeNull();
    });
});
//# sourceMappingURL=salaire-usd.spec.js.map