"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const cumul_consolidation_1 = require("./cumul-consolidation");
const EX = { dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
const b = (lignes) => lignes.map(([numero, solde]) => ({ numero, intitule: numero, solde }));
const ent = (id, methode, pctInteret, balance, estConsolidante = false) => ({
    id,
    nom: id,
    estConsolidante,
    methode,
    pctInteret,
    balance,
});
const acq = (detentriceId, detenueId, pct, cout, cpEntree, extra = {}) => ({
    detentriceId,
    detenueId,
    pctCapital: pct,
    coutAcquisition: cout,
    compteTitres: '26100000',
    dateEntree: new Date('2024-01-01'),
    capitauxPropresEntree: cpEntree,
    modeDureeEcart: 'NON_DETERMINABLE',
    dividendesExercice: 0,
    ...extra,
});
const ligne = (r, cle) => r.lignes.find((l) => l.cle === cle)?.solde ?? 0;
const M = ent('M', 'IG', 100, b([['26100000', 800], ['24100000', 1200], ['10100000', -1000], ['11800000', -500], ['70100000', -700], ['60100000', 200]]), true);
const F = ent('F', 'IG', 80, b([['24500000', 2000], ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 600]]));
describe('intégration globale, écart d’acquisition, intérêts minoritaires', () => {
    const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], []);
    it('les titres disparaissent, l’écart d’acquisition apparaît avec son plan (art. 81 et 82)', () => {
        expect(ligne(r, '26100000')).toBe(0);
        expect(ligne(r, 'ECART_ACQUISITION')).toBe(80);
        expect(ligne(r, 'AMORTISSEMENT_ECART_ACQUISITION')).toBe(-24);
        expect(ligne(r, 'DOTATION_ECART_ACQUISITION')).toBe(8);
        expect(r.ecarts[0]).toMatchObject({ ecart: 80, dureeAnnees: 10, amortissementCumuleOuverture: 16, dotationExercice: 8 });
    });
    it('les capitaux propres se partagent · réserves groupe = mère + 80 % du post-acquisition − amortissements antérieurs', () => {
        expect(r.capitauxPropres).toMatchObject({
            capital: 1000,
            reservesGroupe: 1044,
            interetsMinoritairesHorsResultat: 320,
            resultatGroupe: 812,
            resultatMinoritaires: 80,
            resultatEnsemble: 892,
        });
    });
    it('la balance consolidée est équilibrée', () => {
        expect(r.equilibre).toBe(0);
        expect(ligne(r, '24100000') + ligne(r, '24500000')).toBe(3200);
    });
});
describe('chaîne M → A → B · la consolidation directe rend ce que rendraient les paliers (ch. XII-5 § 7)', () => {
    const B = ent('B', 'IG', 48, b([['24100000', 800], ['10100000', -500], ['11800000', -300]]));
    const A = ent('A', 'IG', 80, b([['26100000', 300], ['24100000', 700], ['10100000', -600], ['11800000', -400]]));
    const M2 = ent('M', 'IG', 100, b([['26100000', 480], ['24100000', 520], ['10100000', -1000]]), true);
    const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M2, A, B], [acq('M', 'A', 80, 480, 600), acq('A', 'B', 60, 300, 500)], []);
    it('minoritaires 556, réserves groupe 464, aucun écart', () => {
        expect(r.capitauxPropres.interetsMinoritairesHorsResultat).toBe(556);
        expect(r.capitauxPropres.reservesGroupe).toBe(464);
        expect(r.ecarts.every((e) => e.ecart === 0)).toBe(true);
        expect(r.equilibre).toBe(0);
    });
});
describe('mise en équivalence (art. 81, al. 3 · ch. XII-5 § 6)', () => {
    const E = ent('E', 'ME', 30, b([['24100000', 1300], ['10100000', -1000], ['11800000', -200], ['70100000', -100]]));
    const Mme = ent('M', 'IG', 100, b([['26300000', 300], ['24100000', 700], ['10100000', -1000]]), true);
    it('la valeur des titres est la quote-part des capitaux propres, résultat compris', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mme, E], [acq('M', 'E', 30, 300, 1000, { compteTitres: '26300000' })], []);
        expect(ligne(r, 'TITRES_MIS_EN_EQUIVALENCE')).toBe(390);
        expect(ligne(r, 'QUOTE_PART_RESULTAT_ME')).toBe(-30);
        expect(ligne(r, '24100000')).toBe(700);
        expect(r.capitauxPropres).toMatchObject({ reservesGroupe: 60, resultatGroupe: 30, interetsMinoritairesHorsResultat: 0 });
        expect(r.equilibre).toBe(0);
    });
    it('une quote-part négative est retenue pour zéro, et le dit ; déclarée, elle passe en provision', () => {
        const Eneg = ent('E', 'ME', 30, b([['24100000', 100], ['10100000', -1000], ['11800000', 1500], ['70100000', -100], ['60100000', 0], ['40100000', -500]]));
        const zero = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mme, Eneg], [acq('M', 'E', 30, 300, 1000, { compteTitres: '26300000' })], []);
        expect(ligne(zero, 'TITRES_MIS_EN_EQUIVALENCE')).toBe(0);
        expect(zero.avertissements.join(' ')).toContain('valeur nulle');
        expect(zero.equilibre).toBe(0);
        const prov = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mme, Eneg], [acq('M', 'E', 30, 300, 1000, { compteTitres: '26300000', obligationNonDesengagement: true })], []);
        expect(ligne(prov, 'PROVISION_ME_NEGATIVE')).toBe(-120);
        expect(prov.equilibre).toBe(0);
    });
});
describe('dividendes intra-groupe (art. 86, 4° · ch. XII-5 § 4)', () => {
    it('sortent du résultat et rejoignent les réserves', () => {
        const Md = ent('M', 'IG', 100, b([['26100000', 800], ['24100000', 1150], ['10100000', -1000], ['11800000', -500], ['70100000', -700], ['77210000', -50], ['60100000', 300]]), true);
        const sans = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Md, F], [acq('M', 'F', 80, 800, 900)], []);
        const avec = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Md, F], [acq('M', 'F', 80, 800, 900, { dividendesExercice: 50, compteDividendes: '77210000' })], []);
        expect(ligne(avec, '77210000')).toBe(0);
        expect(avec.capitauxPropres.resultatGroupe).toBe(sans.capitauxPropres.resultatGroupe - 50);
        expect(avec.capitauxPropres.reservesGroupe).toBe(sans.capitauxPropres.reservesGroupe + 50);
        expect(avec.equilibre).toBe(0);
    });
});
describe('comptes réciproques (art. 86, 6°)', () => {
    const Mr = ent('M', 'IG', 100, b([['26100000', 800], ['41100000', 100], ['24100000', 1100], ['10100000', -1000], ['11800000', -500], ['70100000', -700], ['60100000', 200]]), true);
    const Fr = ent('F', 'IG', 80, b([['24500000', 2100], ['40100000', -100], ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 600]]));
    const recip = { entiteAId: 'M', compteA: '41100000', entiteBId: 'F', compteB: '40100000', montant: 100, libelle: 'Créance M sur F' };
    it('la créance et la dette s’annulent des deux côtés', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mr, Fr], [acq('M', 'F', 80, 800, 900)], [recip]);
        expect(ligne(r, '41100000')).toBe(0);
        expect(ligne(r, '40100000')).toBe(0);
        expect(r.equilibre).toBe(0);
    });
    it('une vente interne éliminée ne déplace RIEN entre groupe et minoritaires', () => {
        const vente = { entiteAId: 'M', compteA: '70100000', entiteBId: 'F', compteB: '60100000', montant: 300, libelle: 'Vente M à F' };
        const sans = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mr, Fr], [acq('M', 'F', 80, 800, 900)], []);
        const avec = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mr, Fr], [acq('M', 'F', 80, 800, 900)], [vente]);
        expect(avec.capitauxPropres.resultatGroupe).toBe(sans.capitauxPropres.resultatGroupe);
        expect(avec.capitauxPropres.resultatMinoritaires).toBe(sans.capitauxPropres.resultatMinoritaires);
        expect(ligne(avec, '70100000')).toBe(ligne(sans, '70100000') + 300);
    });
    it('F152 · un prêt intragroupe refuse le tableau des flux · ses mouvements bruts y resteraient', () => {
        const Mp = ent('M', 'IG', 100, b([['26100000', 800], ['27410000', 100], ['24100000', 1100], ['10100000', -1000], ['11800000', -500], ['70100000', -700], ['60100000', 200]]), true);
        const Fp = ent('F', 'IG', 80, b([['24500000', 2100], ['16200000', -100], ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 600]]));
        const pret = { entiteAId: 'M', compteA: '27410000', entiteBId: 'F', compteB: '16200000', montant: 100, libelle: 'Prêt M à F' };
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mp, Fp], [acq('M', 'F', 80, 800, 900)], [pret]);
        expect(ligne(r, '27410000')).toBe(0);
        const obstacles = r.obstaclesFlux.join(' ');
        expect(obstacles).toContain('« Prêt M à F » sur le compte 27410000 · le tableau des flux le lit en mouvements (FH, FJ)');
        expect(obstacles).toContain('sur le compte 16200000 · le tableau des flux le lit en mouvements (FO, FQ)');
    });
    it('F152 · une créance commerciale réciproque ne refuse rien · le tableau lit sa variation, que le solde éliminé corrige', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mr, Fr], [acq('M', 'F', 80, 800, 900)], [recip]);
        expect(r.obstaclesFlux.join(' ')).not.toContain('Créance M sur F');
    });
    it('deux comptes de même sens, ou un montant qui excède un solde, sont refusés', () => {
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mr, Fr], [acq('M', 'F', 80, 800, 900)], [{ ...recip, compteB: '24500000' }])).toThrow(/sens contraire/);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mr, Fr], [acq('M', 'F', 80, 800, 900)], [{ ...recip, montant: 150 }])).toThrow(/confirmation de solde/);
    });
});
describe('intégration proportionnelle (art. 81, al. 2 · ch. XII-5 § 5)', () => {
    const P = ent('P', 'IP', 50, b([['24100000', 1000], ['10100000', -800], ['70100000', -200]]));
    const Mp = ent('M', 'IG', 100, b([['26200000', 400], ['41100000', 100], ['10100000', -500]]), true);
    it('la fraction est cumulée, sans intérêts minoritaires', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mp, P], [acq('M', 'P', 50, 400, 800, { compteTitres: '26200000' })], []);
        expect(ligne(r, '24100000')).toBe(500);
        expect(r.capitauxPropres).toMatchObject({ interetsMinoritairesHorsResultat: 0, resultatMinoritaires: 0, resultatGroupe: 100 });
        expect(r.equilibre).toBe(0);
    });
    it('un compte réciproque avec une entité IP ne s’élimine que dans la limite de sa fraction', () => {
        const P2 = ent('P', 'IP', 50, b([['24100000', 1100], ['40100000', -100], ['10100000', -800], ['70100000', -200]]));
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mp, P2], [acq('M', 'P', 50, 400, 800, { compteTitres: '26200000' })], [
            { entiteAId: 'M', compteA: '41100000', entiteBId: 'P', compteB: '40100000', montant: 100, libelle: 'Prêt' },
        ]);
        expect(ligne(r, '41100000')).toBe(50);
        expect(ligne(r, '40100000')).toBe(0);
    });
    it('une entité IP à deux détentrices est refusée, faute de texte', () => {
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mp, P, ent('Q', 'IG', 100, b([['26200000', 10], ['10100000', -10]]))], [
            acq('M', 'P', 50, 400, 800, { compteTitres: '26200000' }),
            acq('Q', 'P', 10, 10, 800, { compteTitres: '26200000' }),
        ], [])).toThrow(/plusieurs/);
    });
});
describe('écart d’acquisition négatif et dépréciation', () => {
    it('l’écart négatif est rapporté au résultat sur sa durée', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 600, 900, { modeDureeEcart: 'LIMITEE', dureeEcartAnnees: 5 })], []);
        expect(ligne(r, 'ECART_ACQUISITION_NEGATIF')).toBe(-48);
        expect(ligne(r, 'REPRISE_ECART_ACQUISITION_NEGATIF')).toBe(-24);
        expect(r.avertissements.join(' ')).toContain('revérifie l’identification');
    });
    it('un écart négatif ne prend pas les dix ans de l’écart positif non déterminable (D4C ch. XII-6 § 4)', () => {
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 600, 900)], [])).toThrow(/durée reflétant les hypothèses/);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [])).not.toThrow();
    });
    it('la dépréciation s’ajoute à la dotation, et ne se reprend jamais', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { depreciationEcartOuverture: 5, depreciationEcartCloture: 12 })], []);
        expect(ligne(r, 'DEPRECIATION_ECART_ACQUISITION')).toBe(-12);
        expect(ligne(r, 'DOTATION_ECART_ACQUISITION')).toBe(15);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { depreciationEcartOuverture: 12, depreciationEcartCloture: 5 })], [])).toThrow(/jamais reprise/);
    });
    it('un écart sans durée est refusé (art. 82)', () => {
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { modeDureeEcart: 'LIMITEE' })], [])).toThrow(/art\. 82/);
    });
});
describe('refus et signalements', () => {
    it('une balance manquante ou déséquilibrée arrête le cumul', () => {
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, ent('F', 'IG', 80, null)], [], [])).toThrow(/balance de « F » manque/);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, ent('F', 'IG', 80, b([['24100000', 10]]))], [], [])).toThrow(/pas équilibrée/);
    });
    it('une entrée en cours d’exercice est refusée, la part de résultat antérieure ne se lisant pas', () => {
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { dateEntree: new Date('2026-04-01') })], [])).toThrow(/en cours d’exercice/);
    });
    it('une subvention d’investissement (14) d’une filiale est signalée, avec les deux paragraphes qui ne s’articulent pas', () => {
        const F14 = ent('F', 'IG', 80, b([['24500000', 2100], ['14100000', -100], ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 600]]));
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F14], [acq('M', 'F', 80, 800, 900)], []);
        expect(r.avertissements.join(' ')).toMatch(/« F » porte des subventions d’investissement \(14\).*ch\. XII-8 § 2.*ch\. XII-3 § 2/);
    });
    it('des titres déclarés au-delà du solde du compte sont signalés', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 900, 900)], []);
        expect(r.avertissements.join(' ')).toContain('vérifiez le compte ou le coût');
    });
});
describe('balances déjà clôturées', () => {
    it('un résultat porté au compte 13 reste du résultat, partagé comme lui', () => {
        const Fc = ent('F', 'IG', 80, b([['24500000', 2000], ['10100000', -1000], ['11800000', -600], ['13100000', -400]]));
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, Fc], [acq('M', 'F', 80, 800, 900)], []);
        expect(r.capitauxPropres).toMatchObject({ reservesGroupe: 1044, resultatGroupe: 812, resultatMinoritaires: 80 });
        expect(ligne(r, 'RESULTAT_DEJA_CONSTATE')).toBe(-400);
        expect(r.equilibre).toBe(0);
    });
    it('le 130 (résultat N-1 en instance d’affectation) est des réserves, jamais du résultat de l’exercice', () => {
        const Fc = ent('F', 'IG', 80, b([['24500000', 2000], ['10100000', -1000], ['11800000', -400], ['13010000', -200], ['13100000', -400]]));
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, Fc], [acq('M', 'F', 80, 800, 900)], []);
        expect(r.capitauxPropres).toMatchObject({ reservesGroupe: 1044, resultatGroupe: 812, resultatMinoritaires: 80 });
        expect(ligne(r, 'RESULTAT_DEJA_CONSTATE')).toBe(-400);
        expect(r.equilibre).toBe(0);
    });
});
describe('oracles · cours de consolidation CPCC (Bamba Makola, ch. 3)', () => {
    const EX21 = { dateDebut: new Date('2021-01-01'), dateFin: new Date('2021-12-31') };
    const entree = new Date('2021-01-01');
    const ginger = (titres, ac, passif) => ent('GINGER', 'IG', 100, b([['24100000', 2700000], ...titres, ['52100000', ac], ['10100000', -2000000], ['11800000', -500000], ['70100000', -8000000], ['60100000', 7900000], ['40100000', -passif]]), true);
    const bleuCiel = (methode, pct) => ent('BLEU CIEL', methode, pct, b([['24100000', 200000], ['52100000', 110000], ['10100000', -100000], ['11800000', -80000], ['70100000', -900000], ['60100000', 870000], ['40100000', -100000]]));
    it('A · intégration globale à 55 % · réserves consolidées 544 000, résultat groupe 116 500, minoritaires 94 500', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX21, [ginger([['26100000', 55000]], 245000, 400000), bleuCiel('IG', 55)], [
            acq('GINGER', 'BLEU CIEL', 55, 55000, 100000, { dateEntree: entree }),
        ], []);
        expect(r.capitauxPropres).toMatchObject({ capital: 2000000, reservesGroupe: 544000, resultatGroupe: 116500, resultatEnsemble: 130000 });
        expect(r.capitauxPropres.interetsMinoritairesHorsResultat + r.capitauxPropres.resultatMinoritaires).toBe(94500);
        expect(ligne(r, '24100000')).toBe(2900000);
        expect(ligne(r, '52100000')).toBe(355000);
        expect(r.equilibre).toBe(0);
    });
    it('B · intégration proportionnelle à 50 % · réserves 540 000, résultat 115 000, aucun minoritaire', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX21, [ginger([['26200000', 50000]], 250000, 400000), bleuCiel('IP', 50)], [
            acq('GINGER', 'BLEU CIEL', 50, 50000, 100000, { dateEntree: entree, compteTitres: '26200000' }),
        ], []);
        expect(r.capitauxPropres).toMatchObject({ reservesGroupe: 540000, resultatGroupe: 115000, interetsMinoritairesHorsResultat: 0, resultatMinoritaires: 0 });
        expect(ligne(r, '24100000')).toBe(2800000);
        expect(ligne(r, '70100000')).toBe(-8450000);
        expect(ligne(r, '60100000')).toBe(8335000);
        expect(r.equilibre).toBe(0);
    });
    it('C · mise en équivalence à 25 % · titres 110 000, réserves 1 020 000, résultat 290 000', () => {
        const gm = ent('GINGER', 'IG', 100, b([['24100000', 1950000], ['26300000', 50000], ['26800000', 10000], ['52100000', 2750000], ['10100000', -1000000], ['11800000', -975000], ['13100000', -275000], ['19100000', -250000], ['40100000', -2260000]]), true);
        const bc = ent('BLEU CIEL', 'ME', 25, b([['24100000', 400000], ['52100000', 460000], ['10100000', -200000], ['11800000', -180000], ['13100000', -60000], ['40100000', -420000]]));
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX21, [gm, bc], [acq('GINGER', 'BLEU CIEL', 25, 50000, 200000, { dateEntree: entree, compteTitres: '26300000' })], []);
        expect(ligne(r, 'TITRES_MIS_EN_EQUIVALENCE')).toBe(110000);
        expect(ligne(r, '26800000')).toBe(10000);
        expect(r.capitauxPropres).toMatchObject({ reservesGroupe: 1020000, resultatGroupe: 290000 });
        expect(r.equilibre).toBe(0);
    });
    it('D et E · chaîne AMOR → BOUMAT 80 % → KONGO CEMENT 60 % · réserves 118 000, résultat 94 800, minoritaires 97 200', () => {
        const amor = ent('AMOR', 'IG', 100, b([['24100000', 400000], ['26100000', 150000], ['31100000', 100000], ['10100000', -450000], ['11800000', -100000], ['13100000', -50000], ['40100000', -50000]]), true);
        const boumat = ent('BOUMAT', 'IG', 80, b([['24100000', 200000], ['26100000', 50000], ['31100000', 20000], ['10100000', -150000], ['11800000', -50000], ['13100000', -50000], ['40100000', -20000]]));
        const kc = ent('KONGO CEMENT', 'IG', 48, b([['24100000', 100000], ['31100000', 40000], ['10100000', -80000], ['11800000', -20000], ['13100000', -10000], ['40100000', -30000]]));
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX21, [amor, boumat, kc], [
            acq('AMOR', 'BOUMAT', 80, 150000, 187500, { dateEntree: entree }),
            acq('BOUMAT', 'KONGO CEMENT', 60, 50000, 83333.33, { dateEntree: entree }),
        ], []);
        expect(r.capitauxPropres).toMatchObject({ capital: 450000, reservesGroupe: 118000, resultatGroupe: 94800 });
        expect(r.capitauxPropres.interetsMinoritairesHorsResultat + r.capitauxPropres.resultatMinoritaires).toBe(97200);
        expect(ligne(r, '24100000')).toBe(700000);
        expect(ligne(r, '31100000')).toBe(160000);
        expect(r.equilibre).toBe(0);
    });
});
describe('le compte 10 de la consolidante · capital, primes et réévaluation séparés (D4C ch. XII-8 § 2)', () => {
    const M2 = ent('M', 'IG', 100, b([['26100000', 800], ['24100000', 700], ['10110000', -1000], ['10900000', 100], ['10500000', -300], ['10600000', -200], ['70100000', -100], ['60100000', 0]]), true);
    const F2 = ent('F', 'IG', 80, b([['24500000', 1000], ['10100000', -800], ['10500000', -200]]));
    const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M2, F2], [acq('M', 'F', 80, 800, 1000)], []);
    it('le capital n’est que 101 à 104 et 109 ; 105 et 106 ont leur poste', () => {
        expect(r.capitauxPropres).toMatchObject({ capital: 900, primes: 300, ecartsReevaluation: 200 });
        expect(ligne(r, 'CAPITAL')).toBe(-900);
        expect(ligne(r, 'PRIMES_CONSOLIDANTE')).toBe(-300);
        expect(ligne(r, 'ECARTS_REEVALUATION_CONSOLIDANTE')).toBe(-200);
    });
    it('les primes d’une filiale se partagent comme le reste de ses capitaux propres', () => {
        expect(r.capitauxPropres).toMatchObject({ reservesGroupe: 0, interetsMinoritairesHorsResultat: 200 });
        expect(r.equilibre).toBe(0);
    });
    it('la subvention d’investissement de la consolidante est signalée comme celle d’une filiale', () => {
        const M3 = ent('M', 'IG', 100, b([['24100000', 500], ['10100000', -400], ['14100000', -100]]), true);
        const s = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M3], [], []);
        expect(s.avertissements.join(' ')).toMatch(/« M » porte des subventions d’investissement/);
    });
});
describe('résultats internes inclus dans les actifs (art. 86, 4°)', () => {
    const M = ent('M', 'IG', 100, b([['26100000', 800], ['31100000', 300], ['52100000', 900], ['10100000', -1000], ['11800000', -500], ['70100000', -1000], ['60100000', 500]]), true);
    const F = ent('F', 'IG', 80, b([['31100000', 500], ['52100000', 1500], ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 600]]));
    const A = [acq('M', 'F', 80, 800, 1000)];
    const sans = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], A, []);
    const ri = (vendeuseId, acheteuseId, extra = {}) => ({
        vendeuseId,
        acheteuseId,
        nature: 'STOCK',
        compteActif: '31100000',
        margeOuverture: 40,
        margeCloture: 100,
        libelle: 'marge sur stock',
        ...extra,
    });
    it('la consolidante vend · le stock perd la marge de clôture, le résultat la variation, les réserves l’ouverture, tout au groupe', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], A, [], [ri('M', 'F')]);
        expect(ligne(r, '31100000')).toBe(ligne(sans, '31100000') - 100);
        expect(ligne(r, 'ELIMINATION_RESULTATS_INTERNES')).toBe(60);
        expect(r.capitauxPropres.resultatGroupe).toBe(sans.capitauxPropres.resultatGroupe - 60);
        expect(r.capitauxPropres.reservesGroupe).toBe(sans.capitauxPropres.reservesGroupe - 40);
        expect(r.capitauxPropres.resultatMinoritaires).toBe(sans.capitauxPropres.resultatMinoritaires);
        expect(r.equilibre).toBe(0);
    });
    it('la filiale à 80 % vend · la vendeuse porte l’élimination, partagée 80 / 20', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], A, [], [ri('F', 'M', { margeCloture: 100, margeOuverture: 40 })]);
        expect(r.capitauxPropres.resultatGroupe).toBe(sans.capitauxPropres.resultatGroupe - 48);
        expect(r.capitauxPropres.resultatMinoritaires).toBe(sans.capitauxPropres.resultatMinoritaires - 12);
        expect(r.capitauxPropres.reservesGroupe).toBe(sans.capitauxPropres.reservesGroupe - 32);
        expect(r.capitauxPropres.interetsMinoritairesHorsResultat).toBe(sans.capitauxPropres.interetsMinoritairesHorsResultat - 8);
        expect(r.equilibre).toBe(0);
    });
    it('deux entités intégrées proportionnellement · au plus faible des deux pourcentages, pas au produit (D4C ch. XII-5 § 5)', () => {
        const P1 = ent('P1', 'IP', 50, F.balance);
        const P2 = ent('P2', 'IP', 40, F.balance);
        const acqs = [acq('M', 'P1', 50, 500, 1000), acq('M', 'P2', 40, 400, 1000)];
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, P1, P2], acqs, [], [ri('P1', 'P2', { margeOuverture: 0 })]);
        expect(ligne(r, 'ELIMINATION_RESULTATS_INTERNES')).toBe(40);
        expect(r.equilibre).toBe(0);
    });
    it('une perte interne s’élimine aussi · « pertes/profits inclus » (D4C ch. XII-3 § 2)', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], A, [], [ri('M', 'F', { margeOuverture: 0, margeCloture: -30 })]);
        expect(ligne(r, '31100000')).toBe(ligne(sans, '31100000') + 30);
        expect(ligne(r, 'ELIMINATION_RESULTATS_INTERNES')).toBe(-30);
        expect(r.equilibre).toBe(0);
    });
    it('des dividendes internes non déclarés rendent l’état non publiable · null n’est pas zéro (D4C ch. XII-5 § 4)', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 1000, { dividendesExercice: null })], []);
        expect(r.retraitementsNonJoues.join(' ')).toContain('Dividendes reçus de « F » par « M » non déclarés');
    });
    it('une cession interne d’immobilisation dit que brut et amortissements ne sont pas reconstitués', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], A, [], [ri('M', 'F', { nature: 'IMMOBILISATION', compteActif: '24100000', margeOuverture: 0, margeCloture: 0 })]);
        expect(r.retraitementsNonJoues.join(' ')).toContain('amortissements cumulés du cédant ne sont pas reconstitués');
        expect(sans.retraitementsNonJoues).toEqual([]);
    });
    it('une entité intégrée proportionnellement · au pourcentage d’intégration de l’entité conjointe (D4C ch. XII-5 § 5)', () => {
        const P = ent('F', 'IP', 50, F.balance);
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, P], [acq('M', 'F', 50, 500, 1000)], [], [ri('M', 'F', { margeOuverture: 0 })]);
        const s = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, P], [acq('M', 'F', 50, 500, 1000)], []);
        expect(ligne(r, 'ELIMINATION_RESULTATS_INTERNES')).toBe(50);
        expect(ligne(r, '31100000')).toBe(ligne(s, '31100000') - 50);
    });
    it('trois refus · mise en équivalence, même entité, marge au-delà du solde de l’actif', () => {
        const ME = ent('F', 'ME', 30, F.balance);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, ME], [acq('M', 'F', 30, 300, 1000)], [], [ri('M', 'F')])).toThrow(/mise en équivalence/);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], A, [], [ri('F', 'F')])).toThrow(/même entité/);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], A, [], [ri('M', 'F', { margeCloture: 600 })])).toThrow(/excède le solde/);
    });
    it('une immobilisation s’inscrit en classe 2, un stock en classe 3', () => {
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], A, [], [ri('M', 'F', { nature: 'IMMOBILISATION' })])).toThrow(/classe 2/);
    });
});
describe('tranche 4a · écarts d’évaluation et impôts différés (art. 82 et 92, D4C ch. XII-3 § 3 et XII-6)', () => {
    const fiscal = (entiteId, tauxImpot, extra = {}) => ({
        entiteId,
        tauxImpot,
        idaOuverture: 0,
        idaCloture: 0,
        idpOuverture: 0,
        idpCloture: 0,
        ...extra,
    });
    const FISC = [fiscal('M', 30), fiscal('F', 30)];
    const batiment = { compte: '23100000', compteAmortissement: '28310000', libelle: 'Bâtiment', montant: 100, mode: 'AMORTISSABLE', dureeAnnees: 5 };
    describe('un bâtiment réestimé de 100, amorti sur cinq ans depuis janvier 2024, taux 30 %', () => {
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { ecartsEvaluation: [batiment] })], [], [], FISC);
        it('l’écart d’évaluation passe en priorité, l’écart d’acquisition n’est que le reste (art. 82)', () => {
            expect(r.ecarts[0]).toMatchObject({ quotePartCapitauxPropresEntree: 776, ecart: 24, dotationExercice: 2.4 });
            expect(ligne(r, '23100000')).toBe(100);
            expect(ligne(r, '28310000')).toBe(-60);
            expect(ligne(r, 'ECARTS_EVALUATION_RESULTAT')).toBe(20);
        });
        it('l’impôt différé passif et son produit de l’exercice · jamais sur l’écart d’acquisition', () => {
            expect(ligne(r, 'IMPOTS_DIFFERES_PASSIF')).toBe(-12);
            expect(ligne(r, 'IMPOTS_DIFFERES_ACTIF')).toBe(0);
            expect(ligne(r, 'IMPOTS_DIFFERES_RESULTAT')).toBe(-6);
            expect(r.ecartsEvaluation[0]).toMatchObject({ restantOuverture: 60, restantCloture: 40, impotDiffereCloture: -12, tauxImpot: 30 });
        });
        it('il appartient aux majoritaires ET aux minoritaires (ch. XII-6 § 3)', () => {
            expect(r.capitauxPropres).toMatchObject({
                reservesGroupe: 1032.8,
                interetsMinoritairesHorsResultat: 328.4,
                resultatGroupe: 806.4,
                resultatMinoritaires: 77.2,
                resultatEnsemble: 883.6,
            });
            expect(r.equilibre).toBe(0);
            expect(r.impotsDifferesIncomplets).toEqual([]);
        });
    });
    it('report variable · un taux passé de 25 à 30 % réajuste l’impôt différé d’ouverture AU RÉSULTAT (D4C ch. XII-3 § 3)', () => {
        const acqs = [acq('M', 'F', 80, 800, 900, { ecartsEvaluation: [batiment] })];
        const fixe = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], acqs, [], [], [fiscal('M', 30, { tauxImpotOuverture: 30 }), fiscal('F', 30, { tauxImpotOuverture: 30 })]);
        const change = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], acqs, [], [], [fiscal('M', 30, { tauxImpotOuverture: 30 }), fiscal('F', 30, { tauxImpotOuverture: 25 })]);
        expect(ligne(fixe, 'IMPOTS_DIFFERES_RESULTAT')).toBe(-6);
        expect(ligne(change, 'IMPOTS_DIFFERES_RESULTAT')).toBe(-3);
        expect(ligne(change, 'IMPOTS_DIFFERES_PASSIF')).toBe(-12);
        expect(change.capitauxPropres.resultatEnsemble).toBe(fixe.capitauxPropres.resultatEnsemble - 3);
        expect(change.equilibre).toBe(0);
        expect(fixe.avertissements.join(' ')).not.toContain('Report variable');
        const inconnu = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], acqs, [], [], FISC);
        expect(inconnu.avertissements.join(' ')).toContain('Report variable');
    });
    it('report variable · la marge interne et les provisions réglementées suivent la même règle', () => {
        const ri = { vendeuseId: 'M', acheteuseId: 'F', nature: 'IMMOBILISATION', compteActif: '24500000', margeOuverture: 40, margeCloture: 100, libelle: 'x' };
        const fixe = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [], [ri], [fiscal('M', 30, { tauxImpotOuverture: 30 }), fiscal('F', 30)]);
        const change = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [], [ri], [fiscal('M', 30, { tauxImpotOuverture: 20 }), fiscal('F', 30)]);
        expect(ligne(change, 'IMPOTS_DIFFERES_RESULTAT')).toBe(ligne(fixe, 'IMPOTS_DIFFERES_RESULTAT') - 4);
        expect(change.equilibre).toBe(0);
        const Mpr = ent('M', 'IG', 100, b([['26100000', 800], ['52100000', 1300], ['10100000', -1000], ['11800000', -500], ['15100000', -100], ['85100000', 30], ['70100000', -1000], ['60100000', 470]]), true);
        const prFixe = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mpr, F], [acq('M', 'F', 80, 800, 900)], [], [], [fiscal('M', 30, { tauxImpotOuverture: 30 }), fiscal('F', 30)]);
        const prChange = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Mpr, F], [acq('M', 'F', 80, 800, 900)], [], [], [fiscal('M', 30, { tauxImpotOuverture: 20 }), fiscal('F', 30)]);
        expect(ligne(prChange, 'IMPOTS_DIFFERES_RESULTAT')).toBe(ligne(prFixe, 'IMPOTS_DIFFERES_RESULTAT') + 7);
        expect(prChange.equilibre).toBe(0);
    });
    it('une dépréciation des titres chez la détentrice est nommée, et l’état n’est pas publiable (D4C ch. XII-5 § 5 et § 6)', () => {
        const Md = ent('M', 'IG', 100, b([['26100000', 800], ['29610000', -200], ['52100000', 1100], ['10100000', -1000], ['11800000', -500], ['70100000', -1000], ['60100000', 500], ['69720000', 200], ['31100000', 100]]), true);
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [Md, F], [acq('M', 'F', 80, 800, 900)], [], [], FISC);
        expect(r.retraitementsNonJoues.join(' ')).toContain('29610000');
    });
    it('un stock réestimé puis vendu dans l’exercice · tout passe au résultat, le tableau des flux en est averti', () => {
        const stock = { compte: '31100000', libelle: 'Stock', montant: 50, mode: 'REALISE', dateRealisation: new Date('2026-06-30') };
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { ecartsEvaluation: [stock] })], [], [], FISC);
        expect(ligne(r, '31100000')).toBe(0);
        expect(ligne(r, 'ECARTS_EVALUATION_RESULTAT')).toBe(50);
        expect(ligne(r, 'IMPOTS_DIFFERES_RESULTAT')).toBe(-15);
        expect(ligne(r, 'IMPOTS_DIFFERES_PASSIF')).toBe(0);
        expect(r.ecartsEvaluationStocksResultat).toBe(50);
        expect(r.equilibre).toBe(0);
    });
    it('un passif réestimé en hausse · impôt différé ACTIF, et un écart d’acquisition plus grand', () => {
        const litige = { compte: '19100000', libelle: 'Litige', montant: 100, mode: 'NON_AMORTISSABLE' };
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { ecartsEvaluation: [litige] })], [], [], FISC);
        expect(r.ecarts[0].ecart).toBe(136);
        expect(ligne(r, '19100000')).toBe(-100);
        expect(ligne(r, 'IMPOTS_DIFFERES_ACTIF')).toBe(30);
        expect(r.equilibre).toBe(0);
    });
    it('refus · sans taux, sur une mise en équivalence, sur les capitaux propres, amortissable hors classe 2', () => {
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { ecartsEvaluation: [batiment] })], [], [], [fiscal('M', 30), fiscal('F', null)])).toThrow(/sans taux d’impôt déclaré/);
        const FME = ent('F', 'ME', 30, F.balance);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, FME], [acq('M', 'F', 30, 800, 900, { ecartsEvaluation: [batiment] })], [], [], FISC)).toThrow(/pas d’écart d’évaluation/);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { ecartsEvaluation: [{ ...batiment, compte: '11800000' }] })], [], [], FISC)).toThrow(/jamais aux capitaux propres/);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900, { ecartsEvaluation: [{ ...batiment, compte: '31100000' }] })], [], [], FISC)).toThrow(/amortissable/);
    });
    it('la marge interne éliminée porte un impôt différé ACTIF au taux de la vendeuse (art. 92, 2°)', () => {
        const ri = { vendeuseId: 'M', acheteuseId: 'F', nature: 'STOCK', compteActif: '24500000', margeOuverture: 40, margeCloture: 100, libelle: 'x' };
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [], [{ ...ri, nature: 'IMMOBILISATION' }], FISC);
        expect(ligne(r, 'IMPOTS_DIFFERES_ACTIF')).toBe(30);
        expect(ligne(r, 'IMPOTS_DIFFERES_RESULTAT')).toBe(-18);
        expect(r.equilibre).toBe(0);
        const sansTaux = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [], [{ ...ri, nature: 'IMMOBILISATION' }], [fiscal('M', null), fiscal('F', 30)]);
        expect(ligne(sansTaux, 'IMPOTS_DIFFERES_ACTIF')).toBe(0);
        expect(sansTaux.impotsDifferesIncomplets).toEqual([expect.stringMatching(/aucun taux d’impôt déclaré pour « M »/)]);
    });
    it('les impôts différés individuels se déclarent · absents, l’état le dit ; un IDA sans motif est refusé', () => {
        const sans = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [], [], []);
        expect(sans.impotsDifferesIncomplets).toHaveLength(2);
        expect(sans.impotsDifferesIncomplets[1]).toMatch(/« F » n’a pas déclaré/);
        expect(() => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [], [], [fiscal('M', 30), fiscal('F', 30, { idaCloture: 50 })])).toThrow(/probable/);
        const partiel = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [], [], [fiscal('M', 30), fiscal('F', 30, { idpCloture: null })]);
        expect(partiel.impotsDifferesIncomplets).toEqual([expect.stringMatching(/« F » n’a pas déclaré/)]);
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F], [acq('M', 'F', 80, 800, 900)], [], [], [
            fiscal('M', 30),
            fiscal('F', 30, { idaOuverture: 20, idaCloture: 50, idpOuverture: 10, idpCloture: 0, justificationIda: 'Budget 2027 bénéficiaire' }),
        ]);
        expect(ligne(r, 'IMPOTS_DIFFERES_ACTIF')).toBe(50);
        expect(ligne(r, 'IMPOTS_DIFFERES_PASSIF')).toBe(0);
        expect(ligne(r, 'IMPOTS_DIFFERES_RESULTAT')).toBe(-40);
        expect(r.equilibre).toBe(0);
    });
});
describe('tranche 4b · provisions réglementées contre-passées (art. 86, 3°, D4C ch. XII-3 § 2)', () => {
    const fiscal = (entiteId, tauxImpot) => ({
        entiteId,
        tauxImpot,
        idaOuverture: 0,
        idaCloture: 0,
        idpOuverture: 0,
        idpCloture: 0,
    });
    const F15 = ent('F', 'IG', 80, b([['24500000', 2100], ['15100000', -100], ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 560], ['85100000', 40]]));
    const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F15], [acq('M', 'F', 80, 800, 900)], [], [], [fiscal('M', 30), fiscal('F', 30)]);
    const ligne = (cle) => r.lignes.find((l) => l.cle === cle)?.solde ?? 0;
    it('le 15, le 851 et le 861 disparaissent de la balance consolidée', () => {
        expect(ligne('15100000')).toBe(0);
        expect(ligne('85100000')).toBe(0);
        expect(r.mouvements.some((m) => m.cle.startsWith('15') || m.cle.startsWith('851'))).toBe(false);
    });
    it('exercice → résultat, exercices antérieurs → réserves, avec leur impôt différé passif', () => {
        expect(r.capitauxPropres).toMatchObject({ reservesGroupe: 1077.6, resultatGroupe: 834.4, resultatMinoritaires: 85.6 });
        expect(ligne('IMPOTS_DIFFERES_PASSIF')).toBe(-30);
        expect(ligne('IMPOTS_DIFFERES_RESULTAT')).toBe(12);
        expect(r.equilibre).toBe(0);
    });
    it('le 861 porte au résultat, avec son impôt différé · une reprise de 10 réduit l’incidence de l’exercice', () => {
        const F861 = ent('F', 'IG', 80, b([['24500000', 2110], ['15100000', -100], ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 560], ['85100000', 40], ['86100000', -10]]));
        const s = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F861], [acq('M', 'F', 80, 800, 900)], [], [], [fiscal('M', 30), fiscal('F', 30)]);
        expect(s.lignes.find((l) => l.cle === 'IMPOTS_DIFFERES_RESULTAT')?.solde).toBe(9);
        expect(s.lignes.find((l) => l.cle === '86100000')?.solde ?? 0).toBe(0);
        expect(s.equilibre).toBe(0);
    });
    it('une balance à six colonnes perd aussi les mouvements du 15 et du 851', () => {
        const avecMv = b([['24500000', 2100], ['15100000', -100], ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 560], ['85100000', 40]]).map((l) => ({
            ...l,
            mouvementDebit: Math.max(l.solde, 0),
            mouvementCredit: Math.max(-l.solde, 0),
        }));
        const s = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, ent('F', 'IG', 80, avecMv)], [acq('M', 'F', 80, 800, 900)], [], [], [fiscal('M', 30), fiscal('F', 30)]);
        expect(s.mouvements.some((m) => m.cle === '24500000')).toBe(true);
        expect(s.mouvements.filter((m) => m.cle.startsWith('15') || m.cle.startsWith('851'))).toEqual([]);
    });
    it('sans taux, la contre-passation se fait quand même et l’impôt différé est dit incomplet', () => {
        const s = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, F15], [acq('M', 'F', 80, 800, 900)], [], [], [fiscal('M', 30), fiscal('F', null)]);
        expect(s.lignes.find((l) => l.cle === '15100000')).toBeUndefined();
        expect(s.impotsDifferesIncomplets).toContainEqual(expect.stringMatching(/« F » · aucun taux.*provisions réglementées/));
        expect(s.equilibre).toBe(0);
    });
});
describe('tranche 4b · écarts de conversion des comptes individuels (D4C ch. XII-3 § 2)', () => {
    const zero = (entiteId) => ({ entiteId, tauxImpot: 30, idaOuverture: 0, idaCloture: 0, idpOuverture: 0, idpCloture: 0 });
    const FX = ent('F', 'IG', 80, b([
        ['24500000', 2000], ['47810000', 50], ['47910000', -20], ['49910000', -30], ['40100000', -20],
        ['10100000', -1000], ['11800000', -600], ['70100000', -1000], ['60100000', 600], ['65910000', 30], ['75910000', -10],
    ]));
    const conv = (extra = {}) => ({
        entiteId: 'F',
        actifN1: 10,
        passifN1: 5,
        provisions: [{ compteProvision: '49910000', cloture: 30, dotation: 30, reprise: 10 }],
        ...extra,
    });
    const jouer = (c) => (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, FX], [acq('M', 'F', 80, 800, 900)], [], [], [zero('M'), zero('F')], c);
    it('478, 479, la provision, sa dotation et sa reprise sortent · la variation latente nette entre au résultat', () => {
        const r = jouer([conv()]);
        const ligne = (cle) => r.lignes.find((l) => l.cle === cle)?.solde ?? 0;
        for (const c of ['47810000', '47910000', '49910000', '65910000', '75910000'])
            expect(ligne(c)).toBe(0);
        expect(ligne('ECARTS_CONVERSION_INDIVIDUELS_RESULTAT')).toBe(25);
        expect(r.capitauxPropres).toMatchObject({ reservesGroupe: 1048, resultatGroupe: 792, resultatMinoritaires: 75 });
        expect(r.equilibre).toBe(0);
    });
    it('les mouvements de la dotation et de la reprise sortent · ceux de la provision, compte de bilan, restent', () => {
        const MV = { '49910000': [10, 40], '65910000': [30, 0], '75910000': [0, 10] };
        const FXmv = ent('F', 'IG', 80, FX.balance.map((l) => {
            const [d, c] = MV[l.numero] ?? [Math.max(l.solde, 0), Math.max(-l.solde, 0)];
            return { ...l, mouvementDebit: d, mouvementCredit: c };
        }));
        const r = (0, cumul_consolidation_1.cumulerConsolidation)(EX, [M, FXmv], [acq('M', 'F', 80, 800, 900)], [], [], [zero('M'), zero('F')], [conv()]);
        const mv = (cle) => r.mouvements.find((m) => m.cle === cle);
        expect(mv('65910000')).toMatchObject({ debit: 0, credit: 0 });
        expect(mv('75910000')).toMatchObject({ debit: 0, credit: 0 });
        expect(mv('49910000')).toMatchObject({ debit: 10, credit: 40 });
    });
    it('sans déclaration, rien n’est retraité · les 478 et 479 restent, et l’état les dira à retraiter', () => {
        const r = jouer([]);
        expect(r.lignes.find((l) => l.cle === '47810000')?.solde).toBe(50);
    });
    it('refus · une provision hors 194, 4991, 4997 ; une dotation qu’aucun compte ne porte ; une ouverture négative', () => {
        expect(() => jouer([conv({ provisions: [{ compteProvision: '19100000', cloture: 30, dotation: 30, reprise: 10 }] })])).toThrow(/194, au 4991 ou au 4997/);
        expect(() => jouer([conv({ provisions: [{ compteProvision: '49910000', cloture: 30, dotation: 90, reprise: 10 }] })])).toThrow(/ouverture/);
        expect(() => jouer([conv({ provisions: [{ compteProvision: '49970000', cloture: 30, dotation: 30, reprise: 10 }] })])).toThrow(/aucun compte 4997/);
    });
});
describe('tranche 4c · conversion d’une entité étrangère au cours de clôture (D4C ch. XII-4 § 3)', () => {
    const FU = ent('F', 'IG', 80, b([['24500000', 200], ['10100000', -100], ['11800000', -60], ['70100000', -100], ['60100000', 60]]));
    const MU = ent('M', 'IG', 100, b([['26100000', 250], ['52100000', 750], ['10100000', -1000]]), true);
    const USD = { entiteId: 'F', monnaie: 'USD', coursCloture: 3, coursProduitsCharges: 2.5, capitauxPropresHistoriques: 400, coursEntree: 2 };
    const jouer = (m, entites = [MU, FU], acqs = [acq('M', 'F', 80, 250, 300)]) => (0, cumul_consolidation_1.cumulerConsolidation)(EX, entites, acqs, [], [], [], [], { presentation: 'CDF', entites: m });
    it('bilan au cours de clôture, résultat au cours déclaré, capitaux propres au cours historique · l’écart est leur solde', () => {
        const r = jouer([USD]);
        expect(ligne(r, '24500000')).toBe(600);
        expect(ligne(r, '70100000')).toBe(-250);
        expect(r.conversions).toEqual([{ entite: 'F', monnaie: 'USD', coursCloture: 3, coursProduitsCharges: 2.5, ecartConversion: 100 }]);
        expect(r.equilibre).toBe(0);
    });
    it('l’écart se partage au pourcentage d’intérêt, et l’écart d’acquisition se convertit au cours de clôture', () => {
        const r = jouer([USD]);
        expect(ligne(r, 'ECART_ACQUISITION')).toBe(15);
        expect(ligne(r, 'AMORTISSEMENT_ECART_ACQUISITION')).toBe(-4.5);
        expect(ligne(r, 'DOTATION_ECART_ACQUISITION')).toBe(1.25);
        expect(r.capitauxPropres).toMatchObject({ ecartsConversion: 83.75, reservesGroupe: 78, interetsMinoritairesHorsResultat: 100, resultatGroupe: 78.75, resultatMinoritaires: 20 });
        expect(r.capitauxPropres).toMatchObject({ ecartsConversionMinoritaires: 20, ecartsConversionMe: 0 });
        expect(ligne(r, 'ECARTS_CONVERSION')).toBe(-83.75);
        expect(r.obstaclesFlux.join(' ')).toMatch(/« F » est convertie de USD en CDF/);
    });
    it('un produit HAO (classe 8) se convertit comme les charges et produits, au cours déclaré pour eux', () => {
        const FH = ent('F', 'IG', 80, b([['24500000', 210], ['10100000', -100], ['11800000', -60], ['70100000', -100], ['82100000', -10], ['60100000', 60]]));
        const r = jouer([USD], [MU, FH]);
        expect(ligne(r, '82100000')).toBe(-25);
        expect(r.equilibre).toBe(0);
    });
    it('mise en équivalence · la quote-part suit l’écart, qui reste un écart de conversion', () => {
        const ME = ent('F', 'ME', 30, FU.balance);
        const MM = ent('M', 'IG', 100, b([['26100000', 100], ['52100000', 900], ['10100000', -1000]]), true);
        const r = jouer([USD], [MM, ME], [acq('M', 'F', 30, 100, 300)]);
        expect(ligne(r, 'TITRES_MIS_EN_EQUIVALENCE')).toBe(190.5);
        expect(r.capitauxPropres).toMatchObject({ ecartsConversion: 33.75, reservesGroupe: 28, resultatGroupe: 28.75 });
        expect(r.capitauxPropres).toMatchObject({ ecartsConversionMe: 33.75, ecartsConversionMinoritaires: 0 });
        expect(r.equilibre).toBe(0);
    });
    it('une entité dans la monnaie de présentation n’est pas convertie · une entité sans monnaie déclarée est nommée', () => {
        const r = jouer([{ entiteId: 'F', monnaie: 'cdf' }]);
        expect(ligne(r, '24500000')).toBe(200);
        expect(r.conversions).toEqual([]);
        expect(r.conversionsIncompletes).toEqual([]);
        const sans = jouer([]);
        expect(sans.conversionsIncompletes.join(' ')).toMatch(/« F » n’a pas déclaré la monnaie/);
        expect(sans.obstaclesFlux.join(' ')).toMatch(/« F » n’a pas déclaré la monnaie/);
    });
    it('refus · cours manquant, capitaux propres historiques manquants, hyperinflation, cours d’entrée manquant, écart d’évaluation', () => {
        expect(() => jouer([{ ...USD, coursCloture: null }])).toThrow(/cours de clôture/);
        expect(() => jouer([{ ...USD, coursProduitsCharges: null }])).toThrow(/charges et produits/);
        expect(() => jouer([{ ...USD, capitauxPropresHistoriques: null }])).toThrow(/cours historique/);
        expect(() => jouer([{ ...USD, hyperinflation: true }])).toThrow(/indice général des prix/);
        expect(() => jouer([{ ...USD, coursEntree: null }])).toThrow(/cours à la date d’entrée/);
        const ev = acq('M', 'F', 80, 250, 300, { ecartsEvaluation: [{ compte: '24500000', libelle: 'x', montant: 10, mode: 'NON_AMORTISSABLE' }] });
        expect(() => jouer([USD], [MU, FU], [ev])).toThrow(/entité convertie/);
    });
});
//# sourceMappingURL=cumul-consolidation.spec.js.map