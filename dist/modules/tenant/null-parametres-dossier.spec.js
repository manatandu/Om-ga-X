"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const parametres_dossier_dto_1 = require("./dto/parametres-dossier.dto");
const tenant_service_1 = require("./tenant.service");
async function refusDuPipe(metatype, corps) {
    const pipe = new common_1.ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
    try {
        await pipe.transform(corps, { type: 'body', metatype, data: undefined });
        return null;
    }
    catch (e) {
        if (e instanceof common_1.BadRequestException)
            return e;
        throw e;
    }
}
function motifsDu(refus) {
    if (!refus)
        return [];
    const reponse = refus.getResponse();
    return Array.isArray(reponse.message) ? reponse.message : [String(reponse.message)];
}
describe('null refusé en 400 nommé · colonnes qui ne l’admettent pas', () => {
    const cas = [
        ['coordonnées · raison sociale', parametres_dossier_dto_1.ModifierCoordonneesDto, 'nom', /raison sociale ne s'efface pas/],
        ['coordonnées · capital variable', parametres_dossier_dto_1.ModifierCoordonneesDto, 'capitalVariable', /capital variable » se répond par true ou false/],
        ['régime · assujetti à la TVA', parametres_dossier_dto_1.ModifierRegimeDto, 'assujettiTva', /PAS_ENCORE_DIT, jamais null/],
        ['régime · réponse sur la TVA', parametres_dossier_dto_1.ModifierRegimeDto, 'reponseAssujettissementTva', /OUI, NON ou PAS_ENCORE_DIT/],
        ['régime · vente de biens ou de services', parametres_dossier_dto_1.ModifierRegimeDto, 'venteBiensServices', /OUI, NON ou PAS_ENCORE_DIT/],
        ['régime · effectif permanent', parametres_dossier_dto_1.ModifierRegimeDto, 'effectifPermanent', /zéro compris · null n'en est pas un/],
        ['régime · exigibilité de la TVA', parametres_dossier_dto_1.ModifierRegimeDto, 'regimeExigibiliteTva', /null n'en est pas une/],
        ['forme juridique · droit étranger', parametres_dossier_dto_1.ModifierFormeJuridiqueDto, 'droitEtranger', /Le droit étranger se répond par true ou false/],
    ];
    for (const [libelle, dto, champ, motif] of cas) {
        it(`${libelle} · 400 avec son motif, jamais 500`, async () => {
            const corps = { [champ]: null };
            if (dto === parametres_dossier_dto_1.ModifierFormeJuridiqueDto)
                corps.formeJuridique = 'ASSOCIATION';
            const refus = await refusDuPipe(dto, corps);
            expect(refus).not.toBeNull();
            expect(refus.getStatus()).toBe(400);
            expect(motifsDu(refus).some((m) => motif.test(m))).toBe(true);
        });
    }
    it('omis, ces champs passent · l’absence reste « inchangé »', async () => {
        expect(await refusDuPipe(parametres_dossier_dto_1.ModifierCoordonneesDto, {})).toBeNull();
        expect(await refusDuPipe(parametres_dossier_dto_1.ModifierRegimeDto, {})).toBeNull();
        expect(await refusDuPipe(parametres_dossier_dto_1.ModifierFormeJuridiqueDto, { formeJuridique: 'ASSOCIATION' })).toBeNull();
    });
    it('une valeur explicite passe, zéro et false compris', async () => {
        expect(await refusDuPipe(parametres_dossier_dto_1.ModifierRegimeDto, {
            assujettiTva: false,
            effectifPermanent: 0,
            reponseAssujettissementTva: 'PAS_ENCORE_DIT',
            venteBiensServices: 'NON',
            regimeExigibiliteTva: 'LIVRAISONS',
        })).toBeNull();
        expect(await refusDuPipe(parametres_dossier_dto_1.ModifierCoordonneesDto, { nom: 'Entité', capitalVariable: false })).toBeNull();
    });
});
describe('null lu comme un effacement · colonnes qui l’admettent', () => {
    const CHAMPS_TEXTE = ['activite', 'adresse', 'ville', 'pays', 'telephone', 'email', 'siteWeb'];
    it('la validation laisse passer null sur les coordonnées effaçables et le numéro CNSS', async () => {
        const coordonnees = Object.fromEntries([...CHAMPS_TEXTE, 'deviseFonctionnelle'].map((c) => [c, null]));
        expect(await refusDuPipe(parametres_dossier_dto_1.ModifierCoordonneesDto, coordonnees)).toBeNull();
        expect(await refusDuPipe(parametres_dossier_dto_1.ModifierRegimeDto, { numeroAffiliationCnssEmployeur: null })).toBeNull();
    });
    const monter = () => {
        const ecritures = [];
        const lecturesDevise = [];
        const prisma = {
            tenant: {
                findUnique: async ({ where }) => where.id === 't1' ? { id: 't1', referentiel: client_1.Referentiel.SYSCOHADA, formeJuridiqueSyscohada: null } : null,
                update: async (args) => {
                    ecritures.push(args);
                    return { id: 't1' };
                },
            },
            devise: {
                findFirst: async ({ where }) => {
                    lecturesDevise.push(where);
                    return where.tenantId === 't1' && where.code === 'USD' && where.estActive === true ? { id: 'd1' } : null;
                },
            },
        };
        const s = new tenant_service_1.TenantService(prisma);
        s.parametres = async () => null;
        return { s, ecritures, lecturesDevise };
    };
    it('coordonnées · null écrit null sur chaque champ texte, jamais un 500', async () => {
        const { s, ecritures } = monter();
        await s.modifierCoordonnees('t1', Object.fromEntries(CHAMPS_TEXTE.map((c) => [c, null])));
        expect(ecritures).toHaveLength(1);
        expect(ecritures[0].where).toEqual({ id: 't1' });
        for (const c of CHAMPS_TEXTE)
            expect({ c, v: ecritures[0].data[c] }).toEqual({ c, v: null });
    });
    it('coordonnées · la monnaie fonctionnelle à null est retirée, plus ignorée en silence', async () => {
        const { s, ecritures, lecturesDevise } = monter();
        await s.modifierCoordonnees('t1', { deviseFonctionnelle: null });
        expect(ecritures[0].data.deviseFonctionnelle).toBeNull();
        expect(lecturesDevise).toHaveLength(0);
    });
    it('coordonnées · un champ omis n’est pas touché, une valeur est posée', async () => {
        const { s, ecritures } = monter();
        await s.modifierCoordonnees('t1', { ville: ' Kinshasa ', deviseFonctionnelle: 'usd' });
        expect(ecritures[0].data.ville).toBe('Kinshasa');
        expect(ecritures[0].data.deviseFonctionnelle).toBe('USD');
        expect(ecritures[0].data.adresse).toBeUndefined();
    });
    it('régime · le numéro CNSS à null est effacé, la chaîne vide aussi', async () => {
        const { s, ecritures } = monter();
        await s.modifierRegime('t1', { numeroAffiliationCnssEmployeur: null });
        expect(ecritures[0].data.numeroAffiliationCnssEmployeur).toBeNull();
        await s.modifierRegime('t1', { numeroAffiliationCnssEmployeur: '  ' });
        expect(ecritures[1].data.numeroAffiliationCnssEmployeur).toBeNull();
        await s.modifierRegime('t1', { numeroAffiliationCnssEmployeur: ' 123/A ' });
        expect(ecritures[2].data.numeroAffiliationCnssEmployeur).toBe('123/A');
    });
    it('un autre dossier est introuvable, rien n’est écrit', async () => {
        const { s, ecritures } = monter();
        await expect(s.modifierCoordonnees('t2', { ville: null })).rejects.toThrow('Dossier introuvable');
        expect(ecritures).toHaveLength(0);
    });
});
//# sourceMappingURL=null-parametres-dossier.spec.js.map