import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plantsApi, telemetryApi, alarmsApi, reportsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { LoadingPage } from '../components/ui/Spinner';
import { StatusBadge, SeverityBadge, AlarmTypeBadge } from '../components/ui/Badge';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, formatDistanceToNow } from 'date-fns';
import { ArrowLeft, Download, RefreshCw, CheckCheck, Pencil, X, Check } from 'lucide-react';
import { useAuth } from '../features/auth/AuthContext';
import clsx from 'clsx';

// ── Metric row ────────────────────────────────────────────────
function MetricRow({ label, value, unit, good, bad }) {
  const textColor =
    bad ? 'text-alarm-critical' : good ? 'text-green-600' : 'text-ink';
  return (
    <div className="flex items-center justify-between py-3 border-b border-surface-border last:border-0">
      <span className="text-sm text-ink-secondary">{label}</span>
      <span className={clsx('font-mono text-sm font-medium', textColor)}>
        {value != null ? `${value}${unit ? ' ' + unit : ''}` : '—'}
      </span>
    </div>
  );
}

// ── Threshold field definition ───────────────────────────────
const THRESHOLD_FIELDS = [
  { key: 'tdsMax',       label: 'Max TDS',         unit: 'ppm',  min: 0,   max: 500,  step: 1   },
  { key: 'pressureMin',  label: 'Min Pressure',    unit: 'bar',  min: 0,   max: 20,   step: 0.1 },
  { key: 'pressureMax',  label: 'Max Pressure',    unit: 'bar',  min: 0,   max: 20,   step: 0.1 },
  { key: 'phMin',        label: 'Min pH',          unit: '',     min: 0,   max: 14,   step: 0.1 },
  { key: 'phMax',        label: 'Max pH',          unit: '',     min: 0,   max: 14,   step: 0.1 },
  { key: 'tankLevelMin', label: 'Min Tank Level',  unit: '%',    min: 0,   max: 100,  step: 1   },
  { key: 'flowMin',      label: 'Min Flow Rate',   unit: 'm³/h', min: 0,   max: 1000, step: 1   },
];

// ── Overview tab ─────────────────────────────────────────────
function OverviewTab({ plant, liveData, onPlantUpdate }) {
  const { user } = useAuth();
  const canEdit = ['admin', 'supervisor'].includes(user?.role);

  const d = liveData || plant.lastTelemetry;
  const t = plant.thresholds || {};

  // Threshold edit state
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...t });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const handleEdit = () => {
    setForm({ ...plant.thresholds });
    setSaveError('');
    setEditing(true);
  };

  const handleCancel = () => {
    setEditing(false);
    setSaveError('');
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError('');
    try {
      const { data } = await plantsApi.updateThresholds(plant._id, form);
      onPlantUpdate(data.plant);
      setEditing(false);
    } catch (err) {
      setSaveError(err.response?.data?.message || 'Failed to save thresholds');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-6">
      {/* Current readings */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-ink">Live Readings</h3>
        </div>
        <div className="px-4">
          <MetricRow
            label="TDS"
            value={d?.tds}
            unit="ppm"
            bad={d?.tds > t.tdsMax}
            good={d?.tds <= t.tdsMax}
          />
          <MetricRow
            label="pH"
            value={d?.ph}
            bad={d?.ph < t.phMin || d?.ph > t.phMax}
            good={d?.ph >= t.phMin && d?.ph <= t.phMax}
          />
          <MetricRow
            label="Flow Rate"
            value={d?.flow}
            unit="m³/h"
            bad={d?.flow < t.flowMin}
            good={d?.flow >= t.flowMin}
          />
          <MetricRow
            label="Pressure"
            value={d?.pressure}
            unit="bar"
            bad={d?.pressure < t.pressureMin || d?.pressure > t.pressureMax}
            good={d?.pressure >= t.pressureMin && d?.pressure <= t.pressureMax}
          />
          <MetricRow
            label="Tank Level"
            value={d?.tankLevel}
            unit="%"
            bad={d?.tankLevel < t.tankLevelMin}
            good={d?.tankLevel >= t.tankLevelMin}
          />
        </div>
      </div>

      {/* Plant info */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-ink">Plant Information</h3>
        </div>
        <div className="px-4">
          <MetricRow label="Plant ID" value={plant.plantId} />
          <MetricRow label="Type" value={plant.type} />
          <MetricRow label="Facility" value={plant.facilityName || plant.facility?.name} />
          <MetricRow label="Capacity" value={plant.capacity} unit="m³/day" />
          <MetricRow label="Status" value={null} />
        </div>
        <div className="px-4 pb-4 -mt-4">
          <StatusBadge status={plant.status} />
        </div>
      </div>

      {/* Thresholds */}
      <div className="card md:col-span-2">
        <div className="card-header flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Configured Thresholds</h3>
          {canEdit && !editing && (
            <button
              onClick={handleEdit}
              id="btn-edit-thresholds"
              className="btn-secondary text-xs"
            >
              <Pencil size={12} /> Edit
            </button>
          )}
          {editing && (
            <div className="flex items-center gap-2">
              {saveError && (
                <span className="text-xs text-alarm-critical">{saveError}</span>
              )}
              <button
                onClick={handleCancel}
                className="btn-secondary text-xs"
                disabled={saving}
              >
                <X size={12} /> Cancel
              </button>
              <button
                onClick={handleSave}
                className="btn-primary text-xs"
                disabled={saving}
                id="btn-save-thresholds"
              >
                <Check size={12} /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          )}
        </div>

        {/* Display mode */}
        {!editing && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 divide-x divide-surface-border">
            {[
              { label: 'Max TDS',        value: `${t.tdsMax} ppm`                         },
              { label: 'Pressure Range', value: `${t.pressureMin}–${t.pressureMax} bar`   },
              { label: 'pH Range',       value: `${t.phMin}–${t.phMax}`                   },
              { label: 'Min Tank Level', value: `${t.tankLevelMin}%`                       },
            ].map((item) => (
              <div key={item.label} className="px-4 py-3">
                <div className="text-xs text-ink-muted">{item.label}</div>
                <div className="font-mono text-sm font-medium text-ink mt-0.5">{item.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Edit mode */}
        {editing && (
          <div className="p-4">
            <p className="text-xs text-ink-muted mb-4">
              Changes take effect immediately on the next telemetry reading. Alarm engine will use the new values.
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {THRESHOLD_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="form-label">
                    {field.label}
                    {field.unit && (
                      <span className="text-ink-placeholder font-normal"> ({field.unit})</span>
                    )}
                  </label>
                  <input
                    type="number"
                    min={field.min}
                    max={field.max}
                    step={field.step}
                    className="form-input font-mono text-sm"
                    value={form[field.key] ?? ''}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        [field.key]: parseFloat(e.target.value),
                      }))
                    }
                    id={`threshold-${field.key}`}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Charts tab ────────────────────────────────────────────────
function ChartsTab({ plantId }) {
  const [telemetry, setTelemetry] = useState([]);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);

  const fetchTelemetry = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await telemetryApi.history(plantId, hours);
      const formatted = data.telemetry.map((t) => ({
        ...t,
        time: format(new Date(t.timestamp), 'HH:mm'),
      }));
      setTelemetry(formatted);
    } finally {
      setLoading(false);
    }
  }, [plantId, hours]);

  useEffect(() => {
    fetchTelemetry();
  }, [fetchTelemetry]);

  // Live append
  useEffect(() => {
    const socket = getSocket();
    socket.emit('subscribe:plant', plantId);

    const onTelemetry = (data) => {
      if (data.plantId !== plantId) return;
      const point = { ...data, time: format(new Date(data.timestamp), 'HH:mm') };
      setTelemetry((prev) => [...prev.slice(-499), point]);
    };

    socket.on('telemetry:plant', onTelemetry);
    return () => {
      socket.off('telemetry:plant', onTelemetry);
      socket.emit('unsubscribe:plant', plantId);
    };
  }, [plantId]);

  const chartProps = {
    margin: { top: 4, right: 16, left: 0, bottom: 0 },
  };

  const lineProps = (dataKey, color) => ({
    dataKey,
    stroke: color,
    strokeWidth: 1.5,
    dot: false,
    activeDot: { r: 3 },
  });

  if (loading) return <LoadingPage />;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {[6, 24, 48].map((h) => (
            <button
              key={h}
              onClick={() => setHours(h)}
              className={clsx(
                'btn text-xs',
                hours === h ? 'btn-primary' : 'btn-secondary'
              )}
            >
              {h}h
            </button>
          ))}
        </div>
        <span className="text-xs text-ink-muted">{telemetry.length} data points</span>
      </div>

      {telemetry.length === 0 ? (
        <div className="card p-8 text-center text-ink-muted text-sm">
          No telemetry data available for this period.
        </div>
      ) : (
        <>
          {/* TDS Chart */}
          <div className="card">
            <div className="card-header">
              <h3 className="text-sm font-semibold text-ink">TDS Trend (ppm)</h3>
            </div>
            <div className="p-4">
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={telemetry} {...chartProps}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0' }} />
                  <Line {...lineProps('tds', '#0ea5e9')} name="TDS (ppm)" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Pressure + Flow */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-ink">Pressure Trend (bar)</h3>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={telemetry} {...chartProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0' }} />
                    <Line {...lineProps('pressure', '#334155')} name="Pressure (bar)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-ink">Flow Trend (m³/h)</h3>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={telemetry} {...chartProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0' }} />
                    <Line {...lineProps('flow', '#16a34a')} name="Flow (m³/h)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* pH + Tank Level */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-ink">pH Trend</h3>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={telemetry} {...chartProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis domain={[6, 9]} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0' }} />
                    <Line {...lineProps('ph', '#d97706')} name="pH" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <div className="card-header">
                <h3 className="text-sm font-semibold text-ink">Tank Level (%)</h3>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={telemetry} {...chartProps}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748b' }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64748b' }} />
                    <Tooltip contentStyle={{ fontSize: 12, border: '1px solid #e2e8f0' }} />
                    <Line {...lineProps('tankLevel', '#7c3aed')} name="Tank Level (%)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Alarms tab ────────────────────────────────────────────────
function AlarmsTab({ plantId }) {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  const fetchAlarms = useCallback(async () => {
    setLoading(true);
    try {
      const params = { plantId };
      if (statusFilter) params.status = statusFilter;
      const { data } = await alarmsApi.list(params);
      setAlarms(data.alarms);
    } finally {
      setLoading(false);
    }
  }, [plantId, statusFilter]);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  const handleAcknowledge = async (id) => {
    try {
      await alarmsApi.acknowledge(id);
      fetchAlarms();
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="form-select w-36 text-xs"
        >
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="acknowledged">Acknowledged</option>
          <option value="resolved">Resolved</option>
        </select>
        <button onClick={fetchAlarms} className="btn-secondary text-xs">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="card overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Severity</th>
              <th>Message</th>
              <th>Started</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alarms.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center text-ink-muted py-8">No alarms found</td>
              </tr>
            ) : (
              alarms.map((alarm) => (
                <tr key={alarm._id}>
                  <td><AlarmTypeBadge type={alarm.type} /></td>
                  <td><SeverityBadge severity={alarm.severity} /></td>
                  <td className="max-w-xs">
                    <span className="text-xs text-ink-secondary">{alarm.message}</span>
                  </td>
                  <td className="text-xs text-ink-muted">
                    {formatDistanceToNow(new Date(alarm.startTime), { addSuffix: true })}
                  </td>
                  <td><StatusBadge status={alarm.status} /></td>
                  <td>
                    {alarm.status === 'active' && (
                      <button
                        onClick={() => handleAcknowledge(alarm._id)}
                        className="btn-secondary text-xs"
                      >
                        <CheckCheck size={12} />
                        Ack
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Reports tab ───────────────────────────────────────────────
function ReportsTab({ plant }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState('daily');

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await reportsApi.list(plant.plantId);
      setReports(data.reports);
    } finally {
      setLoading(false);
    }
  }, [plant.plantId]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await reportsApi.generate(plant.plantId, period);
      fetchReports();
    } catch (err) {
      alert(err.response?.data?.message || 'Error generating report');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportCsv = () => {
    const url = reportsApi.exportCsv(plant.plantId, 24);
    const token = localStorage.getItem('ai_token');
    // Open with token in header is tricky for direct download; use a link
    window.open(`/api/reports/${plant.plantId}/export/csv?hours=168`, '_blank');
  };

  if (loading) return <LoadingPage />;

  return (
    <div className="p-6 space-y-4">
      {/* Generate */}
      <div className="card p-4 flex items-center gap-3">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="form-select w-36 text-xs"
        >
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="btn-primary text-xs"
        >
          {generating ? 'Generating...' : 'Generate Report'}
        </button>
        <button onClick={handleExportCsv} className="btn-secondary text-xs">
          <Download size={13} /> Export CSV (7d)
        </button>
      </div>

      {/* Reports list */}
      {reports.length === 0 ? (
        <div className="card p-8 text-center text-ink-muted text-sm">
          No reports generated yet. Use the Generate button above.
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report._id} className="card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <span className="badge badge-offline capitalize mr-2">{report.period}</span>
                  <span className="text-xs text-ink-muted">
                    {format(new Date(report.startDate), 'dd MMM yyyy')} –{' '}
                    {format(new Date(report.endDate), 'dd MMM yyyy')}
                  </span>
                </div>
                <span className="text-xs text-ink-placeholder">
                  Generated {formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })}
                </span>
              </div>
              {report.stats && (
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
                  {[
                    { label: 'Avg TDS', value: `${report.stats.avgTDS ?? 0} ppm` },
                    { label: 'Avg Flow', value: `${report.stats.avgFlow ?? 0} m³/h` },
                    { label: 'Water Produced', value: `${report.stats.totalWaterProduced ?? 0} m³` },
                    { label: 'Uptime', value: `${report.stats.uptimePercent ?? 0}%` },
                    { label: 'Alarms', value: report.stats.alarmCount ?? 0 },
                  ].map((stat) => (
                    <div key={stat.label} className="bg-surface-tertiary rounded-sm p-2.5">
                      <div className="text-ink-muted">{stat.label}</div>
                      <div className="font-mono font-medium text-ink mt-0.5">{stat.value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Plant Detail Page ────────────────────────────────────
const TABS = ['Overview', 'Charts', 'Alarms', 'Reports'];

export default function PlantDetailPage() {
  const { plantId } = useParams();
  const navigate = useNavigate();
  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('Overview');
  const [liveData, setLiveData] = useState(null);

  useEffect(() => {
    async function fetchPlant() {
      try {
        const { data } = await plantsApi.get(plantId);
        setPlant(data.plant);
      } finally {
        setLoading(false);
      }
    }
    fetchPlant();
  }, [plantId]);

  // Live readings update for Overview tab
  useEffect(() => {
    if (!plant) return;
    const socket = getSocket();
    const onTelemetry = (data) => {
      if (data.plantId === plant.plantId) {
        setLiveData(data);
      }
    };
    socket.on('telemetry:update', onTelemetry);
    return () => socket.off('telemetry:update', onTelemetry);
  }, [plant]);

  if (loading) return <LoadingPage />;
  if (!plant) return <div className="p-6 text-ink-muted">Plant not found.</div>;

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="text-ink-muted hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="page-title">{plant.name}</h1>
              <StatusBadge status={plant.status} />
            </div>
            <p className="text-xs text-ink-muted mt-0.5">
              {plant.facilityName} · {plant.type} · <span className="font-mono">{plant.plantId}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-surface-border px-6">
        <div className="tab-bar">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={clsx('tab-btn', activeTab === tab && 'active')}
              id={`tab-${tab.toLowerCase()}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === 'Overview' && <OverviewTab plant={plant} liveData={liveData} onPlantUpdate={setPlant} />}
      {activeTab === 'Charts' && <ChartsTab plantId={plant.plantId} />}
      {activeTab === 'Alarms' && <AlarmsTab plantId={plant.plantId} />}
      {activeTab === 'Reports' && <ReportsTab plant={plant} />}
    </div>
  );
}
