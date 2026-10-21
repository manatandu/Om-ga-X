"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const conges_service_1 = require("./conges.service");
const absences_1 = require("./absences");
const salaire_pendant_le_conge_1 = require("./salaire-pendant-le-conge");
const SANS_MALADIE = new Set();
const jour = (s) => new Date(`${s}T00:00:00Z`);
describe('point 3 · même base des deux côtés pour un mois couvert en entier', () => {
    const conges = (0, absences_1.congesDuMois)([{ id: 'c-dec', du: '2026-12-01', au: '2026-12-31', joursVoyage: 0 }], '2026-12', SANS_MALADIE);
    const proposition = (0, absences_1.propositionDuMois)({ jours: [], salaireMensuel: 1_040_000, moyenneMensuelleArticle66: null, conges, mois: '2026-12' });
    it('la proposition paie 1 040 000 ÷ 27 = 38 518,52 · le jour férié du congé', () => {
        expect(conges[0].auMoins).toBe(26);
        expect([proposition.baseDuMois, proposition.salaireDesJoursDus]).toEqual([27, 38_518.52]);
    });
    it('suivre la proposition passe la garde, un centime de plus ne passe pas', () => {
        const garde = (salaire) => (0, absences_1.motifRefusSalairePleinPendantLeConge)({ mois: '2026-12', conges, salaireDuBulletin: salaire, salaireMensuel: 1_040_000, devise: 'CDF' });
        expect(garde(proposition.salaireDesJoursDus)).toBeNull();
        const m = garde(38_518.53);
        expect(m).toContain('38518.52 CDF');
        expect(m).toContain('27 jours payables');
    });
});
describe('point 1 · la référence est la plus grande du contrat et du taux déclaré au congé × 26', () => {
    const aout = (remunerationJournaliere, deviseAllocation) => (0, absences_1.congesDuMois)([{ id: 'c-1', du: '2026-08-03', au: '2026-08-15', joursVoyage: 0 }], '2026-08', SANS_MALADIE).map((c) => ({
        ...c,
        remunerationJournaliere,
        deviseAllocation,
    }));
    const garde = (salaire, rj, devise) => (0, absences_1.motifRefusSalairePleinPendantLeConge)({ mois: '2026-08', conges: aout(rj, devise), salaireDuBulletin: salaire, salaireMensuel: 1_040_000, devise: 'CDF' });
    it('un taux déclaré de 50 000 (× 26 = 1 300 000) élève le plafond · 1 300 000 × 14 / 26 = 700 000', () => {
        expect(garde(700_000, 50_000, 'CDF')).toBeNull();
        const m = garde(700_000.01, 50_000, 'CDF');
        expect(m).toContain('700000.00 CDF');
        expect(m).toContain('rémunération journalière déclarée au congé × 26');
        expect(m).not.toContain('contrat en vigueur');
    });
    it('la référence du contrat nomme l’issue · saisir le contrat en vigueur', () => {
        const m = garde(1_040_000, 40_000, 'CDF');
        expect(m).toContain('560000.00 CDF');
        expect(m).toContain('salaire mensuel du contrat');
        expect(m).toContain("saisissez d'abord le contrat en vigueur");
    });
    it('un taux déclaré dans une autre monnaie n’élève rien', () => {
        expect(garde(700_000, 50_000, 'USD')).not.toBeNull();
    });
});
describe('point 2 · la garde qui ne compare rien le dit', () => {
    const contrat = (p) => ({
        remunerationBase: 1_040_000,
        periodiciteRemuneration: 'MOIS',
        deviseRemuneration: 'CDF',
        ...p,
    });
    it('journalier, sans monnaie, autre monnaie · chacun sa raison ; au mois dans la monnaie · elle compare', () => {
        expect((0, absences_1.raisonDeLaGardeMuette)(contrat({ periodiciteRemuneration: 'JOUR' }), 'CDF')).toBe('le contrat est payé à la journée, pas au mois');
        expect((0, absences_1.raisonDeLaGardeMuette)(contrat({ deviseRemuneration: null }), 'CDF')).toBe("la monnaie de la rémunération n'est pas renseignée au contrat");
        expect((0, absences_1.raisonDeLaGardeMuette)(contrat({ deviseRemuneration: 'USD' }), 'CDF')).toBe('le contrat est stipulé en USD, le bulletin en CDF');
        expect((0, absences_1.raisonDeLaGardeMuette)(contrat({ remunerationBase: null }), 'CDF')).toBe("la rémunération n'est pas renseignée au contrat");
        expect((0, absences_1.raisonDeLaGardeMuette)(contrat({}), 'CDF')).toBeNull();
    });
    it('à l’émission d’un bulletin journalier d’un mois de congé · aucun refus, un avertissement qui nomme le congé et la raison', async () => {
        const prisma = {
            congeSalarie: {
                findMany: jest.fn().mockResolvedValue([
                    {
                        id: 'c-1',
                        du: jour('2026-08-03'),
                        au: jour('2026-08-15'),
                        joursVoyage: 0,
                        moisDePaie: '2026-08',
                        remunerationJournaliere: null,
                        deviseAllocation: null,
                        bulletin: null,
                    },
                ]),
            },
            absenceSalarie: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const r = await (0, salaire_pendant_le_conge_1.confronterSalaireAuxConges)(prisma, 't', 's-1', {
            mois: '2026-08',
            salaire: 1_040_000,
            devise: 'CDF',
            contrat: { remunerationBase: new client_1.Prisma.Decimal(40_000), periodiciteRemuneration: 'JOUR', deviseRemuneration: 'CDF' },
        });
        expect(r.refus).toBeNull();
        expect(r.avertissement).toMatch(/Le bulletin de 2026-08 n'est pas confronté aux 12 jour\(s\) de congé de ce mois \(congé du 2026-08-03 au 2026-08-15\) · le contrat est payé à la journée, pas au mois\..*art\. 142/);
    });
});
describe('les petites lectures', () => {
    it('le salaire d’une saisie figée · franc par défaut, dollars lus en dollars, illisible rendu null', () => {
        expect((0, salaire_pendant_le_conge_1.salaireDeLaSaisie)({ elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', montantFc: 680_000 }, { nature: 'PRIME', montantFc: 5 }] })).toEqual({
            salaire: 680_000,
            devise: 'CDF',
        });
        expect((0, salaire_pendant_le_conge_1.salaireDeLaSaisie)({ deviseStipulation: 'USD', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', montantUsd: 400 }] })).toEqual({ salaire: 400, devise: 'USD' });
        expect((0, salaire_pendant_le_conge_1.salaireDeLaSaisie)({ deviseStipulation: 'EUR', elements: [] })).toBeNull();
        expect((0, salaire_pendant_le_conge_1.salaireDeLaSaisie)(null)).toBeNull();
    });
    it('les mois qu’un congé touche, année franchie comprise', () => {
        expect((0, salaire_pendant_le_conge_1.moisTouches)('2026-12-21', '2027-01-08')).toEqual(['2026-12', '2027-01']);
        expect((0, salaire_pendant_le_conge_1.moisTouches)('2026-09-10', '2026-09-19')).toEqual(['2026-09']);
    });
});
const MOIS_PAYES = [
    '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08',
];
const CONTRAT = {
    id: 'k-1',
    dateEntreeEnVigueur: jour('2025-06-01'),
    dateFin: null,
    renouvelleDeId: null,
    remunerationBase: new client_1.Prisma.Decimal(1_040_000),
    periodiciteRemuneration: 'MOIS',
    deviseRemuneration: 'CDF',
};
function base(p) {
    const conges = (p.conges ?? []).map((c) => ({
        tenantId: 't',
        salarieId: 's-1',
        joursVoyage: 0,
        deviseAllocation: 'CDF',
        remunerationJournaliere: new client_1.Prisma.Decimal(40_000),
        moyenneMensuelleArticle142: new client_1.Prisma.Decimal(0),
        auDelaDuSolde: false,
        motifAuDelaDuSolde: null,
        motifAnnulation: null,
        ...c,
    }));
    const anciens = MOIS_PAYES.map((m, i) => ({ id: `b-${i}`, numero: i + 1, moisDePaie: m, nature: 'MOIS' }));
    const figes = p.emis.map((b) => ({
        id: b.id,
        numero: b.numero,
        moisDePaie: b.moisDePaie,
        nature: 'MOIS',
        entree: { deviseStipulation: 'CDF', elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: b.salaire }] },
        contrat: { remunerationBase: CONTRAT.remunerationBase, periodiciteRemuneration: 'MOIS', deviseRemuneration: 'CDF', ...b.contrat },
    }));
    const create = jest.fn().mockResolvedValue({ id: 'c-neuf' });
    const update = jest.fn().mockResolvedValue({});
    const prisma = {
        salarie: {
            findFirst: jest.fn().mockResolvedValue({ id: 's-1', nom: 'KABONGO', dateNaissance: jour('1990-04-12'), millesimeNaissance: null, contrats: [CONTRAT] }),
        },
        bulletinPaie: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                if (where.moisDePaie?.in)
                    return Promise.resolve(figes.filter((b) => where.moisDePaie.in.includes(b.moisDePaie)));
                return Promise.resolve([...anciens, ...figes]);
            }),
        },
        repriseCongesSalarie: { findFirst: jest.fn().mockResolvedValue(null) },
        congeSalarie: {
            findMany: jest.fn().mockImplementation(({ where }) => {
                let r = conges;
                if (where.id?.in)
                    r = r.filter((c) => where.id.in.includes(c.id));
                if (where.annuleLe === null)
                    r = r.filter((c) => c.annuleLe === null);
                if (where.du?.lte)
                    r = r.filter((c) => c.du.getTime() <= where.du.lte.getTime());
                if (where.au?.gte)
                    r = r.filter((c) => c.au.getTime() >= where.au.gte.getTime());
                return Promise.resolve(r);
            }),
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(conges.find((c) => c.id === where.id) ?? null)),
            create,
            update,
        },
        absenceSalarie: { findMany: jest.fn().mockResolvedValue([]) },
        contratTravail: { findMany: jest.fn().mockResolvedValue([CONTRAT]) },
    };
    prisma.$transaction = (fn) => fn(prisma);
    return { prisma: prisma, create, update };
}
const septembre = { du: '2026-09-10', au: '2026-09-19', moisDePaie: '2026-10', deviseAllocation: 'CDF', remunerationJournaliere: 40_000, moyenneMensuelleArticle142: 0 };
const congeDeSeptembre = (bulletin = null) => ({
    id: 'c-sept',
    du: jour('2026-09-10'),
    au: jour('2026-09-19'),
    moisDePaie: '2026-10',
    annuleLe: null,
    bulletin,
});
describe('B1 · le congé posé APRÈS le bulletin émis d’un mois qu’il touche', () => {
    it('septembre émis à 1 040 000, puis le congé de septembre · refusé, bulletin, plafond et issue nommés', async () => {
        const { prisma, create } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 1_040_000 }] });
        const echec = new conges_service_1.CongesService(prisma).creerConge('t', 'u@x.cd', 's-1', septembre);
        await expect(echec).rejects.toBeInstanceOf(common_1.BadRequestException);
        await expect(new conges_service_1.CongesService(prisma).creerConge('t', 'u@x.cd', 's-1', septembre)).rejects.toThrow(/Congé non posé · Le bulletin n° 16 de 2026-09, déjà émis, paie 1040000\.00 CDF de salaire alors que 9 jour\(s\).*680000\.00 CDF.*annulez le bulletin n° 16, posez le congé, puis réémettez le bulletin de 2026-09/);
        expect(create).not.toHaveBeenCalled();
    });
    it('septembre émis au salaire des jours hors congé (680 000) · le congé se pose, rien à dire', async () => {
        const { prisma, create } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 680_000 }] });
        const r = await new conges_service_1.CongesService(prisma).creerConge('t', 'u@x.cd', 's-1', septembre);
        expect(create).toHaveBeenCalledTimes(1);
        expect(r.avertissements).toEqual([]);
    });
    it('septembre émis sur un contrat à la journée · le congé se pose, et la garde dit qu’elle ne compare rien', async () => {
        const { prisma, create } = base({
            emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 1_040_000, contrat: { periodiciteRemuneration: 'JOUR' } }],
        });
        const r = await new conges_service_1.CongesService(prisma).creerConge('t', 'u@x.cd', 's-1', septembre);
        expect(create).toHaveBeenCalledTimes(1);
        expect(r.avertissements).toEqual([expect.stringMatching(/Le bulletin n° 16 de 2026-09 n'est pas confronté.*payé à la journée/)]);
    });
});
describe('B1 · l’allocation portée par un AUTRE mois que celui d’un bulletin déjà émis', () => {
    const porter = (prisma) => (0, conges_service_1.allocationsAPorter)(prisma, 't', 's-1', '2026-10', ['c-sept'], 'CDF');
    it('septembre à 1 040 000, l’allocation du congé de septembre au bulletin d’octobre · refusée', async () => {
        const { prisma } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 1_040_000 }], conges: [congeDeSeptembre()] });
        await expect(porter(prisma)).rejects.toThrow(/Congé du 2026-09-10 au 2026-09-19 · Le bulletin n° 16 de 2026-09, déjà émis, paie 1040000\.00 CDF.*annulez le bulletin n° 16 et réémettez le bulletin de 2026-09.*portez l'allocation au bulletin de 2026-10/);
    });
    it('septembre retranché · l’allocation se porte, 9 jours à 40 000', async () => {
        const { prisma } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 680_000 }], conges: [congeDeSeptembre()] });
        const [a] = await porter(prisma);
        expect([a.jours, a.montant]).toEqual([9, 360_000]);
    });
    it('le mois du bulletin qui porte n’est pas jugé ici · l’émission le juge', async () => {
        const { prisma } = base({ emis: [{ id: 'b-oct', numero: 17, moisDePaie: '2026-10', salaire: 1_040_000 }], conges: [congeDeSeptembre()] });
        await expect(porter(prisma)).resolves.toHaveLength(1);
    });
});
describe('B1 · le congé ANNULÉ après qu’un bulletin émis a retranché ses jours', () => {
    it('septembre réduit à 680 000, l’allocation jamais portée · l’annulation du congé est refusée, l’issue nommée', async () => {
        const { prisma, update } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 680_000 }], conges: [congeDeSeptembre()] });
        await expect(new conges_service_1.CongesService(prisma).annulerConge('t', 'u@x.cd', 'c-sept', 'pas pris')).rejects.toThrow(/Congé non annulé · Le bulletin n° 16 de 2026-09, émis, paie 680000\.00 CDF.*il retranche les 9 jour\(s\) de ce congé.*annulez d'abord le bulletin n° 16, puis le congé, et réémettez le bulletin de 2026-09/);
        expect(update).not.toHaveBeenCalled();
    });
    it('un bulletin émis au salaire plein (d’avant la règle) n’a rien retranché · l’annulation passe', async () => {
        const { prisma, update } = base({ emis: [{ id: 'b-sept', numero: 16, moisDePaie: '2026-09', salaire: 1_040_000 }], conges: [congeDeSeptembre()] });
        const r = await new conges_service_1.CongesService(prisma).annulerConge('t', 'u@x.cd', 'c-sept', 'pas pris');
        expect(update).toHaveBeenCalledTimes(1);
        expect(r.avertissements).toEqual([]);
    });
    it('à cheval · porteur de septembre annulé, octobre réduit · l’annulation est refusée sur le bulletin d’octobre', async () => {
        const aCheval = {
            id: 'c-cheval',
            du: jour('2026-09-28'),
            au: jour('2026-10-03'),
            moisDePaie: '2026-09',
            annuleLe: null,
            bulletin: { numero: 16, statut: 'ANNULE' },
        };
        const { prisma, update } = base({ emis: [{ id: 'b-oct', numero: 18, moisDePaie: '2026-10', salaire: 920_000 }], conges: [aCheval] });
        await expect(new conges_service_1.CongesService(prisma).annulerConge('t', 'u@x.cd', 'c-cheval', 'pas pris')).rejects.toThrow(/Le bulletin n° 18 de 2026-10, émis, paie 920000\.00 CDF.*les 3 jour\(s\) de ce congé en 2026-10/);
        expect(update).not.toHaveBeenCalled();
    });
    it('la règle pure · retranché au plafond exactement, et un centime au-dessus n’a pas retranché', () => {
        const [c] = (0, absences_1.congesDuMois)([{ id: 'c-sept', du: '2026-09-10', au: '2026-09-19', joursVoyage: 0 }], '2026-09', SANS_MALADIE);
        const motif = (salaire) => (0, absences_1.motifRefusAnnulationDuCongeRetranche)({ mois: '2026-09', numero: 16, conge: c, salaireDuBulletin: salaire, salaireMensuel: 1_040_000, devise: 'CDF' });
        expect(motif(680_000)).not.toBeNull();
        expect(motif(680_000.01)).toBeNull();
    });
});
//# sourceMappingURL=salaire-pendant-le-conge.spec.js.map