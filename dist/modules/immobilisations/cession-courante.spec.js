"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const client_1 = require("@prisma/client");
const immobilisation_service_1 = require("./immobilisation.service");
const regularisation_service_1 = require("../regularisation/regularisation.service");
const client_2 = require("@prisma/client");
const lire = (p) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, p), 'utf8');
describe('sortie d’immobilisation · cession courante', () => {
    it('vise les comptes que le plan SYSCOHADA porte réellement', () => {
        expect(immobilisation_service_1.COMPTES_CESSION_COURANTE.INCORPORELLE).toEqual({
            valeurComptable: '65410000',
            produitCession: '75410000',
        });
        expect(immobilisation_service_1.COMPTES_CESSION_COURANTE.CORPORELLE).toEqual({
            valeurComptable: '65420000',
            produitCession: '75420000',
        });
    });
    it('n’ouvre AUCUN compte de cession courante à une immobilisation financière', () => {
        expect(immobilisation_service_1.COMPTES_CESSION_COURANTE.FINANCIERE).toBeUndefined();
        expect(immobilisation_service_1.COMPTES_SORTIE.FINANCIERE).toEqual({ valeurComptable: '81600000', produitCession: '82600000' });
    });
    it('ne crée pas de compte 654 ou 754 non subdivisé, que le plan ne porte pas', () => {
        const service = lire('./immobilisation.service.ts');
        expect(service).not.toContain('65400000');
        expect(service).not.toContain('75400000');
    });
    it('les quatre comptes d’imputation sont bien semés au plan SYSCOHADA, et absents du SYCEBNL', () => {
        const syscohada = lire('../comptes/compte-seed-syscohada.ts');
        for (const numero of ['65410000', '65420000', '75410000', '75420000']) {
            expect(`${numero}: ${syscohada.includes(`'${numero}'`)}`).toBe(`${numero}: true`);
        }
        const sycebnl = lire('../comptes/compte-seed.ts');
        expect(sycebnl).toContain('Dons en nature courants');
    });
    it('refuse la cession courante hors SYSCOHADA et hors nature amortissable, côté serveur', () => {
        const service = lire('./immobilisation.service.ts');
        expect(service).toContain('if (referentiel !== Referentiel.SYSCOHADA)');
        expect(service).toContain('const courants = COMPTES_CESSION_COURANTE[nature]');
        expect(service).toContain('if (!courants)');
    });
    it('range chaque nature sur sa racine de compte', () => {
        expect((0, immobilisation_service_1.natureImmobilisation)('21100000', client_1.Referentiel.SYSCOHADA)).toBe('INCORPORELLE');
        expect((0, immobilisation_service_1.natureImmobilisation)('24410000', client_1.Referentiel.SYSCOHADA)).toBe('CORPORELLE');
        expect((0, immobilisation_service_1.natureImmobilisation)('26100000', client_1.Referentiel.SYSCOHADA)).toBe('FINANCIERE');
    });
});
describe('régularisation · la date de reprise suit le type', () => {
    const cible = { dateDebut: new Date('2027-01-01'), dateFin: new Date('2027-12-31') };
    it('reprend le 476 et le 477 à l’OUVERTURE · le SYSCOHADA le recommande, le Guide SYCEBNL l’écrit', () => {
        expect((0, regularisation_service_1.dateReprise)(client_2.TypeRegularisation.CHARGE_CONSTATEE_AVANCE, cible)).toEqual(cible.dateDebut);
        expect((0, regularisation_service_1.dateReprise)(client_2.TypeRegularisation.PRODUIT_CONSTATE_AVANCE, cible)).toEqual(cible.dateDebut);
    });
    it('laisse la subvention pluriannuelle à la clôture', () => {
        expect((0, regularisation_service_1.dateReprise)(client_2.TypeRegularisation.SUBVENTION_PLURIANNUELLE, cible)).toEqual(cible.dateFin);
    });
});
//# sourceMappingURL=cession-courante.spec.js.map