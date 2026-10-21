"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.referentielDuDossier = referentielDuDossier;
exports.compteDeLEcart = compteDeLEcart;
const common_1 = require("@nestjs/common");
const ecart_change_realise_1 = require("./ecart-change-realise");
async function referentielDuDossier(prisma, tenantId) {
    const t = await prisma.tenant.findFirst({ where: { id: tenantId }, select: { referentiel: true } });
    if (!t)
        throw new common_1.NotFoundException('Dossier introuvable.');
    return t.referentiel;
}
function motifInutilisable(c) {
    if (c.typeCompte !== 'DETAIL')
        return `Le compte ${c.numero} est un compte de regroupement · choisissez un compte de détail.`;
    if (!c.estActif)
        return `Le compte ${c.numero} est en sommeil · réactivez-le dans Plan comptable, ou choisissez un autre compte.`;
    return null;
}
async function compteDeLEcart(prisma, p) {
    if (p.choisiId) {
        const c = await prisma.compte.findFirst({
            where: { id: p.choisiId, tenantId: p.tenantId },
            select: { id: true, numero: true, typeCompte: true, estActif: true },
        });
        if (!c)
            throw new common_1.NotFoundException("Compte d'écart de change introuvable pour ce dossier.");
        const inutilisable = motifInutilisable(c);
        if (inutilisable)
            throw new common_1.BadRequestException(inutilisable);
        const motif = (0, ecart_change_realise_1.motifRefusCompteEcart)({ referentiel: p.referentiel, nature: p.nature, ecart: p.ecart, numero: c.numero });
        if (motif)
            throw new common_1.BadRequestException(motif);
        return { id: c.id, numero: c.numero };
    }
    const prescrits = (0, ecart_change_realise_1.comptesPrescrits)(p.referentiel, p.nature);
    if (prescrits.perte === null)
        throw new common_1.BadRequestException(prescrits.motif);
    const numero = p.ecart === 'PERTE' ? prescrits.perte : prescrits.gain;
    const c = await prisma.compte.findFirst({
        where: { tenantId: p.tenantId, numero },
        select: { id: true, numero: true, typeCompte: true, estActif: true },
    });
    const inutilisable = c ? motifInutilisable(c) : `Le compte ${numero} que le texte donne pour cet écart de change n'est pas ouvert dans le plan du dossier.`;
    if (c && !inutilisable)
        return { id: c.id, numero: c.numero };
    const racine = (0, ecart_change_realise_1.racineDuPrescrit)(numero);
    const sousComptes = await prisma.compte.findMany({
        where: { tenantId: p.tenantId, numero: { startsWith: racine }, typeCompte: 'DETAIL', estActif: true },
        select: { numero: true },
        orderBy: { numero: 'asc' },
        take: 20,
    });
    throw new common_1.BadRequestException(`${inutilisable} ` +
        (sousComptes.length > 0
            ? `Choisissez le compte d'écart parmi ses sous-comptes · ${sousComptes.map((x) => x.numero).join(', ')}.`
            : `Ouvrez-le, ou un sous-compte du ${racine}, dans Plan comptable.`));
}
//# sourceMappingURL=compte-ecart-change.js.map