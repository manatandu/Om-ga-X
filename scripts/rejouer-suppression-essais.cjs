#!/usr/bin/env node
'use strict';
/**
 * REJEU, SUR VRAIE BASE, DE LA SUPPRESSION D'UN DOSSIER D'ESSAI ÉCHU
 * (ligne suppression-essais, décision de Manasse du 2026-10-17).
 *
 * CLAUDE.md § 10 · « aucune ligne n'est intégrée sans un scénario sur vraie base » ·
 * les tests unitaires tournent sur des Prisma factices, et une purge qui ne
 * respecterait pas l'ordre des clés étrangères passerait tous les tests et
 * tomberait au premier dossier réel. Ce script monte le serveur COMPILÉ contre
 * une base PostgreSQL JETABLE (jamais celle de production), lui fait ouvrir un
 * dossier d'essai par l'API d'inscription, y saisit des données variées dont une
 * clôture d'exercice, vieillit sa licence, envoie le rappel par la console,
 * vieillit le rappel, supprime, puis PROUVE :
 *
 *   1. aucune ligne résiduelle du dossier, dans TOUTES les tables (celles qui
 *      portent `tenantId` par un comptage direct ; les autres, qu'un parent
 *      porte, par la différence exacte des décomptes avant et après) ;
 *   2. un dossier voisin, identique, intact au nombre de lignes près ;
 *   3. le dossier de l'opérateur intact, et la trace écrite (nombres seulement).
 *
 * Usage · DATABASE_URL pointe une base jetable DÉJÀ migrée (`prisma migrate
 * deploy`), le serveur est compilé (`npm run build`, `dist/`).
 *
 *   DATABASE_URL=postgresql://... node scripts/rejouer-suppression-essais.cjs
 *
 * Sort en code 0 si tout est prouvé, 1 sinon, avec la liste de ce qui ne l'est pas.
 */
const net = require('node:net');
const { existsSync } = require('node:fs');
const { join } = require('node:path');
const { spawn } = require('node:child_process');

const RACINE = join(__dirname, '..');
const URL_BASE = process.env.DATABASE_URL || '';
if (!URL_BASE) {
  console.error('DATABASE_URL est requis (une base JETABLE, déjà migrée).');
  process.exit(2);
}
if (/neon\.tech|\.run\.app|supabase\.co|amazonaws\.com/i.test(URL_BASE)) {
  console.error('Cette base ressemble à une base hébergée · ce script ne tourne que contre une base jetable locale.');
  process.exit(2);
}
const PORT_SERVEUR = Number(process.env.PORT_REJEU || 8091);
const PORT_SMTP = Number(process.env.PORT_SMTP_REJEU || 2526);
const API = `http://127.0.0.1:${PORT_SERVEUR}`;
const MOT_DE_PASSE = 'MotDePasse-rejeu-2026!';
const EMAIL_OPERATEUR = `operateur-${Date.now()}@exemple.invalid`;
const JOUR_MS = 86_400_000;
/** Le jour de Kinshasa (UTC+1) d'un instant, à minuit UTC · la règle de `common/echeance.ts`. */
function jourDeKinshasa(instant) {
  const local = new Date(instant.getTime() + 60 * 60 * 1000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
}

const { PrismaClient } = require(join(RACINE, 'node_modules', '@prisma', 'client'));
const prisma = new PrismaClient({ datasources: { db: { url: URL_BASE } } });

const sorties = []; // ce qui n'est pas prouvé
const verifier = (condition, message) => {
  if (!condition) {
    sorties.push(message);
    console.error(`  ECHEC · ${message}`);
  } else console.log(`  ok · ${message}`);
};
const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Une boîte SMTP de poche · reçoit les courriels du serveur (mot de passe
// provisoire de l'essai, rappel de suppression) sans rien envoyer dehors.
// ---------------------------------------------------------------------------
const courriels = [];
/** Le corps lisible d'un courriel brut · quoted-printable ou base64, comme nodemailer les écrit. */
function decoderCorps(brut) {
  const coupe = brut.indexOf('\r\n\r\n');
  const entetes = coupe < 0 ? brut : brut.slice(0, coupe);
  let corps = coupe < 0 ? '' : brut.slice(coupe + 4);
  if (/Content-Transfer-Encoding:\s*quoted-printable/i.test(entetes)) {
    const sansSouples = corps.replace(/=\r?\n/g, '');
    const octets = [];
    for (let i = 0; i < sansSouples.length; i += 1) {
      if (sansSouples[i] === '=' && /^[0-9A-F]{2}$/i.test(sansSouples.slice(i + 1, i + 3))) {
        octets.push(parseInt(sansSouples.slice(i + 1, i + 3), 16));
        i += 2;
      } else octets.push(...Buffer.from(sansSouples[i], 'utf8'));
    }
    corps = Buffer.from(octets).toString('utf8');
  } else if (/Content-Transfer-Encoding:\s*base64/i.test(entetes)) {
    corps = Buffer.from(corps.replace(/\s+/g, ''), 'base64').toString('utf8');
  }
  return `${entetes}\r\n\r\n${corps}`;
}
function demarrerSmtp() {
  const serveur = net.createServer((socket) => {
    let enDonnees = false;
    let tampon = '';
    let courant = { de: '', a: [], corps: '' };
    const ecrire = (s) => socket.write(s + '\r\n');
    ecrire('220 rejeu ESMTP');
    socket.on('data', (morceau) => {
      tampon += morceau.toString('utf8');
      for (;;) {
        if (enDonnees) {
          const fin = tampon.indexOf('\r\n.\r\n');
          if (fin < 0) return;
          courant.corps = decoderCorps(tampon.slice(0, fin));
          tampon = tampon.slice(fin + 5);
          courriels.push({ ...courant, recuLe: Date.now() });
          courant = { de: '', a: [], corps: '' };
          enDonnees = false;
          ecrire('250 ok');
          continue;
        }
        const i = tampon.indexOf('\r\n');
        if (i < 0) return;
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        const cmd = ligne.toUpperCase();
        if (cmd.startsWith('EHLO') || cmd.startsWith('HELO')) {
          socket.write('250-rejeu\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        } else if (cmd.startsWith('AUTH PLAIN')) ecrire('235 ok');
        else if (cmd.startsWith('AUTH LOGIN')) {
          ecrire('334 VXNlcm5hbWU6');
          socket.once('data', () => {
            ecrire('334 UGFzc3dvcmQ6');
            socket.once('data', () => ecrire('235 ok'));
          });
        } else if (cmd.startsWith('MAIL FROM')) {
          courant.de = ligne.slice(10);
          ecrire('250 ok');
        } else if (cmd.startsWith('RCPT TO')) {
          courant.a.push(ligne.slice(8).replace(/[<>]/g, '').trim());
          ecrire('250 ok');
        } else if (cmd === 'DATA') {
          enDonnees = true;
          ecrire('354 go');
        } else if (cmd === 'QUIT') {
          ecrire('221 bye');
          socket.end();
        } else ecrire('250 ok');
      }
    });
    socket.on('error', () => {});
  });
  return new Promise((resolve) => serveur.listen(PORT_SMTP, '127.0.0.1', () => resolve(serveur)));
}

// ---------------------------------------------------------------------------
// Le serveur compilé
// ---------------------------------------------------------------------------
function demarrerServeur() {
  const dist = process.env.OMEGAX_DIST || join(RACINE, 'dist');
  const point = [join(dist, 'main.js'), join(dist, 'src', 'main.js')].find((p) => existsSync(p));
  if (!point) throw new Error(`Serveur compilé introuvable sous ${dist} · lancer npm run build.`);
  const env = {
    ...process.env,
    DATABASE_URL: URL_BASE,
    JWT_SECRET: 'rejeu-jetable-0123456789abcdef0123456789abcdef',
    JWT_EXPIRES_IN: '8h',
    PORT: String(PORT_SERVEUR),
    CORS_ORIGIN: 'http://localhost:4173',
    INSCRIPTION_PUBLIQUE: 'true',
    INSCRIPTION_ESSAI: 'true',
    OPERATEURS_PLATEFORME: EMAIL_OPERATEUR,
    SMTP_HOST: '127.0.0.1',
    SMTP_PORT: String(PORT_SMTP),
    SMTP_USER: 'rejeu',
    SMTP_PASS: 'rejeu',
    SMTP_SECURE: 'false',
    COURRIER_EXPEDITEUR: 'rejeu@exemple.invalid',
    NODE_ENV: 'production',
    // Un serveur compilé ailleurs que sous la racine (OMEGAX_DIST) retrouve quand même ses dépendances.
    NODE_PATH: join(RACINE, 'node_modules'),
  };
  const enfant = spawn(process.execPath, [point], { env, cwd: RACINE, stdio: ['ignore', 'pipe', 'pipe'] });
  let journal = '';
  enfant.stdout.on('data', (d) => (journal += d));
  enfant.stderr.on('data', (d) => (journal += d));
  return { enfant, journal: () => journal };
}

async function attendreSante() {
  for (let i = 0; i < 60; i += 1) {
    try {
      const r = await fetch(`${API}/health`);
      if (r.ok) return;
    } catch {
      /* pas encore */
    }
    await attendre(1000);
  }
  throw new Error('Le serveur ne répond pas sur /health.');
}

// ---------------------------------------------------------------------------
// Un client HTTP à cookie et jeton CSRF
// ---------------------------------------------------------------------------
let compteurAdresse = 1;
class Client {
  constructor() {
    this.cookies = new Map();
    this.csrf = null;
    // Une adresse IP par client · la limite de débit est par adresse (le serveur fait confiance à l'en-tête posé par le relais).
    const n = (Date.now() + compteurAdresse++ * 7919) % 16_777_216;
    this.adresse = `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;
  }
  async appeler(methode, chemin, corps, { attendu = [200, 201], entetes = {} } = {}) {
    const h = { 'X-Forwarded-For': this.adresse, ...entetes };
    if (corps !== undefined) h['Content-Type'] = 'application/json';
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (this.csrf && methode !== 'GET') h['X-CSRF-Token'] = this.csrf;
    const r = await fetch(API + chemin, { method: methode, headers: h, body: corps === undefined ? undefined : JSON.stringify(corps) });
    for (const c of r.headers.getSetCookie?.() ?? []) {
      const [paire] = c.split(';');
      const i = paire.indexOf('=');
      const nom = paire.slice(0, i);
      const valeur = paire.slice(i + 1);
      if (valeur === '' || /expires=Thu, 01 Jan 1970/i.test(c)) this.cookies.delete(nom);
      else this.cookies.set(nom, valeur);
    }
    const texte = await r.text();
    let json;
    try {
      json = texte ? JSON.parse(texte) : undefined;
    } catch {
      json = texte;
    }
    if (json && typeof json === 'object' && typeof json.csrfToken === 'string') this.csrf = json.csrfToken;
    if (!attendu.includes(r.status)) {
      const e = new Error(`${methode} ${chemin} · ${r.status} · ${texte.slice(0, 400)}`);
      e.statut = r.status;
      e.corps = json;
      throw e;
    }
    return { statut: r.status, corps: json };
  }
  async televerser(chemin, formulaire) {
    const h = { 'X-Forwarded-For': this.adresse };
    if (this.cookies.size) h.Cookie = [...this.cookies].map(([k, v]) => `${k}=${v}`).join('; ');
    if (this.csrf) h['X-CSRF-Token'] = this.csrf;
    const r = await fetch(API + chemin, { method: 'POST', headers: h, body: formulaire });
    const texte = await r.text();
    if (r.status >= 300) throw new Error(`POST ${chemin} · ${r.status} · ${texte.slice(0, 300)}`);
    return texte ? JSON.parse(texte) : undefined;
  }
  get(c, o) { return this.appeler('GET', c, undefined, o).then((r) => r.corps); }
  post(c, b, o) { return this.appeler('POST', c, b === undefined ? {} : b, o).then((r) => r.corps); }
  patch(c, b, o) { return this.appeler('PATCH', c, b, o).then((r) => r.corps); }
}

// ---------------------------------------------------------------------------
// Une base de données de lecture · décomptes de toutes les tables
// ---------------------------------------------------------------------------
async function tables() {
  return (
    await prisma.$queryRawUnsafe(
      `SELECT table_name AS t FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations' ORDER BY 1`,
    )
  ).map((x) => x.t);
}
async function decomptes() {
  const sortie = {};
  for (const t of await tables()) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}"`);
    sortie[t] = n;
  }
  return sortie;
}
async function tablesAvecTenantId() {
  return (
    await prisma.$queryRawUnsafe(
      `SELECT table_name AS t FROM information_schema.columns WHERE table_schema = 'public' AND column_name = 'tenantId' ORDER BY 1`,
    )
  ).map((x) => x.t);
}
async function decomptesDuDossier(tenantId) {
  const sortie = {};
  for (const t of await tablesAvecTenantId()) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "${t}" WHERE "tenantId" = $1`, tenantId);
    sortie[t] = n;
  }
  return sortie;
}

// ---------------------------------------------------------------------------
// Un dossier d'essai, ouvert par l'API d'inscription, puis peuplé
// ---------------------------------------------------------------------------
function dernierMotDePasseRecu(adresse, depuis) {
  const m = [...courriels].reverse().find((c) => c.recuLe >= depuis && c.a.includes(adresse) && /Mot de passe provisoire/.test(c.corps));
  if (!m) return null;
  const x = /Mot de passe provisoire\s*·\s*(\S+)/.exec(m.corps.replace(/=\r\n/g, '').replace(/=\n/g, ''));
  return x ? x[1] : null;
}

async function ouvrirEssai(referentiel, etiquette) {
  const email = `essai-${etiquette}-${Date.now()}@exemple.invalid`;
  const depuis = Date.now() - 1;
  const anonyme = new Client();
  await anonyme.post('/auth/inscription-essai', {
    nomEntite: `Essai ${etiquette}`,
    referentiel,
    email,
    ...(referentiel === 'SYCEBNL' ? { jeuEtatsFinanciersSycebnl: 'ASSOCIATIONS_ORDRES_PROFESSIONNELS' } : { systemeComptableSyscohada: 'NORMAL' }),
  });
  let mot = null;
  for (let i = 0; i < 30 && !mot; i += 1) {
    mot = dernierMotDePasseRecu(email, depuis);
    if (!mot) await attendre(300);
  }
  if (!mot) throw new Error(`Le courriel d'inscription de ${email} n'est pas arrivé à la boîte SMTP (${courriels.length} reçus ; dernier : ${JSON.stringify(courriels[courriels.length - 1])?.slice(0, 600)}).`);
  const c = new Client();
  await c.post('/auth/login', { email, motDePasse: mot });
  await c.post('/auth/changer-mot-de-passe', { motDePasseActuel: mot, nouveauMotDePasse: MOT_DE_PASSE });
  const moi = await c.get('/auth/me');
  return { c, email, tenantId: moi.tenantId ?? moi.user?.tenantId ?? moi.tenant?.id };
}

const etapes = [];
async function etape(nom, f, { essentielle = true } = {}) {
  try {
    const r = await f();
    etapes.push({ nom, ok: true });
    return r;
  } catch (e) {
    etapes.push({ nom, ok: false, erreur: e.message });
    console.error(`  (saisie) ${nom} · ${e.message.slice(0, 220)}`);
    if (essentielle) throw e;
    return undefined;
  }
}

async function peupler(c, referentiel) {
  const exercices = await c.get('/exercices');
  const ex = exercices[0];
  const annee = Number(ex.dateDebut.slice(0, 4));
  const debut = ex.dateDebut.slice(0, 10);
  const jour = (mois, j) => `${annee}-${String(mois).padStart(2, '0')}-${String(j).padStart(2, '0')}`;
  const comptes = await c.get('/comptes?typeCompte=DETAIL');
  const journaux = await c.get('/journaux');
  const trouver = (racine) => comptes.find((x) => x.numero.startsWith(racine));
  const adopter = async (racine) => {
    const x = trouver(racine);
    if (!x) throw new Error(`compte ${racine} absent du plan semé`);
    await c.patch(`/comptes/${x.id}`, { estRetenu: true });
    return x;
  };
  const od = journaux.find((j) => j.type === 'GENERAL') ?? journaux[0];
  const banqueJournal = journaux.find((j) => j.type === 'TRESORERIE') ?? od;

  const caisse = await etape('compte caisse/banque', () => adopter('52'));
  const produit = await etape('compte de produit', () => adopter(referentiel === 'SYCEBNL' ? '70' : '701'));
  const charge = await etape('compte de charge', () => adopter('605'), { essentielle: false }) ?? (await adopter('60'));

  const fournisseur = await etape('tiers fournisseur (panoplie)', () => c.post('/tiers', { type: 'FOURNISSEUR', code: 'F-REJEU', nom: 'Fournisseur rejeu' }));
  const client = await etape('tiers client (panoplie)', () => c.post('/tiers', { type: 'CLIENT', code: 'C-REJEU', nom: 'Client rejeu' }));
  const numeroF = fournisseur.panoplie.crees.find((x) => x.role === 'PRINCIPAL').numero;
  const numeroC = client.panoplie.crees.find((x) => x.role === 'PRINCIPAL').numero;
  const comptes2 = await c.get('/comptes?typeCompte=DETAIL');
  const cF = comptes2.find((x) => x.numero === numeroF);
  const cC = comptes2.find((x) => x.numero === numeroC);

  const ecr = (journalId, date, libelle, lignes) => c.post('/ecritures', { exerciceId: ex.id, journalId, date, libelle, lignes });
  const achat = await etape('écriture d’achat (fournisseur)', () =>
    ecr(od.id, jour(3, 10), 'Achat rejeu', [
      { compteId: charge.id, libelle: 'Achat', debit: 250_000, credit: 0 },
      { compteId: cF.id, libelle: 'Achat', debit: 0, credit: 250_000 },
    ]),
  );
  const reglement = await etape('écriture de règlement', () =>
    ecr(banqueJournal.id, jour(3, 28), 'Règlement rejeu', [
      { compteId: cF.id, libelle: 'Règlement', debit: 250_000, credit: 0 },
      { compteId: caisse.id, libelle: 'Règlement', debit: 0, credit: 250_000 },
    ]),
  );
  await etape('vente (client)', () =>
    ecr(od.id, jour(4, 2), 'Vente rejeu', [
      { compteId: cC.id, libelle: 'Vente', debit: 900_000, credit: 0 },
      { compteId: produit.id, libelle: 'Vente', debit: 0, credit: 900_000 },
    ]),
  );
  await etape('encaissement partiel', () =>
    ecr(banqueJournal.id, jour(4, 20), 'Encaissement rejeu', [
      { compteId: caisse.id, libelle: 'Encaissement', debit: 400_000, credit: 0 },
      { compteId: cC.id, libelle: 'Encaissement', debit: 0, credit: 400_000 },
    ]),
  );
  const erronee = await etape('écriture à corriger', () =>
    ecr(od.id, jour(5, 5), 'Erreur rejeu', [
      { compteId: charge.id, libelle: 'Erreur', debit: 10_000, credit: 0 },
      { compteId: caisse.id, libelle: 'Erreur', debit: 0, credit: 10_000 },
    ]),
  );
  await etape('validation jusqu’à fin juin', () => c.post('/ecritures/valider-jusqua', { exerciceId: ex.id, dateLimite: jour(6, 30) }));
  await etape('correction en négatif (écriture liée à l’erreur)', () =>
    c.post(`/ecritures/${erronee.id}/correction`, { date: jour(6, 30), motifCorrection: 'Erreur de saisie rejeu' }),
  );
  await etape('lettrage fournisseur (achat et règlement)', async () => {
    const ligneF = (e) => e.lignes.find((l) => l.compteId === cF.id).id;
    return c.post(`/comptes/${cF.id}/lettrage`, { ligneIds: [ligneF(achat), ligneF(reglement)] });
  }, { essentielle: false });
  await etape('pièce jointe d’écriture (PDF)', async () => {
    const f = new FormData();
    f.append('fichier', new Blob([Buffer.from('%PDF-1.4\n% rejeu\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n')], { type: 'application/pdf' }), 'piece.pdf');
    f.append('commentaire', 'Pièce rejeu');
    return c.televerser(`/ecritures/${achat.id}/pieces-jointes`, f);
  }, { essentielle: false });
  await etape('séquence de saisie + libellé', async () => {
    await c.post('/sequences-saisie', { intitule: 'Rejeu' });
    return c.post('/libelles-ecriture', { code: 'REJ', intitule: 'Libellé rejeu' });
  }, { essentielle: false });
  await etape('campagne d’inventaire + sous-commission', async () => {
    const camp = await c.post('/inventaire', { exerciceId: ex.id, dateInventaire: jour(6, 30), libelle: 'Inventaire rejeu' });
    return c.post(`/inventaire/${camp.id}/sous-commissions`, { nom: 'Sous-commission rejeu' });
  }, { essentielle: false });

  await etape('immobilisation + dotation + composant (auto-référence)', async () => {
    const materiel = await adopter('244');
    const base = {
      compteImmobilisationId: materiel.id,
      dateAcquisition: jour(2, 1),
      dateMiseEnService: jour(2, 1),
      dureeAmortissementAns: 5,
      modeAmortissement: 'LINEAIRE',
      compteContrepartieId: caisse.id,
      journalId: od.id,
      exerciceId: ex.id,
    };
    const bien = await c.post('/immobilisations', { ...base, designation: 'Photocopieur rejeu', valeurOrigine: 1_200_000 });
    await c.post(`/immobilisations/${bien.id}/dotation`, { exerciceId: ex.id, journalId: od.id });
    await c.post('/immobilisations', {
      ...base,
      designation: 'Pièce de sécurité rejeu',
      valeurOrigine: 100_000,
      immobilisationPrincipaleId: bien.id,
      typeComposant: 'PIECE_DE_SECURITE',
      justificationDecomposition: 'Pièce de sécurité du photocopieur',
    });
    return bien;
  }, { essentielle: false });

  await etape('facture de vente + note de crédit (auto-référence)', async () => {
    const taux = (await c.get('/taux-tva?actifsSeuls=true')).find((t) => Number(t.taux) >= 0);
    const facture = await c.post('/facturation', {
      sens: 'VENTE',
      numeroSerie: 'FV-REJEU-1',
      dateFacture: jour(4, 2),
      tiersId: client.id ?? client.tiers?.id,
      lignes: [{ designation: 'Prestation', quantite: 1, prixUnitaire: 100_000, montantHT: 100_000, ...(taux ? { tauxTvaId: taux.id, montantTva: (100_000 * Number(taux.taux)) / 100 } : {}) }],
    });
    return c.post(`/facturation/${facture.id}/note-de-credit`, { numeroSerie: 'NC-REJEU-1', dateNote: jour(4, 15) });
  }, { essentielle: false });

  await etape('plan analytique + section', async () => {
    const [plan] = await c.get('/analytique/plans');
    return c.post(`/analytique/plans/${plan.id}/sections`, { code: 'REJ1', intitule: 'Section rejeu' });
  }, { essentielle: false });

  await etape('banque + RIB', async () => {
    const b = await c.post('/banques', { intitule: 'Banque rejeu' });
    return c.post(`/banques/${b.id}/ribs`, { numeroCompte: '0001234567', abrege: 'REJ' });
  }, { essentielle: false });

  await etape('devise + cours', async () => {
    const d = await c.post('/devises', { code: 'USD', intitule: 'Dollar rejeu' });
    return c.post(`/devises/${d.id}/cours`, { date: jour(4, 1), cours: 2800 });
  }, { essentielle: false });

  await etape('article du magasin + entrée', async () => {
    const stock = await adopter(referentiel === 'SYCEBNL' ? '31' : '31');
    const a = await c.post('/magasin/articles', { compteId: stock.id, code: 'CIM', designation: 'Ciment', uniteMesure: 'sac', methodeValorisation: 'CMPACE' });
    return c.post(`/magasin/articles/${a.id}/mouvements`, { date: jour(3, 1), sens: 'ENTREE', quantite: 10, cout: 12_000, piece: 'BE-REJEU' });
  }, { essentielle: false });

  await etape('salarié + contrat + bulletin', async () => {
    await c.patch('/dossier/modules', { modulesActives: ['PAIE'] });
    const s = await c.post('/personnel/salaries', { nom: 'KABEYA', prenoms: 'Ruth', sexe: 'FEMININ', dateNaissance: '1990-07-11' });
    await c.post(`/personnel/salaries/${s.id}/contrats`, {
      type: 'DUREE_INDETERMINEE',
      dateEntreeEnVigueur: jour(1, 1),
      periodiciteRemuneration: 'MOIS',
      remunerationBase: 780_000,
      deviseRemuneration: 'CDF',
    });
    return c.post(`/personnel/salaries/${s.id}/bulletins`, {
      moisDePaie: `${annee}-03`,
      elements: [{ nature: 'SALAIRE_OU_TRAITEMENT', libelle: 'Salaire', montantFc: 780_000 }],
      natureEmployeurInpp: 'PRIVE',
      effectif: 12,
    });
  }, { essentielle: false });

  if (referentiel === 'SYSCOHADA') {
    await etape('devis + contre-proposition (auto-référence)', async () => {
      const devis = await c.post('/commercial/devis', {
        numero: 'D-REJEU-1',
        dateEmission: jour(2, 2),
        nature: 'MARCHANDISES',
        tiersId: client.id ?? client.tiers?.id,
        lignes: [{ designation: 'Marchandises', quantite: 1, prixUnitaire: 50_000, montantHT: 50_000 }],
      });
      return devis;
    }, { essentielle: false });
  }

  // Une CLÔTURE traversée · l'exercice se valide, se clôt, un exercice suivant naît et reçoit une écriture.
  await etape('validation de tout l’exercice', () => c.post('/ecritures/valider-jusqua', { exerciceId: ex.id, dateLimite: ex.dateFin.slice(0, 10) }));
  const debutSuivant = new Date(Date.parse(ex.dateFin.slice(0, 10)) + JOUR_MS).toISOString().slice(0, 10);
  const suivant = await etape('exercice suivant', () => c.post('/exercices', { dateDebut: debutSuivant, dateFin: `${Number(debutSuivant.slice(0, 4))}-12-31` }));
  await etape('clôture de l’exercice', () => c.post(`/exercices/${ex.id}/cloturer`));
  await etape('écriture de l’exercice suivant', () =>
    ecr_n1(c, suivant, od, caisse, produit, debutSuivant),
  );
  return { exerciceId: ex.id, suivantId: suivant.id };
}
function ecr_n1(c, suivant, od, caisse, produit, date) {
  const d = new Date(Date.parse(date) + 20 * JOUR_MS).toISOString().slice(0, 10);
  return c.post('/ecritures', {
    exerciceId: suivant.id,
    journalId: od.id,
    date: d,
    libelle: 'N+1 rejeu',
    lignes: [
      { compteId: caisse.id, libelle: 'N+1', debit: 33_000, credit: 0 },
      { compteId: produit.id, libelle: 'N+1', debit: 0, credit: 33_000 },
    ],
  });
}

// ---------------------------------------------------------------------------
// Le scénario
// ---------------------------------------------------------------------------
async function principal() {
  console.log('== Boîte SMTP, serveur compilé');
  const smtp = await demarrerSmtp();
  const { enfant, journal } = demarrerServeur();
  let code = 1;
  try {
    await attendreSante();

    console.log('== L’opérateur · dossier de l’éditeur, double authentification, console');
    const op = new Client();
    await op.post('/auth/register', { nomEntite: 'Éditeur rejeu', referentiel: 'SYSCOHADA', email: EMAIL_OPERATEUR, motDePasse: MOT_DE_PASSE, systemeComptableSyscohada: 'NORMAL' });
    const tenantOperateur = (await prisma.user.findUnique({ where: { email: EMAIL_OPERATEUR }, select: { tenantId: true } })).tenantId;
    await prisma.$executeRawUnsafe(`UPDATE "users" SET "estOperateurPlateforme" = true WHERE "email" = $1`, EMAIL_OPERATEUR);
    await prisma.$executeRawUnsafe(`UPDATE "licences" SET "type" = 'PROPRIETAIRE', "dateExpiration" = NULL WHERE "tenantId" = $1`, tenantOperateur);
    const dist = process.env.OMEGAX_DIST || join(RACINE, 'dist');
    process.env.NODE_PATH = join(RACINE, 'node_modules');
    require('node:module').Module._initPaths();
    const da = require(existsSync(join(dist, 'modules', 'auth', 'double-authentification.js'))
      ? join(dist, 'modules', 'auth', 'double-authentification.js')
      : join(dist, 'src', 'modules', 'auth', 'double-authentification.js'));
    await op.post('/auth/login', { email: EMAIL_OPERATEUR, motDePasse: MOT_DE_PASSE });
    const init = await op.post('/auth/double-authentification/initier');
    const cle = da.depuisBase32(init.secret);
    const codeCourant = () => da.codeHotp(cle, da.pasDe(Date.now()));
    await op.post('/auth/double-authentification/activer', { motDePasseActuel: MOT_DE_PASSE, code: codeCourant() });
    // Un code ne ressert pas dans le même pas · on attend le suivant avant la connexion complète.
    await attendre(31_000);
    const console_ = new Client();
    await console_.post('/auth/login', { email: EMAIL_OPERATEUR, motDePasse: MOT_DE_PASSE, code: codeCourant() });
    const liste0 = await console_.get('/plateforme/essais-echus');
    verifier(Array.isArray(liste0.essais), 'la console répond à GET /plateforme/essais-echus');

    // Chaque requête du plan de purge SE PRÉPARE sur la vraie base (tables, colonnes, sous-requêtes), y compris celles des
    // tables que ce rejeu ne peuple pas · EXPLAIN ne supprime rien.
    {
      const purge = require(existsSync(join(dist, 'modules', 'plateforme', 'essais-echus', 'purger-dossier.js'))
        ? join(dist, 'modules', 'plateforme', 'essais-echus', 'purger-dossier.js')
        : join(dist, 'src', 'modules', 'plateforme', 'essais-echus', 'purger-dossier.js'));
      const plan = purge.planDePurge();
      let invalides = 0;
      for (const e of plan) {
        try {
          await prisma.$queryRawUnsafe('EXPLAIN ' + e.sql, '00000000-0000-0000-0000-000000000000');
        } catch (err) {
          invalides += 1;
          console.error(`  requête invalide · ${e.sql.slice(0, 160)} · ${String(err.message).slice(0, 200)}`);
        }
      }
      verifier(invalides === 0, `les ${plan.length} requêtes du plan de purge se préparent sur la vraie base (${plan.filter((e) => e.type === 'DETACHER').length} détachements de clé pour dénouer les cycles)`);
    }

    const instantane0 = await decomptes();

    console.log('== Le dossier d’essai CIBLE, ouvert par l’inscription, peuplé');
    const cible = await ouvrirEssai('SYSCOHADA', 'cible');
    const apresOuverture = await decomptes();
    await peupler(cible.c, 'SYSCOHADA');
    const instantane1 = await decomptes();

    console.log('== Le dossier VOISIN (même parcours, référentiel différent)');
    const voisin = await ouvrirEssai('SYCEBNL', 'voisin');
    await peupler(voisin.c, 'SYCEBNL');
    const instantane2 = await decomptes();

    const tablesPeuplees = Object.keys(instantane1).filter((t) => instantane1[t] > instantane0[t]);
    console.log(`  ${tablesPeuplees.length} tables reçoivent des lignes du dossier cible (sur ${Object.keys(instantane1).length})`);
    const ratees = etapes.filter((e) => !e.ok);
    if (ratees.length) console.log(`  saisies non essentielles refusées : ${ratees.map((e) => e.nom).join(' · ')}`);

    console.log('== Vieillir : terme il y a 160 jours (rappel à envoyer), voisin vieilli de même, SANS rappel');
    const vieillir = async (tenantId, joursDepuisTerme) => {
      const fin = new Date(Date.now() - joursDepuisTerme * JOUR_MS);
      const debut = new Date(fin.getTime() - 30 * JOUR_MS);
      await prisma.$executeRawUnsafe(`UPDATE "licences" SET "dateDebut" = $2, "dateExpiration" = $3 WHERE "tenantId" = $1`, tenantId, debut, fin);
    };
    await vieillir(cible.tenantId, 160);
    await vieillir(voisin.tenantId, 160);

    let liste = await console_.get('/plateforme/essais-echus');
    const ligne = (id) => liste.essais.find((e) => e.tenantId === id);
    verifier(ligne(cible.tenantId)?.etat === 'RAPPEL_A_ENVOYER', `cible · état RAPPEL_A_ENVOYER (lu : ${ligne(cible.tenantId)?.etat})`);
    const brut = JSON.stringify(liste);
    verifier(!brut.includes(cible.email) && !brut.includes('Essai cible'), 'la liste ne porte ni l’adresse ni le nom du client (identifiants, dates, nombres)');

    console.log('== Refus avant le rappel');
    let refus = await console_.appeler('POST', `/plateforme/essais-echus/${cible.tenantId}/supprimer`, { confirmation: cible.tenantId }, { attendu: [409] });
    verifier(refus.statut === 409, 'suppression refusée (409) tant que le rappel n’est pas parti');
    refus = await console_.appeler('POST', `/plateforme/essais-echus/${cible.tenantId}/supprimer`, { confirmation: 'autre-chose' }, { attendu: [400] });
    verifier(refus.statut === 400, 'suppression refusée (400) sans l’identifiant retapé');

    console.log('== Le rappel part (les deux dossiers sont dus), une seule fois');
    const avantRappel = courriels.length;
    // Deux demandes SIMULTANÉES · la réservation (clé unique par dossier) ne laisse partir qu'un courriel par dossier.
    const [r1, r2] = await Promise.all([console_.post('/plateforme/essais-echus/rappels'), console_.post('/plateforme/essais-echus/rappels').catch((e) => ({ erreur: e.message }))]);
    const rappels = { envoyes: (r1.envoyes ?? 0) + (r2.envoyes ?? 0) };
    verifier(rappels.envoyes >= 2, `les rappels partent (envoyés : ${r1.envoyes} + ${r2.envoyes ?? r2.erreur})`);
    await attendre(500);
    const rappelsRecus = courriels.slice(avantRappel).filter((m) => /supprimé/.test(m.corps));
    verifier(rappelsRecus.length === 2, `deux courriels de rappel reçus à la boîte (lu : ${rappelsRecus.length})`);
    const pourCible = rappelsRecus.find((m) => m.a.includes(cible.email));
    verifier(!!pourCible, 'le rappel de la cible est adressé à l’administrateur du dossier');
    verifier(!!pourCible && /Restituer le dossier complet/.test(pourCible.corps), 'le rappel dit comment exporter (Fichier > Restituer le dossier complet)');
    const second = await console_.post('/plateforme/essais-echus/rappels');
    verifier((second.resultats ?? []).length === 0, 'un second appel n’envoie rien (jamais en doublon)');
    verifier(courriels.slice(avantRappel).filter((m) => /supprimé/.test(m.corps)).length === 2, 'toujours deux courriels de rappel seulement');

    liste = await console_.get('/plateforme/essais-echus');
    verifier(['ECHU_CONSERVE', 'SUPPRIMABLE'].includes(ligne(cible.tenantId)?.etat), `cible · rappel parti, état ${ligne(cible.tenantId)?.etat}`);
    refus = await console_.appeler('POST', `/plateforme/essais-echus/${cible.tenantId}/supprimer`, { confirmation: cible.tenantId }, { attendu: [409] });
    verifier(refus.statut === 409, 'suppression refusée (409) le jour même du rappel (préavis de trente jours)');
    const n409 = await prisma.dossierEssaiSupprime.count({ where: { ancienTenantId: cible.tenantId } });
    verifier(n409 === 0, 'aucune trace de suppression après les refus');
    verifier((await decomptesDuDossier(cible.tenantId)).ecritures > 0, 'le dossier cible est intact après les refus');

    console.log('== Vieillir le rappel (trente et un jours) et le terme (200 jours) · seule la cible, le voisin garde son rappel récent');
    const ilYa = new Date(Date.now() - 31 * JOUR_MS);
    // Le temps passe pour TOUT · le terme de la licence et le terme que le rappel
    // annonce avancent ensemble (un rappel d'un autre terme ne vaut pas préavis).
    await vieillir(cible.tenantId, 200);
    const nouveauTerme = jourDeKinshasa(new Date(Date.now() - 200 * JOUR_MS));
    await prisma.$executeRawUnsafe(
      `UPDATE "rappels_suppression_essai" SET "envoyeLe" = $2, "misEnFileLe" = $2, "termeLe" = $3 WHERE "cabinetId" = $1`,
      cible.tenantId,
      ilYa,
      nouveauTerme,
    );
    await prisma.$executeRawUnsafe(`UPDATE "messages" SET "envoyeAt" = $2 WHERE "tenantId" = $1 AND "origine" = 'RAPPEL_SUPPRESSION_ESSAI'`, cible.tenantId, ilYa);
    liste = await console_.get('/plateforme/essais-echus');
    verifier(ligne(cible.tenantId)?.etat === 'SUPPRIMABLE', `cible · état SUPPRIMABLE (lu : ${ligne(cible.tenantId)?.etat})`);
    verifier(ligne(voisin.tenantId)?.etat !== 'SUPPRIMABLE', `voisin · jamais SUPPRIMABLE sans préavis de trente jours (lu : ${ligne(voisin.tenantId)?.etat})`);
    refus = await console_.appeler('POST', `/plateforme/essais-echus/${voisin.tenantId}/supprimer`, { confirmation: voisin.tenantId }, { attendu: [409] });
    verifier(refus.statut === 409, 'le voisin, qui n’a pas son préavis, est refusé (409)');

    console.log('== Suppression de la cible');
    const avant = await decomptes();
    const cibleAvant = await decomptesDuDossier(cible.tenantId);
    const voisinAvant = await decomptesDuDossier(voisin.tenantId);
    const operateurAvant = await decomptesDuDossier(tenantOperateur);
    // Deux demandes SIMULTANÉES · l'une supprime, l'autre est refusée proprement (jamais une erreur 500).
    const demande = (cl) => cl.appeler('POST', '/plateforme/essais-echus/' + cible.tenantId + '/supprimer', { confirmation: cible.tenantId }, { attendu: [200, 201, 404, 409] });
    const [d1, d2] = await Promise.all([demande(console_), demande(console_)]);
    const reussies = [d1, d2].filter((d) => d.statut < 300);
    verifier(reussies.length === 1, `exactement une des deux suppressions simultanées réussit (statuts ${d1.statut} et ${d2.statut})`);
    const resultat = reussies[0]?.corps ?? {};
    verifier(resultat.supprime === true, 'la console répond « supprimé »');
    const apres = await decomptes();

    console.log('== Preuves');
    const apresDossier = await decomptesDuDossier(cible.tenantId);
    const residus = Object.entries(apresDossier).filter(([, n]) => n > 0);
    verifier(residus.length === 0, `0 ligne résiduelle du dossier dans les ${Object.keys(apresDossier).length} tables qui portent tenantId${residus.length ? ' · ' + JSON.stringify(residus) : ''}`);
    const [{ n: tenantRestant }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "tenants" WHERE "id" = $1`, cible.tenantId);
    verifier(tenantRestant === 0, 'le dossier lui-même n’existe plus');
    const [{ n: utilisateursRestants }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "users" WHERE "email" = $1`, cible.email);
    verifier(utilisateursRestants === 0, 'l’administrateur du dossier est supprimé avec lui');

    // Les tables SANS tenantId (portées par un parent) · la différence doit être EXACTEMENT ce que la cible y avait ajouté.
    const avecTenant = new Set(await tablesAvecTenantId());
    const sansTenant = Object.keys(avant).filter((t) => !avecTenant.has(t));
    const ecartsSansTenant = [];
    for (const t of sansTenant) {
      const apporte = instantane1[t] - instantane0[t]; // tout ce que la cible a ajouté (ouverture et saisie)
      const attendu = instantane2[t] - apporte; // le reste
      if (t === 'dossiers_essai_supprimes' || t === 'rappels_suppression_essai') continue;
      if (apres[t] !== attendu) ecartsSansTenant.push(`${t} · attendu ${attendu}, lu ${apres[t]}`);
    }
    verifier(ecartsSansTenant.length === 0, `les ${sansTenant.length} tables sans tenantId rendent exactement ce que la cible y avait ajouté${ecartsSansTenant.length ? ' · ' + ecartsSansTenant.join(' ; ') : ''}`);
    const touchees = sansTenant.filter((t) => instantane1[t] > instantane0[t]);
    console.log(`  (dont ${touchees.length} tables sans tenantId effectivement peuplées par la cible : ${touchees.join(', ')})`);

    const voisinApres = await decomptesDuDossier(voisin.tenantId);
    const voisinDiff = Object.keys(voisinAvant).filter((t) => voisinAvant[t] !== voisinApres[t]);
    verifier(voisinDiff.length === 0, `le voisin est intact, table par table${voisinDiff.length ? ' · ' + voisinDiff.map((t) => `${t} ${voisinAvant[t]} -> ${voisinApres[t]}`).join(' ; ') : ''}`);

    const operateurApres = await decomptesDuDossier(tenantOperateur);
    // Le dossier de l'opérateur gagne des maillons d'audit (l'acte lui-même) et rien d'autre.
    const operateurDiff = Object.keys(operateurAvant).filter((t) => operateurAvant[t] !== operateurApres[t] && t !== 'evenements_audit' && t !== 'messages');
    verifier(operateurDiff.length === 0, `le dossier de l’opérateur est intact (hors maillons d’audit et courriers)${operateurDiff.length ? ' · ' + operateurDiff.join(', ') : ''}`);

    const trace = await prisma.dossierEssaiSupprime.findUnique({ where: { ancienTenantId: cible.tenantId } });
    verifier(!!trace, 'la trace de suppression est écrite');
    if (trace) {
      verifier(trace.nombreUtilisateurs === cibleAvant.users && trace.nombreEcritures === cibleAvant.ecritures && trace.nombreExercices === cibleAvant.exercices,
        `la trace porte les bons nombres (utilisateurs ${trace.nombreUtilisateurs}, écritures ${trace.nombreEcritures}, exercices ${trace.nombreExercices})`);
      verifier(trace.parOperateur === EMAIL_OPERATEUR, 'la trace dit quel opérateur a supprimé');
      const admis = ['id', 'ancienTenantId', 'creeLe', 'termeLe', 'rappelEnvoyeLe', 'supprimeLe', 'parOperateur', 'nombreUtilisateurs', 'nombreExercices', 'nombreEcritures', 'nombreLignesSupprimees'];
      verifier(Object.keys(trace).every((k) => admis.includes(k)) && Object.keys(trace).length === admis.length, 'la trace ne porte aucune autre colonne que des dates, des nombres et l’identifiant (aucune donnée du client)');
    }
    const maillon = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM "evenements_audit" WHERE "tenantId" = $1 AND "entite" = 'DossierEssaiSupprime'`, tenantOperateur);
    verifier(maillon[0].n === 1, 'l’acte est journalisé dans la chaîne du dossier de l’opérateur');

    console.log('== Le serveur n’a pas écrit de panne');
    verifier(!/Maillon d'audit NON écrit/.test(journal()), 'aucun « Maillon d’audit NON écrit » au journal du serveur');

    console.log(`\nSaisies du rejeu · ${etapes.filter((e) => e.ok).length} réussies, ${etapes.filter((e) => !e.ok).length} refusées`);
    code = sorties.length === 0 ? 0 : 1;
  } catch (erreur) {
    console.error(`\nREJEU INTERROMPU · ${erreur.stack || erreur}`);
    console.error('--- fin du journal du serveur ---');
    console.error(journal().split('\n').slice(-25).join('\n'));
    code = 1;
  } finally {
    enfant.kill();
    smtp.close();
    await prisma.$disconnect();
  }
  if (sorties.length) {
    console.error(`\n${sorties.length} preuve(s) manquante(s) :\n - ${sorties.join('\n - ')}`);
  } else if (code === 0) console.log('\nTOUT EST PROUVÉ.');
  process.exit(code);
}

principal();
