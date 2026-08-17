import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { apiFetch } from '../lib/api';
import { PRESET_AVATARS } from './ProfileModal';
import {
  X,
  User as UserIcon,
  Upload,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Shield,
  KeyRound,
  Camera,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

interface AdminEditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUser: User | null;
  onUserUpdated: () => void;
}

export function AdminEditUserModal({
  isOpen,
  onClose,
  targetUser,
  onUserUpdated,
}: AdminEditUserModalProps) {
  const [name, setName] = useState<string>('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(undefined);
  const [role, setRole] = useState<UserRole>('caller');
  const [twoFactorEnabled, setTwoFactorEnabled] = useState<boolean>(false);
  const [twoFactorPin, setTwoFactorPin] = useState<string>('1234');
  const [newPassword, setNewPassword] = useState<string>('');
  const [active, setActive] = useState<boolean>(true);

  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (targetUser) {
      setName(targetUser.name || '');
      setAvatarUrl(targetUser.avatar_url);
      setRole(targetUser.role || 'caller');
      setTwoFactorEnabled(!!targetUser.two_factor_enabled);
      setTwoFactorPin(targetUser.two_factor_pin || '1234');
      setNewPassword('');
      setActive(targetUser.active !== false);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [targetUser, isOpen]);

  if (!isOpen || !targetUser) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP).');
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
          setErrorMsg(null);
        } else {
          setAvatarUrl(event.target?.result as string);
        }
      };
      img.onerror = () => setErrorMsg('Failed to process image file.');
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('User Name cannot be empty.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const payload: any = {
        name: name.trim(),
        avatar_url: avatarUrl ? avatarUrl.trim() : '',
        role,
        two_factor_enabled: twoFactorEnabled,
        two_factor_pin: twoFactorPin.trim() || '1234',
        active,
      };

      if (newPassword.trim().length >= 6) {
        payload.password = newPassword.trim();
      }

      await apiFetch(`/api/users/${targetUser.id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });

      setSuccessMsg(`User profile for ${name} updated successfully!`);
      onUserUpdated();
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update user profile');
    } finally {
      setSaving(false);
    }
  };

  const isProtectedAdmin = targetUser.role === 'admin' && targetUser.active;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Admin: Edit User Profile</h3>
              <p className="text-xs text-slate-400">Modify profile picture, credentials, 2FA key, & access roles</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto custom-scrollbar">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-5">
            {/* Profile Picture Upload & Presets */}
            <div className="flex flex-col items-center justify-center space-y-3 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={name}
                    className="w-20 h-20 rounded-full object-cover ring-4 ring-indigo-500/30 shadow-lg"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-indigo-600/20 border-2 border-indigo-500/40 text-indigo-300 flex items-center justify-center text-2xl font-bold shadow-lg">
                    {name ? name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}

                <label
                  htmlFor="admin-edit-avatar-upload"
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer transition-transform hover:scale-110"
                  title="Upload profile picture"
                >
                  <Camera className="w-3.5 h-3.5" />
                </label>
                <input
                  id="admin-edit-avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              <div className="flex items-center space-x-2">
                <label
                  htmlFor="admin-edit-avatar-upload"
                  className="px-3 py-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer flex items-center space-x-1 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Upload Photo</span>
                </label>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(undefined)}
                    className="px-3 py-1 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 cursor-pointer flex items-center space-x-1 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Preset Avatars */}
              <div className="w-full pt-2 border-t border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1.5 text-center flex items-center justify-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Preset Avatar Gallery</span>
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-1.5">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      className={`relative rounded-full overflow-hidden w-8 h-8 border-2 transition-all cursor-pointer ${
                        avatarUrl === url
                          ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-105'
                          : 'border-slate-700 hover:border-slate-500 opacity-70 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Editable Name & Read-only Email */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-400 mb-1">Email (System ID)</label>
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 font-mono truncate cursor-not-allowed">
                  {targetUser.email}
                </div>
              </div>
            </div>

            {/* Role & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">System Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as UserRole)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="caller">Caller (Dialer UI Only)</option>
                  <option value="team_leader">Team Leader (Read/Monitor)</option>
                  <option value="admin">Admin (Full Control)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">Account Status</label>
                <div className="flex items-center space-x-2 pt-1">
                  <button
                    type="button"
                    disabled={isProtectedAdmin}
                    onClick={() => setActive(!active)}
                    className={`flex-1 py-1.5 px-3 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      active
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border-red-500/40 hover:bg-red-500/30'
                    } ${isProtectedAdmin ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {active ? 'Active' : 'Deactivated'}
                  </button>
                  {isProtectedAdmin && (
                    <span className="text-[10px] text-purple-300 bg-purple-900/40 px-2 py-1 rounded border border-purple-500/30">
                      Protected
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Two-Factor Authentication & Custom 2FA PIN */}
            <div className="p-3.5 bg-slate-950/70 border border-slate-800 rounded-2xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <KeyRound className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-white">Two-Factor Authentication (2FA)</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={twoFactorEnabled}
                    onChange={(e) => setTwoFactorEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                </label>
              </div>

              {twoFactorEnabled && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1.5">
                  <label className="block text-xs font-semibold text-amber-300">
                    2FA Security Key / PIN (Editable by Admin)
                  </label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={twoFactorPin}
                      onChange={(e) => setTwoFactorPin(e.target.value)}
                      placeholder="e.g. 1234 or custom key"
                      className="flex-1 bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs font-mono font-bold text-amber-200 focus:outline-none focus:ring-2 focus:ring-amber-500"
                    />
                    <button
                      type="button"
                      onClick={() => setTwoFactorPin(Math.floor(1000 + Math.random() * 9000).toString())}
                      className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                      title="Generate random 4-digit PIN"
                    >
                      Randomize
                    </button>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    User will enter this key/PIN during 2FA login verification. Default is 1234.
                  </p>
                </div>
              )}
            </div>

            {/* Change Password (Optional) */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1 flex items-center space-x-1">
                <Lock className="w-3.5 h-3.5 text-indigo-400" />
                <span>Reset User Password (Optional)</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave blank to keep current password"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                If provided, password will be re-encrypted with 10-round salted Bcrypt hash.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save User Changes</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
