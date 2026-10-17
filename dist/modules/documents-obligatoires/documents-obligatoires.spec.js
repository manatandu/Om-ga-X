"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const livre_inventaire_service_1 = require("./livre-inventaire.service");
const rapport_activite_service_1 = require("./rapport-activite.service");
const correspondance_inventaire_1 = require("./correspondance-inventaire");
const EXERCICE = { id: 'ex1', tenantId: 't1', dateDebut: new Date('2026-01-01'), dateFin: new Date('2026-12-31') };
function prismaAvec(jeu, transcriptions = [], rapports = []) {
    const ecritures = [];
    const suivante = (table) => (data) => {
        const cree = { id: `x${table.length + 1}`, transcritLe: new Date(), createdAt: new Date(), ...data };
        table.push(cree);
        return Promise.resolve(cree);
    };
    const dernierPar = (table) => (args) => Promise.resolve(args?.orderBy?.version === 'desc'
        ? [...table].sort((a, b) => b.version - a.version)[0] ?? null
        : table.find((x) => x.id === args?.where?.id) ?? null);
    return {
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
        tenant: { findUniqueOrThrow: jest.fn().mockResolvedValue({ jeuEtatsFinanciersSycebnl: jeu }) },
        transcriptionInventaire: {
            findMany: jest.fn().mockResolvedValue(transcriptions),
            findFirst: jest.fn().mockImplementation(dernierPar(transcriptions)),
            create: jest.fn().mockImplementation(({ data }) => suivante(transcriptions)(data)),
            update: jest.fn().mockImplementation(({ where, data }) => {
                const t = transcriptions.find((x) => x.id === where.id);
                Object.assign(t, data);
                return Promise.resolve(t);
            }),
        },
        rapportActivite: {
            findMany: jest.fn().mockResolvedValue(rapports),
            findFirst: jest.fn().mockImplementation(dernierPar(rapports)),
            create: jest.fn().mockImplementation(({ data }) => suivante(rapports)(data)),
        },
        ecriture: {
            count: jest.fn().mockImplementation(({ where }) => Promise.resolve(ecritures.filter((e) => e.tenantId === where.tenantId &&
                e.exerciceId === where.exerciceId &&
                e.motifImputationOuverture === where.motifImputationOuverture).length)),
        },
        _transcriptions: transcriptions,
        _rapports: rapports,
        _ecritures: ecritures,
    };
}
const TFT_QUI_BOUCLE = {
    controle: { tresorerieOuverture: 1200, variation: 300, tresorerieClotureParBilan: 1500, coherent: true },
};
function services(jeu = client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, prisma = prismaAvec(jeu), tft = TFT_QUI_BOUCLE, registreConforme = true) {
    const ef = {
        bilan: jest.fn().mockResolvedValue({ etat: 'bilan-associations' }),
        compteDeResultat: jest.fn().mockResolvedValue({ etat: 'compte-de-resultat' }),
        tableauFluxTresorerie: jest.fn().mockResolvedValue(tft),
    };
    const efp = {
        bilan: jest.fn().mockResolvedValue({ etat: 'bilan-projet' }),
        compteExploitation: jest.fn().mockResolvedValue({ etat: 'compte-exploitation' }),
    };
    const donations = {
        rapportConformite: jest.fn().mockResolvedValue({
            numerotation: { continue: registreConforme },
            signature: { lignesNonSignees: registreConforme ? [] : [{ numero: 3 }] },
            completude: { lignesIncompletes: [] },
            rapprochement: { rapproche: true },
        }),
    };
    const efs = {
        bilan: jest.fn().mockResolvedValue({ etat: 'bilan-smt' }),
        compteDeResultat: jest.fn().mockResolvedValue({ etat: 'compte-de-resultat-smt' }),
    };
    const efb = {
        executionBudgetaire: jest.fn().mockResolvedValue({ etat: 'execution-budgetaire' }),
        reconciliationTresorerie: jest.fn().mockResolvedValue({ etat: 'reconciliation-tresorerie' }),
    };
    const esc = {
        bilan: jest.fn().mockResolvedValue({ etat: 'bilan-syscohada' }),
        compteDeResultat: jest.fn().mockResolvedValue({ etat: 'compte-resultat-syscohada' }),
        tableauFluxTresorerie: jest.fn().mockResolvedValue({ etat: 'tft-syscohada' }),
    };
    const escSmt = {
        bilan: jest.fn().mockResolvedValue({ etat: 'bilan-smt-syscohada' }),
        compteDeResultat: jest.fn().mockResolvedValue({ etat: 'compte-resultat-smt-syscohada' }),
    };
    return {
        inventaire: new livre_inventaire_service_1.LivreInventaireService(prisma, ef, efp, efs, efb, esc, escSmt),
        esc,
        escSmt,
        rapport: new rapport_activite_service_1.RapportActiviteService(prisma, ef, donations, esc),
        prisma,
        ef,
        efp,
        efs,
    };
}
describe('Article 14 · liste des états à transcrire', () => {
    it('reprend les trois états du point 1 pour les associations, dans l’ordre du texte', () => {
        expect(correspondance_inventaire_1.ETATS_INVENTAIRE_ASSOCIATIONS.map((e) => e.libelle)).toEqual([
            'Bilan',
            'Compte de résultat',
            'Tableau des flux de trésorerie',
        ]);
    });
    it('reprend les cinq états du point 2 pour les projets, dans l’ordre du texte', () => {
        expect(correspondance_inventaire_1.ETATS_INVENTAIRE_PROJETS.map((e) => e.libelle)).toEqual([
            'Tableau emplois-ressources',
            "Tableau d'exécution budgétaire",
            'Tableau de réconciliation de trésorerie',
            'Bilan',
            "Compte d'exploitation",
        ]);
    });
    it('motive chaque état déclaré indisponible', () => {
        for (const e of [...correspondance_inventaire_1.ETATS_INVENTAIRE_ASSOCIATIONS, ...correspondance_inventaire_1.ETATS_INVENTAIRE_PROJETS]) {
            if (!e.disponible)
                expect(e.motifIndisponibilite?.length).toBeGreaterThan(40);
            else
                expect(e.motifIndisponibilite).toBeUndefined();
        }
    });
    it('aiguille sur le bon point de l’article selon le jeu', () => {
        expect((0, correspondance_inventaire_1.etatsExigesPar)(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS)).toBe(correspondance_inventaire_1.ETATS_INVENTAIRE_ASSOCIATIONS);
        expect((0, correspondance_inventaire_1.etatsExigesPar)(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT)).toBe(correspondance_inventaire_1.ETATS_INVENTAIRE_PROJETS);
    });
});
describe('Livre d’inventaire · transcription', () => {
    it('fige les trois états d’une association et n’en déclare aucun manquant', async () => {
        const { inventaire } = services();
        const t = await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1' });
        expect(Object.keys(t.etats).sort()).toEqual(['bilan', 'compteDeResultat', 'tableauFluxTresorerie']);
        expect(t.documentsManquants).toEqual([]);
        expect(t.version).toBe(1);
    });
    it('transcrit le bilan du BON jeu · associations', async () => {
        const { inventaire, ef, efp } = services();
        const t = await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1' });
        expect(t.etats.bilan).toEqual({ etat: 'bilan-associations' });
        expect(ef.bilan).toHaveBeenCalled();
        expect(efp.bilan).not.toHaveBeenCalled();
    });
    it('transcrit le bilan du BON jeu · projets de développement', async () => {
        const { inventaire, ef, efp } = services(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
        efp.tableauEmploisRessources = jest.fn().mockResolvedValue({ etat: 'emplois-ressources' });
        const t = await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1' });
        expect(t.etats.bilan).toEqual({ etat: 'bilan-projet' });
        expect(efp.bilan).toHaveBeenCalled();
        expect(ef.bilan).not.toHaveBeenCalled();
    });
    it('transcrit LES CINQ états du point 2, aucun n’est plus déclaré manquant', async () => {
        const { inventaire, efp } = services(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
        efp.tableauEmploisRessources = jest.fn().mockResolvedValue({ etat: 'emplois-ressources' });
        const t = await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1' });
        expect(Object.keys(t.etats)).toEqual([
            'tableauEmploisRessources',
            'tableauExecutionBudgetaire',
            'tableauReconciliationTresorerie',
            'bilan',
            'compteExploitation',
        ]);
        expect(t.documentsManquants).toEqual([]);
    });
    it('fige le jeu sur la transcription, pas seulement les états', async () => {
        const { inventaire, efp } = services(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
        efp.tableauEmploisRessources = jest.fn().mockResolvedValue({ etat: 'emplois-ressources' });
        const t = await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1' });
        expect(t.jeu).toBe(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
    });
    it('crée une version suivante sans effacer la précédente', async () => {
        const { inventaire, prisma } = services();
        await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1' });
        const deux = await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1' });
        expect(deux.version).toBe(2);
        expect(prisma._transcriptions).toHaveLength(2);
        expect(await inventaire.courante('t1', 'ex1')).toMatchObject({ version: 2 });
    });
    it('ne transcrit RIEN venu du client : le DTO ne porte aucun état', async () => {
        const { inventaire, ef } = services();
        await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1', resumeOperationInventaire: '  ' });
        expect(ef.bilan).toHaveBeenCalledWith('t1', 'ex1');
    });
    it('normalise un résumé vide en null plutôt qu’en chaîne blanche', async () => {
        const { inventaire } = services();
        const t = await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1', resumeOperationInventaire: '   ' });
        expect(t.resumeOperationInventaire).toBeNull();
    });
});
describe('Livre d’inventaire · conformité (art. 14)', () => {
    it('un exercice jamais transcrit n’est pas déguisé en transcription vide', async () => {
        const { inventaire } = services();
        const c = await inventaire.conformite('t1', 'ex1');
        expect(c.transcrit).toBe(false);
        expect(c.complete).toBe(false);
        expect(c.etatsExiges.every((e) => !e.transcrit)).toBe(true);
    });
    it('n’est complet qu’avec les états ET le résumé exigés par l’article', async () => {
        const { inventaire } = services();
        const t = await inventaire.transcrire('t1', 'u1', { exerciceId: 'ex1' });
        expect((await inventaire.conformite('t1', 'ex1')).complete).toBe(false);
        await inventaire.renseignerResume('t1', t.id, {
            resumeOperationInventaire: 'Inventaire physique des immobilisations et des stocks au 31/12/2026.',
        });
        const c = await inventaire.conformite('t1', 'ex1');
        expect(c.resume.renseigne).toBe(true);
        expect(c.complete).toBe(true);
    });
    it('un livre de projet est complet dès lors que les cinq états et le résumé y sont', async () => {
        const { inventaire, efp } = services(client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT);
        efp.tableauEmploisRessources = jest.fn().mockResolvedValue({ etat: 'emplois-ressources' });
        const t = await inventaire.transcrire('t1', 'u1', {
            exerciceId: 'ex1',
            resumeOperationInventaire: 'Inventaire réalisé.',
        });
        expect(t.resumeOperationInventaire).toBeTruthy();
        const c = await inventaire.conformite('t1', 'ex1');
        expect(c.documentsManquants).toHaveLength(0);
        expect(c.complete).toBe(true);
    });
});
const RAPPORT_COMPLET = {
    exerciceId: 'ex1',
    etabliLe: '2027-03-15',
    situationExerciceEcoule: 'Activité soutenue, 12 projets menés.',
    perspectivesDeveloppement: 'Ouverture d’une antenne à Lubumbashi en 2027.',
    evolutionTresorerie: 'Trésorerie en hausse de 300 sur l’exercice.',
    evenementsPosterieurs: 'Signature d’une convention bailleur le 20/01/2027.',
    declarationDirigeants: 'Les dirigeants attestent de la tenue conforme du registre des donateurs.',
};
describe('Article 16-3 · sections du rapport d’activité', () => {
    it('en énumère QUATRE, ni plus ni moins, dans l’ordre du texte', () => {
        expect(correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE.map((s) => s.cle)).toEqual([
            'situationExerciceEcoule',
            'perspectivesDeveloppement',
            'evolutionTresorerie',
            'evenementsPosterieurs',
        ]);
    });
    it('cite le texte pour chaque section', () => {
        for (const s of correspondance_inventaire_1.SECTIONS_RAPPORT_ACTIVITE)
            expect(s.exigence).toMatch(/Art\. 16-3/);
    });
});
describe('Rapport d’activité · établissement', () => {
    it('refuse une date d’établissement antérieure à la clôture', async () => {
        const { rapport } = services();
        await expect(rapport.etablir('t1', 'u1', { ...RAPPORT_COMPLET, etabliLe: '2026-11-30' })).rejects.toBeInstanceOf(common_1.BadRequestException);
    });
    it('accepte une date d’établissement égale à la clôture', async () => {
        const { rapport } = services();
        const r = await rapport.etablir('t1', 'u1', { ...RAPPORT_COMPLET, etabliLe: '2026-12-31' });
        expect(r.version).toBe(1);
    });
    it('fige la trésorerie du TFT au moment de l’établissement', async () => {
        const { rapport } = services();
        const r = await rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        expect(r.tresorerie).toEqual({ tableau: 'TFT_ASSOCIATIONS', ouverture: 1200, variation: 300, cloture: 1500, boucle: true });
    });
    it('fige aussi le NON-bouclage du TFT', async () => {
        const { rapport } = services(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, undefined, { controle: { tresorerieOuverture: 100, variation: 50, tresorerieClotureParBilan: 900, coherent: false } });
        const r = await rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        expect(r.tresorerie).toMatchObject({ boucle: false });
    });
    it('fige un contrôle NON EFFECTUÉ comme tel · ouverture et variation null, motif et raison des postes vides', async () => {
        const { rapport } = services(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, undefined, {
            postesVides: ['ZA', 'FM', 'ZF', 'ZG'],
            postesNonCalculables: [
                { ref: 'ZA', raison: 'Ouverture passée en OD (OD n° 1).' },
                { ref: 'FM', raison: 'Ouverture passée en OD (OD n° 1).' },
            ],
            controle: {
                tresorerieOuverture: null,
                variation: null,
                tresorerieClotureParFlux: null,
                tresorerieClotureParBilan: 12_500_000,
                ecart: null,
                coherent: null,
                motifNonControlable: 'Contrôle non effectué · ZA et ZF laissées vides.',
            },
        });
        const r = await rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        expect(r.tresorerie).toEqual({
            tableau: 'TFT_ASSOCIATIONS',
            ouverture: null,
            variation: null,
            cloture: 12_500_000,
            boucle: null,
            motifNonControlable: 'Contrôle non effectué · ZA et ZF laissées vides. Ouverture passée en OD (OD n° 1).',
        });
    });
    it('versionne au lieu d’écraser', async () => {
        const { rapport } = services();
        await rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        const deux = await rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        expect(deux.version).toBe(2);
        expect(await rapport.courant('t1', 'ex1')).toMatchObject({ version: 2 });
    });
});
describe('Rapport d’activité · conformité', () => {
    it('un exercice sans rapport est signalé comme tel (art. 24)', async () => {
        const { rapport } = services();
        const c = await rapport.conformite('t1', 'ex1');
        expect(c.etabli).toBe(false);
        expect(c.complet).toBe(false);
        expect(c.sections.every((s) => !s.renseignee)).toBe(true);
        expect(c.fenetreEvenementsPosterieurs).toBeNull();
    });
    it('signale précisément la section vide, sans juger le contenu des autres', async () => {
        const { rapport } = services();
        await rapport.etablir('t1', 'u1', { ...RAPPORT_COMPLET, perspectivesDeveloppement: undefined });
        const c = await rapport.conformite('t1', 'ex1');
        expect(c.sections.filter((s) => !s.renseignee).map((s) => s.cle)).toEqual(['perspectivesDeveloppement']);
        expect(c.complet).toBe(false);
    });
    it('nomme la fenêtre des événements postérieurs plutôt que de la sous-entendre', async () => {
        const { rapport } = services();
        await rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        const c = await rapport.conformite('t1', 'ex1');
        expect(c.fenetreEvenementsPosterieurs).toEqual({ du: EXERCICE.dateFin, au: new Date('2027-03-15'), article: 'art. 16-3' });
    });
    it('n’attend la déclaration des dirigeants qu’en l’absence d’auditeur', async () => {
        const { rapport } = services();
        await rapport.etablir('t1', 'u1', { ...RAPPORT_COMPLET, entiteAvecAuditeur: true, declarationDirigeants: undefined });
        const c = await rapport.conformite('t1', 'ex1');
        expect(c.declarationRegistreDonateurs.attendue).toBe(false);
        expect(c.complet).toBe(true);
    });
    it('bloque la complétude quand la déclaration manque et qu’il n’y a pas d’auditeur', async () => {
        const { rapport } = services();
        await rapport.etablir('t1', 'u1', { ...RAPPORT_COMPLET, declarationDirigeants: undefined });
        const c = await rapport.conformite('t1', 'ex1');
        expect(c.declarationRegistreDonateurs.attendue).toBe(true);
        expect(c.declarationRegistreDonateurs.renseignee).toBe(false);
        expect(c.complet).toBe(false);
    });
    it('confronte la déclaration à l’état réel du registre des donateurs', async () => {
        const conforme = services();
        await conforme.rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        expect((await conforme.rapport.conformite('t1', 'ex1')).declarationRegistreDonateurs.registreConforme).toBe(true);
        const nonConforme = services(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, undefined, TFT_QUI_BOUCLE, false);
        await nonConforme.rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        const c = await nonConforme.rapport.conformite('t1', 'ex1');
        expect(c.declarationRegistreDonateurs.renseignee).toBe(true);
        expect(c.declarationRegistreDonateurs.registreConforme).toBe(false);
    });
});
function enSyscohada(prisma, systeme, forme = client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME) {
    prisma.tenant.findUniqueOrThrow = jest.fn().mockResolvedValue({
        referentiel: client_1.Referentiel.SYSCOHADA,
        jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
        systemeComptableSyscohada: systeme,
        formeJuridiqueSyscohada: forme,
    });
    return prisma;
}
const RAPPORT_GESTION = { exerciceId: 'ex1', etabliLe: '2027-03-15', sections: { situationExerciceEcoule: 'Exercice.' } };
describe('Rapport · la trésorerie vient du tableau du DOSSIER, ou d’aucun (F94)', () => {
    it('le tableau se choisit par le référentiel, le jeu et le système', () => {
        const t = (referentiel, jeu, systeme) => (0, rapport_activite_service_1.tableauTresorerieDuDossier)({ referentiel, jeuEtatsFinanciersSycebnl: jeu, systemeComptableSyscohada: systeme });
        const J = client_1.JeuEtatsFinanciersSycebnl;
        expect(t(client_1.Referentiel.SYCEBNL, J.ASSOCIATIONS_ORDRES_PROFESSIONNELS, null)).toBe('TFT_ASSOCIATIONS');
        expect(t(client_1.Referentiel.SYCEBNL, J.PROJETS_DEVELOPPEMENT, null)).toBeNull();
        expect(t(client_1.Referentiel.SYCEBNL, J.SYSTEME_MINIMAL_TRESORERIE, null)).toBeNull();
        expect(t(client_1.Referentiel.SYSCOHADA, J.ASSOCIATIONS_ORDRES_PROFESSIONNELS, client_1.SystemeComptableSyscohada.NORMAL)).toBe('TFT_SYSCOHADA_NORMAL');
        expect(t(client_1.Referentiel.SYSCOHADA, J.ASSOCIATIONS_ORDRES_PROFESSIONNELS, null)).toBe('TFT_SYSCOHADA_NORMAL');
        expect(t(client_1.Referentiel.SYSCOHADA, J.ASSOCIATIONS_ORDRES_PROFESSIONNELS, client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE)).toBeNull();
    });
    it.each([client_1.JeuEtatsFinanciersSycebnl.PROJETS_DEVELOPPEMENT, client_1.JeuEtatsFinanciersSycebnl.SYSTEME_MINIMAL_TRESORERIE])('le jeu %s n’a pas de tableau des flux · rien n’est figé, rien n’est lu', async (jeu) => {
        const { rapport, prisma, ef } = services(jeu);
        await rapport.etablir('t1', 'u1', RAPPORT_COMPLET);
        expect(ef.tableauFluxTresorerie).not.toHaveBeenCalled();
        expect(prisma.rapportActivite.create.mock.calls[0][0].data.tresorerie).toBe(client_1.Prisma.DbNull);
        expect((await rapport.conformite('t1', 'ex1')).tresorerie).toBeNull();
    });
    it('une société au Système normal fige SON tableau, jamais celui des associations', async () => {
        const prisma = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS), client_1.SystemeComptableSyscohada.NORMAL);
        const { rapport, ef, esc } = services(undefined, prisma);
        esc.tableauFluxTresorerie.mockResolvedValue({
            controle: { tresorerieOuverture: 10, variation: 5, tresorerieClotureParBilan: 15, coherent: true },
        });
        const r = await rapport.etablir('t1', 'u1', RAPPORT_GESTION);
        expect(r.tresorerie).toEqual({ tableau: 'TFT_SYSCOHADA_NORMAL', ouverture: 10, variation: 5, cloture: 15, boucle: true });
        expect(ef.tableauFluxTresorerie).not.toHaveBeenCalled();
        expect((await rapport.conformiteRapportGestion('t1', 'ex1')).tresorerie).toMatchObject({ cloture: 15 });
    });
    it('une société au Système minimal n’a pas de tableau · aucun n’est lu', async () => {
        const prisma = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS), client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE);
        const { rapport, ef, esc } = services(undefined, prisma);
        await rapport.etablir('t1', 'u1', RAPPORT_GESTION);
        expect(ef.tableauFluxTresorerie).not.toHaveBeenCalled();
        expect(esc.tableauFluxTresorerie).not.toHaveBeenCalled();
        expect(prisma.rapportActivite.create.mock.calls[0][0].data.tresorerie).toBe(client_1.Prisma.DbNull);
    });
    it('une trésorerie figée avant la correction ne se relit que chez une association', async () => {
        const ancienne = { ouverture: 1, variation: 2, cloture: 3, boucle: true };
        expect((0, rapport_activite_service_1.tresorerieFigee)(ancienne, 'TFT_ASSOCIATIONS')).toBe(ancienne);
        expect((0, rapport_activite_service_1.tresorerieFigee)(ancienne, 'TFT_SYSCOHADA_NORMAL')).toBeNull();
        expect((0, rapport_activite_service_1.tresorerieFigee)(ancienne, null)).toBeNull();
        expect((0, rapport_activite_service_1.tresorerieFigee)({ ...ancienne, tableau: 'TFT_SYSCOHADA_NORMAL' }, 'TFT_SYSCOHADA_NORMAL')).toMatchObject({ cloture: 3 });
        const stocke = [{ id: 'r1', exerciceId: 'ex1', version: 1, etabliLe: new Date('2027-03-15'), sections: {}, tresorerie: ancienne }];
        const societe = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, [], stocke), client_1.SystemeComptableSyscohada.NORMAL);
        expect((await services(undefined, societe).rapport.conformiteRapportGestion('t1', 'ex1')).tresorerie).toBeNull();
        const association = prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS, [], [...stocke]);
        association.tenant.findUniqueOrThrow = jest.fn().mockResolvedValue({
            referentiel: client_1.Referentiel.SYCEBNL,
            jeuEtatsFinanciersSycebnl: client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS,
            systemeComptableSyscohada: null,
        });
        expect((await services(undefined, association).rapport.conformite('t1', 'ex1')).tresorerie).toBe(ancienne);
    });
});
describe('Rapport · le texte cité est celui du dossier (F95)', () => {
    it('la fenêtre des événements postérieurs d’une société cite l’AUSCGIE', async () => {
        const prisma = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS), client_1.SystemeComptableSyscohada.NORMAL);
        const { rapport, esc } = services(undefined, prisma);
        esc.tableauFluxTresorerie.mockResolvedValue({
            controle: { tresorerieOuverture: 0, variation: 0, tresorerieClotureParBilan: 0, coherent: true },
        });
        await rapport.etablir('t1', 'u1', RAPPORT_GESTION);
        const c = await rapport.conformiteRapportGestion('t1', 'ex1');
        expect(c.fenetreEvenementsPosterieurs?.article).toBe('AUSCGIE, article 138');
    });
    it('le refus d’une date antérieure à la clôture cite le texte du dossier', async () => {
        const prisma = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS), client_1.SystemeComptableSyscohada.NORMAL);
        const societe = services(undefined, prisma).rapport.etablir('t1', 'u1', { ...RAPPORT_GESTION, etabliLe: '2026-06-30' });
        await expect(societe).rejects.toThrow('AUSCGIE, article 138 rend compte');
        await expect(services(undefined, prisma).rapport.etablir('t1', 'u1', { ...RAPPORT_GESTION, etabliLe: '2026-06-30' })).rejects.not.toThrow('16-3');
        await expect(services().rapport.etablir('t1', 'u1', { ...RAPPORT_COMPLET, etabliLe: '2026-06-30' })).rejects.toThrow("L'article 16-3 rend compte");
        await expect(societe).rejects.toThrow("il s'établit après sa clôture, et les événements postérieurs se comptent à partir d'elle.");
    });
    it('le refus servi à une coopérative s’arrête à « l’exercice écoulé » · l’art. 108 ne demande pas les événements postérieurs', async () => {
        const prisma = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS), client_1.SystemeComptableSyscohada.NORMAL, client_1.FormeJuridiqueSyscohada.SOCIETE_COOPERATIVE);
        await expect(services(undefined, prisma).rapport.etablir('t1', 'u1', { ...RAPPORT_GESTION, etabliLe: '2026-06-30' })).rejects.toThrow(/AUSCOOP, article 108 rend compte de l'exercice écoulé : il s'établit après sa clôture\.$/);
    });
});
describe('Livre d’inventaire · le fondement du dossier (F95)', () => {
    const f = (referentiel, jeu, systeme) => (0, livre_inventaire_service_1.fondementInventaire)({ referentiel, jeuEtatsFinanciersSycebnl: jeu, systemeComptableSyscohada: systeme });
    const J = client_1.JeuEtatsFinanciersSycebnl;
    it('une société relève de l’AUDCIF art. 19, et de l’art. 111 pour la sanction', () => {
        const n = f(client_1.Referentiel.SYSCOHADA, J.ASSOCIATIONS_ORDRES_PROFESSIONNELS, client_1.SystemeComptableSyscohada.NORMAL);
        expect(n).toMatchObject({ article: 'AUDCIF art. 19', perimetre: 'Système normal.' });
        expect(n.sanction).toContain('AUDCIF, art. 111');
        expect(f(client_1.Referentiel.SYSCOHADA, J.ASSOCIATIONS_ORDRES_PROFESSIONNELS, client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE).perimetre).toBe('Système minimal de trésorerie.');
    });
    it('une EBNL relève de l’art. 14 selon son jeu, et de l’art. 24 pour la sanction', () => {
        expect(f(client_1.Referentiel.SYCEBNL, J.ASSOCIATIONS_ORDRES_PROFESSIONNELS, null)).toMatchObject({
            article: 'Art. 14, point 1',
            perimetre: 'Associations et ordres professionnels.',
        });
        expect(f(client_1.Referentiel.SYCEBNL, J.PROJETS_DEVELOPPEMENT, null).article).toBe('Art. 14, point 2');
        expect(f(client_1.Referentiel.SYCEBNL, J.SYSTEME_MINIMAL_TRESORERIE, null).perimetre).toContain('Système minimal de trésorerie');
        expect(f(client_1.Referentiel.SYCEBNL, J.PROJETS_DEVELOPPEMENT, null).sanction).toContain('Acte uniforme SYCEBNL, art. 24');
    });
    it('la conformité d’une société porte l’article de l’AUDCIF', async () => {
        const prisma = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS), client_1.SystemeComptableSyscohada.NORMAL);
        const c = await services(undefined, prisma).inventaire.conformite('t1', 'ex1');
        expect(c.fondement.article).toBe('AUDCIF art. 19');
    });
});
describe('Rapport de gestion · art. 141, 185 et 547-1, et la forme de l’exercice', () => {
    it('rend le nombre de changements de méthode enregistrés à côté de la section de l’art. 141', async () => {
        const prisma = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS), client_1.SystemeComptableSyscohada.NORMAL);
        prisma._ecritures.push({ tenantId: 't1', exerciceId: 'ex1', motifImputationOuverture: 'CHANGEMENT_METHODE' }, { tenantId: 't1', exerciceId: 'ex1', motifImputationOuverture: 'CORRECTION_ERREUR' });
        const c = await services(undefined, prisma).rapport.conformiteRapportGestion('t1', 'ex1');
        expect(c.modificationsDeMethodeEnregistrees).toBe(1);
        expect(c.sections.map((s) => s.cle)).toEqual(expect.arrayContaining(['modificationsPresentationMethodes', 'participationSalariesCapital']));
    });
    it('un exercice clos avant la transformation se juge sous l’ancienne forme, et l’exercice de transformation rappelle l’art. 185', async () => {
        const prisma = enSyscohada(prismaAvec(client_1.JeuEtatsFinanciersSycebnl.ASSOCIATIONS_ORDRES_PROFESSIONNELS), client_1.SystemeComptableSyscohada.NORMAL, client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME);
        const tenant = await prisma.tenant.findUniqueOrThrow({});
        prisma.tenant.findUniqueOrThrow = jest.fn().mockResolvedValue({
            ...tenant,
            formeJuridiqueSyscohadaAnterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            dateTransformationForme: new Date(EXERCICE.dateFin.getTime() + 86_400_000),
        });
        const avant = await services(undefined, prisma).rapport.conformiteRapportGestion('t1', 'ex1');
        expect(avant.sections.map((s) => s.cle)).not.toContain('participationSalariesCapital');
        expect(avant.mentionTransformation).toBeNull();
        prisma.tenant.findUniqueOrThrow = jest.fn().mockResolvedValue({
            ...tenant,
            formeJuridiqueSyscohadaAnterieure: client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE,
            dateTransformationForme: EXERCICE.dateFin,
        });
        const pendant = await services(undefined, prisma).rapport.conformiteRapportGestion('t1', 'ex1');
        expect(pendant.sections.map((s) => s.cle)).toContain('participationSalariesCapital');
        expect(pendant.mentionTransformation).toContain('AUSCGIE art. 185');
    });
});
//# sourceMappingURL=documents-obligatoires.spec.js.map