import React, { useState, useRef, useEffect } from "react";
import { Sparkles, Flame, BookOpen, Briefcase, History, ChevronRight, X, Wallet, CreditCard, Smartphone, ChevronDown, Target, Zap, TrendingUp, CheckCircle2, AlertCircle, Info, ArrowRight, PieChart } from "lucide-react";
import { supabase } from "../supabaseClient";

export default function BerandaView({ accounts = [], transactions = [], missions = [], savingsTargets = [], fetchData, session, setActiveTab }) {
  const [detailModal, setDetailModal] = useState(null); 
  const [isUmkmOpen, setIsUmkmOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
  const carouselRef = useRef(null);

  // STATE UPDATE PROGRES TABUNGAN
  const [targetToUpdate, setTargetToUpdate] = useState(null);
  const [updateAmount, setUpdateAmount] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  // STATE PEMBAYARAN KARTU KREDIT
  const [ccPayModal, setCcPayModal] = useState(null);
  const [ccPayAmount, setCcPayAmount] = useState("");
  const [ccPaySource, setCcPaySource] = useState("");

  // ==========================================
  // STATE NOTIFIKASI & RAPOR INSTAN
  // ==========================================
  const [showReportNotif, setShowReportNotif] = useState(false);
  const [lastMonthVal, setLastMonthVal] = useState("");
  const [isReportPreviewOpen, setIsReportPreviewOpen] = useState(false);
  const [reportData, setReportData] = useState(null);

  const [toast, setToast] = useState({ show: false, message: "", type: "success" });
  const toastTimeout = useRef(null);

  const showToast = (message, type = "success") => {
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    setToast({ show: true, message, type });
    toastTimeout.current = setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 3000);
  };

  useEffect(() => {
    // 1. LOGIKA RANJAU NOTIFIKASI (ANTI HALU)
    if (!transactions || transactions.length === 0) return;

    const now = new Date();
    let prevM = now.getMonth(); // 0-11
    let prevY = now.getFullYear();
    
    // Jika bulan ini Januari, maka bulan lalu adalah Desember tahun sebelumnya
    if (prevM === 0) {
      prevM = 12;
      prevY -= 1;
    }
    
    const prevMonthString = `${prevY}-${String(prevM).padStart(2, '0')}`;
    setLastMonthVal(prevMonthString);

    // CEK 1: Apakah user sudah melihatnya?
    const lastSeen = localStorage.getItem('last_report_seen');
    // CEK 2: APAKAH ADA TRANSAKSI DI BULAN ITU? (Jangan muncul jika kosong)
    const hasData = transactions.some(t => t.date && t.date.startsWith(prevMonthString));

    if (lastSeen !== prevMonthString && hasData) {
      setShowReportNotif(true);
    }

    return () => { if (toastTimeout.current) clearTimeout(toastTimeout.current); };
  }, [transactions]);

  // FUNGSI AKSI NOTIFIKASI RAPOR
  const dismissReportNotif = () => {
    localStorage.setItem('last_report_seen', lastMonthVal);
    setShowReportNotif(false);
  };

  const handleOpenReportFromNotif = () => {
    try {
      const monthTx = transactions.filter(t => t.date && t.date.startsWith(lastMonthVal));
      const income = monthTx.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + Number(t.amount), 0);
      const expense = monthTx.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + Number(t.amount), 0);
      const ratio = income > 0 ? Math.min((expense / income) * 100, 100) : (expense > 0 ? 100 : 0);

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

      setReportData({ month: lastMonthVal, income, expense, ratio, topCats, colors, conicGradient });
      setIsReportPreviewOpen(true);
      dismissReportNotif(); 
    } catch (error) {
      showToast("Gagal memuat rapor.", "error");
    }
  };

  const formatRp = (value) => {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(value || 0);
  };

  const formatRupiahInput = (value, setterFunction) => {
    const numericValue = value.replace(/[^0-9]/g, "");
    if (!numericValue) { setterFunction(""); return; }
    setterFunction(Number(numericValue).toLocaleString("id-ID"));
  };

  const isPribadi = (acc) => !acc.account_group || acc.account_group.toUpperCase() === "PRIBADI";
  const isUsaha = (acc) => acc.account_group && acc.account_group.toUpperCase() === "USAHA";

  const cashPribadi = accounts.filter(a => isPribadi(a) && a.type?.toLowerCase() === "cash");
  const bankPribadi = accounts.filter(a => isPribadi(a) && a.type?.toLowerCase() === "bank");
  const ewalletPribadi = accounts.filter(a => isPribadi(a) && a.type?.toLowerCase() === "ewallet");
  const ccPribadi = accounts.filter(a => isPribadi(a) && a.type?.toLowerCase() === "cc");

  const cashUsaha = accounts.filter(a => isUsaha(a) && a.type?.toLowerCase() === "cash");
  const bankUsaha = accounts.filter(a => isUsaha(a) && a.type?.toLowerCase() === "bank");
  const ewalletUsaha = accounts.filter(a => isUsaha(a) && a.type?.toLowerCase() === "ewallet");
  const ccUsaha = accounts.filter(a => isUsaha(a) && a.type?.toLowerCase() === "cc");

  const paymentSources = accounts.filter(a => a.type?.toLowerCase() !== "cc");

  const sumBalance = (arr) => arr.reduce((sum, acc) => sum + Number(acc.balance || 0), 0);
  const sumLimit = (arr) => arr.reduce((sum, acc) => sum + Number(acc.credit_limit || 0), 0);
  const sumCcDebt = (arr) => arr.reduce((sum, acc) => sum + Math.abs(Number(acc.balance || 0)), 0);

  const totalCashP = sumBalance(cashPribadi);
  const totalBankP = sumBalance(bankPribadi);
  const totalEwalletP = sumBalance(ewalletPribadi);
  const totalCcDebtP = sumCcDebt(ccPribadi); 
  const totalCcLimitP = sumLimit(ccPribadi);
  
  // ✅ LOGIKA NET WORTH SUDAH DIPERBAIKI (MEMOTONG UTANG CC):
  const netWorthPribadi = totalCashP + totalBankP + totalEwalletP - totalCcDebtP; 

  const totalCashU = sumBalance(cashUsaha);
  const totalBankU = sumBalance(bankUsaha);
  const totalEwalletU = sumBalance(ewalletUsaha);
  const totalCcDebtU = sumCcDebt(ccUsaha);
  const totalCcLimitU = sumLimit(ccUsaha);
  const netWorthUsaha = totalCashU + totalBankU + totalEwalletU - totalCcDebtU;

  const recentTransactions = transactions.slice(0, 5);

  const goToBukuLog = () => { if (setActiveTab) setActiveTab("activity"); };
  const goToKlaim = () => { localStorage.setItem("targetBukuLogTab", "reimburse"); if (setActiveTab) setActiveTab("activity"); };

  const klaimExpense = transactions.filter(tx => tx.type === 'EXPENSE' && (tx.is_reimbursement === true || (tx.title || '').toUpperCase().includes("[KLAIM]"))).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const klaimIncome = transactions.filter(tx => tx.type === 'INCOME' && (tx.category === 'Reimbursement Paid' || (tx.title || '').toUpperCase().includes("[CAIR]"))).reduce((sum, tx) => sum + Number(tx.amount || 0), 0);
  const totalTalanganPribadi = klaimExpense - klaimIncome;
  const finalTalangan = totalTalanganPribadi > 0 ? totalTalanganPribadi : 0;

  const todayDay = new Date().getDate();
  const dueCreditCards = [...ccPribadi, ...ccUsaha].filter(cc => {
    if (!cc.statement_date || !cc.due_date || Number(cc.balance) === 0) return false;
    const sd = parseInt(cc.statement_date);
    const dd = parseInt(cc.due_date);
    if (sd < dd) return todayDay >= sd && todayDay <= dd;
    else return todayDay >= sd || todayDay <= dd;
  });

  const isMisiVisible = missions && missions.some(m => m.is_active);
  const activeMission = missions && missions.find(m => m.is_active);
  const activeTargets = savingsTargets ? savingsTargets.filter(t => t.status === 'ACTIVE') : [];

  const carouselItems = [];
  if (activeTargets.length > 0) activeTargets.forEach(t => carouselItems.push({ type: 'tabungan', data: t }));
  if (isMisiVisible && activeMission) carouselItems.push({ type: 'misi', data: activeMission });

  const showFokusSection = carouselItems.length > 0;

  const handleScroll = () => {
    if (carouselRef.current) {
      const scrollPosition = carouselRef.current.scrollLeft;
      const width = carouselRef.current.offsetWidth;
      setCurrentSlide(Math.round(scrollPosition / width));
    }
  };

  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    if (!updateAmount || !targetToUpdate) return;
    setIsUpdating(true);
    try {
      const cleanInput = parseFloat(updateAmount.replace(/\./g, ""));
      const newCollected = Number(targetToUpdate.collected_amount || 0) + cleanInput;
      const { error } = await supabase.from('savings_targets').update({ collected_amount: newCollected }).eq('id', targetToUpdate.id);
      if (error) throw error;
      showToast(`Progres Rp ${cleanInput.toLocaleString('id-ID')} dicatat! Amankan fisiknya di ${targetToUpdate.location} ya!`, "success");
      setTargetToUpdate(null); setUpdateAmount("");
      if (fetchData) fetchData();
    } catch (err) {
      showToast("Gagal mengupdate progres: " + err.message, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const handlePayCreditCard = async (e) => {
    e.preventDefault();
    if (!ccPayAmount || !ccPaySource || !ccPayModal) return;
    
    setIsUpdating(true);
    try {
      const amountPaid = parseFloat(ccPayAmount.replace(/\./g, "")); 
      const sourceAcc = accounts.find(a => a.id === ccPaySource);
      
      if (!sourceAcc) {
        showToast("Rekening sumber pembayaran tidak ditemukan!", "error");
        setIsUpdating(false);
        return;
      }

      const currentDebt = Math.abs(Number(ccPayModal.balance || 0)); 

      let debtCleared = 0;
      let adminFee = 0;

      if (amountPaid > currentDebt) {
        debtCleared = currentDebt; 
        adminFee = amountPaid - currentDebt; 
      } else {
        debtCleared = amountPaid; 
        adminFee = 0;
      }

      const newSourceBalance = Number(sourceAcc.balance || 0) - amountPaid;
      await supabase.from('accounts').update({ balance: newSourceBalance }).eq('id', sourceAcc.id);

      const newCcBalance = Number(ccPayModal.balance || 0) + debtCleared;
      await supabase.from('accounts').update({ balance: newCcBalance }).eq('id', ccPayModal.id);

      let titleTx = `Bayar Tagihan ${ccPayModal.name}`;
      if (adminFee > 0) {
        titleTx += ` (Termasuk Biaya Admin: Rp ${adminFee.toLocaleString('id-ID')})`;
      }

      let currentUserId = session?.user?.id;
      if (!currentUserId) {
        const { data: { session: activeSession } } = await supabase.auth.getSession();
        currentUserId = activeSession?.user?.id;
      }

      if (!currentUserId) throw new Error("Sesi pengguna tidak valid.");

      await supabase.from('transactions').insert([{
        user_id: currentUserId,
        account_id: sourceAcc.id,
        type: 'EXPENSE',
        amount: amountPaid,
        title: titleTx,
        category: 'Pembayaran CC',
        date: new Date().toISOString().split('T')[0]
      }]);

      showToast(`Pembayaran Rp ${amountPaid.toLocaleString('id-ID')} berhasil! Limit disesuaikan.`, "success");
      setCcPayModal(null);
      setCcPayAmount("");
      setCcPaySource("");
      if (fetchData) fetchData();

    } catch (err) {
      showToast("Gagal memproses pembayaran: " + err.message, "error");
    } finally {
      setIsUpdating(false);
    }
  };

  const getModalTitle = () => {
    if (detailModal === 'bank' || detailModal === 'bank_usaha') return "DAFTAR BANK";
    if (detailModal === 'ewallet' || detailModal === 'ewallet_usaha') return "DAFTAR E-WALLET";
    if (detailModal === 'cc' || detailModal === 'cc_usaha') return "DAFTAR KARTU KREDIT";
    if (detailModal === 'cash' || detailModal === 'cash_usaha') return "DAFTAR UANG TUNAI";
    return "DAFTAR ASET";
  };

  let activeModalList = [];
  if (detailModal === 'bank') activeModalList = bankPribadi;
  else if (detailModal === 'ewallet') activeModalList = ewalletPribadi;
  else if (detailModal === 'cc') activeModalList = ccPribadi;
  else if (detailModal === 'cash') activeModalList = cashPribadi;
  else if (detailModal === 'bank_usaha') activeModalList = bankUsaha;
  else if (detailModal === 'ewallet_usaha') activeModalList = ewalletUsaha;
  else if (detailModal === 'cc_usaha') activeModalList = ccUsaha;
  else if (detailModal === 'cash_usaha') activeModalList = cashUsaha;

  return (
    <div className="space-y-6 pb-[90px] animate-in fade-in slide-in-from-bottom-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full overflow-x-hidden relative">
      
      {toast.show && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[9999] flex justify-center px-4 pointer-events-none animate-in slide-in-from-bottom-5 fade-in duration-300 w-max max-w-[90vw]">
          <div className={`flex items-center gap-2 px-5 py-3 rounded-full border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] ${toast.type === 'success' ? 'bg-emerald-100' : toast.type === 'error' ? 'bg-rose-100' : 'bg-sky-100'}`}>
            {toast.type === 'success' && <CheckCircle2 size={16} className="text-emerald-600 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle size={16} className="text-rose-600 flex-shrink-0" />}
            {toast.type === 'info' && <Info size={16} className="text-sky-600 flex-shrink-0" />}
            <span className={`text-[10px] font-black tracking-wide whitespace-nowrap ${toast.type === 'success' ? 'text-emerald-900' : toast.type === 'error' ? 'text-rose-900' : 'text-sky-900'}`}>
              {toast.message}
            </span>
          </div>
        </div>
      )}

      {/* BANNER NOTIFIKASI RAPOR */}
      {showReportNotif && (
        <div className="bg-purple-100 border-4 border-purple-500 p-5 rounded-3xl shadow-[4px_4px_0px_0px_#9333EA] animate-in slide-in-from-top-4 relative overflow-hidden mb-2">
          <div className="absolute top-[-20px] right-[-20px] opacity-20"><Sparkles size={120} className="text-purple-600 animate-pulse"/></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-2xl drop-shadow-md">🎉</span>
              <h3 className="text-sm font-black text-purple-900 uppercase tracking-widest">Woy Bosku!</h3>
            </div>
            <p className="text-xs font-bold text-purple-800 leading-relaxed mb-5 pr-4">
              Rapor Finansial bulan lalu <span className="font-black underline bg-purple-200 px-1 rounded">({lastMonthVal})</span> udah terbit nih! Udah siap lihat seberapa kalcer arus kasmu?
            </p>
            <div className="flex gap-3">
              <button onClick={handleOpenReportFromNotif} className="flex-1 bg-purple-500 text-white text-[10px] font-black uppercase py-3 rounded-xl border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] hover:bg-purple-400 active:translate-y-px active:shadow-none transition flex justify-center items-center gap-1">
                <Flame size={14} /> LIHAT RAPOR
              </button>
              <button onClick={dismissReportNotif} className="flex-1 bg-white text-purple-900 text-[10px] font-black uppercase py-3 rounded-xl border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] hover:bg-stone-100 active:translate-y-px active:shadow-none transition">
                NANTI AJA
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BANNER NOTIFIKASI TAGIHAN KARTU KREDIT */}
      {dueCreditCards.length > 0 && (
        <div className="bg-rose-100 border-4 border-rose-500 p-4 rounded-2xl shadow-[4px_4px_0px_0px_#E11D48] animate-in slide-in-from-top-4 flex items-start gap-3">
          <div className="w-10 h-10 bg-white rounded-xl border-2 border-rose-500 flex items-center justify-center shrink-0">
            <AlertCircle size={20} className="text-rose-600 animate-pulse" />
          </div>
          <div>
            <h3 className="text-xs font-black text-rose-800 uppercase tracking-widest">Peringatan Tagihan</h3>
            <p className="text-[10px] font-bold text-rose-700 leading-relaxed mt-0.5">
              Anda memiliki {dueCreditCards.length} tagihan Kartu Kredit yang masuk masa pembayaran. Segera siapkan dana!
            </p>
            <button onClick={() => setDetailModal(isUsaha(dueCreditCards[0]) ? 'cc_usaha' : 'cc')} className="text-[10px] font-black text-rose-600 underline mt-2 uppercase">Lihat Detail Tagihan</button>
          </div>
        </div>
      )}

      {showFokusSection && (
        <div className="w-full">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-4 bg-amber-500 rounded-full"></div>
            <h2 className="text-xs font-black uppercase tracking-widest text-[#1E1E1E]">Fokus & Tantangan</h2>
          </div>
          
          <div ref={carouselRef} onScroll={handleScroll} className="flex overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] w-full">
            {carouselItems.map((item, index) => {
              if (item.type === 'tabungan') {
                const tab = item.data;
                const percent = Math.min(100, Math.round(((tab.collected_amount || 0) / (tab.target_amount || 1)) * 100));
                return (
                  <div key={`tab-${tab.id}`} className="w-full min-w-full shrink-0 snap-center px-1 pb-2">
                    <div className="bg-white border-4 border-[#1E1E1E] p-5 rounded-3xl shadow-[4px_4px_0px_0px_#1E1E1E] flex flex-col justify-between h-full">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center border-2 border-[#1E1E1E] shrink-0">
                            <Target size={16} className="text-rose-500"/>
                          </div>
                          <div>
                            <h3 className="text-[11px] font-black uppercase tracking-widest text-[#1E1E1E] truncate max-w-[130px]">{tab.title}</h3>
                            <p className="text-[9px] font-bold text-stone-500 uppercase tracking-widest mt-0.5 truncate max-w-[130px]">Simpanan: {tab.location || "Belum diset"}</p>
                          </div>
                        </div>
                        <span className="text-[11px] font-black bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded border-2 border-[#1E1E1E]">{percent}%</span>
                      </div>
                      
                      <div className="mb-4">
                        <div className="w-full bg-stone-200 rounded-full h-4 border-2 border-[#1E1E1E] overflow-hidden mb-2">
                          <div className="bg-emerald-500 h-full border-r-2 border-[#1E1E1E] transition-all duration-1000 ease-out" style={{ width: `${percent}%` }}></div>
                        </div>
                        <p className="text-[10px] font-bold text-stone-500 text-center uppercase tracking-widest">Terkumpul: <span className="text-[#1E1E1E] font-black">{formatRp(tab.collected_amount)}</span> / {formatRp(tab.target_amount)}</p>
                      </div>

                      <button onClick={() => setTargetToUpdate(tab)} className="w-full bg-emerald-50 text-emerald-700 border-2 border-emerald-500 font-black text-[10px] uppercase py-2.5 rounded-xl hover:bg-emerald-100 transition active:scale-95 flex items-center justify-center gap-1.5">
                        <TrendingUp size={14} /> Catat Progres Baru
                      </button>
                    </div>
                  </div>
                )
              } else {
                const misi = item.data;
                return (
                  <div key="misi-card" className="w-full min-w-full shrink-0 snap-center px-1 pb-2">
                    <div className="bg-gradient-to-r from-orange-500 to-amber-500 border-4 border-[#1E1E1E] p-5 rounded-3xl shadow-[4px_4px_0px_0px_#1E1E1E] text-[#1E1E1E] flex flex-col justify-between h-full">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center border-2 border-[#1E1E1E] shrink-0">
                          <Zap size={16} className="text-amber-500 fill-amber-500" />
                        </div>
                        <div>
                          <h3 className="text-[11px] font-black uppercase tracking-widest text-white drop-shadow-md">Tantangan AI</h3>
                          <p className="text-[12px] font-black text-[#1E1E1E] mt-0.5 max-w-[200px] truncate">{misi.title}</p>
                        </div>
                      </div>
                      <div className="bg-white/20 p-3 rounded-xl border-2 border-[#1E1E1E] backdrop-blur-sm mt-auto">
                        <p className="text-xs font-black mb-2 flex items-center justify-between">
                          <span>🔥 {misi.current_streak || 0} Hari Berhasil!</span>
                          <span className="text-[9px] uppercase tracking-widest bg-white/50 px-2 py-0.5 rounded">Target: {misi.duration_days || 7} Hari</span>
                        </p>
                        <div className="flex gap-1.5 w-full">
                          {Array.from({length: misi.duration_days || 7}).map((_, i) => (
                            <div key={i} className={`flex-1 h-2 rounded-full border-2 border-[#1E1E1E] shadow-sm ${i < (misi.current_streak || 0) ? 'bg-white' : 'bg-amber-600/30'}`}></div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              }
            })}
          </div>

          {carouselItems.length > 1 && (
            <div className="flex justify-center gap-1.5 mt-1 mb-2">
              {carouselItems.map((_, idx) => (
                <div key={idx} className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === idx ? 'w-4 bg-amber-500' : 'w-1.5 bg-stone-300'}`}></div>
              ))}
            </div>
          )}
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-1.5 h-4 bg-emerald-500 rounded-full"></div>
          <h2 className="text-xs font-black uppercase tracking-widest text-[#1E1E1E]">Finansial Pribadi & Keluarga</h2>
        </div>

        <div className="bg-white border-4 border-[#1E1E1E] p-5 rounded-3xl shadow-[6px_6px_0px_0px_#1E1E1E] mb-6">
          <p className="text-[10px] font-black text-stone-500 tracking-widest uppercase mb-1">Kekayaan Bersih Pribadi</p>
          <h1 className="text-3xl font-black text-emerald-500 truncate">{formatRp(netWorthPribadi)}</h1>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0px_0px_#1E1E1E]">
            <span className="inline-block border-2 border-stone-300 text-stone-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-2">CASH</span>
            <p className="text-[10px] font-black text-[#1E1E1E]">Uang Tunai</p>
            <p className="text-sm font-black text-[#1E1E1E] mt-2">{formatRp(totalCashP)}</p>
          </div>
          <div className="bg-white border-2 border-emerald-400 border-dashed rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <span className="inline-block bg-emerald-100 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-2">BANK</span>
              <p className="text-[10px] font-black text-[#1E1E1E]">Total Bank <span onClick={() => setDetailModal('bank')} className="text-[8px] text-emerald-600 font-bold underline cursor-pointer hover:text-emerald-700 transition">(Lihat Bank)</span></p>
            </div>
            <p className="text-sm font-black text-[#1E1E1E] mt-2 truncate">{formatRp(totalBankP)}</p>
          </div>
          <div className="bg-white border-2 border-stone-300 border-dashed rounded-2xl p-4">
            <span className="inline-block border-2 border-stone-300 text-stone-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-2">E-WALLET</span>
            <p className="text-[10px] font-black text-[#1E1E1E]">Total E-Wallet <span onClick={() => setDetailModal('ewallet')} className="text-[8px] text-stone-500 font-bold underline cursor-pointer hover:text-stone-700 transition">(Lihat E-Wallet)</span></p>
            <p className="text-sm font-black text-[#1E1E1E] mt-2">{formatRp(totalEwalletP)}</p>
          </div>
          <div className="bg-white border-2 border-rose-400 border-dashed rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <span className="inline-block bg-rose-100 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-2">LIABILITAS CC</span>
              <p className="text-[10px] font-black text-[#1E1E1E]">Total CC <span onClick={() => setDetailModal('cc')} className="text-[8px] text-rose-500 font-bold underline cursor-pointer hover:text-rose-700 transition">(Lihat Kartu)</span></p>
            </div>
            <div>
              <p className="text-sm font-black text-rose-600 mt-1 truncate">{formatRp(totalCcDebtP)}</p>
              <p className="text-[8px] font-bold text-stone-400 truncate mt-0.5">Limit: {formatRp(totalCcLimitP)}</p>
            </div>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex justify-between items-end mb-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <BookOpen size={14} className="text-sky-600" />
                <h3 className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Dana Reimbursement Kantor</h3>
              </div>
              <p className="text-[9px] font-bold text-stone-400 uppercase tracking-widest">Pending Klaim Kantor</p>
            </div>
            <span className={`text-xl font-black ${finalTalangan > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>{formatRp(finalTalangan)}</span>
          </div>
          <button onClick={goToKlaim} className="w-full bg-[#FDFBF7] border-4 border-[#1E1E1E] p-4 rounded-2xl font-black text-xs hover:bg-stone-100 transition active:scale-95 shadow-[4px_4px_0px_0px_#1E1E1E]">
            KELOLA REIMBURSEMENT
          </button>
        </div>
      </div>

      <div>
        <button onClick={() => setIsUmkmOpen(!isUmkmOpen)} className="w-full flex justify-between items-center bg-[#1E1E1E] text-white p-4 rounded-2xl shadow-[4px_4px_0px_0px_#D6D3D1] mb-4 transition active:scale-95">
          <div className="flex items-center gap-2">
            <Briefcase size={16} className="text-orange-400" />
            <h2 className="text-[10px] font-black uppercase tracking-widest">Operasional Usaha / UMKM</h2>
          </div>
          <ChevronDown size={18} className={`transition-transform duration-300 ${isUmkmOpen ? 'rotate-180' : ''}`} />
        </button>

        {isUmkmOpen && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-300 space-y-6">
            <div className="bg-white border-4 border-[#1E1E1E] p-5 rounded-3xl shadow-[6px_6px_0px_0px_#1E1E1E]">
              <p className="text-[10px] font-black text-stone-500 tracking-widest uppercase mb-1">Kekayaan Bersih Usaha</p>
              <h1 className="text-3xl font-black text-orange-500 truncate">{formatRp(netWorthUsaha)}</h1>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-8">
              <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl p-4 shadow-[4px_4px_0px_0px_#1E1E1E]">
                <span className="inline-block border-2 border-stone-300 text-stone-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-2">CASH</span><p className="text-[10px] font-black text-[#1E1E1E]">Uang Tunai</p><p className="text-sm font-black text-[#1E1E1E] mt-2">{formatRp(totalCashU)}</p>
              </div>
              <div className="bg-white border-2 border-emerald-400 border-dashed rounded-2xl p-4 flex flex-col justify-between">
                <div><span className="inline-block bg-emerald-100 text-emerald-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-2">BANK</span><p className="text-[10px] font-black text-[#1E1E1E]">Total Bank <span onClick={() => setDetailModal('bank_usaha')} className="text-[8px] text-emerald-600 font-bold underline cursor-pointer hover:text-emerald-700 transition">(Lihat Bank)</span></p></div><p className="text-sm font-black text-[#1E1E1E] mt-2">{formatRp(totalBankU)}</p>
              </div>
              <div className="bg-white border-2 border-stone-300 border-dashed rounded-2xl p-4">
                <span className="inline-block border-2 border-stone-300 text-stone-500 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-2">E-WALLET</span><p className="text-[10px] font-black text-[#1E1E1E]">Total E-Wallet <span onClick={() => setDetailModal('ewallet_usaha')} className="text-[8px] text-stone-500 font-bold underline cursor-pointer hover:text-stone-700 transition">(Lihat E-Wallet)</span></p><p className="text-sm font-black text-[#1E1E1E] mt-2">{formatRp(totalEwalletU)}</p>
              </div>
              <div className="bg-white border-2 border-rose-400 border-dashed rounded-2xl p-4 flex flex-col justify-between">
                <div><span className="inline-block bg-rose-100 text-rose-600 text-[8px] font-black px-1.5 py-0.5 rounded uppercase mb-2">LIABILITAS CC</span><p className="text-[10px] font-black text-[#1E1E1E]">Total CC <span onClick={() => setDetailModal('cc_usaha')} className="text-[8px] text-rose-500 font-bold underline cursor-pointer hover:text-rose-700 transition">(Lihat Kartu)</span></p></div><p className="text-sm font-black text-rose-600 mt-2">{formatRp(totalCcDebtU)}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-4 mt-2">
          <div className="w-1.5 h-4 bg-indigo-500 rounded-full"></div>
          <History size={14} className="text-indigo-600" />
          <h2 className="text-xs font-black uppercase tracking-widest text-[#1E1E1E]">Aktivitas Terbaru</h2>
        </div>
        <div className="mb-4">
          {recentTransactions.length === 0 ? (
            <div className="border-2 border-dashed border-stone-300 rounded-2xl p-6 text-center"><p className="text-xs font-bold text-stone-400">Belum ada transaksi tercatat.</p><p className="text-[10px] text-stone-400 mt-1">Lapor ke Asisten Pintar untuk mulai mencatat!</p></div>
          ) : (
            <div className="space-y-3">
              {recentTransactions.map((tx, idx) => (
                <div key={idx} className="bg-white border-2 border-[#1E1E1E] p-4 rounded-xl flex justify-between items-center shadow-[3px_3px_0px_0px_#1E1E1E]">
                  <div><p className="text-xs font-black text-[#1E1E1E] truncate max-w-[150px]">{tx.title || tx.description || tx.category || "Transaksi"}</p><p className="text-[10px] font-bold text-stone-500 mt-0.5">{new Date(tx.date || tx.created_at).toLocaleDateString('id-ID')}</p></div>
                  <p className={`text-sm font-black ${tx.type === 'INCOME' || tx.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>{tx.type === 'INCOME' || tx.type === 'income' ? '+' : '-'}{formatRp(tx.amount)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
        <button onClick={goToBukuLog} className="w-full bg-[#FDFBF7] border-4 border-[#1E1E1E] p-4 rounded-2xl flex items-center justify-between hover:bg-stone-100 transition active:scale-95 shadow-[4px_4px_0px_0px_#1E1E1E]"><span className="text-[10px] font-black uppercase tracking-widest text-[#1E1E1E]">Lihat Transaksi Lengkap</span><ChevronRight size={18} className="text-[#1E1E1E]" /></button>
      </div>

      {/* POP-UP DETAIL ASET & LIABILITAS */}
      {detailModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl shadow-[6px_6px_0px_0px_#1E1E1E] overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center p-5 border-b-2 border-[#1E1E1E] bg-white">
              <div className="flex items-center gap-2">
                {detailModal.includes('cc') ? <CreditCard size={18} className="text-rose-600"/> : detailModal.includes('ewallet') ? <Smartphone size={18} className="text-sky-600"/> : <Wallet size={18} className="text-emerald-600"/>}
                <h3 className="text-xs font-black uppercase tracking-wider text-[#1E1E1E]">{getModalTitle()}</h3>
              </div>
              <button onClick={() => setDetailModal(null)} className="w-8 h-8 bg-stone-200 hover:bg-stone-300 border-2 border-[#1E1E1E] rounded-lg flex items-center justify-center transition active:scale-95"><X size={16} className="text-[#1E1E1E]" /></button>
            </div>
            <div className="p-5 overflow-y-auto flex-1 space-y-3 bg-stone-50 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {activeModalList.length === 0 ? (
                <p className="text-center text-xs font-bold text-stone-400 py-8">Belum ada akun yang terdaftar.</p>
              ) : (
                activeModalList.map(acc => {
                  if (acc.type?.toLowerCase() === 'cc') {
                    const isDue = todayDay >= parseInt(acc.statement_date || 1) && todayDay <= parseInt(acc.due_date || 30);
                    return (
                      <div key={acc.id} className="bg-white border-2 border-[#1E1E1E] rounded-2xl p-4 shadow-[3px_3px_0px_0px_#1E1E1E]">
                        <div className="flex justify-between items-start mb-3">
                          <h4 className="text-xs font-black uppercase text-[#1E1E1E] pr-2">{acc.name}</h4>
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded flex-shrink-0 ${isDue ? 'text-rose-600 bg-rose-100 animate-pulse' : 'text-stone-500 bg-stone-200'}`}>
                            Tgl: {acc.due_date || '-'}
                          </span>
                        </div>
                        <div className="flex justify-between items-end border-t border-dashed border-stone-300 pt-3">
                          <div><p className="text-[9px] font-black text-stone-500 uppercase">Tagihan</p><p className="text-sm font-black text-rose-600">{formatRp(Math.abs(acc.balance || 0))}</p></div>
                          <div className="text-right"><p className="text-[9px] font-black text-stone-500 uppercase">Sisa Limit</p><p className="text-sm font-black text-emerald-600">{formatRp(Number(acc.credit_limit || 0) - Math.abs(Number(acc.balance || 0)))}</p></div>
                        </div>
                        
                        <button onClick={() => { setDetailModal(null); setCcPayModal(acc); }} className="w-full mt-4 bg-rose-50 hover:bg-rose-100 text-rose-600 border-2 border-rose-500 font-black text-[10px] uppercase py-2.5 rounded-xl transition active:scale-95 flex items-center justify-center gap-1.5">
                          Bayar Tagihan
                        </button>
                      </div>
                    );
                  } else {
                    return (
                      <div key={acc.id} className="bg-white border-2 border-[#1E1E1E] rounded-2xl p-4 flex justify-between items-center shadow-[3px_3px_0px_0px_#1E1E1E]">
                        <div><h4 className="text-xs font-black uppercase text-[#1E1E1E]">{acc.name}</h4><p className="text-[10px] font-bold text-emerald-600">Aktif</p></div><p className="text-sm font-black text-[#1E1E1E]">{formatRp(acc.balance)}</p>
                      </div>
                    );
                  }
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL LAYAR RAPOR INTERAKTIF */}
      {isReportPreviewOpen && reportData && (
        <div className="fixed inset-0 bg-black/80 z-[1000] flex items-end sm:items-center justify-center sm:p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] sm:border-4 border-[#1E1E1E] sm:rounded-3xl h-[90vh] sm:h-[85vh] shadow-[0px_-8px_0px_0px_#000] sm:shadow-[8px_8px_0px_0px_#000] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 rounded-t-3xl relative">
            
            <div className="bg-[#FDFBF7] border-b-4 border-[#1E1E1E] p-4 flex justify-between items-center z-10 shrink-0">
              <div>
                <h2 className="text-lg font-black uppercase">Rapor Finansial</h2>
                <p className="text-[10px] font-bold text-stone-500 uppercase">Periode: {reportData.month}</p>
              </div>
              <button onClick={() => setIsReportPreviewOpen(false)} className="w-10 h-10 bg-rose-100 hover:bg-rose-200 border-2 border-[#1E1E1E] rounded-xl flex items-center justify-center transition active:scale-95"><X size={20} className="text-rose-600" /></button>
            </div>

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

              <div className="border-2 border-[#1E1E1E] p-5 rounded-2xl bg-white shadow-[4px_4px_0px_0px_#1E1E1E]">
                <h3 className="text-xs font-black uppercase mb-3 flex items-center gap-2"><Zap size={16} className="text-amber-500"/> Bar Pemasukan</h3>
                <div className="w-full h-6 border-2 border-[#1E1E1E] rounded-full overflow-hidden flex bg-emerald-100">
                  <div style={{ width: `${reportData.ratio}%` }} className="bg-rose-500 h-full border-r-2 border-[#1E1E1E] transition-all duration-1000 ease-out"></div>
                </div>
                <p className="font-bold text-[10px] mt-2 text-stone-500">Pengeluaran memakan <span className="font-black text-rose-600">{reportData.ratio.toFixed(1)}%</span> dari Pemasukan.</p>
              </div>

              <div className="border-2 border-amber-400 p-5 rounded-2xl bg-[#FFFBEB] shadow-[4px_4px_0px_0px_#F59E0B]">
                <h3 className="text-xs font-black text-amber-800 uppercase mb-2 flex items-center gap-2"><Sparkles size={16}/> Insight Kilat</h3>
                <p className="font-bold text-xs leading-relaxed text-amber-900">Ini adalah ringkasan cepat pengeluaranmu. Kunjungi <span className="font-black text-amber-950 bg-amber-200 px-1">Menu Settings</span> untuk mengunduh versi PDF/CSV Lengkap dan membaca saran dari Pelatih AI.</p>
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

              <div className="pt-2 border-t-2 border-dashed border-stone-300">
                <button onClick={() => { setIsReportPreviewOpen(false); if(setActiveTab) setActiveTab("settings"); }} className="w-full mt-4 bg-[#1E1E1E] text-white font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#444] hover:bg-stone-800 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2">
                  PUSAT LAPORAN (PDF/CSV) <ChevronRight size={16} />
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL UPDATE PROGRES TABUNGAN */}
      {targetToUpdate && (
        <div className="fixed inset-0 bg-black/70 z-[1000] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-emerald-500" />
                <h3 className="text-sm font-black text-[#1E1E1E] uppercase">Catat Uang Masuk</h3>
              </div>
              <button onClick={() => { setTargetToUpdate(null); setUpdateAmount(""); }} className="w-8 h-8 bg-stone-200 border-2 border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-rose-100 transition active:scale-95">
                <X size={14} strokeWidth={3} className="text-[#1E1E1E]" />
              </button>
            </div>
            
            <form onSubmit={handleUpdateProgress} className="space-y-4">
              <div className="bg-stone-100 p-3 rounded-xl border-2 border-stone-300 border-dashed text-center">
                <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mb-1">Target Impian</p>
                <p className="text-xs font-black text-[#1E1E1E] truncate">{targetToUpdate.title}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Nominal Masuk (Rp)</label>
                <input type="text" inputMode="numeric" value={updateAmount} onChange={(e) => formatRupiahInput(e.target.value, setUpdateAmount)} placeholder="Contoh: 500.000" className="w-full p-3 text-sm border-2 border-[#1E1E1E] rounded-xl font-black bg-white outline-none shadow-[2px_2px_0px_0px_#1E1E1E] focus:border-emerald-500 transition text-emerald-600" required />
              </div>
              <p className="text-[9px] font-bold text-stone-400 text-center px-4 leading-relaxed">
                Ini hanya merubah skor. Pastikan kamu benar-benar menyisihkan fisik uangnya di {targetToUpdate.location} ya!
              </p>
              <button type="submit" disabled={isUpdating} className="w-full mt-2 bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-emerald-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
                {isUpdating ? "MENYIMPAN..." : "SIMPAN PROGRES!"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FORM PEMBAYARAN CC PINTAR */}
      {ccPayModal && (
        <div className="fixed inset-0 bg-black/70 z-[1000] flex items-end sm:items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] animate-in slide-in-from-bottom-8">
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-2">
                <CreditCard size={20} className="text-rose-500" />
                <h3 className="text-sm font-black text-[#1E1E1E] uppercase">Bayar Tagihan CC</h3>
              </div>
              <button onClick={() => { setCcPayModal(null); setCcPayAmount(""); setCcPaySource(""); }} className="w-8 h-8 bg-stone-200 border-2 border-[#1E1E1E] rounded-lg flex items-center justify-center hover:bg-rose-100 transition active:scale-95">
                <X size={14} strokeWidth={3} className="text-[#1E1E1E]" />
              </button>
            </div>
            
            <form onSubmit={handlePayCreditCard} className="space-y-4">
              <div className="bg-rose-50 p-3 rounded-xl border-2 border-rose-300 border-dashed flex justify-between items-center">
                <div>
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-0.5">Kartu Terpilih</p>
                  <p className="text-xs font-black text-rose-900 truncate max-w-[150px]">{ccPayModal.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-rose-500 uppercase tracking-widest mb-0.5">Total Utang</p>
                  <p className="text-xs font-black text-rose-700">{formatRp(Math.abs(ccPayModal.balance || 0))}</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Pilih Sumber Dana</label>
                <select value={ccPaySource} onChange={(e) => setCcPaySource(e.target.value)} className="w-full p-3 text-xs border-2 border-[#1E1E1E] rounded-xl font-bold bg-white outline-none shadow-[2px_2px_0px_0px_#1E1E1E] focus:border-rose-500 transition appearance-none" required>
                  <option value="" disabled>-- Pilih Rekening / E-Wallet --</option>
                  {paymentSources.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} (Saldo: {formatRp(acc.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-stone-500 uppercase tracking-widest">Total Uang Keluar (Rp)</label>
                <input type="text" inputMode="numeric" value={ccPayAmount} onChange={(e) => formatRupiahInput(e.target.value, setCcPayAmount)} placeholder="Termasuk jika ada admin bank" className="w-full p-3 text-sm border-2 border-[#1E1E1E] rounded-xl font-black bg-white outline-none shadow-[2px_2px_0px_0px_#1E1E1E] focus:border-rose-500 transition text-rose-600" required />
              </div>

              <p className="text-[9px] font-bold text-stone-400 text-center px-2 leading-relaxed">
                Asisten Pintar akan otomatis memotong tagihan sesuai utangmu. Jika nominal lebih besar, selisihnya akan dicatat sebagai Biaya Admin.
              </p>

              <button type="submit" disabled={isUpdating} className="w-full mt-2 bg-rose-500 text-white font-black text-xs uppercase py-4 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-rose-400 transition active:translate-y-1 active:shadow-none flex items-center justify-center gap-2 disabled:opacity-50">
                {isUpdating ? "MEMPROSES..." : "PROSES PEMBAYARAN!"} <ArrowRight size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}