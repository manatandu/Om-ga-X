"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const regles_comptes_sycebnl_1 = require("./regles-comptes-sycebnl");
const regles_comptes_syscohada_1 = require("./regles-comptes-syscohada");
const compte_seed_syscohada_1 = require("../comptes/compte-seed-syscohada");
const dossier_revision_service_1 = require("./dossier-revision.service");
const compte_seed_1 = require("../comptes/compte-seed");
const NUMEROS_PLAN = compte_seed_1.PLAN_COMPTES_SYCEBNL.map((c) => c.numero);
const existe = (n) => NUMEROS_PLAN.some((p) => p.startsWith(n) || n.startsWith(p));
describe('couverture du chapitre 3', () => {
    it('porte les 79 fiches · 77 comptes des classes 1 à 8, plus 90 et 91', () => {
        expect(regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL).toHaveLength(79);
        expect(regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.filter((r) => r.exclusions)).toHaveLength(71);
        expect(regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.filter((r) => r.elementsDeControle)).toHaveLength(78);
    });
    it('le 63 a sa fiche, sur le texte commun aux comptes 62 et 63 (R5-C5)', () => {
        const par = (n) => regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.find((r) => r.numero === n);
        expect([par('62').intitule, par('63').intitule]).toEqual(['Services extérieurs', 'Autres services extérieurs']);
        expect(par('63').elementsDeControle).toContain('Les comptes 62 et 63');
        expect(par('63').elementsDeControle).toBe(par('62').elementsDeControle);
        expect(dossier_revision_service_1.DossierRevisionService.regleDe('63100000', regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL)?.numero).toBe('63');
    });
    it('les trois fiches à TROIS chiffres sont là', () => {
        const numeros = regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.map((r) => r.numero);
        expect(numeros).toEqual(expect.arrayContaining(['603', '659', '759']));
    });
    it('aucun doublon · une fiche par compte', () => {
        const numeros = regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.map((r) => r.numero);
        expect(numeros.filter((n, i) => numeros.indexOf(n) !== i)).toEqual([]);
    });
});
describe('les comptes cités existent', () => {
    it('chaque fiche porte un numéro du plan SYCEBNL', () => {
        const fantomes = regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.filter((r) => !existe(r.numero)).map((r) => r.numero);
        expect(fantomes).toEqual([]);
    });
    it('chaque compte À UTILISER existe au plan', () => {
        const fantomes = [
            ...new Set(regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.flatMap((r) => r.comptesAUtiliser.map((n) => `${r.numero} → ${n}`)).filter((paire) => {
                const n = paire.split(' → ')[1];
                return !existe(n);
            })),
        ].sort();
        expect(fantomes).toEqual([]);
    });
});
describe('un compte ne se propose jamais en remplacement de lui-même', () => {
    it('aucune fiche ne se cite', () => {
        const boucles = regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.filter((r) => r.comptesAUtiliser.includes(r.numero)).map((r) => `${r.numero} → ${r.comptesAUtiliser.join(', ')}`);
        expect(boucles).toEqual([]);
    });
    it('les trois cas de référence sont extraits comme le texte les écrit', () => {
        const par = (n) => regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.find((r) => r.numero === n);
        expect(par('10').comptesAUtiliser).toEqual(['104', '16', '46']);
        expect(par('40').comptesAUtiliser).toEqual(['25', '481']);
        expect(par('52').comptesAUtiliser).toEqual(['53', '538']);
    });
    it('une plage « 21 à 26 » se restitue en entier, jamais en deux numéros (R5-B4)', () => {
        const vingt = regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.find((r) => r.numero === '20');
        expect(vingt.exclusions).toContain('utiliser comptes 21 à 26');
        expect(vingt.comptesAUtiliser).toEqual(['21', '22', '23', '24', '25', '26']);
    });
});
describe('un renvoi que le plan du même référentiel numérote autrement (R5-A1, R5-C1)', () => {
    const par = (n) => regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.find((r) => r.numero === n);
    it('« 16 · Emprunts et dettes assimilées » des fiches 64 et 67 est nommé discordant, pas proposé', () => {
        for (const n of ['64', '67']) {
            expect(par(n).exclusions).toContain('16 \u2014 Emprunts et dettes assimilées');
            expect(par(n).comptesAUtiliser).not.toContain('16');
            expect(par(n).renvoisDiscordants).toEqual([
                { numero: '16', intituleCite: 'Emprunts et dettes assimilées', intitulePlan: 'Fonds affectés' },
            ]);
        }
        expect(par('56').comptesAUtiliser).toContain('18');
    });
    it('le 848 de la fiche 78 est nommé discordant, sans qu’aucun autre numéro soit choisi', () => {
        expect(par('78').renvoisDiscordants.map((d) => [d.numero, d.intitulePlan])).toEqual([
            ['848', 'Transferts de produits H.A.O.'],
        ]);
        expect(par('78').comptesAUtiliser).toEqual(['72']);
    });
    it('un intitulé partagé (« 654 et 7542 - … ») ou juste n’est jamais discordant', () => {
        expect(par('90').renvoisDiscordants).toEqual([]);
        expect(par('65').comptesAUtiliser).toContain('831');
        expect(regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.flatMap((r) => r.renvoisDiscordants.map((d) => `${r.numero} → ${d.numero}`))).toEqual([
            '64 → 16',
            '67 → 16',
            '78 → 848',
        ]);
    });
});
describe('le texte est cité, jamais reformulé', () => {
    it('l’exclusion du compte 40 est celle du référentiel, mot pour mot', () => {
        const quarante = regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.find((r) => r.numero === '40');
        expect(quarante.exclusions).toContain("ne doit pas servir à enregistrer : les fournisseurs d'immobilisations");
        expect(quarante.exclusions).toContain("481 — Fournisseurs d'investissements");
    });
    it('les éléments de contrôle nomment des PIÈCES, pas des consignes', () => {
        const quarante = regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL.find((r) => r.numero === '40');
        expect(quarante.elementsDeControle).toContain('factures');
        expect(quarante.elementsDeControle).toContain('chèques de règlement');
    });
    it('aucun texte tronqué · les blocs font des phrases', () => {
        for (const r of regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL) {
            if (r.exclusions)
                expect([r.numero, r.exclusions.length > 40]).toEqual([r.numero, true]);
            if (r.elementsDeControle) {
                expect([r.numero, r.elementsDeControle.length > 30]).toEqual([r.numero, true]);
            }
        }
    });
});
describe('règles par compte du SYSCOHADA · AUDCIF, Titre VII', () => {
    const numeros = compte_seed_syscohada_1.PLAN_COMPTES_SYSCOHADA.map((c) => c.numero);
    const existeSyscohada = (n) => numeros.some((p) => p.startsWith(n) || n.startsWith(p));
    it('porte les 115 fiches des neuf classes', () => {
        expect(regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA).toHaveLength(115);
        expect(regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA.filter((r) => r.numero.length === 4).length).toBe(31);
    });
    it('l’AUDCIF écrit la règle AUTREMENT, et l’extraction le sait', () => {
        const quarante = regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA.find((r) => r.numero === '40');
        expect(quarante.exclusions).toContain('→ 481');
        expect(quarante.comptesAUtiliser).toEqual(['25', '481']);
    });
    it('un renvoi vers des CLASSES ne produit aucun numéro de compte', () => {
        const treize = regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA.find((r) => r.numero === '13');
        expect(treize.exclusions).toContain('classes 6, 7 et 8');
        expect(treize.comptesAUtiliser).toEqual([]);
    });
    it('chaque compte à utiliser existe au plan SYSCOHADA', () => {
        const fantomes = [
            ...new Set(regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA.flatMap((r) => r.comptesAUtiliser).filter((n) => !existeSyscohada(n))),
        ].sort();
        expect(fantomes).toEqual([]);
    });
    it('des en-têtes consécutifs partagent la fiche commune (R1-C3)', () => {
        const par = (n) => regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA.find((r) => r.numero === n);
        expect(par('62').elementsDeControle).toBe('Factures et avoirs fournisseurs ; dispositions des contrats.');
        expect(par('62').elementsDeControle).toBe(par('63').elementsDeControle);
        for (const [seul, commun] of [
            ['9013', '9018'],
            ['9014', '9018'],
            ['9033', '9038'],
            ['9043', '9048'],
            ['9051', '9058'],
            ['9083', '9088'],
        ]) {
            expect([seul, par(seul).elementsDeControle]).toEqual([seul, par(commun).elementsDeControle]);
            expect([seul, par(seul).elementsDeControle]).not.toEqual([seul, null]);
        }
        expect(par('9013').comptesAUtiliser).toEqual(['9011']);
    });
    it('la liste des remplacements lit tout le segment, hors parenthèses et notes de transcription (R1-C10)', () => {
        const par = (n) => regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA.find((r) => r.numero === n);
        expect(par('79').comptesAUtiliser).toEqual(['759', '779', '849', '86']);
        expect(par('86').comptesAUtiliser).toEqual(['691', '697', '759', '779', '791', '797']);
        expect(par('759').comptesAUtiliser).toEqual(['791', '797']);
        expect(par('9024').comptesAUtiliser).toEqual(['9088']);
    });
    it('aucune fiche ne se cite elle-même en remplacement', () => {
        const boucles = regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA.filter((r) => r.comptesAUtiliser.includes(r.numero)).map((r) => r.numero);
        expect(boucles).toEqual([]);
    });
});
describe('les deux tables ne se servent jamais l’une pour l’autre', () => {
    it('un dossier reçoit les fiches de SON texte, et rien pour un référentiel inconnu', () => {
        const svc = new dossier_revision_service_1.DossierRevisionService({});
        expect(svc.regles('SYCEBNL')).toBe(regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL);
        expect(svc.regles('SYSCOHADA')).toBe(regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA);
        expect(svc.regles(undefined)).toEqual([]);
        expect(svc.regles('AUTRE')).toEqual([]);
    });
    it('la fiche retenue est la plus PRÉCISE de la table donnée', () => {
        const fiche = dossier_revision_service_1.DossierRevisionService.regleDe('65910000', regles_comptes_sycebnl_1.REGLES_COMPTES_SYCEBNL);
        expect(fiche?.numero).toBe('659');
        const engagement = dossier_revision_service_1.DossierRevisionService.regleDe('90110000', regles_comptes_syscohada_1.REGLES_COMPTES_SYSCOHADA);
        expect(engagement?.numero).toBe('9011');
    });
});
//# sourceMappingURL=regles-comptes.spec.js.map