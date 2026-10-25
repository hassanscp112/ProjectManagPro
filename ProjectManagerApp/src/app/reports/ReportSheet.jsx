import { useI18n } from '../../i18n/useI18n.js';
import { useProject } from '../../state/projectContext.js';
import { cx } from '../../ui/index.js';
import s from './Reports.module.css';

/**
 * A printable report: project name and contract, the report title, the
 * period it covers and when it was issued, then the sections. On screen it
 * is a card; on paper it is the whole page (`.ui-print-sheet`).
 */
export function ReportSheet({ title, period, stamp, extra, children, className }) {
  const { t } = useI18n();
  const { project } = useProject();
  return (
    <article className={cx(s.sheet, 'ui-print-sheet', className)}>
      <header className={s.sheetHead}>
        <div className={s.project}>
          <strong>{project?.name}</strong>
          {project?.contract && <span>{project.contract}</span>}
        </div>
        <h2 className={s.sheetTitle}>{title}</h2>
        <div className={s.sheetMeta}>
          {period && <span>{period}</span>}
          {stamp && (
            <span>
              {t('reports.issuedAt')} <span className="ui-ltr">{stamp}</span>
            </span>
          )}
          {extra}
        </div>
      </header>
      {children}
    </article>
  );
}

/** One titled block inside a sheet (keeps together across page breaks). */
export function SheetSection({ title, aside, children, className }) {
  return (
    <section className={cx(s.section, className)}>
      {(title || aside) && (
        <div className={s.sectionHead}>
          {title && <h3 className={s.sectionTitle}>{title}</h3>}
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}
