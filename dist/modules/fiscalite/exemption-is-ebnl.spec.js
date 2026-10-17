"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const referentiels_decorator_1 = require("../../common/decorators/referentiels.decorator");
const fiscalite_controller_1 = require("./fiscalite.controller");
const fiscalite_service_1 = require("./fiscalite.service");
const exemption_is_ebnl_1 = require("./exemption-is-ebnl");
const tenant = (options) => ({
    id: 't1',
    referentiel: options.referentiel ?? client_1.Referentiel.SYCEBNL,
    formeJuridique: options.forme === undefined ? client_1.FormeJuridiqueEbnl.ASSOCIATION : options.forme,
    droitEtranger: options.droitEtranger ?? false,
    actePersonnaliteJuridique: options.acte === undefined ? 'ARR/JUST/2024/117' : options.acte,
    attestationExemptionIs: options.attestation ?? null,
});
const service = (t) => new fiscalite_service_1.FiscaliteService({ tenant: { findUnique: async () => t } }, {});
describe("Fondement de l'exemption · art. 5, points 3, 4 et 5 de la loi n° 23/053", () => {
    it("range une association et une association confessionnelle au point 3, sans attestation", () => {
        for (const forme of [client_1.FormeJuridiqueEbnl.ASSOCIATION, client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE]) {
            const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme }));
            expect(q.fondement).toBe('ART_5_POINT_3');
            expect(q.attestationRequise).toBe(false);
            expect(q.exemptionAffirmable).toBe(true);
            expect(q.avertissements).toHaveLength(0);
        }
    });
    it("ne tranche pas pour une ONG, et sert les deux lectures du point 3 et du point 5", () => {
        const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE }));
        expect(q.fondement).toBe('ART_5_POINT_3_OU_POINT_5');
        expect(q.attestationRequise).toBe(true);
        expect(q.exemptionAffirmable).toBe(false);
        const dit = q.avertissements.join(' ');
        expect(dit).toMatch(/art\. 35/);
        expect(dit).toMatch(/conditions définies par voie réglementaire/);
        expect(dit).toMatch(/le logiciel ne la tranche pas/);
    });
    it("réserve le point 5 seul à un établissement d'utilité publique, qui n'est pas une ASBL", () => {
        const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE, acte: null }));
        expect(q.fondement).toBe('ART_5_POINT_5');
        expect(q.enonce).toMatch(/art\. 58/);
        const dit = q.avertissements.join(' ');
        expect(dit).not.toMatch(/point 4/);
        expect(dit).not.toMatch(/constituées conformément à la Loi/);
    });
    it("n'accorde aucun point de l'art. 5 à une unité de gestion de projet", () => {
        const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET }));
        expect(q.fondement).toBe('HORS_LOI_004_2001');
        expect(q.attestationRequise).toBeNull();
        expect(q.exemptionAffirmable).toBe(false);
        expect(q.avertissements.join(' ')).toMatch(/n'est pas une personne morale de la loi n° 004\/2001/);
    });
    it("ne qualifie rien quand la forme est « AUTRE » ou absente, et le dit", () => {
        for (const forme of [client_1.FormeJuridiqueEbnl.AUTRE, null]) {
            const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme }));
            expect(q.fondement).toBe('INDETERMINE');
            expect(q.attestationRequise).toBeNull();
            expect(q.exemptionAffirmable).toBe(false);
        }
    });
    it("distingue le point 4 du point 3 · il vise des PROFITS, et survit à l'acte manquant", () => {
        const avec = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ASSOCIATION }));
        const sans = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ASSOCIATION, acte: null }));
        expect(avec.avertissements.join(' ')).not.toMatch(/point 4/);
        expect(sans.exemptionAffirmable).toBe(false);
        expect(sans.avertissements.join(' ')).toMatch(/point 4/);
        expect(sans.avertissements.join(' ')).toMatch(/foires, des expositions, des réunions sportives/);
    });
});
describe("Attestation de l'art. 2 de l'arrêté n° 007/2025 · elle est enfin LUE", () => {
    it("signale à une ONG sans attestation que rien n'est acquis, et nomme les pièces à joindre", () => {
        const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE }));
        expect(q.attestationConnue).toBe(false);
        const dit = q.avertissements.join(' ');
        expect(dit).toMatch(/AUCUNE ATTESTATION N'EST ENREGISTRÉE/);
        expect(dit).toMatch(/acte d'enregistrement auprès du Ministère du secteur d'activité visé/);
    });
    it("change de discours quand l'attestation est enregistrée, sans pour autant la valider", () => {
        const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, attestation: 'DGI/AE/2026/0789' }));
        expect(q.attestationConnue).toBe(true);
        const dit = q.avertissements.join(' ');
        expect(dit).not.toMatch(/AUCUNE ATTESTATION N'EST ENREGISTRÉE/);
        expect(dit).toMatch(/Le logiciel ne la vérifie pas/);
        expect(q.exemptionAffirmable).toBe(false);
    });
    it("réclame à une ONG étrangère l'accord-cadre du Ministère du Plan, et ne le confond avec aucune autre pièce", () => {
        const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, droitEtranger: true }));
        const dit = q.avertissements.join(' ');
        expect(dit).toMatch(/accord-cadre conclu avec le Ministère du Plan/);
        expect(dit).toMatch(/certificat d'enregistrement du Ministère du Plan, qui est une autre pièce/);
        expect(dit).toMatch(/arrêté interministériel de l'art. 39, qui ouvre les exonérations/);
        expect(dit).toMatch(/ACCORD_CADRE_PLAN_ABSENT/);
    });
});
describe("Quatre conditions cumulatives de l'art. 3, et sanction de l'art. 5", () => {
    it("sert les quatre conditions et la gestion désintéressée à une ONG et à un EUP", () => {
        for (const forme of [
            client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE,
            client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE,
        ]) {
            const dit = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme })).avertissements.join(' ');
            expect(dit).toMatch(/but non lucratif/);
            expect(dit).toMatch(/gestion désintéressée/);
            expect(dit).toMatch(/doit être réinvesti dans le programme d'activités/);
            expect(dit).toMatch(/distorsion de concurrence/);
            expect(dit).toMatch(/comparables à celles versées pour des responsabilités similaires/);
            expect(dit).toMatch(/est dû » au titre de l'exercice concerné|dû au titre de l'exercice concerné/);
            expect(dit).toMatch(/OmegaX ne le liquide pas/);
        }
    });
    it("ne les sert PAS à une association du point 3, que l'arrêté ne vise pas", () => {
        const dit = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ASSOCIATION })).avertissements.join(' ');
        expect(dit).not.toMatch(/distorsion de concurrence/);
        expect(dit).not.toMatch(/attestation/);
    });
});
describe("Sanction de l'art. 5 de l'arrêté · servie seulement là où l'arrêté s'applique (C2)", () => {
    const brute = /OmegaX ne le liquide pas/;
    const conditionnelle = /se révèle être celle d'un établissement d'utilité publique ou d'une ONG/;
    it("sert la sanction brute si et seulement si l'arrêté s'applique, la conditionnelle au seul cas indéterminé", () => {
        const formes = [...Object.values(client_1.FormeJuridiqueEbnl), null];
        for (const forme of formes) {
            for (const droitEtranger of [false, true]) {
                for (const acte of ['ARR/JUST/2024/117', null]) {
                    const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme, droitEtranger, acte }));
                    const dit = q.avertissements.join(' ');
                    const arreteSApplique = q.fondement === 'ART_5_POINT_5' || q.attestationRequise === true;
                    expect({ forme, droitEtranger, acte, brute: brute.test(dit) }).toEqual({
                        forme,
                        droitEtranger,
                        acte,
                        brute: arreteSApplique,
                    });
                    expect({ forme, conditionnelle: conditionnelle.test(dit) }).toEqual({
                        forme,
                        conditionnelle: q.fondement === 'INDETERMINE',
                    });
                }
            }
        }
    });
    it("ne sert aucune sanction à une unité de gestion de projet, que l'arrêté ne vise pas", () => {
        const dit = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET })).avertissements.join(' ');
        expect(dit).toMatch(/À établir pièce en main/);
        expect(brute.test(dit) || conditionnelle.test(dit)).toBe(false);
    });
});
describe("Acte de personnalité juridique manquant, entité de droit étranger (C3)", () => {
    const art30 = /autorisation du Président de la République donnée par décret sur proposition du Ministre de la Justice » \(art\. 30\)/;
    const provisoire = /autorisation provisoire de fonctionnement » de six mois/;
    it("cite l'art. 30 à une ONG étrangère sans acte, nomme décret et ordonnance sans trancher, et tait l'autorisation provisoire", () => {
        const q = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, droitEtranger: true, acte: null }));
        const dit = q.avertissements.join(' ');
        expect(dit).toMatch(art30);
        expect(dit).toMatch(/\(art\. 34\)/);
        expect(dit).toMatch(/ordonnance présidentielle accordant la personnalité juridique » là où la loi parle d'un décret/);
        expect(dit).toMatch(/ne tranche pas entre les deux désignations/);
        expect(provisoire.test(dit)).toBe(false);
    });
    it("cite l'art. 30 et l'art. 31 à une association étrangère sans acte, et l'art. 32 à la confessionnelle", () => {
        const asso = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ASSOCIATION, droitEtranger: true, acte: null })).avertissements.join(' ');
        expect(asso).toMatch(art30);
        expect(asso).toMatch(/\(art\. 31\)/);
        expect(provisoire.test(asso)).toBe(false);
        const conf = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ASSOCIATION_CONFESSIONNELLE, droitEtranger: true, acte: null })).avertissements.join(' ');
        expect(conf).toMatch(art30);
        expect(conf).toMatch(/\(art\. 32\)/);
    });
    it("garde les art. 3 et 5 pour une association de droit congolais sans acte", () => {
        const dit = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ASSOCIATION, acte: null })).avertissements.join(' ');
        expect(dit).toMatch(provisoire);
        expect(art30.test(dit)).toBe(false);
    });
});
describe("Art. 3 de l'arrêté, point 4 · la clause finale est citée (C4)", () => {
    it("cite « condition limitée au public et à l'espace visés par l'objet de la structure »", () => {
        const dit = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE })).avertissements.join(' ');
        expect(dit).toMatch(/ne doit pas entraîner de distorsion de concurrence · condition limitée au public et à l'espace visés par l'objet de la structure\. »/);
    });
});
describe("Pièces d'une entité de droit étranger · ONG et EUP ne se confondent pas (C5)", () => {
    it("dit l'impossibilité de l'ONG étrangère comme une lecture des pièces de l'art. 2", () => {
        const dit = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE, droitEtranger: true })).avertissements.join(' ');
        expect(dit).toMatch(/parmi les pièces que l'ONG étrangère joint à sa demande d'attestation \(art\. 2\)\. Il s'ensuit/);
    });
    it("ne sert ni l'art. 37 ni les pièces de l'EUP de droit national à un EUP étranger, et dit que l'arrêté ne règle pas ce cas", async () => {
        const s = service(tenant({ forme: client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE, droitEtranger: true }));
        const r = await s.exemptionIs('t1');
        expect(r.droitEtranger).toBe(true);
        const dit = r.avertissements.join(' ');
        expect(dit).toMatch(/L'arrêté ne règle pas le cas d'un établissement d'utilité publique de droit étranger/);
        expect(dit).toMatch(/Pièces à joindre à la demande : non fixées par l'arrêté pour un établissement de droit étranger/);
        expect(/La loi n° 004\/2001, art\. 37/.test(dit)).toBe(false);
        expect(/Pièces à joindre à la demande : arrêté du Ministre ayant la Justice/.test(dit)).toBe(false);
    });
    it("garde les pièces de l'EUP de droit national à un EUP congolais", () => {
        const dit = (0, exemption_is_ebnl_1.qualifierExemptionIs)(tenant({ forme: client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE })).avertissements.join(' ');
        expect(dit).toMatch(/Pièces à joindre à la demande : arrêté du Ministre ayant la Justice/);
    });
});
describe("Le refus du module fiscal n'affirme plus un droit qu'il ne vérifie pas", () => {
    it("affirme l'exemption à une association constituée conformément à la Loi, et à elle seule", async () => {
        const s = service(tenant({ forme: client_1.FormeJuridiqueEbnl.ASSOCIATION }));
        await expect(s.resultatFiscal('t1', 'N')).rejects.toThrow(/art\. 5, point 3/);
        await expect(s.resultatFiscal('t1', 'N')).rejects.toThrow(/SYSCOHADA/);
    });
    it("ne l'affirme pas à une ONG · le point 5 renvoie au règlement", async () => {
        const s = service(tenant({ forme: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE }));
        await expect(s.resultatFiscal('t1', 'N')).rejects.toThrow(/n'est pas acquise du seul fait du référentiel/);
        await expect(s.resultatFiscal('t1', 'N')).rejects.toThrow(/007\/2025/);
    });
    it("ne l'affirme pas à un établissement d'utilité publique", async () => {
        const s = service(tenant({ forme: client_1.FormeJuridiqueEbnl.ETABLISSEMENT_UTILITE_PUBLIQUE }));
        await expect(s.resultatFiscal('t1', 'N')).rejects.toThrow(/relève du seul point 5/);
    });
    it("ne l'affirme pas à une unité de gestion de projet", async () => {
        const s = service(tenant({ forme: client_1.FormeJuridiqueEbnl.UNITE_GESTION_PROJET }));
        await expect(s.resultatFiscal('t1', 'N')).rejects.toThrow(/hors du champ de la loi n° 004\/2001/);
    });
});
describe("La route ouverte au SYCEBNL · avertir, jamais calculer", () => {
    it("sert la qualification et les avertissements d'une ONG, sans aucun montant", async () => {
        const s = service(tenant({ forme: client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE }));
        const r = await s.exemptionIs('t1');
        expect(r.fondement).toBe('ART_5_POINT_3_OU_POINT_5');
        expect(r.formeJuridique).toBe(client_1.FormeJuridiqueEbnl.ORGANISATION_NON_GOUVERNEMENTALE);
        expect(r.avertissements.length).toBeGreaterThanOrEqual(5);
        expect(Object.keys(r)).not.toContain('impotDu');
    });
    it("refuse un dossier SYSCOHADA · l'art. 5 de la loi n° 23/053 ne le concerne pas", async () => {
        const s = service(tenant({ referentiel: client_1.Referentiel.SYSCOHADA }));
        await expect(s.exemptionIs('t1')).rejects.toThrow(/SYCEBNL/);
    });
    it("est ouverte au SYCEBNL par un décorateur de méthode, qui l'emporte sur la classe", () => {
        const surLaMethode = Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, fiscalite_controller_1.FiscaliteController.prototype.exemptionIs);
        expect(surLaMethode).toEqual([client_1.Referentiel.SYCEBNL]);
        expect(Reflect.getMetadata(referentiels_decorator_1.REFERENTIELS_KEY, fiscalite_controller_1.FiscaliteController)).toEqual([client_1.Referentiel.SYSCOHADA]);
    });
});
//# sourceMappingURL=exemption-is-ebnl.spec.js.map