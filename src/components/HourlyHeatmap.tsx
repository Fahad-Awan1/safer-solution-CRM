import React, { useState, useEffect } from 'react';
import { apiFetch } from '../lib/api';
import { Flame, Clock, Calendar, TrendingUp, BarChart2, Award, Info, RefreshCw, CheckCircle2 } from 'lucide-react';

export type TimeRange = 'today' | '7days' | '30days' | 'all' | 'custom_date';
export type HeatmapMetric = 'successful' | 'appointments' | 'total' | 'conversion';

interface CallLogItem {
  id: string;
  created_at: string;
  call_outcome?: string;
  caller_name?: string;
  business_name?: string;
  business_phone?: string;
  who_answered?: string;
}

interface HourlyData {
  hour: number;
  label: string;
  totalCalls: number;
  successfulCalls: number;
  appointments: number;
  conversionRate: number;
  topCaller?: string;
  logs: CallLogItem[];
}

export const HourlyHeatmap: React.FC = () => {
  const [logs, setLogs] = useState<CallLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<TimeRange>('7days');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [metric, setMetric] = useState<HeatmapMetric>('successful');
  const [selectedHour, setSelectedHour] = useState<HourlyData | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await apiFetch<CallLogItem[]>('/api/call-logs');
      setLogs(data);
    } catch (err) {
      console.error('Failed to fetch call logs for heatmap:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  // Filter logs by time range
  const filteredLogs = logs.filter((log) => {
    if (!log.created_at) return false;
    const logDate = new Date(log.created_at);
    const now = new Date();

    if (timeRange === 'today') {
      return logDate.toDateString() === now.toDateString();
    }
    if (timeRange === 'custom_date') {
      const dateStr = logDate.toISOString().split('T')[0];
      return dateStr === selectedDate;
    }
    if (timeRange === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 7);
      return logDate >= sevenDaysAgo;
    }
    if (timeRange === '30days') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(now.getDate() - 30);
      return logDate >= thirtyDaysAgo;
    }
    return true; // 'all'
  });

  // Calculate 24-hour distribution
  const hourlyStats: HourlyData[] = Array.from({ length: 24 }, (_, hour) => {
    const hourLogs = filteredLogs.filter((log) => {
      const date = new Date(log.created_at);
      return date.getHours() === hour;
    });

    const totalCalls = hourLogs.length;

    // Successful outcomes include appointments, interest, email info requested, follow-ups
    const successfulCalls = hourLogs.filter((log) => {
      const outcome = log.call_outcome || '';
      return (
        outcome.includes('Interested') ||
        outcome.includes('Appointment') ||
        outcome.includes('Email Info') ||
        outcome.includes('Text') ||
        outcome.includes('Call Back')
      );
    }).length;

    const appointments = hourLogs.filter((log) =>
      (log.call_outcome || '').includes('appointment set')
    ).length;

    const conversionRate = totalCalls > 0 ? (successfulCalls / totalCalls) * 100 : 0;

    // Determine top caller in this hour
    const callerCounts: Record<string, number> = {};
    hourLogs.forEach((l) => {
      if (l.caller_name) {
        callerCounts[l.caller_name] = (callerCounts[l.caller_name] || 0) + 1;
      }
    });

    let topCaller = '';
    let maxCount = 0;
    Object.entries(callerCounts).forEach(([name, count]) => {
      if (count > maxCount) {
        maxCount = count;
        topCaller = name;
      }
    });

    // Label formatting (e.g., "9 AM", "12 PM")
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 === 0 ? 12 : hour % 12;
    const label = `${displayHour} ${ampm}`;

    return {
      hour,
      label,
      totalCalls,
      successfulCalls,
      appointments,
      conversionRate,
      topCaller,
      logs: hourLogs,
    };
  });

  // Determine maximum metric value for heatmap intensity scale
  const getMetricValue = (item: HourlyData) => {
    switch (metric) {
      case 'successful':
        return item.successfulCalls;
      case 'appointments':
        return item.appointments;
      case 'total':
        return item.totalCalls;
      case 'conversion':
        return item.conversionRate;
    }
  };

  const maxVal = Math.max(...hourlyStats.map(getMetricValue), 1);

  // Peak hour determination
  const peakHourItem = [...hourlyStats].sort((a, b) => getMetricValue(b) - getMetricValue(a))[0];
  const totalSuccessful = hourlyStats.reduce((sum, h) => sum + h.successfulCalls, 0);
  const totalAppointments = hourlyStats.reduce((sum, h) => sum + h.appointments, 0);
  const totalCalls = hourlyStats.reduce((sum, h) => sum + h.totalCalls, 0);
  const avgConversion = totalCalls > 0 ? (totalSuccessful / totalCalls) * 100 : 0;

  // Background styling calculation according to intensity
  const getTileStyle = (val: number, isPeak: boolean) => {
    if (val === 0) {
      return {
        bg: 'bg-slate-900/60 border-slate-800 text-slate-500',
        barBg: 'bg-slate-800',
      };
    }

    const ratio = val / maxVal;

    if (isPeak && val > 0) {
      return {
        bg: 'bg-gradient-to-b from-indigo-600 to-indigo-700 border-amber-400 text-white shadow-lg shadow-indigo-500/25 ring-2 ring-amber-400/50',
        barBg: 'bg-amber-300',
      };
    }

    if (ratio > 0.66) {
      return {
        bg: 'bg-indigo-600/90 border-indigo-400 text-white shadow-md shadow-indigo-600/20',
        barBg: 'bg-indigo-300',
      };
    } else if (ratio > 0.33) {
      return {
        bg: 'bg-indigo-900/80 border-indigo-600/60 text-indigo-100',
        barBg: 'bg-indigo-400',
      };
    } else {
      return {
        bg: 'bg-slate-800/90 border-slate-700/80 text-slate-300',
        barBg: 'bg-indigo-500/60',
      };
    }
  };

  return (
    <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 shadow-xl space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Flame className="w-5 h-5 text-amber-400" />
            <span>Hourly Call Outcome Heatmap</span>
          </h2>
          <p className="text-slate-400 text-xs mt-1">
            Analyze peak performing hours of the day to optimize caller shifts and campaign distribution.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          {/* Time Range Selector & Past Date Selector */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-full">
            <Calendar className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1 shrink-0" />
            {(['today', '7days', '30days', 'all'] as TimeRange[]).map((tr) => (
              <button
                key={tr}
                onClick={() => setTimeRange(tr)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  timeRange === tr
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                {tr === 'today'
                  ? 'Today'
                  : tr === '7days'
                  ? '7 Days'
                  : tr === '30days'
                  ? '30 Days'
                  : 'All Time'}
              </button>
            ))}

            <div className="h-4 w-px bg-slate-800 mx-1 hidden sm:block" />

            {/* Custom Past Date Selector */}
            <div className="flex items-center space-x-1.5 pl-1">
              <button
                onClick={() => setTimeRange('custom_date')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                  timeRange === 'custom_date'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
                title="View Heatmap for a Specific Past Date"
              >
                Specific Date:
              </button>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setTimeRange('custom_date');
                }}
                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              />
            </div>
          </div>

          {/* Metric Selector */}
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 max-w-full overflow-x-auto">
            <BarChart2 className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1 shrink-0" />
            <button
              onClick={() => setMetric('successful')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                metric === 'successful'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Interested & Appointments"
            >
              Successful
            </button>
            <button
              onClick={() => setMetric('appointments')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                metric === 'appointments'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Appointments
            </button>
            <button
              onClick={() => setMetric('total')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                metric === 'total'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Total Calls
            </button>
            <button
              onClick={() => setMetric('conversion')}
              className={`px-2 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                metric === 'conversion'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Conversion %
            </button>
          </div>

          <button
            onClick={fetchLogs}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition-colors cursor-pointer shrink-0"
            title="Refresh Heatmap Data"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Summary Stat Highlights */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Peak Conversion
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white truncate">
              {peakHourItem && getMetricValue(peakHourItem) > 0
                ? `${peakHourItem.label}`
                : 'N/A'}
            </div>
            <div className="text-[10px] sm:text-[11px] text-amber-400 font-medium truncate">
              {peakHourItem && getMetricValue(peakHourItem) > 0
                ? `${peakHourItem.successfulCalls} Succ. (${peakHourItem.conversionRate.toFixed(0)}%)`
                : 'No calls recorded'}
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shrink-0">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Successful
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white truncate">{totalSuccessful}</div>
            <div className="text-[10px] sm:text-[11px] text-indigo-400 font-medium truncate">
              Of {totalCalls} total calls
            </div>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Appointments
            </div>
            <div className="text-sm sm:text-base font-extrabold text-emerald-400 truncate">{totalAppointments}</div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">High-intent</div>
          </div>
        </div>

        <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center space-x-2.5 sm:space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider truncate">
              Avg Conversion
            </div>
            <div className="text-sm sm:text-base font-extrabold text-white truncate">{avgConversion.toFixed(1)}%</div>
            <div className="text-[10px] sm:text-[11px] text-slate-400 truncate">Rate / Total</div>
          </div>
        </div>
      </div>

      {/* 24-Hour Grid Heatmap */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-400 mb-2 gap-2">
          <span className="font-semibold text-slate-300">24-Hour Hourly Intensity Grid</span>
          <div className="flex flex-wrap items-center space-x-2 text-[11px]">
            <span className="text-slate-500">Legend:</span>
            <span className="inline-block w-3 h-3 rounded bg-slate-900 border border-slate-800" title="Zero Calls" />
            <span className="inline-block w-3 h-3 rounded bg-slate-800 border border-slate-700" title="Low Volume" />
            <span className="inline-block w-3 h-3 rounded bg-indigo-900 border border-indigo-600" title="Medium Volume" />
            <span className="inline-block w-3 h-3 rounded bg-indigo-600 border border-indigo-400" title="High Volume" />
            <span className="inline-block w-3 h-3 rounded bg-amber-400 border border-amber-300" title="Peak Hour" />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-12 gap-2">
          {hourlyStats.map((item) => {
            const val = getMetricValue(item);
            const isPeak = peakHourItem?.hour === item.hour && val > 0;
            const style = getTileStyle(val, isPeak);
            const intensityPct = maxVal > 0 ? Math.min(100, Math.max(8, (val / maxVal) * 100)) : 0;

            return (
              <button
                key={item.hour}
                onClick={() => setSelectedHour(item)}
                className={`p-2.5 rounded-xl border text-left flex flex-col justify-between h-24 transition-all hover:scale-105 cursor-pointer relative overflow-hidden ${style.bg}`}
              >
                {/* Header label & peak badge */}
                <div className="flex items-start justify-between w-full">
                  <span className="text-xs font-bold font-mono tracking-tight">{item.label}</span>
                  {isPeak && (
                    <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[9px] rounded uppercase tracking-wider flex items-center space-x-0.5 shadow">
                      <Flame className="w-2.5 h-2.5 fill-slate-950" />
                      <span>Peak</span>
                    </span>
                  )}
                </div>

                {/* Main Metric Value */}
                <div className="my-1">
                  <div className="text-lg font-black leading-none">
                    {metric === 'conversion' ? `${item.conversionRate.toFixed(0)}%` : val}
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5 truncate">
                    {metric === 'conversion'
                      ? `${item.successfulCalls}/${item.totalCalls} Calls`
                      : `${item.appointments} Appts (${item.conversionRate.toFixed(0)}%)`}
                  </div>
                </div>

                {/* Relative Intensity Bar at bottom */}
                <div className="w-full h-1.5 bg-black/30 rounded-full overflow-hidden mt-auto">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${style.barBg}`}
                    style={{ width: `${intensityPct}%` }}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Hour Detail Modal / Drawer */}
      {selectedHour && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-hidden flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900">
              <div className="flex items-center space-x-2">
                <Clock className="w-5 h-5 text-indigo-400" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    Hourly Drilldown: {selectedHour.label} ({selectedHour.hour}:00 - {selectedHour.hour}:59)
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedHour.totalCalls} total calls logged in this hour interval
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHour(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4 flex-1">
              <div className="grid grid-cols-3 gap-2 text-center p-3 rounded-xl bg-slate-950 border border-slate-800">
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Total Calls</div>
                  <div className="text-base font-bold text-white">{selectedHour.totalCalls}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Successful</div>
                  <div className="text-base font-bold text-indigo-400">{selectedHour.successfulCalls}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Appointments</div>
                  <div className="text-base font-bold text-emerald-400">{selectedHour.appointments}</div>
                </div>
              </div>

              {selectedHour.topCaller && (
                <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between text-xs">
                  <span className="text-indigo-300 font-semibold">Most Active Caller in this hour:</span>
                  <span className="font-bold text-white bg-indigo-600/40 px-2 py-0.5 rounded border border-indigo-500/30">
                    {selectedHour.topCaller}
                  </span>
                </div>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Call Activity Records ({selectedHour.logs.length})
                </div>
                {selectedHour.logs.length === 0 ? (
                  <div className="text-center py-6 text-slate-500 italic text-xs">
                    No calls recorded during this hour.
                  </div>
                ) : (
                  selectedHour.logs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/70 space-y-1.5 text-xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-white">{log.business_name}</span>
                        <span className="text-slate-400 text-[11px]">
                          {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">
                          Caller: <strong>{log.caller_name || 'Caller'}</strong>
                        </span>
                        {log.call_outcome && (
                          <span
                            className={`px-2 py-0.5 rounded font-semibold ${
                              log.call_outcome.includes('appointment set')
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : log.call_outcome.includes('Interested')
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            {log.call_outcome}
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
