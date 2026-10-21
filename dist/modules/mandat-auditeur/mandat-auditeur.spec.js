"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const mandat_auditeur_service_1 = require("./mandat-auditeur.service");
const controles_service_1 = require("../controles/controles.service");
const duree_mandat_1 = require("./duree-mandat");
describe('Durée du mandat · trois textes, trois durées', () => {
    it('SYCEBNL · trois exercices, renouvelables UNE FOIS', () => {
        const d = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYCEBNL, null, 'ASSEMBLEE_GENERALE_ORDINAIRE');
        expect(d.exercices).toBe(3);
        expect(d.mandatsMaximum).toBe(2);
        expect(d.source).toContain('SYCEBNL art. 21');
    });
    it('SA · DEUX exercices par les statuts, SIX par l’assemblée ordinaire', () => {
        const statuts = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, 'STATUTS_OU_AG_CONSTITUTIVE');
        const ago = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, 'ASSEMBLEE_GENERALE_ORDINAIRE');
        expect(statuts.exercices).toBe(2);
        expect(ago.exercices).toBe(6);
        expect(statuts.source).not.toBe(ago.source);
    });
    it('SARL · trois exercices, et AUCUNE limite de renouvellement', () => {
        const d = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, 'ASSOCIES');
        expect(d.exercices).toBe(3);
        expect(d.mandatsMaximum).toBeNull();
        expect(d.source).toContain('AUSCGIE art. 379');
    });
    it('entreprenant · aucune durée lue, et le module le DIT', () => {
        for (const forme of [client_1.FormeJuridiqueSyscohada.ENTREPRENANT]) {
            const d = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, forme, 'ASSEMBLEE_GENERALE_ORDINAIRE');
            expect(d.exercices).toBeNull();
            expect(d.source).toMatch(/aucun texte lu/i);
        }
    });
    it('GIE · six exercices s’il émet des obligations, sinon le contrat · AUSCGIE art. 880 (O1b-G7)', () => {
        const gie = client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE;
        const emetteur = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, gie, 'ASSEMBLEE_GENERALE_ORDINAIRE', true);
        expect([emetteur.exercices, emetteur.source]).toEqual([6, 'AUSCGIE art. 880, quatrième alinéa (GIE émetteur d’obligations)']);
        const inconnu = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, gie, 'ASSEMBLEE_GENERALE_ORDINAIRE');
        expect(inconnu.exercices).toBeNull();
        expect(inconnu.source).toContain('AUSCGIE art. 880');
        expect(inconnu.source).toContain('six exercices');
    });
    it('coopérative · TROIS exercices, AUSCOOP art. 121, al. 2 (constat O6-B1)', () => {
        const d = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE, 'ASSEMBLEE_GENERALE_ORDINAIRE');
        expect([d.exercices, d.mandatsMaximum, d.source]).toEqual([3, null, 'AUSCOOP art. 121, al. 2']);
    });
    it('SNC et SCS · TROIS exercices, par le renvoi de l’art. 289-1 à l’art. 379 (passe O1a, E2)', () => {
        const snc = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF, 'ASSOCIES');
        const scs = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE, 'ASSOCIES');
        expect([snc.exercices, snc.mandatsMaximum, scs.exercices, scs.mandatsMaximum]).toEqual([3, null, 3, null]);
        expect(snc.source).toContain('art. 289-1');
        expect(scs.source).toContain('art. 293-1');
    });
    it('SAS · le renvoi de l’art. 853-3 à l’art. 704, et la lecture qui le rend dite (passe O1b, G1)', () => {
        const sas = client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE;
        const statuts = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, sas, 'STATUTS_OU_AG_CONSTITUTIVE');
        const associes = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, sas, 'ASSOCIES');
        expect([statuts.exercices, associes.exercices]).toEqual([2, 6]);
        expect(statuts.source).toContain('art. 853-3');
        expect(associes.source).toContain('lecture d’OmegaX');
        expect(associes.source).toContain('dans la mesure où');
    });
    it('SA · la juridiction ne donne AUCUNE durée · art. 708 et 730 (passe O1b, E2)', () => {
        const d = (0, duree_mandat_1.dureeMandat)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, 'JURIDICTION');
        expect(d.exercices).toBeNull();
        expect(d.source).toContain('art. 708 et 730');
        expect((0, duree_mandat_1.motifRefusDuree)(client_1.Referentiel.SYSCOHADA, d.exercices, 1)).toBeNull();
    });
    it('SA · refuse les associés et le bailleur, que l’art. 703 ne connaît pas', () => {
        const sa = client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME;
        expect((0, duree_mandat_1.motifRefusOrgane)(client_1.Referentiel.SYSCOHADA, sa, 'ASSOCIES')).toContain('art. 703');
        expect((0, duree_mandat_1.motifRefusOrgane)(client_1.Referentiel.SYSCOHADA, sa, 'BAILLEUR_OU_ETAT')).toContain('art. 703');
        expect((0, duree_mandat_1.motifRefusOrgane)(client_1.Referentiel.SYSCOHADA, sa, 'ASSEMBLEE_GENERALE_ORDINAIRE')).toBeNull();
        expect((0, duree_mandat_1.motifRefusOrgane)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, 'ASSOCIES')).toBeNull();
        expect((0, duree_mandat_1.motifRefusOrgane)(client_1.Referentiel.SYCEBNL, null, 'BAILLEUR_OU_ETAT')).toBeNull();
    });
    it('la prorogation de la SAS vient de l’art. 709 par l’art. 853-3', () => {
        const r = (0, duree_mandat_1.regleDeProrogation)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE);
        expect(r?.source).toBe('AUSCGIE art. 853-3 et 709');
        expect((0, duree_mandat_1.regleDeProrogation)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE)).toBeNull();
    });
    it('la réduction à l’existence de l’entité est PROPRE au SYCEBNL', () => {
        expect([
            (0, duree_mandat_1.motifRefusDuree)(client_1.Referentiel.SYCEBNL, 3, 2),
            (0, duree_mandat_1.motifRefusDuree)(client_1.Referentiel.SYCEBNL, 3, 3),
            (0, duree_mandat_1.motifRefusDuree)(client_1.Referentiel.SYCEBNL, 3, 4),
            (0, duree_mandat_1.motifRefusDuree)(client_1.Referentiel.SYCEBNL, 3, 0),
            (0, duree_mandat_1.motifRefusDuree)(client_1.Referentiel.SYSCOHADA, 3, 2),
        ]).toEqual([null, null, 'au plus 3 exercice(s)', 'au plus 3 exercice(s)', '3 exercice(s)']);
    });
    it('le dernier exercice couvert compte le PREMIER · pas un rang de plus', () => {
        expect((0, duree_mandat_1.dernierExerciceCouvert)(2026, 3)).toBe(2028);
        expect((0, duree_mandat_1.dernierExerciceCouvert)(2026, 1)).toBe(2026);
    });
});
function service(referentiel, formeJuridiqueSyscohada, nbExercices = 5, origines = []) {
    const cree = [];
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't', referentiel, formeJuridiqueSyscohada }) },
        exercice: { count: jest.fn().mockResolvedValue(nbExercices) },
        mandatAuditeur: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest
                .fn()
                .mockImplementation(({ where }) => Promise.resolve(origines.find((o) => o.id === where.id && o.tenantId === where.tenantId) ?? null)),
            create: jest.fn().mockImplementation(({ data }) => {
                cree.push(data);
                return Promise.resolve({ id: 'm1', ...data });
            }),
        },
    };
    return { svc: new mandat_auditeur_service_1.MandatAuditeurService(prisma), cree };
}
const mandatValide = {
    nom: 'Cabinet X',
    inscriptionOrdre: 'ONEC/EC/2019/114',
    organeDesignation: client_1.OrganeDesignationAuditeur.ASSEMBLEE_GENERALE_ORDINAIRE,
    dateDesignation: '2026-06-12',
    premierExercice: 2026,
    nombreExercices: 3,
};
describe('Enregistrement du mandat · ce que les textes refusent', () => {
    it('enregistre un mandat conforme', async () => {
        const { svc, cree } = service(client_1.Referentiel.SYCEBNL, null);
        await svc.enregistrer('t', mandatValide);
        expect(cree[0].nombreExercices).toBe(3);
        expect(cree[0].inscriptionOrdre).toBe('ONEC/EC/2019/114');
    });
    it('REFUSE un auditeur sans référence d’inscription au tableau de l’ordre', async () => {
        const { svc } = service(client_1.Referentiel.SYCEBNL, null);
        await expect(svc.enregistrer('t', { ...mandatValide, inscriptionOrdre: '   ' })).rejects.toThrow(/tableau de l’ordre/i);
        await expect(svc.enregistrer('t', { ...mandatValide, inscriptionOrdre: '' })).rejects.toThrow(/ne vérifie pas|sans la vérifier/i);
    });
    it('REFUSE un TROISIÈME mandat au SYCEBNL · « renouvelables une fois »', async () => {
        const { svc } = service(client_1.Referentiel.SYCEBNL, null);
        await expect(svc.enregistrer('t', { ...mandatValide, rang: 3 })).rejects.toThrow(/renouvelables UNE FOIS/i);
        await expect(svc.enregistrer('t', { ...mandatValide, rang: 2 })).resolves.toBeDefined();
    });
    it('N’INVENTE PAS cette limite pour une SARL', async () => {
        const { svc } = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        await expect(svc.enregistrer('t', {
            ...mandatValide,
            organeDesignation: client_1.OrganeDesignationAuditeur.ASSOCIES,
            rang: 4,
        })).resolves.toBeDefined();
    });
    it('REFUSE une durée que le texte contredit, et LAISSE libre celle qu’aucun texte ne fixe', async () => {
        const sarl = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        await expect(sarl.svc.enregistrer('t', { ...mandatValide, organeDesignation: client_1.OrganeDesignationAuditeur.ASSOCIES, nombreExercices: 6 })).rejects.toThrow(/3 exercice/);
        const gie = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE);
        await expect(gie.svc.enregistrer('t', { ...mandatValide, nombreExercices: 5 })).resolves.toBeDefined();
        const snc = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF);
        await expect(snc.svc.enregistrer('t', { ...mandatValide, nombreExercices: 6 })).rejects.toThrow(/art\. 289-1/);
    });
    it('ne mesure pas l’existence au nombre d’exercices du logiciel (audit final F18)', async () => {
        const { svc, cree } = service(client_1.Referentiel.SYCEBNL, null, 1);
        const proposee = await svc.dureeProposee('t', client_1.OrganeDesignationAuditeur.ASSEMBLEE_GENERALE_ORDINAIRE);
        await svc.enregistrer('t', mandatValide);
        await svc.enregistrer('t', { ...mandatValide, rang: 2, nombreExercices: 2 });
        await expect(svc.enregistrer('t', { ...mandatValide, nombreExercices: 4 })).rejects.toThrow(/au plus 3 exercice/);
        expect({ proposee: [proposee.exercices, proposee.reductionPossible], enregistres: cree.map((m) => m.nombreExercices) }).toEqual({
            proposee: [3, true],
            enregistres: [3, 2],
        });
    });
});
function serviceControles(mandats, formeJuridiqueSyscohada = null, effectifPermanent = 0, actif = 0, referentiel = client_1.Referentiel.SYSCOHADA, obligataire = 0, transformation = null) {
    const groupes = actif ? [{ compteId: 'c521', _sum: { debit: actif, credit: 0 } }] : [];
    const prisma = {
        exercice: {
            findMany: jest.fn().mockResolvedValue([]),
            findFirst: jest.fn().mockResolvedValue({
                id: 'ex',
                dateDebut: new Date('2029-01-01'),
                dateFin: new Date('2029-12-31'),
                dateArreteComptes: new Date('2030-03-31'),
            }),
        },
        tenant: {
            findUniqueOrThrow: jest
                .fn()
                .mockResolvedValue({
                id: 't',
                referentiel,
                formeJuridiqueSyscohada,
                effectifPermanent,
                formeJuridiqueSyscohadaAnterieure: transformation?.anterieure ?? null,
                dateTransformationForme: transformation?.date ?? null,
            }),
        },
        ecriture: { findMany: jest.fn().mockResolvedValue([]) },
        compte: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where?.id?.in?.includes('c521') ? [{ id: 'c521', numero: '52110000', classe: 'CLASSE_5', typeCompte: 'DETAIL' }] : [])),
        },
        ligneEcriture: {
            findMany: jest.fn().mockResolvedValue([]),
            groupBy: jest.fn().mockResolvedValue(groupes),
            aggregate: jest.fn().mockImplementation(({ where }) => Promise.resolve({ _sum: { debit: 0, credit: where.compte.numero.startsWith === '161' ? obligataire : 0 } })),
        },
        exoneration: { findMany: jest.fn().mockResolvedValue([]) },
        manuelProcedures: { findFirst: jest.fn().mockResolvedValue(null) },
        conventionFinancement: { findMany: jest.fn().mockResolvedValue([]) },
        dotationAmortissement: { findMany: jest.fn().mockResolvedValue([]) },
        depreciationImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        reclassementImmobilisation: { findMany: jest.fn().mockResolvedValue([]) },
        amortissementDerogatoire: { findMany: jest.fn().mockResolvedValue([]) },
        clotureLocationAcquisition: { findMany: jest.fn().mockResolvedValue([]) },
        immobilisation: { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue(mandats) },
        reevaluation: { findMany: jest.fn().mockResolvedValue([]) },
        rapprochementBancaire: { findMany: jest.fn().mockResolvedValue([]), groupBy: jest.fn().mockResolvedValue([]) },
    };
    return new controles_service_1.ControlesService(prisma);
}
const anomalie = async (code, mandats) => {
    const rapport = await serviceControles(mandats, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME).analyser('t', 'ex');
    return rapport.anomalies.find((a) => a.code === code);
};
describe('Le contrôle du mandat · et le piège de l’article 22', () => {
    it('signale l’ABSENCE totale de mandat sur un dossier qui en doit un', async () => {
        const a = await anomalie('AUDITEUR_OBLIGATOIRE_SANS_MANDAT', []);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
    });
    it('se TAIT quand un mandat couvre l’exercice', async () => {
        const couvrant = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2027, nombreExercices: 3, refusDeProrogation: false }];
        expect(await anomalie('AUDITEUR_OBLIGATOIRE_SANS_MANDAT', couvrant)).toBeUndefined();
        expect(await anomalie('MANDAT_AUDITEUR_PROROGE', couvrant)).toBeUndefined();
    });
    it('un mandat de SA échu l’an dernier n’est PAS un trou · AUSCGIE art. 709', async () => {
        const echu = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2026, nombreExercices: 3, refusDeProrogation: false }];
        expect(await anomalie('AUDITEUR_OBLIGATOIRE_SANS_MANDAT', echu)).toBeUndefined();
        const a = await anomalie('MANDAT_AUDITEUR_PROROGE', echu);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('INFORMATION');
        expect(a.consequence).toContain('AUSCGIE art. 709');
        expect(a.consequence).not.toContain('SYCEBNL');
    });
    it('une association lit l’art. 22 du SYCEBNL', async () => {
        const echu = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2026, nombreExercices: 3, refusDeProrogation: false }];
        const rapport = await serviceControles(echu, null, 50, 0, client_1.Referentiel.SYCEBNL).analyser('t', 'ex');
        const a = rapport.anomalies.find((x) => x.code === 'MANDAT_AUDITEUR_PROROGE');
        expect(a?.consequence).toContain('SYCEBNL art. 22');
        expect(a?.consequence).toMatch(/PROROGÉE/);
    });
    it('la prorogation ne couvre que l’exercice qui suit · échu depuis trois ans, plus de contrôleur (audit final F69)', async () => {
        const ancien = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2024, nombreExercices: 3, refusDeProrogation: false }];
        expect(await anomalie('MANDAT_AUDITEUR_PROROGE', ancien)).toBeUndefined();
        const a = await anomalie('AUDITEUR_OBLIGATOIRE_SANS_MANDAT', ancien);
        expect(a.occurrences[0].detail).toMatch(/échu avec l’exercice 2026 · la prorogation du AUSCGIE art. 709 ne couvrait que l’exercice suivant/);
    });
    it('une SARL n’a aucune prorogation servie · aucun texte lu ne la lui donne (audit final F69)', async () => {
        const echu = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2026, nombreExercices: 3, refusDeProrogation: false }];
        const rapport = await serviceControles(echu, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, 500, 200_000_000).analyser('t', 'ex');
        expect(rapport.anomalies.some((x) => x.code === 'MANDAT_AUDITEUR_PROROGE')).toBe(false);
    });
    it('la prorogation suit la forme de l’EXERCICE · une SA devenue SARL après lui garde l’art. 709 (AUSCGIE art. 182 et 183)', async () => {
        const echu = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2026, nombreExercices: 3, refusDeProrogation: false }];
        const saDevenueSarl = await serviceControles(echu, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, 0, 0, client_1.Referentiel.SYSCOHADA, 0, {
            anterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
            date: new Date('2030-06-30'),
        }).analyser('t', 'ex');
        expect(saDevenueSarl.anomalies.find((x) => x.code === 'MANDAT_AUDITEUR_PROROGE')?.consequence).toContain('AUSCGIE art. 709');
        const sarlDevenueSa = await serviceControles(echu, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, 0, 0, client_1.Referentiel.SYSCOHADA, 0, {
            anterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            date: new Date('2030-06-30'),
        }).analyser('t', 'ex');
        expect(sarlDevenueSa.anomalies.some((x) => x.code === 'MANDAT_AUDITEUR_PROROGE')).toBe(false);
    });
    it('un GIE émetteur d’obligations, tenu sans seuil, n’a aucune prorogation servie (art. 880, F69)', async () => {
        const echu = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2026, nombreExercices: 3, refusDeProrogation: false }];
        const rapport = await serviceControles(echu, client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE, 0, 0, client_1.Referentiel.SYSCOHADA, 5_000_000).analyser('t', 'ex');
        expect(rapport.anomalies.some((x) => x.code === 'MANDAT_AUDITEUR_PROROGE')).toBe(false);
        const a = rapport.anomalies.find((x) => x.code === 'AUDITEUR_OBLIGATOIRE_SANS_MANDAT');
        expect(a.occurrences[0].detail).toMatch(/aucun texte lu ne proroge le mandat pour cette forme/);
    });
    it('une SARL ne se voit pas opposer un refus de prorogation qu’aucun texte ne lui ouvre (audit final F69)', async () => {
        const refuse = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2026, nombreExercices: 3, refusDeProrogation: true }];
        const rapport = await serviceControles(refuse, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, 500, 200_000_000).analyser('t', 'ex');
        expect(rapport.anomalies.some((x) => x.code === 'MANDAT_AUDITEUR_SANS_PROROGATION')).toBe(false);
    });
    it('une SARL n’est jamais dite tenue sur des montants FC comparés à des seuils FCFA (O1b-A2, F17)', async () => {
        const sarl = (effectif, actif) => serviceControles([], client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, effectif, actif)
            .analyser('t', 'ex')
            .then((r) => [
            r.anomalies.some((a) => a.code === 'AUDITEUR_OBLIGATOIRE_SANS_MANDAT'),
            r.anomalies.some((a) => a.code === 'SEUILS_AUDITEUR_NON_COMPARES'),
        ]);
        expect([await sarl(500, 0), await sarl(500, 200_000_000)]).toEqual([
            [false, false],
            [false, true],
        ]);
    });
    it('les messages AUSCGIE disent la sortie du texte et la sanction de l’art. 897 (O1b-A8, O1b-G8)', async () => {
        const sarl = await serviceControles([], client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, 500, 200_000_000).analyser('t', 'ex');
        const info = sarl.anomalies.find((a) => a.code === 'SEUILS_AUDITEUR_NON_COMPARES');
        expect(info.action).toContain("pendant les deux exercices précédant l'expiration du mandat du commissaire aux comptes");
        expect(info.consequence).toContain("L'article 897 de l'AUSCGIE punit les dirigeants");
        expect(info.consequence).toContain('article 906');
        const sa = await anomalie('COMMISSAIRE_AUX_COMPTES_OBLIGATOIRE', []);
        expect(sa.consequence).toContain("L'article 897 de l'AUSCGIE punit les dirigeants");
    });
    it('SEUL le refus exprès rouvre le trou · l’unique fait que l’art. 709 oppose', async () => {
        const refuse = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2026, nombreExercices: 3, refusDeProrogation: true }];
        const a = await anomalie('MANDAT_AUDITEUR_SANS_PROROGATION', refuse);
        expect(a).toBeDefined();
        expect(a.gravite).toBe('AVERTISSEMENT');
        expect(a.consequence).toContain('AUSCGIE art. 709');
        expect(await anomalie('MANDAT_AUDITEUR_PROROGE', refuse)).toBeUndefined();
    });
});
describe('Inscription au tableau · le texte du dossier, jamais celui de l’autre (passe D3)', () => {
    it('une société lit la loi n° 15/002, art. 59, et une SA l’AUSCGIE art. 695', async () => {
        const sa = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        await expect(sa.svc.enregistrer('t', { ...mandatValide, nombreExercices: 6, inscriptionOrdre: ' ' })).rejects.toThrow(/Loi n° 15\/002, art\. 59 · AUSCGIE art\. 695/);
        expect((0, duree_mandat_1.fondementInscription)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE).source).toBe('Loi n° 15/002, art. 59 · AUSCGIE art. 695, par l’art. 377');
        expect((0, duree_mandat_1.fondementInscription)(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE).source).toBe('Loi n° 15/002, art. 59');
    });
    it('une association garde l’art. 20 du SYCEBNL, sans l’art. 59 du commissaire aux comptes', () => {
        const f = (0, duree_mandat_1.fondementInscription)(client_1.Referentiel.SYCEBNL, null);
        expect(f.source).toBe('SYCEBNL art. 20');
        expect(f.texte).not.toContain('15/002');
    });
    it('la liste des mandats sert le fondement du dossier à l’écran', async () => {
        const { svc } = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        expect((await svc.lister('t')).fondementInscription.source).toContain('AUSCGIE art. 695');
    });
});
describe('Organe et succession du commissaire de SA (passe O1b, E1 et E2)', () => {
    const origine = { id: 'm0', tenantId: 't', premierExercice: 2024, nombreExercices: 6 };
    it('REFUSE à une SA un commissaire désigné par les « associés »', async () => {
        const { svc } = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        await expect(svc.enregistrer('t', { ...mandatValide, organeDesignation: client_1.OrganeDesignationAuditeur.ASSOCIES, nombreExercices: 6 })).rejects.toThrow(/art\. 703/);
    });
    it('accepte un commissaire désigné en justice pour la durée que l’acte fixe', async () => {
        const { svc } = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        await expect(svc.enregistrer('t', { ...mandatValide, organeDesignation: client_1.OrganeDesignationAuditeur.JURIDICTION, nombreExercices: 1 })).resolves.toBeDefined();
    });
    it('le remplaçant ne demeure en fonction que jusqu’à l’expiration du mandat de son prédécesseur (art. 706)', async () => {
        const { svc, cree } = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, 5, [origine]);
        await svc.enregistrer('t', {
            ...mandatValide,
            premierExercice: 2027,
            nombreExercices: 3,
            mandatOrigineId: 'm0',
            natureSuccession: 'REMPLACEMENT',
        });
        expect(cree[0]).toMatchObject({ mandatOrigineId: 'm0', natureSuccession: 'REMPLACEMENT', nombreExercices: 3 });
        await expect(svc.enregistrer('t', {
            ...mandatValide,
            premierExercice: 2027,
            nombreExercices: 6,
            mandatOrigineId: 'm0',
            natureSuccession: 'REMPLACEMENT',
        })).rejects.toThrow(/art\. 706/);
    });
    it('le suppléant exerce au plus jusqu’à l’expiration du mandat empêché (art. 728)', async () => {
        expect((0, duree_mandat_1.motifRefusSuccession)('SUPPLEANT', origine, 2027, 1)).toBeNull();
        expect((0, duree_mandat_1.motifRefusSuccession)('REMPLACEMENT', origine, 2027, 1)).toContain('art. 706');
        expect((0, duree_mandat_1.motifRefusSuccession)('SUPPLEANT', origine, 2027, 4)).toContain('art. 728');
        expect((0, duree_mandat_1.motifRefusSuccession)('REMPLACEMENT', origine, 2031, 1)).toContain('mandat d’origine');
    });
    it('ne l’étend pas à la SARL, et une origine d’un autre dossier n’existe pas', async () => {
        const sarl = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, 5, [origine]);
        await expect(sarl.svc.enregistrer('t', { ...mandatValide, mandatOrigineId: 'm0', natureSuccession: 'REMPLACEMENT' })).rejects.toThrow(/pas étendues à cette forme/);
        const sa = service(client_1.Referentiel.SYSCOHADA, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME, 5, [{ ...origine, tenantId: 'autre' }]);
        await expect(sa.svc.enregistrer('t', { ...mandatValide, premierExercice: 2027, mandatOrigineId: 'm0', natureSuccession: 'REMPLACEMENT' })).rejects.toThrow(/introuvable/);
    });
});
describe('La SAS n’est plus signalée sans contrôleur l’année où sa mission est prorogée (passe O1b, G1)', () => {
    it('un mandat de SAS échu l’an dernier est prorogé par les art. 853-3 et 709', async () => {
        const echu = [{ id: 'm', nom: 'Cabinet X', premierExercice: 2026, nombreExercices: 3, refusDeProrogation: false }];
        const rapport = await serviceControles(echu, client_1.FormeJuridiqueSyscohada.SOCIETE_PAR_ACTIONS_SIMPLIFIEE, 500, 200_000_000).analyser('t', 'ex');
        expect(rapport.anomalies.some((x) => x.code === 'AUDITEUR_OBLIGATOIRE_SANS_MANDAT')).toBe(false);
        expect(rapport.anomalies.find((x) => x.code === 'MANDAT_AUDITEUR_PROROGE')?.consequence).toContain('AUSCGIE art. 853-3 et 709');
    });
});
//# sourceMappingURL=mandat-auditeur.spec.js.map