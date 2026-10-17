"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const exercice_service_1 = require("./exercice.service");
const N = { id: 'n', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const N1 = { id: 'n1', tenantId: 't', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
const ligne = (debit, credit, lettre = null) => ({
    debit,
    credit,
    lettre,
    libelle: 'L',
    dateEcheance: null,
    ecriture: { libelle: 'E' },
});
const COMPTES = [
    { id: '601', numero: '60110000', intitule: 'Achats', modeReportANouveau: 'AUCUN', lignesEcriture: [ligne(1000, 0)] },
    { id: '701', numero: '70110000', intitule: 'Ventes', modeReportANouveau: 'AUCUN', lignesEcriture: [ligne(0, 1500)] },
    { id: '521', numero: '52110000', intitule: 'Banque', modeReportANouveau: 'SOLDE', lignesEcriture: [ligne(1500, 0), ligne(0, 1000)] },
    { id: '131', numero: '13100000', intitule: 'Excédent', modeReportANouveau: 'SOLDE', lignesEcriture: [] },
    { id: '411', numero: '41110000', intitule: 'Clients', modeReportANouveau: 'DETAIL', lignesEcriture: [ligne(300, 0), ligne(200, 0, 'AA'), ligne(0, 200, 'AA')] },
    { id: '401', numero: '40110000', intitule: 'Fournisseurs', modeReportANouveau: 'DETAIL', lignesEcriture: [ligne(0, 300)] },
];
const estReference = (x) => !!x && typeof x === 'object' && 'modelName' in x;
function champ(r, v, f) {
    if (f === null || typeof f !== 'object')
        return v === f;
    return Object.entries(f).every(([op, x]) => {
        const o = estReference(x) ? r[x.name] : x;
        if (op === 'not')
            return o === null ? v !== null : typeof o === 'object' ? !champ(r, v, o) : v !== null && v !== o;
        if (v === null || v === undefined)
            return false;
        if (op === 'equals')
            return v === o;
        if (op === 'in')
            return o.includes(v);
        if (op === 'gt')
            return v > o;
        if (op === 'gte')
            return v >= o;
        if (op === 'lt')
            return v < o;
        if (op === 'lte')
            return v <= o;
        throw new Error(`doublure : filtre « ${op} » non honoré`);
    });
}
function correspond(r, where) {
    return Object.entries((where ?? {})).every(([cle, f]) => {
        if (cle === 'AND')
            return [].concat(f).every((w) => correspond(r, w));
        if (cle === 'OR')
            return f.some((w) => correspond(r, w));
        if (cle === 'NOT')
            return [].concat(f).every((w) => !correspond(r, w));
        if (cle === 'ecriture' || cle === 'compte')
            return correspond(r[cle], f);
        return champ(r, r[cle], f);
    });
}
function lectureDuReport(comptes) {
    const lignes = comptes.flatMap((c) => c.lignesEcriture.map((l, i) => ({
        id: `${c.id}-${String(i).padStart(4, '0')}`,
        compteId: c.id,
        compte: c,
        deviseId: null,
        montantDevise: null,
        coursApplique: null,
        ...l,
        ecriture: { tenantId: 't', exerciceId: 'n', statut: 'VALIDEE', ...l.ecriture },
    })));
    const projeter = (r, select) => Object.fromEntries(Object.entries(select).map(([k, v]) => [k, v === true ? r[k] : { libelle: r[k].libelle }]));
    return {
        compte: {
            findMany: jest.fn(async (a) => {
                if (a.include)
                    throw new Error('doublure : include non honoré');
                return comptes
                    .filter((c) => correspond({ tenantId: 't', ...c }, a.where))
                    .sort((x, y) => (x.numero < y.numero ? -1 : 1))
                    .map((c) => Object.fromEntries(Object.keys(a.select).map((k) => [k, c[k]])));
            }),
        },
        ligneEcriture: {
            fields: { credit: { modelName: 'LigneEcriture', name: 'credit' } },
            groupBy: jest.fn(async (a) => {
                const groupes = new Map();
                for (const l of lignes.filter((x) => correspond(x, a.where))) {
                    const cle = JSON.stringify(a.by.map((k) => l[k]));
                    const g = groupes.get(cle) ?? { ...Object.fromEntries(a.by.map((k) => [k, l[k]])), _sum: {} };
                    const somme = g._sum;
                    for (const k of Object.keys(a._sum))
                        somme[k] = l[k] === null ? (somme[k] ?? null) : (somme[k] ?? 0) + l[k];
                    groupes.set(cle, g);
                }
                return [...groupes.values()];
            }),
            findMany: jest.fn(async (a) => {
                let r = lignes.filter((x) => correspond(x, a.where)).sort((x, y) => (x.id < y.id ? -1 : 1));
                if (a.cursor)
                    r = r.slice(r.findIndex((x) => x.id === a.cursor.id) + (a.skip ?? 0));
                return r.slice(0, a.take).map((x) => projeter(x, a.select));
            }),
        },
    };
}
function service(provisoire, creancesDouteuses = []) {
    const lecture = lectureDuReport(COMPTES);
    const tx = {
        compte: { findMany: lecture.compte.findMany, findUnique: jest.fn().mockResolvedValue({ id: '131' }) },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'od', code: 'OD' }) },
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where?.id === 'n' ? N : N1)),
            findMany: jest.fn().mockResolvedValue([N, N1]),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue({ ...N, statut: 'CLOTURE' }),
        },
        creanceDouteuse: { findMany: jest.fn().mockResolvedValue(creancesDouteuses) },
        ecriture: {
            findFirst: jest.fn().mockResolvedValue(provisoire),
            findMany: jest.fn().mockResolvedValue([]),
            count: jest.fn().mockResolvedValue(4),
            delete: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockResolvedValue({ lignes: [] }),
        },
        ligneEcriture: {
            ...lecture.ligneEcriture,
            findMany: jest.fn((a) => a.where.id?.in ? Promise.resolve([]) : lecture.ligneEcriture.findMany(a)),
            count: jest.fn().mockResolvedValue(0),
            deleteMany: jest.fn().mockResolvedValue({}),
        },
        cloture: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]) },
        lettrage: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.dateFin || where.dateDebut ? null : N)),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        lettrage: { count: jest.fn().mockResolvedValue(0) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
        creanceDouteuse: { findMany: jest.fn().mockRejectedValue(new Error('lue hors de la transaction de clôture')) },
        $transaction: jest.fn((fn) => fn(tx)),
    };
    const journalService = { prochainNumeroPiece: jest.fn().mockResolvedValue(50) };
    return { s: new exercice_service_1.ExerciceService(prisma, journalService), tx };
}
describe('Clôture annuelle', () => {
    it('solde la gestion sur le résultat, puis passe le report définitif · la ligne lettrée ne passe pas', async () => {
        const { s, tx } = service(null);
        await s.cloturer('t', 'n', 'u');
        const [cloture, ran] = tx.ecriture.create.mock.calls.map((c) => c[0].data);
        expect(cloture.exerciceId).toBe('n');
        expect(cloture.lignes.create.find((l) => l.compteId === '131')).toMatchObject({ credit: 500 });
        expect(ran.exerciceId).toBe('n1');
        expect(ran.estANouveauProvisoire).toBeUndefined();
        const lignes = ran.lignes.create;
        expect(lignes.find((l) => l.compteId === '521')).toMatchObject({ debit: 500 });
        expect(lignes.find((l) => l.compteId === '131')).toMatchObject({ credit: 500 });
        expect(lignes.filter((l) => l.compteId === '411')).toHaveLength(1);
        expect(lignes.reduce((t, l) => t + l.debit - l.credit, 0)).toBe(0);
        expect(tx.exercice.update).toHaveBeenCalledWith({ where: { id: 'n' }, data: { statut: client_1.StatutExercice.CLOTURE } });
    });
    it('passe les deux écritures VALIDÉES, et marque seule l’écriture de solde', async () => {
        const { s, tx } = service(null);
        await s.cloturer('t', 'n', 'u');
        const [cloture, ran] = tx.ecriture.create.mock.calls.map((c) => c[0].data);
        expect({ statut: cloture.statut, valideeBy: cloture.valideeBy, solde: cloture.estSoldeDesComptesDeGestion }).toEqual({
            statut: 'VALIDEE',
            valideeBy: 'u',
            solde: true,
        });
        expect({ statut: ran.statut, solde: ran.estSoldeDesComptesDeGestion }).toEqual({ statut: 'VALIDEE', solde: undefined });
    });
    it('F185 · la clôture lit le plan sans ses lignes, le reste en sommes, le DÉTAIL par les seules colonnes du report', async () => {
        const { s, tx } = service(null);
        await s.cloturer('t', 'n', 'u');
        expect(tx.compte.findMany.mock.calls[0][0].include).toBeUndefined();
        expect(tx.ligneEcriture.groupBy).toHaveBeenCalled();
        const detail = tx.ligneEcriture.findMany.mock.calls[0][0];
        expect(detail.select.ecriture).toEqual({ select: { libelle: true } });
        expect(Object.keys(detail.select).sort()).toEqual(['compteId', 'coursApplique', 'credit', 'dateEcheance', 'debit', 'deviseId', 'ecriture', 'id', 'lettre', 'libelle', 'montantDevise']);
    });
    it('refuse de clôturer avant l’exercice précédent (audit final F6)', async () => {
        const { s, tx } = service(null);
        s.prisma.exercice.findFirst.mockImplementation(({ where }) => Promise.resolve(where.dateFin ? { dateDebut: new Date('2025-01-01'), dateFin: new Date('2025-12-31') } : where.dateDebut ? null : N));
        await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/2025 n'est pas clôturé/);
        expect(tx.ecriture.create).not.toHaveBeenCalled();
    });
    it('refuse de clôturer quand un exercice postérieur est déjà clos (audit final F6)', async () => {
        const { s, tx } = service(null);
        s.prisma.exercice.findFirst.mockImplementation(({ where }) => Promise.resolve(where.dateDebut ? { dateDebut: new Date('2027-01-01') } : where.dateFin ? null : N));
        await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/postérieur est déjà clôturé/);
        expect(tx.ecriture.create).not.toHaveBeenCalled();
    });
    it('remplace le report PROVISOIRE et lui reprend son numéro de pièce', async () => {
        const { s, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ lettre: null, rapprochementId: null }] });
        await s.cloturer('t', 'n', 'u');
        expect(tx.ecriture.delete).toHaveBeenCalledWith({ where: { id: 'p' } });
        const ran = tx.ecriture.create.mock.calls[1][0].data;
        expect(ran.numeroPiece).toBe(3);
    });
    it('refuse de clôturer tant qu’il reste du brouillard', async () => {
        const { s } = service(null);
        s.prisma.ecriture.count.mockResolvedValue(1);
        await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/brouillard/);
    });
});
describe('AU2 · clôture de N avec une ouverture déjà passée dans N+1', () => {
    const IMPORT = { id: 'imp', numeroPiece: 1, statut: 'VALIDEE', journal: { code: 'OD' } };
    const ligneImport = (id, compteId, debit, credit, extra = {}) => ({
        id, ecritureId: 'imp', compteId, compte: { numero: `N${compteId}` }, debit, credit, libelle: 'Import',
        dateEcheance: null, deviseId: null, montantDevise: null, coursApplique: null, lettrageId: null, rapprochementId: null, ...extra,
    });
    function avecOuverture(ecritures, lignes) {
        const { s, tx } = service(null);
        tx.ecriture.findMany.mockResolvedValue(ecritures);
        const parDefaut = tx.ligneEcriture.findMany.getMockImplementation();
        tx.ligneEcriture.findMany.mockImplementation(((a) => a.where.ecriture?.AND ? Promise.resolve(a.cursor ? [] : lignes) : parDefaut(a)));
        tx.ligneEcriture.count.mockResolvedValue(lignes.length);
        const lecturePlan = tx.compte.findMany.getMockImplementation();
        tx.compte.findMany = jest.fn((a) => a.where.lettrable ? Promise.resolve([]) : a.where.id ? Promise.resolve(a.where.id.in.map((id) => ({ id, numero: `N${id}`, intitule: '' }))) : lecturePlan(a));
        tx.devise = { findMany: jest.fn().mockResolvedValue([{ id: 'usd', code: 'USD' }]) };
        return { s, tx };
    }
    const importExact = [
        ligneImport('i1', '521', 500, 0), ligneImport('i2', '411', 300, 0), ligneImport('i3', '401', 0, 300), ligneImport('i4', '131', 0, 500),
    ];
    const faux = [ligneImport('i1', '521', 500, 0), ligneImport('i2', '411', 450, 0), ligneImport('i3', '401', 0, 300), ligneImport('i4', '131', 0, 650)];
    it('une ouverture qui correspond au bilan de clôture · aucun report ajouté, et c’est dit', async () => {
        const { s, tx } = avecOuverture([IMPORT], importExact);
        const r = (await s.cloturer('t', 'n', 'u'));
        expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
        expect(tx.ecriture.create.mock.calls[0][0].data.estSoldeDesComptesDeGestion).toBe(true);
        expect(r.issueOuverture.join(' ')).toMatch(/correspond au bilan de clôture/);
    });
    it('R1 · le périmètre est le PREMIER JOUR, toutes origines, sans compte de gestion ni provisoire', async () => {
        const { s, tx } = avecOuverture([IMPORT], importExact);
        await s.cloturer('t', 'n', 'u');
        const where = tx.ecriture.findMany.mock.calls.at(-1)[0].where;
        expect(where).toMatchObject({
            exerciceId: 'n1',
            estANouveauProvisoire: false,
            estSoldeDesComptesDeGestion: false,
            AND: [
                {
                    OR: [
                        { OR: [{ date: N1.dateDebut }, { dateValeur: N1.dateDebut }] },
                        { corrigeEcriture: { is: { OR: [{ date: N1.dateDebut }, { dateValeur: N1.dateDebut }] } } },
                    ],
                },
                {
                    OR: [
                        { OR: [{ estGenereeParCloture: true }, { journal: { type: 'GENERAL' } }] },
                        { corrigeEcriture: { is: { OR: [{ estGenereeParCloture: true }, { journal: { type: 'GENERAL' } }] } } },
                    ],
                },
                {
                    reevaluationExtourne: { is: null },
                    OR: [{ corrigeEcritureId: null }, { corrigeEcriture: { is: { reevaluationExtourne: { is: null } } } }],
                },
            ],
            lignes: { none: { compte: { classe: { in: ['CLASSE_6', 'CLASSE_7', 'CLASSE_8'] } } } },
        });
        expect(JSON.stringify(where)).not.toMatch(/TRESORERIE|ACHATS|VENTES/);
        expect(where.estGenereeParCloture).toBeUndefined();
    });
    it('R1 · import 600, négatif lié, OD de 300 · concordant, rien n’est ajouté (le report ne double pas)', async () => {
        const ecritures = [IMPORT, { id: 'neg', numeroPiece: 2, statut: 'VALIDEE', journal: { code: 'OD' } }, { id: 'od', numeroPiece: 3, statut: 'VALIDEE', journal: { code: 'OD' } }];
        const lignes = [
            ligneImport('a1', '411', 600, 0), ligneImport('a2', '131', 0, 600),
            ligneImport('b1', '411', -600, 0, { ecritureId: 'neg' }), ligneImport('b2', '131', 0, -600, { ecritureId: 'neg' }),
            ligneImport('c1', '411', 300, 0, { ecritureId: 'od' }), ligneImport('c2', '521', 500, 0, { ecritureId: 'od' }),
            ligneImport('c3', '401', 0, 300, { ecritureId: 'od' }), ligneImport('c4', '131', 0, 500, { ecritureId: 'od' }),
        ];
        const { s, tx } = avecOuverture(ecritures, lignes);
        const r = (await s.cloturer('t', 'n', 'u', { ouvertureImportee: 'RECTIFIER' }));
        expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
        expect(r.issueOuverture.join(' ')).toMatch(/correspond au bilan de clôture/);
    });
    it('une ouverture entièrement annulée · plus de déclaration, le report entier passe (R10)', async () => {
        const lignes = [ligneImport('a1', '411', 600, 0), ligneImport('a2', '131', 0, 600), ligneImport('b1', '411', -600, 0), ligneImport('b2', '131', 0, -600)];
        const { s, tx } = avecOuverture([IMPORT], lignes);
        await s.cloturer('t', 'n', 'u');
        const ran = tx.ecriture.create.mock.calls[1][0].data.lignes.create;
        expect(ran.find((l) => l.compteId === '521')).toMatchObject({ debit: 500 });
    });
    describe('second tour, B1 · une ouverture annulée par un négatif inscrit hors du premier jour', () => {
        const OD = { id: 'imp', numeroPiece: 1, statut: 'VALIDEE', journal: { code: 'OD' }, date: N1.dateDebut, dateValeur: null, corrigeEcritureId: null };
        const negatif = (date, dateValeur = null) => ({
            id: 'neg', numeroPiece: 2, statut: 'VALIDEE', journal: { code: 'OD' }, date, dateValeur, corrigeEcritureId: 'imp',
        });
        const annulee = [
            ligneImport('a1', '521', 500, 0), ligneImport('a2', '131', 0, 500),
            ligneImport('b1', '521', -500, 0, { ecritureId: 'neg' }), ligneImport('b2', '131', 0, -500, { ecritureId: 'neg' }),
        ];
        const MARS = new Date('2027-03-15');
        it('rien de déclaré · refus qui nomme le négatif, sa date et les deux issues', async () => {
            const { s, tx } = avecOuverture([OD, negatif(MARS)], annulee);
            await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/OD n° 2 du 15\/03\/2027.*AUDCIF art\. 34.*« Conserver ».*ressaisie.*« Rectifier ».*le report entier/);
            expect(tx.ecriture.create.mock.calls.filter((c) => c[0].data.exerciceId === 'n1')).toHaveLength(0);
        });
        it('RECTIFIER · le report ENTIER est passé, rien n’est inscrit en négatif', async () => {
            const { s, tx } = avecOuverture([OD, negatif(MARS)], annulee);
            const r = (await s.cloturer('t', 'n', 'u', { ouvertureImportee: 'RECTIFIER' }));
            const ran = tx.ecriture.create.mock.calls[1][0].data.lignes.create;
            expect(ran.find((l) => l.compteId === '521')).toMatchObject({ debit: 500 });
            expect(ran.every((l) => l.debit >= 0 && l.credit >= 0)).toBe(true);
            expect(r.issueOuverture.join(' ')).toMatch(/OD n° 2 du 15\/03\/2027.*non ressaisies · le report entier est passé/);
        });
        it('CONSERVER · rien n’est passé, motif, positions et négatif s’écrivent sur l’exercice ; sans motif, refus', async () => {
            const sans = avecOuverture([OD, negatif(MARS)], annulee);
            await expect(sans.s.cloturer('t', 'n', 'u', { ouvertureImportee: 'CONSERVER' })).rejects.toThrow(/motif écrit/);
            const { s, tx } = avecOuverture([OD, negatif(MARS)], annulee);
            await s.cloturer('t', 'n', 'u', { ouvertureImportee: 'CONSERVER', motifConservation: 'Ouverture ressaisie le 15/03' });
            expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
            const data = tx.exercice.update.mock.calls[0][0].data;
            expect(data.motifOuvertureSuivanteConservee).toBe('Ouverture ressaisie le 15/03');
            expect(data.ecartsOuvertureSuivanteConservee).toMatchObject({
                ecarts: expect.arrayContaining([expect.objectContaining({ numero: 'N521', cloture: 500, ouverture: 0 })]),
                negatifsTardifs: [{ piece: 'OD n° 2', date: '2027-03-15' }],
            });
        });
        it('un négatif daté ou valorisé au PREMIER JOUR · position nulle sans doute, le report entier passe sans déclaration (R10)', async () => {
            for (const n of [negatif(N1.dateDebut), negatif(MARS, N1.dateDebut)]) {
                const { s, tx } = avecOuverture([OD, n], annulee);
                await s.cloturer('t', 'n', 'u');
                const ran = tx.ecriture.create.mock.calls[1][0].data.lignes.create;
                expect(ran.find((l) => l.compteId === '521')).toMatchObject({ debit: 500 });
            }
        });
    });
    it('R2 · le report porte le 521 en dollars, l’import en francs seuls · ÉCART nommé avec sa devise, jamais concordant', async () => {
        const { s, tx } = avecOuverture([IMPORT], importExact);
        const parDefaut = tx.ligneEcriture.groupBy.getMockImplementation();
        tx.ligneEcriture.groupBy.mockImplementation((async (a) => a.by.includes('deviseId') && a.where.debit && a.where.debit.gte !== undefined
            ? [{ compteId: '521', deviseId: 'usd', _sum: { debit: 1500, credit: 0, montantDevise: 1 } }, ...(await parDefaut(a)).filter((g) => g.compteId !== '521')]
            : parDefaut(a)));
        await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/N521 \(clôture 1500\.00, ouverture 0\.00\) en USD \(clôture 1\.00, ouverture 0\.00\)/);
    });
    it('un import divergent, rien de déclaré · refus qui nomme les positions, les montants et les deux gestes', async () => {
        const { s } = avecOuverture([IMPORT], faux);
        await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/N411 \(clôture 300\.00, ouverture 450\.00\).*AUDCIF art\. 34.*Rectifier l'import.*Conserver l'import/);
    });
    it('CONSERVER · rien n’est passé, motif ET positions s’écrivent sur l’exercice ; sans motif, refus', async () => {
        const sans = avecOuverture([IMPORT], faux);
        await expect(sans.s.cloturer('t', 'n', 'u', { ouvertureImportee: 'CONSERVER' })).rejects.toThrow(/motif écrit/);
        const { s, tx } = avecOuverture([IMPORT], faux);
        await s.cloturer('t', 'n', 'u', { ouvertureImportee: 'CONSERVER', motifConservation: 'N tenu pour les comparatifs' });
        expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
        const data = tx.exercice.update.mock.calls[0][0].data;
        expect(data.motifOuvertureSuivanteConservee).toBe('N tenu pour les comparatifs');
        expect(data.ecartsOuvertureSuivanteConservee).toMatchObject({
            total: 2,
            tronque: false,
            ecarts: expect.arrayContaining([expect.objectContaining({ numero: 'N411', cloture: 300, ouverture: 450 })]),
        });
    });
    it('un exercice SANS écriture · rien à reporter, l’import fait foi sans déclaration', async () => {
        const { s, tx } = avecOuverture([IMPORT], faux);
        tx.ecriture.count.mockResolvedValue(0);
        const r = (await s.cloturer('t', 'n', 'u'));
        expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
        expect(r.issueOuverture.join(' ')).toMatch(/aucune écriture/);
    });
    it('RECTIFIER · ses lignes inscrites en NÉGATIF puis le report exact ; une ligne lettrée inscrite en négatif est NOMMÉE (R6)', async () => {
        const avecLettree = faux.map((l) => (l.id === 'i2' ? { ...l, lettrageId: 'g' } : l));
        const { s, tx } = avecOuverture([IMPORT], avecLettree);
        const r = (await s.cloturer('t', 'n', 'u', { ouvertureImportee: 'RECTIFIER' }));
        const ran = tx.ecriture.create.mock.calls[1][0].data;
        const lignes = ran.lignes.create;
        expect(lignes.filter((l) => l.compteId === '521' || l.compteId === '401')).toHaveLength(0);
        expect(lignes.filter((l) => l.compteId === '411')).toEqual([
            expect.objectContaining({ debit: -450, credit: -0 }),
            expect.objectContaining({ debit: 300, credit: 0 }),
        ]);
        expect(lignes.reduce((t, l) => t + l.debit - l.credit, 0)).toBe(0);
        expect(ran.statut).toBe('VALIDEE');
        expect(ran.motifCorrection).toMatch(/AUDCIF art\. 34.*art\. 20/);
        expect(r.issueOuverture.join(' ')).toMatch(/lettrées ou pointées.*N411 OD n° 1 débit 450\.00, lettrée/);
        const ouverture = (c) => [...faux, ...lignes].filter((l) => l.compteId === c).reduce((t, l) => t + l.debit - l.credit, 0);
        expect([ouverture('521'), ouverture('411'), ouverture('401'), ouverture('131')]).toEqual([500, 300, -300, -500]);
    });
    const declaree = () => ({
        id: 'cp',
        numeroPiece: 7,
        statut: 'VALIDEE',
        journal: { code: 'OD' },
        reevaluationContrePassationDeclaree: {
            annuleeLe: null,
            ecritureEcarts: {
                lignes: [
                    { compteId: '411', debit: 100, credit: 0, compte: { numero: '41110000' } },
                    { compteId: '479', debit: 0, credit: 100, compte: { numero: '47910000' } },
                ],
            },
        },
    });
    const ligneCp = (id, compteId, debit, credit) => ({ ...ligneImport(id, compteId, debit, credit), ecritureId: 'cp' });
    it('A8 · une contre-passation DÉCLARÉE seule au premier jour · rien à déclarer, le report entier passe, elle n’est jamais inscrite en négatif', async () => {
        const { s, tx } = avecOuverture([declaree()], [ligneCp('k1', '479', 100, 0), ligneCp('k2', '411', 0, 100)]);
        const r = (await s.cloturer('t', 'n', 'u'));
        expect(tx.ecriture.create).toHaveBeenCalledTimes(2);
        const ran = tx.ecriture.create.mock.calls[1][0].data.lignes.create;
        expect(ran.find((l) => l.compteId === '521')).toMatchObject({ debit: 500 });
        expect(ran.filter((l) => l.debit < 0 || l.credit < 0)).toEqual([]);
        expect(r.issueOuverture.join(' ')).not.toMatch(/inscrites en négatif/);
    });
    it('A8 · une OD déclarée qui groupe aussi un bilan d’ouverture · ses lignes de l’écart sortent, les autres restent confrontées', async () => {
        const ecarts = declaree().reevaluationContrePassationDeclaree.ecritureEcarts.lignes.map((l) => l.compteId === '411' ? { ...l, compteId: '412', compte: { numero: '41120000' } } : l);
        const od = { ...declaree(), reevaluationContrePassationDeclaree: { annuleeLe: null, ecritureEcarts: { lignes: ecarts } } };
        const lignes = [
            ligneCp('k1', '479', 100, 0), ligneCp('k2', '412', 0, 100),
            ligneCp('o1', '521', 500, 0), ligneCp('o3', '401', 0, 300), ligneCp('o4', '131', 0, 500), ligneImport('i2', '411', 300, 0),
        ];
        const { s, tx } = avecOuverture([od, IMPORT], lignes);
        const r = (await s.cloturer('t', 'n', 'u'));
        expect(tx.ecriture.create).toHaveBeenCalledTimes(1);
        expect(r.issueOuverture.join(' ')).toMatch(/correspond au bilan de clôture/);
        const sans = avecOuverture([{ ...od, reevaluationContrePassationDeclaree: null }, IMPORT], lignes);
        await expect(sans.s.cloturer('t', 'n', 'u')).rejects.toThrow(/N479 \(clôture 0\.00, ouverture 100\.00\)/);
    });
    it('une écriture du premier jour AU BROUILLARD · la clôture est refusée, les gestes ouverts sont nommés', async () => {
        const { s } = avecOuverture([{ ...IMPORT, statut: 'BROUILLARD' }], importExact);
        await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/au brouillard \(OD n° 1\).*Validez-les/);
    });
    it('une ligne provisoire lettrée sur un compte où l’ouverture fait foi · le lettrage passe sur la ligne importée', async () => {
        const { s, tx } = avecOuverture([IMPORT], importExact);
        tx.ecriture.findFirst.mockResolvedValue({
            id: 'p',
            numeroPiece: 2,
            lignes: [{ id: 'pl', compteId: '411', debit: 300, credit: 0, dateEcheance: null, deviseId: null, montantDevise: null, lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null }],
        });
        tx.ligneEcriture.update = jest.fn().mockResolvedValue({});
        await s.cloturer('t', 'n', 'u');
        expect(tx.ligneEcriture.update).toHaveBeenCalledWith({
            where: { id: 'i2' },
            data: { lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null },
        });
    });
});
describe('AU1 · la clôture reporte le lettrage du provisoire sur le définitif', () => {
    const tenue = { id: 'pl', compteId: '411', debit: 300, credit: 0, dateEcheance: null, deviseId: null, montantDevise: null, lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null };
    const definitif = (lignes) => ({ data }) => Promise.resolve({ lignes: data.exerciceId === 'n1' ? lignes : [] });
    const d = (id, compteId, debit, extra = {}) => ({ id, compteId, debit, credit: 0, dateEcheance: null, deviseId: null, montantDevise: null, ...extra });
    it('la clôture passe, et la ligne définitive de même compte et montant reçoit le groupe', async () => {
        const { s, tx } = service({ id: 'p', numeroPiece: 3, lignes: [tenue] });
        tx.ecriture.create.mockImplementation(definitif([d('d521', '521', 500), d('d411', '411', 300)]));
        tx.ligneEcriture.update = jest.fn().mockResolvedValue({});
        const r = (await s.cloturer('t', 'n', 'u'));
        expect(tx.ligneEcriture.update).toHaveBeenCalledWith({
            where: { id: 'd411' },
            data: { lettre: 'A', lettrageId: 'g', rapprochementId: null, ligneReleveId: null },
        });
        expect(tx.ecriture.delete).toHaveBeenCalledWith({ where: { id: 'p' } });
        expect(r.issueOuverture.join(' ')).toMatch(/reportées sur l'à-nouveau définitif/);
    });
    it('R3 et R4 · deux lignes de même montant aux échéances différentes · aucune devinette, le groupe est DÉLETTRÉ, écrit sur l’exercice, nommé, à relettrer', async () => {
        const { s: sv, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ ...tenue, dateEcheance: new Date('2027-02-01') }] });
        tx.ecriture.create.mockImplementation(definitif([d('x', '411', 300, { dateEcheance: new Date('2027-03-01') }), d('y', '411', 300, { dateEcheance: new Date('2027-04-01') })]));
        tx.ligneEcriture.update = jest.fn().mockResolvedValue({});
        const parDefaut = tx.ligneEcriture.findMany.getMockImplementation();
        tx.ligneEcriture.findMany.mockImplementation(((a) => a.where.lettrageId === 'g'
            ? Promise.resolve([{ id: 'reg', debit: 0, credit: 300, deviseId: null, montantDevise: null, ecriture: { date: new Date('2027-01-20') } }])
            : parDefaut(a)));
        tx.ligneEcriture.updateMany = jest.fn().mockResolvedValue({ count: 1 });
        tx.ligneEcriture.count.mockResolvedValue(2);
        tx.lettrage = {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({ code: 'A', compteId: '411', compte: { numero: '41110000', intitule: 'Clients' } }),
            delete: jest.fn().mockResolvedValue({}),
        };
        const r = (await sv.cloturer('t', 'n', 'u'));
        expect(tx.ligneEcriture.update).not.toHaveBeenCalled();
        expect(tx.ligneEcriture.updateMany).toHaveBeenCalledWith({
            where: { lettrageId: 'g', ecriture: { tenantId: 't' } },
            data: { lettre: null, lettrageId: null, aRelettrerDepuis: expect.any(Date) },
        });
        expect(tx.lettrage.delete).toHaveBeenCalledWith({ where: { id: 'g' } });
        expect(tx.exercice.update.mock.calls[0][0].data.defaitsParLaCloture).toEqual([
            expect.objectContaining({ type: 'LETTRAGE', compte: '41110000', groupe: 'A', lignes: [{ date: '2027-01-20', montant: -300 }] }),
        ]);
        expect(r.issueOuverture.join(' ')).toMatch(/Lettrage A DÉLETTRÉ.*paiement du 2027-01-20.*À relettrer · 2 ligne\(s\) de même montant proposée\(s\)/);
    });
    it('R3 · une seule candidate à une autre échéance · appariée ; la devise ne se relâche jamais', async () => {
        const { s, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ ...tenue, dateEcheance: new Date('2027-02-01') }] });
        tx.ecriture.create.mockImplementation(definitif([d('x', '411', 300, { dateEcheance: new Date('2027-03-01') })]));
        tx.ligneEcriture.update = jest.fn().mockResolvedValue({});
        await s.cloturer('t', 'n', 'u');
        expect(tx.ligneEcriture.update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'x' } }));
    });
    it('R5 · une ligne POINTÉE sans équivalent · le pointage est défait et nommé, jamais un refus (rapprochement en cours ou clos)', async () => {
        for (const statut of ['EN_COURS', 'CLOTURE']) {
            const { s: sv, tx } = service({ id: 'p', numeroPiece: 3, lignes: [{ ...tenue, debit: 999, lettre: null, lettrageId: null, rapprochementId: 'r' }] });
            tx.rapprochementBancaire.findMany.mockResolvedValue([{ id: 'r', statut, dateReleve: new Date('2027-01-31'), compte: { numero: '52110000' } }]);
            const r = (await sv.cloturer('t', 'n', 'u'));
            expect(r.issueOuverture.join(' ')).toMatch(/Pointage défait · la ligne d'à-nouveau provisoire \(débit 999\.00\) quitte le rapprochement du relevé du 2027-01-31/);
            expect(tx.exercice.update.mock.calls[0][0].data.defaitsParLaCloture).toEqual([
                expect.objectContaining({ type: 'POINTAGE', compte: '52110000', releve: '2027-01-31', montant: 999 }),
            ]);
        }
    });
});
describe('Clôture de période · bornée à l’exercice', () => {
    const service = () => {
        const create = jest.fn().mockResolvedValue({});
        const prisma = {
            exercice: { findFirst: jest.fn().mockResolvedValue(N) },
            cloture: { create },
            tenant: { findUnique: jest.fn().mockResolvedValue({ refusClotureJournalNonImprime: false }) },
        };
        return { s: new exercice_service_1.ExerciceService(prisma, {}), create };
    };
    it('refuse une date hors de l’exercice, et ne crée rien', async () => {
        const { s, create } = service();
        await expect(s.clorePeriode('t', 'n', 'u', { dateLimite: '2062-03-31' })).rejects.toThrow(/hors de l'exercice/);
        expect(create).not.toHaveBeenCalled();
    });
    it('accepte une date de l’exercice', async () => {
        const { s, create } = service();
        await s.clorePeriode('t', 'n', 'u', { dateLimite: '2026-03-31' });
        expect(create.mock.calls[0][0].data.dateLimite).toEqual(new Date('2026-03-31'));
    });
});
describe('Clôture annuelle · dépréciation orpheline d’une créance douteuse (ligne A7, B1)', () => {
    it('refuse tant qu’une créance perdue garde sa dépréciation sans revue de l’exercice, et nomme créance, montants et issue', async () => {
        const orpheline = {
            id: 'cd-1',
            montant: 1_000,
            dateReclassement: new Date('2025-06-30'),
            declareeOuverture: false,
            depreciationOuverture: 0,
            compteCreance: { numero: '41110001', intitule: 'Client Kasa' },
            ajustements: [{ exerciceId: 'n-1', ecart: 800, exercice: { dateFin: new Date('2025-12-31') } }],
            mouvements: [{ date: new Date('2026-05-10'), montant: 1_000 }],
        };
        const { s, tx } = service(null, [orpheline]);
        await expect(s.cloturer('t', 'n', 'u')).rejects.toThrow(/41110001 Client Kasa \(dépréciation en place 800\.00, reste au 416 0\.00\).*Passez la revue/);
        expect(tx.ecriture.create).not.toHaveBeenCalled();
        expect(tx.creanceDouteuse.findMany).toHaveBeenCalled();
    });
});
//# sourceMappingURL=cloture-annuelle.spec.js.map