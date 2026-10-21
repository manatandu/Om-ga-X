"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fiche_immobilisation_1 = require("./fiche-immobilisation");
const vierge = {
    sortie: false,
    autresEcritures: [],
    acquisition: { validee: false, numeroPiece: 4, nombreLignes: 2, exerciceClos: false },
    motifLignesTenues: null,
    origineParticuliere: null,
    neeDUneEcriturePassee: false,
    usages: [],
    annulationsRetenant: 0,
    exerciceClosQuiLaPorte: null,
    renouvelle: null,
};
describe('les champs à effet', () => {
    it('ne retient que les champs présents · absent vaut inchangé', () => {
        expect((0, fiche_immobilisation_1.champsAEffetDemandes)({ valeurOrigine: 10, dureeAmortissementAns: undefined })).toEqual(['valeurOrigine']);
        expect((0, fiche_immobilisation_1.champsAEffetDemandes)({ dateMiseEnService: null })).toEqual(['dateMiseEnService']);
        expect((0, fiche_immobilisation_1.champsAEffetDemandes)({})).toEqual([]);
    });
    it('se modifient au brouillard, sans traitement', () => {
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)(vierge)).toBeNull();
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...vierge, acquisition: null })).toBeNull();
    });
    it("refusent quand l'écriture d'acquisition est validée, et nomment les gestes qui existent", () => {
        const m = (0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...vierge, acquisition: { ...vierge.acquisition, validee: true } });
        expect(m).toMatch(/pièce n° 4\) est validée/);
        expect(m).toMatch(/AUDCIF art\. 22, 2°/);
        expect(m).toMatch(/reclassement/);
        expect(m).toMatch(/révision du plan/);
    });
    it('refusent tant qu’un traitement a lu la fiche, en le nommant, avec l’issue', () => {
        const m = (0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...vierge, usages: [{ modele: 'DotationAmortissement', champ: 'immobilisationId', nombre: 1 }] });
        expect(m).toMatch(/dotations \(1\)/);
        expect(m).toMatch(/annulez-les d’abord/);
    });
    it("une annulation de traitement ne bloque pas la modification · origine et négatif s'y neutralisent", () => {
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...vierge, annulationsRetenant: 2 })).toBeNull();
    });
    it('refusent sur un bien sorti, une écriture propre au bien, une origine particulière, un exercice clôturé', () => {
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...vierge, sortie: true })).toMatch(/sorti/);
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...vierge, autresEcritures: ["l'écriture de mise en service"] })).toMatch(/mise en service/);
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...vierge, origineParticuliere: "d'un legs" })).toMatch(/Supprimez la fiche et refaites/);
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...vierge, acquisition: { ...vierge.acquisition, exerciceClos: true } })).toMatch(/clôturé/);
    });
});
describe('la suppression', () => {
    it('passe sans écriture retenue', () => {
        expect((0, fiche_immobilisation_1.motifRefusSuppression)(vierge)).toBeNull();
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...vierge, acquisition: null })).toBeNull();
    });
    it("refuse une écriture d'acquisition validée et renvoie à la sortie du bien", () => {
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...vierge, acquisition: { ...vierge.acquisition, validee: true } })).toMatch(/se sort/);
    });
    it('refuse un bien utilisé et un traitement annulé qui garde son écriture', () => {
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...vierge, usages: [{ modele: 'FicheInventaire', champ: 'immobilisationId', nombre: 3 }] })).toMatch(/fiches d'inventaire \(3\)/);
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...vierge, annulationsRetenant: 1 })).toMatch(/gardent leur écriture et son négatif/);
    });
});
describe('la duplication', () => {
    it('propose une copie sans dates, sans numéro d’inventaire, sans écriture', () => {
        const p = (0, fiche_immobilisation_1.propositionDeDuplication)({
            designation: 'Camion',
            compteImmobilisationId: 'c1',
            natureFiscaleCle: 'B.3',
            lieuId: 'l1',
            valeurOrigine: 12_000_000,
            valeurResiduelle: 0,
            dureeAmortissementAns: 4,
            modeAmortissement: 'LINEAIRE',
            unitesOeuvrePrevues: null,
            uniteOeuvreLibelle: null,
        });
        expect(p.designation).toBe('Camion (copie)');
        expect(p).not.toHaveProperty('dateAcquisition');
        expect(p).not.toHaveProperty('numeroInventaire');
        expect(p).not.toHaveProperty('compteContrepartieId');
        expect(p.valeurOrigine).toBe(12_000_000);
    });
});
describe('la fiche née d’un renouvellement (relecture, mineur)', () => {
    it('ne se supprime pas · elle porte la trace du renouvellement ; elle se modifie au brouillard', () => {
        const e = { ...vierge, renouvelle: 'Moteur 1' };
        expect((0, fiche_immobilisation_1.motifRefusSuppression)(e)).toMatch(/renouvellement de « Moteur 1 »/);
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)(e)).toBeNull();
    });
});
describe('un exercice clôturé a porté le bien (relecture M4)', () => {
    const repris = { ...vierge, acquisition: null, exerciceClosQuiLaPorte: '2026-12-31' };
    it('refuse les champs à effet d’un bien repris porté par un exercice clos, avec l’issue', () => {
        const m = (0, fiche_immobilisation_1.motifRefusModificationAEffet)(repris);
        expect(m).toMatch(/clos le 2026-12-31 a porté ce bien/);
        expect(m).toMatch(/AUDCIF art\. 19/);
        expect(m).toMatch(/AUDCIF art\. 20, al\. 3 et 4/);
        expect(m).toMatch(/reclassement/);
    });
    it('refuse sa suppression, et dit de le sortir', () => {
        const m = (0, fiche_immobilisation_1.motifRefusSuppression)(repris);
        expect(m).toMatch(/clos le 2026-12-31 a porté ce bien/);
        expect(m).toMatch(/se sort/);
    });
    it('refuse le retrait d’une fiche née d’une écriture passée que l’exercice clos a portée', () => {
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...vierge, neeDUneEcriturePassee: true, acquisition: { ...vierge.acquisition, validee: true }, exerciceClosQuiLaPorte: '2026-12-31' })).toMatch(/ne se retire plus/);
    });
    it('laisse tout ouvert sans exercice clos qui le porte', () => {
        expect((0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...repris, exerciceClosQuiLaPorte: null })).toBeNull();
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...repris, exerciceClosQuiLaPorte: null })).toBeNull();
    });
});
describe('la fiche née d’une écriture déjà passée (fonction n° 68)', () => {
    const nee = {
        ...vierge,
        acquisition: { ...vierge.acquisition, validee: true, nombreLignes: 3 },
        origineParticuliere: "d'une écriture déjà passée au journal",
        neeDUneEcriturePassee: true,
        motifLignesTenues: 'Une ligne de l’écriture est lettrée.',
    };
    it('se retire sans usage, l’écriture validée et lettrée restant au journal', () => {
        expect((0, fiche_immobilisation_1.motifRefusSuppression)(nee)).toBeNull();
    });
    it('ne se retire plus quand son écriture est dans un exercice clôturé, ni sous un usage', () => {
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...nee, acquisition: { ...nee.acquisition, exerciceClos: true } })).toMatch(/exercice clôturé/);
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...nee, usages: [{ modele: 'DotationAmortissement', champ: 'immobilisationId', nombre: 1 }] })).toMatch(/dotations \(1\)/);
        expect((0, fiche_immobilisation_1.motifRefusSuppression)({ ...nee, autresEcritures: ["l'écriture de sortie"] })).toMatch(/sortie/);
    });
    it('ne retouche ni valeur, ni compte, ni date · l’issue dépend de ce qui l’a lue', () => {
        const libre = (0, fiche_immobilisation_1.motifRefusModificationAEffet)(nee);
        expect(libre).toMatch(/née d’une écriture déjà passée au journal \(pièce n° 4\)/);
        expect(libre).toMatch(/recréez-la depuis la même ligne/);
        const lue = (0, fiche_immobilisation_1.motifRefusModificationAEffet)({ ...nee, usages: [{ modele: 'DotationAmortissement', champ: 'immobilisationId', nombre: 1 }] });
        expect(lue).toMatch(/révision du plan/);
        expect(lue).not.toMatch(/recréez-la/);
    });
});
describe('l’exercice clos ne porte que la fiche qui existait à sa clôture (relecture M4, précisée)', () => {
    const fiche = new Date('2027-02-10T10:00:00Z');
    const fin2026 = new Date('2026-12-31');
    it('clos APRÈS la fiche · il l’a portée', () => {
        expect((0, fiche_immobilisation_1.exerciceClosQuiPorteLaFiche)({ ficheCreeeLe: fiche, debutDuJournal: new Date('2026-01-01'), clos: [{ dateFin: fin2026, clotures: [new Date('2027-03-01')] }] })).toEqual(fin2026);
    });
    it('clos AVANT la fiche (bien repris saisi au bilan d’ouverture de N+1) · aucun état arrêté ne l’a lue', () => {
        expect((0, fiche_immobilisation_1.exerciceClosQuiPorteLaFiche)({ ficheCreeeLe: fiche, debutDuJournal: new Date('2026-01-01'), clos: [{ dateFin: fin2026, clotures: [new Date('2027-01-20')] }] })).toBeNull();
    });
    it('clos, rouvert puis reclos après la fiche · la dernière clôture la porte', () => {
        expect((0, fiche_immobilisation_1.exerciceClosQuiPorteLaFiche)({ ficheCreeeLe: fiche, debutDuJournal: new Date('2026-01-01'), clos: [{ dateFin: fin2026, clotures: [new Date('2027-01-20'), new Date('2027-03-01')] }] })).toEqual(fin2026);
    });
    it('sans maillon de clôture · antérieure au journal ; le doute fige quand le journal ne précède pas la fiche', () => {
        expect((0, fiche_immobilisation_1.exerciceClosQuiPorteLaFiche)({ ficheCreeeLe: fiche, debutDuJournal: new Date('2026-06-01'), clos: [{ dateFin: fin2026, clotures: [] }] })).toBeNull();
        expect((0, fiche_immobilisation_1.exerciceClosQuiPorteLaFiche)({ ficheCreeeLe: fiche, debutDuJournal: new Date('2027-03-01'), clos: [{ dateFin: fin2026, clotures: [] }] })).toEqual(fin2026);
        expect((0, fiche_immobilisation_1.exerciceClosQuiPorteLaFiche)({ ficheCreeeLe: fiche, debutDuJournal: null, clos: [{ dateFin: fin2026, clotures: [] }] })).toEqual(fin2026);
    });
    it('le premier exercice qui la porte, dans l’ordre des clôtures', () => {
        const fin2027 = new Date('2027-12-31');
        expect((0, fiche_immobilisation_1.exerciceClosQuiPorteLaFiche)({
            ficheCreeeLe: fiche,
            debutDuJournal: new Date('2026-01-01'),
            clos: [
                { dateFin: fin2026, clotures: [new Date('2027-01-20')] },
                { dateFin: fin2027, clotures: [new Date('2028-01-15')] },
            ],
        })).toEqual(fin2027);
    });
});
//# sourceMappingURL=fiche-immobilisation.spec.js.map