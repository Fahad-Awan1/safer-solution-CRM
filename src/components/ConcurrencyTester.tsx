import React, { useState } from 'react';
import { apiFetch } from '../lib/api';
import { Zap, CheckCircle2, ShieldAlert, Play, RefreshCw, Cpu, ShieldCheck } from 'lucide-react';

export const ConcurrencyTester: React.FC = () => {
  const [concurrentCount, setConcurrentCount] = useState<number>(20);
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRunBenchmark = async () => {
    setTesting(true);
    setReport(null);
    setErrorMsg(null);

    try {
      const res = await apiFetch('/api/concurrency-test', {
        method: 'POST',
        body: JSON.stringify({ concurrentRequestsCount: concurrentCount }),
      });
      setReport(res);
    } catch (err: any) {
      setErrorMsg(err.message || 'Concurrency benchmark failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <div className="border-b border-slate-800 pb-4">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2">
          <Zap className="w-6 h-6 text-amber-400" />
          <span>Atomic Lead Reservation Concurrency Benchmark</span>
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Server-side stress test simulating simultaneous requests firing at the exact same millisecond to prove 0 lead collisions.
        </p>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5 shadow-xl">
        <div className="grid md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Simultaneous Caller Requests Count
            </label>
            <select
              value={concurrentCount}
              onChange={(e) => setConcurrentCount(Number(e.target.value))}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-sm text-white focus:ring-2 focus:ring-indigo-500"
            >
              <option value={10}>10 Simultaneous Requests</option>
              <option value={20}>20 Simultaneous Requests</option>
              <option value={30}>30 Simultaneous Requests</option>
              <option value={50}>50 Simultaneous Requests</option>
            </select>
          </div>

          <button
            onClick={handleRunBenchmark}
            disabled={testing}
            className="py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-extrabold text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
          >
            {testing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Simulating Race Conditions...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Run Concurrency Test</span>
              </>
            )}
          </button>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
            {errorMsg}
          </div>
        )}

        {report && (
          <div className="space-y-4 pt-4 border-t border-slate-800">
            <div
              className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                report.testPassed
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                  : 'bg-red-950/40 border-red-500/40 text-red-200'
              }`}
            >
              <div className="flex items-center space-x-3">
                {report.testPassed ? (
                  <ShieldCheck className="w-8 h-8 text-emerald-400 shrink-0" />
                ) : (
                  <ShieldAlert className="w-8 h-8 text-red-400 shrink-0" />
                )}
                <div>
                  <div className="text-lg font-extrabold">
                    {report.testPassed ? 'BENCHMARK PASSED — ZERO COLLISIONS DETECTED!' : 'FAIL: Lead Collisions Found'}
                  </div>
                  <div className="text-xs opacity-90">
                    {report.totalConcurrentRequests} simultaneous requests processed in {report.durationMs}ms with atomic Mutex lock protection.
                  </div>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 ${
                  report.testPassed ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-red-500/20 text-red-300'
                }`}
              >
                {report.testPassed ? 'PASS (100% Unique)' : 'FAIL'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              <div className="p-3.5 bg-slate-800 rounded-xl">
                <div className="text-xs text-slate-400">Total Dials Fired</div>
                <div className="text-xl font-bold text-white">{report.totalConcurrentRequests}</div>
              </div>
              <div className="p-3.5 bg-slate-800 rounded-xl">
                <div className="text-xs text-slate-400">Leads Assigned</div>
                <div className="text-xl font-bold text-indigo-400">{report.leadsAssigned}</div>
              </div>
              <div className="p-3.5 bg-slate-800 rounded-xl">
                <div className="text-xs text-slate-400">Collisions Detected</div>
                <div className="text-xl font-bold text-emerald-400">{report.collisionsDetected}</div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Simulated Request Audit Execution Stream:
              </div>
              <div className="max-h-52 overflow-y-auto space-y-1.5 font-mono text-[11px] bg-slate-950 p-3 rounded-xl border border-slate-800">
                {report.details.map((item: any, idx: number) => (
                  <div key={idx} className="text-slate-300 flex justify-between">
                    <span>Req #{item.reqIndex + 1} ({item.caller || 'Caller'}):</span>
                    {item.success ? (
                      <span className="text-emerald-400">Lock Acquired → Reserved Lead: {item.reservedLeadId}</span>
                    ) : (
                      <span className="text-amber-400">Lock Acquired → Queue Exhausted safely</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
