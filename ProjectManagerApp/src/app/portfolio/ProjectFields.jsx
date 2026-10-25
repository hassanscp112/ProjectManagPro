import { useI18n } from '../../i18n/useI18n.js';
import { Field, Input } from '../../ui/index.js';
import s from './Portfolio.module.css';

/**
 * A project's details: name, contract, location, start date. `value` is the
 * draft, `errors` from portfolioModel.validateProjectDraft.
 */
export function ProjectFields({ value, onChange, errors = {} }) {
  const { t } = useI18n();
  const set = (key) => (e) => onChange({ ...value, [key]: e.target.value });
  return (
    <div className={s.fields}>
      <Field label={t('projects.name')} error={errors.name ? t('record.required') : undefined} className={s.wideField}>
        <Input data-autofocus value={value.name} placeholder={t('projects.namePlaceholder')} onChange={set('name')} />
      </Field>
      <Field label={t('projects.contract')} optional>
        <Input value={value.contract} placeholder={t('projects.contractPlaceholder')} onChange={set('contract')} />
      </Field>
      <Field label={t('projects.location')} optional>
        <Input value={value.location} onChange={set('location')} />
      </Field>
      <Field label={t('projects.startDate')} error={errors.startDate ? t('projects.startDateInvalid') : undefined}>
        <Input type="date" value={value.startDate} onChange={set('startDate')} />
      </Field>
    </div>
  );
}
