"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const circularisation_service_1 = require("./circularisation.service");
const EXERCICE = { id: 'ex1', tenantId: 't1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
function honore(where, ligne) {
    return Object.entries(where ?? {}).every(([cle, valeur]) => valeur !== null && typeof valeur === 'object' && 'in' in valeur
        ? (valeur.in ?? []).includes(ligne[cle])
        : ligne[cle] === valeur);
}
function service(etat = {}) {
    const majCampagne = jest.fn().mockImplementation((a) => Promise.resolve({ ...(etat.campagne ?? {}), ...a.data }));
    const majDemande = jest.fn().mockImplementation((a) => Promise.resolve({ id: a.where.id, ...a.data }));
    const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
        compte: { findFirst: jest.fn().mockResolvedValue({ id: 'c1', numero: '40110000' }) },
        campagneCircularisation: {
            findFirst: jest.fn().mockResolvedValue(etat.campagne ?? null),
            create: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'camp1', ...a.data })),
            update: majCampagne,
            updateMany: jest.fn().mockImplementation((a) => {
                const c = etat.campagne;
                if (!c || !honore(a.where, c))
                    return Promise.resolve({ count: 0 });
                Object.assign(c, a.data);
                return Promise.resolve({ count: 1 });
            }),
            findMany: jest.fn().mockResolvedValue([]),
        },
        demandeConfirmation: {
            findFirst: jest.fn().mockResolvedValue(etat.demandes?.[0] ?? null),
            findMany: jest.fn().mockResolvedValue(etat.demandes ?? []),
            create: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'd1', ...a.data })),
            update: majDemande,
            updateMany: jest.fn().mockResolvedValue({ count: (etat.demandes ?? []).length }),
            count: jest.fn().mockResolvedValue((etat.demandes ?? []).length),
        },
        $transaction: jest.fn().mockImplementation((ops) => Promise.all(ops)),
    };
    const ecritures = {
        balance: jest.fn().mockResolvedValue({ lignes: etat.balance ?? [], totaux: { debit: 0, credit: 0 } }),
    };
    return { svc: new circularisation_service_1.CircularisationService(prisma, ecritures), majCampagne, majDemande, prisma };
}
const campagne = (statut, extra = {}) => ({
    id: 'camp1',
    tenantId: 't1',
    exerciceId: 'ex1',
    cycle: client_1.CycleCircularisation.FOURNISSEURS,
    statut,
    ...extra,
});
const demande = (o = {}) => ({
    id: 'd1',
    tenantId: 't1',
    campagneId: 'camp1',
    soldeAConfirmer: 1_000_000,
    statut: client_1.StatutDemandeConfirmation.ENVOYEE,
    proceduresAlternatives: null,
    ecart: null,
    natureEcart: null,
    reponseIndirecte: false,
    campagne: campagne(client_1.StatutCampagneCircularisation.ENVOYEE),
    ...o,
});
describe('forme négative · ISA 505 § 15, quatre conditions cumulatives', () => {
    const base = {
        exerciceId: 'ex1',
        libelle: 'Fournisseurs 2026',
        dateArrete: '2026-12-31',
        cycle: client_1.CycleCircularisation.FOURNISSEURS,
    };
    it('REFUSE la forme négative sans les quatre conditions, et les nomme', async () => {
        const { svc } = service();
        await expect(svc.creer('t1', 'u1', { ...base, forme: client_1.FormeConfirmation.NEGATIVE, conditionsNegativeReunies: [] })).rejects.toThrow(/§ 15/);
    });
    it('REFUSE trois conditions sur quatre · elles sont cumulatives', async () => {
        const { svc } = service();
        await expect(svc.creer('t1', 'u1', {
            ...base,
            forme: client_1.FormeConfirmation.NEGATIVE,
            conditionsNegativeReunies: circularisation_service_1.CircularisationService.CONDITIONS_NEGATIVE.slice(0, 3),
        })).rejects.toThrow(/AUCUNE_RAISON_DE_CROIRE_A_UN_REJET/);
    });
    it('accepte la forme négative quand les quatre sont déclarées', async () => {
        const { svc } = service();
        const c = await svc.creer('t1', 'u1', {
            ...base,
            forme: client_1.FormeConfirmation.NEGATIVE,
            conditionsNegativeReunies: [...circularisation_service_1.CircularisationService.CONDITIONS_NEGATIVE],
        });
        expect(c.forme).toBe(client_1.FormeConfirmation.NEGATIVE);
    });
    it('la forme positive ne demande rien · c’est la plus probante', async () => {
        const { svc } = service();
        const c = await svc.creer('t1', 'u1', base);
        expect(c.forme).toBe(client_1.FormeConfirmation.POSITIVE);
    });
});
describe('dépouillement · l’écart et son investigation', () => {
    it('REFUSE une réponse reçue sans solde confirmé · zéro EST une réponse', async () => {
        const { svc } = service({ demandes: [demande()] });
        await expect(svc.depouiller('t1', 'd1', { statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE })).rejects.toThrow(/zéro EST une réponse/);
    });
    it('accepte un solde confirmé de ZÉRO · « je ne vous dois rien »', async () => {
        const { svc, majDemande } = service({ demandes: [demande()] });
        await svc.depouiller('t1', 'd1', {
            statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE,
            soldeConfirme: 0,
            natureEcart: client_1.NatureEcartConfirmation.ANOMALIE_POTENTIELLE,
            investigation: 'Le fournisseur ne reconnaît aucune dette · facture à retrouver.',
        });
        expect(majDemande.mock.calls[0][0].data.ecart).toBe(-1_000_000);
    });
    it('REFUSE un écart non qualifié · § 14 impose de l’investiguer', async () => {
        const { svc } = service({ demandes: [demande()] });
        await expect(svc.depouiller('t1', 'd1', { statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE, soldeConfirme: 900_000 })).rejects.toThrow(/§ 14/);
    });
    it('REFUSE un écart qualifié sans résultat d’investigation', async () => {
        const { svc } = service({ demandes: [demande()] });
        await expect(svc.depouiller('t1', 'd1', {
            statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE,
            soldeConfirme: 900_000,
            natureEcart: client_1.NatureEcartConfirmation.DELAI,
        })).rejects.toThrow(/investigation/);
    });
    it('laisse passer une réponse SANS écart, sans rien exiger', async () => {
        const { svc, majDemande } = service({ demandes: [demande()] });
        await svc.depouiller('t1', 'd1', {
            statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE,
            soldeConfirme: 1_000_000,
        });
        expect(majDemande.mock.calls[0][0].data).toMatchObject({ ecart: 0, natureEcart: null });
    });
    it('marque le doute quand la réponse est passée par l’entité · § 7 c) et § 10', async () => {
        const { svc, majDemande } = service({ demandes: [demande()] });
        await svc.depouiller('t1', 'd1', {
            statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE,
            soldeConfirme: 1_000_000,
            reponseIndirecte: true,
        });
        expect(majDemande.mock.calls[0][0].data.doutefiabilite).toMatch(/§ 7 c\)/);
    });
    it('efface le solde et l’écart quand la demande bascule en non-réponse', async () => {
        const { svc, majDemande } = service({ demandes: [demande({ soldeConfirme: 900_000, ecart: -100_000 })] });
        await svc.depouiller('t1', 'd1', { statut: client_1.StatutDemandeConfirmation.SANS_REPONSE });
        expect(majDemande.mock.calls[0][0].data).toMatchObject({ soldeConfirme: null, ecart: null, natureEcart: null });
    });
});
describe('clôture · le refus qui donne sa valeur au module', () => {
    it('REFUSE de clore sur une non-réponse sans procédure alternative', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.RELANCEE),
            demandes: [
                demande({ statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE }),
                demande({ id: 'd2', statut: client_1.StatutDemandeConfirmation.SANS_REPONSE }),
            ],
        });
        await expect(svc.clore('t1', 'camp1', 'u1', {})).rejects.toThrow(/§ 12/);
    });
    it('REFUSE aussi sur une lettre revenue NON DISTRIBUÉE · § 6 d) la range en non-réponse', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.RELANCEE),
            demandes: [demande({ statut: client_1.StatutDemandeConfirmation.NON_DISTRIBUEE })],
        });
        await expect(svc.clore('t1', 'camp1', 'u1', {})).rejects.toThrow(/§ 12/);
    });
    it('REFUSE de clore sur une demande restée « envoyée » · ni confirmée ni traitée', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.ENVOYEE),
            demandes: [demande({ statut: client_1.StatutDemandeConfirmation.ENVOYEE })],
        });
        await expect(svc.clore('t1', 'camp1', 'u1', {})).rejects.toThrow(/en attente/);
    });
    it('clôt quand chaque non-réponse porte sa procédure alternative', async () => {
        const { svc, majCampagne } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.RELANCEE),
            demandes: [
                demande({ statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE }),
                demande({
                    id: 'd2',
                    statut: client_1.StatutDemandeConfirmation.SANS_REPONSE,
                    proceduresAlternatives: 'Décaissements postérieurs examinés au 15/02, bons de réception rapprochés.',
                }),
            ],
        });
        await svc.clore('t1', 'camp1', 'u1', {});
        expect(majCampagne.mock.calls[0][0].data.statut).toBe(client_1.StatutCampagneCircularisation.CLOTUREE);
    });
    it('ne consigne des procédures alternatives que sur une non-réponse', async () => {
        const { svc } = service({ demandes: [demande({ statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE })] });
        await expect(svc.consignerProceduresAlternatives('t1', 'd1', { proceduresAlternatives: 'Encaissements postérieurs' })).rejects.toThrow(/NON-RÉPONSE/);
    });
});
describe('échantillon proposé · une matière, pas une sélection', () => {
    it('retient les racines du cycle et écarte les soldes nuls', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.PREPARATION),
            balance: [
                { compteId: 'a', numero: '40110000', intitule: 'Fournisseur A', solde: -3_000_000 },
                { compteId: 'b', numero: '40120000', intitule: 'Fournisseur B', solde: -1_000_000 },
                { compteId: 'c', numero: '40130000', intitule: 'Fournisseur C', solde: 0 },
                { compteId: 'd', numero: '41110000', intitule: 'Client', solde: -9_000_000 },
                { compteId: 'e', numero: '40', intitule: 'Fournisseurs', solde: -4_000_000, typeCompte: 'TOTAL' },
            ],
        });
        const r = await svc.echantillonPropose('t1', 'camp1');
        expect(r.candidats.map((c) => c.numero)).toEqual(['40110000', '40120000']);
        expect(r.totalCycle).toBe(4_000_000);
        expect(r.candidats[0].poids).toBe(75);
    });
    it('classe du plus gros au plus petit, en valeur absolue', async () => {
        const { svc } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.PREPARATION),
            balance: [
                { compteId: 'a', numero: '40110000', intitule: 'A', solde: -100 },
                { compteId: 'b', numero: '40120000', intitule: 'B', solde: -5_000 },
            ],
        });
        const r = await svc.echantillonPropose('t1', 'camp1');
        expect(r.candidats.map((c) => c.numero)).toEqual(['40120000', '40110000']);
    });
    it('les racines suivent le cycle du CPCC', () => {
        expect(circularisation_service_1.CircularisationService.racinesDuCycle(client_1.CycleCircularisation.BANQUES)).toEqual(['52', '53']);
        expect(circularisation_service_1.CircularisationService.racinesDuCycle(client_1.CycleCircularisation.FOURNISSEURS)).toEqual(['40']);
        expect(circularisation_service_1.CircularisationService.racinesDuCycle(client_1.CycleCircularisation.CLIENTS_ADHERENTS)).toEqual(['41']);
        expect(circularisation_service_1.CircularisationService.racinesDuCycle(client_1.CycleCircularisation.AUTRES_TIERS)).toEqual(['42', '43', '44', '47']);
    });
});
describe('synthèse · deux taux qui ne disent pas la même chose', () => {
    const BALANCE_CYCLE = [
        { compteId: 'f1', numero: '40110001', intitule: 'Fournisseur A', solde: -80_000_000 },
        { compteId: 'f2', numero: '40110002', intitule: 'Fournisseur B', solde: -20_000_000 },
        { compteId: 'b1', numero: '52110000', intitule: 'Banque', solde: 500_000_000 },
    ];
    function synthese(demandes) {
        const prisma = {
            campagneCircularisation: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'camp1',
                    exerciceId: 'ex1',
                    cycle: client_1.CycleCircularisation.FOURNISSEURS,
                    dateArrete: new Date('2026-12-31'),
                    demandes,
                }),
            },
        };
        const balance = jest.fn().mockResolvedValue({ lignes: BALANCE_CYCLE, totaux: { debit: 0, credit: 0 } });
        const svc = new circularisation_service_1.CircularisationService(prisma, { balance });
        return { consulter: () => svc.consulter('t1', 'camp1'), balance };
    }
    const d = (id, statut, solde, extra = {}) => ({
        id,
        statut,
        soldeAConfirmer: solde,
        ecart: statut === client_1.StatutDemandeConfirmation.REPONSE_RECUE ? 0 : null,
        natureEcart: null,
        reponseIndirecte: false,
        proceduresAlternatives: null,
        compte: { numero: '40110001', intitule: 'Fournisseur' },
        ...extra,
    });
    it('sépare le taux de réponse du taux de couverture', async () => {
        const { synthese: s } = await synthese([
            d('1', client_1.StatutDemandeConfirmation.REPONSE_RECUE, 80_000_000),
            d('2', client_1.StatutDemandeConfirmation.SANS_REPONSE, 5_000_000, { proceduresAlternatives: 'Encaissements postérieurs' }),
            d('3', client_1.StatutDemandeConfirmation.SANS_REPONSE, 5_000_000),
            d('4', client_1.StatutDemandeConfirmation.NON_DISTRIBUEE, 10_000_000),
        ]).consulter();
        expect(s).toMatchObject({
            envoyees: 4,
            reponses: 1,
            nonReponses: 3,
            nonReponsesSansProcedure: 2,
            tauxReponse: 25,
            tauxCouverture: 80,
            totalCycle: 100_000_000,
        });
    });
    it('le dénominateur est le total du cycle, jamais le solde envoyé (audit final F70)', async () => {
        const { synthese: s } = await synthese([
            d('1', client_1.StatutDemandeConfirmation.REPONSE_RECUE, 1_000_000),
            d('2', client_1.StatutDemandeConfirmation.REPONSE_RECUE, 1_000_000),
        ]).consulter();
        expect([s.tauxReponse, s.tauxCouverture, s.soldeEnvoye]).toEqual([100, 2, 2_000_000]);
    });
    it('une lettre hors du cycle ne couvre rien du cycle', async () => {
        const { synthese: s } = await synthese([
            d('1', client_1.StatutDemandeConfirmation.REPONSE_RECUE, 50_000_000, { compte: { numero: '52110000', intitule: 'Banque' } }),
        ]).consulter();
        expect(s.tauxCouverture).toBe(0);
    });
    it('le total du cycle est lu à la date d’arrêté, sur le livre-journal (audit final F72)', async () => {
        const { consulter, balance } = synthese([]);
        await consulter();
        expect(balance).toHaveBeenCalledWith('t1', 'ex1', false, new Date('2026-12-31'));
    });
});
describe('les demandes · en préparation, une par compte, jamais oubliées (audit final F71)', () => {
    it('refuse une demande ajoutée à une campagne envoyée', async () => {
        const { svc, prisma } = service({ campagne: campagne(client_1.StatutCampagneCircularisation.ENVOYEE) });
        await expect(svc.creerDemande('t1', 'camp1', { compteId: 'c1', destinataire: 'X' })).rejects.toThrow(/PREPARATION/);
        expect(prisma.demandeConfirmation.create).not.toHaveBeenCalled();
    });
    it('refuse une seconde lettre sur le même compte, en nommant la première', async () => {
        const { svc, prisma } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.PREPARATION),
            demandes: [{ destinataire: 'Fournisseur A' }],
        });
        await expect(svc.creerDemande('t1', 'camp1', { compteId: 'c1', destinataire: 'X' })).rejects.toThrow(/40110000 a déjà sa demande dans cette campagne \(Fournisseur A\)/);
        expect(prisma.demandeConfirmation.create).not.toHaveBeenCalled();
    });
    it('la lettre fige le solde à la date d’arrêté', async () => {
        const { svc, prisma } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.PREPARATION, { dateArrete: new Date('2026-06-30') }),
        });
        const balance = jest.fn().mockResolvedValue({ lignes: [], totaux: { debit: 0, credit: 0 } });
        Object.assign(svc, { ecritures: { balance } });
        await svc.creerDemande('t1', 'camp1', { compteId: 'c1', destinataire: 'X' });
        expect(balance).toHaveBeenCalledWith('t1', 'ex1', false, new Date('2026-06-30'));
        expect(prisma.demandeConfirmation.create).toHaveBeenCalled();
    });
    it('refuse de clore sur une demande jamais envoyée', async () => {
        const { svc, majCampagne } = service({
            campagne: campagne(client_1.StatutCampagneCircularisation.DEPOUILLEE),
            demandes: [demande({ statut: client_1.StatutDemandeConfirmation.A_ENVOYER })],
        });
        await expect(svc.clore('t1', 'camp1', 'u1', {})).rejects.toThrow(/jamais envoyée/);
        expect(majCampagne).not.toHaveBeenCalled();
    });
    it('retire une demande qui n’est pas partie, jamais une lettre partie', async () => {
        const aRetirer = service({ demandes: [demande({ statut: client_1.StatutDemandeConfirmation.A_ENVOYER })] });
        const supprimer = jest.fn().mockResolvedValue({});
        Object.assign(aRetirer.prisma.demandeConfirmation, { delete: supprimer });
        await aRetirer.svc.retirerDemande('t1', 'd1');
        expect(supprimer).toHaveBeenCalledWith({ where: { id: 'd1' } });
        const partie = service({ demandes: [demande({ statut: client_1.StatutDemandeConfirmation.ENVOYEE })] });
        const pasSupprimer = jest.fn();
        Object.assign(partie.prisma.demandeConfirmation, { delete: pasSupprimer });
        await expect(partie.svc.retirerDemande('t1', 'd1')).rejects.toThrow(/elle se classe/);
        expect(pasSupprimer).not.toHaveBeenCalled();
    });
    it('une campagne close ne se rouvre pas par le retrait, même d’une lettre restée à envoyer', async () => {
        const close = service({
            demandes: [
                demande({
                    statut: client_1.StatutDemandeConfirmation.A_ENVOYER,
                    campagne: campagne(client_1.StatutCampagneCircularisation.CLOTUREE),
                }),
            ],
        });
        const supprimer = jest.fn();
        Object.assign(close.prisma.demandeConfirmation, { delete: supprimer });
        await expect(close.svc.retirerDemande('t1', 'd1')).rejects.toThrow(/campagne est close/);
        expect(supprimer).not.toHaveBeenCalled();
    });
});
describe('la date d’arrêté tombe dans l’exercice (audit final F72)', () => {
    it('refuse une date hors de l’exercice', async () => {
        const { svc, prisma } = service();
        await expect(svc.creer('t1', 'u1', { exerciceId: 'ex1', libelle: 'X', dateArrete: '2027-03-31', cycle: 'FOURNISSEURS' })).rejects.toThrow(/doit tomber dans l'exercice/);
        expect(prisma.campagneCircularisation.create).not.toHaveBeenCalled();
        await svc.creer('t1', 'u1', { exerciceId: 'ex1', libelle: 'X', dateArrete: '2026-06-30', cycle: 'FOURNISSEURS' });
        expect(prisma.campagneCircularisation.create).toHaveBeenCalled();
    });
});
describe('livre-journal seul · échantillon et lettre (F6)', () => {
    const avecBrouillard = (svc) => {
        const balance = jest.fn().mockImplementation((_t, _ex, inclureBrouillard = true) => Promise.resolve({
            lignes: [{ compteId: 'c1', numero: '40110000', intitule: 'Fournisseur', solde: inclureBrouillard ? -1_500 : -1_000 }],
            totaux: { debit: 0, credit: 0 },
        }));
        Object.assign(svc, { ecritures: { balance } });
    };
    it('la lettre fige le solde du livre-journal, pas celui du brouillard', async () => {
        const { svc, prisma } = service({ campagne: campagne(client_1.StatutCampagneCircularisation.PREPARATION) });
        avecBrouillard(svc);
        await svc.creerDemande('t1', 'camp1', { compteId: 'c1', destinataire: 'Fournisseur' });
        const cree = prisma.demandeConfirmation.create.mock.calls[0][0].data;
        expect(['soldeAConfirmer', cree.soldeAConfirmer]).toEqual(['soldeAConfirmer', -1_000]);
    });
    it('l’échantillon lit la même balance que la lettre', async () => {
        const { svc } = service({ campagne: campagne(client_1.StatutCampagneCircularisation.PREPARATION) });
        avecBrouillard(svc);
        const r = await svc.echantillonPropose('t1', 'camp1');
        expect(['totalCycle', r.totalCycle]).toEqual(['totalCycle', 1_000]);
    });
});
describe('F210 · la campagne dépouillée', () => {
    function banc(statutCampagne, statuts) {
        const c = campagne(statutCampagne);
        const demandes = statuts.map((st, i) => demande({ id: `d${i + 1}`, statut: st, campagne: { ...c } }));
        const etat = { campagne: c, demandes };
        const outils = service(etat);
        const dc = outils.prisma.demandeConfirmation;
        dc.findFirst.mockImplementation((a) => Promise.resolve(demandes.find((d) => honore(a.where, d)) ?? null));
        dc.findMany.mockImplementation((a) => Promise.resolve(demandes.filter((d) => honore(a.where, d))));
        dc.update.mockImplementation((a) => {
            const d = demandes.find((x) => x.id === a.where.id);
            Object.assign(d, a.data);
            return Promise.resolve(d);
        });
        return { ...outils, c, demandes };
    }
    it('dépouillée, c’est chaque lettre classée · et rien à dépouiller n’est pas dépouillé', () => {
        const { REPONSE_RECUE, SANS_REPONSE, NON_DISTRIBUEE, ENVOYEE, RELANCEE, A_ENVOYER } = client_1.StatutDemandeConfirmation;
        expect(circularisation_service_1.CircularisationService.estDepouillee([REPONSE_RECUE, SANS_REPONSE, NON_DISTRIBUEE])).toBe(true);
        expect(circularisation_service_1.CircularisationService.estDepouillee([REPONSE_RECUE, ENVOYEE])).toBe(false);
        expect(circularisation_service_1.CircularisationService.estDepouillee([REPONSE_RECUE, RELANCEE])).toBe(false);
        expect(circularisation_service_1.CircularisationService.estDepouillee([REPONSE_RECUE, A_ENVOYER])).toBe(false);
        expect(circularisation_service_1.CircularisationService.estDepouillee([])).toBe(false);
    });
    it('la dernière lettre classée fait passer la campagne relancée à « dépouillée »', async () => {
        const { svc, c } = banc(client_1.StatutCampagneCircularisation.RELANCEE, [
            client_1.StatutDemandeConfirmation.RELANCEE,
            client_1.StatutDemandeConfirmation.REPONSE_RECUE,
        ]);
        await svc.depouiller('t1', 'd1', { statut: client_1.StatutDemandeConfirmation.SANS_REPONSE });
        expect(c.statut).toBe(client_1.StatutCampagneCircularisation.DEPOUILLEE);
    });
    it('la campagne envoyée aussi, sur une réponse reçue', async () => {
        const { svc, c } = banc(client_1.StatutCampagneCircularisation.ENVOYEE, [client_1.StatutDemandeConfirmation.ENVOYEE]);
        await svc.depouiller('t1', 'd1', {
            statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE,
            soldeConfirme: 1_000_000,
        });
        expect(c.statut).toBe(client_1.StatutCampagneCircularisation.DEPOUILLEE);
    });
    it('tant qu’une lettre attend, la campagne reste où elle est', async () => {
        const { svc, c } = banc(client_1.StatutCampagneCircularisation.ENVOYEE, [
            client_1.StatutDemandeConfirmation.ENVOYEE,
            client_1.StatutDemandeConfirmation.ENVOYEE,
        ]);
        await svc.depouiller('t1', 'd1', { statut: client_1.StatutDemandeConfirmation.NON_DISTRIBUEE });
        expect(c.statut).toBe(client_1.StatutCampagneCircularisation.ENVOYEE);
    });
    it('une campagne close entre-temps ne se rouvre pas', async () => {
        const { svc, c } = banc(client_1.StatutCampagneCircularisation.ENVOYEE, [client_1.StatutDemandeConfirmation.ENVOYEE]);
        c.statut = client_1.StatutCampagneCircularisation.CLOTUREE;
        await svc.depouiller('t1', 'd1', { statut: client_1.StatutDemandeConfirmation.SANS_REPONSE });
        expect(c.statut).toBe(client_1.StatutCampagneCircularisation.CLOTUREE);
    });
    it('le dépouillement ne remet pas une lettre en attente', async () => {
        for (const statut of [
            client_1.StatutDemandeConfirmation.ENVOYEE,
            client_1.StatutDemandeConfirmation.RELANCEE,
            client_1.StatutDemandeConfirmation.A_ENVOYER,
        ]) {
            const { svc, demandes, majDemande } = banc(client_1.StatutCampagneCircularisation.DEPOUILLEE, [
                client_1.StatutDemandeConfirmation.REPONSE_RECUE,
            ]);
            await expect(svc.depouiller('t1', 'd1', { statut })).rejects.toThrow(/lettre partie/);
            expect([statut, demandes[0].statut, majDemande.mock.calls.length]).toEqual([
                statut,
                client_1.StatutDemandeConfirmation.REPONSE_RECUE,
                0,
            ]);
        }
    });
    it('une lettre qui n’est pas partie ne se classe pas en non-réponse', async () => {
        const { svc, majDemande } = banc(client_1.StatutCampagneCircularisation.ENVOYEE, [client_1.StatutDemandeConfirmation.A_ENVOYER]);
        await expect(svc.depouiller('t1', 'd1', { statut: client_1.StatutDemandeConfirmation.SANS_REPONSE })).rejects.toThrow(/pas partie/);
        expect(majDemande).not.toHaveBeenCalled();
    });
    it('une campagne dépouillée se clôt, et ne se relance pas', async () => {
        const { svc, majCampagne } = banc(client_1.StatutCampagneCircularisation.DEPOUILLEE, [
            client_1.StatutDemandeConfirmation.REPONSE_RECUE,
        ]);
        await svc.clore('t1', 'camp1', 'u1', {});
        expect(majCampagne.mock.calls[0][0].data.statut).toBe(client_1.StatutCampagneCircularisation.CLOTUREE);
        const relance = banc(client_1.StatutCampagneCircularisation.DEPOUILLEE, [client_1.StatutDemandeConfirmation.REPONSE_RECUE]);
        await expect(relance.svc.envoyer('t1', 'camp1', {})).rejects.toThrow(/DEPOUILLEE/);
    });
    it('retirer la dernière lettre restée « à envoyer » d’une campagne partie achève son dépouillement', async () => {
        const { svc, c, demandes, prisma } = banc(client_1.StatutCampagneCircularisation.ENVOYEE, [
            client_1.StatutDemandeConfirmation.A_ENVOYER,
            client_1.StatutDemandeConfirmation.REPONSE_RECUE,
        ]);
        Object.assign(prisma.demandeConfirmation, {
            delete: jest.fn().mockImplementation((a) => {
                const i = demandes.findIndex((d) => d.id === a.where.id);
                return Promise.resolve(demandes.splice(i, 1)[0]);
            }),
        });
        await svc.retirerDemande('t1', 'd1');
        expect([demandes.length, c.statut]).toEqual([1, client_1.StatutCampagneCircularisation.DEPOUILLEE]);
    });
    it('une lettre reclassée dans une campagne déjà dépouillée ne réécrit pas la campagne', async () => {
        const { svc, c, prisma } = banc(client_1.StatutCampagneCircularisation.DEPOUILLEE, [
            client_1.StatutDemandeConfirmation.SANS_REPONSE,
        ]);
        await svc.depouiller('t1', 'd1', {
            statut: client_1.StatutDemandeConfirmation.REPONSE_RECUE,
            soldeConfirme: 1_000_000,
        });
        const campagnes = prisma.campagneCircularisation;
        expect([c.statut, campagnes.updateMany.mock.calls.length]).toEqual([client_1.StatutCampagneCircularisation.DEPOUILLEE, 0]);
    });
});
//# sourceMappingURL=circularisation.spec.js.map