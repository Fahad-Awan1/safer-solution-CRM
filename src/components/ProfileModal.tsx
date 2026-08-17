import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { apiFetch } from '../lib/api';
import {
  X,
  User as UserIcon,
  Upload,
  Trash2,
  Lock,
  CheckCircle2,
  AlertCircle,
  Shield,
  Sparkles,
  Camera,
  RefreshCw,
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onProfileUpdated: (updatedUser: User) => void;
}

// Collection of 8 curated professional avatar choices
export const PRESET_AVATARS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1560250097-0b93528c311a?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=200&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=200&auto=format&fit=crop&q=80',
];

export function ProfileModal({ isOpen, onClose, currentUser, onProfileUpdated }: ProfileModalProps) {
  const [name, setName] = useState<string>(currentUser.name);
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(currentUser.avatar_url);
  const [saving, setSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setName(currentUser.name);
    setAvatarUrl(currentUser.avatar_url);
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [currentUser, isOpen]);

  if (!isOpen) return null;

  // Process uploaded image file & compress to JPEG Data URL
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
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          setAvatarUrl(compressedBase64);
          setErrorMsg(null);
        } else {
          setAvatarUrl(event.target?.result as string);
        }
      };
      img.onerror = () => setErrorMsg('Failed to read image file.');
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setErrorMsg('Full Name cannot be empty.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const updatedUser = await apiFetch<User>('/api/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name: name.trim(),
          avatar_url: avatarUrl || '',
        }),
      });

      setSuccessMsg('Profile updated successfully!');
      onProfileUpdated(updatedUser);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">Caller Profile & Settings</h3>
              <p className="text-xs text-slate-400">Update your display name and profile picture</p>
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
            {/* Profile Picture Upload & Preview Section */}
            <div className="flex flex-col items-center justify-center space-y-3 p-4 bg-slate-950/60 border border-slate-800 rounded-2xl">
              <div className="relative group">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={currentUser.name}
                    className="w-24 h-24 rounded-full object-cover ring-4 ring-indigo-500/30 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-indigo-600/20 border-2 border-indigo-500/40 text-indigo-300 flex items-center justify-center text-3xl font-bold shadow-lg">
                    {name ? name.charAt(0).toUpperCase() : '?'}
                  </div>
                )}

                {/* File input overlay trigger */}
                <label
                  htmlFor="profile-picture-upload"
                  className="absolute bottom-0 right-0 p-2 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white shadow-md cursor-pointer transition-transform hover:scale-110"
                  title="Upload new profile picture"
                >
                  <Camera className="w-4 h-4" />
                </label>
                <input
                  id="profile-picture-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Upload & Clear buttons */}
              <div className="flex items-center space-x-2">
                <label
                  htmlFor="profile-picture-upload"
                  className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer flex items-center space-x-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Upload Photo</span>
                </label>

                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(undefined)}
                    className="px-3 py-1.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs font-semibold border border-red-500/20 cursor-pointer flex items-center space-x-1 transition-colors"
                    title="Remove profile picture"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Preset Avatars Gallery */}
              <div className="w-full pt-2 border-t border-slate-800">
                <label className="block text-[11px] font-semibold text-slate-400 mb-2 text-center flex items-center justify-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                  <span>Or Select a Preset Avatar</span>
                </label>
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {PRESET_AVATARS.map((url, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setAvatarUrl(url)}
                      className={`relative rounded-full overflow-hidden w-9 h-9 border-2 transition-all cursor-pointer ${
                        avatarUrl === url
                          ? 'border-indigo-500 ring-2 ring-indigo-500/50 scale-110'
                          : 'border-slate-700 hover:border-slate-500 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <img src={url} alt={`Preset ${idx + 1}`} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Editable Name Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5">Full Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your Full Name"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                required
              />
            </div>

            {/* Locked System Fields (Read-Only) */}
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex items-center space-x-1 text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                <Lock className="w-3.5 h-3.5 text-amber-400" />
                <span>Locked System Identifiers</span>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">Email Address (Locked)</label>
                <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-400 font-mono flex items-center justify-between opacity-80 cursor-not-allowed">
                  <span>{currentUser.email}</span>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">System Role</label>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-semibold text-indigo-300 uppercase tracking-wider flex items-center justify-between opacity-80 cursor-not-allowed">
                    <span>{currentUser.role.replace('_', ' ')}</span>
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">Agency Org ID</label>
                  <div className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-400 font-mono truncate opacity-80 cursor-not-allowed">
                    {currentUser.org_id}
                  </div>
                </div>
              </div>

              <p className="text-[11px] text-slate-500 italic">
                * Note: Email address, system role, and security credentials can only be changed by system administrators.
              </p>
            </div>

            {/* Modal Actions */}
            <div className="pt-3 border-t border-slate-800 flex items-center justify-end space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all cursor-pointer disabled:opacity-50 flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Profile</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
