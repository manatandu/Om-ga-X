"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const compte_seed_1 = require("./compte-seed");
describe('comptes principaux (2 chiffres)', () => {
    const totaux = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.numero.length === 2);
    const detail = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.numero.length > 2);
    it('sème un en-tête de division par regroupement officiel, tous en type Total', () => {
        expect(totaux).toHaveLength(84);
        expect(totaux.every((c) => c.typeCompte === 'TOTAL')).toBe(true);
    });
    it("n'entre jamais en collision avec le numéro d'un compte Détail", () => {
        const numerosDetail = new Set(detail.map((c) => c.numero));
        for (const t of totaux) {
            expect(numerosDetail.has(t.numero)).toBe(false);
        }
    });
    it('confirme la raison du non-complètement à 8 chiffres : ça collisionnerait', () => {
        const numerosDetail = new Set(detail.map((c) => c.numero));
        const auraitCollisionne = totaux.some((t) => numerosDetail.has(`${t.numero}000000`.slice(0, 8)));
        expect(auraitCollisionne).toBe(true);
    });
    it('regroupe au moins un compte Détail réel, sans quoi l’en-tête serait orphelin', () => {
        const ANALYTIQUE_LIBRE = new Set(['92', '93', '94', '95', '96', '97', '98', '99']);
        for (const t of totaux) {
            const enfants = detail.filter((d) => d.numero.startsWith(t.numero) && d.classe === t.classe);
            if (ANALYTIQUE_LIBRE.has(t.numero)) {
                expect(enfants).toHaveLength(0);
                continue;
            }
            expect(enfants.length).toBeGreaterThan(0);
        }
    });
    it('ne regroupe jamais un compte Détail d’une autre division', () => {
        const dix = totaux.find((t) => t.numero === '10');
        const onze = detail.filter((d) => d.numero.startsWith('11'));
        expect(onze.some((d) => d.numero.startsWith(dix.numero) && d.numero[1] !== '0')).toBe(false);
    });
    it('un compte à 2 chiffres ne peut pas naître autrement que de ce semis', () => {
        expect(totaux.every((c) => !/^\d{3,13}$/.test(c.numero))).toBe(true);
    });
});
describe('comptes divisionnaires (3 chiffres)', () => {
    const divisionnaires = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.numero.length === 3);
    const detail = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.numero.length > 3);
    it('sème un en-tête par regroupement à 3 chiffres réellement subdivisé, tous en type Total', () => {
        expect(divisionnaires).toHaveLength(172);
        expect(divisionnaires.every((c) => c.typeCompte === 'TOTAL')).toBe(true);
    });
    it("n'entre jamais en collision avec le numéro d'un compte Détail", () => {
        const numerosDetail = new Set(detail.map((c) => c.numero));
        for (const t of divisionnaires) {
            expect(numerosDetail.has(t.numero)).toBe(false);
        }
    });
    it('regroupe au moins un compte Détail réel, sans quoi l’en-tête serait orphelin', () => {
        for (const t of divisionnaires) {
            const enfants = detail.filter((d) => d.numero.startsWith(t.numero) && d.classe === t.classe);
            expect(enfants.length).toBeGreaterThan(0);
        }
    });
    it('un code à 3 chiffres sans subdivision reste un compte de détail, pas un doublon Total', () => {
        expect(divisionnaires.some((t) => t.numero === '103')).toBe(false);
        const droitEntree = compte_seed_1.PLAN_COMPTES_SYCEBNL.find((c) => c.numero === '10300000');
        expect(droitEntree?.typeCompte).not.toBe('TOTAL');
    });
    it('les deux anomalies de numérotation (832, 842) sont volontairement omises', () => {
        expect(divisionnaires.some((t) => t.numero === '832')).toBe(false);
        expect(divisionnaires.some((t) => t.numero === '842')).toBe(false);
    });
    it('un compte à 3 chiffres ne peut pas naître autrement que de ce semis', () => {
        expect(divisionnaires.every((c) => !/^\d{4,13}$/.test(c.numero))).toBe(true);
    });
});
describe('intitulés relus sur le plan des comptes officiel', () => {
    const parNumero = new Map(compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => [c.numero, c.intitule]));
    const RELUS = [
        ['45210000', 'Fondations et assimilées · apporteurs en nature'],
        ['45220000', 'Fondations et assimilées · apporteurs en numéraire'],
        ['45250000', 'Fondations et assimilées · fondateurs, dirigeants, comptes courants'],
        ['45310000', 'Ordres professionnels · apporteurs en nature'],
        ['45320000', 'Ordres professionnels · apporteurs en numéraire'],
        ['45350000', 'Ordres professionnels · membres, dirigeants, comptes courants'],
        ['45410000', 'Organisations politiques · apporteurs en nature'],
        ['45420000', 'Organisations politiques · apporteurs en numéraire'],
        ['45450000', 'Organisations politiques · adhérents, dirigeants, comptes courants'],
        ['45510000', 'Organisations syndicales · apporteurs en nature'],
        ['45520000', 'Organisations syndicales · apporteurs en numéraire'],
        ['45550000', 'Organisations syndicales · adhérents, dirigeants, comptes courants'],
        ['47110000', 'Débiteurs divers'],
        ['47120000', 'Créditeurs divers'],
        ['44210000', "État, impôts et taxes d'État"],
        ['41310000', 'Adhérents, chèques impayés'],
        ['41320000', 'Clients-usagers, chèques impayés'],
        ['41330000', 'Adhérents, autres valeurs impayées'],
        ['41380000', 'Clients-usagers, autres valeurs impayées'],
        ['41810000', 'Adhérents, appels de fonds à établir'],
        ['41820000', 'Clients-usagers, factures à établir'],
        ['41910000', 'Adhérents, avances reçues'],
        ['41920000', 'Clients-usagers, avances et acomptes reçus'],
        ['41940000', 'Clients-usagers, dettes pour emballages et matériels consignés'],
        ['41980000', 'Clients-usagers, rabais, remises, ristournes et autres avoirs à accorder'],
        ['66900000', 'Dégrèvements et annulations des charges sociales'],
        ['60310000', "Variations des stocks de biens et services liés à l'activité"],
        ['24910000', 'Matériel et outillage industriel et commercial en cours'],
        ['24920000', 'Matériel et outillage agricole en cours'],
        ['24930000', "Matériel d'emballage récupérable et identifiable en cours"],
        ['24940000', 'Matériel et mobilier de bureau en cours'],
        ['24980000', 'Autres matériels et actifs biologiques en cours'],
        ['29470000', 'Dépréciations du matériel · agencements et aménagements du matériel et des actifs biologiques'],
        ['44781000', 'État, retenue sur les revenus locatifs'],
        ['44782000', 'État, prélèvement sur prestataires non-résidents'],
        ['44783000', 'État, prélèvement exceptionnel sur le personnel expatrié'],
        ['44784000', 'État, retenue sur les revenus de capitaux mobiliers'],
        ['44785000', 'État, retenue sur les plus-values (20 %)'],
    ];
    it.each(RELUS)('%s porte l’intitulé du texte officiel', (numero, intitule) => {
        expect(parNumero.get(numero)).toBe(intitule);
    });
    it('498 porte la dépréciation, pas la créance', () => {
        expect(parNumero.get('498')).toBe('Dépréciations des comptes de créances H.A.O.');
    });
    describe('subdivisions rendues par le plan des comptes', () => {
        it('479 est développé en symétrie du 478', () => {
            const passif = compte_seed_1.PLAN_COMPTES_SYCEBNL.filter((c) => c.numero.startsWith('479') && c.numero.length === 8);
            expect(passif.map((c) => c.numero)).toEqual([
                '47911000',
                '47918000',
                '47920000',
                '47931000',
                '47938000',
                '47940000',
                '47970000',
                '47980000',
            ]);
            expect(parNumero.has('47900000')).toBe(false);
        });
        it('501 et 506 sont développés au lieu de rester des comptes uniques', () => {
            expect(parNumero.get('50110000')).toBe('Titres du Trésor à court terme');
            expect(parNumero.get('50120000')).toBe("Titres d'organismes financiers");
            expect(parNumero.get('50130000')).toBe('Bons de caisse à court terme');
            expect(parNumero.get('50610000')).toBe('Intérêts courus · titres du Trésor et bons de caisse à court terme');
            expect(parNumero.get('50620000')).toBe('Intérêts courus · actions');
            expect(parNumero.get('50630000')).toBe('Intérêts courus · obligations');
            expect(parNumero.has('50100000')).toBe(false);
            expect(parNumero.has('50600000')).toBe(false);
        });
    });
});
describe('passe R5, C3 · les subdivisions que la fiche du compte énumère sont semées', () => {
    it('6276 « Cadeaux à la clientèle » et 6344 « Redevances pour marques » (Partie 2 ch. 3, classe 6)', () => {
        const intitule = (numero) => compte_seed_1.PLAN_COMPTES_SYCEBNL.find((c) => c.numero === numero)?.intitule;
        expect(intitule('62760000')).toBe('Cadeaux à la clientèle');
        expect(intitule('63440000')).toBe('Redevances pour marques');
        for (const n of ['6271', '6272', '6273', '6274', '6275', '6276', '6277', '6278', '6342', '6343', '6344', '6345', '6346', '6348']) {
            expect([n, !!intitule(`${n}0000`)]).toEqual([n, true]);
        }
    });
});
//# sourceMappingURL=compte-seed.spec.js.map