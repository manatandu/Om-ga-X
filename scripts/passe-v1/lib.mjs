/**
 * OUTILS DU BANC DE LA PASSE V1 · client HTTP, contrôles et bilan.
 *
 * Le banc NE CORRIGE RIEN et NE CONTOURNE AUCUNE RÈGLE · il joue les gestes
 * d'un cabinet par l'API du serveur compilé, lit ce que le logiciel rend et le
 * compare à un montant ATTENDU calculé à la main (README.md). Un geste refusé
 * est consigné avec son statut et son corps, et le scénario continue avec ce
 * qu'il peut.
 */

export const BASE = process.env.OMEGAX_API ?? 'http://localhost:8745';
export const MOT_DE_PASSE = 'MotDePasse-passe-v1-2026!';
let compteurAdresse = 1;

/** Un montant au centime · le flottant de JavaScript ne se compare jamais tel quel. */
export const auCentime = (x) => Math.round(Number(x) * 100) / 100;

/**
 * LE JOUR DU BANC · celui de l'horloge du serveur quand `lancer.sh` la pose
 * (PASSE_HORLOGE, voir README), sinon le jour réel. Le banc le lit pour savoir
 * ce que le serveur tiendra pour « à venir » ou « échu ».
 */
export function aujourdhui() {
  const h = process.env.PASSE_HORLOGE;
  return h ? h.slice(0, 10) : new Date().toISOString().slice(0, 10);
}

// --- Le registre des contrôles ---------------------------------------------

export class Registre {
  constructor() {
    this.controles = [];
    this.erreurs = [];
    this.constats = [];
    this.scenario = '';
  }

  /** Un contrôle chiffré · concorde au centime, sinon écart (attendu, lu, différence). */
  montant(libelle, attendu, lu) {
    const l = lu === undefined || lu === null || Number.isNaN(Number(lu)) ? null : auCentime(lu);
    const a = auCentime(attendu);
    const ok = l !== null && Math.abs(l - a) < 0.005;
    const c = { scenario: this.scenario, libelle, attendu: a, lu: l, difference: l === null ? null : auCentime(l - a), verdict: ok ? 'concorde' : 'écart' };
    this.controles.push(c);
    this.imprimer(c);
    return ok;
  }

  /** Un contrôle d'égalité exacte (texte, booléen, statut). */
  egal(libelle, attendu, lu) {
    const ok = JSON.stringify(attendu) === JSON.stringify(lu);
    const c = { scenario: this.scenario, libelle, attendu, lu: lu === undefined ? null : lu, difference: null, verdict: ok ? 'concorde' : 'écart' };
    this.controles.push(c);
    this.imprimer(c);
    return ok;
  }

  imprimer(c) {
    const marque = c.verdict === 'concorde' ? 'concorde' : 'ÉCART   ';
    const detail = c.verdict === 'concorde'
      ? ''
      : ` · attendu ${JSON.stringify(c.attendu)}, lu ${JSON.stringify(c.lu)}${c.difference !== null ? `, différence ${c.difference}` : ''}`;
    console.log(`  [${marque}] ${c.libelle}${detail}`);
  }

  erreurHttp(geste, methode, chemin, statut, corps) {
    const e = { scenario: this.scenario, geste, methode, chemin, statut, corps };
    this.erreurs.push(e);
    console.log(`  [HTTP ${statut}] ${geste} · ${methode} ${chemin} · ${JSON.stringify(corps).slice(0, 600)}`);
  }

  /** Une remarque du banc (geste sauté faute d'un préalable, lecture absente). */
  note(texte) {
    this.constats.push({ scenario: this.scenario, texte });
    console.log(`  [note] ${texte}`);
  }

  bilan() {
    const ecarts = this.controles.filter((c) => c.verdict !== 'concorde');
    return {
      date: new Date().toISOString(),
      api: BASE,
      nombreControles: this.controles.length,
      concordances: this.controles.length - ecarts.length,
      nombreEcarts: ecarts.length,
      nombreErreursHttp: this.erreurs.length,
      ecarts,
      erreursHttp: this.erreurs,
      notes: this.constats,
      controles: this.controles,
    };
  }
}

// --- Le client --------------------------------------------------------------

/** Un client par dossier · cookie de session et jeton CSRF à lui. */
export class Client {
  constructor(registre) {
    // UNE ADRESSE CLIENTE PAR DOSSIER · la limite générale de débit est par
    // adresse (app.module.ts), comme dans les tests navigateur (outils.ts).
    const n = (Date.now() + compteurAdresse++ * 7919) % 16_777_216;
    this.adresse = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
    this.cookie = '';
    this.csrf = '';
    this.registre = registre;
  }

  async req(methode, chemin, corps) {
    const r = await fetch(BASE + chemin, {
      method: methode,
      headers: {
        'X-Forwarded-For': this.adresse,
        ...(corps === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(this.cookie ? { Cookie: this.cookie } : {}),
        ...(this.csrf && methode !== 'GET' ? { 'X-CSRF-Token': this.csrf } : {}),
      },
      body: corps === undefined ? undefined : JSON.stringify(corps),
    });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const kv = c.split(';')[0];
      if (kv.startsWith('__session=')) this.cookie = kv;
    }
    const type = r.headers.get('content-type') ?? '';
    let json;
    if (type.includes('json') || type.includes('text')) {
      const texte = await r.text();
      try {
        json = texte ? JSON.parse(texte) : undefined;
      } catch {
        json = texte;
      }
    } else {
      const octets = Buffer.from(await r.arrayBuffer());
      // Le contenu reste à portée de la relecture (liasse, restitution,
      // cloisonnement) · il n'entre jamais dans le fichier de résultats, qui
      // ne recopie que les corps des refus.
      json = { octets: octets.length, type, contenu: octets };
    }
    if (json && typeof json.csrfToken === 'string') this.csrf = json.csrfToken;
    return { statut: r.status, corps: json };
  }

  /**
   * UN GESTE · un refus est CONSIGNÉ (statut et corps) et rend `null`, le
   * scénario continue. Jamais un second essai qui contournerait le refus.
   */
  async geste(libelle, methode, chemin, corps) {
    const r = await this.req(methode, chemin, corps);
    if (r.statut >= 400) {
      this.registre.erreurHttp(libelle, methode, chemin, r.statut, r.corps);
      return null;
    }
    return r.corps ?? {};
  }

  /** Une lecture · même règle qu'un geste. */
  lire(libelle, chemin) {
    return this.geste(libelle, 'GET', chemin);
  }
}

// --- Le dossier -------------------------------------------------------------

/** Un dossier neuf, né par l'inscription comme dans les tests navigateur. */
export async function nouveauDossier(registre, nom, options) {
  const c = new Client(registre);
  c.email = `passe-v1-${options.cle}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@exemple.cd`;
  c.nom = nom;
  const r = await c.geste('Inscription du dossier', 'POST', '/auth/register', {
    nomEntite: nom,
    referentiel: options.referentiel,
    ...(options.systeme ? { systemeComptableSyscohada: options.systeme } : {}),
    ...(options.jeu ? { jeuEtatsFinanciersSycebnl: options.jeu } : {}),
    email: c.email,
    motDePasse: MOT_DE_PASSE,
    dateDebutExercice: options.exercice[0],
    dateFinExercice: options.exercice[1],
  });
  if (!r) throw new Error('Inscription refusée · le scénario ne peut pas commencer');
  c.moi = await c.lire('Session du dossier', '/auth/me');
  c.tenantId = c.moi?.tenant?.id ?? null;
  await rechargerComptes(c);
  c.journaux = (await c.lire('Journaux', '/journaux')) ?? [];
  c.journal = (code) => c.journaux.find((j) => j.code === code);
  c.od = c.journal('OD') ?? c.journaux.find((j) => j.type === 'GENERAL');
  await rechargerExercices(c);
  return c;
}

export async function rechargerComptes(c) {
  const comptes = (await c.lire('Plan des comptes', '/comptes')) ?? [];
  c.plan = comptes;
  c.comptes = new Map(comptes.map((x) => [x.numero, x]));
}

export async function rechargerExercices(c) {
  const exercices = (await c.lire('Exercices', '/exercices')) ?? [];
  c.exercices = new Map(exercices.map((e) => [e.dateDebut.slice(0, 4), e]));
}

/** L'identifiant d'un compte du plan SEMÉ · un numéro absent arrête le geste, jamais deviné. */
export function compte(c, numero) {
  const x = c.comptes.get(numero);
  if (!x) throw new Error(`Compte ${numero} absent du plan du dossier`);
  return x.id;
}

/**
 * Une écriture · lignes [numéro, débit, crédit, extra?]. `extra` porte ce que
 * la ligne a en plus (devise, tiers, échéance, ventilations).
 */
export async function ecriture(c, libelleGeste, exerciceId, date, libelle, lignes, options = {}) {
  let corpsLignes;
  try {
    corpsLignes = lignes.map(([numero, debit, credit, extra]) => ({
      compteId: compte(c, numero),
      libelle,
      debit,
      credit,
      ...(extra ?? {}),
    }));
  } catch (e) {
    c.registre.note(`${libelleGeste} · non passée · ${e.message}`);
    return null;
  }
  return c.geste(libelleGeste, 'POST', '/ecritures', {
    exerciceId,
    journalId: (options.journal ?? c.od).id,
    date,
    libelle,
    ...(options.reference ? { reference: options.reference } : {}),
    lignes: corpsLignes,
  });
}

export const validerJusqua = (c, exerciceId, dateLimite) =>
  c.geste(`Validation jusqu’au ${dateLimite}`, 'POST', '/ecritures/valider-jusqua', { exerciceId, dateLimite });

// --- Lectures ---------------------------------------------------------------

/** La balance d'un exercice · { numero → { debit, credit, solde } } et ses totaux. */
export async function balance(c, exerciceId) {
  const b = await c.lire('Balance', `/ecritures/balance?exerciceId=${exerciceId}`);
  if (!b) return null;
  const lignes = Array.isArray(b) ? b : (b.lignes ?? b.comptes ?? []);
  const parNumero = new Map();
  let totalDebit = 0;
  let totalCredit = 0;
  for (const l of lignes) {
    const numero = l.numero ?? l.compte?.numero;
    const d = Number(l.totalDebit ?? l.debit ?? 0);
    const cr = Number(l.totalCredit ?? l.credit ?? 0);
    parNumero.set(numero, { debit: d, credit: cr, solde: auCentime(d - cr), brut: l });
    totalDebit += d;
    totalCredit += cr;
  }
  return { parNumero, totalDebit: auCentime(totalDebit), totalCredit: auCentime(totalCredit), brut: b };
}

/** Solde (débit moins crédit) d'un compte ou d'une racine · somme des comptes de détail qui commencent par elle. */
export function solde(bal, racine) {
  if (!bal) return null;
  let s = 0;
  for (const [numero, l] of bal.parNumero) if (numero && numero.startsWith(racine)) s += l.solde;
  return auCentime(s);
}

/** Aplatit un état en { ref → { n, n1 } } · toutes les listes de lignes rencontrées. */
export function aplatir(objet) {
  const m = {};
  const visiter = (o) => {
    if (Array.isArray(o)) {
      for (const x of o) visiter(x);
      return;
    }
    if (o && typeof o === 'object') {
      if (typeof o.ref === 'string' && o.ref && ('montant' in o || 'net' in o || 'montantN1' in o || 'netN1' in o)) {
        const lu = { n: o.net ?? o.montant ?? null, n1: o.netN1 ?? o.montantN1 ?? null };
        m[o.ref] = m[o.ref] ? { n: m[o.ref].n ?? lu.n, n1: m[o.ref].n1 ?? lu.n1 } : lu;
      }
      for (const v of Object.values(o)) if (v && typeof v === 'object') visiter(v);
    }
  };
  visiter(objet);
  return m;
}

/** Une étape · une exception du banc est consignée et le scénario continue. */
export async function etape(registre, nom, fn) {
  console.log(` · ${nom}`);
  try {
    return await fn();
  } catch (e) {
    registre.note(`Étape « ${nom} » interrompue · ${e.message}`);
    return null;
  }
}

// --- Gestes courants ----------------------------------------------------------

/** Un tiers avec son compte individuel · rend { id, compteId, numero }. */
export async function tiers(c, type, code, nom) {
  const t = await c.geste(`Tiers ${code}`, 'POST', '/tiers', { type, code, nom, creerCompteIndividuel: true });
  if (!t) return null;
  await rechargerComptes(c);
  return { id: t.id, compteId: t.compteIndividuel?.id, numero: t.compteIndividuel?.numero };
}

/** La ligne d'une écriture rendue par le serveur, retrouvée par son compte. */
export function ligneDe(c, e, numero) {
  if (!e?.lignes) return null;
  const id = c.comptes.get(numero)?.id;
  return e.lignes.find((l) => l.compteId === id) ?? null;
}

/** Les lignes d'un compte au grand livre de l'exercice. */
export async function lignesDuCompte(c, numero, exerciceId) {
  const id = c.comptes.get(numero)?.id;
  if (!id) return [];
  const g = await c.lire(`Grand livre ${numero}`, `/ecritures/grand-livre/${id}?exerciceId=${exerciceId}`);
  if (!g) return [];
  return g.lignes ?? g.mouvements ?? (Array.isArray(g) ? g : []);
}

/** Lettrage manuel · total ou partiel, comme l'écran le propose. */
export function lettrer(c, numero, ligneIds, partiel = false) {
  const id = c.comptes.get(numero)?.id;
  return c.geste(`Lettrage ${numero}${partiel ? ' (partiel)' : ''}`, 'POST', `/comptes/${id}/lettrage`, {
    ligneIds,
    ...(partiel ? { autoriserPartiel: true } : {}),
  });
}

/** Clôture annuelle · rend vrai si elle passe. */
export async function cloturer(c, annee, corps = {}) {
  const id = c.exercices.get(annee)?.id;
  const r = await c.geste(`Clôture de l’exercice ${annee}`, 'POST', `/exercices/${id}/cloturer`, corps);
  await rechargerExercices(c);
  return r !== null;
}

/**
 * LIVRES EXPORTÉS ET RESTITUTION · journal, grand livre et balance de
 * l'exercice (AUDCIF art. 22, 6°) et l'archive de restitution du dossier.
 * Le banc ne relit pas le contenu des classeurs (leurs tests le font) · il
 * vérifie qu'ils sortent, non vides, sur un dossier réel de deux exercices.
 */
export async function livresExportes(c, R, exerciceId, an) {
  for (const [nom, chemin] of [
    ['journal', `/exports/journal?exerciceId=${exerciceId}`],
    ['grand livre', `/exports/grand-livre?exerciceId=${exerciceId}`],
    ['balance', `/exports/balance?exerciceId=${exerciceId}`],
  ]) {
    const r = await c.lire(`Export ${nom} ${an}`, chemin);
    R.egal(`${an} · export ${nom} produit (classeur non vide)`, true, Boolean(r?.octets > 1000));
  }
}

/**
 * L'ARCHIVE DE RESTITUTION, RELUE · produite, manifeste présent et nommant le
 * dossier, `controles.txt` sans écart entre l'inventaire annoncé et les lignes
 * écrites, tables principales non vides (une table vide sortirait d'une
 * borne fausse aussi bien que d'un dossier vide · ces tables ne le sont pas).
 * Rend les entrées de l'archive, que le scénario de cloisonnement fouille.
 */
export async function restitution(c, R, libelle = 'restitution') {
  const r = await c.lire('Archive de restitution', '/restitution/archive');
  if (!R.egal(`${libelle} · archive du dossier produite (non vide)`, true, Boolean(r?.octets > 1000)) || !r?.contenu) return null;
  const { entreesZip, enregistrementsCsv } = await import('./parcours.mjs');
  const entrees = await entreesZip(r.contenu);
  const texte = (nom) => (entrees.get(nom) ?? Buffer.alloc(0)).toString('utf8');
  R.egal(`${libelle} · manifeste présent`, true, texte('MANIFESTE.md').length > 0);
  R.egal(`${libelle} · le manifeste nomme le dossier`, true, Boolean(c.nom) && texte('MANIFESTE.md').includes(c.nom));
  // controles.txt confronte, table par table, les lignes annoncées par
  // l'inventaire à celles réellement écrites · ses lignes « ECART » sont
  // relevées telles quelles, et le nombre réel de lignes de chaque CSV est
  // relu à côté (tables/<table>.csv), pour départager l'archive et son contrôle.
  // Le maillon d'audit de la restitution elle-même s'écrit APRÈS l'inventaire
  // (restitution.service.ts, il porte cet inventaire) · EvenementAudit a donc
  // exactement une ligne écrite de plus qu'annoncée. Écart voulu, que
  // controles.txt explique en tête ; toute autre forme reste relevée.
  const estLeMaillonDeLaRestitution = (l) => {
    const [table, annonce, ecrit] = l.split(';');
    return table === 'EvenementAudit' && Number(ecrit) === Number(annonce) + 1;
  };
  const ecartsDits = texte('controles.txt').split(/\r?\n/)
    .filter((l) => l.endsWith(';ECART') && !estLeMaillonDeLaRestitution(l));
  R.egal(`${libelle} · controles.txt · aucune table en écart entre l'inventaire et les lignes écrites`, [], ecartsDits.slice(0, 6));
  const ecritureCsv = entrees.has('tables/ecriture.csv') ? enregistrementsCsv(texte('tables/ecriture.csv')) - 1 : null;
  const ditEcriture = texte('controles.txt').split(/\r?\n/).find((l) => l.startsWith('Ecriture;'))?.split(';');
  if (ditEcriture) {
    R.montant(`${libelle} · controles.txt · lignes d'écriture annoncées = lignes du CSV`, ecritureCsv ?? NaN, Number(ditEcriture[1]));
    R.montant(`${libelle} · controles.txt · lignes d'écriture dites écrites = lignes du CSV`, ecritureCsv ?? NaN, Number(ditEcriture[2]));
  }
  for (const table of ['tenant', 'exercice', 'journal', 'compte', 'tiers', 'ecriture', 'ligne-ecriture', 'evenement-audit']) {
    const nom = `tables/${table}.csv`;
    const lignes = entrees.has(nom) ? enregistrementsCsv(texte(nom)) - 1 : null;
    R.egal(`${libelle} · table ${table} présente et non vide`, true, lignes !== null && lignes > 0);
  }
  const exercices = entrees.has('tables/exercice.csv') ? enregistrementsCsv(texte('tables/exercice.csv')) - 1 : null;
  R.montant(`${libelle} · table exercice · une ligne par exercice du dossier`, c.exercices?.size ?? 0, exercices);
  return entrees;
}
