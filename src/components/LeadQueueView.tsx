import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { User as UserType } from '../types';
import {
  Users,
  Eye,
  EyeOff,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Building,
  Phone,
  Layers,
  Check,
  X,
  Lock,
} from 'lucide-react';

interface ManagedLead {
  id: string;
  status: string;
  allowed_caller_ids: string[] | null;
  current_cycle: number;
  created_at: string;
  business_id: string;
  business_name: string;
  phone: string;
  industry: string;
  city?: string;
  state?: string;
  zip?: string;
  address?: string;
  batch_id?: string;
  batch_name?: string;
}

export const LeadQueueView: React.FC = () => {
  const [leads, setLeads] = useState<ManagedLead[]>([]);
  const [callers, setCallers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('ALL');
  const [industryFilter, setIndustryFilter] = useState<string>('ALL');
  const [batchFilter, setBatchFilter] = useState<string>('ALL');

  // Checkbox selection state
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);

  // Bulk Edit Modal State
  const [showVisibilityModal, setShowVisibilityModal] = useState(false);
  const [targetScope, setTargetScope] = useState<'selected' | 'filtered' | 'all'>('selected');
  const [modalVisibilityType, setModalVisibilityType] = useState<'all' | 'specific'>('all');
  const [modalSelectedCallerIds, setModalSelectedCallerIds] = useState<string[]>([]);
  const [updating, setUpdating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsData, usersData] = await Promise.all([
        apiFetch<ManagedLead[]>('/api/leads/manage'),
        apiFetch<UserType[]>('/api/users'),
      ]);
      setLeads(leadsData || []);
      setCallers((usersData || []).filter((u) => u.role === 'caller' || u.role === 'team_leader'));
    } catch (err: any) {
      console.error('Failed to fetch lead queue:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Unique lists for dropdown filters
  const industries = Array.from(new Set(leads.map((l) => l.industry).filter(Boolean)));
  const batches = Array.from(new Set(leads.map((l) => l.batch_name).filter(Boolean)));

  // Filtered Leads
  const filteredLeads = leads.filter((lead) => {
    // Status Filter
    if (statusFilter !== 'ALL' && lead.status !== statusFilter) return false;

    // Visibility Filter
    if (visibilityFilter === 'PUBLIC') {
      if (lead.allowed_caller_ids && lead.allowed_caller_ids.length > 0) return false;
    } else if (visibilityFilter === 'RESTRICTED') {
      if (!lead.allowed_caller_ids || lead.allowed_caller_ids.length === 0) return false;
    } else if (visibilityFilter.startsWith('CALLER_')) {
      const cid = visibilityFilter.replace('CALLER_', '');
      if (!lead.allowed_caller_ids || !lead.allowed_caller_ids.includes(cid)) return false;
    }

    // Industry Filter
    if (industryFilter !== 'ALL' && lead.industry !== industryFilter) return false;

    // Batch Filter
    if (batchFilter !== 'ALL' && lead.batch_name !== batchFilter) return false;

    // Text Search
    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        lead.business_name?.toLowerCase().includes(q) ||
        lead.phone?.includes(q) ||
        lead.city?.toLowerCase().includes(q) ||
        lead.state?.toLowerCase().includes(q) ||
        lead.zip?.includes(q) ||
        lead.address?.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedLeadIds(filteredLeads.map((l) => l.id));
    } else {
      setSelectedLeadIds([]);
    }
  };

  const handleToggleSelectLead = (id: string) => {
    setSelectedLeadIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleOpenVisibilityModal = (scope: 'selected' | 'filtered' | 'all') => {
    setTargetScope(scope);
    setModalVisibilityType('all');
    setModalSelectedCallerIds([]);
    setMessage(null);
    setShowVisibilityModal(true);
  };

  const handleSaveVisibility = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdating(true);
    setMessage(null);

    try {
      const allowed_caller_ids =
        modalVisibilityType === 'all' ? null : modalSelectedCallerIds;

      let payload: any = { allowed_caller_ids };

      if (targetScope === 'selected') {
        payload.lead_ids = selectedLeadIds;
      } else if (targetScope === 'filtered') {
        payload.lead_ids = filteredLeads.map((l) => l.id);
      } else {
        payload.update_all = true;
      }

      const res = await apiFetch<{ success: boolean; updatedCount: number }>(
        '/api/leads/visibility',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );

      setMessage({
        type: 'success',
        text: `Successfully updated caller visibility for ${res.updatedCount} leads!`,
      });

      setSelectedLeadIds([]);
      setTimeout(() => {
        setShowVisibilityModal(false);
        fetchData();
      }, 1200);
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.message || 'Failed to update lead visibility settings',
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-400" />
        <span>Loading Lead Queue & Visibility Data...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Eye className="w-6 h-6 text-indigo-400" />
            <span>Lead Visibility & Queue Manager</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage, filter, and assign caller access for every uploaded business lead in Cloud SQL.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
            title="Refresh Queue"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => handleOpenVisibilityModal('selected')}
            disabled={selectedLeadIds.length === 0}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold text-sm shadow-md transition-all cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Edit Visibility for Selected ({selectedLeadIds.length})</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative col-span-1 sm:col-span-2 md:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search business, phone, city, state, address..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Visibility Filter */}
          <div>
            <select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="ALL">All Visibility Settings</option>
              <option value="PUBLIC">🌐 Public to All Callers</option>
              <option value="RESTRICTED">🔒 Restricted Access Only</option>
              {callers.map((c) => (
                <option key={c.id} value={`CALLER_${c.id}`}>
                  👤 Assigned to: {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="ALL">All Lead Statuses</option>
              <option value="unassigned">Unassigned (Ready)</option>
              <option value="reserved">Reserved (Active Dial)</option>
              <option value="completed">Completed (Called)</option>
              <option value="do_not_call">Do Not Call</option>
            </select>
          </div>

          {/* Industry Filter */}
          <div>
            <select
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="ALL">All Target Industries</option>
              {industries.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Secondary Filter Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between pt-2 border-t border-slate-800 gap-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span className="font-semibold text-slate-300">File Batch:</span>
            <select
              value={batchFilter}
              onChange={(e) => setBatchFilter(e.target.value)}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:ring-1 focus:ring-indigo-500"
            >
              <option value="ALL">All Upload Batches</option>
              {batches.map((b) => (
                <option key={b} value={b}>
                  📁 {b}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 text-xs text-slate-400">
            <span>Showing <strong className="text-white">{filteredLeads.length}</strong> of {leads.length} leads</span>
            {(statusFilter !== 'ALL' || visibilityFilter !== 'ALL' || industryFilter !== 'ALL' || batchFilter !== 'ALL' || search) && (
              <button
                onClick={() => {
                  setStatusFilter('ALL');
                  setVisibilityFilter('ALL');
                  setIndustryFilter('ALL');
                  setBatchFilter('ALL');
                  setSearch('');
                }}
                className="text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer ml-2"
              >
                Reset Filters
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Leads Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 uppercase text-[10px] font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={
                      filteredLeads.length > 0 &&
                      filteredLeads.every((l) => selectedLeadIds.includes(l.id))
                    }
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                  />
                </th>
                <th className="p-3.5">Business Name & Phone</th>
                <th className="p-3.5">Industry</th>
                <th className="p-3.5">Location</th>
                <th className="p-3.5">Lead Status</th>
                <th className="p-3.5">Caller Visibility Access</th>
                <th className="p-3.5">Uploaded Batch File</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-500 italic">
                    No leads match your current search and filter criteria.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => {
                  const isSelected = selectedLeadIds.includes(lead.id);

                  // Visibility labels
                  let visibilityBadge = (
                    <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-semibold text-[10px] flex items-center space-x-1 w-fit">
                      <Eye className="w-3 h-3 text-emerald-400" />
                      <span>Public (All Callers)</span>
                    </span>
                  );

                  let allowedIds: string[] = [];
                  if (Array.isArray(lead.allowed_caller_ids)) {
                    allowedIds = lead.allowed_caller_ids;
                  } else if (typeof lead.allowed_caller_ids === 'string') {
                    try { allowedIds = JSON.parse(lead.allowed_caller_ids); } catch { allowedIds = []; }
                  }

                  if (allowedIds && allowedIds.length > 0) {
                    const assignedNames = allowedIds
                      .map((id) => callers.find((c) => c.id === id)?.name || id)
                      .join(', ');

                    visibilityBadge = (
                      <span
                        className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold text-[10px] flex items-center space-x-1 w-fit"
                        title={`Restricted to callers: ${assignedNames}`}
                      >
                        <Lock className="w-3 h-3 text-amber-400" />
                        <span>Restricted: {assignedNames}</span>
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={lead.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="p-3.5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelectLead(lead.id)}
                          className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                        />
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-white">{lead.business_name}</div>
                        <div className="text-[11px] text-indigo-300 font-mono">{lead.phone}</div>
                      </td>

                      <td className="p-3.5 text-slate-300 font-medium">{lead.industry}</td>

                      <td className="p-3.5 text-slate-400">
                        {[lead.city, lead.state].filter(Boolean).join(', ') || lead.address || 'N/A'}
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            lead.status === 'unassigned'
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : lead.status === 'reserved'
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                              : lead.status === 'completed'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border border-red-500/30'
                          }`}
                        >
                          {lead.status}
                        </span>
                      </td>

                      <td className="p-3.5">{visibilityBadge}</td>

                      <td className="p-3.5 text-slate-400 text-[11px] max-w-xs truncate">
                        {lead.batch_name || 'Direct Import'}
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => {
                            setSelectedLeadIds([lead.id]);
                            handleOpenVisibilityModal('selected');
                          }}
                          className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold transition-colors cursor-pointer border border-slate-700"
                        >
                          Change Access
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT VISIBILITY MODAL */}
      {showVisibilityModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Edit Lead Visibility & Access</h3>
              </div>
              <button
                onClick={() => setShowVisibilityModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              Configure which callers in your team are authorized to see and dial these uploaded leads.
            </p>

            {message && (
              <div
                className={`p-3.5 rounded-xl text-xs flex items-center space-x-2 ${
                  message.type === 'success'
                    ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
                    : 'bg-red-500/10 border border-red-500/30 text-red-300'
                }`}
              >
                {message.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
                <span>{message.text}</span>
              </div>
            )}

            <form onSubmit={handleSaveVisibility} className="space-y-4">
              {/* Target Scope Information */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-slate-400 block text-[10px] uppercase">
                  Target Selection Scope:
                </span>
                <strong className="text-white text-sm">
                  {targetScope === 'selected'
                    ? `${selectedLeadIds.length} Selected Leads`
                    : targetScope === 'filtered'
                    ? `All ${filteredLeads.length} Filtered Leads`
                    : `All Uploaded Leads in Organization (${leads.length})`}
                </strong>
              </div>

              {/* Radio: Public vs Specific Callers */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Access Rule
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label
                    className={`p-3 rounded-xl border flex items-center space-x-2 cursor-pointer transition-all ${
                      modalVisibilityType === 'all'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mod_vis_type"
                      checked={modalVisibilityType === 'all'}
                      onChange={() => setModalVisibilityType('all')}
                      className="hidden"
                    />
                    <Eye className="w-4 h-4 text-emerald-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Public</div>
                      <div className="text-[10px] opacity-75">All Callers</div>
                    </div>
                  </label>

                  <label
                    className={`p-3 rounded-xl border flex items-center space-x-2 cursor-pointer transition-all ${
                      modalVisibilityType === 'specific'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white'
                        : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <input
                      type="radio"
                      name="mod_vis_type"
                      checked={modalVisibilityType === 'specific'}
                      onChange={() => setModalVisibilityType('specific')}
                      className="hidden"
                    />
                    <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="text-xs font-bold">Restricted</div>
                      <div className="text-[10px] opacity-75">Specific Callers</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Callers Roster Checklist when 'specific' is active */}
              {modalVisibilityType === 'specific' && (
                <div className="space-y-2 p-3.5 bg-slate-950 border border-slate-800 rounded-xl max-h-48 overflow-y-auto">
                  <label className="block text-[11px] font-bold text-slate-400 uppercase">
                    Select Authorized Callers:
                  </label>
                  {callers.length === 0 ? (
                    <p className="text-xs text-slate-500 italic">No callers found in system team roster.</p>
                  ) : (
                    callers.map((caller) => {
                      const isChecked = modalSelectedCallerIds.includes(caller.id);
                      return (
                        <label
                          key={caller.id}
                          className="flex items-center space-x-2.5 p-2 rounded-lg hover:bg-slate-800/70 cursor-pointer text-xs text-slate-200"
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setModalSelectedCallerIds((prev) => [...prev, caller.id]);
                              } else {
                                setModalSelectedCallerIds((prev) =>
                                  prev.filter((id) => id !== caller.id)
                                );
                              }
                            }}
                            className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500"
                          />
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold text-white">{caller.name}</span>
                            <span className="text-[10px] text-slate-400">({caller.email})</span>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowVisibilityModal(false)}
                  disabled={updating}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={
                    updating ||
                    (modalVisibilityType === 'specific' && modalSelectedCallerIds.length === 0)
                  }
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
                >
                  {updating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Updating Database...</span>
                    </>
                  ) : (
                    <span>Apply Visibility Rules</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
