// PUITS DE COURRIEL JETABLE · sert UNIQUEMENT au test de charge k6 (e2e/k6/).
//
// Pourquoi : l'inscription d'essai (`POST /auth/inscription-essai`) n'ouvre
// aucune session et ne remet le mot de passe provisoire QUE par courriel. Sans
// messagerie, elle est refusée en 503 et le parcours public ne peut pas être
// éprouvé. Ce puits fait deux choses, sans aucune dépendance :
//   1. un serveur SMTP minimal (port 2525) qui accepte tout, lit le mot de
//      passe provisoire dans le message et le garde par destinataire ;
//   2. une petite porte HTTP (port 2526) `GET /mot-de-passe?courriel=...` que
//      le script k6 interroge pour finir la connexion.
// Il n'écoute que sur 127.0.0.1. Ne le pointez JAMAIS vers un vrai serveur de
// courrier, ni ne donnez au serveur de production ces variables SMTP.
import net from 'node:net';
import http from 'node:http';

const PORT_SMTP = Number(process.env.PUITS_SMTP_PORT ?? 2525);
const PORT_HTTP = Number(process.env.PUITS_HTTP_PORT ?? 2526);
const mots = new Map(); // courriel -> dernier mot de passe provisoire

function decoderQP(s) {
  return s
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function lireMessage(brut, destinataire) {
  // Le corps peut être en quoted-printable (le « · » est hors ASCII) ou en
  // base64 selon ce que nodemailer choisit · on essaie les deux.
  const [entetes, ...reste] = brut.split(/\r?\n\r?\n/);
  let corps = reste.join('\n\n');
  if (/content-transfer-encoding:\s*base64/i.test(entetes)) corps = Buffer.from(corps.replace(/\s+/g, ''), 'base64').toString('utf8');
  else if (/content-transfer-encoding:\s*quoted-printable/i.test(entetes)) corps = Buffer.from(decoderQP(corps), 'latin1').toString('utf8');
  const m = /Mot de passe provisoire\s*\S+\s*(\S+)/.exec(corps);
  if (m && destinataire) mots.set(destinataire.toLowerCase(), m[1]);
}

net
  .createServer((socle) => {
    let enDonnees = false;
    let tampon = '';
    let destinataire = '';
    const dire = (l) => socle.write(l + '\r\n');
    dire('220 puits-k6 ESMTP');
    socle.on('data', (morceau) => {
      tampon += morceau.toString('latin1');
      for (;;) {
        if (enDonnees) {
          const fin = tampon.indexOf('\r\n.\r\n');
          if (fin < 0) return;
          lireMessage(tampon.slice(0, fin), destinataire);
          tampon = tampon.slice(fin + 5);
          enDonnees = false;
          dire('250 ok');
          continue;
        }
        const i = tampon.indexOf('\r\n');
        if (i < 0) return;
        const ligne = tampon.slice(0, i);
        tampon = tampon.slice(i + 2);
        const cmd = ligne.slice(0, 4).toUpperCase();
        if (cmd === 'EHLO' || cmd === 'HELO') {
          socle.write('250-puits-k6\r\n250-AUTH PLAIN LOGIN\r\n250 8BITMIME\r\n');
        } else if (cmd === 'AUTH') {
          if (/PLAIN\s+\S+/i.test(ligne)) dire('235 ok');
          else if (/LOGIN/i.test(ligne)) { dire('334 VXNlcm5hbWU6'); }
          else dire('235 ok');
        } else if (/^[A-Za-z0-9+/=]+$/.test(ligne) && !['MAIL', 'RCPT', 'DATA', 'QUIT', 'RSET', 'NOOP'].includes(cmd)) {
          // étapes de AUTH LOGIN (identifiant puis mot de passe en base64)
          dire(ligne.length > 12 ? '235 ok' : '334 UGFzc3dvcmQ6');
        } else if (cmd === 'MAIL') dire('250 ok');
        else if (cmd === 'RCPT') {
          const m = /<([^>]+)>/.exec(ligne);
          destinataire = m ? m[1] : '';
          dire('250 ok');
        } else if (cmd === 'DATA') { enDonnees = true; dire('354 go'); }
        else if (cmd === 'RSET' || cmd === 'NOOP') dire('250 ok');
        else if (cmd === 'QUIT') { dire('221 bye'); socle.end(); return; }
        else dire('250 ok');
      }
    });
    socle.on('error', () => {});
  })
  .listen(PORT_SMTP, '127.0.0.1');

http
  .createServer((req, rep) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/mot-de-passe') {
      const mot = mots.get((u.searchParams.get('courriel') ?? '').toLowerCase());
      if (mot) { rep.writeHead(200, { 'Content-Type': 'text/plain' }); rep.end(mot); return; }
      rep.writeHead(404); rep.end('aucun courriel recu'); return;
    }
    rep.writeHead(404); rep.end();
  })
  .listen(PORT_HTTP, '127.0.0.1');

console.log(`puits de courriel · SMTP 127.0.0.1:${PORT_SMTP}, mots de passe sur http://127.0.0.1:${PORT_HTTP}/mot-de-passe?courriel=`);
