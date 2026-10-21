"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const path_1 = require("path");
const client_1 = require("@prisma/client");
const facturation_service_1 = require("./facturation.service");
const mentions_facture_1 = require("./mentions-facture");
const etat_detaille_tva_1 = require("./etat-detaille-tva");
const fs_1 = require("fs");
const ligne = (sur = {}) => ({
    designation: 'Prestation de conseil',
    quantite: 1,
    prixUnitaire: 100_000,
    montantHT: 100_000,
    imposable: true,
    tauxApplique: 16,
    montantTva: 16_000,
    ...sur,
});
const facture = (sur = {}) => ({
    emetteurNom: 'VMG Consulting',
    emetteurAdresse: '12, avenue de la Justice, Kinshasa/Gombe',
    emetteurNumeroImpot: 'A1234567X',
    contrepartieNom: 'Client SARL',
    contrepartieAdresse: '4, boulevard du 30 Juin, Kinshasa',
    contrepartieNumeroImpot: 'B7654321Y',
    dateFacture: new Date('2026-09-10'),
    mentionTvaDebits: false,
    numeroSerie: 'FV-2026-0001',
    autresImpotsEtTaxes: 0,
    lignes: [ligne()],
    ...sur,
});
describe('Les mentions · DOUZE à l’art. 26, DIX pour un document en tenant lieu', () => {
    it('LE TEXTE GOUVERNANT EST CELUI DE 2023, et il porte douze groupes', () => {
        expect(mentions_facture_1.MENTIONS_ARTICLE_26).toHaveLength(12);
        expect(mentions_facture_1.MENTIONS_ARTICLE_26.map((m) => m.cle)).toEqual([
            'IDENTITE_VENDEUR',
            'IDENTITE_CLIENT',
            'DATE_ET_NUMERO',
            'DESIGNATION_ET_QUANTITE',
            'PRIX_UNITAIRE_ET_GLOBAL',
            'PRIX_HORS_TVA',
            'TAUX_ET_MONTANT_TVA',
            'MONTANT_NON_TAXABLE',
            'MONTANT_TTC',
            'AUTRES_IMPOTS_ET_TAXES',
            'NUMERO_DISPOSITIF_ELECTRONIQUE',
            'CODE_AUTHENTIFICATION_ET_QR',
        ]);
    });
    it('un DOCUMENT EN TENANT LIEU en sert DIX · art. 26, dernier alinéa', () => {
        expect(mentions_facture_1.MENTIONS_DOCUMENT_EN_TENANT_LIEU).toHaveLength(10);
        expect(mentions_facture_1.MENTIONS_DOCUMENT_EN_TENANT_LIEU.map((m) => m.cle)).not.toContain('NUMERO_DISPOSITIF_ELECTRONIQUE');
        expect(mentions_facture_1.MENTIONS_DOCUMENT_EN_TENANT_LIEU.map((m) => m.cle)).not.toContain('CODE_AUTHENTIFICATION_ET_QR');
    });
    it('les deux mentions hors de portée sont NOMMÉES, jamais tues', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture(), true);
        expect(v.horsDePortee.map((m) => m.cle)).toEqual([
            'NUMERO_DISPOSITIF_ELECTRONIQUE',
            'CODE_AUTHENTIFICATION_ET_QR',
        ]);
    });
    it('LE DIXIÈME GROUPE · « le cas échéant » n’est pas « facultatif »', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ autresImpotsEtTaxes: null }), true);
        expect(v.conforme).toBe(false);
        expect(v.manquantes.map((m) => m.cle)).toEqual(['AUTRES_IMPOTS_ET_TAXES']);
        expect((0, mentions_facture_1.verifierMentions)(facture({ autresImpotsEtTaxes: 0 }), true).conforme).toBe(true);
    });
    it('une facture complète sert les dix', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture(), true);
        expect(v.conforme).toBe(true);
        expect(v.manquantes).toEqual([]);
    });
    it('C’EST L’ÉTAT D’AVANT QUI EST FAUTIF · une pièce sans lignes manque SIX groupes', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ lignes: [] }), true);
        expect(v.conforme).toBe(false);
        expect(v.manquantes.map((m) => m.cle)).toEqual([
            'DESIGNATION_ET_QUANTITE',
            'PRIX_UNITAIRE_ET_GLOBAL',
            'PRIX_HORS_TVA',
            'TAUX_ET_MONTANT_TVA',
            'MONTANT_NON_TAXABLE',
            'MONTANT_TTC',
        ]);
        expect(v.presentes).toEqual(['IDENTITE_VENDEUR', 'IDENTITE_CLIENT', 'DATE_ET_NUMERO', 'AUTRES_IMPOTS_ET_TAXES']);
    });
    it('l’identité se sert du NOM ET du numéro impôt · pas de l’un des deux', () => {
        expect((0, mentions_facture_1.verifierMentions)(facture({ contrepartieNumeroImpot: null }), true).manquantes.map((m) => m.cle)).toEqual([
            'IDENTITE_CLIENT',
        ]);
        expect((0, mentions_facture_1.verifierMentions)(facture({ emetteurNumeroImpot: '   ' }), true).manquantes.map((m) => m.cle)).toEqual([
            'IDENTITE_VENDEUR',
        ]);
    });
    it('la date ET le n° de série sont un seul groupe · le texte les écrit ensemble', () => {
        expect((0, mentions_facture_1.verifierMentions)(facture({ numeroSerie: '' }), true).manquantes.map((m) => m.cle)).toEqual(['DATE_ET_NUMERO']);
    });
    it('une ligne EXONÉRÉE sans taux ne fait PAS manquer la mention de TVA', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ lignes: [ligne({ imposable: false, tauxApplique: null, montantTva: 0 })] }), true);
        expect(v.conforme).toBe(true);
    });
    it('une ligne IMPOSABLE sans taux fait manquer la mention de TVA', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ lignes: [ligne({ tauxApplique: null })] }), true);
        expect(v.manquantes.map((m) => m.cle)).toEqual(['TAUX_ET_MONTANT_TVA']);
    });
});
describe('L’amende de l’art. 97 bis · un barème unitaire, jamais un total', () => {
    it('750.000 FC pour une personne morale, 250.000 FC pour une personne physique', () => {
        expect((0, mentions_facture_1.verifierMentions)(facture(), true).amendeUnitaire).toBe(750_000);
        expect((0, mentions_facture_1.verifierMentions)(facture(), false).amendeUnitaire).toBe(250_000);
        expect(mentions_facture_1.AMENDE_PAR_OMISSION.source).toMatch(/art\. 97 bis/);
    });
    it('la réserve accompagne TOUJOURS le barème, même sur une facture conforme', () => {
        for (const conforme of [true, false]) {
            const v = (0, mentions_facture_1.verifierMentions)(conforme ? facture() : facture({ lignes: [] }), true);
            expect(v.reserveAmende).toMatch(/ne se déduit donc pas du nombre de groupes manquants/);
        }
    });
    it('AUCUN TOTAL n’est calculé dans la source · la propriété se gèle là où elle vit', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'mentions-facture.ts'), 'utf8');
        expect(source).not.toMatch(/amendeTotale|montantEncouru|manquantes\.length\s*\*/);
    });
});
describe('L’homologation · la procédure EXISTE, et le module le disait de travers', () => {
    it('nomme le décret, la qualification d’OmegaX et l’acte à obtenir', () => {
        expect(mentions_facture_1.HOMOLOGATION.omegaxHomologue).toBe(false);
        expect(mentions_facture_1.HOMOLOGATION.source).toMatch(/23\/10 du 3 mars 2023/);
        expect(mentions_facture_1.HOMOLOGATION.qualification).toMatch(/Système de Facturation d[’']Entreprise/);
        expect(mentions_facture_1.HOMOLOGATION.procedure).toMatch(/ATTESTATION DE CONFORMITÉ/);
        expect(mentions_facture_1.HOMOLOGATION.consequence).toMatch(/n[’']est PAS une facture normalisée/);
    });
    it('dit ce qui reste hors corpus · l’ARRÊTÉ de l’art. 23, pas la procédure elle-même', () => {
        expect(mentions_facture_1.HOMOLOGATION.procedure).toMatch(/arrêté du Ministre des Finances \(art\. 23\)/);
        expect(mentions_facture_1.HOMOLOGATION.procedure).toMatch(/n[’']est dans aucune source lue/);
    });
    it('l’obligation d’ACCEPTATION nomme l’ONG · art. 27', () => {
        expect(mentions_facture_1.OBLIGATION_DACCEPTATION.mention).toMatch(/organisations non gouvernementales/);
        expect(mentions_facture_1.OBLIGATION_DACCEPTATION.source).toMatch(/art\. 25 et 27/);
    });
    it('aucun fichier du module ne présente sa sortie comme une facture normalisée', () => {
        for (const fichier of ['mentions-facture.ts', 'etat-detaille-tva.ts', 'facturation.service.ts']) {
            const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, fichier), 'utf8');
            const affirmations = source.match(/produi[a-z]*\s+une\s+facture\s+normalisée/gi) ?? [];
            expect(affirmations).toEqual([]);
        }
    });
});
describe('Les totaux du pied de facture', () => {
    it('le montant NON TAXABLE se sépare du montant imposable', () => {
        const t = (0, mentions_facture_1.totauxFacture)(facture({
            lignes: [
                ligne({ montantHT: 100_000, montantTva: 16_000 }),
                ligne({ montantHT: 40_000, imposable: false, tauxApplique: null, montantTva: 0 }),
            ],
        }));
        expect(t.montantHT).toBe(140_000);
        expect(t.montantNonTaxable).toBe(40_000);
        expect(t.montantImposable).toBe(100_000);
        expect(t.montantTva).toBe(16_000);
        expect(t.montantTTC).toBe(156_000);
    });
    it('le TTC comprend les autres impôts et taxes de la pièce', () => {
        const lignes = [ligne({ montantHT: 100_000, montantTva: 16_000 })];
        const avec = (0, mentions_facture_1.totauxFacture)({ ...facture({ lignes }), autresImpotsEtTaxes: 5_000 });
        expect(avec.montantAutresImpotsEtTaxes).toBe(5_000);
        expect(avec.montantTTC).toBe(121_000);
        const sans = (0, mentions_facture_1.totauxFacture)({ ...facture({ lignes }), autresImpotsEtTaxes: null });
        expect(sans.montantTTC).toBe(116_000);
    });
});
const achat = (sur = {}) => ({
    numeroSerie: 'FA-001',
    dateFacture: new Date('2026-09-04'),
    fournisseurNom: 'Fournisseur SARL',
    fournisseurNumeroImpot: 'C1111111Z',
    lignes: [{ designation: 'Papier', quantite: 10, prixHT: 50_000, montantTva: 8_000, imposable: true }],
    ...sur,
});
describe('L’état détaillé de l’art. 56 · la condition du droit à déduction', () => {
    it('rend une ligne par ligne de facture, avec les données que l’art. 134 nomme', () => {
        const e = (0, etat_detaille_tva_1.construireEtatDetaille)('2026-09', [achat()]);
        expect(e.lignes).toHaveLength(1);
        expect(e.lignes[0]).toMatchObject({
            fournisseurNom: 'Fournisseur SARL',
            fournisseurNumeroImpot: 'C1111111Z',
            numeroFacture: 'FA-001',
            dateFacture: '2026-09-04',
            designation: 'Papier',
            quantite: 10,
            prixHT: 50_000,
            tvaFacturee: 8_000,
            montantTTC: 58_000,
        });
        expect(e.totalHT).toBe(50_000);
        expect(e.totalTva).toBe(8_000);
        expect(e.totalTTC).toBe(58_000);
    });
    it('une ligne SANS numéro impôt du fournisseur est signalée, jamais écartée', () => {
        const e = (0, etat_detaille_tva_1.construireEtatDetaille)('2026-09', [achat({ fournisseurNumeroImpot: null })]);
        expect(e.lignes).toHaveLength(1);
        expect(e.complet).toBe(false);
        expect(e.incompletudes[0].manques).toEqual(['NUMERO_IMPOT_FOURNISSEUR']);
    });
    it('le volet IMPORTATIONS n’est JAMAIS couvert, et l’état le dit sur lui-même', () => {
        const e = (0, etat_detaille_tva_1.construireEtatDetaille)('2026-09', [achat()]);
        expect(e.voletImportations.couvert).toBe(false);
        expect(e.voletImportations.motif).toMatch(/déclaration de mise à la consommation/);
    });
    it('la conséquence du défaut est portée par l’état, avec son délai de cinq jours', () => {
        const e = (0, etat_detaille_tva_1.construireEtatDetaille)('2026-09', []);
        expect(e.consequenceDuDefaut).toMatch(/RÉINTÉGRATION D[’']OFFICE/);
        expect(e.consequenceDuDefaut).toMatch(/cinq jours/);
    });
    it('refuse une période qui n’est pas un MOIS · la déclaration est mensuelle', () => {
        expect(() => (0, etat_detaille_tva_1.construireEtatDetaille)('2026', [])).toThrow(/MENSUELLE/);
        expect(() => (0, etat_detaille_tva_1.construireEtatDetaille)('2026-13', [])).toThrow(/MENSUELLE/);
    });
});
function projeter(complet, args) {
    const select = args?.select;
    if (!select)
        return complet;
    return Object.fromEntries(Object.keys(select).filter((k) => select[k] && k in complet).map((k) => [k, complet[k]]));
}
function service(factures = [], doublon = null, dossier = {}) {
    const create = jest.fn().mockImplementation(({ data }) => {
        const d = data;
        return Promise.resolve({
            ...d,
            id: 'f1',
            lignes: d.lignes.create.map((l) => ({ ...l })),
        });
    });
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockImplementation((args) => Promise.resolve(projeter({
                id: 't',
                nom: 'Le dossier',
                numeroImpot: 'A0000000A',
                formeJuridique: null,
                formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE',
                referentiel: 'SYSCOHADA',
                capitalSocial: new client_1.Prisma.Decimal(10_000_000),
                capitalVariable: false,
                adresse: '12, avenue de la Justice',
                ville: 'Kinshasa',
                rccm: null,
                devise: 'CDF',
                ...dossier,
            }, args))),
        },
        tiers: { findFirst: jest.fn().mockResolvedValue(null) },
        tauxTva: {
            findMany: jest.fn().mockImplementation(({ where }) => Promise.resolve(where.tenantId === 't' ? where.id.in.filter((id) => id === 't16').map((id) => ({ id })) : [])),
        },
        ecriture: { findFirst: jest.fn().mockResolvedValue({ id: 'e1' }) },
        facture: {
            findMany: jest.fn().mockResolvedValue(factures),
            count: jest.fn().mockResolvedValue(factures.length),
            findFirst: jest.fn().mockResolvedValue(doublon),
            create,
            delete: jest.fn().mockResolvedValue({}),
        },
    };
    return { svc: new facturation_service_1.FacturationService(prisma), prisma, create };
}
const dto = (sur = {}) => ({
    sens: client_1.SensFacture.VENTE,
    numeroSerie: 'FV-0001',
    dateFacture: '2026-09-10',
    contrepartieNom: 'Client SARL',
    contrepartieNumeroImpot: 'B7654321Y',
    lignes: [{ designation: 'Conseil', quantite: 1, prixUnitaire: 100_000, montantHT: 100_000, tauxApplique: 16, montantTva: 16_000 }],
    ...sur,
});
describe('une écriture de situation ne comptabilise aucune facture (ligne sage-l1, relecture B3)', () => {
    it('refusée, nommée par son numéro, et rien n’est créé', async () => {
        const { svc, prisma, create } = service();
        prisma.ecriture.findFirst = jest.fn().mockResolvedValue({ id: 'e1', statut: 'SITUATION', numeroPiece: 9 });
        await expect(svc.enregistrer('t', dto({ ecritureId: 'e1' }))).rejects.toThrow(/n° 9 est une écriture de situation/);
        expect(create).not.toHaveBeenCalled();
    });
});
describe('Le service · qui est l’émetteur, et qui est la contrepartie', () => {
    it('SUR UNE VENTE, l’émetteur est le dossier', async () => {
        const { svc, create } = service();
        await svc.enregistrer('t', dto());
        const data = create.mock.calls[0][0].data;
        expect(data.emetteurNom).toBe('Le dossier');
        expect(data.emetteurNumeroImpot).toBe('A0000000A');
        expect(data.contrepartieNom).toBe('Client SARL');
    });
    it('SUR UN ACHAT, l’émetteur est le FOURNISSEUR · l’art. 100 nomme le vendeur', async () => {
        const { svc, create } = service();
        await svc.enregistrer('t', dto({ sens: client_1.SensFacture.ACHAT, contrepartieNom: 'Fournisseur SARL' }));
        const data = create.mock.calls[0][0].data;
        expect(data.emetteurNom).toBe('Fournisseur SARL');
        expect(data.contrepartieNom).toBe('Le dossier');
    });
    it('SUR UNE VENTE, les mentions de l’AUSCGIE art. 17 sont RECOPIÉES à la date de la pièce', async () => {
        const { svc, create } = service();
        await svc.enregistrer('t', dto());
        const data = create.mock.calls[0][0].data;
        expect(data.mentionsSocieteEmetteur).toEqual({
            denomination: 'Le dossier',
            ligne: 'Société à responsabilité limitée · au capital de 10 000 000 CDF · siège social : 12, avenue de la Justice, Kinshasa',
            manquantes: ["numéro d'immatriculation au RCCM"],
        });
    });
    it('la sélection du dossier porte les faits de la dénomination · mode de la SA et dissolution recopiés', async () => {
        const { svc, create } = service([], null, {
            formeJuridiqueSyscohada: 'SOCIETE_ANONYME',
            rccm: 'CD/KIN/RCCM/26-B-00001',
            modeAdministrationSa: 'CONSEIL_ADMINISTRATION',
            dateDissolution: new Date('2026-06-30'),
            liquidateurs: 'M. Liquidateur',
        });
        await svc.enregistrer('t', dto());
        const recopie = create.mock.calls[0][0].data.mentionsSocieteEmetteur;
        expect(recopie.ligne).toBe('Société en liquidation · liquidateur(s) : M. Liquidateur · Société anonyme avec conseil d’administration · au capital de ' +
            '10 000 000 CDF · siège social : 12, avenue de la Justice, Kinshasa · RCCM CD/KIN/RCCM/26-B-00001');
        expect(recopie.manquantes).toEqual([]);
    });
    it('SUR UN ACHAT, rien n’est recopié · le capital du fournisseur n’est pas connu', async () => {
        const { svc, create } = service();
        await svc.enregistrer('t', dto({ sens: client_1.SensFacture.ACHAT, contrepartieNom: 'Fournisseur SARL' }));
        const data = create.mock.calls[0][0].data;
        expect(data.mentionsSocieteEmetteur).toBe(client_1.Prisma.DbNull);
    });
    it('refuse un n° de série déjà porté par une facture du MÊME sens', async () => {
        const { svc } = service([], { id: 'deja' });
        await expect(svc.enregistrer('t', dto())).rejects.toThrow(/déjà porté/);
    });
    it('refuse un taux de taxe d’un autre dossier, et garde celui du dossier (audit final F120)', async () => {
        const ligne = (tauxTvaId) => [{ designation: 'Conseil', quantite: 1, prixUnitaire: 100_000, montantHT: 100_000, tauxTvaId, tauxApplique: 16, montantTva: 16_000 }];
        const { svc, create } = service();
        await expect(svc.enregistrer('t', dto({ lignes: ligne('voisin') }))).rejects.toThrow(/Taux de taxe introuvable/);
        await svc.enregistrer('t', dto({ lignes: ligne('t16') }));
        const lignes = create.mock.calls[0][0].data.lignes.create;
        expect([create.mock.calls.length, lignes[0].tauxTvaId]).toEqual([1, 't16']);
    });
    it('l’unicité du n° de série est bornée au SENS · la numérotation reçue est celle du fournisseur', async () => {
        const { svc, prisma } = service();
        await svc.enregistrer('t', dto({ sens: client_1.SensFacture.ACHAT }));
        const ou = prisma.facture.findFirst.mock.calls[0][0].where;
        expect(ou.sens).toBe(client_1.SensFacture.ACHAT);
    });
});
describe('F229 · les refus nomment le texte en vigueur à la date de la pièce', () => {
    const EN_2022 = '2022-11-30';
    const EN_2026 = '2026-09-10';
    const refus = async (sur, doublon = null) => {
        const { svc } = service([], doublon);
        try {
            await svc.enregistrer('t', dto(sur));
        }
        catch (e) {
            return e.message;
        }
        throw new Error('aucun refus');
    };
    it('le renvoi se lit dans la liste du texte · tirets de l’art. 100, lettres de l’art. 26', () => {
        expect((0, mentions_facture_1.renvoiALaMention)(new Date(`${EN_2022}T00:00:00Z`), 'DATE_ET_NUMERO')).toBe('troisième tiret de l’art. 100 du décret n° 011/42');
        expect((0, mentions_facture_1.renvoiALaMention)(new Date(`${EN_2026}T00:00:00Z`), 'DATE_ET_NUMERO')).toBe('point c) de l’art. 26 du décret n° 23/10');
        expect((0, mentions_facture_1.renvoiALaMention)(new Date(`${EN_2026}T00:00:00Z`), 'AUTRES_IMPOTS_ET_TAXES')).toBe('point j) de l’art. 26 du décret n° 23/10');
        expect(() => (0, mentions_facture_1.renvoiALaMention)(new Date(`${EN_2022}T00:00:00Z`), 'AUTRES_IMPOTS_ET_TAXES')).toThrow();
    });
    it('le n° de série déjà porté · une pièce de 2022 et une de 2026 ne reçoivent pas le même refus', async () => {
        const ancien = await refus({ dateFacture: EN_2022 }, { id: 'deja' });
        const recent = await refus({ dateFacture: EN_2026 }, { id: 'deja' });
        expect(ancien).not.toBe(recent);
        expect(ancien).toContain((0, mentions_facture_1.renvoiALaMention)(new Date(EN_2022), 'DATE_ET_NUMERO'));
        expect(recent).toContain((0, mentions_facture_1.renvoiALaMention)(new Date(EN_2026), 'DATE_ET_NUMERO'));
        expect(recent).toContain('art. 26 du décret n° 23/10');
        expect(recent).not.toContain('011/42');
    });
    it('l’identité manquante · le texte suit la date, la mention suit le sens', async () => {
        const venteAncienne = await refus({ dateFacture: EN_2022, contrepartieNom: '' });
        const venteRecente = await refus({ dateFacture: EN_2026, contrepartieNom: '' });
        const achatRecent = await refus({ dateFacture: EN_2026, contrepartieNom: '', sens: client_1.SensFacture.ACHAT });
        expect(venteAncienne).not.toBe(venteRecente);
        expect(venteAncienne).toContain((0, mentions_facture_1.renvoiALaMention)(new Date(EN_2022), 'IDENTITE_CLIENT'));
        expect(venteRecente).toContain((0, mentions_facture_1.renvoiALaMention)(new Date(EN_2026), 'IDENTITE_CLIENT'));
        expect(venteRecente).not.toContain('011/42');
        expect(achatRecent).toContain((0, mentions_facture_1.renvoiALaMention)(new Date(EN_2026), 'IDENTITE_VENDEUR'));
    });
});
describe('F117 · une facture barrée par une note de crédit ne se lit pas comme les autres (décret n° 011/42, art. 127)', () => {
    const note = (date) => ({ numeroSerie: 'NC-3', dateFacture: new Date(date) });
    it('barrée par une note DU MOIS · hors des lignes et des totaux, montrée à part', () => {
        const e = (0, etat_detaille_tva_1.construireEtatDetaille)('2026-09', [achat(), achat({ numeroSerie: 'FA-002', annuleePar: note('2026-09-30') })]);
        expect(e.lignes.map((l) => l.numeroFacture)).toEqual(['FA-001']);
        expect(e.totalTva).toBe(8_000);
        expect(e.facturesAnnulees).toEqual([
            expect.objectContaining({ numeroFacture: 'FA-002', noteDeCredit: 'NC-3', dateNote: '2026-09-30', tvaFacturee: 8_000, ecarteeDesTotaux: true }),
        ]);
    });
    it('barrée par une note POSTÉRIEURE · reste sur l’état tel qu’il est parti, et la reprise est dite', () => {
        const e = (0, etat_detaille_tva_1.construireEtatDetaille)('2026-09', [achat({ annuleePar: note('2026-10-01') })]);
        expect(e.lignes).toHaveLength(1);
        expect(e.totalTva).toBe(8_000);
        expect(e.facturesAnnulees[0]).toMatchObject({ ecarteeDesTotaux: false, dateNote: '2026-10-01' });
        expect(e.facturesAnnulees[0].motif).toMatch(/au mois de la note/);
    });
    it('le service lit la note qui barre la facture, et la porte au moteur', async () => {
        const { svc, prisma } = service([
            {
                numeroSerie: 'FA-9',
                dateFacture: new Date('2026-09-04'),
                emetteurNom: 'Fournisseur SARL',
                emetteurNumeroImpot: 'C1111111Z',
                noteDeCredit: { numeroSerie: 'NC-1', dateFacture: new Date('2026-09-20') },
                lignes: [{ designation: 'Papier', quantite: new client_1.Prisma.Decimal(1), montantHT: new client_1.Prisma.Decimal(100), montantTva: new client_1.Prisma.Decimal(16), imposable: true }],
            },
        ]);
        const e = await svc.etatDetaille('t', '2026-09');
        const arg = prisma.facture.findMany.mock.calls[0][0];
        expect(arg.include.noteDeCredit).toEqual({ select: { numeroSerie: true, dateFacture: true } });
        expect(e.lignes).toHaveLength(0);
        expect(e.facturesAnnulees).toEqual([expect.objectContaining({ numeroFacture: 'FA-9', noteDeCredit: 'NC-1', ecarteeDesTotaux: true })]);
    });
});
describe('L’état détaillé ne lit QUE les factures d’achat', () => {
    it('borne sa requête au sens ACHAT et au mois demandé', async () => {
        const { svc, prisma } = service([]);
        await svc.etatDetaille('t', '2026-09');
        const ou = prisma.facture.findMany.mock.calls[0][0].where;
        expect(ou.sens).toBe(client_1.SensFacture.ACHAT);
        const mois = { gte: new Date(Date.UTC(2026, 8, 1)), lt: new Date(Date.UTC(2026, 9, 1)) };
        expect(ou.OR).toEqual([{ dateReception: mois }, { dateReception: null, dateFacture: mois }]);
    });
    it('prend le FOURNISSEUR sur l’émetteur, jamais sur la contrepartie', async () => {
        const { svc, prisma } = service([
            {
                numeroSerie: 'FA-9',
                dateFacture: new Date('2026-09-04'),
                emetteurNom: 'Fournisseur SARL',
                emetteurNumeroImpot: 'C1111111Z',
                contrepartieNom: 'Le dossier',
                contrepartieNumeroImpot: 'A0000000A',
                lignes: [
                    {
                        designation: 'Papier',
                        quantite: new client_1.Prisma.Decimal(10),
                        montantHT: new client_1.Prisma.Decimal(50_000),
                        montantTva: new client_1.Prisma.Decimal(8_000),
                        imposable: true,
                    },
                ],
            },
        ]);
        void prisma;
        const e = await svc.etatDetaille('t', '2026-09');
        expect(e.lignes[0].fournisseurNom).toBe('Fournisseur SARL');
        expect(e.lignes[0].fournisseurNumeroImpot).toBe('C1111111Z');
    });
    it('refuse une période mal formée avant toute lecture de la base', async () => {
        const { svc, prisma } = service([]);
        await expect(svc.etatDetaille('t', '2026')).rejects.toThrow(/AAAA-MM/);
        expect(prisma.facture.findMany).not.toHaveBeenCalled();
    });
});
describe('L’ADRESSE EXACTE · la mention qui rendait le verdict FAUX', () => {
    it('l’art. 26 a) exige TROIS éléments du vendeur, et l’adresse manquait', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ emetteurAdresse: null }), true);
        expect(v.conforme).toBe(false);
        expect(v.manquantes.map((m) => m.cle)).toEqual(['IDENTITE_VENDEUR']);
        expect(v.manquantes[0].libelle).toMatch(/adresse exacte/);
    });
    it('l’art. 26 b) l’exige aussi du client', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ contrepartieAdresse: '   ' }), true);
        expect(v.conforme).toBe(false);
        expect(v.manquantes.map((m) => m.cle)).toEqual(['IDENTITE_CLIENT']);
    });
    it('AUCUNE DÉROGATION n’est fabriquée pour un client non immatriculé', () => {
        expect((0, mentions_facture_1.verifierMentions)(facture({ contrepartieNumeroImpot: null }), true).conforme).toBe(false);
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'mentions-facture.ts'), 'utf8');
        expect(source).not.toMatch(/nonImmatricule|sansNumeroImpot|particulier\s*\?/);
    });
});
describe('LE BORNAGE À L’ENTRÉE EN VIGUEUR · art. 29, 3 mars 2023', () => {
    it('la date est celle de la signature, sans vacatio legis', () => {
        expect(mentions_facture_1.ENTREE_EN_VIGUEUR_DECRET_23_10.toISOString().slice(0, 10)).toBe('2023-03-03');
    });
    it('une pièce ANTÉRIEURE se vérifie contre l’art. 100, et pas contre l’art. 26', () => {
        const ancienne = facture({
            dateFacture: new Date('2022-11-30T00:00:00Z'),
            autresImpotsEtTaxes: null,
        });
        const v = (0, mentions_facture_1.verifierMentions)(ancienne, true);
        expect(v.conforme).toBe(true);
        expect(v.texteApplicable.texte).toMatch(/011\/42/);
        expect(v.texteApplicable.source).toMatch(/ne lui est pas opposable/);
        expect(v.source).toMatch(/011\/42/);
    });
    it('la MÊME pièce au 3 mars 2023 tombe sous les douze de l’art. 26', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({
            dateFacture: new Date('2023-03-03T00:00:00Z'),
            emetteurAdresse: null,
            autresImpotsEtTaxes: null,
        }), true);
        expect(v.conforme).toBe(false);
        expect(v.manquantes.map((m) => m.cle)).toEqual(['IDENTITE_VENDEUR', 'AUTRES_IMPOTS_ET_TAXES']);
        expect(v.texteApplicable.texte).toMatch(/23\/10/);
    });
    it('l’art. 100 réclame l’adresse exacte AUSSI · seul le dixième groupe lui manque', () => {
        const avant = (0, mentions_facture_1.texteApplicable)(new Date('2022-01-01T00:00:00Z'));
        expect(avant.mentions).toHaveLength(9);
        expect(avant.mentions.map((m) => m.cle)).not.toContain('AUTRES_IMPOTS_ET_TAXES');
        expect(avant.mentions.find((m) => m.cle === 'IDENTITE_VENDEUR').libelle).toMatch(/adresse exacte/);
        expect(avant.mentions.find((m) => m.cle === 'IDENTITE_CLIENT').libelle).toMatch(/adresse exacte/);
        expect(avant.source).toMatch(/L’ADRESSE EXACTE lui est réclamée TOUT AUTANT/);
        expect(avant.source).toMatch(/EXCLUT DU DROIT À DÉDUCTION/);
    });
    it('une pièce de 2022 SANS adresse n’est PAS conforme, et l’art. 104 en dit le prix', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({
            dateFacture: new Date('2022-11-30T00:00:00Z'),
            emetteurAdresse: null,
            contrepartieAdresse: null,
            autresImpotsEtTaxes: null,
        }), true);
        expect(v.conforme).toBe(false);
        expect(v.manquantes.map((m) => m.cle)).toEqual(['IDENTITE_VENDEUR', 'IDENTITE_CLIENT']);
        expect(mentions_facture_1.EXCLUSION_DEDUCTION_ART_104.citation).toContain('exclus du droit à déduction');
    });
});
describe('L’ART. 25 · trois supports de déduction, et non un seul', () => {
    it('le texte dit « de façon générale », et le module ne le rend plus EXCLUSIF', () => {
        expect(mentions_facture_1.OBLIGATION_DACCEPTATION.mention).not.toMatch(/n[’']est déductible que si/);
        expect(mentions_facture_1.OBLIGATION_DACCEPTATION.supportsDeDeduction).toHaveLength(3);
        expect(mentions_facture_1.OBLIGATION_DACCEPTATION.supportsDeDeduction.map((s) => s.cas)).toEqual([
            'de façon générale',
            'en cas d’importation',
            'en cas de livraison de biens ou de prestation de services à soi-même',
        ]);
    });
    it('dit lesquels des trois OmegaX ne tient pas', () => {
        const absents = mentions_facture_1.OBLIGATION_DACCEPTATION.supportsDeDeduction.filter((s) => !s.tenuParOmegaX);
        expect(absents.map((s) => s.support)).toEqual([
            'la déclaration de mise à la consommation délivrée par la douane',
            'une facture normalisée à soi-même',
        ]);
        expect(mentions_facture_1.OBLIGATION_DACCEPTATION.reserveSupports).toMatch(/à joindre à la main/);
    });
    it('l’état détaillé nomme l’art. 25, 2° et pas seulement l’imprimé de l’art. 134', () => {
        const e = (0, etat_detaille_tva_1.construireEtatDetaille)('2026-09', []);
        expect(e.voletImportations.motif).toMatch(/art\. 25, 2°/);
        expect(e.voletImportations.motif).toMatch(/LE SUPPORT de la déduction/);
    });
});
describe('L’ARRÊTÉ DE L’ART. 25 · la seconde lacune hors corpus', () => {
    it('la qualification « document en tenant lieu » est dite HYPOTHÈSE, pas acquise', () => {
        expect(mentions_facture_1.HOMOLOGATION.qualificationHypothetique).toMatch(/HYPOTHÈSE/);
        expect(mentions_facture_1.HOMOLOGATION.qualificationHypothetique).toMatch(/art\. 25, dernière phrase/);
        expect(mentions_facture_1.HOMOLOGATION.qualificationHypothetique).toMatch(/n[’']est dans aucune source lue/);
    });
    it('l’anomalie du texte source est signalée et NON tranchée', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'mentions-facture.ts'), 'utf8');
        expect(source).toMatch(/ANOMALIE DU TEXTE SOURCE/);
        expect(source).toMatch(/sans le Journal officiel/);
    });
});
describe('Article 60 du décret n° 011/42 · la mention des débits', () => {
    const aucun = { sensVente: true, regimeExigibiliteTva: 'ENCAISSEMENTS' };
    const debits = { sensVente: true, regimeExigibiliteTva: 'DEBITS' };
    it('une VENTE d’un dossier aux DÉBITS sans la mention n’est PAS conforme', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ mentionTvaDebits: false }), true, debits);
        expect(v.mentionDebitsExigee).toBe(true);
        expect(v.mentionDebitsManquante).toBe(true);
        expect(v.conforme).toBe(false);
        expect(v.mentionDebits.article).toContain('art. 60');
    });
    it('la même vente AVEC la mention est conforme', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ mentionTvaDebits: true }), true, debits);
        expect(v.mentionDebitsManquante).toBe(false);
        expect(v.conforme).toBe(true);
    });
    it('un dossier qui n’est PAS aux débits ne doit rien mentionner', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ mentionTvaDebits: false }), true, aucun);
        expect(v.mentionDebitsExigee).toBe(false);
        expect(v.conforme).toBe(true);
    });
    it('sur un ACHAT, la mention se lit mais ne s’impose pas · c’est le fournisseur qui la doit', () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ mentionTvaDebits: false }), true, {
            sensVente: false,
            regimeExigibiliteTva: 'DEBITS',
        });
        expect(v.mentionDebitsExigee).toBe(false);
        expect(v.conforme).toBe(true);
    });
    it("l'amende de l'art. 97 bis n'est pas CHIFFRÉE ici, et ce silence n'est pas présenté comme une dispense", () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ mentionTvaDebits: false }), true, debits);
        expect(v.manquantes).toHaveLength(0);
        expect(v.mentionDebits.reserveSanction).toContain('NE CHIFFRE AUCUNE AMENDE');
        expect(v.mentionDebits.reserveSanction).toContain("n'est pas une dispense");
        expect(v.mentionDebits.reserveSanction).toContain("TOUTE");
        expect(v.mentionDebits.reserveSanction).toContain('article 97 bis');
    });
    it("CE QUI EST SERVI AU CABINET ne rattache le barème à aucun texte de mentions", () => {
        const v = (0, mentions_facture_1.verifierMentions)(facture({ mentionTvaDebits: false }), true, debits);
        expect(v.mentionDebits.reserveSanction).not.toContain('vise les mentions du décret n° 23/10');
    });
});
describe('le service câble bien le contexte de l’article 60', () => {
    const service = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'facturation.service.ts'), 'utf8');
    it('la requête du dossier ramène le régime d’exigibilité', () => {
        const dossier = service.slice(service.indexOf('private async dossier'), service.indexOf('LE BARÈME'));
        expect(dossier).toContain('regimeExigibiliteTva: true');
    });
    it('les deux appels à verifierMentions passent le sens ET le régime', () => {
        const appels = service.split('verifierMentions(').slice(1);
        expect(appels).toHaveLength(2);
        for (const a of appels) {
            const bloc = a.slice(0, 220);
            expect(bloc).toContain('sensVente');
            expect(bloc).toContain('regimeExigibiliteTva: t.regimeExigibiliteTva');
        }
    });
});
describe("Art. 97 bis · le choix du barème lit la liste partagée", () => {
    it("le service ne réécrit pas sa propre liste de personnes physiques", () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'facturation.service.ts'), 'utf8');
        expect(source).toContain("import { FORMES_PERSONNES_PHYSIQUES } from '../retenues/correspondance-retenues'");
        expect(source).toContain('FORMES_PERSONNES_PHYSIQUES.includes(');
    });
});
//# sourceMappingURL=facturation.spec.js.map