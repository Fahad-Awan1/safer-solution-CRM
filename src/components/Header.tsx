import React, { useState } from 'react';
import { User } from '../types';
import { Phone, Users, BarChart3, Shield, Upload, FileText, Activity, Zap, LogOut, ChevronDown, Menu, X, Bell, User as UserIcon, Eye } from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  users: User[];
  onSwitchUser: (userId: string) => void;
  onLogout?: () => void;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onOpenNotifications?: () => void;
  notificationCount?: number;
  onOpenProfile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  users,
  onSwitchUser,
  onLogout,
  activeTab,
  setActiveTab,
  onOpenNotifications,
  notificationCount = 0,
  onOpenProfile,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (!currentUser) return null;

  const handleMobileNavClick = (tab: string) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 shrink-0">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-base sm:text-lg tracking-tight text-white">Safer Solution CRM</span>
                <span className="hidden sm:inline-block text-[10px] sm:text-xs px-2 py-0.5 rounded-full font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Outbound Sales
                </span>
              </div>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center space-x-1">
            {currentUser.role === 'caller' && (
              <button
                onClick={() => setActiveTab('caller')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'caller'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Phone className="w-4 h-4" />
                <span>Call Workspace</span>
              </button>
            )}

            {(currentUser.role === 'team_leader' || currentUser.role === 'admin') && (
              <button
                onClick={() => setActiveTab('team_leader')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'team_leader'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Live Team Monitor</span>
              </button>
            )}

            {currentUser.role === 'admin' && (
              <>
                <button
                  onClick={() => setActiveTab('admin')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <BarChart3 className="w-4 h-4" />
                  <span>Analytics & KPIs</span>
                </button>

                <button
                  onClick={() => setActiveTab('import')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'import'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  <span>Lead Import</span>
                </button>

                <button
                  onClick={() => setActiveTab('lead_queue')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'lead_queue'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Lead Access</span>
                </button>

                <button
                  onClick={() => setActiveTab('users')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Shield className="w-4 h-4" />
                  <span>Team & Roles</span>
                </button>

                <button
                  onClick={() => setActiveTab('concurrency')}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    activeTab === 'concurrency'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Lock Benchmark</span>
                </button>
              </>
            )}

            <button
              onClick={() => setActiveTab('call_logs')}
              className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'call_logs'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Call History</span>
            </button>

            {currentUser.role === 'admin' && (
              <button
                onClick={() => setActiveTab('audit_logs')}
                className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'audit_logs'
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Audit Logs</span>
              </button>
            )}

            {onOpenProfile && (
              <button
                onClick={onOpenProfile}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer text-indigo-300 hover:bg-slate-800 hover:text-white border border-indigo-500/20 bg-indigo-500/10"
                title="Edit My Profile & Picture"
              >
                <UserIcon className="w-4 h-4 text-indigo-400" />
                <span>My Profile</span>
              </button>
            )}

            {onLogout && (
              <button
                onClick={onLogout}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer border border-red-500/20 ml-2"
                title="Sign Out / Log Out"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            )}
          </nav>

          {/* Bell Notifications & User Profile & Mobile Toggle */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            {/* Bell Notification Button */}
            {onOpenNotifications && (
              <button
                onClick={onOpenNotifications}
                className="relative p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-all cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center shrink-0"
                title="Call Back Notifications"
              >
                <Bell className="w-5 h-5 text-indigo-400" />
                {notificationCount > 0 ? (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] px-1 items-center justify-center rounded-full bg-rose-500 text-white font-bold text-[10px] ring-2 ring-slate-900 shadow-md shadow-rose-500/30 animate-pulse">
                    {notificationCount > 99 ? '99+' : notificationCount}
                  </span>
                ) : (
                  <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-slate-600" />
                )}
              </button>
            )}

            {/* Mobile Hamburger Navigation Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/60 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
              title="Toggle Mobile Navigation"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-slate-800 space-y-1 animate-in fade-in slide-in-from-top-2">
            <div className="px-3 py-1 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              Navigation Menu
            </div>

            {onOpenNotifications && (
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onOpenNotifications();
                }}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 transition-all cursor-pointer"
              >
                <div className="flex items-center space-x-3">
                  <Bell className="w-4 h-4 text-indigo-400" />
                  <span>Call Back Notifications</span>
                </div>
                {notificationCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-rose-500 text-white font-bold text-[10px]">
                    {notificationCount}
                  </span>
                )}
              </button>
            )}

            {currentUser.role === 'caller' && (
              <button
                onClick={() => handleMobileNavClick('caller')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'caller'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Phone className="w-4 h-4 text-indigo-400" />
                <span>Call Workspace</span>
              </button>
            )}

            {(currentUser.role === 'team_leader' || currentUser.role === 'admin') && (
              <button
                onClick={() => handleMobileNavClick('team_leader')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'team_leader'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Users className="w-4 h-4 text-indigo-400" />
                <span>Live Team Monitor</span>
              </button>
            )}

            {currentUser.role === 'admin' && (
              <>
                <button
                  onClick={() => handleMobileNavClick('admin')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'admin'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <BarChart3 className="w-4 h-4 text-indigo-400" />
                  <span>Analytics & KPIs</span>
                </button>

                <button
                  onClick={() => handleMobileNavClick('import')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'import'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Upload className="w-4 h-4 text-indigo-400" />
                  <span>Lead Import</span>
                </button>

                <button
                  onClick={() => handleMobileNavClick('lead_queue')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'lead_queue'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span>Lead Access</span>
                </button>

                <button
                  onClick={() => handleMobileNavClick('users')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'users'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Shield className="w-4 h-4 text-indigo-400" />
                  <span>Team & Roles</span>
                </button>

                <button
                  onClick={() => handleMobileNavClick('concurrency')}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    activeTab === 'concurrency'
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Zap className="w-4 h-4 text-amber-400" />
                  <span>Lock Benchmark</span>
                </button>
              </>
            )}

            <button
              onClick={() => handleMobileNavClick('call_logs')}
              className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                activeTab === 'call_logs'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-300 hover:bg-slate-800'
              }`}
            >
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Call History</span>
            </button>

            {currentUser.role === 'admin' && (
              <button
                onClick={() => handleMobileNavClick('audit_logs')}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === 'audit_logs'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>Audit Logs</span>
              </button>
            )}

            {/* Mobile Navigation Account & Sign Out Section */}
            <div className="pt-3 border-t border-slate-800/80 space-y-2">
              <div className="px-3 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Account Options
              </div>

              {onOpenProfile && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onOpenProfile();
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 border border-indigo-500/30 transition-all cursor-pointer"
                >
                  <UserIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                  <span>Edit Profile & Picture</span>
                </button>
              )}

              {onLogout && (
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLogout();
                  }}
                  className="w-full flex items-center space-x-3 px-3 py-2.5 rounded-xl text-xs font-semibold bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-red-400 shrink-0" />
                  <span>Sign Out / Log Out</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
