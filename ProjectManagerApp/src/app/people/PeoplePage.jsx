import { Plus, RotateCcw, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { useI18n } from '../../i18n/useI18n.js';
import { isAutoSized, sizePatch, syncAutoTeams, teamsUsingWorker, toggleMemberPatch } from '../../state/peopleModel.js';
import { useProject } from '../../state/projectContext.js';
import {
  addContractor,
  addTeam,
  addWorker,
  deleteContractor,
  deleteTeam,
  deleteWorker,
  saveRegistries,
  updateContractor,
  updateTeam,
  updateWorker,
} from '../../utils/Registries.js';
import { Button, Card, ConfirmDialog, EmptyState, Field, IconButton, Input, NumberInput, Select, StatusBadge, Table, cx } from '../../ui/index.js';
import { Page } from '../Page.jsx';
import s from './People.module.css';

const KINDS = ['contractors', 'teams', 'workers'];
const TRADE_KEYS = [
  'registries.tradeGeneral',
  'registries.tradeHelper',
  'registries.tradeSteelFixer',
  'registries.tradeFormworkFixer',
  'registries.tradeCarpenter',
  'registries.tradeElectrician',
  'registries.tradeWelder',
  'registries.tradeMechanic',
  'registries.tradeDriver',
  'registries.tradeSurveyor',
  'registries.tradeLabTechnician',
  'registries.tradeInspector',
];

/**
 * /people/:kind — contractors, teams and workers (the "who" of every order
 * and plan). Edits save as you type. Storage: utils/Registries.js (notifies
 * the store, so pickers everywhere update at once).
 */
export default function PeoplePage() {
  const { kind } = useParams();
  const { t } = useI18n();
  const { registries, setRegistries } = useProject();
  const [toDelete, setToDelete] = useState(null); // { kind, item }

  if (!KINDS.includes(kind)) return <Navigate to="/people/contractors" replace />;
  const commit = (next) => setRegistries(saveRegistries(next));
  const unnamed = (x) => x.name || t('registries.unnamed');

  const addButton = {
    contractors: ['registries.addContractor', () => commit(addContractor(registries))],
    teams: ['registries.addTeam', () => commit(addTeam(registries, { name: t('registries.newTeam') }))],
    workers: ['registries.addWorker', () => commit(addWorker(registries))],
  }[kind];

  const confirmDelete = () => {
    const { kind: k, item } = toDelete;
    if (k === 'contractors') commit(deleteContractor(registries, item.id));
    else if (k === 'teams') commit(deleteTeam(registries, item.id));
    else {
      const next = deleteWorker(registries, item.id);
      commit({ ...next, teams: syncAutoTeams(registries.teams, next.teams) });
    }
  };
  const deleteMessage = () => {
    if (!toDelete) return '';
    const { kind: k, item } = toDelete;
    const name = unnamed(item);
    if (k === 'contractors') return t('registries.confirmDeleteContractor', { name });
    if (k === 'teams') return t('registries.confirmDeleteTeam', { name });
    const used = teamsUsingWorker(registries.teams, item.id);
    return t('registries.confirmDeleteWorker', { name }) + (used ? t('registries.confirmDeleteWorkerTeams', { count: used }) : '');
  };

  return (
    <Page area="people">
      <div className={s.toolbar}>
        <p className={s.hint}>{t(`people.hint_${kind}`)}</p>
        <Button variant="primary" icon={Plus} onClick={addButton[1]}>
          {t(addButton[0]).replace(/^\+\s*/, '')}
        </Button>
      </div>

      {kind === 'contractors' &&
        (registries.contractors.length === 0 ? (
          <EmptyState title={t('registries.contractorsEmpty')} />
        ) : (
          <Table minWidth={620} label={t('registries.tabContractors')}>
            <thead>
              <tr>
                <th>{t('registries.colContractorName')}</th>
                <th>{t('registries.colPhone')}</th>
                <th>{t('common.notes')}</th>
                <th aria-label={t('common.actions')} />
              </tr>
            </thead>
            <tbody>
              {registries.contractors.map((c) => {
                const set = (patch) => commit(updateContractor(registries, c.id, patch));
                return (
                  <tr key={c.id}>
                    <td>
                      <Input aria-label={t('registries.colContractorName')} value={c.name || ''} placeholder={t('registries.contractorNamePh')} onChange={(e) => set({ name: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label={t('registries.colPhone')} type="tel" className="ui-ltr" value={c.phone || ''} placeholder="07XX XXX XXXX" onChange={(e) => set({ phone: e.target.value })} />
                    </td>
                    <td>
                      <Input aria-label={t('common.notes')} value={c.notes || ''} placeholder={t('registries.contractorNotesPh')} onChange={(e) => set({ notes: e.target.value })} />
                    </td>
                    <td>
                      <IconButton icon={Trash2} label={t('registries.deleteContractorTitle')} variant="ghost" onClick={() => setToDelete({ kind, item: c })} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        ))}

      {kind === 'workers' &&
        (registries.workers.length === 0 ? (
          <EmptyState title={t('registries.workersEmpty')} />
        ) : (
          <>
            <Table minWidth={820} label={t('registries.tabWorkers')}>
              <thead>
                <tr>
                  <th>{t('common.name')}</th>
                  <th>{t('registries.colTrade')}</th>
                  <th>{t('registries.colDailyRate', { unit: t('registries.currencyUnit') })}</th>
                  <th>{t('registries.colPhone')}</th>
                  <th>{t('common.notes')}</th>
                  <th aria-label={t('common.actions')} />
                </tr>
              </thead>
              <tbody>
                {registries.workers.map((w) => {
                  const set = (patch) => commit(updateWorker(registries, w.id, patch));
                  return (
                    <tr key={w.id}>
                      <td>
                        <Input aria-label={t('common.name')} value={w.name || ''} placeholder={t('registries.workerNamePh')} onChange={(e) => set({ name: e.target.value })} />
                      </td>
                      <td>
                        <Input aria-label={t('registries.colTrade')} list="people-trades" value={w.trade || ''} placeholder={t('registries.tradePh')} onChange={(e) => set({ trade: e.target.value })} />
                      </td>
                      <td>
                        <NumberInput
                          aria-label={t('registries.dailyRateTitle')}
                          min="0"
                          value={w.dailyRate ?? ''}
                          onChange={(e) => set({ dailyRate: e.target.value === '' ? '' : Number(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <Input aria-label={t('registries.colPhone')} type="tel" className="ui-ltr" value={w.phone || ''} placeholder="07XX XXX XXXX" onChange={(e) => set({ phone: e.target.value })} />
                      </td>
                      <td>
                        <Input aria-label={t('common.notes')} value={w.notes || ''} onChange={(e) => set({ notes: e.target.value })} />
                      </td>
                      <td>
                        <IconButton icon={Trash2} label={t('registries.deleteWorkerTitle')} variant="ghost" onClick={() => setToDelete({ kind, item: w })} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
            <datalist id="people-trades">
              {TRADE_KEYS.map((k) => (
                <option key={k} value={t(k)} />
              ))}
            </datalist>
          </>
        ))}

      {kind === 'teams' &&
        (registries.teams.length === 0 ? (
          <EmptyState title={t('registries.teamsEmpty')} />
        ) : (
          <div className={s.teams}>
            {registries.teams.map((team) => {
              const set = (patch) => commit(updateTeam(registries, team.id, patch));
              const auto = isAutoSized(team);
              return (
                <Card key={team.id} padding="md" className={s.team}>
                  <div className={s.teamHead}>
                    <Input aria-label={t('registries.teamNamePh')} className={s.teamName} value={team.name || ''} placeholder={t('registries.teamNamePh')} onChange={(e) => set({ name: e.target.value })} />
                    <IconButton icon={Trash2} label={t('registries.deleteTeamTitle')} variant="ghost" onClick={() => setToDelete({ kind, item: team })} />
                  </div>
                  <Field label={t('registries.colForeman')}>
                    <Select value={team.foremanWorkerId || ''} onChange={(e) => set({ foremanWorkerId: e.target.value || null })}>
                      <option value="">{t('registries.noForeman')}</option>
                      {registries.workers.map((w) => (
                        <option key={w.id} value={w.id}>
                          {unnamed(w)}
                          {w.trade ? ` — ${w.trade}` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className={s.members}>
                    <span className={s.label}>
                      {t('registries.colMembers')} ({team.memberWorkerIds.length})
                    </span>
                    {registries.workers.length === 0 ? (
                      <p className={s.hint}>{t('registries.noWorkersHint')}</p>
                    ) : (
                      <div className={s.chips} role="group" aria-label={t('registries.colMembers')}>
                        {registries.workers.map((w) => {
                          const on = team.memberWorkerIds.includes(w.id);
                          const foreman = team.foremanWorkerId === w.id;
                          return (
                            <button key={w.id} type="button" aria-pressed={on} className={cx(s.chip, on && s.chipOn)} onClick={() => set(toggleMemberPatch(team, w.id))}>
                              {foreman && <Star size={14} aria-label={t('registries.foremanChipTitle')} />}
                              {unnamed(w)}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <div className={s.sizeRow}>
                    <Field label={t('registries.colDefaultSize')}>
                      <NumberInput min="0" value={team.defaultSize ?? 0} onChange={(e) => set(sizePatch(team, e.target.value))} />
                    </Field>
                    {auto ? (
                      <StatusBadge tone="accent" icon={false}>
                        {t('registries.sizeAuto')}
                      </StatusBadge>
                    ) : (
                      <Button size="sm" icon={RotateCcw} title={t('registries.sizeResetTitle')} onClick={() => set({ defaultSize: team.memberWorkerIds.length })}>
                        {t('registries.sizeAuto')}
                      </Button>
                    )}
                  </div>
                  <p className={s.hint}>{t('registries.sizeTitle')}</p>
                  <Field label={t('common.notes')}>
                    <Input value={team.notes || ''} placeholder={t('registries.teamNotesPh')} onChange={(e) => set({ notes: e.target.value })} />
                  </Field>
                </Card>
              );
            })}
          </div>
        ))}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(o) => !o && setToDelete(null)}
        title={t('people.deleteTitle')}
        message={deleteMessage()}
        confirmLabel={t('common.delete')}
        tone="danger"
        onConfirm={confirmDelete}
      />
    </Page>
  );
}
