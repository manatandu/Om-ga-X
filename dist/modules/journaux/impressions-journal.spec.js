"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = require("path");
const impressions_journal_1 = require("./impressions-journal");
const export_service_1 = require("../exports/export.service");
const etat_journaux_saisie_1 = require("./etat-journaux-saisie");
const impressions_journal_service_1 = require("./impressions-journal.service");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const ecritures_de_situation_1 = require("../comptabilite/ecritures-de-situation");
const J = (iso) => new Date(`${iso}T00:00:00.000Z`);
const H = (iso) => new Date(iso);
const impressionVte = { journalId: 'VTE', dateDebut: J('2026-03-01'), dateFin: J('2026-03-31'), imprimeAt: H('2026-04-02T10:00:00Z') };
const impressionTous = { journalId: null, dateDebut: J('2026-01-01'), dateFin: J('2026-12-31'), imprimeAt: H('2026-05-01T08:00:00Z') };
describe('un jour est couvert par une impression postérieure à sa dernière validation', () => {
    it('l’impression du journal, sur sa période, après la validation, couvre le jour', () => {
        expect((0, impressions_journal_1.jourCouvert)({ journalId: 'VTE', date: J('2026-03-15'), derniereValidation: H('2026-04-01T09:00:00Z') }, [impressionVte])).toBe(true);
    });
    it('une validation APRÈS l’impression rend le jour non imprimé', () => {
        expect((0, impressions_journal_1.jourCouvert)({ journalId: 'VTE', date: J('2026-03-15'), derniereValidation: H('2026-04-02T11:00:00Z') }, [impressionVte])).toBe(false);
    });
    it('un autre journal ne couvre rien ; l’impression de tous les journaux couvre chacun', () => {
        const ach = { journalId: 'ACH', date: J('2026-03-15'), derniereValidation: H('2026-04-01T09:00:00Z') };
        expect((0, impressions_journal_1.jourCouvert)(ach, [impressionVte])).toBe(false);
        expect((0, impressions_journal_1.jourCouvert)(ach, [impressionVte, impressionTous])).toBe(true);
    });
    it('un jour hors de la période imprimée n’est pas couvert', () => {
        expect((0, impressions_journal_1.jourCouvert)({ journalId: 'VTE', date: J('2026-04-01'), derniereValidation: H('2026-04-01T09:00:00Z') }, [impressionVte])).toBe(false);
    });
    it('les jours manquants sont nommés, les autres non', () => {
        const jours = [
            { journalId: 'VTE', date: J('2026-03-10'), derniereValidation: H('2026-03-31T09:00:00Z') },
            { journalId: 'VTE', date: J('2026-03-20'), derniereValidation: H('2026-04-03T09:00:00Z') },
        ];
        expect((0, impressions_journal_1.joursNonImprimes)(jours, [impressionVte]).map((j) => j.date.toISOString().slice(0, 10))).toEqual(['2026-03-20']);
    });
});
describe('une recherche n’est pas le journal', () => {
    it('un critère de contenu fait une recherche ; le périmètre seul, non', () => {
        expect((0, impressions_journal_1.estUneRecherche)({})).toBe(false);
        expect((0, impressions_journal_1.estUneRecherche)({ recherche: '  ' })).toBe(false);
        expect((0, impressions_journal_1.estUneRecherche)({ compte: '401' })).toBe(true);
        expect((0, impressions_journal_1.estUneRecherche)({ montantMin: 100 })).toBe(true);
        expect((0, impressions_journal_1.estUneRecherche)({ numeroPiece: 4 })).toBe(true);
        expect((0, impressions_journal_1.estUneRecherche)({ reference: 'FAC' })).toBe(true);
        expect((0, impressions_journal_1.estUneRecherche)({ recherche: 'loyer' })).toBe(true);
    });
    it('la période imprimée est bornée à l’exercice, et une période à l’envers est refusée', () => {
        const ex = { dateDebut: J('2026-01-01'), dateFin: J('2026-12-31') };
        expect((0, impressions_journal_1.periodeCouverte)(ex, {})).toEqual({ dateDebut: ex.dateDebut, dateFin: ex.dateFin });
        expect((0, impressions_journal_1.periodeCouverte)(ex, { dateDebut: '2025-11-01', dateFin: '2026-02-28' })).toEqual({ dateDebut: ex.dateDebut, dateFin: J('2026-02-28') });
        expect(() => (0, impressions_journal_1.periodeCouverte)(ex, { dateDebut: '2026-05-01', dateFin: '2026-04-01' })).toThrow(common_1.BadRequestException);
    });
});
describe('les mois non imprimés, lus en base', () => {
    function lecteur(jours, impressions) {
        const groupBy = jest.fn().mockResolvedValue(jours);
        return {
            groupBy,
            prisma: {
                ecriture: { groupBy },
                impressionJournal: { findMany: jest.fn().mockResolvedValue(impressions) },
                journal: {
                    findMany: jest.fn().mockResolvedValue([
                        { id: 'VTE', code: 'VTE' },
                        { id: 'ACH', code: 'ACH' },
                    ]),
                },
            },
        };
    }
    it('le livre-journal seul, hors journal de situation, jusqu’à la date', async () => {
        const { prisma, groupBy } = lecteur([], []);
        await (0, impressions_journal_1.moisNonImprimes)(prisma, { tenantId: 't', exerciceId: 'e', journalId: null, jusquau: J('2026-06-30') });
        const where = groupBy.mock.calls[0][0].where;
        expect(where.statut).toBe(client_1.StatutEcriture.VALIDEE);
        expect(where.journal).toEqual({ type: { not: 'SITUATION' } });
        expect(where.date).toEqual({ lte: J('2026-06-30') });
        expect(where.journalId).toBeUndefined();
    });
    it('nomme journal et mois une seule fois, triés, et le refus dit l’issue', async () => {
        const { prisma } = lecteur([
            { journalId: 'VTE', date: J('2026-03-20'), _max: { valideeAt: H('2026-04-03T09:00:00Z') } },
            { journalId: 'VTE', date: J('2026-03-21'), _max: { valideeAt: H('2026-04-03T09:00:00Z') } },
            { journalId: 'ACH', date: J('2026-02-05'), _max: { valideeAt: H('2026-02-28T09:00:00Z') } },
            { journalId: 'VTE', date: J('2026-03-02'), _max: { valideeAt: H('2026-03-31T09:00:00Z') } },
        ], [impressionVte]);
        const r = await (0, impressions_journal_1.moisNonImprimes)(prisma, { tenantId: 't', exerciceId: 'e', journalId: null, jusquau: J('2026-12-31') });
        expect(r).toEqual({ mois: [{ journal: 'ACH', mois: '2026-02' }, { journal: 'VTE', mois: '2026-03' }], total: 2 });
        const motif = (0, impressions_journal_1.motifClotureNonImprimee)(r);
        expect(motif).toContain('ACH 02/2026, VTE 03/2026');
        expect(motif).toContain('Imprimez ou exportez le journal');
        expect(motif).toContain('AUDCIF art. 22, 1°');
    });
});
describe('l’état des journaux de saisie dit « non imprimé »', () => {
    const mois = (0, etat_journaux_saisie_1.moisDeLExercice)(J('2026-01-01'), J('2026-12-31'));
    const compter = (date, valideeAt) => ({
        journalId: 'VTE',
        date: J(date),
        statut: client_1.StatutEcriture.VALIDEE,
        estANouveauProvisoire: false,
        nombre: 2,
        derniereValidation: H(valideeAt),
    });
    const etat = (g, m) => g[0].cases.find((c) => c.mois === m)?.etat;
    it('validé et non imprimé, puis imprimé, puis validé à nouveau après l’impression', () => {
        expect(etat((0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'VTE' }], mois, [compter('2026-03-15', '2026-04-01T09:00:00Z')], [], false, []), '2026-03')).toBe('NON_IMPRIME');
        expect(etat((0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'VTE' }], mois, [compter('2026-03-15', '2026-04-01T09:00:00Z')], [], false, [impressionVte]), '2026-03')).toBe('JOURNAL');
        expect(etat((0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'VTE' }], mois, [compter('2026-03-15', '2026-04-05T09:00:00Z')], [], false, [impressionVte]), '2026-03')).toBe('NON_IMPRIME');
    });
    it('sans la liste des impressions, l’état ne se juge pas · le mois validé reste « Journal »', () => {
        expect(etat((0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'VTE' }], mois, [compter('2026-03-15', '2026-04-01T09:00:00Z')], [], false), '2026-03')).toBe('JOURNAL');
    });
});
describe('l’impression de la fenêtre est enregistrée par le serveur', () => {
    function service(nombre, type = 'VENTES') {
        const create = jest.fn(async ({ data }) => data);
        const tx = {
            $executeRaw: jest.fn().mockResolvedValue(1),
            impressionJournal: { aggregate: jest.fn().mockResolvedValue({ _max: { numero: 6 } }), create },
            evenementAudit: { findFirst: jest.fn(), create: jest.fn() },
        };
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e', dateDebut: J('2026-01-01'), dateFin: J('2026-12-31') }) },
            journal: { findFirst: jest.fn().mockResolvedValue({ id: 'VTE', code: type === 'SITUATION' ? 'SIT' : 'VTE', type }) },
            ecriture: { count: jest.fn().mockResolvedValue(nombre) },
            $transaction: jest.fn(async (fn) => fn(tx)),
        };
        return { s: new impressions_journal_service_1.ImpressionsJournalService(prisma), create, prisma };
    }
    it('numérote à la suite du dossier, avec la période, le nombre de pièces compté et l’auteur', async () => {
        const { s, create } = service(42);
        await s.imprimer('t', 'u', { exerciceId: 'e', journalId: 'VTE', dateDebut: '2026-03-01', dateFin: '2026-03-31' });
        expect(create.mock.calls[0][0].data).toMatchObject({
            tenantId: 't',
            numero: 7,
            exerciceId: 'e',
            journalId: 'VTE',
            dateDebut: J('2026-03-01'),
            dateFin: J('2026-03-31'),
            forme: 'IMPRESSION',
            nombreEcritures: 42,
            imprimePar: 'u',
        });
    });
    it('un journal sans pièce s’imprime sans être enregistré, et la réponse le dit (relecture M6)', async () => {
        const { s, create } = service(0);
        await expect(s.imprimer('t', 'u', { exerciceId: 'e', journalId: 'VTE' })).resolves.toEqual({
            numero: null,
            imprimeAt: null,
            nombreEcritures: 0,
            motif: "Aucune pièce dans le journal de cette période · l'impression n'est pas enregistrée.",
        });
        expect(create).not.toHaveBeenCalled();
    });
    it('un journal de situation ne prend aucun numéro de la suite des impressions (second tour, d)', async () => {
        const { s, create, prisma } = service(5, 'SITUATION');
        await expect(s.imprimer('t', 'u', { exerciceId: 'e', journalId: 'VTE' })).resolves.toEqual({
            numero: null,
            imprimeAt: null,
            nombreEcritures: null,
            motif: (0, ecritures_de_situation_1.motifImpressionDeSituationNonNumerotee)('SIT'),
        });
        expect(create).not.toHaveBeenCalled();
        expect(prisma.ecriture.count).not.toHaveBeenCalled();
    });
    it('refuse une fenêtre qui ne montrerait qu’une partie du journal, et dit d’exporter', async () => {
        const { s, create } = service(ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE + 1);
        await expect(s.imprimer('t', 'u', { exerciceId: 'e' })).rejects.toThrow(/Exportez-le en Excel/);
        expect(create).not.toHaveBeenCalled();
    });
});
describe('l’export du journal entier est une impression, une recherche exportée ne l’est pas', () => {
    it('l’export appelle l’enregistrement après la dernière ligne, et ne casse jamais le classeur remis', () => {
        const src = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'exports', 'export.service.ts'), 'utf8');
        const debut = src.indexOf('async journalExcelEnFlux(');
        const corps = src.slice(debut, src.indexOf('\n  }\n', debut));
        expect(corps.indexOf('await edition.terminer(')).toBeGreaterThan(-1);
        expect(corps.indexOf('await this.marquerJournalImprime(')).toBeGreaterThan(corps.indexOf('await edition.terminer('));
        const marquer = src.slice(src.indexOf('private async marquerJournalImprime('));
        expect(marquer).toContain('estUneRecherche(filtres)');
        expect(marquer).toContain('this.logger.error(');
    });
});
describe('l’export d’un journal sans pièce n’est pas une impression (relecture M6)', () => {
    function exporteur(nombre, type = 'VENTES') {
        const create = jest.fn();
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'e', dateDebut: J('2026-01-01'), dateFin: J('2026-12-31') }) },
            journal: { findFirst: jest.fn().mockResolvedValue({ type }) },
            ecriture: { count: jest.fn().mockResolvedValue(nombre) },
            $transaction: jest.fn(async (fn) => fn({
                $executeRaw: jest.fn().mockResolvedValue(1),
                impressionJournal: { aggregate: jest.fn().mockResolvedValue({ _max: { numero: 2 } }), create },
                evenementAudit: { findFirst: jest.fn(), create: jest.fn() },
            })),
        };
        const vide = {};
        const svc = new export_service_1.ExportService(prisma, vide, vide, vide, vide, vide, vide, vide, vide, vide);
        const marquer = svc
            .marquerJournalImprime;
        return { marquer: (f) => marquer.call(svc, 't', f, 'u'), create };
    }
    it('rien n’est enregistré quand le périmètre ne compte aucune pièce ; une pièce suffit', async () => {
        const vide = exporteur(0);
        await vide.marquer({ exerciceId: 'e', journalId: 'VTE' });
        expect(vide.create).not.toHaveBeenCalled();
        const plein = exporteur(3);
        await plein.marquer({ exerciceId: 'e', journalId: 'VTE' });
        expect(plein.create).toHaveBeenCalledTimes(1);
        expect(plein.create.mock.calls[0][0].data).toMatchObject({ numero: 3, nombreEcritures: 3, forme: 'EXPORT' });
    });
    it('l’export d’un journal de situation n’est pas une impression (second tour, d)', async () => {
        const situation = exporteur(3, 'SITUATION');
        await situation.marquer({ exerciceId: 'e', journalId: 'SIT' });
        expect(situation.create).not.toHaveBeenCalled();
        const tous = exporteur(3, 'SITUATION');
        await tous.marquer({ exerciceId: 'e' });
        expect(tous.create).toHaveBeenCalledTimes(1);
    });
});
describe('une impression suit l’exercice qui reprend sa période, jamais supprimée (relecture M6)', () => {
    it('chaque impression est rattachée par une mise à jour unitaire, au journal d’audit', async () => {
        const lues = [{ id: 'i1' }, { id: 'i2' }];
        const findMany = jest.fn().mockResolvedValueOnce(lues);
        const update = jest.fn().mockResolvedValue({});
        const tx = { impressionJournal: { findMany, update } };
        await expect((0, impressions_journal_1.rattacherLesImpressions)(tx, 't', 'liquidation', 'arrete')).resolves.toBe(2);
        expect(findMany.mock.calls[0][0].where).toEqual({ tenantId: 't', exerciceId: 'liquidation' });
        expect(update.mock.calls.map((c) => c[0])).toEqual([
            { where: { id: 'i1' }, data: { exerciceId: 'arrete' } },
            { where: { id: 'i2' }, data: { exerciceId: 'arrete' } },
        ]);
    });
    it('l’arrêt et son annulation les rattachent AVANT de retirer un exercice, et elles n’occupent plus l’exercice', () => {
        const src = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'exercice', 'exercice.service.ts'), 'utf8');
        const suppressions = [...src.matchAll(/await tx\.exercice\.delete\(\{ where: \{ id: ([\w.]+) \} \}\);/g)];
        expect(suppressions.length).toBe(2);
        for (const s of suppressions) {
            const debutMethode = src.lastIndexOf('\n  async ', s.index);
            const corps = src.slice(debutMethode, s.index);
            expect(corps).toContain(`await rattacherLesImpressions(tx, tenantId, ${s[1]}, exercice.id);`);
        }
        const usages = src.slice(src.indexOf('async function usagesDeLExercice('));
        expect(usages.slice(0, usages.indexOf('\n}\n'))).toContain('[CLE_IMPRESSION_VERS_EXERCICE]');
        expect(src).toContain("const CLE_IMPRESSION_VERS_EXERCICE = 'ImpressionJournal.exerciceId';");
    });
});
describe('la clôture refuse un journal non imprimé seulement sur l’option du dossier', () => {
    const src = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', 'exercice', 'exercice.service.ts'), 'utf8');
    it('les clôtures partielle, totale et de période appellent le refus ; l’annuelle lit l’option avec le dossier', () => {
        for (const methode of ['async clorePartielle(', 'async cloreTotale(', 'async clorePeriode(']) {
            const debut = src.indexOf(methode);
            const corps = src.slice(debut, src.indexOf('\n  }\n', debut));
            expect(corps).toContain('await this.refuserSiNonImprime(');
        }
        const annuelle = src.slice(src.indexOf('  async cloturer('));
        expect(annuelle.slice(0, annuelle.indexOf('\n  }\n'))).toContain('dossier.refusClotureJournalNonImprime === true');
        const refus = src.slice(src.indexOf('private async refuserSiNonImprime('));
        expect(refus.slice(0, refus.indexOf('\n  }\n'))).toContain('refusClotureJournalNonImprime !== true) return;');
    });
});
//# sourceMappingURL=impressions-journal.spec.js.map