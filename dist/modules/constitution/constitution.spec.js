"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const constitution_service_1 = require("./constitution.service");
const catalogue_constitution_1 = require("./catalogue-constitution");
const ONG = client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE;
describe('Catalogue de constitution · trois fondements qui ne se valent pas', () => {
    it('les DIX pièces de la section A sont là, dans l’ordre de la note circulaire', () => {
        const enregistrement = (0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION, false).find((e) => e.cle === 'enregistrement-plan');
        expect(enregistrement.pieces).toHaveLength(10);
        expect(enregistrement.pieces[0].cle).toBe('lettre-demande');
        expect(enregistrement.pieces[9].cle).toBe('frais-dgrad');
    });
    it('UNE pièce de la liste officielle ne repose sur AUCUN texte en vigueur', () => {
        const pieces = (0, catalogue_constitution_1.piecesDuParcours)(client_1.FormeJuridiqueEbnl.ASSOCIATION, false);
        const sansBase = pieces.filter((p) => p.fondement === 'USAGE_SANS_BASE_LEGALE');
        expect(sansBase).toHaveLength(1);
        expect(sansBase[0].cle).toBe('reconnaissance-provinciale');
        expect(sansBase[0].reserve).toMatch(/AUCUN TEXTE LÉGAL/);
        expect(sansBase[0].reserve).toMatch(/réclamée en pratique/);
        expect(pieces.some((p) => p.cle === 'reconnaissance-provinciale')).toBe(true);
    });
    it('les cinq pièces de la personnalité juridique viennent de l’ARTICLE 4, pas d’une pratique', () => {
        const etape = (0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION, false).find((e) => e.cle === 'personnalite-juridique');
        expect(etape.pieces).toHaveLength(5);
        for (const p of etape.pieces) {
            expect(p.fondement).toBe('LOI');
            expect(p.source).toMatch(/art\. 4/);
        }
    });
    it('AUCUN MONTANT de frais DGRAD n’est donné · l’annotation est manuscrite', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'catalogue-constitution.ts'), 'utf8');
        const frais = (0, catalogue_constitution_1.piecesDuParcours)(client_1.FormeJuridiqueEbnl.ASSOCIATION, false).find((p) => p.cle === 'frais-dgrad');
        expect(frais.libelle).toBe('Frais DGRAD');
        expect(frais.reserve).toMatch(/BARRÉS À LA MAIN/);
        expect(frais.reserve).toMatch(/vérifier le barème en vigueur auprès de la DGRAD/);
        expect((source.match(/50 USD|100 USD/g) ?? []).length).toBe(2);
        expect(source).not.toMatch(/70\.?755|141\.?510/);
    });
    it('le dossier de l’avis de tutelle n’est PAS inventé · la loi ne le fixe pas', () => {
        const etape = (0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION, false)[0];
        expect(etape.cle).toBe('avis-tutelle');
        expect(etape.pieces).toHaveLength(1);
        expect(etape.pieces[0].reserve).toMatch(/chaque Ministère les fixe librement|les fixe librement/i);
    });
    it('l’étape de l’ONG étrangère n’est servie QU’à elle, et ne recopie pas l’art. 37', () => {
        expect((0, catalogue_constitution_1.parcoursConstitution)(ONG, true).map((e) => e.cle)).toContain('conditions-ong-etrangere');
        expect((0, catalogue_constitution_1.parcoursConstitution)(ONG, false).map((e) => e.cle)).not.toContain('conditions-ong-etrangere');
        expect((0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION, true).map((e) => e.cle)).not.toContain('conditions-ong-etrangere');
        const etape = (0, catalogue_constitution_1.parcoursConstitution)(ONG, true).find((e) => e.cle === 'conditions-ong-etrangere');
        expect(etape.pieces).toHaveLength(0);
        expect(etape.produit).toMatch(/fenêtre Accord-cadre/);
    });
});
function service(dossier) {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(dossier) },
    };
    return new constitution_service_1.ConstitutionService(prisma);
}
const vide = {
    formeJuridique: client_1.FormeJuridiqueEbnl.ASSOCIATION,
    droitEtranger: false,
    actePersonnaliteJuridique: null,
    dateActePersonnalite: null,
    numeroEnregistrementSecteur: null,
    certificatEnregistrementPlan: null,
};
describe('Confrontation avec ce que le dossier détient déjà', () => {
    it('n’ouvre AUCUNE table · il lit les champs existants du dossier', async () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'constitution.service.ts'), 'utf8');
        for (const mot of ['create(', 'update(', 'upsert(', 'delete(']) {
            expect(source).not.toContain(`prisma.${mot}`);
        }
        expect(source).not.toMatch(/checklistConstitution|pieceConstitution\./);
    });
    it('dit « non renseigné » sur un dossier vide, et « renseigné » quand la pièce est là', async () => {
        const ong = { ...vide, formeJuridique: ONG };
        const rien = await service(ong).parcours('t');
        expect(rien.etapes.map((e) => e.produitDetenu?.renseigne)).toEqual([false, false, false]);
        const garni = await service({
            ...ong,
            actePersonnaliteJuridique: 'Arrêté 0142/CAB/MIN/J/2019',
            numeroEnregistrementSecteur: 'MINSANTE/ONG/2019/77',
            certificatEnregistrementPlan: 'CE/PLAN/2020/311',
        }).parcours('t');
        expect(garni.etapes.map((e) => e.produitDetenu?.renseigne)).toEqual([true, true, true]);
    });
    it('D1-A5, D1-B3 · un champ que la forme ne porte pas rend null et son motif, jamais « non renseigné »', async () => {
        const r = await service(vide).parcours('t');
        expect(r.etapes.map((e) => e.produitDetenu === null)).toEqual([true, false, true]);
        expect(r.etapes[0].motifSansProduit).toBe('Aucun champ du dossier ne porte cet acte');
        expect(r.etapes[1].motifSansProduit).toBeNull();
        expect(r.champsPortes).toEqual({ enregistrementSecteur: false, certificatPlan: false });
    });
    it('D1-B3 · l’association étrangère confronte son enregistrement au ministère du secteur (art. 31)', async () => {
        const r = await service({ ...vide, droitEtranger: true, numeroEnregistrementSecteur: 'MIN/ET/1' }).parcours('t');
        const avis = r.etapes.find((e) => e.cle === 'avis-enregistrement-secteur');
        expect(avis.produitDetenu).toEqual({ champ: 'Enregistrement au ministère du secteur (art. 31)', valeur: 'MIN/ET/1', renseigne: true });
        expect(r.etapes.find((e) => e.cle === 'personnalite-juridique').produitDetenu.champ).toBe('Décret d’autorisation');
    });
    it('D1-B1 · l’unité de gestion de projet reçoit un motif et aucune liste', async () => {
        const r = await service({ ...vide, formeJuridique: client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET }).parcours('t');
        expect(r.etapes).toHaveLength(0);
        expect(r.horsParcours).toMatch(/pas concerné par la loi n° 004\/2001/);
        expect((await service(vide).parcours('t')).horsParcours).toBeNull();
    });
    it('l’appariement se fait PAR CLÉ, jamais par rang · gelé dans la source', async () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'constitution.service.ts'), 'utf8');
        expect(source).toContain('detenu[e.cle]');
        expect(source).not.toMatch(/Object\.values\(detenu\)|detenu\[\s*i\s*\]/);
    });
    it('l’étape de l’ONG étrangère ne porte AUCUN produit détenu · null, jamais false', async () => {
        const r = await service({ ...vide, formeJuridique: ONG, droitEtranger: true }).parcours('t');
        const etrangere = r.etapes.find((e) => e.cle === 'conditions-ong-etrangere');
        expect(etrangere.produitDetenu).toBeNull();
    });
    it('compte les pièces PAR FONDEMENT · c’est là que l’usage sans base se voit', async () => {
        const r = await service(vide).parcours('t');
        expect(r.parFondement.USAGE_SANS_BASE_LEGALE).toBe(1);
        expect(r.parFondement.LOI).toBe(7);
        expect(r.parFondement.PRATIQUE_ADMINISTRATIVE).toBe(8);
    });
});
const pieceDe = (etapes, cle) => etapes.flatMap((e) => e.pieces).find((p) => p.cle === cle);
describe('D1-B1, D1-A4 · l’établissement d’utilité publique suit le Titre II, pas l’art. 4', () => {
    const eup = (0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE, false);
    it('déclaration authentique et autorisation provisoire (art. 60 à 62), puis arrêté dans les douze mois (art. 63)', () => {
        expect(eup.map((e) => e.cle)).toEqual(['declaration-eup', 'personnalite-juridique', 'enregistrement-plan']);
        expect(eup[0].source).toBe('Loi n° 004/2001, art. 60 à 62');
        expect(pieceDe(eup, 'declaration-authentique').source).toBe('Loi n° 004/2001, art. 60 al. 1');
        expect(eup[1].source).toBe('Loi n° 004/2001, art. 63');
        expect(eup[1].produit).toMatch(/dans les douze mois de l’autorisation provisoire/);
    });
    it('aucune pièce de l’art. 4 · il n’a pas de membres effectifs', () => {
        expect(eup.flatMap((e) => e.pieces).filter((p) => /art\. 4/.test(p.source))).toHaveLength(0);
        expect(pieceDe(eup, 'liste-membres')).toBeUndefined();
    });
    it('les pièces 7, 9 et 11 de la liste de la Justice sont de la PRATIQUE, jamais de la loi', () => {
        for (const [cle, point] of [
            ['cession-biens-eup', 7],
            ['designation-administrateurs-eup', 9],
            ['dispositions-testamentaires-eup', 11],
        ]) {
            const p = pieceDe(eup, cle);
            expect(p.fondement).toBe('PRATIQUE_ADMINISTRATIVE');
            expect(p.source).toMatch(new RegExp(`annexe I\\), point ${point}$`));
        }
        expect(pieceDe(eup, 'acte-personnalite').source).toMatch(/art\. 63/);
    });
    it('la forme AUTRE s’abstient, le drapeau étranger ne change rien à l’EUP', () => {
        expect((0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.AUTRE, false)).toHaveLength(0);
        expect((0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE, true).map((e) => e.cle)).toEqual(eup.map((e) => e.cle));
    });
});
describe('D1-B2, D1-A4 · l’association de droit étranger obtient un décret d’autorisation (art. 30)', () => {
    it('avis et enregistrement au ministère du secteur, puis autorisation, jamais l’arrêté de personnalité', () => {
        const a = (0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION, true);
        expect(a.map((e) => e.cle)).toEqual(['avis-enregistrement-secteur', 'personnalite-juridique', 'enregistrement-plan']);
        expect(a[0].source).toBe('Loi n° 004/2001, art. 31 al. 1');
        expect(a[0].produit).toMatch(/aucune autorisation provisoire/);
        expect(a[1].libelle).toBe('Autorisation d’exercer en RDC');
        expect(a[1].produit).toMatch(/^Décret du Président de la République, sur proposition du Ministre de la Justice/);
        expect(a[1].produit).toMatch(/art\. 34/);
        expect(a[1].pieces).toHaveLength(5);
        for (const p of a[1].pieces)
            expect(p.source).toMatch(/art\. 4, [a-e]\) · par le renvoi de l’art\. 31 al\. 3$/);
        expect(pieceDe(a, 'acte-personnalite').source).toMatch(/art\. 30/);
    });
    it('pour une ONG, l’écart décret / ordonnance est nommé sans être tranché', () => {
        const o = (0, catalogue_constitution_1.parcoursConstitution)(ONG, true);
        expect(o.find((e) => e.cle === 'personnalite-juridique').produit).toMatch(/ne tranche pas entre les deux désignations/);
        expect(o.map((e) => e.cle)).toContain('conditions-ong-etrangere');
    });
    it('la confessionnelle étrangère s’adresse à la Justice (art. 32) et produit la pièce de l’art. 52', () => {
        const c = (0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE, true);
        expect(c.map((e) => e.cle)).toEqual(['personnalite-juridique', 'enregistrement-plan']);
        expect(c[0].destinataire).toBe('Ministre de la Justice (art. 32)');
        expect(pieceDe(c, 'dossier-doctrine').source).toBe('Loi n° 004/2001, art. 52, 1°');
    });
});
describe('D1-B5, D1-B6, D1-A9 · l’association de droit congolais', () => {
    it('la confessionnelle produit le dossier de doctrine de l’art. 52, 1°, en fondement LOI', () => {
        const c = (0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE, false);
        const doctrine = pieceDe(c, 'dossier-doctrine');
        expect(doctrine.fondement).toBe('LOI');
        expect(doctrine.source).toBe('Loi n° 004/2001, art. 52, 1°');
        expect(pieceDe((0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION, false), 'dossier-doctrine')).toBeUndefined();
    });
    it('l’autorisation provisoire vaut pour toute ASBL, le gouverneur la donne en province (art. 5 al. 2)', () => {
        const [avis, personnalite] = (0, catalogue_constitution_1.parcoursConstitution)(client_1.FormeJuridiqueEbnl.ASSOCIATION, false);
        expect(avis.produit).toMatch(/gouverneur de province pour une ASBL enregistrée en province \(art\. 5 al\. 2\)/);
        expect(avis.destinataire).toMatch(/gouverneur de province/);
        expect(avis.pieces[0].fondement).toBe('LOI');
        expect(avis.pieces[0].source).toMatch(/^Loi n° 004\/2001, art\. 3 \(avis exigé\) et art\. 4/);
        expect(personnalite.produit).toMatch(/censée être octroyée.*dans le mois qui suit \(art\. 5 al\. 3\)/);
    });
});
//# sourceMappingURL=constitution.spec.js.map