// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

type SessionStatus = 'loading' | 'ready' | 'invalid';

const ResetPasswordPage = () => {
  const [status, setStatus] = React.useState<SessionStatus>('loading');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [updating, setUpdating] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);

  const router = useRouter();
  const brandDarkRed = '#701e1e';

  React.useEffect(() => {
    const initializeRecoverySession = async () => {
      setError('');

      if (typeof window === 'undefined') {
        return;
      }

      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      const params = new URLSearchParams(hash);
      const type = params.get('type');
      const access_token = params.get('access_token');
      const refresh_token = params.get('refresh_token');

      if (type !== 'recovery') {
        setStatus('invalid');
        setError('This password reset link is invalid. Please request a new recovery email.');
        return;
      }

      if (!access_token || !refresh_token) {
        setStatus('invalid');
        setError('This password reset link is incomplete or expired. Please request a new one.');
        return;
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

      if (sessionError) {
        setStatus('invalid');
        setError(sessionError.message || 'Unable to verify your recovery link. Please request a new one.');
        return;
      }

      setStatus('ready');
    };

    void initializeRecoverySession();
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const trimmedPassword = password.trim();
    const trimmedConfirmPassword = confirmPassword.trim();

    if (trimmedPassword.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setUpdating(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password: trimmedPassword,
      });

      if (updateError) {
        setError(updateError.message || 'Could not update password. The link may be expired.');
        return;
      }

      setSuccess('Your password has been updated successfully. Redirecting you to login...');
      setPassword('');
      setConfirmPassword('');

      setTimeout(async () => {
        await supabase.auth.signOut();
        router.push('/login');
      }, 1800);
    } catch (err) {
      console.error('Reset password error:', err);
      setError('An unexpected error occurred while updating your password. Please try again.');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFEBDD] px-6 py-10 sm:px-8 lg:px-12">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-xl items-center">
        <motion.div
          className="w-full"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="mb-10 text-center">
            <span className="inline-flex items-center justify-center rounded-full bg-[#8B2424]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#8B2424]">
              Account Recovery
            </span>
            <h1 className="mt-6 text-4xl lg:text-5xl font-heading font-semibold text-deep-red" style={{ color: brandDarkRed }}>
              Reset Password
            </h1>
            <p className="mt-3 text-base text-[#701E1E]/80">Set a new secure password for your account.</p>
          </div>

          <motion.form
            onSubmit={handleUpdatePassword}
            className="space-y-6 rounded-3xl border border-[#e5e4e3] bg-[#FFFDFB] p-8 shadow-[0_20px_45px_-20px_rgba(112,30,30,0.45)]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            {status === 'loading' && (
              <div className="rounded-xl border border-[#E5E4E3] bg-[#FFF9F4] p-4 text-sm font-medium text-[#8B2424]">
                Verifying your recovery link...
              </div>
            )}

            {status === 'invalid' && (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#F5A3A3] bg-[#FDECEC] p-4 text-sm font-medium text-[#8B2424]">{error}</div>
                <Link
                  href="/login"
                  className="inline-flex w-full items-center justify-center rounded-xl bg-[#701E1E] px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:bg-[#8B2424]"
                >
                  Back to Login
                </Link>
              </div>
            )}

            {status === 'ready' && (
              <>
                <div>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8B2424]">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Enter new password"
                      className="w-full rounded-xl border border-[#e5e4e3] bg-[#f2f2f2] px-4 py-3 pr-12 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 transform text-[#8B2424]/60 transition-colors hover:text-[#701E1E]"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8B2424]">Confirm Password</label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      placeholder="Confirm new password"
                      className="w-full rounded-xl border border-[#e5e4e3] bg-[#f2f2f2] px-4 py-3 pr-12 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      className="absolute right-3 top-1/2 -translate-y-1/2 transform text-[#8B2424]/60 transition-colors hover:text-[#701E1E]"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                  <p className="mt-2 text-xs text-[#8B2424]/70">Password must be at least 8 characters.</p>
                </div>

                {error && <div className="rounded-xl border border-[#F5A3A3] bg-[#FDECEC] p-4 text-sm font-medium text-[#8B2424]">{error}</div>}
                {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">{success}</div>}

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#701E1E] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#8B2424] hover:shadow-[0_20px_40px_-20px_rgba(112,30,30,0.65)] disabled:cursor-not-allowed disabled:bg-[#701E1E]/60 disabled:shadow-none"
                  disabled={updating}
                >
                  {updating ? (
                    <div className="flex items-center justify-center text-[#FFFDFB]">
                      <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                      Updating password...
                    </div>
                  ) : (
                    <div className="flex items-center justify-center text-[#FFFDFB]">
                      <KeyRound size={18} className="mr-2 text-[#FFFDFB]" />
                      Set New Password
                    </div>
                  )}
                </button>

                <p className="text-center text-xs font-medium uppercase tracking-[0.2em] text-[#000000]/80">
                  Recovery links can expire. Request a new one if needed.
                </p>
              </>
            )}
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
