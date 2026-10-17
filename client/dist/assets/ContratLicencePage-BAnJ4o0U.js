import{u as K,r as f,j as e,A as Y,m as U,a as M,b as S}from"./index-DrHRWwF_.js";import{t as $,V as N,a as Z,L as Q,A as D}from"./conditions-de-licence-u7-PpdB-.js";import{C as W,a as ee}from"./CadrePagePublique-YtgIwTjZ.js";const te=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],ne=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],h=(s,n)=>s>>>n|s<<32-n;function se(s){const n=[];for(const t of s){const i=t.codePointAt(0);if(i===void 0)throw new Error("Caractère vide dans le texte à hacher.");i<128?n.push(i):i<2048?n.push(192|i>>6,128|i&63):i<65536?n.push(224|i>>12,128|i>>6&63,128|i&63):n.push(240|i>>18,128|i>>12&63,128|i>>6&63,128|i&63)}return n}function O(s){const n=se(s),t=n.length*8;for(n.push(128);n.length%64!==56;)n.push(0);const i=Math.floor(t/4294967296),c=t>>>0;for(let d=3;d>=0;d--)n.push(i>>>d*8&255);for(let d=3;d>=0;d--)n.push(c>>>d*8&255);const a=ne.slice(),p=new Array(64);for(let d=0;d<n.length;d+=64){for(let r=0;r<16;r++){const x=d+4*r;p[r]=(n[x]<<24|n[x+1]<<16|n[x+2]<<8|n[x+3])>>>0}for(let r=16;r<64;r++){const x=h(p[r-15],7)^h(p[r-15],18)^p[r-15]>>>3,A=h(p[r-2],17)^h(p[r-2],19)^p[r-2]>>>10;p[r]=p[r-16]+x+p[r-7]+A>>>0}let[m,g,b,v,l,C,q,E]=a;for(let r=0;r<64;r++){const x=h(l,6)^h(l,11)^h(l,25),A=l&C^~l&q,V=E+x+A+te[r]+p[r]>>>0,j=h(m,2)^h(m,13)^h(m,22),R=m&g^m&b^g&b,L=j+R>>>0;E=q,q=C,C=l,l=v+V>>>0,v=b,b=g,g=m,m=V+L>>>0}a[0]=a[0]+m>>>0,a[1]=a[1]+g>>>0,a[2]=a[2]+b>>>0,a[3]=a[3]+v>>>0,a[4]=a[4]+l>>>0,a[5]=a[5]+C>>>0,a[6]=a[6]+q>>>0,a[7]=a[7]+E>>>0}return a.map(d=>d.toString(16).padStart(8,"0")).join("")}const ie=`CONDITIONS DE LICENCE D’OMEGAX
Version 1 du 15 octobre 2026 · langue du contrat · français

1. Les parties

L’éditeur est VMG Consulting, qui exploite et vend OmegaX. Les informations qui suivent sont celles que le Code du numérique (art. 52) veut accessibles de façon permanente.

  - Dénomination · VMG Consulting.
  - Siège social · (à arrêter par VMG Consulting).
  - Courrier électronique · (à arrêter par VMG Consulting).
  - Téléphone · (à arrêter par VMG Consulting).
  - Immatriculation (RCCM, forme juridique, identification nationale, numéro d’impôt, capital social) · (à arrêter par VMG Consulting).

Le client est l’entité dont un ou plusieurs dossiers comptables sont tenus dans OmegaX · association, organisation non gouvernementale, ordre professionnel, projet, entreprise ou cabinet. Il agit par l’administrateur de son dossier, qui accepte les présentes conditions en son nom.

2. Définitions

  - OmegaX · le logiciel de comptabilité édité par VMG Consulting, ses mises à jour et sa documentation.
  - Dossier · le fichier comptable d’une entité, avec ses exercices, ses écritures, ses tiers et ses utilisateurs.
  - Administrateur du dossier · l’utilisateur qui gère les accès du dossier et agit pour le client.
  - Version en ligne · OmegaX servi par VMG Consulting et utilisé dans un navigateur, à l’adresse oomega.web.app.
  - Installation sur site · OmegaX installé sur un ordinateur Windows du client, avec sa propre base de données.
  - Licence · le droit d’utiliser OmegaX que le présent contrat concède ; pour une installation sur site, le fichier signé par VMG Consulting qui le constate.

3. Objet et caractéristiques du service

Le présent contrat fixe les conditions auxquelles VMG Consulting concède au client le droit d’utiliser OmegaX et lui en rend le service.

OmegaX tient la comptabilité d’entités de la République démocratique du Congo dans l’un des deux référentiels de l’OHADA · le système comptable des entités à but non lucratif (SYCEBNL), pour les associations et ordres professionnels, les projets de développement ou en système minimal de trésorerie, et le système comptable OHADA révisé (SYSCOHADA), en système normal ou en système minimal de trésorerie. Il produit les livres, la balance, les états financiers et les notes annexes du référentiel du dossier.

L’interface d’OmegaX, ses documents et le présent contrat sont en français, seule langue proposée.

4. Droits de VMG Consulting sur OmegaX

Les logiciels sont des œuvres de l’esprit protégées par l’ordonnance-loi n° 86-033 du 5 avril 1986 portant protection des droits d’auteurs et des droits voisins (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 47). L’auteur d’une œuvre de l’esprit jouit sur elle, du seul fait de sa création, d’un droit de propriété incorporelle exclusif et opposable à tous (ordonnance-loi n° 86-033, art. 1er).

OmegaX est publié sous le nom de VMG Consulting, qui en détient les droits. Le présent contrat ne transfère au client aucun de ces droits · il lui en concède seulement l’usage, dans les limites de l’article 5.

Toute atteinte méchante ou frauduleuse portée en connaissance de cause aux droits d’auteur constitue l’infraction de contrefaçon (ordonnance-loi n° 86-033, art. 96).

Les données que le client saisit dans ses dossiers lui appartiennent. VMG Consulting n’acquiert sur elles aucun droit.

5. Licence concédée au client

VMG Consulting concède au client, pour la durée du contrat, une licence non exclusive et non transférable d’utilisation d’OmegaX, pour la tenue de ses propres dossiers et dans le périmètre de sa formule ou de son fichier de licence.

Le client ne peut, sauf accord écrit de VMG Consulting :

  - copier, modifier, traduire, adapter ou décompiler OmegaX, ni en extraire le code ;
  - le revendre, le louer, le sous-licencier ou le mettre à la disposition d’un tiers qui n’est pas l’un de ses utilisateurs ;
  - contourner ou neutraliser la vérification de la licence, notamment l’empreinte du poste et la signature du fichier de licence d’une installation sur site.

6. Formules, prix et facturation

La version en ligne s’utilise par abonnement, sous l’une des formules suivantes, avec ses options :

  - Essentiel · 1 dossier, 2 utilisateurs · tenue, états financiers, notes.
  - Standard · Essentiel + analytique et budgets, paie, TVA, immobilisations · 5 utilisateurs.
  - Cabinet · Paquet de dossiers, utilisateurs illimités.
  - Option paie · La paie en supplément de la formule Essentiel.
  - Option groupe · Consolidation et IFRS, en supplément de Standard ou Cabinet.
  - Dossier supplémentaire · Au-delà du paquet de la formule Cabinet, prix par dossier.

Le prix de chaque formule et de chaque option est fixé en dollars des États-Unis, au mois ou à l’année, et communiqué par écrit au client avant la souscription. Le prix applicable à un dossier est rappelé avant son acceptation en ligne (article 18).

Chaque période donne lieu à une facture (Code du numérique, art. 56, al. 2). La facture est établie en francs congolais, au cours du dollar du jour de la facture ; la taxe sur la valeur ajoutée y figure lorsque VMG Consulting y est assujettie. Un abonnement annuel se facture au premier mois facturable, puis tous les douze mois. Le mois entamé au début de l’abonnement n’est pas facturé, et aucune période n’est facturée au prorata.

7. Essai, paiement et lecture seule

Un abonnement peut commencer par un essai gratuit de trente jours. Tout mois qui commence avant la fin de l’essai n’est pas facturé.

Le client dispose de quinze jours après la fin de l’essai, puis après la fin de chaque période payée, pour régler la facture suivante. Passé ce délai sans paiement constaté par VMG Consulting, la licence du dossier arrive à échéance.

Les modalités de paiement, notamment les moyens de paiement acceptés · (à arrêter par VMG Consulting) (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 53, 6°).

Un dossier dont la licence est échue passe en LECTURE SEULE · ses utilisateurs le consultent et en téléchargent les états et les livres, mais aucune saisie, aucune modification ni aucune impression numérotée du journal n’y est plus admise. Le paiement constaté rouvre l’écriture aussitôt.

Un utilisateur qui respecte les conditions contractuelles et financières souscrites ne subit pas d’interruption de fourniture du service, sauf demande expresse de sa part, force majeure ou raisons de sécurité publique (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 30, al. 3). VMG Consulting ne suspend donc entièrement un dossier que dans ces cas, ou lorsque le client manque à ses obligations.

8. Installation sur site

Une installation sur site fonctionne sans connexion à Internet. Sa licence est un fichier signé par VMG Consulting, qui nomme le titulaire, l’empreinte du poste serveur, le nombre de dossiers que l’installation peut ouvrir, la date de fin de maintenance et, s’il y a lieu, la date d’expiration. Copié sur un autre poste, le fichier ne vaut rien.

  - La date de fin de maintenance borne les VERSIONS · le client garde la version qu’il a, mais une version publiée après cette date refuse de démarrer sous cette licence.
  - La date d’expiration borne l’USAGE · une licence sans date d’expiration est perpétuelle.
  - Une horloge du poste reculée de plus d’un jour sous la date la plus tardive déjà vue suspend l’usage, jusqu’à ce qu’elle soit remise à l’heure.

Sur une installation sur site, les données restent sur l’ordinateur du client, qui en assure la garde et la sauvegarde. VMG Consulting n’y a pas accès.

9. Données du client et traitement pour son compte

La politique de confidentialité d’OmegaX, publiée à côté du présent contrat, décrit les données traitées, leurs hébergeurs, leur durée de conservation et les droits des personnes. Elle fait partie du contrat (Code du numérique, art. 53, 10°).

Pour la version en ligne, le client est responsable du traitement des données personnelles de ses dossiers, et VMG Consulting traite ces données pour son compte, comme sous-traitant (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 229). À ce titre, et pour la durée du contrat :

  - objet et finalité · la tenue de la comptabilité du client, les éditions, les sauvegardes et les courriers que le client fait partir du logiciel ;
  - données et personnes · celles que le client saisit · tiers, membres, donateurs, salariés, utilisateurs ;
  - VMG Consulting ne traite ces données que sur instruction documentée du client, y compris pour leur transfert hors de la République démocratique du Congo · l’usage du logiciel selon le présent contrat vaut cette instruction ;
  - les personnes autorisées à traiter ces données sont tenues à la confidentialité ;
  - VMG Consulting aide le client à répondre aux demandes des personnes concernées et à respecter ses obligations, et met à sa disposition les informations nécessaires pour démontrer le respect de ces obligations et pour permettre des audits ;
  - le client autorise VMG Consulting à recourir aux prestataires nommés par la politique de confidentialité ; VMG Consulting l’informe de tout ajout ou remplacement de l’un d’eux avant qu’il ne prenne effet, et le client peut s’y opposer.

Le transfert de données personnelles hors de la République démocratique du Congo reste régi par les articles 201 et 202 du Code du numérique · la politique de confidentialité dit où en est la qualification de sa base juridique.

VMG Consulting est tenue à la confidentialité des données qu’elle traite, sauf réquisition judiciaire (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 37). Elle ne consulte pas le contenu des dossiers · ses accès techniques à la base se limitent à la sauvegarde chiffrée, dont elle détient la clé, à la restauration de contrôle automatique qui l’éprouve et ne rend que des décomptes, et aux requêtes de maintenance, qui ne rendent que des identifiants et des nombres. Sa console d’exploitation ne montre d’un dossier que sa fiche commerciale et sa licence.

À tout moment, et même lorsque le dossier est en lecture seule, l’administrateur du dossier en obtient une archive de ses données, un fichier CSV par table, par la commande Restituer le dossier complet, et chaque utilisateur en exporte les états et les livres. Cette archive porte cinq réserves, qu’elle écrit elle-même · elle ne remplace pas la conservation des pièces justificatives, n’a pas la force probante d’un écrit légalisé, ne se recharge pas entière dans OmegaX, n’est pas un instantané pris d’un seul coup, et ses fichiers ne sont pas le livre-journal.

Ce que deviennent les données d’un dossier après la fin du contrat, au-delà des obligations légales de conservation · (à arrêter par VMG Consulting).

10. Accès, sécurité et obligations du client

Le client désigne ses utilisateurs et leur rôle par l’administrateur de son dossier. Chaque utilisateur garde son mot de passe secret et ne le partage pas ; la double authentification lui est offerte, et elle est recommandée.

Le client répond de ce que ses utilisateurs saisissent, valident et éditent. Il reste seul juge des écritures qu’il passe et des états qu’il arrête · OmegaX applique les règles des référentiels qu’il cite, il ne remplace pas le jugement du comptable.

Le client utilise OmegaX dans le respect de la loi, et ne s’en sert à aucune fin illicite.

11. Mises à jour, disponibilité et assistance

VMG Consulting met à jour la version en ligne sans intervention du client. Une installation sur site se met à jour par l’installation d’une nouvelle version, dans les limites de sa fin de maintenance (article 8) ; une copie de la base est prise avant chaque mise à jour.

VMG Consulting publie sans délai les prévisions d’interruption du service, notamment pour installation, réparation ou changement d’équipement (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 29, 4°). Le moyen de cette publication · (à arrêter par VMG Consulting).

L’assistance après-vente, son canal et ses horaires · (à arrêter par VMG Consulting). VMG Consulting ne consent, à la date de la présente version, aucune garantie commerciale ni aucun engagement de disponibilité chiffré.

12. Responsabilité et force majeure

VMG Consulting est responsable de plein droit, à l’égard du client, de la bonne exécution des obligations résultant du présent contrat. Elle en est exonérée en apportant la preuve que l’inexécution, l’exécution tardive ou la mauvaise exécution est imputable soit au client, soit à un cas de force majeure, soit à un tiers à la fourniture des prestations prévues au contrat (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 51).

Il n’y a lieu à aucuns dommages-intérêts lorsque, par suite d’une force majeure ou d’un cas fortuit, une partie a été empêchée de faire ce à quoi elle était obligée (Code civil, Livre III, art. 46). Hors le cas du dol, une partie n’est tenue que des dommages-intérêts qui ont été prévus ou qu’on a pu prévoir lors du contrat (art. 48).

Les garanties légales de conformité, des vices cachés et d’éviction · (à arrêter par VMG Consulting) (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 53, 20°).

Un plafond de responsabilité · (à arrêter par VMG Consulting).

13. Droit de rétractation

Le Code du numérique n’ouvre un droit de rétractation que dans un contrat conclu entre un professionnel et un non-professionnel (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 61), et ce droit se perd une fois le service fourni (art. 64, 2°). Le présent contrat est conclu avec une entité, pour la tenue de sa comptabilité.

L’existence ou l’absence d’un droit de rétractation pour le présent contrat, et ses conditions d’exercice · (à arrêter par VMG Consulting) (art. 53, 16°).

14. Durée et fin du contrat

Le contrat dure tant que l’abonnement du dossier ou sa licence sur site est en vigueur.

Les conventions légalement formées tiennent lieu de loi à ceux qui les ont faites ; elles ne peuvent être révoquées que de leur consentement mutuel ou pour les causes que la loi autorise, et elles doivent être exécutées de bonne foi (Code civil, Livre III, art. 33). Si l’une des parties ne satisfait point à son engagement, l’autre peut la forcer à l’exécution lorsqu’elle est possible, ou en demander la résolution avec dommages-intérêts (art. 82).

La résiliation à l’initiative de chaque partie et son préavis · (à arrêter par VMG Consulting).

15. Modification des conditions

VMG Consulting ne modifie unilatéralement les présentes conditions que pour les raisons qu’elles indiquent, ou à la suite d’un changement de la législation ou d’une décision de l’Autorité de Régulation du Numérique (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 34). Les raisons que le présent contrat admet · (à arrêter par VMG Consulting).

Le projet de modification est communiqué au client par écrit ou sur un autre support durable au moins trente jours ouvrables avant son entrée en vigueur. Tant qu’il n’a pas expressément accepté les nouvelles conditions, le client peut résilier le contrat sans pénalité ni droit au dédommagement, jusqu’à soixante jours ouvrables après l’entrée en vigueur de la modification, qui ne prend effet qu’à l’issue de ce délai (art. 34).

Chaque version porte un numéro, une date et l’empreinte de son texte (SHA-256). Une version publiée n’est jamais réécrite · un changement fait une version nouvelle, et le texte de chaque version publiée reste consultable dans OmegaX.

16. Réclamations

Le client adresse ses réclamations à VMG Consulting · téléphone (à arrêter par VMG Consulting), courrier électronique (à arrêter par VMG Consulting) (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 53, 13°).

Modalités de traitement des réclamations · (à arrêter par VMG Consulting) (art. 53, 14°).

17. Confidentialité entre les parties

Chaque partie garde confidentielles les informations de l’autre qu’elle reçoit pour l’exécution du contrat, sauf obligation légale de les communiquer.

18. Conclusion du contrat en ligne

Le contrat se conclut dans OmegaX, en quatre étapes (Code du numérique, art. 53, 2°) :

  - l’administrateur du dossier ouvre le présent texte depuis le menu « ? » ; la version, sa date et l’abonnement du dossier y sont rappelés ;
  - il vérifie ces éléments, et peut se retirer sans rien accepter · tant qu’il n’a pas confirmé, rien n’est enregistré (art. 53, 3°, et art. 55, al. 1er) ;
  - il coche la case qui dit avoir lu les conditions, puis confirme l’acceptation au nom du client · OmegaX vérifie que le texte lu est celui que le service tient en vigueur, même version et même empreinte, et sinon demande de recharger la page ;
  - OmegaX en accuse aussitôt réception à l’écran · version acceptée, date, heure et auteur · et met en file, à l’adresse de l’administrateur, un courriel qui porte le même accusé et, en pièce jointe, le texte accepté (art. 55, al. 2, et art. 56, al. 1er).

L’acceptation est enregistrée dans le dossier, avec la version et l’empreinte du texte accepté, son auteur, sa date et l’adresse réseau d’où elle a été faite, au journal d’audit. Le texte de chaque version acceptée reste consultable et imprimable (art. 53, 9°).

L’offre est valable tant qu’elle est accessible en ligne (art. 53, al. 2, et art. 53, 4°). Le contrat ne se forme que par le consentement de la partie qui s’oblige (Code civil, Livre III, art. 8) · sans acceptation, le présent texte ne lie pas le client, et son accès au dossier n’en est pas interrompu (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 30, al. 3).

19. Droit applicable et litiges

Le Code du numérique régit les activités et services numériques exercés à partir ou à destination du territoire de la République démocratique du Congo (ordonnance-loi n° 23/10 du 13 mars 2023 portant Code du numérique, art. 3). Les contrats sont soumis aux règles générales du Code civil congolais, Livre III (art. 7).

La juridiction compétente en cas de litige · (à arrêter par VMG Consulting).
`,P=[{numero:1,date:"2026-10-15",dateLisible:"15 octobre 2026",communiqueeLe:null,enVigueurLe:"2026-10-15",empreinte:"1a878fe68d79ec76fa40173395750ab68cbf8a1a581c91397e45b30815dac75d",texte:ie}];function re(s){return P.find(n=>n.numero===s)??null}let G=null;function ae(){return G===null&&(G=O($())),G}const X="auteur non enregistré";function oe(s){return O(s===null?"aucune commande":JSON.stringify([s.formule,s.options,s.periodicite,s.debut,s.finEssai,s.lignes===null?null:s.lignes.map(n=>[n.designation,n.quantite,n.prixUnitaireUsd]),s.totalUsd,s.duSiege]))}function ue(s,n){return s.numero>n.numero?"PAGE_ANCIENNE":s.numero<n.numero?"SERVICE_EN_RETARD":s.empreinte===n.empreinte?"A_JOUR":"TEXTE_DIFFERENT"}function le(s,n,t,i){if(s==="SERVICE_EN_RETARD")return`Cette page affiche la version ${t} des conditions, que le service ne tient pas encore (il est à la version ${n}) · le service n’est pas encore à jour, réessayez dans quelques minutes.`;const c=i?"avant d’accepter":"pour lire la version en vigueur";return s==="TEXTE_DIFFERENT"?`Le texte affiché diffère de celui que le service tient pour la même version ${n} · rechargez la page ${c}.`:`Le texte affiché (version ${t}) n’est pas celui que le service tient en vigueur (version ${n}) · rechargez la page ${c}.`}function ce(s,n){const t=n?"il peut être renvoyé":"l’administrateur du dossier peut le renvoyer";switch(s){case"ENVOYE":return"Le courriel portant cet accusé et le texte accepté est parti.";case"EN_ATTENTE":return"Un courriel portant cet accusé et le texte accepté est en file, à l’adresse de l’auteur de l’acceptation · il part à la prochaine reprise de la file (Fichier > Courriers sortants, « Relancer les envois »).";case"SANS_TRANSPORT":return"Un courriel portant cet accusé et le texte accepté est en file, mais aucune messagerie n’est configurée pour l’envoi · il ne partira qu’une fois une messagerie configurée (Fichier > Courriers sortants).";case"ECHEC":return"Le courriel portant cet accusé n’est pas parti au dernier essai · la file le retente d’elle-même (Fichier > Courriers sortants).";case"ABANDONNE":return`La file a abandonné le courriel portant cet accusé · ${t}.`;default:return`Le courriel d’accusé de réception n’a pas pu être mis en file · le texte reste téléchargeable ci-dessus, et ${n?"l’accusé peut être renvoyé":"l’administrateur du dossier peut renvoyer l’accusé"}.`}}function _(s){return new Date(`${s}T00:00:00Z`).toLocaleDateString("fr-FR",{timeZone:"UTC",day:"numeric",month:"long",year:"numeric"}).replace(/^1 /,"1er ")}function I(s,n){const t=new Blob([n],{type:"text/plain;charset=utf-8"}),i=URL.createObjectURL(t),c=document.createElement("a");c.href=i,c.download=`conditions-de-licence-omegax-version-${s}.txt`,document.body.appendChild(c),c.click(),c.remove(),URL.revokeObjectURL(i)}const y=N.numero,w=ae();function de(){var T;const{estAdmin:s,utilisateur:n}=K(),[t,i]=f.useState(null),[c,a]=f.useState(null),[p,d]=f.useState(!1),[m,g]=f.useState(!1),[b,v]=f.useState(null),[l,C]=f.useState(null),q=f.useRef(0),E=f.useRef(null);function r(){const o=++q.current;a(null),M.get("/conditions-licence").then(u=>o===q.current&&i(u)).catch(u=>o===q.current&&a(u instanceof S?u.message:"Lecture impossible."))}f.useEffect(r,[]),f.useEffect(()=>{var o;l&&((o=E.current)==null||o.focus())},[l]);async function x(){var o;if(!(!t||!p)){g(!0),v(null);try{const u=await M.post("/conditions-licence/acceptation",{version:y,empreinte:w,empreinteCommande:oe(t.commande),lu:!0});i(u.etat),C({deja:u.deja,statut:((o=u.accuse)==null?void 0:o.statut)??null}),window.dispatchEvent(new Event("omegax:conditions-acceptees"))}catch(u){v(u instanceof S?u.message:"Acceptation impossible."),d(!1),r()}finally{g(!1)}}}async function A(){var o;g(!0),v(null);try{const u=await M.post("/conditions-licence/accuse",{});i(u.etat),C({deja:!1,statut:((o=u.accuse)==null?void 0:o.statut)??null})}catch(u){v(u instanceof S?u.message:"Renvoi impossible."),r()}finally{g(!1)}}const V=o=>new Date(o).toLocaleString("fr-FR",{timeZone:"Africa/Kinshasa",dateStyle:"long",timeStyle:"short"}),j=t?ue(t.version,{numero:y,empreinte:w}):null,R=j==="A_JOUR",L=t!=null&&t.acceptation&&t.acceptation.version!==y?re(t.acceptation.version):null,z=l?l.statut:((T=t==null?void 0:t.accuse)==null?void 0:T.statut)??null;return e.jsxs("section",{className:"ecran-seul mt-5 border border-border bg-surface px-3.5 py-3 text-[11.5px]","aria-label":"Acceptation des conditions par ce dossier",children:[e.jsxs("h2",{className:"text-[12px] font-bold mb-1.5 flex items-center gap-1.5",children:["Acceptation par ce dossier",e.jsx(Y,{titre:"Acceptation en ligne",texte:"L’administrateur du dossier accepte les conditions au nom de l’entité, après avoir vérifié la version et l’abonnement du dossier. L’acceptation est enregistrée avec la version et l’empreinte du texte accepté, son auteur, sa date et l’adresse réseau au journal d’audit. OmegaX en accuse réception aussitôt à l’écran, et met en file un courriel qui porte l’accusé et le texte accepté. Sans acceptation, l’accès au dossier n’est pas interrompu.",source:"Code du numérique, art. 30, al. 3 ; art. 53 à 56."})]}),c&&e.jsx("p",{role:"alert",className:"text-danger",children:c}),!t&&!c&&e.jsx("p",{className:"text-text-dim",children:"Chargement…"}),t&&e.jsxs(e.Fragment,{children:[t.acceptation?e.jsxs("p",{className:"mb-1.5",children:["Acceptées · version ",t.acceptation.version,", le ",V(t.acceptation.le)," (heure de Kinshasa), par"," ",t.acceptation.par??X,"."]}):e.jsx("p",{className:"mb-1.5",children:"Aucune acceptation enregistrée pour ce dossier."}),t.acceptation&&!t.aJour&&e.jsxs("p",{className:"mb-1.5 text-warning",children:["La version en vigueur (",t.version.numero,") n’a pas encore été acceptée."]}),L&&e.jsxs("button",{type:"button",onClick:()=>I(L.numero,L.texte),className:"text-sel underline mb-1.5",children:["Télécharger le texte accepté (version ",L.numero,")"]}),j&&j!=="A_JOUR"&&e.jsxs("div",{role:"alert",className:"mb-2 text-warning",children:[e.jsx("p",{children:le(j,t.version.numero,y,s)}),j==="SERVICE_EN_RETARD"?e.jsx("button",{type:"button",onClick:r,className:"text-sel underline font-semibold",children:"Réessayer"}):e.jsx("button",{type:"button",onClick:()=>window.location.reload(),className:"text-sel underline font-semibold",children:"Recharger la page"})]}),t.commande&&e.jsxs("div",{className:"mb-2",children:[e.jsx("p",{className:"font-semibold mb-1",children:t.commande.duSiege?"Abonnement du siège du groupe":"Abonnement du dossier"}),e.jsxs("p",{children:[t.commande.formule,t.commande.options.length>0?` · options ${t.commande.options.join(", ")}`:""," ·"," ",t.commande.periodicite==="ANNUELLE"?"annuel":"mensuel"," · depuis le ",_(t.commande.debut),t.commande.finEssai?` · essai jusqu’au ${_(t.commande.finEssai)}`:"",t.commande.actif?"":" · suspendu","."]}),t.commande.lignes?e.jsxs("table",{className:"mt-1",children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{scope:"col",className:"pr-3 text-left",children:"Désignation"}),e.jsx("th",{scope:"col",className:"pr-3 text-right",children:"Quantité"}),e.jsx("th",{scope:"col",className:"text-right",children:"Prix unitaire"})]})}),e.jsxs("tbody",{children:[t.commande.lignes.map((o,u)=>e.jsxs("tr",{children:[e.jsx("td",{className:"pr-3",children:o.designation}),e.jsx("td",{className:"pr-3 text-right",children:o.quantite}),e.jsxs("td",{className:"text-right",children:[U(o.prixUnitaireUsd)," USD"]})]},u)),e.jsxs("tr",{children:[e.jsx("td",{className:"pr-3 font-semibold",children:"Total d’une période"}),e.jsx("td",{}),e.jsxs("td",{className:"text-right font-semibold",children:[U(t.commande.totalUsd)," USD"]})]})]})]}):e.jsx("p",{className:"text-warning",children:t.commande.motifPrix})]}),t.motifFermeture&&e.jsx("p",{className:"text-text-dim",children:t.motifFermeture}),t.aAccepter&&!s&&e.jsx("p",{className:"text-text-dim",children:"Seul l’administrateur du dossier accepte les conditions au nom de l’entité."}),t.aAccepter&&s&&R&&e.jsxs("div",{className:"mt-2 flex flex-col gap-2",children:[e.jsxs("label",{className:"flex items-start gap-2",children:[e.jsx("input",{type:"checkbox",checked:p,onChange:o=>d(o.target.checked),className:"mt-0.5"}),e.jsxs("span",{children:["J’ai lu les conditions de licence, version ",y," du ",N.dateLisible,", et je les accepte au nom de"," ",(n==null?void 0:n.tenant.nom)??"ce dossier","."]})]}),e.jsx("div",{children:e.jsx("button",{type:"button",disabled:!p||m,onClick:x,className:"bg-sel text-white rounded-full px-4 py-1 font-semibold disabled:opacity-50",children:m?"Un instant…":"Accepter les conditions"})})]}),b&&e.jsx("p",{role:"alert",className:"mt-2 text-danger",children:b}),t.acceptation&&t.aJour&&(l||t.accuse||t.renvoiAccusePossible)&&e.jsxs("div",{ref:E,tabIndex:-1,role:"status",className:"mt-2 border border-sel/30 bg-sel-soft px-3 py-2",children:[e.jsx("p",{className:"font-semibold",children:"Accusé de réception"}),l&&e.jsxs("p",{children:[l.deja?"Ces conditions étaient déjà acceptées":"Conditions acceptées"," · version ",t.acceptation.version,", le"," ",V(t.acceptation.le)," (heure de Kinshasa), par ",t.acceptation.par??X,"."]}),!(l&&l.deja)&&e.jsx("p",{children:ce(z,s)}),s&&t.renvoiAccusePossible&&e.jsx("button",{type:"button",disabled:m,onClick:A,className:"mt-1 text-sel underline font-semibold disabled:opacity-50",children:"Renvoyer l’accusé"})]})]})]})}const k=`Version ${N.numero} du ${N.dateLisible} · langue du contrat · ${Q}`;function F({texte:s}){const n=s.split(`(${D})`);return e.jsx(e.Fragment,{children:n.map((t,i)=>e.jsxs(f.Fragment,{children:[t,i<n.length-1&&e.jsxs("em",{className:"text-warning not-italic font-semibold",children:["(",D,")"]})]},i))})}function H(){return e.jsx("div",{className:"text-[11.5px] leading-relaxed",children:Z().map(s=>e.jsxs("section",{id:`article-${s.numero}`,className:"eviter-coupure",children:[e.jsx("h2",{className:"text-[12px] font-bold mt-4 mb-1.5",children:`${s.numero}. ${s.titre}`}),s.alineas.map((n,t)=>typeof n=="string"?e.jsx("p",{className:"mb-2",children:e.jsx(F,{texte:n})},t):e.jsx("ul",{className:"list-disc pl-5 mb-2 space-y-1",children:n.liste.map((i,c)=>e.jsx("li",{children:e.jsx(F,{texte:i})},c))},t))]},s.numero))})}function pe(){I(N.numero,$())}function J(){return e.jsx("button",{type:"button",onClick:pe,className:"ecran-seul text-[11.5px] text-sel underline mb-2",children:"Télécharger le texte"})}function B(){const s=P.filter(n=>n.numero!==N.numero);return s.length===0?null:e.jsxs("section",{className:"ecran-seul mt-5 text-[11.5px]","aria-label":"Versions antérieures",children:[e.jsx("h2",{className:"text-[12px] font-bold mb-1.5",children:"Versions antérieures"}),e.jsx("ul",{className:"list-disc pl-5 space-y-1",children:s.map(n=>e.jsxs("li",{children:["Version ",n.numero," du ",n.dateLisible," ·"," ",e.jsx("button",{type:"button",onClick:()=>I(n.numero,n.texte),className:"text-sel underline",children:"Télécharger le texte"})]},n.numero))})]})}function xe(){return e.jsxs(ee,{titre:"Contrat de licence d’OmegaX",sousTitre:k,children:[e.jsx(J,{}),e.jsx(H,{}),e.jsx(B,{})]})}function he(){return e.jsxs(W,{sousTitre:k,children:[e.jsx(J,{}),e.jsx(H,{}),e.jsx(B,{}),e.jsx(de,{})]})}export{H as ContenuContratLicence,he as ContratLicenceFenetre,xe as ContratLicencePage,pe as telechargerTexteDuContrat};
