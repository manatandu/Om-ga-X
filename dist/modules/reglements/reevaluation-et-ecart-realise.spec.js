"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const reevaluation_et_ecart_realise_1 = require("./reevaluation-et-ecart-realise");
function tient(obj, where) {
    for (const [k, v] of Object.entries(where)) {
        if (v === undefined)
            continue;
        if (k === 'OR') {
            if (!v.some((w) => tient(obj, w)))
                return false;
            continue;
        }
        const val = obj[k];
        if (v instanceof Date) {
            if (!(val instanceof Date) || val.getTime() !== v.getTime())
                return false;
            continue;
        }
        if (v !== null && typeof v === 'object') {
            const op = v;
            if ('some' in op) {
                if (!Array.isArray(val) || !val.some((x) => tient(x, op.some)))
                    return false;
                continue;
            }
            if ('lte' in op || 'gt' in op || 'in' in op || 'not' in op) {
                if ('lte' in op && !(val !== null && val <= op.lte))
                    return false;
                if ('gt' in op && !(val !== null && val > op.gt))
                    return false;
                if ('in' in op && !op.in.includes(val))
                    return false;
                if ('not' in op && val === op.not)
                    return false;
                continue;
            }
            if (val === null || typeof val !== 'object')
                return false;
            if (!tient(val, v))
                return false;
            continue;
        }
        if (val !== v)
            return false;
    }
    return true;
}
const SAISIE = new Date('2026-12-31T10:00:00Z');
const AVANT = new Date('2026-05-15');
let n = 0;
function ligne(deviseId, debit, credit, montantDevise, groupe, ecriture = {}) {
    n += 1;
    return {
        id: `l${n}`,
        compteId: 'c401',
        deviseId,
        debit,
        credit,
        montantDevise,
        lettrageId: groupe?.id ?? null,
        lettre: groupe?.soldeLe ? groupe.id : null,
        lettrage: groupe ? { createdAt: groupe.creeLe, soldeAt: groupe.soldeLe ?? null } : null,
        ecriture: {
            tenantId: 't',
            exerciceId: 'ex',
            date: new Date('2026-06-01'),
            createdAt: SAISIE,
            estANouveauProvisoire: false,
            estGenereeParCloture: false,
            estSoldeDesComptesDeGestion: false,
            ...ecriture,
        },
    };
}
const L = { id: 'L', creeLe: AVANT };
const groupeL = () => [ligne('usd', 0, 1_948_800, 1160, L), ligne('usd', 1_008_000, 0, 600, L), ligne('usd', 1_064_000, 0, 560, L)];
const factureB = (ecriture = {}, groupe = null) => ligne('usd', 0, 850_000, 500, groupe, ecriture);
function monter(p) {
    const creeeLe = new Date('2027-01-05T09:00:00Z');
    return {
        reevaluation: {
            findFirst: jest.fn(async () => ({
                dateReevaluation: new Date(p.dateReevaluation ?? '2026-12-31'),
                createdAt: creeeLe,
                coursUtilises: p.coursUtilises ?? null,
                ecritureEcarts: { lignes: [{ debit: p.passe > 0 ? p.passe : 0, credit: p.passe < 0 ? -p.passe : 0 }] },
            })),
        },
        exercice: { findFirst: jest.fn(async () => ({ dateDebut: new Date('2026-01-01') })) },
        ligneEcriture: {
            findMany: jest.fn(async ({ where }) => {
                for (const l of p.lignes)
                    if (l.lettrage)
                        l.lettrage.lignes = p.lignes.filter((x) => x.lettrageId === l.lettrageId);
                return p.lignes.filter((l) => tient(l, where));
            }),
        },
        coursDevise: {
            findFirst: jest.fn(async ({ where }) => {
                const c = (p.cours ?? { usd: 1850, eur: 1100 })[where.deviseId];
                return c === undefined ? null : { cours: c };
            }),
        },
    };
}
const params = { tenantId: 't', exerciceId: 'ex', compteId: 'c401', compteNumero: '40110000', lettrageId: 'L' };
describe('l’écart proposé et la réévaluation de l’exercice', () => {
    it('la réévaluation a lu le groupe (198 200) · refus nommé, honnête sur le retrait', async () => {
        const r = await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB()], passe: -198_200 }), params);
        expect(r).toEqual({ refus: expect.stringMatching(/a lu ce dénouement du 40110000.*compterait la perte deux fois/) });
        expect(r.refus).toMatch(/Issue · annulez cette réévaluation \(Devises, « Annuler la réévaluation », motif exigé · AUDCIF art\. 20, al\. 2\)/);
    });
    it('la réévaluation a écarté le groupe (75 000) · rien ne s’oppose', async () => {
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB()], passe: -75_000 }), params)).toBeNull();
    });
    it('une réévaluation antérieure au dénouement qui a lu ses lignes · refus', async () => {
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB()], passe: -198_200, dateReevaluation: '2026-06-30' }), params)).toHaveProperty('refus');
    });
    it('le scénario de la relecture · facture 1 000 USD à 2 000, réévaluée le 30/09 à 2 100 (100 000), réglée le 15/11 à 2 150 · refus', async () => {
        const G = { id: 'G', creeLe: new Date('2026-11-15') };
        const lignes = [
            ligne('usd', 0, 2_000_000, 1000, G, { date: new Date('2026-06-01'), createdAt: new Date('2026-06-01') }),
            ligne('usd', 2_150_000, 0, 1000, G, { date: new Date('2026-11-15'), createdAt: new Date('2026-11-15') }),
        ];
        const prisma = monter({ lignes, passe: -100_000, dateReevaluation: '2026-09-30', cours: { usd: 2100 } });
        prisma.reevaluation.findFirst.mockResolvedValue({
            dateReevaluation: new Date('2026-09-30'),
            createdAt: new Date('2026-10-01'),
            ecritureEcarts: { lignes: [{ debit: 0, credit: 100_000 }] },
        });
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(prisma, { ...params, lettrageId: 'G' })).toHaveProperty('refus');
    });
    it('une facture POSTÉRIEURE à la réévaluation · elle n’y était pas, l’écart passe', async () => {
        const G = { id: 'G', creeLe: new Date('2027-01-06') };
        const lignes = [
            factureB(),
            ligne('usd', 0, 1_700_000, 1000, G, { date: new Date('2026-10-15') }),
            ligne('usd', 1_800_000, 0, 1000, G, { date: new Date('2026-11-15') }),
        ];
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes, passe: -75_000, dateReevaluation: '2026-09-30' }), { ...params, lettrageId: 'G' })).toBeNull();
    });
    it('tiers à deux devises · 75 000 en USD et 10 000 en EUR passés · rien ne s’oppose, et 208 200 refusent', async () => {
        const eur = ligne('eur', 0, 100_000, 100, null);
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB(), eur], passe: -85_000 }), params)).toBeNull();
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB(), eur], passe: -208_200 }), params)).toHaveProperty('refus');
    });
    it('la facture B lettrée SOLDE après la réévaluation · elle était ouverte, rien ne s’oppose', async () => {
        const b = factureB({}, { id: 'LB', creeLe: new Date('2027-01-10'), soldeLe: new Date('2027-01-10') });
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), b], passe: -75_000 }), params)).toBeNull();
    });
    it('une facture de décembre SAISIE après la réévaluation · elle n’y était pas, rien ne s’oppose', async () => {
        const c = ligne('usd', 0, 340_000, 200, null, { date: new Date('2026-12-20'), createdAt: new Date('2027-01-08') });
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB(), c], passe: -75_000 }), params)).toBeNull();
    });
    it('le cours du 31 décembre corrigé depuis · avertissement, jamais « déjà porté »', async () => {
        const r = await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB()], passe: -75_000, cours: { usd: 1900 } }), params);
        expect(r).toEqual({ avertissement: expect.stringMatching(/^Des lettrages ou des écritures ont changé depuis la réévaluation des devises du 2026-12-31/) });
        expect(r.avertissement).not.toMatch(/déjà porté/);
    });
    it('D5 · le cours USD retenu 1 850, corrigé à 1 900 depuis · refus nommé, issue « annuler puis réévaluer »', async () => {
        const r = await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB()], passe: -75_000, cours: { usd: 1900 }, coursUtilises: { usd: 1850 } }), params);
        expect(r).toEqual({ refus: expect.stringMatching(/cours applicable au 2026-12-31 a été posé ou corrigé depuis la réévaluation des devises du 2026-12-31 \(1850 retenu, 1900 coté aujourd’hui\).*annulez cette réévaluation.*réévaluez au cours exact/) });
    });
    it('D5 · le cours retenu sert la reconstitution · inchangé, la règle ordinaire joue (75 000 · rien ne s’oppose)', async () => {
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB()], passe: -75_000, coursUtilises: { usd: 1850, eur: 1100 } }), params)).toBeNull();
    });
    it('D5 · seul le cours de la devise du GROUPE compte · un EUR corrigé ne refuse pas l’écart d’un groupe en USD', async () => {
        const eur = ligne('eur', 0, 100_000, 100, null);
        const r = await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), factureB(), eur], passe: -85_000, cours: { usd: 1850, eur: 1200 }, coursUtilises: { usd: 1850, eur: 1100 } }), params);
        expect(r).toBeNull();
    });
    it('L et M, décembre lettré en janvier · la réévaluation de 298 200 a lu les deux · refus pour L, puis pour M', async () => {
        const Lj = { id: 'L', creeLe: new Date('2027-01-06') };
        const M = { id: 'M', creeLe: new Date('2027-01-07') };
        const groupeLj = [ligne('usd', 0, 1_948_800, 1160, Lj), ligne('usd', 1_008_000, 0, 600, Lj), ligne('usd', 1_064_000, 0, 560, Lj)];
        const lignes = [...groupeLj, factureB(), ligne('usd', 0, 1_700_000, 1000, M), ligne('usd', 1_800_000, 0, 1000, M, { date: new Date('2026-12-15') })];
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes, passe: -298_200 }), params)).toHaveProperty('refus');
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes, passe: -298_200 }), { ...params, lettrageId: 'M' })).toHaveProperty('refus');
    });
    it('un à-nouveau provisoire recréé après la réévaluation · lu comme à sa date, rien ne s’oppose', async () => {
        const b = factureB({ date: new Date('2026-01-01'), createdAt: new Date('2027-01-06'), estANouveauProvisoire: true });
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), b], passe: -75_000 }), params)).toBeNull();
        const ordinaire = factureB({ date: new Date('2026-01-01'), createdAt: new Date('2027-01-06') });
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: [...groupeL(), ordinaire], passe: -75_000 }), params)).toHaveProperty('avertissement');
    });
});
describe('un règlement en devise d’une facture déjà réévaluée', () => {
    it('la facture choisie a été lue · refus nommé, honnête sur le retrait', async () => {
        const b = factureB();
        const motif = await (0, reevaluation_et_ecart_realise_1.motifReglementDejaReevalue)(monter({ lignes: [b], passe: -75_000 }), { ...params, ligneIds: [b.id] });
        expect(motif).toMatch(/a lu une facture choisie du 40110000.*compterait la perte deux fois.*Rien n’est passé/);
        expect(motif).toMatch(/annulez cette réévaluation.*puis réévaluez/);
    });
    it('une facture au cours de clôture (écart nul) · rien ne s’oppose', async () => {
        const usd = ligne('usd', 0, 1_850_000, 1000, null);
        const eur = ligne('eur', 0, 100_000, 100, null);
        expect(await (0, reevaluation_et_ecart_realise_1.motifReglementDejaReevalue)(monter({ lignes: [usd, eur], passe: -10_000 }), { ...params, ligneIds: [usd.id] })).toBeNull();
        expect(await (0, reevaluation_et_ecart_realise_1.motifReglementDejaReevalue)(monter({ lignes: [usd, eur], passe: -10_000 }), { ...params, ligneIds: [eur.id] })).toMatch(/a lu une facture choisie/);
    });
    it('une devise dont la position était soldée pendant qu’une autre était réévaluée · rien ne s’oppose', async () => {
        const facture = ligne('usd', 0, 850_000, 500, null);
        const avance = ligne('usd', 900_000, 0, 500, null);
        const eur = ligne('eur', 0, 100_000, 100, null);
        expect(await (0, reevaluation_et_ecart_realise_1.motifReglementDejaReevalue)(monter({ lignes: [facture, avance, eur], passe: -10_000 }), { ...params, ligneIds: [facture.id] })).toBeNull();
    });
    it('une facture saisie après la réévaluation, ou une devise sans cours · rien ne s’oppose', async () => {
        const tardive = factureB({ date: new Date('2026-12-20'), createdAt: new Date('2027-01-08') });
        expect(await (0, reevaluation_et_ecart_realise_1.motifReglementDejaReevalue)(monter({ lignes: [tardive], passe: -75_000 }), { ...params, ligneIds: [tardive.id] })).toBeNull();
        const b = factureB();
        expect(await (0, reevaluation_et_ecart_realise_1.motifReglementDejaReevalue)(monter({ lignes: [b], passe: -75_000, cours: {} }), { ...params, ligneIds: [b.id] })).toBeNull();
    });
});
describe('la contre-passation de la réévaluation précédente oubliée', () => {
    const EX = { ex0: ['2025-01-01', '2025-12-31'], ex: ['2026-01-01', '2026-12-31'], ex2: ['2027-01-01', '2027-12-31'] };
    function monterN1(p) {
        return {
            exercice: {
                findFirst: jest.fn(async ({ where }) => {
                    if (where.id)
                        return { id: where.id, dateDebut: new Date(EX[where.id][0]) };
                    const avant = Object.keys(EX)
                        .filter((k) => new Date(EX[k][1]) < where.dateFin.lt)
                        .sort((a, b) => EX[b][1].localeCompare(EX[a][1]));
                    return avant.length ? { id: avant[0] } : null;
                }),
            },
            reevaluation: {
                findMany: jest.fn(async ({ where }) => p.reevaluations
                    .filter((r) => !r.extournee && new Date(EX[r.exerciceId][1]) < where.exercice.dateFin.lt)
                    .filter((r) => !(r.declaree && 'contrePassationDeclareeId' in where && where.contrePassationDeclareeId === null))
                    .sort((a, b) => EX[a.exerciceId][1].localeCompare(EX[b.exerciceId][1]))
                    .map((r) => ({ exerciceId: r.exerciceId }))),
                findFirst: jest.fn(async ({ where }) => {
                    const r = p.reevaluations.find((x) => x.exerciceId === where.exerciceId);
                    return r
                        ? {
                            dateReevaluation: new Date(EX[r.exerciceId][1]),
                            createdAt: new Date(`${Number(EX[r.exerciceId][1].slice(0, 4)) + 1}-01-05`),
                            ecritureExtourneId: r.extournee ? 'x' : null,
                            ecritureEcarts: { lignes: [{ debit: r.passe > 0 ? r.passe : 0, credit: r.passe < 0 ? -r.passe : 0 }] },
                        }
                        : null;
                }),
            },
            ligneEcriture: {
                findMany: jest.fn(async ({ where }) => {
                    for (const l of p.lignes)
                        if (l.lettrage)
                            l.lettrage.lignes = p.lignes.filter((x) => x.lettrageId === l.lettrageId);
                    return p.lignes.filter((l) => tient(l, where));
                }),
            },
            coursDevise: { findFirst: jest.fn(async ({ where }) => ({ usd: { cours: 1850 }, eur: { cours: 1100 } })[where.deviseId] ?? null) },
        };
    }
    const n1 = { tenantId: 't', exerciceId: 'ex2', compteId: 'c401', compteNumero: '40110000' };
    const enN = () => factureB();
    const aNouveau = (deviseId = 'usd') => ligne(deviseId, 0, 850_000, 500, null, { exerciceId: 'ex2', date: new Date('2027-01-01'), createdAt: new Date('2027-01-02'), estANouveauProvisoire: true });
    it('à-nouveau d’une facture réévaluée en N, réévaluation non contre-passée · l’avertissement nomme la réévaluation et le geste', async () => {
        const an = aNouveau();
        const prisma = monterN1({ reevaluations: [{ exerciceId: 'ex', extournee: false, passe: -75_000 }], lignes: [enN(), an] });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(prisma, { ...n1, ligneIds: [an.id] })).toMatch(/40110000 · la réévaluation des devises du 2026-12-31 n'a pas été contre-passée.*Passez la contre-passation/);
    });
    it('contre-passée · aucun avertissement', async () => {
        const an = aNouveau();
        const prisma = monterN1({ reevaluations: [{ exerciceId: 'ex', extournee: true, passe: -75_000 }], lignes: [enN(), an] });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(prisma, { ...n1, ligneIds: [an.id] })).toBeNull();
    });
    it('contre-passée à la main et DÉCLARÉE (A5 bis) · aucun avertissement', async () => {
        const an = aNouveau();
        const prisma = monterN1({ reevaluations: [{ exerciceId: 'ex', extournee: false, declaree: true, passe: -75_000 }], lignes: [enN(), an] });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(prisma, { ...n1, ligneIds: [an.id] })).toBeNull();
        const lue = prisma.reevaluation.findMany.mock.calls[0][0];
        expect(lue.where).toMatchObject({ ecritureExtourneId: null, contrePassationDeclareeId: null });
    });
    it('une facture ORDINAIRE du 1er janvier · aucun avertissement', async () => {
        const ordinaire = ligne('usd', 0, 850_000, 500, null, { exerciceId: 'ex2', date: new Date('2027-01-01'), createdAt: new Date('2027-01-02') });
        const prisma = monterN1({ reevaluations: [{ exerciceId: 'ex', extournee: false, passe: -75_000 }], lignes: [enN(), ordinaire] });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(prisma, { ...n1, ligneIds: [ordinaire.id] })).toBeNull();
    });
    it('le message dit ce que la contre-passation fait, et ce qu’elle ne fait pas', async () => {
        const an = aNouveau();
        const prisma = monterN1({ reevaluations: [{ exerciceId: 'ex', extournee: false, passe: -75_000 }], lignes: [enN(), an] });
        const motif = await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(prisma, { ...n1, ligneIds: [an.id] });
        expect(motif).toMatch(/elle ne touche que le 478 et le 479 ; la provision pour pertes de change, elle, s'ajuste à la réévaluation de l'exercice en cours/);
        expect(motif).not.toMatch(/et sa provision restent/);
    });
    const enN2 = () => ligne('usd', 0, 850_000, 500, null, { exerciceId: 'ex0', date: new Date('2025-06-01'), createdAt: new Date('2025-06-02') });
    it('une réévaluation de N-2 non contre-passée qui a porté la devise · avertissement', async () => {
        const an = aNouveau();
        const prisma = monterN1({ reevaluations: [{ exerciceId: 'ex0', extournee: false, passe: -75_000 }], lignes: [enN2(), an] });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(prisma, { ...n1, ligneIds: [an.id] })).toMatch(/la réévaluation des devises du 2025-12-31 n'a pas été contre-passée/);
    });
    it('N-2 et N-1 non contre-passées · les deux nommées ; N-2 contre-passée · N-1 seule', async () => {
        const an = aNouveau();
        const deux = monterN1({
            reevaluations: [
                { exerciceId: 'ex0', extournee: false, passe: -75_000 },
                { exerciceId: 'ex', extournee: false, passe: -75_000 },
            ],
            lignes: [enN2(), enN(), an],
        });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(deux, { ...n1, ligneIds: [an.id] })).toMatch(/les réévaluations des devises du 2025-12-31, du 2026-12-31 n'ont pas été contre-passées/);
        const une = monterN1({
            reevaluations: [
                { exerciceId: 'ex0', extournee: true, passe: -75_000 },
                { exerciceId: 'ex', extournee: false, passe: -75_000 },
            ],
            lignes: [enN2(), enN(), an],
        });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(une, { ...n1, ligneIds: [an.id] })).toMatch(/la réévaluation des devises du 2026-12-31 n'a pas été/);
    });
    it('une réévaluation de N-2 qui n’a rien porté sur le compte · aucun avertissement', async () => {
        const an = aNouveau();
        const prisma = monterN1({ reevaluations: [{ exerciceId: 'ex0', extournee: false, passe: -75_000 }], lignes: [enN(), an] });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(prisma, { ...n1, ligneIds: [an.id] })).toBeNull();
    });
    it('une devise que la réévaluation n’a pas portée · aucun avertissement', async () => {
        const anEur = aNouveau('eur');
        const prisma = monterN1({ reevaluations: [{ exerciceId: 'ex', extournee: false, passe: -75_000 }], lignes: [enN(), anEur] });
        expect(await (0, reevaluation_et_ecart_realise_1.avertissementExtourneManquante)(prisma, { ...n1, ligneIds: [anEur.id] })).toBeNull();
    });
});
describe('la reconstitution suit la règle B1 (groupe à cheval)', () => {
    const G = { id: 'G', creeLe: new Date('2026-03-01'), soldeLe: new Date('2026-03-02') };
    const lignes = () => {
        const realise = ligne('usd', 0, 150_000, 0, G, { date: new Date('2026-03-01'), createdAt: new Date('2026-03-02') });
        realise.deviseId = null;
        realise.montantDevise = null;
        return [
            ligne('usd', 0, 2_000_000, 1000, G, { exerciceId: 'n0', date: new Date('2025-11-15'), createdAt: new Date('2025-11-15') }),
            ligne('usd', 0, 2_000_000, 1000, null, { date: new Date('2026-01-01'), createdAt: new Date('2026-01-02'), estGenereeParCloture: true }),
            ligne('usd', 2_150_000, 0, 1000, G, { date: new Date('2026-03-01'), createdAt: new Date('2026-03-01') }),
            realise,
            factureB(),
        ];
    };
    it('le compte se reconstitue tel que la réévaluation l’a calculé · aucun avertissement', async () => {
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: lignes(), passe: -75_000 }), { ...params, lettrageId: 'H' })).toBeNull();
    });
    it('un autre montant passé ne se reconstitue pas · l’avertissement reste', async () => {
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter({ lignes: lignes(), passe: 75_000 }), { ...params, lettrageId: 'H' })).toHaveProperty('avertissement');
    });
    it('le groupe à cheval dénoué avant la date, réalisé non passé · écarté par la réévaluation, son écart passe', async () => {
        const G2 = { id: 'G2', creeLe: new Date('2026-03-01') };
        const prisma = monter({
            lignes: [
                ligne('usd', 0, 2_000_000, 1000, G2, { exerciceId: 'n0', date: new Date('2025-11-15'), createdAt: new Date('2025-11-15') }),
                ligne('usd', 0, 2_000_000, 1000, null, { date: new Date('2026-01-01'), createdAt: new Date('2026-01-02'), estGenereeParCloture: true }),
                ligne('usd', 2_150_000, 0, 1000, G2, { date: new Date('2026-03-01'), createdAt: new Date('2026-03-01') }),
                factureB(),
            ],
            passe: -75_000,
        });
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(prisma, { ...params, lettrageId: 'G2' })).toBeNull();
    });
});
describe('la devise du groupe, réellement réévaluée', () => {
    const G = { id: 'G', creeLe: new Date('2026-11-15') };
    function monter30sept(lignes) {
        const prisma = monter({ lignes, passe: -10_000, dateReevaluation: '2026-09-30', cours: { usd: 2100, eur: 1100 } });
        prisma.reevaluation.findFirst.mockResolvedValue({
            dateReevaluation: new Date('2026-09-30'),
            createdAt: new Date('2026-10-01'),
            ecritureEcarts: { lignes: [{ debit: 0, credit: 10_000 }] },
        });
        return prisma;
    }
    const f1 = () => ligne('usd', 0, 2_000_000, 1000, G, { createdAt: new Date('2026-06-01') });
    const reglementF1 = () => ligne('usd', 2_150_000, 0, 1000, G, { date: new Date('2026-11-15'), createdAt: new Date('2026-11-15') });
    const f3 = () => ligne('eur', 0, 100_000, 100, null, { createdAt: new Date('2026-06-01') });
    it('F1, F2, F3 · l’écart USD de la réévaluation est nul · l’écart de F1 passe', async () => {
        const f2 = ligne('usd', 0, 2_200_000, 1000, null, { createdAt: new Date('2026-06-01') });
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter30sept([f1(), reglementF1(), f2, f3()]), { ...params, lettrageId: 'G' })).toBeNull();
    });
    it('une position USD soldée dans sa devise à la réévaluation · l’écart passe', async () => {
        const avance = ligne('usd', 2_050_000, 0, 1000, null, { createdAt: new Date('2026-06-01') });
        expect(await (0, reevaluation_et_ecart_realise_1.issueReevaluationDejaPassee)(monter30sept([f1(), reglementF1(), avance, f3()]), { ...params, lettrageId: 'G' })).toBeNull();
    });
});
//# sourceMappingURL=reevaluation-et-ecart-realise.spec.js.map