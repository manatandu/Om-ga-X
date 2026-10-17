"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const retenues_service_1 = require("./retenues.service");
const inpp_onem_du_4428_1 = require("./inpp-onem-du-4428");
const passation_paie_1 = require("../personnel/passation-paie");
function ligne(numero, date, montant, s = {}) {
    return {
        debit: montant.debit ?? 0,
        credit: montant.credit ?? 0,
        dateVersement: null,
        lettrageId: s.lettrage ?? null,
        compte: { numero, intitule: `Compte ${numero}` },
        ecriture: {
            date: new Date(date),
            libelle: 'Écriture',
            reference: null,
            estGenereeParCloture: false,
            estSoldeDesComptesDeGestion: false,
            bulletinsPaie: s.paie ? [{ id: 'b1' }] : [],
            bulletinsPaieRepris: [],
            lignes: s.charge ? [{ id: 'l6415' }] : [],
        },
    };
}
function service(lignes) {
    const prisma = {
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ referentiel: 'SYSCOHADA' }) },
        ligneEcriture: { findMany: jest.fn().mockResolvedValue(lignes) },
        exercice: { findFirst: jest.fn().mockResolvedValue(null) },
        mandatAuditeur: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new retenues_service_1.RetenuesService(prisma);
}
const inppOnem = (r) => r.natures.find((n) => n.cle === 'inppOnem');
describe('M1 · le 4428 se partage par sa structure, jamais par son numéro', () => {
    it('les charges qui rattachent sont celles que la passation de la paie donne à l’INPP et à l’ONEM', () => {
        for (const role of ['FORMATION_PROFESSIONNELLE_CONTINUE', 'TAXES_SUR_SALAIRES']) {
            for (const c of [passation_paie_1.NOMENCLATURE_PAIE[role].SYSCOHADA, passation_paie_1.NOMENCLATURE_PAIE[role].SYCEBNL]) {
                expect(inpp_onem_du_4428_1.RACINES_CHARGE_INPP_ONEM.some((r) => c.startsWith(r))).toBe(true);
            }
        }
    });
    it('une taxe étrangère au 4428 n’apparaît pas dans l’INPP et l’ONEM, ni en retard · elle est nommée', async () => {
        const r = await service([
            ligne('44280000', '2026-06-30', { credit: 37_000 }, { paie: true }),
            ligne('44280000', '2026-03-10', { credit: 50_000 }),
        ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
        const n = inppOnem(r);
        expect(n.retenu).toBe(37_000);
        expect(n.moisEnRetard).toBe(0);
        expect(n.mention4428).toContain('50000.00 FC crédités cet exercice ne viennent ni de la paie');
        expect(r.avertissements).toContain(n.mention4428);
    });
    it('la charge 6415 ou 6413 dans la même écriture rattache aussi · une saisie manuelle de l’INPP compte', async () => {
        const r = await service([
            ligne('44280000', '2026-02-27', { credit: 12_000 }, { charge: true }),
            ligne('44280000', '2026-02-27', { credit: 8_000 }),
        ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
        const n = inppOnem(r);
        expect(n.retenu).toBe(12_000);
        expect(n.moisEnRetard).toBe(1);
        expect(n.retardIndetermine).toBe(false);
    });
    it('un reversement lettré avec la dette de la paie l’éteint ; un reversement non rattaché suspend l’affirmation du retard', async () => {
        const lettre = await service([
            ligne('44280000', '2026-02-27', { credit: 12_000 }, { paie: true, lettrage: 'g1' }),
            ligne('44280000', '2026-03-14', { debit: 12_000 }, { lettrage: 'g1' }),
            ligne('44280000', '2026-02-27', { credit: 8_000 }),
        ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
        expect(inppOnem(lettre).reverse).toBe(12_000);
        expect(inppOnem(lettre).solde).toBe(0);
        expect(inppOnem(lettre).moisEnRetard).toBe(0);
        const nonRattache = await service([
            ligne('44280000', '2026-02-27', { credit: 12_000 }, { paie: true }),
            ligne('44280000', '2026-03-14', { debit: 8_000 }),
            ligne('44280000', '2026-02-27', { credit: 8_000 }),
        ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
        const n = inppOnem(nonRattache);
        expect(n.retenu).toBe(12_000);
        expect(n.reverse).toBe(0);
        expect(n.retardIndetermine).toBe(true);
        expect(n.moisEnRetard).toBe(0);
        expect(n.mention4428).toContain('8000.00 FC de reversements au 4428 ne sont rattachés à aucune dette');
    });
    it('un 4428 PUR (rien que la paie) se lit en entier, reversements non lettrés compris, comme avant', async () => {
        const r = await service([
            ligne('44280000', '2026-02-27', { credit: 12_000 }, { paie: true }),
            ligne('44280000', '2026-03-14', { debit: 12_000 }),
        ]).registre('t1', { exerciceId: 'e1', dateReference: '2026-06-30' });
        const n = inppOnem(r);
        expect(n.retenu).toBe(12_000);
        expect(n.reverse).toBe(12_000);
        expect(n.mention4428).toBeNull();
        expect(n.moisEnRetard).toBe(0);
    });
    it('les 4334 et 4335 d’un dossier ancien restent lus en entier · leur intitulé est leur structure', () => {
        const p = (0, inpp_onem_du_4428_1.partagerLe4428)([
            { debit: 0, credit: 1_000, compte: { numero: '43340000' }, ecriture: {} },
            { debit: 0, credit: 2_000, compte: { numero: '44280000' }, ecriture: {} },
        ]);
        expect(p.pur).toBe(false);
        expect(p.lues.size).toBe(0);
        expect(p.creditsEtrangersFc).toBe(2_000);
    });
});
//# sourceMappingURL=inpp-onem-du-4428.spec.js.map