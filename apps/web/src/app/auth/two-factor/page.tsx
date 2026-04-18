"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient, twoFactor } from "@/lib/auth-client";
import { Loader2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

export default function TwoFactorChallenge() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const verifyChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifying(true);
    
    try {
      // First try TOTP
      const res = await twoFactor.verifyTotp({ code });
      
      if (res.error) {
        // If TOTP fails, gracefully fail back to checking if it is a backup code
        toast.loading("Checking if backup code...", { id: "verify" });
        const resBackup = await twoFactor.verifyBackupCode({ code });
        if (resBackup.error) {
             toast.error(resBackup.error.message || "Invalid code.", { id: "verify" });
             setIsVerifying(false);
             return;
        }
      }
      
      toast.success("Identity verified!", { id: "verify" });
      
      // Refresh session
      await authClient.getSession();
      
      // We need to route based on session role. Assuming the backend login flow sent them here.
      // Easiest is to redirect to generic dashboard which will handle routing based on role
      router.push("/admin"); 

    } catch (err) {
      console.error(err);
      toast.error("An unexpected error occurred.", { id: "verify" });
    } finally {
      setIsVerifying(false);
    }
  };

  const sendEmailOTP = async () => {
      const loadingToast = toast.loading("Sending email OTP...");
      try {
          const res = await twoFactor.sendOtp();
          if (res.error) {
              toast.error(res.error.message || "Failed to send email OTP.", { id: loadingToast });
          } else {
              toast.success("Email OTP sent!", { id: loadingToast });
          }
      } catch (e) {
          toast.error("Failed to send email OTP.", { id: loadingToast });
      }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] px-4">
      <div className="max-w-md w-full bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[200px] h-[100px] bg-emerald-500/20 blur-[60px] rounded-full pointer-events-none" />
        
        <div className="relative text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
             <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <h1 className="text-3xl font-extrabold text-white mb-2 tracking-tight">Two-Step Verification</h1>
          <p className="text-gray-400">Enter the code from your authenticator app or an emergency backup code.</p>
        </div>

        <form onSubmit={verifyChallenge} className="relative space-y-6">
            <div>
              <input
                type="text"
                autoFocus
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-black/40 border border-white/10 rounded-2xl px-6 py-4 text-white font-mono text-center text-2xl tracking-[0.5em] placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all transition-shadow"
                placeholder="000000"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifying || !code}
              className="w-full flex items-center justify-center space-x-2 bg-gradient-to-r from-emerald-600 to-emerald-500 hover:from-emerald-500 hover:to-emerald-400 text-white py-4 px-6 rounded-2xl font-bold text-lg shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98]"
            >
              {isVerifying ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              <span>Verify</span>
            </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 text-center relative">
           <button onClick={sendEmailOTP} className="text-sm text-gray-400 hover:text-emerald-400 transition-colors font-medium">
               Send code to email instead?
           </button>
        </div>
      </div>
    </div>
  );
}
