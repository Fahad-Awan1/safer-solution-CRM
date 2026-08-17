import React, { useState, useEffect } from 'react';
import { Lead, CallerDashboardStats, WhoAnswered, CallOutcome, PitchGiven, ObjectionReason, FollowUpMethod, User } from '../types';
import { apiFetch } from '../lib/api';
import { PhoneCall, Sparkles, CheckCircle2, Clock, Globe, MapPin, Building, Calendar, AlertCircle, Play, Flame, ArrowRight, ShieldAlert, RefreshCw, Copy, Check, Mail, User as UserIcon, Camera, Edit3 } from 'lucide-react';

interface CallerViewProps {
  currentUser?: User | null;
  onOpenProfile?: () => void;
  onRefreshGlobal?: () => void;
}

export const CallerView: React.FC<CallerViewProps> = ({ currentUser, onOpenProfile, onRefreshGlobal }) => {
  const [stats, setStats] = useState<CallerDashboardStats | null>(null);
  const [activeLead, setActiveLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // Outcome Form State
  const [whoAnswered, setWhoAnswered] = useState<WhoAnswered | ''>('');
  const [callOutcome, setCallOutcome] = useState<CallOutcome | ''>('');
  const [pitchGiven, setPitchGiven] = useState<PitchGiven | ''>('');
  const [objectionReason, setObjectionReason] = useState<ObjectionReason | ''>('');
  const [hasFollowUp, setHasFollowUp] = useState<boolean>(false);
  const [followupAt, setFollowupAt] = useState<string>('');
  const [followupMethod, setFollowupMethod] = useState<FollowUpMethod>('Call');
  const [contactName, setContactName] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const fetchStats = async () => {
    try {
      const data = await apiFetch<CallerDashboardStats>('/api/dashboard/caller');
      setStats(data);
    } catch (err: any) {
      console.error('Failed to fetch caller stats:', err);
    }
  };

  const loadNextLead = async () => {
    setLoading(true);
    setErrorMessage(null);
    setSuccessMsg(null);
    try {
      const leadData = await apiFetch<any>('/api/leads/next', { method: 'POST' });
      if (leadData.lead === null) {
        setActiveLead(null);
        setErrorMessage(leadData.message || 'No leads available right now.');
      } else {
        setActiveLead(leadData);
        // Pre-fill smart pitch
        if (leadData.smart_pitch) {
          setPitchGiven(leadData.smart_pitch as PitchGiven);
        }
        resetOutcomeForm();
      }
      fetchStats();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to fetch next lead');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    loadNextLead();
  }, []);

  const resetOutcomeForm = () => {
    setWhoAnswered('');
    setCallOutcome('');
    setObjectionReason('');
    setHasFollowUp(false);
    setFollowupAt('');
    setFollowupMethod('Call');
    setContactName('');
    setContactEmail('');
    setNotes('');
  };

  const handleCopyPhone = (phoneNumber?: string) => {
    if (phoneNumber) {
      navigator.clipboard.writeText(phoneNumber);
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    }
  };

  // Check if call was non-conversational (Voicemail, No Answer, Wrong Number, Business Closed)
  const isNonConversational = [
    'Voicemail',
    'No Answer',
    'Wrong Number',
    'Business Closed-Disconnected',
  ].includes(whoAnswered);

  const handleSubmitOutcome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeLead) return;

    if (!whoAnswered) {
      setErrorMessage('Please select who answered the call.');
      return;
    }

    if (!isNonConversational) {
      if (!callOutcome) {
        setErrorMessage('Please select a Conversation Outcome.');
        return;
      }
      if (!pitchGiven) {
        setErrorMessage('Please select the Pitch Delivered.');
        return;
      }
      if (callOutcome === 'Not Interested' && !objectionReason) {
        setErrorMessage('Please select a Primary Objection Reason.');
        return;
      }
    }

    if (hasFollowUp) {
      if (!followupAt) {
        setErrorMessage('Please select a Follow-Up date & time.');
        return;
      }
      if (!followupMethod) {
        setErrorMessage('Please select a Follow-Up method.');
        return;
      }
    }

    setSubmitting(true);
    setErrorMessage(null);

    try {
      await apiFetch('/api/leads/outcome', {
        method: 'POST',
        body: JSON.stringify({
          leadId: activeLead.id,
          who_answered: whoAnswered,
          call_outcome: isNonConversational ? undefined : callOutcome,
          pitch_given: isNonConversational ? undefined : pitchGiven,
          objection_reason: isNonConversational ? undefined : objectionReason,
          has_followup: hasFollowUp,
          followup_at: hasFollowUp ? followupAt : undefined,
          followup_method: hasFollowUp ? followupMethod : undefined,
          contact_name: contactName || undefined,
          contact_email: contactEmail || undefined,
          notes: notes || undefined,
        }),
      });

      setSuccessMsg('Call outcome saved successfully!');
      setActiveLead(null);
      resetOutcomeForm();
      fetchStats();
      if (onRefreshGlobal) onRefreshGlobal();

      // Automatically load next lead immediately
      setTimeout(() => {
        loadNextLead();
      }, 400);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit call outcome.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReleaseLead = async () => {
    if (!activeLead) return;
    try {
      await apiFetch('/api/leads/release', {
        method: 'POST',
        body: JSON.stringify({ leadId: activeLead.id }),
      });
      setActiveLead(null);
      resetOutcomeForm();
      fetchStats();
      if (onRefreshGlobal) onRefreshGlobal();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to release lead.');
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-2.5 sm:px-4 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Caller Header Stats Ticker */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 sm:gap-3">
        <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm text-slate-100 flex items-center space-x-2 sm:space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-indigo-500/10 text-indigo-400 shrink-0">
            <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold tracking-tight truncate">{stats?.calls_today ?? 0}</div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">Calls Today</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm text-slate-100 flex items-center space-x-2 sm:space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0">
            <Sparkles className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold tracking-tight truncate">{stats?.interested_count ?? 0}</div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">Interested</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm text-slate-100 flex items-center space-x-2 sm:space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/10 text-cyan-400 shrink-0">
            <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold tracking-tight truncate">{stats?.appointments_count ?? 0}</div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">Appointments</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm text-slate-100 flex items-center space-x-2 sm:space-x-3">
          <div className="p-2 sm:p-2.5 rounded-xl bg-amber-500/10 text-amber-400 shrink-0">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold tracking-tight truncate">{stats?.remaining_leads ?? 0}</div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">Queue Left</div>
          </div>
        </div>

        <div className="bg-slate-900 border border-slate-800 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm text-slate-100 flex items-center space-x-2 sm:space-x-3 col-span-2 sm:col-span-1 md:col-span-1">
          <div className="p-2 sm:p-2.5 rounded-xl bg-orange-500/10 text-orange-400 shrink-0">
            <Flame className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-lg sm:text-2xl font-bold tracking-tight text-orange-400 truncate">
              {stats?.current_streak ?? 0}
            </div>
            <div className="text-[10px] sm:text-xs text-slate-400 font-medium truncate">Win Streak</div>
          </div>
        </div>
      </div>

      {/* Global Alerts */}
      {errorMessage && (
        <div className="p-3 sm:p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs sm:text-sm flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 min-w-0">
            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400 shrink-0" />
            <span className="break-words">{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-xs underline text-red-400 hover:text-red-300 shrink-0">
            Dismiss
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-3 sm:p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 shrink-0" />
          <span className="break-words">{successMsg}</span>
        </div>
      )}

      {/* Active Workspace State */}
      {!activeLead ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-10 text-center space-y-4 sm:space-y-5 max-w-xl mx-auto my-4 sm:my-8">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-indigo-600/10 text-indigo-400 flex items-center justify-center mx-auto border border-indigo-500/20">
            <Play className="w-6 h-6 sm:w-8 sm:h-8 ml-0.5 sm:ml-1" />
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">Ready for Your Next Lead?</h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1 leading-relaxed">
              Click below to atomically lock the next business lead from the queue. Zero lead collisions guaranteed.
            </p>
          </div>
          <button
            onClick={loadNextLead}
            disabled={loading}
            className="w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-bold text-sm sm:text-lg shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                <span>Reserving Lead...</span>
              </>
            ) : (
              <>
                <span>Start Calling / Get Next Lead</span>
                <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-12 gap-4 sm:gap-6">
          {/* Left Column: Business Lead Info & Smart Pitch */}
          <div className="md:col-span-5 space-y-4 sm:space-y-5">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-4 sm:space-y-5 shadow-xl">
              <div className="flex items-start justify-between">
                <div className="min-w-0 w-full">
                  {activeLead.is_followup_resurface && (
                    <span className="inline-flex items-center space-x-1 text-[11px] sm:text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30 mb-2">
                      <Clock className="w-3.5 h-3.5 mr-1 shrink-0" />
                      <span>Due Follow-up Resurfaced</span>
                    </span>
                  )}
                  <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight break-words">{activeLead.business?.name}</h3>
                  <div className="flex items-center space-x-2 text-slate-400 text-xs mt-1 min-w-0">
                    <Building className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="truncate">{activeLead.business?.industry}</span>
                  </div>
                </div>
              </div>

              {/* Tap to Call & Copy Number Icon Action */}
              <div className="relative group">
                <a
                  href={`tel:${activeLead.business?.phone}`}
                  className="w-full py-3 sm:py-3.5 pl-3.5 pr-14 sm:pr-16 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm sm:text-base flex items-center justify-center space-x-2 shadow-lg shadow-emerald-600/20 transition-all text-center block truncate min-h-[44px]"
                >
                  <PhoneCall className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                  <span className="truncate">Tap to Call: {activeLead.business?.phone}</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleCopyPhone(activeLead.business?.phone)}
                  title="Copy Phone Number"
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-emerald-700/80 hover:bg-emerald-800 text-white transition-all cursor-pointer shadow-sm flex items-center space-x-1 shrink-0 min-h-[36px]"
                >
                  {copiedPhone ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-300 animate-bounce" />
                      <span className="text-[10px] font-bold text-emerald-200 uppercase tracking-wider hidden sm:inline">Copied</span>
                    </>
                  ) : (
                    <Copy className="w-4 h-4 text-emerald-100" />
                  )}
                </button>
              </div>

              {/* Extracted Business Information from CSV */}
              <div className="space-y-3 pt-2 text-xs sm:text-sm border-t border-slate-800">
                {activeLead.business?.contact_person && (
                  <div className="flex items-center space-x-2.5 text-slate-200">
                    <UserIcon className="w-4 h-4 text-indigo-400 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-slate-400 text-[10px] sm:text-xs block">Decision Maker / Contact:</span>
                      <span className="font-semibold text-white truncate block">{activeLead.business.contact_person}</span>
                    </div>
                  </div>
                )}

                {activeLead.business?.email && (
                  <div className="flex items-center space-x-2.5 text-slate-200">
                    <Mail className="w-4 h-4 text-cyan-400 shrink-0" />
                    <div className="min-w-0 w-full">
                      <span className="text-slate-400 text-[10px] sm:text-xs block">Business Email:</span>
                      <a href={`mailto:${activeLead.business.email}`} className="text-cyan-400 hover:underline truncate block">
                        {activeLead.business.email}
                      </a>
                    </div>
                  </div>
                )}

                {/* Complete Location & Zip Code Card */}
                {(() => {
                  const biz = activeLead.business;
                  const zipCode = biz?.zip || (biz?.address ? (biz.address.match(/\b(\d{5}(-\d{4})?)\b/)?.[1] || '') : '');
                  const streetAddress = biz?.address && biz.address !== 'N/A' ? biz.address : '';
                  const cityStr = biz?.city || '';
                  const stateStr = biz?.state || '';

                  let formattedFullAddress = '';
                  if (streetAddress) {
                    formattedFullAddress = streetAddress;
                    if (cityStr && !streetAddress.toLowerCase().includes(cityStr.toLowerCase())) {
                      formattedFullAddress += `, ${cityStr}`;
                    }
                    if (stateStr && !streetAddress.toLowerCase().includes(stateStr.toLowerCase())) {
                      formattedFullAddress += `, ${stateStr}`;
                    }
                    if (zipCode && !streetAddress.includes(zipCode)) {
                      formattedFullAddress += ` ${zipCode}`;
                    }
                  } else {
                    const parts = [cityStr, stateStr, zipCode].filter(Boolean);
                    formattedFullAddress = parts.length > 0 ? parts.join(', ') : 'Location Not Specified';
                  }

                  return (
                    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/80 space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-semibold">
                        <span className="flex items-center space-x-1.5 text-slate-300">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-rose-400 shrink-0" />
                          <span className="text-slate-300 text-[10px] sm:text-xs font-bold uppercase tracking-wider">Location & Zip Code</span>
                        </span>
                        {zipCode ? (
                          <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-mono font-bold flex items-center space-x-1 shrink-0">
                            <span className="text-slate-400 text-[9px]">ZIP:</span>
                            <span className="text-white">{zipCode}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 italic">No Zip Code</span>
                        )}
                      </div>

                      <div className="text-xs sm:text-sm font-semibold text-white leading-snug break-words">
                        {formattedFullAddress}
                      </div>

                      {(cityStr || stateStr || zipCode) && (
                        <div className="flex flex-wrap gap-1.5 text-xs pt-1.5 border-t border-slate-700/60">
                          {streetAddress && streetAddress !== formattedFullAddress && (
                            <span className="bg-slate-900/80 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-700 text-slate-300 max-w-full min-w-0">
                              <span className="text-slate-500 text-[9px] block uppercase font-medium">Street</span>
                              <span className="font-medium text-white truncate block text-[11px]">{streetAddress}</span>
                            </span>
                          )}
                          {cityStr && (
                            <span className="bg-slate-900/80 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-700 text-slate-300">
                              <span className="text-slate-500 text-[9px] block uppercase font-medium">City</span>
                              <span className="font-medium text-white text-[11px]">{cityStr}</span>
                            </span>
                          )}
                          {stateStr && (
                            <span className="bg-slate-900/80 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-700 text-slate-300">
                              <span className="text-slate-500 text-[9px] block uppercase font-medium">State</span>
                              <span className="font-medium text-white text-[11px]">{stateStr}</span>
                            </span>
                          )}
                          {zipCode && (
                            <span className="bg-slate-900/80 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-lg border border-slate-700 text-slate-300">
                              <span className="text-slate-500 text-[9px] block uppercase font-medium">Zip Code</span>
                              <span className="font-mono font-bold text-indigo-300 text-[11px]">{zipCode}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

                <div className="flex items-center justify-between gap-2 pt-1">
                  <div className="flex items-center space-x-2 text-slate-300">
                    <Globe className="w-4 h-4 text-slate-500 shrink-0" />
                    <span>Website Status:</span>
                  </div>
                  {activeLead.business?.has_website && activeLead.business?.website_url ? (
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shrink-0">
                      Has Website
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20 shrink-0">
                      No website detected
                    </span>
                  )}
                </div>

                {activeLead.business?.has_website && activeLead.business?.website_url && (
                  <div className="text-xs text-indigo-400 truncate pl-6">
                    <a href={activeLead.business.website_url} target="_blank" rel="noreferrer" className="hover:underline truncate block">
                      {activeLead.business.website_url}
                    </a>
                  </div>
                )}
              </div>

              {/* SYSTEM DERIVED SMART PITCH BOX */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  <span className="flex items-center space-x-1">
                    <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-400 shrink-0" />
                    <span className="text-[11px] sm:text-xs">Suggested Pitch (Auto-Computed)</span>
                  </span>
                  <span className="text-[9px] sm:text-[10px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full border border-indigo-500/30 shrink-0">
                    Rule Engine
                  </span>
                </div>
                <div className="text-base sm:text-lg font-bold text-white break-words">
                  {activeLead.smart_pitch}
                </div>
                <p className="text-xs text-indigo-300/80 leading-relaxed">
                  {activeLead.business?.has_website
                    ? 'Business has an existing website on file. Focus pitch exclusively on AI Receptionist & phone automation.'
                    : 'No website detected. Pitch a complete Website Development + AI Receptionist bundle.'}
                </p>
              </div>

              {/* Release Button */}
              <button
                type="button"
                onClick={handleReleaseLead}
                className="w-full py-2.5 text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 rounded-xl transition-colors cursor-pointer min-h-[44px]"
              >
                Release Lead Back to Shared Queue
              </button>
            </div>
          </div>

          {/* Right Column: Fast Structured Outcome Form */}
          <div className="md:col-span-7">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4 sm:space-y-5">
              <div className="border-b border-slate-800 pb-3 flex items-center justify-between gap-2">
                <h3 className="text-base sm:text-lg font-bold text-white">Structured Call Outcome</h3>
                <span className="text-[11px] sm:text-xs text-slate-400 shrink-0">Complete in &lt; 15s</span>
              </div>

              <form onSubmit={handleSubmitOutcome} className="space-y-4 sm:space-y-5">
                {/* 1. Who Answered */}
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                    1. Who Answered? <span className="text-indigo-400">*</span>
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {[
                      'Receptionist',
                      'Manager',
                      'Owner-Doctor',
                      'Gatekeeper (refused transfer)',
                      'Voicemail',
                      'No Answer',
                      'Wrong Number',
                      'Business Closed-Disconnected',
                    ].map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setWhoAnswered(opt as WhoAnswered)}
                        className={`p-2.5 rounded-xl text-xs font-medium text-left border transition-all break-words leading-tight min-h-[44px] cursor-pointer ${
                          whoAnswered === opt
                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20'
                            : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700/60'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Conditional Visibility: Skip Outcome/Pitch/Objection if non-conversational call */}
                {!isNonConversational && whoAnswered !== '' && (
                  <>
                    {/* 2. Call Outcome */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        2. Conversation Outcome <span className="text-indigo-400">*</span>
                      </label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {[
                          'Interested (wants more info)',
                          'Interested (appointment set)',
                          'Not Interested',
                          'Call Back Later',
                          'Asked to Email Info',
                          'Asked to Text',
                          'Gatekeeper Blocked',
                          'Do Not Call',
                        ].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => setCallOutcome(opt as CallOutcome)}
                            className={`p-2.5 rounded-xl text-xs font-medium text-left border transition-all break-words leading-tight min-h-[44px] cursor-pointer ${
                              callOutcome === opt
                                ? opt.includes('Interested')
                                  ? 'bg-emerald-600 text-white border-emerald-500 shadow-md'
                                  : opt === 'Do Not Call'
                                  ? 'bg-red-600 text-white border-red-500'
                                  : 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-slate-800/80 text-slate-300 border-slate-700/80 hover:bg-slate-700/60'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 3. Pitch Given */}
                    <div className="space-y-2 pt-2 border-t border-slate-800">
                      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                        3. Pitch Delivered <span className="text-indigo-400">*</span>
                      </label>
                      <select
                        value={pitchGiven}
                        onChange={(e) => setPitchGiven(e.target.value as PitchGiven)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                      >
                        <option value="">-- Select Pitch Delivered --</option>
                        <option value="Website + AI Receptionist">Website + AI Receptionist</option>
                        <option value="AI Receptionist Only">AI Receptionist Only</option>
                        <option value="Both">Both Services Offered</option>
                        <option value="General Intro Only">General Intro Only</option>
                      </select>
                    </div>

                    {/* 4. Objection Reason (Conditional on "Not Interested") */}
                    {callOutcome === 'Not Interested' && (
                      <div className="space-y-2 pt-2 border-t border-slate-800 p-3 rounded-xl bg-red-950/20 border-red-500/20">
                        <label className="block text-xs font-semibold uppercase tracking-wider text-red-300">
                          Primary Objection Reason <span className="text-red-400">*</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {[
                            'Too Expensive',
                            'Already Has a Solution',
                            'Not Decision Maker',
                            'No Budget',
                            'Doesn\'t See Value',
                            'Bad Timing',
                            'Other',
                          ].map((obj) => (
                            <button
                              key={obj}
                              type="button"
                              onClick={() => setObjectionReason(obj as ObjectionReason)}
                              className={`p-2.5 rounded-lg text-xs font-medium border text-left transition-all break-words leading-tight min-h-[44px] cursor-pointer ${
                                objectionReason === obj
                                  ? 'bg-red-600 text-white border-red-500'
                                  : 'bg-slate-800/90 text-slate-300 border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              {obj}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* 5. Follow-Up Toggle & Fields */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-indigo-400 shrink-0" />
                      <span>Schedule Follow-Up Task?</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => setHasFollowUp(!hasFollowUp)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer shrink-0 ${
                        hasFollowUp ? 'bg-indigo-600' : 'bg-slate-700'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          hasFollowUp ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                  </div>

                  {hasFollowUp && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700">
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Date & Time</label>
                        <input
                          type="datetime-local"
                          value={followupAt}
                          onChange={(e) => setFollowupAt(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-400 mb-1">Method</label>
                        <select
                          value={followupMethod}
                          onChange={(e) => setFollowupMethod(e.target.value as FollowUpMethod)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                        >
                          <option value="Call">Call Back</option>
                          <option value="Email">Send Email</option>
                          <option value="WhatsApp">WhatsApp</option>
                          <option value="Text">SMS / Text</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* 6. Optional Contact Info & Notes */}
                <div className="space-y-3 pt-3 border-t border-slate-800">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Contact Person (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. Dr. Smith / Mgr Sarah"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-400 mb-1">Contact Email (Optional)</label>
                      <input
                        type="email"
                        placeholder="e.g. info@clinic.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500 min-h-[44px]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">Notes / Call Summary (Optional)</label>
                    <textarea
                      rows={2}
                      placeholder="Free-text catch-all for key details..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>

                {/* Submit Action */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3.5 sm:py-4 px-4 sm:px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-sm sm:text-base shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50 min-h-[48px]"
                >
                  {submitting ? (
                    <span>Saving Outcome...</span>
                  ) : (
                    <>
                      <span>Save Outcome & Load Next Lead</span>
                      <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                    </>
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
