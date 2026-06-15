import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { plantsApi, facilitiesApi } from '../services/api';
import { StatusBadge } from '../components/ui/Badge';
import { LoadingPage } from '../components/ui/Spinner';
import { ArrowLeft, ChevronRight } from 'lucide-react';

export default function PlantsPage() {
  const { facilityId } = useParams();
  const navigate = useNavigate();
  const [facility, setFacility] = useState(null);
  const [plants, setPlants] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [facilityRes, plantsRes] = await Promise.all([
        facilitiesApi.get(facilityId),
        plantsApi.list(facilityId),
      ]);
      setFacility(facilityRes.data.facility);
      setPlants(plantsRes.data.plants);
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return <LoadingPage />;

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/facilities')} className="text-ink-muted hover:text-ink">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title">{facility?.name}</h1>
            <p className="text-xs text-ink-muted mt-0.5">{facility?.location} · {plants.length} plants</p>
          </div>
        </div>
      </div>

      <div className="page-body">
        <div className="card overflow-hidden">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plant</th>
                <th>Type</th>
                <th>Status</th>
                <th>Capacity</th>
                <th>TDS</th>
                <th>Flow</th>
                <th>Pressure</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {plants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center text-ink-muted py-8">No plants in this facility.</td>
                </tr>
              ) : (
                plants.map((plant) => (
                  <tr
                    key={plant._id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/plants/${plant._id}`)}
                  >
                    <td>
                      <div className="font-medium">{plant.name}</div>
                      <div className="text-xs text-ink-muted font-mono">{plant.plantId}</div>
                    </td>
                    <td><span className="badge badge-offline font-mono">{plant.type}</span></td>
                    <td><StatusBadge status={plant.status} /></td>
                    <td className="font-mono text-sm">{plant.capacity} m³/d</td>
                    <td className="font-mono text-sm">
                      {plant.type === 'UF' ? '—' : (plant.lastTelemetry?.tds != null ? `${plant.lastTelemetry.tds} ppm` : '—')}
                    </td>
                    <td className="font-mono text-sm">
                      {plant.lastTelemetry?.flow != null ? `${plant.lastTelemetry.flow} m³/h` : '—'}
                    </td>
                    <td className="font-mono text-sm">
                      {plant.lastTelemetry?.pressure != null ? `${plant.lastTelemetry.pressure} bar` : '—'}
                    </td>
                    <td><ChevronRight size={14} className="text-ink-placeholder" /></td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
