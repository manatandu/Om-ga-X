"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const client_1 = require("@prisma/client");
const tenant_service_1 = require("./tenant.service");
const parametres_dossier_dto_1 = require("./dto/parametres-dossier.dto");
const code_activite_principale_1 = require("./code-activite-principale");
describe('Code activité principale · règle', () => {
    it('six chiffres, les espaces de lecture retirés ; la chaîne vide et null effacent', () => {
        expect((0, code_activite_principale_1.normaliserCodeActivite)(' 031 003 ')).toBe('031003');
        expect((0, code_activite_principale_1.normaliserCodeActivite)('')).toBeNull();
        expect((0, code_activite_principale_1.normaliserCodeActivite)(null)).toBeNull();
        expect((0, code_activite_principale_1.normaliserCodeActivite)(undefined)).toBeUndefined();
    });
    it('refuse un dossier SYCEBNL et un format autre que six chiffres, jamais un effacement', () => {
        expect((0, code_activite_principale_1.motifRefusCodeActivite)(client_1.Referentiel.SYCEBNL, '031003')).toBe(code_activite_principale_1.MOTIF_CODE_ACTIVITE_SYCEBNL);
        expect((0, code_activite_principale_1.motifRefusCodeActivite)(client_1.Referentiel.SYSCOHADA, '31003')).toBe(code_activite_principale_1.MOTIF_CODE_ACTIVITE_FORMAT);
        expect((0, code_activite_principale_1.motifRefusCodeActivite)(client_1.Referentiel.SYSCOHADA, 'A01020')).toBe(code_activite_principale_1.MOTIF_CODE_ACTIVITE_FORMAT);
        expect((0, code_activite_principale_1.motifRefusCodeActivite)(client_1.Referentiel.SYSCOHADA, '031003')).toBeNull();
        expect((0, code_activite_principale_1.motifRefusCodeActivite)(client_1.Referentiel.SYCEBNL, null)).toBeNull();
    });
    it('un groupe hors des 44 est AVERTI, un groupe de la NOTE 36 ne l’est pas', () => {
        expect((0, code_activite_principale_1.avertissementCodeActivite)('044000')).toBeNull();
        expect((0, code_activite_principale_1.avertissementCodeActivite)('001001')).toBeNull();
        expect((0, code_activite_principale_1.avertissementCodeActivite)('045001')).toContain('045');
        expect((0, code_activite_principale_1.avertissementCodeActivite)('000001')).toContain('000');
        expect((0, code_activite_principale_1.avertissementCodeActivite)(null)).toBeNull();
    });
});
describe('Code activité principale · route des coordonnées', () => {
    const service = (capture, tenant) => new tenant_service_1.TenantService({
        tenant: {
            findUnique: async () => ({ dossierMereId: null, _count: { cellules: 0 }, ...tenant }),
            update: async ({ data }) => {
                capture.data = data;
                Object.assign(tenant, data);
                return tenant;
            },
        },
        ecriture: { count: async () => 0 },
        compte: { findMany: async () => [] },
        devise: { findFirst: async () => null },
    });
    it('le DTO admet le champ, null compris', async () => {
        const erreurs = await (0, class_validator_1.validate)((0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierCoordonneesDto, { codeActivitePrincipale: null }), {
            whitelist: true,
            forbidNonWhitelisted: true,
        });
        expect(erreurs).toHaveLength(0);
    });
    it('SYSCOHADA · enregistré normalisé, et les 44 groupes sont servis', async () => {
        const capture = {};
        const tenant = { id: 't1', referentiel: client_1.Referentiel.SYSCOHADA, codeActivitePrincipale: null };
        const p = (await service(capture, tenant).modifierCoordonnees('t1', { codeActivitePrincipale: '031 003' }));
        expect(capture.data.codeActivitePrincipale).toBe('031003');
        expect(p.codeActivitePrincipale).toBe('031003');
        expect(p.avertissementCodeActivitePrincipale).toBeNull();
        expect(p.groupesActivites.length).toBe(44);
    });
    it('SYSCOHADA · un groupe hors liste est enregistré ET averti', async () => {
        const capture = {};
        const tenant = { id: 't1', referentiel: client_1.Referentiel.SYSCOHADA, codeActivitePrincipale: null };
        const p = (await service(capture, tenant).modifierCoordonnees('t1', { codeActivitePrincipale: '099001' }));
        expect(capture.data.codeActivitePrincipale).toBe('099001');
        expect(String(p.avertissementCodeActivitePrincipale)).toContain('099');
    });
    it('SYSCOHADA · un format faux est refusé en 400 nommé, rien n’est écrit', async () => {
        const capture = {};
        const tenant = { id: 't1', referentiel: client_1.Referentiel.SYSCOHADA };
        await expect(service(capture, tenant).modifierCoordonnees('t1', { codeActivitePrincipale: '3100' })).rejects.toThrow(code_activite_principale_1.MOTIF_CODE_ACTIVITE_FORMAT);
        expect(capture.data).toBeUndefined();
    });
    it('SYCEBNL · refusé en 400 nommé, mais l’effacement passe, et aucun groupe n’est servi', async () => {
        const capture = {};
        const tenant = { id: 't1', referentiel: client_1.Referentiel.SYCEBNL, codeActivitePrincipale: '031003' };
        await expect(service(capture, tenant).modifierCoordonnees('t1', { codeActivitePrincipale: '031003' })).rejects.toThrow(code_activite_principale_1.MOTIF_CODE_ACTIVITE_SYCEBNL);
        expect(capture.data).toBeUndefined();
        const p = (await service(capture, tenant).modifierCoordonnees('t1', { codeActivitePrincipale: null }));
        expect(capture.data.codeActivitePrincipale).toBeNull();
        expect(p.groupesActivites).toEqual([]);
    });
    it('un appel qui ne porte pas le champ n’y touche pas', async () => {
        const capture = {};
        await service(capture, { id: 't1', referentiel: client_1.Referentiel.SYCEBNL }).modifierCoordonnees('t1', { ville: 'Goma' });
        expect(capture.data.codeActivitePrincipale).toBeUndefined();
    });
});
//# sourceMappingURL=code-activite-principale.spec.js.map