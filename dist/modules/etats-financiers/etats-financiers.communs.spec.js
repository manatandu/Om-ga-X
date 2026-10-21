"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const etats_financiers_communs_1 = require("./etats-financiers.communs");
function exerciceService(exercices, tenant = 't1') {
    return {
        lister: jest.fn().mockImplementation((tenantId) => Promise.resolve(tenantId === tenant ? [...exercices].sort((a, b) => b.dateDebut.getTime() - a.dateDebut.getTime()) : [])),
    };
}
const E2025 = { id: 'e2025', dateDebut: new Date('2025-01-01') };
const E2026 = { id: 'e2026', dateDebut: new Date('2026-01-01') };
describe('trouverExerciceN1', () => {
    it('rend l’exercice antérieur le plus récent', async () => {
        await expect((0, etats_financiers_communs_1.trouverExerciceN1)(exerciceService([E2025, E2026]), 't1', 'e2026')).resolves.toBe('e2025');
    });
    it('rend null pour le premier exercice du dossier · le comparatif reste absent', async () => {
        await expect((0, etats_financiers_communs_1.trouverExerciceN1)(exerciceService([E2025, E2026]), 't1', 'e2025')).resolves.toBeNull();
    });
    it('refuse un exercice inconnu du dossier par un 404 nommé', async () => {
        const promesse = (0, etats_financiers_communs_1.trouverExerciceN1)(exerciceService([E2025, E2026]), 't1', 'inconnu');
        await expect(promesse).rejects.toBeInstanceOf(common_1.NotFoundException);
        await expect((0, etats_financiers_communs_1.trouverExerciceN1)(exerciceService([E2026]), 't1', 'inconnu')).rejects.toThrow('Exercice introuvable dans ce dossier');
    });
    it('refuse l’exercice d’un AUTRE dossier, même s’il existe ailleurs', async () => {
        await expect((0, etats_financiers_communs_1.trouverExerciceN1)(exerciceService([E2025, E2026], 't1'), 't2', 'e2026')).rejects.toBeInstanceOf(common_1.NotFoundException);
    });
});
describe('chargerOuverture', () => {
    const ligneBalance = (numero, rd, rc, md, mc, typeCompte = client_1.TypeCompteDetailTotal.DETAIL) => ({
        compteId: `id-${numero}`,
        numero,
        intitule: numero,
        classe: 'CLASSE_1',
        typeCompte,
        reportDebit: rd,
        reportCredit: rc,
        mouvementDebit: md,
        mouvementCredit: mc,
        clotureDebit: 0,
        clotureCredit: 0,
        totalDebit: rd + md,
        totalCredit: rc + mc,
        solde: rd + md - rc - mc,
    });
    const ecritureService = (lignes) => ({ balance: jest.fn().mockResolvedValue({ lignes, totaux: { debit: 0, credit: 0 } }) });
    it('demande la balance du livre-journal avant la clôture, date d’arrêté transmise', async () => {
        const es = ecritureService([]);
        const arrete = new Date('2026-06-30');
        await (0, etats_financiers_communs_1.chargerOuverture)(es, 't1', 'e1', arrete);
        expect(es.balance).toHaveBeenCalledWith('t1', 'e1', false, arrete, { avantLaCloture: true });
    });
    it('rend les lignes à l’ouverture · le report tient lieu de solde, les comptes Total écartés', async () => {
        const es = ecritureService([
            ligneBalance('13100000', 0, 2_000_000, 0, 0),
            ligneBalance('52110000', 12_000_000, 0, 500_000, 0),
            ligneBalance('13', 0, 2_000_000, 0, 0, client_1.TypeCompteDetailTotal.TOTAL),
        ]);
        const lignes = await (0, etats_financiers_communs_1.chargerOuverture)(es, 't1', 'e1');
        expect(lignes.map((l) => [l.numero, l.solde, l.mouvementDebit, l.mouvementCredit])).toEqual([
            ['13100000', -2_000_000, 0, 0],
            ['52110000', 12_000_000, 0, 0],
        ]);
    });
    it('sans exercice, rien n’est lu', async () => {
        const es = ecritureService([]);
        await expect((0, etats_financiers_communs_1.chargerOuverture)(es, 't1', null)).resolves.toEqual([]);
        expect(es.balance).not.toHaveBeenCalled();
    });
});
describe('l’exercice précédent qui ne tient rien · vide ou au brouillard', () => {
    it.each(['SYSCOHADA', 'SYCEBNL'])('%s · au brouillard, les messages disent de valider, jamais d’importer', (referentiel) => {
        for (const ouvertureLue of [true, false]) {
            const m = (0, etats_financiers_communs_1.mentionExercicePrecedentVide)(referentiel, ouvertureLue, 2);
            expect(m).toContain("n'a que des écritures au brouillard (2)");
            expect(m).toContain('Validez-les (AUDCIF art. 22, 2°)');
            expect(m).not.toContain('Importez');
        }
        const motif = (0, etats_financiers_communs_1.motifColonneN1NonTenue)(referentiel, 2);
        expect(motif).toContain('Validez-les (AUDCIF art. 22, 2°)');
        expect(motif).not.toContain('Importez');
    });
    it.each(['SYSCOHADA', 'SYCEBNL'])('%s · sans aucune écriture, les messages gardent l’issue de l’import', (referentiel) => {
        expect((0, etats_financiers_communs_1.mentionExercicePrecedentVide)(referentiel, false)).toContain('Importez la balance de clôture');
        expect((0, etats_financiers_communs_1.mentionExercicePrecedentVide)(referentiel, false, 0)).toBe((0, etats_financiers_communs_1.mentionExercicePrecedentVide)(referentiel, false));
        expect((0, etats_financiers_communs_1.motifColonneN1NonTenue)(referentiel)).toContain('Importez sa balance de clôture');
        expect((0, etats_financiers_communs_1.motifColonneN1NonTenue)(referentiel)).not.toContain('brouillard');
    });
    it('le brouillard n’est compté que d’un exercice précédent qui ne tient rien', async () => {
        const es = { nombreAuBrouillard: jest.fn().mockResolvedValue(4) };
        await expect((0, etats_financiers_communs_1.brouillardDuPrecedentNonTenu)(es, 't1', 'e0', true)).resolves.toBe(0);
        await expect((0, etats_financiers_communs_1.brouillardDuPrecedentNonTenu)(es, 't1', null, false)).resolves.toBe(0);
        expect(es.nombreAuBrouillard).not.toHaveBeenCalled();
        await expect((0, etats_financiers_communs_1.brouillardDuPrecedentNonTenu)(es, 't1', 'e0', false)).resolves.toBe(4);
        expect(es.nombreAuBrouillard).toHaveBeenCalledWith('t1', 'e0');
    });
});
describe('controleDuTableauDesFlux (relecture M1)', () => {
    const base = {
        ouverture: { ref: 'ZA', montant: 0 },
        variation: { ref: 'ZF', montant: 0 },
        clotureParFlux: { ref: 'ZG', montant: 0 },
        clotureParBilan: 12_500_000,
    };
    it('ZA et ZF vides · ni bouclage ni écart, montants inconnus à null, motif qui nomme les deux', () => {
        const c = (0, etats_financiers_communs_1.controleDuTableauDesFlux)({ ...base, vides: new Set(['ZA', 'FM', 'ZF', 'ZG']) });
        expect(c).toEqual({
            tresorerieOuverture: null,
            variation: null,
            tresorerieClotureParFlux: null,
            tresorerieClotureParBilan: 12_500_000,
            ecart: null,
            coherent: null,
            motifNonControlable: expect.stringContaining('(ZA) et la variation de la trésorerie (ZF) sont laissées vides'),
        });
    });
    it('la seule variation vide · l’ouverture connue est rendue, le contrôle reste non effectué', () => {
        const c = (0, etats_financiers_communs_1.controleDuTableauDesFlux)({ ...base, ouverture: { ref: 'ZA', montant: 300 }, vides: new Set(['ZF', 'ZG']) });
        expect(c).toMatchObject({ tresorerieOuverture: 300, variation: null, ecart: null, coherent: null });
        const v = (0, etats_financiers_communs_1.controleDuTableauDesFlux)({
            ...base,
            ouverture: { ref: 'ZA', montant: 300 },
            variation: { ref: 'ZG', montant: 0 },
            clotureParFlux: { ref: 'ZH', montant: 300 },
            vides: new Set(['ZG']),
        });
        expect(v.motifNonControlable).toContain('la variation de la trésorerie (ZG) est laissée vide');
        expect(v.motifNonControlable).toContain('(ZH)');
    });
    it('rien de vide · le contrôle se fait comme avant, bouclage et écart constaté', () => {
        expect((0, etats_financiers_communs_1.controleDuTableauDesFlux)({
            ...base,
            ouverture: { ref: 'ZA', montant: 12_000_000 },
            variation: { ref: 'ZF', montant: 500_000 },
            clotureParFlux: { ref: 'ZG', montant: 12_500_000 },
            vides: new Set(),
        })).toEqual({
            tresorerieOuverture: 12_000_000,
            variation: 500_000,
            tresorerieClotureParFlux: 12_500_000,
            tresorerieClotureParBilan: 12_500_000,
            ecart: 0,
            coherent: true,
            motifNonControlable: null,
        });
        const ecart = (0, etats_financiers_communs_1.controleDuTableauDesFlux)({ ...base, clotureParFlux: { ref: 'ZG', montant: 12_400_000 }, vides: new Set(['FM']) });
        expect({ ecart: ecart.ecart, coherent: ecart.coherent }).toEqual({ ecart: -100_000, coherent: false });
    });
});
describe('exercice précédent clôturé sans écriture (relecture m1)', () => {
    it.each(['SYSCOHADA', 'SYCEBNL'])('%s · la mention et le motif de la colonne N-1 le disent clôturé', (referentiel) => {
        for (const texte of [
            (0, etats_financiers_communs_1.mentionExercicePrecedentVide)(referentiel, false, 0, true),
            (0, etats_financiers_communs_1.mentionExercicePrecedentVide)(referentiel, true, 0, true),
            (0, etats_financiers_communs_1.motifColonneN1NonTenue)(referentiel, 0, true),
        ]) {
            expect(texte).toContain('clôturé sans aucune écriture');
            expect(texte).not.toMatch(/est ouvert|clôturez-le|Importez/);
        }
        expect((0, etats_financiers_communs_1.mentionExercicePrecedentVide)(referentiel, false, 0, true)).toContain("passez le bilan d'ouverture en à-nouveau");
    });
    it('lu seulement quand l’exercice précédent ne tient rien', async () => {
        const lister = jest.fn().mockResolvedValue([{ id: 'e0', statut: 'CLOTURE' }]);
        const es = { lister };
        await expect((0, etats_financiers_communs_1.precedentNonTenuCloture)(es, 't1', 'e0', true)).resolves.toBe(false);
        await expect((0, etats_financiers_communs_1.precedentNonTenuCloture)(es, 't1', null, false)).resolves.toBe(false);
        expect(lister).not.toHaveBeenCalled();
        await expect((0, etats_financiers_communs_1.precedentNonTenuCloture)(es, 't1', 'e0', false)).resolves.toBe(true);
    });
});
describe('l’ouverture passée en OD derrière un exercice précédent qui ne tient rien (relecture m2)', () => {
    const od = { nombre: 1, pieces: ['OD n° 1'] };
    it.each(['SYSCOHADA', 'SYCEBNL'])('%s · sans exercice précédent, le texte d’origine est gardé', (referentiel) => {
        const texte = (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(od, referentiel);
        expect(texte).toContain('sans exercice précédent ni à-nouveau dans le dossier');
        expect((0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(od, referentiel, null)).toBe(texte);
    });
    it.each(['SYSCOHADA', 'SYCEBNL'])('%s · l’exercice précédent existe · il est dit, jamais « sans exercice précédent »', (referentiel) => {
        const vide = (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(od, referentiel, { auBrouillard: 0, clos: false });
        const brouillard = (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(od, referentiel, { auBrouillard: 2, clos: false });
        const clos = (0, etats_financiers_communs_1.motifOuverturePasseeEnOd)(od, referentiel, { auBrouillard: 0, clos: true });
        for (const texte of [vide, brouillard, clos]) {
            expect(texte).not.toContain('sans exercice précédent');
            expect(texte).toContain('OD n° 1');
            expect(texte).toContain('passez-le en à-nouveau');
            expect(texte).toContain(referentiel === 'SYCEBNL' ? 'SYCEBNL art. 16, 4)' : 'AUDCIF art. 34');
        }
        expect(vide).toContain("l'exercice précédent étant ouvert sans aucune écriture au livre-journal");
        expect(clos).toContain("l'exercice précédent étant clôturé sans aucune écriture au livre-journal");
        expect(clos).not.toMatch(/clôturez-le|Validez|validez-les/);
        expect(brouillard).toContain("n'ayant que des écritures au brouillard (2)");
        expect(brouillard).toContain('validez-les (AUDCIF art. 22, 2°)');
        expect(vide).not.toContain('validez-les');
    });
    it('l’état de l’exercice précédent n’est lu que s’il existe sans rien tenir', async () => {
        const nombreAuBrouillard = jest.fn().mockResolvedValue(3);
        const lister = jest.fn().mockResolvedValue([{ id: 'e0', statut: 'OUVERT' }]);
        const ecritures = { nombreAuBrouillard };
        const exercices = { lister };
        await expect((0, etats_financiers_communs_1.etatDuPrecedentNonTenu)(ecritures, exercices, 't1', null, false)).resolves.toBeNull();
        await expect((0, etats_financiers_communs_1.etatDuPrecedentNonTenu)(ecritures, exercices, 't1', 'e0', true)).resolves.toBeNull();
        expect(nombreAuBrouillard).not.toHaveBeenCalled();
        expect(lister).not.toHaveBeenCalled();
        await expect((0, etats_financiers_communs_1.etatDuPrecedentNonTenu)(ecritures, exercices, 't1', 'e0', false)).resolves.toEqual({ auBrouillard: 3, clos: false });
        expect(nombreAuBrouillard).toHaveBeenCalledWith('t1', 'e0');
    });
});
//# sourceMappingURL=etats-financiers.communs.spec.js.map