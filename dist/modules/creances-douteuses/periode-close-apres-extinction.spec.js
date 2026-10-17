"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const ecriture_service_1 = require("../comptabilite/ecriture.service");
const creances_douteuses_service_1 = require("./creances-douteuses.service");
const D = (x) => new client_1.Prisma.Decimal(x);
const CLOTURE = new Date('2026-11-30');
const EXERCICE = { id: 'ex-26', statut: client_1.StatutExercice.OUVERT, dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
function monterScenario() {
    const ecritures = [];
    const lignes = [];
    let rangLigne = 0;
    const ecrire = (e, ls, groupe) => {
        ecritures.push({ ...e, statut: client_1.StatutEcriture.VALIDEE, dateValeur: null, corrigeEcritureId: null });
        for (const [compteId, debit, credit] of ls) {
            lignes.push({
                id: `l-${++rangLigne}`,
                ecritureId: e.id,
                compteId,
                debit: D(debit),
                credit: D(credit),
                lettre: compteId === 'c4161' && groupe ? 'A' : null,
                lettrageId: compteId === 'c4161' ? groupe : null,
                rapprochementId: null,
            });
        }
    };
    ecrire({ id: 'ecr-r', date: new Date('2026-11-15'), numeroPiece: 1, journalId: 'od', libelle: 'Reclassement' }, [['c4161', 1_160_000, 0], ['c411', 0, 1_160_000]], 'g-A');
    ecrire({ id: 'ecr-mr', date: new Date('2026-11-30'), numeroPiece: 2, journalId: 'bq', libelle: 'Recouvrement' }, [['c521', 760_000, 0], ['c4161', 0, 760_000]], 'g-A');
    ecrire({ id: 'ecr-p', date: new Date('2026-12-20'), numeroPiece: 3, journalId: 'od', libelle: 'Perte' }, [['c6511', 400_000, 0], ['c4161', 0, 400_000]], 'g-A');
    const mouvements = [
        { id: 'mv-r', creanceId: 'cd-1', tenantId: 't', type: client_1.TypeMouvementCreanceDouteuse.RECOUVREMENT, date: new Date('2026-11-30'), montant: 760_000, ecritureId: 'ecr-mr', annuleeLe: null },
        { id: 'mv-p', creanceId: 'cd-1', tenantId: 't', type: client_1.TypeMouvementCreanceDouteuse.PERTE, date: new Date('2026-12-20'), montant: 400_000, ecritureId: 'ecr-p', annuleeLe: null },
    ];
    const creance = { id: 'cd-1', tenantId: 't', compte416Id: 'c4161', ecritureReclassementId: 'ecr-r' };
    const groupes = [{ id: 'g-A', code: 'A', origine: 'MODULE' }];
    const clotures = [{ granularite: 'PERIODE', journalId: null, dateLimite: CLOTURE }];
    const journal = (id) => ({ id, code: id === 'bq' ? 'BQ' : 'OD' });
    const vueEcriture = (e) => ({
        ...e,
        tenantId: 't',
        exerciceId: EXERCICE.id,
        reference: null,
        journal: journal(e.journalId),
        exercice: EXERCICE,
        correction: ecritures.find((x) => x.corrigeEcritureId === e.id) ? { id: ecritures.find((x) => x.corrigeEcritureId === e.id).id } : null,
        lignes: lignes
            .filter((l) => l.ecritureId === e.id)
            .map((l) => ({ ...l, libelle: null, tauxTvaId: null, dateEcheance: null, dateVersement: null, deviseId: null, montantDevise: null, coursApplique: null, ventilations: [] })),
    });
    const vueLigne = (l) => {
        const e = ecritures.find((x) => x.id === l.ecritureId);
        return { ...l, ecriture: { exerciceId: EXERCICE.id, date: e.date, journalId: e.journalId, journal: journal(e.journalId), exercice: { statut: EXERCICE.statut } } };
    };
    const prisma = {
        verrouCreancesDouteuses: {
            deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
            create: jest.fn().mockResolvedValue({ id: 'verrou' }),
        },
        creanceDouteuse: { findFirst: jest.fn().mockResolvedValue(creance) },
        ajustementCreanceDouteuse: { findFirst: jest.fn().mockResolvedValue(null) },
        recuperationTvaCreance: { count: jest.fn().mockResolvedValue(0) },
        declarationDeviseANouveau: { count: jest.fn().mockResolvedValue(0) },
        mouvementCreanceDouteuse: {
            findFirst: jest.fn().mockImplementation(({ where }) => {
                const m = mouvements.find((x) => x.id === where.id && x.creanceId === where.creanceId);
                if (!m)
                    return Promise.resolve(null);
                const e = ecritures.find((x) => x.id === m.ecritureId);
                return Promise.resolve({ ...m, exercice: { statut: EXERCICE.statut }, ecriture: e ? vueEcriture(e) : null });
            }),
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(mouvements.filter((m) => m.creanceId === where.creanceId && m.ecritureId))),
            update: jest.fn().mockImplementation(({ where, data }) => {
                const m = mouvements.find((x) => x.id === where.id);
                m.annuleeLe = data.annuleeLe;
                return Promise.resolve(m);
            }),
        },
        lettrage: { findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(groupes.find((g) => g.id === where.id) ?? null)) },
        cloture: { findMany: jest.fn().mockResolvedValue(clotures) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where, take }) => {
                let r = lignes;
                if (where.lettrageId)
                    r = r.filter((l) => l.lettrageId === where.lettrageId);
                if (where.id?.in)
                    r = r.filter((l) => where.id.in.includes(l.id));
                if (where.ecritureId?.in)
                    r = r.filter((l) => where.ecritureId.in.includes(l.ecritureId));
                else if (where.ecritureId)
                    r = r.filter((l) => l.ecritureId === where.ecritureId);
                if (where.compteId)
                    r = r.filter((l) => l.compteId === where.compteId);
                return Promise.resolve(r.slice(0, take ?? r.length).map(vueLigne));
            }),
        },
        ecriture: {
            findFirst: jest.fn().mockImplementation(({ where }) => {
                const e = ecritures.find((x) => x.id === where.id);
                return Promise.resolve(e ? vueEcriture(e) : null);
            }),
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(ecritures.filter((e) => e.corrigeEcritureId && where.corrigeEcritureId?.in?.includes(e.corrigeEcritureId)).map((e) => ({ id: e.id })))),
            create: jest.fn().mockImplementation(({ data }) => {
                const e = {
                    id: `neg-${ecritures.length}`,
                    statut: data.statut,
                    date: data.date,
                    dateValeur: data.dateValeur,
                    numeroPiece: data.numeroPiece,
                    journalId: data.journalId,
                    libelle: data.libelle,
                    corrigeEcritureId: data.corrigeEcritureId,
                };
                ecritures.push(e);
                for (const l of data.lignes.create) {
                    lignes.push({ id: `l-${++rangLigne}`, ecritureId: e.id, compteId: l.compteId, debit: l.debit, credit: l.credit, lettre: null, lettrageId: null, rapprochementId: null });
                }
                return Promise.resolve({ id: e.id, numeroPiece: e.numeroPiece, date: e.date });
            }),
        },
        $transaction: (f) => f(prisma),
    };
    const exerciceService = {
        premierJourOuvert: jest.fn().mockImplementation((_t, _j, date) => Promise.resolve(date <= CLOTURE ? new Date(CLOTURE.getTime() + 24 * 3600 * 1000) : date)),
    };
    let piece = 100;
    const journalService = { prochainNumeroPiece: jest.fn().mockImplementation(() => Promise.resolve(++piece)) };
    const ecritureService = new ecriture_service_1.EcritureService(prisma, journalService, exerciceService, {});
    const lettrage = {
        defaireLettrageDuModule: jest.fn().mockRejectedValue(new Error('la ligne du 2026-11-15 est figée')),
        lettrerLignesDuModule: jest.fn(),
    };
    const service = new creances_douteuses_service_1.CreancesDouteusesService(prisma, ecritureService, lettrage, {});
    const solde = (compteId) => lignes.filter((l) => l.compteId === compteId).reduce((t, l) => t + l.debit.toNumber() - l.credit.toNumber(), 0);
    const ouvertes416 = () => lignes.filter((l) => l.compteId === 'c4161' && l.lettrageId === null);
    return { service, ecritures, lignes, solde, ouvertes416, lettrage };
}
describe('A7 ter, B2b · période close après l’extinction de la créance', () => {
    it('l’annulation de la perte du 20/12 passe · négatif à sa date, 651 à zéro, 416 à 400 000 sur la seule ligne ouverte', async () => {
        const s = monterScenario();
        const r = await s.service.annulerMouvement('t', 'u', 'cd-1', 'mv-p', { motif: 'Le client a repris ses paiements' });
        expect(r.annulation).toMatchObject({ traitement: 'INSCRITE_EN_NEGATIF', lettrageMaintenu: 'g-A' });
        const negatif = s.ecritures.find((e) => e.corrigeEcritureId === 'ecr-p');
        expect(negatif).toMatchObject({ statut: client_1.StatutEcriture.VALIDEE, date: new Date('2026-12-20'), dateValeur: null });
        expect(s.solde('c6511')).toBe(0);
        expect(s.solde('c4161')).toBe(400_000);
        expect(s.lignes.filter((l) => l.lettrageId === 'g-A')).toHaveLength(3);
        expect(s.ouvertes416().map((l) => l.debit.toNumber() - l.credit.toNumber())).toEqual([400_000]);
        expect(s.lettrage.defaireLettrageDuModule).not.toHaveBeenCalled();
    });
    it('l’annulation du recouvrement du 30/11 passe · négatif au premier jour non clôturé, date de valeur le 30/11 (art. 22, 4°)', async () => {
        const s = monterScenario();
        await s.service.annulerMouvement('t', 'u', 'cd-1', 'mv-p', { motif: 'Le client a repris ses paiements' });
        await s.service.annulerMouvement('t', 'u', 'cd-1', 'mv-r', { motif: 'Virement rejeté par la banque' });
        const negatif = s.ecritures.find((e) => e.corrigeEcritureId === 'ecr-mr');
        expect(negatif).toMatchObject({ date: new Date('2026-12-01'), dateValeur: new Date('2026-11-30') });
        expect(s.solde('c521')).toBe(0);
        expect(s.solde('c6511')).toBe(0);
        expect(s.solde('c4161')).toBe(1_160_000);
        expect(s.ouvertes416().reduce((t, l) => t + l.debit.toNumber() - l.credit.toNumber(), 0)).toBe(1_160_000);
    });
});
//# sourceMappingURL=periode-close-apres-extinction.spec.js.map