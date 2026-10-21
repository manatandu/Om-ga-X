"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const service = (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, 'ecriture.service.ts'), 'utf8');
const page = ['pages/BalanceAgeePage.tsx', 'components/TableauBalanceAgee.tsx']
    .map((f) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(__dirname, '..', '..', '..', 'client', 'src', f), 'utf8'))
    .join('\n');
describe('balance âgée · le modèle du dossier de révision', () => {
    it('la page rend la grille du composant qu’on relit avec elle', () => {
        expect(page).toContain('<TableauBalanceAgee donnees={donnees} />');
    });
    it('ne ventile plus par tranches glissantes de trente jours', () => {
        for (const ancien of ['nonEchu', 'j1a30', 'j31a60', 'j61a90', 'plus90']) {
            expect(service).not.toContain(`${ancien}:`);
            expect(page).not.toContain(ancien);
        }
    });
    it('titre chaque tranche DEUX fois · période calendaire et âge', () => {
        expect(service).toContain('libellePeriode');
        expect(service).toContain('libelleAge');
        expect(service).toContain('Moins de ${age} jours');
        expect(service).toContain('Du ${jour(debut)} au ${jour(dernierJour)}');
        expect(page).toContain('t.libelleAge');
        expect(page).toContain('t.libellePeriode');
    });
    it('groupe par TIERS, et retombe sur le compte à défaut', () => {
        expect(service).toContain('`${tiers.code} - ${tiers.nom}`');
        expect(service).toContain('`${l.compte.numero} - ${l.compte.intitule}`');
        expect(service).toContain("`tiers:${tiers.id}`");
    });
    it('ne ventile pas les soldes de sens contraire', () => {
        expect(service).toContain("montants: [] as number[]");
        expect(service).toContain('const sensInverse = toutes');
        expect(page).toContain('non ventilés par antériorité');
    });
    it('le sens contraire se lit sur le sens NORMAL du périmètre, jamais sur le seul signe (lot M, D1)', () => {
        expect(service).toContain('ligneVentilee(perimetre.sensNormal, [...(comptesDeLaCle.get(c.cle) ?? [c.numero])], c.solde)');
        expect(page).toContain('donnees.crediteurs.map');
        expect(page).toContain('donnees.sensInverse');
    });
    it('rend les totaux, dont le net qui recoupe la balance auxiliaire', () => {
        expect(service).toContain('debiteurs: totalDebiteurs');
        expect(service).toContain('crediteurs: totalCrediteurs');
        expect(service).toContain('sensInverse: totalSensInverse');
        expect(service).toContain('net: arrondir(totalDebiteurs + totalCrediteurs + totalSensInverse)');
        expect(page).toContain('Solde net');
    });
    it('n’invente pas un bloc « reste de l’exercice » quand il serait vide', () => {
        expect(service).toContain('if (exercice.dateDebut < debutFenetre)');
    });
    it('borne la date de référence à la fin de l’exercice', () => {
        expect(service).toContain('demande > exercice.dateFin ? exercice.dateFin : demande');
    });
    it('n’aligne pas la grille de l’écran sur un nombre de colonnes figé', () => {
        expect(page).toContain('repeat(${nbTranches + 1}, 116px)');
    });
});
//# sourceMappingURL=balance-agee-modele.spec.js.map