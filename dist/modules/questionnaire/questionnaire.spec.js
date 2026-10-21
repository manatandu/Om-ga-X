"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path_1 = require("path");
const client_1 = require("@prisma/client");
const questionnaire_service_1 = require("./questionnaire.service");
const catalogue_questionnaire_1 = require("./catalogue-questionnaire");
const EXERCICE = { id: 'ex1', tenantId: 't1' };
function service(etat = {}) {
    const creerReponse = jest.fn().mockImplementation((a) => Promise.resolve({ id: 'r1', ...a.create, ...a.update }));
    const prisma = {
        exercice: { findFirst: jest.fn().mockResolvedValue(EXERCICE) },
        tenant: { findUnique: jest.fn().mockResolvedValue({ referentiel: etat.referentiel ?? client_1.Referentiel.SYCEBNL }) },
        questionnaireRevision: {
            findFirst: jest.fn().mockResolvedValue(etat.questionnaire ?? null),
            findMany: jest.fn().mockResolvedValue([]),
            create: jest.fn().mockImplementation((a) => Promise.resolve({ id: 'q1', ...a.data })),
            update: jest.fn().mockImplementation((a) => Promise.resolve({ id: a.where.id, ...a.data })),
        },
        reponseQuestionnaire: {
            findUnique: jest.fn().mockResolvedValue(etat.parent ?? null),
            findMany: jest.fn().mockResolvedValue(etat.reponses ?? []),
            upsert: creerReponse,
        },
    };
    return { svc: new questionnaire_service_1.QuestionnaireService(prisma), creerReponse };
}
const questionnaire = (extra = {}) => ({
    id: 'q1',
    tenantId: 't1',
    exerciceId: 'ex1',
    cycles: [],
    statut: client_1.StatutQuestionnaire.OUVERT,
    ...extra,
});
const item = (code) => {
    const i = catalogue_questionnaire_1.ITEM_PAR_CODE.get(code);
    if (!i)
        throw new Error(`item ${code} absent du catalogue`);
    return i;
};
describe('les vingt-quatre items du CPCC, mot pour mot', () => {
    it('en compte exactement vingt-quatre, et pas un de plus', () => {
        expect(questionnaire_service_1.QuestionnaireService.itemsInterrogatifsCpcc()).toHaveLength(24);
    });
    it('les répartit comme les deux checklists du séminaire', () => {
        const parCycle = (c) => questionnaire_service_1.QuestionnaireService.itemsInterrogatifsCpcc().filter((i) => i.cycle === c).length;
        expect(parCycle(client_1.CycleQuestionnaire.IMMOBILISATIONS)).toBe(2);
        expect(parCycle(client_1.CycleQuestionnaire.STOCKS)).toBe(8);
        expect(parCycle(client_1.CycleQuestionnaire.CAISSES)).toBe(5);
        expect(parCycle(client_1.CycleQuestionnaire.BANQUES)).toBe(1);
        expect(parCycle(client_1.CycleQuestionnaire.DETTES_FOURNISSEURS)).toBe(3);
        expect(parCycle(client_1.CycleQuestionnaire.PROVISIONS)).toBe(0);
        expect(parCycle(client_1.CycleQuestionnaire.CREANCES)).toBe(5);
    });
    it('porte dix-sept impératifs, comptés à part des questions', () => {
        const travaux = catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE.filter((i) => i.origine === 'CPCC' && i.forme === 'TRAVAIL');
        expect(travaux).toHaveLength(17);
        expect(travaux.filter((i) => i.cycle === client_1.CycleQuestionnaire.PROVISIONS)).toHaveLength(6);
    });
    it('fige le libellé de six items sensibles, à la virgule près', () => {
        expect(item('CPCC-CAI-4').libelle).toBe("Y a-t-il un chevauchement avec l'exercice en cours sur le solde d'ouverture ?");
        expect(item('CPCC-CAI-3').libelle).toBe('A-t-on tenu compte de la caisse siège, de la caisse agence, de la caisse de secours ?');
        expect(item('CPCC-DET-3').libelle).toBe("Si non, comment a-t-on procédé pour la sélection des fournisseurs à circulariser ?");
        expect(item('CPCC-CRE-5').libelle).toBe("Combien de réponses a-t-on reçues ? Si le pourcentage est insignifiant, a-t-on relancé pour insister sur l'importance attendue des réponses ?");
        expect(item('CPCC-PRO-6').libelle).toBe("Faire le suivi des faiblesses relevées lors de l'audit précédent.");
        expect(item('CPCC-STO-6').libelle).toBe("Quelles dispositions assurent le bon fonctionnement du cut-off (clôture des aires de réception et d'expédition, transferts internes...) ?");
    });
    it('donne une source à chaque item du CPCC et un fondement à chaque item de VMG', () => {
        for (const i of catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE) {
            if (i.origine === 'CPCC') {
                expect({ code: i.code, source: Boolean(i.source), fondement: i.fondement }).toEqual({
                    code: i.code,
                    source: true,
                    fondement: undefined,
                });
            }
            else {
                expect({ code: i.code, fondement: Boolean(i.fondement), source: i.source }).toEqual({
                    code: i.code,
                    fondement: true,
                    source: undefined,
                });
            }
        }
    });
    it('préfixe le code par l’origine · aucun item de VMG ne peut se lire comme du CPCC', () => {
        for (const i of catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE) {
            expect(i.code.startsWith(i.origine === 'CPCC' ? 'CPCC-' : 'VMG-')).toBe(true);
        }
    });
});
describe('la polarité · vingt-trois fois « Non », une fois « Oui »', () => {
    it('ne connaît qu’un seul item du CPCC à polarité inversée', () => {
        const inverses = catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE.filter((i) => i.origine === 'CPCC' && i.polariteException === 'OUI');
        expect(inverses.map((i) => i.code)).toEqual(['CPCC-CAI-4']);
    });
    it('fait du « Oui » l’exception sur le chevauchement du solde d’ouverture', () => {
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-CAI-4'), client_1.ReponseItem.OUI)).toBe(true);
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-CAI-4'), client_1.ReponseItem.NON)).toBe(false);
    });
    it('fait du « Non » l’exception partout ailleurs', () => {
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-CAI-1'), client_1.ReponseItem.NON)).toBe(true);
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-CAI-1'), client_1.ReponseItem.OUI)).toBe(false);
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-STO-1'), client_1.ReponseItem.NON)).toBe(true);
    });
    it('ne fait jamais de SANS_OBJET une exception · le cycle n’existe pas, ce n’est pas un manquement', () => {
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-CAI-1'), client_1.ReponseItem.SANS_OBJET)).toBe(false);
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-CAI-4'), client_1.ReponseItem.SANS_OBJET)).toBe(false);
    });
    it('n’ouvre aucune exception sur un item qui n’est pas une question fermée', () => {
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-STO-6'), client_1.ReponseItem.NON)).toBe(false);
        expect(questionnaire_service_1.QuestionnaireService.estException(item('CPCC-PRO-6'), client_1.ReponseItem.NON)).toBe(false);
    });
});
describe('le chaînage · un item fermé ne se répond pas', () => {
    it('ouvre « Si oui, une attestation… » seulement après un comptage au 31 décembre', () => {
        expect(questionnaire_service_1.QuestionnaireService.estOuvert(item('CPCC-CAI-2'), new Map([['CPCC-CAI-1', client_1.ReponseItem.OUI]]))).toBe(true);
        expect(questionnaire_service_1.QuestionnaireService.estOuvert(item('CPCC-CAI-2'), new Map([['CPCC-CAI-1', client_1.ReponseItem.NON]]))).toBe(false);
        expect(questionnaire_service_1.QuestionnaireService.estOuvert(item('CPCC-CAI-2'), new Map())).toBe(false);
    });
    it('ouvre la seule chaîne « Non → suite » du corpus dans le bon sens', () => {
        expect(questionnaire_service_1.QuestionnaireService.estOuvert(item('CPCC-DET-3'), new Map([['CPCC-DET-2', client_1.ReponseItem.NON]]))).toBe(true);
        expect(questionnaire_service_1.QuestionnaireService.estOuvert(item('CPCC-DET-3'), new Map([['CPCC-DET-2', client_1.ReponseItem.OUI]]))).toBe(false);
    });
    it('laisse ouvert tout item sans parent', () => {
        expect(questionnaire_service_1.QuestionnaireService.estOuvert(item('CPCC-CAI-1'), new Map())).toBe(true);
    });
    it('refuse la réponse à un item dont le parent ne l’ouvre pas', async () => {
        const { svc } = service({
            questionnaire: questionnaire(),
            parent: { code: 'CPCC-CAI-1', reponse: client_1.ReponseItem.NON },
        });
        await expect(svc.repondre('t1', 'q1', 'u1', { code: 'CPCC-CAI-2', reponse: client_1.ReponseItem.OUI })).rejects.toThrow(/n'est ouvert que si CPCC-CAI-1/);
    });
    it('accepte la réponse quand le parent l’ouvre', async () => {
        const { svc, creerReponse } = service({
            questionnaire: questionnaire(),
            parent: { code: 'CPCC-CAI-1', reponse: client_1.ReponseItem.OUI },
        });
        await svc.repondre('t1', 'q1', 'u1', { code: 'CPCC-CAI-2', reponse: client_1.ReponseItem.NON });
        expect(creerReponse.mock.calls[0][0].create.estException).toBe(true);
    });
});
describe('une forme ne s’échange pas contre une autre', () => {
    it('refuse un « Oui » sur un item qui appelle une donnée', async () => {
        const { svc } = service({ questionnaire: questionnaire() });
        await expect(svc.repondre('t1', 'q1', 'u1', { code: 'CPCC-IMM-1', reponse: client_1.ReponseItem.OUI })).rejects.toThrow(/une date, un nombre/);
    });
    it('refuse un « Oui » sur un impératif', async () => {
        const { svc } = service({ questionnaire: questionnaire() });
        await expect(svc.repondre('t1', 'q1', 'u1', { code: 'CPCC-PRO-6', reponse: client_1.ReponseItem.OUI })).rejects.toThrow(/renvoi au papier de travail/);
    });
    it('exige une réponse fermée sur une question fermée', async () => {
        const { svc } = service({ questionnaire: questionnaire() });
        await expect(svc.repondre('t1', 'q1', 'u1', { code: 'CPCC-STO-1', valeur: 'oui bien sûr' })).rejects.toThrow(/question fermée/);
    });
    it('exige le renvoi de travaux sur un impératif', async () => {
        const { svc } = service({ questionnaire: questionnaire() });
        await expect(svc.repondre('t1', 'q1', 'u1', { code: 'CPCC-PRO-1', commentaire: 'fait' })).rejects.toThrow(/renvoi au papier de travail/);
    });
    it('exige la valeur écrite sur un texte libre', async () => {
        const { svc } = service({ questionnaire: questionnaire() });
        await expect(svc.repondre('t1', 'q1', 'u1', { code: 'CPCC-STO-6', commentaire: 'vu' })).rejects.toThrow(/réponse écrite, pas une case/);
    });
});
describe('VMG-ENG-1 · les sûretés réelles sont un objet du recensement', () => {
    it('nomme hypothèques, nantissements et gages, y compris sur les dettes du bilan, avec leur fondement', () => {
        const item = catalogue_questionnaire_1.ITEM_PAR_CODE.get('VMG-ENG-1');
        expect(item.objets).toEqual([
            'Cautions',
            'Avals',
            'Garanties données',
            'Hypothèques, nantissements, gages et autres sûretés réelles consentis, y compris en garantie des dettes du bilan',
        ]);
        expect(item.fondement).toContain('AUDCIF, Titre VII, compte 16');
        expect(item.fondement).toContain('« Dettes garanties par des sûretés réelles »');
        expect(item.fondement).toContain('« hypothèques, nantissements, gages, autres »');
        expect(item.referentiel).toBeUndefined();
    });
});
describe('le référentiel filtre l’item, pas le questionnaire', () => {
    it('écarte la classe 9 des contributions volontaires en SYSCOHADA', () => {
        const sycebnl = questionnaire_service_1.QuestionnaireService.itemsRetenus([client_1.CycleQuestionnaire.ENGAGEMENTS_HORS_BILAN], client_1.Referentiel.SYCEBNL);
        const syscohada = questionnaire_service_1.QuestionnaireService.itemsRetenus([client_1.CycleQuestionnaire.ENGAGEMENTS_HORS_BILAN], client_1.Referentiel.SYSCOHADA);
        expect(sycebnl.map((i) => i.code)).toContain('VMG-ENG-3');
        expect(syscohada.map((i) => i.code)).not.toContain('VMG-ENG-3');
    });
    it('refuse d’y répondre dans le mauvais référentiel', async () => {
        const { svc } = service({ questionnaire: questionnaire(), referentiel: client_1.Referentiel.SYSCOHADA });
        await expect(svc.repondre('t1', 'q1', 'u1', { code: 'VMG-ENG-3', reponse: client_1.ReponseItem.OUI })).rejects.toThrow(/contresens/);
    });
    it('rend tous les cycles quand aucun n’est choisi', () => {
        expect(questionnaire_service_1.QuestionnaireService.itemsRetenus([], client_1.Referentiel.SYCEBNL)).toHaveLength(catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE.length);
    });
});
describe('ce qui empêche de clore', () => {
    const items = questionnaire_service_1.QuestionnaireService.itemsRetenus([client_1.CycleQuestionnaire.CAISSES], client_1.Referentiel.SYCEBNL);
    const rep = (code, o = {}) => ({
        code,
        reponse: null,
        valeur: null,
        renvoiTravaux: null,
        estException: false,
        commentaire: null,
        ...o,
    });
    it('refuse un item ouvert laissé sans réponse', () => {
        const motifs = questionnaire_service_1.QuestionnaireService.motifsRefusCloture(items, []);
        expect(motifs).toHaveLength(1);
        expect(motifs[0]).toContain('sans réponse');
    });
    it('ne réclame rien sur un item que son parent laisse fermé', () => {
        const motifs = questionnaire_service_1.QuestionnaireService.motifsRefusCloture(items, [rep('CPCC-CAI-1', { reponse: client_1.ReponseItem.NON, estException: true, commentaire: 'aucun comptage tenu.' })]);
        expect(motifs[0]).not.toContain('CPCC-CAI-2');
        expect(motifs[0]).toContain('CPCC-CAI-3');
    });
    it('refuse une exception sans commentaire', () => {
        const complet = items.map((i) => rep(i.code, {
            reponse: i.code === 'CPCC-CAI-2' ? null : client_1.ReponseItem.OUI,
            estException: i.code === 'CPCC-CAI-4',
        }));
        const motifs = questionnaire_service_1.QuestionnaireService.motifsRefusCloture(items, complet);
        expect(motifs.some((m) => m.includes('sans commentaire') && m.includes('CPCC-CAI-4'))).toBe(true);
    });
    const refermee = () => items.map((i) => i.code === 'CPCC-CAI-1'
        ? rep(i.code, { reponse: client_1.ReponseItem.NON, estException: true, commentaire: 'Aucun comptage tenu.' })
        : i.code === 'CPCC-CAI-2'
            ? rep(i.code, { reponse: client_1.ReponseItem.NON, estException: true })
            : rep(i.code, { reponse: client_1.ReponseItem.OUI }));
    it('ne compte pas l’exception d’un item que son parent a refermé (audit final F75)', () => {
        expect(questionnaire_service_1.QuestionnaireService.motifsRefusCloture(items, refermee())).toEqual([]);
    });
    it('la synthèse ne la compte pas non plus (audit final F75)', async () => {
        const { svc } = service({
            questionnaire: questionnaire({ cycles: [client_1.CycleQuestionnaire.CAISSES], reponses: refermee() }),
        });
        const r = await svc.consulter('t1', 'q1');
        expect(r.synthese.exceptions).toBe(1);
        expect(r.synthese.exceptionsSansCommentaire).toBe(0);
    });
    it('laisse clore un questionnaire complet dont les exceptions sont commentées', () => {
        const complet = items.map((i) => rep(i.code, {
            reponse: client_1.ReponseItem.OUI,
            estException: i.code === 'CPCC-CAI-4',
            commentaire: i.code === 'CPCC-CAI-4' ? "Reprise du solde d'ouverture corrigée le 12/01." : null,
        }));
        expect(questionnaire_service_1.QuestionnaireService.motifsRefusCloture(items, complet)).toEqual([]);
    });
});
describe('les cycles ajoutés par le cabinet', () => {
    it('en porte vingt-cinq, tous marqués VMG', () => {
        const vmg = catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE.filter((i) => i.origine === 'VMG');
        expect(vmg).toHaveLength(25);
        expect(vmg.every((i) => i.origine === 'VMG')).toBe(true);
    });
    it('n’ajoute aucun item sur les sept rubriques que le CPCC couvre', () => {
        const rubriquesCpcc = [
            client_1.CycleQuestionnaire.IMMOBILISATIONS,
            client_1.CycleQuestionnaire.STOCKS,
            client_1.CycleQuestionnaire.CAISSES,
            client_1.CycleQuestionnaire.BANQUES,
            client_1.CycleQuestionnaire.DETTES_FOURNISSEURS,
            client_1.CycleQuestionnaire.PROVISIONS,
            client_1.CycleQuestionnaire.CREANCES,
        ];
        const intrus = catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE.filter((i) => i.origine === 'VMG' && rubriquesCpcc.includes(i.cycle));
        expect(intrus).toEqual([]);
    });
    it('reprend la logique du CPCC · chaînage et polarité inversée', () => {
        const vmg = catalogue_questionnaire_1.ITEMS_QUESTIONNAIRE.filter((i) => i.origine === 'VMG');
        expect(vmg.filter((i) => i.ouvertPar).length).toBeGreaterThan(0);
        expect(vmg.filter((i) => i.polariteException === 'OUI').length).toBeGreaterThan(0);
    });
});
describe('ce que la source ne doit jamais porter', () => {
    const source = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'catalogue-questionnaire.ts'), 'utf8');
    const svcSource = (0, fs_1.readFileSync)((0, path_1.join)(__dirname, 'questionnaire.service.ts'), 'utf8');
    it('ne chiffre nulle part le « pourcentage insignifiant » de CPCC-CRE-5', () => {
        for (const texte of [source, svcSource]) {
            expect(texte).not.toMatch(/(seuil|taux|pourcentage)[A-Za-z_]*\s*[:=]\s*\d/i);
            expect(texte).not.toMatch(/\d+\s*%/);
        }
    });
    it('conserve le tiret du texte source dans la citation de CPCC-PRO-5', () => {
        expect(item('CPCC-PRO-5').libelle).toContain('litiges — revue des procès-verbaux de conseil');
    });
});
//# sourceMappingURL=questionnaire.spec.js.map