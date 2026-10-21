"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const commercial_service_1 = require("./commercial.service");
const vente_commerciale_1 = require("./vente-commerciale");
describe('Le périmètre du Livre 8 · ce qu’il ne régit PAS', () => {
    it('régit la vente de marchandises entre commerçants', () => {
        const p = (0, vente_commerciale_1.perimetreVenteCommerciale)('MARCHANDISES');
        expect(p.regiParLeLivre8).toBe(true);
        expect(p.article).toMatch(/art\. 234/);
    });
    it('NE régit PAS une prestation de services · art. 235 b)', () => {
        const p = (0, vente_commerciale_1.perimetreVenteCommerciale)('SERVICES');
        expect(p.regiParLeLivre8).toBe(false);
        expect(p.motif).toMatch(/ne régit que la vente de MARCHANDISES/);
    });
    it('NE régit PAS un contrat mixte à part de main-d’œuvre prépondérante', () => {
        const p = (0, vente_commerciale_1.perimetreVenteCommerciale)('MIXTE_SERVICES_PREPONDERANTS');
        expect(p.regiParLeLivre8).toBe(false);
        expect(p.article).toMatch(/235 b\)/);
        expect(p.motif).toMatch(/qualification du cabinet, pas\s+un calcul du logiciel/);
    });
    it('NE régit ni l’usage personnel ni les six régimes particuliers', () => {
        expect((0, vente_commerciale_1.perimetreVenteCommerciale)('USAGE_PERSONNEL').regiParLeLivre8).toBe(false);
        expect((0, vente_commerciale_1.perimetreVenteCommerciale)('USAGE_PERSONNEL').article).toMatch(/235 a\)/);
        const r = (0, vente_commerciale_1.perimetreVenteCommerciale)('REGIME_PARTICULIER');
        expect(r.regiParLeLivre8).toBe(false);
        expect(r.motif).toMatch(/électricité/);
    });
    it('le refus opposé à une ASBL porte sa raison, et ce n’est pas « elle ne vend rien »', () => {
        expect(vente_commerciale_1.MOTIF_HORS_SYCEBNL).toMatch(/ENTRE COMMERÇANTS/);
        expect(vente_commerciale_1.MOTIF_HORS_SYCEBNL).toMatch(/n['’]est pas commerçante/);
        expect(vente_commerciale_1.MOTIF_HORS_SYCEBNL).toMatch(/004\/2001/);
    });
});
const lignesPrecises = [{ designation: 'Ciment 42,5', quantite: 100, prixUnitaire: 25_000 }];
describe('Ce qui fait d’une proposition une OFFRE · art. 241', () => {
    it('les trois conditions réunies font une offre', () => {
        const q = (0, vente_commerciale_1.qualifierOffre)({ destinataireDetermine: true, volonteDEtreLie: true, lignes: lignesPrecises });
        expect(q.estUneOffre).toBe(true);
        expect(q.requalification).toBeNull();
    });
    it('sans destinataire déterminé, ce n’est qu’une INVITATION à l’offre', () => {
        const q = (0, vente_commerciale_1.qualifierOffre)({ destinataireDetermine: false, volonteDEtreLie: true, lignes: lignesPrecises });
        expect(q.estUneOffre).toBe(false);
        expect(q.requalification).toMatch(/INVITATION À L[’']OFFRE/);
    });
    it('des lignes imprécises retirent la qualité d’offre · désignation, quantité ET prix', () => {
        for (const ligne of [
            { designation: '', quantite: 1, prixUnitaire: 10 },
            { designation: 'Ciment', quantite: null, prixUnitaire: 10 },
            { designation: 'Ciment', quantite: 1, prixUnitaire: null },
        ]) {
            const q = (0, vente_commerciale_1.qualifierOffre)({ destinataireDetermine: true, volonteDEtreLie: true, lignes: [ligne] });
            expect(q.manques).toContain('LIGNES_IMPRECISES');
        }
        expect((0, vente_commerciale_1.qualifierOffre)({ destinataireDetermine: true, volonteDEtreLie: true, lignes: [] }).manques).toContain('LIGNES_IMPRECISES');
    });
    it('sans volonté d’être lié, il n’y a pas d’offre non plus', () => {
        const q = (0, vente_commerciale_1.qualifierOffre)({ destinataireDetermine: true, volonteDEtreLie: false, lignes: lignesPrecises });
        expect(q.manques).toEqual(['VOLONTE_DETRE_LIE_NON_EXPRIMEE']);
    });
});
describe('Le délai · deux dates, et une seule le fait courir', () => {
    it('court depuis l’ÉMISSION (art. 246), jamais depuis la réception (art. 242)', () => {
        const limite = (0, vente_commerciale_1.dateLimiteAcceptation)(new Date('2026-09-01T00:00:00Z'), 30);
        expect(limite.toISOString().slice(0, 10)).toBe('2026-10-01');
    });
    it('sans délai stipulé, AUCUNE date n’est inventée · art. 243 renvoie au « délai raisonnable »', () => {
        expect((0, vente_commerciale_1.dateLimiteAcceptation)(new Date('2026-09-01T00:00:00Z'), null)).toBeNull();
        expect(vente_commerciale_1.DELAI_NON_CHIFFRE).toMatch(/délai raisonnable/);
        const e = (0, vente_commerciale_1.etatDevis)({
            dateEmission: new Date('2020-01-01T00:00:00Z'),
            delaiJours: null,
            dateReponse: null,
            natureReponse: null,
            revoqueLe: null,
            reference: new Date('2026-09-13T00:00:00Z'),
        });
        expect(e.etat).toBe('EN_ATTENTE');
    });
    it('la source ne porte AUCUN délai par défaut', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'vente-commerciale.ts'), 'utf8');
        expect(source).not.toMatch(/DELAI_PAR_DEFAUT|delaiJours\s*\?\?\s*\d|DELAI_RAISONNABLE_JOURS/);
    });
});
const base = {
    dateEmission: new Date('2026-09-01T00:00:00Z'),
    delaiJours: 30,
    dateReponse: null,
    natureReponse: null,
    revoqueLe: null,
};
describe('L’état du devis · le silence ne vaut RIEN', () => {
    it('LE DÉLAI ÉCOULÉ SANS RÉPONSE REND CADUC, ni accepté ni refusé', () => {
        const e = (0, vente_commerciale_1.etatDevis)({ ...base, reference: new Date('2026-10-15T00:00:00Z') });
        expect(e.etat).toBe('CADUC');
        expect(e.etat).not.toBe('REFUSE');
        expect(e.explication).toMatch(/NI accepté NI refusé/);
        expect(e.explication).toMatch(/le silence ou l[’']inaction/);
    });
    it('avant l’échéance et sans réponse, il est en attente', () => {
        expect((0, vente_commerciale_1.etatDevis)({ ...base, reference: new Date('2026-09-15T00:00:00Z') }).etat).toBe('EN_ATTENTE');
    });
    it('une MODIFICATION NON SUBSTANTIELLE vaut ACCEPTATION · art. 245, second alinéa', () => {
        const e = (0, vente_commerciale_1.etatDevis)({
            ...base,
            natureReponse: client_1.NatureReponseDevis.MODIFICATION_NON_SUBSTANTIELLE,
            dateReponse: new Date('2026-09-10T00:00:00Z'),
            reference: new Date('2026-09-15T00:00:00Z'),
        });
        expect(e.etat).toBe('ACCEPTE');
        expect(e.explication).toMatch(/termes du contrat sont ceux de l[’']offre avec les/);
    });
    it('une MODIFICATION SUBSTANTIELLE vaut REJET et contre-proposition · art. 245, premier alinéa', () => {
        const e = (0, vente_commerciale_1.etatDevis)({
            ...base,
            natureReponse: client_1.NatureReponseDevis.MODIFICATION_SUBSTANTIELLE,
            dateReponse: new Date('2026-09-10T00:00:00Z'),
            reference: new Date('2026-09-15T00:00:00Z'),
        });
        expect(e.etat).toBe('CONTRE_PROPOSITION');
        expect(e.etat).not.toBe('ACCEPTE');
        expect(e.explication).toMatch(/VAUT REJET/);
    });
    it('une réponse PARVENUE prime sur le délai écoulé · art. 244', () => {
        const e = (0, vente_commerciale_1.etatDevis)({
            ...base,
            natureReponse: client_1.NatureReponseDevis.ACCEPTATION,
            dateReponse: new Date('2026-09-10T00:00:00Z'),
            reference: new Date('2027-01-01T00:00:00Z'),
        });
        expect(e.etat).toBe('ACCEPTE');
    });
    it('F118 · une acceptation parvenue APRÈS le délai stipulé ne forme aucun contrat (art. 243)', () => {
        for (const nature of [client_1.NatureReponseDevis.ACCEPTATION, client_1.NatureReponseDevis.MODIFICATION_NON_SUBSTANTIELLE]) {
            const e = (0, vente_commerciale_1.etatDevis)({ ...base, natureReponse: nature, dateReponse: new Date('2026-10-02T00:00:00Z'), reference: new Date('2026-10-05T00:00:00Z') });
            expect(e.etat).toBe('CADUC');
            expect(e.explication).toMatch(/aucun contrat n’est formé/);
        }
        const aLaLimite = (0, vente_commerciale_1.etatDevis)({ ...base, natureReponse: client_1.NatureReponseDevis.ACCEPTATION, dateReponse: new Date('2026-10-01T00:00:00Z'), reference: new Date('2026-10-05T00:00:00Z') });
        expect(aLaLimite.etat).toBe('ACCEPTE');
        const sansDelai = (0, vente_commerciale_1.etatDevis)({ ...base, delaiJours: null, natureReponse: client_1.NatureReponseDevis.ACCEPTATION, dateReponse: new Date('2027-01-02T00:00:00Z'), reference: new Date('2027-01-05T00:00:00Z') });
        expect(sansDelai.etat).toBe('ACCEPTE');
        expect((0, vente_commerciale_1.etatDevis)({ ...base, natureReponse: client_1.NatureReponseDevis.MODIFICATION_SUBSTANTIELLE, dateReponse: new Date('2026-10-02T00:00:00Z'), reference: new Date('2026-10-05T00:00:00Z') }).etat).toBe('CONTRE_PROPOSITION');
        expect((0, vente_commerciale_1.etatDevis)({ ...base, natureReponse: client_1.NatureReponseDevis.REFUS, dateReponse: new Date('2026-10-02T00:00:00Z'), reference: new Date('2026-10-05T00:00:00Z') }).etat).toBe('REFUSE');
    });
    it('une révocation antérieure à la référence rend l’offre révoquée', () => {
        const e = (0, vente_commerciale_1.etatDevis)({ ...base, revoqueLe: new Date('2026-09-05T00:00:00Z'), reference: new Date('2026-09-10T00:00:00Z') });
        expect(e.etat).toBe('REVOQUE');
    });
});
describe('La révocabilité · un délai seul ne rend pas l’offre ferme', () => {
    it('DEUX CONDITIONS CUMULATIVES · art. 242', () => {
        expect((0, vente_commerciale_1.revocabilite)({ delaiJours: 30, declareeIrrevocable: false, dejaAcceptee: false }).revocable).toBe(true);
        expect((0, vente_commerciale_1.revocabilite)({ delaiJours: null, declareeIrrevocable: true, dejaAcceptee: false }).revocable).toBe(true);
        expect((0, vente_commerciale_1.revocabilite)({ delaiJours: 30, declareeIrrevocable: true, dejaAcceptee: false }).revocable).toBe(false);
    });
    it('une offre déjà acceptée ne se révoque plus', () => {
        expect((0, vente_commerciale_1.revocabilite)({ delaiJours: null, declareeIrrevocable: false, dejaAcceptee: true }).revocable).toBe(false);
    });
    it('la SECONDE branche de l’art. 242 est dite, jamais calculée', () => {
        const r = (0, vente_commerciale_1.revocabilite)({ delaiJours: 30, declareeIrrevocable: false, dejaAcceptee: false });
        expect(r.reserve).toMatch(/raisonnablement fondé à croire/);
        expect(r.reserve).toMatch(/le logiciel ne tranche pas/);
    });
});
function projeter(complet, args) {
    const select = args?.select;
    if (!select)
        return complet;
    return Object.fromEntries(Object.keys(select).filter((k) => select[k] && k in complet).map((k) => [k, complet[k]]));
}
function service(opts = {}) {
    const update = jest.fn().mockImplementation(({ data }) => Promise.resolve({ ...opts.unDevis, ...data, lignes: [] }));
    const create = jest.fn().mockImplementation(({ data }) => {
        const d = data;
        return Promise.resolve({ ...d, id: 'd1', lignes: d.lignes.create.map((l) => ({ ...l })) });
    });
    const prisma = {
        tenant: {
            findUniqueOrThrow: jest.fn().mockImplementation((args) => Promise.resolve(projeter({
                id: 't',
                nom: 'Le dossier',
                referentiel: opts.referentiel ?? client_1.Referentiel.SYSCOHADA,
                formeJuridiqueSyscohada: 'SOCIETE_RESPONSABILITE_LIMITEE',
                capitalSocial: null,
                capitalVariable: false,
                adresse: null,
                ville: null,
                rccm: null,
                devise: 'CDF',
                ...opts.dossier,
            }, args))),
        },
        tiers: { findFirst: jest.fn().mockResolvedValue(null) },
        devis: {
            findMany: jest.fn().mockResolvedValue(opts.devis ?? []),
            count: jest.fn().mockResolvedValue((opts.devis ?? []).length),
            findFirst: jest.fn().mockImplementation((args) => {
                const ou = (args?.where ?? {});
                if ('numero' in ou)
                    return Promise.resolve(null);
                return Promise.resolve(opts.unDevis === undefined ? null : opts.unDevis);
            }),
            create,
            update,
        },
    };
    return { svc: new commercial_service_1.CommercialService(prisma), prisma, create, update };
}
const dto = (sur = {}) => ({
    numero: 'DV-0001',
    dateEmission: '2026-09-01',
    nature: client_1.NatureOperationVente.MARCHANDISES,
    clientNom: 'Client SARL',
    delaiJours: 30,
    lignes: [{ designation: 'Ciment', quantite: 100, prixUnitaire: 25_000, montantHT: 2_500_000 }],
    ...sur,
});
describe('Le service · le refus de périmètre est au SERVEUR, pas seulement à l’écran', () => {
    it('refuse un dossier SYCEBNL avec la raison du texte', async () => {
        const { svc } = service({ referentiel: client_1.Referentiel.SYCEBNL });
        await expect(svc.lister('t')).rejects.toThrow(/ENTRE COMMERÇANTS/);
        await expect(svc.emettre('t', dto())).rejects.toThrow(/n['’]est pas commerçante/);
    });
});
describe('Le service · la contre-proposition ne naît que d’un rejet', () => {
    it('refuse de rattacher une contre-proposition à un devis sans réponse', async () => {
        const { svc } = service({ unDevis: { id: 'p1', natureReponse: null, emetteur: 'DOSSIER', contreProposition: null } });
        await expect(svc.emettre('t', dto({ numero: 'DV-2', contrePropositionDeId: 'p1' }))).rejects.toThrow(/MODIFICATION SUBSTANTIELLE/);
    });
    it('refuse de la rattacher à un devis ACCEPTÉ · le contrat est formé', async () => {
        const { svc } = service({
            unDevis: { id: 'p1', natureReponse: client_1.NatureReponseDevis.ACCEPTATION, emetteur: 'DOSSIER', contreProposition: null },
        });
        await expect(svc.emettre('t', dto({ numero: 'DV-2', contrePropositionDeId: 'p1' }))).rejects.toThrow(/art\. 245/);
    });
    it('INVERSE L’ÉMETTEUR · l’offre nouvelle vient de celui qui a rejeté', async () => {
        const { svc, create } = service({
            unDevis: {
                id: 'p1',
                natureReponse: client_1.NatureReponseDevis.MODIFICATION_SUBSTANTIELLE,
                emetteur: 'DOSSIER',
                contreProposition: null,
            },
        });
        await svc.emettre('t', dto({ numero: 'DV-2', contrePropositionDeId: 'p1' }));
        expect(create.mock.calls[0][0].data.emetteur).toBe('CLIENT');
        expect(create.mock.calls[0][0].data.mentionsSocieteEmetteur).toBe(client_1.Prisma.DbNull);
    });
    it('un devis ÉMIS par le dossier recopie les mentions de l’AUSCGIE art. 17 à sa date', async () => {
        const { svc, create } = service();
        await svc.emettre('t', dto());
        const recopie = create.mock.calls[0][0].data.mentionsSocieteEmetteur;
        expect(recopie.denomination).toBe('Le dossier');
        expect(recopie.ligne).toBe('Société à responsabilité limitée');
        expect(recopie.manquantes).toEqual(['montant du capital social', 'adresse du siège social', "numéro d'immatriculation au RCCM"]);
    });
});
describe('Le service · la sélection du dossier porte les faits de la dénomination', () => {
    it('une SASU déclarée imprime « unipersonnelle » et ne voit plus l’associé unique dans ses manques (AUSCGIE art. 853-2)', async () => {
        const { svc, create } = service({ dossier: { formeJuridiqueSyscohada: 'SOCIETE_PAR_ACTIONS_SIMPLIFIEE', associeUnique: true } });
        await svc.emettre('t', dto());
        const recopie = create.mock.calls[0][0].data.mentionsSocieteEmetteur;
        expect(recopie.ligne).toBe('Société par actions simplifiée unipersonnelle');
        expect(recopie.manquantes).toEqual(['montant du capital social', 'adresse du siège social', "numéro d'immatriculation au RCCM"]);
    });
});
describe('Le service · la réponse est un fait REÇU', () => {
    const devisEnAttente = {
        id: 'd1',
        tenantId: 't',
        emetteur: 'DOSSIER',
        numero: 'DV-1',
        dateEmission: new Date('2026-09-01T00:00:00Z'),
        delaiJours: 30,
        declareeIrrevocable: false,
        destinataireDetermine: true,
        volonteDEtreLie: true,
        nature: client_1.NatureOperationVente.MARCHANDISES,
        clientNom: 'Client SARL',
        natureReponse: null,
        dateReponse: null,
        revoqueLe: null,
        lignes: [],
    };
    it('exige un écrit sur une modification · la substantialité se qualifie', async () => {
        const { svc } = service({ unDevis: devisEnAttente });
        await expect(svc.enregistrerReponse('t', 'd1', {
            natureReponse: client_1.NatureReponseDevis.MODIFICATION_SUBSTANTIELLE,
            dateReponse: '2026-09-10',
        })).rejects.toThrow(/elle se qualifie, elle ne se calcule pas/);
    });
    it('refuse une réponse parvenue APRÈS une révocation · art. 242', async () => {
        const { svc } = service({ unDevis: { ...devisEnAttente, revoqueLe: new Date('2026-09-05T00:00:00Z') } });
        await expect(svc.enregistrerReponse('t', 'd1', {
            natureReponse: client_1.NatureReponseDevis.ACCEPTATION,
            dateReponse: '2026-09-10',
        })).rejects.toThrow(/révoquée avant la date de cette réponse/);
    });
    it('refuse une réponse antérieure à l’émission', async () => {
        const { svc } = service({ unDevis: devisEnAttente });
        await expect(svc.enregistrerReponse('t', 'd1', {
            natureReponse: client_1.NatureReponseDevis.ACCEPTATION,
            dateReponse: '2026-08-01',
        })).rejects.toThrow(/avant que l[’']offre n[’']ait été émise/);
    });
    it('AUCUN CHEMIN DU SERVICE ne pose une réponse ailleurs que sur cet appel', () => {
        const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'commercial.service.ts'), 'utf8');
        const ecritures = source.match(/natureReponse:\s*dto\.natureReponse/g) ?? [];
        expect(ecritures).toHaveLength(1);
        expect(source).not.toMatch(/natureReponse:\s*(NatureReponseDevis\.|'|")/);
    });
});
describe('Le prix du devis', () => {
    it('est un total HORS TAXES, et la présomption est rendue avec · art. 263', async () => {
        const { svc, create } = service();
        const vue = await svc.emettre('t', dto());
        void create;
        expect(vue.totalHT).toBe(2_500_000);
        expect(vue.prixPresume.mention).toMatch(/présumé convenu hors taxes/);
        expect(vue.prixPresume.article).toMatch(/art\. 263/);
    });
    it('la liste rappelle qu’aucune forme n’est imposée · art. 240', async () => {
        const { svc } = service();
        const r = await svc.lister('t');
        expect(r.aucuneConditionDeForme.mention).toMatch(/écrit ou verbal/);
        expect(r.aucuneConditionDeForme.mention).toMatch(/Le devis n[’']est pas obligatoire/);
    });
    it('la liste porte les deux délais de dénonciation · art. 258 et 259', async () => {
        const { svc } = service();
        const r = await svc.lister('t');
        expect(r.delaisDeConformite.map((d) => d.cle)).toEqual(['APPARENT', 'CACHE']);
        expect(r.delaisDeConformite[0].delai).toMatch(/un mois/);
        expect(r.delaisDeConformite[1].delai).toMatch(/un an/);
    });
});
void client_1.Prisma;
//# sourceMappingURL=commercial.spec.js.map