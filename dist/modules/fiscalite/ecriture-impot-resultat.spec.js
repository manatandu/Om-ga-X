"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const compte_seed_1 = require("../comptes/compte-seed");
const ecriture_impot_resultat_1 = require("./ecriture-impot-resultat");
const fiscalite_service_1 = require("./fiscalite.service");
const base = {
    formeJuridique: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
    regime: 'IMPOT_SOCIETES',
    impotDu: 3_000_000,
    minimumApplique: false,
    simulationAvantLaLoi: false,
    exerciceClos: false,
    brouillardGestion: 0,
    impotDejaConstate: 0,
    impotConstateAu89: 0,
    reintegrationsImpot: 0,
    attestationRegime: null,
};
describe('comptes de l’écriture · relus au semis', () => {
    const parNumero = new Map(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((l) => [l.numero, l]));
    it('les quatre comptes existent au semis SYSCOHADA, en détail, sous l’intitulé que la fiche nomme', () => {
        const attendus = [
            [ecriture_impot_resultat_1.COMPTES_IMPOT_RESULTAT.charge, /Activités exercées dans l.État/],
            [ecriture_impot_resultat_1.COMPTES_IMPOT_RESULTAT.chargeMinimum, /Impôt minimum forfaitaire/],
            [ecriture_impot_resultat_1.COMPTES_IMPOT_RESULTAT.dette, /État, impôt sur les bénéfices/],
            [ecriture_impot_resultat_1.COMPTES_IMPOT_RESULTAT.acomptes, /avances et acomptes versés sur impôts/],
        ];
        for (const [numero, intitule] of attendus) {
            const ligne = parNumero.get(numero);
            expect(ligne).toBeDefined();
            expect(ligne.typeCompte ?? client_1.TypeCompteDetailTotal.DETAIL).toBe(client_1.TypeCompteDetailTotal.DETAIL);
            expect(ligne.intitule).toMatch(intitule);
        }
        expect(parNumero.get('891')?.typeCompte).toBe(client_1.TypeCompteDetailTotal.TOTAL);
    });
    it('le SYCEBNL n’ouvre aucun 89 · l’EBNL est exemptée (loi n° 23/053, art. 5), la route lui est fermée', () => {
        expect(compte_seed_1.PLAN_COMPTES_SYCEBNL.some((l) => l.numero.startsWith('89'))).toBe(false);
    });
});
describe('lignes de l’écriture · fiche du compte 89 et art. 57 bis LPF', () => {
    it('D 8911 / C 441 pour l’impôt ENTIER, sans acompte retranché (fiche du 89, « quelles que soient les modalités de règlement »)', () => {
        expect((0, ecriture_impot_resultat_1.lignesConstat)(180, false, 0)).toEqual([
            expect.objectContaining({ numero: '89110000', debit: 180, credit: 0 }),
            expect.objectContaining({ numero: '44100000', debit: 0, credit: 180 }),
        ]);
    });
    it('l’impôt minimum retenu va au 895 (loi n° 23/053, art. 45 et 57)', () => {
        expect((0, ecriture_impot_resultat_1.compteDeLaCharge)(true)).toBe('89500000');
        expect((0, ecriture_impot_resultat_1.compteDeLaCharge)(false)).toBe('89110000');
        expect((0, ecriture_impot_resultat_1.lignesConstat)(50, true, 0)[0].numero).toBe('89500000');
    });
    it('l’imputation demandée est une seconde paire D 441 / C 4492, la charge reste entière', () => {
        const lignes = (0, ecriture_impot_resultat_1.lignesConstat)(180, false, 160);
        expect(lignes).toHaveLength(4);
        expect(lignes[0]).toMatchObject({ numero: '89110000', debit: 180 });
        expect(lignes[2]).toMatchObject({ numero: '44100000', debit: 160 });
        expect(lignes[3]).toMatchObject({ numero: '44920000', credit: 160 });
        const debits = lignes.reduce((s, l) => s + l.debit, 0);
        const credits = lignes.reduce((s, l) => s + l.credit, 0);
        expect(debits).toBe(credits);
    });
});
describe('imputation des acomptes · bornée par le déclaré, le 4492 et l’impôt', () => {
    it('rend le plus petit du déclaré et de l’impôt · l’excédent reste au 4492 (art. 57 ter LPF)', () => {
        expect((0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: 160, solde4492: 160, impot: 180 })).toEqual({ montant: 160, motifRefus: null });
        expect((0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: 200, solde4492: 250, impot: 180 })).toEqual({ montant: 180, motifRefus: null });
    });
    it('refuse sans acompte déclaré, sans 4492 débiteur, ou au-delà du 4492 (jamais un 4492 créditeur)', () => {
        expect((0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: 0, solde4492: 100, impot: 180 }).motifRefus).toMatch(/Aucun acompte/);
        expect((0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: 100, solde4492: 0, impot: 180 }).motifRefus).toMatch(/4492/);
        expect((0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: 150, solde4492: 100, impot: 180 }).motifRefus).toMatch(/créditeur/);
    });
});
describe('motifs de refus · un impôt non chiffré n’est jamais zéro', () => {
    it('une société au régime de l’IS, calcul complet · aucun motif', () => {
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)(base)).toEqual([]);
    });
    it('une personne physique est refusée (art. 3), de même une forme non renseignée', () => {
        for (const forme of [client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE, client_1.FormeJuridiqueSyscohada.ENTREPRENANT]) {
            expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, formeJuridique: forme })[0]).toMatch(/personne physique/);
        }
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, formeJuridique: null })[0]).toMatch(/forme juridique/);
    });
    it('impôt null ou nul · refus nommé, jamais une écriture à zéro', () => {
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotDu: null }).join(' ')).toMatch(/pas chiffré/);
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotDu: 0 }).join(' ')).toMatch(/nul/);
    });
    it('exercice d’avant la loi, exercice clos, brouillard de gestion · refusés', () => {
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, simulationAvantLaLoi: true }).join(' ')).toMatch(/SIMULATION/);
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, exerciceClos: true }).join(' ')).toMatch(/clôturé/);
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, brouillardGestion: 2 }).join(' ')).toMatch(/2 écriture\(s\) au brouillard/);
    });
    it('un impôt déjà au 891 ou au 895 hors module refuse (pas deux fois pour un exercice)', () => {
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotDejaConstate: 500, impotConstateAu89: 500 }).join(' ')).toMatch(/déjà constaté/);
    });
    it('un 89 non réintégré à sa mesure fausse la base · refus dans les deux sens', () => {
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotConstateAu89: 40 }).join(' ')).toMatch(/réintégration/);
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, reintegrationsImpot: 40 }).join(' ')).toMatch(/réintégration/);
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotConstateAu89: 40, reintegrationsImpot: 40 })).toEqual([]);
    });
    it('personne physique · le refus renvoie au 1043 (AUDCIF, compte 104)', () => {
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, formeJuridique: client_1.FormeJuridiqueSyscohada.ENTREPRISE_INDIVIDUELLE }).join(' ')).toMatch(/1043/);
    });
    it('acomptes passés au 441 selon le Guide · le refus d’imputation le dit, rien à imputer', () => {
        expect((0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: 160, solde4492: 0, impot: 180 }).motifRefus).toMatch(/Acomptes passés au 441[^·]*rien à imputer/);
    });
    it('forme dont l’assujettissement tient à un fait · attestation exigée au clic, pas à la lecture', () => {
        for (const forme of Object.keys(ecriture_impot_resultat_1.CONDITIONS_A_DECLARER)) {
            expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, formeJuridique: forme, attestationRegime: null }).join(' ')).toMatch(/Assujettissement à déclarer/);
            expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, formeJuridique: forme, attestationRegime: undefined })).toEqual([]);
            expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, formeJuridique: forme, attestationRegime: 'Option levée en AG du 12 mars 2026' })).toEqual([]);
        }
        expect(ecriture_impot_resultat_1.CONDITIONS_A_DECLARER.SOCIETE_ANONYME).toBeUndefined();
        expect(ecriture_impot_resultat_1.CONDITIONS_A_DECLARER.SOCIETE_RESPONSABILITE_LIMITEE).toBeUndefined();
        expect(ecriture_impot_resultat_1.CONDITIONS_A_DECLARER.SOCIETE_PAR_ACTIONS_SIMPLIFIEE).toBeUndefined();
    });
});
describe('observation · l’impôt déduit de son propre calcul (art. 45 et 50, 2°)', () => {
    it('se tait quand le 89 égale sa réintégration, parle dans les deux sens sinon', () => {
        expect(fiscalite_service_1.FiscaliteService.observationImpotNonReintegre(0, 0)).toBeNull();
        expect(fiscalite_service_1.FiscaliteService.observationImpotNonReintegre(180, 180)).toBeNull();
        expect(fiscalite_service_1.FiscaliteService.observationImpotNonReintegre(180, 0)).toMatch(/écart 180,00/);
        expect(fiscalite_service_1.FiscaliteService.observationImpotNonReintegre(0, 180)).toMatch(/écart -180,00/);
    });
    it('le même formateur que le motif jumeau du constat (montants à deux décimales)', () => {
        const motif = (0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotConstateAu89: 180 }).join(' ');
        expect(motif).toContain((0, ecriture_impot_resultat_1.montantFiscal)(180));
        expect(fiscalite_service_1.FiscaliteService.observationImpotNonReintegre(180, 0)).toContain((0, ecriture_impot_resultat_1.montantFiscal)(180));
        expect(motif).toMatch(/ligne libre/);
        expect(motif).toMatch(/reclasse au 89/);
    });
    it('le dégrèvement au 899 est NOMMÉ, jamais déduit · son sort fiscal est au cabinet (art. 45 a contrario)', () => {
        expect(fiscalite_service_1.FiscaliteService.observationDegrevement(0)).toBeNull();
        const obs = fiscalite_service_1.FiscaliteService.observationDegrevement(500);
        expect(obs).toMatch(/DÉGRÈVEMENT AU 899/);
        expect(obs).toContain((0, ecriture_impot_resultat_1.montantFiscal)(500));
        expect(obs).toMatch(/relève du cabinet/);
        expect(obs).toMatch(/Rien n'est déduit d'office/);
    });
    it('ne compte que les réintégrations du code IMPOT_SUR_LE_RESULTAT', () => {
        expect(fiscalite_service_1.FiscaliteService.reintegrationsImpot([
            { code: 'IMPOT_SUR_LE_RESULTAT', sens: 'REINTEGRATION', montant: '100' },
            { code: 'IMPOT_SUR_LE_RESULTAT', sens: 'REINTEGRATION', montant: 80 },
            { code: 'AMENDES_PENALITES', sens: 'REINTEGRATION', montant: 999 },
        ])).toBe(180);
    });
});
describe('exercice de liquidation · trop-payé de la première cotisation au 441 par le 8994', () => {
    it('8994 est semé au SYSCOHADA, en détail, sous l’intitulé de la fiche du compte 89', () => {
        const ligne = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((l) => l.numero === ecriture_impot_resultat_1.COMPTES_IMPOT_RESULTAT.annulationPertesRetroactives);
        expect(ligne?.intitule).toMatch(/Annulations pour pertes rétroactives/);
        expect(ligne.typeCompte ?? client_1.TypeCompteDetailTotal.DETAIL).toBe(client_1.TypeCompteDetailTotal.DETAIL);
        expect(compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.find((l) => l.numero === '899')?.typeCompte).toBe(client_1.TypeCompteDetailTotal.TOTAL);
    });
    it('les lignes · D 441 / C 8994 du trop-payé, sans ligne d’impôt nulle', () => {
        expect((0, ecriture_impot_resultat_1.lignesConstat)(0, false, 0, 600_000)).toEqual([
            expect.objectContaining({ numero: '44100000', debit: 600_000, credit: 0 }),
            expect.objectContaining({ numero: '89940000', debit: 0, credit: 600_000 }),
        ]);
        expect((0, ecriture_impot_resultat_1.lignesConstat)(150_000, false, 0, 0).map((l) => l.numero)).toEqual(['89110000', '44100000']);
    });
    it('un impôt de l’exercice nul n’est pas refusé quand un trop-payé reste à constater', () => {
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotDu: 0, tropPaye: 600_000 })).toEqual([]);
        expect((0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotDu: 0, tropPaye: 0 }).join(' ')).toMatch(/nul/);
    });
    it('totalisation non calculée · refus nommé, jamais l’impôt de la seule liquidation', () => {
        const m = (0, ecriture_impot_resultat_1.motifsRefusConstat)({ ...base, impotDu: null, motifTotalisation: 'Aucun exercice n’est arrêté à la dissolution.' }).join(' ');
        expect(m).toMatch(/seconde cotisation spéciale/);
        expect(m).toMatch(/Aucun exercice n’est arrêté/);
    });
    it('aucun impôt à éteindre · les acomptes restent au 4492 (art. 57 ter)', () => {
        const r = (0, ecriture_impot_resultat_1.imputationAcomptes)({ declares: 300_000, solde4492: 300_000, impot: 0 });
        expect(r.montant).toBe(0);
        expect(r.motifRefus).toMatch(/restent au 4492/);
    });
});
//# sourceMappingURL=ecriture-impot-resultat.spec.js.map