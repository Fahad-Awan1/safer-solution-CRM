import React, { useState, useEffect } from 'react';
import { CallLog, WhoAnswered, CallOutcome, PitchGiven, FollowUpMethod, User as UserType } from '../types';
import { apiFetch } from '../lib/api';
import {
  FileText,
  Search,
  Download,
  RefreshCw,
  Calendar,
  Pencil,
  Save,
  X,
  User,
  Lock,
  AlertCircle,
  CheckCircle2,
  Filter,
  Clock,
  RotateCcw,
  Sparkles,
  PhoneCall,
  SlidersHorizontal,
} from 'lucide-react';

interface CallLogsViewProps {
  initialCallerId?: string;
  currentUser?: UserType | null;
}

export const CallLogsView: React.FC<CallLogsViewProps> = ({ initialCallerId, currentUser }) => {
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);

  const isCaller = currentUser?.role === 'caller';

  // Granular Filter States
  const [selectedCallerId, setSelectedCallerId] = useState<string>(
    initialCallerId || (currentUser?.role === 'caller' ? currentUser.id : 'ALL')
  );
  const [datePreset, setDatePreset] = useState<'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'SPECIFIC_DATE'>('ALL');
  const [specificDate, setSpecificDate] = useState<string>(''); // YYYY-MM-DD
  const [startTime, setStartTime] = useState<string>(''); // HH:mm (24-hr)
  const [endTime, setEndTime] = useState<string>(''); // HH:mm (24-hr)
  const [outcomeFilter, setOutcomeFilter] = useState<string>('ALL');
  const [followupFilter, setFollowupFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');

  // Edit Modal State
  const [editingLog, setEditingLog] = useState<CallLog | null>(null);
  const [editWhoAnswered, setEditWhoAnswered] = useState<WhoAnswered | ''>('');
  const [editCallOutcome, setEditCallOutcome] = useState<CallOutcome | ''>('');
  const [editPitchGiven, setEditPitchGiven] = useState<PitchGiven | ''>('');
  const [editHasFollowup, setEditHasFollowup] = useState<boolean>(false);
  const [editFollowupAt, setEditFollowupAt] = useState<string>('');
  const [editFollowupMethod, setEditFollowupMethod] = useState<FollowUpMethod>('Call');
  const [editNotes, setEditNotes] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [data, usersData] = await Promise.all([
        apiFetch<CallLog[]>('/api/call-logs'),
        apiFetch<UserType[]>('/api/users').catch(() => []),
      ]);
      setLogs(data);
      setUsers(usersData);
    } catch (err) {
      console.error('Failed to load call logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (isCaller && currentUser?.id) {
      setSelectedCallerId(currentUser.id);
    }
  }, [isCaller, currentUser?.id]);

  const getLocalDateStr = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Main Filtering Engine
  const filteredLogs = logs.filter((log) => {
    // 1. Caller Filter (If caller role, strictly enforce own ID)
    if (isCaller) {
      if (log.caller_id !== currentUser?.id) return false;
    } else if (selectedCallerId !== 'ALL' && log.caller_id !== selectedCallerId) {
      return false;
    }

    const logDate = new Date(log.created_at);
    const logDateStr = getLocalDateStr(logDate);
    const logMinutes = logDate.getHours() * 60 + logDate.getMinutes();

    // 2. Date Preset Filter
    if (datePreset === 'TODAY') {
      const todayStr = getLocalDateStr(new Date());
      if (logDateStr !== todayStr) return false;
    } else if (datePreset === 'YESTERDAY') {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      if (logDateStr !== getLocalDateStr(yest)) return false;
    } else if (datePreset === 'THIS_WEEK') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      if (logDate < sevenDaysAgo) return false;
    } else if (datePreset === 'THIS_MONTH') {
      const now = new Date();
      if (logDate.getFullYear() !== now.getFullYear() || logDate.getMonth() !== now.getMonth()) return false;
    }

    // 3. Specific Date Picker
    if (specificDate && logDateStr !== specificDate) {
      return false;
    }

    // 4. Time Range Filter (Start & End Time)
    if (startTime) {
      const [sH, sM] = startTime.split(':').map(Number);
      const startMins = sH * 60 + sM;
      if (logMinutes < startMins) return false;
    }

    if (endTime) {
      const [eH, eM] = endTime.split(':').map(Number);
      const endMins = eH * 60 + eM;
      if (logMinutes > endMins) return false;
    }

    // 5. Outcome Filter
    if (outcomeFilter !== 'ALL') {
      if (outcomeFilter === 'INTERESTED' && !log.call_outcome?.includes('Interested')) return false;
      if (outcomeFilter === 'APPOINTMENT' && log.call_outcome !== 'Interested (appointment set)') return false;
      if (outcomeFilter === 'NOT_INTERESTED' && log.call_outcome !== 'Not Interested') return false;
      if (outcomeFilter === 'NO_ANSWER' && !['Voicemail', 'No Answer'].includes(log.who_answered)) return false;
      if (outcomeFilter === 'CALLBACK' && log.call_outcome !== 'Call Back Later') return false;
      if (outcomeFilter === 'DNC' && log.call_outcome !== 'Do Not Call') return false;
    }

    // 6. Follow-up Filter
    if (followupFilter === 'HAS_FOLLOWUP' && !log.has_followup) return false;
    if (followupFilter === 'NO_FOLLOWUP' && log.has_followup) return false;

    // 7. Text Search
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      const matches =
        log.business_name?.toLowerCase().includes(q) ||
        log.business_phone?.includes(q) ||
        log.caller_name.toLowerCase().includes(q) ||
        log.notes?.toLowerCase().includes(q) ||
        log.contact_name?.toLowerCase().includes(q) ||
        log.who_answered?.toLowerCase().includes(q);

      if (!matches) return false;
    }

    return true;
  });

  const handleResetFilters = () => {
    setSelectedCallerId(isCaller ? (currentUser?.id || 'ALL') : 'ALL');
    setDatePreset('ALL');
    setSpecificDate('');
    setStartTime('');
    setEndTime('');
    setOutcomeFilter('ALL');
    setFollowupFilter('ALL');
    setSearch('');
  };

  const hasActiveFilters =
    (!isCaller && selectedCallerId !== 'ALL') ||
    datePreset !== 'ALL' ||
    specificDate !== '' ||
    startTime !== '' ||
    endTime !== '' ||
    outcomeFilter !== 'ALL' ||
    followupFilter !== 'ALL' ||
    search !== '';

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      alert('No call history records match your current filter to export.');
      return;
    }

    const headers = [
      'Call Log ID',
      'Date & Time',
      'Business Name',
      'Business Phone',
      'Caller Name',
      'Who Answered',
      'Call Outcome',
      'Pitch Delivered',
      'Objection Reason',
      'Follow-Up Scheduled',
      'Follow-Up Date',
      'Follow-Up Method',
      'Call Notes',
    ];

    const escapeCsv = (val: any) => {
      if (val === undefined || val === null) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const csvRows = [
      headers.join(','),
      ...filteredLogs.map((l) =>
        [
          escapeCsv(l.id),
          escapeCsv(l.created_at ? new Date(l.created_at).toLocaleString() : ''),
          escapeCsv(l.business_name || ''),
          escapeCsv(l.business_phone || ''),
          escapeCsv(l.caller_name || ''),
          escapeCsv(l.who_answered || ''),
          escapeCsv(l.call_outcome || ''),
          escapeCsv(l.pitch_given || ''),
          escapeCsv(l.objection_reason || ''),
          escapeCsv(l.has_followup ? 'Yes' : 'No'),
          escapeCsv(l.followup_at ? new Date(l.followup_at).toLocaleString() : ''),
          escapeCsv(l.followup_method || ''),
          escapeCsv(l.notes || ''),
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    const selectedUser = users.find((u) => u.id === selectedCallerId);
    const callerTag = selectedUser ? selectedUser.name.toLowerCase().replace(/[^a-z0-9]/g, '_') : 'all_callers';
    const dateTag = specificDate || datePreset.toLowerCase();

    link.setAttribute('download', `call_logs_${callerTag}_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenEditModal = (log: CallLog) => {
    setEditingLog(log);
    setEditWhoAnswered(log.who_answered || '');
    setEditCallOutcome(log.call_outcome || '');
    setEditPitchGiven(log.pitch_given || '');
    setEditHasFollowup(Boolean(log.has_followup));
    setEditFollowupAt(log.followup_at || '');
    setEditFollowupMethod(log.followup_method || 'Call');
    setEditNotes(log.notes || '');
    setSaveError(null);
    setSaveSuccess(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLog) return;

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const res = await apiFetch<{ success: boolean; callLog: CallLog }>(`/api/call-logs/${editingLog.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          who_answered: editWhoAnswered,
          call_outcome: editCallOutcome,
          pitch_given: editPitchGiven,
          has_followup: editHasFollowup,
          followup_at: editHasFollowup ? editFollowupAt : undefined,
          followup_method: editHasFollowup ? editFollowupMethod : undefined,
          notes: editNotes,
        }),
      });

      setLogs((prev) => prev.map((l) => (l.id === res.callLog.id ? res.callLog : l)));
      setSaveSuccess('Call log updated successfully!');
      setTimeout(() => {
        setEditingLog(null);
        setSaveSuccess(null);
      }, 1000);
    } catch (err: any) {
      setSaveError(err.message || 'Failed to update call log record.');
    } finally {
      setSaving(false);
    }
  };

  const selectedCaller = users.find((u) => u.id === selectedCallerId);
  const totalFilteredCount = filteredLogs.length;
  const interestedCount = filteredLogs.filter((l) => l.call_outcome?.includes('Interested')).length;
  const appointmentCount = filteredLogs.filter((l) => l.call_outcome === 'Interested (appointment set)').length;
  const conversionRate = totalFilteredCount > 0 ? Math.round((interestedCount / totalFilteredCount) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2 text-indigo-400" />
        <span>Loading Call History Database...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <FileText className="w-6 h-6 text-indigo-400" />
            <span>Call History & Analytics Log</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Filter call records by caller name (e.g. Tim), specific date, time window, outcome, or notes.
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={fetchData}
            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer border border-slate-700"
            title="Refresh Call History Data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-md transition-all cursor-pointer"
            title="Download CSV report for current filter"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV ({totalFilteredCount})</span>
          </button>
        </div>
      </div>

      {/* Advanced Filter Toolbar Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-indigo-400 font-bold text-sm">
            <SlidersHorizontal className="w-4 h-4" />
            <span>Call History Filters</span>
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetFilters}
              className="text-xs font-semibold text-amber-400 hover:text-amber-300 flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset All Filters</span>
            </button>
          )}
        </div>

        {/* Filter Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* 1. Caller Selector */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Caller / Rep
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-indigo-400 absolute left-3 top-2.5 pointer-events-none" />
              {isCaller ? (
                <input
                  type="text"
                  readOnly
                  value={`👤 ${currentUser?.name || 'You'} (Your Call Logs Only)`}
                  className="w-full bg-slate-800 border border-indigo-500/40 rounded-xl pl-9 pr-3 py-2 text-xs text-indigo-300 font-semibold cursor-not-allowed opacity-90"
                />
              ) : (
                <select
                  value={selectedCallerId}
                  onChange={(e) => setSelectedCallerId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-semibold cursor-pointer appearance-none"
                >
                  <option value="ALL">All Callers ({logs.length} calls)</option>
                  {users.map((u) => {
                    const count = logs.filter((l) => l.caller_id === u.id).length;
                    return (
                      <option key={u.id} value={u.id}>
                        👤 {u.name} ({count} calls)
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
          </div>

          {/* 2. Date Quick Presets */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Date Quick Filter
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-indigo-400 absolute left-3 top-2.5 pointer-events-none" />
              <select
                value={datePreset}
                onChange={(e) => {
                  const val = e.target.value as any;
                  setDatePreset(val);
                  if (val !== 'SPECIFIC_DATE') setSpecificDate('');
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-semibold cursor-pointer appearance-none"
              >
                <option value="ALL">All Time</option>
                <option value="TODAY">Today Only</option>
                <option value="YESTERDAY">Yesterday</option>
                <option value="THIS_WEEK">This Week (Last 7 Days)</option>
                <option value="THIS_MONTH">This Month</option>
                <option value="SPECIFIC_DATE">Specific Date (Calendar)...</option>
              </select>
            </div>
          </div>

          {/* 3. Specific Date Picker */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Pick Specific Date
            </label>
            <input
              type="date"
              value={specificDate}
              onChange={(e) => {
                setSpecificDate(e.target.value);
                if (e.target.value) setDatePreset('SPECIFIC_DATE');
              }}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium"
            />
          </div>

          {/* 4. Time Range (Start & End Time) */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1 flex items-center justify-between">
              <span>Time Window (Hours)</span>
              {(startTime || endTime) && (
                <button
                  onClick={() => {
                    setStartTime('');
                    setEndTime('');
                  }}
                  className="text-[10px] text-amber-400 hover:underline"
                >
                  Clear Time
                </button>
              )}
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              <div className="relative">
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="From"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-[11px] text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                  title="Filter calls from this time"
                />
              </div>
              <div className="relative">
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="To"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2 py-2 text-[11px] text-white focus:ring-2 focus:ring-indigo-500 font-medium"
                  title="Filter calls up to this time"
                />
              </div>
            </div>
          </div>

          {/* 5. Outcome Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Call Outcome
            </label>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="ALL">All Outcomes</option>
              <option value="INTERESTED">Interested (All)</option>
              <option value="APPOINTMENT">Appointment Set Only</option>
              <option value="NOT_INTERESTED">Not Interested</option>
              <option value="NO_ANSWER">Voicemail / No Answer</option>
              <option value="CALLBACK">Callback Requested</option>
              <option value="DNC">Do Not Call</option>
            </select>
          </div>

          {/* 6. Follow-Up Filter */}
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Follow-Up Status
            </label>
            <select
              value={followupFilter}
              onChange={(e) => setFollowupFilter(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 font-medium"
            >
              <option value="ALL">All Call Logs</option>
              <option value="HAS_FOLLOWUP">Has Follow-Up Task</option>
              <option value="NO_FOLLOWUP">No Follow-Up</option>
            </select>
          </div>

          {/* 7. Text Search */}
          <div className="sm:col-span-2">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1">
              Search Text
            </label>
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search by business name, phone, caller name, notes..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>
        </div>

        {/* Active Filter Chips Bar */}
        {hasActiveFilters && (
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Active Filters:
            </span>

            {selectedCallerId !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1">
                <span>Caller: {selectedCaller?.name || selectedCallerId}</span>
                <button onClick={() => setSelectedCallerId('ALL')} className="hover:text-white ml-1">
                  ×
                </button>
              </span>
            )}

            {datePreset !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1">
                <span>Preset: {datePreset.replace('_', ' ')}</span>
                <button onClick={() => setDatePreset('ALL')} className="hover:text-white ml-1">
                  ×
                </button>
              </span>
            )}

            {specificDate && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1">
                <span>Date: {specificDate}</span>
                <button onClick={() => setSpecificDate('')} className="hover:text-white ml-1">
                  ×
                </button>
              </span>
            )}

            {(startTime || endTime) && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1">
                <span>
                  Time: {startTime || '00:00'} - {endTime || '23:59'}
                </span>
                <button
                  onClick={() => {
                    setStartTime('');
                    setEndTime('');
                  }}
                  className="hover:text-white ml-1"
                >
                  ×
                </button>
              </span>
            )}

            {outcomeFilter !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1">
                <span>Outcome: {outcomeFilter}</span>
                <button onClick={() => setOutcomeFilter('ALL')} className="hover:text-white ml-1">
                  ×
                </button>
              </span>
            )}

            {followupFilter !== 'ALL' && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1">
                <span>Followup: {followupFilter}</span>
                <button onClick={() => setFollowupFilter('ALL')} className="hover:text-white ml-1">
                  ×
                </button>
              </span>
            )}

            {search && (
              <span className="px-2.5 py-1 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold flex items-center space-x-1">
                <span>Search: "{search}"</span>
                <button onClick={() => setSearch('')} className="hover:text-white ml-1">
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Dynamic Filter Performance KPI Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-sm flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 shrink-0">
            <PhoneCall className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-white">{totalFilteredCount}</div>
            <div className="text-[11px] text-slate-400 font-medium">Filtered Calls</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-sm flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-emerald-300">{interestedCount}</div>
            <div className="text-[11px] text-slate-400 font-medium">Interested Leads</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-sm flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-cyan-300">{appointmentCount}</div>
            <div className="text-[11px] text-slate-400 font-medium">Appointments Set</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-3.5 rounded-xl shadow-sm flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xl font-bold text-amber-300">{conversionRate}%</div>
            <div className="text-[11px] text-slate-400 font-medium">Win Rate</div>
          </div>
        </div>
      </div>

      {/* Call Log Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/90 uppercase text-[10px] font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="p-3.5">Date & Time</th>
                <th className="p-3.5">Business Name & Phone</th>
                <th className="p-3.5">Caller</th>
                <th className="p-3.5">Who Answered</th>
                <th className="p-3.5">Outcome</th>
                <th className="p-3.5">Pitch Given</th>
                <th className="p-3.5">Follow-Up?</th>
                <th className="p-3.5">Notes</th>
                <th className="p-3.5 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-500 italic">
                    {hasActiveFilters
                      ? 'No call history records match your current filter settings.'
                      : 'No call history logs found.'}
                  </td>
                </tr>
              ) : (
                filteredLogs.map((l) => {
                  const logDate = new Date(l.created_at);
                  const formattedDateTime = logDate.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true,
                  });

                  return (
                    <tr key={l.id} className="hover:bg-slate-800/40 transition-colors">
                      <td className="p-3.5 text-slate-300 font-medium whitespace-nowrap">
                        <div className="flex items-center space-x-1.5">
                          <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{formattedDateTime}</span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <div className="font-bold text-white">{l.business_name || 'N/A'}</div>
                        <div className="text-[11px] text-indigo-300 font-mono">{l.business_phone}</div>
                      </td>

                      <td className="p-3.5 font-medium text-slate-200">
                        <button
                          onClick={() => !isCaller && setSelectedCallerId(l.caller_id)}
                          className={`hover:text-indigo-400 transition-colors text-left font-semibold flex items-center space-x-1.5 ${
                            isCaller ? 'cursor-default' : 'cursor-pointer hover:underline'
                          }`}
                          title={isCaller ? `Caller: ${l.caller_name}` : `Filter all calls by ${l.caller_name}`}
                        >
                          <User className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          <span>{l.caller_name}</span>
                        </button>
                      </td>

                      <td className="p-3.5">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 border border-slate-700 font-medium">
                          {l.who_answered}
                        </span>
                      </td>

                      <td className="p-3.5">
                        {l.call_outcome ? (
                          <span
                            className={`px-2.5 py-1 rounded-full font-bold text-[10px] inline-block ${
                              l.call_outcome.includes('Interested')
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : l.call_outcome === 'Not Interested'
                                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                                : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                            }`}
                          >
                            {l.call_outcome}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">N/A</span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-300 font-medium">{l.pitch_given || 'N/A'}</td>

                      <td className="p-3.5">
                        {l.has_followup ? (
                          <span className="text-amber-400 font-semibold flex items-center space-x-1 text-[11px]">
                            <Calendar className="w-3.5 h-3.5" />
                            <span>{l.followup_method}</span>
                          </span>
                        ) : (
                          <span className="text-slate-500">None</span>
                        )}
                      </td>

                      <td className="p-3.5 text-slate-400 max-w-xs truncate" title={l.notes}>
                        {l.notes || '—'}
                      </td>

                      <td className="p-3.5 text-center">
                        <button
                          onClick={() => handleOpenEditModal(l)}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center space-x-1 mx-auto transition-all cursor-pointer"
                          title="Edit Call History Record"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                          <span>Edit</span>
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

      {/* EDIT CALL HISTORY POPUP MODAL */}
      {editingLog && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Pencil className="w-5 h-5 text-indigo-400" />
                <h3 className="text-lg font-bold text-white">Edit Call History Entry</h3>
              </div>
              <button
                onClick={() => setEditingLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2 text-xs">
              <div className="flex items-center justify-between text-slate-400 pb-1 border-b border-slate-700/60">
                <span className="flex items-center space-x-1">
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                    Uneditable System Information
                  </span>
                </span>
                <span>Logged: {new Date(editingLog.created_at).toLocaleString()}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                <div>
                  <span className="text-slate-400 block text-[10px]">Business Name:</span>
                  <strong className="text-white text-sm">{editingLog.business_name}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Phone Number:</span>
                  <span className="text-indigo-300 font-mono">{editingLog.business_phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Caller Name:</span>
                  <span className="text-slate-200">{editingLog.caller_name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">Call Log ID:</span>
                  <span className="text-slate-500 font-mono">{editingLog.id}</span>
                </div>
              </div>
            </div>

            {saveError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{saveError}</span>
              </div>
            )}

            {saveSuccess && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{saveSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  1. Who Answered
                </label>
                <select
                  value={editWhoAnswered}
                  onChange={(e) => setEditWhoAnswered(e.target.value as WhoAnswered)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Who Answered --</option>
                  <option value="Receptionist">Receptionist</option>
                  <option value="Manager">Manager</option>
                  <option value="Owner-Doctor">Owner-Doctor</option>
                  <option value="Voicemail">Voicemail</option>
                  <option value="No Answer">No Answer</option>
                  <option value="Wrong Number">Wrong Number</option>
                  <option value="Business Closed-Disconnected">Business Closed / Disconnected</option>
                  <option value="Gatekeeper (refused transfer)">Gatekeeper (refused transfer)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  2. Call Outcome
                </label>
                <select
                  value={editCallOutcome}
                  onChange={(e) => setEditCallOutcome(e.target.value as CallOutcome)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Call Outcome --</option>
                  <option value="Interested (wants more info)">Interested (Wants More Info)</option>
                  <option value="Interested (appointment set)">Interested (Appointment Set)</option>
                  <option value="Not Interested">Not Interested</option>
                  <option value="Call Back Later">Call Back Later</option>
                  <option value="Asked to Email Info">Asked to Email Info</option>
                  <option value="Asked to Text">Asked to Text</option>
                  <option value="Gatekeeper Blocked">Gatekeeper Blocked</option>
                  <option value="Do Not Call">Do Not Call</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  3. Pitch Delivered
                </label>
                <select
                  value={editPitchGiven}
                  onChange={(e) => setEditPitchGiven(e.target.value as PitchGiven)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Select Pitch Delivered --</option>
                  <option value="Website + AI Receptionist">Website + AI Receptionist</option>
                  <option value="AI Receptionist Only">AI Receptionist Only</option>
                  <option value="Both">Both Services</option>
                  <option value="General Intro Only">General Intro Only</option>
                </select>
              </div>

              <div className="space-y-2 p-3 bg-slate-800/50 border border-slate-700/60 rounded-xl">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="edit_has_followup"
                    checked={editHasFollowup}
                    onChange={(e) => setEditHasFollowup(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 bg-slate-800 border-slate-700 focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="edit_has_followup" className="text-xs font-bold text-white cursor-pointer">
                    Schedule Follow-Up Task
                  </label>
                </div>

                {editHasFollowup && (
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-700/60">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={editFollowupAt}
                        onChange={(e) => setEditFollowupAt(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Follow-Up Method
                      </label>
                      <select
                        value={editFollowupMethod}
                        onChange={(e) => setEditFollowupMethod(e.target.value as FollowUpMethod)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Call">Call</option>
                        <option value="Email">Email</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Text">Text</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  5. Call Notes & Summary
                </label>
                <textarea
                  rows={3}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Enter detailed call notes..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20 flex items-center space-x-2 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>Save Call Log Changes</span>
                    </>
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
