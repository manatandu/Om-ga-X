"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const controles_service_1 = require("./controles.service");
const controles_service_2 = require("./controles.service");
const client_1 = require("@prisma/client");
function ligne(classe, montant, total = false, numero) {
    const parDefaut = {
        [client_1.ClasseCompte.CLASSE_1]: '10100000',
        [client_1.ClasseCompte.CLASSE_2]: '21000000',
        [client_1.ClasseCompte.CLASSE_3]: '31000000',
        [client_1.ClasseCompte.CLASSE_4]: '41100000',
        [client_1.ClasseCompte.CLASSE_5]: '52100000',
        [client_1.ClasseCompte.CLASSE_7]: '70110000',
    };
    const n = numero ?? parDefaut[classe] ?? '60000000';
    return {
        debit: montant.debit ?? 0,
        credit: montant.credit ?? 0,
        estGenereeParCloture: false,
        compte: {
            id: `${n}${total ? '-T' : ''}`,
            numero: n,
            classe,
            typeCompte: total ? client_1.TypeCompteDetailTotal.TOTAL : client_1.TypeCompteDetailTotal.DETAIL,
        },
    };
}
function service(lignes, dossier = {}, dateFinExercice = new Date('2025-12-31')) {
    const groupBy = jest.fn().mockImplementation(({ where }) => {
        const parCompte = new Map();
        for (const l of lignes) {
            if (where.ecriture.estGenereeParCloture === false && l.estGenereeParCloture)
                continue;
            const g = parCompte.get(l.compte.id) ?? { compteId: l.compte.id, _sum: { debit: 0, credit: 0 } };
            g._sum.debit += l.debit;
            g._sum.credit += l.credit;
            parCompte.set(l.compte.id, g);
        }
        return Promise.resolve([...parCompte.values()]);
    });
    const comptes = [...new Map(lignes.map((l) => [l.compte.id, l.compte])).values()];
    const aggregate = jest.fn().mockImplementation(({ where }) => {
        const retenues = lignes.filter((l) => l.compte.numero.startsWith(where.compte.numero.startsWith));
        return Promise.resolve({
            _sum: {
                debit: retenues.reduce((t, l) => t + l.debit, 0),
                credit: retenues.reduce((t, l) => t + l.credit, 0),
            },
        });
    });
    const prisma = {
        ligneEcriture: { groupBy, aggregate },
        compte: { findMany: jest.fn().mockResolvedValue(comptes) },
        tenant: {
            findUniqueOrThrow: jest.fn().mockResolvedValue({
                referentiel: dossier.referentiel ?? client_1.Referentiel.SYCEBNL,
                formeJuridiqueSyscohada: dossier.formeJuridiqueSyscohada ?? null,
                formeJuridiqueSyscohadaAnterieure: dossier.formeJuridiqueSyscohadaAnterieure ?? null,
                dateTransformationForme: dossier.dateTransformationForme ?? null,
            }),
        },
        exercice: {
            findFirst: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.id === 'e1' && where.tenantId === 't1' ? { id: 'e1', dateFin: dateFinExercice } : null)),
        },
    };
    return new controles_service_1.ControlesService(prisma);
}
describe("Seuils de désignation de l'auditeur (SYCEBNL, art. 19)", () => {
    it('ne signale rien sous les trois seuils', async () => {
        const r = await service([
            ligne(client_1.ClasseCompte.CLASSE_5, { debit: 4_000_000 }),
            ligne(client_1.ClasseCompte.CLASSE_7, { credit: 9_000_000 }),
        ]).seuilsAuditeur('t1', 'e1', 3);
        expect(r.franchis).toHaveLength(0);
    });
    it('un total du bilan en FC au-delà du NOMBRE du seuil FCFA n’est PAS dit franchi (O1b-G2)', async () => {
        const r = await service([ligne(client_1.ClasseCompte.CLASSE_2, { debit: controles_service_2.SEUIL_BILAN_AUDITEUR + 1 })]).seuilsAuditeur('t1', 'e1', 0);
        const bilan = r.criteres.find((c) => c.critere === 'Total du bilan');
        expect([bilan.mesure, bilan.franchi, r.obligationDeclenchee]).toEqual([false, false, false]);
        expect(r.nonCompares.map((c) => c.critere)).toEqual(['Total du bilan']);
        expect(r.obligationIndeterminee).toBe(true);
        expect(bilan.detail).toContain('FC (monnaie de tenue)');
        expect(bilan.detail).toContain("l'équivalent dans l'unité monétaire ayant cours légal");
    });
    it('les ressources annuelles ne sont pas comparées non plus', async () => {
        const r = await service([
            ligne(client_1.ClasseCompte.CLASSE_7, { credit: controles_service_2.SEUIL_RESSOURCES_AUDITEUR + 1 }),
        ]).seuilsAuditeur('t1', 'e1', 0);
        expect(r.franchis).toEqual([]);
        expect(r.nonCompares.map((c) => c.critere)).toEqual(['Ressources annuelles']);
    });
    it("signale le franchissement de l'effectif, seul critère hors comptabilité", async () => {
        const r = await service([]).seuilsAuditeur('t1', 'e1', controles_service_2.SEUIL_EFFECTIF_AUDITEUR + 1);
        expect(r.franchis.map((f) => f.critere)).toContain('Effectif permanent');
    });
    it('les critères sont ALTERNATIFS · un seul suffit', async () => {
        const r = await service([]).seuilsAuditeur('t1', 'e1', 25);
        expect(r.franchis).toHaveLength(1);
        expect(r.criteres).toHaveLength(3);
    });
    it('un effectif non renseigné le DIT, au lieu de conclure à zéro', async () => {
        const r = await service([]).seuilsAuditeur('t1', 'e1', 0);
        const effectif = r.criteres.find((c) => c.critere === 'Effectif permanent');
        expect(effectif.franchi).toBe(false);
        expect(effectif.detail).toContain('non renseigné');
    });
    it('ne convertit PAS le seuil en francs congolais · le taux est inconnu du logiciel', async () => {
        const r = await service([]).seuilsAuditeur('t1', 'e1', 0);
        expect(r.conversionAppliquee).toBe(false);
        expect(r.source).toContain('article 19');
    });
    it('additionne les SOLDES par compte, pas les débits ligne à ligne (F8)', async () => {
        const caisse = Array.from({ length: 10 }, () => [
            ligne(client_1.ClasseCompte.CLASSE_5, { debit: 100 }, false, '57110000'),
            ligne(client_1.ClasseCompte.CLASSE_5, { credit: 90 }, false, '57110000'),
        ]).flat();
        const r = await service(caisse).seuilsAuditeur('t1', 'e1', 0);
        expect(['Total du bilan', r.criteres.find((c) => c.critere === 'Total du bilan').valeur]).toEqual(['Total du bilan', 100]);
    });
    it('les ressources d’un exercice clos se lisent hors écriture de clôture (F8)', async () => {
        const produit = ligne(client_1.ClasseCompte.CLASSE_7, { credit: controles_service_2.SEUIL_RESSOURCES_AUDITEUR + 1 });
        const cloture = { ...ligne(client_1.ClasseCompte.CLASSE_7, { debit: controles_service_2.SEUIL_RESSOURCES_AUDITEUR + 1 }), estGenereeParCloture: true };
        const r = await service([produit, cloture]).seuilsAuditeur('t1', 'e1', 0);
        expect(['valeur', r.criteres.find((c) => c.critere === 'Ressources annuelles').valeur]).toEqual(['valeur', controles_service_2.SEUIL_RESSOURCES_AUDITEUR + 1]);
    });
    it('un montant sous le nombre du seuil ne rend pas le verdict indéterminé', async () => {
        const r = await service([ligne(client_1.ClasseCompte.CLASSE_2, { debit: 10 })]).seuilsAuditeur('t1', 'e1', 0);
        expect([r.nonCompares, r.obligationIndeterminee]).toEqual([[], false]);
    });
    it('la lecture est bornée au livre-journal de l’exercice et au dossier', async () => {
        const svc = service([ligne(client_1.ClasseCompte.CLASSE_2, { debit: 10 })]);
        await svc.seuilsAuditeur('t1', 'e1', 0);
        const prisma = svc.prisma;
        expect(prisma.ligneEcriture.groupBy.mock.calls.map((c) => c[0].where)).toEqual([
            { ecriture: { tenantId: 't1', exerciceId: 'e1', statut: 'VALIDEE' } },
            { ecriture: { tenantId: 't1', exerciceId: 'e1', statut: 'VALIDEE', estGenereeParCloture: false } },
        ]);
        expect(prisma.compte.findMany.mock.calls[0][0].where).toEqual({ tenantId: 't1', id: { in: ['21000000'] } });
    });
    it('ignore les comptes de TOTAL · ils agrègent leurs enfants', async () => {
        const r = await service([
            ligne(client_1.ClasseCompte.CLASSE_2, { debit: 60_000_000 }),
            ligne(client_1.ClasseCompte.CLASSE_2, { debit: 60_000_000 }, true),
        ]).seuilsAuditeur('t1', 'e1', 0);
        expect(r.criteres.find((c) => c.critere === 'Total du bilan').valeur).toBe(60_000_000);
        expect(r.franchis).toHaveLength(0);
    });
});
const CA = (montant, numero = '70110000') => ligne(client_1.ClasseCompte.CLASSE_7, { credit: montant }, false, numero);
const BILAN = (montant) => ligne(client_1.ClasseCompte.CLASSE_2, { debit: montant });
const SARL = { referentiel: client_1.Referentiel.SYSCOHADA, formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE };
describe("Désignation du commissaire aux comptes · AUSCGIE, pas SYCEBNL", () => {
    it('une SARL qui franchit UN SEUL seuil n’est PAS tenue de désigner · deux sur trois', async () => {
        const r = await service([BILAN(200_000_000)], SARL).seuilsAuditeur('t1', 'e1', 3);
        expect(r.nonCompares.map((f) => f.critere)).toEqual(['Total du bilan']);
        expect([r.obligationDeclenchee, r.obligationIndeterminee]).toEqual([false, false]);
    });
    it('deux montants FC au-delà des nombres FCFA ne déclenchent RIEN · art. 906 (O1b-A2, G2)', async () => {
        const r = await service([BILAN(200_000_000), CA(300_000_000)], SARL).seuilsAuditeur('t1', 'e1', 3);
        expect(r.obligationDeclenchee).toBe(false);
        expect(r.obligationIndeterminee).toBe(true);
        expect(r.source).toBe('AUSCGIE, article 376');
        expect(r.criteres[0].detail).toContain('article 906');
        expect(r.criteres[0].detail).toContain('30 janvier 2014');
    });
    it('l’effectif, sans unité monétaire, se compare · seul il ne suffit pas à une SARL', async () => {
        const r = await service([], SARL).seuilsAuditeur('t1', 'e1', 51);
        expect(r.franchis.map((c) => c.critere)).toEqual(['Effectif permanent']);
        expect(r.obligationDeclenchee).toBe(false);
        expect(r.obligationIndeterminee).toBe(false);
    });
    it('ses seuils sont ceux de l’AUSCGIE art. 376, pas ceux du SYCEBNL art. 19', async () => {
        const r = await service([], SARL).seuilsAuditeur('t1', 'e1', 0);
        expect(r.criteres.map((c) => c.seuil)).toEqual([125_000_000, 250_000_000, 50]);
        expect(r.criteres.map((c) => c.critere)).toEqual(['Total du bilan', "Chiffre d'affaires annuel", 'Effectif permanent']);
    });
    it('une SNC a ses PROPRES seuils · art. 289-1, plus élevés que la SARL', async () => {
        const r = await service([], {
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF,
        }).seuilsAuditeur('t1', 'e1', 0);
        expect(r.criteres.map((c) => c.seuil)).toEqual([250_000_000, 500_000_000, 50]);
        expect(r.source).toBe('AUSCGIE, article 289-1');
    });
    it('une SCS a les seuils de la SNC · art. 289-1 par le renvoi de l’art. 293-1 (O1a-E1)', async () => {
        const r = await service([], {
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE,
        }).seuilsAuditeur('t1', 'e1', 0);
        expect(r.regle.genre).toBe('DEUX_SUR_TROIS');
        expect(r.criteres.map((c) => c.seuil)).toEqual([250_000_000, 500_000_000, 50]);
        expect(r.source).toBe("AUSCGIE, article 289-1, applicable par l'article 293-1");
    });
    it('une SA est tenue SANS condition de taille · art. 702, aucun seuil à mesurer', async () => {
        const r = await service([BILAN(1)], {
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
        }).seuilsAuditeur('t1', 'e1', 0);
        expect(r.obligationSansSeuil).toBe(true);
        expect(r.criteres).toEqual([]);
        expect(r.source).toBe('AUSCGIE, article 702');
    });
    it('un GIE sans emprunt obligataire ne mesure RIEN · art. 880, le contrôle du contrat', async () => {
        const r = await service([BILAN(900_000_000)], {
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE,
        }).seuilsAuditeur('t1', 'e1', 999);
        expect(r.regle.genre).toBe('AUCUNE_REGLE_LUE');
        expect(r.obligationDeclenchee).toBe(false);
        expect(r.obligationSansSeuil).toBe(false);
        expect(r.criteres).toEqual([]);
        expect(r.regle.genre === 'AUCUNE_REGLE_LUE' && r.regle.motif).toContain('article 880');
    });
    it('un GIE qui porte un solde au 161 doit un commissaire, sans seuil · art. 875 et 880 (O1b-G7)', async () => {
        const r = await service([ligne(client_1.ClasseCompte.CLASSE_1, { credit: 5_000_000 }, false, '16110000')], {
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.GROUPEMENT_INTERET_ECONOMIQUE,
        }).seuilsAuditeur('t1', 'e1', 0);
        expect(r.obligationSansSeuil).toBe(true);
        expect(r.source).toBe('AUSCGIE, articles 875 et 880');
        expect(r.regle.genre === 'TOUJOURS' && r.regle.motif).toContain('six');
    });
    it('une coopérative reçoit l’AUSCOOP art. 121, pas l’AUSCGIE (O6-B2)', async () => {
        const r = await service([BILAN(900_000_000)], {
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE,
        }).seuilsAuditeur('t1', 'e1', 999);
        expect(r.regle.genre).toBe('AUCUNE_REGLE_LUE');
        const motif = r.regle.genre === 'AUCUNE_REGLE_LUE' ? r.regle.motif : '';
        expect(motif).toContain('AUSCOOP, article 121');
        expect(motif).toContain('facultative pour la société coopérative simplifiée');
        expect(r.criteres).toEqual([]);
    });
    it('une forme non renseignée le dit, au lieu de deviner', async () => {
        const r = await service([BILAN(900_000_000)], {
            referentiel: client_1.Referentiel.SYSCOHADA,
            formeJuridiqueSyscohada: null,
        }).seuilsAuditeur('t1', 'e1', 999);
        expect(r.regle.genre).toBe('AUCUNE_REGLE_LUE');
    });
});
describe("Chiffre d'affaires contre ressources · deux mesures différentes", () => {
    it('en SYSCOHADA, seuls les comptes 701 à 707 comptent · pas la classe 7 entière', async () => {
        const r = await service([
            CA(200_000_000),
            CA(100_000_000, '77100000'),
        ], SARL).seuilsAuditeur('t1', 'e1', 0);
        const ca = r.criteres.find((c) => c.critere === "Chiffre d'affaires annuel");
        expect(ca.valeur).toBe(200_000_000);
        expect(r.nonCompares).toEqual([]);
    });
    it('en SYCEBNL, la classe 7 entière compte · ce sont des RESSOURCES, pas un chiffre d’affaires', async () => {
        const r = await service([
            ligne(client_1.ClasseCompte.CLASSE_7, { credit: 150_000_000 }, false, '70110000'),
            ligne(client_1.ClasseCompte.CLASSE_7, { credit: 100_000_000 }, false, '77100000'),
        ]).seuilsAuditeur('t1', 'e1', 0);
        const ressources = r.criteres.find((c) => c.critere === 'Ressources annuelles');
        expect(ressources.valeur).toBe(250_000_000);
        expect(r.obligationIndeterminee).toBe(true);
    });
});
describe('Le planning de clôture nomme les formes et les sanctions (O1a-E1, O1b-G8)', () => {
    const { JALONS_CLOTURE } = require('../exercice/planning-cloture');
    const jalon = (etape) => JALONS_CLOTURE.find((j) => j.etape === etape && j.referentiels?.includes(client_1.Referentiel.SYSCOHADA));
    it('le jalon 18 nomme la SNC et la SCS, par l’art. 289-1 et le renvoi de l’art. 293-1', () => {
        expect(jalon(18).detail).toContain('dans la SNC et la SCS');
        expect(jalon(18).source).toContain('289-1 (SNC) et 293-1 (SCS)');
    });
    it('le jalon 24 cite la sanction pénale de l’art. 890-1', () => {
        expect(jalon(24).source).toContain('art. 890-1');
    });
});
describe('La forme lue est celle de l’EXERCICE, pas celle du jour (AUSCGIE art. 182 et 183)', () => {
    const transformee = {
        referentiel: client_1.Referentiel.SYSCOHADA,
        formeJuridiqueSyscohada: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
        formeJuridiqueSyscohadaAnterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
        dateTransformationForme: new Date('2027-05-15'),
    };
    it('une SARL devenue SA en 2027 n’a pas, pour 2025, de commissaire « sans condition de taille »', async () => {
        const r = await service([], transformee, new Date('2025-12-31')).seuilsAuditeur('t1', 'e1', 0);
        expect(r.regle.genre).not.toBe('TOUJOURS');
        expect(r.obligationSansSeuil).toBe(false);
    });
    it('l’exercice de la transformation suit la nouvelle forme (art. 183 al. 2)', async () => {
        const r = await service([], transformee, new Date('2027-12-31')).seuilsAuditeur('t1', 'e1', 0);
        expect(r.regle.genre).toBe('TOUJOURS');
    });
});
//# sourceMappingURL=seuils-auditeur.spec.js.map