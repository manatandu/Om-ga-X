// Aucun import de « vitest » · convention du dépôt, le spec tourne aussi sous jest.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  JETONS_MODELE_IMPRESSION,
  LIBELLES_NATURE_MODELE,
  LONGUEUR_INTITULE_MODELE,
  LONGUEUR_TEXTE_MODELE,
  NATURES_MODELE,
  PLAFOND_MODELES_IMPRESSION,
  TEXTE_DE_DEPART,
  ZONE_DU_TIERS,
  modelesDeLaNature,
} from './modeles-impression';

/**
 * LE MIROIR DES MODÈLES D'IMPRESSION (ligne sage-l2, fonction 27) · l'écran
 * recopie l'énumération du schéma, les libellés, les jetons et les bornes du
 * serveur. Une nature ajoutée au schéma et absente de l'écran ne se
 * choisirait jamais sur la fiche ; un jeton du serveur que l'aide tairait ne
 * serait jamais écrit, un jeton que l'aide promettrait serait refusé.
 */
const RACINE = join(__dirname, '../../..');
const SERVEUR = readFileSync(join(RACINE, 'src/modules/tiers/modeles-impression.ts'), 'utf8');

describe('le miroir', () => {
  it('suit l’énumération NatureModeleImpression du schéma, dans son ordre', () => {
    const schema = readFileSync(join(RACINE, 'prisma/schema.prisma'), 'utf8');
    const debut = schema.indexOf('enum NatureModeleImpression {');
    const valeurs = schema
      .slice(debut, schema.indexOf('}', debut))
      .split('\n')
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => /^[A-Z_]+$/.test(l));
    expect(valeurs.length).toBeGreaterThan(0);
    expect([...NATURES_MODELE]).toEqual(valeurs);
  });

  it('reprend les libellés, les jetons, les bornes et les colonnes du serveur', () => {
    for (const n of NATURES_MODELE) {
      expect(SERVEUR).toContain(`${n}: '${LIBELLES_NATURE_MODELE[n]}'`);
      expect(SERVEUR).toContain(`${n}: '${ZONE_DU_TIERS[n]}'`);
    }
    const jetonsServeur = [...SERVEUR.matchAll(/\{ jeton: '([a-z]+)'/g)].map((m) => m[1]);
    expect([...JETONS_MODELE_IMPRESSION]).toEqual(jetonsServeur);
    expect(SERVEUR).toContain(`PLAFOND_MODELES_IMPRESSION = ${PLAFOND_MODELES_IMPRESSION};`);
    expect(SERVEUR).toContain(`LONGUEUR_INTITULE_MODELE = ${LONGUEUR_INTITULE_MODELE};`);
    expect(SERVEUR).toContain(`LONGUEUR_TEXTE_MODELE = ${LONGUEUR_TEXTE_MODELE};`);
  });

  it('le texte de départ porte le document une fois, et seulement des jetons admis', () => {
    const jetons = [...TEXTE_DE_DEPART.matchAll(/\{([^{}\s]*)\}/g)].map((m) => m[1]);
    expect(jetons.filter((j) => j === 'document')).toHaveLength(1);
    for (const j of jetons) expect(JETONS_MODELE_IMPRESSION).toContain(j);
  });
});

describe('les modèles d’une zone', () => {
  it('seulement ceux de sa nature, par intitulé', () => {
    const modeles = [
      { nature: 'RAPPEL' as const, intitule: 'Zénith' },
      { nature: 'REGLEMENT' as const, intitule: 'Avis' },
      { nature: 'RAPPEL' as const, intitule: 'Contrat' },
    ];
    expect(modelesDeLaNature(modeles, 'RAPPEL').map((m) => m.intitule)).toEqual(['Contrat', 'Zénith']);
  });
});
