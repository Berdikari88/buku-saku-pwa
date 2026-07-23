import React, { useState, useEffect } from "react";
import { User, Calendar, Briefcase, Target, ArrowRight } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function OnboardingView({ session, onComplete }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: "", // Akan diisi otomatis dari AuthView
    gender: "Laki-laki",
    birth_date: "",
    profession: "Karyawan",
    financial_goal: "Dana Darurat",
  });

  // MENARIK NAMA DARI METADATA SAAT REGISTER (JIKA ADA)
  useEffect(() => {
    if (session?.user?.user_metadata?.full_name) {
      setFormData(prev => ({
        ...prev,
        full_name: session.user.user_metadata.full_name
      }));
    }
  }, [session]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from("profiles").insert([
        {
          id: session.user.id,
          full_name: formData.full_name,
          gender: formData.gender,
          birth_date: formData.birth_date,
          profession: formData.profession,
          financial_goal: formData.financial_goal,
        },
      ]);
      
      if (error) throw error;
      onComplete(); 
    } catch (error) {
      alert("Gagal menyimpan profil: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#E6E2DE] text-[#1E1E1E] font-sans flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#FDFBF7] border-8 border-[#1E1E1E] rounded-[32px] p-6 sm:p-8 shadow-[12px_12px_0px_0px_#1E1E1E] animate-in slide-in-from-bottom-4">
        
        <div className="mb-8 text-center space-y-2">
          {/* LOGO BARU BUKU SAKU */}
          <img 
            src="/pwa-512x512.png" 
            alt="Logo Buku Saku" 
            className="w-16 h-16 rounded-2xl border-4 border-[#1E1E1E] mx-auto mb-4 shadow-[4px_4px_0px_0px_#1E1E1E] object-cover"
          />
          <h1 className="text-2xl font-black tracking-tight leading-tight">Halo! Mari berkenalan.</h1>
          <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest leading-relaxed">Bantu AI memahami profilmu untuk rekomendasi yang lebih tajam.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Nama Panggilan / Lengkap</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><User size={16} className="text-stone-400" /></div>
              <input type="text" name="full_name" required value={formData.full_name} onChange={handleChange} placeholder="Misal: Budi Santoso" className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white focus:border-indigo-500 outline-none transition uppercase" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Gender</label>
              <select name="gender" value={formData.gender} onChange={handleChange} className="w-full px-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white focus:border-indigo-500 outline-none appearance-none">
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Tanggal Lahir</label>
              <input type="date" name="birth_date" required value={formData.birth_date} onChange={handleChange} className="w-full px-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white focus:border-indigo-500 outline-none" />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Profesi Saat Ini</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Briefcase size={16} className="text-stone-400" /></div>
              <select name="profession" value={formData.profession} onChange={handleChange} className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white focus:border-indigo-500 outline-none appearance-none">
                <option value="Karyawan">Karyawan / Pegawai</option>
                <option value="Wirausaha/UMKM">Wirausaha / UMKM</option>
                <option value="Freelancer">Freelancer / Profesional</option>
                <option value="Pelajar/Mahasiswa">Pelajar / Mahasiswa</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-stone-600 uppercase pl-1">Fokus Keuangan Utama</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none"><Target size={16} className="text-stone-400" /></div>
              <select name="financial_goal" value={formData.financial_goal} onChange={handleChange} className="w-full pl-11 pr-4 py-3.5 text-xs border-4 border-[#1E1E1E] rounded-2xl font-bold bg-white focus:border-indigo-500 outline-none appearance-none">
                <option value="Dana Darurat">Membangun Dana Darurat</option>
                <option value="Beli Aset">Membeli Rumah / Aset</option>
                <option value="Bebas Utang">Melunasi Utang</option>
                <option value="Pensiun">Persiapan Pensiun</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full bg-indigo-500 hover:bg-indigo-400 text-white font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 mt-6 disabled:opacity-50">
            {loading ? "MENYIMPAN..." : "SELESAI & MASUK"} {!loading && <ArrowRight size={16} />}
          </button>

        </form>
      </div>
    </div>
  );
}