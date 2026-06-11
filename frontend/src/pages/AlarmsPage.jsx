import { useEffect, useState, useCallback } from 'react';
import { alarmsApi } from '../services/api';
import { getSocket } from '../services/socket';
import { SeverityBadge, AlarmTypeBadge, StatusBadge } from '../components/ui/Badge';
import { LoadingPage } from '../components/ui/Spinner';
import { formatDistanceToNow, format } from 'date-fns';
import { CheckCheck, RefreshCw, Filter } from 'lucide-react';

export default function AlarmsPage() {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: 'active', severity: '' });
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  const fetchAlarms = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 50 };
      if (filters.status) params.status = filters.status;
      if (filters.severity) params.severity = filters.severity;
      const { data } = await alarmsApi.list(params);
      setAlarms(data.alarms);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  useEffect(() => {
    fetchAlarms();
  }, [fetchAlarms]);

  // Live alarm updates
  useEffect(() => {
    const socket = getSocket();
    const onAlarmNew = (alarm) => {
      if (!filters.status || filters.status === 'active') {
        setAlarms((prev) => [alarm, ...prev]);
        setTotal((t) => t + 1);
      }
    };
    socket.on('alarm:new', onAlarmNew);
    return () => socket.off('alarm:new', onAlarmNew);
  }, [filters]);

  const handleAcknowledge = async (id) => {
    try {
      await alarmsApi.acknowledge(id);
      fetchAlarms();
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  const handleResolve = async (id) => {
    try {
      await alarmsApi.resolve(id);
      fetchAlarms();
    } catch (err) {
      alert(err.response?.data?.message || 'Error');
    }
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="page-title">Alarm Management</h1>
          <p className="text-xs text-ink-muted mt-0.5">{total} alarms</p>
        </div>
        <button onClick={fetchAlarms} className="btn-secondary text-xs">
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-4">
          <Filter size={13} className="text-ink-muted" />
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="form-select w-36 text-xs"
            id="filter-status"
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={filters.severity}
            onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
            className="form-select w-36 text-xs"
            id="filter-severity"
          >
            <option value="">All Severity</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
          </select>
        </div>

        {loading ? (
          <LoadingPage />
        ) : (
          <div className="card overflow-hidden">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Severity</th>
                  <th>Plant</th>
                  <th>Facility</th>
                  <th>Message</th>
                  <th>Value</th>
                  <th>Started</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {alarms.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center text-ink-muted py-10">
                      No alarms match the current filters.
                    </td>
                  </tr>
                ) : (
                  alarms.map((alarm) => (
                    <tr
                      key={alarm._id}
                      className={alarm.severity === 'critical' && alarm.status === 'active' ? 'bg-alarm-critical-bg' : ''}
                    >
                      <td><AlarmTypeBadge type={alarm.type} /></td>
                      <td><SeverityBadge severity={alarm.severity} /></td>
                      <td>
                        <div className="font-medium text-xs">{alarm.plantName}</div>
                        <div className="text-xs text-ink-muted font-mono">{alarm.plantId}</div>
                      </td>
                      <td className="text-xs text-ink-secondary">{alarm.facilityName}</td>
                      <td className="max-w-xs">
                        <span className="text-xs text-ink-secondary">{alarm.message}</span>
                      </td>
                      <td className="font-mono text-xs">
                        {alarm.value != null ? alarm.value.toFixed(2) : '—'}
                      </td>
                      <td className="text-xs text-ink-muted whitespace-nowrap">
                        {formatDistanceToNow(new Date(alarm.startTime), { addSuffix: true })}
                      </td>
                      <td><StatusBadge status={alarm.status} /></td>
                      <td>
                        <div className="flex items-center gap-1.5">
                          {alarm.status === 'active' && (
                            <button
                              onClick={() => handleAcknowledge(alarm._id)}
                              className="btn-secondary text-xs px-2 py-1"
                              title="Acknowledge"
                            >
                              <CheckCheck size={11} /> Ack
                            </button>
                          )}
                          {alarm.status !== 'resolved' && (
                            <button
                              onClick={() => handleResolve(alarm._id)}
                              className="btn-secondary text-xs px-2 py-1 text-ink-muted"
                              title="Resolve"
                            >
                              Resolve
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
