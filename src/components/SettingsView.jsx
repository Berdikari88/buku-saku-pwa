import React, { useState, useEffect, useRef } from "react";
import { User, Edit3, Target, Wallet, CreditCard, Fingerprint, Sparkles, DownloadCloud, LogOut, ChevronRight, X, CheckCircle2, AlertCircle, Info, Calendar, Zap, Trophy, PlusCircle, Filter, Tags, Box, ShoppingBag, Coffee, Heart, Monitor, Smile, Lock, Trash2, Settings, FileText, PieChart } from "lucide-react";
import { supabase } from "../supabaseClient";

// IMPORT ALAT PEMBUAT PDF DOKUMEN & TABEL
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// ============================================================================
// MESIN AI UNTUK REVIEW RAPOR BULANAN
// ============================================================================
const callGeminiDirectly = async (prompt, apiKey) => {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  if (!data.models) throw new Error("Gagal mengambil mesin AI.");
  
  let validModels = data.models.filter(m => m.supportedGenerationMethods?.includes("generateContent")).map(m => m.name.replace('models/', ''));
  validModels.sort((a, b) => (b.includes("flash") ? 2 : 1) - (a.includes("flash") ? 2 : 1));

  for (const model of validModels) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const payload = { contents: [{ role: "user", parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7 } };
      const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const responseData = await response.json();
      if (responseData.candidates && responseData.candidates.length > 0) return responseData.candidates[0].content.parts[0].text; 
    } catch (err) { continue; }
  }
  return "AI lagi ngopi, tapi dari angka di atas, tetap pantau keuanganmu ya!";
};

export default function SettingsView({ setAccounts, setTransactions, setChatHistory, setActiveTab, fetchData, accounts = [], transactions = [] }) {
  const [profile, setProfile] = useState({ full_name: "Memuat...", email: "...", gender: "Laki-laki" });
  
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  
  const [useBiometric, setUseBiometric] = useState(() => localStorage.getItem('useBiometric') === 'true');
  
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
  const [walletGroup, setWalletGroup] = useState("PRIBADI"); 
  const [walletName, setWalletName] = useState("");
  const [walletType, setWalletType] = useState("bank"); 
  const [walletBalance, setWalletBalance] = useState(""); 
  const [walletLoading, setWalletLoading] = useState(false);

  const [isCcModalOpen, setIsCcModalOpen] = useState(false);
  const [ccGroup, setCcGroup] = useState("PRIBADI"); 
  const [ccName, setCcName] = useState("");
  const [ccLimit, setCcLimit] = useState(""); 
  const [ccStatementDate, setCcStatementDate] = useState("");
  const [ccDueDate, setCcDueDate] = useState("");
  const [ccLoading, setCcLoading] = useState(false);

  const [isManageAccountsModalOpen, setIsManageAccountsModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState(""); 
  const [newPassword, setNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState("");
  const [catIcon, setCatIcon] = useState("box");
  const [catLoading, setCatLoading] = useState(false);

  const [isAiStyleModalOpen, setIsAiStyleModalOpen] = useState(false);
  const [aiStyle, setAiStyle] = useState(() => localStorage.getItem('aiPersona') || 'skena');

  const [showTargetEduModal, setShowTargetEduModal] = useState(false);
  const [showTargetFormModal, setShowTargetFormModal] = useState(false);
  const [targetTitle, setTargetTitle] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [targetLocation, setTargetLocation] = useState("");
  const [targetLoading, setTargetLoading] = useState(false);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const toastTimeout = useRef(null);

  // ==========================================
  // STATE BARU: PUSAT LAPORAN (INTERAKTIF & PDF)
  // ==========================================
  const [isReportSelectOpen, setIsReportSelectOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState("");
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);
  const [reportData, setReportData] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  const showToast = (message, type = "success") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ show: true, message, type });
    toastTimeout.current = setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('full_name, gender').eq('id', user.id).single();
        setProfile({ 
          full_name: data?.full_name || "Pengguna Baru", 
          email: user.email,
          gender: data?.gender || "Laki-laki" 
        });
      }
    }
    loadProfile();
    
    // Set Default Bulan Laporan
    const now = new Date();
    setReportMonth(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    
    return () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); };
  }, []);

  const formatRupiahInput = (value, setterFunction) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    if (!numericValue) { setterFunction(""); return; }
    setterFunction(Number(numericValue).toLocaleString("id-ID"));
  };
  const formatRp = (val) => new Intl.NumberFormat("id-ID").format(val || 0);

  // ==========================================
  // FUNGSI 1: MEMBANGUN DATA RAPOR
  // ==========================================
  const handleOpenReportPreview = async () => {
    if (!transactions || transactions.length === 0) return showToast("Belum ada data transaksi.", "error");
    
    setReportLoading(true);
    try {
      const monthTx = transactions.filter(t => t.date && t.date.startsWith(reportMonth));
      if (monthTx.length === 0) throw new Error(`Tidak ada aktivitas keuangan di bulan ${reportMonth}`);

      const income = monthTx.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + Number(t.amount), 0);
      const expense = monthTx.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + Number(t.amount), 0);
      const ratio = income > 0 ? Math.min((expense / income) * 100, 100) : (expense > 0 ? 100 : 0);

      // Kelompokkan Kategori (Untuk Donat & Top 5)
      const catMap = {};
      monthTx.filter(t => t.type === 'EXPENSE').forEach(t => { catMap[t.category] = (catMap[t.category] || 0) + Number(t.amount); });
      const topCats = Object.entries(catMap).map(([name, amount]) => ({ name, amount })).sort((a,b) => b.amount - a.amount).slice(0, 5);

      let currentPct = 0;
      const colors = ['#E11D48', '#F59E0B', '#10B981', '#3B82F6', '#8B5CF6'];
      const gradientParts = topCats.map((c, i) => {
        const pct = expense > 0 ? (c.amount / expense) * 100 : 0;
        const part = `${colors[i]} ${currentPct}% ${currentPct + pct}%`;
        currentPct += pct;
        return part;
      }).join(', ');
      const conicGradient = gradientParts ? `conic-gradient(${gradientParts})` : 'conic-gradient(#e5e7eb 0% 100%)';

      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      let aiRoast = "Terus pantau arus kasmu ya!";
      
      if (apiKey) {
        try {
          const prompt = `Anda penasihat keuangan. Persona Anda: ${aiStyle} (jika skena=gaul, bijak=profesional, galak=sarkas). Analisa bulan ${reportMonth}: Pemasukan Rp${income}, Pengeluaran Rp${expense}. Top bocor: ${topCats.slice(0,3).map(c=>c.name).join(', ')}. Beri 1 paragraf (maks 4 kalimat) insight atau roasting sesuai persona. Jika persona skena, sapa dengan "Bosku".`;
          aiRoast = await callGeminiDirectly(prompt, apiKey);
        } catch (e) { console.error("AI Error", e); }
      }

      setReportData({ month: reportMonth, income, expense, ratio, topCats, colors, conicGradient, aiRoast, allTransactions: monthTx });
      setIsReportSelectOpen(false);
      setIsReportPreviewOpen(true);
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setReportLoading(false);
    }
  };

  // ==========================================
  // FUNGSI 2: GENERATE FULL PDF MULTI-HALAMAN
  // ==========================================
  const handleDownloadFullPDF = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      // HEADER
      doc.setFontSize(22);
      doc.setFont("helvetica", "bold");
      doc.text("RAPOR FINANSIAL LENGKAP", pageWidth / 2, 20, { align: "center" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text(`Periode: ${reportData.month}`, pageWidth / 2, 28, { align: "center" });

      // SUMMARY BOXES
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129); // Emerald
      doc.text(`Total Pemasukan: Rp ${formatRp(reportData.income)}`, 20, 45);
      
      doc.setTextColor(225, 29, 72); // Rose
      doc.text(`Total Pengeluaran: Rp ${formatRp(reportData.expense)}`, 20, 55);
      
      doc.setTextColor(0, 0, 0); // Black

      // PREPARE TABLE DATA
      const tableColumn = ["Tanggal", "Tipe", "Kategori", "Catatan", "Dompet", "Nominal"];
      const tableRows = [];

      reportData.allTransactions.forEach(t => {
        const acc = (accounts || []).find(a => a.id === t.account_id);
        const accName = acc ? acc.name : "-";
        const typeIndo = t.type === 'EXPENSE' ? 'Keluar' : t.type === 'INCOME' ? 'Masuk' : 'Transfer';
        const formattedAmount = `Rp ${formatRp(t.amount)}`;
        
        tableRows.push([t.date, typeIndo, t.category, t.title || "-", accName, formattedAmount]);
      });

      // GENERATE MULTI-PAGE TABLE
      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 65,
        theme: 'grid',
        headStyles: { fillColor: [30, 30, 30] }, // Neo-brutalism black header
        styles: { font: 'helvetica', fontSize: 10 },
      });

      // SAVE PDF
      doc.save(`Laporan_Lengkap_${reportData.month}.pdf`);
      showToast("PDF Lengkap Berhasil Diunduh!", "success");

    } catch (error) {
      showToast("Gagal memproses PDF.", "error");
      console.error(error);
    }
  };

  // ==========================================
  // FUNGSI 3: UNDUH MENTAHAN CSV
  // ==========================================
  const handleDownloadCSV = () => {
    let csvContent = "Tanggal,Tipe,Kategori,Catatan,Sumber Dana,Nominal\n";
    reportData.allTransactions.forEach(t => {
      const acc = (accounts || []).find(a => a.id === t.account_id);
      const accName = acc ? acc.name : "-";
      const safeTitle = `"${(t.title || "").replace(/"/g, '""')}"`;
      csvContent += `${t.date},${t.type},${t.category},${safeTitle},${accName},${t.amount}\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Rekap_Mentahan_${reportData.month}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url); 
    showToast("File CSV berhasil diunduh!", "success");
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!editFullName) return;
    setProfileLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Gagal mengidentifikasi pengguna.");
      const { error } = await supabase.from('profiles').update({ full_name: editFullName }).eq('id', user.id);
      if (error) throw error;
      setProfile(prev => ({ ...prev, full_name: editFullName }));
      showToast("Nama berhasil diperbarui!", "success");
      setIsEditProfileModalOpen(false);
    } catch (error) { showToast("Gagal memperbarui profil: " + error.message, "error"); } finally { setProfileLoading(false); }
  };

  const handleDeleteAccount = async (id, name) => {
    const confirmDelete = window.confirm(`PERINGATAN!\nYakin ingin menghapus [${name}]?\nSeluruh riwayat yang memakai dompet ini mungkin akan kehilangan label sumber dananya.`);
    if (!confirmDelete) return;
    try {
      const { error } = await supabase.from('accounts').delete().eq('id', id);
      if (error) throw error;
      showToast(`Sukses menghapus ${name}!`, "success");
      if (fetchData) fetchData();
    } catch (error) { showToast("Gagal menghapus dompet: " + error.message, "error"); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!oldPassword) { showToast("Sandi lama wajib diisi!", "error"); return; }
    if (newPassword.length < 6) { showToast("Kata sandi baru minimal 6 karakter!", "error"); return; }
    
    setPasswordLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: profile.email, password: oldPassword });
      if (signInError) throw new Error("Kata Sandi Lama Anda Salah!");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      showToast("Kata sandi berhasil diamankan & diubah!", "success");
      setOldPassword(""); setNewPassword(""); setIsChangePasswordModalOpen(false);
    } catch (error) { showToast(error.message, "error"); } finally { setPasswordLoading(false); }
  };

  const handleForgotPassword = async () => {
    if (!profile.email || profile.email === "...") return showToast("Data email belum dimuat.", "error");
    try {
      setPasswordLoading(true);
      const { error } = await supabase.auth.resetPasswordForEmail(profile.email);
      if (error) throw error;
      showToast("Tautan reset sandi telah dikirim ke email Anda!", "success");
    } catch (error) { showToast("Gagal kirim email: " + error.message, "error"); } finally { setPasswordLoading(false); }
  };

  const handleToggleBiometric = () => {
    const newValue = !useBiometric;
    setUseBiometric(newValue);
    localStorage.setItem('useBiometric', newValue.toString());
  };

  const handleSaveAiStyle = (styleValue) => {
    setAiStyle(styleValue);
    localStorage.setItem('aiPersona', styleValue);
    setIsAiStyleModalOpen(false);
    showToast("Gaya Bahasa AI berhasil diperbarui!", "success");
  };

  const handleCreateWallet = async (e) => {
    e.preventDefault();
    if (!walletName) return; 
    setWalletLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cleanBalance = walletBalance ? parseFloat(walletBalance.replace(/\./g, "")) : 0;
      const { error } = await supabase.from('accounts').insert([
        { name: walletName, balance: cleanBalance, user_id: user.id, type: walletType, account_group: walletGroup }
      ]);
      if (error) throw error;
      showToast(`Sukses meregistrasi dompet: ${walletName}!`, "success");
      setWalletName(""); setWalletBalance(""); setWalletType("bank"); setWalletGroup("PRIBADI"); setIsWalletModalOpen(false);
      if (fetchData) fetchData();
    } catch (error) { showToast("Gagal menambahkan dompet: " + error.message, "error"); } finally { setWalletLoading(false); }
  };

  const handleCreateCc = async (e) => {
    e.preventDefault();
    if (!ccName || !ccLimit || !ccStatementDate || !ccDueDate) return;
    setCcLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cleanLimit = parseFloat(ccLimit.replace(/\./g, ""));
      const { error } = await supabase.from('accounts').insert([
        { name: `${ccName} (CC)`, balance: 0, user_id: user.id, type: 'cc', credit_limit: cleanLimit, statement_date: parseInt(ccStatementDate), due_date: parseInt(ccDueDate), account_group: ccGroup }
      ]);
      if (error) throw error;
      showToast(`Sukses meregistrasi Kartu Kredit: ${ccName}!`, "success");
      setCcName(""); setCcLimit(""); setCcStatementDate(""); setCcDueDate(""); setCcGroup("PRIBADI"); setIsCcModalOpen(false);
      if (fetchData) fetchData();
    } catch (error) { showToast("Gagal menambahkan Kartu Kredit: " + error.message, "error"); } finally { setCcLoading(false); }
  };

  const handleCreateTarget = async (e) => {
    e.preventDefault();
    if (!targetTitle || !targetAmount || !targetLocation) return;
    setTargetLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const cleanTargetAmount = parseFloat(targetAmount.replace(/\./g, ""));
      const { error } = await supabase.from('savings_targets').insert([
        { user_id: user.id, title: targetTitle, target_amount: cleanTargetAmount, location: targetLocation, status: 'ACTIVE' }
      ]);
      if (error) throw error;
      showToast("Target Tabungan berhasil dibuat!", "success");
      setTargetTitle(""); setTargetAmount(""); setTargetLocation(""); 
      setShowTargetFormModal(false);
      if (fetchData) fetchData(); 
    } catch (error) { showToast("Gagal membuat target: " + error.message, "error"); } finally { setTargetLoading(false); }
  };

  const handleCreateCategory = async (e) => {
    e.preventDefault();
    if (!catName) return;
    setCatLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('categories').insert([{ name: catName, icon: catIcon, user_id: user.id }]);
      if (error) throw error;
      showToast(`Kategori '${catName}' berhasil didaftarkan!`, "success");
      setCatName(""); setCatIcon("box"); setIsCategoryModalOpen(false);
    } catch (error) { showToast("Gagal menambah kategori: " + error.message, "error"); } finally { setCatLoading(false); }
  };

  // FIXED: Bersihkan state lokal saat Logout agar tidak bocor ke sesi berikutnya
  const executeLogout = async () => { 
    setShowLogoutConfirm(false); 
    if (setAccounts) setAccounts([]);
    if (setTransactions) setTransactions([]);
    if (setChatHistory) setChatHistory([]);
    await supabase.auth.signOut(); 
  };

  const iconOptions = [ { id: 'box', icon: <Box size={20}/>, label: 'Umum' }, { id: 'shopping-cart', icon: <ShoppingBag size={20}/>, label: 'Belanja' }, { id: 'utensils', icon: <Coffee size={20}/>, label: 'Konsumsi' }, { id: 'heart', icon: <Heart size={20}/>, label: 'Kesehatan' }, { id: 'monitor', icon: <Monitor size={20}/>, label: 'Digital' }, { id: 'smile', icon: <Smile size={20}/>, label: 'Hiburan' } ];

  return (
    <div className="space-y-6 pb-[100px] animate-in fade-in slide-in-from-bottom-4 relative">
      
      {/* UI NORMAL APLIKASI */}
      <div className="space-y-6">
        {toast.show && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300 w-max max-w-[90vw]">
            <div className={`flex items-center gap-2 px-5 py-3 rounded-full border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] ${toast.type === 'success' ? 'bg-emerald-100' : toast.type === 'error' ? 'bg-rose-100' : 'bg-sky-100'}`}>
              {toast.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
              {toast.type === 'error' && <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />}
              {toast.type === 'info' && <Info size={16} className="text-sky-600 flex-shrink-0" />}
              <span className={`text-[10px] font-black tracking-wide whitespace-nowrap ${toast.type === 'success' ? 'text-emerald-900' : toast.type === 'error' ? 'text-rose-900' : 'text-sky-900'}`}>{toast.message}</span>
            </div>
          </div>
        )}

        <div className="bg-[#1E1E1E] text-white p-5 rounded-3xl border-2 border-[#1E1E1E] shadow-[6px_6px_0px_0px_#10B981] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-5 rounded-full -mr-10 -mt-10 blur-xl"></div>
          <div className="flex items-center gap-4 relative z-10">
            <div className={`w-14 h-14 bg-emerald-400 border-2 border-white flex items-center justify-center flex-shrink-0 shadow-[2px_2px_0px_0px_#ffffff] ${profile.gender === 'Perempuan' ? 'rounded-full' : 'rounded-lg'}`}><User size={28} className="text-[#1E1E1E]" /></div>
            <div className="flex-1 min-w-0">
              <h2 className="font-black text-lg truncate uppercase">{profile.full_name}</h2>
              <p className="text-[10px] font-bold text-stone-400 truncate mb-1">{profile.email}</p>
              <span className="inline-block bg-emerald-500 text-[#1E1E1E] text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">Pro Plan</span>
            </div>
            <button onClick={() => { setEditFullName(profile.full_name); setIsEditProfileModalOpen(true); }} className="w-10 h-10 bg-white/10 hover:bg-white/20 rounded-xl border border-white/20 flex items-center justify-center transition active:scale-95 flex-shrink-0"><Edit3 size={18} className="text-white" /></button>
          </div>
        </div>

        <div className="space-y-1">
          <h3 className="text-[10px] font-black text-stone-500 tracking-widest uppercase pl-2">Pusat Konfigurasi</h3>
          <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl shadow-[4px_4px_0px_0px_#1E1E1E] overflow-hidden">
            <button onClick={() => setShowTargetEduModal(true)} className="w-full flex items-center justify-between p-4 border-b-2 border-[#1E1E1E] hover:bg-stone-50 transition active:bg-stone-100">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-indigo-400 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><Target size={20} className="text-[#1E1E1E]" /></div><span className="text-xs font-black uppercase tracking-wide">Target Tabungan</span></div><ChevronRight size={18} className="text-stone-400" />
            </button>
            <button onClick={() => setIsWalletModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b-2 border-[#1E1E1E] hover:bg-stone-50 transition active:bg-stone-100">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-400 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><Wallet size={20} className="text-[#1E1E1E]" /></div><span className="text-xs font-black uppercase tracking-wide">Registrasi Dompet Baru</span></div><ChevronRight size={18} className="text-stone-400" />
            </button>
            <button onClick={() => setIsCcModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b-2 border-[#1E1E1E] hover:bg-stone-50 transition active:bg-stone-100">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-rose-400 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><CreditCard size={20} className="text-[#1E1E1E]" /></div><span className="text-xs font-black uppercase tracking-wide">Registrasi Kartu Kredit</span></div><ChevronRight size={18} className="text-stone-400" />
            </button>
            <button onClick={() => setIsManageAccountsModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b-2 border-[#1E1E1E] hover:bg-stone-50 transition active:bg-stone-100">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-orange-400 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><Settings size={20} className="text-[#1E1E1E]" /></div><span className="text-xs font-black uppercase tracking-wide">Kelola & Hapus Dompet</span></div><ChevronRight size={18} className="text-stone-400" />
            </button>
            <button onClick={() => setIsCategoryModalOpen(true)} className="w-full flex items-center justify-between p-4 hover:bg-stone-50 transition active:bg-stone-100">
              <div className="flex items-center gap-3"><div className="w-10 h-10 bg-sky-400 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><Tags size={20} className="text-[#1E1E1E]" /></div><span className="text-xs font-black uppercase tracking-wide">Manajemen Kategori</span></div><ChevronRight size={18} className="text-stone-400" />
            </button>
          </div>
        </div>

        <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl shadow-[4px_4px_0px_0px_#1E1E1E] overflow-hidden">
          <button onClick={() => setIsChangePasswordModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b-2 border-[#1E1E1E] hover:bg-stone-50 transition active:bg-stone-100">
            <div className="flex items-center gap-3"><div className="w-10 h-10 bg-stone-300 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><Lock size={20} className="text-[#1E1E1E]" /></div><span className="text-xs font-black uppercase tracking-wide">Ubah Kata Sandi Akun</span></div><ChevronRight size={18} className="text-stone-400" />
          </button>
          <div className="w-full flex items-center justify-between p-4 border-b-2 border-[#1E1E1E]">
            <div className="flex items-center gap-3"><div className="w-10 h-10 bg-amber-400 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><Fingerprint size={20} className="text-[#1E1E1E]" /></div><span className="text-xs font-black uppercase tracking-wide">Kunci Biometrik</span></div>
            <button onClick={handleToggleBiometric} className={`w-12 h-6 rounded-full border-2 border-[#1E1E1E] relative transition-colors ${useBiometric ? 'bg-emerald-500' : 'bg-stone-300'}`}><div className={`absolute top-0.5 w-4 h-4 bg-white border-2 border-[#1E1E1E] rounded-full transition-all ${useBiometric ? 'left-6' : 'left-0.5'}`}></div></button>
          </div>
          <button onClick={() => setIsAiStyleModalOpen(true)} className="w-full flex items-center justify-between p-4 border-b-2 border-[#1E1E1E] hover:bg-stone-50 transition active:bg-stone-100">
            <div className="flex items-center gap-3"><div className="w-10 h-10 bg-purple-400 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><Sparkles size={20} className="text-[#1E1E1E]" /></div><div className="text-left"><span className="block text-xs font-black uppercase tracking-wide">Gaya Bahasa AI</span><span className="block text-[9px] font-bold text-purple-600 mt-0.5 uppercase">{aiStyle === 'skena' ? 'Skena / Santai' : aiStyle === 'bijak' ? 'Konsultan Bijak' : 'Galak & Sarkas'}</span></div></div><ChevronRight size={18} className="text-stone-400" />
          </button>
          
          {/* TOMBOL PUSAT UNDUH LAPORAN */}
          <button onClick={() => setIsReportSelectOpen(true)} className="w-full flex items-center justify-between p-4 hover:bg-emerald-50 transition active:bg-emerald-100">
            <div className="flex items-center gap-3"><div className="w-10 h-10 bg-emerald-400 rounded-xl border-2 border-[#1E1E1E] flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E]"><FileText size={20} className="text-[#1E1E1E]" /></div><span className="text-xs font-black uppercase tracking-wide text-emerald-900">Pusat Rapor & Laporan</span></div><ChevronRight size={18} className="text-emerald-600" />
          </button>
        </div>

        <button onClick={() => setShowLogoutConfirm(true)} className="w-full bg-rose-100 hover:bg-rose-200 text-rose-700 font-black text-xs py-4 rounded-2xl border-2 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] transition active:scale-95 flex items-center justify-center gap-2 mt-4"><LogOut size={18} /> LOGOUT & KELUAR</button>
      </div>

      {/* ========================================== */}
      {/* 1. MODAL PILIH BULAN RAPOR */}
      {/* ========================================== */}
      {isReportSelectOpen && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1E1E1E] space-y-5 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2"><FileText size={18} className="text-emerald-600" /><h4 className="text-xs font-black uppercase tracking-wider">Pilih Bulan Rapor</h4></div>
              <button onClick={() => setIsReportSelectOpen(false)} className="w-7 h-7 bg-stone-200 border border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-stone-300"><X size={14} /></button>
            </div>
            
            <div className="space-y-2 mt-2">
              <input type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} className="w-full p-3 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold outline-none focus:border-emerald-500 transition bg-white" required />
            </div>

            <button onClick={handleOpenReportPreview} disabled={reportLoading || !reportMonth} className="w-full bg-emerald-500 text-[#1E1E1E] p-4 rounded-xl border-2 border-[#1E1E1E] shadow-[3px_3px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none disabled:opacity-50 flex justify-center items-center gap-2">
              {reportLoading ? <Sparkles size={18} className="animate-pulse" /> : <PieChart size={18} />}
              <span className="text-xs font-black uppercase tracking-wider">{reportLoading ? 'MERAKIT DATA...' : 'BUKA RAPOR BULANAN'}</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================== */}
      {/* 2. MODAL LAYAR RAPOR INTERAKTIF */}
      {/* ========================================== */}
      {isReportPreviewOpen && reportData && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] sm:border-4 border-[#1E1E1E] sm:rounded-3xl h-[90vh] sm:h-[85vh] shadow-[0px_-8px_0px_0px_#000] sm:shadow-[8px_8px_0px_0px_#000] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 rounded-t-3xl relative">
            
            {/* STICKY HEADER */}
            <div className="bg-[#FDFBF7] border-b-4 border-[#1E1E1E] p-4 flex justify-between items-center z-10 shrink-0">
              <div>
                <h2 className="text-lg font-black uppercase">Rapor Finansial</h2>
                <p className="text-[10px] font-bold text-stone-500 uppercase">Periode: {reportData.month}</p>
              </div>
              <button onClick={() => setIsReportPreviewOpen(false)} className="w-10 h-10 bg-rose-100 hover:bg-rose-200 border-2 border-[#1E1E1E] rounded-xl flex items-center justify-center transition active:scale-95"><X size={20} className="text-rose-600" /></button>
            </div>

            {/* SCROLLABLE BODY */}
            <div className="p-5 space-y-6 overflow-y-auto flex-1 pb-10 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="border-2 border-[#1E1E1E] p-4 rounded-2xl bg-emerald-50 shadow-[4px_4px_0px_0px_#1E1E1E]">
                  <h3 className="text-[10px] font-black text-emerald-800 uppercase mb-1">Uang Masuk</h3>
                  <p className="text-sm font-black text-emerald-600 truncate">Rp {formatRp(reportData.income)}</p>
                </div>
                <div className="border-2 border-[#1E1E1E] p-4 rounded-2xl bg-rose-50 shadow-[4px_4px_0px_0px_#1E1E1E]">
                  <h3 className="text-[10px] font-black text-rose-800 uppercase mb-1">Uang Keluar</h3>
                  <p className="text-sm font-black text-rose-600 truncate">Rp {formatRp(reportData.expense)}</p>
                </div>
              </div>

              {/* BAR PEMASUKAN */}
              <div className="border-2 border-[#1E1E1E] p-5 rounded-2xl bg-white shadow-[4px_4px_0px_0px_#1E1E1E]">
                <h3 className="text-xs font-black uppercase mb-3 flex items-center gap-2"><Zap size={16} className="text-amber-500"/> Bar Pemasukan</h3>
                <div className="w-full h-6 border-2 border-[#1E1E1E] rounded-full overflow-hidden flex bg-emerald-100">
                  <div style={{ width: `${reportData.ratio}%` }} className="bg-rose-500 h-full border-r-2 border-[#1E1E1E] transition-all duration-1000 ease-out"></div>
                </div>
                <p className="font-bold text-[10px] mt-2 text-stone-500">Pengeluaran memakan <span className="font-black text-rose-600">{reportData.ratio.toFixed(1)}%</span> dari Pemasukan.</p>
              </div>

              {/* FEEDBACK BUAT MU */}
              <div className="border-2 border-amber-400 p-5 rounded-2xl bg-[#FFFBEB] shadow-[4px_4px_0px_0px_#F59E0B]">
                <h3 className="text-xs font-black text-amber-800 uppercase mb-2 flex items-center gap-2"><Sparkles size={16}/> Feedback buat mu</h3>
                <p className="font-bold text-xs leading-relaxed text-amber-900">{reportData.aiRoast}</p>
              </div>

              <div className="border-2 border-[#1E1E1E] p-5 rounded-2xl bg-white shadow-[4px_4px_0px_0px_#1E1E1E]">
                <h3 className="text-xs font-black uppercase mb-4 text-center">Top 5 Bocor Halus</h3>
                <div className="flex justify-center mb-5">
                  <div className="w-32 h-32 rounded-full border-2 border-[#1E1E1E] relative" style={{ background: reportData.conicGradient }}>
                    <div className="absolute inset-0 m-auto w-16 h-16 bg-white border-2 border-[#1E1E1E] rounded-full"></div>
                  </div>
                </div>
                <ul className="space-y-3">
                  {reportData.topCats.map((c, i) => (
                    <li key={i} className="flex justify-between items-center font-bold text-[10px] border-b border-stone-100 pb-2">
                      <span className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border border-[#1E1E1E]" style={{backgroundColor: reportData.colors[i]}}></div> {c.name}</span>
                      <span>Rp {formatRp(c.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* AREA DOWNLOAD DOKUMEN LENGKAP */}
              <div className="pt-2 border-t-2 border-dashed border-stone-300">
                <h3 className="text-[10px] font-black uppercase text-center text-stone-500 mb-4 mt-4">⬇️ UNDUH ARSIP LENGKAP ⬇️</h3>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={handleDownloadFullPDF} className="flex flex-col items-center justify-center gap-2 bg-rose-50 border-2 border-rose-500 text-rose-700 p-4 rounded-xl shadow-[3px_3px_0px_0px_#E11D48] hover:bg-rose-100 transition active:translate-y-1 active:shadow-none">
                    <FileText size={24} />
                    <div className="text-center">
                      <span className="block text-[10px] font-black uppercase tracking-wider">PDF Lengkap</span>
                      <span className="block text-[8px] font-bold mt-0.5">Tabel Transaksi</span>
                    </div>
                  </button>
                  <button onClick={handleDownloadCSV} className="flex flex-col items-center justify-center gap-2 bg-sky-50 border-2 border-sky-500 text-sky-700 p-4 rounded-xl shadow-[3px_3px_0px_0px_#0EA5E9] hover:bg-sky-100 transition active:translate-y-1 active:shadow-none">
                    <DownloadCloud size={24} />
                    <div className="text-center">
                      <span className="block text-[10px] font-black uppercase tracking-wider">CSV Mentahan</span>
                      <span className="block text-[8px] font-bold mt-0.5">Olah Excel</span>
                    </div>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* POP UP EDIT PROFIL DAN MODAL LAINNYA */}
      {isEditProfileModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1E1E1E] space-y-4 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <User size={18} className="text-emerald-600" />
                <h4 className="text-xs font-black uppercase tracking-wider">Edit Profil</h4>
              </div>
              <button onClick={() => setIsEditProfileModalOpen(false)} className="w-7 h-7 bg-stone-200 border border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-stone-300">
                <X size={14} />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProfile} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-stone-500 uppercase">Nama Lengkap</label>
                <input type="text" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} placeholder="Masukkan nama baru" className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold uppercase outline-none focus:border-emerald-500 transition" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-stone-500 uppercase">Alamat Email (Tidak bisa diubah)</label>
                <input type="email" value={profile.email} disabled className="w-full p-2.5 text-xs border-2 border-stone-300 rounded-xl font-bold bg-stone-100 text-stone-400 cursor-not-allowed" />
              </div>
              <button type="submit" disabled={profileLoading} className="w-full bg-emerald-500 text-white font-black text-xs py-3.5 rounded-xl border-2 border-[#1E1E1E] shadow-[3px_3px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none mt-4 disabled:opacity-50">
                {profileLoading ? "MENYIMPAN..." : "SIMPAN PERUBAHAN"}
              </button>
            </form>
          </div>
        </div>
      )}

      {isManageAccountsModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1E1E1E] space-y-4 animate-in slide-in-from-bottom-8 overflow-y-auto max-h-[85vh]">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2"><Settings size={18} className="text-orange-600" /><h4 className="text-xs font-black uppercase tracking-wider">Daftar Dompet / CC</h4></div>
              <button onClick={() => setIsManageAccountsModalOpen(false)} className="w-7 h-7 bg-stone-200 border border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-stone-300"><X size={14} /></button>
            </div>
            <div className="bg-orange-50 p-3 rounded-xl border-2 border-orange-300 border-dashed mb-4"><p className="text-[9px] font-bold text-orange-800 leading-relaxed text-center">Menghapus dompet tidak akan menghapus transaksi lama Anda, tapi sumber dana di transaksi tersebut akan hilang.</p></div>
            <div className="space-y-3">
              {accounts && accounts.length > 0 ? (
                accounts.map(acc => (
                  <div key={acc.id} className="flex items-center justify-between bg-white border-2 border-[#1E1E1E] p-3 rounded-xl shadow-[2px_2px_0px_0px_#1E1E1E]">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase truncate text-[#1E1E1E]">{acc.name}</p>
                      <p className="text-[9px] font-bold text-stone-500 uppercase mt-0.5">{acc.type === 'cc' ? 'Kartu Kredit' : 'Dompet Biasa'}</p>
                    </div>
                    <button onClick={() => handleDeleteAccount(acc.id, acc.name)} className="ml-3 w-8 h-8 bg-rose-100 hover:bg-rose-200 border-2 border-[#1E1E1E] rounded-lg flex items-center justify-center flex-shrink-0 transition active:scale-95"><Trash2 size={14} className="text-rose-600" /></button>
                  </div>
                ))
              ) : (<div className="py-6 text-center text-xs font-bold text-stone-500 border-2 border-dashed border-stone-300 rounded-xl">Belum ada dompet terdaftar.</div>)}
            </div>
          </div>
        </div>
      )}

      {isChangePasswordModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1E1E1E] space-y-4 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2"><Lock size={18} className="text-stone-800" /><h4 className="text-xs font-black uppercase tracking-wider">Ubah Kata Sandi</h4></div>
              <button onClick={() => { setIsChangePasswordModalOpen(false); setOldPassword(""); setNewPassword(""); }} className="w-7 h-7 bg-stone-200 border border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-stone-300"><X size={14} /></button>
            </div>
            <form onSubmit={handleChangePassword} className="space-y-4 mt-2">
              <div className="space-y-1.5">
                <div className="flex justify-between items-end">
                  <label className="text-[10px] font-black text-stone-500 uppercase">Kata Sandi Lama</label>
                  <button type="button" onClick={handleForgotPassword} className="text-[9px] font-black text-rose-500 hover:text-rose-600 uppercase underline">Lupa Sandi?</button>
                </div>
                <input type="password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} placeholder="Ketik sandi saat ini..." className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold outline-none focus:border-stone-800 transition" required />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-stone-500 uppercase">Kata Sandi Baru</label>
                <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Minimal 6 Karakter..." className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold outline-none focus:border-emerald-500 transition" required />
              </div>
              <button type="submit" disabled={passwordLoading} className="w-full bg-[#1E1E1E] text-white font-black text-xs py-3.5 rounded-xl border-2 border-[#1E1E1E] shadow-[3px_3px_0px_0px_#444] hover:bg-stone-800 transition active:translate-y-1 active:shadow-none mt-2 disabled:opacity-50">{passwordLoading ? "MENYIMPAN..." : "UBAH KATA SANDI"}</button>
            </form>
          </div>
        </div>
      )}

      {showTargetEduModal && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] animate-in zoom-in-95">
            <div className="flex justify-between items-center mb-5 border-b-2 border-[#1E1E1E] pb-3">
              <h3 className="text-sm font-black text-[#1E1E1E] uppercase flex items-center gap-2"><Target size={18} className="text-rose-500" /> Set Impianmu</h3>
              <button onClick={() => setShowTargetEduModal(false)} className="w-8 h-8 bg-stone-200 border-2 border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-rose-100 transition active:scale-95"><X size={14} strokeWidth={3} className="text-[#1E1E1E]" /></button>
            </div>
            <div className="space-y-4 mb-6">
              <div className="flex gap-3 items-start"><div className="w-8 h-8 rounded-full bg-rose-100 border-2 border-[#1E1E1E] flex items-center justify-center shrink-0"><Target size={14} className="text-rose-600" /></div><div><h4 className="text-xs font-black text-stone-800 uppercase">1. Tentukan Target</h4><p className="text-[10px] font-bold text-stone-500 leading-relaxed mt-0.5">Mulai dari beli HP sampai Dana Darurat. Tulis juga di mana kamu nyimpen uang fisiknya.</p></div></div>
              <div className="flex gap-3 items-start"><div className="w-8 h-8 rounded-full bg-amber-100 border-2 border-[#1E1E1E] flex items-center justify-center shrink-0"><Zap size={14} className="text-amber-600 fill-amber-500" /></div><div><h4 className="text-xs font-black text-stone-800 uppercase">2. Tantangan AI</h4><p className="text-[10px] font-bold text-stone-500 leading-relaxed mt-0.5">Asisten AI bakal ngasih misi hemat harian biar uang tabunganmu cepet kekumpul.</p></div></div>
              <div className="flex gap-3 items-start"><div className="w-8 h-8 rounded-full bg-emerald-100 border-2 border-[#1E1E1E] flex items-center justify-center shrink-0"><Trophy size={14} className="text-emerald-600" /></div><div><h4 className="text-xs font-black text-stone-800 uppercase">3. Catat Progres</h4><p className="text-[10px] font-bold text-stone-500 leading-relaxed mt-0.5">Uang fisik udah kamu sisihkan? Jangan lupa catat manual progresnya di Papan Skor tabungan!</p></div></div>
            </div>
            <button onClick={() => { setShowTargetEduModal(false); setShowTargetFormModal(true); }} className="w-full bg-rose-500 text-white font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-rose-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2">Lanjut Buat Target <ChevronRight size={16} /></button>
          </div>
        </div>
      )}

      {showTargetFormModal && (
        <div className="fixed inset-0 bg-black/70 z-[1000] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-5"><div className="flex items-center gap-2"><PlusCircle size={20} className="text-rose-500" /><h3 className="text-sm font-black text-[#1E1E1E] uppercase">Target Baru</h3></div><button onClick={() => setShowTargetFormModal(false)} className="w-8 h-8 bg-stone-200 border-2 border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-rose-100 transition active:scale-95"><X size={14} strokeWidth={3} className="text-[#1E1E1E]" /></button></div>
            <form onSubmit={handleCreateTarget} className="space-y-4">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Nama Impian / Target</label><input type="text" value={targetTitle} onChange={(e) => setTargetTitle(e.target.value)} placeholder="Beli Macbook Pro" className="w-full p-3 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold bg-white outline-none shadow-[2px_2px_0px_0px_#1E1E1E] focus:border-rose-500 transition" required /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Nominal Dibutuhkan (Rp)</label><input type="text" inputMode="numeric" value={targetAmount} onChange={(e) => formatRupiahInput(e.target.value, setTargetAmount)} placeholder="15.000.000" className="w-full p-3 text-sm border-2 border-[#1E1E1E] rounded-xl font-black bg-white outline-none shadow-[2px_2px_0px_0px_#1E1E1E] focus:border-emerald-500 transition text-emerald-600" required /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Lokasi Uang Fisik Disimpan</label><input type="text" value={targetLocation} onChange={(e) => setTargetLocation(e.target.value)} placeholder="Reksadana Bibit / BCA Tabungan" className="w-full p-3 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold bg-white outline-none shadow-[2px_2px_0px_0px_#1E1E1E] focus:border-sky-500 transition" required /></div>
              <button type="submit" disabled={targetLoading} className="w-full mt-2 bg-[#1E1E1E] text-white font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#444] hover:bg-stone-800 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">{targetLoading ? "MENYIMPAN..." : "SIMPAN & MULAI HEMAT!"}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL LOGOUT */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xs bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-100 rounded-full border-4 border-[#1E1E1E] flex items-center justify-center mx-auto mb-4"><LogOut size={28} className="text-rose-600" /></div>
            <h3 className="text-sm font-black text-[#1E1E1E] uppercase mb-2">Yakin Ingin Keluar?</h3>
            <p className="text-xs font-bold text-stone-500 mb-6">Sesi Anda akan diakhiri dan harus login kembali.</p>
            <div className="flex gap-3"><button onClick={() => setShowLogoutConfirm(false)} className="flex-1 py-3 bg-stone-200 text-[#1E1E1E] text-xs font-black uppercase rounded-xl border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] active:translate-y-px active:shadow-none">Batal</button><button onClick={executeLogout} className="flex-1 py-3 bg-rose-500 text-white text-xs font-black uppercase rounded-xl border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] active:translate-y-px active:shadow-none">Ya, Keluar</button></div>
          </div>
        </div>
      )}

      {/* MODAL GAYA AI */}
      {isAiStyleModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1E1E1E] space-y-4 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Sparkles size={18} className="text-purple-600" /><h4 className="text-xs font-black uppercase tracking-wider">Persona AI</h4></div><button onClick={() => setIsAiStyleModalOpen(false)} className="w-7 h-7 bg-stone-200 border border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-stone-300"><X size={14} /></button></div>
            <div className="space-y-3">
              <button onClick={() => handleSaveAiStyle('skena')} className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${aiStyle === 'skena' ? 'bg-purple-100 border-purple-600 shadow-[2px_2px_0px_0px_#9333EA]' : 'bg-white border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] hover:bg-stone-50'}`}><h5 className="text-xs font-black text-[#1E1E1E] uppercase">😎 Skena / Santai</h5><p className="text-[10px] text-stone-500 font-bold mt-1">Sapaan "Bosku", asyik, dan gaya bahasa sehari-hari.</p></button>
              <button onClick={() => handleSaveAiStyle('bijak')} className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${aiStyle === 'bijak' ? 'bg-sky-100 border-sky-600 shadow-[2px_2px_0px_0px_#0284C7]' : 'bg-white border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] hover:bg-stone-50'}`}><h5 className="text-xs font-black text-[#1E1E1E] uppercase">🧐 Konsultan Bijak</h5><p className="text-[10px] text-stone-500 font-bold mt-1">Sopan, baku, analitis, dan wawasan layaknya profesional.</p></button>
              <button onClick={() => handleSaveAiStyle('galak')} className={`w-full text-left p-4 rounded-2xl border-2 transition-all ${aiStyle === 'galak' ? 'bg-rose-100 border-rose-600 shadow-[2px_2px_0px_0px_#E11D48]' : 'bg-white border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] hover:bg-stone-50'}`}><h5 className="text-xs font-black text-[#1E1E1E] uppercase">🤬 Galak & Sarkas</h5><p className="text-[10px] text-stone-500 font-bold mt-1">Nge-gas, ketat, dan siap me-roasting pengeluaran Anda.</p></button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REGISTRASI DOMPET */}
      {isWalletModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#F8F5F2] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1E1E1E] space-y-4 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Wallet size={18} className="text-emerald-600" /><h4 className="text-xs font-black uppercase tracking-wider">Registrasi Dompet</h4></div><button onClick={() => setIsWalletModalOpen(false)} className="w-7 h-7 bg-stone-200 border border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-stone-300"><X size={14} /></button></div>
            <form onSubmit={handleCreateWallet} className="space-y-4">
              <div className="space-y-1"><label className="text-[10px] font-black text-stone-500 uppercase">Status Kepemilikan</label><div className="flex gap-1.5 p-1 bg-stone-200 border-2 border-[#1E1E1E] rounded-xl"><button type="button" onClick={() => setWalletGroup("PRIBADI")} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 ${walletGroup === 'PRIBADI' ? 'bg-sky-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 border-transparent text-stone-500 hover:bg-stone-100'}`}>Pribadi</button><button type="button" onClick={() => setWalletGroup("USAHA")} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 ${walletGroup === 'USAHA' ? 'bg-orange-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 border-transparent text-stone-500 hover:bg-stone-100'}`}>Usaha / UMKM</button></div></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-stone-500 uppercase">Tipe Dompet</label><div className="flex gap-1.5 p-1 bg-stone-200 border-2 border-[#1E1E1E] rounded-xl"><button type="button" onClick={() => setWalletType("cash")} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 ${walletType === 'cash' ? 'bg-[#1E1E1E] text-white shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 border-transparent text-stone-500 hover:bg-stone-100'}`}>Tunai</button><button type="button" onClick={() => setWalletType("bank")} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 ${walletType === 'bank' ? 'bg-[#1E1E1E] text-white shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 border-transparent text-stone-500 hover:bg-stone-100'}`}>Bank</button><button type="button" onClick={() => setWalletType("ewallet")} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 ${walletType === 'ewallet' ? 'bg-[#1E1E1E] text-white shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 border-transparent text-stone-500 hover:bg-stone-100'}`}>E-Wallet</button></div></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-stone-500 uppercase">Nama Dompet / Bank</label><input type="text" value={walletName} onChange={(e) => setWalletName(e.target.value)} placeholder="BCA Utama, Cash" className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold uppercase" required /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-stone-500 uppercase">Saldo Awal (Rp) - Boleh Kosong</label><input type="text" inputMode="numeric" value={walletBalance} onChange={(e) => formatRupiahInput(e.target.value, setWalletBalance)} placeholder="25.000" className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold" /></div>
              <button type="submit" disabled={walletLoading} className="w-full bg-emerald-500 text-[#1E1E1E] font-black text-xs py-3 rounded-xl border-2 border-[#1E1E1E] shadow-[3px_3px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition">{walletLoading ? "MENYIMPAN..." : "DAFTARKAN DOMPET"}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REGISTRASI CC */}
      {isCcModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#F8F5F2] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1E1E1E] space-y-4 animate-in slide-in-from-bottom-8 overflow-y-auto max-h-screen">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><CreditCard size={18} className="text-rose-600" /><h4 className="text-xs font-black uppercase tracking-wider text-rose-700">Registrasi CC</h4></div><button onClick={() => setIsCcModalOpen(false)} className="w-7 h-7 bg-stone-200 border border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-stone-300"><X size={14} /></button></div>
            <form onSubmit={handleCreateCc} className="space-y-3">
              <div className="space-y-1"><label className="text-[10px] font-black text-stone-500 uppercase">Status Kepemilikan</label><div className="flex gap-1.5 p-1 bg-stone-200 border-2 border-[#1E1E1E] rounded-xl"><button type="button" onClick={() => setCcGroup("PRIBADI")} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 ${ccGroup === 'PRIBADI' ? 'bg-sky-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 border-transparent text-stone-500 hover:bg-stone-100'}`}>Pribadi</button><button type="button" onClick={() => setCcGroup("USAHA")} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 ${ccGroup === 'USAHA' ? 'bg-orange-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 border-transparent text-stone-500 hover:bg-stone-100'}`}>Usaha / UMKM</button></div></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-stone-500 uppercase">Nama Kartu Kredit</label><input type="text" value={ccName} onChange={(e) => setCcName(e.target.value)} placeholder="Mandiri SKYZ" className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold uppercase" required /></div>
              <div className="space-y-1"><label className="text-[10px] font-black text-rose-600 uppercase">Total Limit Kartu (Rp)</label><input type="text" inputMode="numeric" value={ccLimit} onChange={(e) => formatRupiahInput(e.target.value, setCcLimit)} placeholder="15.000.000" className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold text-rose-700 bg-rose-50" required /></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1"><label className="text-[10px] font-black text-stone-500 uppercase">Tgl Cetak</label><input type="number" min="1" max="31" value={ccStatementDate} onChange={(e) => setCcStatementDate(e.target.value)} placeholder="Tgl (1-31)" className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold" required /></div>
                <div className="space-y-1"><label className="text-[10px] font-black text-stone-500 uppercase">Tgl Tagihan</label><input type="number" min="1" max="31" value={ccDueDate} onChange={(e) => setCcDueDate(e.target.value)} placeholder="Tgl (1-31)" className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold" required /></div>
              </div>
              <button type="submit" disabled={ccLoading} className="w-full bg-rose-500 text-white font-black text-xs py-3 rounded-xl border-2 border-[#1E1E1E] shadow-[3px_3px_0px_0px_#1E1E1E] hover:bg-rose-400 transition mt-2">{ccLoading ? "MENYIMPAN..." : "SIMPAN PROFIL CC"}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL KATEGORI */}
      {isCategoryModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#F8F5F2] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[6px_6px_0px_0px_#1E1E1E] space-y-4 animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center"><div className="flex items-center gap-2"><Tags size={18} className="text-sky-600" /><h4 className="text-xs font-black uppercase tracking-wider">Kategori Kustom</h4></div><button onClick={() => setIsCategoryModalOpen(false)} className="w-7 h-7 bg-stone-200 border border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-stone-300"><X size={14} /></button></div>
            <div className="bg-sky-50 p-3 rounded-xl border-2 border-sky-300 border-dashed"><p className="text-[9px] font-bold text-sky-800 leading-relaxed text-center">Personalisasi pos transaksi agar sesuai dengan gaya hidup dan kebutuhan akuntansi Anda.</p></div>
            <form onSubmit={handleCreateCategory} className="space-y-4 mt-2">
              <div className="space-y-1.5"><label className="text-[10px] font-black text-stone-500 uppercase">Nama Kategori Baru</label><input type="text" value={catName} onChange={(e) => setCatName(e.target.value)} placeholder="Skincare, Mainan, dll" className="w-full p-2.5 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold uppercase outline-none focus:border-sky-500 transition" required /></div>
              <div className="space-y-1.5"><label className="text-[10px] font-black text-stone-500 uppercase">Pilih Visual Ikon</label>
                <div className="grid grid-cols-3 gap-2">
                  {iconOptions.map((opt) => (
                    <button key={opt.id} type="button" onClick={() => setCatIcon(opt.id)} className={`flex flex-col items-center justify-center p-3 border-2 rounded-xl transition ${catIcon === opt.id ? 'bg-[#1E1E1E] text-white border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-white text-stone-500 border-stone-300 hover:bg-stone-50'}`}>
                      {opt.icon}<span className="text-[8px] font-bold mt-1 uppercase">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </div>
              <button type="submit" disabled={catLoading} className="w-full bg-sky-500 text-white font-black text-xs py-3.5 rounded-xl border-2 border-[#1E1E1E] shadow-[3px_3px_0px_0px_#1E1E1E] hover:bg-sky-400 transition active:translate-y-1 active:shadow-none mt-4 disabled:opacity-50">{catLoading ? "MENYIMPAN..." : "DAFTARKAN KATEGORI"}</button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}