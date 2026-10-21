"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const balance_fonctionnelle_service_1 = require("./balance-fonctionnelle.service");
const j = (s) => new Date(`${s}T00:00:00.000Z`);
describe('le cours applicable · le dernier connu à la date ou avant', () => {
    const cours = [
        { date: j('2026-01-01'), cours: 2500 },
        { date: j('2026-06-01'), cours: 2800 },
        { date: j('2026-12-01'), cours: 3100 },
    ];
    it('retient le dernier cours antérieur ou égal', () => {
        expect(balance_fonctionnelle_service_1.BalanceFonctionnelleService.coursApplicable(cours, j('2026-06-01'))).toBe(2800);
        expect(balance_fonctionnelle_service_1.BalanceFonctionnelleService.coursApplicable(cours, j('2026-07-15'))).toBe(2800);
        expect(balance_fonctionnelle_service_1.BalanceFonctionnelleService.coursApplicable(cours, j('2026-12-31'))).toBe(3100);
    });
    it('ne prend JAMAIS un cours postérieur · l’état est historique, pas rétrospectif', () => {
        expect(balance_fonctionnelle_service_1.BalanceFonctionnelleService.coursApplicable(cours, j('2025-12-31'))).toBeNull();
        expect(balance_fonctionnelle_service_1.BalanceFonctionnelleService.coursApplicable(cours, j('2026-05-31'))).toBe(2500);
    });
    it('rend null quand aucun cours n’est connu', () => {
        expect(balance_fonctionnelle_service_1.BalanceFonctionnelleService.coursApplicable([], j('2026-06-01'))).toBeNull();
    });
    it('F155 · la mention imprimée dit la même règle que le calcul', () => {
        expect(balance_fonctionnelle_service_1.BalanceFonctionnelleService.MENTION_SANS_VALEUR_LEGALE).toContain('au cours en vigueur à sa date (le dernier saisi à cette date ou avant, jamais un postérieur)');
    });
});
describe('la conversion d’une ligne', () => {
    const ligne = (o = {}) => ({
        debit: 0,
        credit: 0,
        deviseCode: null,
        montantDevise: null,
        ...o,
    });
    it('divise par le cours · le cours dit combien vaut UNE unité en monnaie de tenue', () => {
        const r = balance_fonctionnelle_service_1.BalanceFonctionnelleService.convertirLigne(ligne({ debit: 2_800_000 }), 'USD', 2800);
        expect(r).toEqual({ debit: 1000, credit: 0, exacte: false });
    });
    it('prend le montant d’ORIGINE quand la ligne est déjà dans la monnaie fonctionnelle', () => {
        const r = balance_fonctionnelle_service_1.BalanceFonctionnelleService.convertirLigne(ligne({ debit: 28_000_000, deviseCode: 'USD', montantDevise: 10_000 }), 'USD', 2800);
        expect(r).toEqual({ debit: 10_000, credit: 0, exacte: true });
    });
    it('place le montant d’origine du bon côté · c’est le sens en monnaie de tenue qui le dit', () => {
        const r = balance_fonctionnelle_service_1.BalanceFonctionnelleService.convertirLigne(ligne({ credit: 28_000_000, deviseCode: 'USD', montantDevise: 10_000 }), 'USD', 2800);
        expect(r).toEqual({ debit: 0, credit: 10_000, exacte: true });
    });
    it('garde à une ligne inscrite en négatif son côté et son signe · jamais une contre-passation (AUDCIF art. 20)', () => {
        const r = balance_fonctionnelle_service_1.BalanceFonctionnelleService.convertirLigne(ligne({ credit: -28_000_000, deviseCode: 'USD', montantDevise: 10_000 }), 'USD', 2800);
        expect(r).toEqual({ debit: 0, credit: -10_000, exacte: true });
    });
    it('convertit une ligne libellée dans une AUTRE devise · seule la fonctionnelle est exacte', () => {
        const r = balance_fonctionnelle_service_1.BalanceFonctionnelleService.convertirLigne(ligne({ debit: 2_800_000, deviseCode: 'EUR', montantDevise: 900 }), 'USD', 2800);
        expect(r).toEqual({ debit: 1000, credit: 0, exacte: false });
    });
});
describe('la balance du second jeu', () => {
    function service(etat = {}) {
        const parEcriture = new Map();
        for (const { ecriture, ...reste } of etat.lignes ?? []) {
            const e = parEcriture.get(ecriture.id) ?? { id: ecriture.id, date: ecriture.date, lignes: [] };
            e.lignes.push(reste);
            parEcriture.set(ecriture.id, e);
        }
        const ecritures = [...parEcriture.values()].sort((a, b) => a.id.localeCompare(b.id));
        const prisma = {
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    devise: etat.devise === undefined ? 'CDF' : etat.devise,
                    deviseFonctionnelle: etat.deviseFonctionnelle === undefined ? 'USD' : etat.deviseFonctionnelle,
                }),
            },
            exercice: {
                findFirst: jest.fn().mockResolvedValue({ id: 'ex1', dateDebut: j('2026-01-01'), dateFin: j('2026-12-31') }),
            },
            devise: {
                findFirst: jest
                    .fn()
                    .mockResolvedValue(etat.deviseExiste === false ? null : { id: 'd1', code: 'USD', cours: etat.cours ?? [{ date: j('2026-01-01'), cours: 2500 }] }),
            },
            ecriture: {
                findMany: jest.fn(({ where, take, cursor, skip }) => {
                    const retenues = where.tenantId === 't1' && where.exerciceId === 'ex1' && !where.estGenereeParCloture ? ecritures : [];
                    const debut = cursor ? retenues.findIndex((e) => e.id === cursor.id) + (skip ?? 0) : 0;
                    return Promise.resolve(retenues.slice(debut, take === undefined ? undefined : debut + take));
                }),
            },
            ligneEcriture: {
                findFirst: jest.fn(({ where }) => Promise.resolve(where.ecriture.estGenereeParCloture ? null : (ecritures[0]?.lignes[0] ?? null))),
            },
        };
        return new balance_fonctionnelle_service_1.BalanceFonctionnelleService(prisma);
    }
    const ligne = (numero, debit, credit, ecritureId = 'e1', date = j('2026-03-01'), devise = null, montantDevise = null) => ({
        debit,
        credit,
        montantDevise,
        devise,
        ecriture: { id: ecritureId, date },
        compte: { id: `c${numero}`, numero, intitule: `Compte ${numero}` },
    });
    it('refuse quand aucune monnaie fonctionnelle n’est nommée', async () => {
        await expect(service({ deviseFonctionnelle: null }).balance('t1', 'ex1')).rejects.toThrow(/Aucune monnaie fonctionnelle/);
    });
    it('refuse quand elle est déjà la monnaie de tenue · rien à convertir', async () => {
        await expect(service({ deviseFonctionnelle: 'CDF' }).balance('t1', 'ex1')).rejects.toThrow(/déjà sa monnaie de tenue/);
    });
    it('refuse quand la devise n’existe pas au plan des devises', async () => {
        await expect(service({ deviseExiste: false }).balance('t1', 'ex1')).rejects.toThrow(/plan des devises/);
    });
    it('ARRÊTE l’état sur une date sans cours plutôt que d’inventer', async () => {
        const svc = service({
            cours: [{ date: j('2026-06-01'), cours: 2800 }],
            lignes: [ligne('60100000', 2_800_000, 0, 'e1', j('2026-03-01'))],
        });
        await expect(svc.balance('t1', 'ex1')).rejects.toThrow(/2026-03-01/);
        await expect(svc.balance('t1', 'ex1')).rejects.toThrow(/plausible et fausse/);
    });
    it('convertit chaque écriture au cours de SA date, et l’équilibre est conservé', async () => {
        const r = await service({
            cours: [
                { date: j('2026-01-01'), cours: 2500 },
                { date: j('2026-06-01'), cours: 2800 },
            ],
            lignes: [
                ligne('60100000', 2_500_000, 0, 'e1', j('2026-03-01')),
                ligne('40100000', 0, 2_500_000, 'e1', j('2026-03-01')),
                ligne('60100000', 2_800_000, 0, 'e2', j('2026-07-01')),
                ligne('40100000', 0, 2_800_000, 'e2', j('2026-07-01')),
            ],
        }).balance('t1', 'ex1');
        expect(r.totaux.debit).toBe(2000);
        expect(r.totaux.credit).toBe(2000);
        expect(r.totaux.ecartDeConversion).toBe(0);
        expect(r.lignes.find((l) => l.numero === '60100000')?.debit).toBe(2000);
    });
    it('MONTRE l’écart de conversion, jamais absorbé dans un compte', async () => {
        const r = await service({
            cours: [{ date: j('2026-01-01'), cours: 2500 }],
            lignes: [
                ligne('52100000', 2_600_000, 0, 'e1', j('2026-03-01'), { code: 'USD' }, 1_000),
                ligne('41100000', 0, 2_600_000, 'e1', j('2026-03-01')),
            ],
        }).balance('t1', 'ex1');
        expect(r.totaux.debit).toBe(1000);
        expect(r.totaux.credit).toBe(1040);
        expect(r.totaux.ecartDeConversion).toBe(-40);
        expect(r.lignes.map((l) => l.numero)).toEqual(['41100000', '52100000']);
    });
    it('compte les lignes prises à leur montant d’origine', async () => {
        const r = await service({
            cours: [{ date: j('2026-01-01'), cours: 2500 }],
            lignes: [
                ligne('52100000', 2_500_000, 0, 'e1', j('2026-03-01'), { code: 'USD' }, 1_000),
                ligne('41100000', 0, 2_500_000, 'e1', j('2026-03-01')),
            ],
        }).balance('t1', 'ex1');
        expect(r.origine).toEqual({ lignes: 2, lignesExactes: 1, lignesConverties: 1, ecritures: 1, ouverture: 'AUCUNE' });
    });
    it('porte la mention qui dit ce que l’état n’est pas', async () => {
        const r = await service({ lignes: [] }).balance('t1', 'ex1');
        expect(r.mention).toContain('SANS VALEUR LÉGALE');
        expect(r.mention).toContain('CDF');
        expect(r.mention).toContain('Aucun texte lu ne régit ce second jeu');
        expect(r.monnaie).toBe('USD');
    });
});
//# sourceMappingURL=balance-fonctionnelle.spec.js.map