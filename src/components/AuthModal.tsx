'use client';

import React, { useState } from 'react';
import { api } from '../lib/api-client';
import {
  X,
  Mail,
  KeyRound,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Bike,
  Phone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: any, token: string) => void;
}

type AuthMode = 'EMAIL' | 'RIDER';
type Step = 'IDENTITY' | 'OTP';

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [mode, setMode] = useState<AuthMode>('EMAIL');
  const [step, setStep] = useState<Step>('IDENTITY');
  const [email, setEmail] = useState<string>('alex.morgan@eatclub.in');
  const [phone, setPhone] = useState<string>('+919900011101');
  const [otp, setOtp] = useState<string>('');
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const resetToIdentity = () => {
    setStep('IDENTITY');
    setOtp('');
    setDemoCode(null);
    setErrorMsg(null);
  };

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setMode(next);
    resetToIdentity();
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (mode === 'RIDER') {
        const res = await api.riders.requestOtp(phone.trim());
        if (res?.demoOtp) {
          setDemoCode(res.demoOtp);
          setOtp(res.demoOtp);
        }
      } else {
        const res = await api.requestOtp(email);
        if (res.demoOtp) {
          setDemoCode(res.demoOtp);
          // Auto-fill the OTP field in dev mode so user doesn't have to type it
          setOtp(res.demoOtp);
        }
      }
      setStep('OTP');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send OTP');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    try {
      if (mode === 'RIDER') {
        const res = await api.riders.verifyOtp(
          phone.trim(),
          otp || demoCode || '123456',
        );
        if (res.accessToken) {
          localStorage.setItem('eatclub_token', res.accessToken);
          // Rider tokens carry the Rider table id as `sub`; the storefront
          // user shape needs the role added explicitly.
          onSuccess({ ...res.rider, role: 'RIDER', email: '' }, res.accessToken);
          onClose();
        }
        return;
      }

      const res = await api.verifyOtp(email, otp || demoCode || '123456');
      if (res.accessToken) {
        localStorage.setItem('eatclub_token', res.accessToken);
        onSuccess(res.user, res.accessToken);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Invalid OTP code');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm">
                🍽️
              </div>
              <h2 className="text-lg font-black text-gray-900 dark:text-white">Sign In to CraveOS</h2>
            </div>
            <button onClick={onClose} className="p-1 rounded-full text-gray-400 hover:text-gray-900">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Email accounts cover customers + every staff console. Riders live in
              a separate table and sign in with their phone. */}
          <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-gray-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => switchMode('EMAIL')}
              className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'EMAIL'
                  ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Email / Staff
            </button>
            <button
              type="button"
              onClick={() => switchMode('RIDER')}
              className={`py-2 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 transition-all ${
                mode === 'RIDER'
                  ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400'
              }`}
            >
              <Bike className="w-3.5 h-3.5" />
              Delivery Rider
            </button>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {step === 'IDENTITY' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              {mode === 'EMAIL' ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Staff: use the email created by a super admin (for example
                    finance.admin@eatclub.in).
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    Rider Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+919900011101"
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-semibold focus:outline-none focus:border-rose-500"
                    />
                  </div>
                  <p className="text-[10px] text-gray-400">
                    Use the number registered with the fleet desk. New numbers are
                    created as pending KYC.
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{isLoading ? 'Sending OTP...' : 'Continue with OTP'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-700 dark:text-slate-300">
                    Enter 6-Digit OTP
                  </label>
                  <button
                    type="button"
                    onClick={resetToIdentity}
                    className="text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:underline"
                  >
                    {mode === 'RIDER' ? 'Change Number' : 'Change Email'}
                  </button>
                </div>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-gray-400 absolute left-3.5 top-3.5" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder={demoCode || '123456'}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-sm font-bold tracking-widest focus:outline-none focus:border-rose-500"
                  />
                </div>
                {demoCode && (
                  <div className="mt-2 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      <span className="text-[11px] font-semibold">Dev OTP auto-filled:</span>
                      <strong className="text-sm tracking-widest font-black">{demoCode}</strong>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOtp(demoCode)}
                      className="text-[10px] font-extrabold text-emerald-700 dark:text-emerald-300 underline hover:no-underline shrink-0"
                    >
                      Re-fill
                    </button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-sm shadow-lg shadow-rose-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span>{isLoading ? 'Verifying...' : 'Verify & Sign In'}</span>
                <ShieldCheck className="w-4 h-4" />
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
