import { createHash } from 'crypto';
import { texteBrutDesConditions, VERSION_CONDITIONS_LICENCE } from './conditions-de-licence';
import { sha256Hex } from './empreinte';
import { empreinteEnVigueur, VERSIONS_PUBLIEES, VERSIONS_RETIREES, versionPubliee } from './versions-publiees';
import { entreeEnVigueurAuPlusTot, finDuDelaiDeResiliation, motifDelaiArticle34, nIemeJourOuvrableApres, priseDEffet } from './delais-article-34';

/**
 * LES VERSIONS PUBLIÉES ET LEUR EMPREINTE (relecture « échecs silencieux » de
 * la ligne pages-legales, M2). Ce qui casserait en silence · un contrat
 * retouché sous le même numéro, une version acceptée dont le texte ne se
 * relirait plus, une version nouvelle entrée en vigueur sans le délai de
 * l'art. 34.
 */

/**
 * L'EMPREINTE GELÉE DE CHAQUE VERSION PUBLIÉE · à ne JAMAIS modifier. Publier
 * une version, c'est AJOUTER sa ligne ici, avec son texte archivé dans
 * `versions/` ; retoucher le texte d'une version publiée fait tomber ce spec.
 */
const EMPREINTES_GELEES: Record<number, string> = {
  3: 'deae0898432fb16cc14b5b3328caf015c22030b1dac180a93d697940562a2bff',
};

describe('l’empreinte SHA-256, écrite pour les deux côtés', () => {
  it('rend les vecteurs de la norme (FIPS 180-2, annexe B)', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    );
  });

  it('rend ce que rend Node, sur des caractères accentués et sur le contrat entier', () => {
    for (const t of ['é’·', '😀 OmegaX', 'x'.repeat(64), 'x'.repeat(65), texteBrutDesConditions()]) {
      expect(sha256Hex(t)).toBe(createHash('sha256').update(t, 'utf8').digest('hex'));
    }
  });
});

describe('chaque version publiée garde son texte et son empreinte', () => {
  it('l’empreinte de chaque version archivée est celle de son texte, et elle est gelée ici', () => {
    expect(VERSIONS_PUBLIEES.map((v) => v.numero)).toEqual(Object.keys(EMPREINTES_GELEES).map(Number));
    for (const v of VERSIONS_PUBLIEES) {
      expect([v.numero, sha256Hex(v.texte)]).toEqual([v.numero, v.empreinte]);
      expect([v.numero, v.empreinte]).toEqual([v.numero, EMPREINTES_GELEES[v.numero]]);
    }
  });

  it('les versions, retirées et publiées, se suivent sans trou, dans l’ordre des dates', () => {
    const toutes = [...VERSIONS_RETIREES, ...VERSIONS_PUBLIEES].sort((a, b) => a.numero - b.numero);
    toutes.forEach((v, i) => {
      expect(v.numero).toBe(i + 1);
      if (i > 0) expect(v.date >= toutes[i - 1].date).toBe(true);
    });
  });

  it('une version retirée garde son empreinte gelée, ne sert plus de texte, et précède toute version publiée', () => {
    // La version 1 (2026-10-15), offre jamais acceptable, retirée le
    // 2026-10-28 avec le nom de l'ancien éditeur · son empreinte ne change
    // jamais, et son numéro ne sert plus aucun texte.
    expect(VERSIONS_RETIREES.map((v) => [v.numero, v.empreinte])).toEqual([
      [1, '1a878fe68d79ec76fa40173395750ab68cbf8a1a581c91397e45b30815dac75d'],
      [2, 'f980b6ce005f83bcc6610892deb519c9c8b154e6202f34ac0954e4bd33217f9e'],
    ]);
    for (const r of VERSIONS_RETIREES) {
      expect(versionPubliee(r.numero)).toBeNull();
      expect(VERSIONS_PUBLIEES.every((p) => p.numero > r.numero)).toBe(true);
    }
  });

  it('la version en vigueur est la dernière publiée, et le générateur rend EXACTEMENT son texte archivé', () => {
    // Retoucher `conditions-de-licence.ts` sans publier de version nouvelle
    // fait tomber ce test · c'est voulu (contrat, article 15).
    const derniere = VERSIONS_PUBLIEES[VERSIONS_PUBLIEES.length - 1];
    expect(derniere.numero).toBe(VERSION_CONDITIONS_LICENCE.numero);
    expect(derniere.date).toBe(VERSION_CONDITIONS_LICENCE.date);
    expect(derniere.dateLisible).toBe(VERSION_CONDITIONS_LICENCE.dateLisible);
    expect(texteBrutDesConditions()).toBe(derniere.texte);
    expect(empreinteEnVigueur()).toBe(derniere.empreinte);
  });

  it('une version se retrouve par son numéro, et un numéro inconnu n’a pas de texte', () => {
    expect(versionPubliee(3)?.texte).toBe(VERSIONS_PUBLIEES[0].texte);
    expect(versionPubliee(99)).toBeNull();
  });
});

describe('les délais de l’art. 34 (Code du numérique), comptés au plus long pour l’utilisateur', () => {
  it('trente jours ouvrables pleins, du lundi au vendredi, entre la communication et l’entrée en vigueur', () => {
    // Communiquée le jeudi 15 octobre 2026 · le 30e jour ouvrable qui suit
    // est le jeudi 26 novembre, l'entrée en vigueur au plus tôt le vendredi 27.
    expect(nIemeJourOuvrableApres('2026-10-15', 30)).toBe('2026-11-26');
    expect(entreeEnVigueurAuPlusTot('2026-10-15')).toBe('2026-11-27');
  });

  it('les jours fériés de l’ordonnance n° 23-042 ne comptent pas', () => {
    // Le 25 décembre, le 1er et le 4 janvier sautent · 2027-02-03 est le 30e.
    expect(nIemeJourOuvrableApres('2026-12-20', 30)).toBe('2027-02-03');
  });

  it('la modification ne prend effet qu’au lendemain du soixantième jour ouvrable après l’entrée en vigueur', () => {
    // Du lundi 30 novembre 2026, soixante jours ouvrables, le 25 décembre et
    // les 1er et 4 janvier sautés · le soixantième est le mercredi 24 février.
    expect(finDuDelaiDeResiliation('2026-11-27')).toBe('2027-02-24');
    expect(priseDEffet('2026-11-27')).toBe('2027-02-25');
  });

  it('chaque version publiée respecte le délai, et la première, offre initiale, n’en porte aucun', () => {
    const retires = VERSIONS_RETIREES.map((r) => r.numero);
    for (const v of VERSIONS_PUBLIEES) expect([v.numero, motifDelaiArticle34(v, retires)]).toEqual([v.numero, null]);
    // Après une version retirée, jamais acceptable, la suivante est l'offre initiale.
    expect(motifDelaiArticle34({ numero: 2, communiqueeLe: null, enVigueurLe: '2027-01-01' }, [1])).toBeNull();
    // Après une version acceptable, la suivante est une modification.
    expect(motifDelaiArticle34({ numero: 2, communiqueeLe: null, enVigueurLe: '2027-01-01' })).toContain('date de communication');
    expect(motifDelaiArticle34({ numero: 4, communiqueeLe: null, enVigueurLe: '2027-01-01' }, retires)).toContain('date de communication');
    expect(motifDelaiArticle34({ numero: 4, communiqueeLe: '2026-10-15', enVigueurLe: '2026-11-26' }, retires)).toContain('ne peut entrer en vigueur avant le 2026-11-27');
    expect(motifDelaiArticle34({ numero: 4, communiqueeLe: '2026-10-15', enVigueurLe: '2026-11-27' }, retires)).toBeNull();
  });

  it('UNE SEULE VERSION tant que la bascule de N à N+1 n’est pas servie', () => {
    // Une version qui suit une version ACCEPTABLE exige plus qu'une ligne ici ·
    // l'acceptation de N vaut jusqu'à la prise d'effet de N+1 (art. 34, « ne
    // prend effet qu'à l'issue de ce délai »), le client peut résilier sans
    // pénalité pendant soixante jours ouvrables, et le serveur ne sert
    // aujourd'hui que la dernière version. Ce test tombe le jour où une
    // seconde version publiée est ajoutée, pour qu'on code cette bascule avec
    // elle. La version 1, retirée sans avoir jamais été acceptable, n'en
    // demandait aucune.
    expect(VERSIONS_PUBLIEES).toHaveLength(1);
  });
});
