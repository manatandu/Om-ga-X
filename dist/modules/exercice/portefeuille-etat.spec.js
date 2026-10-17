"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const portefeuille_etat_1 = require("./portefeuille-etat");
const exercice_service_1 = require("./exercice.service");
const exercice_controller_1 = require("./exercice.controller");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const jalon = (etape, debut, echeance) => ({
    etape,
    libelle: `Jalon ${etape}`,
    detail: 'Détail.',
    nature: 'LEGALE',
    source: 'Source',
    sanction: null,
    debut: new Date(debut),
    echeance: new Date(echeance),
    enRetard: false,
});
const iso = (d) => (d === null ? null : d.toISOString().slice(0, 10));
const BASE = [
    jalon(13, '2027-03-01', '2027-04-30'),
    jalon(15, '2027-03-01', '2027-04-30'),
    jalon(16, '2027-03-01', '2027-04-30'),
    jalon(17, '2027-03-15', '2027-05-15'),
    jalon(18, '2027-03-01', '2027-05-15'),
    jalon(21, '2027-04-01', '2027-06-30'),
    jalon(23, '2027-04-01', '2027-06-30'),
    jalon(24, '2027-07-01', '2027-07-31'),
    jalon(26, '2027-06-01', '2027-08-31'),
];
const AUJOURDHUI = new Date(Date.UTC(2027, 0, 10));
const FAITS = {
    dateFin: new Date(Date.UTC(2026, 11, 31)),
    forme: client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME,
    commissaireDesigne: null,
    exerciceClos: false,
    dateAssembleeGenerale: null,
    dateDepotEtatsPortefeuille: null,
    dateTransmissionPvPortefeuille: null,
    dateDecisionAffectation: null,
};
const par = (r, etape) => r.find((j) => j.etape === etape);
const pvDe = (r) => r.find((j) => j.libelle.startsWith('Procès-verbal'));
const affectationDe = (r) => r.find((j) => j.libelle.startsWith('Affectation des résultats'));
describe('Entreprise du portefeuille de l’État · O.-L. n° 13/003', () => {
    it('exercice clos au 31 décembre · assemblée au 31 mars, 45 jours francs avant (étapes 17 ET 18) · 13 février, RCCM 30 avril', () => {
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, FAITS, AUJOURDHUI);
        expect(iso(par(r, 21).echeance)).toBe('2027-03-31');
        expect(iso(par(r, 23).echeance)).toBe('2027-03-31');
        expect(par(r, 21).source).toContain('art. 112');
        expect(iso(par(r, 17).echeance)).toBe('2027-02-13');
        expect(iso(par(r, 18).echeance)).toBe('2027-02-13');
        expect(par(r, 17).detail).toContain('quarante-cinq jours francs');
        expect(par(r, 17).detail).toContain('un jour plus tard si le délai n’est pas franc');
        expect(iso(par(r, 24).echeance)).toBe('2027-04-30');
        expect(iso(par(r, 13).echeance)).toBe('2027-02-13');
        expect(iso(par(r, 16).echeance)).toBe('2027-02-13');
        expect(par(r, 16).detail).toContain('quarante-cinq');
        expect(iso(par(r, 15).echeance)).toBe('2027-04-30');
        for (const j of r) {
            if (j.debut && j.echeance)
                expect({ etape: j.etape, ok: j.debut.getTime() <= j.echeance.getTime() }).toEqual({ etape: j.etape, ok: true });
        }
        expect(iso(pvDe(r).echeance)).toBe('2027-04-10');
        expect(pvDe(r).detail).toContain('Au plus tard, faute de date d’assemblée déclarée');
        expect(affectationDe(r).echeance).toBeNull();
        expect(affectationDe(r).enAttente).toBe('En attente du dépôt');
    });
    it('affectation · non calculée dès que le dépôt est possible (exercice clôturé, ou 31 mars passé)', () => {
        const clos = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, exerciceClos: true }, AUJOURDHUI);
        expect(affectationDe(clos).enAttente).toBeUndefined();
        expect(affectationDe(clos).echeance).toBeNull();
        expect(affectationDe(clos).detail).toContain('Échéance non calculée');
        const avril = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, FAITS, new Date(Date.UTC(2027, 3, 1)));
        expect(affectationDe(avril).enAttente).toBeUndefined();
        const trenteEtUn = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, FAITS, new Date(Date.UTC(2027, 2, 31)));
        expect(affectationDe(trenteEtUn).enAttente).toBe('En attente du dépôt');
    });
    it('année bissextile · 14 février ; dix jours calendaires de l’assemblée, soixante du dépôt', () => {
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE.map((j) => ({ ...j, debut: new Date(j.debut.getTime() + 365 * 86_400_000), echeance: new Date(j.echeance.getTime() + 366 * 86_400_000) })), { ...FAITS, dateFin: new Date(Date.UTC(2027, 11, 31)), dateDepotEtatsPortefeuille: new Date(Date.UTC(2028, 2, 1)) }, AUJOURDHUI);
        expect(iso(par(r, 17).echeance)).toBe('2028-02-14');
        expect(iso(affectationDe(r).echeance)).toBe('2028-04-30');
    });
    it('assemblée DÉCLARÉE le 20 mars · étapes 21 et 23 levées (jamais rouges), PV au 30 mars, 45 jours francs avant le 2 février', () => {
        const apres = new Date(Date.UTC(2027, 3, 15));
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)) }, apres);
        for (const e of [21, 23]) {
            expect(par(r, e).observation).toEqual({ libelle: 'Assemblée tenue le 20/03/2027', satisfait: true });
            expect(par(r, e).enRetard).toBe(false);
        }
        expect(iso(pvDe(r).echeance)).toBe('2027-03-30');
        expect(pvDe(r).enRetard).toBe(true);
        expect(iso(par(r, 17).echeance)).toBe('2027-02-02');
        const tard = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 3, 5)) }, apres);
        expect(par(tard, 21).observation).toEqual({
            libelle: 'Assemblée tenue le 05/04/2027, après l’échéance du 31/03/2027',
            satisfait: true,
            horsDelai: true,
        });
        expect(par(tard, 21).enRetard).toBe(false);
    });
    it('assemblée FUTURE · admise pour les délais à rebours, « prévue », elle ne lève rien', () => {
        const mars = new Date(Date.UTC(2027, 2, 1));
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)) }, mars);
        expect(par(r, 21).observation).toEqual({ libelle: 'Assemblée prévue le 20/03/2027', satisfait: false });
        expect(iso(par(r, 17).echeance)).toBe('2027-02-02');
        expect(par(r, 17).detail).toContain('l’assemblée prévue');
        const avril = new Date(Date.UTC(2027, 3, 5));
        const tard = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 3, 20)) }, avril);
        expect(par(tard, 21).observation?.satisfait).toBe(false);
        expect(par(tard, 21).enRetard).toBe(true);
    });
    it('un fait déclaré · la même règle pour tous (tenu, après l’échéance, prévu)', () => {
        const f = { passe: 'Fait tenu', prevu: 'Fait prévu' };
        const ech = new Date(Date.UTC(2027, 2, 31));
        const auj = new Date(Date.UTC(2027, 5, 1));
        expect((0, portefeuille_etat_1.observationDuFait)(f, null, ech, auj)).toBeUndefined();
        expect((0, portefeuille_etat_1.observationDuFait)(f, new Date(Date.UTC(2027, 2, 31)), ech, auj)).toEqual({ libelle: 'Fait tenu le 31/03/2027', satisfait: true });
        expect((0, portefeuille_etat_1.observationDuFait)(f, new Date(Date.UTC(2027, 3, 1)), ech, auj)).toEqual({
            libelle: 'Fait tenu le 01/04/2027, après l’échéance du 31/03/2027',
            satisfait: true,
            horsDelai: true,
        });
        expect((0, portefeuille_etat_1.observationDuFait)(f, auj, null, auj)?.satisfait).toBe(true);
        expect((0, portefeuille_etat_1.observationDuFait)(f, new Date(Date.UTC(2027, 5, 2)), ech, auj)).toEqual({ libelle: 'Fait prévu le 02/06/2027', satisfait: false });
    });
    it('délais forme par forme · l’art. 140 ne vise que SA, SAS et SARL « le cas échéant » ; SNC et SCS · quinze jours (art. 288, 306)', () => {
        const avecAg = { ...FAITS, dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 31)) };
        const sarl = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...avecAg, forme: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE }, AUJOURDHUI);
        for (const e of [17, 18]) {
            expect(par(sarl, e).echeance).toBeNull();
            expect(par(sarl, e).enAttente).toBe('Sans commissaire enregistré');
            expect(par(sarl, e).enRetard).toBe(false);
        }
        expect(iso(par(sarl, 13).echeance)).toBe('2027-03-16');
        expect(par(sarl, 13).source).toContain('art. 345');
        expect(par(sarl, 13).detail).not.toContain('jours francs');
        const sarlCac = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...avecAg, forme: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE, commissaireDesigne: true }, AUJOURDHUI);
        expect(iso(par(sarlCac, 17).echeance)).toBe('2027-02-13');
        expect(iso(par(sarlCac, 13).echeance)).toBe('2027-02-13');
        const snc = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...avecAg, forme: client_1.FormeJuridiqueSyscohada.SOCIETE_NOM_COLLECTIF }, AUJOURDHUI);
        expect(par(snc, 18).enAttente).toBe('Sans commissaire enregistré');
        expect(iso(par(snc, 13).echeance)).toBe('2027-03-15');
        expect(iso(par(snc, 16).echeance)).toBe('2027-03-15');
        expect(par(snc, 16).detail).toContain('quinze jours francs');
        expect(par(snc, 16).source).toContain('art. 288 et 306');
        expect(par(snc, 16).source).not.toContain('art. 140');
        const scs = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...avecAg, forme: client_1.FormeJuridiqueSyscohada.SOCIETE_COMMANDITE_SIMPLE, commissaireDesigne: true }, AUJOURDHUI);
        expect(iso(par(scs, 18).echeance)).toBe('2027-02-13');
        expect(par(scs, 18).source).toContain('AUDCIF, art. 71');
        expect(par(scs, 13).source).not.toContain('AUSCGIE, art. 140');
        for (const r of [sarl, snc, scs])
            expect(iso(par(r, 21).echeance)).toBe('2027-03-31');
    });
    it('JAMAIS UN ROUGE QU’AUCUN GESTE NE LÈVE · PV levé par sa communication déclarée, affectation par la décision enregistrée', () => {
        const tres = new Date(Date.UTC(2027, 11, 1));
        const faits = {
            ...FAITS,
            dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
            dateDepotEtatsPortefeuille: new Date(Date.UTC(2027, 3, 5)),
        };
        const rouge = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, faits, tres);
        expect(pvDe(rouge).enRetard).toBe(true);
        expect(affectationDe(rouge).enRetard).toBe(true);
        const leve = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, {
            ...faits,
            dateTransmissionPvPortefeuille: new Date(Date.UTC(2027, 2, 25)),
            dateDecisionAffectation: new Date(Date.UTC(2027, 4, 20)),
        }, tres);
        expect(pvDe(leve).observation).toEqual({ libelle: 'Procès-verbal communiqué le 25/03/2027', satisfait: true });
        expect(pvDe(leve).enRetard).toBe(false);
        expect(affectationDe(leve).observation).toEqual({ libelle: 'Affectation décidée le 20/05/2027', satisfait: true });
        expect(affectationDe(leve).enRetard).toBe(false);
        const tardifs = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, {
            ...faits,
            dateTransmissionPvPortefeuille: new Date(Date.UTC(2027, 3, 8)),
            dateDecisionAffectation: new Date(Date.UTC(2027, 6, 1)),
        }, tres);
        expect(pvDe(tardifs).observation).toEqual({
            libelle: 'Procès-verbal communiqué le 08/04/2027, après l’échéance du 30/03/2027',
            satisfait: true,
            horsDelai: true,
        });
        expect(affectationDe(tardifs).observation?.horsDelai).toBe(true);
        expect(affectationDe(tardifs).enRetard).toBe(false);
    });
    it('autre clôture · rien n’est calculé, et le jalon le dit ; les six mois restent', () => {
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, dateFin: new Date(Date.UTC(2027, 5, 30)) }, AUJOURDHUI);
        expect(iso(par(r, 21).echeance)).toBe('2027-06-30');
        const dit = r.find((j) => j.libelle.startsWith('Assemblée générale · entreprise du portefeuille'));
        expect(dit.echeance).toBeNull();
        expect(dit.sansDelai).toBe(true);
        expect(dit.detail).toContain('Aucune échéance n’est calculée');
        expect(pvDe(r).echeance).toBeNull();
    });
    it('exercice clos avant le 27 février 2013 (art. 115) · planning inchangé', () => {
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, dateFin: new Date(Date.UTC(2012, 11, 31)) }, AUJOURDHUI);
        expect(r).toBe(BASE);
    });
    it('les dates · route cloisonnée au SYSCOHADA et réservée à l’administrateur, comme l’arrêté des comptes', () => {
        expect(Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, exercice_controller_1.ExerciceController.prototype.declarerDatesPortefeuille)).toEqual([
            client_1.Referentiel.SYSCOHADA,
        ]);
        const roles = (m) => Reflect.getMetadata(roles_decorator_1.ROLES_KEY, exercice_controller_1.ExerciceController.prototype[m]);
        expect(roles('declarerDatesPortefeuille')).toEqual(roles('arreterComptes'));
        expect(roles('declarerFicheR2')).toEqual(roles('arreterComptes'));
        expect(roles('arreterComptes')).toEqual([client_1.RoleUtilisateur.ADMIN_CABINET]);
    });
    it('les dates · un JOUR lu par la règle commune · avant la clôture, hors calendrier, illisible, avec heure refusés', async () => {
        const prisma = {
            exercice: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'e1',
                    tenantId: 't1',
                    dateFin: new Date(Date.UTC(2026, 11, 31)),
                    dateAssembleeGenerale: null,
                    dateTransmissionPvPortefeuille: null,
                }),
                update: jest.fn().mockResolvedValue({}),
            },
        };
        const s = new exercice_service_1.ExerciceService(prisma, {});
        await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '2026-12-15' })).rejects.toThrow(common_1.BadRequestException);
        await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '2027-02-30' })).rejects.toThrow('absente du calendrier');
        await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '20270101' })).rejects.toThrow(common_1.BadRequestException);
        const passe = new exercice_service_1.ExerciceService({
            exercice: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'e0',
                    tenantId: 't1',
                    dateFin: new Date(Date.UTC(2024, 11, 31)),
                    dateAssembleeGenerale: null,
                    dateTransmissionPvPortefeuille: null,
                }),
                update: jest.fn().mockResolvedValue({}),
            },
        }, {});
        await expect(passe.declarerDatesPortefeuille('t1', 'e0', { dateAssembleeGenerale: '2025-03-20', dateTransmissionPvPortefeuille: '2025-03-19' })).rejects.toThrow('ne peut pas précéder celle de l’assemblée');
        await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateDepotEtatsPortefeuille: '2099-01-10' })).rejects.toThrow('à venir ne se déclare pas');
        await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateTransmissionPvPortefeuille: '2099-01-10' })).rejects.toThrow('à venir ne se déclare pas');
        await s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: '2099-03-20' });
        for (const heure of ['2027-03-20T23:30:00-05:00', '2026-10-06T23:30:00Z']) {
            await expect(s.declarerDatesPortefeuille('t1', 'e1', { dateAssembleeGenerale: heure })).rejects.toThrow('format AAAA-MM-JJ');
        }
        await s.declarerDatesPortefeuille('t1', 'e1', {
            dateAssembleeGenerale: '2027-03-20',
            dateDepotEtatsPortefeuille: null,
            dateTransmissionPvPortefeuille: '',
        });
        expect(prisma.exercice.update).toHaveBeenCalledWith({
            where: { id: 'e1' },
            data: {
                dateAssembleeGenerale: new Date(Date.UTC(2027, 2, 20)),
                dateDepotEtatsPortefeuille: null,
                dateTransmissionPvPortefeuille: null,
            },
        });
    });
    it('le planning ne l’applique que sur « oui » déclaré, aux sociétés commerciales du SYSCOHADA ; « pas encore dit » invite à le déclarer', async () => {
        const exercice = {
            id: 'e1',
            tenantId: 't1',
            dateDebut: new Date(Date.UTC(2026, 0, 1)),
            dateFin: new Date(Date.UTC(2026, 11, 31)),
            statut: 'OUVERT',
            dateAssembleeGenerale: null,
            dateDepotEtatsPortefeuille: null,
            dateTransmissionPvPortefeuille: null,
        };
        const planning = async (referentiel, entreprisePortefeuilleEtat, forme = 'SOCIETE_ANONYME', mandats = []) => {
            const prisma = {
                mandatAuditeur: { findMany: jest.fn().mockResolvedValue(mandats) },
                exercice: { findFirst: jest.fn().mockResolvedValue(exercice) },
                tenant: {
                    findUniqueOrThrow: jest.fn().mockResolvedValue({
                        referentiel,
                        formeJuridique: 'ASSOCIATION',
                        formeJuridiqueSyscohada: forme,
                        droitEtranger: false,
                        associeUnique: null,
                        entreprisePortefeuilleEtat,
                    }),
                },
                affectationResultat: { findFirst: jest.fn().mockResolvedValue(null) },
                ecriture: { count: jest.fn().mockResolvedValue(0) },
                transcriptionInventaire: { count: jest.fn().mockResolvedValue(0) },
                rapportActivite: { count: jest.fn().mockResolvedValue(0) },
                donation: { findMany: jest.fn().mockResolvedValue([]) },
            };
            return new exercice_service_1.ExerciceService(prisma, {}).planningCloture('t1', 'e1');
        };
        const pv = (p) => p.jalons.some((j) => j.libelle.startsWith('Procès-verbal à l’Administration des recettes non fiscales'));
        expect(pv(await planning(client_1.Referentiel.SYSCOHADA, true))).toBe(true);
        expect(pv(await planning(client_1.Referentiel.SYSCOHADA, false))).toBe(false);
        expect(pv(await planning(client_1.Referentiel.SYCEBNL, true))).toBe(false);
        expect(pv(await planning(client_1.Referentiel.SYSCOHADA, true, 'ENTREPRENANT'))).toBe(false);
        const nonDit = await planning(client_1.Referentiel.SYSCOHADA, null);
        expect(pv(nonDit)).toBe(false);
        const etape23 = nonDit.jalons.find((j) => j.etape === 23);
        expect(etape23.detail).toContain('PORTEFEUILLE DE L’ÉTAT NON DÉCLARÉ');
        const etape17 = (p) => p.jalons.find((j) => j.etape === 17);
        const sansMandat = await planning(client_1.Referentiel.SYSCOHADA, true, 'SOCIETE_RESPONSABILITE_LIMITEE');
        expect(etape17(sansMandat).enAttente).toBe('Sans commissaire enregistré');
        const avecMandat = await planning(client_1.Referentiel.SYSCOHADA, true, 'SOCIETE_RESPONSABILITE_LIMITEE', [
            { premierExercice: 2025, nombreExercices: 3, refusDeProrogation: false },
        ]);
        expect(iso(etape17(avecMandat).echeance)).toBe('2027-02-13');
    });
});
describe('Dividende prioritaire · entreprise minière du portefeuille', () => {
    const MINIER = {
        ...FAITS,
        secteurMinier: true,
        quotePartEtat: 20,
        sourceQuotePartEtat: 'Registre des titres au 31/12/2026',
        resultatNet: 1_000_000,
    };
    const declarationDe = (r) => r.find((j) => j.libelle.startsWith('Déclaration du dividende'));
    const paiementDe = (r) => r.find((j) => j.libelle.startsWith('Paiement du dividende'));
    it('rien sans le secteur minier DÉCLARÉ · « pas encore dit » ou « non » ne servent aucun jalon', () => {
        for (const secteurMinier of [null, false, undefined]) {
            const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, secteurMinier }, AUJOURDHUI);
            expect(declarationDe(r)).toBeUndefined();
            expect(paiementDe(r)).toBeUndefined();
        }
    });
    it('bénéfice provisoire · 15 mai de l’année qui suit, montant = bénéfice × quote-part, paiement en attente de la note', () => {
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, MINIER, AUJOURDHUI);
        const d = declarationDe(r);
        expect(iso(d.echeance)).toBe('2027-05-15');
        expect(d.montant).toBe(200_000);
        expect(d.etape).toBe(26);
        expect(d.detail).toContain('provisoire');
        expect(d.detail).toContain('Registre des titres au 31/12/2026');
        expect(d.source).toContain('159bis/CAB/MIN/FINANCES/2025');
        const p = paiementDe(r);
        expect(p.echeance).toBeNull();
        expect(p.enAttente).toBe('En attente de la note de perception');
        expect(p.montant).toBe(200_000);
        const rang = (libelle) => r.findIndex((j) => j.libelle.startsWith(libelle));
        expect(rang('Déclaration du dividende')).toBeLessThan(rang('Affectation des résultats'));
        expect(rang('Paiement du dividende')).toBeLessThan(rang('Affectation des résultats'));
    });
    it('sans quote-part · le montant n’est pas calculé (null, jamais zéro) et le détail le dit', () => {
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, quotePartEtat: null, sourceQuotePartEtat: null }, AUJOURDHUI);
        const d = declarationDe(r);
        expect(d.montant).toBeNull();
        expect(d.detail).toContain('Montant non calculé');
        expect(iso(d.echeance)).toBe('2027-05-15');
    });
    it('comptes ARRÊTÉS en perte, exercice non clôturé · aucun dividende, jamais « en retard » (arrêté, art. 2)', () => {
        const apresLe15Mai = new Date(Date.UTC(2027, 5, 20));
        const arretes = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, resultatNet: -50_000, dateArreteComptes: new Date(Date.UTC(2027, 2, 31)) }, apresLe15Mai);
        const d = declarationDe(arretes);
        expect(d.observation).toEqual({ libelle: 'Aucun bénéfice net comptable · aucun dividende prioritaire', satisfait: true });
        expect(d.enRetard).toBe(false);
        const nonArretes = declarationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, resultatNet: -50_000 }, apresLe15Mai));
        expect(nonArretes.enRetard).toBe(true);
        expect(nonArretes.detail).toContain('À vérifier');
    });
    it('la réserve légale passe avant · le détail le dit, l’AUSCGIE primant sur l’arrêté (art. 143, 346, 546)', () => {
        const d = declarationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, MINIER, AUJOURDHUI));
        expect(d.detail).toContain('réserve légale');
        expect(d.detail).toContain('art. 546, 2°');
        expect(d.detail).toContain('ne retranche ni les pertes antérieures ni la réserve légale');
    });
    it('au centime · 1 234 567,89 × 33,3333 %', () => {
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, resultatNet: 1_234_567.89, quotePartEtat: 33.3333 }, AUJOURDHUI);
        expect(declarationDe(r).montant).toBe(411_522.22);
    });
    it('aucun bénéfice · exercice clôturé, constaté (montant 0, aucun paiement) ; exercice ouvert, en attente du résultat', () => {
        const clos = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, exerciceClos: true, resultatNet: -50_000 }, AUJOURDHUI);
        const d = declarationDe(clos);
        expect(d.observation).toEqual({ libelle: 'Aucun bénéfice net comptable · aucun dividende prioritaire', satisfait: true });
        expect(d.montant).toBe(0);
        expect(d.enRetard).toBe(false);
        expect(paiementDe(clos)).toBeUndefined();
        const ouvert = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, resultatNet: 0 }, AUJOURDHUI);
        expect(declarationDe(ouvert).enAttente).toBe('En attente du résultat de l’exercice');
        expect(declarationDe(ouvert).montant).toBeNull();
        expect(declarationDe(ouvert).enRetard).toBe(false);
    });
    it('déclaration et paiement · huit jours CALENDAIRES de la réception de la note ; tardif levé et dit', () => {
        const apres = new Date(Date.UTC(2027, 5, 15));
        const enRetard = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, exerciceClos: true }, apres);
        expect(declarationDe(enRetard).enRetard).toBe(true);
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, {
            ...MINIER,
            exerciceClos: true,
            dateDeclarationDividendeEtat: new Date(Date.UTC(2027, 4, 10)),
            dateNotePerceptionDividende: new Date(Date.UTC(2027, 4, 20)),
            datePaiementDividendeEtat: new Date(Date.UTC(2027, 4, 30)),
        }, apres);
        expect(declarationDe(r).observation).toEqual({ libelle: 'Dividende déclaré le 10/05/2027', satisfait: true });
        const p = paiementDe(r);
        expect(iso(p.echeance)).toBe('2027-05-28');
        expect(p.enAttente).toBeUndefined();
        expect(p.observation).toEqual({
            libelle: 'Dividende payé le 30/05/2027, après l’échéance du 28/05/2027',
            satisfait: true,
            horsDelai: true,
        });
        expect(p.enRetard).toBe(false);
        const sansNote = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, exerciceClos: true, dateDeclarationDividendeEtat: new Date(Date.UTC(2027, 4, 10)) }, apres);
        expect(paiementDe(sansNote).echeance).toBeNull();
        expect(paiementDe(sansNote).enAttente).toBeUndefined();
        expect(paiementDe(sansNote).enRetard).toBe(false);
    });
    it('montant PROVISOIRE sur un exercice ouvert, jamais sur un exercice clôturé', () => {
        const ouvert = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, MINIER, AUJOURDHUI);
        expect(declarationDe(ouvert).montantProvisoire).toBe(true);
        expect(paiementDe(ouvert).montantProvisoire).toBe(true);
        const clos = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, exerciceClos: true }, AUJOURDHUI);
        expect(declarationDe(clos).montantProvisoire).toBeUndefined();
        const sansQuote = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, quotePartEtat: null }, AUJOURDHUI);
        expect(declarationDe(sansQuote).montantProvisoire).toBeUndefined();
    });
    it('exercice ouvert, résultat nul ou négatif · le montant attend le résultat, le 15 mai reste, et passé lui sans déclaration le jalon est en retard', () => {
        const avant = declarationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, resultatNet: -10 }, AUJOURDHUI));
        expect(iso(avant.echeance)).toBe('2027-05-15');
        expect(avant.montantEnAttente).toBe(true);
        expect(avant.montant).toBeNull();
        expect(avant.enRetard).toBe(false);
        const apres = declarationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, resultatNet: -10 }, new Date(Date.UTC(2027, 4, 17))));
        expect(apres.enRetard).toBe(true);
        const declare = declarationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, resultatNet: -10, dateDeclarationDividendeEtat: new Date(Date.UTC(2027, 4, 10)) }, new Date(Date.UTC(2027, 4, 17))));
        expect(declare.enRetard).toBe(false);
    });
    it('le montant est une LECTURE, et la distribution reste soumise à l’AUSCGIE art. 143 et 144', () => {
        const d = declarationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, MINIER, AUJOURDHUI));
        expect(d.detail).toContain('lecture de l’arrêté');
        expect(d.detail).toContain('« taux égal à la quote-part de l’État dans le capital »');
        expect(d.detail).toContain('dividende fictif (art. 144)');
        expect(d.detail).not.toContain('AVERTISSEMENT');
    });
    it('avertit · report à nouveau débiteur, capitaux propres sous le capital (art. 143) ; rien quand le livre-journal ne montre pas de capital', () => {
        const r = (0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, capitauxPropres: { capital: 10_000_000, capitauxPropres: 7_000_000, reportANouveau: -4_000_000 } }, AUJOURDHUI);
        const d = declarationDe(r);
        expect(d.detail).toContain('AVERTISSEMENT · report à nouveau débiteur (4');
        expect(d.detail).toContain('AVERTISSEMENT · capitaux propres (7');
        expect(d.detail).toContain('(AUSCGIE art. 143, dernier alinéa)');
        const sansCapital = declarationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...MINIER, capitauxPropres: { capital: 0, capitauxPropres: -5, reportANouveau: 0 } }, AUJOURDHUI));
        expect(sansCapital.detail).not.toContain('AVERTISSEMENT');
    });
    it('après la dissolution déclarée · aucun dividende, un jalon sans délai dit le boni ou produit de liquidation', () => {
        const r = (0, portefeuille_etat_1.jalonsDividendePrioritaire)({ ...MINIER, dateDissolution: new Date(Date.UTC(2026, 5, 30)) }, AUJOURDHUI);
        expect(r).toHaveLength(1);
        expect(r[0].sansDelai).toBe(true);
        expect(r[0].echeance).toBeNull();
        expect(r[0].montant).toBeUndefined();
        expect(r[0].detail).toContain('boni ou produit de liquidation');
        expect(r[0].source).toContain('loi n° 08/010 du 7 juillet 2008, art. 7');
        expect((0, portefeuille_etat_1.jalonsDividendePrioritaire)({ ...MINIER, dateDissolution: new Date(Date.UTC(2026, 11, 31)) }, AUJOURDHUI)).toHaveLength(2);
    });
    it('portefeuille déclaré, secteur minier « pas encore dit » · l’affectation invite à le déclarer', () => {
        const affectation = affectationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, secteurMinier: null }, AUJOURDHUI));
        expect(affectation.detail).toContain('SECTEUR MINIER NON DÉCLARÉ');
        expect(affectationDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, secteurMinier: false }, AUJOURDHUI)).detail).not.toContain('SECTEUR MINIER NON DÉCLARÉ');
    });
    it('entrée en vigueur à la signature (art. 9) · un 15 mai antérieur au 10 décembre 2025 ne sert rien', () => {
        const r = (0, portefeuille_etat_1.jalonsDividendePrioritaire)({ ...MINIER, dateFin: new Date(Date.UTC(2024, 11, 31)) }, AUJOURDHUI);
        expect(r).toEqual([]);
        expect((0, portefeuille_etat_1.jalonsDividendePrioritaire)({ ...MINIER, dateFin: new Date(Date.UTC(2025, 11, 31)) }, AUJOURDHUI)).toHaveLength(2);
    });
    it('autre clôture · le 15 mai de l’année qui suit la clôture, et le détail dit le silence de l’arrêté', () => {
        const r = (0, portefeuille_etat_1.jalonsDividendePrioritaire)({ ...MINIER, dateFin: new Date(Date.UTC(2026, 5, 30)) }, AUJOURDHUI);
        expect(iso(r[0].echeance)).toBe('2027-05-15');
        expect(r[0].detail).toContain('sans viser la date de clôture');
    });
    it('art. 5 · le PV va aussi au Secrétariat Général du Portefeuille, CA compris, astreinte DITE · borné à l’entrée en vigueur', () => {
        const pv = pvDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, FAITS, AUJOURDHUI));
        expect(pv.detail).toContain('Secrétariat Général du Portefeuille');
        expect(pv.detail).toContain('conseil d’administration');
        expect(pv.detail).toContain('100 USD par jour de retard, qu’OmegaX ne calcule pas');
        expect(pv.source).toContain('art. 1er (point 11) et 5');
        expect(pv.detail).toContain('le cas échéant, à celui que reçoit la Direction générale des impôts');
        const ancien = pvDe((0, portefeuille_etat_1.appliquerPortefeuilleEtat)(BASE, { ...FAITS, dateFin: new Date(Date.UTC(2024, 11, 31)) }, AUJOURDHUI));
        expect(ancien.source).toBe('Ordonnance-loi n° 13/003 du 23 février 2013, art. 112 ; loi n° 08/010 du 7 juillet 2008, art. 3');
    });
    it('les dates du dividende · réservées à l’entreprise minière déclarée, jamais futures, jamais avant la clôture ; l’effacement passe toujours', async () => {
        const exercice = {
            id: 'e1',
            tenantId: 't1',
            dateFin: new Date(Date.UTC(2025, 11, 31)),
            dateAssembleeGenerale: null,
            dateTransmissionPvPortefeuille: null,
        };
        const service = (dossier) => {
            const prisma = {
                exercice: { findFirst: jest.fn().mockResolvedValue(exercice), update: jest.fn().mockResolvedValue({}) },
                tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(dossier) },
            };
            return { prisma, s: new exercice_service_1.ExerciceService(prisma, {}) };
        };
        const nonMinier = service({ entreprisePortefeuilleEtat: true, portefeuilleSecteurMinier: null });
        await expect(nonMinier.s.declarerDatesPortefeuille('t1', 'e1', { dateDeclarationDividendeEtat: '2026-05-10' })).rejects.toThrow('secteur minier');
        await nonMinier.s.declarerDatesPortefeuille('t1', 'e1', { dateDeclarationDividendeEtat: null });
        expect(nonMinier.prisma.exercice.update).toHaveBeenCalledWith({
            where: { id: 'e1' },
            data: { dateDeclarationDividendeEtat: null },
        });
        const minier = service({ entreprisePortefeuilleEtat: true, portefeuilleSecteurMinier: true });
        await expect(minier.s.declarerDatesPortefeuille('t1', 'e1', { datePaiementDividendeEtat: '2099-01-01' })).rejects.toThrow('à venir ne se déclare pas');
        await expect(minier.s.declarerDatesPortefeuille('t1', 'e1', { dateNotePerceptionDividende: '2025-12-15' })).rejects.toThrow('ne peut pas précéder sa clôture');
        await expect(minier.s.declarerDatesPortefeuille('t1', 'e1', {
            dateDeclarationDividendeEtat: '2026-05-10',
            dateNotePerceptionDividende: '2026-05-09',
        })).resolves.toBeDefined();
        await expect(minier.s.declarerDatesPortefeuille('t1', 'e1', {
            dateNotePerceptionDividende: '2026-05-20',
            datePaiementDividendeEtat: '2026-05-19',
        })).rejects.toThrow('ne peut pas précéder la réception de la note de perception');
        await minier.s.declarerDatesPortefeuille('t1', 'e1', {
            dateDeclarationDividendeEtat: '2026-05-10',
            dateNotePerceptionDividende: '2026-05-20',
            datePaiementDividendeEtat: '2026-05-25',
        });
        expect(minier.prisma.exercice.update).toHaveBeenCalledWith({
            where: { id: 'e1' },
            data: {
                dateDeclarationDividendeEtat: new Date(Date.UTC(2026, 4, 10)),
                dateNotePerceptionDividende: new Date(Date.UTC(2026, 4, 20)),
                datePaiementDividendeEtat: new Date(Date.UTC(2026, 4, 25)),
            },
        });
    });
    it('le planning lit le bénéfice sur le LIVRE-JOURNAL, classes 6 à 8, avant le solde des comptes de gestion', async () => {
        const aggregate = jest.fn().mockResolvedValue({ _sum: { debit: 4_000_000, credit: 5_000_000 } });
        const prisma = {
            mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
            exercice: {
                findFirst: jest.fn().mockResolvedValue({
                    id: 'e1',
                    tenantId: 't1',
                    dateDebut: new Date(Date.UTC(2026, 0, 1)),
                    dateFin: new Date(Date.UTC(2026, 11, 31)),
                    statut: 'CLOTURE',
                    dateAssembleeGenerale: null,
                    dateDepotEtatsPortefeuille: null,
                    dateTransmissionPvPortefeuille: null,
                    dateDeclarationDividendeEtat: null,
                    dateNotePerceptionDividende: null,
                    datePaiementDividendeEtat: null,
                }),
            },
            tenant: {
                findUniqueOrThrow: jest.fn().mockResolvedValue({
                    referentiel: client_1.Referentiel.SYSCOHADA,
                    formeJuridique: 'ASSOCIATION',
                    formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
                    droitEtranger: false,
                    associeUnique: null,
                    entreprisePortefeuilleEtat: true,
                    portefeuilleSecteurMinier: true,
                    quotePartEtatCapital: '55.5',
                    sourceQuotePartEtat: 'Statuts',
                    dateDissolution: null,
                }),
            },
            ligneEcriture: { aggregate },
            affectationResultat: { findFirst: jest.fn().mockResolvedValue(null) },
            ecriture: { count: jest.fn().mockResolvedValue(0) },
            transcriptionInventaire: { count: jest.fn().mockResolvedValue(0) },
            rapportActivite: { count: jest.fn().mockResolvedValue(0) },
            donation: { findMany: jest.fn().mockResolvedValue([]) },
        };
        const p = await new exercice_service_1.ExerciceService(prisma, {}).planningCloture('t1', 'e1');
        expect(aggregate).toHaveBeenCalledWith({
            where: {
                compte: { tenantId: 't1', classe: { in: ['CLASSE_6', 'CLASSE_7', 'CLASSE_8'] } },
                ecriture: { tenantId: 't1', exerciceId: 'e1', statut: 'VALIDEE', estSoldeDesComptesDeGestion: false },
            },
            _sum: { debit: true, credit: true },
        });
        const d = p.jalons.find((j) => j.libelle.startsWith('Déclaration du dividende'));
        expect(d.montant).toBe(555_000);
        expect(p.quotePartEtatCapital).toBe(55.5);
        expect(p.portefeuilleSecteurMinier).toBe(true);
    });
});
describe('Capitaux propres lus pour le dividende prioritaire', () => {
    it('la lecture des autres capitaux propres porte le 13, et écarte l’écriture qui solde la gestion', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'exercice.service.ts'), 'utf8');
        const debut = source.indexOf('const [resultat, capital, reportANouveau, autres]');
        expect(debut).toBeGreaterThan(-1);
        const bloc = source.slice(debut, source.indexOf(']);', debut));
        const autres = bloc.split('\n').find((l) => l.includes("'14', '15'"));
        expect(autres).toBeDefined();
        expect(autres).toContain("'13'");
        const lecture = source.slice(source.lastIndexOf('const livreJournal', debut), debut);
        expect(lecture).toContain('estSoldeDesComptesDeGestion: false');
    });
});
//# sourceMappingURL=portefeuille-etat.spec.js.map