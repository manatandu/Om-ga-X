"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const regles_contrat_travail_1 = require("./regles-contrat-travail");
const bareme_smig_1 = require("./bareme-smig");
const EMPLOYEUR = {
    nom: 'ASBL Bomoko',
    numeroAffiliationCnssEmployeur: 'CNSS-EMP-4471',
};
const SALARIE = {
    nom: 'Mukendi',
    postNom: 'Tshibangu',
    prenoms: 'Jean',
    sexe: 'MASCULIN',
    numeroAffiliationCnss: 'CNSS-0099',
    dateNaissance: '1990-04-12',
    millesimeNaissance: null,
    lieuNaissance: 'Mbuji-Mayi',
    nationalite: 'Congolaise',
    nomConjoint: null,
    aptitudeConstateeLe: '2026-01-02',
    enfantsSansDateNaissance: 0,
};
const CONTRAT = {
    type: 'DUREE_INDETERMINEE',
    constateParEcrit: true,
    viseParOnem: true,
    dateEntreeEnVigueur: '2026-01-05',
    dateConclusion: '2026-01-02',
    lieuConclusion: 'Kinshasa',
    dateFinPrevue: null,
    ouvrageDetermine: null,
    motifRemplacement: null,
    emploiPermanent: true,
    natureTravail: 'Comptable',
    lieuExecution: 'Kinshasa, Gombe',
    remunerationBase: 1_200_000,
    avantagesConvenus: 'Transport',
    dureePreavisJours: 14,
    separeDeSaFamille: false,
    manoeuvreSansSpecialite: false,
    clauseEssai: false,
    essaiConstateParEcrit: false,
    essaiDureeJours: null,
    classeProfessionnelle: null,
    periodiciteRemuneration: null,
    deviseRemuneration: 'CDF',
};
describe('article 212 · les quinze énonciations, et pas une de plus', () => {
    it('en porte exactement quinze, numérotées de 1 à 15 sans trou ni doublon', () => {
        expect(regles_contrat_travail_1.ENONCIATIONS_ARTICLE_212).toHaveLength(15);
        expect(regles_contrat_travail_1.ENONCIATIONS_ARTICLE_212.map((e) => e.numero)).toEqual([
            1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        ]);
        expect(new Set(regles_contrat_travail_1.ENONCIATIONS_ARTICLE_212.map((e) => e.point)).size).toBe(15);
        for (const e of regles_contrat_travail_1.ENONCIATIONS_ARTICLE_212)
            expect(e.ou.trim().length).toBeGreaterThan(0);
    });
    it('un dossier complet ne manque de rien', () => {
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, SALARIE, CONTRAT)).toEqual([]);
    });
    it('LE POINT 2 EST DU CÔTÉ DE L’EMPLOYEUR · une fiche parfaite ne suffit pas', () => {
        const manques = (0, regles_contrat_travail_1.mentionsManquantes)({ ...EMPLOYEUR, numeroAffiliationCnssEmployeur: null }, SALARIE, CONTRAT);
        expect(manques.map((m) => m.numero)).toEqual([2]);
        expect(manques[0].ou).toContain('Paramètres du dossier');
    });
    it('LE MILLÉSIME SUFFIT · le point 5 prévoit lui-même la date inconnue', () => {
        const sansDate = { ...SALARIE, dateNaissance: null, millesimeNaissance: 1990 };
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, sansDate, CONTRAT)).toEqual([]);
        const sansRien = { ...SALARIE, dateNaissance: null, millesimeNaissance: null };
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, sansRien, CONTRAT).map((m) => m.numero)).toEqual([5]);
    });
    it('UN CÉLIBATAIRE SANS ENFANT SATISFAIT LE POINT 7', () => {
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, { ...SALARIE, nomConjoint: null }, CONTRAT)).toEqual([]);
    });
    it('un enfant déclaré SANS date de naissance manque au point 7, et le motif le chiffre', () => {
        const manques = (0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, { ...SALARIE, enfantsSansDateNaissance: 2 }, CONTRAT);
        expect(manques.map((m) => m.numero)).toEqual([7]);
        expect(manques[0].motif).toContain('2 enfant(s)');
        expect(manques[0].motif).not.toContain('[object Object]');
    });
    it('UN CDI A UNE DURÉE · le point 11 ne lui réclame pas de date de fin', () => {
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, SALARIE, { ...CONTRAT, dateFinPrevue: null })).toEqual([]);
        const cdd = {
            ...CONTRAT,
            type: 'DUREE_DETERMINEE',
            emploiPermanent: false,
        };
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, SALARIE, cdd).map((m) => m.numero)).toEqual([11]);
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, SALARIE, { ...cdd, ouvrageDetermine: 'Réfection du toit' })).toEqual([]);
    });
    it('rend les manques DANS L’ORDRE DU TEXTE · c’est l’ordre de lecture d’un inspecteur', () => {
        const vide = {
            ...CONTRAT,
            natureTravail: null,
            lieuExecution: null,
            remunerationBase: null,
            dureePreavisJours: null,
            lieuConclusion: null,
        };
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, SALARIE, vide).map((m) => m.numero)).toEqual([
            8, 9, 10, 12, 14,
        ]);
    });
    it('le message de manque cite le texte du point, jamais un code', () => {
        const m = (0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, SALARIE, { ...CONTRAT, natureTravail: null })[0];
        expect(m.motif).toContain('la nature et les modalités du travail à fournir');
        expect(m.motif).toContain("l'article 212");
    });
});
describe('les requalifications de plein droit (art. 40 à 45)', () => {
    const rien = { nombreCdd: 1, nombreRenouvellements: 0 };
    const cdd = {
        ...CONTRAT,
        type: 'DUREE_DETERMINEE',
        emploiPermanent: false,
        dateFinPrevue: '2026-12-31',
    };
    it('un CDI régulier ne requalifie rien', () => {
        expect((0, regles_contrat_travail_1.requalifications)(CONTRAT, rien)).toEqual([]);
    });
    it('SANS ÉCRIT · présumé à durée indéterminée (art. 44), et la présomption est dite réfragable', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({ ...cdd, constateParEcrit: false }, rien);
        expect(r.map((x) => x.motif)).toContain('PAS_D_ECRIT');
        const sans = r.find((x) => x.motif === 'PAS_D_ECRIT');
        expect(sans.formule).toContain("jusqu'à preuve du contraire");
        expect(sans.explication).toContain('preuve contraire');
    });
    it('L’ENGAGEMENT AU JOUR LE JOUR ÉCHAPPE À L’ÉCRIT · l’alinéa 3 l’excepte', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({ ...CONTRAT, type: 'JOUR_LE_JOUR', constateParEcrit: false }, rien);
        expect(r).toEqual([]);
    });
    it('L’APPRENTISSAGE RELÈVE DU TITRE III · les art. 41 et 42 ne le visent pas', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({ ...CONTRAT, type: 'APPRENTISSAGE', constateParEcrit: true, viseParOnem: true, emploiPermanent: true }, { nombreCdd: 5, nombreRenouvellements: 9 });
        expect(r).toEqual([]);
    });
    it('L’APPRENTISSAGE A SES PROPRES PRÉSOMPTIONS · écrit (art. 19 et 23), visa (art. 21), quatre ans (art. 20)', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({
            ...CONTRAT,
            type: 'APPRENTISSAGE',
            constateParEcrit: false,
            viseParOnem: false,
            dateEntreeEnVigueur: '2026-01-05',
            dateFinPrevue: '2030-01-06',
        }, rien);
        expect(r.map((x) => x.motif)).toEqual([
            'APPRENTISSAGE_SANS_ECRIT',
            'APPRENTISSAGE_NON_VISE',
            'APPRENTISSAGE_TROP_LONG',
        ]);
        const visa = r.find((x) => x.motif === 'APPRENTISSAGE_NON_VISE');
        expect(visa.article).toBe('art. 21, alinéa 3');
        expect(visa.formule).toContain('présumés être prestés en exécution d’un contrat de travail'.replace(/’/g, "'"));
        expect(visa.effet).toMatch(/contrat de travail/);
        expect((0, regles_contrat_travail_1.requalifications)({ ...CONTRAT, type: 'APPRENTISSAGE', dateEntreeEnVigueur: '2026-01-05', dateFinPrevue: '2030-01-05' }, rien)).toEqual([]);
    });
    it('L’APPRENTISSAGE ne se voit pas réclamer les quinze énonciations de l’art. 212 (art. 20)', () => {
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, { ...SALARIE, numeroAffiliationCnss: null }, { ...CONTRAT, type: 'APPRENTISSAGE', lieuExecution: null })).toEqual([]);
    });
    it('LE JOUR LE JOUR NON ÉCRIT n’a aucune énonciation de l’art. 212 à porter (art. 44 al. 3)', () => {
        const sansTout = { ...CONTRAT, type: 'JOUR_LE_JOUR', lieuExecution: null, dureePreavisJours: null };
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, SALARIE, { ...sansTout, constateParEcrit: false })).toEqual([]);
        expect((0, regles_contrat_travail_1.mentionsManquantes)(EMPLOYEUR, SALARIE, { ...sansTout, constateParEcrit: true }).map((m) => m.numero)).toEqual([10, 12]);
    });
    it('JOUR LE JOUR · vingt-deux journées en deux mois font du nouvel engagement un CDI (art. 40 al. 2)', () => {
        const jlj = { ...CONTRAT, type: 'JOUR_LE_JOUR', constateParEcrit: false };
        expect((0, regles_contrat_travail_1.requalifications)(jlj, { ...rien, journeesJourLeJour: 21 })).toEqual([]);
        const r = (0, regles_contrat_travail_1.requalifications)(jlj, { ...rien, journeesJourLeJour: 22 });
        expect(r.map((x) => x.motif)).toEqual(['ENGAGEMENT_JOUR_LE_JOUR_REPETE']);
        expect(r[0].formule).toContain('le nouvel engagement conclu, avant l');
        expect((0, regles_contrat_travail_1.requalifications)(jlj, { ...rien, journeesJourLeJour: null })).toEqual([]);
    });
    it('les journées se comptent sur les engagements d’un jour des deux mois de date à date, et s’abstiennent sinon', () => {
        const unJour = (d) => ({ type: 'JOUR_LE_JOUR', dateEntreeEnVigueur: d, dateFin: d });
        const anterieurs = [
            unJour('2026-01-04'),
            unJour('2026-01-05'),
            unJour('2026-02-10'),
            { type: 'DUREE_DETERMINEE', dateEntreeEnVigueur: '2026-02-01', dateFin: null },
            unJour('2026-03-05'),
        ];
        expect((0, regles_contrat_travail_1.journeesJourLeJourAvant)(anterieurs, { dateEntreeEnVigueur: '2026-03-05' })).toBe(2);
        expect((0, regles_contrat_travail_1.journeesJourLeJourAvant)([...anterieurs, { type: 'JOUR_LE_JOUR', dateEntreeEnVigueur: '2026-02-12', dateFin: '2026-02-20' }], { dateEntreeEnVigueur: '2026-03-05' })).toBeNull();
    });
    it('EMPLOI PERMANENT en CDD · réputé conclu pour une durée indéterminée (art. 42)', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({ ...cdd, emploiPermanent: true }, rien);
        expect(r.map((x) => x.motif)).toContain('EMPLOI_PERMANENT');
        expect(r.find((x) => x.motif === 'EMPLOI_PERMANENT').article).toBe('art. 42');
    });
    it('un CDD sans aucune des trois formes de l’art. 40 est réputé à durée indéterminée (art. 45)', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({ ...cdd, dateFinPrevue: null }, rien);
        expect(r.map((x) => x.motif)).toEqual(['CDD_SANS_MENTION_DE_SON_TERME']);
    });
    it('DEUX ANS · le plafond se compte de DATE À DATE, et le contrat ENJAMBE UN 29 FÉVRIER', () => {
        const deuxAnsBissextiles = {
            ...cdd,
            dateEntreeEnVigueur: '2027-01-05',
            dateFinPrevue: '2029-01-05',
        };
        expect((0, regles_contrat_travail_1.joursEntre)(new Date('2027-01-05'), new Date('2029-01-05'))).toBe(731);
        expect((0, regles_contrat_travail_1.requalifications)(deuxAnsBissextiles, rien)).toEqual([]);
        const trop = (0, regles_contrat_travail_1.requalifications)({ ...deuxAnsBissextiles, dateFinPrevue: '2029-01-06' }, rien);
        expect(trop.map((x) => x.motif)).toEqual(['CDD_TROP_LONG']);
        expect(trop[0].formule).toContain('ne peut excéder deux ans');
    });
    it('UN AN · même épreuve, et le motif distingue le travailleur séparé de sa famille', () => {
        const unAnBissextile = {
            ...cdd,
            separeDeSaFamille: true,
            dateEntreeEnVigueur: '2027-06-01',
            dateFinPrevue: '2028-06-01',
        };
        expect((0, regles_contrat_travail_1.joursEntre)(new Date('2027-06-01'), new Date('2028-06-01'))).toBe(366);
        expect((0, regles_contrat_travail_1.requalifications)(unAnBissextile, rien)).toEqual([]);
        const r = (0, regles_contrat_travail_1.requalifications)({ ...unAnBissextile, dateFinPrevue: '2028-06-02' }, rien);
        expect(r.map((x) => x.motif)).toEqual(['CDD_TROP_LONG_SEPARE_DE_SA_FAMILLE']);
        expect(r[0].formule).toContain('ne peut excéder un an');
    });
    it('LA SÉPARATION NE SE DÉDUIT PAS DU CONJOINT · un marié peut vivre avec sa famille', () => {
        expect((0, regles_contrat_travail_1.requalifications)({ ...cdd, separeDeSaFamille: false, dateEntreeEnVigueur: '2026-01-05', dateFinPrevue: '2027-06-30' }, rien)).toEqual([]);
    });
    it('LE TROISIÈME CDD est de plein droit un CDI (art. 41), le deuxième non', () => {
        expect((0, regles_contrat_travail_1.requalifications)(cdd, { nombreCdd: 2, nombreRenouvellements: 0 })).toEqual([]);
        const r = (0, regles_contrat_travail_1.requalifications)(cdd, { nombreCdd: 3, nombreRenouvellements: 0 });
        expect(r.map((x) => x.motif)).toEqual(['TROISIEME_CDD']);
        expect(r[0].explication).toContain('3e contrat');
    });
    it('LE SECOND RENOUVELLEMENT aussi · et l’exception saisonnière n’est jamais déduite', () => {
        expect((0, regles_contrat_travail_1.requalifications)(cdd, { nombreCdd: 1, nombreRenouvellements: 1 })).toEqual([]);
        const r = (0, regles_contrat_travail_1.requalifications)(cdd, { nombreCdd: 1, nombreRenouvellements: 2 });
        expect(r.map((x) => x.motif)).toEqual(['SECOND_RENOUVELLEMENT']);
        expect(r[0].explication).toContain("n'est pas déduite");
        expect(r[0].explication).toMatch(/exceptés par la loi elle-même/);
        expect(r[0].reserve).toBeNull();
    });
    it('l’art. 41 al. 2 est cité EN ENTIER, exception comprise, dans les deux requalifications', () => {
        expect(regles_contrat_travail_1.FORMULE_ARTICLE_41_ALINEAS_2_ET_3).toContain('sauf dans le cas d');
        const r = (0, regles_contrat_travail_1.requalifications)(cdd, { nombreCdd: 3, nombreRenouvellements: 2 });
        for (const x of r)
            expect(x.formule).toContain("d'ouvrages bien définis");
    });
    it('un ouvrage déterminé met la requalification de l’art. 41 SOUS RÉSERVE de l’exception', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({ ...cdd, ouvrageDetermine: 'Construction du puits de Kimpese' }, { nombreCdd: 3, nombreRenouvellements: 2 });
        expect(r.map((x) => x.motif)).toEqual(['TROISIEME_CDD', 'SECOND_RENOUVELLEMENT']);
        for (const x of r) {
            expect(x.reserve).toMatch(/ouvrage bien défini/);
            expect(x.effet).toMatch(/sous réserve/);
        }
    });
    it('cumule les motifs sans en perdre · un contrat peut violer plusieurs articles', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({ ...cdd, constateParEcrit: false, emploiPermanent: true, dateFinPrevue: null }, { nombreCdd: 4, nombreRenouvellements: 3 });
        expect(r.map((x) => x.motif).sort()).toEqual([
            'CDD_SANS_MENTION_DE_SON_TERME',
            'EMPLOI_PERMANENT',
            'PAS_D_ECRIT',
            'SECOND_RENOUVELLEMENT',
            'TROISIEME_CDD',
        ].sort());
    });
    it('chaque requalification porte son article ET la formule du texte', () => {
        const r = (0, regles_contrat_travail_1.requalifications)({ ...cdd, constateParEcrit: false, emploiPermanent: true, dateFinPrevue: null }, { nombreCdd: 4, nombreRenouvellements: 3 });
        for (const x of r) {
            expect(x.article).toMatch(/^art\. \d+/);
            expect(x.formule.length).toBeGreaterThan(40);
        }
    });
});
describe('la clause d’essai (art. 43)', () => {
    it('sans clause · rien à dire, et aucune durée opposable', () => {
        const v = (0, regles_contrat_travail_1.verdictEssai)(CONTRAT);
        expect(v.dureeOpposableJours).toBeNull();
        expect(v.reduiteDePleinDroit).toBe(false);
        expect(v.reserve).toBeNull();
    });
    it('RÉDUITE DE PLEIN DROIT à six mois pour un travailleur qualifié', () => {
        const v = (0, regles_contrat_travail_1.verdictEssai)({ ...CONTRAT, clauseEssai: true, essaiConstateParEcrit: true, essaiDureeJours: 365 });
        expect(v.plafondJours).toBe(6 * regles_contrat_travail_1.JOURS_PAR_MOIS_ESSAI);
        expect(v.dureeOpposableJours).toBe(180);
        expect(v.reduiteDePleinDroit).toBe(true);
    });
    it('UN MOIS pour le manœuvre sans spécialité · le plafond change avec la qualité', () => {
        const v = (0, regles_contrat_travail_1.verdictEssai)({
            ...CONTRAT,
            manoeuvreSansSpecialite: true,
            clauseEssai: true,
            essaiConstateParEcrit: true,
            essaiDureeJours: 90,
        });
        expect(v.plafondJours).toBe(30);
        expect(v.dureeOpposableJours).toBe(30);
        expect(v.reduiteDePleinDroit).toBe(true);
    });
    it('une durée sous le plafond n’est pas touchée', () => {
        const v = (0, regles_contrat_travail_1.verdictEssai)({ ...CONTRAT, clauseEssai: true, essaiConstateParEcrit: true, essaiDureeJours: 60 });
        expect(v.dureeOpposableJours).toBe(60);
        expect(v.reduiteDePleinDroit).toBe(false);
    });
    it('SIGNALE L’ÉCRIT MANQUANT · l’alinéa 1er l’exige séparément de la durée', () => {
        const v = (0, regles_contrat_travail_1.verdictEssai)({ ...CONTRAT, clauseEssai: true, essaiConstateParEcrit: false, essaiDureeJours: 30 });
        expect(v.ecritManquant).toBe(true);
        expect(v.reduiteDePleinDroit).toBe(false);
    });
    it('AVOUE SA CONVERSION · le texte plafonne en MOIS, le logiciel compte en jours', () => {
        const v = (0, regles_contrat_travail_1.verdictEssai)({ ...CONTRAT, clauseEssai: true, essaiConstateParEcrit: true, essaiDureeJours: 181 });
        expect(v.reserve).toContain('MOIS');
        expect(v.reserve).toContain('convention du logiciel');
        expect(v.reserve).toContain('alinéa 4');
        expect(v.reserve).toContain("délais d'engagement et de route");
    });
});
describe('les déclarations de l’article 217 · quinze jours, deux fois', () => {
    const base = {
        dateEntreeEnVigueur: '2026-01-05',
        declarationEngagementLe: null,
        dateFin: null,
        declarationDepartLe: null,
    };
    it('l’engagement ouvre une déclaration à quinze jours, aux DEUX destinataires', () => {
        const d = (0, regles_contrat_travail_1.declarationsDues)(base, new Date('2026-01-10'));
        expect(d).toHaveLength(1);
        expect(d[0].objet).toBe('ENGAGEMENT');
        expect(d[0].echeance.toISOString().slice(0, 10)).toBe('2026-01-20');
        expect(regles_contrat_travail_1.JOURS_DECLARATION_ARTICLE_217).toBe(15);
        expect(d[0].destinataires).toContain('ministère');
        expect(d[0].destinataires).toContain("Office national de l'emploi");
    });
    it('signale le retard tant que la déclaration n’est pas faite', () => {
        expect((0, regles_contrat_travail_1.declarationsDues)(base, new Date('2026-01-25'))[0].enRetard).toBe(true);
        expect((0, regles_contrat_travail_1.declarationsDues)({ ...base, declarationEngagementLe: '2026-02-01' }, new Date('2026-03-01'))[0]
            .enRetard).toBe(false);
    });
    it('LE DÉPART EN OUVRE UNE SECONDE · « pour quelque cause que ce soit »', () => {
        const d = (0, regles_contrat_travail_1.declarationsDues)({ ...base, dateFin: '2026-08-31' }, new Date('2026-09-30'));
        expect(d.map((x) => x.objet)).toEqual(['ENGAGEMENT', 'DEPART']);
        expect(d[1].echeance.toISOString().slice(0, 10)).toBe('2026-09-15');
        expect(d[1].enRetard).toBe(true);
    });
    it('un contrat en cours n’a PAS de déclaration de départ · on ne la réclame pas d’avance', () => {
        expect((0, regles_contrat_travail_1.declarationsDues)(base, new Date('2026-06-01')).map((x) => x.objet)).toEqual([
            'ENGAGEMENT',
        ]);
    });
});
describe('l’aptitude provisoire de l’article 38', () => {
    it('trois mois DE DATE À DATE · entré le 1er juillet, signalé le 2 octobre et pas le 30 septembre', () => {
        expect(regles_contrat_travail_1.MOIS_CONFIRMATION_APTITUDE).toBe(3);
        const juillet = { dateEntreeEnVigueur: '2026-07-01' };
        expect((0, regles_contrat_travail_1.aptitudeProvisoirePerimee)({ aptitudeProvisoire: true }, juillet, new Date('2026-09-30T12:00:00Z'))).toBe(false);
        expect((0, regles_contrat_travail_1.aptitudeProvisoirePerimee)({ aptitudeProvisoire: true }, juillet, new Date('2026-10-01T12:00:00Z'))).toBe(false);
        expect((0, regles_contrat_travail_1.aptitudeProvisoirePerimee)({ aptitudeProvisoire: true }, juillet, new Date('2026-10-02T00:00:00Z'))).toBe(true);
    });
    it('trois mois pour confirmer, et pas un de plus', () => {
        const contrat = { dateEntreeEnVigueur: '2026-01-05' };
        expect((0, regles_contrat_travail_1.aptitudeProvisoirePerimee)({ aptitudeProvisoire: true }, contrat, new Date('2026-03-01'))).toBe(false);
        expect((0, regles_contrat_travail_1.aptitudeProvisoirePerimee)({ aptitudeProvisoire: true }, contrat, new Date('2026-06-01'))).toBe(true);
    });
    it('une aptitude DÉFINITIVE ne se périme jamais', () => {
        expect((0, regles_contrat_travail_1.aptitudeProvisoirePerimee)({ aptitudeProvisoire: false }, { dateEntreeEnVigueur: '2020-01-05' }, new Date('2026-06-01'))).toBe(false);
    });
    it('sans date d’entrée en vigueur, le délai ne court pas · on ne l’invente pas', () => {
        expect((0, regles_contrat_travail_1.aptitudeProvisoirePerimee)({ aptitudeProvisoire: true }, { dateEntreeEnVigueur: null }, new Date('2026-06-01'))).toBe(false);
    });
});
describe('la rémunération convenue confrontée au minimum de sa classe', () => {
    const manoeuvre = {
        ...CONTRAT,
        classeProfessionnelle: 1,
        periodiciteRemuneration: 'MOIS',
        remunerationBase: 559_000,
    };
    it('conforme quand la rémunération atteint le minimum, au centime près', () => {
        const v = (0, regles_contrat_travail_1.verdictRemunerationMinimale)(manoeuvre, '2026-01');
        expect(v.conforme).toBe(true);
        expect(v.minimumFc).toBe(559_000);
        expect(v.manqueFc).toBeNull();
        expect(v.explication).toContain('Manœuvre');
    });
    it('jumeau de C1 · un contrat EXACTEMENT au minimum d’une grille aux centimes est conforme, au centime', () => {
        const grille = (0, bareme_smig_1.annexeDuCabinet)({ aPartirDu: '2027-01-01', reference: 'Arrêté du banc', smigJournalierFc: 21_500.01 });
        expect(104_920.05 * 26).toBeGreaterThan(2_727_921.3);
        const auMinimum = { ...manoeuvre, classeProfessionnelle: 12, remunerationBase: 2_727_921.3 };
        const v = (0, regles_contrat_travail_1.verdictRemunerationMinimale)(auMinimum, '2027-03', [grille]);
        expect(v).toMatchObject({ conforme: true, minimumFc: 2_727_921.3, manqueFc: null });
        const unCentimeDessous = (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...auMinimum, remunerationBase: 2_727_921.29 }, '2027-03', [grille]);
        expect(unCentimeDessous).toMatchObject({ conforme: false, manqueFc: 0.01 });
    });
    it('EN DEÇÀ · il chiffre le manque et cite les deux textes qui le sanctionnent', () => {
        const v = (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, remunerationBase: 500_000 }, '2026-01');
        expect(v.conforme).toBe(false);
        expect(v.manqueFc).toBe(59_000);
        expect(v.explication).toContain('sous peine de sanction');
        expect(v.explication).toContain("l'article 37");
        expect(v.explication).toContain('art. 88, al. 2');
        expect(v.explication).toContain("l'article 321");
    });
    it('LE MINIMUM A CHANGÉ EN JANVIER 2026 · le même contrat bascule', () => {
        const sousPaye = { ...manoeuvre, remunerationBase: 500_000 };
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)(sousPaye, '2025-09').conforme).toBe(true);
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)(sousPaye, '2025-09').minimumFc).toBe(377_000);
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)(sousPaye, '2026-01').conforme).toBe(false);
    });
    it('LA PÉRIODICITÉ CHANGE TOUT · le même nombre est conforme ou non selon l’unité', () => {
        const base = { ...manoeuvre, remunerationBase: 21_500 };
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...base, periodiciteRemuneration: 'JOUR' }, '2026-01').conforme).toBe(true);
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...base, periodiciteRemuneration: 'MOIS' }, '2026-01').conforme).toBe(false);
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...base, periodiciteRemuneration: 'SEMAINE' }, '2026-01').minimumFc).toBe(129_000);
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...base, periodiciteRemuneration: 'ANNEE' }, '2026-01').minimumFc).toBe(6_708_000);
    });
    it('LA CLASSE COMMANDE LE MINIMUM · un cadre n’est pas un manœuvre', () => {
        const cadre = { ...manoeuvre, classeProfessionnelle: 17, remunerationBase: 559_000 };
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)(cadre, '2026-01').conforme).toBe(false);
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)(cadre, '2026-01').minimumFc).toBe(215_000 * 26);
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)(cadre, '2026-01').explication).toContain('Cadre de collaboration');
    });
    it('S’ABSTIENT plutôt que de deviner, et nomme ce qui manque', () => {
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, classeProfessionnelle: null }, '2026-01').abstention)
            .toBe('CLASSE_NON_RENSEIGNEE');
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, periodiciteRemuneration: null }, '2026-01').abstention)
            .toBe('PERIODICITE_NON_RENSEIGNEE');
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, remunerationBase: null }, '2026-01').abstention)
            .toBe('REMUNERATION_NON_RENSEIGNEE');
        for (const v of [
            (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, classeProfessionnelle: null }, '2026-01'),
            (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, periodiciteRemuneration: null }, '2026-01'),
            (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, remunerationBase: null }, '2026-01'),
        ]) {
            expect(v.conforme).toBeNull();
            expect(v.explication.length).toBeGreaterThan(60);
        }
    });
    it('LA MONNAIE · un salaire en dollars ne se compare pas à un minimum en francs (audit final F226)', () => {
        const enDollars = (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, remunerationBase: 1000, deviseRemuneration: 'USD' }, '2026-01');
        expect(enDollars.conforme).toBeNull();
        expect(enDollars.abstention).toBe('REMUNERATION_HORS_FRANC');
        expect(enDollars.manqueFc).toBeNull();
        expect(enDollars.convenueFc).toBeNull();
        expect(enDollars.explication).toContain('stipulée en USD');
        expect(enDollars.explication).toContain('art. 89');
        const sansMonnaie = (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, remunerationBase: 1000, deviseRemuneration: null }, '2026-01');
        expect(sansMonnaie.conforme).toBeNull();
        expect(sansMonnaie.abstention).toBe('DEVISE_NON_RENSEIGNEE');
        expect(sansMonnaie.convenueFc).toBeNull();
        const enFrancs = (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, remunerationBase: 1000, deviseRemuneration: 'CDF' }, '2026-01');
        expect(enFrancs.conforme).toBe(false);
        expect(enFrancs.convenueFc).toBe(1000);
    });
    it('NE CONTRÔLE RIEN sous le décret n° 18/017 sans ancienneté · son art. 7 majore les taux (audit D2-C1)', () => {
        const v = (0, regles_contrat_travail_1.verdictRemunerationMinimale)(manoeuvre, '2025-03');
        expect(v.abstention).toBe('HORS_BAREME');
        expect(v.explication).toContain('3 %');
        expect((0, regles_contrat_travail_1.verdictRemunerationMinimale)(manoeuvre, '2018-09').explication).toContain('suivant l');
    });
    it('ne déduit PAS la classe de la catégorie de la convention collective', () => {
        const v = (0, regles_contrat_travail_1.verdictRemunerationMinimale)({ ...manoeuvre, classeProfessionnelle: null, categorieProfessionnelle: 'Agent de maîtrise' }, '2026-01');
        expect(v.abstention).toBe('CLASSE_NON_RENSEIGNEE');
        expect(v.explication).toContain('convention collective');
    });
});
//# sourceMappingURL=regles-contrat-travail.spec.js.map