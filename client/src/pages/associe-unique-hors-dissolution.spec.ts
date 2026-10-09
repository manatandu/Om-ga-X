import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { faitsDeLaFormeAEnvoyer } from '../lib/mentions-dossier';

// Aucun import de « vitest » · convention du dépôt, le spec lit des sources.

/**
 * LE CHAMP QUE LE MESSAGE NOMME EST CELUI DE L'ÉCRAN, ET IL SE REMPLIT HORS DE
 * TOUTE DISSOLUTION (paquet 1, ligne C, premier tour de relecture, constat 7).
 *
 * L'observation de l'art. 63, al. 2, 1° (loi n° 23/053) servie sous condition
 * disait de déclarer la nature de l'associé unique dans « identité du
 * dossier, “associé unique personne morale” » · aucun écran ne porte ce nom.
 * Le champ vit dans Paramètres du dossier, section Immatriculation, sous
 * « Régime de la liquidation », et son infobulle ne parlait que de la
 * dissolution (AUSCGIE art. 201 al. 4) · une société qui ne se dissout pas
 * n'y répondait pas, et la condition ne se levait jamais.
 *
 * Le spec relit les compléments du SERVEUR et l'écran · chaque libellé que
 * le message cite après « section Immatriculation » est celui d'une ligne de
 * cette section ; la ligne de l'associé personne morale ne dépend d'aucune
 * date de dissolution, ni à l'affichage ni à l'envoi ; son infobulle le dit.
 */

const page = readFileSync(join(__dirname, 'ParametresDossierPage.tsx'), 'utf8');
const fiscalite = readFileSync(join(__dirname, '../../../src/modules/fiscalite/fiscalite.service.ts'), 'utf8');

/** La valeur littérale d'une constante exportée du service fiscal. */
const constante = (nom: string): string => {
  const debut = fiscalite.indexOf(`export const ${nom} =`);
  expect(debut).toBeGreaterThan(-1);
  const ouverture = fiscalite.indexOf('"', debut);
  return fiscalite.slice(ouverture + 1, fiscalite.indexOf('";', ouverture));
};

/** La section Immatriculation · de son titre au titre de section suivant. */
const sectionImmatriculation = (() => {
  const titre = page.search(/<SectionTitre>\s*Immatriculation/);
  expect(titre).toBeGreaterThan(-1);
  const fin = page.indexOf('<SectionTitre>', titre + 1);
  expect(fin).toBeGreaterThan(titre);
  return page.slice(titre, fin);
})();

/** Les libellés cités entre guillemets après « section Immatriculation, ». */
const champsCites = (message: string): string[] => {
  const i = message.indexOf('section Immatriculation, ');
  expect(i).toBeGreaterThan(-1);
  const suite = message.slice(i);
  return [...suite.matchAll(/« ([^»]+) »/g)].map((m) => m[1]);
};

/** La balise <select> qui porte cette étiquette, ancrée sur la balise elle-même. */
const selectDe = (etiquette: string) => {
  const i = sectionImmatriculation.indexOf(`aria-label="${etiquette}"`);
  expect(i).toBeGreaterThan(-1);
  return sectionImmatriculation.slice(sectionImmatriculation.lastIndexOf('<select', i), sectionImmatriculation.indexOf('>', i) + 1);
};

describe('constat 7 · le champ de l’associé unique, nommé où il est et rempli hors dissolution', () => {
  it('chaque champ cité par les compléments de l’observation est une ligne de la section Immatriculation', () => {
    for (const nom of ['COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE', 'COMPLEMENT_UNICITE_NON_DECLAREE']) {
      const cites = champsCites(constante(nom));
      expect(cites.length).toBeGreaterThan(0);
      for (const libelle of cites) expect(sectionImmatriculation).toContain(`<Ligne label="${libelle}">`);
    }
  });

  it('le message sur la nature de l’associé dit que la réponse vaut hors de toute dissolution', () => {
    const message = constante('COMPLEMENT_NATURE_ASSOCIE_NON_DECLAREE');
    expect(message).toContain('« Associé unique personne morale »');
    expect(message).toContain('la réponse vaut hors de toute dissolution');
    // La condition elle-même ne change pas · c'est elle que le banc relit.
    expect(message).toContain("l'observation ne vaut que s'il est une personne physique");
  });

  it('la ligne ne dépend d’aucune date de dissolution à l’affichage', () => {
    const ligne = sectionImmatriculation.indexOf('<Ligne label="Associé unique personne morale">');
    // Les conditions qui l'enveloppent · le bloc de la liquidation, puis la forme.
    const blocLiquidation = sectionImmatriculation.lastIndexOf('faitsDeLaForme(params?.formeJuridiqueSyscohada).liquidation && (', ligne);
    expect(blocLiquidation).toBeGreaterThan(-1);
    const conditions = sectionImmatriculation.slice(sectionImmatriculation.lastIndexOf('{', blocLiquidation), ligne);
    expect(conditions).toContain('faitsDeLaForme(params?.formeJuridiqueSyscohada).associeUniquePm && (');
    expect(conditions).not.toMatch(/dateDissolution|dissolution\s*&&/);
  });

  it('la réponse part sans date de dissolution, pour une SARL comme pour une SAS', () => {
    for (const forme of ['SOCIETE_RESPONSABILITE_LIMITEE', 'SOCIETE_PAR_ACTIONS_SIMPLIFIEE'] as const) {
      const corps = faitsDeLaFormeAEnvoyer(forme, {
        modeAdministrationSa: 'PAS_ENCORE_DIT',
        associeUnique: 'OUI',
        dateDissolution: '',
        liquidateurs: '',
        associeUniquePersonneMorale: 'NON',
      });
      expect(corps.associeUniquePersonneMorale).toBe('NON');
      expect(corps.dateDissolution).toBe('');
    }
  });

  it('son infobulle dit qu’elle sert aussi hors de toute dissolution, et pourquoi', () => {
    const select = selectDe('Associé unique personne morale');
    expect(select).toContain('AUSCGIE art. 201 al. 4');
    expect(select).toContain('hors de toute dissolution');
    expect(select).toContain('loi n° 23/053, art. 63, al. 2, 1°');
  });
});
