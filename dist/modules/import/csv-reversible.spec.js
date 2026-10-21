"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const lecture_fichier_1 = require("./lecture-fichier");
const lire = (csv, nom = 'balance.csv') => (0, lecture_fichier_1.lireFichier)(nom, Buffer.from(csv, 'utf8').toString('base64'));
describe('le retour à la ligne ne coupe pas un champ protégé', () => {
    it('garde l’enregistrement entier, montant compris', async () => {
        const t = await lire('Numero;Intitule;Debit\n41100000;"Cotisations\nannee 2026";1500\n');
        expect(t.lignes).toEqual([['41100000', 'Cotisations\nannee 2026', '1500']]);
    });
    it('lit les trois conventions de fin de ligne', () => {
        expect((0, lecture_fichier_1.analyserCsv)('a;b\r\nc;d', ';')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
        expect((0, lecture_fichier_1.analyserCsv)('a;b\nc;d', ';')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
        expect((0, lecture_fichier_1.analyserCsv)('a;b\rc;d', ';')).toEqual([
            ['a', 'b'],
            ['c', 'd'],
        ]);
    });
    it('ne perd pas le dernier enregistrement faute de retour final', () => {
        expect((0, lecture_fichier_1.analyserCsv)('a;b\nc;d', ';')).toHaveLength(2);
        expect((0, lecture_fichier_1.analyserCsv)('a;b\nc;d\n', ';')).toHaveLength(2);
    });
    it('rend un guillemet doublé comme un guillemet', () => {
        expect((0, lecture_fichier_1.analyserCsv)('a;"il a dit ""oui""";c', ';')).toEqual([['a', 'il a dit "oui"', 'c']]);
    });
    it('détecte encore le séparateur malgré un retour à la ligne protégé', async () => {
        const t = await lire('Numero,Intitule,Debit\n411,"Cotisations\n2026",1500\n');
        expect(t.separateur).toBe(',');
        expect(t.lignes).toEqual([['411', 'Cotisations\n2026', '1500']]);
    });
});
describe('ce qu’on écrit se relit à l’identique', () => {
    const COLONNES = ['numero', 'intitule', 'observation'];
    const LIGNES = [
        ['41100000', 'Cotisations annee 2026', ''],
        ['52110000', 'Banque; compte principal', 'il a dit "oui"'],
        ['60100000', 'Achats\nsur deux lignes', '  bordé d’espaces  '],
        ['70100000', 'Rien de particulier', 'virgule, et tabulation\tcomprises'],
    ];
    it('l’aller-retour rend exactement ce qui est parti', () => {
        for (const separateur of [';', ',', '\t']) {
            const texte = (0, lecture_fichier_1.ecrireCsv)(COLONNES, LIGNES, separateur);
            expect((0, lecture_fichier_1.analyserCsv)(texte, separateur)).toEqual([COLONNES, ...LIGNES]);
        }
    });
    it('l’aller-retour passe aussi par le lecteur de fichier, élagage compris', async () => {
        const t = await lire((0, lecture_fichier_1.ecrireCsv)(COLONNES, LIGNES, ';'));
        expect(t.colonnes).toEqual(COLONNES);
        expect(t.lignes).toEqual(LIGNES);
    });
    it('ne protège que ce qui l’exige', () => {
        expect((0, lecture_fichier_1.ecrireCelluleCsv)('41100000', ';')).toBe('41100000');
        expect((0, lecture_fichier_1.ecrireCelluleCsv)('a;b', ';')).toBe('"a;b"');
        expect((0, lecture_fichier_1.ecrireCelluleCsv)('a;b', ',')).toBe('a;b');
        expect((0, lecture_fichier_1.ecrireCelluleCsv)('a"b', ';')).toBe('"a""b"');
        expect((0, lecture_fichier_1.ecrireCelluleCsv)('a\nb', ';')).toBe('"a\nb"');
        expect((0, lecture_fichier_1.ecrireCelluleCsv)(' a ', ';')).toBe('" a "');
    });
});
describe('une cellule vide de balance vaut zéro, et le reste', () => {
    it('rend 0 sur une cellule vide, null sur ce qui n’est pas un montant', () => {
        expect((0, lecture_fichier_1.lireMontant)('')).toBe(0);
        expect((0, lecture_fichier_1.lireMontant)('   ')).toBe(0);
        expect((0, lecture_fichier_1.lireMontant)('-')).toBe(0);
        expect((0, lecture_fichier_1.lireMontant)('douze')).toBeNull();
        expect((0, lecture_fichier_1.lireMontant)('1 234,56')).toBe(1234.56);
        expect((0, lecture_fichier_1.lireMontant)('(1234.56)')).toBe(-1234.56);
    });
});
//# sourceMappingURL=csv-reversible.spec.js.map