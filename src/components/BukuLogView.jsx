import React, { useState, useMemo, useEffect } from "react";
import { Sparkles, Archive, X, Printer, Loader2, Search, SlidersHorizontal, Settings2, BrainCircuit, Wallet, Calendar, Tag, FileText } from "lucide-react";
import { supabase } from "../supabaseClient"; 

export default function BukuLogView({ accounts = [], setAccounts, transactions = [], setTransactions, fetchData }) {
  const [subTabActivity, setSubTabActivity] = useState("mutasi");
  const [selectedTxForClaim, setSelectedTxForClaim] = useState([]);
  const [claimFolderName, setClaimFolderName] = useState("");
  
  const [activeClaims, setActiveClaims] = useState([]);
  const [previewPdfData, setPreviewPdfData] = useState(null);
  
  const [liquidatingClaim, setLiquidatingClaim] = useState(null);
  const [formDisbursedAmount, setFormDisbursedAmount] = useState("");
  const [formDisbursementAccountId, setFormDisbursementAccountId] = useState("");

  const [isProcessing, setIsProcessing] = useState(false);

  // --- STATE FILTER & PENCARIAN MUTASI ---
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilterModal, setShowFilterModal] = useState(false);
  
  // DEFAULT TAMPILAN AWAL: "Bulan Ini" dan "Semua" 
  const [filterPeriod, setFilterPeriod] = useState("Bulan Ini"); 
  const [filterType, setFilterType] = useState("Semua"); 
  const [filterCategory, setFilterCategory] = useState("Semua");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // --- STATE SETTINGS AI ---
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiScope, setAiScope] = useState("PRIBADI");

  // --- STATE FILTER ARSIP KLAIM LUNAS ---
  const [claimFilterPeriod, setClaimFilterPeriod] = useState("Semua");
  const [claimStartDate, setClaimStartDate] = useState("");
  const [claimEndDate, setClaimEndDate] = useState("");

  // =======================================================
  // STATE BARU: BATAS TAMPILAN (LOAD MORE LOGIC)
  // =======================================================
  const [visibleTxCount, setVisibleTxCount] = useState(30);

  // FIXED: Auto-select akun default saat accounts selesai dimuat
  useEffect(() => {
    if (accounts && accounts.length > 0) {
      const defaultAcc = accounts.find(a => a.account_group === "PRIBADI" && a.type !== "CREDIT_CARD") || accounts[0];
      if (defaultAcc && !formDisbursementAccountId) {
        setFormDisbursementAccountId(defaultAcc.id);
      }
    }
  }, [accounts]);

  // PENERIMA SINYAL DARI BERANDA (AUTO-NAVIGASI TAB KLAIM)
  useEffect(() => {
    const targetTab = localStorage.getItem("targetBukuLogTab");
    if (targetTab) {
      setSubTabActivity(targetTab);
      localStorage.removeItem("targetBukuLogTab");
    }
  }, []);

  // KEMBALIKAN BATAS TAMPILAN KE 30 JIKA FILTER/PENCARIAN BERUBAH
  useEffect(() => {
    setVisibleTxCount(30);
  }, [searchQuery, filterType, filterCategory, filterPeriod, startDate, endDate]);

  const unmaskNumber = (str) => parseInt(str.toString().replace(/\./g, ""), 10) || 0;
  const maskRupiah = (val) => { const clean = val.toString().replace(/[^0-9]/g, ""); return clean ? new Intl.NumberFormat("id-ID").format(parseInt(clean, 10)) : ""; };

  const normalizeCategory = (cat) => {
    if (!cat) return "Lain-lain";
    const lower = cat.toLowerCase();
    if (lower.includes("makan")) return "Makan & Minum";
    if (lower.includes("transport") || lower.includes("bensin") || lower.includes("toll")) return "Transportasi";
    if (lower.includes("belanja") || lower.includes("atk")) return "Belanja & ATK";
    if (lower.includes("tagihan") || lower.includes("listrik") || lower.includes("air")) return "Tagihan & Utilitas";
    if (lower.includes("sehat") || lower.includes("obat")) return "Kesehatan";
    return cat; 
  };

  // 1. DATA FILTERING MUTASI
  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterType !== "Semua" && t.type !== filterType) return false;
      if (filterType === "EXPENSE" && filterCategory !== "Semua" && t.category !== filterCategory) return false;
      
      if (filterPeriod === "Bulan Ini") {
        const currentMonth = new Date().toISOString().slice(0, 7);
        if (t.date && !t.date.startsWith(currentMonth)) return false;
      } else if (filterPeriod === "Kustom") {
        if (startDate && t.date < startDate) return false;
        if (endDate && t.date > endDate) return false;
      }
      return true;
    });
  }, [transactions, searchQuery, filterType, filterCategory, filterPeriod, startDate, endDate]);

  const displayedTransactions = filteredTransactions.slice(0, visibleTxCount);

  const availableCategories = useMemo(() => {
    const expenseTxs = transactions.filter(t => t.type === 'EXPENSE');
    return Array.from(new Set(expenseTxs.map(t => t.category))).filter(Boolean);
  }, [transactions]);

  // 2. DONUT CHART LOGIC
  const expenseDistribution = useMemo(() => {
    const expenseTx = filteredTransactions.filter(t => t.type === "EXPENSE");
    const categoriesMap = {};
    let grandTotal = 0;
    
    expenseTx.forEach(t => { 
      const cleanCat = normalizeCategory(t.category);
      categoriesMap[cleanCat] = (categoriesMap[cleanCat] || 0) + t.amount; 
      grandTotal += t.amount; 
    });

    let rawDistribution = Object.keys(categoriesMap)
      .map(cat => ({ category: cat, amount: categoriesMap[cat], percentage: grandTotal > 0 ? parseInt(((categoriesMap[cat] / grandTotal) * 100).toFixed(0), 10) : 0 }))
      .sort((a, b) => b.amount - a.amount);

    if (rawDistribution.length > 4) {
      const top3 = rawDistribution.slice(0, 3);
      const others = rawDistribution.slice(3).reduce((acc, curr) => {
        return { category: "Lain-lain", amount: acc.amount + curr.amount, percentage: acc.percentage + curr.percentage };
      }, { category: "Lain-lain", amount: 0, percentage: 0 });
      return [...top3, others];
    }
    return rawDistribution;
  }, [filteredTransactions]);

  const chartColors = ["#F43F5E", "#F59E0B", "#3B82F6", "#10B981", "#8B5CF6", "#64748B"];
  let cumulativePercent = 0;
  const donutSlices = expenseDistribution.map((d, i) => {
    const slice = { ...d, dashArray: `${d.percentage} ${100 - d.percentage}`, dashOffset: 25 - cumulativePercent, color: chartColors[i % chartColors.length] };
    cumulativePercent += d.percentage;
    return slice;
  });

  // 3. AI INSIGHT LOGIC
  const computedLogAiCategoryInsight = useMemo(() => {
    if (expenseDistribution.length === 0) return "Belum ada data pengeluaran untuk dianalisis AI pada filter ini.";
    const top = expenseDistribution[0];
    if (top.percentage >= 40) return `Analisis AI (${aiScope}): Porsi terbesar pengeluaran tersedot di "${top.category}" (${top.percentage}%). Awasi agar tidak over-budget ya Bosku!`;
    return `Analisis AI (${aiScope}): Distribusi pos belanja berjalan seimbang tanpa lonjakan anomali yang mencurigakan.`;
  }, [expenseDistribution, aiScope]);

  // LOAD KLAIM DB
  const loadClaimsFromDB = async () => {
    try {
      const { data, error } = await supabase.from('reimbursement_claims').select('*').order('created_at', { ascending: false });
      if (data && !error) {
        const { data: { session } } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        
        const userClaims = userId ? data.filter(c => c.user_id === userId) : data;

        const formattedClaims = userClaims.map(c => ({
          id: c.id, title: c.title, status: c.status, total_amount: c.total_amount,
          txIds: transactions.filter(t => t.claim_id === c.id).map(t => t.id),
          actual_disbursed: c.actual_disbursed || 0, target_account_name: c.target_account_name || "",
          disbursement_date: c.updated_at || c.created_at || "" 
        }));
        
        setActiveClaims(formattedClaims);
      }
    } catch (err) { console.error("Gagal memuat klaim:", err); }
  };

  useEffect(() => { loadClaimsFromDB(); }, [transactions]); 

  const filteredPaidClaims = useMemo(() => {
    let paid = activeClaims.filter(c => c.status === "PAID");
    
    if (claimFilterPeriod === "Bulan Ini") {
      const currentMonth = new Date().toISOString().slice(0, 7);
      paid = paid.filter(c => c.disbursement_date && c.disbursement_date.startsWith(currentMonth));
    } else if (claimFilterPeriod === "Kustom") {
      if (claimStartDate) paid = paid.filter(c => c.disbursement_date && c.disbursement_date >= claimStartDate);
      if (claimEndDate) paid = paid.filter(c => c.disbursement_date && c.disbursement_date <= claimEndDate + 'T23:59:59');
    }
    
    return paid;
  }, [activeClaims, claimFilterPeriod, claimStartDate, claimEndDate]);

  const generateUUID = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  const handleCreateClaimFolder = async (e) => {
    e.preventDefault();
    if (!claimFolderName || selectedTxForClaim.length === 0) return alert("Pilih pengeluaran & beri nama dokumen.");
    
    setIsProcessing(true); 

    const computedTotal = transactions.filter(t => selectedTxForClaim.includes(t.id)).reduce((sum, t) => sum + t.amount, 0);
    const newFolderId = generateUUID(); 

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Sesi login tidak terdeteksi.");
        
      const { error: claimError } = await supabase.from('reimbursement_claims').insert({
        id: newFolderId, user_id: session.user.id, title: claimFolderName, status: 'PENDING', total_amount: computedTotal
      });
      if (claimError) throw claimError;

      const { error: txError } = await supabase.from('transactions')
          .update({ claim_id: newFolderId })
          .in('id', selectedTxForClaim);
      
      if (txError) throw txError;

      setSelectedTxForClaim([]); 
      setClaimFolderName("");

      if (fetchData) await fetchData();
      await loadClaimsFromDB();

    } catch (err) { 
      alert("⚠️ Gagal menyinkronkan ke Database: " + err.message);
    } finally {
      setIsProcessing(false); 
    }
  };

  const handleConfirmDisbursedSubmit = async (e) => {
    e.preventDefault();
    if (!formDisbursementAccountId) return alert("Pilih rekening pencairan!");
    
    setIsProcessing(true); 

    const totalDicairkan = unmaskNumber(formDisbursedAmount);
    const selisih = liquidatingClaim.total_amount - totalDicairkan;
    const currentDateStr = new Date().toISOString().split("T")[0];
    const accTarget = accounts.find(a => a.id === formDisbursementAccountId);
    const accName = accTarget?.name || "Rekening Bank";

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const userId = session?.user?.id;

      const { error: updateError } = await supabase.from('reimbursement_claims').update({
        status: 'PAID', actual_disbursed: totalDicairkan, target_account_name: accName
      }).eq('id', liquidatingClaim.id);

      if (updateError) throw updateError;

      const incId = generateUUID();
      await supabase.from('transactions').insert({
        id: incId, user_id: userId, account_id: formDisbursementAccountId,
        title: `[CAIR] ${liquidatingClaim.title}`, amount: totalDicairkan, type: 'INCOME', 
        category: 'Reimbursement Paid', date: currentDateStr, is_reimbursement: false
      });

      let newBalance = accTarget ? accTarget.balance + totalDicairkan : totalDicairkan;

      if (selisih > 0) {
        const expId = generateUUID();
        await supabase.from('transactions').insert({
          id: expId, user_id: userId, account_id: formDisbursementAccountId,
          title: `[SELISIH] ${liquidatingClaim.title}`, amount: selisih, type: 'EXPENSE', 
          category: 'Beban Dinas Pribadi', date: currentDateStr, is_reimbursement: false
        });
        newBalance -= selisih;
      }

      if (accTarget) {
        await supabase.from('accounts').update({ balance: newBalance }).eq('id', formDisbursementAccountId);
      }

      if (fetchData) await fetchData();
      await loadClaimsFromDB();

      setLiquidatingClaim(null); 
      setFormDisbursedAmount("");
    } catch (error) {
      console.error("Gagal memproses pencairan:", error);
      alert("Terjadi kesalahan saat menyimpan pencairan: " + error.message);
    } finally {
      setIsProcessing(false); 
    }
  };

  const handlePrintPDF = () => {
    if (!previewPdfData) return;
    const txList = transactions.filter(t => previewPdfData.txIds.includes(t.id));
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head>
          <title>Klaim_${previewPdfData.title}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; color: #1E1E1E; max-width: 800px; margin: auto; }
            .header { border-bottom: 3px solid #1E1E1E; padding-bottom: 15px; margin-bottom: 30px; text-align: center; }
            h2 { font-weight: 900; letter-spacing: 1px; margin-bottom: 5px; text-transform: uppercase; }
            p { margin: 5px 0; font-size: 14px; }
            table { border-collapse: collapse; width: 100%; margin-top: 20px; font-size: 14px; }
            th, td { border: 1px solid #1E1E1E; padding: 12px; text-align: left; }
            th { background-color: #F8F9FA; font-weight: bold; }
            .total-row { font-weight: 900; background-color: #E2E8F0; }
            .receipts-section { margin-top: 50px; page-break-before: always; }
            .receipt-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; margin-top: 20px; }
            .receipt-box { border: 2px dashed #94A3B8; padding: 15px; text-align: center; background-color: #F8FAFC; border-radius: 8px; height: 280px; display: flex; flex-direction: column; justify-content: center; align-items: center; page-break-inside: avoid; }
            .receipt-img { max-width: 100%; max-height: 200px; object-fit: contain; border: 1px solid #CBD5E1; border-radius: 4px; box-shadow: 2px 2px 0px #CBD5E1; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>LAPORAN PENGAJUAN REIMBURSEMENT RESMI</h2>
            <p style="font-family: monospace; color: #64748B;">ID DOKUMEN: #DOC-KLM-${previewPdfData.id.slice(0,8).toUpperCase()}</p>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 30px;">
            <div><p><strong>Keterangan:</strong> ${previewPdfData.title}</p></div>
            <div style="text-align: right;"><p><strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID')}</p><p><strong>Status:</strong> ${previewPdfData.status}</p></div>
          </div>
          <table>
            <thead><tr><th>No</th><th>Deskripsi Belanja</th><th>Lampiran Struk</th><th style="text-align: right;">Nominal (Rp)</th></tr></thead>
            <tbody>
              ${txList.map((t, index) => `<tr><td style="width: 5%; text-align: center;">${index + 1}</td><td>${t.title}</td><td style="text-align: center; font-weight: bold; color: #16A34A;">${t.receipt_url ? '✔ TERLAMPIR' : '❌ TIDAK ADA'}</td><td style="text-align: right;">${t.amount.toLocaleString('id-ID')}</td></tr>`).join('')}
              <tr class="total-row"><td colspan="3" style="text-align: right;">TOTAL PENGAJUAN KLAIM:</td><td style="text-align: right;">Rp ${previewPdfData.total_amount.toLocaleString('id-ID')}</td></tr>
            </tbody>
          </table>
          <div class="receipts-section">
            <div class="header" style="border-bottom: 2px solid #64748B; padding-bottom: 5px; margin-bottom: 10px;">
              <h3 style="margin-bottom: 0;">LAMPIRAN BUKTI TRANSAKSI</h3>
              <p style="margin-top: 5px;">Dokumen sah verifikasi pengeluaran.</p>
            </div>
            <div class="receipt-grid">
              ${txList.map(t => `<div class="receipt-box"><h4 style="margin-top: 0; margin-bottom: 10px; font-size: 13px; color: #1E1E1E;">Ref: ${t.title}</h4>${t.receipt_url ? (t.receipt_url.startsWith('data:image') || t.receipt_url.startsWith('http') ? `<img src="${t.receipt_url}" class="receipt-img" alt="Bukti Struk"/>` : `<p style="font-family: monospace; font-size: 10px; color: #64748B;">[ DATABASE: ${t.receipt_url.slice(0,20)}... ]</p>`) : `<p style="color: #EF4444; font-weight: bold; font-size: 12px;">[!] TANPA STRUK</p>`}</div>`).join('')}
            </div>
          </div>
          <script>window.onload = () => { window.print(); window.close(); }</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="space-y-4 pb-[100px] pt-2 px-2">
      
      {/* TABS TETAP MENEMPEL DI ATAS */}
      <div className="grid grid-cols-2 p-1 bg-white border-2 border-[#1E1E1E] rounded-xl shadow-[2px_2px_0px_0px_#1E1E1E] mx-1 mt-1">
        <button onClick={() => setSubTabActivity("mutasi")} className={`py-2 text-xs font-black transition rounded-lg ${subTabActivity === 'mutasi' ? 'bg-[#1E1E1E] text-white' : 'text-stone-500 hover:bg-stone-100'}`}>🟢 Riwayat Mutasi</button>
        <button onClick={() => setSubTabActivity("reimburse")} className={`py-2 text-xs font-black transition rounded-lg flex items-center justify-center gap-1.5 ${subTabActivity === 'reimburse' ? 'bg-[#1E1E1E] text-white' : 'text-stone-500 hover:bg-stone-100'}`}><FileText size={14}/> Pengajuan Klaim</button>
      </div>

      <div className="px-1">

        {/* ──────── SUB-TAB A: MUTASI ──────── */}
        {subTabActivity === "mutasi" && (
          <div className="space-y-4 animate-in fade-in">
            
            {/* 1. ANALISA AI */}
            <div className="bg-white border-2 border-[#1E1E1E] p-4 rounded-xl shadow-[3px_3px_0px_0px_#1E1E1E] relative">
              <div className="flex justify-between items-start mb-2">
                <p className="text-[10px] font-black text-amber-600 tracking-wider uppercase flex items-center gap-1.5">
                  <BrainCircuit size={14} /> <span>Analisis Asisten AI</span>
                </p>
                <button onClick={() => setShowAiSettings(true)} className="p-1.5 bg-stone-50 border-2 border-[#1E1E1E] rounded-md shadow-[1px_1px_0px_0px_#1E1E1E] hover:bg-stone-100 active:translate-y-px transition">
                  <Settings2 size={12} className="text-stone-700" />
                </button>
              </div>
              <p className="text-xs text-stone-700 font-bold leading-relaxed">"{computedLogAiCategoryInsight}"</p>
            </div>

            {/* 2. DONUT CHART */}
            <div className="bg-white border-2 border-[#1E1E1E] p-4 rounded-xl shadow-[3px_3px_0px_0px_#1E1E1E] text-center">
              <p className="text-[10px] font-black text-stone-500 uppercase tracking-wide text-left mb-3 flex items-center gap-1.5"><Sparkles size={12}/> Distribusi Pengeluaran</p>
              <div className="flex flex-col sm:flex-row items-center gap-4 justify-center">
                <div className="flex justify-center shrink-0">
                  <svg width="110" height="110" viewBox="0 0 36 36" className="transform -rotate-90 drop-shadow-md">
                    <circle cx="18" cy="18" r="15.915" fill="none" stroke="#E6E2DE" strokeWidth="4" />
                    {donutSlices.map((slice, i) => (
                       <circle key={i} cx="18" cy="18" r="15.915" fill="none" stroke={slice.color} strokeWidth="4" strokeDasharray={slice.dashArray} strokeDashoffset={slice.dashOffset} className="transition-all duration-500 ease-in-out" />
                    ))}
                  </svg>
                </div>
                <div className="flex flex-col gap-2 text-[9px] font-black text-left uppercase w-full sm:w-auto">
                  {donutSlices.length === 0 && <p className="text-stone-400">Data Kosong</p>}
                  {donutSlices.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-stone-50 border border-stone-200 p-1.5 rounded-lg">
                      <span className="w-3 h-3 rounded-full border border-[#1E1E1E] flex-shrink-0 shadow-sm" style={{ backgroundColor: d.color }}></span>
                      <span className="truncate flex-1 text-stone-700">{d.category}</span>
                      <span className="font-mono text-stone-900">{d.percentage}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 3. PENCARIAN & FILTER BAR */}
            <div className="space-y-2">
              <p className="text-[10px] font-black text-stone-500 uppercase tracking-wide mb-1 flex items-center gap-1"><Archive size={12}/> Buku Riwayat Lengkap</p>
              
              <div className="flex gap-2">
                <div className="flex-1 bg-white border-2 border-[#1E1E1E] rounded-xl flex items-center px-3 shadow-[2px_2px_0px_0px_#1E1E1E]">
                  <Search size={16} className="text-stone-400 shrink-0" />
                  <input type="text" placeholder="Cari transaksi..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full text-xs p-3 outline-none font-bold text-stone-700 bg-transparent" />
                  {searchQuery && <X size={14} className="text-stone-400 cursor-pointer shrink-0" onClick={() => setSearchQuery("")}/>}
                </div>
                <button onClick={() => setShowFilterModal(true)} className="bg-amber-100 border-2 border-[#1E1E1E] px-3.5 rounded-xl flex items-center justify-center shadow-[2px_2px_0px_0px_#1E1E1E] hover:bg-amber-200 transition active:translate-y-px shrink-0">
                  <SlidersHorizontal size={18} className="text-amber-900" />
                </button>
              </div>

              {/* Indikator Filter Aktif */}
              {(filterType !== "Semua" || filterCategory !== "Semua" || filterPeriod !== "Semua") && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {filterPeriod !== "Semua" && (
                    <span className="bg-stone-800 text-white text-[9px] font-bold px-2 py-1 rounded border border-[#1E1E1E] flex items-center gap-1">🕒 {filterPeriod === 'Kustom' ? 'Tgl Kustom' : filterPeriod} <X size={10} className="cursor-pointer" onClick={() => setFilterPeriod("Semua")}/></span>
                  )}
                  {filterType !== "Semua" && (
                    <span className="bg-stone-800 text-white text-[9px] font-bold px-2 py-1 rounded border border-[#1E1E1E] flex items-center gap-1">
                      🏷️ {filterType === 'EXPENSE' ? 'Keluar' : filterType === 'INCOME' ? 'Masuk' : 'Pindah'} <X size={10} className="cursor-pointer" onClick={() => setFilterType("Semua")}/>
                    </span>
                  )}
                  {filterType === "EXPENSE" && filterCategory !== "Semua" && (
                    <span className="bg-amber-500 text-[#1E1E1E] text-[9px] font-bold px-2 py-1 rounded border border-[#1E1E1E] flex items-center gap-1">📂 {filterCategory} <X size={10} className="cursor-pointer" onClick={() => setFilterCategory("Semua")}/></span>
                  )}
                </div>
              )}
              
              {/* DAFTAR TRANSAKSI MUTASI DENGAN LIMIT & LOAD MORE */}
              <div className="space-y-2 mt-2">
                {filteredTransactions.length === 0 && (
                  <div className="text-center py-8 border-2 border-dashed border-stone-300 rounded-xl bg-stone-50">
                    <p className="text-xs font-bold text-stone-500">Tidak ada transaksi yang cocok dengan filter/pencarian.</p>
                  </div>
                )}
                
                {displayedTransactions.map(t => (
                  <div key={t.id} className="bg-white border-2 border-[#1E1E1E] p-3 rounded-xl flex justify-between items-center shadow-[2px_2px_0px_0px_#1E1E1E]">
                    <div className="flex items-center gap-3">
                      <span className={`w-8 h-8 flex justify-center items-center rounded-lg border-2 font-black shrink-0 ${t.type === 'EXPENSE' ? 'bg-rose-50 text-rose-600 border-rose-300' : t.type === 'INCOME' ? 'bg-emerald-50 text-emerald-600 border-emerald-300' : 'bg-indigo-50 text-indigo-600 border-indigo-300'}`}>
                        {t.type === 'EXPENSE' ? '-' : t.type === 'INCOME' ? '+' : '⇄'}
                      </span>
                      <div>
                        <p className="text-xs font-black text-stone-800 line-clamp-1">{t.title}</p>
                        <p className="text-[9px] text-stone-500 font-bold mt-0.5">{accounts.find(a => a.id === t.account_id)?.name} • <span className="uppercase bg-stone-100 px-1 py-0.5 rounded border border-stone-200">{t.category}</span></p>
                      </div>
                    </div>
                    <span className={`text-xs font-black shrink-0 ${t.type === 'EXPENSE' ? 'text-rose-600' : t.type === 'INCOME' ? 'text-emerald-600' : 'text-indigo-600'}`}>
                      Rp {t.amount.toLocaleString('id-ID')}
                    </span>
                  </div>
                ))}

                {visibleTxCount < filteredTransactions.length && (
                  <button 
                    onClick={() => setVisibleTxCount(prev => prev + 30)}
                    className="w-full mt-4 min-h-[44px] bg-amber-300 text-amber-950 font-black text-[10px] uppercase tracking-widest rounded-xl border-2 border-[#1E1E1E] shadow-[3px_3px_0px_0px_#1E1E1E] active:translate-y-1 active:shadow-none hover:bg-amber-400 transition cursor-pointer"
                  >
                    Lebih Banyak ({filteredTransactions.length - visibleTxCount} Tersisa)
                  </button>
                )}

              </div>
            </div>
          </div>
        )}

        {/* ──────── SUB-TAB B: KLAIM ──────── */}
        {subTabActivity === "reimburse" && (
          <div className="space-y-4 animate-in fade-in">
            <div className="space-y-2">
              <p className="text-[10px] font-black text-stone-600 uppercase flex items-center gap-1">⚡ Pengajuan Reimbursement Aktif</p>
              {activeClaims.filter(c => c.status === "PENDING").length === 0 && (
                <p className="text-center text-[10px] font-bold text-stone-400 py-4 border-2 border-dashed border-stone-300 rounded-xl">Belum ada dokumen klaim yang diajukan.</p>
              )}
              {activeClaims.filter(c => c.status === "PENDING").map(c => (
                <div key={c.id} className="bg-white border-2 border-[#1E1E1E] p-3 rounded-xl shadow-[3px_3px_0px_0px_#1E1E1E]">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h4 className="text-xs font-black text-stone-900">{c.title}</h4>
                      <p className="text-[9px] font-mono text-stone-500 mt-0.5">Nilai Ajuan: <span className="font-bold text-stone-800">Rp {c.total_amount.toLocaleString('id-ID')}</span></p>
                    </div>
                    <span className="text-[8px] font-black px-1.5 py-0.5 rounded border border-amber-500 bg-amber-50 text-amber-700 uppercase">PENDING HRD</span>
                  </div>
                  <div className="flex gap-2 border-t border-dashed border-stone-200 pt-2">
                    <button onClick={() => setPreviewPdfData(c)} className="flex-1 min-h-[44px] bg-stone-50 border-2 border-[#1E1E1E] text-[10px] font-black rounded-lg flex items-center justify-center gap-1 shadow-[1px_1px_0px_0px_#000] hover:bg-stone-100 transition active:scale-95">📄 Pratinjau</button>
                    <button onClick={() => { setLiquidatingClaim(c); setFormDisbursedAmount(c.total_amount.toString()); }} className="flex-1 min-h-[44px] bg-emerald-600 text-white border-2 border-[#1E1E1E] text-[10px] font-black rounded-lg flex items-center justify-center gap-1 shadow-[1px_1px_0px_0px_#000] hover:bg-emerald-500 transition active:scale-95">💰 Cair</button>
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-white border-2 border-[#1E1E1E] p-3 rounded-xl shadow-[3px_3px_0px_0px_#1E1E1E] space-y-3">
              <div className="border-b-2 border-dashed border-stone-200 pb-2">
                <p className="text-[10px] font-black text-stone-500 uppercase">📥 Antrean Nota Belum Diajukan (Draft)</p>
              </div>
              
              {transactions.filter(t => t.is_reimbursement && !t.claim_id).length === 0 ? (
                 <p className="text-center text-[10px] font-bold text-stone-400 py-6">Keren! Tidak ada nota dinas pribadi yang nganggur.</p>
              ) : (
                <div className="space-y-2 py-1 max-h-[160px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                  {transactions.filter(t => t.is_reimbursement && !t.claim_id).map(t => (
                    <div key={t.id} onClick={() => setSelectedTxForClaim(prev => prev.includes(t.id) ? prev.filter(id => id !== t.id) : [...prev, t.id])} className={`p-2 border-2 rounded-lg flex justify-between items-center text-xs font-bold cursor-pointer transition select-none hover:bg-stone-50 ${selectedTxForClaim.includes(t.id) ? 'bg-amber-50 border-amber-500 shadow-[2px_2px_0px_0px_#F59E0B]' : 'border-stone-300'}`}>
                      <div className="flex items-center gap-2"><input type="checkbox" checked={selectedTxForClaim.includes(t.id)} readOnly className="w-3.5 h-3.5 border-2 border-[#1E1E1E] accent-amber-600 flex-shrink-0" /><span>{t.title}</span></div>
                      <span className="text-stone-900 font-mono text-[11px] flex-shrink-0">Rp {t.amount.toLocaleString('id-ID')}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {transactions.filter(t => t.is_reimbursement && !t.claim_id).length > 0 && (
                <form onSubmit={handleCreateClaimFolder} className="border-t border-dashed border-stone-200 pt-3 space-y-2">
                  <input type="text" value={claimFolderName} onChange={(e) => setClaimFolderName(e.target.value)} placeholder="Judul Rekap (Cth: Dinas JKT Juli)" className="w-full text-xs p-3 border-2 border-[#1E1E1E] rounded-xl font-bold bg-stone-50 outline-none focus:border-amber-500 transition" required />
                  <button type="submit" disabled={isProcessing} className="w-full min-h-[48px] bg-[#1E1E1E] text-white text-xs font-black tracking-widest uppercase rounded-xl border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#444] disabled:opacity-50 flex justify-center items-center gap-2 transition active:scale-95">
                    {isProcessing ? <><Loader2 size={16} className="animate-spin" /> MEMPROSES...</> : "BUNGKUS & AJUKAN PDF"}
                  </button>
                </form>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <p className="text-[10px] font-black text-stone-600 uppercase tracking-wider flex items-center gap-1">
                  <Archive size={12} className="text-stone-500" /> <span>📜 Riwayat Arsip Lunas</span>
                </p>
              </div>

              <div className="bg-white border-2 border-[#1E1E1E] p-2 rounded-xl shadow-[2px_2px_0px_0px_#1E1E1E] flex flex-col gap-2">
                <div className="flex gap-2">
                  {['Semua', 'Bulan Ini', 'Kustom'].map(opt => (
                    <button key={opt} onClick={() => setClaimFilterPeriod(opt)} className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg border-2 transition-all ${claimFilterPeriod === opt ? 'bg-amber-400 text-amber-900 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 text-stone-600 border-[#1E1E1E]'}`}>{opt}</button>
                  ))}
                </div>
                {claimFilterPeriod === 'Kustom' && (
                  <div className="flex items-center gap-2 pt-1">
                    <input type="date" value={claimStartDate} onChange={(e) => setClaimStartDate(e.target.value)} className="w-full text-[10px] p-1.5 border-2 border-[#1E1E1E] rounded-lg font-bold outline-none" />
                    <span className="text-xs font-black">-</span>
                    <input type="date" value={claimEndDate} onChange={(e) => setClaimEndDate(e.target.value)} className="w-full text-[10px] p-1.5 border-2 border-[#1E1E1E] rounded-lg font-bold outline-none" />
                  </div>
                )}
              </div>

              {filteredPaidClaims.map(c => (
                <div key={c.id} className="bg-stone-100 border-2 border-[#1E1E1E] p-3 rounded-xl flex justify-between items-center opacity-85 shadow-[1px_1px_0px_0px_#000]">
                  <div>
                    <h4 className="text-xs font-black text-stone-700 truncate max-w-[200px]">{c.title}</h4>
                    <p className="text-[9px] text-stone-500 font-mono mt-0.5">
                      Cair ke: <span className="font-bold">{c.target_account_name}</span> • Total: <span className="text-emerald-700 font-bold">Rp {c.actual_disbursed.toLocaleString('id-ID')}</span>
                    </p>
                  </div>
                  <button onClick={() => setPreviewPdfData(c)} className="min-h-[38px] px-3 bg-white border-2 border-[#1E1E1E] text-[9px] font-black rounded-lg flex items-center justify-center gap-1 shadow-[1px_1px_0px_0px_#000] hover:bg-stone-50 transition">
                    📄 Arsip PDF
                  </button>
                </div>
              ))}
              {filteredPaidClaims.length === 0 && (
                <p className="text-[10px] font-bold text-stone-400 py-2 text-center">Belum ada rekam jejak arsip PDF klaim lunas.</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* --- MODAL FILTER BERJENJANG MUTASI --- */}
      {showFilterModal && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-end justify-center sm:items-center sm:p-4" onClick={() => setShowFilterModal(false)}>
          <div className="w-full sm:max-w-sm bg-[#FDFBF7] border-t-4 sm:border-4 border-[#1E1E1E] rounded-t-3xl sm:rounded-3xl p-5 shadow-[8px_8px_0px_0px_#000] space-y-5 animate-in slide-in-from-bottom-10" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b-2 border-[#1E1E1E] pb-3">
              <h3 className="text-sm font-black text-stone-800 uppercase flex items-center gap-1.5"><SlidersHorizontal size={16}/> Filter Transaksi</h3>
              <button type="button" onClick={() => setShowFilterModal(false)} className="min-w-[32px] min-h-[32px] border-2 border-[#1E1E1E] flex items-center justify-center bg-stone-200 rounded-lg hover:bg-rose-100 transition shadow-[2px_2px_0px_0px_#1E1E1E]"><X size={14} strokeWidth={3} /></button>
            </div>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black block text-stone-500 uppercase flex items-center gap-1"><Calendar size={12}/> Periode Waktu</label>
                <div className="flex gap-2">
                  {['Semua', 'Bulan Ini', 'Kustom'].map(opt => (
                    <button key={opt} onClick={() => setFilterPeriod(opt)} className={`flex-1 py-2 text-[11px] font-bold rounded-lg border-2 transition-all ${filterPeriod === opt ? 'bg-[#1E1E1E] text-white border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-white text-stone-600 border-[#1E1E1E]'}`}>{opt}</button>
                  ))}
                </div>
                {filterPeriod === 'Kustom' && (
                  <div className="flex items-center gap-2 mt-2 p-2 bg-stone-100 border-2 border-dashed border-stone-300 rounded-xl animate-in fade-in">
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-stone-500">Dari Tanggal:</label>
                      <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setEndDate(""); }} className="w-full text-[11px] p-2 border-2 border-[#1E1E1E] rounded-lg font-bold outline-none" />
                    </div>
                    <span className="text-sm font-black mt-4">-</span>
                    <div className="flex-1 space-y-1">
                      <label className="text-[9px] font-bold text-stone-500">Sampai: (Maks 1 Bln)</label>
                      <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} min={startDate} 
                        max={startDate ? new Date(new Date(startDate).setMonth(new Date(startDate).getMonth() + 1)).toISOString().split('T')[0] : ""} 
                        disabled={!startDate} 
                        className="w-full text-[11px] p-2 border-2 border-[#1E1E1E] rounded-lg font-bold outline-none disabled:opacity-50" />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black block text-stone-500 uppercase flex items-center gap-1"><Wallet size={12}/> Tipe Kas</label>
                <div className="grid grid-cols-2 gap-2">
                  {[ {id: 'Semua', label: 'Semua'}, {id: 'EXPENSE', label: 'Pengeluaran'}, {id: 'INCOME', label: 'Pemasukan'}, {id: 'TRANSFER', label: 'Pindah Dana'} ].map(opt => (
                    <button key={opt.id} onClick={() => { setFilterType(opt.id); setFilterCategory('Semua'); }} className={`py-2 text-[11px] font-bold rounded-lg border-2 transition-all ${filterType === opt.id ? 'bg-amber-400 text-amber-900 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-white text-stone-600 border-[#1E1E1E]'}`}>{opt.label}</button>
                  ))}
                </div>
              </div>

              {filterType === "EXPENSE" && (
                <div className="space-y-2 pt-2 border-t border-dashed border-stone-300 animate-in fade-in">
                  <label className="text-[10px] font-black block text-stone-500 uppercase flex items-center gap-1"><Tag size={12}/> Filter Kategori</label>
                  <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="w-full text-xs p-3 border-2 border-[#1E1E1E] rounded-xl font-bold bg-white shadow-[2px_2px_0px_0px_#1E1E1E] outline-none">
                    <option value="Semua">-- Semua Kategori --</option>
                    {availableCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                </div>
              )}
            </div>

            <button onClick={() => setShowFilterModal(false)} className="w-full min-h-[48px] mt-4 bg-[#1E1E1E] text-white font-black text-xs uppercase tracking-widest rounded-xl border-2 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-stone-800 transition active:translate-y-1 active:shadow-none">
              Terapkan Filter
            </button>
          </div>
        </div>
      )}

      {/* --- MODAL PENGATURAN AI --- */}
      {showAiSettings && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4" onClick={() => setShowAiSettings(false)}>
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-2xl p-5 shadow-[8px_8px_0px_0px_#000] space-y-5 animate-in zoom-in-95" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center border-b-2 border-[#1E1E1E] pb-3">
              <h3 className="text-sm font-black text-stone-800 uppercase flex items-center gap-1.5"><Settings2 size={16}/> Parameter AI</h3>
              <button type="button" onClick={() => setShowAiSettings(false)} className="min-w-[32px] min-h-[32px] border-2 border-[#1E1E1E] flex items-center justify-center bg-stone-200 rounded-lg hover:bg-rose-100 transition shadow-[2px_2px_0px_0px_#1E1E1E]"><X size={14} strokeWidth={3} /></button>
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black block text-stone-500 uppercase">Fokus Alokasi Dana</label>
                <div className="flex gap-2 p-1 bg-stone-200 border-2 border-[#1E1E1E] rounded-xl h-11">
                  <button type="button" onClick={() => setAiScope("PRIBADI")} className={`flex-1 text-[10px] font-black uppercase rounded-lg border-2 ${aiScope === 'PRIBADI' ? 'bg-sky-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-transparent border-transparent text-stone-500'}`}>Pribadi</button>
                  <button type="button" onClick={() => setAiScope("USAHA")} className={`flex-1 text-[10px] font-black uppercase rounded-lg border-2 ${aiScope === 'USAHA' ? 'bg-orange-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-transparent border-transparent text-stone-500'}`}>Usaha</button>
                  <button type="button" onClick={() => setAiScope("GABUNGAN")} className={`flex-1 text-[10px] font-black uppercase rounded-lg border-2 ${aiScope === 'GABUNGAN' ? 'bg-stone-50 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-transparent border-transparent text-stone-500'}`}>Gabungan</button>
                </div>
              </div>
            </div>
            <button onClick={() => setShowAiSettings(false)} className="w-full min-h-[48px] bg-amber-400 text-amber-950 font-black text-xs uppercase tracking-widest rounded-xl border-2 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] transition active:translate-y-1 active:shadow-none">
              Simpan Setelan
            </button>
          </div>
        </div>
      )}

      {/* MODAL CAIR & PRATINJAU KLAIM */}
      {liquidatingClaim && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4">
          <form onSubmit={handleConfirmDisbursedSubmit} className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-2xl p-5 shadow-[8px_8px_0px_0px_#000] space-y-4 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b-2 border-[#1E1E1E] pb-3">
              <h3 className="text-sm font-black text-stone-800 uppercase">💰 Validasi Cair HRD</h3>
              <button type="button" onClick={() => setLiquidatingClaim(null)} className="min-w-[32px] min-h-[32px] border-2 border-[#1E1E1E] flex items-center justify-center bg-stone-200 rounded-lg hover:bg-rose-100 transition shadow-[2px_2px_0px_0px_#1E1E1E]"><X size={14} strokeWidth={3} /></button>
            </div>
            <div className="bg-white p-3 border-2 border-stone-300 rounded-xl text-xs font-bold text-stone-700 space-y-1">
              <p>Dokumen: <span className="text-stone-900 font-black">"{liquidatingClaim.title}"</span></p>
              <p>Tagihan Awal: <span className="text-rose-600 font-black">Rp {liquidatingClaim.total_amount.toLocaleString('id-ID')}</span></p>
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black block text-stone-600 uppercase tracking-wide">Nominal Dana Cair Nyata (Rp)</label>
              <input type="text" value={formDisbursedAmount} onChange={(e) => setFormDisbursedAmount(maskRupiah(e.target.value))} placeholder="Cth: 500000" className="w-full text-sm p-3 border-2 border-[#1E1E1E] rounded-xl font-mono font-black bg-white shadow-[2px_2px_0px_0px_#1E1E1E] outline-none focus:border-emerald-500 transition" required />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black block text-stone-600 uppercase tracking-wide">Rekening Tujuan Pencairan</label>
              <select value={formDisbursementAccountId} onChange={(e) => setFormDisbursementAccountId(e.target.value)} className="w-full text-xs p-3 border-2 border-[#1E1E1E] rounded-xl font-bold bg-white shadow-[2px_2px_0px_0px_#1E1E1E] outline-none" required>
                {accounts.filter(a => (a.account_group || "PRIBADI").toUpperCase() === "PRIBADI" && a.type !== "CREDIT_CARD").map(a => (
                  <option key={a.id} value={a.id}>{a.name} (Saldo: Rp {a.balance.toLocaleString('id-ID')})</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={isProcessing} className="w-full min-h-[48px] mt-2 bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase tracking-widest flex justify-center items-center gap-2 rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] disabled:opacity-50 hover:bg-emerald-400 transition active:scale-95">
              {isProcessing ? <><Loader2 size={16} className="animate-spin" /> MEMPROSES...</> : "SAHKAN CAIR & HITUNG SELISIH"}
            </button>
          </form>
        </div>
      )}

      {/* MODAL PRATINJAU PDF */}
      {previewPdfData && (
        <div className="fixed inset-0 bg-black/80 z-[9999] flex items-center justify-center p-4" onClick={() => setPreviewPdfData(null)}>
          <div className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-3xl shadow-[8px_8px_0px_0px_#000] flex flex-col max-h-[85%] overflow-hidden animate-in zoom-in-95 relative" onClick={(e) => e.stopPropagation()}>
            <div className="border-b-4 border-[#1E1E1E] p-4 bg-white flex justify-between items-center shrink-0">
              <div>
                <h2 className="text-sm font-black text-stone-900 uppercase tracking-widest">Laporan Reimbursement</h2>
                <p className="text-[8px] text-stone-400 font-mono mt-0.5 tracking-widest">ID: #DOC-KLM-{previewPdfData.id.slice(0,8).toUpperCase()}</p>
              </div>
              <button type="button" onClick={() => setPreviewPdfData(null)} className="w-8 h-8 flex justify-center items-center bg-stone-200 border-2 border-[#1E1E1E] rounded-lg hover:bg-rose-100 transition active:scale-95 cursor-pointer">
                <X size={14} strokeWidth={3}/>
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 bg-stone-50 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="bg-white p-4 border-2 border-[#1E1E1E] font-sans text-left space-y-4 text-[10px] text-stone-800 shadow-[2px_2px_0px_0px_#1E1E1E] rounded-xl relative">
                <div className="grid grid-cols-2 gap-2 text-[9px] text-stone-700">
                  <p><strong>Keterangan:</strong> {previewPdfData.title}</p>
                  <p className="text-right"><strong>Status:</strong> <span className="font-bold text-amber-600">{previewPdfData.status}</span></p>
                </div>
                <table className="w-full text-left border-collapse border-2 border-[#1E1E1E] text-[9px]">
                  <thead>
                    <tr className="bg-stone-200 border-b-2 border-[#1E1E1E]"><th className="p-1.5 border-r-2 border-[#1E1E1E] uppercase tracking-wide">Deskripsi Pengeluaran</th><th className="p-1.5 text-right uppercase tracking-wide">Nominal</th></tr>
                  </thead>
                  <tbody>
                    {transactions.filter(t => previewPdfData.txIds.includes(t.id)).map(t => (
                      <tr key={t.id} className="border-b-2 border-[#1E1E1E]"><td className="p-1.5 border-r-2 border-[#1E1E1E] font-bold">{t.title}<br/><span className="text-[7px] text-emerald-600 font-bold">{t.receipt_url ? '✔ Struk Ada' : '❌ Tanpa Struk'}</span></td><td className="p-1.5 text-right font-mono font-black">Rp {t.amount.toLocaleString('id-ID')}</td></tr>
                    ))}
                    <tr className="font-black bg-amber-100 text-stone-900 border-t-2 border-[#1E1E1E]"><td className="p-2 border-r-2 border-[#1E1E1E]">Total Tagihan Awal</td><td className="p-2 text-right">Rp {previewPdfData.total_amount.toLocaleString('id-ID')}</td></tr>
                    {previewPdfData.status === "PAID" && (
                      <tr className="font-black bg-emerald-100 text-emerald-900 border-t-2 border-[#1E1E1E]"><td className="p-2 border-r-2 border-[#1E1E1E]">Total Realisasi Cair</td><td className="p-2 text-right">Rp {previewPdfData.actual_disbursed.toLocaleString('id-ID')}</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="border-t-4 border-[#1E1E1E] p-4 bg-white space-y-3 shrink-0">
              <button type="button" onClick={handlePrintPDF} className="w-full min-h-[48px] bg-sky-500 text-white font-black text-xs uppercase tracking-widest rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] hover:bg-sky-400 transition flex justify-center items-center gap-2 cursor-pointer active:translate-y-1 active:shadow-none">
                <Printer size={18} strokeWidth={2.5}/> UNDUH PDF RESMI
              </button>
              <button type="button" onClick={() => setPreviewPdfData(null)} className="w-full min-h-[44px] bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] active:translate-y-1 active:shadow-none hover:bg-rose-400 transition cursor-pointer">
                TUTUP PRATINJAU
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}