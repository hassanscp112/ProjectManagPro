import { Check } from 'lucide-react';
import { useI18n } from '../../../i18n/useI18n.js';
import { cx } from '../../../ui/index.js';
import s from './Wizard.module.css';

/**
 * The step list: done steps show a check, the current one is marked; a
 * step can be opened once every step before it is complete.
 */
export function WizardSteps({ steps, current, reachable, onGo }) {
  const { t } = useI18n();
  const at = steps.indexOf(current);
  return (
    <nav aria-label={t('planning.wiz.stepsLabel')}>
      <ol className={s.steps}>
        {steps.map((step, i) => (
          <li key={step} className={cx(i < at && s.stepDone)}>
            <button
              type="button"
              className={s.stepButton}
              aria-current={step === current ? 'step' : undefined}
              disabled={i > reachable}
              onClick={() => onGo(step)}
            >
              <span className={s.stepNum}>{i < at ? <Check size={12} aria-hidden="true" /> : i + 1}</span>
              {t(`planning.wiz.step.${step}`)}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
