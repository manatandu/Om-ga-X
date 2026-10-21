"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const taux_tva_service_1 = require("./taux-tva.service");
function service(referentiel, opts) {
    const tva = opts.tva ?? [];
    const classe7 = opts.classe7 ?? [];
    const requetesNumerateur = [];
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel }) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                const racine = compte?.numero?.startsWith;
                if (!racine)
                    return Promise.resolve([]);
                requetesNumerateur.push(where);
                return Promise.resolve(tva
                    .filter((l) => l.numero.startsWith(racine))
                    .map((l) => ({
                    credit: l.credit,
                    ecritureId: l.ecritureId ?? 'e1',
                    compte: { numero: l.numero },
                    tauxTva: { taux: l.taux },
                })));
            }),
            aggregate: jest.fn().mockImplementation(({ where }) => {
                const compte = where.compte;
                if (where.ecritureId) {
                    const ids = where.ecritureId.in;
                    const exclues = (compte?.NOT ?? []).map((c) => c.numero.startsWith);
                    const somme = classe7
                        .filter((l) => ids.includes(l.ecritureId ?? 'e1') && !exclues.some((r) => l.numero.startsWith(r)))
                        .reduce((s, l) => s + l.credit, 0);
                    return Promise.resolve({ _sum: { credit: somme } });
                }
                if (compte?.OR) {
                    const racines = compte.OR.map((c) => c.numero.startsWith);
                    const somme = classe7
                        .filter((l) => racines.some((r) => l.numero.startsWith(r)))
                        .reduce((s, l) => s + l.credit, 0);
                    return Promise.resolve({ _sum: { credit: somme } });
                }
                return Promise.resolve({ _sum: { credit: classe7.reduce((s, l) => s + l.credit, 0) } });
            }),
        },
    };
    return { svc: new taux_tva_service_1.TauxTvaService(prisma, {}), requetesNumerateur };
}
const DEBUT = new Date('2026-01-01');
const FIN = new Date('2026-12-31');
describe('Prorata · les exclusions du dénominateur (art. 43)', () => {
    it('la CESSION COURANTE d’immobilisation (754) sort du dénominateur en SYSCOHADA', async () => {
        const { svc: s } = service('SYSCOHADA', {
            tva: [{ numero: '44310000', credit: 16_000_000, taux: 16 }],
            classe7: [
                { numero: '70100000', credit: 100_000_000 },
                { numero: '70600000', credit: 20_000_000 },
                { numero: '75420000', credit: 30_000_000 },
            ],
        });
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.numerateur).toBe(100_000_000);
        expect(p.recettesClasse7).toBe(150_000_000);
        expect(p.recettesExclues).toBe(30_000_000);
        expect(p.denominateur).toBe(120_000_000);
        expect(p.pourcentage).toBe(84);
    });
    it('la PRODUCTION IMMOBILISÉE (72), les INDEMNITÉS D’ASSURANCE (7582) et les REPRISES DE SUBVENTIONS D’INVESTISSEMENT (799) en sortent aussi', async () => {
        const { svc: s } = service('SYSCOHADA', {
            tva: [{ numero: '44310000', credit: 16_000_000, taux: 16 }],
            classe7: [
                { numero: '70100000', credit: 100_000_000 },
                { numero: '72210000', credit: 10_000_000 },
                { numero: '75820000', credit: 5_000_000 },
                { numero: '79900000', credit: 25_000_000 },
            ],
        });
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.recettesExclues).toBe(40_000_000);
        expect(p.denominateur).toBe(100_000_000);
        expect(p.pourcentage).toBe(100);
    });
    it('la SUBVENTION D’EXPLOITATION (71) reste au dénominateur · l’article n’exclut que l’ÉQUIPEMENT', async () => {
        const { svc: s } = service('SYSCOHADA', {
            tva: [{ numero: '44310000', credit: 16_000_000, taux: 16 }],
            classe7: [
                { numero: '70100000', credit: 100_000_000 },
                { numero: '71810000', credit: 100_000_000 },
            ],
        });
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.recettesExclues).toBe(0);
        expect(p.denominateur).toBe(200_000_000);
        expect(p.pourcentage).toBe(50);
    });
    it('en SYCEBNL, le 754 « Dons en nature courants » RESTE au dénominateur', async () => {
        const { svc: s } = service('SYCEBNL', {
            tva: [{ numero: '44310000', credit: 16_000_000, taux: 16 }],
            classe7: [
                { numero: '70510000', credit: 100_000_000 },
                { numero: '75420000', credit: 100_000_000 },
            ],
        });
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.racinesExclues).not.toContain('754');
        expect(p.recettesExclues).toBe(0);
        expect(p.denominateur).toBe(200_000_000);
        expect(p.pourcentage).toBe(50);
    });
    it('la LIVRAISON À SOI-MÊME est exclue des DEUX termes', async () => {
        const { svc: s } = service('SYSCOHADA', {
            tva: [
                { numero: '44310000', credit: 16_000_000, taux: 16 },
                { numero: '44340000', credit: 8_000_000, taux: 16 },
            ],
            classe7: [
                { numero: '70100000', credit: 100_000_000 },
                { numero: '72210000', credit: 50_000_000 },
            ],
        });
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.numerateur).toBe(100_000_000);
        expect(p.denominateur).toBe(100_000_000);
        expect(p.pourcentage).toBe(100);
    });
    it('le numérateur ne lit QUE la TVA collectée · un avoir fournisseur n’est pas une recette', async () => {
        const { svc, requetesNumerateur } = service('SYSCOHADA', {
            tva: [
                { numero: '44310000', credit: 8_000_000, taux: 16 },
                { numero: '44520000', credit: 8_000_000, taux: 16 },
            ],
            classe7: [{ numero: '70100000', credit: 100_000_000 }],
        });
        const p = await svc.calculerProrata('t1', DEBUT, FIN);
        expect(requetesNumerateur).toHaveLength(1);
        expect(requetesNumerateur[0].compte.numero.startsWith).toBe('443');
        expect(p.numerateur).toBe(50_000_000);
        expect(p.pourcentage).toBe(50);
    });
    it('un rapport EXACT ne gagne pas un point par l’arrondi · 55 % reste 55 %', async () => {
        const { svc: s } = service('SYSCOHADA', {
            tva: [{ numero: '44310000', credit: 8_800_000, taux: 16 }],
            classe7: [{ numero: '70100000', credit: 100_000_000 }],
        });
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.numerateur).toBe(55_000_000);
        expect(p.pourcentage).toBe(55);
    });
    it('un rapport INEXACT est bien porté à l’unité supérieure', async () => {
        const { svc: s } = service('SYSCOHADA', {
            tva: [{ numero: '44310000', credit: 9_600_000, taux: 16 }],
            classe7: [{ numero: '70100000', credit: 121_000_000 }],
        });
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.pourcentage).toBe(50);
    });
    it('annonce ce qu’il a retranché ET ce qu’il n’a pas pu retrancher (les débours)', async () => {
        const { svc: s } = service('SYSCOHADA', {
            tva: [{ numero: '44310000', credit: 16_000_000, taux: 16 }],
            classe7: [
                { numero: '70100000', credit: 100_000_000 },
                { numero: '75420000', credit: 30_000_000 },
            ],
        });
        const p = await s.calculerProrata('t1', DEBUT, FIN);
        expect(p.mentionDenominateur).toContain('article 43');
        expect(p.mentionDenominateur).toContain('DÉBOURS');
        expect(p.racinesExclues).toEqual(expect.arrayContaining(['72', '7582', '799', '754']));
    });
});
//# sourceMappingURL=prorata-denominateur-tva.spec.js.map