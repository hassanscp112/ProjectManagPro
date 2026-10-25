import * as RadixTabs from '@radix-ui/react-tabs';
import { cx } from './cx.js';
import s from './Tabs.module.css';

/** Tabs (Radix): keyboard arrows follow the reading direction. */
export function Tabs({ className, ...rest }) {
  return <RadixTabs.Root {...rest} className={className} />;
}

export function TabList({ label, className, children }) {
  return (
    <RadixTabs.List aria-label={label} className={cx(s.list, className)}>
      {children}
    </RadixTabs.List>
  );
}

/** count: optional pending-items number shown as a small pill. */
export function Tab({ value, count, className, children }) {
  return (
    <RadixTabs.Trigger value={value} className={cx(s.tab, className)}>
      {children}
      {count ? <span className={s.count}>{count}</span> : null}
    </RadixTabs.Trigger>
  );
}

export function TabPanel({ value, className, children }) {
  return (
    <RadixTabs.Content value={value} className={cx(s.panel, className)}>
      {children}
    </RadixTabs.Content>
  );
}
