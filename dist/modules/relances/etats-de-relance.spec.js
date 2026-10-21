"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const relances_service_1 = require("./relances.service");
const lecture_par_lots_1 = require("../../common/lecture-par-lots");
const DOSSIER = 'd-1';
const AGENT = 'u-1';
const REF = '2026-10-01';
const PREVENTIF = {
    id: 'n-1',
    tenantId: DOSSIER,
    niveau: 1,
    libelle: 'Avis préventif',
    type: client_1.TypeRelance.PREVENTIVE,
    joursApresEcheance: -7,
    modeleTexte: 'Échéance le {echeance} · lettre du {date}',
    estActif: true,
};
const RAPPEL = {
    id: 'n-2',
    tenantId: DOSSIER,
    niveau: 2,
    libelle: 'Premier rappel',
    type: client_1.TypeRelance.RAPPEL,
    joursApresEcheance: 15,
    modeleTexte: 'Cher {tiers}, {montant} dû au {date}.',
    estActif: true,
};
function ligne(compte, piece, echeance) {
    return {
        debit: 100_000,
        credit: 0,
        lettre: null,
        libelle: `Facture ${compte}`,
        dateEcheance: new Date(`${echeance}T00:00:00Z`),
        compte: {
            id: `c-${compte}`,
            numero: compte,
            intitule: `Client ${compte}`,
            tiersCompte: {
                tiers: {
                    id: `t-${compte}`,
                    nom: `Tiers ${compte}`,
                    type: 'CLIENT',
                    email: null,
                    horsRelance: false,
                    motifHorsRelance: null,
                    horsRelanceDepuis: null,
                },
            },
        },
        ecriture: { date: new Date(`${piece}T00:00:00Z`), libelle: 'Vente' },
    };
}
function service(lignes, niveaux, relances = []) {
    const relanceFindMany = jest.fn(async (args) => relances
        .filter((r) => !args.where.compteId || args.where.compteId.in.includes(r.compteId))
        .filter((r) => !args.where.dateRelance || r.dateRelance >= args.where.dateRelance.gte)
        .sort((a, b) => b.dateRelance.getTime() - a.dateRelance.getTime()));
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: client_1.Referentiel.SYSCOHADA }),
            findUnique: jest.fn().mockResolvedValue({ nom: 'SARL Kin' }),
        },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        niveauRelance: {
            findFirst: jest.fn(async (args) => niveaux.find((n) => n.id === args.where.id) ?? null),
            findMany: jest.fn(async (args) => niveaux
                .filter((n) => args.where.type === undefined || n.type === args.where.type)
                .filter((n) => args.where.estActif === undefined || n.estActif === args.where.estActif)
                .sort((a, b) => b.joursApresEcheance - a.joursApresEcheance)),
        },
        relance: { findMany: relanceFindMany, createMany: jest.fn(async ({ data }) => ({ count: data.length })) },
        tiers: { findMany: jest.fn().mockResolvedValue([]) },
        compte: {
            findMany: jest.fn(async (args) => args.where.id.in.map((id) => ({ id, numero: id.replace('c-', ''), intitule: `Client ${id.replace('c-', '')}` }))),
        },
        $executeRaw: jest.fn(async () => 0),
        $transaction: jest.fn(async (fn) => fn(prisma)),
    };
    const courrier = {
        ecrireEnFileSansTenter: jest.fn(async (_tx, _dossier, lot) => lot.map(() => ({ id: 'm-1', statut: client_1.StatutMessage.SANS_TRANSPORT, motif: null }))),
    };
    return { svc: new relances_service_1.RelancesService(prisma, courrier), relanceFindMany };
}
describe('F166 · l’avis préventif annonce l’ÉCHÉANCE, pas la date du courrier', () => {
    it('les deux jeux livrés écrivent « {echeance} » dans leur avis préventif', async () => {
        for (const r of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            const createMany = jest.fn().mockResolvedValue({ count: 3 });
            const prisma = { niveauRelance: { count: jest.fn().mockResolvedValue(0), createMany } };
            await new relances_service_1.RelancesService(prisma, {}).seedNiveauxDefaut('t1', r);
            const data = createMany.mock.calls[0][0].data;
            const preventif = data.find((n) => n.type === client_1.TypeRelance.PREVENTIVE);
            expect(preventif.modeleTexte).toMatch(/(à terme|à échéance) le \{echeance\}/);
        }
    });
    it('la lettre porte l’échéance de la ligne, et le courrier sa propre date', async () => {
        const { svc } = service([ligne('41100001', '2026-09-01', '2026-10-04')], [PREVENTIF]);
        const r = await svc.emettre(DOSSIER, AGENT, { exerciceId: 'ex-1', niveauId: PREVENTIF.id, compteIds: ['c-41100001'], dateReference: REF });
        expect(r.emises).toBe(1);
        expect(r.lettres[0].texte).toBe(`Échéance le 04/10/2026 · lettre du ${new Date(REF).toLocaleDateString('fr-FR')}`);
    });
});
describe('F167 · un état ne suggère que ses propres niveaux, et dit ce qu’il n’a pas à réclamer', () => {
    it('un rappel échu de cinq jours ne se voit pas suggérer l’avis préventif', async () => {
        const { svc } = service([ligne('41100001', '2026-08-01', '2026-09-26')], [PREVENTIF, RAPPEL]);
        const [p] = await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.RAPPEL, dateReference: REF });
        expect(p.retardMaxJours).toBe(5);
        expect(p.niveauSuggere).toBeNull();
    });
    it('un compte désigné sans rien à réclamer dans cet état est nommé, jamais sauté en silence', async () => {
        const { svc } = service([ligne('41100001', '2026-06-01', '2026-07-01'), ligne('41100002', '2026-09-20', '2026-11-30')], [PREVENTIF, RAPPEL]);
        const r = await svc.emettre(DOSSIER, AGENT, {
            exerciceId: 'ex-1',
            niveauId: RAPPEL.id,
            compteIds: ['c-41100001', 'c-41100002'],
            dateReference: REF,
        });
        expect(r.emises).toBe(1);
        expect(r.sansObjet).toEqual([
            { compteId: 'c-41100002', compte: '41100002 · Client 41100002', motif: (0, relances_service_1.motifRienAReclamer)(client_1.TypeRelance.RAPPEL) },
        ]);
    });
    it('le motif dit l’état, pas une phrase passe-partout', () => {
        expect((0, relances_service_1.motifRienAReclamer)(client_1.TypeRelance.PREVENTIVE)).toContain('à prévenir');
        expect((0, relances_service_1.motifRienAReclamer)(client_1.TypeRelance.RAPPEL)).toContain('à rappeler');
        expect((0, relances_service_1.motifRienAReclamer)(client_1.TypeRelance.RELEVE)).toContain('Rien de dû');
    });
});
describe('F168 · l’avis préventif ne part pas deux mois avant l’échéance', () => {
    it('une échéance à soixante jours n’atteint pas le seuil de sept jours', async () => {
        const { svc } = service([ligne('41100001', '2026-09-20', '2026-11-30')], [PREVENTIF]);
        const [p] = await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.PREVENTIVE, dateReference: REF });
        expect(p.retardMaxJours).toBe(-60);
        expect(p.niveauSuggere).toBeNull();
    });
    it('une échéance à trois jours l’atteint', async () => {
        const { svc } = service([ligne('41100001', '2026-09-20', '2026-10-04')], [PREVENTIF]);
        const [p] = await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.PREVENTIVE, dateReference: REF });
        expect(p.retardMaxJours).toBe(-3);
        expect(p.niveauSuggere).toBe(1);
    });
});
describe('F169 · seules comptent les relances de la dette encore ouverte', () => {
    it('une relance antérieure à la plus ancienne pièce ouverte ne bloque plus la suggestion', async () => {
        const { svc } = service([ligne('41100001', '2026-06-01', '2026-07-01')], [RAPPEL], [
            { compteId: 'c-41100001', dateRelance: new Date('2025-12-01T00:00:00Z'), niveauRelance: { niveau: 2 } },
        ]);
        const [p] = await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.RAPPEL, dateReference: REF });
        expect(p.derniereRelance).toBeNull();
        expect(p.niveauSuggere).toBe(2);
    });
    it('une relance de la dette ouverte, elle, bloque toujours le même niveau', async () => {
        const { svc } = service([ligne('41100001', '2026-06-01', '2026-07-01')], [RAPPEL], [
            { compteId: 'c-41100001', dateRelance: new Date('2026-08-01T00:00:00Z'), niveauRelance: { niveau: 2 } },
        ]);
        const [p] = await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.RAPPEL, dateReference: REF });
        expect(p.derniereRelance).toEqual({ niveau: 2, date: '2026-08-01' });
        expect(p.niveauSuggere).toBeNull();
    });
    it('la borne est la PLUS ANCIENNE pièce du compte, pas la plus récente', async () => {
        const { svc } = service([ligne('41100001', '2026-06-01', '2026-07-01'), ligne('41100001', '2026-03-01', '2026-04-01')], [RAPPEL], [{ compteId: 'c-41100001', dateRelance: new Date('2026-04-15T00:00:00Z'), niveauRelance: { niveau: 2 } }]);
        const [p] = await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.RAPPEL, dateReference: REF });
        expect(p.derniereRelance).toEqual({ niveau: 2, date: '2026-04-15' });
        expect(p.niveauSuggere).toBeNull();
    });
    it('la borne se lit compte par compte · la pièce d’un voisin plus ancien ne la recule pas', async () => {
        const { svc } = service([ligne('41100001', '2026-01-10', '2026-02-10'), ligne('41100002', '2026-06-01', '2026-07-01')], [RAPPEL], [{ compteId: 'c-41100002', dateRelance: new Date('2026-03-01T00:00:00Z'), niveauRelance: { niveau: 2 } }]);
        const positions = await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.RAPPEL, dateReference: REF });
        const p2 = positions.find((p) => p.compteId === 'c-41100002');
        expect(p2.derniereRelance).toBeNull();
        expect(p2.niveauSuggere).toBe(2);
    });
    it('la lecture des relances est bornée aux comptes retenus et à leur plus ancienne pièce', async () => {
        const { svc, relanceFindMany } = service([ligne('41100001', '2026-01-10', '2026-02-10'), ligne('41100002', '2026-06-01', '2026-07-01')], [RAPPEL]);
        await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.RAPPEL, dateReference: REF });
        expect(relanceFindMany).toHaveBeenCalledTimes(1);
        const { where } = relanceFindMany.mock.calls[0][0];
        expect(where.tenantId).toBe(DOSSIER);
        expect([...where.compteId.in].sort()).toEqual(['c-41100001', 'c-41100002']);
        expect(where.dateRelance.gte.toISOString().slice(0, 10)).toBe('2026-01-10');
    });
    it('sans aucune position, l’historique n’est pas lu du tout', async () => {
        const { svc, relanceFindMany } = service([], [RAPPEL]);
        expect(await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.RAPPEL, dateReference: REF })).toEqual([]);
        expect(relanceFindMany).not.toHaveBeenCalled();
    });
});
describe('F185 · les positions se lisent par tranches, et aucune ligne ne se perd entre deux', () => {
    it('la requête pagine par identifiant, et le montant dû porte les lignes de toutes les tranches', async () => {
        const toutes = Array.from({ length: lecture_par_lots_1.LOT_LECTURE + 2 }, (_, i) => ({
            ...ligne('41100001', '2026-09-01', '2026-09-15'),
            id: `l-${String(i).padStart(6, '0')}`,
        }));
        const { svc } = service([], [PREVENTIF]);
        const findMany = jest.fn(async (args) => {
            const debut = args.cursor ? toutes.findIndex((l) => l.id === args.cursor.id) + (args.skip ?? 0) : 0;
            return toutes.slice(debut, debut + args.take);
        });
        svc.prisma.ligneEcriture.findMany = findMany;
        const [p] = await svc.positions(DOSSIER, { exerciceId: 'ex-1', type: client_1.TypeRelance.RELEVE, dateReference: REF });
        expect(findMany).toHaveBeenCalledTimes(2);
        expect(findMany.mock.calls[0][0]).toMatchObject({ orderBy: { id: 'asc' }, take: lecture_par_lots_1.LOT_LECTURE });
        expect(p.lignes).toHaveLength(lecture_par_lots_1.LOT_LECTURE + 2);
        expect(p.montantDu).toBe((lecture_par_lots_1.LOT_LECTURE + 2) * 100_000);
    });
});
//# sourceMappingURL=etats-de-relance.spec.js.map