"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const devises_service_1 = require("./devises.service");
function service(lignes, cours) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex1',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
                statut: 'OUVERT',
            }),
        },
        ligneEcriture: {
            aggregate: jest.fn().mockResolvedValue({ _count: { _all: 0 } }),
            findMany: jest.fn().mockResolvedValue(lignes.map((l, i) => ({
                compteId: `c-${l.compteNumero}`,
                deviseId: `d-${l.deviseCode}`,
                debit: l.debit,
                credit: l.credit,
                montantDevise: l.montantDevise,
                compte: { id: `c-${l.compteNumero}`, numero: l.compteNumero, intitule: `Compte ${i}` },
                devise: { id: `d-${l.deviseCode}`, code: l.deviseCode },
            }))),
        },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]), },
        provisionChangeOuverture: { findMany: jest.fn().mockResolvedValue([]) },
        verrouProvisionChange: { deleteMany: jest.fn(), create: jest.fn().mockResolvedValue({ id: 'verrou' }) },
        ecriture: { count: jest.fn().mockResolvedValue(1) },
        coursDevise: {
            findFirst: jest.fn().mockImplementation(({ where }) => {
                const code = where.deviseId.replace('d-', '');
                return Promise.resolve(cours[code] === undefined ? null : { cours: cours[code] });
            }),
        },
    };
    return new devises_service_1.DevisesService(prisma, {});
}
const CREANCE_QUI_PERD = {
    compteNumero: '41100000',
    deviseCode: 'USD',
    debit: 2_800_000,
    credit: 0,
    montantDevise: 1000,
};
const DETTE_QUI_GAGNE = {
    compteNumero: '40100000',
    deviseCode: 'USD',
    debit: 0,
    credit: 2_800_000,
    montantDevise: 1000,
};
describe('Position globale de change · art. 58', () => {
    it('sans l’option, la perte est provisionnée EN ENTIER même compensée par un gain', async () => {
        const r = await service([CREANCE_QUI_PERD, DETTE_QUI_GAGNE], { USD: 2500 }).calculer('t1', {
            exerciceId: 'ex1',
        });
        expect(r.perteLatente).toBe(300_000);
        expect(r.gainLatent).toBe(300_000);
        expect(r.provision).toBe(300_000);
        expect(r.positionGlobaleRetenue).toBe(false);
    });
    it('avec l’option, la dotation tombe à l’excédent des pertes sur les gains', async () => {
        const r = await service([CREANCE_QUI_PERD, DETTE_QUI_GAGNE], { USD: 2500 }).calculer('t1', {
            exerciceId: 'ex1',
            positionGlobale: true,
        });
        expect(r.provision).toBe(0);
        expect(r.perteLatente).toBe(300_000);
        expect(r.gainLatent).toBe(300_000);
        expect(r.provisionSansPositionGlobale).toBe(300_000);
        expect(r.positionGlobaleRetenue).toBe(true);
    });
    it('la position se tient DEVISE PAR DEVISE · un gain en euros ne couvre pas une perte en dollars', async () => {
        const gainEnEuros = {
            compteNumero: '40100000',
            deviseCode: 'EUR',
            debit: 0,
            credit: 3_000_000,
            montantDevise: 1000,
        };
        const r = await service([CREANCE_QUI_PERD, gainEnEuros], { USD: 2500, EUR: 2700 }).calculer('t1', {
            exerciceId: 'ex1',
            positionGlobale: true,
        });
        expect(r.gainLatent).toBe(300_000);
        expect(r.provision).toBe(300_000);
    });
    it('la réduction se répartit au PRORATA entre les positions perdantes', async () => {
        const pret = {
            compteNumero: '27100000',
            deviseCode: 'USD',
            debit: 1_120_000,
            credit: 0,
            montantDevise: 400,
        };
        const detteQuiGagne = {
            compteNumero: '40100000',
            deviseCode: 'USD',
            debit: 0,
            credit: 2_710_000,
            montantDevise: 1000,
        };
        const r = await service([CREANCE_QUI_PERD, pret, detteQuiGagne], { USD: 2500 }).calculer('t1', {
            exerciceId: 'ex1',
            positionGlobale: true,
        });
        expect(r.perteLatente).toBe(420_000);
        expect(r.gainLatent).toBe(210_000);
        expect(r.provision).toBe(210_000);
        const parCompte = new Map(r.positions.map((p) => [p.numero, p.provisionnable]));
        expect(parCompte.get('41100000')).toBe(150_000);
        expect(parCompte.get('27100000')).toBe(60_000);
        expect(parCompte.get('40100000')).toBe(0);
    });
    it('une disponibilité n’entre pas dans la position · son écart est déjà au résultat', async () => {
        const banque = {
            compteNumero: '52120000',
            deviseCode: 'USD',
            debit: 2_800_000,
            credit: 0,
            montantDevise: 1000,
        };
        const r = await service([banque], { USD: 2500 }).calculer('t1', {
            exerciceId: 'ex1',
            positionGlobale: true,
        });
        expect(r.perteRealisee).toBe(300_000);
        expect(r.perteLatente).toBe(0);
        expect(r.provision).toBe(0);
    });
});
describe('Étalement de l’art. 56 · ce que le logiciel dit ne pas savoir calculer', () => {
    it('avertit sur une perte de change portant un emprunt à long terme', async () => {
        const emprunt = {
            compteNumero: '16100000',
            deviseCode: 'USD',
            debit: 0,
            credit: 2_800_000,
            montantDevise: 1000,
        };
        const r = await service([emprunt], { USD: 3100 }).calculer('t1', { exerciceId: 'ex1' });
        expect(r.avertissements).toHaveLength(1);
        expect(r.avertissements[0]).toMatch(/16100000/);
        expect(r.avertissements[0]).toMatch(/art\. 56/);
        expect(r.avertissements[0]).toMatch(/ÉTALER/);
        expect(r.provision).toBe(300_000);
    });
    it('n’avertit pas sur une créance commerciale, que l’art. 56 ne vise pas', async () => {
        const r = await service([CREANCE_QUI_PERD], { USD: 2500 }).calculer('t1', { exerciceId: 'ex1' });
        expect(r.avertissements).toEqual([]);
    });
    it('n’avertit pas sur un GAIN de change · il n’y a rien à doter', async () => {
        const emprunt = {
            compteNumero: '16100000',
            deviseCode: 'USD',
            debit: 0,
            credit: 2_800_000,
            montantDevise: 1000,
        };
        const r = await service([emprunt], { USD: 2500 }).calculer('t1', { exerciceId: 'ex1' });
        expect(r.gainLatent).toBe(300_000);
        expect(r.avertissements).toEqual([]);
    });
});
//# sourceMappingURL=position-globale-etalement.spec.js.map