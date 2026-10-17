"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const analyse_journaux_service_1 = require("./analyse-journaux.service");
const sequence_pieces_1 = require("./sequence-pieces");
function service(options) {
    const versLigne = (e) => ({
        id: e.id,
        journalId: e.journalId,
        date: e.date,
        numeroPiece: e.numeroPiece,
        statut: e.statut ?? client_1.StatutEcriture.VALIDEE,
        estGenereeParCloture: e.estGenereeParCloture ?? false,
        _count: { lignes: e.lignes.length },
        lignes: e.lignes,
    });
    const prisma = {
        exercice: {
            findFirst: jest.fn(({ where }) => {
                const a = options.arret;
                if (where.id === 'e1') {
                    return Promise.resolve(a ? a.exercice : { dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) });
                }
                if (!a)
                    return Promise.resolve(null);
                const j = { id: 'e2', ...a.jumeau };
                if (where.dateDebut && where.dateDebut.getTime() === a.jumeau.dateDebut.getTime())
                    return Promise.resolve(j);
                if (where.dateFin && where.dateFin.getTime() === a.jumeau.dateFin.getTime())
                    return Promise.resolve(j);
                return Promise.resolve(null);
            }),
        },
        tenant: {
            findUnique: jest.fn(() => Promise.resolve({ dateDissolution: options.arret?.dissolution ?? null })),
        },
        compte: {
            findMany: jest.fn(({ where }) => Promise.resolve((options.comptes ?? []).filter((c) => where?.numero?.startsWith ? c.numero.startsWith(where.numero.startsWith) : true))),
        },
        ligneEcriture: {
            groupBy: jest.fn(() => Promise.resolve((options.groupes ?? []).map((g) => ({
                compteId: g.compteId,
                _sum: { debit: g.debit, credit: g.credit },
                _count: { _all: g.lignes },
            })))),
        },
        journal: { findMany: jest.fn().mockResolvedValue(options.journaux ?? []) },
        ecriture: {
            findMany: jest.fn(({ where, cursor }) => Promise.resolve(cursor
                ? []
                : (where?.exerciceId === 'e2' ? options.arret?.ecrituresJumeau ?? [] : options.ecritures ?? []).map(versLigne))),
        },
    };
    return { service: new analyse_journaux_service_1.AnalyseJournauxService(prisma), prisma: prisma };
}
const COMPTES = [
    { id: 'c52', numero: '52110000', intitule: 'Banque', classe: 'CLASSE_5' },
    { id: 'c60', numero: '60100000', intitule: 'Achats', classe: 'CLASSE_6' },
    { id: 'c61', numero: '61100000', intitule: 'Transports', classe: 'CLASSE_6' },
];
describe('Palmarès des comptes', () => {
    it('CLASSE SUR LE MOUVEMENT, PAS SUR LE SOLDE', async () => {
        const { service: s } = service({
            comptes: COMPTES,
            groupes: [
                { compteId: 'c52', debit: 500_000, credit: 500_000, lignes: 400 },
                { compteId: 'c60', debit: 300_000, credit: 0, lignes: 12 },
            ],
        });
        const p = await s.palmaresComptes('t1', { exerciceId: 'e1' });
        expect(p.lignes[0].numero).toBe('52110000');
        expect(p.lignes[0].mouvement).toBe(1_000_000);
        expect(p.lignes[0].solde).toBe(0);
    });
    it('la PART CUMULÉE se prend sur le périmètre entier, pas sur la tranche affichée', async () => {
        const { service: s } = service({
            comptes: COMPTES,
            groupes: [
                { compteId: 'c52', debit: 500_000, credit: 0, lignes: 5 },
                { compteId: 'c60', debit: 300_000, credit: 0, lignes: 5 },
                { compteId: 'c61', debit: 200_000, credit: 0, lignes: 5 },
            ],
        });
        const p = await s.palmaresComptes('t1', { exerciceId: 'e1', limite: 1 });
        expect(p.lignes).toHaveLength(1);
        expect(p.lignes[0].part).toBe(50);
        expect(p.lignes[0].partCumulee).toBe(50);
        expect(p.total.comptes).toBe(3);
        expect(p.tronque).toBe(true);
    });
    it('EXCLUT LE REPORT À-NOUVEAU, et NE LIT PAS le brouillard par défaut', async () => {
        const { service: s, prisma } = service({
            comptes: COMPTES,
            groupes: [{ compteId: 'c60', debit: 1, credit: 0, lignes: 1 }],
        });
        await s.palmaresComptes('t1', { exerciceId: 'e1' });
        const filtre = prisma.ligneEcriture.groupBy.mock.calls[0][0].where.ecriture;
        expect(filtre.estGenereeParCloture).toBe(false);
        expect(filtre.statut).toBe(client_1.StatutEcriture.VALIDEE);
        const ouvert = service({ comptes: COMPTES, groupes: [] });
        await ouvert.service.palmaresComptes('t1', { exerciceId: 'e1', inclureBrouillard: true });
        expect(ouvert.prisma.ligneEcriture.groupBy.mock.calls[0][0].where.ecriture.statut).toEqual({ not: 'SITUATION' });
    });
});
describe('Analyse des journaux', () => {
    const journal = (code, numerotation, id = code) => ({ id, code, intitule: `Journal ${code}`, type: 'ACHATS', numerotation });
    const ecr = (journalId, numeroPiece, mois = 0, extra = {}) => ({
        id: `${journalId}-${numeroPiece}-${mois}`,
        journalId,
        date: new Date(Date.UTC(2026, mois, 15)),
        numeroPiece,
        lignes: [{ debit: 100, credit: 0 }, { debit: 0, credit: 100 }],
        ...extra,
    });
    it('NOMME les numéros partis avec l’arrêt à la dissolution, sans les compter manquants', async () => {
        const dissolution = new Date(Date.UTC(2026, 5, 30));
        const { service: s } = service({
            journaux: [journal('ACH', client_1.NumerotationPiece.CONTINUE_JOURNAL)],
            ecritures: [ecr('ACH', 1), ecr('ACH', 2), ecr('ACH', 5)],
            arret: {
                exercice: { dateDebut: new Date(Date.UTC(2026, 0, 1)), dateFin: dissolution },
                dissolution,
                jumeau: { dateDebut: new Date(Date.UTC(2026, 6, 1)), dateFin: new Date(Date.UTC(2026, 11, 31)) },
                ecrituresJumeau: [ecr('ACH', 3, 6), ecr('ACH', 6, 7)],
            },
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        expect(a.lignes[0].sequence.trous).toEqual([{ de: 4, a: 4 }]);
        expect(a.lignes[0].sequence.manquants).toBe(1);
        expect(a.lignes[0].sequence.rattachesALArret?.nombre).toBe(1);
        expect(a.lignes[0].sequence.rattachesALArret?.explication).toContain('exercice de liquidation');
    });
    it('TROUVE LE TROU d’une numérotation continue par journal', async () => {
        const { service: s } = service({
            journaux: [journal('ACH', client_1.NumerotationPiece.CONTINUE_JOURNAL)],
            ecritures: [ecr('ACH', 1), ecr('ACH', 2), ecr('ACH', 5)],
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        expect(a.lignes[0].sequence.manquants).toBe(2);
        expect(a.lignes[0].sequence.trous).toEqual([{ de: 3, a: 4 }]);
    });
    it('NE CRIE PAS AU TROU sur une numérotation CONTINUE SUR LE FICHIER', async () => {
        const { service: s } = service({
            journaux: [
                journal('ACH', client_1.NumerotationPiece.CONTINUE_FICHIER),
                journal('VEN', client_1.NumerotationPiece.CONTINUE_FICHIER),
            ],
            ecritures: [ecr('ACH', 1), ecr('VEN', 2), ecr('ACH', 3), ecr('VEN', 4)],
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        for (const l of a.lignes) {
            expect(l.sequence.manquants).toBeNull();
            expect(l.sequence.explication).toContain('TOUS les journaux');
        }
        expect(a.sequenceDuDossier.applicable).toBe(true);
        expect(a.sequenceDuDossier.manquants).toBe(0);
    });
    it('NE CRIE PAS AU TROU au changement de mois sur une numérotation MENSUELLE', async () => {
        const { service: s } = service({
            journaux: [journal('ACH', client_1.NumerotationPiece.MENSUELLE)],
            ecritures: [ecr('ACH', 1, 0), ecr('ACH', 2, 0), ecr('ACH', 1, 1), ecr('ACH', 2, 1)],
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        expect(a.lignes[0].sequence.manquants).toBe(0);
    });
    it('TROUVE le trou À L’INTÉRIEUR d’un mois, que la lecture annuelle MASQUERAIT', async () => {
        const { service: s } = service({
            journaux: [journal('ACH', client_1.NumerotationPiece.MENSUELLE)],
            ecritures: [ecr('ACH', 1, 0), ecr('ACH', 2, 0), ecr('ACH', 1, 1), ecr('ACH', 3, 1)],
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        expect(a.lignes[0].sequence.trous).toEqual([{ de: 2, a: 2 }]);
        expect(a.lignes[0].sequence.manquants).toBe(1);
    });
    it('NE SE PRONONCE PAS sur une numérotation MANUELLE', async () => {
        const { service: s } = service({
            journaux: [journal('OD', client_1.NumerotationPiece.MANUELLE)],
            ecritures: [ecr('OD', 7), ecr('OD', 99)],
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        expect(a.lignes[0].sequence.manquants).toBeNull();
        expect(a.lignes[0].sequence.trous).toEqual([]);
    });
    it('SÉPARE le brouillard et la clôture du travail de saisie', async () => {
        const { service: s } = service({
            journaux: [journal('ACH', client_1.NumerotationPiece.CONTINUE_JOURNAL)],
            ecritures: [
                ecr('ACH', 1),
                ecr('ACH', 2, 0, { statut: client_1.StatutEcriture.BROUILLARD }),
                ecr('ACH', 3, 0, { estGenereeParCloture: true }),
            ],
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        expect(a.lignes[0].nombreEcritures).toBe(3);
        expect(a.lignes[0].enBrouillard).toBe(1);
        expect(a.lignes[0].deCloture).toBe(1);
    });
    it('la séquence du DOSSIER ne mêle pas les journaux qui ne sont pas sur le fichier', async () => {
        const { service: s } = service({
            journaux: [
                journal('ACH', client_1.NumerotationPiece.CONTINUE_FICHIER),
                journal('OD', client_1.NumerotationPiece.MENSUELLE),
            ],
            ecritures: [ecr('ACH', 10), ecr('ACH', 11), ecr('OD', 1), ecr('OD', 2)],
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        expect(a.sequenceDuDossier.manquants).toBe(0);
        expect(a.sequenceDuDossier.trous).toEqual([]);
    });
    it('N’AFFICHE AUCUN CONTRÔLE D’ÉQUILIBRE PAR JOURNAL', async () => {
        const { service: s } = service({
            journaux: [journal('ACH', client_1.NumerotationPiece.CONTINUE_JOURNAL)],
            ecritures: [ecr('ACH', 1)],
        });
        const a = await s.analyseJournaux('t1', { exerciceId: 'e1' });
        expect(Object.keys(a.lignes[0])).not.toContain('equilibre');
        expect(Object.keys(a.lignes[0])).not.toContain('boucle');
    });
});
describe('Règle de séquence, isolée', () => {
    it('la séquence ne commence PAS forcément à 1', () => {
        expect((0, sequence_pieces_1.trousDeLaSequence)([340, 341, 342])).toEqual([]);
    });
    it('chaque mode de numérotation a SON périmètre', () => {
        expect((0, sequence_pieces_1.perimetreDeLaSequence)(client_1.NumerotationPiece.CONTINUE_JOURNAL)).toBe('JOURNAL_EXERCICE');
        expect((0, sequence_pieces_1.perimetreDeLaSequence)(client_1.NumerotationPiece.CONTINUE_FICHIER)).toBe('DOSSIER_EXERCICE');
        expect((0, sequence_pieces_1.perimetreDeLaSequence)(client_1.NumerotationPiece.MENSUELLE)).toBe('JOURNAL_MOIS');
        expect((0, sequence_pieces_1.perimetreDeLaSequence)(client_1.NumerotationPiece.MANUELLE)).toBe('AUCUN');
    });
});
//# sourceMappingURL=analyse-journaux.spec.js.map