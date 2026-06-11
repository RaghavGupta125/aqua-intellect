import clsx from 'clsx';

const severityClass = {
  critical: 'badge-critical',
  warning: 'badge-warning',
  info: 'badge-info',
};

const statusClass = {
  online: 'badge-online',
  offline: 'badge-offline',
  maintenance: 'badge-maintenance',
  fault: 'badge-fault',
  active: 'badge-critical',
  resolved: 'badge-offline',
  acknowledged: 'badge-warning',
};

export function SeverityBadge({ severity }) {
  return (
    <span className={clsx('badge', severityClass[severity] || 'badge-offline')}>
      {severity}
    </span>
  );
}

export function StatusBadge({ status }) {
  return (
    <span className={clsx('badge', statusClass[status] || 'badge-offline')}>
      {status}
    </span>
  );
}

export function AlarmTypeBadge({ type }) {
  const labels = {
    TDS_HIGH: 'TDS High',
    PRESSURE_LOW: 'Pressure Low',
    PRESSURE_HIGH: 'Pressure High',
    TANK_LEVEL_LOW: 'Tank Low',
    PH_LOW: 'pH Low',
    PH_HIGH: 'pH High',
    FLOW_LOW: 'Flow Low',
  };
  return <span className="text-xs text-ink-secondary font-mono">{labels[type] || type}</span>;
}
