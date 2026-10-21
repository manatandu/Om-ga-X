"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.effectifDuRegistre = effectifDuRegistre;
const client_1 = require("@prisma/client");
async function effectifDuRegistre(prisma, tenantId, ala) {
    const enVigueur = {
        tenantId,
        dateEntreeEnVigueur: { lte: ala },
        OR: [{ dateFin: null }, { dateFin: { gte: ala } }],
    };
    const [groupes, permanents] = await Promise.all([
        prisma.salarie.groupBy({
            by: ['sexe', 'nationalite'],
            where: { tenantId, contrats: { some: enVigueur } },
            _count: { _all: true },
        }),
        prisma.salarie.count({
            where: { tenantId, contrats: { some: { ...enVigueur, type: client_1.TypeContratTravail.DUREE_INDETERMINEE } } },
        }),
    ]);
    const nationalite = (n) => (n ?? '').trim().toLowerCase();
    const estCongolaise = (n) => ['congolaise', 'congolais', 'rdc', 'rd congo'].includes(nationalite(n));
    const somme = (garder) => groupes.filter(garder).reduce((total, g) => total + g._count._all, 0);
    const effectif = somme(() => true);
    const nationaux = somme((g) => estCongolaise(g.nationalite));
    const sansNationalite = somme((g) => nationalite(g.nationalite) === '');
    return {
        ala,
        effectif,
        hommes: somme((g) => g.sexe === 'MASCULIN'),
        femmes: somme((g) => g.sexe === 'FEMININ'),
        permanents,
        nationaux,
        sansNationalite,
        partMainOeuvreNationale: effectif === 0 || sansNationalite > 0 ? null : (nationaux / effectif) * 100,
        source: `Registre du personnel au ${ala.toISOString().slice(0, 10)}`,
        reserve: sansNationalite > 0
            ? `${sansNationalite} salarié(s) de l'effectif n'ont pas de nationalité au registre. La part de main-d'œuvre locale (art. 37, 4° de la loi n° 004/2001) n'est pas calculée : un pourcentage tiré d'un registre incomplet serait faux sous une apparence de calcul, et c'est l'engagement des 60 % de cet article qu'il servirait.`
            : null,
    };
}
//# sourceMappingURL=effectif-registre.js.map