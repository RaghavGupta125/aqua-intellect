import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { dashboardApi } from '../services/api';
import { getSocket } from '../services/socket';
import { LoadingPage, EmptyState } from '../components/ui/Spinner';
import { StatusBadge, SeverityBadge } from '../components/ui/Badge';
import {
  Building2,
  Factory,
  BellRing,
  Droplets,
  BarChart3,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function KPICard({ label, value, unit, icon: Icon, highlight }) {
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div>
          <div className={`kpi-value ${highlight ? 'text-alarm-critical' : ''}`}>
            {value ?? '—'}
            {unit && <span className="text-base font-normal text-ink-muted ml-1">{unit}</span>}
          </div>
          <div className="kpi-label">{label}</div>
        </div>
        <div className="w-9 h-9 bg-surface-tertiary rounded-sm flex items-center justify-center flex-shrink-0">
          <Icon size={16} className="text-ink-muted" />
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [plantHealth, setPlantHealth] = useState([]);
  const [recentAlarms, setRecentAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [sumRes, healthRes, alarmsRes] = await Promise.all([
        dashboardApi.summary(),
        dashboardApi.plantHealth(),
        dashboardApi.recentAlarms(),
      ]);
      setSummary(sumRes.data);
      setPlantHealth(healthRes.data.plants);
      setRecentAlarms(alarmsRes.data.alarms);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Live socket updates
  useEffect(() => {
    const socket = getSocket();

    const onTelemetry = (data) => {
      setPlantHealth((prev) =>
        prev.map((p) =>
          p.plantId === data.plantId
            ? {
                ...p,
                status: 'online',
                lastTelemetry: {
                  ...p.lastTelemetry,
                  tds: data.tds,
                  flow: data.flow,
                  pressure: data.pressure,
                  ph: data.ph,
                  tankLevel: data.tankLevel,
                  timestamp: data.timestamp,
                },
              }
            : p
        )
      );
    };

    const onAlarmNew = (alarm) => {
      setRecentAlarms((prev) => [alarm, ...prev.slice(0, 9)]);
      setSummary((prev) =>
        prev ? { ...prev, activeAlarmCount: prev.activeAlarmCount + 1 } : prev
      );
    };

    const onAlarmResolved = (alarm) => {
      setSummary((prev) =>
        prev
          ? { ...prev, activeAlarmCount: Math.max(0, prev.activeAlarmCount - 1) }
          : prev
      );
    };

    socket.on('telemetry:update', onTelemetry);
    socket.on('alarm:new', onAlarmNew);
    socket.on('alarm:resolved', onAlarmResolved);

    return () => {
      socket.off('telemetry:update', onTelemetry);
      socket.off('alarm:new', onAlarmNew);
      socket.off('alarm:resolved', onAlarmResolved);
    };
  }, []);

  if (loading) return <LoadingPage />;

  return (
    <div>
      {/* Page header */}
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Operations Dashboard</h1>
          {lastRefresh && (
            <p className="text-xs text-ink-muted mt-0.5">
              Last updated {formatDistanceToNow(lastRefresh, { addSuffix: true })}
            </p>
          )}
        </div>
        <button
          onClick={fetchData}
          id="btn-refresh-dashboard"
          className="btn-secondary text-xs"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      <div className="page-body space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            label="Total Facilities"
            value={summary?.facilityCount}
            icon={Building2}
          />
          <KPICard
            label="Total Plants"
            value={summary?.plantCount}
            icon={Factory}
          />
          <KPICard
            label="Active Alarms"
            value={summary?.activeAlarmCount}
            icon={BellRing}
            highlight={summary?.activeAlarmCount > 0}
          />
          <KPICard
            label="Average TDS"
            value={summary?.avgTDS}
            unit="ppm"
            icon={Droplets}
          />
          <KPICard
            label="Water Produced Today"
            value={summary?.waterProducedToday}
            unit="m³"
            icon={BarChart3}
          />
        </div>

        {/* Plant health + alarms grid */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Plant Health Table */}
          <div className="xl:col-span-2 card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Plant Health</h2>
              <span className="text-xs text-ink-muted">{plantHealth.length} plants</span>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Plant</th>
                    <th>Facility</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>TDS</th>
                    <th>Flow</th>
                    <th>Alarms</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {plantHealth.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center text-ink-muted py-8">No plants found</td>
                    </tr>
                  ) : (
                    plantHealth.map((plant) => (
                      <tr
                        key={plant._id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/plants/${plant._id}`)}
                      >
                        <td>
                          <div className="font-medium text-ink">{plant.name}</div>
                          <div className="text-xs text-ink-muted font-mono">{plant.plantId}</div>
                        </td>
                        <td className="text-ink-secondary">{plant.facility}</td>
                        <td>
                          <span className="badge badge-offline font-mono">{plant.type}</span>
                        </td>
                        <td><StatusBadge status={plant.status} /></td>
                        <td className="font-mono text-sm">
                          {plant.lastTelemetry?.tds != null ? `${plant.lastTelemetry.tds} ppm` : '—'}
                        </td>
                        <td className="font-mono text-sm">
                          {plant.lastTelemetry?.flow != null ? `${plant.lastTelemetry.flow} m³/h` : '—'}
                        </td>
                        <td>
                          {plant.activeAlarms > 0 ? (
                            <span className="badge badge-critical">{plant.activeAlarms}</span>
                          ) : (
                            <span className="text-green-600 text-xs">—</span>
                          )}
                        </td>
                        <td>
                          <ChevronRight size={14} className="text-ink-placeholder" />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Alarms */}
          <div className="card">
            <div className="card-header flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Recent Alarms</h2>
              <button
                onClick={() => navigate('/alarms')}
                className="text-xs text-accent hover:underline"
              >
                View all
              </button>
            </div>
            <div className="divide-y divide-surface-border">
              {recentAlarms.length === 0 ? (
                <div className="p-6 text-center text-ink-muted text-xs">No recent alarms</div>
              ) : (
                recentAlarms.slice(0, 8).map((alarm) => (
                  <div key={alarm._id} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-ink truncate">
                          {alarm.plantName}
                        </div>
                        <div className="text-xs text-ink-muted mt-0.5 leading-relaxed">
                          {alarm.message}
                        </div>
                      </div>
                      <SeverityBadge severity={alarm.severity} />
                    </div>
                    <div className="text-xs text-ink-placeholder mt-1">
                      {formatDistanceToNow(new Date(alarm.startTime), { addSuffix: true })}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
