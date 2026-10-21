"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const nomenclature_stocks_1 = require("./nomenclature-stocks");
const racineDepot = (0, node_path_1.join)(__dirname, '..', '..', '..');
function semis(chemin) {
    const source = (0, node_fs_1.readFileSync)((0, node_path_1.join)(racineDepot, chemin), 'utf8');
    const paires = new Map();
    const motifs = [
        /['"]([0-9]{2,8})['"],\s*'([^']*)'/g,
        /['"]([0-9]{2,8})['"],\s*"([^"]*)"/g,
    ];
    for (const motif of motifs) {
        let trouve;
        while ((trouve = motif.exec(source)) !== null) {
            if (!paires.has(trouve[1]))
                paires.set(trouve[1], trouve[2]);
        }
    }
    return paires;
}
const SEMIS = {
    [client_1.Referentiel.SYCEBNL]: semis('src/modules/comptes/compte-seed.ts'),
    [client_1.Referentiel.SYSCOHADA]: semis('src/modules/comptes/compte-seed-syscohada.ts'),
};
function intituleSeme(referentiel, racine) {
    const table = SEMIS[referentiel];
    return table.get(racine) ?? table.get(racine.padEnd(8, '0'));
}
describe('Nomenclature des stocks · la prémisse se vérifie contre les deux semis', () => {
    it('le recensement trouve quelque chose · un garde-fou vide ne vérifie rien', () => {
        expect(SEMIS[client_1.Referentiel.SYCEBNL].size).toBeGreaterThan(500);
        expect(SEMIS[client_1.Referentiel.SYSCOHADA].size).toBeGreaterThan(500);
    });
    it.each([client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA])('chaque racine de stock ET son compte de variation sont ouverts au plan · %s', (referentiel) => {
        for (const c of (0, nomenclature_stocks_1.correspondancesDuReferentiel)(referentiel)) {
            expect(intituleSeme(referentiel, c.racine)).toBeDefined();
            expect(intituleSeme(referentiel, c.variation)).toBeDefined();
        }
    });
    it.each([client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA])('chaque compte de VARIATION est IMPUTABLE, jamais un en-tête de division · %s', (referentiel) => {
        const table = SEMIS[referentiel];
        for (const c of (0, nomenclature_stocks_1.correspondancesDuReferentiel)(referentiel)) {
            expect({
                compte: c.variation,
                semeCommeImputable: table.has(c.variation.padEnd(8, '0')),
            }).toEqual({ compte: c.variation, semeCommeImputable: true });
        }
    });
    it.each([client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA])('chaque racine hors variation automatique existe bien au plan · %s', (referentiel) => {
        for (const h of nomenclature_stocks_1.STOCKS_HORS_VARIATION_AUTOMATIQUE) {
            if (!h.referentiels.includes(referentiel))
                continue;
            expect(intituleSeme(referentiel, h.racine)).toBeDefined();
        }
    });
});
describe('Nomenclature des stocks · UN NUMÉRO, DEUX SENS, et le plan le confirme', () => {
    const DISCRIMINANTS = [
        ['31', 'Marchandises', 'Biens liés'],
        ['34', 'Produits en cours', 'Dons en nature'],
        ['36', 'Produits finis', 'intermédiaires'],
        ['60310000', 'marchandises', 'biens et services liés'],
        ['60320000', 'matières premières', 'marchandises'],
    ];
    it.each(DISCRIMINANTS)('le %s ne veut pas dire la même chose dans les deux plans', (numero, motSyscohada, motSycebnl) => {
        const seyscohada = intituleSeme(client_1.Referentiel.SYSCOHADA, numero);
        const sycebnl = intituleSeme(client_1.Referentiel.SYCEBNL, numero);
        expect(seyscohada).toBeDefined();
        expect(sycebnl).toBeDefined();
        expect(seyscohada).toContain(motSyscohada);
        expect(sycebnl).toContain(motSycebnl);
        expect(seyscohada).not.toEqual(sycebnl);
    });
    it('le 31 part au 6031 des DEUX côtés, et ce n’est pas la même variation', () => {
        const societe = (0, nomenclature_stocks_1.variationDuCompte)('31100000', client_1.Referentiel.SYSCOHADA);
        const association = (0, nomenclature_stocks_1.variationDuCompte)('31100000', client_1.Referentiel.SYCEBNL);
        expect(societe?.variation).toBe('6031');
        expect(association?.variation).toBe('6031');
        expect(societe?.intitule).toBe('Marchandises');
        expect(association?.intitule).toBe("Biens liés à l'activité");
        expect(intituleSeme(client_1.Referentiel.SYSCOHADA, '60310000')).toContain('marchandises');
        expect(intituleSeme(client_1.Referentiel.SYCEBNL, '60310000')).toContain('biens et services liés');
    });
});
describe('Nomenclature des stocks · la plus longue racine l’emporte', () => {
    it('le 32 du SYCEBNL se sépare en DEUX comptes de variation', () => {
        expect((0, nomenclature_stocks_1.variationDuCompte)('32100000', client_1.Referentiel.SYCEBNL)?.variation).toBe('6032');
        expect((0, nomenclature_stocks_1.variationDuCompte)('32300000', client_1.Referentiel.SYCEBNL)?.variation).toBe('6033');
        expect((0, nomenclature_stocks_1.variationDuCompte)('32500000', client_1.Referentiel.SYCEBNL)?.variation).toBe('6033');
    });
    it('le 37 du SYSCOHADA sépare produits intermédiaires et produits résiduels', () => {
        expect((0, nomenclature_stocks_1.variationDuCompte)('37100000', client_1.Referentiel.SYSCOHADA)?.variation).toBe('7371');
        expect((0, nomenclature_stocks_1.variationDuCompte)('37200000', client_1.Referentiel.SYSCOHADA)?.variation).toBe('7372');
    });
    it('un compte hors classe 3 ne rend aucune variation', () => {
        expect((0, nomenclature_stocks_1.variationDuCompte)('60110000', client_1.Referentiel.SYSCOHADA)).toBeNull();
        expect((0, nomenclature_stocks_1.variationDuCompte)('41100000', client_1.Referentiel.SYCEBNL)).toBeNull();
    });
});
describe('Nomenclature des stocks · ce qui est NOMMÉ hors de la variation automatique', () => {
    it('les dons en nature du SYCEBNL portent leur motif, et il parle d’extourne', () => {
        const don = (0, nomenclature_stocks_1.motifHorsVariation)('34100000', client_1.Referentiel.SYCEBNL);
        expect(don).not.toBeNull();
        expect(don?.motif).toContain('EXTOURNÉES');
        expect(don?.motif).toContain('4713');
        expect((0, nomenclature_stocks_1.variationDuCompte)('34100000', client_1.Referentiel.SYCEBNL)).toBeNull();
    });
    it('le même 34 est un stock ORDINAIRE au SYSCOHADA · produits en cours', () => {
        expect((0, nomenclature_stocks_1.motifHorsVariation)('34100000', client_1.Referentiel.SYSCOHADA)).toBeNull();
        expect((0, nomenclature_stocks_1.variationDuCompte)('34100000', client_1.Referentiel.SYSCOHADA)?.variation).toBe('7341');
    });
    it('les stocks en cours de route 381 à 383 du SYSCOHADA ont LEUR 603 · la nature est dans le numéro', () => {
        for (const [compte, variation] of [
            ['38100000', '6031'],
            ['38200000', '6032'],
            ['38300000', '6033'],
        ]) {
            expect((0, nomenclature_stocks_1.motifHorsVariation)(compte, client_1.Referentiel.SYSCOHADA)).toBeNull();
            expect((0, nomenclature_stocks_1.variationDuCompte)(compte, client_1.Referentiel.SYSCOHADA)?.variation).toBe(variation);
        }
        expect((0, nomenclature_stocks_1.motifHorsVariation)('38600000', client_1.Referentiel.SYSCOHADA)?.motif).toContain('ANOMALIE DU TEXTE');
        expect((0, nomenclature_stocks_1.motifHorsVariation)('38710000', client_1.Referentiel.SYSCOHADA)?.racine).toBe('387');
        const routeEbnl = (0, nomenclature_stocks_1.motifHorsVariation)('37200000', client_1.Referentiel.SYCEBNL);
        expect(routeEbnl?.motif).toContain('603');
        expect((0, nomenclature_stocks_1.variationDuCompte)('38100000', client_1.Referentiel.SYCEBNL)).toBeNull();
    });
    it('la dépréciation n’est pas une variation · elle passe par le 6593 et le 7593', () => {
        for (const r of [client_1.Referentiel.SYCEBNL, client_1.Referentiel.SYSCOHADA]) {
            const dep = (0, nomenclature_stocks_1.motifHorsVariation)('39100000', r);
            expect(dep?.motif).toContain('6593');
            expect(dep?.motif).toContain('7593');
            expect((0, nomenclature_stocks_1.variationDuCompte)('39100000', r)).toBeNull();
        }
    });
});
describe('388 · hors de la variation automatique, avec SON mécanisme', () => {
    it('le 388 du SYSCOHADA n’est pas servi comme un stock en cours de route', () => {
        const m = (0, nomenclature_stocks_1.motifHorsVariation)('38800000', client_1.Referentiel.SYSCOHADA);
        expect(m?.racine).toBe('388');
        expect(m?.motif).toContain('le compte 388 est SOLDÉ par le débit du compte 603');
        expect((0, nomenclature_stocks_1.variationDuCompte)('38100000', client_1.Referentiel.SYSCOHADA)?.variation).toBe('6031');
    });
    it('le 378 du SYCEBNL est le même objet, avec son motif propre et sans la règle de l’AUDCIF', () => {
        const m = (0, nomenclature_stocks_1.motifHorsVariation)('37800000', client_1.Referentiel.SYCEBNL);
        expect(m?.racine).toBe('378');
        expect(m?.motif).toContain('OmegaX ne transpose pas');
        expect((0, nomenclature_stocks_1.motifHorsVariation)('37100000', client_1.Referentiel.SYCEBNL)?.racine).toBe('37');
    });
});
//# sourceMappingURL=nomenclature-stocks.spec.js.map