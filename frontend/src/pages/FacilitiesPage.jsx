import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { facilitiesApi, plantsApi } from '../services/api';
import { StatusBadge } from '../components/ui/Badge';
import { LoadingPage } from '../components/ui/Spinner';
import Modal from '../components/ui/Modal';
import { useAuth } from '../features/auth/AuthContext';
import { Plus, ChevronRight, Factory } from 'lucide-react';

export default function FacilitiesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [facilities, setFacilities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddFacility, setShowAddFacility] = useState(false);
  const [showAddPlant, setShowAddPlant] = useState(false);
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [facilityForm, setFacilityForm] = useState({ name: '', location: '', state: '', contactPerson: '', contactPhone: '' });
  const [plantForm, setPlantForm] = useState({ plantId: '', name: '', type: 'RO', capacity: '' });
  const [saving, setSaving] = useState(false);

  const canManage = ['admin', 'supervisor'].includes(user?.role);

  const fetchFacilities = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await facilitiesApi.list();
      setFacilities(data.facilities);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFacilities();
  }, [fetchFacilities]);

  const handleAddFacility = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await facilitiesApi.create(facilityForm);
      setShowAddFacility(false);
      setFacilityForm({ name: '', location: '', state: '', contactPerson: '', contactPhone: '' });
      fetchFacilities();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating facility');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPlant = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await plantsApi.create({
        ...plantForm,
        facility: selectedFacility._id,
        facilityName: selectedFacility.name,
        capacity: Number(plantForm.capacity),
      });
      setShowAddPlant(false);
      setPlantForm({ plantId: '', name: '', type: 'RO', capacity: '' });
      fetchFacilities();
    } catch (err) {
      alert(err.response?.data?.message || 'Error creating plant');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingPage />;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <h1 className="page-title">Facilities</h1>
        {canManage && (
          <button
            onClick={() => setShowAddFacility(true)}
            className="btn-primary text-xs"
            id="btn-add-facility"
          >
            <Plus size={13} /> Add Facility
          </button>
        )}
      </div>

      <div className="page-body space-y-4">
        {facilities.length === 0 ? (
          <div className="card p-12 text-center">
            <Factory size={32} className="text-ink-placeholder mx-auto mb-3" />
            <p className="text-sm text-ink-secondary">No facilities yet.</p>
            {canManage && (
              <button
                onClick={() => setShowAddFacility(true)}
                className="btn-primary text-xs mt-4 mx-auto"
              >
                <Plus size={13} /> Add First Facility
              </button>
            )}
          </div>
        ) : (
          facilities.map((facility) => (
            <div key={facility._id} className="card">
              <div className="card-header flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-ink">{facility.name}</h2>
                  <p className="text-xs text-ink-muted mt-0.5">
                    {facility.location}
                    {facility.state ? ` · ${facility.state}` : ''}
                    {facility.contactPerson ? ` · ${facility.contactPerson}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-ink-muted">
                    {facility.plantCount} plant{facility.plantCount !== 1 ? 's' : ''}
                  </span>
                  <StatusBadge status={facility.status} />
                  {canManage && (
                    <button
                      onClick={() => {
                        setSelectedFacility(facility);
                        setShowAddPlant(true);
                      }}
                      className="btn-secondary text-xs"
                    >
                      <Plus size={12} /> Add Plant
                    </button>
                  )}
                  <button
                    onClick={() => navigate(`/facilities/${facility._id}/plants`)}
                    className="btn-secondary text-xs"
                  >
                    View Plants <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Add Facility Modal */}
      <Modal
        isOpen={showAddFacility}
        onClose={() => setShowAddFacility(false)}
        title="Add Facility"
      >
        <form onSubmit={handleAddFacility} className="space-y-4">
          <div>
            <label className="form-label">Facility Name *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. Pantnagar Plant"
              value={facilityForm.name}
              onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
            />
          </div>
          <div>
            <label className="form-label">Location *</label>
            <input
              required
              className="form-input"
              placeholder="City, State"
              value={facilityForm.location}
              onChange={(e) => setFacilityForm({ ...facilityForm, location: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">State</label>
              <input
                className="form-input"
                placeholder="Uttarakhand"
                value={facilityForm.state}
                onChange={(e) => setFacilityForm({ ...facilityForm, state: e.target.value })}
              />
            </div>
            <div>
              <label className="form-label">Contact Person</label>
              <input
                className="form-input"
                placeholder="Name"
                value={facilityForm.contactPerson}
                onChange={(e) => setFacilityForm({ ...facilityForm, contactPerson: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAddFacility(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Creating...' : 'Create Facility'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Add Plant Modal */}
      <Modal
        isOpen={showAddPlant}
        onClose={() => setShowAddPlant(false)}
        title={`Add Plant — ${selectedFacility?.name}`}
      >
        <form onSubmit={handleAddPlant} className="space-y-4">
          <div>
            <label className="form-label">Plant ID *</label>
            <input
              required
              className="form-input font-mono"
              placeholder="e.g. PNT-RO-03"
              value={plantForm.plantId}
              onChange={(e) => setPlantForm({ ...plantForm, plantId: e.target.value.toUpperCase() })}
            />
          </div>
          <div>
            <label className="form-label">Plant Name *</label>
            <input
              required
              className="form-input"
              placeholder="e.g. RO Plant 3"
              value={plantForm.name}
              onChange={(e) => setPlantForm({ ...plantForm, name: e.target.value })}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Type *</label>
              <select
                className="form-select"
                value={plantForm.type}
                onChange={(e) => setPlantForm({ ...plantForm, type: e.target.value })}
              >
                <option value="RO">RO</option>
                <option value="UF">UF</option>
                <option value="NF">NF</option>
                <option value="MBR">MBR</option>
              </select>
            </div>
            <div>
              <label className="form-label">Capacity (m³/day)</label>
              <input
                type="number"
                className="form-input"
                placeholder="200"
                value={plantForm.capacity}
                onChange={(e) => setPlantForm({ ...plantForm, capacity: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowAddPlant(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Creating...' : 'Create Plant'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
