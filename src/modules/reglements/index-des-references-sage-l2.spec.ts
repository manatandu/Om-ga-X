import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * LES CLÉS ÉTRANGÈRES DE LA LIGNE SAGE-L2 PORTENT LEUR INDEX (second tour de
 * relecture, m8) · le retrait d'un mode de règlement ou d'un modèle
 * d'impression compte les fiches qui le portent (`references.ts`), et la clé
 * étrangère RESTRICT les relit à chaque suppression · sans index, chacun
 * balaie la table entière, tous dossiers confondus. Le test lit le schéma
 * par sa structure · chaque relation vers ces modèles, dans chaque modèle,
 * a un index qui commence par sa colonne.
 */
const schema = readFileSync(join(__dirname, '../../../prisma/schema.prisma'), 'utf8');

function blocsDeModeles(): Map<string, string> {
  const blocs = new Map<string, string>();
  const re = /^model (\w+) \{\n([\s\S]*?)^\}/gm;
  for (let m = re.exec(schema); m; m = re.exec(schema)) blocs.set(m[1], m[2]);
  return blocs;
}

const CIBLES = ['ModeReglement', 'ModeleImpressionTiers'];

describe('index des références de la ligne sage-l2', () => {
  const blocs = blocsDeModeles();
  const relations: Array<{ modele: string; colonne: string }> = [];
  for (const [modele, corps] of blocs) {
    for (const ligne of corps.split('\n')) {
      const cible = /^\s+\w+\s+(\w+)\??\s+@relation\(/.exec(ligne)?.[1];
      if (!cible || !CIBLES.includes(cible)) continue;
      const colonne = /fields:\s*\[(\w+)\]/.exec(ligne)?.[1];
      if (colonne) relations.push({ modele, colonne });
    }
  }

  it('le recensement trouve les relations attendues', () => {
    expect(relations).toEqual(
      expect.arrayContaining([
        { modele: 'Tiers', colonne: 'modeReglementId' },
        { modele: 'Tiers', colonne: 'modeleImpressionExtraitId' },
        { modele: 'Tiers', colonne: 'modeleImpressionReglementId' },
        { modele: 'Tiers', colonne: 'modeleImpressionRappelId' },
        { modele: 'ModeleReglement', colonne: 'modeReglementId' },
        { modele: 'EcheanceReglement', colonne: 'modeReglementId' },
        { modele: 'LigneEcriture', colonne: 'modeReglementId' },
      ]),
    );
  });

  it('chaque relation a un index qui commence par sa colonne', () => {
    const sansIndex = relations.filter(({ modele, colonne }) => {
      const corps = blocs.get(modele) ?? '';
      return !new RegExp(`@@(index|unique)\\(\\[${colonne}[,\\]]`).test(corps);
    });
    expect(sansIndex).toEqual([]);
  });
});
