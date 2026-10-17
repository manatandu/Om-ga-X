"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const devises_service_1 = require("./devises.service");
const ecarts_disponibilites_1 = require("./ecarts-disponibilites");
const ligne = (l) => ({ compteId: l.compteId, debit: l.debit, credit: l.credit, libelle: null, compte: { numero: l.numero } });
const CAISSE_ET_CREANCE = [
    { compteId: 'c-4781', numero: '47810000', debit: 300_000, credit: 0 },
    { compteId: 'c-4111', numero: '41110000', debit: 0, credit: 300_000 },
    { compteId: 'c-676', numero: '67600000', debit: 300_000, credit: 0 },
    { compteId: 'c-5712', numero: '57120000', debit: 0, credit: 300_000 },
];
const N = { id: 'n', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' };
const N1 = { id: 'e', dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31'), statut: 'OUVERT' };
const N2 = { id: 'e2', dateDebut: new Date('2028-01-01'), dateFin: new Date('2028-12-31'), statut: 'OUVERT' };
function ecritureDesEcartsRetenue(w = {}) {
    const borne = (valeur, filtre) => {
        if (filtre === undefined)
            return true;
        if (filtre && typeof filtre === 'object' && !(filtre instanceof Date)) {
            const f = filtre;
            if ('in' in f)
                return f.in.includes(valeur);
            const t = valeur.getTime();
            if (f.lt && !(t < f.lt.getTime()))
                return false;
            if (f.gte && !(t >= f.gte.getTime()))
                return false;
            if (f.lte && !(t <= f.lte.getTime()))
                return false;
            if (f.gt && !(t > f.gt.getTime()))
                return false;
            return true;
        }
        return valeur === filtre;
    };
    if (!borne('n', w.exerciceId) || !borne(new Date('2026-12-31'), w.date))
        return false;
    if (w.estGenereeParCloture === true)
        return false;
    if (Array.isArray(w.OR) && !w.OR.some((o) => ecritureDesEcartsRetenue(o)))
        return false;
    return true;
}
function monter(dateDebutSuivant, lignes = [
    { compteId: 'c1', numero: '41110000', debit: 100, credit: 0 },
    { compteId: 'c2', numero: '47910000', debit: 0, credit: 100 },
], options = {}) {
    const exercices = options.exercices ?? [N, { ...N1, dateDebut: new Date(dateDebutSuivant) }];
    const creer = jest.fn().mockResolvedValue({ id: 'ex' });
    const retirerCompensation = jest.fn();
    const update = jest.fn(async (_a) => {
        if (options.updateEchoue)
            throw options.updateEchoue;
        return { id: 'r1' };
    });
    const prisma = {
        reevaluation: {
            findFirst: jest.fn(async (a) => {
                if (a.where.id === 'r1') {
                    return {
                        id: 'r1',
                        exerciceId: 'n',
                        exercice: { dateFin: N.dateFin },
                        dateReevaluation: new Date('2026-12-31'),
                        ecritureExtourneId: null,
                        contrePassationDeclareeId: options.declaree ? 'od' : null,
                        coursUtilises: null,
                        ecartsDisponibilites: options.ecartsDisponibilites ?? null,
                        ecritureEcarts: { lignes: lignes.map(ligne) },
                    };
                }
                const filtreJson = a.where.ecartsDisponibilites;
                return ((options.autres ?? []).find((r) => r.exerciceId === a.where.exerciceId &&
                    (filtreJson?.equals !== client_1.Prisma.DbNull || r.ecartsDisponibilites === null || r.ecartsDisponibilites === undefined)) ?? null);
            }),
            update,
            findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'r1' }),
            findMany: jest.fn().mockResolvedValue([{ id: 'r1', ecritureExtourne: null, contrePassationDeclaree: null, ecritureEcarts: { lignes: lignes.map(ligne) } }]),
        },
        exercice: {
            findFirst: jest.fn(async (a) => {
                if (typeof a.where.id === 'string')
                    return exercices.find((x) => x.id === a.where.id) ?? null;
                const apres = a.where.dateDebut.gt.getTime();
                return ([...exercices]
                    .sort((x, y) => x.dateDebut.getTime() - y.dateDebut.getTime())
                    .find((x) => x.dateDebut.getTime() > apres && (a.where.statut === undefined || x.statut === a.where.statut)) ?? null);
            }),
            findMany: jest.fn(async (a) => [...exercices]
                .filter((x) => (!a.where.dateDebut?.gt || x.dateDebut.getTime() > a.where.dateDebut.gt.getTime()) &&
                (!a.where.dateDebut?.lte || x.dateDebut.getTime() <= a.where.dateDebut.lte.getTime()))
                .sort((x, y) => (a.orderBy?.dateDebut === 'desc' ? -1 : 1) * (x.dateDebut.getTime() - y.dateDebut.getTime()))),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: {
            groupBy: jest.fn(async (a) => lignes
                .filter((x) => a.where.compteId.in.includes(x.compteId) && ecritureDesEcartsRetenue(a.where.ecriture))
                .map((x) => ({ compteId: x.compteId, _sum: { debit: x.debit, credit: x.credit } }))),
        },
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        journal: { findFirst: jest.fn().mockResolvedValue({ id: 'od' }) },
        verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
    };
    return {
        svc: new devises_service_1.DevisesService(prisma, { creer, retirerCompensation }),
        creer,
        update,
        retirerCompensation,
        prisma,
    };
}
const equilibree = (lignes) => Math.abs(lignes.reduce((t, l) => t + (l.debit ?? 0) - (l.credit ?? 0), 0)) < 0.005;
describe('contre-passation de la réévaluation', () => {
    it('sur l’exercice qui suit · passée à son ouverture, sens inverse', async () => {
        const { svc, creer } = monter('2027-01-01');
        await svc.extourner('t', 'u', 'r1', 'e');
        expect(creer.mock.calls[0][2]).toMatchObject({ date: '2027-01-01', lignes: [{ compteId: 'c1', credit: 100 }, { compteId: 'c2', debit: 100 }] });
    });
    it('sur un exercice antérieur ou celui de la réévaluation · refusée avant toute écriture', async () => {
        for (const debut of ['2025-01-01', '2026-01-01']) {
            const { svc, creer } = monter(debut);
            await expect(svc.extourner('t', 'u', 'r1', 'e')).rejects.toThrow(/exercice suivant/);
            expect(creer).not.toHaveBeenCalled();
        }
    });
    it('M1 · sur un exercice plus lointain que celui qui suit immédiatement, ouvert · refusée, la cible nommée, rien passé', async () => {
        const { svc, creer } = monter('2027-01-01', undefined, { exercices: [N, N1, N2] });
        await expect(svc.extourner('t', 'u', 'r1', 'e2')).rejects.toThrow(/premier exercice ouvert qui suit la réévaluation, celui du 2027-01-01 au 2027-12-31/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('B-II · l’exercice qui suit est clôturé · la contre-passation va au premier exercice ouvert après lui', async () => {
        const { svc, creer } = monter('2027-01-01', undefined, { exercices: [N, { ...N1, statut: 'CLOTURE' }, N2] });
        await expect(svc.extourner('t', 'u', 'r1', 'e')).rejects.toThrow(/celui du 2028-01-01 au 2028-12-31/);
        await svc.extourner('t', 'u', 'r1', 'e2');
        expect(creer.mock.calls[0][2]).toMatchObject({ exerciceId: 'e2', date: '2028-01-01' });
    });
    it('B-II · aucun exercice ouvert après la réévaluation · refus nommé, l’issue dite', async () => {
        const { svc, creer } = monter('2027-01-01', undefined, { exercices: [N, { ...N1, statut: 'CLOTURE' }] });
        await expect(svc.extourner('t', 'u', 'r1', 'e')).rejects.toThrow(/Aucun exercice ouvert après celui de la réévaluation/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('B3 · la première période close reporte la pièce au premier jour ouvert (AUDCIF art. 22, 4°) · demandé à chaque contre-passation', async () => {
        const { svc, creer } = monter('2027-01-01');
        await svc.extourner('t', 'u', 'r1', 'e');
        expect(creer.mock.calls[0][2]).toMatchObject({ reporterAuPremierJourOuvert: true });
    });
    it('M6 · lien par un `update` unitaire sur une réévaluation encore libre ; perdu de vitesse, la pièce est retirée et 409', async () => {
        const { svc, update } = monter('2027-01-01');
        await svc.extourner('t', 'u', 'r1', 'e');
        expect(update).toHaveBeenCalledWith({
            where: { id: 'r1', tenantId: 't', AND: [{ ecritureExtourneId: null }, { contrePassationDeclareeId: null }] },
            data: { ecritureExtourneId: 'ex', contrePassationIntegrale: null },
        });
        const course = new client_1.Prisma.PrismaClientKnownRequestError('perdu', { code: 'P2025', clientVersion: 'x' });
        const perdu = monter('2027-01-01', undefined, { updateEchoue: course });
        await expect(perdu.svc.extourner('t', 'u', 'r1', 'e')).rejects.toThrow(/déjà été extournée/);
        expect(perdu.retirerCompensation).toHaveBeenCalledWith('t', 'ex');
    });
});
describe('troisième tour · une réévaluation contre-passée À LA MAIN et déclarée', () => {
    it('ne se contre-passe pas une seconde fois par le module · refus nommé, rien écrit', async () => {
        const { svc, creer } = monter('2027-01-01', undefined, { declaree: true });
        await expect(svc.extourner('t', 'u', 'r1', 'e')).rejects.toThrow(/déjà contre-passée par une écriture manuelle déclarée/);
        expect(creer).not.toHaveBeenCalled();
    });
});
describe('A5 bis · la contre-passation ne touche pas les disponibilités (AUDCIF art. 57)', () => {
    it('caisse et créance en USD · seuls le 4781 et le 4111 sont inversés, la caisse et son 676 restent, écriture équilibrée', async () => {
        const { svc, creer } = monter('2027-01-01', CAISSE_ET_CREANCE);
        const r = await svc.extourner('t', 'u', 'r1', 'e');
        const lignes = creer.mock.calls[0][2].lignes;
        expect(lignes).toEqual([
            expect.objectContaining({ compteId: 'c-4781', credit: 300_000 }),
            expect.objectContaining({ compteId: 'c-4111', debit: 300_000 }),
        ]);
        expect(lignes.map((l) => l.compteId)).not.toContain('c-5712');
        expect(lignes.map((l) => l.compteId)).not.toContain('c-676');
        expect(equilibree(lignes)).toBe(true);
        expect(r.avertissement).toMatch(/^L'ouverture de cet exercice n'est pas encore l'à-nouveau de clôture/);
    });
    it('les cinq racines de disponibilités et le 776 restent hors de la contre-passation', () => {
        const lignes = [
            { compteNumero: '52150000', debit: 10, credit: 0 },
            { compteNumero: '53100000', debit: 10, credit: 0 },
            { compteNumero: '55100000', debit: 10, credit: 0 },
            { compteNumero: '57120000', debit: 10, credit: 0 },
            { compteNumero: '58500000', debit: 10, credit: 0 },
            { compteNumero: '77600000', debit: 0, credit: 50 },
            { compteNumero: '40110000', debit: 7, credit: 0 },
            { compteNumero: '47930000', debit: 0, credit: 7 },
            { compteNumero: '56100000', debit: 3, credit: 0 },
            { compteNumero: '47940000', debit: 0, credit: 3 },
        ];
        const partage = (0, ecarts_disponibilites_1.partagerLignesDEcarts)(lignes);
        expect(partage.motifRefus).toBeNull();
        expect(partage.aContrePasser.map((l) => l.compteNumero)).toEqual(['40110000', '47930000', '56100000', '47940000']);
        expect(partage.realisees).toHaveLength(6);
    });
    const retouchee = () => {
        const l = CAISSE_ET_CREANCE.map((x) => (x.compteId === 'c-676' ? { ...x, debit: 250_000 } : x));
        l.push({ compteId: 'c-4111b', numero: '41110000', debit: 50_000, credit: 0 });
        return l;
    };
    it('M2 · une écriture des écarts qui ne se partage pas · refusée, l’issue (contre-passation intégrale) nommée, rien passé', async () => {
        const { svc, creer } = monter('2027-01-01', retouchee());
        await expect(svc.extourner('t', 'u', 'r1', 'e')).rejects.toThrow(/deux parts équilibrées[\s\S]*contre-passation INTÉGRALE/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('M2 · demandée, la contre-passation INTÉGRALE passe toute l’écriture, le dit au libellé et dans la réponse', async () => {
        const { svc, creer, update } = monter('2027-01-01', retouchee());
        const r = await svc.extourner('t', 'u', 'r1', 'e', { integrale: true });
        const piece = creer.mock.calls[0][2];
        expect(piece.libelle).toMatch(/Contre-passation intégrale .*banque et caisse comprises.*ne se partage pas/);
        expect(piece.lignes).toHaveLength(5);
        expect(equilibree(piece.lignes)).toBe(true);
        expect(update.mock.calls[0][0].data).toEqual({ ecritureExtourneId: 'ex', contrePassationIntegrale: 'PARTAGE_IMPOSSIBLE' });
        expect(r.avertissement).toMatch(/INTÉGRALE demandée/);
    });
    it('M2 · demandée sur une écriture qui se partage · refusée, la banque garde son écart (art. 57)', async () => {
        const { svc, creer } = monter('2027-01-01', CAISSE_ET_CREANCE);
        await expect(svc.extourner('t', 'u', 'r1', 'e', { integrale: true })).rejects.toThrow(/n'est ouverte qu'à une écriture des écarts qui ne se partage pas/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('une réévaluation qui ne porte que des disponibilités · rien à contre-passer, refus nommé', async () => {
        const { svc, creer } = monter('2027-01-01', CAISSE_ET_CREANCE.slice(2));
        await expect(svc.extourner('t', 'u', 'r1', 'e')).rejects.toThrow(/art\. 57/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('réévaluation antérieure à A5 bis · rien n’est écrit sur elle, `ecartsDisponibilites` nul dit l’ancien régime (B2)', async () => {
        const { svc, update } = monter('2027-01-01', CAISSE_ET_CREANCE);
        await svc.extourner('t', 'u', 'r1', 'e');
        expect(update.mock.calls[0][0].data).toEqual({ ecritureExtourneId: 'ex', contrePassationIntegrale: null });
    });
});
describe('B2 · contre-passation dans un exercice réévalué sous l’ancien régime · intégrale, chiffrée', () => {
    const ECARTS_N = [
        { compteId: 'c-5215', numero: '52150000', debit: 100_000, credit: 0 },
        { compteId: 'c-776', numero: '77600000', debit: 0, credit: 100_000 },
        { compteId: 'c-4111', numero: '41110000', debit: 50_000, credit: 0 },
        { compteId: 'c-4791', numero: '47910000', debit: 0, credit: 50_000 },
    ];
    const N1_AVANT = [
        { compteId: 'c-5215', debit: 1_464_000, credit: 0 },
        { compteId: 'c-5215', debit: 141_000, credit: 0 },
        { compteId: 'c-776', debit: 0, credit: 141_000 },
    ];
    const soldes = (lignes) => {
        const s = new Map();
        for (const l of lignes)
            s.set(l.compteId, (s.get(l.compteId) ?? 0) + (l.debit ?? 0) - (l.credit ?? 0));
        return s;
    };
    it('ancien régime en N+1 · la banque est contre-passée aussi · banque 1 505 000 et gain de 41 000', async () => {
        const { svc, creer, update } = monter('2027-01-01', ECARTS_N, { autres: [{ exerciceId: 'e', ecartsDisponibilites: null }] });
        const r = await svc.extourner('t', 'u', 'r1', 'e');
        const piece = creer.mock.calls[0][2];
        expect(piece.libelle).toMatch(/intégrale .*banque et caisse comprises.*ancien régime/);
        const s = soldes([...N1_AVANT, ...piece.lignes]);
        expect(s.get('c-5215')).toBe(1_505_000);
        expect(-(s.get('c-776') ?? 0)).toBe(41_000);
        expect(update.mock.calls[0][0].data).toEqual({ ecritureExtourneId: 'ex', contrePassationIntegrale: 'EXERCICE_SUIVANT_ANCIEN_REGIME' });
        expect(r.avertissement).toMatch(/réévalué avant A5 bis/);
    });
    it('sans l’exception, la même contre-passation aurait laissé la banque à 1 605 000 et le gain à 141 000 (le défaut que B2 ferme)', async () => {
        const { svc, creer } = monter('2027-01-01', ECARTS_N, { autres: [{ exerciceId: 'e', ecartsDisponibilites: [] }] });
        await svc.extourner('t', 'u', 'r1', 'e');
        const s = soldes([...N1_AVANT, ...creer.mock.calls[0][2].lignes]);
        expect(s.get('c-5215')).toBe(1_605_000);
        expect(-(s.get('c-776') ?? 0)).toBe(141_000);
    });
    it('une réévaluation des seules disponibilités, l’exercice suivant à l’ancien régime · contre-passée intégralement', async () => {
        const { svc, creer } = monter('2027-01-01', ECARTS_N.slice(0, 2), { autres: [{ exerciceId: 'e', ecartsDisponibilites: null }] });
        await svc.extourner('t', 'u', 'r1', 'e');
        expect(creer.mock.calls[0][2].lignes).toEqual([
            expect.objectContaining({ compteId: 'c-5215', credit: 100_000 }),
            expect.objectContaining({ compteId: 'c-776', debit: 100_000 }),
        ]);
    });
});
describe('M1 · annuler une contre-passation', () => {
    function monterAnnulation(o) {
        const ecritureExtourne = {
            id: 'cp',
            statut: o.statut,
            numeroPiece: 7,
            exerciceId: 'e2',
            exercice: { statut: o.exerciceClos ? 'CLOTURE' : 'OUVERT' },
            lignes: [{ lettre: o.lettree ? 'AA' : null, lettrageId: o.lettree ? 'l1' : null, rapprochementId: null }],
        };
        const tx = {
            ligneEcriture: {
                findMany: jest.fn().mockResolvedValue(ecritureExtourne.lignes),
                deleteMany: jest.fn().mockResolvedValue({ count: 2 }),
            },
            ecriture: {
                findFirst: jest.fn().mockResolvedValue({ statut: o.statut }),
                deleteMany: jest.fn().mockResolvedValue({ count: o.countSuppression ?? 1 }),
            },
            reevaluation: {
                update: jest.fn(async (_a) => ({})),
                findFirstOrThrow: jest.fn().mockResolvedValue({ id: 'r1' }),
            },
        };
        const prisma = {
            reevaluation: {
                findFirst: jest.fn(async (a) => a.where.id === 'r1'
                    ? { id: 'r1', dateReevaluation: N.dateFin, annuleeLe: null, annulationsContrePassation: null, ecritureExtourne }
                    : o.lectrice
                        ? { dateReevaluation: N2.dateFin }
                        : null),
            },
            verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
            $transaction: jest.fn(async (fn) => fn(tx)),
        };
        const inscrireEnNegatifPourAnnulation = jest.fn().mockResolvedValue({ id: 'neg', numeroPiece: 9 });
        const svc = new devises_service_1.DevisesService(prisma, { inscrireEnNegatifPourAnnulation });
        return { svc, tx, prisma, inscrireEnNegatifPourAnnulation };
    }
    it('au brouillard · supprimée (lignes filtrées sur le statut), la réévaluation déliée et la trace gardée', async () => {
        const { svc, tx, inscrireEnNegatifPourAnnulation } = monterAnnulation({ statut: 'BROUILLARD' });
        await svc.annulerContrePassation('t', 'u', 'r1', 'Passée en 2028 au lieu de 2027');
        expect(inscrireEnNegatifPourAnnulation).not.toHaveBeenCalled();
        expect(tx.reevaluation.update).toHaveBeenCalledWith({
            where: { id: 'r1', tenantId: 't', ecritureExtourneId: 'cp' },
            data: expect.objectContaining({
                ecritureExtourneId: null,
                contrePassationIntegrale: null,
                annulationsContrePassation: [expect.objectContaining({ ecritureId: 'cp', traitement: 'SUPPRIMEE', motif: 'Passée en 2028 au lieu de 2027' })],
            }),
        });
        expect(tx.ligneEcriture.deleteMany).toHaveBeenCalledWith({ where: { ecritureId: 'cp', ecriture: { tenantId: 't', statut: 'BROUILLARD' } } });
        expect(tx.ecriture.deleteMany).toHaveBeenCalledWith({ where: { id: 'cp', tenantId: 't', statut: 'BROUILLARD' } });
    });
    it('validée entre-temps · rien n’est supprimé, la transaction tombe en 409', async () => {
        const { svc } = monterAnnulation({ statut: 'BROUILLARD', countSuppression: 0 });
        await expect(svc.annulerContrePassation('t', 'u', 'r1', 'Motif valable')).rejects.toThrow(/validée entre-temps/);
    });
    it('validée · inscrite en négatif dans la transaction, jamais supprimée', async () => {
        const { svc, tx, inscrireEnNegatifPourAnnulation } = monterAnnulation({ statut: 'VALIDEE' });
        await svc.annulerContrePassation('t', 'u', 'r1', 'Motif valable');
        expect(inscrireEnNegatifPourAnnulation).toHaveBeenCalledWith('t', 'u', 'cp', 'Motif valable', tx);
        expect(tx.ecriture.deleteMany).not.toHaveBeenCalled();
        expect(tx.reevaluation.update.mock.calls[0][0].data.annulationsContrePassation).toEqual([
            expect.objectContaining({ traitement: 'INSCRITE_EN_NEGATIF', negatifId: 'neg' }),
        ]);
    });
    it('refus nommés avant toute transaction · exercice clôturé, réévaluation qui l’a lue, ligne lettrée, motif vide', async () => {
        for (const [o, motif] of [
            [{ statut: 'VALIDEE', exerciceClos: true }, /exercice clôturé/],
            [{ statut: 'VALIDEE', lectrice: true }, /annulez-la d'abord/],
            [{ statut: 'VALIDEE', lettree: true }, /lettr/],
        ]) {
            const { svc, prisma } = monterAnnulation(o);
            await expect(svc.annulerContrePassation('t', 'u', 'r1', 'Motif valable')).rejects.toThrow(motif);
            expect(prisma.$transaction).not.toHaveBeenCalled();
        }
        const { svc } = monterAnnulation({ statut: 'BROUILLARD' });
        await expect(svc.annulerContrePassation('t', 'u', 'r1', '  ')).rejects.toThrow(/motif/);
    });
});
describe('liste des réévaluations · ce qu’il reste à contre-passer', () => {
    function lister(lignes, o = {}) {
        const r = {
            id: 'r1',
            exerciceId: 'n',
            dateReevaluation: N.dateFin,
            createdAt: new Date('2027-01-05'),
            annuleeLe: null,
            ecritureExtourneId: o.contrePassee ? 'cp' : null,
            coursUtilises: null,
            ecartsDisponibilites: [],
            ventilationDisponibilites: null,
            ecritureEcarts: { statut: 'VALIDEE', valideeAt: null, lignes: lignes.map(ligne) },
        };
        const prisma = {
            exercice: {
                findFirst: jest.fn(async (a) => (typeof a.where.id === 'string' ? N : N1)),
            },
            reevaluation: {
                findMany: jest.fn().mockResolvedValue([r]),
                findFirst: jest.fn().mockResolvedValue(o.suivantAncienRegime ? { id: 'r-e' } : null),
            },
        };
        return new devises_service_1.DevisesService(prisma, {}).listerReevaluations('t', 'n');
    }
    it('créance et caisse · les écarts de conversion seuls, à l’ouverture de l’exercice qui suit immédiatement', async () => {
        const [r] = await lister(CAISSE_ET_CREANCE);
        expect(r).toMatchObject({ contrePassationAPasser: 'ECARTS_DE_CONVERSION', exerciceDeContrePassation: { id: 'e' } });
    });
    it('seules des disponibilités · rien à contre-passer (art. 57), sauf si l’exercice suivant est de l’ancien régime (B2)', async () => {
        expect((await lister(CAISSE_ET_CREANCE.slice(2)))[0].contrePassationAPasser).toBeNull();
        expect((await lister(CAISSE_ET_CREANCE.slice(2), { suivantAncienRegime: true }))[0].contrePassationAPasser).toBe('INTEGRALE_ANCIEN_REGIME');
    });
    it('écriture qui ne se partage pas · intégrale sur demande (M2) ; déjà contre-passée · rien', async () => {
        const retouchee = [...CAISSE_ET_CREANCE.map((x) => (x.compteId === 'c-676' ? { ...x, debit: 250_000 } : x))];
        retouchee.push({ compteId: 'c-4111b', numero: '41110000', debit: 50_000, credit: 0 });
        expect((await lister(retouchee))[0].contrePassationAPasser).toBe('INTEGRALE_SUR_DEMANDE');
        expect((await lister(CAISSE_ET_CREANCE, { contrePassee: true }))[0].contrePassationAPasser).toBeNull();
    });
});
//# sourceMappingURL=contre-passation-reevaluation.spec.js.map