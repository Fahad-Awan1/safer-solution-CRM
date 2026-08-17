import React, { useState, useEffect } from 'react';
import { CallbackNotificationItem, CallbackNotificationsResponse, User } from '../types';
import { apiFetch } from '../lib/api';
import {
  Bell,
  X,
  Calendar,
  Phone,
  Clock,
  User as UserIcon,
  Search,
  CheckCircle2,
  AlertCircle,
  Building2,
  ChevronRight,
  RefreshCw,
  CheckCheck,
  Sparkles,
} from 'lucide-react';

export function getLocalDateString(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onSelectLead: (item: CallbackNotificationItem) => void;
  onRefreshParent?: () => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  currentUser,
  onSelectLead,
  onRefreshParent,
}) => {
  const [data, setData] = useState<CallbackNotificationsResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Filter & Date State using Local Timezone Date
  const todayStr = getLocalDateString();
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [activeTab, setActiveTab] = useState<'selected' | 'today' | 'overdue' | 'upcoming'>('today');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Local Read/Unseen State Tracking
  const storageKey = `seen_callbacks_${currentUser.id}`;
  const [seenIds, setSeenIds] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });

  const saveSeenIds = (ids: string[]) => {
    setSeenIds(ids);
    try {
      localStorage.setItem(storageKey, JSON.stringify(ids));
    } catch (e) {
      // Ignore quota errors
    }
  };

  const markAsSeen = (id: string) => {
    if (!seenIds.includes(id)) {
      const updated = [...seenIds, id];
      saveSeenIds(updated);
      if (onRefreshParent) onRefreshParent();
    }
  };

  const markAllAsSeen = () => {
    if (!data) return;
    const allIds = [
      ...data.selected_date_callbacks.map((i) => i.id),
      ...data.today_callbacks.map((i) => i.id),
      ...data.overdue_callbacks.map((i) => i.id),
      ...data.upcoming_callbacks.map((i) => i.id),
    ];
    const uniqueSeen = Array.from(new Set([...seenIds, ...allIds]));
    saveSeenIds(uniqueSeen);
    if (onRefreshParent) onRefreshParent();
  };

  const fetchNotifications = async (dateStr: string = selectedDate) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<CallbackNotificationsResponse>(
        `/api/notifications/callbacks?date=${dateStr}&today=${todayStr}`
      );
      setData(res);
      if (onRefreshParent) onRefreshParent();
    } catch (err: any) {
      setError(err.message || 'Failed to load callback notifications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications(selectedDate);
    }
  }, [isOpen, selectedDate]);

  if (!isOpen) return null;

  // Compute tab counts and unseen numbers
  const selectedList = data?.selected_date_callbacks || [];
  const todayList = data?.today_callbacks || [];
  const overdueList = data?.overdue_callbacks || [];
  const upcomingList = data?.upcoming_callbacks || [];

  const countUnseen = (list: CallbackNotificationItem[]) =>
    list.filter((item) => !seenIds.includes(item.id)).length;

  const selectedUnseen = countUnseen(selectedList);
  const todayUnseen = countUnseen(todayList);
  const overdueUnseen = countUnseen(overdueList);
  const upcomingUnseen = countUnseen(upcomingList);

  const totalUnseen = todayUnseen + overdueUnseen + selectedUnseen + upcomingUnseen;

  // Determine list based on activeTab
  let currentList: CallbackNotificationItem[] = [];
  if (activeTab === 'selected') currentList = selectedList;
  else if (activeTab === 'today') currentList = todayList;
  else if (activeTab === 'overdue') currentList = overdueList;
  else if (activeTab === 'upcoming') currentList = upcomingList;

  // Apply search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase().trim();
    currentList = currentList.filter(
      (item) =>
        item.business_name.toLowerCase().includes(q) ||
        item.business_phone.toLowerCase().includes(q) ||
        item.caller_name.toLowerCase().includes(q) ||
        (item.contact_person && item.contact_person.toLowerCase().includes(q)) ||
        (item.industry && item.industry.toLowerCase().includes(q))
    );
  }

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    if (val) {
      setSelectedDate(val);
      setActiveTab('selected');
    }
  };

  const handleItemClick = (item: CallbackNotificationItem) => {
    markAsSeen(item.id);
    onSelectLead(item);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/70 backdrop-blur-sm animate-in fade-in">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-0 sm:pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-100">
          {/* Drawer Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="relative w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Bell className="w-5 h-5 animate-bounce" />
                {totalUnseen > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-slate-900 animate-ping" />
                )}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h2 className="text-base font-bold text-white tracking-tight">Notification Center</h2>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    Call Backs
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {currentUser.role === 'caller' ? 'Your Scheduled Call Backs' : 'All Agency Call Backs'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1">
              <button
                onClick={() => fetchNotifications(selectedDate)}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
                title="Refresh Notifications"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Date Selector & Filters Banner */}
          <div className="p-3.5 sm:p-4 bg-slate-950/60 border-b border-slate-800/80 space-y-3">
            {/* Date Picker Input & Mark All Read Action */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                <span className="text-xs font-semibold text-slate-300">Select Date:</span>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={handleDateChange}
                  className="bg-slate-800 border border-slate-700/80 rounded-lg px-2.5 py-1 text-xs text-white font-medium focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                />
              </div>

              {totalUnseen > 0 && (
                <button
                  onClick={markAllAsSeen}
                  className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 text-[10px] font-semibold flex items-center space-x-1 border border-indigo-500/30 transition-colors cursor-pointer shrink-0"
                  title="Mark all notifications as read"
                >
                  <CheckCheck className="w-3 h-3 text-indigo-400" />
                  <span>Mark Read</span>
                </button>
              )}
            </div>

            {/* Quick Filter Tabs with Counters */}
            <div className="grid grid-cols-4 gap-1 p-1 bg-slate-900 rounded-xl border border-slate-800 text-xs">
              {/* Selected Date Tab */}
              <button
                onClick={() => setActiveTab('selected')}
                className={`py-1.5 px-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                  activeTab === 'selected'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <span>Selected</span>
                  <span className="font-mono text-[10px] px-1 rounded bg-slate-950/40">
                    {selectedList.length}
                  </span>
                </div>
                {selectedUnseen > 0 && (
                  <span className="text-[9px] text-cyan-300 font-bold leading-none mt-0.5">
                    {selectedUnseen} new
                  </span>
                )}
              </button>

              {/* Today Tab */}
              <button
                onClick={() => setActiveTab('today')}
                className={`py-1.5 px-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                  activeTab === 'today'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <span>Today</span>
                  <span className="font-mono text-[10px] px-1 rounded bg-slate-950/40">
                    {todayList.length}
                  </span>
                </div>
                {todayUnseen > 0 ? (
                  <span className="text-[9px] text-emerald-200 font-bold leading-none mt-0.5">
                    {todayUnseen} new
                  </span>
                ) : null}
              </button>

              {/* Overdue Tab */}
              <button
                onClick={() => setActiveTab('overdue')}
                className={`py-1.5 px-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                  activeTab === 'overdue'
                    ? 'bg-amber-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <span>Overdue</span>
                  <span className="font-mono text-[10px] px-1 rounded bg-slate-950/40">
                    {overdueList.length}
                  </span>
                </div>
                {overdueUnseen > 0 ? (
                  <span className="text-[9px] text-amber-200 font-bold leading-none mt-0.5">
                    {overdueUnseen} new
                  </span>
                ) : null}
              </button>

              {/* Upcoming Tab */}
              <button
                onClick={() => setActiveTab('upcoming')}
                className={`py-1.5 px-1 rounded-lg font-semibold text-[11px] transition-all cursor-pointer flex flex-col items-center justify-center relative ${
                  activeTab === 'upcoming'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center space-x-1">
                  <span>Upcoming</span>
                  <span className="font-mono text-[10px] px-1 rounded bg-slate-950/40">
                    {upcomingList.length}
                  </span>
                </div>
                {upcomingUnseen > 0 ? (
                  <span className="text-[9px] text-indigo-200 font-bold leading-none mt-0.5">
                    {upcomingUnseen} new
                  </span>
                ) : null}
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search business, phone, or agent..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-800/80 border border-slate-700/60 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Drawer Body / Callback Notification List */}
          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {loading ? (
              <div className="py-12 text-center text-slate-400 space-y-2">
                <RefreshCw className="w-6 h-6 animate-spin mx-auto text-indigo-400" />
                <p className="text-xs">Fetching callback notifications...</p>
              </div>
            ) : error ? (
              <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs text-center space-y-2">
                <AlertCircle className="w-6 h-6 mx-auto text-red-400" />
                <p>{error}</p>
                <button
                  onClick={() => fetchNotifications(selectedDate)}
                  className="px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-white font-semibold cursor-pointer"
                >
                  Retry
                </button>
              </div>
            ) : currentList.length === 0 ? (
              <div className="py-12 px-4 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto border border-slate-700/60">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-300">No Call Back Notifications</p>
                  <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                    {activeTab === 'selected'
                      ? `No call backs scheduled for ${selectedDate}.`
                      : activeTab === 'today'
                      ? `No call backs scheduled for today (${todayStr}).`
                      : activeTab === 'overdue'
                      ? 'No overdue call backs pending.'
                      : 'No upcoming call backs scheduled.'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-1 flex items-center justify-between">
                  <span>
                    {activeTab === 'selected'
                      ? `Scheduled for ${selectedDate}`
                      : activeTab === 'today'
                      ? `Today's Call Backs (${todayStr})`
                      : activeTab === 'overdue'
                      ? 'Overdue Call Backs'
                      : 'Upcoming Call Backs'}
                  </span>
                  <span className="text-indigo-400 font-mono">
                    Total: {currentList.length} | Unseen: {countUnseen(currentList)}
                  </span>
                </div>

                {currentList.map((item) => {
                  const isToday = item.scheduled_date === todayStr;
                  const isUnseen = !seenIds.includes(item.id);
                  const dateFormatted = new Date(item.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  });

                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className={`relative p-3.5 rounded-xl border transition-all cursor-pointer group hover:scale-[1.01] ${
                        isUnseen
                          ? 'bg-indigo-950/30 border-indigo-500/60 ring-1 ring-indigo-500/40 shadow-lg shadow-indigo-950/40'
                          : isToday
                          ? 'bg-slate-800/90 border-emerald-500/40 hover:border-emerald-400'
                          : item.is_overdue
                          ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400'
                          : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      {/* NEW Unseen Pill */}
                      {isUnseen && (
                        <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-indigo-500 text-white font-black text-[9px] tracking-wider uppercase shadow-md flex items-center space-x-1 animate-pulse">
                          <Sparkles className="w-2.5 h-2.5" />
                          <span>NEW</span>
                        </span>
                      )}

                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Building2 className="w-4 h-4 text-indigo-400 shrink-0" />
                            <h4 className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors">
                              {item.business_name}
                            </h4>
                          </div>

                          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                            <span className="flex items-center space-x-1 font-mono text-emerald-400 font-semibold">
                              <Phone className="w-3 h-3 shrink-0" />
                              <span>{item.business_phone}</span>
                            </span>
                            {item.industry && <span className="truncate max-w-[120px] text-slate-400">{item.industry}</span>}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white transition-colors shrink-0 mt-1" />
                      </div>

                      {/* Scheduled Date & Time Badge */}
                      <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-2 py-0.5 rounded font-bold text-[10px] flex items-center space-x-1 ${
                              isToday
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : item.is_overdue
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-slate-700 text-slate-300'
                            }`}
                          >
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{dateFormatted}</span>
                          </span>

                          {item.scheduled_time && (
                            <span className="text-slate-400 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-indigo-400" />
                              <span>{item.scheduled_time}</span>
                            </span>
                          )}
                        </div>

                        {/* Caller Info */}
                        {currentUser.role !== 'caller' && (
                          <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                            <UserIcon className="w-3 h-3 text-slate-500" />
                            <span>Caller: <strong className="text-slate-300">{item.caller_name}</strong></span>
                          </div>
                        )}
                      </div>

                      {/* Call Notes Preview */}
                      {item.notes && (
                        <p className="mt-2 text-[11px] text-slate-300 line-clamp-1 italic bg-slate-900/60 px-2 py-1 rounded border border-slate-800">
                          "{item.notes}"
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-slate-800 bg-slate-900/90 text-center text-xs text-slate-500">
            <span>Call-back notifications sync dynamically based on scheduled date & local timezone.</span>
          </div>
        </div>
      </div>
    </div>
  );
};
