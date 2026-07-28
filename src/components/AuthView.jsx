import React, { useState, useRef, useEffect } from "react";
import { Lock, Mail, ArrowRight, AlertCircle, CheckCircle2, RefreshCcw, Edit2 } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function AuthView({ isRecovery, onRecoveryComplete }) {
  // STATE VIEW: Dimulai dari 'check_email' (Pintu Utama)
  const [view, setView] = useState(isRecovery ? 'update_password' : 'check_email'); 
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const toastTimeout = useRef(null);

  const showToast = (message, type = "success") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ show: true, message, type });
    toastTimeout.current = setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  };

  useEffect(() => {
    if (isRecovery) setView('update_password');
  }, [isRecovery]);

  useEffect(() => {
    return () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); };
  }, []);

  // ==========================================
  // FUNGSI LOGIN GOOGLE (VVIP)
  // ==========================================
  const handleGoogleLogin = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (error) {
      showToast("Gagal masuk dengan Google: " + error.message, "error");
    }
  };

  // ==========================================
  // TAHAP 1: CEK EMAIL & LANJUT
  // ==========================================
  const handleEmailNext = async (e) => {
    e.preventDefault();
    if (!email) {
      showToast("Masukkan email terlebih dahulu!", "error");
      return;
    }
    
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setView('login_password');
    }, 600);
  };

  // ==========================================
  // TAHAP 2A: FUNGSI LOGIN (PENGGUNA LAMA)
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      showToast(error.message === "Invalid login credentials" ? "Kata sandi salah atau akun belum terdaftar!" : error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // TAHAP 2B: FUNGSI DAFTAR BARU
  // ==========================================
  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      showToast("Kata sandi dan Konfirmasi tidak cocok!", "error");
      return;
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(password)) {
      showToast("Sandi min. 6 karakter, wajib mengandung Huruf, Angka & Simbol!", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      showToast("Pendaftaran berhasil! Mengalihkan...", "success");
    } catch (error) {
      showToast("Gagal mendaftar: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FUNGSI KIRIM LINK RESET (LUPA SANDI)
  // ==========================================
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin,
      });
      if (error) throw error;
      showToast("Link reset kata sandi telah dikirim ke email Anda!", "success");
      setTimeout(() => setView('login_password'), 3000);
    } catch (error) {
      showToast("Gagal mengirim link: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FUNGSI UPDATE PASSWORD BARU DARI RECOVERY
  // ==========================================
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      showToast("Kata sandi dan Konfirmasi tidak cocok!", "error");
      return;
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(password)) {
      showToast("Sandi min. 6 karakter, wajib mengandung Huruf, Angka & Simbol!", "error");
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      
      showToast("Kata sandi berhasil diperbarui! Mengalihkan...", "success");
      setTimeout(() => { if (onRecoveryComplete) onRecoveryComplete(); }, 3000);
    } catch (error) {
      showToast("Gagal memperbarui sandi: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // Ikon Google Resmi Berwarna
  const GoogleIcon = () => (
    <svg className="w-5 h-5 mr-3 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );

  return (
    <div className="min-h-screen bg-[#E6E2DE] text-[#1E1E1E] font-sans flex items-center justify-center p-4">
      
      {/* CUSTOM TOAST */}
      {toast.show && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[9999] flex justify-center px-4 pointer-events-none animate-in slide-in-from-top-5 fade-in duration-300 w-max max-w-[90vw]">
          <div className={`flex items-center gap-2 px-5 py-4 rounded-2xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] ${toast.type === 'success' ? 'bg-emerald-100' : 'bg-rose-100'}`}>
            {toast.type === 'success' ? <CheckCircle2 size={20} className="text-emerald-600 shrink-0" /> : <AlertCircle size={20} className="text-rose-600 shrink-0" />}
            <span className={`text-[11px] font-black tracking-wide leading-tight ${toast.type === 'success' ? 'text-emerald-900' : 'text-rose-900'}`}>
              {toast.message}
            </span>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm bg-[#FDFBF7] border-8 border-[#1E1E1E] rounded-[32px] p-6 sm:p-8 shadow-[12px_12px_0px_0px_#1E1E1E] animate-in slide-in-from-bottom-4 relative">
        
        <div className="text-center mb-8">
          <img 
            src="/pwa-512x512.png" 
            alt="Logo Buku Saku" 
            className="w-16 h-16 mx-auto mb-4 rounded-2xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] object-cover"
          />
          <h1 className="text-2xl font-black tracking-wider text-[#1E1E1E]">BUKU SAKU</h1>
          <p className="text-[9px] font-black text-stone-500 tracking-[0.2em] uppercase mt-2">Catat uangmu. Sat-set.</p>
        </div>

        {/* ----------------- TAHAP 1: FORM PINTU UTAMA ----------------- */}
        {view === 'check_email' && (
          <div className="animate-in fade-in zoom-in-95">
            
            {/* Tombol Masuk Google */}
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center bg-[#1E1E1E] text-white font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#10B981] hover:bg-stone-800 transition active:translate-y-1 active:shadow-none"
            >
              <GoogleIcon />
              Masuk dengan Google
            </button>

            {/* Divider */}
            <div className="flex items-center my-6 opacity-60">
              <div className="flex-grow border-t-2 border-[#1E1E1E] border-dashed"></div>
              <span className="px-4 text-[10px] font-black text-[#1E1E1E] uppercase tracking-widest">Atau</span>
              <div className="flex-grow border-t-2 border-[#1E1E1E] border-dashed"></div>
            </div>

            <form onSubmit={handleEmailNext} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Alamat Email</label>
                <div className="relative flex gap-2">
                  <div className="relative flex-grow">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail size={16} className="text-stone-400" /></div>
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
                  </div>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase py-3.5 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? "MEMERIKSA..." : "LANJUT"} <ArrowRight size={16} />
              </button>
            </form>

            <div className="mt-8 pt-4 border-t-2 border-stone-200 border-dashed text-center flex justify-center items-center gap-2 text-[8px] font-black text-stone-400 uppercase tracking-[0.2em]">
              <span>KONEKSI AMAN</span> <span className="text-[10px]">•</span> <span>DATA TERKUNCI</span> <span className="text-[10px]">•</span> <span>100% RAHASIA</span>
            </div>
          </div>
        )}

        {/* ----------------- TAHAP 2A: FORM LOGIN ----------------- */}
        {view === 'login_password' && (
          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in zoom-in-95">
            
            <div className="bg-stone-100 p-3 rounded-xl border-2 border-stone-300 flex justify-between items-center mb-4">
              <span className="text-[10px] font-bold text-stone-600 truncate mr-2">{email}</span>
              <button type="button" onClick={() => { setView('check_email'); setPassword(''); }} className="flex items-center gap-1 text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase px-2 py-1 bg-white border-2 border-indigo-200 rounded-lg transition">
                <Edit2 size={10} /> Ubah
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center pl-1 pr-1">
                <label className="text-[10px] font-black text-stone-600 uppercase">Kata Sandi</label>
                <button type="button" onClick={() => { setView('forgot'); setPassword(''); setConfirmPassword(''); }} className="text-[9px] font-black text-emerald-600 hover:text-emerald-500 transition uppercase tracking-wider">
                  Lupa Sandi?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={16} className="text-stone-400" /></div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata sandi" className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? "MEMPROSES..." : "MASUK SEKARANG"} <ArrowRight size={16} />
            </button>
            
            <div className="text-center pt-4">
              <p className="text-[10px] font-bold text-stone-500 mb-1">Email belum terdaftar?</p>
              <button type="button" onClick={() => { setView('register_password'); setPassword(''); setConfirmPassword(''); }} className="text-[11px] font-black text-emerald-700 hover:underline uppercase tracking-wider transition">
                BUAT AKUN BARU SEKARANG
              </button>
            </div>
          </form>
        )}

        {/* ----------------- TAHAP 2B: FORM DAFTAR BARU ----------------- */}
        {view === 'register_password' && (
          <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in zoom-in-95">
            
            <div className="bg-emerald-50 p-3 rounded-xl border-2 border-emerald-200 flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-emerald-800 truncate mr-2">{email}</span>
              <button type="button" onClick={() => { setView('check_email'); setPassword(''); setConfirmPassword(''); }} className="flex items-center gap-1 text-[9px] font-black text-indigo-600 hover:text-indigo-800 uppercase px-2 py-1 bg-white border-2 border-indigo-200 rounded-lg transition">
                <Edit2 size={10} /> Ubah
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Buat Kata Sandi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={16} className="text-stone-400" /></div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Huruf, Angka & Simbol" minLength={6} className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Konfirmasi Sandi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={16} className="text-stone-400" /></div>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ketik ulang kata sandi" minLength={6} className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
              </div>
              <p className="text-[9px] font-bold text-stone-400 pl-2">Minimal 6 karakter kombinasi (contoh: @, #, !)</p>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 bg-[#1E1E1E] text-white font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#10B981] hover:bg-stone-800 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? "MEMPROSES..." : "BUAT AKUN SAYA"} <ArrowRight size={16} />
            </button>
            
            <div className="text-center pt-4">
              <button type="button" onClick={() => { setView('login_password'); setPassword(''); setConfirmPassword(''); }} className="text-[10px] font-black text-stone-500 hover:text-[#1E1E1E] uppercase tracking-wider transition">
                BATAL & KEMBALI MASUK
              </button>
            </div>
          </form>
        )}

        {/* ----------------- FORM LUPA PASSWORD ----------------- */}
        {view === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in zoom-in-95">
            <div className="bg-amber-100 p-4 rounded-2xl border-4 border-[#1E1E1E] mb-2 shadow-[2px_2px_0px_0px_#1E1E1E]">
              <p className="text-[10px] font-black text-amber-900 leading-relaxed text-center uppercase tracking-wider">
                Kami akan mengirimkan tautan untuk mereset kata sandi ke email Anda.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Alamat Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail size={16} className="text-stone-400" /></div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-amber-500 transition" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 bg-amber-400 text-[#1E1E1E] font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-amber-300 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? "MENGIRIM..." : "KIRIM LINK RESET"} <RefreshCcw size={16} />
            </button>
            
            <div className="text-center pt-4">
              <button type="button" onClick={() => setView('login_password')} className="text-[10px] font-black text-stone-500 hover:text-[#1E1E1E] uppercase tracking-widest transition">
                BATAL & KEMBALI
              </button>
            </div>
          </form>
        )}

        {/* ----------------- FORM UPDATE PASSWORD (RECOVERY) ----------------- */}
        {view === 'update_password' && (
          <form onSubmit={handleUpdatePassword} className="space-y-4 animate-in fade-in zoom-in-95">
            <div className="bg-emerald-100 p-4 rounded-2xl border-4 border-[#1E1E1E] mb-2 shadow-[2px_2px_0px_0px_#1E1E1E]">
              <p className="text-[10px] font-black text-emerald-900 leading-relaxed text-center uppercase tracking-wider">
                Silakan buat kata sandi baru untuk mengamankan kembali akun Anda.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Kata Sandi Baru</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={16} className="text-stone-400" /></div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Huruf, Angka & Simbol" minLength={6} className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Konfirmasi Sandi Baru</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={16} className="text-stone-400" /></div>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Ketik ulang kata sandi" minLength={6} className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? "MEMPROSES..." : "SIMPAN KATA SANDI"} <CheckCircle2 size={16} />
            </button>
          </form>
        )}

      </div>
    </div>
  );
}