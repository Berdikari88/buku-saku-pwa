import React, { useState, useRef, useEffect } from "react";
import { Lock, Mail, ArrowRight, BookMarked, AlertCircle, CheckCircle2, User, RefreshCcw } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function AuthView({ isRecovery, onRecoveryComplete }) {
  
  const [view, setView] = useState(isRecovery ? 'update_password' : 'login'); 
  
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // STATE BARU: Untuk Konfirmasi Kata Sandi
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
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
  // FUNGSI LOGIN
  // ==========================================
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error) {
      showToast(error.message === "Invalid login credentials" ? "Email atau kata sandi salah!" : error.message, "error");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // FUNGSI DAFTAR BARU
  // ==========================================
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!fullName) {
      showToast("Nama lengkap wajib diisi!", "error");
      return;
    }
    
    // VALIDASI KECOCOKAN KATA SANDI
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
      const { error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: { data: { full_name: fullName } }
      });
      if (error) throw error;
      
      showToast("Pendaftaran berhasil! Silakan masuk dengan akun barumu.", "success");
      setTimeout(() => { 
        setView('login'); 
        setPassword(""); 
        setConfirmPassword(""); 
      }, 2000);
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
      setTimeout(() => setView('login'), 3000);
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
    
    // VALIDASI KECOCOKAN KATA SANDI
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
      
      showToast("Kata sandi berhasil diperbarui! Mengalihkan ke aplikasi...", "success");
      
      setTimeout(() => {
        if (onRecoveryComplete) onRecoveryComplete();
      }, 3000);

    } catch (error) {
      showToast("Gagal memperbarui sandi: " + error.message, "error");
    } finally {
      setLoading(false);
    }
  };

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

      <div className="w-full max-w-sm bg-[#FDFBF7] border-8 border-[#1E1E1E] rounded-[32px] p-6 sm:p-8 shadow-[12px_12px_0px_0px_#1E1E1E] animate-in slide-in-from-bottom-4">
        
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl border-4 border-[#1E1E1E] flex items-center justify-center mx-auto mb-4 shadow-[4px_4px_0px_0px_#1E1E1E]">
            <BookMarked size={32} className="text-[#1E1E1E]" />
          </div>
          <h1 className="text-2xl font-black tracking-wider text-[#1E1E1E]">BUKU SAKU</h1>
          <p className="text-[9px] font-black text-stone-500 tracking-[0.2em] uppercase mt-2">Asisten Finansial Pintar</p>
        </div>

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
              <p className="text-[9px] font-bold text-stone-400 pl-2">Gunakan minimal 6 karakter kombinasi huruf, angka, dan simbol (contoh: @, #, !)</p>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? "MEMPROSES..." : "SIMPAN KATA SANDI"} <CheckCircle2 size={16} />
            </button>
          </form>
        )}

        {/* ----------------- FORM LOGIN ----------------- */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 animate-in fade-in zoom-in-95">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Alamat Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail size={16} className="text-stone-400" /></div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center pl-1 pr-1">
                <label className="text-[10px] font-black text-stone-600 uppercase">Kata Sandi</label>
                <button type="button" onClick={() => { setView('forgot'); setEmail(''); setPassword(''); setConfirmPassword(''); }} className="text-[9px] font-black text-emerald-600 hover:text-emerald-500 transition uppercase tracking-wider">
                  Lupa Sandi?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Lock size={16} className="text-stone-400" /></div>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Masukkan kata sandi" className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
              </div>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? "MEMPROSES..." : "LOGIN"} <ArrowRight size={16} />
            </button>
            
            <div className="text-center pt-4">
              <p className="text-[10px] font-bold text-stone-500 mb-1">Belum punya akun?</p>
              <button type="button" onClick={() => { setView('register'); setPassword(''); setConfirmPassword(''); }} className="text-[11px] font-black text-emerald-700 hover:underline uppercase tracking-wider transition">
                DAFTAR SEKARANG
              </button>
            </div>
          </form>
        )}

        {/* ----------------- FORM REGISTRASI ----------------- */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in zoom-in-95">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Nama Lengkap</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={16} className="text-stone-400" /></div>
                <input type="text" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Misal: Budi Santoso" className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition uppercase" required />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Alamat Email</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Mail size={16} className="text-stone-400" /></div>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nama@email.com" className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white outline-none focus:border-emerald-500 transition" required />
              </div>
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
              <p className="text-[9px] font-bold text-stone-400 pl-2">Gunakan minimal 6 karakter kombinasi huruf, angka, dan simbol (contoh: @, #, !)</p>
            </div>

            <button type="submit" disabled={loading} className="w-full mt-2 bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
              {loading ? "MEMPROSES..." : "BUAT AKUN BARU"} <ArrowRight size={16} />
            </button>
            
            <div className="text-center pt-4">
              <p className="text-[10px] font-bold text-stone-500 mb-1">Sudah terdaftar?</p>
              <button type="button" onClick={() => { setView('login'); setPassword(''); setConfirmPassword(''); setFullName(''); }} className="text-[11px] font-black text-[#1E1E1E] hover:underline uppercase tracking-wider transition">
                MASUK DENGAN AKUN LAMA
              </button>
            </div>
          </form>
        )}

        {/* ----------------- FORM LUPA PASSWORD ----------------- */}
        {view === 'forgot' && (
          <form onSubmit={handleResetPassword} className="space-y-4 animate-in fade-in zoom-in-95">
            <div className="bg-amber-100 p-4 rounded-2xl border-4 border-[#1E1E1E] mb-2 shadow-[2px_2px_0px_0px_#1E1E1E]">
              <p className="text-[10px] font-black text-amber-900 leading-relaxed text-center uppercase tracking-wider">
                Masukkan email Anda. Kami akan mengirimkan tautan untuk mereset kata sandi.
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
              <button type="button" onClick={() => setView('login')} className="text-[10px] font-black text-stone-500 hover:text-[#1E1E1E] uppercase tracking-widest transition">
                BATAL & KEMBALI LOGIN
              </button>
            </div>
          </form>
        )}

      </div>
    </div>
  );
}