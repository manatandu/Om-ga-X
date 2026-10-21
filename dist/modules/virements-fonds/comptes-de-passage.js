"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assurerComptesDePassage = assurerComptesDePassage;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const subdivisions_du_plan_1 = require("../comptes/subdivisions-du-plan");
const virement_fonds_1 = require("./virement-fonds");
async function assurerComptesDePassage(client, tenantId) {
    const liens = await client.compteVirementFonds.findMany({
        where: { tenantId },
        select: { sens: true, compte: { select: { id: true, numero: true, intitule: true } } },
    });
    const tenus = new Map(liens.map((l) => [l.sens, l.compte]));
    const manquants = Object.keys(virement_fonds_1.COMPTES_DE_PASSAGE).filter((s) => !tenus.has(s));
    if (manquants.length > 0) {
        const [dossier, parent] = await Promise.all([
            client.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { referentiel: true, longueurCompte: true } }),
            client.compte.findUnique({
                where: { tenantId_numero: { tenantId, numero: virement_fonds_1.COMPTE_DU_PLAN_585 } },
                select: { lettrable: true, modeReportANouveau: true },
            }),
        ]);
        if (!parent) {
            throw new common_1.BadRequestException(`Le compte ${virement_fonds_1.COMPTE_DU_PLAN_585} « Virements de fonds » manque au plan de ce dossier · ouvrez-le dans Plan comptable, ` +
                'les comptes de passage des virements naissent sous lui.');
        }
        for (const sens of manquants) {
            const existants = (await client.compte.findMany({ where: { tenantId, numero: { startsWith: '585' } }, select: { numero: true } })).map((c) => c.numero);
            const auRang = `5850000${virement_fonds_1.COMPTES_DE_PASSAGE[sens].rang}`;
            const numero = existants.includes(auRang)
                ? (0, subdivisions_du_plan_1.sousComptePropose)(dossier.referentiel, virement_fonds_1.COMPTE_DU_PLAN_585, Math.max(8, dossier.longueurCompte), existants)
                : auRang;
            if (!numero) {
                throw new common_1.BadRequestException(`Plus aucun numéro libre sous le ${virement_fonds_1.COMPTE_DU_PLAN_585} · allongez les numéros de compte (Structure > Paramètres du dossier).`);
            }
            const compte = await client.compte.create({
                data: {
                    tenantId,
                    numero,
                    intitule: virement_fonds_1.COMPTES_DE_PASSAGE[sens].intitule,
                    classe: client_1.ClasseCompte.CLASSE_5,
                    typeCompte: client_1.TypeCompteDetailTotal.DETAIL,
                    estRetenu: true,
                    lettrable: parent.lettrable,
                    modeReportANouveau: parent.modeReportANouveau,
                },
                select: { id: true, numero: true, intitule: true },
            });
            await client.compteVirementFonds.create({ data: { tenantId, sens, compteId: compte.id } });
            tenus.set(sens, compte);
        }
    }
    return Object.fromEntries([...tenus.entries()]);
}
//# sourceMappingURL=comptes-de-passage.js.map