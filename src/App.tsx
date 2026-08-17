import React, { useState, useEffect } from 'react';
import { User, CallbackNotificationItem, CallbackNotificationsResponse } from './types';
import { apiFetch, setCurrentUserId, getCurrentUserId } from './lib/api';
import { Header } from './components/Header';
import { LoginForm } from './components/LoginForm';
import { CallerView } from './components/CallerView';
import { AdminDashboard } from './components/AdminDashboard';
import { TeamLeaderDashboard } from './components/TeamLeaderDashboard';
import { LeadImporter } from './components/LeadImporter';
import { LeadQueueView } from './components/LeadQueueView';
import { UserManagement } from './components/UserManagement';
import { CallLogsView } from './components/CallLogsView';
import { AuditLogsView } from './components/AuditLogsView';
import { ConcurrencyTester } from './components/ConcurrencyTester';
import { NotificationDrawer, getLocalDateString } from './components/NotificationDrawer';
import { LeadDetailModal } from './components/LeadDetailModal';
import { ProfileModal } from './components/ProfileModal';
import { Phone, ShieldAlert, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<string>('caller');
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Profile Modal State
  const [profileModalOpen, setProfileModalOpen] = useState<boolean>(false);

  // Notification Drawer & Callback Lead States
  const [notificationDrawerOpen, setNotificationDrawerOpen] = useState<boolean>(false);
  const [selectedNotificationLead, setSelectedNotificationLead] = useState<CallbackNotificationItem | null>(null);
  const [notificationCount, setNotificationCount] = useState<number>(0);

  const fetchNotificationCount = async () => {
    if (!getCurrentUserId()) return;
    try {
      const todayStr = getLocalDateString();
      const res = await apiFetch<CallbackNotificationsResponse>(`/api/notifications/callbacks?today=${todayStr}`);
      const todayCount = res.today_callbacks ? res.today_callbacks.length : 0;
      const overdueCount = res.overdue_callbacks ? res.overdue_callbacks.length : 0;
      setNotificationCount(todayCount + overdueCount);
    } catch (e) {
      // Ignore count fetch errors
    }
  };

  const initAppData = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    setErrorMsg(null);
    try {
      const activeId = getCurrentUserId();
      if (!activeId) {
        setCurrentUser(null);
        if (isInitial) setLoading(false);
        return;
      }

      // Validate logged in user with backend
      const me = await apiFetch<User>('/api/auth/me');
      setCurrentUser(me);

      // Fetch user roster if authorized
      try {
        const allUsers = await apiFetch<User[]>('/api/users');
        setUsers(allUsers);
      } catch (e) {
        setUsers([me]);
      }

      if (isInitial) {
        if (me.role === 'caller') setActiveTab('caller');
        else if (me.role === 'team_leader') setActiveTab('team_leader');
        else if (me.role === 'admin') setActiveTab('admin');
      }

      // Fetch notification count
      fetchNotificationCount();
    } catch (err: any) {
      // Token/Session invalid
      setCurrentUserId('');
      setCurrentUser(null);
    } finally {
      if (isInitial) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    initAppData(true);
  }, []);

  // Heartbeat interval for live active monitoring & notifications polling
  useEffect(() => {
    if (!currentUser) return;
    const interval = setInterval(() => {
      apiFetch('/api/auth/heartbeat', { method: 'POST' }).catch(() => {});
      fetchNotificationCount();
    }, 15000); // Send heartbeat & poll count every 15s
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    if (user.role === 'caller') setActiveTab('caller');
    else if (user.role === 'team_leader') setActiveTab('team_leader');
    else if (user.role === 'admin') setActiveTab('admin');

    try {
      const allUsers = await apiFetch<User[]>('/api/users');
      setUsers(allUsers);
    } catch (e) {
      setUsers([user]);
    }

    fetchNotificationCount();
  };

  const handleLogout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' });
    } catch (e) {}
    setCurrentUserId('');
    setCurrentUser(null);
  };

  const handleSwitchUser = async (userId: string) => {
    try {
      setCurrentUserId(userId);
      const target = users.find((u) => u.id === userId);
      if (target) {
        setCurrentUser(target);
        if (target.role === 'caller') setActiveTab('caller');
        else if (target.role === 'team_leader') setActiveTab('team_leader');
        else if (target.role === 'admin') setActiveTab('admin');
      }
      fetchNotificationCount();
    } catch (err: any) {
      alert(err.message || 'Failed to switch user');
    }
  };

  const handleSelectNotificationItem = (item: CallbackNotificationItem) => {
    setSelectedNotificationLead(item);
  };

  const handleSelectLeadForCalling = async (leadId: string) => {
    try {
      await apiFetch('/api/leads/reserve-specific', {
        method: 'POST',
        body: JSON.stringify({ leadId }),
      });
      setActiveTab('caller');
      setNotificationDrawerOpen(false);
      setSelectedNotificationLead(null);
      fetchNotificationCount();
    } catch (err: any) {
      alert(err.message || 'Failed to lock lead for calling.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
          <Phone className="w-6 h-6 animate-pulse" />
        </div>
        <div className="text-sm font-semibold text-slate-300">Initializing Agency Outbound CRM...</div>
      </div>
    );
  }

  // Render Login Screen if not authenticated
  if (!currentUser) {
    return <LoginForm onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Header */}
      <Header
        currentUser={currentUser}
        users={users}
        onSwitchUser={handleSwitchUser}
        onLogout={handleLogout}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenNotifications={() => setNotificationDrawerOpen(true)}
        notificationCount={notificationCount}
        onOpenProfile={() => setProfileModalOpen(true)}
      />

      {/* Main Workspace View Switcher */}
      <main className="flex-1 pb-12">
        {activeTab === 'caller' && (
          <CallerView
            currentUser={currentUser}
            onOpenProfile={() => setProfileModalOpen(true)}
            onRefreshGlobal={initAppData}
          />
        )}
        {activeTab === 'team_leader' && <TeamLeaderDashboard />}
        {activeTab === 'admin' && <AdminDashboard />}
        {activeTab === 'import' && <LeadImporter onImportComplete={initAppData} />}
        {activeTab === 'lead_queue' && <LeadQueueView />}
        {activeTab === 'users' && <UserManagement onRefreshUsers={initAppData} />}
        {activeTab === 'call_logs' && <CallLogsView currentUser={currentUser} />}
        {activeTab === 'audit_logs' && <AuditLogsView />}
        {activeTab === 'concurrency' && <ConcurrencyTester />}
      </main>

      {/* Profile Modal */}
      <ProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
        currentUser={currentUser}
        onProfileUpdated={(updatedUser) => {
          setCurrentUser(updatedUser);
          initAppData();
        }}
      />

      {/* Notification Drawer Component */}
      <NotificationDrawer
        isOpen={notificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
        currentUser={currentUser}
        onSelectLead={handleSelectNotificationItem}
        onRefreshParent={fetchNotificationCount}
      />

      {/* Selected Lead Callback Detail Modal */}
      {selectedNotificationLead && (
        <LeadDetailModal
          item={selectedNotificationLead}
          currentUser={currentUser}
          onClose={() => setSelectedNotificationLead(null)}
          onSelectLeadForCalling={handleSelectLeadForCalling}
        />
      )}

      {/* Persistent Bottom Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Agency Outbound Sales CRM • Atomic Lead Locking Engine</span>
          <span className="text-slate-400">
            Active User: <strong className="text-slate-200">{currentUser?.name}</strong> ({currentUser?.email})
          </span>
        </div>
      </footer>
    </div>
  );
}
