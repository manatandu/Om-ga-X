"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const tenant_service_1 = require("./tenant.service");
const parametres_dossier_dto_1 = require("./dto/parametres-dossier.dto");
describe('Coordonnées du dossier', () => {
    const service = (capture, tenant, ecritures = 0, devisesOuvertes = []) => new tenant_service_1.TenantService({
        tenant: {
            findUnique: async () => ({ dossierMereId: null, _count: { cellules: 0 }, ...tenant }),
            update: async ({ data }) => {
                capture.data = data;
                return tenant;
            },
        },
        ecriture: { count: async () => ecritures },
        compte: { findMany: async () => [] },
        devise: {
            findFirst: async ({ where }) => devisesOuvertes.includes(where.code) ? { id: 'd-1' } : null,
        },
    });
    it('la chaîne vide efface l’adresse mais ne touche ni la raison sociale ni la tenue', async () => {
        const capture = {};
        const s = service(capture, { id: 't1', devise: 'CDF' });
        await s.modifierCoordonnees('t1', { nom: '  VMG Consulting  ', adresse: '', ville: 'Kinshasa' });
        expect(capture.data.nom).toBe('VMG Consulting');
        expect(capture.data.adresse).toBeNull();
        expect(capture.data.ville).toBe('Kinshasa');
        expect(capture.data.devise).toBeUndefined();
        expect(capture.data.telephone).toBeUndefined();
    });
    it('la monnaie de tenue n’est plus une valeur qu’un client puisse envoyer', async () => {
        const avecDevise = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierCoordonneesDto, { nom: 'A', devise: 'USD' }), { whitelist: true, forbidNonWhitelisted: true });
        expect(avecDevise).toHaveLength(1);
        expect(JSON.stringify(avecDevise)).toContain('devise');
    });
    it('la monnaie FONCTIONNELLE se pose, et seulement si le dossier la connaît', async () => {
        const capture = {};
        const s = service(capture, { id: 't1', devise: 'CDF' }, 12, ['USD']);
        await s.modifierCoordonnees('t1', { deviseFonctionnelle: 'usd' });
        expect(capture.data.deviseFonctionnelle).toBe('USD');
    });
    it('refuse une monnaie fonctionnelle que le dossier n’a jamais ouverte', async () => {
        const capture = {};
        const s = service(capture, { id: 't1', devise: 'CDF' }, 0, []);
        await expect(s.modifierCoordonnees('t1', { deviseFonctionnelle: 'EUR' })).rejects.toThrow(/n’est pas ouverte dans ce dossier/);
        expect(capture.data).toBeUndefined();
    });
    it('refuse le franc congolais comme monnaie fonctionnelle', async () => {
        const capture = {};
        const s = service(capture, { id: 't1', devise: 'CDF' }, 0, ['CDF']);
        await expect(s.modifierCoordonnees('t1', { deviseFonctionnelle: 'CDF' })).rejects.toThrow(/monnaie de tenue/);
    });
    it('la chaîne vide retire la monnaie fonctionnelle', async () => {
        const capture = {};
        const s = service(capture, { id: 't1', devise: 'CDF' }, 12, ['USD']);
        await s.modifierCoordonnees('t1', { deviseFonctionnelle: '' });
        expect(capture.data.deviseFonctionnelle).toBeNull();
    });
    it('le DTO refuse une raison sociale vide', async () => {
        const vide = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierCoordonneesDto, { nom: '' }));
        expect(vide).toHaveLength(1);
        const rempli = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierCoordonneesDto, { nom: 'A', adresse: '' }));
        expect(rempli).toHaveLength(0);
    });
    it('le système comptable est refusé hors SYSCOHADA et figé par la première écriture', async () => {
        const capture = {};
        const sycebnl = service(capture, { id: 't1', referentiel: client_1.Referentiel.SYCEBNL });
        await expect(sycebnl.modifierSystemeSyscohada('t1', client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE)).rejects.toThrow();
        const mouvemente = service(capture, {
            id: 't2',
            referentiel: client_1.Referentiel.SYSCOHADA,
            systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
        }, 5);
        await expect(mouvemente.modifierSystemeSyscohada('t2', client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE)).rejects.toThrow();
        expect(capture.data).toBeUndefined();
        const vierge = service(capture, {
            id: 't3',
            referentiel: client_1.Referentiel.SYSCOHADA,
            systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL,
        });
        await vierge.modifierSystemeSyscohada('t3', client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE);
        expect(capture.data.systemeComptableSyscohada).toBe(client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE);
    });
    it('le système d’une cellule ou d’un siège ne change pas · il est celui du groupe (audit final F172)', async () => {
        const base = { referentiel: client_1.Referentiel.SYSCOHADA, systemeComptableSyscohada: client_1.SystemeComptableSyscohada.NORMAL };
        const capture = {};
        const cellule = service(capture, { id: 't4', ...base, dossierMereId: 'siege' });
        await expect(cellule.modifierSystemeSyscohada('t4', client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE)).rejects.toThrow(/cellule · il tient le système comptable de son siège/);
        const siege = service(capture, { id: 't5', ...base, _count: { cellules: 2 } });
        await expect(siege.modifierSystemeSyscohada('t5', client_1.SystemeComptableSyscohada.MINIMAL_TRESORERIE)).rejects.toThrow(/siège de 2 cellule\(s\)/);
        expect(capture.data).toBeUndefined();
        await cellule.modifierSystemeSyscohada('t4', client_1.SystemeComptableSyscohada.NORMAL);
        expect(capture.data.systemeComptableSyscohada).toBe(client_1.SystemeComptableSyscohada.NORMAL);
    });
    it('la forme juridique OHADA est refusée à un dossier SYCEBNL', async () => {
        const capture = {};
        const asbl = service(capture, { id: 't1', referentiel: client_1.Referentiel.SYCEBNL });
        await expect(asbl.modifierFormeSyscohada('t1', client_1.FormeJuridiqueSyscohada.SOCIETE_ANONYME)).rejects.toThrow(/SYSCOHADA/);
        expect(capture.data).toBeUndefined();
    });
    it('la forme juridique de la loi n° 004/2001 est refusée à un dossier SYSCOHADA', async () => {
        const capture = {};
        const societe = service(capture, { id: 't2', referentiel: client_1.Referentiel.SYSCOHADA });
        await expect(societe.modifierFormeJuridique('t2', client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE)).rejects.toThrow(/SYCEBNL/);
        expect(capture.data).toBeUndefined();
        const asbl = service(capture, { id: 't1', referentiel: client_1.Referentiel.SYCEBNL });
        await asbl.modifierFormeJuridique('t1', client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE);
        expect(capture.data.formeJuridique).toBe(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE);
    });
    it('la forme juridique OHADA se pose et se corrige à tout moment sur un dossier SYSCOHADA', async () => {
        const capture = {};
        const societe = service(capture, { id: 't2', referentiel: client_1.Referentiel.SYSCOHADA }, 400);
        await societe.modifierFormeSyscohada('t2', client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
        expect(capture.data.formeJuridiqueSyscohada).toBe(client_1.FormeJuridiqueSyscohada.SOCIETE_RESPONSABILITE_LIMITEE);
    });
});
//# sourceMappingURL=coordonnees-dossier.spec.js.map