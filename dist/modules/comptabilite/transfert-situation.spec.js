"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = require("path");
const ecritures_de_situation_1 = require("./ecritures-de-situation");
const ecriture_service_1 = require("./ecriture.service");
const extension_journal_de_situation_1 = require("../../common/journal-de-situation/extension-journal-de-situation");
const SOURCE = (chemin) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', '..', '..', chemin), 'utf8');
const EXERCICE = { id: 'ex1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: client_1.StatutExercice.OUVERT };
const OD = { id: 'jOD', code: 'OD', type: client_1.TypeJournal.GENERAL, numerotation: client_1.NumerotationPiece.CONTINUE_JOURNAL, estActif: true };
function heritee(surcharge = {}) {
    return {
        id: 'e1',
        statut: client_1.StatutEcriture.BROUILLARD,
        exerciceId: 'ex1',
        journalId: 'jSIT',
        numeroPiece: 7,
        date: new Date('2026-04-10'),
        dateValeur: null,
        journal: { code: 'SIT', type: client_1.TypeJournal.SITUATION },
        ...surcharge,
    };
}
function monter(ecriture, arrivee = OD, relue) {
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'e1', ...data, journal: { code: arrivee.code } }));
    const ligneEcriture = { deleteMany: jest.fn(), updateMany: jest.fn(), update: jest.fn() };
    const tx = {
        ecriture: {
            findFirst: jest.fn().mockResolvedValue(relue === undefined ? (ecriture ? { statut: ecriture.statut, journalId: ecriture.journalId, exerciceId: 'ex1' } : null) : relue),
            update,
        },
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
        ligneEcriture,
        pieceJointeEcriture: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    };
    const prisma = {
        ecriture: { findFirst: jest.fn().mockResolvedValue(ecriture) },
        $transaction: jest.fn().mockImplementation((f) => f(tx)),
    };
    const journalService = {
        trouver: jest.fn().mockResolvedValue(arrivee),
        prochainNumeroPiece: jest.fn().mockResolvedValue(42),
    };
    const service = new ecriture_service_1.EcritureService(prisma, journalService, {}, {});
    return { service, update, journalService, ligneEcriture, prisma, tx };
}
describe('le transfert d’un brouillard hérité dans un journal ordinaire', () => {
    it('change le journal et le numéro, garde la date et ne touche à aucune ligne', async () => {
        const { service, update, journalService, ligneEcriture } = monter(heritee());
        const controles = jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
            exercice: EXERCICE,
            journal: OD,
            date: new Date('2026-04-10'),
            dateValeur: null,
            sectionsParId: new Map(),
        });
        const r = await service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' });
        const piece = controles.mock.calls[0][1];
        expect(piece).toMatchObject({ exerciceId: 'ex1', journalId: 'jOD', reporterAuPremierJourOuvert: false });
        expect(piece.lignes).toBeUndefined();
        expect(piece.journalDeSituationAdmis).toBeUndefined();
        expect(journalService.prochainNumeroPiece).toHaveBeenCalledWith('t1', OD, 'ex1', new Date('2026-04-10'), expect.anything());
        expect(update).toHaveBeenCalledTimes(1);
        const { where, data } = update.mock.calls[0][0];
        expect(where).toEqual({ id: 'e1' });
        expect(data).toEqual({ journalId: 'jOD', numeroPiece: 42, date: new Date('2026-04-10') });
        expect(Object.keys(data)).not.toContain('lignes');
        expect(Object.keys(data)).not.toContain('statut');
        for (const f of Object.values(ligneEcriture))
            expect(f).not.toHaveBeenCalled();
        expect(r).toMatchObject({ numeroPiece: 42, journal: { code: 'OD' } });
    });
    it('ses pièces jointes disent le nouveau journal et le nouveau numéro (relecture sage-l6, mineur 2)', async () => {
        const { service, tx } = monter(heritee());
        jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
            exercice: EXERCICE,
            journal: OD,
            date: new Date('2026-04-10'),
            dateValeur: null,
            sectionsParId: new Map(),
        });
        tx.ecriture.findFirst
            .mockResolvedValueOnce({ statut: 'BROUILLARD', journalId: heritee().journalId, exerciceId: 'ex1' })
            .mockResolvedValueOnce({
            statut: 'BROUILLARD', estANouveauProvisoire: false, numeroPiece: 42, date: new Date('2026-04-10'),
            libelle: 'Loyer', journalId: 'jOD', journal: { code: 'OD' },
        });
        tx.pieceJointeEcriture.count.mockResolvedValue(1);
        tx.pieceJointeEcriture.findMany.mockResolvedValueOnce([{ id: 'pj-1' }]).mockResolvedValue([]);
        await service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' });
        expect(tx.pieceJointeEcriture.findMany.mock.calls[0][0].where).toEqual({
            tenantId: 't1',
            ecritureId: 'e1',
            NOT: { ecritureDecrite: 'OD n° 42 du 10/04/2026 · Loyer' },
        });
        expect(tx.pieceJointeEcriture.update).toHaveBeenCalledWith({
            where: { id: 'pj-1' },
            data: { ecritureDecrite: 'OD n° 42 du 10/04/2026 · Loyer' },
            select: { id: true, ecritureId: true, ecritureDecrite: true },
        });
    });
    it('reportée au premier jour non clôturé, elle garde sa date d’origine en date de valeur (art. 22, 4°)', async () => {
        const { service, update } = monter(heritee({ date: new Date('2026-02-15') }));
        jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
            exercice: EXERCICE,
            journal: OD,
            date: new Date('2026-04-01'),
            dateValeur: new Date('2026-02-15'),
            sectionsParId: new Map(),
        });
        await service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD', reporterAuPremierJourOuvert: true });
        expect(update.mock.calls[0][0].data).toEqual({
            journalId: 'jOD',
            numeroPiece: 42,
            date: new Date('2026-04-01'),
            dateValeur: new Date('2026-02-15'),
        });
    });
    it('une date de valeur déjà portée prime sur la date d’origine', async () => {
        const { service, update } = monter(heritee({ date: new Date('2026-02-01'), dateValeur: new Date('2026-01-20') }));
        jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
            exercice: EXERCICE,
            journal: OD,
            date: new Date('2026-04-01'),
            dateValeur: new Date('2026-02-01'),
            sectionsParId: new Map(),
        });
        await service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD', reporterAuPremierJourOuvert: true });
        expect(update.mock.calls[0][0].data.dateValeur).toEqual(new Date('2026-01-20'));
    });
    it('refuse un journal d’arrivée de situation, en le nommant, avant toute écriture', async () => {
        const { service, update } = monter(heritee(), { ...OD, id: 'jSIT2', code: 'SIT2', type: client_1.TypeJournal.SITUATION });
        await expect(service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jSIT2' })).rejects.toThrow((0, ecritures_de_situation_1.motifArriveeDeSituation)('SIT2'));
        expect(update).not.toHaveBeenCalled();
    });
    it('refuse ce qui n’est pas un brouillard hérité · simulation, pièce validée, journal ordinaire', async () => {
        for (const [surcharge, attendu] of [
            [{ statut: client_1.StatutEcriture.SITUATION }, (0, ecritures_de_situation_1.motifTransfertSansObjet)('SIT n° 7', client_1.StatutEcriture.SITUATION, true)],
            [{ statut: client_1.StatutEcriture.VALIDEE }, (0, ecritures_de_situation_1.motifTransfertSansObjet)('SIT n° 7', client_1.StatutEcriture.VALIDEE, true)],
            [
                { journal: { code: 'VT', type: client_1.TypeJournal.VENTES }, journalId: 'jVT' },
                (0, ecritures_de_situation_1.motifTransfertSansObjet)('VT n° 7', client_1.StatutEcriture.BROUILLARD, false),
            ],
        ]) {
            const { service, update } = monter(heritee(surcharge));
            await expect(service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' })).rejects.toThrow(attendu);
            expect(update).not.toHaveBeenCalled();
        }
        expect((0, ecritures_de_situation_1.motifTransfertSansObjet)('SIT n° 7', client_1.StatutEcriture.BROUILLARD, true)).toBeNull();
    });
    it('relue changée dans la transaction (validée, transférée par un autre poste), elle n’est pas transférée deux fois', async () => {
        const { service, update } = monter(heritee(), OD, { statut: client_1.StatutEcriture.BROUILLARD, journalId: 'jOD', exerciceId: 'ex1' });
        jest.spyOn(service, 'controlesDEntree').mockResolvedValue({
            exercice: EXERCICE,
            journal: OD,
            date: new Date('2026-04-10'),
            dateValeur: null,
            sectionsParId: new Map(),
        });
        await expect(service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' })).rejects.toThrow(common_1.ConflictException);
        expect(update).not.toHaveBeenCalled();
    });
    it('l’invariant de l’extension admet le transfert · un brouillard dans un journal ordinaire', () => {
        expect((0, extension_journal_de_situation_1.motifEcartJournalDeSituation)({ situation: false, code: 'OD' }, client_1.StatutEcriture.BROUILLARD)).toBeNull();
        expect((0, extension_journal_de_situation_1.motifEcartJournalDeSituation)({ situation: true, code: 'SIT' }, client_1.StatutEcriture.VALIDEE)).not.toBeNull();
    });
});
describe('la validation du brouillard hérité', () => {
    function service(findMany, count, updateMany = jest.fn()) {
        const prisma = {
            ecriture: { findMany, count: count ?? jest.fn().mockResolvedValue(0), updateMany },
            exercice: { findFirst: jest.fn().mockResolvedValue({ id: 'ex1' }) },
            journal: { findFirst: jest.fn().mockResolvedValue({ id: 'jOD' }) },
            tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ doubleRegardValidation: false, referentiel: 'SYSCOHADA' }) },
        };
        return new ecriture_service_1.EcritureService(prisma, {}, {}, {});
    }
    it('une sélection qui le contient est refusée en le nommant, avec l’issue du transfert', async () => {
        const updateMany = jest.fn();
        const findMany = jest.fn().mockResolvedValue([
            {
                id: 'e1',
                statut: client_1.StatutEcriture.BROUILLARD,
                numeroPiece: 7,
                createdBy: 'u',
                estANouveauProvisoire: false,
                exercice: { statut: client_1.StatutExercice.OUVERT },
                journal: { code: 'SIT', type: client_1.TypeJournal.SITUATION },
                lignes: [],
            },
        ]);
        await expect(service(findMany, undefined, updateMany).valider('t1', 'u', ['e1'])).rejects.toThrow((0, ecritures_de_situation_1.motifBrouillardHeriteNeSeValidePas)(['SIT n° 7']));
        expect((0, ecritures_de_situation_1.motifBrouillardHeriteNeSeValidePas)(['SIT n° 7'])).toContain('« Transférer »');
        expect(updateMany).not.toHaveBeenCalled();
    });
    it('la validation par période l’écarte en le comptant, et valide le reste', async () => {
        const updateMany = jest.fn();
        const findMany = jest
            .fn()
            .mockResolvedValueOnce([{ id: 'e2' }])
            .mockResolvedValueOnce([
            {
                id: 'e2',
                statut: client_1.StatutEcriture.BROUILLARD,
                numeroPiece: 3,
                createdBy: 'u',
                estANouveauProvisoire: false,
                estGenereeParCloture: false,
                exercice: { statut: client_1.StatutExercice.OUVERT },
                journal: { code: 'OD', type: client_1.TypeJournal.GENERAL },
                lignes: [
                    { debit: 100, credit: 0 },
                    { debit: 0, credit: 100 },
                ],
            },
        ]);
        const count = jest.fn().mockResolvedValue(2);
        const r = await service(findMany, count, updateMany).validerJusqua('t1', 'u', { exerciceId: 'ex1', dateLimite: '2026-04-30' });
        const lot = findMany.mock.calls[0][0].where;
        expect(lot.journal).toEqual({ type: { not: client_1.TypeJournal.SITUATION } });
        expect(count.mock.calls[0][0].where.journal).toEqual({ type: client_1.TypeJournal.SITUATION });
        expect(r.validees).toBe(1);
        expect(r.ecarteesJournalDeSituation).toBe(2);
        expect(r.motifEcarteesJournalDeSituation).toContain(ecritures_de_situation_1.ISSUE_TRANSFERT);
        expect(updateMany).toHaveBeenCalledTimes(1);
    });
    it('rien d’autre à valider, le compteur est servi quand même', async () => {
        const findMany = jest.fn().mockResolvedValue([]);
        const r = await service(findMany, jest.fn().mockResolvedValue(1)).validerJusqua('t1', 'u', { exerciceId: 'ex1', dateLimite: '2026-04-30' });
        expect(r).toMatchObject({ validees: 0, ecarteesJournalDeSituation: 1 });
        expect(r.motifEcarteesJournalDeSituation).toContain('journal de situation');
    });
});
describe('le contrôle et la clôture proposent le transfert', () => {
    it('l’action du contrôle et le refus de clôture nomment le geste', () => {
        const controles = SOURCE('src/modules/controles/controles.service.ts');
        const debut = controles.indexOf("code: 'JOURNAL_DE_SITUATION_AU_BROUILLARD'");
        const bloc = controles.slice(debut, controles.indexOf('occurrences:', debut));
        expect(bloc).toContain('${ISSUE_TRANSFERT}');
        expect(ecritures_de_situation_1.ISSUE_TRANSFERT).toContain('« Transférer »');
        const exercice = SOURCE('src/modules/exercice/exercice.service.ts');
        const cloturer = exercice.slice(exercice.indexOf('  async cloturer('));
        const corps = cloturer.slice(0, cloturer.indexOf('\n  }\n'));
        expect(corps).toContain('transférez-les dans');
        expect(corps).toContain('« Transférer »');
    });
    it('la route du transfert porte ses rôles, comme la modification du brouillard', () => {
        const src = SOURCE('src/modules/comptabilite/ecriture.controller.ts');
        const debut = src.indexOf("@Post(':id/transfert')");
        expect(debut).toBeGreaterThan(-1);
        const entete = src.slice(debut, src.indexOf('async transferer(', debut));
        expect(entete).toContain('@Roles(RoleUtilisateur.ADMIN_CABINET, RoleUtilisateur.COMPTABLE)');
    });
    it('un refus de transfert ne laisse rien à moitié · BadRequest avant la transaction', async () => {
        const { service, prisma } = monter(null);
        await expect(service.transfererDansUnJournalOrdinaire('t1', 'absente', { journalId: 'jOD' })).rejects.toThrow('Écriture introuvable pour ce dossier.');
        expect(prisma.$transaction).not.toHaveBeenCalled();
        const autre = monter(heritee({ statut: client_1.StatutEcriture.VALIDEE }));
        await expect(autre.service.transfererDansUnJournalOrdinaire('t1', 'e1', { journalId: 'jOD' })).rejects.toThrow(common_1.BadRequestException);
        expect(autre.prisma.$transaction).not.toHaveBeenCalled();
    });
});
//# sourceMappingURL=transfert-situation.spec.js.map