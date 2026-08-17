import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { apiFetch } from '../lib/api';
import { Activity, RefreshCw, Shield, Clock, Search, Filter } from 'lucide-react';

export const AuditLogsView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [userFilter, setUserFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');

  const fetchAuditLogs = async () => {
    try {
      setLoading(true);
      const data = await apiFetch<AuditLog[]>('/api/audit-logs');
      setLogs(data || []);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
  }, []);

  // Filter options
  const actions = Array.from(new Set(logs.map((l) => l.action).filter(Boolean)));
  const users = Array.from(new Set(logs.map((l) => l.user_name).filter(Boolean)));

  const filteredLogs = logs.filter((log) => {
    if (actionFilter !== 'ALL' && log.action !== actionFilter) return false;
    if (userFilter !== 'ALL' && log.user_name !== userFilter) return false;

    if (dateFilter === 'today') {
      const todayStr = new Date().toDateString();
      if (new Date(log.timestamp).toDateString() !== todayStr) return false;
    } else if (dateFilter === '7days') {
      const sevenAgo = new Date();
      sevenAgo.setDate(sevenAgo.getDate() - 7);
      if (new Date(log.timestamp) < sevenAgo) return false;
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      const match =
        log.details?.toLowerCase().includes(q) ||
        log.action?.toLowerCase().includes(q) ||
        log.user_name?.toLowerCase().includes(q) ||
        log.target_type?.toLowerCase().includes(q) ||
        log.target_id?.toLowerCase().includes(q);
      if (!match) return false;
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-400" />
        <span>Loading Traceable Audit History...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Activity className="w-6 h-6 text-indigo-400" />
            <span>Traceable Audit History</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Every state change, reservation, lead import, profile update, and security event logged in Cloud SQL.
          </p>
        </div>

        <button
          onClick={fetchAuditLogs}
          className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer self-start md:self-auto"
          title="Refresh Audit Logs"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search details, actor, target..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Action Filter */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="ALL">All Actions ({logs.length})</option>
              {actions.map((act) => (
                <option key={act} value={act}>
                  {act}
                </option>
              ))}
            </select>
          </div>

          {/* User Filter */}
          <div>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="ALL">All Users / Actors</option>
              {users.map((u) => (
                <option key={u} value={u}>
                  👤 {u}
                </option>
              ))}
            </select>
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="today">Today Only</option>
              <option value="7days">Last 7 Days</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs text-slate-400">
          <span>
            Showing <strong className="text-white">{filteredLogs.length}</strong> of {logs.length} audit records
          </span>
          {(actionFilter !== 'ALL' || userFilter !== 'ALL' || dateFilter !== 'ALL' || search) && (
            <button
              onClick={() => {
                setActionFilter('ALL');
                setUserFilter('ALL');
                setDateFilter('ALL');
                setSearch('');
              }}
              className="text-indigo-400 hover:text-indigo-300 underline font-medium cursor-pointer"
            >
              Clear Audit Filters
            </button>
          )}
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-3">
        {filteredLogs.length === 0 ? (
          <div className="text-center py-10 text-slate-500 italic">No audit records match your current filter.</div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-slate-800/50 border border-slate-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-800/70 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-[10px] px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                      {log.action}
                    </span>
                    <span className="font-semibold text-sm text-white">{log.user_name}</span>
                  </div>
                  <p className="text-xs text-slate-300">{log.details}</p>
                </div>

                <div className="text-xs text-slate-500 shrink-0 flex items-center space-x-1 font-mono">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  <span>{new Date(log.timestamp).toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
