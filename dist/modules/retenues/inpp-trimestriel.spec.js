"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retenues_service_1 = require("./retenues.service");
const correspondance_retenues_1 = require("./correspondance-retenues");
const inpp_trimestriel_1 = require("./inpp-trimestriel");
const cotisations_paie_1 = require("../personnel/cotisations-paie");
const jour = (d) => d.toISOString().slice(0, 10);
function ligne(numero, date, montant, charges = [], lettrage) {
    return {
        debit: montant.debit ?? 0,
        credit: montant.credit ?? 0,
        dateVersement: null,
        lettrageId: lettrage ?? null,
        compte: { numero, intitule: `Compte ${numero}` },
        ecriture: {
            date: new Date(date),
            libelle: 'Paie',
            reference: null,
            estGenereeParCloture: false,
            estSoldeDesComptesDeGestion: false,
            bulletinsPaie: [{ id: 'b1' }],
            bulletinsPaieRepris: [],
            lignes: charges.map((c, i) => ({ id: `c${i}`, debit: c.debit ?? 0, credit: c.credit ?? 0, compte: { numero: c.numero } })),
        },
    };
}
function service(lignes) {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        exercice: { findFirst: jest.fn().mockResolvedValue(null) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new retenues_service_1.RetenuesService(prisma);
}
const inppOnem = (r) => r.natures.find((n) => n.cle === 'inppOnem');
const paieDe = (date, inpp = 35_000, onem = 5_000) => ligne('44280000', date, { credit: inpp + onem }, [
    { numero: '64150000', debit: inpp },
    { numero: '64130000', debit: onem },
]);
describe("Ordonnance n° 84/186, art. 3 · les quatre échéances de l'INPP", () => {
    it('la table recopie le texte · 30 avril, 31 juillet, 31 octobre, 31 janvier de l’année suivante', () => {
        expect(inpp_trimestriel_1.ECHEANCES_TRIMESTRIELLES_INPP.map((e) => [e.moisZeroBase + 1, e.jour, e.anneeSuivante])).toEqual([
            [4, 30, false],
            [7, 31, false],
            [10, 31, false],
            [1, 31, true],
        ]);
    });
    it('chaque mois prend l’échéance de son trimestre civil', () => {
        expect(jour((0, inpp_trimestriel_1.echeanceTrimestrielleInpp)(2026, 0))).toBe('2026-04-30');
        expect(jour((0, inpp_trimestriel_1.echeanceTrimestrielleInpp)(2026, 2))).toBe('2026-04-30');
        expect(jour((0, inpp_trimestriel_1.echeanceTrimestrielleInpp)(2026, 3))).toBe('2026-07-31');
        expect(jour((0, inpp_trimestriel_1.echeanceTrimestrielleInpp)(2026, 8))).toBe('2026-10-31');
        expect(jour((0, inpp_trimestriel_1.echeanceTrimestrielleInpp)(2026, 11))).toBe('2027-01-31');
        expect(jour((0, inpp_trimestriel_1.echeanceTrimestrielleInpp)(2026, -1))).toBe('2026-01-31');
    });
    it('aucun report au jour ouvrable · le 31 janvier 2027, un dimanche, reste le 31', () => {
        expect(new Date(Date.UTC(2027, 0, 31)).getUTCDay()).toBe(0);
        expect(jour((0, inpp_trimestriel_1.echeanceTrimestrielleInpp)(2026, 11))).toBe('2027-01-31');
    });
    it('la prochaine échéance · le jour même est encore dans le délai', () => {
        expect(jour((0, inpp_trimestriel_1.prochaineEcheanceInpp)(new Date('2026-01-05')))).toBe('2026-01-31');
        expect(jour((0, inpp_trimestriel_1.prochaineEcheanceInpp)(new Date('2026-02-01')))).toBe('2026-04-30');
        expect(jour((0, inpp_trimestriel_1.prochaineEcheanceInpp)(new Date('2026-04-30')))).toBe('2026-04-30');
        expect(jour((0, inpp_trimestriel_1.prochaineEcheanceInpp)(new Date('2026-11-01')))).toBe('2027-01-31');
    });
});
describe('La dette du 4428 se ventile entre INPP et ONEM sur les charges de son écriture', () => {
    it('au prorata du 6415 et du 6413, au centime, la somme rendue entière', () => {
        const parts = (0, inpp_trimestriel_1.ventilerInppOnem)(40_000, '44280000', [
            { compte: { numero: '64150000' }, debit: 35_000, credit: 0 },
            { compte: { numero: '64130000' }, debit: 5_000, credit: 0 },
        ]);
        expect(parts).toEqual([
            { part: 'ONEM', montant: 5_000 },
            { part: 'INPP', montant: 35_000 },
        ]);
        const arrondi = (0, inpp_trimestriel_1.ventilerInppOnem)(100, '44280000', [
            { compte: { numero: '64150000' }, debit: 1, credit: 0 },
            { compte: { numero: '64130000' }, debit: 2, credit: 0 },
        ]);
        expect(arrondi.reduce((s, p) => s + p.montant, 0)).toBeCloseTo(100, 10);
    });
    it('les 4334 et 4335 d’un dossier ancien se lisent par leur intitulé', () => {
        expect((0, inpp_trimestriel_1.ventilerInppOnem)(1_000, '43340000', [])).toEqual([{ part: 'INPP', montant: 1_000 }]);
        expect((0, inpp_trimestriel_1.ventilerInppOnem)(1_000, '43350000', [])).toEqual([{ part: 'ONEM', montant: 1_000 }]);
    });
    it('sans charge lisible · NON VENTILÉE, jamais devinée', () => {
        expect((0, inpp_trimestriel_1.ventilerInppOnem)(1_000, '44280000', [])).toEqual([{ part: 'NON_VENTILEE', montant: 1_000 }]);
        expect((0, inpp_trimestriel_1.ventilerInppOnem)(1_000, '44280000', undefined)).toEqual([{ part: 'NON_VENTILEE', montant: 1_000 }]);
    });
});
describe('Le registre ne dit plus « en retard » au 16 du mois suivant une cotisation INPP', () => {
    it('la paie de janvier non reversée · au 16 février, seul l’ONEM est en retard', async () => {
        const n = inppOnem(await service([paieDe('2026-01-31')]).registre('t1', { exerciceId: 'e1', dateReference: '2026-02-16' }));
        const onem = n.mois.find((m) => m.part === 'ONEM');
        const inpp = n.mois.find((m) => m.part === 'INPP');
        expect(onem.retenu).toBe(5_000);
        expect(jour(onem.echeance)).toBe('2026-02-15');
        expect(onem.enRetard).toBe(true);
        expect(inpp.retenu).toBe(35_000);
        expect(jour(inpp.echeance)).toBe('2026-04-30');
        expect(inpp.enRetard).toBe(false);
        expect(n.moisEnRetard).toBe(1);
    });
    it('une paie d’INPP seul (sans ONEM) n’est pas en retard avant le 30 avril, l’est le 1er mai', async () => {
        const seul = [ligne('44280000', '2026-01-31', { credit: 35_000 }, [{ numero: '64150000', debit: 35_000 }])];
        const avant = inppOnem(await service(seul).registre('t1', { exerciceId: 'e1', dateReference: '2026-04-30' }));
        expect(avant.moisEnRetard).toBe(0);
        const apres = inppOnem(await service(seul).registre('t1', { exerciceId: 'e1', dateReference: '2026-05-01' }));
        expect(apres.moisEnRetard).toBe(1);
    });
    it('un reversement s’impute d’abord sur les échéances les plus proches · l’ONEM avant l’INPP du trimestre', async () => {
        const n = inppOnem(await service([
            paieDe('2026-01-31'),
            paieDe('2026-02-28'),
            ligne('44280000', '2026-03-14', { debit: 10_000 }),
        ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-03-16' }));
        expect(n.moisEnRetard).toBe(0);
        expect(n.mois.filter((m) => m.part === 'ONEM').every((m) => m.solde === 0)).toBe(true);
        expect(n.mois.filter((m) => m.part === 'INPP').reduce((s, m) => s + m.solde, 0)).toBe(70_000);
    });
    it('l’INPP et l’ONEM d’un même mois en retard comptent pour UN mois', async () => {
        const n = inppOnem(await service([paieDe('2026-01-31')]).registre('t1', { exerciceId: 'e1', dateReference: '2026-05-02' }));
        expect(n.mois.filter((m) => m.enRetard)).toHaveLength(2);
        expect(n.moisEnRetard).toBe(1);
    });
    it('une dette sans charge qui la ventile est datée au trimestre et nommée', async () => {
        const r = await service([ligne('44280000', '2026-01-31', { credit: 12_000 }, [])]).registre('t1', {
            exerciceId: 'e1',
            dateReference: '2026-02-16',
        });
        const n = inppOnem(r);
        expect(n.mois).toHaveLength(1);
        expect(n.mois[0].part).toBe('NON_VENTILEE');
        expect(jour(n.mois[0].echeance)).toBe('2026-04-30');
        expect(n.moisEnRetard).toBe(0);
        expect(n.mentionNonVentilee).toContain('12000.00 FC');
        expect(r.avertissements).toContain(n.mentionNonVentilee);
    });
    it('la prochaine échéance de la nature est la plus proche des deux', async () => {
        const n = inppOnem(await service([]).registre('t1', { exerciceId: 'e1', dateReference: '2026-04-20' }));
        expect(jour(n.prochaineEcheance)).toBe('2026-04-30');
        const m = inppOnem(await service([]).registre('t1', { exerciceId: 'e1', dateReference: '2026-05-02' }));
        expect(jour(m.prochaineEcheance)).toBe('2026-05-15');
    });
    it('une autre nature garde son échéance au mois (la CNSS au 15)', async () => {
        const r = await service([ligne('43110000', '2026-01-31', { credit: 10_000 })]).registre('t1', {
            exerciceId: 'e1',
            dateReference: '2026-02-16',
        });
        const cnss = r.natures.find((n) => n.cle === 'cnss');
        expect(jour(cnss.mois[0].echeance)).toBe('2026-02-15');
        expect(cnss.mois[0].part).toBeNull();
        expect(cnss.moisEnRetard).toBe(1);
    });
});
describe('Ordonnance n° 84/186, art. 4 · la majoration de retard est DITE, jamais calculée', () => {
    const nature = correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === 'inppOnem');
    it('la base légale et la réserve de la nature la nomment avec son article', () => {
        expect(nature.porteLInppTrimestriel).toBe(true);
        expect(nature.baseLegale).toContain('ordonnance n° 84/186 du 15 octobre 1984');
        expect(nature.baseLegale).toContain('0,5 pour mille par jour (art. 4)');
        expect(nature.reserve).toContain('ce registre n\'en chiffre aucun');
        expect(inpp_trimestriel_1.MAJORATION_RETARD_INPP).toContain('ce registre ne le chiffre pas');
    });
    it('le registre ne rend aucun montant de majoration', async () => {
        const n = inppOnem(await service([paieDe('2026-01-31')]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' }));
        expect(Object.keys(n).some((k) => /majoration/i.test(k))).toBe(false);
    });
});
describe('Ordonnance n° 84/186, art. 1er, al. 2 · la réduction du taux se DÉCLARE, au plus le quart', () => {
    it('le plafond est le quart du taux', () => {
        expect(inpp_trimestriel_1.FRACTION_MAXIMALE_REDUCTION_INPP).toBe(0.25);
        expect((0, inpp_trimestriel_1.motifRefusReductionInpp)(3.5, 0.875)).toBeNull();
        expect((0, inpp_trimestriel_1.motifRefusReductionInpp)(3.5, 0.9)).toContain('dépasse le quart du taux');
        expect((0, inpp_trimestriel_1.motifRefusReductionInpp)(3.5, 0)).not.toBeNull();
    });
    const inpp = (p) => (0, cotisations_paie_1.cotisations)(1_000_000, { moisDePaie: '2026-03', natureEmployeurInpp: 'PRIVE', effectif: 50, ...p });
    it('absente, aucune réduction · le barème entier', () => {
        expect(inpp({}).lignes.find((l) => l.cle === 'inpp').montantFc).toBeCloseTo(35_000, 6);
    });
    it('déclarée avec son acte · le taux réduit, et la réserve le dit', () => {
        const l = inpp({ reductionTauxInppPoints: 0.5, referenceReductionInpp: 'Décision ministérielle n° 001/2026' }).lignes.find((x) => x.cle === 'inpp');
        expect(l.tauxPourCent).toBeCloseTo(3, 10);
        expect(l.montantFc).toBeCloseTo(30_000, 6);
        expect(l.reserve).toContain('Décision ministérielle n° 001/2026');
        expect(l.reserve).toContain('art. 1er, al. 2');
    });
    it('sans acte, ou au-delà du quart · l’INPP s’abstient, motif nommé, jamais un taux minoré', () => {
        const sansActe = inpp({ reductionTauxInppPoints: 0.5 });
        expect(sansActe.lignes.find((l) => l.cle === 'inpp')).toBeUndefined();
        expect(sansActe.abstentions.join(' ')).toContain('référence de l’acte'.replace('’', "'"));
        const auDela = inpp({ reductionTauxInppPoints: 1, referenceReductionInpp: 'Décision n° 2' });
        expect(auDela.lignes.find((l) => l.cle === 'inpp')).toBeUndefined();
        expect(auDela.abstentions.join(' ')).toContain('dépasse le quart du taux');
    });
});
describe('Le solde d’ouverture de l’INPP et de l’ONEM se ventile sur l’exercice précédent', () => {
    const aNouveau = (montant) => ({
        ...ligne('44280000', '2027-01-01', { credit: montant }),
        ecriture: {
            date: new Date('2027-01-01'),
            libelle: 'Report à nouveau',
            reference: null,
            estGenereeParCloture: true,
            estSoldeDesComptesDeGestion: false,
            bulletinsPaie: [],
            bulletinsPaieRepris: [],
            lignes: [],
        },
    });
    const lignes2026 = [
        paieDe('2026-11-30'),
        paieDe('2026-12-31', 30_000, 5_000),
        ligne('44280000', '2026-12-14', { debit: 5_000 }),
    ];
    function deuxExercices(ouverture) {
        const lignes2027 = [aNouveau(ouverture), paieDe('2027-01-31'), ligne('44280000', '2027-01-10', { debit: 3_000 })];
        const prisma = {
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
            ligneEcriture: {
                findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.ecriture.exerciceId === 'e27' ? lignes2027 : where.ecriture.exerciceId === 'e26' ? lignes2026 : [])),
            },
            ecriture: {
                findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.date.lte.getUTCFullYear() === 2027 ? { date: new Date('2027-01-01'), exerciceId: 'e27' } : null)),
            },
            exercice: {
                findFirst: jest.fn().mockImplementation(({ where }) => {
                    if (where.id === 'e27')
                        return Promise.resolve({ dateDebut: new Date('2027-01-01') });
                    if (where.id === 'e26')
                        return Promise.resolve({ dateDebut: new Date('2026-01-01') });
                    if (where.dateFin && where.dateFin.lt.getUTCFullYear() === 2027)
                        return Promise.resolve({ id: 'e26' });
                    return Promise.resolve(null);
                }),
            },
            mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        };
        return new retenues_service_1.RetenuesService(prisma);
    }
    it('au 16 janvier 2027 · l’ONEM de décembre (2 000 restant) en retard, l’INPP du quatrième trimestre dû le 31 janvier', async () => {
        const n = inppOnem(await deuxExercices(70_000).registre('t1', { exerciceId: 'e27', dateReference: '2027-01-16' }));
        const ligneDe = (mois, part) => n.mois.find((m) => m.mois === mois && m.part === part);
        expect(ligneDe('2026-12', 'ONEM')).toMatchObject({ retenu: 5_000, reverse: 3_000, solde: 2_000, enRetard: true });
        expect(jour(ligneDe('2026-12', 'ONEM').echeance)).toBe('2027-01-15');
        expect(ligneDe('2026-11', 'INPP')).toMatchObject({ solde: 35_000, enRetard: false });
        expect(ligneDe('2026-12', 'INPP')).toMatchObject({ solde: 30_000, enRetard: false });
        expect(jour(ligneDe('2026-12', 'INPP').echeance)).toBe('2027-01-31');
        expect(n.moisEnRetard).toBe(1);
        expect(jour(n.prochaineEcheance)).toBe('2027-01-31');
    });
    it('au 1er février 2027 · l’INPP du quatrième trimestre (65 000) en retard, deux mois', async () => {
        const n = inppOnem(await deuxExercices(70_000).registre('t1', { exerciceId: 'e27', dateReference: '2027-02-01' }));
        expect(n.mois.filter((m) => m.enRetard).reduce((s, m) => s + m.solde, 0)).toBe(67_000);
        expect(n.moisEnRetard).toBe(2);
    });
    it('une ouverture que l’exercice précédent ne rend pas au centime reste en bloc, au trimestre, et c’est dit', async () => {
        const r = await deuxExercices(80_000).registre('t1', { exerciceId: 'e27', dateReference: '2027-01-16' });
        const n = inppOnem(r);
        const an = n.mois.filter((m) => m.anterieur);
        expect(an).toHaveLength(1);
        expect(jour(an[0].echeance)).toBe('2027-01-31');
        expect(n.moisEnRetard).toBe(0);
        expect(n.mentionOuvertureNonVentilee).toContain('80000.00 FC');
        expect(r.avertissements).toContain(n.mentionOuvertureNonVentilee);
    });
});
describe("L'échéancier sert DEUX lignes pour le 4428 · l'ONEM au mois, l'INPP au trimestre (relecture adverse, MAJEUR)", () => {
    const lignesDu4428 = async (lignes, dateReference) => {
        const r = await service(lignes).echeancierFiscal('t1', { exerciceId: 'e1', dateReference });
        return r.echeances.filter((e) => e.cle.startsWith('inppOnem'));
    };
    it('le 1er novembre, octobre seul impayé · 5 000 au 15 novembre (ONEM), 35 000 au 31 janvier (INPP), jamais 40 000 au 15 novembre', async () => {
        const l = await lignesDu4428([paieDe('2026-10-31')], '2026-11-01');
        expect(l.map((e) => e.cle).sort()).toEqual(['inppOnem-inpp', 'inppOnem-onem']);
        const onem = l.find((e) => e.cle === 'inppOnem-onem');
        const inpp = l.find((e) => e.cle === 'inppOnem-inpp');
        expect([jour(onem.date), onem.montantDu, onem.periodicite]).toEqual(['2026-11-15', 5_000, 'MENSUELLE']);
        expect([jour(inpp.date), inpp.montantDu, inpp.periodicite]).toEqual(['2027-01-31', 35_000, 'TRIMESTRIELLE']);
        expect(l.some((e) => e.montantDu === 40_000)).toBe(false);
    });
    it('après décembre, l’ONEM d’octobre et de novembre reversé · 5 000 au 15 janvier, 105 000 au 31 janvier', async () => {
        const l = await lignesDu4428([
            paieDe('2026-10-31'),
            paieDe('2026-11-30'),
            paieDe('2026-12-31'),
            ligne('44280000', '2026-11-10', { debit: 5_000 }),
            ligne('44280000', '2026-12-10', { debit: 5_000 }),
        ], '2027-01-01');
        const onem = l.find((e) => e.cle === 'inppOnem-onem');
        const inpp = l.find((e) => e.cle === 'inppOnem-inpp');
        expect([jour(onem.date), onem.montantDu, onem.moisEnRetard]).toEqual(['2027-01-15', 5_000, 0]);
        expect([jour(inpp.date), inpp.montantDu, inpp.moisEnRetard]).toEqual(['2027-01-31', 105_000, 0]);
    });
    it("l'ordre d'imputation cite son fondement et ses limites, sur la seule nature du 4428 (mineur c)", async () => {
        const r = await service([paieDe('2026-10-31')]).registre('t1', { exerciceId: 'e1', dateReference: '2026-11-01' });
        const n = r.natures.find((x) => x.cle === 'inppOnem');
        expect(n.reserveImputation).toBe(inpp_trimestriel_1.RESERVE_IMPUTATION_INPP_ONEM);
        expect(inpp_trimestriel_1.RESERVE_IMPUTATION_INPP_ONEM).toContain('Code civil, Livre III, art. 154');
        expect(inpp_trimestriel_1.RESERVE_IMPUTATION_INPP_ONEM).toContain('par analogie');
        expect(inpp_trimestriel_1.RESERVE_IMPUTATION_INPP_ONEM).toContain("l'INPP et l'ONEM sont deux organismes");
        const autres = r.natures.filter((x) => x.cle !== 'inppOnem');
        expect(autres.every((x) => x.reserveImputation === null)).toBe(true);
    });
    it('une part échue et impayée reste sur SA ligne, comptée en retard une fois', async () => {
        const l = await lignesDu4428([paieDe('2026-10-31')], '2026-11-16');
        const onem = l.find((e) => e.cle === 'inppOnem-onem');
        const inpp = l.find((e) => e.cle === 'inppOnem-inpp');
        expect([jour(onem.date), onem.montantDu, onem.moisEnRetard]).toEqual(['2026-12-15', 5_000, 1]);
        expect([inpp.montantDu, inpp.moisEnRetard]).toEqual([35_000, 0]);
    });
});
//# sourceMappingURL=inpp-trimestriel.spec.js.map