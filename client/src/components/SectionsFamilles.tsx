import { useEffect, useState } from 'react';
import { api, ApiError } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { FamilleImmobilisation } from '../lib/types';
import type { SectionsPourLesBiens } from './FicheImmobilisationGeneral';
import { Aide } from './chrome/Aide';

/**
 * LA SECTION ANALYTIQUE DES FAMILLES (ligne immos, fonction n° 70) · la
 * dotation d'un bien sans section propre se ventile sur celle de sa famille.
 * Seule la section se pose, la famille ne se saisissant plus (elle suit le
 * compte du bien). Réservée à l'administrateur, comme le serveur.
 */
export function SectionsFamilles() {
  const { estAdmin } = useAuth();
  const [familles, setFamilles] = useState<FamilleImmobilisation[] | null>(null);
  const [sections, setSections] = useState<SectionsPourLesBiens | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);

  const charger = () => {
    setErreur(null);
    Promise.all([
      api.get<FamilleImmobilisation[]>('/immobilisations/familles'),
      api.get<SectionsPourLesBiens>('/immobilisations/sections-analytiques'),
    ])
      .then(([f, s]) => {
        setFamilles(f);
        setSections(s);
      })
      .catch((e) => setErreur(e instanceof ApiError ? e.message : 'Familles ou sections illisibles'));
  };
  useEffect(() => {
    if (estAdmin) charger();
  }, [estAdmin]);
  if (!estAdmin) return null;

  const poser = async (famille: FamilleImmobilisation, sectionId: string) => {
    setEnvoi(famille.id);
    setErreur(null);
    setInfo(null);
    try {
      await api.patch(`/immobilisations/familles/${famille.id}/section`, { sectionAnalytiqueId: sectionId || null });
      setInfo(sectionId ? `Famille « ${famille.intitule} » · section posée.` : `Famille « ${famille.intitule} » · section retirée.`);
      charger();
    } catch (e) {
      setErreur(e instanceof ApiError ? e.message : 'Section refusée');
    } finally {
      setEnvoi(null);
    }
  };

  const actives = (familles ?? []).filter((f) => f.estActif);
  return (
    <div className="border border-border bg-surface shadow-posee max-w-[1180px] mt-3 text-[11.5px]" data-sections-familles>
      <div className="px-3.5 py-1.5 bg-chrome border-b border-border font-semibold text-text-dim flex items-center gap-1.5">
        Section analytique des familles
        <Aide
          titre="Section analytique des familles"
          texte="La dotation d'un bien se ventile sur la section de sa fiche, et à défaut sur celle de sa famille. La passation la pose sur la ligne de charge ; une section devenue impropre laisse la dotation partir non ventilée, et le compte rendu le dit."
          source="AUDCIF Titre VII, classe 9 · usage laissé à l’initiative des entités"
        />
      </div>
      <div className="px-3.5 py-1.5">
        {erreur && <div className="text-danger mb-1">{erreur}</div>}
        {info && <div className="text-positive mb-1">{info}</div>}
        {familles === null || sections === null ? (
          !erreur && <div className="text-text-dim">…</div>
        ) : actives.length === 0 ? (
          <div className="text-text-dim">Aucune famille · elles naissent avec le premier bien de chaque compte.</div>
        ) : (
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left">Famille</th>
                <th className="text-left">Compte</th>
                <th className="text-left">Section</th>
              </tr>
            </thead>
            <tbody>
              {actives.map((f) => (
                <tr key={f.id}>
                  <td>{f.intitule}</td>
                  <td className="tabular-nums">{f.compteImmobilisation?.numero ?? '·'}</td>
                  <td>
                    <select
                      value={f.sectionAnalytiqueId ?? ''}
                      disabled={envoi !== null}
                      onChange={(e) => void poser(f, e.target.value)}
                      className="border border-border-dark px-2 py-0.5 text-[11.5px]"
                    >
                      <option value="">Aucune</option>
                      {f.sectionAnalytiqueId && !sections.sections.some((s) => s.id === f.sectionAnalytiqueId) && (
                        <option value={f.sectionAnalytiqueId}>Section actuelle (impropre à la dotation)</option>
                      )}
                      {sections.sections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.plan.code} · {s.code} · {s.intitule}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {sections && sections.sections.length === 0 && (
          <div className="mt-1 text-text-dim">Aucune section Détail active d’un plan qui ventile la classe 6 · ouvrez-la dans Plans analytiques.</div>
        )}
      </div>
    </div>
  );
}
