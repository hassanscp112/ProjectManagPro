import { useI18n } from '../i18n/useI18n.js';
import { switchWhoKind, toggleWhoWorker } from '../utils/WhoSelection.js';
import { ChipGroup, Segmented } from './Choice.jsx';
import { NumberInput, Select } from './Field.jsx';
import s from './Picker.module.css';

const KIND_LABEL_KEYS = {
  contractor: 'ui.whoContractor',
  team: 'ui.whoTeam',
  workers: 'ui.whoWorkers',
  count: 'ui.whoCount',
  none: 'ui.whoNone',
};

// Up to this many entries show as one-tap chips; more fall back to a select.
const CHIP_LIMIT = 6;

const asArray = (v) => (Array.isArray(v) ? v : []);

/**
 * Who did the work / received the money. `kinds` picks the modes:
 * orders use ['contractor','team','workers','none'], planning uses
 * ['count','team','workers']. Value shapes: see utils/WhoSelection.js.
 */
export function WhoPicker({ value, onChange, registries, kinds = ['contractor', 'team', 'workers', 'none'], label }) {
  const { t } = useI18n();
  const contractors = asArray(registries?.contractors);
  const teams = asArray(registries?.teams);
  const workers = asArray(registries?.workers);
  const who = value && kinds.includes(value.kind) ? value : { kind: kinds[0] };

  const pickOne = (list, key, emptyKey, chooseKey) => {
    if (list.length === 0) return <span className={s.whoNone}>{t(emptyKey)}</span>;
    if (list.length <= CHIP_LIMIT) {
      return (
        <ChipGroup
          label={t(KIND_LABEL_KEYS[who.kind])}
          value={who[key]}
          onChange={(id) => onChange({ kind: who.kind, [key]: id })}
          options={list.map((x) => ({ value: x.id, label: x.name }))}
        />
      );
    }
    return (
      <Select
        aria-label={t(KIND_LABEL_KEYS[who.kind])}
        value={who[key] || ''}
        onChange={(e) => onChange({ kind: who.kind, [key]: e.target.value })}
      >
        <option value="">{t(chooseKey)}</option>
        {list.map((x) => (
          <option key={x.id} value={x.id}>
            {x.name}
          </option>
        ))}
      </Select>
    );
  };

  return (
    <div className={s.who}>
      {kinds.length > 1 && (
        <Segmented
          label={label || t('ui.whoKind')}
          value={who.kind}
          onChange={(k) => onChange(switchWhoKind(who, k, teams))}
          options={kinds.map((k) => ({ value: k, label: t(KIND_LABEL_KEYS[k]) }))}
        />
      )}

      {who.kind === 'contractor' && pickOne(contractors, 'contractorId', 'ui.noContractors', 'ui.chooseContractor')}
      {who.kind === 'team' && pickOne(teams, 'teamId', 'ui.noTeams', 'ui.chooseTeam')}

      {who.kind === 'workers' &&
        (workers.length === 0 ? (
          <span className={s.whoNone}>{t('ui.noWorkers')}</span>
        ) : (
          <div className={s.workers} role="group" aria-label={t('ui.whoWorkers')}>
            {workers.map((w) => (
              <label key={w.id} className={s.worker}>
                <input
                  type="checkbox"
                  checked={asArray(who.workerIds).includes(w.id)}
                  onChange={() => onChange(toggleWhoWorker(who, w.id))}
                />
                {w.name}
                {w.trade && <span className={s.trade}>{w.trade}</span>}
              </label>
            ))}
          </div>
        ))}

      {who.kind === 'count' && (
        <NumberInput
          aria-label={t('ui.headCount')}
          min="0"
          step="1"
          inputMode="numeric"
          value={who.count ?? 0}
          onChange={(e) => onChange({ kind: 'count', count: Math.max(0, Number(e.target.value) || 0) })}
        />
      )}

      {who.kind === 'none' && <span className={s.whoNone}>{t('ui.noRecipient')}</span>}
    </div>
  );
}
