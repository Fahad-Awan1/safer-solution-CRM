import React, { useState } from 'react';
import { CallbackNotificationItem, User } from '../types';
import { X, Phone, Calendar, Clock, User as UserIcon, Building2, MapPin, Mail, Sparkles, Copy, Check, FileText } from 'lucide-react';

interface LeadDetailModalProps {
  item: CallbackNotificationItem | null;
  currentUser: User;
  onClose: () => void;
  onSelectLeadForCalling?: (leadId: string) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  item,
  currentUser,
  onClose,
  onSelectLeadForCalling,
}) => {
  const [copied, setCopied] = useState(false);

  if (!item) return null;

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(item.business_phone);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(item.scheduled_date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in">
      <div
        className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/80 flex items-start justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg font-bold text-white tracking-tight leading-snug">
                  {item.business_name}
                </h3>
                {item.industry && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                    {item.industry}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">Call-Back Scheduled Lead Details</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Scheduled Date & Time Banner */}
          <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
            <div className="flex items-center space-x-2 text-indigo-300 font-medium">
              <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
              <span>
                Scheduled Date: <strong className="text-white font-bold">{formattedDate}</strong>
              </span>
            </div>
            {item.scheduled_time && (
              <div className="flex items-center space-x-1.5 text-slate-300">
                <Clock className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                <span>Time: {item.scheduled_time}</span>
              </div>
            )}
          </div>

          {/* Quick Business Contact Information */}
          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800 space-y-3 text-xs">
            {/* Phone Number with Call & Copy Actions */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <span className="text-[11px] text-slate-400 block leading-tight">Phone Number</span>
                  <a
                    href={`tel:${item.business_phone}`}
                    className="font-mono font-bold text-sm text-emerald-300 hover:underline"
                  >
                    {item.business_phone}
                  </a>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyPhone}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1 border border-slate-700/60 transition-colors cursor-pointer"
                  title="Copy Phone Number"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5 text-slate-400" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Address */}
            {item.address && (
              <div className="flex items-start space-x-2.5">
                <MapPin className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[11px] text-slate-400 block leading-tight">Address / Location</span>
                  <span className="text-slate-200 font-medium">{item.address}</span>
                </div>
              </div>
            )}

            {/* Decision Maker & Email */}
            {(item.contact_person || item.contact_email) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-800/80">
                {item.contact_person && (
                  <div className="flex items-start space-x-2">
                    <UserIcon className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] text-slate-400 block leading-tight">Contact Person</span>
                      <span className="text-slate-200 font-medium">{item.contact_person}</span>
                    </div>
                  </div>
                )}
                {item.contact_email && (
                  <div className="flex items-start space-x-2">
                    <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-[11px] text-slate-400 block leading-tight">Contact Email</span>
                      <a href={`mailto:${item.contact_email}`} className="text-indigo-400 hover:underline font-medium truncate block">
                        {item.contact_email}
                      </a>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Smart Pitch Suggestion */}
          {item.smart_pitch && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
              <div className="flex items-center space-x-2 text-amber-300 font-bold mb-1">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>Recommended Pitch Strategy</span>
              </div>
              <p className="text-slate-200 font-medium">{item.smart_pitch}</p>
            </div>
          )}

          {/* Caller & Notes Section */}
          <div className="p-4 rounded-xl bg-slate-950/40 border border-slate-800/80 space-y-2.5 text-xs">
            <div className="flex items-center justify-between text-slate-400">
              <span className="flex items-center space-x-1.5">
                <UserIcon className="w-3.5 h-3.5 text-indigo-400" />
                <span>Assigned Caller: <strong className="text-slate-200">{item.caller_name}</strong></span>
              </span>
              {item.call_outcome && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-indigo-300 text-[10px] font-semibold border border-slate-700">
                  {item.call_outcome}
                </span>
              )}
            </div>

            {item.notes ? (
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1 flex items-center space-x-1">
                  <FileText className="w-3.5 h-3.5 text-slate-400" />
                  <span>Call Notes & Instructions</span>
                </span>
                <p className="text-slate-300 bg-slate-900/90 p-2.5 rounded-lg border border-slate-800/60 leading-relaxed italic">
                  "{item.notes}"
                </p>
              </div>
            ) : (
              <p className="text-slate-500 italic text-[11px]">No previous call notes recorded.</p>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close Window
          </button>

          {currentUser.role === 'caller' && onSelectLeadForCalling && (
            <button
              onClick={() => {
                onSelectLeadForCalling(item.lead_id);
                onClose();
              }}
              className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white text-xs font-bold shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all cursor-pointer min-h-[44px]"
            >
              <Phone className="w-4 h-4" />
              <span>Lock & Call This Lead Now</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
