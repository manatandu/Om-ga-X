"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tenant_service_1 = require("./tenant.service");
const DOSSIER = {
    id: 't1',
    nom: 'Dossier',
    jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS',
    systemeComptableSyscohada: null,
    activite: null,
    adresse: null,
    ville: null,
    pays: null,
    telephone: null,
    devise: 'CDF',
    numeroImpot: null,
    idNat: null,
    rccm: null,
    actePersonnaliteJuridique: null,
    dateActePersonnalite: null,
    numeroEnregistrementSecteur: null,
    certificatEnregistrementPlan: null,
    attestationExemptionIs: null,
    formeJuridique: 'ASSOCIATION',
    formeJuridiqueSyscohada: null,
    droitEtranger: false,
    longueurCompte: 8,
    assujettiTva: false,
    dateOptionTva: null,
    regimeExigibiliteTva: null,
    dateAutorisationDebitsTva: null,
    effectifPermanent: null,
};
function service(referentiel, surcharge = {}) {
    const prisma = {
        tenant: { findUnique: jest.fn().mockResolvedValue({ ...DOSSIER, referentiel, ...surcharge }) },
        ecriture: { count: jest.fn().mockResolvedValue(0) },
        compte: { findMany: jest.fn().mockResolvedValue([]) },
    };
    return new tenant_service_1.TenantService(prisma);
}
describe('Paramètres du dossier · les champs propres au SYCEBNL', () => {
    it('ne sert AUCUN champ SYCEBNL à un dossier SYSCOHADA', async () => {
        const p = await service('SYSCOHADA').parametres('t1');
        expect(p.jeuEtatsFinanciersSycebnl).toBeNull();
        expect(p.formeJuridique).toBeNull();
        expect(p.droitEtranger).toBeNull();
    });
    it('sert ces mêmes champs à un dossier SYCEBNL', async () => {
        const p = await service('SYCEBNL', {
            jeuEtatsFinanciersSycebnl: 'PROJETS_DEVELOPPEMENT',
            formeJuridique: 'ORGANISATION_NON_GOUVERNEMENTALE',
            droitEtranger: true,
        }).parametres('t1');
        expect(p.jeuEtatsFinanciersSycebnl).toBe('PROJETS_DEVELOPPEMENT');
        expect(p.formeJuridique).toBe('ORGANISATION_NON_GOUVERNEMENTALE');
        expect(p.droitEtranger).toBe(true);
    });
    it('sert `false` et non `null` à un dossier SYCEBNL de droit congolais', async () => {
        const p = await service('SYCEBNL', { droitEtranger: false }).parametres('t1');
        expect(p.droitEtranger).toBe(false);
    });
    it('laisse intacts les champs communs aux deux référentiels', async () => {
        const p = await service('SYSCOHADA', { numeroImpot: 'A1234567X', rccm: 'CD/KIN/RCCM/22-B-01' }).parametres('t1');
        expect(p.devise).toBe('CDF');
        expect(p.numeroImpot).toBe('A1234567X');
        expect(p.rccm).toBe('CD/KIN/RCCM/22-B-01');
        expect(p.longueurCompte).toBe(8);
    });
});
//# sourceMappingURL=reponse-referentiel.spec.js.map