"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const fs_1 = require("fs");
const path_1 = require("path");
const ecritures_de_situation_1 = require("./ecritures-de-situation");
const extension_journal_de_situation_1 = require("../../common/journal-de-situation/extension-journal-de-situation");
const contexte_audit_1 = require("../../common/audit/contexte-audit");
const balance_trois_colonnes_1 = require("./balance-trois-colonnes");
const gel_cloture_1 = require("../exercice/gel-cloture");
const etat_journaux_saisie_1 = require("../journaux/etat-journaux-saisie");
const numerotation_piece_1 = require("../journaux/numerotation-piece");
const ecriture_service_1 = require("./ecriture.service");
const SOURCE = (chemin) => (0, fs_1.readFileSync)((0, path_1.join)(__dirname, '..', '..', '..', chemin), 'utf8');
describe('les filtres partagés', () => {
    it('la balance avec brouillard écarte la situation, le livre-journal seul ne lit que le validé', () => {
        expect((0, ecritures_de_situation_1.filtreDuStatut)(true)).toEqual({ statut: { not: client_1.StatutEcriture.SITUATION } });
        expect((0, ecritures_de_situation_1.filtreDuStatut)(false)).toEqual({ statut: client_1.StatutEcriture.VALIDEE });
    });
    it('une écriture née dans un journal de situation porte le statut SITUATION, ailleurs le brouillard', () => {
        expect((0, ecritures_de_situation_1.statutDeNaissance)({ type: client_1.TypeJournal.SITUATION })).toBe(client_1.StatutEcriture.SITUATION);
        expect((0, ecritures_de_situation_1.statutDeNaissance)({ type: client_1.TypeJournal.GENERAL })).toBe(client_1.StatutEcriture.BROUILLARD);
        expect((0, ecritures_de_situation_1.statutDeNaissance)({ type: client_1.TypeJournal.TRESORERIE })).toBe(client_1.StatutEcriture.BROUILLARD);
    });
    it('un livre imprime « Situation », jamais « Brouillard », pour une simulation', () => {
        expect((0, ecritures_de_situation_1.libelleDuStatut)(client_1.StatutEcriture.SITUATION)).toBe('Situation');
        expect((0, ecritures_de_situation_1.libelleDuStatut)(client_1.StatutEcriture.VALIDEE)).toBe('Validée');
        expect((0, ecritures_de_situation_1.libelleDuStatut)(client_1.StatutEcriture.BROUILLARD)).toBe('Brouillard');
    });
    it('le filtre d’un appelant garde le statut qu’il pose, et écarte la situation sinon · la valeur, pas la clé (second tour, e)', () => {
        expect((0, ecritures_de_situation_1.avecStatut)({ tenantId: 't1', statut: client_1.StatutEcriture.VALIDEE })).toEqual({ tenantId: 't1', statut: client_1.StatutEcriture.VALIDEE });
        expect((0, ecritures_de_situation_1.avecStatut)({ tenantId: 't1' })).toEqual({ tenantId: 't1', ...ecritures_de_situation_1.HORS_SITUATION });
        expect((0, ecritures_de_situation_1.avecStatut)({ tenantId: 't1', statut: undefined })).toEqual({ tenantId: 't1', ...ecritures_de_situation_1.HORS_SITUATION });
    });
    it('les trois colonnes de la balance écartent la situation quand le filtre ne fixe pas de statut', () => {
        const f = (0, balance_trois_colonnes_1.filtresDesTroisColonnes)({ tenantId: 't1', exerciceId: 'e1' });
        for (const colonne of [f.reports, f.mouvements, f.clotures]) {
            expect(JSON.stringify(colonne)).toContain('"statut":{"not":"SITUATION"}');
        }
        const v = (0, balance_trois_colonnes_1.filtresDesTroisColonnes)({ tenantId: 't1', exerciceId: 'e1', statut: client_1.StatutEcriture.VALIDEE });
        expect(JSON.stringify(v.mouvements)).toContain('"statut":"VALIDEE"');
        expect(JSON.stringify(v.mouvements)).not.toContain('SITUATION');
    });
});
describe('l’invariant tenu sur le client Prisma', () => {
    it('la règle pure, dans les deux sens', () => {
        expect((0, extension_journal_de_situation_1.motifEcartJournalDeSituation)({ situation: true, code: 'SIT' }, 'SITUATION')).toBeNull();
        expect((0, extension_journal_de_situation_1.motifEcartJournalDeSituation)({ situation: false, code: 'OD' }, 'BROUILLARD')).toBeNull();
        expect((0, extension_journal_de_situation_1.motifEcartJournalDeSituation)({ situation: true, code: 'SIT' }, 'BROUILLARD')).toContain('SIT');
        expect((0, extension_journal_de_situation_1.motifEcartJournalDeSituation)({ situation: true, code: 'SIT' }, 'VALIDEE')).toContain('journal de situation');
        expect((0, extension_journal_de_situation_1.motifEcartJournalDeSituation)({ situation: false, code: 'OD' }, 'SITUATION')).toBe(extension_journal_de_situation_1.MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL);
    });
    function base(groupes = []) {
        const journaux = [
            { id: 'jSit', code: 'SIT', type: 'SITUATION' },
            { id: 'jOd', code: 'OD', type: 'GENERAL' },
        ];
        const findMany = jest.fn(async (a) => journaux.filter((j) => a.where.id.in.includes(j.id)));
        const groupBy = jest.fn().mockResolvedValue(groupes);
        const findFirst = jest.fn().mockResolvedValue(groupes[0] ?? null);
        return { base: { journal: { findMany }, ecriture: { groupBy, findFirst } }, findMany, groupBy, findFirst };
    }
    const baseInterdite = () => {
        const tombe = jest.fn(async () => {
            throw new Error('seconde connexion · lu hors de la transaction en cours');
        });
        return { journal: { findMany: tombe }, ecriture: { groupBy: tombe, findFirst: tombe } };
    };
    const query = jest.fn().mockResolvedValue('fait');
    const appeler = (b, operation, args) => (0, extension_journal_de_situation_1.garderJournalDeSituation)(b, { model: 'Ecriture', operation, args, query });
    it('refuse qu’un module passe une écriture au brouillard dans un journal de situation', async () => {
        const { base: b } = base();
        await expect(appeler(b, 'create', { data: { journalId: 'jSit' } })).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(appeler(b, 'create', { data: { journal: { connect: { id: 'jSit' } }, statut: 'VALIDEE' } })).rejects.toThrow('SIT');
        await expect(appeler(b, 'createMany', { data: [{ journalId: 'jOd' }, { journalId: 'jSit' }] })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse une écriture de situation dans un journal ordinaire, admet la saisie dans son journal', async () => {
        const { base: b } = base();
        await expect(appeler(b, 'create', { data: { journalId: 'jOd', statut: 'SITUATION' } })).rejects.toThrow(extension_journal_de_situation_1.MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL);
        await expect(appeler(b, 'create', { data: { journalId: 'jSit', statut: 'SITUATION' } })).resolves.toBe('fait');
        await expect(appeler(b, 'create', { data: { journalId: 'jOd' } })).resolves.toBe('fait');
    });
    it('refuse de valider une écriture de situation, même par un updateMany de lot', async () => {
        const { base: b } = base([
            { journalId: 'jOd', statut: 'BROUILLARD' },
            { journalId: 'jSit', statut: 'SITUATION' },
        ]);
        await expect(appeler(b, 'updateMany', { where: { id: { in: ['a', 'b'] } }, data: { statut: 'VALIDEE' } })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('refuse de déplacer une simulation dans un journal ordinaire', async () => {
        const { base: b } = base([{ journalId: 'jSit', statut: 'SITUATION' }]);
        await expect(appeler(b, 'update', { where: { id: 'a' }, data: { journalId: 'jOd' } })).rejects.toThrow(extension_journal_de_situation_1.MESSAGE_ECRITURE_DE_SITUATION_HORS_DE_SON_JOURNAL);
    });
    it('dans une transaction, lit par elle et borne chaque lecture au dossier de l’écriture (relecture M2)', async () => {
        const { base: tx, findMany, groupBy, findFirst } = base([{ journalId: 'jSit', statut: 'SITUATION', tenantId: 't1' }]);
        const dansLaTransaction = (operation, args) => (0, contexte_audit_1.dansContexteAudit)({ acteurEmail: 'a@b.c', tenantId: 't1' }, () => (0, contexte_audit_1.journaliserDansTransaction)(tx, () => appeler(baseInterdite(), operation, args)));
        await expect(dansLaTransaction('create', { data: { tenantId: 't1', journalId: 'jSit' } })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 't1', id: { in: ['jSit'] } } }));
        await expect(dansLaTransaction('update', { where: { id: 'a' }, data: { statut: 'VALIDEE' } })).rejects.toThrow('SIT');
        expect(findFirst).toHaveBeenCalledWith({
            where: { id: 'a' },
            select: { journalId: true, statut: true, tenantId: true },
        });
        await expect(dansLaTransaction('updateMany', { where: { tenantId: 't1', id: { in: ['a'] } }, data: { statut: 'VALIDEE' } })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(groupBy).toHaveBeenCalledWith({
            by: ['journalId', 'statut', 'tenantId'],
            where: { tenantId: 't1', id: { in: ['a'] } },
        });
    });
    it('hors de toute transaction, ou sans dossier au contexte, la lecture reste sur le client de base', async () => {
        const { base: b, findMany } = base();
        await expect(appeler(b, 'create', { data: { tenantId: 't1', journalId: 'jSit' } })).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(findMany).toHaveBeenCalledTimes(1);
        const { base: tx, findMany: luParTx } = base();
        const { base: b2, findMany: luParBase } = base();
        await expect((0, contexte_audit_1.journaliserDansTransaction)(tx, () => appeler(b2, 'create', { data: { tenantId: 't1', journalId: 'jSit' } }))).rejects.toBeInstanceOf(common_1.BadRequestException);
        expect(luParTx).not.toHaveBeenCalled();
        expect(luParBase).toHaveBeenCalledTimes(1);
    });
    it('une modification qui ne touche ni statut ni journal ne lit rien de plus', async () => {
        const { base: b, groupBy, findMany } = base();
        await expect(appeler(b, 'update', { where: { id: 'a' }, data: { libelle: 'Nouveau' } })).resolves.toBe('fait');
        expect(groupBy).not.toHaveBeenCalled();
        expect(findMany).not.toHaveBeenCalled();
    });
    it('l’extension est posée sur le client Prisma, entre le périmètre des journaux et le journal d’audit', () => {
        const src = SOURCE('src/common/prisma.service.ts');
        const perimetre = src.indexOf('.$extends(extensionPerimetreJournaux(this))');
        const situation = src.indexOf('.$extends(extensionJournalDeSituation(this))');
        const audit = src.indexOf('.$extends(extensionAudit(this))');
        expect(perimetre).toBeGreaterThan(-1);
        expect(situation).toBeGreaterThan(perimetre);
        expect(audit).toBeGreaterThan(situation);
    });
});
describe('une écriture de situation ne se valide pas', () => {
    it('refuse le lot en la nommant, au lieu de l’écarter sans un mot', async () => {
        const updateMany = jest.fn();
        const prisma = {
            ecriture: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 's1',
                        statut: 'SITUATION',
                        numeroPiece: 4,
                        createdBy: 'u',
                        exercice: { statut: 'OUVERT' },
                        journal: { code: 'SIT' },
                        lignes: [],
                    },
                ]),
                updateMany,
            },
        };
        const service = new ecriture_service_1.EcritureService(prisma, {}, {}, {});
        await expect(service.valider('t1', 'u', ['s1'])).rejects.toThrow((0, ecritures_de_situation_1.motifSituationNeSeValidePas)(['SIT n° 4']));
        expect(updateMany).not.toHaveBeenCalled();
    });
});
describe('la clôture et le report à-nouveau ne lisent pas la situation', () => {
    const exercice = SOURCE('src/modules/exercice/exercice.service.ts');
    it('chaque report de clôture tiré de l’exercice l’écarte, ou ne lit que le livre-journal', () => {
        const appels = [...exercice.matchAll(/lireComptesDuReport\(tx, tenantId, (\{[^}]*\})/g)].map((m) => m[1]);
        expect(appels.length).toBeGreaterThanOrEqual(3);
        for (const filtre of appels) {
            expect(filtre.includes('...HORS_SITUATION') || filtre.includes('StatutEcriture.VALIDEE')).toBe(true);
        }
    });
    it('les clôtures partielle et totale refusent un journal de situation', () => {
        for (const methode of ['async clorePartielle(', 'async cloreTotale(']) {
            const debut = exercice.indexOf(methode);
            expect(debut).toBeGreaterThan(-1);
            const corps = exercice.slice(debut, exercice.indexOf('\n  }\n', debut));
            expect(corps).toContain('estJournalDeSituation(');
            expect(corps).toContain('motifJournalDeSituationNonCloturable(');
        }
    });
});
describe('le gel de période et l’état des journaux de saisie', () => {
    const cloturePeriode = { journalId: null, granularite: client_1.GranulariteCloture.PERIODE, dateLimite: new Date('2026-03-31T00:00:00Z') };
    const clotureTotale = { journalId: 'jSit', granularite: client_1.GranulariteCloture.TOTALE, dateLimite: new Date('2026-12-31T00:00:00Z') };
    it('une clôture de période ne fige pas un journal de situation, l’exercice clôturé si', () => {
        const date = new Date('2026-02-10T00:00:00Z');
        expect((0, gel_cloture_1.motifLigneFigee)({ journalId: 'jOd', date, exerciceClos: false }, [cloturePeriode])).not.toBeNull();
        expect((0, gel_cloture_1.motifLigneFigee)({ journalId: 'jSit', date, exerciceClos: false, journalSituation: true }, [cloturePeriode])).toBeNull();
        expect((0, gel_cloture_1.motifLigneFigee)({ journalId: 'jSit', date, exerciceClos: true, journalSituation: true }, [])).not.toBeNull();
    });
    it('le mois d’un journal de situation porte l’état SITUATION, jamais « Brouillard » ni « Clôturé » par une période', () => {
        const mois = [{ debut: '2026-02-01', fin: '2026-02-28' }];
        const comptages = [{ journalId: 'jSit', date: new Date('2026-02-10T00:00:00Z'), statut: client_1.StatutEcriture.SITUATION, estANouveauProvisoire: false, nombre: 3 }];
        const [ligne] = (0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'jSit', type: 'SITUATION' }], mois, comptages, [cloturePeriode], false);
        expect(ligne.cases[0].etat).toBe('SITUATION');
        expect(ligne.cases[0].enBrouillard).toBe(0);
        expect(ligne.cases[0].figeJusquau).toBeNull();
        const [fige] = (0, etat_journaux_saisie_1.grilleJournauxSaisie)([{ id: 'jSit', type: 'SITUATION' }], mois, comptages, [clotureTotale], false);
        expect(fige.cases[0].etat).toBe('CLOTURE');
    });
});
describe('la numérotation · jamais la séquence du fichier', () => {
    const sit = { id: 'jSit', numerotation: client_1.NumerotationPiece.CONTINUE_FICHIER, type: client_1.TypeJournal.SITUATION };
    const ach = { id: 'jAch', numerotation: client_1.NumerotationPiece.CONTINUE_FICHIER, type: client_1.TypeJournal.ACHATS };
    it('un journal de situation posé en numérotation du fichier numérote sur lui seul', () => {
        expect((0, numerotation_piece_1.modeEffectif)(sit)).toBe(client_1.NumerotationPiece.CONTINUE_JOURNAL);
        expect((0, numerotation_piece_1.modeEffectif)(ach)).toBe(client_1.NumerotationPiece.CONTINUE_FICHIER);
        expect((0, numerotation_piece_1.journauxDeLaSequenceDuFichier)([sit, ach]).map((j) => j.id)).toEqual(['jAch']);
    });
    it('la séquence du fichier ne lit jamais le maximum d’un journal de situation', async () => {
        const aggregate = jest.fn().mockResolvedValue({ _max: { numeroPiece: 7 } });
        const tx = { ecriture: { aggregate } };
        await expect((0, numerotation_piece_1.prochainNumeroPiece)(tx, 't1', ach, 'e1', new Date('2026-02-10T00:00:00Z'))).resolves.toBe(8);
        expect(JSON.stringify(aggregate.mock.calls[0][0].where)).toContain('"type":{"not":"SITUATION"}');
    });
});
describe('le contrôle nomme les écritures validées dans un journal de situation', () => {
    it('le parcours des écritures les relève, sans seconde lecture, et l’analyse les nomme', () => {
        const src = SOURCE('src/modules/controles/controles.service.ts');
        const debut = src.indexOf('private async parcourirEcrituresControlees(');
        expect(debut).toBeGreaterThan(-1);
        const corps = src.slice(debut, src.indexOf('\n  }\n', debut));
        expect(corps).toContain('where: { tenantId, exerciceId, ...HORS_SITUATION }');
        expect(corps).toMatch(/e\.statut === StatutEcriture\.VALIDEE && e\.journal\.type === TypeJournal\.SITUATION\) valideesEnSituation\.ajouter\(e\)/);
        expect(src).toContain("code: 'JOURNAL_DE_SITUATION_AU_LIVRE_JOURNAL'");
    });
    it('celles restées au brouillard par la reprise (tenues) sont nommées, et la clôture dit leur issue (relecture M3)', () => {
        const src = SOURCE('src/modules/controles/controles.service.ts');
        const debut = src.indexOf('private async parcourirEcrituresControlees(');
        const corps = src.slice(debut, src.indexOf('\n  }\n', debut));
        expect(corps).toMatch(/e\.statut === StatutEcriture\.BROUILLARD && e\.journal\.type === TypeJournal\.SITUATION\) brouillardEnSituation\.ajouter\(e\)/);
        expect(src).toContain("code: 'JOURNAL_DE_SITUATION_AU_BROUILLARD'");
        const exercice = SOURCE('src/modules/exercice/exercice.service.ts');
        const cloturer = exercice.slice(exercice.indexOf('  async cloturer('));
        const corpsCloture = cloturer.slice(0, cloturer.indexOf('\n  }\n'));
        expect(corpsCloture).toContain('statut: StatutEcriture.BROUILLARD, journal: { type: TypeJournal.SITUATION }');
        const migration = SOURCE('prisma/migrations/20270171040000_ecritures_de_situation_tenues/migration.sql');
        expect(migration).toContain('UPDATE "ecritures" SET "statut" = \'BROUILLARD\' WHERE "id" = ANY (tenues);');
        expect(migration).toMatch(/"lettrageId" IS NOT NULL OR l\."lettre" IS NOT NULL OR l\."rapprochementId" IS NOT NULL/);
        expect(migration).toContain("c.confrelid = '\"ecritures\"'::regclass");
        expect(migration).toContain('FROM pg_constraint c');
        expect(migration).toMatch(/IF cles = 0 THEN\s+RAISE EXCEPTION/);
    });
});
describe('les lectures de travail écartent la situation', () => {
    it('le grand livre, le justificatif et le périmètre du journal le disent dans leur filtre', () => {
        const src = SOURCE('src/modules/comptabilite/ecriture.service.ts');
        const perimetres = [...src.matchAll(/const perimetreExercice = \{[^;]*\};/g)].map((m) => m[0]);
        expect(perimetres.length).toBeGreaterThanOrEqual(2);
        for (const p of perimetres)
            expect(p).toContain('...HORS_SITUATION');
        expect(ecritures_de_situation_1.HORS_SITUATION).toEqual({ statut: { not: client_1.StatutEcriture.SITUATION } });
    });
});
//# sourceMappingURL=ecritures-de-situation.spec.js.map