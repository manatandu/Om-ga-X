import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { Aide } from '../chrome/Aide';
import { CHAMP_PAIE } from './ModalePaie';
import { dateCourte } from '../../lib/conges-paie';
import type { ListeMajorations } from '../../lib/heures-majorees';

/**
 * LIGNE SAGE-L5, FONCTION 78, ÉTAPE 2 · LES TAUX DE MAJORATION DU DOSSIER,
 * dans l'onglet Barèmes · déclarés avec leur source, désactivés jamais
 * supprimés. Les boutons suivent `peutEcrire`, comme les routes.
 */
export function MajorationsHeuresPaie({ peutEcrire }: { peutEcrire: boolean }) {
  // Null tant que la liste n'est pas LUE.
  const [liste, setListe] = useState<ListeMajorations | null>(null);
  const [erreur, setErreur] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [f, setF] = useState({ nature: '', libelle: '', taux: '', source: '', dateEffet: '' });

  const charger = useCallback(() => {
    api.get<ListeMajorations>('/personnel/majorations-heures').then(setListe, (e: ApiError) => setErreur(e.message));
  }, []);
  useEffect(charger, [charger]);

  const envoyer = async (fn: () => Promise<unknown>) => {
    setErreur('');
    setEnvoi(true);
    try {
      await fn();
      setEnvoi(false);
      charger();
      return true;
    } catch (e) {
      setEnvoi(false);
      setErreur(e instanceof ApiError ? e.message : 'Opération refusée.');
      return false;
    }
  };

  const creer = async (e: FormEvent) => {
    e.preventDefault();
    const taux = Number(f.taux.replace(',', '.'));
    if (!f.nature || f.libelle.trim().length < 3 || !Number.isFinite(taux) || f.source.trim().length < 3 || !f.dateEffet) {
      setErreur("La nature, l'intitulé, le taux, la source et la date d'effet se déclarent ensemble.");
      return;
    }
    const ok = await envoyer(() =>
      api.post('/personnel/majorations-heures', {
        nature: f.nature,
        libelle: f.libelle.trim(),
        tauxPourCent: taux,
        source: f.source.trim(),
        dateEffet: f.dateEffet,
      }),
    );
    if (ok) setF({ nature: '', libelle: '', taux: '', source: '', dateEffet: '' });
  };

  const natureDe = (cle: string) => liste?.natures.find((n) => n.cle === cle)?.libelle ?? cle;

  return (
    <section className="ecran-seul max-w-[1240px] text-[11.5px] mt-4">
      <div className="font-semibold mb-1 flex items-center gap-1.5">
        Majorations des heures
        <Aide
          titre="Majorations des heures"
          texte="Le Code du travail donne droit à une majoration pour les heures au-delà de la durée légale (quarante-cinq heures par semaine, huit par jour) et pour le travail de nuit, de 19 heures à 5 heures, mais renvoie leurs taux à des arrêtés qui ne sont pas au corpus. Chaque taux se déclare donc ici avec sa source (convention collective, règlement d'entreprise, arrêté) et sa date d'effet. Une heure supplémentaire se paie entière et majorée ; l'heure de nuit, du samedi, du dimanche ou d'un férié faite dans l'horaire normal ne paie que son supplément. Aucun plafond d'heures n'est opposé, le nombre autorisé relevant du même arrêté. Une majoration ne se supprime pas, elle se désactive."
          source="Code du travail, art. 93, 119, 120 et 124 · arrêté n° 12/CAB.MIN/ETPS/042 du 8 août 2008, mentions 8 à 11"
        />
      </div>
      {erreur && (
        <div role="alert" className="border border-danger/30 bg-danger-soft text-danger px-3 py-2 mb-2">
          {erreur}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px]">
          <thead>
            <tr>
              <th className="text-left px-2 py-1">Nature</th>
              <th className="text-left px-2 py-1">Intitulé</th>
              <th className="text-right px-2 py-1">Taux</th>
              <th className="text-left px-2 py-1">Source</th>
              <th className="text-left px-2 py-1">Effet</th>
              <th className="px-2 py-1 w-[100px]" />
            </tr>
          </thead>
          <tbody>
            {liste && liste.majorations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-2 py-1 text-text-dim">
                  Aucune majoration déclarée.
                </td>
              </tr>
            )}
            {liste?.majorations.map((m) => (
              <tr key={m.id} className={m.actif ? '' : 'text-text-dim'}>
                <td className="px-2 py-1">{natureDe(m.nature)}</td>
                <td className="px-2 py-1">{m.libelle}</td>
                <td className="px-2 py-1 text-right">{m.tauxPourCent.toLocaleString('fr-FR')} %</td>
                <td className="px-2 py-1">{m.source}</td>
                <td className="px-2 py-1">
                  {dateCourte(m.dateEffet)}
                  {m.actif ? '' : ' · désactivée'}
                </td>
                <td className="px-2 py-1 text-right">
                  {peutEcrire && m.actif && (
                    <button
                      type="button"
                      className="text-danger hover:underline"
                      disabled={envoi}
                      onClick={() => void envoyer(() => api.post(`/personnel/majorations-heures/${m.id}/desactivation`, {}))}
                    >
                      Désactiver
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {liste?.tronque && <div className="text-warning mt-1">Liste tronquée · seules les {liste.majorations.length} premières majorations sont lues.</div>}
      {peutEcrire && liste && (
        <form onSubmit={creer} className="flex flex-wrap gap-1.5 mt-2 items-center">
          <select aria-label="Nature de la majoration" value={f.nature} onChange={(e) => setF({ ...f, nature: e.target.value })} className={`${CHAMP_PAIE} w-auto`}>
            <option value="">Nature…</option>
            {liste.natures.map((n) => (
              <option key={n.cle} value={n.cle}>
                {n.libelle}
              </option>
            ))}
          </select>
          <input aria-label="Intitulé de la majoration" placeholder="Intitulé" value={f.libelle} onChange={(e) => setF({ ...f, libelle: e.target.value })} className={`${CHAMP_PAIE} w-[200px]`} />
          <input aria-label="Taux de majoration" inputMode="decimal" placeholder="Taux %" value={f.taux} onChange={(e) => setF({ ...f, taux: e.target.value })} className={`${CHAMP_PAIE} w-[90px] text-right`} />
          <input
            aria-label="Source du taux"
            placeholder="Convention collective, règlement d'entreprise, arrêté"
            value={f.source}
            onChange={(e) => setF({ ...f, source: e.target.value })}
            className={`${CHAMP_PAIE} w-[280px]`}
          />
          <input aria-label="Date d'effet de la majoration" type="date" value={f.dateEffet} onChange={(e) => setF({ ...f, dateEffet: e.target.value })} className={`${CHAMP_PAIE} w-auto`} />
          <button type="submit" disabled={envoi} className="bg-sel text-white font-semibold px-3 py-1 rounded-full disabled:opacity-50">
            Déclarer la majoration
          </button>
        </form>
      )}
    </section>
  );
}
