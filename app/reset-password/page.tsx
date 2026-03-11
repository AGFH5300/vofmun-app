// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import supabase from '@/lib/supabase';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

type SessionStatus = 'verifying' | 'ready' | 'invalid';
type RecoveryFlowType = 'recovery' | 'invite';

const withTimeout = async <T,>(operation: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> => {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) => {
      window.setTimeout(() => {
        reject(new Error(timeoutMessage));
      }, timeoutMs);
    }),
  ]);
};

const ResetPasswordPage = () => {
  const [status, setStatus] = React.useState<SessionStatus>('verifying');
  const [password, setPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [error, setError] = React.useState('');
  const [success, setSuccess] = React.useState('');
  const [updating, setUpdating] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [flowType, setFlowType] = React.useState<RecoveryFlowType>('recovery');

  const router = useRouter();
  const brandDarkRed = '#701e1e';

  React.useEffect(() => {
    let mounted = true;
    let hasResolvedSession = false;

    const verifySession = async (source: string) => {
      const { data, error: sessionError } = await supabase.auth.getSession();

      if (!mounted || hasResolvedSession) {
        return;
      }

      if (sessionError) {
        console.debug('[ResetPasswordDebug] getSession:error', {
          source,
          message: sessionError.message,
        });
        return;
      }

      const hasSession = Boolean(data.session);
      console.debug('[ResetPasswordDebug] getSession:result', {
        source,
        hasSession,
      });

      if (hasSession) {
        hasResolvedSession = true;
        setStatus('ready');
        setError('');
      }
    };

    const initializeRecoverySession = async () => {
      setError('');

      if (typeof window === 'undefined') {
        return;
      }

      const hash = window.location.hash.startsWith('#') ? window.location.hash.slice(1) : window.location.hash;
      const hashParams = new URLSearchParams(hash);
      const searchParams = new URLSearchParams(window.location.search);

      const type = (hashParams.get('type') ?? searchParams.get('type')) as RecoveryFlowType | null;
      const access_token = hashParams.get('access_token') ?? searchParams.get('access_token');
      const refresh_token = hashParams.get('refresh_token') ?? searchParams.get('refresh_token');
      const code = searchParams.get('code');

      const isRecoveryOrInvite = type === 'recovery' || type === 'invite';
      console.debug('[ResetPasswordDebug] flow:detected', {
        type,
        isRecoveryOrInvite,
        hasCode: Boolean(code),
      });

      if (isRecoveryOrInvite) {
        setFlowType(type);
      }

      if (code) {
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

        if (!mounted) {
          return;
        }

        if (exchangeError) {
          setStatus('invalid');
          setError(exchangeError.message || 'Unable to verify your recovery link. Please request a new one.');
          return;
        }

        await verifySession('exchangeCodeForSession');
        return;
      }

      if (!isRecoveryOrInvite) {
        setStatus('invalid');
        setError('This password setup link is invalid. Please request a new password link.');
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

      if (!mounted) {
        return;
      }

      if (sessionError) {
        setStatus('invalid');
        setError(sessionError.message || 'Unable to verify your password setup link. Please request a new one.');
        return;
      }

      await verifySession('setSession');
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.debug('[ResetPasswordDebug] auth_event', {
        event,
        hasSession: Boolean(session),
      });

      if (!mounted || hasResolvedSession) {
        return;
      }

      if (session) {
        hasResolvedSession = true;
        setStatus('ready');
        setError('');
      }
    });

    const timeoutId = window.setTimeout(() => {
      if (!mounted || hasResolvedSession) {
        return;
      }

      console.debug('[ResetPasswordDebug] verify:timeout_fired', {
        timeoutMs: 10000,
      });
      setStatus('invalid');
      setError('We could not verify your activation/reset session in time. Please request a new link and try again.');
    }, 10000);

    void initializeRecoverySession();
    void verifySession('initial_mount');

    return () => {
      mounted = false;
      window.clearTimeout(timeoutId);
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (updating) {
      console.debug('[ResetPasswordDebug] submit:ignored_duplicate', {
        flowType,
      });
      return;
    }

    console.debug('[ResetPasswordDebug] submit:start', {
      flowType,
      updatingBeforeSubmit: updating,
    });
    setError('');
    setSuccess('');

    const { data: sessionBeforeSubmit } = await supabase.auth.getSession();
    console.debug('[ResetPasswordDebug] submit:session_state', {
      flowType,
      hasSessionBeforeSubmit: Boolean(sessionBeforeSubmit.session),
    });

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

    console.debug('[ResetPasswordDebug] submit:validation_passed', {
      flowType,
      passwordLength: trimmedPassword.length,
    });

    console.debug('[ResetPasswordDebug] submit:updating_state', {
      flowType,
      nextUpdatingState: true,
    });
    setUpdating(true);

    try {
      console.debug('[ResetPasswordDebug] submit:updateUser:start', {
        flowType,
      });
      const { error: updateError } = await withTimeout(
        supabase.auth.updateUser({
          password: trimmedPassword,
        }),
        12000,
        'Updating password timed out. Please try again.'
      );

      if (updateError) {
        console.debug('[ResetPasswordDebug] submit:updateUser:error', {
          flowType,
          message: updateError.message,
        });
        setError(updateError.message || 'Could not update password. The link may be expired.');
        return;
      }

      console.debug('[ResetPasswordDebug] submit:updateUser:success', {
        flowType,
      });

      setSuccess('Your password has been updated successfully. Redirecting you to login...');
      setPassword('');
      setConfirmPassword('');

      console.debug('[ResetPasswordDebug] submit:signOut:start', {
        flowType,
      });
      try {
        const signOutResult = await withTimeout(
          supabase.auth.signOut(),
          5000,
          'Signing out timed out after password reset.'
        );
        console.debug('[ResetPasswordDebug] submit:signOut:result', {
          flowType,
          hasError: Boolean(signOutResult.error),
          errorMessage: signOutResult.error?.message,
        });
      } catch (signOutError) {
        console.debug('[ResetPasswordDebug] submit:signOut:result', {
          flowType,
          hasError: true,
          errorMessage: signOutError instanceof Error ? signOutError.message : String(signOutError),
        });
      }

      console.debug('[ResetPasswordDebug] submit:redirect:start', {
        flowType,
      });
      router.replace('/login');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message.includes('timed out')) {
        console.debug('[ResetPasswordDebug] submit:updateUser:timeout', {
          flowType,
          message,
        });
      }
      console.debug('[ResetPasswordDebug] submit:updateUser:error', {
        flowType,
        message,
      });
      console.error('Reset password error:', err);
      const timeoutErrorMessage = err instanceof Error ? err.message : '';
      if (timeoutErrorMessage.includes('timed out')) {
        setError(timeoutErrorMessage);
      } else {
        setError('An unexpected error occurred while updating your password. Please try again.');
      }
    } finally {
      console.debug('[ResetPasswordDebug] submit:updating_state', {
        flowType,
        nextUpdatingState: false,
      });
      console.debug('[ResetPasswordDebug] submit:finally', {
        flowType,
      });
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
            {status === 'verifying' && (
              <div className="rounded-xl border border-[#E5E4E3] bg-[#FFF9F4] p-4 text-sm font-medium text-[#8B2424]">
                Verifying your {flowType === 'invite' ? 'account activation' : 'recovery'} link...
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
                <input
                  type="text"
                  autoComplete="username"
                  tabIndex={-1}
                  aria-hidden="true"
                  className="sr-only"
                  defaultValue=""
                  readOnly
                />
                <div>
                  <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8B2424]">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="new-password"
                      placeholder="Enter new password"
                      className="w-full rounded-xl border border-[#e5e4e3] bg-[#f2f2f2] px-4 py-3 pr-12 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                       style={{ backgroundColor: "#f2f2f2", borderColor: "#e5e4e3" }}
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
                      autoComplete="new-password"
                      placeholder="Confirm new password"
                      className="w-full rounded-xl border border-[#e5e4e3] bg-[#f2f2f2] px-4 py-3 pr-12 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      style={{ backgroundColor: "#f2f2f2", borderColor: "#e5e4e3" }}
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

              </>
            )}
          </motion.form>
        </motion.div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
