"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const controles_service_1 = require("./controles.service");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const banque_et_cloture_informatique_1 = require("./banque-et-cloture-informatique");
const D = (s) => new Date(`${s}T00:00:00.000Z`);
const iso = (d) => d.toISOString().slice(0, 10);
describe('les comptes de banque à rapprocher · racine 52, hors 526', () => {
    it('lit les comptes de banque des deux semis, et écarte les intérêts courus', () => {
        for (const plan of [compte_seed_1.PLAN_COMPTES_SYCEBNL, compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA]) {
            const detail52 = plan.filter((c) => c.numero.startsWith('52') && c.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL);
            const retenus = detail52.filter((c) => (0, banque_et_cloture_informatique_1.estCompteBancaireARapprocher)(c.numero)).map((c) => c.numero);
            const ecartes = detail52.filter((c) => !(0, banque_et_cloture_informatique_1.estCompteBancaireARapprocher)(c.numero));
            expect(retenus).toEqual(['52110000', '52150000', '52200000', '52300000', '52400000', '52500000']);
            expect(ecartes.map((c) => c.numero)).toEqual(['52610000', '52670000']);
            for (const c of ecartes)
                expect(c.intitule.toLowerCase()).toContain('intérêts courus');
        }
    });
    it('un sous-compte ouvert par le cabinet suit sa racine', () => {
        expect((0, banque_et_cloture_informatique_1.estCompteBancaireARapprocher)('5211000123')).toBe(true);
        expect((0, banque_et_cloture_informatique_1.estCompteBancaireARapprocher)('5261000123')).toBe(false);
        expect((0, banque_et_cloture_informatique_1.estCompteBancaireARapprocher)('53100000')).toBe(false);
        expect((0, banque_et_cloture_informatique_1.estCompteBancaireARapprocher)('57110000')).toBe(false);
    });
});
describe('entrée en vigueur des textes (§ 10 bis)', () => {
    it('AUDCIF art. 113 · comptes personnels au 1er janvier 2018', () => {
        expect((0, banque_et_cloture_informatique_1.texteEnVigueurPourLExercice)(client_1.Referentiel.SYSCOHADA, D('2017-01-01'))).toBe(false);
        expect((0, banque_et_cloture_informatique_1.texteEnVigueurPourLExercice)(client_1.Referentiel.SYSCOHADA, D('2018-01-01'))).toBe(true);
    });
    it('Acte uniforme SYCEBNL art. 28 · applicable au 1er janvier 2024', () => {
        expect((0, banque_et_cloture_informatique_1.texteEnVigueurPourLExercice)(client_1.Referentiel.SYCEBNL, D('2023-01-01'))).toBe(false);
        expect((0, banque_et_cloture_informatique_1.texteEnVigueurPourLExercice)(client_1.Referentiel.SYCEBNL, D('2024-01-01'))).toBe(true);
    });
    it('chaque référentiel cite SON chemin, art. 42 compris (première relecture, a)', () => {
        expect((0, banque_et_cloture_informatique_1.sourceFicheCompte52)(client_1.Referentiel.SYCEBNL)).toBe("SYCEBNL, Partie 2 ch. 3, compte 52 ; AUDCIF art. 42, que l'art. 3 de l'Acte uniforme SYCEBNL n'exclut pas");
        expect((0, banque_et_cloture_informatique_1.sourceFicheCompte52)(client_1.Referentiel.SYSCOHADA)).toBe('AUDCIF, Titre VII, compte 52 ; AUDCIF art. 42');
        expect((0, banque_et_cloture_informatique_1.sourceClotureInformatique)(client_1.Referentiel.SYCEBNL)).toContain("l'art. 3 de l'Acte uniforme SYCEBNL n'exclut pas");
        expect((0, banque_et_cloture_informatique_1.sourceClotureInformatique)(client_1.Referentiel.SYSCOHADA)).toBe('AUDCIF art. 22, 3°');
    });
});
describe('banque · rapprochement clos qui couvre la clôture', () => {
    const banque = {
        compteId: 'c1',
        numero: '52110000',
        intitule: 'Banque',
        soldeCloture: 1000,
        derniereLigne: D('2026-12-20'),
    };
    const etats = (e) => new Map([['c1', { dernierClos: null, soldeDernierClos: null, enCours: null, ...e }]]);
    it('se tait le jour même de la clôture · aucun relevé ne peut encore la couvrir', () => {
        expect((0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)([banque], new Map(), D('2026-12-31'), D('2026-12-31'))).toEqual([]);
    });
    it('parle au lendemain, quand aucun rapprochement n’a été clos', () => {
        expect((0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)([banque], new Map(), D('2026-12-31'), D('2027-01-01'))).toEqual([
            { reference: '52110000 Banque', detail: 'aucun rapprochement clos' },
        ]);
    });
    it('nomme le dernier relevé clos quand il s’arrête avant la clôture, et l’en cours', () => {
        expect((0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)([banque], etats({ dernierClos: D('2026-11-30'), enCours: D('2026-12-31') }), D('2026-12-31'), D('2027-01-15'))).toEqual([
            {
                reference: '52110000 Banque',
                detail: 'dernier rapprochement clos au relevé du 2026-11-30 · rapprochement en cours au relevé du 2026-12-31, non clos',
                date: '2026-11-30',
            },
        ]);
    });
    it('un relevé clos daté de la clôture, ou plus tard, la couvre · le texte ne fixe aucune date', () => {
        expect((0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)([banque], etats({ dernierClos: D('2026-12-31') }), D('2026-12-31'), D('2027-02-01'))).toEqual([]);
        expect((0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)([banque], etats({ dernierClos: D('2027-01-31') }), D('2026-12-31'), D('2027-02-01'))).toEqual([]);
    });
    it('n’examine jamais le 526', () => {
        const interets = { ...banque, compteId: 'c2', numero: '52670000', intitule: 'Intérêts courus' };
        expect((0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)([interets], new Map(), D('2026-12-31'), D('2027-03-01'))).toEqual([]);
    });
    describe('le compte fermé en cours d’exercice (première relecture, B1)', () => {
        const ferme = { ...banque, soldeCloture: 0, derniereLigne: D('2026-06-15') };
        const clos = (dernierClos, soldeDernierClos) => ({ dernierClos: D(dernierClos), soldeDernierClos, enCours: null });
        it('est couvert par son dernier relevé à solde nul, daté au plus tôt de sa dernière ligne, solde comptable nul', () => {
            expect((0, banque_et_cloture_informatique_1.compteFermeCouvert)(ferme, clos('2026-06-30', 0))).toBe(true);
            expect((0, banque_et_cloture_informatique_1.compteFermeCouvert)(ferme, clos('2026-06-15', 0))).toBe(true);
            expect((0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)([ferme], etats(clos('2026-06-30', 0)), D('2026-12-31'), D('2027-01-15'))).toEqual([]);
        });
        it('ne l’est pas quand le relevé précède la dernière ligne', () => {
            expect((0, banque_et_cloture_informatique_1.compteFermeCouvert)(ferme, clos('2026-06-14', 0))).toBe(false);
            expect((0, banque_et_cloture_informatique_1.comptesBancairesSansRapprochement)([ferme], etats(clos('2026-06-14', 0)), D('2026-12-31'), D('2027-01-15'))).toHaveLength(1);
        });
        it('ne l’est pas quand le relevé porte un solde, même si les livres sont nuls', () => {
            expect((0, banque_et_cloture_informatique_1.compteFermeCouvert)(ferme, clos('2026-06-30', 250))).toBe(false);
            expect((0, banque_et_cloture_informatique_1.compteFermeCouvert)(ferme, clos('2026-06-30', null))).toBe(false);
        });
        it('ne l’est pas quand le solde comptable n’est pas nul, même relevé nul', () => {
            expect((0, banque_et_cloture_informatique_1.compteFermeCouvert)({ ...ferme, soldeCloture: 0.5 }, clos('2026-06-30', 0))).toBe(false);
            expect((0, banque_et_cloture_informatique_1.compteFermeCouvert)({ ...ferme, soldeCloture: 0.004 }, clos('2026-06-30', 0))).toBe(true);
        });
        it('ne l’est pas sans aucun rapprochement clos', () => {
            expect((0, banque_et_cloture_informatique_1.compteFermeCouvert)(ferme, { dernierClos: null, soldeDernierClos: null, enCours: null })).toBe(false);
        });
    });
});
describe('clôture informatique · période ouverte et échéance (AUDCIF art. 22, 3°)', () => {
    it('trois mois finissent la veille du même quantième, ou à la fin du mois qui n’en a pas (première relecture, c)', () => {
        expect(iso((0, banque_et_cloture_informatique_1.finDeTroisMois)(D('2026-01-01')))).toBe('2026-03-31');
        expect(iso((0, banque_et_cloture_informatique_1.finDeTroisMois)(D('2026-01-31')))).toBe('2026-04-30');
        expect(iso((0, banque_et_cloture_informatique_1.finDeTroisMois)(D('2026-11-30')))).toBe('2027-02-28');
        expect(iso((0, banque_et_cloture_informatique_1.finDeTroisMois)(D('2026-11-29')))).toBe('2027-02-28');
        expect(iso((0, banque_et_cloture_informatique_1.finDeTroisMois)(D('2027-11-29')))).toBe('2028-02-28');
        expect(iso((0, banque_et_cloture_informatique_1.finDeTroisMois)(D('2027-11-30')))).toBe('2028-02-29');
        expect(iso((0, banque_et_cloture_informatique_1.finDeTroisMois)(D('2026-08-30')))).toBe('2026-11-29');
        expect(iso((0, banque_et_cloture_informatique_1.finDeTroisMois)(D('2026-02-15')))).toBe('2026-05-14');
    });
    it('une période ouverte au 31 janvier court jusqu’au 30 avril, non au 29', () => {
        const p = (0, banque_et_cloture_informatique_1.periodeOuverte)(D('2026-01-30'), D('2026-01-01'), D('2026-12-31'));
        expect([iso(p.debut), iso(p.finAuPlusTard), iso(p.echeance)]).toEqual(['2026-01-31', '2026-04-30', '2026-07-31']);
    });
    it('sans clôture, la première période court trois mois et se clôture à la fin des trois suivants', () => {
        const p = (0, banque_et_cloture_informatique_1.periodeOuverte)(null, D('2026-01-01'), D('2026-12-31'));
        expect([iso(p.debut), iso(p.finAuPlusTard), iso(p.echeance)]).toEqual(['2026-01-01', '2026-03-31', '2026-06-30']);
    });
    it('repart du lendemain du dernier jour figé', () => {
        const p = (0, banque_et_cloture_informatique_1.periodeOuverte)(D('2026-03-31'), D('2026-01-01'), D('2026-12-31'));
        expect([iso(p.debut), iso(p.finAuPlusTard), iso(p.echeance)]).toEqual(['2026-04-01', '2026-06-30', '2026-09-30']);
        const q = (0, banque_et_cloture_informatique_1.periodeOuverte)(D('2026-02-14'), D('2026-01-01'), D('2026-12-31'));
        expect([iso(q.debut), iso(q.finAuPlusTard), iso(q.echeance)]).toEqual(['2026-02-15', '2026-05-14', '2026-08-14']);
    });
    it('la période ne franchit pas la fin de l’exercice', () => {
        const p = (0, banque_et_cloture_informatique_1.periodeOuverte)(D('2026-11-30'), D('2026-01-01'), D('2026-12-31'));
        expect([iso(p.finAuPlusTard), iso(p.echeance)]).toEqual(['2026-12-31', '2027-03-31']);
    });
    it('un exercice figé jusqu’à sa fin n’a plus de période ouverte', () => {
        expect((0, banque_et_cloture_informatique_1.periodeOuverte)(D('2026-12-31'), D('2026-01-01'), D('2026-12-31'))).toBeNull();
    });
    it('un exercice décalé compte ses trimestres depuis son ouverture', () => {
        const p = (0, banque_et_cloture_informatique_1.periodeOuverte)(null, D('2026-07-01'), D('2027-06-30'));
        expect([iso(p.finAuPlusTard), iso(p.echeance)]).toEqual(['2026-09-30', '2026-12-31']);
    });
    it('la partielle ne fige rien · seules la période et la totale de CE journal comptent', () => {
        const clotures = [
            { granularite: client_1.GranulariteCloture.PARTIELLE, journalId: 'A', dateLimite: D('2026-09-30') },
            { granularite: client_1.GranulariteCloture.TOTALE, journalId: 'B', dateLimite: D('2026-08-31') },
            { granularite: client_1.GranulariteCloture.PERIODE, journalId: null, dateLimite: D('2026-03-31') },
        ];
        expect(iso((0, banque_et_cloture_informatique_1.dernierJourFige)('A', clotures))).toBe('2026-03-31');
        expect(iso((0, banque_et_cloture_informatique_1.dernierJourFige)('B', clotures))).toBe('2026-08-31');
    });
    const journaux = [
        { journalId: 'A', code: 'BQ' },
        { journalId: 'B', code: 'AC' },
    ];
    it('le retard ne se dit qu’au lendemain de l’échéance', () => {
        expect((0, banque_et_cloture_informatique_1.journauxEnRetardDeClotureInformatique)(journaux, [], D('2026-01-01'), D('2026-12-31'), D('2026-06-30'))).toEqual([]);
        expect((0, banque_et_cloture_informatique_1.journauxEnRetardDeClotureInformatique)(journaux, [], D('2026-01-01'), D('2026-12-31'), D('2026-07-01')).map((j) => j.reference)).toEqual(['Journal AC', 'Journal BQ']);
    });
    it('une clôture de période repousse l’échéance de tous les journaux, une totale du seul sien', () => {
        const periode = { granularite: client_1.GranulariteCloture.PERIODE, journalId: null, dateLimite: D('2026-03-31') };
        expect((0, banque_et_cloture_informatique_1.journauxEnRetardDeClotureInformatique)(journaux, [periode], D('2026-01-01'), D('2026-12-31'), D('2026-07-01'))).toEqual([]);
        const totaleA = { granularite: client_1.GranulariteCloture.TOTALE, journalId: 'A', dateLimite: D('2026-06-30') };
        expect((0, banque_et_cloture_informatique_1.journauxEnRetardDeClotureInformatique)(journaux, [periode, totaleA], D('2026-01-01'), D('2026-12-31'), D('2026-10-01'))).toEqual([
            {
                reference: 'Journal AC',
                detail: "figé dans OmegaX jusqu'au 2026-03-31 · période ouverte depuis le 2026-04-01, à clôturer au plus tard le 2026-09-30",
                date: '2026-09-30',
            },
        ]);
    });
    it('sans clôture, le détail dit qu’aucune n’est posée DANS OMEGAX (première relecture, d)', () => {
        expect((0, banque_et_cloture_informatique_1.journauxEnRetardDeClotureInformatique)([journaux[0]], [], D('2026-01-01'), D('2026-12-31'), D('2026-07-01'))[0].detail).toBe("aucune clôture de période ni totale posée dans OmegaX pour l'exercice · période ouverte depuis le 2026-01-01, " +
            'à clôturer au plus tard le 2026-06-30');
    });
    it('la première échéance borne la lecture · rien à lire avant elle', () => {
        expect((0, banque_et_cloture_informatique_1.premiereEcheanceDepassee)(D('2026-01-01'), D('2026-12-31'), D('2026-06-30'))).toBe(false);
        expect((0, banque_et_cloture_informatique_1.premiereEcheanceDepassee)(D('2026-01-01'), D('2026-12-31'), D('2026-07-01'))).toBe(true);
    });
});
function ligne(id, numero, debit, credit = 0) {
    return { id: `l-${id}`, debit, credit, lettre: null, compte: { id: `c-${numero}`, numero, intitule: `Compte ${numero}` } };
}
function ecriture(id, journalId, code, lignes, autres = {}) {
    return {
        id,
        date: D(autres.date ?? '2026-05-10'),
        libelle: 'Opération',
        reference: 'PJ',
        numeroPiece: 1,
        statut: autres.statut ?? 'VALIDEE',
        createdAt: D('2026-05-10'),
        createdBy: 'u1',
        valideeBy: 'u2',
        secondRegardNom: null,
        estGenereeParCloture: false,
        estANouveauProvisoire: autres.estANouveauProvisoire ?? false,
        reevaluationEcarts: autres.ecartsDeReevaluation ? { id: 'reeval' } : null,
        reevaluationExtourne: null,
        corrigeEcriture: autres.negatifDEcarts ? { reevaluationEcarts: { id: 'reeval' }, reevaluationExtourne: null } : null,
        journalId,
        journal: { code },
        lignes,
    };
}
function monter(options) {
    const ecritures = options.ecritures ?? [
        ecriture('e1', 'jBQ', 'BQ', [ligne('1', '52110000', 1000), ligne('2', '52670000', 0, 1000)]),
        ecriture('e2', 'jAC', 'AC', [ligne('3', '60100000', 500), ligne('4', '40110000', 0, 500)]),
    ];
    const raps = options.rapprochements ?? [];
    const retenus = (where) => raps.filter((r) => (!where.statut || r.statut === where.statut) &&
        (!where.compteId || where.compteId.in.includes(r.compteId)) &&
        (!where.OR || where.OR.some((o) => o.compteId === r.compteId && o.dateReleve.getTime() === r.dateReleve.getTime())));
    const rapprochementBancaire = {
        findMany: jest.fn(async ({ where, orderBy }) => {
            if (where.lignes)
                return [];
            const lus = retenus(where).map((r) => ({ ...r, soldeReleve: r.soldeReleve ?? 0, clotureAt: r.clotureAt ?? null }));
            if (orderBy?.clotureAt === 'desc')
                lus.sort((a, b) => (b.clotureAt?.getTime() ?? 0) - (a.clotureAt?.getTime() ?? 0));
            return lus;
        }),
        groupBy: jest.fn(async ({ where }) => {
            const max = new Map();
            for (const r of retenus(where)) {
                const m = max.get(r.compteId);
                if (!m || r.dateReleve.getTime() > m.getTime())
                    max.set(r.compteId, r.dateReleve);
            }
            return [...max].map(([compteId, dateReleve]) => ({ compteId, _max: { dateReleve } }));
        }),
    };
    const cloture = {
        findMany: jest.fn(async ({ where }) => (options.clotures ?? []).filter((c) => (c.annuleeAt ?? null) === where.annuleeAt &&
            where.granularite.in.includes(c.granularite) &&
            c.dateLimite >= where.dateLimite.gte &&
            (where.dateLimite.lte === undefined || c.dateLimite <= where.dateLimite.lte))),
    };
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                statut: options.statut ?? client_1.StatutExercice.OUVERT,
                dateDebut: D(options.dateDebut ?? '2026-01-01'),
                dateFin: D(options.dateFin ?? '2026-12-31'),
            }),
        },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel: options.referentiel ?? client_1.Referentiel.SYSCOHADA }) },
        ecriture: { findMany: jest.fn(async ({ cursor }) => (cursor ? [] : ecritures)) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        reevaluation: {
            findMany: jest.fn(async ({ where }) => where.contrePassationDeclaree && !('OR' in where)
                ? (options.declarees ?? [])
                    .filter((d) => !(d.annulee && where.annuleeLe === null))
                    .map((d) => ({
                    ecritureEcarts: { lignes: d.ecritureEcarts.lignes.map((x) => ({ id: x.id, compteId: x.compte.id, debit: x.debit, credit: x.credit, compte: { numero: x.compte.numero } })) },
                    contrePassationDeclaree: {
                        id: d.contrePassationDeclaree.id,
                        lignes: d.contrePassationDeclaree.lignes.map((x) => ({ id: x.id, compteId: x.compte.id, debit: x.debit, credit: x.credit, compte: { numero: x.compte.numero } })),
                    },
                }))
                : where.annulationsContrePassation && options.annulationsContrePassation
                    ? [
                        ...(options.tracesAuDelaDeLaBorne
                            ? Array.from({ length: 50 }, (_, i) => ({ annulationsContrePassation: [{ ecritureId: `autre-${i}` }] }))
                            : []),
                        { annulationsContrePassation: options.annulationsContrePassation },
                    ]
                    : []),
        },
        rapprochementBancaire,
        cloture,
    };
    return { svc: new controles_service_1.ControlesService(prisma), rapprochementBancaire, cloture };
}
describe('la batterie de contrôles · câblage de la ligne A13', () => {
    let maintenant;
    const le = (jour) => maintenant.mockReturnValue(new Date(`${jour}T12:00:00.000Z`).getTime());
    beforeEach(() => {
        maintenant = jest.spyOn(Date, 'now');
    });
    afterEach(() => maintenant.mockRestore());
    const anomalie = async (m, code) => (await m.svc.analyser('t', 'ex')).anomalies.find((a) => a.code === code);
    it('signale le compte de banque à rapprocher avant l’arrêté, jamais le 526', async () => {
        le('2027-01-15');
        const m = monter({ rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-11-30') }] });
        const a = await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE');
        expect(a?.gravite).toBe('AVERTISSEMENT');
        expect(a?.occurrences).toEqual([
            { reference: '52110000 Compte 52110000', detail: 'dernier rapprochement clos au relevé du 2026-11-30', date: '2026-11-30' },
        ]);
        expect(m.rapprochementBancaire.groupBy).toHaveBeenCalledWith({
            by: ['compteId'],
            where: { tenantId: 't', compteId: { in: ['c-52110000'] }, statut: 'CLOTURE' },
            _max: { dateReleve: true },
        });
    });
    it('dit un état à régler avant l’arrêté, jamais un retard (première relecture, a, b, f)', async () => {
        le('2027-01-15');
        const a = await anomalie(monter({}), 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE');
        expect(a?.libelle).toBe("Compte de banque à rapprocher avant l'arrêté des comptes");
        expect(a?.consequence).toContain('AUDCIF, Titre VII, compte 52 ; AUDCIF art. 42');
        expect(a?.consequence).toContain('« doit procéder au recensement et à l\'évaluation de ses biens, créances et dettes » (art. 42)');
        expect(a?.consequence).toContain('dans les quatre mois qui suivent la clôture (AUDCIF art. 23)');
        expect(a?.action).toMatch(/^À rapprocher avant l’arrêté des comptes/);
        expect(a?.action).toContain('Pour un compte en devises, le solde du relevé se compare en francs au cours de clôture');
        expect(a?.action).toContain('Devises et réévaluation');
        expect(`${a?.libelle} ${a?.consequence} ${a?.action}`).not.toMatch(/retard/i);
    });
    it('se tait quand un rapprochement clos atteint la clôture, sans lire aucun solde de relevé', async () => {
        le('2027-01-15');
        const m = monter({ rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-12-31') }] });
        expect(await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE')).toBeUndefined();
        expect(m.rapprochementBancaire.findMany.mock.calls.some(([args]) => 'OR' in args.where)).toBe(false);
    });
    describe('le compte fermé en cours d’exercice (première relecture, B1)', () => {
        const ferme = () => [
            ecriture('e1', 'jBQ', 'BQ', [ligne('1', '52110000', 1000), ligne('2', '70110000', 0, 1000)], { date: '2026-05-10' }),
            ecriture('e2', 'jBQ', 'BQ', [ligne('3', '58500000', 1000), ligne('4', '52110000', 0, 1000)], { date: '2026-06-15' }),
        ];
        it('est couvert par son dernier relevé clos à solde nul, daté au plus tôt de sa dernière opération', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: ferme(),
                rapprochements: [
                    { compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-05-31'), soldeReleve: 1000, clotureAt: D('2026-06-02') },
                    { compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0, clotureAt: D('2026-07-02') },
                ],
            });
            expect(await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE')).toBeUndefined();
            const lecture = m.rapprochementBancaire.findMany.mock.calls.find(([args]) => 'OR' in args.where)[0];
            expect(lecture.where).toEqual({
                tenantId: 't',
                statut: 'CLOTURE',
                OR: [{ compteId: 'c-52110000', dateReleve: D('2026-06-30') }],
            });
        });
        it('reste signalé quand le relevé à solde nul précède la dernière opération', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: ferme(),
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-10'), soldeReleve: 0 }],
            });
            expect((await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE'))?.occurrences).toHaveLength(1);
        });
        it('reste signalé quand le relevé porte un solde, les livres fussent-ils nuls', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: ferme(),
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 300 }],
            });
            expect((await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE'))?.occurrences).toHaveLength(1);
        });
        const fermeEnDevisesPuisReevalue = (autres) => [
            ecriture('e1', 'jBQ', 'BQ', [ligne('1', '52110000', 1000), ligne('2', '70110000', 0, 1000)], { date: '2026-05-10' }),
            ecriture('e2', 'jBQ', 'BQ', [ligne('3', '58500000', 1020), ligne('4', '52110000', 0, 1020)], { date: '2026-06-15' }),
            ecriture('e3', 'jOD', 'OD', [ligne('5', '52110000', 20), ligne('6', '77600000', 0, 20)], { date: '2026-12-31', ...autres }),
        ];
        it('l’écart de conversion du 31/12 ne fait pas d’un compte en devises fermé en juin un compte à rapprocher', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: fermeEnDevisesPuisReevalue({ ecartsDeReevaluation: true }),
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
            });
            expect(await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE')).toBeUndefined();
        });
        it('réévaluation annulée · ni l’écart d’origine ni son négatif ne sont des opérations de banque', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: [
                    ...fermeEnDevisesPuisReevalue({ ecartsDeReevaluation: true }),
                    ecriture('e4', 'jOD', 'OD', [ligne('7', '52110000', 0, 20), ligne('8', '77600000', 20)], { date: '2026-12-31', negatifDEcarts: true }),
                    ecriture('e5', 'jOD', 'OD', [ligne('9', '52110000', 20), ligne('10', '77600000', 0, 20)], { date: '2026-12-31', ecartsDeReevaluation: true }),
                ],
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
            });
            expect(await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE')).toBeUndefined();
        });
        it('m3 · contre-passation annulée (A5 bis, M1) · l’écriture déliée et son négatif, nommés par la trace, ne sont pas des opérations de banque', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: [
                    ...fermeEnDevisesPuisReevalue({ ecartsDeReevaluation: true }),
                    ecriture('e6', 'jOD', 'OD', [ligne('11', '52110000', 0, 20), ligne('12', '77600000', 20)], { date: '2026-12-31' }),
                    ecriture('e7', 'jOD', 'OD', [ligne('13', '52110000', 20), ligne('14', '77600000', 0, 20)], { date: '2026-12-31' }),
                ],
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
                annulationsContrePassation: [{ ecritureId: 'e6', negatifId: 'e7' }],
            });
            expect(await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE')).toBeUndefined();
        });
        it('mineur 3 · au-delà de la borne des traces, la contre-passation annulée redevient une opération · la lecture bornée est DITE', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: [
                    ...fermeEnDevisesPuisReevalue({ ecartsDeReevaluation: true }),
                    ecriture('e6', 'jOD', 'OD', [ligne('11', '52110000', 0, 20), ligne('12', '77600000', 20)], { date: '2026-12-31' }),
                    ecriture('e7', 'jOD', 'OD', [ligne('13', '52110000', 20), ligne('14', '77600000', 0, 20)], { date: '2026-12-31' }),
                ],
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
                annulationsContrePassation: [{ ecritureId: 'e6', negatifId: 'e7' }],
                tracesAuDelaDeLaBorne: true,
            });
            const a = await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE');
            expect(a?.occurrences[0]).toMatchObject({ reference: 'Lecture bornée', detail: expect.stringMatching(/50 réévaluations à contre-passation annulée lues/) });
            expect(a?.occurrences).toHaveLength(2);
        });
        const fermeAvecODDeclaree = () => [
            ecriture('e1', 'jBQ', 'BQ', [ligne('1', '52110000', 1000), ligne('2', '70110000', 0, 1000)], { date: '2026-05-10' }),
            ecriture('e2', 'jBQ', 'BQ', [ligne('3', '58500000', 980), ligne('4', '52110000', 0, 980)], { date: '2026-06-15' }),
            ecriture('od', 'jOD', 'OD', [ligne('5', '47910000', 500), ligne('6', '41110000', 0, 500), ligne('7', '77600000', 20), ligne('8', '52110000', 0, 20)], { date: '2026-07-01' }),
        ];
        const ecartsPasses = { lignes: [ligne('a', '41110000', 500), ligne('b', '47910000', 0, 500), ligne('c', '52110000', 20), ligne('d', '77600000', 0, 20)] };
        it('A5 ter (d) · la ligne de banque d’une OD DÉCLARÉE qui inverse exactement l’écart passé n’est pas une opération de banque', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: fermeAvecODDeclaree(),
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
                declarees: [{ ecritureEcarts: ecartsPasses, contrePassationDeclaree: { id: 'od', lignes: fermeAvecODDeclaree()[2].lignes } }],
            });
            expect(await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE')).toBeUndefined();
        });
        it('A5 ter (d) · jumeau · la même OD NON déclarée, ou d’un autre montant sur la banque, reste une opération · signalée', async () => {
            le('2027-01-15');
            const nonDeclaree = monter({
                ecritures: fermeAvecODDeclaree(),
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
            });
            expect((await anomalie(nonDeclaree, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE'))?.occurrences).toHaveLength(1);
            const autreMontant = { lignes: [...ecartsPasses.lignes.slice(0, 2), ligne('c', '52110000', 25), ligne('d', '77600000', 0, 25)] };
            const melee = monter({
                ecritures: fermeAvecODDeclaree(),
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
                declarees: [{ ecritureEcarts: autreMontant, contrePassationDeclaree: { id: 'od', lignes: fermeAvecODDeclaree()[2].lignes } }],
            });
            expect((await anomalie(melee, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE'))?.occurrences).toHaveLength(1);
        });
        it('A5 ter (d), second tour · LIGNE PAR LIGNE · une vraie opération de banque dans la même OD, sur le même compte, reste une opération', async () => {
            le('2027-01-15');
            const od = [
                ligne('5', '47910000', 500),
                ligne('6', '41110000', 0, 500),
                ligne('7', '77600000', 20),
                ligne('8', '52110000', 0, 20),
                ligne('9', '52110000', 0, 30),
                ligne('10', '58500000', 30),
            ];
            const ecritures = [
                ecriture('e1', 'jBQ', 'BQ', [ligne('1', '52110000', 1000), ligne('2', '70110000', 0, 1000)], { date: '2026-05-10' }),
                ecriture('e2', 'jBQ', 'BQ', [ligne('3', '58500000', 950), ligne('4', '52110000', 0, 950)], { date: '2026-06-15' }),
                ecriture('od', 'jOD', 'OD', od, { date: '2026-07-01' }),
            ];
            const m = monter({
                ecritures,
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
                declarees: [{ ecritureEcarts: ecartsPasses, contrePassationDeclaree: { id: 'od', lignes: od } }],
            });
            expect((await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE'))?.occurrences).toHaveLength(1);
        });
        it('A5 ter (d), second tour · la déclaration d’une réévaluation ANNULÉE n’écarte rien', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: fermeAvecODDeclaree(),
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
                declarees: [{ annulee: true, ecritureEcarts: ecartsPasses, contrePassationDeclaree: { id: 'od', lignes: fermeAvecODDeclaree()[2].lignes } }],
            });
            expect((await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE'))?.occurrences).toHaveLength(1);
        });
        it('jumeau · la même ligne passée à la main, vraie opération de banque après le relevé, reste signalée', async () => {
            le('2027-01-15');
            const m = monter({
                ecritures: fermeEnDevisesPuisReevalue({}),
                rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }],
            });
            expect((await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE'))?.occurrences).toHaveLength(1);
        });
        it('un solde comptable non nul ne fait lire aucun solde de relevé · le compte n’est pas fermé', async () => {
            le('2027-01-15');
            const m = monter({ rapprochements: [{ compteId: 'c-52110000', statut: 'CLOTURE', dateReleve: D('2026-06-30'), soldeReleve: 0 }] });
            expect((await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE'))?.occurrences).toHaveLength(1);
            expect(m.rapprochementBancaire.findMany.mock.calls.some(([args]) => 'OR' in args.where)).toBe(false);
        });
    });
    it('ne lit pas les rapprochements avant le lendemain de la clôture', async () => {
        le('2026-12-31');
        const m = monter({});
        expect(await anomalie(m, 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE')).toBeUndefined();
        expect(m.rapprochementBancaire.groupBy).not.toHaveBeenCalled();
    });
    it('un exercice SYCEBNL d’avant 2024 n’est pas examiné', async () => {
        le('2027-01-15');
        const m = monter({ referentiel: client_1.Referentiel.SYCEBNL, dateDebut: '2023-01-01', dateFin: '2023-12-31' });
        const rapport = await m.svc.analyser('t', 'ex');
        expect(rapport.anomalies.map((a) => a.code)).not.toContain('BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE');
        expect(rapport.anomalies.map((a) => a.code)).not.toContain('CLOTURE_INFORMATIQUE_EN_RETARD');
        expect(m.cloture.findMany).not.toHaveBeenCalled();
    });
    it('chez une association, fiche du 52, AUDCIF art. 42 et AUDCIF art. 22 passent par le chemin du SYCEBNL', async () => {
        le('2027-01-15');
        const m = monter({ referentiel: client_1.Referentiel.SYCEBNL });
        const rapport = await m.svc.analyser('t', 'ex');
        const banque = rapport.anomalies.find((a) => a.code === 'BANQUE_SANS_RAPPROCHEMENT_A_LA_CLOTURE');
        const cloture = rapport.anomalies.find((a) => a.code === 'CLOTURE_INFORMATIQUE_EN_RETARD');
        expect(banque?.consequence).toContain("SYCEBNL, Partie 2 ch. 3, compte 52 ; AUDCIF art. 42, que l'art. 3 de l'Acte uniforme SYCEBNL n'exclut pas");
        expect(cloture?.consequence).toContain("que l'art. 3 de l'Acte uniforme SYCEBNL n'exclut pas");
    });
    it('signale le journal resté ouvert au-delà de l’échéance, et lit les seules clôtures qui figent', async () => {
        le('2027-01-15');
        const m = monter({
            clotures: [
                { granularite: client_1.GranulariteCloture.PERIODE, journalId: null, dateLimite: D('2026-06-30') },
                { granularite: client_1.GranulariteCloture.TOTALE, journalId: 'jBQ', dateLimite: D('2026-09-30') },
                { granularite: client_1.GranulariteCloture.PARTIELLE, journalId: 'jAC', dateLimite: D('2026-12-31') },
            ],
        });
        const a = await anomalie(m, 'CLOTURE_INFORMATIQUE_EN_RETARD');
        expect(a?.gravite).toBe('AVERTISSEMENT');
        expect(a?.occurrences.map((o) => o.reference)).toEqual(['Journal AC']);
        const where = m.cloture.findMany.mock.calls[0][0].where;
        expect(where).toEqual({
            tenantId: 't',
            annuleeAt: null,
            granularite: { in: [client_1.GranulariteCloture.PERIODE, client_1.GranulariteCloture.TOTALE] },
            dateLimite: { gte: D('2026-01-01') },
        });
    });
    it('l’action nomme le rôle, l’effet et la clôture faite ailleurs (première relecture, d, e)', async () => {
        le('2027-01-15');
        const a = await anomalie(monter({}), 'CLOTURE_INFORMATIQUE_EN_RETARD');
        expect(a?.action).toMatch(/^L'administrateur du dossier pose une clôture de période/);
        expect(a?.action).toContain('fige aussi, jusqu\'à sa date, le lettrage et la ventilation analytique');
        expect(a?.action).toContain("faite dans un autre logiciel avant la reprise du dossier n'est pas connue d'OmegaX");
    });
    it('l’à-nouveau provisoire ne fait pas d’un journal un journal écrit (première relecture, i)', async () => {
        le('2026-07-01');
        const m = monter({
            ecritures: [
                ecriture('an', 'jAN', 'AN', [ligne('1', '52110000', 1000), ligne('2', '10100000', 0, 1000)], {
                    date: '2026-01-01',
                    estANouveauProvisoire: true,
                }),
                ecriture('e2', 'jAC', 'AC', [ligne('3', '60100000', 500), ligne('4', '40110000', 0, 500)]),
            ],
        });
        expect((await anomalie(m, 'CLOTURE_INFORMATIQUE_EN_RETARD'))?.occurrences.map((o) => o.reference)).toEqual(['Journal AC']);
    });
    it('un dossier dont seul l’à-nouveau provisoire est écrit ne lit aucune clôture', async () => {
        le('2026-07-01');
        const m = monter({
            ecritures: [
                ecriture('an', 'jAN', 'AN', [ligne('1', '52110000', 1000), ligne('2', '10100000', 0, 1000)], {
                    date: '2026-01-01',
                    estANouveauProvisoire: true,
                }),
            ],
        });
        expect(await anomalie(m, 'CLOTURE_INFORMATIQUE_EN_RETARD')).toBeUndefined();
        expect(m.cloture.findMany).not.toHaveBeenCalled();
    });
    it('une clôture de PÉRIODE posée dans N+1 fige tout N · rien signalé sur N (seconde relecture, B-β)', async () => {
        le('2027-04-15');
        const m = monter({ clotures: [{ granularite: client_1.GranulariteCloture.PERIODE, journalId: null, dateLimite: D('2027-03-31') }] });
        expect(await anomalie(m, 'CLOTURE_INFORMATIQUE_EN_RETARD')).toBeUndefined();
    });
    it('une clôture TOTALE de N+1 fige son seul journal sur N', async () => {
        le('2027-04-15');
        const m = monter({ clotures: [{ granularite: client_1.GranulariteCloture.TOTALE, journalId: 'jBQ', dateLimite: D('2027-02-28') }] });
        expect((await anomalie(m, 'CLOTURE_INFORMATIQUE_EN_RETARD'))?.occurrences.map((o) => o.reference)).toEqual(['Journal AC']);
    });
    it('une clôture annulée ne compte pas', async () => {
        le('2026-10-01');
        const m = monter({
            clotures: [{ granularite: client_1.GranulariteCloture.PERIODE, journalId: null, dateLimite: D('2026-06-30'), annuleeAt: D('2026-07-02') }],
        });
        expect((await anomalie(m, 'CLOTURE_INFORMATIQUE_EN_RETARD'))?.occurrences).toHaveLength(2);
    });
    it('un exercice clôturé fige tout · aucune lecture des clôtures', async () => {
        le('2027-06-15');
        const m = monter({ statut: client_1.StatutExercice.CLOTURE });
        expect(await anomalie(m, 'CLOTURE_INFORMATIQUE_EN_RETARD')).toBeUndefined();
        expect(m.cloture.findMany).not.toHaveBeenCalled();
    });
    it('avant la première échéance, aucune lecture des clôtures', async () => {
        le('2026-06-30');
        const m = monter({});
        expect(await anomalie(m, 'CLOTURE_INFORMATIQUE_EN_RETARD')).toBeUndefined();
        expect(m.cloture.findMany).not.toHaveBeenCalled();
    });
});
describe('virements internes · racines 585 et 588, aux deux plans (fiche du compte 58)', () => {
    it('lit les 585 et 588 des deux semis, jamais les régies et accréditifs du SYSCOHADA', () => {
        const detail58 = (plan) => plan.filter((c) => c.numero.startsWith('58') && c.typeCompte !== client_1.TypeCompteDetailTotal.TOTAL);
        expect(detail58(compte_seed_1.PLAN_COMPTES_SYCEBNL).map((c) => c.numero)).toEqual(['58500000', '58800000']);
        expect(detail58(compte_seed_1.PLAN_COMPTES_SYCEBNL).every((c) => (0, banque_et_cloture_informatique_1.estCompteDeVirementInterne)(c.numero))).toBe(true);
        const syscohada = detail58(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA);
        expect(syscohada.filter((c) => (0, banque_et_cloture_informatique_1.estCompteDeVirementInterne)(c.numero)).map((c) => c.numero)).toEqual(['58500000', '58800000']);
        const ecartes = syscohada.filter((c) => !(0, banque_et_cloture_informatique_1.estCompteDeVirementInterne)(c.numero)).map((c) => c.numero);
        expect(ecartes.length).toBeGreaterThan(0);
        for (const n of ecartes)
            expect(n.startsWith('581') || n.startsWith('582')).toBe(true);
    });
    it('chaque référentiel cite SA fiche', () => {
        expect((0, banque_et_cloture_informatique_1.sourceFicheCompte58)(client_1.Referentiel.SYCEBNL)).toBe('SYCEBNL, Partie 2 ch. 3, compte 58');
        expect((0, banque_et_cloture_informatique_1.sourceFicheCompte58)(client_1.Referentiel.SYSCOHADA)).toBe('AUDCIF, Titre VII, compte 58');
    });
});
describe('virements internes · la règle pure', () => {
    const v = (numero, lj, tout = lj) => ({
        compteId: `c-${numero}`,
        numero,
        intitule: `Compte ${numero}`,
        soldeLivreJournalCentimes: lj,
        soldeToutesLignesCentimes: tout,
    });
    it('se tait jusqu’au jour de clôture compris (§ 10 bis), parle le lendemain', () => {
        expect((0, banque_et_cloture_informatique_1.virementsInternesNonSoldes)([v('58500000', 100_000)], D('2026-12-31'), D('2026-12-31'))).toEqual([]);
        expect((0, banque_et_cloture_informatique_1.virementsInternesNonSoldes)([v('58500000', 100_000)], D('2026-12-31'), D('2027-01-01'))).toHaveLength(1);
    });
    it('un compte soldé au centime ne parle pas ; un 581 jamais', () => {
        expect((0, banque_et_cloture_informatique_1.virementsInternesNonSoldes)([v('58500000', 0), v('58100000', 5_000)], D('2026-12-31'), D('2027-01-15'))).toEqual([]);
    });
    it('nomme le compte, le sens et le montant au livre-journal', () => {
        const r = (0, banque_et_cloture_informatique_1.virementsInternesNonSoldes)([v('58800000', -25_050), v('58500000', 100_000)], D('2026-12-31'), D('2027-01-15'));
        expect(r.map((x) => x.reference)).toEqual(['58500000 Compte 58500000', '58800000 Compte 58800000']);
        expect(r[0].montant).toBe(1000);
        expect(r[0].detail).toMatch(/^solde débiteur de 1\s000,00 au livre-journal au 2026-12-31$/);
        expect(r[1].montant).toBe(-250.5);
        expect(r[1].detail).toMatch(/^solde créditeur de 250,50 au livre-journal/);
    });
    it('le brouillard ne se lit jamais comme validé · les deux soldes sont dits', () => {
        const [a] = (0, banque_et_cloture_informatique_1.virementsInternesNonSoldes)([v('58500000', 100_000, 0)], D('2026-12-31'), D('2027-01-15'));
        expect(a.montant).toBe(1000);
        expect(a.detail).toContain('nul en comptant le brouillard, la pièce qui le solde reste à valider');
        const [b] = (0, banque_et_cloture_informatique_1.virementsInternesNonSoldes)([v('58500000', 0, 30_000)], D('2026-12-31'), D('2027-01-15'));
        expect(b.montant).toBe(0);
        expect(b.detail).toMatch(/^solde nul au livre-journal au 2026-12-31 · débiteur de 300,00 en comptant le brouillard/);
    });
});
describe('la batterie de contrôles · câblage de la ligne A17', () => {
    let maintenant;
    const le = (jour) => maintenant.mockReturnValue(new Date(`${jour}T12:00:00.000Z`).getTime());
    beforeEach(() => {
        maintenant = jest.spyOn(Date, 'now');
    });
    afterEach(() => maintenant.mockRestore());
    const anomalie = async (m, code) => (await m.svc.analyser('t', 'ex')).anomalies.find((a) => a.code === code);
    const CODE = 'VIREMENT_INTERNE_NON_SOLDE_A_LA_CLOTURE';
    const demiVirement = () => [
        ecriture('e1', 'jBQ', 'BQ', [ligne('1', '58500000', 1000), ligne('2', '52110000', 0, 1000)], { date: '2026-12-20' }),
    ];
    for (const referentiel of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
        it(`${referentiel} · signale le 585 non soldé, avec SA fiche`, async () => {
            le('2027-01-15');
            const a = await anomalie(monter({ referentiel, ecritures: demiVirement() }), CODE);
            expect(a?.gravite).toBe('AVERTISSEMENT');
            expect(a?.libelle).toBe('Compte de virements internes non soldé à la clôture');
            expect(a?.consequence).toContain((0, banque_et_cloture_informatique_1.sourceFicheCompte58)(referentiel));
            expect(a?.consequence).toContain('« Il importe de s\'assurer que les comptes 585 et 588 relatifs aux virements internes sont soldés à la fin de l\'exercice »');
            expect(a?.consequence).toContain(referentiel === client_1.Referentiel.SYSCOHADA ? 'En tout état de cause, ces comptes doivent' : 'En tout état de cause ces comptes doivent');
            expect(a?.occurrences).toEqual([
                { reference: '58500000 Compte 58500000', detail: expect.stringContaining('solde débiteur de 1'), montant: 1000 },
            ]);
            expect(`${a?.libelle} ${a?.consequence} ${a?.action}`).not.toMatch(/retard/i);
        });
    }
    it('se tait quand la caisse a reçu l’autre moitié, validée', async () => {
        le('2027-01-15');
        const m = monter({
            ecritures: [
                ...demiVirement(),
                ecriture('e2', 'jCA', 'CA', [ligne('3', '57110000', 1000), ligne('4', '58500000', 0, 1000)], { date: '2026-12-21' }),
            ],
        });
        expect(await anomalie(m, CODE)).toBeUndefined();
    });
    it('parle quand l’autre moitié est au brouillard, et le dit', async () => {
        le('2027-01-15');
        const m = monter({
            ecritures: [
                ...demiVirement(),
                ecriture('e2', 'jCA', 'CA', [ligne('3', '57110000', 1000), ligne('4', '58500000', 0, 1000)], {
                    date: '2026-12-21',
                    statut: 'BROUILLARD',
                }),
            ],
        });
        const a = await anomalie(m, CODE);
        expect(a?.occurrences[0].montant).toBe(1000);
        expect(a?.occurrences[0].detail).toContain('la pièce qui le solde reste à valider');
    });
    it('l’à-nouveau d’un 585 resté ouvert se signale aussi dans N+1', async () => {
        le('2028-01-15');
        const m = monter({
            dateDebut: '2027-01-01',
            dateFin: '2027-12-31',
            ecritures: [
                ecriture('an', 'jAN', 'AN', [ligne('1', '58500000', 1000), ligne('2', '13100000', 0, 1000)], { date: '2027-01-01' }),
            ],
        });
        expect((await anomalie(m, CODE))?.occurrences.map((o) => o.reference)).toEqual(['58500000 Compte 58500000']);
    });
    it('avant le lendemain de la clôture, ou hors du texte, rien', async () => {
        le('2026-12-31');
        expect(await anomalie(monter({ ecritures: demiVirement() }), CODE)).toBeUndefined();
        le('2024-01-15');
        expect(await anomalie(monter({ referentiel: client_1.Referentiel.SYCEBNL, dateDebut: '2023-01-01', dateFin: '2023-12-31', ecritures: demiVirement() }), CODE)).toBeUndefined();
    });
});
//# sourceMappingURL=banque-et-cloture-informatique.spec.js.map