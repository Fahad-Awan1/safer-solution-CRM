import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Users, PhoneCall, Clock, AlertTriangle, CheckCircle2, ChevronRight, RefreshCw, X, Eye } from 'lucide-react';
import { HourlyHeatmap } from './HourlyHeatmap';

interface CallerRosterItem {
  id: string;
  name: string;
  email: string;
  active: boolean;
  status: 'In Call' | 'Idle' | 'Offline';
  calls_today: number;
  interested_today: number;
  appointments_today: number;
  idle_minutes: number;
  is_idle_alert: boolean;
  current_lead?: {
    id: string;
    business_name: string;
    phone: string;
    industry: string;
    reserved_at?: string;
  };
}

interface TeamLeaderData {
  roster: CallerRosterItem[];
  remaining_queue_leads: number;
  total_calls_today: number;
}

export const TeamLeaderDashboard: React.FC = () => {
  const [data, setData] = useState<TeamLeaderData | null>(null);
  const [selectedCaller, setSelectedCaller] = useState<CallerRosterItem | null>(null);
  const [callerHistory, setCallerHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchTeamData = async () => {
    try {
      const res = await apiFetch<TeamLeaderData>('/api/dashboard/team-leader');
      setData(res);
    } catch (err: any) {
      console.error('Failed to load team leader dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTeamData();
    const timer = setInterval(fetchTeamData, 10000); // Auto refresh every 10 sec
    return () => clearInterval(timer);
  }, []);

  const handleDrillDownCaller = async (caller: CallerRosterItem) => {
    setSelectedCaller(caller);
    setHistoryLoading(true);
    try {
      const allLogs = await apiFetch<any[]>('/api/call-logs');
      const filtered = allLogs.filter((l) => l.caller_id === caller.id);
      setCallerHistory(filtered);
    } catch (err) {
      console.error('Failed to load caller logs:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading Live Caller Roster...</span>
      </div>
    );
  }

  const idleAlertCallers = data?.roster.filter((c) => c.is_idle_alert) || [];

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Users className="w-6 h-6 text-indigo-400" />
            <span>Live Caller Performance Monitor</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time status tracking, idle alerts, and active call reservations.
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <div className="text-right">
            <div className="text-xs text-slate-400">Total Calls Today</div>
            <div className="text-xl font-bold text-white">{data?.total_calls_today ?? 0}</div>
          </div>
          <button
            onClick={fetchTeamData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer"
            title="Refresh Roster"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 15+ Min IDLE ALERT BANNER */}
      {idleAlertCallers.length > 0 && (
        <div className="p-4 rounded-2xl bg-red-950/60 border border-red-500/40 text-red-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xl animate-pulse">
          <div className="flex items-center space-x-3">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
            <div>
              <div className="font-bold text-sm text-red-300">
                ATTENTION: {idleAlertCallers.length} Caller(s) Idle for 15+ Minutes
              </div>
              <div className="text-xs text-red-200/80 mt-0.5">
                {idleAlertCallers.map((c) => `${c.name} (${c.idle_minutes}m idle)`).join(', ')}
              </div>
            </div>
          </div>
          <span className="text-xs bg-red-600 text-white font-bold px-3 py-1 rounded-full uppercase tracking-wider shrink-0">
            Action Required
          </span>
        </div>
      )}

      {/* Live Roster Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
        {data?.roster.map((caller) => (
          <div
            key={caller.id}
            className={`bg-slate-900 rounded-2xl p-5 border space-y-4 shadow-lg transition-all ${
              caller.is_idle_alert
                ? 'border-red-500/60 bg-red-950/20'
                : caller.status === 'In Call'
                ? 'border-emerald-500/40'
                : 'border-slate-800'
            }`}
          >
            {/* Header / Status Badge */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-lg text-white">{caller.name}</h3>
                <p className="text-xs text-slate-400">{caller.email}</p>
              </div>

              {caller.status === 'In Call' && (
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span>In Call</span>
                </span>
              )}

              {caller.status === 'Idle' && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/30">
                  <Clock className="w-3.5 h-3.5 mr-0.5" />
                  <span>Idle ({caller.idle_minutes}m)</span>
                </span>
              )}

              {caller.status === 'Offline' && (
                <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-800 text-slate-400 border border-slate-700">
                  Offline
                </span>
              )}
            </div>

            {/* Currently Reserved Lead (If in call) */}
            {caller.current_lead ? (
              <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-1">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400">
                  Active Reserved Lead
                </div>
                <div className="font-bold text-sm text-white truncate">{caller.current_lead.business_name}</div>
                <div className="text-xs text-slate-400 flex items-center justify-between">
                  <span>{caller.current_lead.phone}</span>
                  <span className="text-[11px] text-slate-500">{caller.current_lead.industry}</span>
                </div>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-slate-800/30 border border-slate-800 text-xs text-slate-500 italic">
                No active lead reserved currently
              </div>
            )}

            {/* Daily Performance Ticker */}
            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
              <div>
                <div className="text-xs text-slate-400">Calls</div>
                <div className="text-base font-bold text-white">{caller.calls_today}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Interested</div>
                <div className="text-base font-bold text-indigo-400">{caller.interested_today}</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Appointments</div>
                <div className="text-base font-bold text-emerald-400">{caller.appointments_today}</div>
              </div>
            </div>

            {/* Drill Down Button */}
            <button
              onClick={() => handleDrillDownCaller(caller)}
              className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Drill Into Call History</span>
            </button>
          </div>
        ))}
      </div>

      {/* Hourly Call Outcome Heatmap */}
      <HourlyHeatmap />

      {/* DRILL DOWN MODAL */}
      {selectedCaller && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div>
                <h3 className="text-lg font-bold text-white">Caller Performance Drill-Down</h3>
                <p className="text-xs text-slate-400">{selectedCaller.name} — Detailed Activity Trail</p>
              </div>
              <button
                onClick={() => setSelectedCaller(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {historyLoading ? (
                <div className="text-center py-10 text-slate-400">Loading caller history...</div>
              ) : callerHistory.length === 0 ? (
                <div className="text-center py-10 text-slate-500 italic">
                  No call logs recorded for {selectedCaller.name} yet.
                </div>
              ) : (
                <div className="space-y-3">
                  {callerHistory.map((log) => (
                    <div key={log.id} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-2">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span className="font-semibold text-white text-sm">{log.business_name} ({log.business_phone})</span>
                        <span>{new Date(log.created_at).toLocaleString()}</span>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="px-2.5 py-1 rounded-md bg-slate-700 text-slate-200">
                          Answered: <strong>{log.who_answered}</strong>
                        </span>
                        {log.call_outcome && (
                          <span className="px-2.5 py-1 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Outcome: <strong>{log.call_outcome}</strong>
                          </span>
                        )}
                        {log.pitch_given && (
                          <span className="px-2.5 py-1 rounded-md bg-emerald-500/20 text-emerald-300">
                            Pitch: {log.pitch_given}
                          </span>
                        )}
                      </div>
                      {log.notes && (
                        <p className="text-xs text-slate-300 italic pt-1 border-t border-slate-700/50">
                          "{log.notes}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
