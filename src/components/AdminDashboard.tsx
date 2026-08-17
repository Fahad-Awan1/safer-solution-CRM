import React, { useState, useEffect } from 'react';
import { AdminDashboardStats, Industry } from '../types';
import { apiFetch } from '../lib/api';
import { BarChart3, TrendingUp, Users, CheckCircle2, Phone, Calendar, Download, Building, Plus, Trash2, Shield, RefreshCw, Lock, Globe, Eye, ShieldCheck } from 'lucide-react';
import { HourlyHeatmap } from './HourlyHeatmap';

interface DiagnosticReport {
  success: boolean;
  timestamp: string;
  total_callers: number;
  total_batches: number;
  verification_checks: string[];
  batch_diagnostics: Array<{
    batch_id: string;
    file_name: string;
    total_leads: number;
    allowed_caller_ids: string[];
    is_restricted: boolean;
    allowed_callers_count: number;
    blocked_callers_count: number;
    caller_breakdown: Array<{
      caller_id: string;
      caller_name: string;
      caller_email: string;
      is_allowed: boolean;
      accessible_leads_count: number;
      status: string;
    }>;
  }>;
}

export const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [newIndustryName, setNewIndustryName] = useState('');
  const [newIndustryPitch, setNewIndustryPitch] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [diagnosticReport, setDiagnosticReport] = useState<DiagnosticReport | null>(null);
  const [runningDiagnostic, setRunningDiagnostic] = useState(false);

  const fetchAdminData = async () => {
    try {
      const [statsData, industriesData] = await Promise.all([
        apiFetch<AdminDashboardStats>('/api/dashboard/admin'),
        apiFetch<Industry[]>('/api/industries'),
      ]);
      setStats(statsData);
      setIndustries(industriesData);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load admin analytics');
    } finally {
      setLoading(false);
    }
  };

  const runVisibilityDiagnostic = async () => {
    setRunningDiagnostic(true);
    try {
      const data = await apiFetch<DiagnosticReport>('/api/admin/diagnostic/visibility');
      setDiagnosticReport(data);
    } catch (err: any) {
      alert(err.message || 'Failed to run diagnostic audit');
    } finally {
      setRunningDiagnostic(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
    runVisibilityDiagnostic();
  }, []);

  const handleAddIndustry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newIndustryName.trim()) return;

    try {
      await apiFetch('/api/industries', {
        method: 'POST',
        body: JSON.stringify({
          name: newIndustryName.trim(),
          default_pitch: newIndustryPitch.trim() || undefined,
        }),
      });
      setNewIndustryName('');
      setNewIndustryPitch('');
      fetchAdminData();
    } catch (err: any) {
      alert(err.message || 'Failed to add industry');
    }
  };

  const handleExportCSV = () => {
    window.open('/api/export/csv', '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading Admin Analytics...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-8">
      {/* Top Header Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <BarChart3 className="w-6 h-6 text-indigo-400" />
            <span>Executive Sales Analytics & Operations</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time conversion rates, lead lifecycle metrics, and agency outbound performance.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchAdminData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors"
            title="Refresh Analytics"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Call Logs CSV</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {errorMsg}
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 sm:gap-4">
        <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-1.5 sm:space-y-2">
          <div className="text-[10px] sm:text-xs font-semibold text-slate-400 uppercase tracking-wider">Total Leads</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-white">{stats?.total_leads ?? 0}</div>
          <div className="text-[11px] sm:text-xs text-slate-500">In database queue</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-1.5 sm:space-y-2">
          <div className="text-[10px] sm:text-xs font-semibold text-emerald-400 uppercase tracking-wider">Completed Calls</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-emerald-400">{stats?.completed_leads ?? 0}</div>
          <div className="text-[11px] sm:text-xs text-slate-500">Worked lifecycle</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-1.5 sm:space-y-2">
          <div className="text-[10px] sm:text-xs font-semibold text-amber-400 uppercase tracking-wider">Leads Remaining</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-amber-400">{stats?.remaining_leads ?? 0}</div>
          <div className="text-[11px] sm:text-xs text-slate-500">Ready to call</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-1.5 sm:space-y-2">
          <div className="text-[10px] sm:text-xs font-semibold text-cyan-400 uppercase tracking-wider">Conversion Rate</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-cyan-400">{stats?.conversion_rate ?? 0}%</div>
          <div className="text-[11px] sm:text-xs text-slate-500">Calls interested</div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 sm:p-5 rounded-2xl space-y-1.5 sm:space-y-2 col-span-2 sm:col-span-1 md:col-span-1">
          <div className="text-[10px] sm:text-xs font-semibold text-indigo-400 uppercase tracking-wider">Appointments Set</div>
          <div className="text-2xl sm:text-3xl font-extrabold text-indigo-400">{stats?.appointments_set ?? 0}</div>
          <div className="text-[11px] sm:text-xs text-slate-500">High-intent conversions</div>
        </div>
      </div>

      {/* Visual Hourly Call Outcome Heatmap */}
      <HourlyHeatmap />

      {/* Main Analytics Sections */}
      <div className="grid md:grid-cols-12 gap-6">
        {/* Call Volume Trend */}
        <div className="md:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-indigo-400" />
              <span>7-Day Call Volume & Conversion Trend</span>
            </h3>
            <span className="text-xs text-slate-400">Automated Log Stream</span>
          </div>

          <div className="space-y-3 pt-2">
            {stats?.call_volume_series.map((item) => {
              const maxVol = Math.max(...(stats?.call_volume_series.map((s) => s.total_calls) || [1]), 10);
              const pct = Math.round((item.total_calls / maxVol) * 100);

              return (
                <div key={item.date} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-300 font-medium">
                    <span>{item.date}</span>
                    <span>
                      <strong className="text-white">{item.total_calls} calls</strong> ({item.interested} interested, {item.appointments} appointments)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden flex">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Performers Leaderboard */}
        <div className="md:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span>Top Caller Leaderboard</span>
            </h3>
          </div>

          <div className="space-y-3">
            {stats?.top_performers.length === 0 ? (
              <p className="text-sm text-slate-500 italic py-4">No call logs recorded yet today.</p>
            ) : (
              stats?.top_performers.map((caller, idx) => (
                <div
                  key={caller.caller_id}
                  className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between"
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                        idx === 0
                          ? 'bg-amber-500 text-slate-950'
                          : idx === 1
                          ? 'bg-slate-300 text-slate-950'
                          : idx === 2
                          ? 'bg-amber-700 text-white'
                          : 'bg-slate-700 text-slate-300'
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white">{caller.caller_name}</div>
                      <div className="text-xs text-slate-400">{caller.calls_count} total dials completed</div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-bold text-emerald-400">{caller.appointments} Appointments</div>
                    <div className="text-xs text-indigo-400">{caller.interested} Interested</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Industries Management */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-lg font-bold text-white flex items-center space-x-2">
            <Building className="w-5 h-5 text-indigo-400" />
            <span>Target Industries & Pitch Configuration</span>
          </h3>
          <span className="text-xs text-slate-400">Used for lead grouping & smart pitch rules</span>
        </div>

        <form onSubmit={handleAddIndustry} className="grid md:grid-cols-3 gap-3">
          <input
            type="text"
            placeholder="Industry Name (e.g. Veterinary Clinic)"
            value={newIndustryName}
            onChange={(e) => setNewIndustryName(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500"
            required
          />
          <input
            type="text"
            placeholder="Default Custom Pitch (Optional)"
            value={newIndustryPitch}
            onChange={(e) => setNewIndustryPitch(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="py-3 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-xl flex items-center justify-center space-x-2 cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Add Industry</span>
          </button>
        </form>

        <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
          {industries.map((ind) => (
            <div key={ind.id} className="p-3.5 rounded-xl bg-slate-800/50 border border-slate-700/80">
              <div className="font-semibold text-sm text-white">{ind.name}</div>
              {ind.default_pitch && (
                <div className="text-xs text-indigo-300 mt-1">Pitch: {ind.default_pitch}</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Batch Visibility Diagnostics Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <span>Batch Visibility Enforcement Diagnostic Tool</span>
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Live queries against PostgreSQL database to verify if batch caller restrictions are strictly enforced for non-admin callers.
            </p>
          </div>
          <button
            onClick={runVisibilityDiagnostic}
            disabled={runningDiagnostic}
            className="px-4 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold text-sm flex items-center justify-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${runningDiagnostic ? 'animate-spin' : ''}`} />
            <span>{runningDiagnostic ? 'Auditing Database...' : 'Run Visibility Diagnostic'}</span>
          </button>
        </div>

        {diagnosticReport ? (
          <div className="space-y-4">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                <div>
                  <div className="text-sm font-semibold text-emerald-300">
                    Database Query Diagnostic Audit Verified
                  </div>
                  <div className="text-xs text-emerald-400/80">
                    Audited {diagnosticReport.total_batches} batch(es) across {diagnosticReport.total_callers} caller accounts at {new Date(diagnosticReport.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>

            {/* Verification Checks */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Automated Rule Checks</h4>
              <div className="space-y-1.5">
                {diagnosticReport.verification_checks.map((check, idx) => (
                  <div key={idx} className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-200 flex items-start space-x-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{check}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Batch Breakdown Cards */}
            <div className="space-y-3 pt-2">
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Per-Batch Caller Isolation Matrix</h4>
              {diagnosticReport.batch_diagnostics.map((batch) => (
                <div
                  key={batch.batch_id}
                  className={`p-4 rounded-xl border space-y-3 transition-all ${
                    batch.is_restricted
                      ? 'bg-amber-950/15 border-amber-500/30'
                      : 'bg-emerald-950/15 border-emerald-500/20'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-700/60 pb-2 gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div
                        className={`p-1.5 rounded-lg border ${
                          batch.is_restricted
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                        }`}
                      >
                        {batch.is_restricted ? <Lock className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                      </div>
                      <div>
                        <span className="font-bold text-white text-sm">{batch.file_name}</span>
                        <span className="text-xs text-slate-400 ml-2">({batch.total_leads} total leads)</span>
                      </div>
                    </div>
                    <div>
                      {batch.is_restricted ? (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/40 text-xs font-bold">
                          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>🔒 Restricted ({batch.allowed_callers_count} Allowed / {batch.blocked_callers_count} Blocked)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-bold">
                          <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                          <span>🌐 Global Access (All Callers Allowed)</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {batch.caller_breakdown.map((caller) => (
                      <div
                        key={caller.caller_id}
                        className={`p-2.5 rounded-lg border text-xs flex justify-between items-center ${
                          caller.is_allowed
                            ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-200'
                            : 'bg-red-950/30 border-red-900/50 text-red-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-100 flex items-center space-x-1">
                            <span>{caller.caller_name}</span>
                          </div>
                          <div className="text-[10px] opacity-75">{caller.caller_email}</div>
                        </div>
                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center space-x-1 ${
                              caller.is_allowed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-red-500/20 text-red-300 border border-red-500/30'
                            }`}
                          >
                            <span>{caller.is_allowed ? '✓' : '✕'}</span>
                            <span>{caller.status}</span>
                          </span>
                          <div className="text-[10px] mt-0.5 opacity-80 font-medium">
                            {caller.accessible_leads_count} leads visible
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="p-6 text-center rounded-xl bg-slate-800/30 border border-dashed border-slate-700 text-slate-400 text-sm">
            Click <strong className="text-amber-300">Run Visibility Diagnostic</strong> above to trigger live PostgreSQL queries testing caller isolation per lead batch.
          </div>
        )}
      </div>
    </div>
  );
};
