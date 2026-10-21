"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const modeles_cloisonnes_1 = require("./modeles-cloisonnes");
const RACINE = (0, node_path_1.join)(__dirname, '..', '..', '..');
const schema = (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/schema.prisma'), 'utf8');
const CLOISONNES = [...modeles_cloisonnes_1.MODELES_CLOISONNES];
const MODELES = new Map([...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].map(([, nom, corps]) => [
    nom,
    corps.split('\n').map((l) => l.replace(/\/\/.*$/, '').trim()),
]));
function indexDuModele(lignes) {
    return lignes
        .map((l) => /^@@index\(\s*(?:fields:\s*)?\[([^\]]*)\]/.exec(l))
        .filter((m) => m !== null)
        .map((m) => m[1].split(',').map((c) => c.trim()));
}
function commenceParLeDossier(lignes) {
    return (lignes.some((l) => /^@@(index|unique|id)\(\s*(?:fields:\s*)?\[\s*tenantId\b/.test(l)) ||
        lignes.some((l) => /^tenantId\s.*@(unique|id)\b/.test(l)));
}
function tableDuModele(nom, lignes) {
    return /^@@map\("([^"]+)"\)/.exec(lignes.find((l) => l.startsWith('@@map(')) ?? '')?.[1] ?? nom;
}
const INDEX_F261 = [
    { modele: 'User', table: 'users', colonnes: ['tenantId'] },
    { modele: 'Cloture', table: 'clotures', colonnes: ['tenantId', 'exerciceId'] },
    { modele: 'RapprochementBancaire', table: 'rapprochements_bancaires', colonnes: ['tenantId', 'compteId'] },
    { modele: 'LigneOdAnalytique', table: 'lignes_od_analytique', colonnes: ['tenantId', 'sectionId'] },
    { modele: 'Immobilisation', table: 'immobilisations', colonnes: ['tenantId', 'statut'] },
    { modele: 'LigneRetraitementIfrs', table: 'lignes_retraitement_ifrs', colonnes: ['tenantId'] },
];
describe('F261 · un index qui commence par le dossier, sur toute table cloisonnée', () => {
    it('le recensement trouve encore les tables cloisonnées · un garde-fou qui ne trouve rien ne vérifie rien', () => {
        expect(CLOISONNES.length).toBeGreaterThan(0);
        for (const nom of CLOISONNES)
            expect(MODELES.has(nom)).toBe(true);
        for (const { modele } of INDEX_F261)
            expect(CLOISONNES).toContain(modele);
    });
    it('chaque table cloisonnée porte un index, un unique ou une clé qui commence par tenantId', () => {
        const sansIndex = CLOISONNES.filter((nom) => !commenceParLeDossier(MODELES.get(nom) ?? []));
        expect(sansIndex).toEqual([]);
    });
});
describe('F261 · les six index posés, au schéma et dans leur migration', () => {
    const migrations = (0, node_fs_1.readdirSync)((0, node_path_1.join)(RACINE, 'prisma/migrations'), { withFileTypes: true })
        .filter((e) => e.isDirectory())
        .map((e) => (0, node_fs_1.readFileSync)((0, node_path_1.join)(RACINE, 'prisma/migrations', e.name, 'migration.sql'), 'utf8'))
        .join('\n');
    it.each(INDEX_F261)('$modele porte son index par le dossier sur la table $table', ({ modele, table, colonnes }) => {
        const lignes = MODELES.get(modele) ?? [];
        expect(tableDuModele(modele, lignes)).toBe(table);
        expect(indexDuModele(lignes)).toContainEqual(colonnes);
    });
    it.each(INDEX_F261)('la migration crée l’index de $modele sous le nom que Prisma lui donne', ({ table, colonnes }) => {
        const nom = `${table}_${colonnes.join('_')}_idx`;
        const cols = colonnes.map((c) => `"${c}"`).join(', ');
        expect(migrations).toContain(`CREATE INDEX "${nom}" ON "${table}"(${cols});`);
    });
});
//# sourceMappingURL=index-du-dossier.spec.js.map