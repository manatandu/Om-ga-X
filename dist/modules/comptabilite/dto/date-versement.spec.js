"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const creer_ecriture_dto_1 = require("./creer-ecriture.dto");
const brouillard_dto_1 = require("./brouillard.dto");
const MEMES_OPTIONS_QUE_LE_SERVEUR = { whitelist: true, forbidNonWhitelisted: true };
const ligne = (extra) => ({
    compteId: '11111111-1111-4111-8111-111111111111',
    libelle: 'Rémunérations du personnel',
    credit: 250000,
    ...extra,
});
const piece = (l) => ({
    exerciceId: '22222222-2222-4222-8222-222222222222',
    journalId: '33333333-3333-4333-8333-333333333333',
    date: '2026-12-31',
    libelle: 'Paie de décembre',
    lignes: [l],
});
describe('ligne d’écriture · date du versement', () => {
    it('accepte une date de versement à la CRÉATION', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(creer_ecriture_dto_1.CreerEcritureDto, piece(ligne({ dateVersement: '2027-01-05' })));
        expect(await (0, class_validator_1.validate)(dto, MEMES_OPTIONS_QUE_LE_SERVEUR)).toEqual([]);
        expect(dto.lignes[0].dateVersement).toBe('2027-01-05');
    });
    it('accepte une date de versement à la CORRECTION d’une pièce en brouillard', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(brouillard_dto_1.ModifierEcritureDto, {
            lignes: [ligne({ dateVersement: '2027-01-05' }), ligne({ debit: 250000, credit: undefined })],
        });
        expect(await (0, class_validator_1.validate)(dto, MEMES_OPTIONS_QUE_LE_SERVEUR)).toEqual([]);
        expect(dto.lignes[0].dateVersement).toBe('2027-01-05');
    });
    it('refuse une date qui n’en est pas une', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(creer_ecriture_dto_1.CreerEcritureDto, piece(ligne({ dateVersement: 'janvier' })));
        const erreurs = await (0, class_validator_1.validate)(dto, MEMES_OPTIONS_QUE_LE_SERVEUR);
        expect(JSON.stringify(erreurs)).toContain('dateVersement');
    });
    it('reste FACULTATIVE · une ligne sans elle est valide et ne porte rien', async () => {
        const dto = (0, class_transformer_1.plainToInstance)(creer_ecriture_dto_1.LigneEcritureDto, ligne({}));
        expect(await (0, class_validator_1.validate)(dto, MEMES_OPTIONS_QUE_LE_SERVEUR)).toEqual([]);
        expect(dto.dateVersement).toBeUndefined();
    });
});
describe('La date de versement est PERSISTÉE, pas seulement acceptée', () => {
    const source = () => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'ecriture.service.ts'), 'utf8') +
        (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', 'lignes-en-negatif.ts'), 'utf8');
    it('range la date aux trois constructeurs d’où une ligne d’écriture naît', () => {
        const s = source();
        const occurrences = s.split('dateVersement:').length - 1;
        expect(`dateVersement rangé ${occurrences} fois`).toBe('dateVersement rangé 3 fois');
    });
    it('la range PARTOUT où elle range déjà la date d’échéance, et pas moins', () => {
        const s = source();
        const echeances = s.split('dateEcheance:').length - 1;
        const versements = s.split('dateVersement:').length - 1;
        expect(`échéance ${echeances} / versement ${versements}`).toBe(`échéance ${echeances} / versement ${echeances}`);
    });
    it('la contre-passation reprend la date de l’origine, elle ne la redate pas', () => {
        const s = source();
        expect(s).toContain('dateVersement: l.dateVersement,');
    });
});
//# sourceMappingURL=date-versement.spec.js.map