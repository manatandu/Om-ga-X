"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
let idLigne = 0;
function ligne(numero, debit, credit = 0) {
    idLigne += 1;
    return { id: `l${idLigne}`, debit, credit, lettre: null, compte: { numero, intitule: `Compte ${numero}` } };
}
function ecriture(libelle, lignes) {
    return {
        id: `e-${libelle}`,
        date: new Date('2026-05-10'),
        libelle,
        reference: 'PJ-1',
        numeroPiece: 1,
        createdAt: new Date('2026-05-10'),
        statut: 'VALIDEE',
        journal: { code: 'OD' },
        lignes,
    };
}
function service(referentiel, ecritures) {
    const exoneration = { findMany: jest.fn().mockResolvedValue([]) };
    const prisma = {
        exercice: {
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2026-01-01'),
                dateFin: new Date('2026-12-31'),
            }),
            findMany: jest.fn().mockResolvedValue([{ id: 'ex', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31'), statut: 'OUVERT' }]),
        },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                id: 't',
                referentiel,
                jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
                systemeComptableSyscohada: null,
                formeJuridiqueSyscohada: null,
            }),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue(ecritures) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        exoneration,
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        cloture: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return { svc: new controles_service_1.ControlesService(prisma), exoneration };
}
const anomalie = async (svc, code) => (await svc.analyser('t', 'ex')).anomalies.find((a) => a.code === code);
const texte = (a) => [a.libelle, a.consequence, a.action, ...a.occurrences.map((o) => o.detail ?? '')].join(' | ');
describe('Contrôles · le vocabulaire suit le référentiel du dossier', () => {
    const clientCrediteur = [ecriture('Encaissement', [ligne('41100000', 0, 500_000), ligne('52110000', 500_000)])];
    it('ne parle jamais d’adhérent à un dossier SYSCOHADA', async () => {
        const { svc } = service(client_1.Referentiel.SYSCOHADA, clientCrediteur);
        const a = await anomalie(svc, 'TIERS_SOLDE_INVERSE');
        expect(a).toBeDefined();
        expect(texte(a)).not.toMatch(/adhérent|usager/i);
        expect(texte(a)).toMatch(/client/i);
    });
    it('parle bien d’adhérent et de client-usager à un dossier SYCEBNL', async () => {
        const { svc } = service(client_1.Referentiel.SYCEBNL, clientCrediteur);
        const a = await anomalie(svc, 'TIERS_SOLDE_INVERSE');
        expect(a).toBeDefined();
        expect(texte(a)).toMatch(/adhérent/i);
    });
    it('ne renvoie pas un dossier SYSCOHADA à un chapitre du SYCEBNL', async () => {
        const { svc } = service(client_1.Referentiel.SYSCOHADA, [
            ecriture('Loyer', [ligne('62210000', 300_000), ligne('52110000', 0, 300_000)]),
        ]);
        const a = await anomalie(svc, 'CHARGE_SANS_TIERS');
        expect(a).toBeDefined();
        expect(texte(a)).not.toMatch(/SYCEBNL|Partie \d/);
        expect(texte(a)).toMatch(/AUDCIF/);
    });
});
describe('Contrôles · la classe 9 ne porte pas la même chose dans les deux plans', () => {
    const engagement = [ecriture('Caution', [ligne('90110000', 4_000_000), ligne('91110000', 0, 4_000_000)])];
    it('annonce les contributions volontaires en nature au SYCEBNL', async () => {
        const { svc } = service(client_1.Referentiel.SYCEBNL, engagement);
        const a = await anomalie(svc, 'CLASSE_9_MOUVEMENTEE');
        expect(a.libelle).toMatch(/contributions volontaires/i);
        expect(a.action).toMatch(/contributions volontaires/i);
    });
    it('au SYCEBNL, un 94 est de la comptabilité analytique, pas une contribution volontaire (R5-A4, R5-C2)', async () => {
        const couts = [ecriture('Coûts', [ligne('94100000', 100_000), ligne('92100000', 0, 100_000)])];
        const { svc } = service(client_1.Referentiel.SYCEBNL, couts);
        const rapport = await svc.analyser('t', 'ex');
        expect(rapport.anomalies.some((a) => a.code === 'CLASSE_9_MOUVEMENTEE')).toBe(false);
        const a = rapport.anomalies.find((x) => x.code === 'CLASSE_9_ANALYTIQUE_MOUVEMENTEE');
        expect(a.occurrences.map((o) => o.reference)).toEqual(['94100000', '92100000']);
        expect(a.libelle).not.toMatch(/contributions volontaires/i);
    });
    it('le report à-nouveau d’un 90 n’est pas un mouvement (R5-C2)', async () => {
        const report = { ...ecriture('À-nouveau', [ligne('90110000', 4_000_000), ligne('91110000', 0, 4_000_000)]), estGenereeParCloture: true };
        const { svc } = service(client_1.Referentiel.SYCEBNL, [report]);
        expect(await anomalie(svc, 'CLASSE_9_MOUVEMENTEE')).toBeUndefined();
    });
    for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        it(`${referentiel} · nomme la pièce où les 90 et 91 ne s’équilibrent pas entre eux`, async () => {
            const fautive = ecriture('Bénévolat payé en caisse', [ligne('90400000', 500_000), ligne('57100000', 0, 500_000)]);
            const { svc } = service(referentiel, [...engagement, fautive]);
            const rapport = await svc.analyser('t', 'ex');
            const a = rapport.anomalies.find((x) => x.code === 'CLASSE_9_HORS_EQUILIBRE');
            expect(a.gravite).toBe('AVERTISSEMENT');
            expect(a.occurrences.map((o) => o.detail)).toEqual(['Bénévolat payé en caisse']);
            expect(a.consequence).toContain(referentiel === client_1.Referentiel.SYCEBNL ? '910 à 914' : '911 à 914');
            const info = rapport.anomalies.find((x) => x.code === 'CLASSE_9_MOUVEMENTEE');
            expect(info.consequence).toContain('Sauf sur les écritures signalées');
        });
    }
    it('se tait sur la pièce du Guide, 90 contre 91, et la classe 9 garde sa phrase entière', async () => {
        const { svc } = service(client_1.Referentiel.SYCEBNL, engagement);
        const rapport = await svc.analyser('t', 'ex');
        expect(rapport.anomalies.find((x) => x.code === 'CLASSE_9_HORS_EQUILIBRE')).toBeUndefined();
        const info = rapport.anomalies.find((x) => x.code === 'CLASSE_9_MOUVEMENTEE');
        expect(info.consequence).toMatch(/situation nette, et se présentent en note annexe\.$/);
    });
    it('annonce les engagements hors bilan et l’analytique au SYSCOHADA', async () => {
        const { svc } = service(client_1.Referentiel.SYSCOHADA, engagement);
        const a = await anomalie(svc, 'CLASSE_9_MOUVEMENTEE');
        expect(a.libelle).not.toMatch(/contributions volontaires/i);
        expect(a.libelle).toMatch(/engagements hors bilan/i);
        expect(a.consequence).toMatch(/92 à 99/);
        expect(a.action).toMatch(/engagements hors bilan/i);
    });
});
describe('Contrôles · les exonérations douanières sont un régime d’ASBL', () => {
    it('un dossier SYSCOHADA n’interroge même pas la table des exonérations', async () => {
        const { svc, exoneration } = service(client_1.Referentiel.SYSCOHADA, []);
        await svc.analyser('t', 'ex');
        expect(exoneration.findMany).not.toHaveBeenCalled();
    });
    it('un dossier SYCEBNL l’interroge', async () => {
        const { svc, exoneration } = service(client_1.Referentiel.SYCEBNL, []);
        await svc.analyser('t', 'ex');
        expect(exoneration.findMany).toHaveBeenCalled();
    });
});
describe('Contrôles · 409 et 419 ont un sens normalement inversé, dans les deux plans', () => {
    for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        describe(referentiel, () => {
            const numeros = async (ecritures) => {
                const { svc } = service(referentiel, ecritures);
                const a = await anomalie(svc, 'TIERS_SOLDE_INVERSE');
                return (a?.occurrences ?? []).map((o) => o.reference);
            };
            it('se tait sur une avance versée (4091 débiteur) et sur une avance reçue (4191 créditeur)', async () => {
                const lignes = await numeros([
                    ecriture('Acompte fournisseur', [ligne('40910000', 200_000), ligne('52110000', 0, 200_000)]),
                    ecriture('Acompte reçu', [ligne('52110000', 300_000), ligne('41910000', 0, 300_000)]),
                ]);
                expect(lignes).toEqual([]);
            });
            it('signale le sens CONTRAIRE au leur, que l’exclusion pure aurait masqué', async () => {
                const lignes = await numeros([
                    ecriture('409 au crédit', [ligne('52110000', 200_000), ligne('40910000', 0, 200_000)]),
                    ecriture('419 au débit', [ligne('41910000', 300_000), ligne('52110000', 0, 300_000)]),
                ]);
                expect(lignes.sort()).toEqual(['40910000', '41910000']);
            });
            it('dit le reclassement, et pas seulement d’aller regarder', async () => {
                const { svc } = service(referentiel, [
                    ecriture('Avance au 401', [ligne('40110000', 400_000), ligne('52110000', 0, 400_000)]),
                ]);
                const a = await anomalie(svc, 'TIERS_SOLDE_INVERSE');
                expect(a.action).toMatch(/4091/);
                expect(a.action).toMatch(/4191/);
                expect(a.action).toMatch(/compensation/i);
            });
            it('signale toujours un 411 créditeur et un 401 débiteur', async () => {
                const lignes = await numeros([
                    ecriture('Client créditeur', [ligne('52110000', 500_000), ligne('41100000', 0, 500_000)]),
                    ecriture('Fournisseur débiteur', [ligne('40110000', 400_000), ligne('52110000', 0, 400_000)]),
                ]);
                expect(lignes.sort()).toEqual(['40110000', '41100000']);
            });
        });
    }
});
describe('Contrôles · la créance douteuse se reclasse au 416 et se déprécie au 491', () => {
    it('cite les deux comptes, et pas le 416 seul', async () => {
        const { svc } = service(client_1.Referentiel.SYSCOHADA, [
            {
                ...ecriture('Vieille facture', [ligne('41100000', 900_000), ligne('70100000', 0, 900_000)]),
                date: new Date('2026-01-05'),
            },
        ]);
        const a = await anomalie(svc, 'TIERS_ANCIEN_NON_LETTRE');
        expect(a).toBeDefined();
        expect(a.consequence).toMatch(/416/);
        expect(a.consequence).toMatch(/491/);
    });
});
describe('Contrôles · le compte 55 lit la phrase de SON texte (R1-B5, R5-C4)', () => {
    for (const [referentiel, source] of [
        [client_1.Referentiel.SYCEBNL, 'SYCEBNL, Partie 2 ch. 3, compte 55'],
        [client_1.Referentiel.SYSCOHADA, 'AUDCIF, Titre VII, compte 55'],
    ]) {
        it(`${referentiel} · un 55 créditeur est signalé en avertissement`, async () => {
            const { svc } = service(referentiel, []);
            const prisma = svc.prisma;
            prisma.compte.findMany.mockImplementation(({ where }) => Promise.resolve(where.numero?.startsWith === '55'
                ? [{ id: 'c55', numero: '55100000', intitule: 'Mobile money', journauxTresorerie: [] }]
                : []));
            prisma.ligneEcriture.findMany.mockImplementation(({ where }) => Promise.resolve(where.compteId?.in?.includes('c55')
                ? [{ id: 'l55', compteId: 'c55', debit: 0, credit: 10_000, ecriture: { date: new Date('2026-04-01') } }]
                : []));
            const a = await anomalie(svc, 'MONNAIE_ELECTRONIQUE_CREDITRICE');
            expect(a.gravite).toBe('AVERTISSEMENT');
            expect(a.consequence).toContain(source);
            expect(a.consequence).toContain('ne doit être que débiteur ou nul');
        });
    }
});
//# sourceMappingURL=controles-referentiel.spec.js.map