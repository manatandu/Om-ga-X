import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { Aide } from './chrome/Aide';
import { PortailModale } from './PortailModale';
import { ecouterEchap } from '../lib/echap';
import { montant } from '../lib/montants';
import {
  partsAEnvoyer,
  resteEnFrancs,
  type LigneADeclarer,
  type PartSaisie,
  type ReponseADeclarer,
} from '../lib/declaration-devise-a-nouveau';

/**
 * LES À-NOUVEAUX SANS DEVISE (ligne AU3) · ce qui reste à déclarer, nommé par
 * le serveur, jamais deviné. Une ligne se déclare en devise (une ou plusieurs
 * parts, le reste en francs) ou entièrement en francs ; la source est
 * exigée. Réservé à qui valide (`peutValider`) · une ligne validée se
 * corrige par inscription en négatif.
 */
export function ANouveauxADeclarer(p: {
  devises: { id: string; code: string; estActive: boolean }[];
  peutValider: boolean;
  /** Une déclaration change ce que la réévaluation lit · la page se relit. */
  apresDeclaration: () => void;
}) {
  const [reponse, setReponse] = useState<ReponseADeclarer | null>(null);
  const [erreurLecture, setErreurLecture] = useState<string | null>(null);
  const [enCours, setEnCours] = useState<{ ligne: LigneADeclarer; parts: PartSaisie[]; source: string } | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const premierChamp = useRef<HTMLSelectElement | null>(null);
  const jeton = useRef(0);

  const lire = useCallback(async () => {
    const mien = ++jeton.current;
    setErreurLecture(null);
    try {
      const r = await api.get<ReponseADeclarer>('/devises/a-nouveaux/a-declarer');
      if (mien === jeton.current) setReponse(r);
    } catch (e) {
      if (mien === jeton.current) {
        setReponse(null);
        setErreurLecture(e instanceof ApiError ? e.message : 'Lecture impossible');
      }
    }
  }, []);

  useEffect(() => {
    void lire();
  }, [lire]);

  useEffect(() => {
    if (!enCours) return;
    premierChamp.current?.focus({ preventScroll: true });
    return ecouterEchap(() => {
      if (envoi) return true;
      setEnCours(null);
      return true;
    });
    // La modale s'ouvre une fois par ligne · la mise au point aussi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enCours?.ligne.ligneId, envoi]);

  const ouvrir = (ligne: LigneADeclarer) => {
    setErreur(null);
    setMessage(null);
    setEnCours({ ligne, parts: [{ deviseId: '', montantDevise: '', cours: '', montant: String(Math.abs(ligne.montant)) }], source: '' });
  };

  const declarer = async (enFrancs: boolean) => {
    if (!enCours) return;
    const lues = enFrancs ? { parts: [] } : partsAEnvoyer(enCours.parts, enCours.ligne.montant);
    if ('motif' in lues) {
      setErreur(lues.motif);
      return;
    }
    if (!enFrancs && lues.parts.length === 0) {
      setErreur('Aucune part saisie · pour une ligne en francs, utilisez « Déclarer en francs ».');
      return;
    }
    setEnvoi(true);
    setErreur(null);
    try {
      const r = await api.post<{ messages: string[] }>('/devises/a-nouveaux/declaration', {
        ligneId: enCours.ligne.ligneId,
        parts: lues.parts,
        source: enCours.source.trim(),
      });
      setMessage(r.messages.join(' '));
      setEnCours(null);
      await lire();
      p.apresDeclaration();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Déclaration impossible');
    } finally {
      setEnvoi(false);
    }
  };

  const devisesEtrangeres = p.devises.filter((d) => d.code.toUpperCase() !== 'CDF' && d.estActive);
  const champ = 'mt-1 w-full border border-border-dark px-2 py-1 text-[12px] font-normal';

  if (reponse?.sansDeviseEtrangere) return null;

  return (
    <section className="bg-surface border border-border rounded-[4px] shadow-posee overflow-x-auto mt-2.5">
      <div className="px-3 py-2 bg-chrome-alt border-b border-border text-[11.5px] font-bold flex items-center gap-1.5">
        À-nouveaux sans devise
        <Aide
          titre="À-nouveaux sans devise"
          texte="Une balance d'ouverture importée sans devise fait d'une créance ou d'une dette en devise une ligne en francs, que la réévaluation de clôture ne lit pas. Rien n'est deviné · déclarez, pièce à l'appui, quelle part de la ligne est en quelle devise et pour quel montant en devise ; le reste est en francs. Au brouillard, la ligne est complétée en place ; validée, elle est inscrite en négatif puis ses parts exactes dans une pièce de correction (au brouillard sous le double regard). Refusé si la ligne est lettrée ou pointée, si une réévaluation de cet exercice ou d'un exercice suivant l'a déjà lue (annulez-la d'abord), si des règlements en francs non lettrés réduisent déjà le compte, ou si l'exercice précédent est encore ouvert (déclarez sur son bilan d'ouverture). Le report au détail d'une ligne non déclarée la suit ; un report au solde ne se retrouve pas, et la ligne est nommée."
          source="AUDCIF art. 20, al. 2 ; art. 22, 2° ; art. 52 et 54"
        />
      </div>
      {message && <div className="px-3 py-2 text-[11.5px] text-success border-b border-border">{message}</div>}
      {erreurLecture && (
        <div role="alert" className="px-3 py-2 text-[11.5px] text-danger">
          {erreurLecture}
        </div>
      )}
      {reponse && reponse.lignes.length === 0 && reponse.nonRetrouvees.length === 0 && !erreurLecture && (
        <div className="px-3 py-2 text-[11.5px] text-text-dim italic">Aucune ligne d'à-nouveau importée ne reste à déclarer.</div>
      )}
      {reponse && reponse.lignes.length > 0 && (
        <table className="w-full min-w-[720px] text-[11.5px]">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">Exercice</th>
              <th className="text-left px-2 py-1">Pièce</th>
              <th className="text-left px-2 py-1">Origine</th>
              <th className="text-left px-2 py-1">Compte</th>
              <th className="text-right px-2 py-1">Montant</th>
              <th className="text-left px-2 py-1">État</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reponse.lignes.map((l) => (
              <tr key={l.ligneId} className="border-b border-border/40 align-top">
                <td className="px-2 py-1">{l.exercice}</td>
                <td className="px-2 py-1">
                  {l.piece ?? '·'} du {l.date.split('-').reverse().join('/')}
                </td>
                <td className="px-2 py-1">{l.origine === 'IMPORT' ? 'Bilan importé' : 'Report de clôture'}</td>
                <td className="px-2 py-1">
                  {l.compteNumero} {l.compteIntitule}
                </td>
                <td className="px-2 py-1 text-right">{montant(l.montant)}</td>
                <td className="px-2 py-1 max-w-[320px]">
                  {l.motifRefus ? <span className="text-warning">{l.motifRefus}</span> : l.statut === 'VALIDEE' ? 'Validée' : 'Brouillard'}
                </td>
                <td className="px-2 py-1 text-right">
                  {p.peutValider && !l.motifRefus && (
                    <button type="button" onClick={() => ouvrir(l)} className="text-sel hover:underline font-semibold">
                      Déclarer
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {reponse && reponse.nonRetrouvees.length > 0 && (
        <div className="px-3 py-2 text-[11.5px] text-warning border-t border-border">
          {reponse.nonRetrouvees.map((n, i) => (
            <div key={`${n.exercice}-${n.compteNumero}-${i}`}>
              Compte {n.compteNumero}, {montant(n.montant)} (bilan importé {n.exercice}) · report{' '}
              {n.motif === 'AMBIGU' ? 'ambigu' : 'non retrouvé'} en {n.exerciceSuivant} · rien n'est hérité, sa devise se corrige par inscription en négatif.
            </div>
          ))}
        </div>
      )}
      {reponse?.tronque && (
        <div className="px-3 py-2 text-[11.5px] text-text-dim">
          {reponse.lignes.length} ligne(s) affichée(s) sur {reponse.total} · déclarez celles-ci, la liste se relit.
        </div>
      )}

      {enCours && (
        <PortailModale>
          <div className="anim-voile fixed inset-0 z-40 bg-black/35 flex items-center justify-center p-4">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void declarer(false);
              }}
              className="anim-modale w-full max-w-[560px] bg-surface border border-border-dark shadow-flottante modale-bornee max-h-[calc(100dvh-2rem)] overflow-y-auto"
            >
              <div className="h-[32px] flex items-center justify-between px-2.5 bg-surface text-text border-b border-border text-[11.5px]">
                <span>
                  Devise de la ligne {enCours.ligne.compteNumero} · {montant(enCours.ligne.montant)}
                </span>
                <button
                  type="button"
                  disabled={envoi}
                  onClick={() => setEnCours(null)}
                  className="-mr-2 self-stretch w-[46px] flex items-center justify-center text-text-dim hover:text-white hover:bg-[#c42b1c]"
                >
                  ✕
                </button>
              </div>
              <div className="p-4 flex flex-col gap-2.5">
                {erreur && (
                  <div role="alert" className="text-[11.5px] text-danger bg-danger-soft border border-danger/30 px-3 py-2">
                    {erreur}
                  </div>
                )}
                {enCours.parts.map((part, i) => (
                  <div key={i} className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <label className="text-[11.5px] font-semibold text-text-dim">
                      Devise
                      <select
                        ref={i === 0 ? premierChamp : undefined}
                        value={part.deviseId}
                        onChange={(e) => {
                          const parts = [...enCours.parts];
                          parts[i] = { ...part, deviseId: e.target.value };
                          setEnCours({ ...enCours, parts });
                        }}
                        className={champ}
                      >
                        <option value="">(choisir)</option>
                        {devisesEtrangeres.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.code}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-[11.5px] font-semibold text-text-dim">
                      Montant en devise
                      <input
                        value={part.montantDevise}
                        onChange={(e) => {
                          const parts = [...enCours.parts];
                          parts[i] = { ...part, montantDevise: e.target.value };
                          setEnCours({ ...enCours, parts });
                        }}
                        className={champ}
                      />
                    </label>
                    <label className="text-[11.5px] font-semibold text-text-dim">
                      Part en francs
                      <input
                        value={part.montant}
                        onChange={(e) => {
                          const parts = [...enCours.parts];
                          parts[i] = { ...part, montant: e.target.value };
                          setEnCours({ ...enCours, parts });
                        }}
                        className={champ}
                      />
                    </label>
                    <label className="text-[11.5px] font-semibold text-text-dim">
                      Cours (facultatif)
                      <input
                        value={part.cours}
                        onChange={(e) => {
                          const parts = [...enCours.parts];
                          parts[i] = { ...part, cours: e.target.value };
                          setEnCours({ ...enCours, parts });
                        }}
                        className={champ}
                      />
                    </label>
                  </div>
                ))}
                <div className="flex items-center justify-between text-[11.5px]">
                  <button
                    type="button"
                    onClick={() =>
                      setEnCours({ ...enCours, parts: [...enCours.parts, { deviseId: '', montantDevise: '', cours: '', montant: '' }] })
                    }
                    className="text-sel hover:underline"
                  >
                    Ajouter une part
                  </button>
                  <span className="text-text-dim">Reste en francs · {montant(resteEnFrancs(enCours.parts, enCours.ligne.montant))}</span>
                </div>
                <label className="text-[11.5px] font-semibold text-text-dim">
                  Source (pièce qui établit la devise)
                  <textarea
                    required
                    minLength={3}
                    maxLength={500}
                    value={enCours.source}
                    onChange={(e) => setEnCours({ ...enCours, source: e.target.value })}
                    className={`${champ} min-h-[60px]`}
                  />
                </label>
                <div className="flex flex-wrap gap-2 mt-1">
                  <button
                    type="submit"
                    disabled={envoi || enCours.source.trim().length < 3}
                    className="bg-sel text-white text-[11.5px] font-semibold px-4 py-1.5 rounded-full disabled:opacity-40"
                  >
                    Déclarer la devise
                  </button>
                  <button
                    type="button"
                    disabled={envoi || enCours.source.trim().length < 3}
                    onClick={() => void declarer(true)}
                    className="border border-border text-[11.5px] font-semibold px-4 py-1.5 disabled:opacity-40"
                  >
                    Déclarer en francs
                  </button>
                  <button type="button" disabled={envoi} onClick={() => setEnCours(null)} className="text-[11.5px] font-semibold text-text-dim px-4 py-1.5">
                    Fermer
                  </button>
                </div>
              </div>
            </form>
          </div>
        </PortailModale>
      )}
    </section>
  );
}
