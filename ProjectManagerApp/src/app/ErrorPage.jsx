import { Component } from 'react';
import { Download, Home, RotateCw, TriangleAlert } from 'lucide-react';
import { useRouteError } from 'react-router';
import { useI18n } from '../i18n/useI18n.js';
import { exportAppData } from '../utils/DataIO.js';
import { Button, Card, useToast } from '../ui/index.js';
import s from './ErrorPage.module.css';

const errorDetails = (error) => {
  if (!error) return '';
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  if (typeof error === 'object' && 'status' in error) return `${error.status} ${error.statusText || ''}`.trim();
  return String(error);
};

/**
 * Shown instead of a screen that crashed. Data is untouched; the user can
 * download a backup, reload, or go Home. `inline` keeps it inside the shell
 * (a screen failed); otherwise it fills the window (the shell failed).
 */
export function ErrorPage({ error, inline = false }) {
  const { t } = useI18n();
  const toast = useToast();

  const backup = async () => {
    try {
      await exportAppData();
      toast({ title: t('schedule.backupSaved') });
    } catch {
      toast({ title: t('app.backup.exportFail'), tone: 'danger' });
    }
  };
  const goHome = () => {
    window.location.hash = '#/';
    window.location.reload();
  };
  const details = errorDetails(error);

  return (
    <div className={inline ? s.inline : s.full} role="alert">
      <Card className={s.card} padding="lg">
        <div className={s.body}>
          <span className={s.icon} aria-hidden="true">
            <TriangleAlert size={26} />
          </span>
          <h1 className={s.title}>{t('app.error.title')}</h1>
          <p className={s.text}>{t('app.error.body')}</p>
          <div className={s.buttons}>
            <Button variant="primary" icon={Download} onClick={backup}>
              {t('schedule.backup')}
            </Button>
            <Button icon={RotateCw} onClick={() => window.location.reload()}>
              {t('app.error.reload')}
            </Button>
            <Button variant="ghost" icon={Home} onClick={goHome}>
              {t('app.error.home')}
            </Button>
          </div>
          {details && (
            <details className={s.details}>
              <summary>{t('app.error.details')}</summary>
              <pre className="ui-ltr">{details}</pre>
            </details>
          )}
        </div>
      </Card>
    </div>
  );
}

/** Router errorElement: a route's component (or its lazy code) failed. */
export function RouteErrorPage({ inline = false }) {
  return <ErrorPage error={useRouteError()} inline={inline} />;
}

/** Catches crashes above the router (the project store itself). */
export class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('App crashed:', error, info?.componentStack);
  }

  render() {
    return this.state.error ? <ErrorPage error={this.state.error} /> : this.props.children;
  }
}
