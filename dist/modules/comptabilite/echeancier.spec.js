"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ecriture_service_1 = require("./ecriture.service");
function ligne(id, numero, montant, options = {}) {
    return {
        id,
        debit: montant.debit ?? 0,
        credit: montant.credit ?? 0,
        libelle: null,
        dateEcheance: options.echeance ? new Date(options.echeance) : null,
        compte: {
            id: `c-${numero}`,
            numero,
            intitule: `Compte ${numero}`,
            tiersCompte: options.tiers ? { tiers: { nom: options.tiers } } : null,
        },
        ecriture: { date: new Date('2026-01-15'), libelle: `Écriture ${id}`, reference: options.reference ?? null },
    };
}
function tresorerie(numero, debit, credit = 0) {
    return { debit, credit, compte: { numero } };
}
function service(tiers, treso) {
    const prisma = {
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue(tiers),
            groupBy: jest.fn().mockResolvedValue([]),
            aggregate: jest.fn().mockImplementation(({ where }) => {
                const racine = where.compte.numero.startsWith;
                const exclue = where.compte.NOT?.numero?.startsWith;
                const retenues = treso.filter((l) => l.compte.numero.startsWith(racine) && !(exclue && l.compte.numero.startsWith(exclue)));
                return Promise.resolve({
                    _sum: {
                        debit: retenues.reduce((t, l) => t + l.debit, 0),
                        credit: retenues.reduce((t, l) => t + l.credit, 0),
                    },
                });
            }),
        },
    };
    return new ecriture_service_1.EcritureService(prisma, {}, {}, {});
}
const REF = '2026-06-15';
describe('Échéancier de trésorerie', () => {
    it('une créance est un ENCAISSEMENT, une dette un DÉCAISSEMENT', async () => {
        const s = service([
            ligne('a', '41100000', { debit: 500_000 }, { echeance: '2026-06-30', tiers: 'Mutuelle Kin' }),
            ligne('b', '40110000', { credit: 300_000 }, { echeance: '2026-06-20' }),
        ], [tresorerie('52110000', 1_000_000)]);
        const e = await s.echeancier('t1', { exerciceId: 'e1', dateReference: REF });
        expect(e.details.find((d) => d.ligneId === 'a').sens).toBe('ENCAISSEMENT');
        expect(e.details.find((d) => d.ligneId === 'b').sens).toBe('DECAISSEMENT');
        expect(e.details.find((d) => d.ligneId === 'a').tiers).toBe('Mutuelle Kin');
    });
    it('couvre les classes 42, 43 et 44 · c’est là qu’une ASBL se met en défaut', async () => {
        const s = service([
            ligne('sal', '42200000', { credit: 800_000 }, { echeance: '2026-06-30' }),
            ligne('cnss', '43100000', { credit: 200_000 }, { echeance: '2026-07-15' }),
            ligne('irpp', '44200000', { credit: 150_000 }, { echeance: '2026-07-15' }),
        ], [tresorerie('57100000', 400_000)]);
        const e = await s.echeancier('t1', { exerciceId: 'e1', dateReference: REF });
        expect(e.details).toHaveLength(3);
        expect(e.details.every((d) => d.sens === 'DECAISSEMENT')).toBe(true);
    });
    it('projette la trésorerie de tranche en tranche et NOMME la première rupture', async () => {
        const s = service([ligne('sal', '42200000', { credit: 800_000 }, { echeance: '2026-06-30' })], [tresorerie('57100000', 400_000)]);
        const e = await s.echeancier('t1', { exerciceId: 'e1', dateReference: REF });
        expect(e.tresorerieActuelle).toBe(400_000);
        const t = e.tranches.find((x) => x.cle === 'j8a30');
        expect(t.decaissements).toBe(800_000);
        expect(t.tresorerieProjetee).toBe(-400_000);
        expect(e.alerte).not.toBeNull();
        expect(e.alerte.tranche).toBe('j8a30');
    });
    it('ne signale aucune alerte quand la caisse suit', async () => {
        const s = service([ligne('f', '40110000', { credit: 100_000 }, { echeance: '2026-06-30' })], [tresorerie('52110000', 900_000)]);
        const e = await s.echeancier('t1', { exerciceId: 'e1', dateReference: REF });
        expect(e.alerte).toBeNull();
        expect(e.tranches.at(-1).tresorerieProjetee).toBe(800_000);
    });
    it('classe en ÉCHU ce dont la date est passée, et compte les lignes sans échéance', async () => {
        const s = service([
            ligne('retard', '40110000', { credit: 250_000 }, { echeance: '2026-05-01' }),
            ligne('sansDate', '40110000', { credit: 50_000 }),
        ], [tresorerie('52110000', 1_000_000)]);
        const e = await s.echeancier('t1', { exerciceId: 'e1', dateReference: REF });
        const echu = e.tranches.find((t) => t.cle === 'echu');
        expect(echu.decaissements).toBe(300_000);
        expect(e.lignesSansEcheance).toBe(1);
    });
    it('écarte le compte 59 de la trésorerie disponible · une dépréciation n’est pas de l’argent', async () => {
        const s = service([], [tresorerie('52110000', 1_000_000), tresorerie('59100000', 0, 200_000)]);
        const e = await s.echeancier('t1', { exerciceId: 'e1', dateReference: REF });
        expect(e.tresorerieActuelle).toBe(1_000_000);
    });
    it('une correction en négatif s’annule dans les TOTAUX, tout en restant visible au détail', async () => {
        const s = service([
            ligne('f', '40110000', { credit: 400_000 }, { echeance: '2026-06-30' }),
            ligne('corr', '40110000', { credit: -400_000 }, { echeance: '2026-06-30' }),
        ], [tresorerie('52110000', 500_000)]);
        const e = await s.echeancier('t1', { exerciceId: 'e1', dateReference: REF });
        expect(e.details).toHaveLength(2);
        const t = e.tranches.find((x) => x.cle === 'j8a30');
        expect(t.net).toBe(0);
        expect(e.alerte).toBeNull();
    });
});
describe('Échéancier · tranches entières, détail borné (audit final F185)', () => {
    it('au-delà du plafond, le détail garde les échéances les plus proches, et les tranches comptent tout', async () => {
        const n = ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE + 5;
        const lignes = Array.from({ length: n }, (_, i) => {
            const jour = new Date(Date.UTC(2026, 6, 1) + (n - i) * 86_400_000).toISOString().slice(0, 10);
            return ligne(`l${i}`, '41100000', { debit: 100 }, { echeance: jour });
        });
        const e = await service(lignes, []).echeancier('t1', { exerciceId: 'e1', dateReference: REF });
        expect(e.details).toHaveLength(ecriture_service_1.PLAFOND_ECRITURES_PAR_FENETRE);
        expect(e.tronque).toBe(true);
        expect(e.nombreDetails).toBe(n);
        expect(e.details[0].ligneId).toBe(`l${n - 1}`);
        const totalEncaisse = e.tranches.reduce((t, x) => t + x.encaissements, 0);
        expect(totalEncaisse).toBe(100 * n);
    });
});
//# sourceMappingURL=echeancier.spec.js.map