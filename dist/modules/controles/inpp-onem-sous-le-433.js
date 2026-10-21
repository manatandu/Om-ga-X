"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estCompteAncienInppOnem = exports.RACINES_ANCIENNES_INPP_ONEM = void 0;
exports.anomalieInppOnemSousLe433 = anomalieInppOnemSousLe433;
exports.RACINES_ANCIENNES_INPP_ONEM = ['4334', '4335'];
const estCompteAncienInppOnem = (numero) => exports.RACINES_ANCIENNES_INPP_ONEM.some((r) => numero.startsWith(r));
exports.estCompteAncienInppOnem = estCompteAncienInppOnem;
function anomalieInppOnemSousLe433(comptes, exerciceClos) {
    const occurrences = [];
    for (const c of [...comptes].sort((a, b) => a.numero.localeCompare(b.numero))) {
        const reference = `${c.numero} ${c.intitule}`;
        const mouvementeIci = c.lignesSaisiesExercice + c.lignesReportExercice > 0;
        const montant = Math.round(c.soldeCrediteurExercice * 100) / 100;
        if (mouvementeIci && exerciceClos) {
            occurrences.push({
                reference,
                detail: "Exercice clôturé · rien n'y est réimputé ni corrigé. Le solde reporté s'apure dans l'exercice ouvert qui suit, à son paiement, sur ce même compte.",
                montant,
            });
            continue;
        }
        if (c.lignesSaisiesExercice > 0) {
            occurrences.push({
                reference,
                detail: `${c.lignesSaisiesExercice} ligne(s) saisie(s) dans cet exercice · à réimputer vers le 44280000 « Autres impôts et taxes » ` +
                    '(Recherche d’écritures filtrée sur ce compte, puis Réimputer). Validées, elles sont inscrites en négatif sur ce compte et reprises au 4428.',
                montant,
            });
            continue;
        }
        if (c.lignesReportExercice > 0) {
            occurrences.push({
                reference,
                detail: "Seul le report à-nouveau mouvemente ce compte dans cet exercice · une écriture de report ne se réimpute pas. Le solde s'apure à son paiement, sur ce même compte ; les dettes suivantes vont au 44280000.",
                montant,
            });
            continue;
        }
        if (c.lignesTotal === 0 && c.estActif) {
            occurrences.push({
                reference,
                detail: 'Jamais mouvementé · mettez-le en sommeil (Plan comptable) pour qu’aucune saisie ne le choisisse plus.',
            });
        }
    }
    if (occurrences.length === 0)
        return null;
    return {
        code: 'INPP_ONEM_SOUS_LE_433',
        gravite: 'INFORMATION',
        libelle: 'INPP ou ONEM sur un compte 433 semé avant la décision du 7 octobre 2026',
        consequence: "L'INPP et l'ONEM sont des impôts et taxes · la fiche du compte 64 des deux textes les débite par le crédit du compte 44, et la fiche du compte 66 " +
            "exclut les impôts assis sur la rémunération. Leur dette va au 44280000 « Autres impôts et taxes », leur charge au 64150000 (INPP) et au 64130000 " +
            "(ONEM). Le solde porté au 4334 ou au 4335 est juste, seule la nature du compte l'est moins · le registre des retenues continue de le lire.",
        action: "Dans un exercice ouvert, réimputez les lignes saisies vers le 44280000, et reclassez par une écriture d'opérations diverses la charge passée au " +
            '66410000 vers le 64150000 et le 64130000. Dans un exercice clôturé, rien ne se touche. Un compte que rien ne mouvemente plus se met en sommeil, ' +
            "jamais ne se supprime s'il a été mouvementé.",
        occurrences,
    };
}
//# sourceMappingURL=inpp-onem-sous-le-433.js.map