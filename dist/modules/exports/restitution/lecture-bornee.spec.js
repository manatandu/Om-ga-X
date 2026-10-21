"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const extension_cloisonnement_1 = require("../../../common/cloisonnement/extension-cloisonnement");
const modeles_cloisonnes_1 = require("../../../common/cloisonnement/modeles-cloisonnes");
const tables_restitution_1 = require("./tables-restitution");
const RACINE = (0, node_path_1.join)(__dirname, '..', '..', '..', '..');
const DOSSIER = 'd-1';
const AUTRE = 'd-2';
describe('l’inventaire couvre le schéma, sans trou ni surplus', () => {
    it('compte exactement les modèles du schéma, Tenant mis à part', () => {
        const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/schema.prisma'), 'utf8');
        const modeles = [...schema.matchAll(/^model (\w+) \{/gm)].map(([, n]) => n);
        expect(modeles).toHaveLength(182);
        expect([...tables_restitution_1.TABLES_RESTITUEES].sort()).toEqual(modeles.filter((m) => m !== 'Tenant' && !(m in modeles_cloisonnes_1.MODELES_HORS_DOSSIER)).sort());
        for (const m of Object.keys(modeles_cloisonnes_1.MODELES_HORS_DOSSIER)) {
            expect(modeles).toContain(m);
            expect(modeles_cloisonnes_1.MODELES_CLOISONNES.has(m)).toBe(false);
        }
    });
    it('L’ARCHIVE REND LES DONNÉES QUE LE JOURNAL MASQUE · deux listes, deux fins', () => {
        const colonnes = (0, tables_restitution_1.colonnesDuModele)('Salarie');
        for (const attendue of [
            'dateNaissance',
            'nationalite',
            'lieuNaissance',
            'nomConjoint',
            'numeroAffiliationCnss',
        ]) {
            expect(colonnes).toContain(attendue);
        }
        expect((0, tables_restitution_1.colonnesDuModele)('ContratTravail')).toContain('remunerationBase');
        expect((0, tables_restitution_1.colonnesDuModele)('EnfantACharge')).toContain('dateNaissance');
        expect((0, tables_restitution_1.colonnesDuModele)('User')).not.toContain('motDePasse');
        expect((0, tables_restitution_1.colonnesDuModele)('User')).not.toContain('estOperateurPlateforme');
    });
    it('déclare une borne pour CHAQUE modèle porté, et pour eux seuls', () => {
        expect(Object.keys(tables_restitution_1.BORNES_PORTEES).sort()).toEqual([...modeles_cloisonnes_1.MODELES_PORTES_PAR_LEUR_PARENT].sort());
    });
    it('refuse un modèle inconnu au lieu de rendre un filtre vide', () => {
        expect(() => (0, tables_restitution_1.borneDuModele)('ModeleInvente', DOSSIER)).toThrow(tables_restitution_1.ModeleSansBorne);
    });
});
describe('chaque borne est acceptée par la garde du moteur', () => {
    it('borne toutes les tables au dossier, valeur comprise', () => {
        for (const modele of tables_restitution_1.TABLES_RESTITUEES) {
            const where = (0, tables_restitution_1.borneDuModele)(modele, DOSSIER);
            expect([modele, (0, extension_cloisonnement_1.filtreBorne)(where, DOSSIER)]).toEqual([modele, true]);
            expect([modele, (0, extension_cloisonnement_1.filtreBorne)(where, AUTRE)]).toEqual([modele, false]);
        }
    });
    it('borne un modèle cloisonné par son tenantId', () => {
        expect((0, tables_restitution_1.borneDuModele)('Ecriture', DOSSIER)).toEqual({ tenantId: DOSSIER });
    });
    it('borne un modèle porté par sa relation parente obligatoire', () => {
        expect((0, tables_restitution_1.borneDuModele)('LigneEcriture', DOSSIER)).toEqual({ ecriture: { tenantId: DOSSIER } });
        expect((0, tables_restitution_1.borneDuModele)('VentilationAnalytique', DOSSIER)).toEqual({
            ligne: { ecriture: { tenantId: DOSSIER } },
        });
    });
    it('ne borne par AUCUNE relation facultative', () => {
        const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/schema.prisma'), 'utf8');
        const blocs = new Map([...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, nom, corps]) => [nom, corps]));
        for (const [modele, chemin] of Object.entries(tables_restitution_1.BORNES_PORTEES)) {
            let courant = modele;
            for (const relation of chemin) {
                const ligne = blocs
                    .get(courant)
                    .split('\n')
                    .map((l) => l.trim())
                    .find((l) => l.startsWith(`${relation} `));
                expect([modele, relation, ligne]).not.toEqual([modele, relation, undefined]);
                const type = ligne.split(/\s+/)[1];
                expect([modele, relation, type.endsWith('?')]).toEqual([modele, relation, false]);
                courant = type;
            }
            expect([modele, modeles_cloisonnes_1.MODELES_CLOISONNES.has(courant)]).toEqual([modele, true]);
        }
    });
});
describe('ce que l’archive écrit de chaque table', () => {
    it('ne recopie jamais une colonne exclue', () => {
        const colonnes = (0, tables_restitution_1.colonnesDuModele)('User');
        expect(colonnes).toContain('email');
        expect(colonnes).not.toContain('motDePasse');
        expect(colonnes).not.toContain('estOperateurPlateforme');
    });
    it('ne recopie que des colonnes, jamais une relation', () => {
        const colonnes = (0, tables_restitution_1.colonnesDuModele)('LigneEcriture');
        expect(colonnes).toContain('ecritureId');
        expect(colonnes).not.toContain('ecriture');
        expect(colonnes).not.toContain('compte');
    });
    it('lit le journal d’audit par son RANG, tout le reste par id', () => {
        expect((0, tables_restitution_1.ordreDuModele)('EvenementAudit')).toBe('rang');
        expect((0, tables_restitution_1.ordreDuModele)('Ecriture')).toBe('id');
    });
    it('range chaque table sous un nom de fichier stable', () => {
        expect((0, tables_restitution_1.fichierDeLaTable)('LigneEcriture')).toBe('tables/ligne-ecriture.csv');
        expect((0, tables_restitution_1.fichierDeLaTable)('Tiers')).toBe('tables/tiers.csv');
        const noms = tables_restitution_1.TABLES_RESTITUEES.map(tables_restitution_1.fichierDeLaTable);
        expect(new Set(noms).size).toBe(noms.length);
    });
});
//# sourceMappingURL=lecture-bornee.spec.js.map