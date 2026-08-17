import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { apiFetch } from '../lib/api';
import { ImportValidationResult, ImportedBatch, User as UserType } from '../types';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Download,
  ArrowRight,
  RefreshCw,
  Database,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Save,
  X,
  ChevronDown,
  ChevronUp,
  Layers,
  Calendar,
  User,
  Users,
  Eye,
  EyeOff,
  ShieldCheck,
  Check,
  Lock,
  Globe,
  ShieldAlert,
} from 'lucide-react';

interface LeadImporterProps {
  onImportComplete?: () => void;
}

export const LeadImporter: React.FC<LeadImporterProps> = ({ onImportComplete }) => {
  const [csvText, setCsvText] = useState('');
  const [uploadedFileName, setUploadedFileName] = useState<string>('Uploaded_Leads_Batch.csv');
  const [validationResult, setValidationResult] = useState<ImportValidationResult | null>(null);
  const [validating, setValidating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Callers Roster State for Admin-Set Visibility
  const [callers, setCallers] = useState<UserType[]>([]);
  const [loadingCallers, setLoadingCallers] = useState<boolean>(true);
  const [visibilityType, setVisibilityType] = useState<'all' | 'specific'>('all');
  const [selectedCallerIds, setSelectedCallerIds] = useState<string[]>([]);

  // Uploaded Batches / Files state
  const [batches, setBatches] = useState<ImportedBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState<boolean>(true);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editFileNameText, setEditFileNameText] = useState<string>('');
  const [savingBatchId, setSavingBatchId] = useState<string | null>(null);

  // Batch Visibility Editing Modal / Inline State
  const [editingVisibilityBatchId, setEditingVisibilityBatchId] = useState<string | null>(null);
  const [editBatchCallerIds, setEditBatchCallerIds] = useState<string[]>([]);
  const [savingVisibilityBatchId, setSavingVisibilityBatchId] = useState<string | null>(null);

  const [deletingBatchId, setDeletingBatchId] = useState<string | null>(null);
  const [deletingBatch, setDeletingBatch] = useState<boolean>(false);
  const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null);

  const fetchBatches = async () => {
    try {
      setLoadingBatches(true);
      const data = await apiFetch<ImportedBatch[]>('/api/leads/batches');
      setBatches(data || []);
    } catch (err: any) {
      console.error('Failed to load lead batches:', err);
    } finally {
      setLoadingBatches(false);
    }
  };

  const fetchCallers = async () => {
    try {
      setLoadingCallers(true);
      const allUsers = await apiFetch<UserType[]>('/api/users');
      const callerUsers = allUsers.filter((u) => u.role === 'caller');
      setCallers(callerUsers);
    } catch (err: any) {
      console.error('Failed to load callers roster:', err);
    } finally {
      setLoadingCallers(false);
    }
  };

  useEffect(() => {
    fetchBatches();
    fetchCallers();
  }, []);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (text) {
        setCsvText(text);
        setValidationResult(null);
        setSuccessMsg(null);
        setErrorMsg(null);
      }
    };
    reader.readAsText(file);
  };

  const handleValidateCSV = async () => {
    if (!csvText.trim()) {
      setErrorMsg('Please paste CSV data or upload a file first.');
      return;
    }

    setValidating(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
      if (parsed.errors.length > 0 && parsed.data.length === 0) {
        throw new Error('Failed to parse CSV file structure.');
      }

      const res = await apiFetch<ImportValidationResult>('/api/leads/import/validate', {
        method: 'POST',
        body: JSON.stringify({ rows: parsed.data }),
      });

      setValidationResult(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'CSV validation failed.');
    } finally {
      setValidating(false);
    }
  };

  const handleToggleCallerSelection = (callerId: string) => {
    setSelectedCallerIds((prev) =>
      prev.includes(callerId) ? prev.filter((id) => id !== callerId) : [...prev, callerId]
    );
  };

  const handleSelectAllCallers = () => {
    setSelectedCallerIds(callers.map((c) => c.id));
  };

  const handleDeselectAllCallers = () => {
    setSelectedCallerIds([]);
  };

  const handleCommitImport = async () => {
    if (!validationResult || validationResult.valid_count === 0) {
      setErrorMsg('No valid leads available to import.');
      return;
    }

    if (visibilityType === 'specific' && selectedCallerIds.length === 0) {
      setErrorMsg('Please select at least one caller for visibility, or switch to All Callers.');
      return;
    }

    setCommitting(true);
    setErrorMsg(null);

    try {
      const rowsToCommit = (validationResult as any).valid_rows || validationResult.sample_valid_rows;
      const res = await apiFetch<{ success: boolean; importedCount: number }>('/api/leads/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          rows: rowsToCommit,
          fileName: uploadedFileName || 'Uploaded_Leads_Batch.csv',
          allowed_caller_ids: visibilityType === 'specific' ? selectedCallerIds : [],
        }),
      });

      const visibilityNote =
        visibilityType === 'specific'
          ? ` (Visible to ${selectedCallerIds.length} designated caller${selectedCallerIds.length > 1 ? 's' : ''})`
          : ' (Visible to All Callers)';

      setSuccessMsg(`Successfully imported ${res.importedCount} business leads into queue!${visibilityNote}`);
      setValidationResult(null);
      setCsvText('');
      fetchBatches();
      if (onImportComplete) onImportComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to commit lead import.');
    } finally {
      setCommitting(false);
    }
  };

  const handleStartRename = (batch: ImportedBatch) => {
    setEditingBatchId(batch.id);
    setEditFileNameText(batch.file_name);
  };

  const handleSaveRename = async (batchId: string) => {
    if (!editFileNameText.trim()) return;
    setSavingBatchId(batchId);
    try {
      await apiFetch(`/api/leads/batches/${batchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ file_name: editFileNameText.trim() }),
      });
      setEditingBatchId(null);
      fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to rename file batch.');
    } finally {
      setSavingBatchId(null);
    }
  };

  const handleOpenVisibilityModal = (batch: ImportedBatch) => {
    setEditingVisibilityBatchId(batch.id);
    let allowed: string[] = [];
    if (Array.isArray(batch.allowed_caller_ids)) {
      allowed = batch.allowed_caller_ids;
    } else if (typeof batch.allowed_caller_ids === 'string') {
      try { allowed = JSON.parse(batch.allowed_caller_ids); } catch { allowed = []; }
    }
    setEditBatchCallerIds(allowed);
  };

  const handleToggleEditBatchCaller = (callerId: string) => {
    setEditBatchCallerIds((prev) =>
      prev.includes(callerId) ? prev.filter((id) => id !== callerId) : [...prev, callerId]
    );
  };

  const handleSaveBatchVisibility = async (batchId: string) => {
    setSavingVisibilityBatchId(batchId);
    try {
      await apiFetch(`/api/leads/batches/${batchId}`, {
        method: 'PATCH',
        body: JSON.stringify({ allowed_caller_ids: editBatchCallerIds }),
      });
      setSuccessMsg('Successfully updated lead batch visibility permissions.');
      setEditingVisibilityBatchId(null);
      fetchBatches();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to update batch visibility.');
    } finally {
      setSavingVisibilityBatchId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingBatchId) return;
    setDeletingBatch(true);
    try {
      await apiFetch(`/api/leads/batches/${deletingBatchId}`, {
        method: 'DELETE',
      });
      setSuccessMsg('Successfully deleted lead file batch and associated CRM records.');
      setDeletingBatchId(null);
      fetchBatches();
      if (onImportComplete) onImportComplete();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to delete file batch.');
    } finally {
      setDeletingBatch(false);
    }
  };

  const handleDownloadSampleTemplate = () => {
    const sampleCsv = `Business Name,Phone Number,Has Website,Industry,Address,City,State,Zip Code
Metro Dental Studio,(555) 123-4567,false,Dental Clinic,100 North Blvd Suite 10,Austin,TX,78701
Prestige Barber Shop,(555) 234-5678,https://prestigebarber.com,Barber Shop / Salon,45 Main Street,Miami,FL,33101
Tuscan Grill Restaurant,(555) 345-6789,NO_WEBSITE,Restaurant / Dining,88 River Road,Chicago,IL,60601
Summit Auto Repair,(555) 456-7890,no,Auto Repair,500 Industrial Pkwy,Denver,CO,80202`;

    const blob = new Blob([sampleCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'crm_lead_import_template.csv';
    a.click();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      {/* Header Bar */}
      <div className="border-b border-slate-800 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
            <Upload className="w-6 h-6 text-indigo-400" />
            <span>Bulk Lead Import Engine</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Import business CSV files with strict validation, manage uploaded files, edit batch names, or remove lead files.
          </p>
        </div>

        <button
          onClick={handleDownloadSampleTemplate}
          className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-semibold transition-colors cursor-pointer border border-slate-700"
        >
          <Download className="w-4 h-4 text-indigo-400" />
          <span>Download CSV Template</span>
        </button>
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* SECTION 1: CSV Upload & Commit Engine */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
          <span>Upload New Lead File / CSV</span>
        </h2>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Option 1: Choose CSV File
            </label>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileUpload}
              className="w-full text-xs text-slate-400 bg-slate-800 border border-slate-700 rounded-xl p-3 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              File / Batch Identifier Name
            </label>
            <input
              type="text"
              value={uploadedFileName}
              onChange={(e) => setUploadedFileName(e.target.value)}
              placeholder="e.g. Dental_Leads_Austin_Q3.csv"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-semibold text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
            Option 2: Or Paste Raw CSV Data
          </label>
          <textarea
            rows={4}
            placeholder="Business Name, Phone Number, Has Website, Industry, Address..."
            value={csvText}
            onChange={(e) => {
              setCsvText(e.target.value);
              setValidationResult(null);
            }}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-mono text-slate-200 focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* SECTION 1.5: Admin Caller Visibility Controls */}
        <div className="p-4 rounded-xl bg-slate-950/60 border border-indigo-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-indigo-300 font-bold text-sm">
              <Users className="w-4 h-4 text-indigo-400" />
              <span>Caller Visibility & Queue Access Settings</span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Admin Restricted Access Mode
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setVisibilityType('all');
                setSelectedCallerIds([]);
              }}
              className={`p-3 rounded-xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                visibilityType === 'all'
                  ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:border-slate-600'
              }`}
            >
              <Eye className={`w-5 h-5 mt-0.5 shrink-0 ${visibilityType === 'all' ? 'text-indigo-400' : 'text-slate-500'}`} />
              <div>
                <div className="text-xs font-bold text-white">All Callers (Global Access)</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Leads will be available to all active callers in your organization's queue.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setVisibilityType('specific');
                if (selectedCallerIds.length === 0 && callers.length > 0) {
                  setSelectedCallerIds([callers[0].id]);
                }
              }}
              className={`p-3 rounded-xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                visibilityType === 'specific'
                  ? 'bg-indigo-600/15 border-indigo-500 text-white shadow-md'
                  : 'bg-slate-800/60 border-slate-700/80 text-slate-400 hover:border-slate-600'
              }`}
            >
              <ShieldCheck className={`w-5 h-5 mt-0.5 shrink-0 ${visibilityType === 'specific' ? 'text-indigo-400' : 'text-slate-500'}`} />
              <div>
                <div className="text-xs font-bold text-white">Restrict to Specific Callers</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  Only selected callers will be able to see & call leads from this import.
                </div>
              </div>
            </button>
          </div>

          {/* Caller Multi-Select List */}
          {visibilityType === 'specific' && (
            <div className="mt-3 p-3.5 rounded-xl bg-slate-900 border border-slate-800 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-300">
                  Select Authorized Callers ({selectedCallerIds.length} Selected):
                </span>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={handleSelectAllCallers}
                    className="text-[11px] font-semibold text-indigo-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllCallers}
                    className="text-[11px] font-semibold text-slate-400 hover:underline cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              {loadingCallers ? (
                <div className="text-xs text-slate-400 py-2 flex items-center space-x-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Loading callers list...</span>
                </div>
              ) : callers.length === 0 ? (
                <div className="text-xs text-amber-400 italic py-1">
                  No registered users with the "caller" role found in this organization.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 max-h-40 overflow-y-auto pr-1">
                  {callers.map((caller) => {
                    const isChecked = selectedCallerIds.includes(caller.id);
                    return (
                      <div
                        key={caller.id}
                        onClick={() => handleToggleCallerSelection(caller.id)}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-indigo-600/20 border-indigo-500/80 text-white'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isChecked ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {caller.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold truncate">{caller.name}</span>
                        </div>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                          isChecked ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 bg-slate-900'
                        }`}>
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <button
          onClick={handleValidateCSV}
          disabled={validating || !csvText.trim()}
          className="w-full py-3.5 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          {validating ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Validating CSV Rows...</span>
            </>
          ) : (
            <>
              <FileText className="w-4 h-4" />
              <span>Validate CSV Data Pre-Commit</span>
            </>
          )}
        </button>
      </div>

      {/* Pre-Commit Validation Report Section */}
      {validationResult && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-lg font-bold text-white flex items-center space-x-2">
              <Database className="w-5 h-5 text-indigo-400" />
              <span>Pre-Commit Validation Report</span>
            </h3>

            {validationResult.invalid_count === 0 ? (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                100% Clean — Ready to Commit
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-500/10 text-red-400 border border-red-500/30">
                {validationResult.invalid_count} Invalid Row(s) Detected
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3 text-center">
            <div className="p-3 bg-slate-800 rounded-xl">
              <div className="text-xs text-slate-400">Total Rows</div>
              <div className="text-xl font-bold text-white">{validationResult.total_rows}</div>
            </div>
            <div className="p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-xl">
              <div className="text-xs text-emerald-400">Valid Rows</div>
              <div className="text-xl font-bold text-emerald-400">{validationResult.valid_count}</div>
            </div>
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl">
              <div className="text-xs text-red-400">Errors Found</div>
              <div className="text-xl font-bold text-red-400">{validationResult.errors.length}</div>
            </div>
          </div>

          {/* Sample Mapped Leads Preview */}
          {validationResult.sample_valid_rows && validationResult.sample_valid_rows.length > 0 && (
            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Sample Normalized Records Preview ({validationResult.valid_count} Total Ready):
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {validationResult.sample_valid_rows.map((row: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs text-slate-200 flex flex-wrap justify-between items-center gap-2">
                    <div>
                      <strong className="text-white text-sm">{row.name}</strong>
                      <span className="text-slate-400 ml-2">Phone: {row.phone}</span>
                      {(row.address || row.zip) && (
                        <div className="text-[11px] text-slate-400 mt-1 flex items-center space-x-1.5">
                          <span className="text-slate-500 font-semibold">📍 Location:</span>
                          <span className="text-slate-200 font-medium">{row.address !== 'N/A' ? row.address : ''}{row.city ? `, ${row.city}` : ''}{row.state ? `, ${row.state}` : ''}</span>
                          {row.zip && (
                            <span className="px-1.5 py-0.2 bg-indigo-500/20 text-indigo-300 font-mono font-bold rounded text-[10px] border border-indigo-500/30">
                              ZIP: {row.zip}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                        {row.industry}
                      </span>
                      {row.has_website ? (
                        <span className="text-emerald-400 text-[11px]">Website: {row.website_url || 'Yes'}</span>
                      ) : (
                        <span className="text-red-400 text-[11px]">No Website</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Commit Action */}
          {validationResult.valid_count > 0 && (
            <button
              onClick={handleCommitImport}
              disabled={committing}
              className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 text-white font-bold text-base shadow-lg shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              {committing ? (
                <span>Importing Leads into CRM Queue...</span>
              ) : (
                <>
                  <span>Commit {validationResult.valid_count} Validated Leads to CRM Queue</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* SECTION 2: Already Uploaded Lead Files & Batches Section */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Layers className="w-5 h-5 text-indigo-400" />
              <span>Uploaded Files & Lead Batches</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              View uploaded lead files, edit file names, or delete entire batches from the CRM queue.
            </p>
          </div>

          <button
            onClick={fetchBatches}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            title="Refresh Uploaded Batches"
          >
            <RefreshCw className={`w-4 h-4 ${loadingBatches ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {loadingBatches ? (
          <div className="py-8 text-center text-slate-400 text-sm flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Loading uploaded file batches...</span>
          </div>
        ) : batches.length === 0 ? (
          <div className="py-8 text-center text-slate-500 text-sm border-2 border-dashed border-slate-800 rounded-xl">
            No uploaded lead files found. Upload a CSV file above to populate lead batches.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Visibility Status Summary Banner */}
            {(() => {
              const restrictedBatches = batches.filter((b) => {
                let ids = b.allowed_caller_ids;
                if (typeof ids === 'string') {
                  try { ids = JSON.parse(ids); } catch { ids = []; }
                }
                return Array.isArray(ids) && ids.length > 0;
              });
              const globalBatchesCount = batches.length - restrictedBatches.length;

              return (
                <div className="p-3 bg-slate-950/80 border border-slate-800 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center space-x-3 flex-wrap gap-y-1">
                    <span className="font-semibold text-slate-300">Batch Visibility Overview:</span>
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-300 border border-amber-500/30 font-bold">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>{restrictedBatches.length} Restricted Batch{restrictedBatches.length !== 1 ? 'es' : ''}</span>
                    </span>
                    <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                      <Globe className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{globalBatchesCount} Global Batch{globalBatchesCount !== 1 ? 'es' : ''}</span>
                    </span>
                  </div>
                  <span className="text-slate-400 text-[11px]">
                    Non-admin callers only see leads in Global batches or batches explicitly assigned to them.
                  </span>
                </div>
              );
            })()}

            {batches.map((batch) => {
              const isEditing = editingBatchId === batch.id;
              const isExpanded = expandedBatchId === batch.id;

              let allowedArr: string[] = [];
              if (Array.isArray(batch.allowed_caller_ids)) {
                allowedArr = batch.allowed_caller_ids;
              } else if (typeof batch.allowed_caller_ids === 'string') {
                try { allowedArr = JSON.parse(batch.allowed_caller_ids); } catch { allowedArr = []; }
              }

              const isRestricted = allowedArr && allowedArr.length > 0;

              return (
                <div
                  key={batch.id}
                  className={`border rounded-xl p-4 space-y-3 transition-all ${
                    isRestricted
                      ? 'bg-amber-950/10 border-amber-500/30 hover:border-amber-500/50 shadow-sm shadow-amber-950/20'
                      : 'bg-emerald-950/10 border-emerald-500/20 hover:border-emerald-500/40 shadow-sm shadow-emerald-950/20'
                  }`}
                >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    {/* File Name & Editing Controls */}
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <div
                        className={`p-2.5 rounded-xl border shrink-0 ${
                          isRestricted
                            ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        }`}
                      >
                        {isRestricted ? <Lock className="w-5 h-5" /> : <FileSpreadsheet className="w-5 h-5" />}
                      </div>

                      <div className="flex-1 min-w-0">
                        {isEditing ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="text"
                              value={editFileNameText}
                              onChange={(e) => setEditFileNameText(e.target.value)}
                              className="bg-slate-900 border border-indigo-500 rounded-lg px-3 py-1.5 text-sm text-white font-semibold w-full focus:outline-none"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveRename(batch.id)}
                              disabled={savingBatchId === batch.id}
                              className="p-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
                              title="Save Name"
                            >
                              <Save className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => setEditingBatchId(null)}
                              className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white text-base truncate">{batch.file_name}</span>
                            <button
                              onClick={() => handleStartRename(batch)}
                              className="p-1 text-slate-400 hover:text-indigo-400 transition-colors"
                              title="Edit File Name"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center space-x-4 text-xs text-slate-400 mt-1 flex-wrap gap-y-1">
                          <span className="flex items-center space-x-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <span>{new Date(batch.created_at).toLocaleDateString()}</span>
                          </span>
                          <span className="flex items-center space-x-1">
                            <User className="w-3.5 h-3.5 text-slate-500" />
                            <span>{batch.imported_by_name}</span>
                          </span>

                          {/* Prominent Visibility Indicator Badge */}
                          {!isRestricted ? (
                            <span className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold">
                              <Globe className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                              <span>🌐 Global Access (Visible to All Callers)</span>
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/40 text-[11px] font-bold"
                              title={`Restricted to: ${allowedArr
                                .map((id) => callers.find((c) => c.id === id)?.name || id)
                                .join(', ')}`}
                            >
                              <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                🔒 Restricted ({allowedArr.length} Caller{allowedArr.length > 1 ? 's' : ''}:{' '}
                                {allowedArr
                                  .map((id) => callers.find((c) => c.id === id)?.name || id)
                                  .join(', ')}
                                )
                              </span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Stats & Actions */}
                    <div className="flex items-center space-x-2 shrink-0 flex-wrap gap-y-2">
                      <div className="flex items-center space-x-2 bg-slate-900/80 px-3 py-1.5 rounded-lg border border-slate-700 text-xs">
                        <span className="text-slate-400">Total Leads:</span>
                        <span className="font-bold text-white">{batch.total_leads}</span>
                        {batch.unassigned_count !== undefined && (
                          <span className="text-amber-400 text-[11px] font-medium ml-1">
                            ({batch.unassigned_count} Queued)
                          </span>
                        )}
                      </div>

                      {/* Edit Visibility Permission Button */}
                      <button
                        onClick={() => handleOpenVisibilityModal(batch)}
                        className="p-2 rounded-lg bg-indigo-600/15 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                        title="Manage Caller Visibility Permissions"
                      >
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                        <span className="hidden sm:inline">Set Visibility</span>
                      </button>

                      <button
                        onClick={() => setExpandedBatchId(isExpanded ? null : batch.id)}
                        className="p-2 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center space-x-1 transition-colors cursor-pointer"
                      >
                        <span>{isExpanded ? 'Hide Sample' : 'View Sample'}</span>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      <button
                        onClick={() => setDeletingBatchId(batch.id)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-colors cursor-pointer"
                        title="Delete File Batch & Leads"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Sample Business Rows in Batch */}
                  {isExpanded && batch.sample_businesses && batch.sample_businesses.length > 0 && (
                    <div className="pt-2 border-t border-slate-700/60 space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                        Sample Leads in File Batch ({batch.sample_businesses.length} of {batch.total_leads}):
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {batch.sample_businesses.map((biz) => (
                          <div
                            key={biz.id}
                            className="p-2.5 rounded-lg bg-slate-900/60 border border-slate-800 text-xs text-slate-300 flex justify-between items-center"
                          >
                            <div>
                              <div className="font-semibold text-white">{biz.name}</div>
                              <div className="text-slate-400 text-[11px]">{biz.phone}</div>
                            </div>
                            <div className="text-right">
                              <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">
                                {biz.industry}
                              </span>
                              {biz.has_website && biz.website_url ? (
                                <div className="text-[10px] text-indigo-400 truncate max-w-[120px]">{biz.website_url}</div>
                              ) : (
                                <div className="text-[10px] text-red-400">No Website</div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit Batch Visibility Modal */}
      {editingVisibilityBatchId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-lg w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2 text-indigo-400">
                <ShieldCheck className="w-5 h-5" />
                <h3 className="text-lg font-bold text-white">Lead Batch Access & Visibility</h3>
              </div>
              <button
                onClick={() => setEditingVisibilityBatchId(null)}
                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed bg-slate-800/60 p-3 rounded-xl border border-slate-700/60">
              <span className="font-bold text-amber-300 block mb-1">How Caller Visibility Works:</span>
              • <strong>Checked Callers (✓):</strong> ONLY these selected callers will be allowed to see, queue, and draw calls from this batch.<br />
              • <strong>Unchecked Callers:</strong> Will be strictly <strong>hidden & blocked</strong> from drawing calls or seeing leads in this batch.<br />
              • <strong>No Callers Selected / Allow All:</strong> Clears restrictions so <strong>all callers</strong> in your organization can access this batch.
            </p>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-200">
                  Allowed Callers ({editBatchCallerIds.length === 0 ? 'All Callers Allowed' : `${editBatchCallerIds.length} Caller(s) Selected`}):
                </span>
                <div className="space-x-2">
                  <button
                    type="button"
                    onClick={() => setEditBatchCallerIds(callers.map((c) => c.id))}
                    className="text-[11px] font-semibold text-indigo-400 hover:underline cursor-pointer"
                  >
                    Select All
                  </button>
                  <span className="text-slate-600">|</span>
                  <button
                    type="button"
                    onClick={() => setEditBatchCallerIds([])}
                    className="text-[11px] font-semibold text-slate-400 hover:underline cursor-pointer"
                  >
                    Allow All (Clear Restrictions)
                  </button>
                </div>
              </div>

              {callers.length === 0 ? (
                <div className="text-xs text-amber-400 italic py-2">
                  No active caller accounts found in your organization roster.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
                  {callers.map((caller) => {
                    const isChecked = editBatchCallerIds.includes(caller.id);
                    return (
                      <div
                        key={caller.id}
                        onClick={() => handleToggleEditBatchCaller(caller.id)}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-indigo-600/20 border-indigo-500/80 text-white'
                            : 'bg-slate-800/40 border-slate-700/60 text-slate-400 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center space-x-2 truncate">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            isChecked ? 'bg-indigo-500 text-white' : 'bg-slate-700 text-slate-300'
                          }`}>
                            {caller.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold truncate">{caller.name}</span>
                        </div>
                        <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                          isChecked ? 'bg-indigo-600 border-indigo-500 text-white' : 'border-slate-600 bg-slate-900'
                        }`}>
                          {isChecked && <Check className="w-3 h-3" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setEditingVisibilityBatchId(null)}
                disabled={savingVisibilityBatchId === editingVisibilityBatchId}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleSaveBatchVisibility(editingVisibilityBatchId)}
                disabled={savingVisibilityBatchId === editingVisibilityBatchId}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {savingVisibilityBatchId === editingVisibilityBatchId ? (
                  <span>Saving Permissions...</span>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Save Visibility Settings</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBatchId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-red-500/30 rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center space-x-3 text-red-400">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-lg font-bold text-white">Delete Lead File Batch?</h3>
            </div>

            <p className="text-sm text-slate-300">
              Are you sure you want to delete this uploaded lead file? This action will permanently remove all associated business leads and call queue entries for this file.
            </p>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                onClick={() => setDeletingBatchId(null)}
                disabled={deletingBatch}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deletingBatch}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/20 flex items-center space-x-2 cursor-pointer disabled:opacity-50"
              >
                {deletingBatch ? (
                  <span>Deleting Batch...</span>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Permanently</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
