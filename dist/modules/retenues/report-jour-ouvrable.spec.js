"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retenues_service_1 = require("./retenues.service");
const correspondance_retenues_1 = require("./correspondance-retenues");
const jour_ouvrable_1 = require("./jour-ouvrable");
const fs_1 = require("fs");
const child_process_1 = require("child_process");
const path_1 = require("path");
function ligne(numero, date, montant) {
    return {
        debit: montant.debit ?? 0,
        credit: montant.credit ?? 0,
        dateVersement: null,
        compte: { numero, intitule: `Compte ${numero}` },
        ecriture: { date: new Date(date), libelle: 'Écriture', reference: null },
    };
}
function service(lignes) {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYCEBNL' }) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        exercice: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    return new retenues_service_1.RetenuesService(prisma);
}
const moisDe = (r, cle) => r.natures.find((n) => n.cle === cle);
describe('Report au premier jour ouvrable · art. 110 bis, alinéa 2', () => {
    describe('la règle · trois exclusions, trois sources, trois bornes', () => {
        it('le DIMANCHE est non ouvrable de tout temps · Code du travail, art. 121, alinéa 2', () => {
            expect(new Date(2026, 1, 15).getDay()).toBe(0);
            expect((0, jour_ouvrable_1.estJourOuvrable)(new Date(2026, 1, 15))).toBe(false);
            expect(new Date(2020, 0, 5).getDay()).toBe(0);
            expect((0, jour_ouvrable_1.estJourOuvrable)(new Date(2020, 0, 5))).toBe(false);
        });
        it("LE SAMEDI N'EST PAS OUVRABLE · les services publics travaillent du lundi au vendredi", () => {
            expect(new Date(2026, 6, 25).getDay()).toBe(6);
            expect((0, jour_ouvrable_1.estJourOuvrable)(new Date(2026, 6, 25))).toBe(false);
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(new Date(2026, 6, 25))).toEqual(new Date(2026, 6, 27));
        });
        it("UN PUR PAIEMENT GARDE SON SAMEDI · décision de Manasse du 2026-10-04 (LPF art. 110 bis, al. 2)", () => {
            const j = (a, m, d) => new Date(Date.UTC(a, m, d));
            expect((0, jour_ouvrable_1.estJourOuvrable)(j(2026, 6, 25), 'PAIEMENT')).toBe(true);
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(j(2026, 6, 25), 'PAIEMENT')).toEqual(j(2026, 6, 25));
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(j(2026, 6, 26), 'PAIEMENT')).toEqual(j(2026, 6, 27));
            expect(j(2027, 11, 25).getUTCDay()).toBe(6);
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(j(2027, 11, 25), 'PAIEMENT')).toEqual(j(2027, 11, 27));
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(j(2026, 6, 25))).toEqual(j(2026, 6, 27));
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain("décision de l'éditeur du 2026-10-04 qu'aucun texte lu ne fonde");
        });
        it('la seconde quotité de la petite entreprise, « acquittée à l’aide d’un bordereau de versement », est un PUR PAIEMENT', () => {
            expect(correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'secondeQuotitePetiteEntreprise').natureEcheance).toBe('PAIEMENT');
        });
        it('une échéance annuelle se compare REPORTÉE · le 30 avril 2028 (dimanche, 1er mai férié) tient jusqu’au 2 mai', () => {
            const declaration = correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'declarationImpotSocietes');
            const svc = service([]);
            expect(new Date(Date.UTC(2028, 3, 30)).getUTCDay()).toBe(0);
            expect(svc.prochaineEcheanceDeclarative(declaration, new Date(Date.UTC(2028, 4, 1))).toISOString().slice(0, 10)).toBe('2028-05-02');
            expect(svc.prochaineEcheanceDeclarative(declaration, new Date(Date.UTC(2028, 4, 3))).toISOString().slice(0, 10)).toBe('2029-04-30');
        });
        it("les trois acomptes de l'art. 57 bis sont des PURS PAIEMENTS, et l'échéancier sert le samedi 25 juillet 2026", () => {
            const acompte = correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'premierAcompteIs');
            for (const cle of ['premierAcompteIs', 'deuxiemeAcompteIs', 'troisiemeAcompteIs']) {
                expect(correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === cle).natureEcheance).toBe('PAIEMENT');
            }
            expect(correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'declarationImpotSocietes').natureEcheance).toBeUndefined();
            const svc = service([]);
            expect(svc.prochaineEcheanceDeclarative(acompte, new Date(Date.UTC(2026, 6, 1))).toISOString()).toBe('2026-07-25T00:00:00.000Z');
        });
        it("le samedi n'est fermé QU'À COMPTER du 17 février 2024 · avant, le texte n'est pas au corpus", () => {
            const avant = new Date(2024, 1, 10);
            expect(avant.getDay()).toBe(6);
            expect((0, jour_ouvrable_1.estJourOuvrable)(avant)).toBe(true);
            const apres = new Date(2024, 1, 24);
            expect(apres.getDay()).toBe(6);
            expect((0, jour_ouvrable_1.estJourOuvrable)(apres)).toBe(false);
        });
        it('reporte un dimanche au lundi qui suit, et ne touche pas un jour ouvrable', () => {
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(new Date(2026, 1, 15))).toEqual(new Date(2026, 1, 16));
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(new Date(2026, 1, 17))).toEqual(new Date(2026, 1, 17));
        });
        it('NE MUTE JAMAIS la date reçue · les appelants gardent des échéances calculées ailleurs', () => {
            const origine = new Date(2026, 1, 15);
            (0, jour_ouvrable_1.reporterAuJourOuvrable)(origine);
            expect(origine).toEqual(new Date(2026, 1, 15));
        });
    });
    describe('les jours fériés · ordonnance n° 23-042 du 30 mars 2023', () => {
        it("la liste compte DIX jours, tous à date FIXE · l'art. 1er la ferme", () => {
            expect(jour_ouvrable_1.JOURS_FERIES).toHaveLength(10);
            expect(jour_ouvrable_1.JOURS_FERIES.map((f) => `${f.mois}-${f.jour}`)).toEqual([
                '1-1',
                '1-4',
                '1-16',
                '1-17',
                '4-6',
                '5-1',
                '5-17',
                '6-30',
                '8-1',
                '12-25',
            ]);
        });
        it('un VENDREDI férié est reporté au lundi · Noël 2026 tombe un vendredi', () => {
            const noel = new Date(2026, 11, 25);
            expect(noel.getDay()).toBe(5);
            expect((0, jour_ouvrable_1.jourFerie)(noel)).toBe('Noël');
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(noel)).toEqual(new Date(2026, 11, 28));
        });
        it('le report CHAÎNE dimanche et férié · 3 janvier 2027 est un dimanche, le 4 est la Journée des Martyrs', () => {
            expect(new Date(2027, 0, 3).getDay()).toBe(0);
            expect((0, jour_ouvrable_1.jourFerie)(new Date(2027, 0, 4))).toContain('Martyrs');
            expect((0, jour_ouvrable_1.reporterAuJourOuvrable)(new Date(2027, 0, 3))).toEqual(new Date(2027, 0, 5));
        });
        it("LA LISTE EST BORNÉE AU 30 MARS 2023 · avant, l'ordonnance 14-010 s'appliquait et n'est pas au corpus", () => {
            expect((0, jour_ouvrable_1.jourFerie)(new Date(2022, 5, 30))).toBeNull();
            expect((0, jour_ouvrable_1.jourFerie)(new Date(2023, 5, 30))).toContain("l'indépendance");
            expect(new Date(2022, 11, 25).getDay()).toBe(0);
            expect((0, jour_ouvrable_1.estJourOuvrable)(new Date(2022, 11, 25))).toBe(false);
        });
    });
    describe("le câblage · c'est lui qui produisait le faux retard", () => {
        it("l'échéance de la retenue de janvier 2026 est reportée au LUNDI 16 février", async () => {
            const r = await service([ligne('44720000', '2026-01-31', { credit: 200_000 })]).registre('t1', {
                exerciceId: 'e1',
                dateReference: '2026-06-15',
            });
            expect(moisDe(r, 'irppSalaires').mois.find((m) => m.mois === '2026-01')?.echeance).toEqual(new Date(2026, 1, 16));
        });
        it("AU 16 FÉVRIER 2026, LE REDEVABLE N'EST PAS EN RETARD · c'est le défaut que la passe corrige", async () => {
            const r = await service([ligne('44720000', '2026-01-31', { credit: 200_000 })]).registre('t1', {
                exerciceId: 'e1',
                dateReference: '2026-02-16',
            });
            const n = moisDe(r, 'irppSalaires');
            expect(n.mois.find((m) => m.mois === '2026-01')?.enRetard).toBe(false);
            expect(n.moisEnRetard).toBe(0);
        });
        it('le retard est bien constaté le MARDI 17 février, une fois le terme reporté passé', async () => {
            const r = await service([ligne('44720000', '2026-01-31', { credit: 200_000 })]).registre('t1', {
                exerciceId: 'e1',
                dateReference: '2026-02-17',
            });
            expect(moisDe(r, 'irppSalaires').moisEnRetard).toBe(1);
        });
        it("une échéance du 15 tombant un SAMEDI est reportée au lundi · août 2026", async () => {
            expect(new Date(2026, 7, 15).getDay()).toBe(6);
            const r = await service([ligne('44720000', '2026-07-31', { credit: 120_000 })]).registre('t1', {
                exerciceId: 'e1',
                dateReference: '2026-12-01',
            });
            expect(moisDe(r, 'irppSalaires').mois.find((m) => m.mois === '2026-07')?.echeance).toEqual(new Date(2026, 7, 17));
        });
        it("PASSE D2 · la CNSS n'est PAS reportée · les cotisations de janvier 2026 sont dues le DIMANCHE 15 février", async () => {
            const r = await service([ligne('43110000', '2026-01-31', { credit: 200_000 })]).registre('t1', {
                exerciceId: 'e1',
                dateReference: '2026-02-16',
            });
            const cnss = moisDe(r, 'cnss');
            expect(cnss.mois.find((m) => m.mois === '2026-01')?.echeance).toEqual(new Date(Date.UTC(2026, 1, 15)));
            expect(cnss.moisEnRetard).toBe(1);
            expect(r.avertissements.join(' ')).toContain('ne sont PAS reportées');
        });
        it("une échéance qui tombe déjà un jour ouvrable n'est pas déplacée · avril 2026 reste le 15", async () => {
            expect(new Date(2026, 3, 15).getDay()).toBe(3);
            const r = await service([ligne('44720000', '2026-03-31', { credit: 100_000 })]).registre('t1', {
                exerciceId: 'e1',
                dateReference: '2026-06-15',
            });
            expect(moisDe(r, 'irppSalaires').mois.find((m) => m.mois === '2026-03')?.echeance).toEqual(new Date(2026, 3, 15));
        });
    });
    describe('le même jour quel que soit le fuseau du poste (audit final F81)', () => {
        const SCRIPT = [
            "const j = require('./src/modules/retenues/jour-ouvrable');",
            'const r = {',
            '  lundi: j.estJourOuvrable(new Date(Date.UTC(2026, 1, 16))),',
            '  dimanche: j.estJourOuvrable(new Date(Date.UTC(2026, 1, 15))),',
            '  noel: j.jourFerie(new Date(Date.UTC(2026, 11, 25))),',
            '  reporte: j.reporterAuJourOuvrable(new Date(Date.UTC(2026, 1, 15))).toISOString(),',
            '  heureEte: j.reporterAuJourOuvrable(new Date(Date.UTC(2026, 2, 29))).toISOString(),',
            '  janvier: j.echeanceDeReversement(15, 2026, 0).toISOString(),',
            '  mars: j.echeanceDeReversement(15, 2026, 2).toISOString(),',
            '};',
            'process.stdout.write(JSON.stringify(r));',
        ].join('\n');
        for (const tz of ['Africa/Kinshasa', 'America/Bogota', 'Europe/Paris']) {
            it(`${tz} · le lundi 16 février 2026 est ouvrable, et l'échéance de janvier y tombe`, () => {
                const sortie = (0, child_process_1.execFileSync)((0, path_1.join)(__dirname, '../../../node_modules/.bin/ts-node'), ['-T', '-O', '{"module":"commonjs"}', '-e', SCRIPT], { cwd: (0, path_1.join)(__dirname, '../../..'), env: { ...process.env, TZ: tz }, encoding: 'utf8' });
                expect(JSON.parse(sortie)).toEqual({
                    lundi: true,
                    dimanche: false,
                    noel: 'Noël',
                    reporte: '2026-02-16T00:00:00.000Z',
                    heureEte: '2026-03-30T00:00:00.000Z',
                    janvier: '2026-02-16T00:00:00.000Z',
                    mars: '2026-04-15T00:00:00.000Z',
                });
            }, 60_000);
        }
    });
    describe("ce qui n'est PAS calculé, et qui doit être dit", () => {
        it('la réserve est servie avec le registre et porte ses trois sources datées', () => {
            expect(correspondance_retenues_1.AVERTISSEMENT_REGISTRE).toContain(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE);
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('art. 121');
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('décret n° 24/09 du 17 février 2024');
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('ordonnance n° 23-042 du 30 mars 2023');
        });
        it('la réserve dit que les trois règles sont EMPRUNTÉES · la loi fiscale ne définit pas le jour ouvrable', () => {
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('EMPRUNTÉES');
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('14-010');
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('81-067');
        });
        it("L'ARTICLE 2 N'EST PAS CALCULÉ · il fait RECULER un congé quand l'art. 110 bis fait AVANCER une échéance", () => {
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('est pris le jour précédent');
            expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('PRÉCÉDANT');
        });
        it('AUCUNE FÊTE MOBILE ne peut entrer · la liste ne porte que des entiers littéraux', () => {
            for (const f of jour_ouvrable_1.JOURS_FERIES) {
                expect(Number.isInteger(f.mois)).toBe(true);
                expect(Number.isInteger(f.jour)).toBe(true);
            }
            const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'jour-ouvrable.ts'), 'utf8');
            expect(source).not.toMatch(/Math\./);
        });
        it('le report vit UNE SEULE FOIS · le service ne recalcule pas la règle dans son coin', () => {
            const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'retenues.service.ts'), 'utf8');
            expect(source).toContain("import { echeanceDeReversement, reporterAuJourOuvrable } from './jour-ouvrable'");
            expect(source).not.toMatch(/getDay\(\)/);
            expect((source.match(/(?:reporterAuJourOuvrable|echeanceDeReversement)\(/g) ?? []).length).toBeGreaterThanOrEqual(3);
            expect(source).toContain('estEcheanceFiscale(');
        });
    });
});
//# sourceMappingURL=report-jour-ouvrable.spec.js.map