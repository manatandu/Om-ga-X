"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const frais_developpement_1 = require("./frais-developpement");
const contrepartie_acquisition_1 = require("./contrepartie-acquisition");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
const tous = Object.fromEntries(frais_developpement_1.CRITERES_FRAIS_DEVELOPPEMENT.map((c) => [c.cle, `Justification du critère ${c.rang}`]));
const base = {
    referentiel: 'SYSCOHADA',
    numeroCompte: '21100000',
    repris: false,
    criteres: tous,
    dateReunion: new Date('2026-05-01'),
    dateInscription: new Date('2026-12-31'),
};
describe('frais de développement · six critères (lot 15)', () => {
    it('les six critères du texte, dans son ordre, et aucun autre', () => {
        expect(frais_developpement_1.CRITERES_FRAIS_DEVELOPPEMENT.map((c) => c.rang)).toEqual([1, 2, 3, 4, 5, 6]);
        expect(frais_developpement_1.CRITERES_FRAIS_DEVELOPPEMENT[0].libelle).toContain('faisabilité technique');
        expect(frais_developpement_1.CRITERES_FRAIS_DEVELOPPEMENT[5].libelle).toContain('évaluer de manière fiable');
    });
    it('exemple du texte · inscrit au 31 décembre, conditions réunies au 1er mai · admis', () => {
        expect((0, frais_developpement_1.motifRefusFraisDeveloppement)(base)).toBeNull();
    });
    it('chaque critère manquant est nommé, et le refus renvoie la dépense aux charges', () => {
        for (const c of frais_developpement_1.CRITERES_FRAIS_DEVELOPPEMENT) {
            const sans = { ...tous, [c.cle]: '   ' };
            const motif = (0, frais_developpement_1.motifRefusFraisDeveloppement)({ ...base, criteres: sans });
            expect(motif).toContain(`Critère ${c.rang} non démontré`);
            expect(motif).toContain('constituent des charges');
        }
        expect((0, frais_developpement_1.motifRefusFraisDeveloppement)({ ...base, criteres: null })).toContain('Critère 1');
    });
    it('pas de rétroactivité · ni sans date de réunion, ni inscrit avant elle (§ 3.1)', () => {
        expect((0, frais_developpement_1.motifRefusFraisDeveloppement)({ ...base, dateReunion: null })).toContain('§ 3.1');
        expect((0, frais_developpement_1.motifRefusFraisDeveloppement)({ ...base, dateInscription: new Date('2026-04-30') })).toContain('ne peuvent plus être activées');
    });
    it('un bien repris sans déclaration passe ; une déclaration partielle sur lui est refusée', () => {
        expect((0, frais_developpement_1.motifRefusFraisDeveloppement)({ ...base, repris: true, criteres: null, dateReunion: null })).toBeNull();
        expect((0, frais_developpement_1.motifRefusFraisDeveloppement)({ ...base, repris: true, criteres: { INTENTION: 'x' }, dateReunion: null })).toContain('Critère 1');
    });
    it('SYSCOHADA seul · le SYCEBNL n’ouvre aucun 211, et une déclaration hors du 211 est refusée', () => {
        expect((0, frais_developpement_1.estFraisDeveloppement)('SYSCOHADA', '21100000')).toBe(true);
        expect((0, frais_developpement_1.estFraisDeveloppement)('SYCEBNL', '21100000')).toBe(false);
        expect((0, frais_developpement_1.estFraisDeveloppement)('SYSCOHADA', '21810000')).toBe(false);
        expect((0, frais_developpement_1.motifRefusFraisDeveloppement)({ ...base, numeroCompte: '21310000', criteres: null, dateReunion: null })).toBeNull();
        expect((0, frais_developpement_1.motifRefusFraisDeveloppement)({ ...base, referentiel: 'SYCEBNL', numeroCompte: '21310000' })).toContain('aucun 211');
        expect(compte_seed_1.PLAN_COMPTES_SYCEBNL.some((c) => c.numero.startsWith('211'))).toBe(false);
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((c) => c.numero === '21100000')?.intitule).toBe('Frais de développement');
    });
    it('le 721 est une contrepartie admise du 211 (§ 2.1.2)', () => {
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => c.numero)).toContain('72100000');
        expect((0, contrepartie_acquisition_1.contrepartieAcquisitionAdmise)(client_1.Referentiel.SYSCOHADA, '21100000', '72100000')).toBe(true);
    });
    it('les justifications sont gardées nettoyées, dans l’ordre du texte', () => {
        expect((0, frais_developpement_1.criteresRetenus)({ CAPACITE: '  oui  ', INTENTION: '' })).toEqual({ CAPACITE: 'oui' });
        expect((0, frais_developpement_1.criteresRetenus)(null)).toBeNull();
    });
});
//# sourceMappingURL=frais-developpement.spec.js.map