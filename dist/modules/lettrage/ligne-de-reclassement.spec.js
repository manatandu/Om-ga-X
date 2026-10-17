"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const lettrage_service_1 = require("./lettrage.service");
const ligne_de_reclassement_1 = require("./ligne-de-reclassement");
const ligne = (id, compteId, debit, credit, reclassement = null, comptesDeLaPiece = [], date = '2026-11-15', statut = 'OUVERT') => ({
    id,
    compteId,
    debit,
    credit,
    lettre: null,
    lettrageId: null,
    deviseId: null,
    montantDevise: null,
    libelle: null,
    ecriture: {
        tenantId: 't1',
        date: new Date(date),
        reference: null,
        journalId: 'jOD',
        journal: { code: 'OD' },
        exercice: { statut },
        creanceDouteuseReclassement: reclassement,
        lignes: comptesDeLaPiece.map((numero) => ({ compte: { numero } })),
    },
});
function monter(lignes) {
    const groupes = [];
    let seq = 0;
    const filtrer = (where) => lignes.filter((l) => {
        if (where?.id?.in && !where.id.in.includes(l.id))
            return false;
        if (where?.compteId && l.compteId !== where.compteId)
            return false;
        if (where?.lettrageId === null && l.lettrageId !== null)
            return false;
        if (typeof where?.lettrageId === 'string' && l.lettrageId !== where.lettrageId)
            return false;
        if (where?.lettre === null && l.lettre !== null)
            return false;
        if (where?.lettre?.not === null && l.lettre === null)
            return false;
        if (where?.ecriture?.tenantId && l.ecriture.tenantId !== where.ecriture.tenantId)
            return false;
        const prefixe = where?.ecriture?.lignes?.some?.compte?.numero?.startsWith;
        if (prefixe && !l.ecriture.lignes.some((x) => x.compte.numero.startsWith(prefixe)))
            return false;
        const lien = where?.ecriture?.creanceDouteuseReclassement?.is;
        if (lien) {
            const r = l.ecriture.creanceDouteuseReclassement;
            if (!r)
                return false;
            if (lien.annuleeLe === null && r.annuleeLe !== null)
                return false;
            if (lien.compteCreanceId && r.compteCreanceId !== lien.compteCreanceId)
                return false;
        }
        return true;
    });
    const prisma = {
        $transaction: (fn) => fn(prisma),
        exercice: { findMany: jest.fn().mockResolvedValue([{ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' }]) },
        cloture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: { findFirst: jest.fn().mockResolvedValue({ id: '411', tenantId: 't1', numero: '41110001', intitule: 'Client Kasa', lettrable: true }) },
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(filtrer(where))),
            count: jest.fn().mockImplementation(({ where }) => Promise.resolve(filtrer(where).length)),
            updateMany: jest.fn().mockImplementation(({ where, data }) => {
                const cibles = filtrer(where);
                for (const l of cibles)
                    Object.assign(l, data);
                return Promise.resolve({ count: cibles.length });
            }),
        },
        lettrage: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(groupes.find((g) => g.id === where.id) ?? null)),
            create: jest.fn().mockImplementation(({ data }) => {
                const g = { id: `g${++seq}`, ...data };
                groupes.push(g);
                return Promise.resolve(g);
            }),
            update: jest.fn().mockImplementation(({ where, data }) => Promise.resolve(Object.assign(groupes.find((g) => g.id === where.id), data))),
            delete: jest.fn().mockImplementation(({ where }) => Promise.resolve(groupes.splice(groupes.findIndex((g) => g.id === where.id), 1)[0])),
        },
    };
    return { service: new lettrage_service_1.LettrageService(prisma), prisma, groupes, lignes };
}
const facture = () => ligne('fac', '411', 1_160_000, 0, null, ['41110001', '70610000', '44310000']);
const factureSansTva = () => ligne('fac', '411', 1_160_000, 0, null, ['41110001', '70610000']);
const reclassement = (annuleeLe = null) => ligne('rcl', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe });
describe('A7 ter, B3 · la ligne du compte client d’un reclassement hors du lettrage, TOUJOURS (règle d’A7)', () => {
    it('le lettrage automatique n’apparie plus la facture et le reclassement de même montant', async () => {
        const { service, groupes } = monter([facture(), reclassement()]);
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(r.groupes).toBe(0);
        expect(groupes).toHaveLength(0);
    });
    it('le pré-lettrage ne le propose pas', async () => {
        const { service } = monter([facture(), reclassement()]);
        const p = await service.preLettrage('t1', '411');
        expect(p.propositions).toHaveLength(0);
    });
    it('la facture que le reclassement aurait prise reste OUVERTE · jamais donnée au règlement qui suit', async () => {
        const { service, groupes, lignes } = monter([facture(), reclassement(), ligne('reg', '411', 0, 1_160_000)]);
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(r.groupes).toBe(0);
        expect(groupes).toHaveLength(0);
        expect(lignes.every((l) => l.lettrageId === null)).toBe(true);
        const avant = monter([facture(), ligne('reg', '411', 0, 1_160_000), reclassement()]);
        const r2 = await avant.service.lettrageAutomatique('t1', '411', 'u1');
        expect(avant.groupes).toHaveLength(0);
        expect(r2).toMatchObject({ ecarteesReclassement: 3, passesParMontantSuspendues: true });
    });
    it('le lettrage MANUEL, le complément et la confirmation d’un pré-lettrage sont refusés par le motif nommé', async () => {
        const { service, groupes } = monter([facture(), reclassement(), ligne('acp', '411', 0, 100_000)]);
        await expect(service.lettrerManuel('t1', '411', ['fac', 'rcl'], 'u1')).rejects.toThrow(ligne_de_reclassement_1.MOTIF_LETTRAGE_RECLASSEMENT);
        await service.lettrerManuel('t1', '411', ['fac', 'acp'], 'u1', { autoriserPartiel: true });
        await expect(service.completer('t1', groupes[0].id, ['rcl'])).rejects.toThrow(/Ne lettrez pas la facture avec le reclassement/);
        const { service: s2 } = monter([facture(), reclassement()]);
        await expect(s2.confirmerPreLettrage('t1', '411', 'u1', [{ ligneIds: ['fac', 'rcl'], origine: client_1.OrigineLettrage.AUTOMATIQUE_MONTANT }])).rejects.toThrow(/se déclare par le cabinet/);
    });
    it('B-2 · sans TVA facturée aussi, la facture et son reclassement ne se lettrent pas, ni à la main ni en automatique', async () => {
        const auto = monter([factureSansTva(), reclassement()]);
        const r = await auto.service.lettrageAutomatique('t1', '411', 'u1');
        expect(r.groupes).toBe(0);
        expect(auto.groupes).toHaveLength(0);
        const manuel = monter([factureSansTva(), reclassement()]);
        await expect(manuel.service.lettrerManuel('t1', '411', ['fac', 'rcl'], 'u1')).rejects.toThrow(ligne_de_reclassement_1.MOTIF_LETTRAGE_RECLASSEMENT);
        expect(manuel.groupes).toHaveLength(0);
    });
    it('B-2 · avec n’importe quelle autre pièce · un groupe partiel qui porte le reclassement ne se complète pas', async () => {
        const { service, groupes } = monter([facture(), reclassement(), ligne('avr', '411', 1_160_000, 0)]);
        await expect(service.lettrerManuel('t1', '411', ['avr', 'rcl'], 'u1')).rejects.toThrow(ligne_de_reclassement_1.MOTIF_LETTRAGE_RECLASSEMENT);
        expect(groupes).toHaveLength(0);
    });
    const lignesB = () => [
        ligne('U', '411', 1_160_000, 0, null, ['41110001', '70110000'], '2026-02-10'),
        ligne('T', '411', 1_160_000, 0, null, ['41110001', '70610000', '44320000'], '2026-05-01'),
        ligne('P', '411', 0, 1_160_000, null, ['52110000', '41110001'], '2026-05-20'),
        ligne('R', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-06-15'),
    ];
    const lettrees = (lignes) => lignes.filter((l) => l.lettrageId !== null).map((l) => l.id).sort();
    it('(B) · U, T, P, R · aucune paire par montant, ni [U,P] ni [T,P], et le nombre de lignes laissées ouvertes est dit', async () => {
        const { service, groupes, lignes } = monter(lignesB());
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(r.groupes).toBe(0);
        expect(groupes).toHaveLength(0);
        expect(lettrees(lignes)).toEqual([]);
        expect(r).toMatchObject({ passesParMontantSuspendues: true, ecarteesReclassement: 4 });
        expect(r.miseDeCote).toMatch(/aucun rapprochement par montant n'est fait \(4 ligne\(s\)/);
    });
    it('(B) · le pré-lettrage, qui partage le calcul, ne propose rien non plus et le dit', async () => {
        const { service } = monter(lignesB());
        const p = await service.preLettrage('t1', '411');
        expect(p.propositions).toHaveLength(0);
        expect(p).toMatchObject({ passesParMontantSuspendues: true, ecarteesReclassement: 4 });
    });
    it('(B) · la passe par référence de pièce, saisie par un humain, joue encore', async () => {
        const lignes = lignesB();
        lignes[1].ecriture.reference = 'FV-0042';
        lignes[2].ecriture.reference = 'FV-0042';
        const { service, groupes } = monter(lignes);
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(r).toMatchObject({ parPiece: 1, parMontant: 0 });
        expect(groupes[0].origine).toBe(client_1.OrigineLettrage.AUTOMATIQUE_PIECE);
        expect(lettrees(lignes)).toEqual(['P', 'T']);
    });
    it('(B) · aucune exception · U seule antérieure à R, T (01/07) et son règlement P (20/07) restent aussi au lettrage manuel', async () => {
        const { service, groupes } = monter([
            ligne('U', '411', 1_160_000, 0, null, ['41110001', '70110000'], '2026-02-10'),
            ligne('R', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-06-15'),
            ligne('T', '411', 1_160_000, 0, null, ['41110001', '70610000'], '2026-07-01'),
            ligne('P', '411', 0, 1_160_000, null, ['52110000', '41110001'], '2026-07-20'),
        ]);
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(groupes).toHaveLength(0);
        expect(r).toMatchObject({ passesParMontantSuspendues: true, ecarteesReclassement: 4, parMontant: 0 });
        expect(r.miseDeCote).toMatch(/rien ne dit quelles factures il a reclassées/);
    });
    it('(B) · second tour, cas 1 · R reclasse X + Y, P paie V · ni [P,X,Y] ni rien par montant', async () => {
        const scene = () => [
            ligne('V', '411', 500_000, 0, null, [], '2026-02-01'),
            ligne('X', '411', 300_000, 0, null, [], '2026-03-01'),
            ligne('Y', '411', 200_000, 0, null, [], '2026-04-01'),
            ligne('R', '411', 0, 500_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-05-15'),
            ligne('P', '411', 0, 500_000, null, [], '2026-05-20'),
        ];
        const { service, groupes, lignes } = monter(scene());
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(groupes).toHaveLength(0);
        expect(lettrees(lignes)).toEqual([]);
        expect(r).toMatchObject({ parMontant: 0, passesParMontantSuspendues: true, ecarteesReclassement: 5 });
        expect((await monter(scene()).service.preLettrage('t1', '411')).propositions).toHaveLength(0);
    });
    it('(B) · second tour, cas 2 · R reclasse le reste de U payée en partie par P1, W payée par Q · ni [U,P1,Q] ni rien par montant', async () => {
        const scene = () => [
            ligne('U', '411', 1_000_000, 0, null, [], '2026-02-01'),
            ligne('P1', '411', 0, 600_000, null, [], '2026-03-01'),
            ligne('W', '411', 400_000, 0, null, [], '2026-04-01'),
            ligne('Q', '411', 0, 400_000, null, [], '2026-04-20'),
            ligne('R', '411', 0, 400_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-05-15'),
        ];
        const { service, groupes, lignes } = monter(scene());
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(groupes).toHaveLength(0);
        expect(lettrees(lignes)).toEqual([]);
        expect(r).toMatchObject({ parMontant: 0, passesParMontantSuspendues: true });
        expect((await monter(scene()).service.preLettrage('t1', '411')).propositions).toHaveLength(0);
    });
    it('(B) · U figée par une clôture et T antérieures à R, abstention', async () => {
        const { service, groupes } = monter([
            ligne('U', '411', 1_160_000, 0, null, [], '2025-02-10', 'CLOTURE'),
            ligne('T', '411', 1_160_000, 0, null, [], '2026-05-01'),
            ligne('P', '411', 0, 1_160_000, null, [], '2026-05-20'),
            ligne('R', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-06-15'),
        ]);
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(groupes).toHaveLength(0);
        expect(r.passesParMontantSuspendues).toBe(true);
    });
    it('(B) · N+1 · les à-nouveaux de U et de R, sans liaison, ne s’apparient pas · R de N reste ouverte et les suspend', async () => {
        const scene = () => [
            ligne('U', '411', 1_160_000, 0, null, [], '2026-02-10', 'CLOTURE'),
            ligne('R', '411', 0, 1_160_000, { compteCreanceId: '411', annuleeLe: null }, [], '2026-06-15', 'CLOTURE'),
            ligne('U-AN', '411', 1_160_000, 0, null, [], '2027-01-01'),
            ligne('R-AN', '411', 0, 1_160_000, null, [], '2027-01-01'),
        ];
        const { service, groupes } = monter(scene());
        const r = await service.lettrageAutomatique('t1', '411', 'u1');
        expect(groupes).toHaveLength(0);
        expect(r).toMatchObject({ passesParMontantSuspendues: true, ecarteesReclassement: 2 });
        expect((await monter(scene()).service.preLettrage('t1', '411')).propositions).toHaveLength(0);
    });
    it('un reclassement ANNULÉ ne retient plus rien · sa ligne se lettre comme une autre', async () => {
        const { service, groupes } = monter([facture(), reclassement(new Date('2026-12-01'))]);
        await service.lettrerManuel('t1', '411', ['fac', 'rcl'], 'u1');
        expect(groupes).toHaveLength(1);
    });
    it('seule la ligne du compte d’ORIGINE est retenue · la ligne 416 du même reclassement reste lettrable', async () => {
        const { prisma } = monter([ligne('d416', '416', 1_160_000, 0, { compteCreanceId: '411', annuleeLe: null }), reclassement()]);
        const tenues = await (0, ligne_de_reclassement_1.lignesDuCompteClientReclasse)(prisma, 't1', ['d416', 'rcl']);
        expect([...tenues]).toEqual(['rcl']);
        expect(prisma.ligneEcriture.findMany.mock.calls[0][0].where).toEqual({
            id: { in: ['d416', 'rcl'] },
            ecriture: { tenantId: 't1', creanceDouteuseReclassement: { is: { annuleeLe: null } } },
        });
    });
});
describe('A7 ter, B2 (b) · le lettrage qu’un module pose sur ses propres lignes', () => {
    const lignes416 = () => [ligne('r', '416', 1_160_000, 0), ligne('m1', '416', 0, 760_000), ligne('m2', '416', 0, 400_000)];
    it('pose un groupe SOLDÉ, d’origine MODULE (lui seul le défait), lettre servie sur chaque ligne', async () => {
        const { service, groupes, lignes } = monter(lignes416());
        const r = await service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
        expect(r).toEqual({ code: 'A' });
        expect(groupes[0]).toMatchObject({ statut: 'SOLDE', origine: client_1.OrigineLettrage.MODULE, compteId: '416' });
        expect(lignes.map((l) => l.lettre)).toEqual(['A', 'A', 'A']);
    });
    it('rend un MOTIF, jamais une exception, quand rien ne se pose · solde non nul, ligne déjà lettrée, compte non lettrable', async () => {
        const { service, groupes } = monter(lignes416());
        expect(await service.lettrerLignesDuModule('t1', '416', ['r', 'm1'], 'u1')).toEqual({ motif: expect.stringMatching(/ne soldent pas/) });
        const deja = monter(lignes416());
        deja.lignes[1].lettrageId = 'g-x';
        expect(await deja.service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1')).toEqual({ motif: expect.stringMatching(/déjà lettrée/) });
        const ferme = monter(lignes416());
        ferme.prisma.compte.findFirst.mockResolvedValue({ id: '416', tenantId: 't1', numero: '41610000', lettrable: false });
        expect(await ferme.service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1')).toEqual({ motif: expect.stringMatching(/pas déclaré lettrable/) });
        expect(groupes).toHaveLength(0);
    });
    it('défait le groupe dans la transaction de l’appelant · lignes libérées, groupe supprimé ; un groupe verrouillé refuse', async () => {
        const { service, groupes, lignes, prisma } = monter(lignes416());
        await service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
        await service.defaireLettrageDuModule(prisma, 't1', groupes[0].id);
        expect(groupes).toHaveLength(0);
        expect(lignes.every((l) => l.lettre === null && l.lettrageId === null)).toBe(true);
        const v = monter(lignes416());
        await v.service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
        v.groupes[0].verrouille = true;
        await expect(v.service.defaireLettrageDuModule(v.prisma, 't1', v.groupes[0].id)).rejects.toThrow(/verrouillé/);
        const manuel = monter(lignes416());
        await manuel.service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
        manuel.groupes[0].origine = client_1.OrigineLettrage.MANUEL;
        await expect(manuel.service.defaireLettrageDuModule(manuel.prisma, 't1', manuel.groupes[0].id)).rejects.toThrow(/n'a pas été posé par le module/);
        expect(manuel.groupes).toHaveLength(1);
    });
    it('m5 · le délettrage refuse un groupe d’origine MODULE, et nomme l’issue · les lignes restent lettrées', async () => {
        const { service, groupes, lignes, prisma } = monter(lignes416());
        prisma.lettrage.findFirst.mockImplementation(({ where }) => Promise.resolve(groupes.find((g) => g.id === where.id || g.code === where.code) ?? null));
        await service.lettrerLignesDuModule('t1', '416', ['r', 'm1', 'm2'], 'u1');
        await expect(service.delettrer('t1', '416', 'A')).rejects.toThrow((0, lettrage_service_1.MOTIF_DELETTRAGE_MODULE)('A'));
        expect(groupes).toHaveLength(1);
        expect(lignes.every((l) => l.lettre === 'A')).toBe(true);
        groupes[0].origine = client_1.OrigineLettrage.MANUEL;
        await expect(service.delettrer('t1', '416', 'A')).resolves.toEqual({ lettre: 'A', nombreLignes: 3 });
    });
});
describe('la perte qui récupère la TVA · ses lignes du compte d’origine ne se lettrent pas avec la facture', () => {
    const creance = { compteCreanceId: 'cli' };
    const servies = [
        { id: 'retour', compteId: 'cli', ecriture: { mouvementCreanceDouteuse: { ecriturePerteId: 'e-perte', creance }, mouvementCreanceDouteusePerte: null, corrigeEcriture: null } },
        { id: 'perte', compteId: 'cli', ecriture: { mouvementCreanceDouteuse: null, mouvementCreanceDouteusePerte: { creance }, corrigeEcriture: null } },
        { id: 'negatif', compteId: 'cli', ecriture: { mouvementCreanceDouteuse: null, mouvementCreanceDouteusePerte: null, corrigeEcriture: { mouvementCreanceDouteuse: null, mouvementCreanceDouteusePerte: { creance } } } },
        { id: 'l416', compteId: 'c416', ecriture: { mouvementCreanceDouteuse: { ecriturePerteId: 'e-perte', creance }, mouvementCreanceDouteusePerte: null, corrigeEcriture: null } },
        { id: 'ttc', compteId: 'cli', ecriture: { mouvementCreanceDouteuse: { ecriturePerteId: null, creance }, mouvementCreanceDouteusePerte: null, corrigeEcriture: null } },
    ];
    const db = {
        ligneEcriture: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where?.id?.in ? servies.filter((l) => where.id.in.includes(l.id)) : [])),
        },
    };
    it('reconnaît le retour, la perte et le négatif par leur liaison, la seule ligne du compte d’origine', async () => {
        const lues = await (0, ligne_de_reclassement_1.lignesDeLaPerteAvecTva)(db, 't1', ['retour', 'perte', 'negatif', 'l416', 'ttc', 'facture']);
        expect([...lues].sort()).toEqual(['negatif', 'perte', 'retour']);
    });
    it('le refus est nommé, au lettrage manuel comme au complément', async () => {
        await expect((0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(db, 't1', ['facture', 'perte'])).rejects.toThrow(ligne_de_reclassement_1.MOTIF_LETTRAGE_PERTE_AVEC_TVA);
        await expect((0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(db, 't1', ['facture'], ['retour'])).rejects.toThrow(ligne_de_reclassement_1.MOTIF_LETTRAGE_PERTE_AVEC_TVA);
        await expect((0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(db, 't1', ['facture', 'ttc'])).resolves.toBeUndefined();
    });
});
describe('le report du reclassement à l’exercice suivant ne se lettre pas non plus', () => {
    const servies = [
        { id: 'R', compteId: 'cli', debit: 0, credit: 1_160_000, dateEcheance: null, libelle: null, lettrageId: null, ecriture: { libelle: 'Reclassement 41110000', creanceDouteuseReclassement: { compteCreanceId: 'cli' } } },
        { id: 'R1', compteId: 'cli', debit: 0, credit: 1_160_000, dateEcheance: null, libelle: 'RAN détail 41110000 · Reclassement 41110000', lettrageId: null, ecriture: { libelle: 'À-nouveau', creanceDouteuseReclassement: null } },
        { id: 'R2', compteId: 'cli', debit: 0, credit: 1_160_000, dateEcheance: null, libelle: 'RAN détail 41110000 · RAN détail 41110000 · Reclassement 41110000', lettrageId: null, ecriture: { libelle: 'À-nouveau', creanceDouteuseReclassement: null } },
        { id: 'U1', compteId: 'cli', debit: 1_160_000, credit: 0, dateEcheance: null, libelle: 'RAN détail 41110000 · Facture 12', lettrageId: null, ecriture: { libelle: 'À-nouveau', creanceDouteuseReclassement: null } },
        { id: 'P1', compteId: 'cli', debit: 0, credit: 1_160_000, dateEcheance: null, libelle: 'RAN détail 41110000 · Règlement', lettrageId: null, ecriture: { libelle: 'À-nouveau', creanceDouteuseReclassement: null } },
    ];
    const honore = (l, where) => {
        if (where.id?.in && !where.id.in.includes(l.id))
            return false;
        if (typeof where.compteId === 'string' && l.compteId !== where.compteId)
            return false;
        if (where.compteId?.in && !where.compteId.in.includes(l.compteId))
            return false;
        if (where.lettrageId === null && l.lettrageId !== null)
            return false;
        if (where.libelle?.startsWith && !(l.libelle ?? '').startsWith(where.libelle.startsWith))
            return false;
        const rel = where.ecriture?.creanceDouteuseReclassement?.is;
        if (rel && (!l.ecriture.creanceDouteuseReclassement || (rel.compteCreanceId && rel.compteCreanceId !== l.ecriture.creanceDouteuseReclassement.compteCreanceId)))
            return false;
        if (where.ecriture?.OR)
            return false;
        return true;
    };
    const db = { ligneEcriture: { findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(servies.filter((l) => honore(l, where ?? {})))) } };
    it('le lettrage manuel du report de la facture avec celui du reclassement est refusé, à toute profondeur', async () => {
        await expect((0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(db, 't1', ['U1', 'R1'])).rejects.toThrow(ligne_de_reclassement_1.MOTIF_LETTRAGE_RECLASSEMENT);
        await expect((0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(db, 't1', ['U1', 'R2'])).rejects.toThrow(ligne_de_reclassement_1.MOTIF_LETTRAGE_RECLASSEMENT);
        await expect((0, ligne_de_reclassement_1.refuserLignesDuCompteClientReclasse)(db, 't1', ['U1', 'P1'])).resolves.toBeUndefined();
    });
    it('les passes par montant le mettent de côté · il est compté parmi les lignes reclassées du compte', async () => {
        const reclassees = await (0, ligne_de_reclassement_1.lignesReclasseesDuCompte)(db, 't1', 'cli');
        expect([...reclassees].sort()).toEqual(['R', 'R1', 'R2']);
    });
});
//# sourceMappingURL=ligne-de-reclassement.spec.js.map