import React from "react";
import { motion } from "framer-motion";
import { useRouter } from "@/src/router";
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
  const { navigate } = useRouter();
  const { login } = useSession();
  const isMobile = useMobile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPassword = password.trim();

    try {
      const { data: admin, error: adminError } = await supabase
        .from("Admin")
        .select("adminID, firstname, lastname, password")
        .eq("adminID", trimmedEmail)
        .maybeSingle();

      if (!adminError && admin) {
        if (admin.password !== trimmedPassword) {
          setError("Incorrect password");
          setLoading(false);
          return;
        }

        const adminUser = {
          ...admin,
          role: "admin",
        };

        login(adminUser);
        navigate("/home");
        return;
      }

      const { data: chair, error: chairError } = await supabase
        .from("Chair")
        .select("*")
        .eq("chairID", trimmedEmail)
        .maybeSingle();

      if (!chairError && chair) {
        if (chair.password !== trimmedPassword) {
          setError("Incorrect password");
          setLoading(false);
          return;
        }

        const { data: committeeID, error: IDerror } = await supabase
          .from("Committee-Chair")
          .select("chairID, committeeID")
          .eq("chairID", trimmedEmail)
          .single();

        if (IDerror || !committeeID) {
          setError("Committee assignment not found");
          setLoading(false);
          return;
        }

        const { data: committee, error: committeeError } = await supabase
          .from("Committee")
          .select("committeeID, name")
          .eq("committeeID", committeeID.committeeID)
          .single();

        if (committeeError || !committee) {
          setError("Committee not found");
          setLoading(false);
          return;
        }

        const enrichedUser = {
          ...chair,
          committee: {
            committeeID: committee.committeeID,
            name: committee.name,
          },
        };

        login(enrichedUser);
        navigate("/home");
        return;
      }

      const { data: delegate, error: delegateError } = await supabase
        .from("Delegate")
        .select("delegateID, email, password")
        .eq("email", trimmedEmail)
        .maybeSingle();

      if (!delegateError && delegate) {
        if (delegate.password !== trimmedPassword) {
          setError("Incorrect password");
          setLoading(false);
          return;
        }

        const { data: fullDelegate, error: fullDelegateError } = await supabase
          .from("Delegate")
          .select("*")
          .eq("delegateID", delegate.delegateID)
          .single();

        if (fullDelegateError || !fullDelegate) {
          setError("Delegate record not found");
          setLoading(false);
          return;
        }

        const { data: delegation, error: delegationError } = await supabase
          .from("Delegation")
          .select(`*,
             Country:countryID (countryID, name, flag),
             Committee:committeeID (committeeID, name)
          `)
          .eq("delegateID", delegate.delegateID)
          .single();

        if (delegationError || !delegation) {
          setError("Delegation not found");
          setLoading(false);
          return;
        }

        const enrichedUser = {
          ...fullDelegate,
          country: delegation.Country,
          committee: delegation.Committee,
        };

        login(enrichedUser);
        navigate("/home");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <div className="flex min-h-screen flex-col lg:flex-row">
        {/* Left Side - Branding */}
        <motion.div
          className="relative overflow-hidden lg:w-1/2 bg-gradient-to-br from-deep-red to-dark-burgundy flex flex-col justify-center items-center p-8 lg:p-12"
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

        {/* Right Side - Login Form */}
        <motion.div
          className="lg:w-1/2 flex flex-col justify-center p-8 lg:p-12 bg-[#FFEBDD]"
          initial={{ opacity: 0, x: isMobile ? 0 : 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="mx-auto w-full max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="mb-10 text-center"
            >
              <span className="inline-flex items-center justify-center rounded-full bg-[#8B2424]/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-[#8B2424]">
                Official Access
              </span>
              <h1
                className="mt-6 text-4xl lg:text-5xl font-heading font-semibold text-deep-red"
                data-testid="text-login-header"
              >
                VOFMUN Portal
              </h1>
              <p className="mt-3 text-base text-[#701E1E]/80">
                Sign in to manage your conference experience and stay connected.
              </p>
            </motion.div>

            <motion.form
              onSubmit={handleSubmit}
              className="space-y-6 rounded-3xl border border-[#F4C5AF] bg-[#FFFDFB] p-8 shadow-[0_20px_45px_-20px_rgba(112,30,30,0.45)]"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
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
                    className="w-full rounded-xl border border-[#F1BBA3] bg-[#FFFDFB] px-4 py-3 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
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
                    className="w-full rounded-xl border border-[#F1BBA3] bg-[#FFFDFB] px-4 py-3 pr-12 text-[#1C1C1C] shadow-[0_8px_18px_-12px_rgba(139,36,36,0.6)] outline-none transition-all placeholder:text-[#8B2424]/40 focus:border-[#8B2424] focus:ring-4 focus:ring-[#8B2424]/30"
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

              <p className="text-center text-xs font-medium uppercase tracking-[0.3em] text-[#8B2424]/60">
                Secure Conference Access
              </p>
            </motion.form>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Login;
