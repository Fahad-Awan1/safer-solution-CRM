import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiFetch } from '../lib/api';
import { PRESET_AVATARS } from './ProfileModal';
import { AdminEditUserModal } from './AdminEditUserModal';
import { Shield, UserPlus, Users, CheckCircle2, XCircle, RefreshCw, AlertCircle, KeyRound, Lock, ShieldCheck, Camera, Upload, Trash2, Sparkles, UserCog, AlertTriangle, Pencil } from 'lucide-react';

interface UserManagementProps {
  onRefreshUsers?: () => void;
}

export const UserManagement: React.FC<UserManagementProps> = ({ onRefreshUsers }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [role, setRole] = useState<UserRole>('caller');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Admin Edit Profile Modal State
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Hard Delete User Modal State
  const [deleteModalUser, setDeleteModalUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Reset Password Modal State
  const [resetModalUser, setResetModalUser] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetting, setResetting] = useState(false);

  const fetchUsers = async () => {
    try {
      const data = await apiFetch<User[]>('/api/users');
      setUsers(data);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_DIM = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_DIM) {
            height *= MAX_DIM / width;
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width *= MAX_DIM / height;
            height = MAX_DIM;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          setAvatarUrl(canvas.toDataURL('image/jpeg', 0.85));
        } else {
          setAvatarUrl(event.target?.result as string);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const newUser = await apiFetch<User>('/api/users', {
        method: 'POST',
        body: JSON.stringify({
          name,
          email,
          role,
          password: password.trim() || undefined,
          avatar_url: avatarUrl.trim() || undefined,
        }),
      });

      setSuccessMsg(`User ${newUser.name} created successfully as ${newUser.role} with profile picture set!`);
      setName('');
      setEmail('');
      setPassword('');
      setAvatarUrl('');
      setRole('caller');
      fetchUsers();
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user: User) => {
    if (user.role === 'admin' && user.active) {
      setErrorMsg('Administrator accounts cannot be deactivated to safeguard system management.');
      return;
    }
    try {
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ active: !user.active }),
      });
      fetchUsers();
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user status');
    }
  };

  const handleHardDelete = async () => {
    if (!deleteModalUser) return;
    setDeleting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await apiFetch<{ message: string }>(`/api/users/${deleteModalUser.id}`, {
        method: 'DELETE',
      });
      setSuccessMsg(res.message || `User ${deleteModalUser.name} deleted successfully!`);
      setDeleteModalUser(null);
      fetchUsers();
      if (onRefreshUsers) onRefreshUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete user');
    } finally {
      setDeleting(false);
    }
  };

  const handleToggle2FA = async (user: User) => {
    try {
      const targetState = !user.two_factor_enabled;
      const pinToUse = user.two_factor_pin || '1234';
      await apiFetch(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          two_factor_enabled: targetState,
          two_factor_pin: pinToUse,
        }),
      });
      setSuccessMsg(`Updated 2FA for ${user.name}: ${targetState ? `Enabled (PIN: ${pinToUse})` : 'Disabled'}`);
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update 2FA state');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetModalUser) return;
    if (!newPassword || newPassword.length < 6) {
      setErrorMsg('New password must be at least 6 characters long.');
      return;
    }

    setResetting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      await apiFetch(`/api/users/${resetModalUser.id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: newPassword }),
      });
      setSuccessMsg(`Password reset successfully for ${resetModalUser.name} with Bcrypt 10-round hash!`);
      setResetModalUser(null);
      setNewPassword('');
      fetchUsers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to reset password');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-slate-400">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        <span>Loading User Roster...</span>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div className="border-b border-slate-800 pb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Shield className="w-6 h-6 text-indigo-400" />
            <span>Team & Access Control</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage agency callers, team leaders, and administrators with secure Bcrypt password hashing & 2FA PINs.
          </p>
        </div>
        <div className="flex items-center space-x-2 bg-indigo-500/10 border border-indigo-500/30 px-3 py-1.5 rounded-xl text-xs font-semibold text-indigo-300">
          <ShieldCheck className="w-4 h-4 text-indigo-400" />
          <span>Bcrypt 10-Round Hashing</span>
        </div>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center space-x-2">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Add User Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <h3 className="text-lg font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
          <UserPlus className="w-5 h-5 text-indigo-400" />
          <span>Provision New Team Account</span>
        </h3>

        <form onSubmit={handleCreateUser} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Full Name</label>
              <input
                type="text"
                placeholder="e.g. David Vance"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Email Address</label>
              <input
                type="email"
                placeholder="david@agency.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">Password (Encrypted)</label>
              <input
                type="text"
                placeholder="Defaults to role password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">System Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
              >
                <option value="caller">Caller (Dialer UI Only)</option>
                <option value="team_leader">Team Leader (Read/Monitor)</option>
                <option value="admin">Admin (Full Control)</option>
              </select>
            </div>
          </div>

          {/* Profile Picture Option for New User */}
          <div className="p-3 bg-slate-800/40 border border-slate-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center space-x-3 w-full sm:w-auto">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Avatar preview"
                  className="w-10 h-10 rounded-full object-cover ring-2 ring-indigo-500/40 shrink-0"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30 shrink-0">
                  {name ? name.charAt(0).toUpperCase() : '?'}
                </div>
              )}
              <div className="min-w-0">
                <span className="text-xs font-bold text-white block">Caller Profile Picture (Optional)</span>
                <span className="text-[11px] text-slate-400 block">Upload photo or select preset avatar</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <label
                htmlFor="admin-avatar-file-upload"
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer flex items-center space-x-1 shrink-0 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-indigo-400" />
                <span>Upload</span>
              </label>
              <input
                id="admin-avatar-file-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />

              {PRESET_AVATARS.slice(0, 5).map((url, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setAvatarUrl(url)}
                  className={`w-7 h-7 rounded-full overflow-hidden border transition-all shrink-0 cursor-pointer ${
                    avatarUrl === url ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-110' : 'border-slate-700 opacity-70 hover:opacity-100'
                  }`}
                >
                  <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl('')}
                  className="p-1.5 rounded-lg text-red-400 hover:bg-red-500/10 cursor-pointer shrink-0"
                  title="Clear photo"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="py-2.5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md transition-all cursor-pointer disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>

      {/* User Roster Table & Mobile Card View */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <h3 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2 border-b border-slate-800 pb-3">
          <Users className="w-5 h-5 text-indigo-400 shrink-0" />
          <span>Active & Deactivated Roster ({users.length})</span>
        </h3>

        {/* Mobile Cards View (Visible on small screens < md) */}
        <div className="block md:hidden space-y-3">
          {users.map((u) => (
            <div
              key={u.id}
              className="bg-slate-800/60 border border-slate-700/80 rounded-2xl p-4 space-y-3 shadow-md"
            >
              {/* Card Header: User Info & Badges */}
              <div className="flex items-start justify-between gap-3 border-b border-slate-700/50 pb-2.5">
                <div className="flex items-center space-x-3 min-w-0 flex-1">
                  {u.avatar_url ? (
                    <img
                      src={u.avatar_url}
                      alt={u.name}
                      className="w-9 h-9 rounded-full object-cover border border-indigo-500/40 shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-xs border border-indigo-500/30 shrink-0 shadow-sm">
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <h4 className="font-bold text-sm text-white truncate">{u.name}</h4>
                    <p className="text-xs text-slate-400 truncate">{u.email}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      u.role === 'admin'
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                        : u.role === 'team_leader'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                    }`}
                  >
                    {u.role.replace('_', ' ')}
                  </span>
                  {u.active ? (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Active</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 text-[11px] text-red-400 font-medium">
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Deactivated</span>
                    </span>
                  )}
                </div>
              </div>

              {/* 2FA Toggle Row */}
              <div className="flex items-center justify-between text-xs pt-0.5">
                <span className="text-slate-400 font-medium">Two-Factor Auth:</span>
                <button
                  onClick={() => setEditingUser(u)}
                  className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    u.two_factor_enabled
                      ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                  }`}
                  title="Click to edit user 2FA Key/PIN & Profile"
                >
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>{u.two_factor_enabled ? `2FA Active (PIN: ${u.two_factor_pin || '1234'})` : '2FA Off'}</span>
                </button>
              </div>

              {/* Action Buttons Grid on Mobile */}
              <div className="pt-2 border-t border-slate-700/40 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  onClick={() => setEditingUser(u)}
                  className="w-full py-2 px-2 rounded-xl text-xs font-bold bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition-all cursor-pointer inline-flex items-center justify-center min-h-[38px]"
                  title="Edit Profile"
                >
                  <Pencil className="w-4 h-4 text-purple-400 shrink-0" />
                </button>

                <button
                  onClick={() => setResetModalUser(u)}
                  className="w-full py-2 px-2 rounded-xl text-xs font-semibold bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30 transition-all cursor-pointer inline-flex items-center justify-center space-x-1 min-h-[38px]"
                  title="Reset user password"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Password</span>
                </button>

                {u.role === 'admin' && u.active ? (
                  <div
                    className="w-full py-2 px-1.5 rounded-xl text-[11px] font-semibold bg-purple-950/40 text-purple-300 border border-purple-500/40 inline-flex items-center justify-center space-x-1 min-h-[38px] opacity-90 cursor-not-allowed"
                    title="Administrator accounts cannot be deactivated"
                  >
                    <Shield className="w-3 h-3 text-purple-400 shrink-0" />
                    <span className="truncate">Protected</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleToggleActive(u)}
                    className={`w-full py-2 px-2 rounded-xl text-xs font-semibold transition-colors cursor-pointer inline-flex items-center justify-center space-x-1 min-h-[38px] ${
                      u.active
                        ? 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/30'
                        : 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/30'
                    }`}
                  >
                    <span className="truncate">{u.active ? 'Deactivate' : 'Reactivate'}</span>
                  </button>
                )}

                {u.role === 'admin' && u.active ? (
                  <div
                    className="w-full py-2 px-1.5 rounded-xl text-[11px] font-semibold bg-slate-900 text-slate-500 border border-slate-800 inline-flex items-center justify-center min-h-[38px] opacity-50 cursor-not-allowed"
                    title="Administrator accounts cannot be deleted"
                  >
                    <Trash2 className="w-4 h-4 text-slate-500 shrink-0" />
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteModalUser(u)}
                    className="w-full py-2 px-2 rounded-xl text-xs font-bold bg-red-600/20 text-red-300 hover:bg-red-600/35 border border-red-500/40 transition-all cursor-pointer inline-flex items-center justify-center min-h-[38px]"
                    title="Delete User"
                  >
                    <Trash2 className="w-4 h-4 text-red-400 shrink-0" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Desktop Table View (Visible on screens >= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-800/80 uppercase text-[10px] font-bold text-slate-400">
              <tr>
                <th className="p-3 rounded-l-xl whitespace-nowrap">User Name</th>
                <th className="p-3 whitespace-nowrap">Email</th>
                <th className="p-3 whitespace-nowrap">Role</th>
                <th className="p-3 whitespace-nowrap">2FA Key / Status</th>
                <th className="p-3 whitespace-nowrap">Status</th>
                <th className="p-3 text-right rounded-r-xl whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-slate-800/30">
                  <td className="p-3 font-semibold text-white whitespace-nowrap">
                    <button
                      onClick={() => setEditingUser(u)}
                      className="flex items-center space-x-2.5 group text-left cursor-pointer hover:text-indigo-300 transition-colors"
                      title="Click to edit profile"
                    >
                      {u.avatar_url ? (
                        <img
                          src={u.avatar_url}
                          alt={u.name}
                          className="w-7 h-7 rounded-full object-cover border border-indigo-500/40 shrink-0 shadow-sm group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-[11px] border border-indigo-500/30 shrink-0 group-hover:bg-indigo-500/30 transition-colors">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="group-hover:underline decoration-indigo-400 underline-offset-2">{u.name}</span>
                    </button>
                  </td>
                  <td className="p-3 text-slate-400 whitespace-nowrap">{u.email}</td>
                  <td className="p-3 whitespace-nowrap">
                    <span
                      className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        u.role === 'admin'
                          ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                          : u.role === 'team_leader'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                          : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                      }`}
                    >
                      {u.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    <button
                      onClick={() => setEditingUser(u)}
                      className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                        u.two_factor_enabled
                          ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200'
                      }`}
                      title="Click to change 2FA Key/PIN"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>{u.two_factor_enabled ? `2FA PIN: ${u.two_factor_pin || '1234'}` : '2FA Off'}</span>
                    </button>
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {u.active ? (
                      <span className="inline-flex items-center space-x-1 text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Active</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 text-red-400 font-medium">
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Deactivated</span>
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end space-x-2">
                      <button
                        onClick={() => setEditingUser(u)}
                        className="p-1.5 rounded-lg text-xs font-bold bg-purple-600/20 text-purple-300 hover:bg-purple-600/30 border border-purple-500/30 transition-all cursor-pointer shrink-0"
                        title="Edit Profile"
                      >
                        <Pencil className="w-4 h-4 text-purple-400" />
                      </button>
                      <button
                        onClick={() => setResetModalUser(u)}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 border border-indigo-500/30 transition-all cursor-pointer inline-flex items-center space-x-1 shrink-0"
                        title="Reset user password"
                      >
                        <Lock className="w-3 h-3" />
                        <span>Password</span>
                      </button>
                      {u.role === 'admin' && u.active ? (
                        <span
                          className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-purple-300/80 border border-purple-500/30 cursor-not-allowed opacity-90 shrink-0"
                          title="Administrator accounts cannot be deactivated"
                        >
                          <Shield className="w-3.5 h-3.5 text-purple-400" />
                          <span>Protected</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer shrink-0 ${
                            u.active
                              ? 'bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 border border-amber-500/30'
                              : 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30'
                          }`}
                        >
                          {u.active ? 'Deactivate' : 'Reactivate'}
                        </button>
                      )}

                      {u.role === 'admin' && u.active ? (
                        <span
                          className="p-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed opacity-50 shrink-0"
                          title="Administrator accounts cannot be deleted"
                        >
                          <Trash2 className="w-4 h-4 text-slate-500" />
                        </span>
                      ) : (
                        <button
                          onClick={() => setDeleteModalUser(u)}
                          className="p-1.5 rounded-lg text-xs font-bold bg-red-600/20 text-red-300 hover:bg-red-600/35 border border-red-500/40 transition-all cursor-pointer shrink-0"
                          title="Delete User"
                        >
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reset Password Modal */}
      {resetModalUser && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Lock className="w-5 h-5 text-indigo-400" />
                <span>Reset User Password</span>
              </h3>
              <button
                onClick={() => setResetModalUser(null)}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Updating password for <strong className="text-white">{resetModalUser.name}</strong> ({resetModalUser.email}).
              Password will be encrypted with Bcrypt 10-round salted hash.
            </p>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">New Password</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="Enter new strong password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500"
                  autoFocus
                />
              </div>

              <div className="flex space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResetModalUser(null)}
                  className="w-1/2 py-2.5 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={resetting}
                  className="w-1/2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center justify-center space-x-1"
                >
                  {resetting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <span>Save & Encrypt</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Hard Delete User Confirmation Modal */}
      {deleteModalUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center space-x-3 bg-red-950/20">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white leading-tight">Confirm Hard Delete User</h3>
                <p className="text-xs text-red-400 font-medium">Irreversible Database Action</p>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-xs font-medium space-y-1.5">
                <p className="font-bold text-red-300 text-sm">
                  Are you sure you want to delete this user?
                </p>
                <p className="text-slate-300 leading-relaxed">
                  You will lose all the data and record that belongs to this user. This action cannot be undone and will permanently erase this account from the database.
                </p>
              </div>

              {/* Target User Info Summary */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center space-x-3">
                {deleteModalUser.avatar_url ? (
                  <img src={deleteModalUser.avatar_url} alt={deleteModalUser.name} className="w-10 h-10 rounded-full object-cover border border-indigo-500/40 shrink-0" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-300 font-bold flex items-center justify-center text-sm border border-indigo-500/30 shrink-0">
                    {deleteModalUser.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-white truncate">{deleteModalUser.name}</h4>
                  <p className="text-[11px] text-slate-400 truncate">{deleteModalUser.email}</p>
                  <span className="text-[10px] font-semibold text-purple-300 uppercase tracking-wide">
                    Role: {deleteModalUser.role.replace('_', ' ')}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setDeleteModalUser(null)}
                  disabled={deleting}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleHardDelete}
                  disabled={deleting}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
                >
                  {deleting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Deleting User...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Yes, Hard Delete User</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit User Profile Modal */}
      <AdminEditUserModal
        isOpen={!!editingUser}
        onClose={() => setEditingUser(null)}
        targetUser={editingUser}
        onUserUpdated={() => {
          fetchUsers();
          if (onRefreshUsers) onRefreshUsers();
        }}
      />
    </div>
  );
};
