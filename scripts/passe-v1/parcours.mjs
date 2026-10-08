/**
 * PARCOURS DE LA DEUXIÈME PASSE · rapprochement bancaire sur relevé importé,
 * contrôles de clôture, relecture de la liasse Excel, import d'écritures par
 * le modèle de fichier, modèle de saisie, pré-lettrage et lettrage
 * automatique, relance d'une facture échue.
 *
 * Mêmes règles que le reste du banc · chaque geste passe par l'API du serveur
 * compilé, chaque montant lu est confronté à l'attendu calculé à la main
 * (README.md), un refus est consigné et le parcours continue.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ExcelJS from 'exceljs';
import { auCentime, compte } from './lib.mjs';

const require = createRequire(import.meta.url);
const ICI = dirname(fileURLToPath(import.meta.url));

// --- Archives ZIP (classeurs, restitution) -----------------------------------

/**
 * Les entrées d'un ZIP, en octets. JSZip n'est pas une dépendance ajoutée ·
 * ExcelJS l'apporte, et le dépôt l'a déjà dans `node_modules`.
 */
export async function entreesZip(octets) {
  const JSZip = require('jszip');
  const zip = await JSZip.loadAsync(octets);
  const entrees = new Map();
  for (const [nom, f] of Object.entries(zip.files)) if (!f.dir) entrees.set(nom, await f.async('nodebuffer'));
  return entrees;
}

/** Le nombre d'enregistrements d'un CSV, retours à la ligne entre guillemets compris. */
export function enregistrementsCsv(texte) {
  let dansGuillemets = false;
  let n = 0;
  let courant = false;
  for (const ch of texte) {
    if (ch === '"') dansGuillemets = !dansGuillemets;
    if (ch === '\n' && !dansGuillemets) {
      if (courant) n += 1;
      courant = false;
    } else if (ch !== '\r') courant = true;
  }
  return n + (courant ? 1 : 0);
}

// --- Relecture d'un classeur ------------------------------------------------------

class ErreurFormule extends Error {
  constructor(code, detail) {
    super(`${code} · ${detail}`);
    this.code = code;
  }
}

/**
 * UN ÉVALUATEUR DE FORMULES, RÉDUIT À CE QUE LES FEUILLES DE CONTRÔLE ÉCRIVENT ·
 * références (avec ou sans feuille, entre apostrophes ou non), plages dans une
 * fonction, + - * /, parenthèses, SUM, ABS, ROUND, MIN, MAX. Le serveur écrit
 * des formules SANS résultat en cache · Excel les calcule à l'ouverture, et le
 * banc doit donc les calculer lui-même pour savoir ce que le lecteur verra. Une
 * référence vers une feuille absente rend « #REF! », un texte dans un calcul
 * « #VALUE! », une division par zéro « #DIV/0! », comme Excel. Une fonction
 * que l'évaluateur ne connaît pas n'est PAS une erreur du classeur · elle est
 * rendue « NON ÉVALUÉE » et dite.
 */
export function evaluateur(classeur) {
  const cache = new Map();

  const lireCellule = (nomFeuille, adresse, pile) => {
    const cle = `${nomFeuille}!${adresse}`;
    if (cache.has(cle)) return cache.get(cle);
    if (pile.has(cle)) throw new ErreurFormule('#CIRC', cle);
    const ws = classeur.getWorksheet(nomFeuille);
    if (!ws) throw new ErreurFormule('#REF!', `feuille « ${nomFeuille} » absente`);
    const cell = ws.getCell(adresse);
    const brut = cell.value;
    let v;
    if (brut && typeof brut === 'object' && ('formula' in brut || 'sharedFormula' in brut)) {
      pile.add(cle);
      try {
        v = evaluer(cell.formula ?? brut.formula, nomFeuille, pile);
      } finally {
        pile.delete(cle);
      }
    } else if (brut && typeof brut === 'object' && 'richText' in brut) v = brut.richText.map((r) => r.text).join('');
    else if (brut && typeof brut === 'object' && 'error' in brut) throw new ErreurFormule(String(brut.error), cle);
    else if (brut && typeof brut === 'object' && 'text' in brut) v = brut.text;
    else v = brut ?? null;
    cache.set(cle, v);
    return v;
  };

  const versNombre = (v, ou) => {
    if (v === null || v === undefined || v === '') return 0;
    if (typeof v === 'number') return v;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v))) return Number(v);
    throw new ErreurFormule('#VALUE!', `texte « ${String(v).slice(0, 40)} » dans un calcul (${ou})`);
  };

  const colonneVersNombre = (lettres) => [...lettres].reduce((n, l) => n * 26 + (l.charCodeAt(0) - 64), 0);
  const nombreVersColonne = (n) => {
    let s = '';
    while (n > 0) {
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  };

  function evaluer(formule, feuilleCourante, pile) {
    const texte = String(formule).replace(/^=/, '');
    let i = 0;
    const espaces = () => {
      while (i < texte.length && texte[i] === ' ') i += 1;
    };
    const lireReference = () => {
      // [feuille!]cellule[:cellule]
      let feuille = feuilleCourante;
      const debut = i;
      if (texte[i] === "'") {
        let nom = '';
        i += 1;
        while (i < texte.length) {
          if (texte[i] === "'" && texte[i + 1] === "'") {
            nom += "'";
            i += 2;
          } else if (texte[i] === "'") {
            i += 1;
            break;
          } else {
            nom += texte[i];
            i += 1;
          }
        }
        if (texte[i] !== '!') throw new ErreurFormule('#NAME?', `nom de feuille sans « ! » dans ${texte}`);
        i += 1;
        feuille = nom;
      } else {
        const m = /^([\p{L}\p{N}_.]+)!/u.exec(texte.slice(i));
        if (m) {
          feuille = m[1];
          i += m[0].length;
        }
      }
      const cellule = /^\$?([A-Z]{1,3})\$?(\d+)/.exec(texte.slice(i));
      if (!cellule) {
        i = debut;
        return null;
      }
      i += cellule[0].length;
      const a = { col: colonneVersNombre(cellule[1]), ligne: Number(cellule[2]) };
      if (texte[i] === ':') {
        const fin = /^:\$?([A-Z]{1,3})\$?(\d+)/.exec(texte.slice(i));
        if (!fin) throw new ErreurFormule('#REF!', `plage illisible dans ${texte}`);
        i += fin[0].length;
        const b = { col: colonneVersNombre(fin[1]), ligne: Number(fin[2]) };
        const valeurs = [];
        for (let l = Math.min(a.ligne, b.ligne); l <= Math.max(a.ligne, b.ligne); l += 1) {
          for (let c = Math.min(a.col, b.col); c <= Math.max(a.col, b.col); c += 1) {
            valeurs.push(lireCellule(feuille, `${nombreVersColonne(c)}${l}`, pile));
          }
        }
        return { plage: valeurs };
      }
      return { valeur: lireCellule(feuille, `${nombreVersColonne(a.col)}${a.ligne}`, pile) };
    };
    const fonctions = {
      SUM: (args) => args.flat().reduce((t, v) => t + (typeof v === 'number' ? v : 0), 0),
      ABS: ([x]) => Math.abs(versNombre(x, 'ABS')),
      ROUND: ([x, n]) => {
        const f = 10 ** versNombre(n, 'ROUND');
        return Math.round(versNombre(x, 'ROUND') * f) / f;
      },
      MIN: (args) => Math.min(...args.flat().filter((v) => typeof v === 'number')),
      MAX: (args) => Math.max(...args.flat().filter((v) => typeof v === 'number')),
      IF: ([cond, si, sinon]) => (cond === true || (typeof cond === 'number' && cond !== 0) ? si : (sinon ?? false)),
      // TEXT · le banc ne reproduit pas le masque d'Excel, il rend le nombre ·
      // la ligne de contrôle ne se juge que sur son égalité, pas sur son rendu.
      TEXT: ([x]) => String(x ?? ''),
      AND: (args) => args.flat().every((v) => v === true || (typeof v === 'number' && v !== 0)),
      OR: (args) => args.flat().some((v) => v === true || (typeof v === 'number' && v !== 0)),
    };
    const primaire = () => {
      espaces();
      const ch = texte[i];
      if (ch === '(') {
        i += 1;
        const v = expression();
        espaces();
        if (texte[i] !== ')') throw new ErreurFormule('#NAME?', `parenthèse non fermée dans ${texte}`);
        i += 1;
        return v;
      }
      if (ch === '"') {
        let v = '';
        i += 1;
        while (i < texte.length) {
          if (texte[i] === '"' && texte[i + 1] === '"') {
            v += '"';
            i += 2;
          } else if (texte[i] === '"') {
            i += 1;
            break;
          } else {
            v += texte[i];
            i += 1;
          }
        }
        return v;
      }
      const nombre = /^\d+(\.\d+)?([eE][+-]?\d+)?/.exec(texte.slice(i));
      if (nombre && !/^\d+[A-Z]/.test(texte.slice(i))) {
        i += nombre[0].length;
        return Number(nombre[0]);
      }
      const fonction = /^([A-Z][A-Z0-9.]*)\(/.exec(texte.slice(i));
      if (fonction) {
        i += fonction[0].length;
        const args = [];
        espaces();
        if (texte[i] !== ')') {
          for (;;) {
            espaces();
            const avant = i;
            const ref = lireReference();
            if (ref && ref.plage && (texte[i] === ',' || texte[i] === ';' || texte[i] === ')')) args.push(ref.plage);
            else {
              i = avant;
              args.push(expression());
            }
            espaces();
            if (texte[i] === ',' || texte[i] === ';') {
              i += 1;
              continue;
            }
            break;
          }
        }
        if (texte[i] !== ')') throw new ErreurFormule('#NAME?', `appel non fermé dans ${texte}`);
        i += 1;
        const f = fonctions[fonction[1]];
        if (!f) throw new ErreurFormule('NON ÉVALUÉE', `fonction ${fonction[1]}`);
        return f(args);
      }
      const ref = lireReference();
      if (ref) {
        if (ref.plage) throw new ErreurFormule('#VALUE!', `plage hors d'une fonction dans ${texte}`);
        return ref.valeur;
      }
      throw new ErreurFormule('#NAME?', `« ${texte.slice(i, i + 20)} » illisible dans ${texte}`);
    };
    const facteur = () => {
      espaces();
      if (texte[i] === '-') {
        i += 1;
        return -versNombre(facteur(), texte);
      }
      if (texte[i] === '+') {
        i += 1;
        return versNombre(facteur(), texte);
      }
      return primaire();
    };
    const terme = () => {
      let v = facteur();
      for (;;) {
        espaces();
        const op = texte[i];
        if (op !== '*' && op !== '/') return v;
        i += 1;
        const d = versNombre(facteur(), texte);
        if (op === '/' && d === 0) throw new ErreurFormule('#DIV/0!', texte);
        v = op === '*' ? versNombre(v, texte) * d : versNombre(v, texte) / d;
      }
    };
    const additive = () => {
      let v = terme();
      for (;;) {
        espaces();
        const op = texte[i];
        if (op !== '+' && op !== '-') return v;
        i += 1;
        const d = versNombre(terme(), texte);
        v = op === '+' ? versNombre(v, texte) + d : versNombre(v, texte) - d;
      }
    };
    const concatenation = () => {
      let v = additive();
      for (;;) {
        espaces();
        if (texte[i] !== '&') return v;
        i += 1;
        v = `${v ?? ''}${additive() ?? ''}`;
      }
    };
    // La comparaison, priorité la plus basse d'Excel · = <> < > <= >=.
    const expression = () => {
      const a = concatenation();
      espaces();
      const op = /^(<>|<=|>=|=|<|>)/.exec(texte.slice(i))?.[1];
      if (!op) return a;
      i += op.length;
      const b = concatenation();
      const x = typeof a === 'number' || typeof b === 'number' ? versNombre(a, texte) : String(a ?? '');
      const y = typeof a === 'number' || typeof b === 'number' ? versNombre(b, texte) : String(b ?? '');
      return { '=': x === y, '<>': x !== y, '<': x < y, '>': x > y, '<=': x <= y, '>=': x >= y }[op];
    };
    const v = expression();
    espaces();
    if (i < texte.length) throw new ErreurFormule('#NAME?', `reste « ${texte.slice(i)} » dans ${texte}`);
    return v;
  }

  return {
    /** La valeur que le lecteur verra dans une cellule · { valeur } ou { erreur }. */
    cellule(nomFeuille, adresse) {
      try {
        return { valeur: lireCellule(nomFeuille, adresse, new Set()) };
      } catch (e) {
        return { erreur: e instanceof ErreurFormule ? e.message : `exception · ${e.message}` };
      }
    },
  };
}

/**
 * RELECTURE D'UNE LIASSE · le classeur produit est ouvert, la feuille
 * CONTROLES calculée ligne à ligne (aucune formule en erreur, chaque ligne
 * « doit être 0 » à zéro), puis les totaux qu'elle désigne (BZ, DZ, XI, ZH…)
 * confrontés aux états servis par l'API (`attendus`, clé = code entre
 * parenthèses dans l'intitulé de la ligne).
 */
export async function relireLiasse(c, R, libelle, chemin, attendus = {}) {
  const r = await c.lire(`Liasse Excel ${libelle}`, chemin);
  if (!R.egal(`${libelle} · liasse Excel produite (classeur non vide)`, true, Boolean(r?.octets > 1000)) || !r?.contenu) return null;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(r.contenu);
  const ev = evaluateur(wb);
  const feuilles = wb.worksheets.map((w) => w.name);
  for (const nomFeuille of ['CONTROLES', 'CONTROLE BALANCE']) {
    const ws = wb.getWorksheet(nomFeuille);
    if (!R.egal(`${libelle} · feuille ${nomFeuille} présente`, true, Boolean(ws))) continue;
    const erreurs = [];
    let formules = 0;
    let nonEvaluees = 0;
    ws.eachRow((row) => {
      row.eachCell((cell) => {
        const brut = cell.value;
        const estFormule = brut && typeof brut === 'object' && ('formula' in brut || 'sharedFormula' in brut);
        const estErreur = brut && typeof brut === 'object' && 'error' in brut;
        if (!estFormule && !estErreur && !(typeof brut === 'string' && /^#(REF!|VALUE!|DIV\/0!|NAME\?|N\/A)/.test(brut))) return;
        formules += estFormule ? 1 : 0;
        const v = ev.cellule(nomFeuille, cell.address);
        if (v.erreur?.startsWith('NON ÉVALUÉE')) nonEvaluees += 1;
        else if (v.erreur) erreurs.push(`${cell.address} · ${v.erreur}`);
        else if (estErreur || typeof brut === 'string') erreurs.push(`${cell.address} · ${JSON.stringify(brut)}`);
      });
    });
    R.egal(`${libelle} · ${nomFeuille} · aucune formule en erreur (${formules} formule(s))`, [], erreurs);
    if (nonEvaluees) R.note(`${libelle} · ${nomFeuille} · ${nonEvaluees} formule(s) hors de ce que l'évaluateur du banc calcule`);
  }
  const ctl = wb.getWorksheet('CONTROLES');
  const lignes = [];
  if (ctl) {
    ctl.eachRow((row, n) => {
      if (n === 1) return;
      const intitule = String(row.getCell(1).value ?? '');
      const lu = ev.cellule('CONTROLES', `B${n}`);
      const attendu = row.getCell(3).value;
      lignes.push({ intitule, ...lu, attendu });
    });
    // Une ligne qui porte un code dont l'attendu est donné (XC d'un projet qui
    // a un résultat propre) se juge sur cet attendu, pas sur le zéro du modèle.
    const codeDe = (intitule) => Object.keys(attendus).find((code) => new RegExp(`[( ]${code}[ )]`).test(intitule));
    for (const l of lignes) {
      if (l.attendu === 0 && !codeDe(l.intitule)) R.montant(`${libelle} · CONTROLES · ${l.intitule}`, 0, l.erreur ? null : l.valeur);
    }
  }
  for (const [code, montant] of Object.entries(attendus)) {
    const l = lignes.find((x) => new RegExp(`[( ]${code}[ )]`).test(x.intitule));
    R.montant(`${libelle} · liasse · ${code} lu par la feuille CONTROLES = état servi`, montant, l && !l.erreur ? l.valeur : null);
  }
  return { wb, feuilles, lignes, ev };
}

// --- Contrôles de clôture ----------------------------------------------------------

/**
 * LES CONTRÔLES LEVÉS À LA FIN DE L'EXERCICE, confrontés à ceux que le
 * scénario doit lever. `attendus` · { code: raison } ; un code levé hors de
 * la liste est un contrôle levé À TORT tant que le README ne dit pas pourquoi
 * il est juste, un code de la liste absent est un contrôle MANQUANT.
 */
export async function confronterControles(c, R, libelle, exerciceId, attendus) {
  const rapport = await c.lire(`Contrôles ${libelle}`, `/controles?exerciceId=${exerciceId}`);
  if (!rapport) return null;
  const anomalies = rapport.anomalies ?? [];
  const leves = [...new Set(anomalies.map((a) => a.code))].sort();
  const voulus = Object.keys(attendus).sort();
  // Une liste vide d'attendus ne se juge pas · elle sert au premier relevé.
  for (const code of voulus) {
    const att = typeof attendus[code] === 'string' ? { raison: attendus[code] } : attendus[code];
    R.egal(`${libelle} · contrôle ${code} levé (${att.raison})`, true, leves.includes(code));
    if (att.references) {
      const refs = occurrences(rapport, code).map((o) => o.split(' ')[0]).sort();
      R.egal(`${libelle} · contrôle ${code} · occurrences`, [...att.references].sort(), refs);
    }
  }
  const enTrop = leves.filter((x) => !voulus.includes(x));
  R.egal(`${libelle} · aucun contrôle levé hors de la liste attendue`, [], enTrop);
  for (const a of anomalies.filter((x) => enTrop.includes(x.code))) {
    R.note(`${libelle} · ${a.code} (${a.gravite}) · ${a.libelle} · ${(a.occurrences ?? []).slice(0, 4).map((o) => `${o.reference ?? ''} ${o.detail ?? ''}`.trim()).join(' | ')}`);
  }
  return { anomalies, leves };
}

/** Les occurrences d'un contrôle, par leur référence (le compte pour la banque). */
export function occurrences(rapport, code) {
  return (rapport?.anomalies ?? []).filter((a) => a.code === code).flatMap((a) => (a.occurrences ?? []).map((o) => o.reference ?? ''));
}

// --- Rapprochement bancaire sur relevé importé -------------------------------------

/**
 * LE PREMIER RAPPROCHEMENT D'UN COMPTE, SUR UN RELEVÉ CSV · solde de départ
 * déclaré (lu sur le relevé, jamais deviné), import, propositions, confirmation,
 * clôture. `releve` · [date AAAA-MM-JJ, libellé, débit banque, crédit banque]
 * (un crédit de la banque est un débit du 52).
 */
export async function rapprochementSurReleve(c, R, { libelle, numero, dateDepart, soldeDepart, dateReleve, releve, attendus }) {
  const ouvert = await c.geste(`${libelle} · ouverture`, 'POST', '/rapprochements', {
    compteId: compte(c, numero), dateReleve, soldeReleve: attendus.soldeReleve,
  });
  if (!ouvert) return null;
  const id = ouvert.id;
  await c.geste(`${libelle} · solde de départ déclaré`, 'PATCH', `/rapprochements/${id}/depart`, { soldeDepart, dateDepart });
  const jj = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;
  const csv = ['Date;Libellé;Débit;Crédit', ...releve.map(([d, l, deb, cre]) => `${jj(d)};${l};${deb || ''};${cre || ''}`)].join('\n');
  const imp = await c.geste(`${libelle} · import du relevé CSV`, 'POST', `/rapprochements/${id}/releve`, {
    nomFichier: `releve-${numero}-${dateReleve}.csv`, contenuBase64: Buffer.from(csv, 'utf8').toString('base64'),
  });
  void imp;
  const avant = await c.lire(`${libelle} · état après import`, `/rapprochements/${id}`);
  R.montant(`${libelle} · lignes du relevé importées`, releve.length, avant?.releve?.length);
  R.montant(`${libelle} · écart d'ouverture (livre à la veille − départ − en-cours)`, 0, avant?.ouverture?.ecart);
  R.montant(`${libelle} · contrôle du relevé (départ + opérations − solde imprimé)`, 0, avant?.ecartReleve);
  // L'écran demande toujours la fenêtre (15 jours par défaut, RapprochementDetailPage) ·
  // la route la déclare facultative, et son absence est éprouvée à part.
  const sansFenetre = await c.req('GET', `/rapprochements/${id}/propositions`);
  R.egal(`${libelle} · propositions sans fenêtre de dates (paramètre déclaré facultatif) · servies`, 200, sansFenetre.statut);
  const props = await c.lire(`${libelle} · propositions`, `/rapprochements/${id}/propositions?fenetreJours=15`);
  const liste = props?.propositions ?? (Array.isArray(props) ? props : []);
  R.montant(`${libelle} · propositions (une par ligne du relevé)`, attendus.propositions, liste.length);
  R.egal(`${libelle} · motifs des propositions`, attendus.motifs, [...new Set(liste.map((p) => p.motif))].sort());
  if (liste.length) {
    await c.geste(`${libelle} · confirmation des propositions`, 'POST', `/rapprochements/${id}/correspondances`, {
      correspondances: liste.map((p) => ({ ligneReleveId: p.ligneReleveId, ligneEcritureIds: p.ligneEcritureIds })),
    });
  }
  const apres = await c.lire(`${libelle} · état après confirmation`, `/rapprochements/${id}`);
  R.montant(`${libelle} · solde pointé = solde du relevé`, attendus.soldeReleve, apres?.soldePointe);
  R.montant(`${libelle} · écart`, 0, apres?.ecart);
  const suspens = (apres?.lignes ?? []).filter((l) => !l.pointee);
  R.montant(`${libelle} · lignes du livre en suspens (non passées par la banque)`, attendus.suspens.length, suspens.length);
  R.montant(`${libelle} · montant en suspens (débit − crédit)`, attendus.suspens.reduce((t, x) => t + x, 0),
    suspens.reduce((t, l) => t + Number(l.debit) - Number(l.credit), 0));
  const clos = await c.geste(`${libelle} · clôture du rapprochement`, 'POST', `/rapprochements/${id}/cloturer`);
  R.egal(`${libelle} · rapprochement clos`, 'CLOTURE', clos ? (await c.lire(`${libelle} · relecture`, `/rapprochements/${id}`))?.rapprochement?.statut : null);
  return id;
}

// --- Import d'écritures par le modèle de fichier ---------------------------------

/**
 * L'EN-TÊTE DU MODÈLE D'IMPORT DES ÉCRITURES, LU DANS L'INTERFACE · le banc
 * remplit le fichier que l'écran propose de télécharger
 * (`client/src/lib/modele-import.ts`), jamais un en-tête de son invention.
 */
export function enteteModeleImportEcritures() {
  const source = readFileSync(join(ICI, '../../client/src/lib/modele-import.ts'), 'utf8');
  const m = /ECRITURES:\s*\[\s*'([^']+)'/.exec(source);
  if (!m) throw new Error('En-tête du modèle d’import des écritures introuvable dans client/src/lib/modele-import.ts');
  return m[1];
}

/**
 * Un import d'écritures · le fichier suit le modèle, la correspondance des
 * colonnes est celle que l'analyse PROPOSE (aucune colonne désignée à la
 * main), puis l'import est exécuté.
 */
export async function importerEcritures(c, R, libelle, { exerciceId, journalId, lignes }) {
  const entete = enteteModeleImportEcritures();
  const csv = [entete, ...lignes.map((l) => l.join(';'))].join('\n');
  const contenuBase64 = Buffer.from(csv, 'utf8').toString('base64');
  const analyse = await c.geste(`${libelle} · analyse du fichier`, 'POST', '/import/analyser', {
    type: 'ECRITURES', nomFichier: 'import-ecritures.csv', contenuBase64,
  });
  R.egal(`${libelle} · le modèle de fichier est reconnu sans colonne manquante`, [], analyse?.manquants ?? null);
  const mapping = Object.fromEntries(Object.entries(analyse?.mappingPropose ?? {}).filter(([, v]) => v));
  return c.geste(`${libelle} · exécution`, 'POST', '/import/executer', {
    type: 'ECRITURES', nomFichier: 'import-ecritures.csv', contenuBase64, mapping, exerciceId, journalId, separateur: ';',
  });
}

// --- Modèle de saisie ------------------------------------------------------------------

/**
 * DÉROULER UN MODÈLE comme l'écran de saisie le fait (fonctions de ligne de
 * Sage i7 · Saisir, Répéter, Calculer, Équilibrer, l'équilibrage en dernier).
 * Le banc refait le calcul pour proposer les lignes, comme l'écran · les
 * montants qu'il attend sont dans le README, calculés à la main.
 */
export function deroulerModele(lignes, saisies, taux) {
  const ordonnees = [...lignes].sort((a, b) => a.ordre - b.ordre);
  const montants = [];
  ordonnees.forEach((l, i) => {
    const f = l.fonction ?? 'SAISIR';
    if (f === 'SAISIR') montants[i] = l.montant !== null && l.montant !== undefined ? Number(l.montant) : (saisies[i] ?? 0);
    else if (f === 'REPETER') montants[i] = montants[i - 1] ?? 0;
    else if (f === 'CALCULER') {
      const t = taux.find((x) => x.id === l.tauxTvaId);
      montants[i] = t ? auCentime((montants[i - 1] ?? 0) * Number(t.taux) / 100) : 0;
    } else montants[i] = 0;
  });
  const iEq = ordonnees.findIndex((l) => l.fonction === 'EQUILIBRER');
  if (iEq >= 0) {
    let s = 0;
    ordonnees.forEach((l, i) => {
      if (i !== iEq) s += l.sens === 'DEBIT' ? montants[i] : -montants[i];
    });
    const v = ordonnees[iEq].sens === 'CREDIT' ? s : -s;
    montants[iEq] = v < 0 ? 0 : auCentime(v);
  }
  return ordonnees.map((l, i) => ({
    compteId: l.compteId,
    debit: l.sens === 'DEBIT' ? montants[i] : 0,
    credit: l.sens === 'CREDIT' ? montants[i] : 0,
    ...(l.fonction === 'CALCULER' && l.tauxTvaId ? { tauxTvaId: l.tauxTvaId } : {}),
  }));
}
