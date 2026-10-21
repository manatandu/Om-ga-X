"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retenues_service_1 = require("./retenues.service");
const correspondance_retenues_1 = require("./correspondance-retenues");
const compte_seed_1 = require("../comptes/compte-seed");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const OBLIGATIONS_SYCEBNL = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)('SYCEBNL');
function ligne(numero, date, montant, dateVersement) {
    return {
        debit: montant.debit ?? 0,
        credit: montant.credit ?? 0,
        dateVersement: dateVersement ? new Date(dateVersement) : null,
        compte: { numero, intitule: `Compte ${numero}` },
        ecriture: { date: new Date(date), libelle: 'Écriture', reference: null },
    };
}
function service(lignes, referentiel = 'SYCEBNL') {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel }) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        exercice: { findFirst: jest.fn().mockResolvedValue(null) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new retenues_service_1.RetenuesService(prisma);
}
const nature = (r, cle) => r.natures.find((n) => n.cle === cle);
describe('Registre des retenues à la source', () => {
    it('un CRÉDIT est une retenue constituée, un DÉBIT est un reversement', async () => {
        const s = service([
            ligne('44720000', '2026-03-31', { credit: 350_000 }),
            ligne('44720000', '2026-04-14', { debit: 350_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const n = nature(r, 'irppSalaires');
        expect(n.retenu).toBe(350_000);
        expect(n.reverse).toBe(350_000);
        expect(n.solde).toBe(0);
    });
    it('découpe par MOIS · chaque mois a sa propre échéance de reversement', async () => {
        const s = service([
            ligne('44720000', '2026-03-31', { credit: 300_000 }),
            ligne('44720000', '2026-04-30', { credit: 320_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const n = nature(r, 'irppSalaires');
        expect(n.mois.map((m) => m.mois)).toEqual(['2026-03', '2026-04']);
        expect(n.mois[0].echeance.toISOString().slice(0, 10)).toBe('2026-04-15');
        expect(n.mois[1].echeance.toISOString().slice(0, 10)).toBe('2026-05-15');
    });
    it('signale le retard de reversement, mois par mois', async () => {
        const s = service([
            ligne('44720000', '2026-03-31', { credit: 300_000 }),
            ligne('44720000', '2026-06-30', { credit: 280_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const n = nature(r, 'irppSalaires');
        expect(n.moisEnRetard).toBe(1);
        expect(n.mois.find((m) => m.mois === '2026-03').enRetard).toBe(true);
        expect(n.mois.find((m) => m.mois === '2026-06').enRetard).toBe(false);
    });
    it('un compte 44 qu’aucune nature ne réclame ressort en NON RATTACHÉ, jamais absorbé', async () => {
        const s = service([ligne('44210000', '2026-03-31', { credit: 90_000 })]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        expect(r.comptesNonRattaches.map((c) => c.numero)).toEqual(['44210000']);
        expect(r.totalRetenu).toBe(0);
    });
    it('sépare l’État des organismes sociaux', async () => {
        const s = service([
            ligne('44720000', '2026-03-31', { credit: 350_000 }),
            ligne('43100000', '2026-03-31', { credit: 130_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        expect(nature(r, 'irppSalaires').retenu).toBe(350_000);
        expect(nature(r, 'cnss').retenu).toBe(130_000);
        expect(r.natures.find((n) => n.cle === 'cnss').beneficiaire).toBe('ORGANISME_SOCIAL');
    });
    it('ne calcule AUCUN impôt et le dit · aucun taux n’est inscrit dans le référentiel', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        expect(r.avertissements[0]).toContain("ne calcule aucun impôt");
        expect(r.avertissements[1]).toContain('DÉCLARER');
        const serialise = JSON.stringify(correspondance_retenues_1.NATURES_RETENUES);
        expect(serialise).not.toMatch(/"taux"/);
    });
    it('porte la réserve sur le compte 4478 non ventilé, dont les échéances diffèrent', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        expect(nature(r, 'autresRetenues').reserve).toContain('44781');
    });
    it('date la retenue locative au 10 du mois suivant, et non au 15', async () => {
        const r = await service([ligne('44781000', '2026-06-12', { credit: 100_000 })]).registre('t1', {
            exerciceId: 'e1',
        });
        const mois = nature(r, 'retenueLocative').mois[0];
        expect(mois.echeance.toISOString().slice(0, 10)).toBe('2026-07-10');
    });
    it('date les autres prélèvements au 15 du mois suivant', async () => {
        const r = await service([ligne('44782000', '2026-06-12', { credit: 100_000 })]).registre('t1', {
            exerciceId: 'e1',
        });
        expect(nature(r, 'prestatairesNonResidents').mois[0].echeance.toISOString().slice(0, 10)).toBe('2026-07-15');
    });
    it('une retenue de décembre s’échoit en janvier suivant', async () => {
        const r = await service([ligne('44781000', '2026-12-20', { credit: 50_000 })]).registre('t1', {
            exerciceId: 'e1',
        });
        expect(nature(r, 'retenueLocative').mois[0].echeance.toISOString().slice(0, 10)).toBe('2027-01-11');
    });
    it('le 4478 générique n’absorbe pas les lignes de ses sous-comptes ventilés', async () => {
        const r = await service([
            ligne('44781000', '2026-06-12', { credit: 100_000 }),
            ligne('44780000', '2026-06-12', { credit: 30_000 }),
        ]).registre('t1', { exerciceId: 'e1' });
        expect(nature(r, 'retenueLocative').retenu).toBe(100_000);
        expect(nature(r, 'autresRetenues').retenu).toBe(30_000);
    });
    it('sépare la CNSS du 4428 · et compte UNE fois l’INPP et l’ONEM qui le partagent (décision T1)', async () => {
        const du4428DeLaPaie = ligne('44280000', '2026-06-12', { credit: 37_000 });
        const r = await service([
            ligne('43110000', '2026-06-12', { credit: 65_000 }),
            { ...du4428DeLaPaie, ecriture: { ...du4428DeLaPaie.ecriture, bulletinsPaie: [{ id: 'b1' }] } },
            ligne('43340000', '2026-06-12', { credit: 1_000 }),
            ligne('43350000', '2026-06-12', { credit: 500 }),
        ]).registre('t1', { exerciceId: 'e1' });
        expect(nature(r, 'cnss').retenu).toBe(65_000);
        expect(nature(r, 'inppOnem').retenu).toBe(38_500);
        expect(nature(r, 'autresOrganismesSociaux').retenu).toBe(0);
        expect(r.natures.map((n) => n.cle)).not.toContain('inpp');
        expect(r.natures.map((n) => n.cle)).not.toContain('onem');
        expect(r.totalRetenu).toBe(103_500);
    });
    it('ne fait lire AUCUN compte des deux semis par deux natures à la fois', () => {
        const numeros = new Set(['43340000', '43350000']);
        for (const c of [...compte_seed_1.PLAN_COMPTES_SYCEBNL, ...compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA]) {
            if (/^4[34]/.test(c.numero) && c.typeCompte !== 'TOTAL')
                numeros.add(c.numero);
        }
        const doublons = [...numeros].filter((n) => correspondance_retenues_1.NATURES_RETENUES.filter((x) => (0, correspondance_retenues_1.compteRelevantDe)(n, x)).length > 1);
        expect(doublons).toEqual([]);
        expect(correspondance_retenues_1.NATURES_RETENUES.filter((x) => (0, correspondance_retenues_1.compteRelevantDe)('44280000', x)).map((x) => x.cle)).toEqual(['inppOnem']);
    });
    it('porte le taux ONEM de 0,5 % ET sa date d’effet', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        expect(nature(r, 'inppOnem').baseLegale).toContain('0,5 %');
        expect(nature(r, 'inppOnem').baseLegale).toContain('028/CAB/MIN.ET');
        expect(nature(r, 'inppOnem').reserve).toContain("DATE D'EFFET");
        expect(nature(r, 'inppOnem').reserve).toContain('25 septembre 2025');
        expect(nature(r, 'inppOnem').reserve).toMatch(/0,2\s*%/);
        expect(nature(r, 'inppOnem').baseLegale).not.toMatch(/0[.,]2\s*%/);
    });
    it('porte le barème INPP ANTÉRIEUR et la date d’effet du nouveau', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        const inpp = nature(r, 'inppOnem');
        expect(inpp.baseLegale).toContain('24 SEPTEMBRE 2025');
        expect(inpp.baseLegale).toContain('à la date de sa signature');
        expect(inpp.baseLegale).toContain('12/MTPS/123');
        expect(inpp.baseLegale).toContain('14 février 2006');
        expect(inpp.reserve).toContain("DATE D'EFFET");
        expect(inpp.baseLegale).not.toContain('1er JANVIER 2026');
        expect(inpp.reserve).not.toContain('1er JANVIER 2026');
    });
    it('nomme les QUATRE catégories de l’article 1er · le public n’est pas une tranche d’effectif', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        const inpp = nature(r, 'inppOnem');
        for (const taux of ['4 %', '3,5 %', '3 %', '2 %']) {
            expect(inpp.baseLegale).toContain(taux);
        }
        expect(inpp.baseLegale).toContain('PUBLICS');
        expect(inpp.baseLegale).toContain('PRIVÉS');
        expect(inpp.baseLegale).toContain('3 % pour les entreprises publiques');
        expect(inpp.reserve).toContain("NATURE de l'employeur");
    });
    it('n’invente PAS le taux de l’arrêté de 2003, dont seul le visa est connu', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        const inpp = nature(r, 'inppOnem');
        expect(inpp.reserve).toContain('28 mars 2003');
        expect(inpp.reserve).toContain("n'est PAS reconstitué");
        expect(inpp.baseLegale).not.toContain('2003');
    });
    it('restitue les numéros LISIBLES et signale celui qui ne l’est pas', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        const inpp = nature(r, 'inppOnem');
        expect(inpp.baseLegale).toContain('002/CAB/MET/2025');
        expect(inpp.baseLegale).toContain('003/CAB/VPM/MIN/BUD/2025');
        expect(inpp.reserve).toContain('ILLISIBLE');
    });
    it('sépare la déclaration ONEM (le 10) du versement ONEM (le 15)', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-03-05' });
        const declaration = e.echeances.find((x) => x.cle === 'declarationMensuelleOnem');
        const versement = e.echeances.find((x) => x.cle === 'inppOnem-onem');
        expect(declaration).toBeDefined();
        expect(versement).toBeDefined();
        expect(declaration.genre).toBe('DECLARATION');
        expect(versement.genre).toBe('REVERSEMENT');
        expect(declaration.periodicite).toBe('MENSUELLE');
        expect(declaration.sanction).toContain('50 %');
        expect(declaration.date.getMonth()).toBe(versement.date.getMonth());
        expect(declaration.date.getDate()).toBe(10);
        expect(versement.date.getDate()).toBe(15);
        expect(declaration.date.getTime()).toBeLessThan(versement.date.getTime());
    });
    it('avertit que la retenue omise est personnellement due (art. 96 bis)', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        expect(r.avertissements.join(' ')).toContain('96 bis');
    });
});
describe('Échéancier fiscal et social', () => {
    it('trie par date et garde les natures sans solde · déclarer reste dû', async () => {
        const s = service([ligne('44720000', '2026-06-10', { credit: 200_000 })]);
        const e = await s.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-06-20' });
        expect(e.echeances).toHaveLength(correspondance_retenues_1.NATURES_RETENUES.length + OBLIGATIONS_SYCEBNL.length + 1);
        const dates = e.echeances.map((x) => x.date.getTime());
        expect([...dates].sort((a, b) => a - b)).toEqual(dates);
    });
    it('porte le relevé trimestriel des sommes versées à des tiers (art. 47)', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-05-02' });
        const releve = e.echeances.find((x) => x.cle === 'releveTrimestrielTiers');
        expect(releve.periodicite).toBe('TRIMESTRIELLE');
        expect(releve.date.toISOString().slice(0, 10)).toBe('2026-07-10');
        expect(releve.sanction).toContain('500 000');
    });
    it('le relevé trimestriel du trimestre CLOS reste dû tant que ses dix jours courent', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-07-05' });
        const releve = e.echeances.find((x) => x.cle === 'releveTrimestrielTiers');
        expect(releve.date.toISOString().slice(0, 10)).toBe('2026-07-10');
    });
    it('le relevé trimestriel du 10 janvier est celui du trimestre de l’année écoulée', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-01-05' });
        const releve = e.echeances.find((x) => x.cle === 'releveTrimestrielTiers');
        expect(releve.date.toISOString().slice(0, 10)).toBe('2026-01-12');
    });
    it('la déclaration mensuelle du mois CLOS reste due jusqu’à son dixième jour', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-09-01' });
        const declaration = e.echeances.find((x) => x.cle === 'declarationMensuelleOnem');
        expect(declaration.date.toISOString().slice(0, 10)).toBe('2026-09-10');
    });
    it('PASSE D2 · la déclaration ONEM tombant un samedi n’est pas reportée, le relevé fiscal du même jour l’est', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-10-01' });
        const onem = e.echeances.find((x) => x.cle === 'declarationMensuelleOnem');
        expect(onem.date.toISOString().slice(0, 10)).toBe('2026-10-10');
        const releve = e.echeances.find((x) => x.cle === 'releveTrimestrielTiers');
        expect(releve.date.toISOString().slice(0, 10)).toBe('2026-10-12');
    });
    it('le relevé trimestriel bascule au trimestre suivant une fois l’échéance passée', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-07-20' });
        const releve = e.echeances.find((x) => x.cle === 'releveTrimestrielTiers');
        expect(releve.date.toISOString().slice(0, 10)).toBe('2026-10-12');
    });
    it('porte les deux déclarations annuelles du 31 mars (art. 22 ter et 47 ter)', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-05-02' });
        for (const cle of ['declarationAnnuelleSalaires', 'listeFournisseurs']) {
            const o = e.echeances.find((x) => x.cle === cle);
            expect(o.periodicite).toBe('ANNUELLE');
            expect(o.date.toISOString().slice(0, 10)).toBe('2027-03-31');
        }
    });
    it('distingue un reversement d’une déclaration · l’un porte un montant, l’autre non', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1' });
        expect(e.echeances.filter((x) => x.genre === 'DECLARATION')).toHaveLength(OBLIGATIONS_SYCEBNL.length);
        for (const d of e.echeances.filter((x) => x.genre === 'DECLARATION')) {
            expect(d.contenu).toBeTruthy();
        }
    });
    it('la prochaine échéance passe au mois suivant quand celle du mois est passée', async () => {
        const s = service([]);
        const quand = (e, cle) => e.echeances.find((x) => x.cle === cle).date.toISOString().slice(0, 10);
        const avant = await s.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-06-10' });
        const apres = await s.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-06-20' });
        expect(quand(avant, 'irppSalaires')).toBe('2026-06-15');
        expect(quand(apres, 'irppSalaires')).toBe('2026-07-15');
        expect(quand(avant, 'retenueLocative')).toBe('2026-06-10');
        expect(quand(apres, 'retenueLocative')).toBe('2026-07-10');
    });
    it('expose la date de dernière vérification des échéances · elles changent', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1' });
        expect(e.derniereVerificationEcheances).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
});
describe('registre des retenues · le crédit de TVA reporté n’est pas un reversement', () => {
    it('compte la TVA due du 4441 et ignore le 4449', async () => {
        const s = service([
            ligne('44410000', '2026-01-31', { credit: 500_000 }),
            ligne('44490000', '2026-01-31', { debit: 200_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const tva = nature(r, 'tva');
        expect(tva.retenu).toBe(500_000);
        expect(tva.reverse).toBe(0);
        expect(tva.solde).toBe(500_000);
    });
    it('reste exact en SYCEBNL, dont le plan n’a pas de 4449 · l’exclusion y est inerte', async () => {
        const s = service([
            ligne('44410000', '2026-01-31', { credit: 500_000 }),
            ligne('44410000', '2026-02-15', { debit: 500_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const tva = nature(r, 'tva');
        expect(tva.retenu).toBe(500_000);
        expect(tva.reverse).toBe(500_000);
        expect(tva.solde).toBe(0);
    });
    it('la nature TVA porte bien la forme commune aux deux référentiels', () => {
        const tva = correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === 'tva');
        expect(tva.comptes).toEqual(['444']);
        expect(tva.exclusions).toEqual(['4449']);
    });
});
describe('registre des retenues · le régime d’impôt suit le référentiel', () => {
    const params = { exerciceId: 'ex1' };
    it('annonce l’exemption d’IS à une ASBL et la redevabilité à une société', async () => {
        const asbl = await service([], 'SYCEBNL').registre('t1', params);
        expect(asbl.avertissements.join(' ')).toContain("L'exemption d'impôt sur les sociétés");
        expect(asbl.avertissements.join(' ')).not.toContain('est redevable');
        const societe = await service([], 'SYSCOHADA').registre('t2', params);
        expect(societe.avertissements.join(' ')).toContain("redevable de l'impôt sur les sociétés");
        expect(societe.avertissements.join(' ')).not.toContain("L'exemption d'impôt sur les sociétés");
    });
    it('garde des deux côtés la conclusion, qui est tout l’objet de l’état', async () => {
        for (const referentiel of ['SYCEBNL', 'SYSCOHADA']) {
            const r = await service([], referentiel).registre('t1', params);
            expect(`${referentiel}: ${r.avertissements.join(' ')}`).toContain("pour le compte d'autrui");
        }
    });
    it('sert à une société la réserve du prélèvement expatriés dans le bon sens', async () => {
        const asbl = await service([], 'SYCEBNL').registre('t1', params);
        expect(nature(asbl, 'prelevementExpatries').reserve).toContain('tension du texte');
        const societe = await service([], 'SYSCOHADA').registre('t2', params);
        const reserve = nature(societe, 'prelevementExpatries').reserve ?? '';
        expect(reserve).not.toContain('tension du texte');
        expect(reserve).toContain('art. 145');
        expect(reserve).toContain('69/007');
    });
    it('ne parle plus d’ASBL exonérée de TVA à un dossier assujetti', async () => {
        const asbl = await service([], 'SYCEBNL').registre('t1', params);
        expect(nature(asbl, 'tva').reserve).toContain('exonérée de TVA');
        const societe = await service([], 'SYSCOHADA').registre('t2', params);
        const reserve = nature(societe, 'tva').reserve ?? '';
        expect(reserve).toContain('assujettie de plein droit');
        expect(reserve).not.toContain('exonérée de TVA');
    });
    it('retombe sur la réserve commune quand il n’y a pas de variante', async () => {
        const societe = await service([], 'SYSCOHADA').registre('t2', params);
        expect(nature(societe, 'autresRetenues').reserve).toContain('retenue locative');
    });
});
describe('échéancier · l’article 47 ne vise pas les mêmes redevables selon son alinéa', () => {
    const params = { exerciceId: 'ex1' };
    const cles = async (referentiel) => (await service([], referentiel).echeancierFiscal('t1', params)).echeances.map((e) => e.cle);
    it('réserve le relevé général de l’alinéa 1er aux entités qu’il énumère', async () => {
        expect(await cles('SYCEBNL')).toContain('releveTrimestrielTiers');
        expect(await cles('SYSCOHADA')).not.toContain('releveTrimestrielTiers');
    });
    it('sert aux deux le relevé de l’alinéa 2, qui vise « les entreprises ET les associations »', async () => {
        for (const referentiel of ['SYCEBNL', 'SYSCOHADA']) {
            expect(`${referentiel}`).toBe(referentiel);
            expect(await cles(referentiel)).toContain('releveTrimestrielDroitsAuteur');
        }
    });
    it('sert aux deux l’article 47 ter, qui vise « exonérée ou non »', async () => {
        for (const referentiel of ['SYCEBNL', 'SYSCOHADA']) {
            expect(await cles(referentiel)).toContain('listeFournisseurs');
        }
    });
});
describe('Retenue non reversée et déductibilité de la charge (loi n° 23/053, art. 20)', () => {
    const signalements = (r) => r.signalementsDeductibilite;
    const ligneNature = (r, cle) => r.natures.find((n) => n.cle === cle);
    it('signale la charge exposée quand la retenue échue n’est pas reversée', async () => {
        const s = service([ligne('44782000', '2026-03-31', { credit: 4_200_000 })], 'SYSCOHADA');
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const signale = signalements(r);
        expect(signale.map((x) => x.cle)).toEqual(['prestatairesNonResidents']);
        expect(signale[0].montantEchuNonReverse).toBe(4_200_000);
        expect(signale[0].derniereEcheanceEchue.toISOString().slice(0, 10)).toBe('2026-04-15');
        expect(signale[0].charge).toContain('non-résidents');
        const avertissement = r.avertissements.join(' ');
        expect(avertissement).toContain('article 20');
        expect(avertissement).toContain('preuve de la déclaration et du paiement');
    });
    it('ne signale RIEN quand la retenue a été reversée à temps, et le drapeau mensuel non plus', async () => {
        const s = service([
            ligne('44782000', '2026-03-31', { credit: 4_200_000 }),
            ligne('44782000', '2026-04-14', { debit: 4_200_000 }),
        ], 'SYSCOHADA');
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        expect(signalements(r)).toHaveLength(0);
        expect(r.avertissements.join(' ')).not.toContain('RETENUES ÉCHUES');
        const n = ligneNature(r, 'prestatairesNonResidents');
        expect(n.solde).toBe(0);
        expect(n.retenuEchuNonReverse).toBe(0);
        expect(n.moisEnRetard).toBe(0);
    });
    it('ne signale rien tant que l’échéance n’est pas passée · il n’y a pas encore de preuve à rapporter', async () => {
        const s = service([ligne('44782000', '2026-06-12', { credit: 4_200_000 })], 'SYSCOHADA');
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        expect(signalements(r)).toHaveLength(0);
        expect(ligneNature(r, 'prestatairesNonResidents').derniereEcheanceEchue).toBeNull();
    });
    it('ne retient que la part ÉCHUE, et impute le reversement sur les plus anciennes', async () => {
        const s = service([
            ligne('44782000', '2026-03-31', { credit: 1_000_000 }),
            ligne('44782000', '2026-04-10', { debit: 400_000 }),
            ligne('44782000', '2026-06-30', { credit: 700_000 }),
        ], 'SYSCOHADA');
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-07-05' });
        const n = ligneNature(r, 'prestatairesNonResidents');
        expect(n.solde).toBe(1_300_000);
        expect(n.retenuEchuNonReverse).toBe(600_000);
        expect(signalements(r)[0].montantEchuNonReverse).toBe(600_000);
    });
    it('ne rattache la condition ni à la TVA, ni aux cotisations sociales, ni à la retenue sur plus-values', async () => {
        const s = service([
            ligne('44400000', '2026-03-31', { credit: 900_000 }),
            ligne('43110000', '2026-03-31', { credit: 650_000 }),
            ligne('44785000', '2026-03-31', { credit: 300_000 }),
        ], 'SYSCOHADA');
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        expect(signalements(r)).toHaveLength(0);
        for (const cle of ['tva', 'cnss', 'plusValues']) {
            const n = ligneNature(r, cle);
            expect(n.retenuEchuNonReverse).toBeGreaterThan(0);
            expect(n.chargeSousConditionArticle20).toBeNull();
        }
    });
    it('AVERTIT sans chiffrer · il nomme la charge, ne calcule aucune réintégration', async () => {
        const s = service([ligne('44782000', '2026-03-31', { credit: 4_200_000 })], 'SYSCOHADA');
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const avertissement = r.avertissements.find((a) => a.includes('RETENUES ÉCHUES'));
        expect(avertissement).toContain('réintégration');
        expect(avertissement).toContain('applique aucun taux');
        expect(avertissement).toContain('Résultat fiscal');
        expect(signalements(r)[0].montantEchuNonReverse).toBe(4_200_000);
        expect(avertissement).toContain((4_200_000).toLocaleString('fr-FR'));
        expect(avertissement).toContain('exercice suivant');
    });
    it('un dossier SYCEBNL est renvoyé à son exemption d’IS, et non à une réintégration', async () => {
        const s = service([ligne('44782000', '2026-03-31', { credit: 4_200_000 })], 'SYCEBNL');
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const avertissement = r.avertissements.find((a) => a.includes('RETENUES ÉCHUES'));
        expect(avertissement).toContain('article 5');
        expect(avertissement).toContain('007/CAB/MIN/FINANCES/2025');
        expect(avertissement).not.toContain('réintégration');
        expect(avertissement).toContain('reste dû');
    });
    it('l’échéancier porte le même avertissement que le registre', async () => {
        const s = service([ligne('44782000', '2026-03-31', { credit: 4_200_000 })], 'SYSCOHADA');
        const e = await s.echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        expect(e.avertissements.join(' ')).toContain('RETENUES ÉCHUES');
    });
});
describe('Le reversement s’impute sur le mois de la retenue qu’il éteint (art. 18)', () => {
    it('une retenue de mars reversée le 14 avril ne laisse mars ni crédité ni en retard', async () => {
        const s = service([
            ligne('44720000', '2026-03-31', { credit: 350_000 }),
            ligne('44720000', '2026-04-14', { debit: 350_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const n = nature(r, 'irppSalaires');
        const mars = n.mois.find((m) => m.mois === '2026-03');
        expect(mars.reverse).toBe(350_000);
        expect(mars.solde).toBe(0);
        expect(mars.enRetard).toBe(false);
        expect(n.moisEnRetard).toBe(0);
    });
    it('douze mois de paie régulièrement reversés ne donnent AUCUN mois en retard', async () => {
        const lignes = [];
        for (let mois = 1; mois <= 12; mois++) {
            const finDeMois = new Date(2026, mois, 0);
            lignes.push(ligne('44720000', finDeMois.toISOString().slice(0, 10), { credit: 100_000 * mois }));
            if (mois < 12) {
                lignes.push(ligne('44720000', `2026-${String(mois + 1).padStart(2, '0')}-14`, { debit: 100_000 * mois }));
            }
        }
        const r = await service(lignes).registre('t1', { exerciceId: 'e1', dateReference: '2026-12-20' });
        const n = nature(r, 'irppSalaires');
        expect(n.moisEnRetard).toBe(0);
        expect(n.solde).toBe(1_200_000);
        expect(n.mois.find((m) => m.mois === '2026-12').enRetard).toBe(false);
    });
    it('un solde nul et des mois en retard ne peuvent plus s’afficher ensemble', async () => {
        const lignes = [];
        for (let mois = 1; mois <= 3; mois++) {
            const finDeMois = new Date(2026, mois, 0);
            lignes.push(ligne('44720000', finDeMois.toISOString().slice(0, 10), { credit: 100_000 * mois }));
            lignes.push(ligne('44720000', `2026-${String(mois + 1).padStart(2, '0')}-14`, { debit: 100_000 * mois }));
        }
        const r = await service(lignes).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const n = nature(r, 'irppSalaires');
        expect(n.solde).toBe(0);
        expect(n.moisEnRetard).toBe(0);
        expect(r.totalDu).toBe(0);
    });
    it('impute un reversement partiel sur le mois le plus ancien, et garde la trace du débit', async () => {
        const s = service([
            ligne('44782000', '2026-03-31', { credit: 1_000_000 }),
            ligne('44782000', '2026-04-14', { debit: 400_000 }),
            ligne('44782000', '2026-04-30', { credit: 600_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const n = nature(r, 'prestatairesNonResidents');
        const mars = n.mois.find((m) => m.mois === '2026-03');
        const avril = n.mois.find((m) => m.mois === '2026-04');
        expect(mars.reverse).toBe(400_000);
        expect(mars.solde).toBe(600_000);
        expect(mars.enRetard).toBe(true);
        expect(avril.reverse).toBe(0);
        expect(avril.reverseEcritures).toBe(400_000);
        expect(avril.solde).toBe(600_000);
        expect(n.moisEnRetard).toBe(2);
        expect(n.reverse).toBe(400_000);
        expect(n.solde).toBe(1_200_000);
    });
    it('le mois réellement impayé reste signalé · corriger n’est pas taire', async () => {
        const s = service([ligne('44782000', '2026-03-31', { credit: 4_200_000 })]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const n = nature(r, 'prestatairesNonResidents');
        expect(n.moisEnRetard).toBe(1);
        expect(n.mois.find((m) => m.mois === '2026-03').enRetard).toBe(true);
        expect(r.avertissements.join(' ')).toContain('RETENUES ÉCHUES');
    });
    it('dit le reversement qu’aucun mois de l’exercice n’absorbe, au lieu de le lisser', async () => {
        const s = service([ligne('44720000', '2026-01-14', { debit: 250_000 })]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2026-06-15' });
        const n = nature(r, 'irppSalaires');
        expect(n.reverseNonImpute).toBe(250_000);
        expect(n.mois[0].reverse).toBe(0);
        expect(n.mois[0].reverseEcritures).toBe(250_000);
        expect(r.avertissements).toContain(correspondance_retenues_1.AVERTISSEMENT_REVERSEMENT_ANTERIEUR);
    });
    it('avertit que le reversement de décembre peut vivre sur l’exercice suivant', async () => {
        const s = service([ligne('44720000', '2026-12-31', { credit: 400_000 })]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2027-02-01' });
        expect(nature(r, 'irppSalaires').moisEnRetard).toBe(1);
        expect(r.avertissements).toContain(correspondance_retenues_1.AVERTISSEMENT_REVERSEMENT_EXERCICE_SUIVANT);
    });
    it('ne crie pas la réserve d’exercice à un dossier qui n’a aucun mois signalé', async () => {
        const r = await service([ligne('44720000', '2026-06-30', { credit: 400_000 })]).registre('t1', {
            exerciceId: 'e1',
            dateReference: '2026-07-01',
        });
        expect(r.avertissements).not.toContain(correspondance_retenues_1.AVERTISSEMENT_REVERSEMENT_EXERCICE_SUIVANT);
        expect(r.avertissements).not.toContain(correspondance_retenues_1.AVERTISSEMENT_REVERSEMENT_ANTERIEUR);
    });
});
describe('Sanction du relevé trimestriel non déposé (art. 94)', () => {
    it('sert la grille par TAILLE, et non les 500 000 FC de la rédaction abrogée', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-05-02' });
        const releve = e.echeances.find((x) => x.cle === 'releveTrimestrielTiers');
        expect(releve.sanction).toContain('5 000 000');
        expect(releve.sanction).toContain('2 500 000');
        expect(releve.sanction).toContain('250 000');
        expect(releve.sanction).toContain('associations sans but lucratif');
        expect(releve.sanction).toContain('23/056');
        expect(releve.sanction).not.toContain('500 000 francs congolais pour une personne morale');
    });
    it('sert la même grille au relevé des droits d’auteurs, servi aux deux référentiels', async () => {
        for (const referentiel of ['SYCEBNL', 'SYSCOHADA']) {
            const e = await service([], referentiel).echeancierFiscal('t1', {
                exerciceId: 'e1',
                dateReference: '2026-05-02',
            });
            const releve = e.echeances.find((x) => x.cle === 'releveTrimestrielDroitsAuteur');
            expect(releve.sanction).toContain('2 500 000');
            expect(releve.sanction).not.toContain('500 000 francs congolais pour une personne morale');
        }
    });
    it('ne choisit AUCUN des trois montants · la taille de l’entité n’est pas dans le logiciel', async () => {
        const e = await service([]).echeancierFiscal('t1', { exerciceId: 'e1', dateReference: '2026-05-02' });
        const releve = e.echeances.find((x) => x.cle === 'releveTrimestrielTiers');
        expect(releve.sanction).toContain('ne connaît pas la taille');
    });
});
describe('Prélèvement sur les capitaux mobiliers versés à des non-résidents', () => {
    it('porte la déclaration mensuelle de l’article 22 quater, au 15 du mois suivant', async () => {
        const e = await service([], 'SYSCOHADA').echeancierFiscal('t1', {
            exerciceId: 'e1',
            dateReference: '2026-05-02',
        });
        const o = e.echeances.find((x) => x.cle === 'prelevementCapitauxMobiliersNonResidents');
        expect(o.genre).toBe('DECLARATION');
        expect(o.periodicite).toBe('MENSUELLE');
        expect(o.date.toISOString().slice(0, 10)).toBe('2026-05-15');
        expect(o.baseLegale).toContain('22 quater');
        expect(o.baseLegale).toContain('149 quater');
        expect(o.baseLegale).toContain('20 %');
    });
    it('ne la sert PAS à une ASBL · l’article 149 ter ne vise que « des sociétés »', async () => {
        const cles = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)('SYCEBNL').map((o) => o.cle);
        expect(cles).not.toContain('prelevementCapitauxMobiliersNonResidents');
        expect((0, correspondance_retenues_1.obligationsDeclarativesApplicables)('SYSCOHADA').map((o) => o.cle)).toContain('prelevementCapitauxMobiliersNonResidents');
    });
    it('n’invente NI nature NI compte · le 44784 ne dit pas la résidence du bénéficiaire', async () => {
        expect(correspondance_retenues_1.NATURES_RETENUES.filter((n) => n.comptes.includes('44784'))).toHaveLength(1);
        const r = await service([], 'SYSCOHADA').registre('t1', { exerciceId: 'e1' });
        expect(nature(r, 'capitauxMobiliers').reserve).toContain('RÉSIDENCE');
    });
    it('cite le chapitre non-résidents SANS inventer d’écart d’assiette avec l’interne', async () => {
        const r = await service([], 'SYSCOHADA').registre('t1', { exerciceId: 'e1' });
        const n = nature(r, 'capitauxMobiliers');
        expect(n.baseLegale).toContain('149 bis à 149 quinquies');
        expect(n.baseLegale).toContain('même assiette brute');
        expect(n.baseLegale).toContain('DEUX déclarations');
    });
});
describe('Le forfait trimestriel du personnel domestique et des micro-entreprises', () => {
    it('avertit, cite ses trois textes, et ne chiffre AUCUNE quotité', async () => {
        for (const referentiel of ['SYCEBNL', 'SYSCOHADA']) {
            const r = await service([], referentiel).registre('t1', { exerciceId: 'e1' });
            const reserve = nature(r, 'irppSalaires').reserve;
            expect(reserve).toContain('article 70, alinéa 2');
            expect(reserve).toContain('019/CAB/MIN/FINANCES/2025');
            expect(reserve).toContain('quotité trimestrielle');
            expect(reserve).toContain('LIBÉRATOIRE');
            expect(reserve).toContain('art. 121, alinéa 2');
            expect(reserve).toContain('24 dollars');
            expect(reserve).toContain('36 dollars');
            expect(reserve).toContain('CE QUE LE LOGICIEL NE SAIT PAS');
        }
    });
    it('date toujours la paie au 15 du mois suivant · il ne devine pas la catégorie du salarié', async () => {
        const r = await service([ligne('44720000', '2026-03-31', { credit: 120_000 })]).registre('t1', {
            exerciceId: 'e1',
        });
        expect(nature(r, 'irppSalaires').mois[0].echeance.toISOString().slice(0, 10)).toBe('2026-04-15');
    });
});
describe('Contribution nationale · la base légale qui ne se vérifiait pas', () => {
    it('ne fonde plus la ligne sur l’article 18, qui ne la vise pas', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        const n = nature(r, 'contributions');
        expect(n.baseLegale).not.toBe('Article 18 de la loi de procédures fiscales (retenues à la source).');
        expect(n.baseLegale).toContain("AUCUN PRÉLÈVEMENT DE DROIT CONGOLAIS N'EST IDENTIFIÉ");
        expect(n.baseLegale).toContain('revenus salariaux et revenus assimilés');
    });
    it('annonce sa date comme un REPÈRE, et non comme une échéance tirée d’un texte', async () => {
        const r = await service([]).registre('t1', { exerciceId: 'e1' });
        const n = nature(r, 'contributions');
        expect(n.echeance).toContain('repère');
        expect(n.reserve).toContain('ne le devine pas');
    });
    it('les douze autres natures citent toujours un texte qui les vise', async () => {
        for (const n of correspondance_retenues_1.NATURES_RETENUES) {
            if (n.cle === 'contributions')
                continue;
            expect(n.baseLegale).toMatch(/[Aa]rticle|[Aa]rt\.|loi|Loi|arrêté|Arrêté|décret|Décret|Ordonnance|conventions/);
        }
    });
    it("la retenue locative rattache chaque taux au texte qui le PORTE, pas à celui qui le modifie", () => {
        const b = correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === 'retenueLocative').baseLegale;
        expect(b).toContain('20 %');
        expect(b).toContain("loi n° 83/004 du 23 février 1983");
        expect(b).toContain('22 %');
        expect(b).toContain("ordonnance-loi n° 69/009");
        expect(b).toContain('109/2000');
        expect(b).not.toContain('du régime de retenue, décret-loi');
    });
    it("l'abrogation du 69/009 est dite PARTIELLE là où le logiciel s'appuie sur ce qui survit", () => {
        const b = correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === 'retenueLocative').baseLegale;
        expect(b).toContain('titre II');
        expect(b).toContain('titres III et IV');
    });
});
describe('L’échéance suit le mois du VERSEMENT, pas celui de l’écriture (art. 18)', () => {
    it('une paie de décembre versée le 5 janvier est due le 15 février, et n’est pas en retard', async () => {
        const s = service([ligne('44720000', '2026-12-31', { credit: 400_000 }, '2027-01-05')]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2027-02-01' });
        const n = nature(r, 'irppSalaires');
        expect(n.mois.map((m) => m.mois)).toEqual(['2027-01']);
        expect(n.mois[0].echeance.toISOString().slice(0, 10)).toBe('2027-02-15');
        expect(n.mois[0].enRetard).toBe(false);
        expect(n.moisEnRetard).toBe(0);
    });
    it('la MÊME ligne sans date de versement ne bouge pas d’un jour · le comportement d’avant', async () => {
        const s = service([ligne('44720000', '2026-12-31', { credit: 400_000 })]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2027-02-01' });
        const n = nature(r, 'irppSalaires');
        expect(n.mois.map((m) => m.mois)).toEqual(['2026-12']);
        expect(n.mois[0].echeance.toISOString().slice(0, 10)).toBe('2027-01-15');
        expect(n.mois[0].enRetard).toBe(true);
    });
    it('l’imputation du reversement classe les mois sur le versement, et non sur l’écriture', async () => {
        const s = service([
            ligne('44720000', '2026-11-30', { credit: 300_000 }),
            ligne('44720000', '2026-12-31', { credit: 500_000 }, '2027-01-05'),
            ligne('44720000', '2026-12-14', { debit: 300_000 }),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2027-02-01' });
        const n = nature(r, 'irppSalaires');
        expect(n.mois.map((m) => m.mois)).toEqual(['2026-11', '2026-12', '2027-01']);
        expect(n.mois[0].reverse).toBe(300_000);
        expect(n.mois[0].solde).toBe(0);
        expect(n.mois[1].retenu).toBe(0);
        expect(n.mois[1].reverseEcritures).toBe(300_000);
        expect(n.mois[2].solde).toBe(500_000);
        expect(n.mois[2].echeance.toISOString().slice(0, 10)).toBe('2027-02-15');
        expect(n.moisEnRetard).toBe(0);
    });
    it('le signalement de l’article 20 suit le même mois · rien à prouver avant l’échéance', async () => {
        const s = service([ligne('44782000', '2026-12-31', { credit: 1_000_000 }, '2027-01-05')], 'SYSCOHADA');
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2027-02-01' });
        expect(r.signalementsDeductibilite).toEqual([]);
        expect(r.avertissements.join(' ')).not.toContain('RETENUES ÉCHUES');
    });
    it('déplace aussi la trace du débit, sans toucher à l’arithmétique du compte', async () => {
        const s = service([
            ligne('44720000', '2026-11-30', { credit: 300_000 }),
            ligne('44720000', '2026-12-31', { debit: 300_000 }, '2027-01-05'),
        ]);
        const r = await s.registre('t1', { exerciceId: 'e1', dateReference: '2027-02-01' });
        const n = nature(r, 'irppSalaires');
        expect(n.reverse).toBe(300_000);
        expect(n.mois.find((m) => m.mois === '2026-11').reverse).toBe(300_000);
        expect(n.mois.find((m) => m.mois === '2026-11').solde).toBe(0);
        expect(n.mois.find((m) => m.mois === '2027-01').reverseEcritures).toBe(300_000);
        expect(n.moisEnRetard).toBe(0);
    });
});
describe('Ce que le dépôt AFFIRME sur les sanctions · vérifié contre le texte', () => {
    it("l'article 96 bis est daté de son INSERTION, pas de son remplacement", () => {
        expect(correspondance_retenues_1.AVERTISSEMENT_REDEVABLE).toContain('24/011');
        expect(correspondance_retenues_1.AVERTISSEMENT_REDEVABLE).toContain('25/060');
        expect(correspondance_retenues_1.AVERTISSEMENT_REDEVABLE).toContain('REMPLACÉ');
        expect(correspondance_retenues_1.AVERTISSEMENT_REDEVABLE).toContain('RÉSERVE');
    });
    it("L'ENTREPRENANT EST UNE PERSONNE PHYSIQUE · la liste en porte DEUX, pas une", () => {
        expect(correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES).toContain('ENTREPRISE_INDIVIDUELLE');
        expect(correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES).toContain('ENTREPRENANT');
        expect(correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES).toHaveLength(2);
    });
});
describe('Passe F6 · l’impôt suit la qualité de la personne (art. 1er et art. 2, 17°, a))', () => {
    it('sert l’IRPP, et non l’impôt sur les sociétés, à une entreprise individuelle', () => {
        const message = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'ENTREPRISE_INDIVIDUELLE');
        expect(message).toContain('PERSONNE PHYSIQUE');
        expect(message).toContain("l'impôt sur les sociétés ne lui est PAS dû");
        expect(message).toContain('impôt unique sur le revenu des personnes physiques');
        expect(message).toContain('article 17');
        expect(message).toContain('DÉPEND DU RÉGIME');
        expect(message).toContain('Résultat fiscal et impôt sur les bénéfices');
    });
    it('sert le même message à un entreprenant · les deux formes vivent dans une seule liste', () => {
        const entreprenant = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'ENTREPRENANT');
        const individuelle = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'ENTREPRISE_INDIVIDUELLE');
        expect(entreprenant).toBe(individuelle);
        expect(correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES).toEqual(['ENTREPRISE_INDIVIDUELLE', 'ENTREPRENANT']);
    });
    it('continue de servir l’impôt sur les sociétés à une SARL · la correction n’a pas débordé', () => {
        const message = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'SOCIETE_RESPONSABILITE_LIMITEE');
        expect(message).toContain("La société est redevable de l'impôt sur les sociétés");
        expect(message).toContain('25 juillet, 25 septembre et 25 novembre');
    });
    it('forme non renseignée · on ne devine pas, le repli société reste servi', () => {
        const message = (0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', null);
        expect(message).toContain("La société est redevable de l'impôt sur les sociétés");
    });
    it('les deux branches déjà lues restent intactes · entité publique et coopérative', () => {
        expect((0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'ENTITE_PUBLIQUE')).toContain('ENTITÉ PUBLIQUE');
        expect((0, correspondance_retenues_1.avertissementRegimeImpot)('SYSCOHADA', 'SOCIETE_COOPERATIVE')).toContain('SOCIÉTÉ COOPÉRATIVE');
    });
});
describe('Passe F6 · le prélèvement des capitaux mobiliers ne vise que « les sociétés »', () => {
    it('n’est plus servi à une entreprise individuelle ni à un entreprenant', () => {
        for (const forme of correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES) {
            const cles = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)('SYSCOHADA', forme).map((o) => o.cle);
            expect(cles).not.toContain('prelevementCapitauxMobiliersNonResidents');
        }
    });
    it('reste servi à une société, à une succursale et à une entité publique', () => {
        for (const forme of ['SOCIETE_ANONYME', 'SUCCURSALE', 'ENTITE_PUBLIQUE']) {
            const cles = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)('SYSCOHADA', forme).map((o) => o.cle);
            expect(cles).toContain('prelevementCapitauxMobiliersNonResidents');
        }
    });
    it('forme non renseignée · rien n’est retranché', () => {
        const cles = (0, correspondance_retenues_1.obligationsDeclarativesApplicables)('SYSCOHADA', null).map((o) => o.cle);
        expect(cles).toContain('prelevementCapitauxMobiliersNonResidents');
    });
    it('dit pourquoi les deux formes restantes ne sont pas exclues, et ne se lit pas comme une dispense', () => {
        const o = correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((x) => x.cle === 'prelevementCapitauxMobiliersNonResidents');
        expect(o.sourceDonnees).toContain('SUCCURSALE');
        expect(o.sourceDonnees).toContain('ENTITÉ PUBLIQUE');
        expect(o.sourceDonnees).toContain('art. 120');
    });
});
describe('Passe F6 · l’abrogation de l’O.-L. n° 69/007 porte sa date d’effet (art. 152 et 153)', () => {
    it('borne la mort du régime expatrié au 1er janvier 2026', () => {
        const nature = correspondance_retenues_1.NATURES_RETENUES.find((n) => n.cle === 'prelevementExpatries');
        expect(nature.reserveSyscohada).toContain('SUR UN EXERCICE ANTÉRIEUR au 1er JANVIER 2026');
    });
});
describe("CNSS · l'assiette est la rémunération, pas le revenu imposable", () => {
    const cnss = () => correspondance_retenues_1.NATURES_RETENUES.find((r) => r.cle === 'cnss');
    it("énonce la CONCLUSION, et pas seulement ses sources", () => {
        expect(cnss().reserve).toContain("L'ASSIETTE N'EST PAS LE REVENU IMPOSABLE");
        expect(cnss().reserve).toContain("sont assises sur l'ensemble de la rémunération du travailleur assujetti");
    });
    it("cite l'article 13 de la loi n° 16/009, qui ROUTE l'assiette vers le Code du travail", () => {
        expect(cnss().reserve).toContain('article 13 de la loi n° 16/009');
        expect(cnss().reserve).toContain("ARTICLE 7, LITERA H, DU CODE DU TRAVAIL");
    });
    it("cite l'arrêté n° 146/2018, article 17, point 1, qui recopie la définition", () => {
        expect(cnss().reserve).toContain('arrêté n° 146/2018, article 17, point 1');
    });
    it('nomme les CINQ exclusions, et dit qu\'elles sont inconditionnelles', () => {
        const r = cnss().reserve ?? '';
        for (const exclusion of [
            'soins de santé',
            'logement',
            'allocations familiales légales',
            'transport',
            'frais de voyage',
        ]) {
            expect(r).toContain(exclusion);
        }
        expect(r).toContain('INCONDITIONNELLES');
    });
    it('oppose ces exclusions aux immunités conditionnelles de la loi fiscale', () => {
        expect(cnss().reserve).toContain("article 69 de la loi n° 23/053");
    });
    it('porte la preuve que la déclaration apporte elle-même', () => {
        const r = cnss().reserve ?? '';
        expect(r).toContain('Mod. DC');
        expect(r).toContain('PRISES EN CONSIDÉRATION POUR LE CALCUL DES COTISATIONS');
    });
    it("nomme les deux régimes étrangers qui disent l'inverse, pour qu'on ne s'en serve pas", () => {
        const r = cnss().reserve ?? '';
        expect(r).toContain('1314-25');
        expect(r).toContain('salaire brut imposable');
    });
});
describe('Passe F13 · échéancier et loi de finances n° 25/060', () => {
    const cles = (referentiel, forme) => (0, correspondance_retenues_1.obligationsDeclarativesApplicables)(referentiel, (forme ?? null)).map((o) => o.cle);
    it('le PV d’assemblée de l’art. 13 bis ne vise que les personnes soumises à l’IS', () => {
        expect(cles('SYSCOHADA', 'SA')).toContain('procesVerbalAssemblee');
        expect(cles('SYSCOHADA')).toContain('procesVerbalAssemblee');
        expect(cles('SYCEBNL')).not.toContain('procesVerbalAssemblee');
        for (const forme of correspondance_retenues_1.FORMES_PERSONNES_PHYSIQUES) {
            expect(cles('SYSCOHADA', forme)).not.toContain('procesVerbalAssemblee');
        }
        const pv = correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'procesVerbalAssemblee');
        expect(pv.baseLegale).toContain('soumises à l’impôt sur les sociétés');
    });
    it('la déclaration d’IS dit que le solde de l’impôt se paie au dépôt (art. 57 bis, al. 3)', () => {
        const is = correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'declarationImpotSocietes');
        expect(is.contenu).toContain('le solde éventuel de cet impôt devant être versé au moment du dépôt');
        expect(is.baseLegale).toContain('loi de finances n° 25/060');
        expect(is.baseLegale).toContain('Le redevable de l’impôt sur les sociétés est tenu');
    });
    it('chaque article est daté de son texte, pas de la loi n° 25/060 par défaut', () => {
        const salaires = correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'declarationAnnuelleSalaires');
        expect(salaires.baseLegale).toContain('créé par la loi de finances n° 22/071');
        expect(salaires.baseLegale).toContain('modifié par la loi de finances n° 25/060');
        expect(salaires.sourceDonnees).toContain('PAR PROVINCE');
    });
    it('la liste des fournisseurs de l’art. 47 ter lit aussi les fournisseurs d’investissements', () => {
        const liste = correspondance_retenues_1.OBLIGATIONS_DECLARATIVES.find((o) => o.cle === 'listeFournisseurs');
        expect(liste.sourceDonnees).toContain('481');
    });
    it('l’art. 96 bis rend la personne redevable de la retenue ET des pénalités', () => {
        expect(correspondance_retenues_1.AVERTISSEMENT_REDEVABLE).toContain('ET DES PÉNALITÉS Y AFFÉRENTES');
    });
});
//# sourceMappingURL=retenues.spec.js.map