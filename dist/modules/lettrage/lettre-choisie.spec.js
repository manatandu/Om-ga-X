"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const lettrage_dto_1 = require("./dto/lettrage.dto");
const lettre_choisie_1 = require("./lettre-choisie");
describe('lettre de lettrage choisie · forme', () => {
    it('admet une à quatre lettres, minuscules comprises, rangées en majuscules', () => {
        for (const l of ['A', 'z', 'Ab', 'ZZZ', 'abcd'])
            expect((0, lettre_choisie_1.lettreBienFormee)(l)).toBe(true);
        expect((0, lettre_choisie_1.normaliserLettre)(' kz ')).toBe('KZ');
    });
    it('refuse chiffre, accent, signe, vide et cinq lettres', () => {
        for (const l of ['', 'A1', 'É', 'A-B', 'ABCDE', '1'])
            expect((0, lettre_choisie_1.lettreBienFormee)(l)).toBe(false);
    });
    it('le DTO refuse une lettre mal formée et laisse passer son absence', async () => {
        const id = '11111111-1111-4111-8111-111111111111';
        const sans = (0, class_transformer_1.plainToInstance)(lettrage_dto_1.LettrerDto, { ligneIds: [id, id] });
        expect(await (0, class_validator_1.validate)(sans)).toHaveLength(0);
        const mauvaise = (0, class_transformer_1.plainToInstance)(lettrage_dto_1.LettrerDto, { ligneIds: [id, id], lettre: 'A1' });
        const erreurs = await (0, class_validator_1.validate)(mauvaise);
        expect(erreurs.map((e) => e.property)).toEqual(['lettre']);
        expect(JSON.stringify(erreurs[0].constraints)).toMatch(/une à quatre lettres/);
    });
    it('le refus nomme la lettre, le compte, le groupe qui la porte et la lettre proposée', () => {
        const m = (0, lettre_choisie_1.motifLettreDejaEmployee)({ lettre: 'C', compteNumero: '40110001', statutGroupe: 'PARTIEL', lettreProposee: 'F' });
        expect(m).toContain('« C »');
        expect(m).toContain('40110001');
        expect(m).toContain('lettrage partiel (affiché « c »)');
        expect(m).toContain('« F »');
    });
});
//# sourceMappingURL=lettre-choisie.spec.js.map