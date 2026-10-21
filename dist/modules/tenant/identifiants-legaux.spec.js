"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const tenant_service_1 = require("./tenant.service");
const parametres_dossier_dto_1 = require("./dto/parametres-dossier.dto");
describe('Identifiants légaux du dossier', () => {
    const tenant = { id: 't1' };
    const service = (capture) => new tenant_service_1.TenantService({
        tenant: {
            findUnique: async () => tenant,
            update: async ({ data }) => {
                capture.data = data;
                return tenant;
            },
        },
        ecriture: { count: async () => 0 },
        compte: { findMany: async () => [] },
    });
    it('la chaîne vide EFFACE l’identifiant, l’absence de champ n’y touche pas', async () => {
        const capture = {};
        const s = service(capture);
        await s.modifierIdentite('t1', { numeroImpot: '  A1234567B  ', idNat: '' });
        expect(capture.data.numeroImpot).toBe('A1234567B');
        expect(capture.data.idNat).toBeNull();
        expect(capture.data.rccm).toBeUndefined();
        expect(capture.data.actePersonnaliteJuridique).toBeUndefined();
    });
    it('la date de l’acte s’efface par une chaîne vide et se pose par une date ISO', async () => {
        const capture = {};
        const s = service(capture);
        await s.modifierIdentite('t1', { dateActePersonnalite: '' });
        expect(capture.data.dateActePersonnalite).toBeNull();
        await s.modifierIdentite('t1', { dateActePersonnalite: '2024-06-12' });
        expect(capture.data.dateActePersonnalite.toISOString().slice(0, 10)).toBe('2024-06-12');
    });
    it('la validation accepte la date vide · sans quoi l’effacement serait refusé', async () => {
        const vide = (0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierIdentiteDto, { dateActePersonnalite: '' });
        expect(await (0, class_validator_1.validate)(vide)).toHaveLength(0);
        const bonne = (0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierIdentiteDto, { dateActePersonnalite: '2024-06-12' });
        expect(await (0, class_validator_1.validate)(bonne)).toHaveLength(0);
        const mauvaise = (0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierIdentiteDto, { dateActePersonnalite: '12 juin' });
        expect(await (0, class_validator_1.validate)(mauvaise)).not.toHaveLength(0);
    });
    it('l’acte de personnalité juridique tient 120 caractères · un numéro d’arrêté est long', async () => {
        const long = (0, class_transformer_1.plainToInstance)(parametres_dossier_dto_1.ModifierIdentiteDto, {
            actePersonnaliteJuridique: 'Arrêté ministériel n° 087/CAB/MIN/J&GS/2024 du 12 juin 2024 portant octroi de la personnalité juridique',
        });
        expect(await (0, class_validator_1.validate)(long)).toHaveLength(0);
    });
});
//# sourceMappingURL=identifiants-legaux.spec.js.map