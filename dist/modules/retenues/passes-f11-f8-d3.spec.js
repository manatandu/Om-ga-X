"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const retenues_service_1 = require("./retenues.service");
const correspondance_retenues_1 = require("./correspondance-retenues");
const jour_ouvrable_1 = require("./jour-ouvrable");
const locative = () => correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === 'retenueLocative');
const obligation = (cle) => correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === cle);
const servies = (referentiel, forme = null, faits = {}) => (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(referentiel, forme, faits);
const cles = (referentiel, forme = null, faits = {}) => servies(referentiel, forme, faits).map((o) => o.cle);
const servie = (cle, referentiel, forme = null) => servies(referentiel, forme).find((o) => o.cle === cle);
function service(tenant) {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue(tenant) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue([]) },
        exercice: { findFirst: jest.fn().mockResolvedValue(null) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new retenues_service_1.RetenuesService(prisma);
}
const lireSemis = (fichier) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'comptes', fichier), 'utf8');
describe('Passe F11 · la retenue sur les revenus locatifs', () => {
    it('B1 · le libellé ne porte plus de taux, et la réserve dit le barème provincial kinois', () => {
        expect(locative().libelle).toBe('Retenue sur les revenus locatifs');
        const r = locative().reserve;
        expect(r).toContain('art. 204, 16°');
        expect(r).toContain('n° 015/CAB/MIN.PROV/FIN.ECO/2023');
        expect(r).toContain('de 15 % et 17 % dans celles des 2e, 3e et 4e rangs');
        expect(locative().baseLegale).toContain('TAUX DES TEXTES NATIONAUX');
    });
    it("B2 · le titulaire est la PROVINCE, et le guichet kinois est cité à côté de l'art. 10 de la loi n° 83/004", () => {
        expect(locative().beneficiaire).toBe('PROVINCE');
        const r = locative().reserve;
        expect(r).toContain('« au compte Ville de Kinshasa/Receveur des Recettes Fiscales »');
        expect(r).toContain('« au profit du Trésor »');
    });
    it("B2 · l'échéancier sert bien PROVINCE sur la ligne de la retenue locative (câblage)", async () => {
        const e = await service({ referentiel: 'SYCEBNL' }).echeancierFiscal('t1', {
            exerciceId: 'e1',
            dateReference: '2026-06-15',
        });
        expect(e.echeances.find((x) => x.cle === 'retenueLocative').beneficiaire).toBe('PROVINCE');
    });
    it("B3 et F8-C2 · la citation de l'art. 57, alinéa 4 est entière, relevé compris", () => {
        expect(locative().baseLegale).toContain("« La retenue sur les revenus locatifs est reversée dans les dix jours du mois qui suit celui du paiement " +
            "de loyer, à l'aide d'un relevé conforme au modèle fixé par l'Administration des Impôts. »");
        expect(locative().baseLegale).toContain('Article 57, alinéa 4');
    });
    it('B3 · le relevé par bailleur et ses mentions sont servis, avec ce que le logiciel ne détient pas', async () => {
        expect(locative().contenu).toContain('relevé daté et signé');
        expect(locative().contenu).toContain('surface développée');
        expect(locative().sourceDonnees).toContain('ni sa surface développée');
        const s = service({ referentiel: 'SYCEBNL' });
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        expect(r.natures.find((n) => n.cle === 'retenueLocative').contenu).toBe(locative().contenu);
        const e = await s.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const ligne = e.echeances.find((x) => x.cle === 'retenueLocative');
        expect(ligne.contenu).toBe(locative().contenu);
        expect(ligne.sourceDonnees).toBe(locative().sourceDonnees);
    });
    it('B4 · la charge exposée est le loyer d’immeuble, sur des comptes ouverts aux DEUX semis', () => {
        const c = locative().chargeSousConditionArticle20;
        expect(c).toContain('6221 locations de terrains, 6222 locations de bâtiments, 6226 fermages et loyers du foncier');
        expect(c).toContain('« Le revenu brut comprend éventuellement le loyer des meubles');
        for (const semis of ['compte-seed.ts', 'compte-seed-syscohada.ts']) {
            const texte = lireSemis(semis);
            expect(texte).toMatch(/'62210000', 'Locations de terrains'/);
            expect(texte).toMatch(/'62220000', 'Locations de bâtiments'/);
            expect(texte).toMatch(/'62260000', 'Fermages et loyers du foncier'/);
            expect(texte).toMatch(/'62280000', 'Locations et charges locatives diverses'/);
        }
    });
    it("B5 · la borne de l'art. 57 et le délai plus court de la loi n° 83/004, art. 11, sont dits", () => {
        const r = locative().reserve;
        expect(r).toContain('« reversé dans les dix jours qui suivent le paiement du loyer »');
        expect(r).toContain('en vigueur depuis le 1er janvier 2026 (loi n° 23/052, art. 1er et 6)');
    });
    it('B6 · la déclaration annuelle du bailleur est servie aux deux référentiels, au 1er février', async () => {
        expect(cles('SYCEBNL')).toContain('declarationRevenusLocatifs');
        expect(cles('SYSCOHADA', 'SOCIETE_ANONYME')).toContain('declarationRevenusLocatifs');
        const o = obligation('declarationRevenusLocatifs');
        expect([o.moisEcheance, o.jourEcheance]).toEqual([2, 1]);
        const r = servie('declarationRevenusLocatifs', 'SYCEBNL').reserve;
        expect(r).toContain('À TENIR POUR DUE SEULEMENT SI LE DOSSIER EST BAILLEUR');
        expect(r).toContain('circulaire ministérielle n° 0023');
        expect(r).toContain("l'impôt foncier (art. 6)");
        const e = await service({ referentiel: 'SYCEBNL' }).echeancierFiscal('t1', {
            exerciceId: 'e1',
            dateReference: '2026-12-01',
        });
        const ligne = e.echeances.find((x) => x.cle === 'declarationRevenusLocatifs');
        expect(ligne.date.toISOString().slice(0, 10)).toBe('2027-02-01');
        expect(ligne.reserve).toContain('BAILLEUR');
    });
});
describe('Passe D3 · la certification des états financiers (arrêté n° 014 du 16 mai 2023)', () => {
    it("la déclaration d'impôt sur les sociétés cite l'indépendance, le refus et la taxation d'office", () => {
        const c = obligation('declarationImpotSocietes').contenu;
        expect(c).toContain('n° 014 du 16 mai 2023');
        expect(c).toContain("Expert-comptable indépendant de l'entité établissant les états financiers");
        expect(c).toContain('« assimilée à un refus de certification » (art. 14)');
        expect(c).toContain("« d'une taxation d'office pour comptabilité irrégulière au sens de l'article 41 »");
        expect(c).toContain('« timbre spécial ou hologramme » (art. 20 et 22)');
    });
    it("la dérogation de l'art. 7 est servie en réserve à la société, sans être tranchée", () => {
        const r = servie('declarationImpotSocietes', 'SYSCOHADA', 'SOCIETE_RESPONSABILITE_LIMITEE').reserve;
        expect(r).toContain("« Par dérogation à l'article 5 du présent Arrêté");
        expect(r).toContain("n'est pas tranchée ici");
        expect(r).toContain("« à compter de l'exercice fiscal 2024/revenus 2023 » (art. 28)");
    });
    it('la désignation du certificateur est une obligation datée, avec la sanction de l’art. 15', () => {
        expect(cles('SYSCOHADA', 'SOCIETE_ANONYME')).toContain('designationCertificateur');
        expect(cles('SYSCOHADA', null)).toContain('designationCertificateur');
        expect(cles('SYSCOHADA', 'ENTREPRISE_INDIVIDUELLE')).not.toContain('designationCertificateur');
        expect(cles('SYCEBNL')).not.toContain('designationCertificateur');
        const o = obligation('designationCertificateur');
        expect([o.moisEcheance, o.jourEcheance]).toEqual([6, 29]);
        expect(o.sanction).toContain("au sens de l'article 41 de la loi n° 004/2003 (arrêté n° 014, art. 15)");
        expect(servie('designationCertificateur', 'SYSCOHADA', 'SOCIETE_ANONYME').reserve).toContain('ONEC n° 2024/001, § 15');
    });
});
describe('Passe F8 · les relevés et listes de la loi de procédures fiscales', () => {
    it("A1 · l'entité publique SYSCOHADA reçoit le relevé trimestriel, avec la réserve sur l'économie mixte", () => {
        expect(cles('SYSCOHADA', 'ENTITE_PUBLIQUE')).toContain('releveTrimestrielTiers');
        expect(servie('releveTrimestrielTiers', 'SYSCOHADA', 'ENTITE_PUBLIQUE').reserve).toContain("« les entreprises publiques ou d'économie mixte »");
        expect(cles('SYSCOHADA', 'SOCIETE_RESPONSABILITE_LIMITEE')).not.toContain('releveTrimestrielTiers');
        expect(cles('SYSCOHADA', null)).not.toContain('releveTrimestrielTiers');
        expect(servie('releveTrimestrielTiers', 'SYCEBNL').reserve).toBeNull();
    });
    it("A1 · câblage · l'échéancier sert le relevé au dossier d'entité publique", async () => {
        const e = await service({ referentiel: 'SYSCOHADA', formeJuridiqueSyscohada: 'ENTITE_PUBLIQUE' }).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        expect(e.echeances.map((x) => x.cle)).toContain('releveTrimestrielTiers');
    });
    it('A2 · le relevé trimestriel lit aussi le 481, ouvert aux deux semis', () => {
        expect(obligation('releveTrimestrielTiers').sourceDonnees).toContain("481 (fournisseurs d'investissements)");
        for (const semis of ['compte-seed.ts', 'compte-seed-syscohada.ts']) {
            expect(lireSemis(semis)).toMatch(/'481', ["']Fournisseurs d['’]investissements/);
        }
    });
    it("A3 · la liste des fournisseurs porte, à l'EBNL, la question de l'exemption", () => {
        const r = servie('listeFournisseurs', 'SYCEBNL').reserve;
        expect(r).toContain('« toute personne physique ou morale');
        expect(r).toContain('La loi de procédures fiscales, art. 3, dispense les personnes exemptées');
        expect(servie('listeFournisseurs', 'SYSCOHADA', 'SOCIETE_ANONYME').reserve).toBeNull();
    });
    it('A4 · la liste des clients est servie, et tombe sur un « non » DÉCLARÉ aux ventes seulement', async () => {
        expect(cles('SYCEBNL')).toContain('listeClients');
        expect(cles('SYSCOHADA', 'SOCIETE_ANONYME')).toContain('listeClients');
        expect(cles('SYCEBNL', null, { venteBiensServices: null })).toContain('listeClients');
        expect(cles('SYCEBNL', null, { venteBiensServices: false })).not.toContain('listeClients');
        expect(servie('listeClients', 'SYCEBNL').reserve).toContain('QUALITÉ DU DÉCLARANT');
        const avecNon = await service({ referentiel: 'SYSCOHADA', venteBiensServices: false }).echeancierFiscal('t1', {
            exerciceId: 'e1',
            dateReference: '2026-06-15',
        });
        expect(avecNon.echeances.map((x) => x.cle)).not.toContain('listeClients');
        const avecOui = await service({ referentiel: 'SYSCOHADA', venteBiensServices: true }).echeancierFiscal('t1', {
            exerciceId: 'e1',
            dateReference: '2026-06-15',
        });
        expect(avecOui.echeances.map((x) => x.cle)).toContain('listeClients');
    });
    it('C3 · le service cite l’alinéa 4 de l’art. 57 pour la retenue locative', () => {
        const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'retenues.service.ts'), 'utf8');
        expect(source).toContain('alinéa 4 pour la retenue locative');
    });
    it("C4 · la première quotité recopie l'art. 57 quater, al. 2, et la tension avec l'art. 17 est servie", () => {
        expect(obligation('premiereQuotitePetiteEntreprise').contenu).toContain('« La 1ère quotité visée à l\'alinéa précédent du présent article est payée à la souscription de la déclaration auto liquidative');
        expect(servie('declarationIrpp', 'SYSCOHADA', 'ENTREPRENANT').reserve).toContain("« à la souscription de la déclaration auto liquidative");
    });
    it('D1 · la réserve du report distingue la déclaration (guichet) du paiement (intervenant)', () => {
        expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('que la DÉCLARATION se dépose auprès des services de la DGI');
        expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('décret n° 20/019 du 21 août 2020, art. 1er et 2');
        expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain('le samedi 25 juillet 2026 reste le 25 juillet');
        expect(jour_ouvrable_1.RESERVE_JOUR_OUVRABLE).toContain("n'est pas suivi");
    });
});
//# sourceMappingURL=passes-f11-f8-d3.spec.js.map