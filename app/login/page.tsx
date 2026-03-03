// © 2026 Ansh Gupta. All rights reserved.
// Proprietary - NOT OPEN SOURCE. No copying/modification/deployment without permission (dxb.avg@gmail.com).
'use client';

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useSession } from "../context/sessionContext";
import TypeWriter from "@/components/ui/typewriter";
import supabase from "@/lib/supabase";
import { useMobile } from "@/hooks/use-mobile";
import { Eye, EyeOff, Rocket } from "lucide-react";

const Login = () => {
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [showForgotPanel, setShowForgotPanel] = React.useState(false);
  const [forgotLoading, setForgotLoading] = React.useState(false);
  const [forgotMessage, setForgotMessage] = React.useState("");
  const router = useRouter();
  const { login } = useSession();
  const isMobile = useMobile();
  const brandDarkRed = "#701e1e";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    try {
      const { data: admin } = await supabase
        .from("Admin")
        .select("*")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (admin) {
        if (admin.password !== trimmedPassword) {
          setError("Incorrect password");
          setLoading(false);
          return;
        }

        login({ ...admin, role: "admin" });
        router.push("/home");
        return;
      }

      const { data: chair } = await supabase
        .from("Chair")
        .select("*")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (chair) {
        if (chair.password !== trimmedPassword) {
          setError("Incorrect password");
          setLoading(false);
          return;
        }

        login({ ...chair, role: "chair" });
        router.push("/home");
        return;
      }

      const { data: delegate } = await supabase
        .from("Delegate")
        .select("delegateID, firstname, lastname, password, email, country, committeeID, resoPerms")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (delegate) {
        if (delegate.password !== trimmedPassword) {
          setError("Incorrect password");
          setLoading(false);
          return;
        }

        let committee = null;
        if (delegate.committeeID) {
          const { data: committeeRecord } = await supabase
            .from("Committee")
            .select("committeeID, name, committeeCode, fullname")
            .eq("committeeID", delegate.committeeID)
            .maybeSingle();
          committee = committeeRecord || null;
        }

        login({ ...delegate, committee, role: "delegate" });
        router.push("/home");
        return;
      }

      const { data: secretariat } = await supabase
        .from("Secretariat")
        .select("*")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (secretariat) {
        if (secretariat.password !== trimmedPassword) {
          setError("Incorrect password");
          setLoading(false);
          return;
        }

        login({ ...secretariat, role: "secretariat" });
        router.push("/home");
        return;
      }

      setError("Account not found");
    } catch (err) {
      console.error("Login error:", err);
      setError("An error occurred during login. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setForgotMessage("");
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail) {
      setError("Enter your email address first to receive a reset link.");
      return;
    }

    setForgotLoading(true);
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/reset-password` : undefined;

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      });

      if (resetError) {
        setError(resetError.message || "Could not send password reset link.");
        return;
      }

      setForgotMessage("If an account exists for this email, a password reset link has been sent.");
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("Could not send password reset link. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Left Side - Branding */}
        <div className="relative overflow-hidden lg:w-1/2 bg-gradient-to-br from-deep-red to-dark-burgundy">
          <motion.div
            key="brand-panel"
            className="relative flex h-full min-h-[45vh] flex-col items-center justify-center p-8 lg:p-12"
            initial={{ opacity: 0, x: isMobile ? 0 : -50 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8 }}
          >
                {/* Background decoration */}
                <div className="absolute inset-0 bg-gradient-to-br from-transparent via-black/10 to-black/20"></div>
                <div className="absolute top-10 left-10 h-32 w-32 rounded-full bg-white/10 blur-xl"></div>
                <div className="absolute bottom-20 right-10 h-40 w-40 rounded-full bg-white/5 blur-2xl"></div>

                <div className="relative z-10 max-w-md text-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 1, delay: 0.2 }}
                    className="mb-8"
                  >
                    <img
                      width={200}
                      height={200}
                      src="/logo.svg"
                      alt="VOFMUN"
                      className="mx-auto"
                    />
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.4 }}
                  >
                    <TypeWriter />
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.8, delay: 0.6 }}
                    className="mt-6 text-lg leading-relaxed text-[#1C1C1C]"
                  >
                    Empowering the next generation of global leaders through diplomacy,
                    debate, and international cooperation.
                  </motion.p>
                </div>
          </motion.div>
        </div>

        {/* Right Side - Login Form */}
        <motion.div
          className="lg:w-1/2 flex flex-col justify-center p-8 lg:p-12 bg-[#FFEBDD]"
          initial={{ opacity: 0, x: isMobile ? 0 : 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="mx-auto w-full max-w-md">
            <AnimatePresence mode="wait">
              {showForgotPanel ? (
                <motion.div
                  key="forgot-panel"
                  initial={{ opacity: 0, x: isMobile ? 0 : 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isMobile ? 0 : 60 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                  className="space-y-6"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                    className="mb-10 text-center"
                  >
                    <span className="inline-flex items-center justify-center rounded-full bg-[#8B2424]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#8B2424]">
                      Password Recovery
                    </span>
                    <h1 className="mt-6 text-4xl lg:text-5xl font-heading font-semibold text-deep-red" style={{ color: brandDarkRed }}>
                      Reset Password
                    </h1>
                    <p className="mt-3 text-base text-[#701E1E]/80">
                      Enter your email and we&apos;ll send you a secure password reset link.
                    </p>
                  </motion.div>

                  <div className="space-y-6 rounded-3xl border border-[#e5e4e3] bg-[#FFFDFB] p-8 shadow-[0_20px_45px_-20px_rgba(112,30,30,0.45)]">
                    <div>
                      <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8B2424]">
                        Email Address
                      </label>
                    <input
                      type="email"
                      placeholder="Your Email Address"
                      className="w-full rounded-xl border border-[#e5e4e3] bg-[#f2f2f2] px-4 py-3 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    </div>

                    {forgotMessage && (
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                        <p className="text-sm font-medium text-emerald-700">{forgotMessage}</p>
                      </div>
                    )}

                    {error && (
                      <div className="rounded-xl border border-[#F5A3A3] bg-[#FDECEC] p-4">
                        <p className="text-sm font-medium text-[#8B2424]">{error}</p>
                      </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row">
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        disabled={forgotLoading}
                        className="rounded-xl bg-[#701E1E] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#8B2424] disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        {forgotLoading ? "Sending reset link..." : "Send reset link"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setError("");
                          setForgotMessage("");
                          setShowForgotPanel(false);
                        }}
                        className="rounded-xl border border-[#8B2424]/30 px-5 py-3 text-sm font-semibold text-[#701E1E] transition-colors hover:bg-[#8B2424]/5"
                      >
                        Back to login
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="login-panel"
                  initial={{ opacity: 0, x: isMobile ? 0 : 60 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isMobile ? 0 : 60 }}
                  transition={{ duration: 0.45, ease: "easeOut" }}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.2 }}
                    className="mb-10 text-center"
                  >
                    <span className="inline-flex items-center justify-center rounded-full bg-[#8B2424]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#8B2424]">
                      Official Access
                    </span>
                    <h1
                      className="mt-6 text-4xl lg:text-5xl font-heading font-semibold text-deep-red"
                      data-testid="text-login-header"
                      style={{ color: brandDarkRed, }}
                    >
                      VOFMUN Portal
                    </h1>
                    <p className="mt-3 text-base text-[#701E1E]/80">
                      Sign in to manage your conference experience and stay connected.
                    </p>
                  </motion.div>

                  <motion.form
                    onSubmit={handleSubmit}
                    className="space-y-6 rounded-3xl border border-[#e5e4e3] bg-[#FFFDFB] p-8 shadow-[0_20px_45px_-20px_rgba(112,30,30,0.45)]"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 0.4 }}
                  >
              {/* Email Field */}
              <div>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8B2424]">
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    placeholder="Your Email Address"
                    className="w-full rounded-xl border border-[#e5e4e3] bg-[#f2f2f2] px-4 py-3 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    data-testid="input-email"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label className="mb-3 block text-xs font-semibold uppercase tracking-[0.2em] text-[#8B2424]">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="Your Password"
                    className="w-full rounded-xl border border-[#e5e4e3] bg-[#f2f2f2] px-4 py-3 pr-12 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    data-testid="input-password"
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

              {/* Error Message */}
              {error && (
                <motion.div
                  className="rounded-xl border border-[#F5A3A3] bg-[#FDECEC] p-4"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  data-testid="error-message"
                >
                  <div className="flex items-center">
                    <div className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-[#8B2424]/20 text-[#701E1E]">
                      <span className="text-xs font-semibold">!</span>
                    </div>
                    <p className="text-sm font-medium text-[#8B2424]">
                      {error}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full rounded-xl bg-[#701E1E] px-6 py-3 font-sans text-sm font-semibold uppercase tracking-[0.2em] text-white transition-all duration-300 hover:-translate-y-0.5 hover:bg-[#8B2424] hover:shadow-[0_20px_40px_-20px_rgba(112,30,30,0.65)] disabled:cursor-not-allowed disabled:bg-[#701E1E]/60 disabled:shadow-none"
                disabled={loading}
                data-testid="button-login"
              >
                {loading ? (
                  <div className="flex items-center justify-center text-[#FFFDFB]">
                    <div className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Signing you in...
                  </div>
                ) : (
                  <div className="flex items-center justify-center text-[#FFFDFB]">
                    <Rocket size={18} className="mr-2 text-[#FFFDFB]" />
                    <span className="text-[#FFFDFB]">Enter VOFMUN ONE</span>
                  </div>
                )}
              </button>

              <p className="text-center text-xs font-medium uppercase tracking-[0.3em] text-[#000000]/90">
                Secure Conference Access
              </p>

              <div className="flex flex-col items-center gap-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setForgotMessage("");
                    setShowForgotPanel(true);
                  }}
                  className="text-sm font-semibold text-[#701E1E] underline underline-offset-4 transition-colors hover:text-[#8B2424]"
                >
                  Forgot password?
                </button>
              </div>
                  </motion.form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
