"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const common_1 = require("@nestjs/common");
const operation_specifique_service_1 = require("./operation-specifique.service");
const compte_seed_1 = require("../comptes/compte-seed");
const correspondance_tft_1 = require("../etats-financiers/correspondance-tft");
const COMPTES_REELS = compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => ({
    id: `id-${c.numero}`,
    numero: c.numero,
    intitule: c.intitule,
}));
function candidatsDe(ligne) {
    return COMPTES_REELS.filter((c) => c.numero.startsWith(ligne.compte) && !(ligne.exclusions ?? []).some((e) => c.numero.startsWith(e)));
}
function service(jeu = 'ASSOCIATIONS_ORDRES_PROFESSIONNELS') {
    const creer = jest.fn().mockImplementation((_t, _u, dto) => Promise.resolve({ id: 'ecr1', ...dto }));
    const prisma = {
        compte: { findMany: jest.fn().mockResolvedValue(COMPTES_REELS) },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ jeuEtatsFinanciersSycebnl: jeu }) },
    };
    const ecriture = { creer };
    return { svc: new operation_specifique_service_1.OperationSpecifiqueService(prisma, ecriture), creer };
}
async function ecriture(codeModele, parametres, comptesChoisis) {
    const { svc } = service();
    const p = await svc.proposer('t1', { codeModele, parametres, comptesChoisis });
    return {
        ...p,
        table: p.lignes.map((l) => ({ numero: l.numero, debit: l.debit, credit: l.credit })),
    };
}
describe('Guide, Application 1 · dotation consomptible et non consomptible', () => {
    it('souscription des apports à titre définitif : 33 000 000 en nature, 5 000 000 en numéraire', async () => {
        const e = await ecriture('B14-SOUSCRIPTION-DEFINITIF', { apportsNature: 33_000_000, apportsNumeraire: 5_000_000 });
        expect(e.table).toEqual([
            { numero: '45110000', debit: 33_000_000, credit: 0 },
            { numero: '45120000', debit: 5_000_000, credit: 0 },
            { numero: '10150000', debit: 0, credit: 33_000_000 },
            { numero: '10410000', debit: 0, credit: 5_000_000 },
        ]);
        expect(e.equilibree).toBe(true);
    });
    it('souscription à titre provisoire : la dotation est AVEC droit de reprise', async () => {
        const e = await ecriture('B14-SOUSCRIPTION-PROVISOIRE', { apportsNature: 30_000_000, apportsNumeraire: 4_000_000 });
        expect(e.table).toEqual([
            { numero: '45110000', debit: 30_000_000, credit: 0 },
            { numero: '45120000', debit: 4_000_000, credit: 0 },
            { numero: '10250000', debit: 0, credit: 30_000_000 },
            { numero: '10210000', debit: 0, credit: 4_000_000 },
        ]);
    });
    it('quote-part de dotation consomptible transférée : 1049 / 703 pour 5 000 000', async () => {
        const e = await ecriture('B14-QUOTE-PART-CONSOMPTIBLE', { chargesCouvertes: 5_000_000 });
        expect(e.table).toEqual([
            { numero: '10490000', debit: 5_000_000, credit: 0 },
            { numero: '70300000', debit: 0, credit: 5_000_000 },
        ]);
    });
});
describe('Guide, Application 2 · droit d’entrée et appel de cotisations', () => {
    it('50 000 000 appelés : 15 % en dépôt, 10 % en cotisations, le SOLDE en droit d’entrée', async () => {
        const e = await ecriture('B6-APPEL-DROIT-ENTREE', { appelGlobal: 50_000_000, tauxDepot: 0.15, tauxCotisation: 0.1 });
        expect(e.table).toEqual([
            { numero: '41100000', debit: 50_000_000, credit: 0 },
            { numero: '18510000', debit: 0, credit: 7_500_000 },
            { numero: '70100000', debit: 0, credit: 5_000_000 },
            { numero: '10300000', debit: 0, credit: 37_500_000 },
        ]);
        expect(e.equilibree).toBe(true);
    });
    it('refuse des parts qui dépassent le montant global, plutôt que de proposer un complément négatif', async () => {
        const { svc } = service();
        await expect(svc.proposer('t1', { codeModele: 'B6-APPEL-DROIT-ENTREE', parametres: { appelGlobal: 1000, tauxDepot: 0.7, tauxCotisation: 0.6 } })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
});
describe('Guide, Application 13 · cotisations des membres', () => {
    it('appel de 2 500 000 · le transfert en douteux et la dépréciation renvoient au module des créances douteuses (A7)', async () => {
        expect((await ecriture('B6-APPEL-COTISATION', { cotisation: 2_500_000 })).table).toEqual([
            { numero: '41100000', debit: 2_500_000, credit: 0 },
            { numero: '70100000', debit: 0, credit: 2_500_000 },
        ]);
        await expect(ecriture('B6-COTISATION-DOUTEUSE', { creanceDouteuse: 12_000_000 })).rejects.toThrow(/Créances douteuses/);
        await expect(ecriture('B6-DEPRECIATION-COTISATION', { creanceDouteuse: 12_000_000, tauxDepreciation: 0.8 })).rejects.toThrow(/Créances douteuses/);
    });
});
describe('Guide, Application 3 · subvention d’investissement', () => {
    it('notification : 4731 par le crédit de la subvention d’équipement', async () => {
        const e = await ecriture('B15-NOTIFICATION', { subvention: 120_000_000 }, { '141': '14170000' });
        expect(e.table).toEqual([
            { numero: '47310000', debit: 120_000_000, credit: 0 },
            { numero: '14170000', debit: 0, credit: 120_000_000 },
        ]);
    });
});
describe('Guide, Application 4 · fonds affectés à un projet spécifique', () => {
    it('réception de 45 000 000 : au PASSIF, pas en produit', async () => {
        const e = await ecriture('B1-RECEPTION', { fonds: 45_000_000 }, { '52': '52110000' });
        expect(e.table).toEqual([
            { numero: '52110000', debit: 45_000_000, credit: 0 },
            { numero: '16500000', debit: 0, credit: 45_000_000 },
        ]);
    });
    it('reprise du tiers consommé : 15 000 000 seulement', async () => {
        const e = await ecriture('B1-REPRISE', { consomme: 15_000_000 });
        expect(e.table).toEqual([
            { numero: '16500000', debit: 15_000_000, credit: 0 },
            { numero: '79250000', debit: 0, credit: 15_000_000 },
        ]);
    });
});
describe('Guide, Application 5 · legs d’immobilisations à conserver', () => {
    it('provision pour l’obligation d’entretien : 1679 / 192 pour 12 500 000', async () => {
        expect((await ecriture('B16-PROVISION-CHARGE', { obligation: 12_500_000 })).table).toEqual([
            { numero: '16790000', debit: 12_500_000, credit: 0 },
            { numero: '19200000', debit: 0, credit: 12_500_000 },
        ]);
    });
});
describe('Lot 9 · un bien passe par sa fiche (décision D-20)', () => {
    const RENVOYES = [
        'B15-REPRISE',
        'B16-RECEPTION-LEGS',
        'B16-REPRISE-FONDS',
        'B17-COMPTABILISATION',
        'B17-DEPRECIATION',
        'B17-SOLDE-FONDS',
        'B18-RECEPTION',
        'B18-AMORTISSEMENT',
        'B18-REPRISE',
    ];
    const RENVOYES_CREANCES = ['B6-COTISATION-DOUTEUSE', 'B6-DEPRECIATION-COTISATION'];
    it('exactement ces onze modèles renvoient au module', () => {
        const marques = operation_specifique_service_1.CATALOGUE.flatMap((o) => o.modeles).filter((m) => m.renvoiModule).map((m) => m.code);
        expect(marques.sort()).toEqual([...RENVOYES, ...RENVOYES_CREANCES].sort());
    });
    it.each(RENVOYES_CREANCES)('%s · renvoyé aux créances douteuses, motif propre, aucune écriture', async (code) => {
        const { svc, creer } = service();
        await expect(svc.proposer('t1', { codeModele: code, parametres: {} })).rejects.toThrow(/fenêtre Créances douteuses ou litigieuses .*revue de la dépréciation/);
        await expect(svc.appliquer('t1', 'u1', { codeModele: code, parametres: {}, exerciceId: 'ex', journalId: 'od', date: '2026-01-31' })).rejects.toThrow(common_1.BadRequestException);
        expect(creer).not.toHaveBeenCalled();
    });
    it.each(RENVOYES)('%s · refusé à la proposition et à l’application, aucune écriture', async (code) => {
        const { svc, creer } = service();
        await expect(svc.proposer('t1', { codeModele: code, parametres: {} })).rejects.toThrow(/fenêtre Immobilisations/);
        await expect(svc.appliquer('t1', 'u1', { codeModele: code, parametres: {}, exerciceId: 'ex', journalId: 'od', date: '2026-01-31' })).rejects.toThrow(common_1.BadRequestException);
        expect(creer).not.toHaveBeenCalled();
    });
    it('aucun autre modèle n’inscrit, ne dote, ne déprécie un bien ni ne reprend son fonds', () => {
        const touche = /^(2|68|69|799|7923|796)/;
        const fautifs = operation_specifique_service_1.CATALOGUE.flatMap((o) => o.modeles)
            .filter((m) => !m.renvoiModule)
            .flatMap((m) => m.lignes.filter((l) => touche.test(l.compte)).map((l) => `${m.code} ${l.compte}`));
        expect(fautifs).toEqual([]);
    });
});
describe('Guide, Application 8 · projet de développement', () => {
    it('150 000 000 décaissés, clé 80 / 20 → 120 000 000 en investissement, 30 000 000 en administration', async () => {
        const e = await ecriture('B19-DECAISSEMENT', { virement: 150_000_000, partInvestissement: 0.8 }, { '52': '52110000' });
        expect(e.table).toEqual([
            { numero: '52110000', debit: 150_000_000, credit: 0 },
            { numero: '16200000', debit: 0, credit: 120_000_000 },
            { numero: '46200000', debit: 0, credit: 30_000_000 },
        ]);
    });
    it('transfert des fonds d’administration au rythme des charges : 28 000 000', async () => {
        expect((await ecriture('B19-TRANSFERT-ADMINISTRATION', { chargesEngagees: 28_000_000 })).table).toEqual([
            { numero: '46200000', debit: 28_000_000, credit: 0 },
            { numero: '70200000', debit: 0, credit: 28_000_000 },
        ]);
    });
    it('fonds d’investissement non consommés : 120 M − 112 M = 8 000 000, à extourner', async () => {
        const e = await ecriture('B19-FONDS-NON-CONSOMMES', { nonConsomme: 8_000_000 });
        expect(e.table).toEqual([
            { numero: '16200000', debit: 8_000_000, credit: 0 },
            { numero: '16500000', debit: 0, credit: 8_000_000 },
        ]);
        expect(e.aExtourner).toBe(true);
    });
    it('ajustement de la clé une fois l’emploi réel connu : 8 000 000', async () => {
        expect((await ecriture('B19-AJUSTEMENT-CLE', { ajustement: 8_000_000 })).table).toEqual([
            { numero: '16200000', debit: 8_000_000, credit: 0 },
            { numero: '46200000', debit: 0, credit: 8_000_000 },
        ]);
    });
});
describe('Guide, Application 9 · dons en nature à distribuer', () => {
    it('réception de 25 000 000, stock de 5 000 000, revenus différés de 5 000 000', async () => {
        expect((await ecriture('B2-RECEPTION-COURANT', { valeur: 25_000_000 }, { '654': '65410000' })).table).toEqual([
            { numero: '65410000', debit: 25_000_000, credit: 0 },
            { numero: '75420000', debit: 0, credit: 25_000_000 },
        ]);
        expect((await ecriture('B2-STOCK-CLOTURE', { stock: 5_000_000 })).table).toEqual([
            { numero: '34500000', debit: 5_000_000, credit: 0 },
            { numero: '60350000', debit: 0, credit: 5_000_000 },
        ]);
        const differe = await ecriture('B2-REVENUS-NON-CONSOMMES', { nonConsomme: 5_000_000 });
        expect(differe.table).toEqual([
            { numero: '75420000', debit: 5_000_000, credit: 0 },
            { numero: '47130000', debit: 0, credit: 5_000_000 },
        ]);
        expect(differe.aExtourner).toBe(true);
    });
});
describe('Guide, Application 10 · dons en nature à vendre', () => {
    it('suivi hors bilan du camion reçu : 15 000 000 en classe 9', async () => {
        expect((await ecriture('B3-SUIVI-EXTRA-COMPTABLE', { valeur: 15_000_000 })).table).toEqual([
            { numero: '90100000', debit: 15_000_000, credit: 0 },
            { numero: '91000000', debit: 0, credit: 15_000_000 },
        ]);
    });
    it('vente non récurrente : 8411, et l’anomalie du Guide est remontée', async () => {
        const e = await ecriture('B3-VENTE-HAO', { prix: 13_000_000 }, { '52': '52110000' });
        expect(e.table).toEqual([
            { numero: '52110000', debit: 13_000_000, credit: 0 },
            { numero: '84110000', debit: 0, credit: 13_000_000 },
        ]);
        expect(e.anomalie).toMatch(/8421/);
        expect(e.anomalie).toMatch(/8411/);
    });
    it('frais neutralisés sur un bien non vendu : 250 000 en charges d’avance, à extourner', async () => {
        const e = await ecriture('B3-FRAIS-NEUTRALISES', { frais: 250_000 });
        expect(e.table).toEqual([
            { numero: '47600000', debit: 250_000, credit: 0 },
            { numero: '83100000', debit: 0, credit: 250_000 },
        ]);
        expect(e.aExtourner).toBe(true);
    });
});
describe('Guide, Application 11 · dons en numéraire', () => {
    it('générosité promise et non encore reçue : 475 par le crédit du 704', async () => {
        const e = await ecriture('B4-GENEROSITE-A-RECEVOIR', { promesse: 8_000_000 }, { '704': '70410000' });
        expect(e.table).toEqual([
            { numero: '47500000', debit: 8_000_000, credit: 0 },
            { numero: '70410000', debit: 0, credit: 8_000_000 },
        ]);
    });
    it('quête encaissée en espèces : le choix de la nature du revenu revient au dossier', async () => {
        const e = await ecriture('B4-ENCAISSEMENT', { montant: 8_000_000 }, { '5': '57100000', '704': '70440000' });
        expect(e.table).toEqual([
            { numero: '57100000', debit: 8_000_000, credit: 0 },
            { numero: '70440000', debit: 0, credit: 8_000_000 },
        ]);
    });
    it('recettes d’une manifestation : 25 000 000 au compte 706', async () => {
        const e = await ecriture('B4-RECETTES-MANIFESTATION', { recettes: 25_000_000 }, { '5': '57100000' });
        expect(e.table).toEqual([
            { numero: '57100000', debit: 25_000_000, credit: 0 },
            { numero: '70600000', debit: 0, credit: 25_000_000 },
        ]);
    });
});
describe('Guide, Application 12 · frais de recherche de fonds', () => {
    it('25 000 + 35 000 + 75 000 = 135 000 au compte spécifique 636', async () => {
        const e = await ecriture('B5-FRAIS', { frais: 135_000 }, { '401': '40110000' });
        expect(e.table).toEqual([
            { numero: '63600000', debit: 135_000, credit: 0 },
            { numero: '40110000', debit: 0, credit: 135_000 },
        ]);
    });
});
describe('Guide, Applications 14 et 15 · fondateur et aides versées', () => {
    it('contribution du fondateur : 20 000 000 au compte 752, pas au compte 10', async () => {
        const e = await ecriture('B7-CONTRIBUTION', { versement: 20_000_000 }, { '5': '52110000' });
        expect(e.table).toEqual([
            { numero: '52110000', debit: 20_000_000, credit: 0 },
            { numero: '75200000', debit: 0, credit: 20_000_000 },
        ]);
    });
    it('aide versée par l’entité : 500 000 au compte 652', async () => {
        const e = await ecriture('B8-SUBVENTION-VERSEE', { aide: 500_000 }, { '5': '57100000' });
        expect(e.table).toEqual([
            { numero: '65200000', debit: 500_000, credit: 0 },
            { numero: '57100000', debit: 0, credit: 500_000 },
        ]);
    });
});
describe('Guide, Application 16 · subvention d’exploitation pluriannuelle', () => {
    it('60 000 000 sur trois exercices : 40 000 000 différés, 20 000 000 rattachés par exercice', async () => {
        expect((await ecriture('B9-NOTIFICATION', { subvention: 60_000_000 }, { '71': '71100000' })).table).toEqual([
            { numero: '47320000', debit: 60_000_000, credit: 0 },
            { numero: '71100000', debit: 0, credit: 60_000_000 },
        ]);
        expect((await ecriture('B9-QUOTE-PART-DIFFEREE', { partDifferee: 40_000_000 }, { '71': '71100000' })).table).toEqual([
            { numero: '71100000', debit: 40_000_000, credit: 0 },
            { numero: '47700000', debit: 0, credit: 40_000_000 },
        ]);
        expect((await ecriture('B9-RATTACHEMENT', { quotePart: 20_000_000 }, { '71': '71100000' })).table).toEqual([
            { numero: '47700000', debit: 20_000_000, credit: 0 },
            { numero: '71100000', debit: 0, credit: 20_000_000 },
        ]);
    });
});
describe('Guide, Application 17 · abandons de frais des bénévoles', () => {
    it('525 000 de frais engagés puis abandonnés', async () => {
        const engages = await ecriture('B10-FRAIS-ENGAGES', { frais: 525_000 }, { '6': '61810000' });
        expect(engages.table).toEqual([
            { numero: '61810000', debit: 525_000, credit: 0 },
            { numero: '45720000', debit: 0, credit: 525_000 },
        ]);
        expect((await ecriture('B10-ABANDON', { abandon: 525_000 })).table).toEqual([
            { numero: '45720000', debit: 525_000, credit: 0 },
            { numero: '75830000', debit: 0, credit: 525_000 },
        ]);
    });
});
describe('Guide, Applications 18 et 19 · mécénat et restitution', () => {
    it('convention de mécénat de 50 000 000 : créance au 475, le 4751 du texte', async () => {
        expect((await ecriture('B11-SIGNATURE', { convention: 50_000_000 })).table).toEqual([
            { numero: '47500000', debit: 50_000_000, credit: 0 },
            { numero: '70460000', debit: 0, credit: 50_000_000 },
        ]);
    });
    it('la créance du mécène est celle que le TFT lit en contrepartie du poste FC', () => {
        const fc = correspondance_tft_1.POSTES_OPERATIONNELS.find((p) => p.ref === 'FC');
        const b11 = operation_specifique_service_1.CATALOGUE.flatMap((o) => o.modeles).find((m) => m.code === 'B11-SIGNATURE');
        const creance = b11.lignes.find((l) => l.sens === 'DEBIT').compte;
        expect((fc.comptesContrepartie ?? []).some((c) => creance.startsWith(c))).toBe(true);
    });
    it('la générosité simplement PROMISE reste au 475, elle', async () => {
        const promesse = await ecriture('B4-GENEROSITE-A-RECEVOIR', { promesse: 1_000_000 });
        expect(promesse.table[0].numero.startsWith('475')).toBe(true);
    });
    it('restitution de 25 000 000 : la subvention d’équipement est débitée pour solde', async () => {
        const e = await ecriture('B12-CONSTATATION', { aReverser: 25_000_000 }, { '14': '14170000' });
        expect(e.table).toEqual([
            { numero: '14170000', debit: 25_000_000, credit: 0 },
            { numero: '47390000', debit: 0, credit: 25_000_000 },
        ]);
    });
});
describe('Guide, Application 20 · contributions volontaires en nature', () => {
    it('450 000 de fournitures reçues, hors bilan', async () => {
        expect((await ecriture('B13-BIENS', { valeur: 450_000 })).table).toEqual([
            { numero: '90100000', debit: 450_000, credit: 0 },
            { numero: '91000000', debit: 0, credit: 450_000 },
        ]);
    });
    it('8 325 heures × 346 = 2 880 450 · et l’écart avec la Note 1 est signalé', async () => {
        const e = await ecriture('B13-BENEVOLAT', { heures: 8_325, tauxHoraire: 346 });
        expect(e.table).toEqual([
            { numero: '90400000', debit: 2_880_450, credit: 0 },
            { numero: '91400000', debit: 0, credit: 2_880_450 },
        ]);
        expect(e.anomalie).toMatch(/2 864 880/);
    });
});
describe('Invariants du catalogue', () => {
    it("aucun renvoi du module n'annonce une application du Guide comme un article", () => {
        const fichiers = ['operation-specifique.types.ts', 'catalogue-operations.ts'];
        for (const nom of fichiers) {
            const texte = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, nom), 'utf8');
            const fautifs = texte
                .split('\n')
                .filter((l) => /(?:Guide|[Aa]pplication|reprise sur \d+ ans)[^\n]{0,60}\bart\.\s*\d/.test(l));
            expect({ fichier: nom, fautifs }).toEqual({ fichier: nom, fautifs: [] });
        }
    });
    it('un modèle qui déclare une application du Guide la nomme « App. N »', () => {
        for (const operation of operation_specifique_service_1.CATALOGUE) {
            for (const modele of operation.modeles) {
                if (!modele.applicationGuide)
                    continue;
                expect({ modele: modele.code, forme: /^App\. \d+$/.test(modele.applicationGuide) }).toEqual({
                    modele: modele.code,
                    forme: true,
                });
            }
        }
    });
    it('toute ligne non marquée « au choix » désigne exactement un compte du plan livré', () => {
        for (const operation of operation_specifique_service_1.CATALOGUE) {
            for (const modele of operation.modeles) {
                for (const ligne of modele.lignes) {
                    if (ligne.auChoix)
                        continue;
                    const candidats = candidatsDe(ligne);
                    expect({ modele: modele.code, compte: ligne.compte, trouves: candidats.map((c) => c.numero) }).toEqual({
                        modele: modele.code,
                        compte: ligne.compte,
                        trouves: [candidats[0]?.numero].filter(Boolean),
                    });
                }
            }
        }
    });
    it('toute ligne marquée « au choix » a bien PLUSIEURS candidats · sinon la marque est de trop', () => {
        for (const operation of operation_specifique_service_1.CATALOGUE) {
            for (const modele of operation.modeles) {
                for (const ligne of modele.lignes.filter((l) => l.auChoix)) {
                    const n = candidatsDe(ligne).length;
                    expect({ modele: modele.code, compte: ligne.compte, candidats: n > 1 }).toEqual({
                        modele: modele.code,
                        compte: ligne.compte,
                        candidats: true,
                    });
                }
            }
        }
    });
    it('chaque modèle a au plus UN complément : deux rendraient la répartition indéterminée', () => {
        for (const operation of operation_specifique_service_1.CATALOGUE) {
            for (const modele of operation.modeles) {
                const n = modele.lignes.filter((l) => l.montant.mode === 'COMPLEMENT').length;
                expect({ modele: modele.code, complements: n }).toEqual({ modele: modele.code, complements: n > 1 ? 'PLUSIEURS' : n });
            }
        }
    });
    it('chaque modèle a au moins un débit et un crédit', () => {
        for (const operation of operation_specifique_service_1.CATALOGUE) {
            for (const modele of operation.modeles) {
                expect({
                    modele: modele.code,
                    debits: modele.lignes.some((l) => l.sens === 'DEBIT'),
                    credits: modele.lignes.some((l) => l.sens === 'CREDIT'),
                }).toEqual({ modele: modele.code, debits: true, credits: true });
            }
        }
    });
    it('tout paramètre référencé par une ligne est déclaré par le modèle', () => {
        for (const operation of operation_specifique_service_1.CATALOGUE) {
            for (const modele of operation.modeles) {
                const declares = new Set(modele.parametres.map((p) => p.nom));
                for (const l of modele.lignes) {
                    const m = l.montant;
                    const utilises = m.mode === 'PARAMETRE'
                        ? [m.parametre]
                        : m.mode === 'PROPORTION'
                            ? [m.parametre, ...(typeof m.taux === 'string' ? [m.taux] : [])]
                            : m.mode === 'ANNUITE'
                                ? [m.parametre, m.parametreDuree, ...(m.parametreMois ? [m.parametreMois] : [])]
                                : [];
                    for (const u of utilises) {
                        expect({ modele: modele.code, parametre: u, declare: declares.has(u) }).toEqual({
                            modele: modele.code, parametre: u, declare: true,
                        });
                    }
                }
            }
        }
    });
    it('chaque modèle cite sa source, et chaque code est unique', () => {
        const codes = new Set();
        for (const operation of operation_specifique_service_1.CATALOGUE) {
            for (const modele of operation.modeles) {
                expect({ modele: modele.code, source: modele.source.length > 30 }).toEqual({ modele: modele.code, source: true });
                expect({ modele: modele.code, deja: codes.has(modele.code) }).toEqual({ modele: modele.code, deja: false });
                codes.add(modele.code);
            }
        }
    });
});
describe('Application effective d’un modèle', () => {
    it('refuse d’enregistrer tant qu’un compte reste à choisir', async () => {
        const { svc, creer } = service();
        await expect(svc.appliquer('t1', 'u1', {
            codeModele: 'B1-RECEPTION', parametres: { fonds: 1000 },
            exerciceId: 'e1', journalId: 'j1', date: '2026-06-01',
        })).rejects.toThrow(/reste à choisir/);
        expect(creer).not.toHaveBeenCalled();
    });
    it('passe par EcritureService.creer · jamais d’écriture par un chemin dérobé', async () => {
        const { svc, creer } = service();
        await svc.appliquer('t1', 'u1', {
            codeModele: 'B1-RECEPTION', parametres: { fonds: 45_000_000 }, comptesChoisis: { '52': '52110000' },
            exerciceId: 'e1', journalId: 'j1', date: '2026-06-01',
        });
        expect(creer).toHaveBeenCalledTimes(1);
        const dto = creer.mock.calls[0][2];
        expect(dto.libelle).toBe('Réception de fonds affectés à un projet');
        expect(dto.lignes).toHaveLength(2);
    });
    it('refuse un compte choisi qui ne correspond pas au préfixe du modèle', async () => {
        const { svc } = service();
        await expect(svc.proposer('t1', { codeModele: 'B1-RECEPTION', parametres: { fonds: 1000 }, comptesChoisis: { '52': '57100000' } })).rejects.toThrow(/ne commence pas par 52/);
    });
    it('exige les paramètres du modèle plutôt que de calculer sur du vide', async () => {
        const { svc } = service();
        await expect(svc.proposer('t1', { codeModele: 'B1-RECEPTION', parametres: {} })).rejects.toThrow(/requis/);
    });
    it('le catalogue est filtré sur le jeu du dossier, sans masquer l’autre', async () => {
        const { svc } = service('PROJETS_DEVELOPPEMENT');
        const c = await svc.catalogue('t1');
        expect(c.jeu).toBe('PROJETS');
        expect(c.operations.map((o) => o.code)).toContain('B19');
        expect(c.operationsAutreJeu.map((o) => o.code)).toContain('B14');
    });
});
//# sourceMappingURL=operation-specifique.service.spec.js.map