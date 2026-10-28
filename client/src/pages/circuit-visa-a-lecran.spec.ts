import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { phraseDuVisa } from '../lib/circuit-visa';

/**
 * LE CIRCUIT DE VISA À L'ÉCRAN (ligne microfina-m1, idée 1). Ce qui casserait
 * en silence ·
 *  · un visa envoyé sans l'empreinte du contenu montré · le serveur ne
 *    pourrait plus refuser une pièce changée depuis la lecture ;
 *  · une validation écartée faute de visa lue comme « rien à valider » ;
 *  · une facture non visée offerte à la comptabilisation, que le serveur
 *    refuse ensuite sans que l'écran ait dit pourquoi.
 */

const brouillard = readFileSync(join(__dirname, 'BrouillardPage.tsx'), 'utf8');
const facturation = readFileSync(join(__dirname, 'FacturationPage.tsx'), 'utf8');
const journal = readFileSync(join(__dirname, 'JournalPage.tsx'), 'utf8');
const parametres = readFileSync(join(__dirname, 'ParametresDossierPage.tsx'), 'utf8');

function corpsDe(source: string, debut: string): string {
  const i = source.indexOf(debut);
  if (i < 0) throw new Error(`${debut} introuvable`);
  const ouvrante = source.indexOf('{', source.indexOf('=>', i));
  let profondeur = 0;
  for (let k = ouvrante; k < source.length; k++) {
    if (source[k] === '{') profondeur++;
    else if (source[k] === '}' && --profondeur === 0) return source.slice(ouvrante, k + 1);
  }
  throw new Error(`${debut} sans fin`);
}

describe('le brouillard vise ce qu’il a montré', () => {
  it('chaque pièce part avec son empreinte, vers la route du circuit', () => {
    const corps = corpsDe(brouillard, 'const viserSelection = async');
    expect(corps).toContain("api.post<ResultatVisa>('/circuit-visa/ecritures', { pieces })");
    expect(corps).toContain('empreinte: l.empreinte');
  });

  it('les gestes du visa vivent sous le circuit ET sous peutValider', () => {
    const i = brouillard.indexOf('{peutValider && (');
    const j = brouillard.indexOf('Viser la sélection');
    expect(i).toBeGreaterThan(0);
    expect(j).toBeGreaterThan(i);
    expect(brouillard.slice(i, j)).toContain('{circuit && (');
  });

  it('une validation écartée faute de visa se compte avant le cas vide', () => {
    const corps = corpsDe(brouillard, 'const phraseValidation = (');
    expect(corps.indexOf('refuseesVisa')).toBeGreaterThan(0);
    expect(corps.indexOf('refuseesVisa')).toBeLessThan(corps.indexOf('r.validees === 0'));
    expect(corps).toContain('r.motifVisa');
    expect(corps).toContain('r.motifAuteurInconnu');
  });

  // RELECTURE M3 · l'issue que nomment les motifs de l'auteur inconnu et du
  // double regard (le nom et le motif du second regard porté hors du
  // logiciel) doit pouvoir partir · aucun écran ne l'envoyait.
  it('les deux validations envoient la dérogation nominative, offerte après un refus du double regard', () => {
    expect(corpsDe(brouillard, 'const validerSelection = async')).toContain('...derogation()');
    expect(corpsDe(brouillard, 'const validerJusqua = async')).toContain('...derogation()');
    const derog = corpsDe(brouillard, 'const derogation = (');
    expect(derog).toContain('secondRegardNom');
    expect(derog).toContain('secondRegardMotif');
    expect(corpsDe(brouillard, 'const apresValidation = (')).toMatch(/refuseesAuteurInconnu[\s\S]*setDerogationOfferte\(true\)/);
    expect(brouillard).toContain('{peutValider && derogationOfferte && (');
  });

  it('le filtre par nature vide la sélection · rien ne se vise ni ne se valide à l’aveugle', () => {
    const i = brouillard.indexOf('setNature(e.target.value');
    expect(brouillard.slice(i, i + 300)).toContain('setSelection(new Set())');
  });
});

describe('la facture se vise avant sa comptabilisation', () => {
  it('le passage de l’écriture n’est offert, sous le circuit, qu’à une facture visée', () => {
    expect(facturation).toContain('{peutEcrire && !f.ecritureId && (!etat.circuitVisa || f.visa?.vise) && (');
  });
  it('viser est un geste du comptable', () => {
    expect(facturation).toContain('etat.circuitVisa && peutValider && f.visa && !f.visa.vise && !f.ecritureId');
    expect(facturation).toContain('`/circuit-visa/factures/${id}`');
  });
});

describe('la fiche d’imputation s’ouvre du brouillard et du journal', () => {
  it('les deux écrans montent la fiche', () => {
    expect(brouillard).toContain('<FicheImputation ecritureId={ficheId}');
    expect(journal).toContain('<FicheImputation ecritureId={ficheOuverte}');
  });
});

describe('l’option se règle par l’administrateur, et dit qu’aucun texte ne l’impose', () => {
  it('route dédiée, case réservée à l’administrateur', () => {
    expect(parametres).toContain("api.patch<ParametresDossier>('/dossier/circuit-visa', { circuitVisa: actif })");
    const i = parametres.indexOf('Circuit de visa avant validation');
    const avant = parametres.slice(i - 400, i);
    expect(avant).toContain('disabled={!estAdmin || envoi}');
    expect(parametres.slice(i, i + 1800)).toContain('Aucun texte n’impose ce visa');
  });
});

describe('le compte rendu d’un visa nomme chaque refus', () => {
  it('jamais un seul compteur', () => {
    const p = phraseDuVisa({
      visees: 1,
      refusees: [{ id: 'a', piece: 'ACH n° 3', motif: 'Vous êtes l’auteur du dernier contenu' }],
      avertissements: [{ id: 'b', piece: 'OD n° 1', avertissement: 'auteur non connu' }],
    });
    expect(p).toContain('1 pièce(s) visée(s).');
    expect(p).toContain('ACH n° 3 · Vous êtes l’auteur du dernier contenu');
    expect(p).toContain('OD n° 1 · auteur non connu');
  });
});
