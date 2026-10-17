"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const etat_journaux_saisie_1 = require("./etat-journaux-saisie");
const analyse_journaux_service_1 = require("./analyse-journaux.service");
describe('Journaux de saisie · la grille journal × mois', () => {
    const d = (s) => new Date(`${s}T00:00:00.000Z`);
    const mois = (0, etat_journaux_saisie_1.moisDeLExercice)(d('2026-01-01'), d('2026-12-31'));
    const compter = (journalId, date, statut, nombre = 1, provisoire = false) => ({
        journalId,
        date: d(date),
        statut,
        estANouveauProvisoire: provisoire,
        nombre,
    });
    const caseDe = (g, j, m) => g.find((l) => l.journalId === j).cases.find((c) => c.mois === m);
    it('douze mois, bornés à l’exercice · un exercice qui commence un 15 ne commence pas le 1er', () => {
        expect(mois).toHaveLength(12);
        expect(mois[1]).toEqual({ debut: '2026-02-01', fin: '2026-02-28' });
        const court = (0, etat_journaux_saisie_1.moisDeLExercice)(d('2026-03-15'), d('2026-05-10'));
        expect(court).toEqual([
            { debut: '2026-03-15', fin: '2026-03-31' },
            { debut: '2026-04-01', fin: '2026-04-30' },
            { debut: '2026-05-01', fin: '2026-05-10' },
        ]);
    });
    it('vide, brouillard dès une écriture non validée, journal quand tout est validé', () => {
        const g = (0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'ACH' }], mois, [
            compter('ACH', '2026-01-10', client_1.StatutEcriture.VALIDEE, 3),
            compter('ACH', '2026-02-10', client_1.StatutEcriture.VALIDEE, 3),
            compter('ACH', '2026-02-20', client_1.StatutEcriture.BROUILLARD, 1),
        ], [], false);
        expect(caseDe(g, 'ACH', '2026-01')).toMatchObject({ etat: 'JOURNAL', nombreEcritures: 3, enBrouillard: 0 });
        expect(caseDe(g, 'ACH', '2026-02')).toMatchObject({ etat: 'BROUILLARD', nombreEcritures: 4, enBrouillard: 1 });
        expect(caseDe(g, 'ACH', '2026-03')).toMatchObject({ etat: 'VIDE', nombreEcritures: 0 });
    });
    it('l’à-nouveau provisoire ne met pas le mois en brouillard, il est compté à part', () => {
        const g = (0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'AN' }], mois, [compter('AN', '2026-01-01', client_1.StatutEcriture.BROUILLARD, 1, true), compter('AN', '2026-02-01', client_1.StatutEcriture.BROUILLARD, 1, true), compter('AN', '2026-02-03', client_1.StatutEcriture.VALIDEE, 2)], [], false);
        expect(caseDe(g, 'AN', '2026-01')).toMatchObject({ etat: 'VIDE', enBrouillard: 0, aNouveauProvisoire: 1 });
        expect(caseDe(g, 'AN', '2026-02')).toMatchObject({ etat: 'JOURNAL', enBrouillard: 0, aNouveauProvisoire: 1, nombreEcritures: 3 });
    });
    it('une clôture totale fige SON journal jusqu’à sa date, pas les autres', () => {
        const clotures = [{ granularite: client_1.GranulariteCloture.TOTALE, journalId: 'VTE', dateLimite: d('2026-01-31') }];
        const g = (0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'VTE' }, { id: 'ACH' }], mois, [], clotures, false);
        expect(caseDe(g, 'VTE', '2026-01').etat).toBe('CLOTURE');
        expect(caseDe(g, 'VTE', '2026-02').etat).toBe('VIDE');
        expect(caseDe(g, 'ACH', '2026-01').etat).toBe('VIDE');
    });
    it('une clôture de période au milieu du mois ne clôt pas le mois · elle dit jusqu’où', () => {
        const clotures = [{ granularite: client_1.GranulariteCloture.PERIODE, journalId: null, dateLimite: d('2026-03-15') }];
        const g = (0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'BQ' }], mois, [compter('BQ', '2026-03-20', client_1.StatutEcriture.VALIDEE)], clotures, false);
        expect(caseDe(g, 'BQ', '2026-02').etat).toBe('CLOTURE');
        expect(caseDe(g, 'BQ', '2026-03')).toMatchObject({ etat: 'JOURNAL', figeJusquau: '2026-03-15' });
        expect(caseDe(g, 'BQ', '2026-04').figeJusquau).toBeNull();
    });
    it('la clôture partielle ne fige rien, l’exercice clôturé fige tout', () => {
        const partielle = [{ granularite: client_1.GranulariteCloture.PARTIELLE, journalId: 'BQ', dateLimite: d('2026-12-31') }];
        expect(caseDe((0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'BQ' }], mois, [], partielle, false), 'BQ', '2026-06')).toMatchObject({
            etat: 'VIDE',
            figeJusquau: null,
        });
        const partielleMiMois = [{ granularite: client_1.GranulariteCloture.PARTIELLE, journalId: 'BQ', dateLimite: d('2026-06-15') }];
        expect(caseDe((0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'BQ' }], mois, [], partielleMiMois, false), 'BQ', '2026-06').figeJusquau).toBeNull();
        expect(caseDe((0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'BQ' }], mois, [], [], true), 'BQ', '2026-06').etat).toBe('CLOTURE');
    });
    it('le service compte par regroupement, borné au dossier et à l’exercice', async () => {
        const appels = {};
        const service = new analyse_journaux_service_1.AnalyseJournauxService({
            exercice: {
                findFirst: async (a) => {
                    appels.exercice = a;
                    return { id: 'e1', dateDebut: d('2026-01-01'), dateFin: d('2026-12-31'), statut: client_1.StatutExercice.OUVERT };
                },
            },
            journal: { findMany: async () => [{ id: 'ACH', code: 'ACH', intitule: 'Achats', type: 'ACHAT', estActif: true }] },
            ecriture: {
                groupBy: async (a) => {
                    appels.groupBy = a;
                    return [{ journalId: 'ACH', date: d('2026-05-04'), statut: client_1.StatutEcriture.BROUILLARD, estANouveauProvisoire: false, _count: { _all: 2 } }];
                },
            },
            cloture: { findMany: async () => [] },
            impressionJournal: {
                findMany: async (a) => {
                    appels.impressions = a;
                    return [];
                },
            },
        });
        const r = await service.grilleSaisie('t1', 'e1');
        expect(appels.exercice).toMatchObject({ where: { id: 'e1', tenantId: 't1' } });
        expect(appels.groupBy).toMatchObject({ where: { tenantId: 't1', exerciceId: 'e1' }, _max: { valideeAt: true } });
        expect(appels.impressions).toMatchObject({ where: { tenantId: 't1', exerciceId: 'e1' } });
        expect(r.mois).toHaveLength(12);
        expect(r.journaux[0].cases[4]).toMatchObject({ mois: '2026-05', etat: 'BROUILLARD', enBrouillard: 2 });
    });
});
//# sourceMappingURL=etat-journaux-saisie.spec.js.map