import { useEffect, useRef, useState } from 'react';
import { AUTEUR_NON_ENREGISTRE, type EtatConditions } from '../../../src/modules/conditions-licence/acceptation-conditions';
import { VERSION_CONDITIONS_LICENCE } from '../../../src/modules/conditions-licence/conditions-de-licence';
import { empreinteEnVigueur, versionPubliee } from '../../../src/modules/conditions-licence/versions-publiees';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import { montant } from '../lib/montants';
import { Aide } from './chrome/Aide';
import { telechargerTexteDeVersion } from './telechargerContrat';

/**
 * L'ACCEPTATION DES CONDITIONS DE LICENCE PAR LE DOSSIER · Code du numérique
 * (ordonnance-loi n° 23/10 du 13 mars 2023), art. 55. L'état est SERVI par le
 * serveur (`GET /conditions-licence`) · la version qu'il tient en vigueur et
 * l'empreinte de son texte, l'acceptation enregistrée, le motif qui ferme
 * l'acceptation, l'abonnement et son prix, le dernier accusé de réception.
 * L'écran ne recalcule rien, sans quoi il pourrait ouvrir une acceptation que
 * le serveur refuse, ou montrer un prix que la facture ne portera pas.
 *
 * LE TEXTE ACCEPTÉ EST CELUI QUE L'ÉCRAN AFFICHE (relecture « échecs
 * silencieux », M1) · le numéro et l'empreinte envoyés sont ceux du code
 * chargé dans CETTE page, jamais ceux que le serveur rend · une page restée
 * ouverte pendant une mise en production aurait sinon fait accepter un texte
 * qu'elle n'affichait pas. Quand les deux diffèrent, rien ne s'accepte, et
 * l'écran demande de recharger la page.
 *
 * QUATRE ÉTATS, CHACUN DIT · pas encore lu (rien n'est affiché comme « aucune
 * acceptation » avant la réponse), lecture en échec (le motif), acceptation
 * fermée (le motif du serveur), acceptation à faire (l'administrateur seul).
 * L'accusé de réception s'affiche aussitôt (art. 55, al. 2) · c'est l'accusé
 * électronique que la loi demande, le courriel en file n'en est que la copie.
 */

/** Le texte que CETTE page affiche · son numéro et son empreinte, calculée sur lui. */
const VERSION_AFFICHEE = VERSION_CONDITIONS_LICENCE.numero;
const EMPREINTE_AFFICHEE = empreinteEnVigueur();

/** Ce que devient un accusé, dit comme le statut de la file le dit. */
function phraseAccuse(statut: string | null): string {
  switch (statut) {
    case 'ENVOYE':
      return 'Le courriel portant cet accusé et le texte accepté est parti.';
    case 'EN_ATTENTE':
      return 'Un courriel portant cet accusé et le texte accepté est en file, à l’adresse de l’auteur de l’acceptation (Fichier > Courriers sortants).';
    case 'SANS_TRANSPORT':
      return 'Un courriel portant cet accusé et le texte accepté est en file, mais aucune messagerie n’est configurée pour l’envoi · il ne partira qu’une fois une messagerie configurée (Fichier > Courriers sortants).';
    case 'ECHEC':
    case 'ABANDONNE':
      return 'Le courriel portant cet accusé n’a pas pu partir · il peut être renvoyé.';
    default:
      return 'Le courriel d’accusé de réception n’a pas pu être mis en file · le texte reste téléchargeable ci-dessus, et l’accusé peut être renvoyé.';
  }
}

export function AcceptationConditionsLicence() {
  const { estAdmin, utilisateur } = useAuth();
  const [etat, setEtat] = useState<EtatConditions | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [lu, setLu] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const [accuse, setAccuse] = useState<{ deja: boolean; statut: string | null } | null>(null);
  const jeton = useRef(0);

  useEffect(() => {
    const n = ++jeton.current;
    api
      .get<EtatConditions>('/conditions-licence')
      .then((e) => n === jeton.current && setEtat(e))
      .catch((e) => n === jeton.current && setErreurLecture(e instanceof ApiError ? e.message : 'Lecture impossible.'));
  }, []);

  async function accepter() {
    if (!etat || !lu) return;
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ etat: EtatConditions; deja: boolean; accuse: { statut: string } | null }>('/conditions-licence/acceptation', {
        version: VERSION_AFFICHEE,
        empreinte: EMPREINTE_AFFICHEE,
        lu: true,
      });
      setEtat(r.etat);
      setAccuse({ deja: r.deja, statut: r.accuse?.statut ?? null });
      // La bannière de l'espace de travail relit l'état à cet événement.
      window.dispatchEvent(new Event('omegax:conditions-acceptees'));
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Acceptation impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  async function renvoyerAccuse() {
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ etat: EtatConditions; accuse: { statut: string } | null }>('/conditions-licence/accuse', {});
      setEtat(r.etat);
      setAccuse({ deja: false, statut: r.accuse?.statut ?? null });
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Renvoi impossible.');
    } finally {
      setEnvoi(false);
    }
  }

  const horodatage = (iso: string) =>
    new Date(iso).toLocaleString('fr-FR', { timeZone: 'Africa/Kinshasa', dateStyle: 'long', timeStyle: 'short' });

  // Le texte de cette page est-il celui que le service tient en vigueur ?
  const texteAJour = etat !== null && etat.version.numero === VERSION_AFFICHEE && etat.version.empreinte === EMPREINTE_AFFICHEE;
  // Une version acceptée qui n'est plus celle affichée reste lisible (contrat, article 18).
  const accepteeArchivee =
    etat?.acceptation && etat.acceptation.version !== VERSION_AFFICHEE ? versionPubliee(etat.acceptation.version) : null;
  const statutAccuse = accuse ? accuse.statut : etat?.accuse?.statut ?? null;

  return (
    <section className="ecran-seul mt-5 border border-border bg-surface px-3.5 py-3 text-[11.5px]" aria-label="Acceptation des conditions par ce dossier">
      <h2 className="text-[12px] font-bold mb-1.5 flex items-center gap-1.5">
        Acceptation par ce dossier
        <Aide
          titre="Acceptation en ligne"
          texte="L’administrateur du dossier accepte les conditions au nom de l’entité, après avoir vérifié la version et l’abonnement du dossier. L’acceptation est enregistrée avec la version et l’empreinte du texte accepté, son auteur, sa date et l’adresse réseau au journal d’audit. OmegaX en accuse réception aussitôt à l’écran, et met en file un courriel qui porte l’accusé et le texte accepté. Sans acceptation, l’accès au dossier n’est pas interrompu."
          source="Code du numérique, art. 30, al. 3 ; art. 53 à 56."
        />
      </h2>

      {erreurLecture && <p role="alert" className="text-danger">{erreurLecture}</p>}
      {!etat && !erreurLecture && <p className="text-text-dim">Chargement…</p>}

      {etat && (
        <>
          {etat.acceptation ? (
            <p className="mb-1.5">
              Acceptées · version {etat.acceptation.version}, le {horodatage(etat.acceptation.le)} (heure de Kinshasa), par{' '}
              {etat.acceptation.par ?? AUTEUR_NON_ENREGISTRE}.
            </p>
          ) : (
            <p className="mb-1.5">Aucune acceptation enregistrée pour ce dossier.</p>
          )}
          {etat.acceptation && !etat.aJour && (
            <p className="mb-1.5 text-warning">La version en vigueur ({etat.version.numero}) n’a pas encore été acceptée.</p>
          )}
          {accepteeArchivee && (
            <button
              type="button"
              onClick={() => telechargerTexteDeVersion(accepteeArchivee.numero, accepteeArchivee.texte)}
              className="text-sel underline mb-1.5"
            >
              Télécharger le texte accepté (version {accepteeArchivee.numero})
            </button>
          )}

          {!texteAJour && (
            <div role="alert" className="mb-2 text-warning">
              <p>
                Le texte affiché (version {VERSION_AFFICHEE}) n’est pas celui que le service tient en vigueur (version {etat.version.numero}) ·
                rechargez la page avant d’accepter.
              </p>
              <button type="button" onClick={() => window.location.reload()} className="text-sel underline font-semibold">
                Recharger la page
              </button>
            </div>
          )}

          {etat.commande && (
            <div className="mb-2">
              <p className="font-semibold mb-1">{etat.commande.duSiege ? 'Abonnement du siège du groupe' : 'Abonnement du dossier'}</p>
              <p>
                {etat.commande.formule}
                {etat.commande.options.length > 0 ? ` · options ${etat.commande.options.join(', ')}` : ''} ·{' '}
                {etat.commande.periodicite === 'ANNUELLE' ? 'annuel' : 'mensuel'} · depuis le {etat.commande.debut}
                {etat.commande.finEssai ? ` · essai jusqu’au ${etat.commande.finEssai}` : ''}
                {etat.commande.actif ? '' : ' · suspendu'}.
              </p>
              {etat.commande.lignes ? (
                <table className="mt-1">
                  <tbody>
                    {etat.commande.lignes.map((l, i) => (
                      <tr key={i}>
                        <td className="pr-3">{l.designation}</td>
                        <td className="pr-3 text-right">{l.quantite}</td>
                        <td className="text-right">{montant(l.prixUnitaireUsd)} USD</td>
                      </tr>
                    ))}
                    <tr>
                      <td className="pr-3 font-semibold">Total d’une période</td>
                      <td />
                      <td className="text-right font-semibold">{montant(etat.commande.totalUsd)} USD</td>
                    </tr>
                  </tbody>
                </table>
              ) : (
                <p className="text-warning">{etat.commande.motifPrix}</p>
              )}
            </div>
          )}

          {etat.motifFermeture && <p className="text-text-dim">{etat.motifFermeture}</p>}

          {etat.aAccepter && !estAdmin && <p className="text-text-dim">Seul l’administrateur du dossier accepte les conditions au nom de l’entité.</p>}

          {etat.aAccepter && estAdmin && texteAJour && (
            <div className="mt-2 flex flex-col gap-2">
              <label className="flex items-start gap-2">
                <input type="checkbox" checked={lu} onChange={(e) => setLu(e.target.checked)} className="mt-0.5" />
                <span>
                  J’ai lu les conditions de licence, version {VERSION_AFFICHEE} du {VERSION_CONDITIONS_LICENCE.dateLisible}, et je les accepte au nom de{' '}
                  {utilisateur?.tenant.nom ?? 'ce dossier'}.
                </span>
              </label>
              <div>
                <button
                  type="button"
                  disabled={!lu || envoi}
                  onClick={accepter}
                  className="bg-sel text-white rounded-full px-4 py-1 font-semibold disabled:opacity-50"
                >
                  {envoi ? 'Un instant…' : 'Accepter les conditions'}
                </button>
              </div>
            </div>
          )}

          {erreur && (
            <p role="alert" className="mt-2 text-danger">
              {erreur}
            </p>
          )}

          {etat.acceptation && etat.aJour && (accuse || etat.accuse || etat.renvoiAccusePossible) && (
            <div role="status" className="mt-2 border border-sel/30 bg-sel-soft px-3 py-2">
              <p className="font-semibold">Accusé de réception</p>
              {accuse && (
                <p>
                  {accuse.deja ? 'Ces conditions étaient déjà acceptées' : 'Conditions acceptées'} · version {etat.acceptation.version}, le{' '}
                  {horodatage(etat.acceptation.le)} (heure de Kinshasa), par {etat.acceptation.par ?? AUTEUR_NON_ENREGISTRE}.
                </p>
              )}
              {!(accuse && accuse.deja) && <p>{phraseAccuse(statutAccuse)}</p>}
              {estAdmin && etat.renvoiAccusePossible && (
                <button type="button" disabled={envoi} onClick={renvoyerAccuse} className="mt-1 text-sel underline font-semibold disabled:opacity-50">
                  Renvoyer l’accusé
                </button>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
