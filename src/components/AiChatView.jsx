import React, { useState, useRef, useEffect } from "react";
import { Send, Camera, X, CheckCircle, Sparkles, ChevronDown, ArrowRightLeft, Trash2, Repeat } from "lucide-react";
import { supabase } from "../supabaseClient"; 

const callGeminiDirectly = async (prompt, base64Image, apiKey) => {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
  const data = await res.json();
  
  if (!data.models) {
    throw new Error("Gagal mengambil daftar mesin dari server Google.");
  }

  let validModels = data.models
    .filter(m => m.supportedGenerationMethods?.includes("generateContent"))
    .map(m => m.name.replace('models/', ''));

  validModels.sort((a, b) => {
    const scoreA = a.includes("flash") ? 2 : a.includes("pro") ? 1 : 0;
    const scoreB = b.includes("flash") ? 2 : b.includes("pro") ? 1 : 0;
    return scoreB - scoreA; 
  });

  let lastErrorMessage = "";

  for (const model of validModels) {
    try {
      console.log(`[Auto-Discovery] Sedang mencoba menembus mesin: ${model}...`);
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const contents = [{ role: "user", parts: [] }];

      if (base64Image) {
        contents[0].parts.push({ inlineData: { mimeType: "image/jpeg", data: base64Image } });
      }
      contents[0].parts.push({ text: prompt });

      const payload = {
        contents,
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
        ],
        generationConfig: { temperature: 0.1 }
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(`[${response.status}] ${responseData.error?.message || 'API Error'}`);
      }

      if (responseData.candidates && responseData.candidates.length > 0) {
        console.log(`✅ [BERHASIL!] Tembus menggunakan mesin: ${model}`);
        return responseData.candidates[0].content.parts[0].text; 
      } else {
        throw new Error("Data balasan kosong.");
      }
    } catch (err) {
      lastErrorMessage = err.message;
      if (err.message.includes("API key not valid")) {
        throw new Error("API Key Anda terdeteksi tidak valid / salah ketik.");
      }
    }
  }
  throw new Error(`Semua mesin di API Key ini diblokir Google. Error terakhir: ${lastErrorMessage}`);
};

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = () => resolve(reader.result);
  reader.onerror = error => reject(error);
});

export default function AiChatView({ session, fetchData, chatHistory = [], setChatHistory, transactions = [], setTransactions, accounts = [], setAccounts }) {
  const [activeTab, setActiveTab] = useState("chat");

  const [chatInputText, setChatInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [ocrReviewData, setOcrReviewData] = useState(null); 
  const fileInputRef = useRef(null);

  const [qiReceiptFile, setQiReceiptFile] = useState(null);
  const [qiReceiptPreview, setQiReceiptPreview] = useState("");
  const qiFileInputRef = useRef(null);

  const [aiProposedMission, setAiProposedMission] = useState(null);

  const [dbCategories, setDbCategories] = useState(["Lain-lain"]);

  const [qiType, setQiType] = useState("EXPENSE"); 
  const [qiAmount, setQiAmount] = useState(0);
  const [qiTitle, setQiTitle] = useState(""); 
  const [qiAccount, setQiAccount] = useState("");
  const [qiAccountTo, setQiAccountTo] = useState(""); 
  const [qiCategory, setQiCategory] = useState("Lain-lain");
  const [qiPurpose, setQiPurpose] = useState("PRIBADI"); 
  const [qiIsRecurring, setQiIsRecurring] = useState(false);
  
  const [activeDropdown, setActiveDropdown] = useState(null); 
  const dropdownRef = useRef(null);
  const chatContainerRef = useRef(null);
  const [showClearChatConfirm, setShowClearChatConfirm] = useState(false);

  useEffect(() => {
    if (accounts && accounts.length > 0) {
      if (!qiAccount) setQiAccount(accounts[0].id);
      if (!qiAccountTo) setQiAccountTo(accounts[1]?.id || accounts[0].id);
    }
  }, [accounts]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const { data, error } = await supabase.from('categories').select('name');
        if (error) throw error;
        if (data && data.length > 0) {
          const catNames = data.map(c => c.name);
          setDbCategories(catNames);
          setQiCategory(catNames[0]);
        }
      } catch (err) {
        console.error("Gagal memuat kategori dari Supabase:", err);
      }
    }
    loadCategories();
  }, []);

  useEffect(() => {
    const cachedChat = localStorage.getItem(`bukusaku_chat_${session?.user?.id || 'anon'}`);
    if (cachedChat) {
      setChatHistory(JSON.parse(cachedChat));
    }
  }, [session]);

  useEffect(() => {
    if (chatContainerRef.current && activeTab === "chat") {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory, aiProposedMission, activeTab]);

  const saveChatToLocal = (newHistory) => {
    setChatHistory(newHistory);
    localStorage.setItem(`bukusaku_chat_${session?.user?.id || 'anon'}`, JSON.stringify(newHistory));
  };

  const executeClearChat = () => {
    setChatHistory([]);
    localStorage.removeItem(`bukusaku_chat_${session?.user?.id || 'anon'}`);
    setShowClearChatConfirm(false);
  };

  useEffect(() => {
    const handleClickOutside = (e) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setActiveDropdown(null); };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unmaskNumber = (str) => parseInt(str.toString().replace(/\./g, ""), 10) || 0;
  const maskRupiah = (val) => { const clean = val.toString().replace(/[^0-9]/g, ""); return clean ? new Intl.NumberFormat("id-ID").format(parseInt(clean, 10)) : ""; };
  const formatRp = (value) => new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(value || 0);

  const handleQiFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setQiReceiptFile(file);
    setQiReceiptPreview(URL.createObjectURL(file));
  };

  const handleAcceptMission = async (missionTitle, targetCategory, keywords) => {
    try {
      let activeSession = session;
      if (!activeSession) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        activeSession = currentSession;
      }
      if (!activeSession || !activeSession.user) return alert("Sesi login kedaluwarsa!");

      const { error } = await supabase.from('missions').insert({
        user_id: activeSession.user.id, title: missionTitle, description: `Tantangan finansial hasil analisa AI.`,
        duration_days: 5, current_streak: 1, is_active: true, target_category: targetCategory, forbidden_keywords: keywords
      });
      if (error) throw error;

      setAiProposedMission(prev => prev ? { ...prev, accepted: true } : null);
      saveChatToLocal([...chatHistory, { id: `msg-${Date.now()}`, sender: "ai", text: `🔥 Mantap Bosku! Misi "${missionTitle}" resmi aktif di Berandamu. Gaspol!`, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
      if (fetchData) fetchData();
    } catch (err) { alert("Gagal mengaktifkan misi: " + err.message); }
  };

  const executeAddTransaction = async (title, formattedAmount, type, accountId, isReimburse, categoryName, receipt = null, toAccountId = null) => {
    const finalAmount = unmaskNumber(formattedAmount);
    const currentDateStr = new Date().toISOString().split("T")[0];
    
    setTransactions(prev => [{ 
      id: `t-${Date.now()}`, account_id: accountId, to_account_id: toAccountId, 
      title, amount: finalAmount, type, is_reimbursement: isReimburse, category: categoryName, 
      date: currentDateStr, claim_id: null, receipt_url: receipt 
    }, ...(Array.isArray(prev) ? prev : [])]);

    setAccounts(prev => prev.map(acc => {
      if (type === "TRANSFER") {
        if (acc.id === accountId) return { ...acc, balance: acc.balance - finalAmount }; 
        if (acc.id === toAccountId) return { ...acc, balance: acc.balance + finalAmount }; 
        return acc;
      } else {
        if (acc.id === accountId) return { ...acc, balance: acc.balance + (type === "EXPENSE" ? -finalAmount : finalAmount) };
        return acc;
      }
    }));

    try {
      let activeSession = session;
      if (!activeSession) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        activeSession = currentSession;
      }
      const userId = activeSession.user.id;

      await supabase.from('transactions').insert({
        user_id: userId, account_id: accountId, to_account_id: toAccountId || null, title: title, amount: finalAmount, type: type, 
        category: categoryName, is_reimbursement: isReimburse, receipt_url: receipt || (isReimburse ? "struk_nota_fisik.jpg" : null), date: currentDateStr
      });

      if (type === "TRANSFER") {
        const accFrom = accounts.find(a => a.id === accountId);
        const accTo = accounts.find(a => a.id === toAccountId);
        if (accFrom) await supabase.from('accounts').update({ balance: accFrom.balance - finalAmount }).eq('id', accountId);
        if (accTo) await supabase.from('accounts').update({ balance: accTo.balance + finalAmount }).eq('id', toAccountId);
      } else {
        const acc = accounts.find(a => a.id === accountId);
        if (acc) {
          const newBalance = acc.balance + (type === "EXPENSE" ? -finalAmount : finalAmount);
          await supabase.from('accounts').update({ balance: newBalance }).eq('id', accountId);
        }
      }
      if (fetchData) fetchData();
    } catch (error) { console.error("Database sync error:", error); }
  };

  const handleQuickSubmit = async (e) => {
    e.preventDefault();
    if (qiAmount <= 0) return alert("Nominal tidak boleh 0!");
    if (!qiAccount) return alert("Pilih dompet sumber dulu!");
    
    if (qiPurpose === "REIMBURSE" && qiType === "EXPENSE" && !qiReceiptFile) {
      return alert("⚠️ Anda WAJIB melampirkan berkas foto struk fisik untuk Klaim Dinas.");
    }

    let prefix = qiPurpose === "USAHA" ? "[Usaha] " : qiPurpose === "REIMBURSE" ? "[Klaim] " : "";
    let defaultTitle = qiType === 'EXPENSE' ? 'Pengeluaran' : qiType === 'INCOME' ? 'Pemasukan' : 'Pindah Dana';
    let finalTitle = qiTitle.trim() ? `${prefix}${qiTitle}` : `${prefix}${defaultTitle} ${qiType === 'TRANSFER' ? '' : qiCategory}`;

    const receiptData = qiReceiptFile ? await fileToBase64(qiReceiptFile) : null;

    executeAddTransaction(finalTitle, qiAmount.toString(), qiType, qiAccount, qiPurpose === "REIMBURSE", qiType === "TRANSFER" ? "Transfer" : qiCategory, receiptData, qiType === "TRANSFER" ? qiAccountTo : null);

    if (qiIsRecurring) {
      try {
        let activeSession = session;
        if (!activeSession) {
          const { data: { session: currentSession } } = await supabase.auth.getSession();
          activeSession = currentSession;
        }
        
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);
        const nextRunDateStr = nextDate.toISOString().split("T")[0];

        const { error: recErr } = await supabase.from('recurring_transactions').insert({
          user_id: activeSession.user.id,
          title: finalTitle,
          amount: qiAmount,
          type: qiType,
          category: qiType === "TRANSFER" ? "Transfer" : qiCategory,
          account_id: qiAccount,
          next_run_date: nextRunDateStr,
          status: 'ACTIVE'
        });

        if (recErr) {
          console.error("Gagal simpan rutinitas (manual):", recErr);
          alert("Gagal menyinkronkan tagihan rutin ke database: " + recErr.message);
        }
      } catch (err) {
        console.error("Kesalahan sistem:", err);
      }
    }

    const userMsg = qiType === "TRANSFER" ? `Pindahkan Rp${maskRupiah(qiAmount)} dari ${accounts.find(a => a.id === qiAccount)?.name} ke ${accounts.find(a => a.id === qiAccountTo)?.name}` : `Catat manual: ${finalTitle} Rp${maskRupiah(qiAmount)}`;
    
    let aiMsg = qiType === "TRANSFER" ? `✨ Siap Bosku! Mutasi dana udah aku amankan.` : `✨ Siap Bosku! ${finalTitle} sebesar ${formatRp(qiAmount)} udah berhasil dicatat.`;
    if (qiIsRecurring) {
      aiMsg += ` Oh ya, tagihan ini udah aku daftarkan buat ditagih otomatis setiap bulan ya! 🔄`;
    }

    saveChatToLocal([...chatHistory, 
      { id: `msg-${Date.now()}`, sender: "user", text: userMsg, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) },
      { id: `msg-${Date.now()+1}`, sender: "ai", text: aiMsg, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }
    ]);
    
    setQiAmount(0); setQiTitle(""); setQiReceiptFile(null); setQiReceiptPreview(""); setQiIsRecurring(false);
    setActiveTab("chat");
  };

  const handleSendChatMessage = async (e) => {
    e.preventDefault();
    if (!chatInputText.trim()) return;
    
    const historyWithUser = [...chatHistory, { id: `msg-${Date.now()}`, sender: "user", text: chatInputText, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }];
    saveChatToLocal(historyWithUser);
    
    const currentInput = chatInputText;
    setChatInputText(""); setIsTyping(true); 
    
    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        setIsTyping(false);
        alert("⚠️ API Key Gemini belum dipasang di .env!");
        return;
      }

      // KUNCI PERBAIKAN: Berikan ID UUID Dompet dengan sangat jelas agar AI bisa Transfer
      const accountsFormatted = accounts.map(a => {
        const group = (a.account_group || 'PRIBADI').toUpperCase();
        return `- ${a.name} (UUID: ${a.id}) [GRUP: ${group}]`;
      }).join('\n');

      const contextHistory = chatHistory.slice(-4).map(m => `${m.sender === 'user' ? 'Pengguna' : 'AI'}: ${m.text}`).join('\n');
      const categoriesFormatted = dbCategories.join(', ');

      const prompt = `Anda asisten keuangan cerdas.
Daftar rekening pengguna:
${accountsFormatted}

Daftar Kategori yang tersedia di database:
[${categoriesFormatted}]

Riwayat (Ingatan):
${contextHistory}

Pesan baru: "${currentInput}"

ATURAN KETAT (BACA HATI-HATI):
1. Jika isi pesan tentang "pindah dana", "transfer", "tarik tunai", atau "top up", maka "type" WAJIB diisi "TRANSFER".
2. Khusus untuk TRANSFER: Anda WAJIB mengisi "account_id" (sebagai sumber/asal) dan "to_account_id" (sebagai tujuan). Keduanya harus diisi dengan UUID persis dari daftar rekening di atas.
3. Jika pesan BUKAN tentang transfer, maka "to_account_id" biarkan null, dan "type" diisi "EXPENSE" atau "INCOME".
4. JANGAN PERNAH set "is_transaction": true JIKA nominal angka (amount) BELUM PASTI! Tanya dulu nominalnya.
5. "category" WAJIB diisi dengan SATU nama kategori dari daftar. Jika transfer, isi saja "Transfer" atau kategori yang relevan.

BALAS HANYA OBJEK JSON MURNI TANPA MARKDOWN:
{ 
  "is_transaction": true/false, 
  "title": "Judul Transaksi Singkat", 
  "amount": angka_murni_tanpa_titik (contoh: 50000), 
  "type": "EXPENSE/INCOME/TRANSFER", 
  "account_id": "UUID Dompet Asal", 
  "to_account_id": "UUID Dompet Tujuan (atau null jika bukan transfer)",
  "category": "Pilih SATU dari daftar kategori", 
  "is_reimburse": false, 
  "is_recurring": true/false,
  "reply_message": "Balasan asik sapa Bosku", 
  "trigger_mission": null 
}`;
      
      let rawResponse = await callGeminiDirectly(prompt, null, apiKey);
      
      const jsonStart = rawResponse.indexOf('{');
      const jsonEnd = rawResponse.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
         rawResponse = rawResponse.substring(jsonStart, jsonEnd + 1);
      }
      const data = JSON.parse(rawResponse);
      
      setIsTyping(false);
      
      if (data.is_transaction) {
        if (data.is_reimburse) {
          saveChatToLocal([...historyWithUser, { id: `msg-${Date.now()+1}`, sender: "ai", text: "⚠️ Wah Bosku, pencatatan Klaim via teks aku tolak ya. Pindah ke tab 'Sat-Set Manual' buat lampirin struk fisiknya!", timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
          return;
        }

        const cleanAmount = typeof data.amount === 'string' ? parseInt(data.amount.replace(/[^0-9]/g, ""), 10) : (Number(data.amount) || 0);
        
        let parsedAccountId = data.account_id;
        const isIdValid = accounts.some(a => a.id === parsedAccountId);
        if (!isIdValid) {
            const fallbackAcc = accounts.find(a => a.name.toLowerCase().includes(String(parsedAccountId).toLowerCase())) || accounts[0];
            parsedAccountId = fallbackAcc ? fallbackAcc.id : null;
        }

        // PENCOCOKAN DOMPET TUJUAN (KHUSUS TRANSFER)
        let parsedToAccountId = data.to_account_id || null;
        if (parsedToAccountId) {
            const isToIdValid = accounts.some(a => a.id === parsedToAccountId);
            if (!isToIdValid) {
                const fallbackToAcc = accounts.find(a => a.name.toLowerCase().includes(String(parsedToAccountId).toLowerCase()));
                parsedToAccountId = fallbackToAcc ? fallbackToAcc.id : null;
            }
        }
        
        const isRecurringBool = String(data.is_recurring).toLowerCase() === 'true';

        let finalType = data.type;
        let finalCategory = data.category;
        
        // FAILSAFE TERAKHIR JIKA AI MASIH BANDEL MENGANGGAP TRANSFER SEBAGAI EXPENSE
        const lowerInput = currentInput.toLowerCase();
        if (lowerInput.includes("pindah") || lowerInput.includes("transfer") || lowerInput.includes("tarik tunai") || lowerInput.includes("top up")) {
            finalType = "TRANSFER";
            finalCategory = "Transfer";
            
            // Jika AI gagal nebak rekening tujuan, kita cari rekening lain otomatis agar tidak error
            if (!parsedToAccountId || parsedToAccountId === parsedAccountId) {
                 const alternativeAcc = accounts.find(a => a.id !== parsedAccountId);
                 parsedToAccountId = alternativeAcc ? alternativeAcc.id : null;
            }
        } else {
            const matchedCategory = dbCategories.find(c => c.toLowerCase() === String(finalCategory).toLowerCase());
            const forcedCat = dbCategories.find(c => lowerInput.includes(c.toLowerCase()));
            if (forcedCat) {
              finalCategory = forcedCat; 
            } else if (matchedCategory) {
              finalCategory = matchedCategory; 
            } else {
              finalCategory = dbCategories.includes("Lain-lain") ? "Lain-lain" : (dbCategories[0] || "Lain-lain");
            }
        }

        // PERUBAHAN KRUSIAL: Memasukkan parsedToAccountId ke fungsi eksekutor
        executeAddTransaction(data.title, cleanAmount.toString(), finalType, parsedAccountId, data.is_reimburse, finalCategory, null, parsedToAccountId);

        if (isRecurringBool) {
          try {
            let activeSession = session;
            if (!activeSession) {
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              activeSession = currentSession;
            }
            
            const nextDate = new Date();
            nextDate.setMonth(nextDate.getMonth() + 1);
            const nextRunDateStr = nextDate.toISOString().split("T")[0];

            const { error: recErr } = await supabase.from('recurring_transactions').insert({
              user_id: activeSession.user.id,
              title: data.title || "Tagihan Rutin",
              amount: cleanAmount,
              type: finalType || "EXPENSE",
              category: finalCategory,
              account_id: parsedAccountId,
              next_run_date: nextRunDateStr,
              status: 'ACTIVE'
            });

            if (recErr) {
              console.error("Gagal simpan tagihan rutin (AI):", recErr);
            }
          } catch (err) {
            console.error("Error Sistem Rutin:", err);
          }
        }
      }
      
      if (data.trigger_mission) setAiProposedMission({ title: data.trigger_mission.title, category: data.trigger_mission.category, keywords: data.trigger_mission.keywords, accepted: false });

      saveChatToLocal([...historyWithUser, { id: `msg-${Date.now()+2}`, sender: "ai", text: data.reply_message, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
    } catch (err) { 
      setIsTyping(false); 
      saveChatToLocal([...historyWithUser, { id: `msg-${Date.now()+3}`, sender: "ai", text: `Duh, gagal proses teks nih Bosku: ${err.message}`, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]); 
    }
  };

  const triggerCamera = () => fileInputRef.current?.click();

  const handleRealCameraUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    let base64Image;
    try {
      base64Image = await fileToBase64(file);
    } catch (err) {
      alert("Gagal membaca file gambar.");
      return;
    }

    const initialHistory = [...chatHistory, { id: `msg-${Date.now()}`, sender: "user", text: `Menganalisa struk...`, image: base64Image, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }];
    saveChatToLocal(initialHistory);
    setIsTyping(true);

    const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      setIsTyping(false);
      alert("⚠️ API Key Gemini belum dipasang di .env!");
      return;
    }

    try {
      const pureBase64Data = base64Image.split(',')[1];
      const categoriesFormatted = dbCategories.join(', ');
      
      const prompt = `Anda adalah asisten data keuangan. Pindai gambar struk atau bukti transfer ini.
      Keluarkan HANYA format JSON valid tanpa awalan/akhiran apapun. JANGAN ADA TEKS LAIN.
      Format wajib:
      {
        "title": "Nama Toko atau Judul Transaksi Singkat",
        "amount": angka_nominal_tanpa_simbol_dan_titik,
        "category": "Pilih HANYA SATU dari daftar ini: [${categoriesFormatted}]"
      }`;
      
      let rawResponse = await callGeminiDirectly(prompt, pureBase64Data, apiKey);
      
      const jsonStart = rawResponse.indexOf('{');
      const jsonEnd = rawResponse.lastIndexOf('}');
      if (jsonStart !== -1 && jsonEnd !== -1) {
         rawResponse = rawResponse.substring(jsonStart, jsonEnd + 1);
      }
      
      const data = JSON.parse(rawResponse);

      setIsTyping(false);
      saveChatToLocal([...initialHistory, { id: `msg-${Date.now()+1}`, sender: "ai", text: "✨ Kertas struk berhasil di-scan Bosku! Cek dulu ya datanya di layar pop-up.", timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
      
      let finalCategory = data.category;
      if (!dbCategories.includes(finalCategory)) {
        finalCategory = dbCategories[0] || "Lain-lain";
      }

      setOcrReviewData({ 
        title: data.title || "Belanja", amount: data.amount ? data.amount.toString() : "0", 
        accountId: accounts[0]?.id || "", purpose: "PRIBADI", category: finalCategory, fileRef: file 
      });
      if(e.target) e.target.value = null; 
    } catch (error) {
      console.error("AI Vision Error:", error);
      setIsTyping(false);
      saveChatToLocal([...initialHistory, { id: `msg-${Date.now()+3}`, sender: "ai", text: `Gagal membaca dokumen: ${error.message}`, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
      if(e.target) e.target.value = null;
    }
  };

  const handleConfirmOcrSubmit = async (e) => {
    e.preventDefault();
    const isDinas = ocrReviewData.purpose === "REIMBURSE";
    
    if (isDinas && !ocrReviewData.fileRef) return alert("⚠️ Foto nota fisik wajib dilampirkan untuk Klaim Dinas.");

    let finalTitle = ocrReviewData.title;
    if (ocrReviewData.purpose === "USAHA") finalTitle = `[Usaha] ${finalTitle}`;
    if (ocrReviewData.purpose === "REIMBURSE") finalTitle = `[Klaim] ${finalTitle}`;

    const receiptData = ocrReviewData.fileRef ? await fileToBase64(ocrReviewData.fileRef) : null;

    executeAddTransaction(finalTitle, ocrReviewData.amount, "EXPENSE", ocrReviewData.accountId, isDinas, ocrReviewData.category, receiptData);
    
    saveChatToLocal([...chatHistory, { id: `msg-${Date.now()+2}`, sender: "ai", text: `✨ Mantap! Transaksi "${finalTitle}" udah sukses masuk ke catatan kita, Bosku!`, timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) }]);
    setOcrReviewData(null);
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#FDFBF7] relative">
      
      {/* STICKY HEADER (TABS NAVIGATION) */}
      <div className="sticky top-0 z-40 bg-[#FDFBF7] px-3 pt-3 pb-2 border-b-2 border-stone-100">
        <div className="grid grid-cols-2 p-1 bg-white border-2 border-[#1E1E1E] rounded-xl shadow-[2px_2px_0px_0px_#1E1E1E]">
          <button onClick={() => setActiveTab("chat")} className={`py-2 text-xs font-black transition rounded-lg ${activeTab === 'chat' ? 'bg-[#1E1E1E] text-white' : 'text-stone-500 hover:bg-stone-100'}`}>💬 Chat AI</button>
          <button onClick={() => setActiveTab("manual")} className={`py-2 text-xs font-black transition rounded-lg ${activeTab === 'manual' ? 'bg-[#1E1E1E] text-white' : 'text-stone-500 hover:bg-stone-100'}`}>⚡ Sat-Set Manual</button>
        </div>
      </div>

      {/* SAT-SET MANUAL TAB */}
      {activeTab === "manual" && (
        <div className="flex-1 flex flex-col min-h-0 animate-in fade-in">
          {/* Form Scrollable Area */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <div className="flex flex-col sm:flex-row justify-between gap-3">
              <div className="flex-1">
                <label className="text-[10px] font-black text-stone-500 uppercase block mb-1">Status Peruntukan</label>
                <div className="flex gap-1 p-1 bg-stone-200 border-2 border-[#1E1E1E] rounded-xl h-11">
                  <button type="button" onClick={() => setQiPurpose("PRIBADI")} className={`flex-1 text-[10px] font-black uppercase rounded-lg border-2 ${qiPurpose === 'PRIBADI' ? 'bg-sky-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-transparent border-transparent text-stone-500'}`}>Pribadi</button>
                  <button type="button" onClick={() => setQiPurpose("USAHA")} className={`flex-1 text-[10px] font-black uppercase rounded-lg border-2 ${qiPurpose === 'USAHA' ? 'bg-orange-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-transparent border-transparent text-stone-500'}`}>Usaha</button>
                  <button type="button" onClick={() => setQiPurpose("REIMBURSE")} className={`flex-1 text-[10px] font-black uppercase rounded-lg border-2 ${qiPurpose === 'REIMBURSE' ? 'bg-amber-400 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-transparent border-transparent text-stone-500'}`}>Klaim</button>
                </div>
              </div>
              
              {/* TIPE SECTION FIXED - Sejajar dan simetris penuh ke kanan */}
              <div className="shrink-0 sm:mt-0">
                <label className="text-[10px] font-black text-stone-500 uppercase block mb-1">Tipe</label>
                <div className="flex gap-1 border-2 border-[#1E1E1E] rounded-xl overflow-hidden h-11 bg-[#1E1E1E] p-1">
                  <button onClick={() => setQiType("EXPENSE")} className={`flex-1 flex items-center justify-center text-[10px] rounded-lg font-black uppercase ${qiType === 'EXPENSE' ? 'bg-rose-500 text-white border-2 border-[#1E1E1E]' : 'bg-transparent text-stone-300'}`}>Keluar</button>
                  <button onClick={() => setQiType("INCOME")} className={`flex-1 flex items-center justify-center text-[10px] rounded-lg font-black uppercase ${qiType === 'INCOME' ? 'bg-emerald-500 text-white border-2 border-[#1E1E1E]' : 'bg-transparent text-stone-300'}`}>Masuk</button>
                  <button onClick={() => setQiType("TRANSFER")} className={`flex-1 flex items-center justify-center text-[10px] rounded-lg font-black uppercase ${qiType === 'TRANSFER' ? 'bg-indigo-500 text-white border-2 border-[#1E1E1E]' : 'bg-transparent text-stone-300'}`}><ArrowRightLeft size={14}/></button>
                </div>
              </div>
            </div>

            <div className="bg-white border-2 border-[#1E1E1E] rounded-2xl p-4 shadow-[2px_2px_0px_0px_#1E1E1E]">
              <div className="flex items-center gap-2 border-b-2 border-stone-100 pb-2 mb-2">
                <span className={`text-2xl font-black ${qiType === 'EXPENSE' ? 'text-rose-600' : qiType === 'INCOME' ? 'text-emerald-600' : 'text-indigo-600'}`}>Rp</span>
                <input type="text" inputMode="numeric" placeholder="0" value={qiAmount === 0 ? "" : maskRupiah(qiAmount)} onChange={(e) => setQiAmount(unmaskNumber(e.target.value))} className={`w-full bg-transparent text-3xl font-black outline-none placeholder:text-stone-300 ${qiType === 'EXPENSE' ? 'text-rose-600' : qiType === 'INCOME' ? 'text-emerald-600' : 'text-indigo-600'}`} />
              </div>
              <input type="text" placeholder="Catatan (Opsional, cth: Beli Kopi)" value={qiTitle} onChange={(e) => setQiTitle(e.target.value)} className="w-full bg-transparent text-sm font-bold text-stone-600 outline-none placeholder:text-stone-400" />
            </div>

            {qiPurpose === "REIMBURSE" && qiType === "EXPENSE" && (
              <div className="flex items-center justify-between bg-amber-50 border-2 border-[#1E1E1E] rounded-xl p-3 animate-in fade-in">
                <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest pl-1">Lampirkan Struk</span>
                
                <input type="file" accept="image/*" ref={qiFileInputRef} onChange={handleQiFileChange} className="hidden" />
                
                {!qiReceiptPreview ? (
                  <button type="button" onClick={() => qiFileInputRef.current?.click()} className="flex items-center gap-2 bg-white border-2 border-[#1E1E1E] rounded-lg px-4 py-2 hover:bg-stone-100 active:translate-y-0.5 shadow-[2px_2px_0px_0px_#1E1E1E] transition">
                    <Camera size={16} strokeWidth={2.5} />
                    <span className="text-[10px] font-black uppercase">Upload</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2 bg-emerald-100 border-2 border-[#1E1E1E] px-3 py-1.5 rounded-lg shadow-[2px_2px_0px_0px_#1E1E1E]">
                    <span className="text-[9px] font-bold text-emerald-800 truncate max-w-[100px]">{qiReceiptFile?.name}</span>
                    <button type="button" onClick={() => { setQiReceiptFile(null); setQiReceiptPreview(""); }} className="bg-white border-2 border-[#1E1E1E] rounded-md p-1 hover:bg-rose-100 transition active:scale-95">
                      <X size={12} strokeWidth={3} className="text-rose-600" />
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="flex flex-wrap justify-center gap-2">
              {[5000, 10000, 25000, 50000, 100000, 500000].map(val => (
                <button key={val} onClick={() => setQiAmount(prev => prev + val)} className="bg-white border-2 border-[#1E1E1E] rounded-lg px-3 py-1.5 text-[10px] font-black text-[#1E1E1E] hover:bg-amber-100 transition shadow-[2px_2px_0px_0px_#1E1E1E] active:translate-y-0.5">
                  + {val >= 100000 ? `${val/1000}K` : `${val/1000}K`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3" ref={dropdownRef}>
              <div className="relative">
                <label className="text-[10px] font-black text-stone-500 uppercase mb-1 block">{qiType === "TRANSFER" ? "Dari Dompet" : "Dompet / CC"}</label>
                <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'fromAcc' ? null : 'fromAcc')} className="w-full text-xs font-black p-3 border-2 border-[#1E1E1E] rounded-xl bg-white text-left flex justify-between items-center shadow-[2px_2px_0px_0px_#1E1E1E]">
                  <span className="truncate mr-2">{accounts.find(a => a.id === qiAccount)?.name || "Pilih..."}</span> <ChevronDown size={16}/>
                </button>
                {activeDropdown === 'fromAcc' && (
                  <ul className="absolute z-50 w-full mt-2 bg-white border-2 border-[#1E1E1E] rounded-xl shadow-xl max-h-48 overflow-y-auto animate-in fade-in [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {accounts.map(acc => (
                      <li key={acc.id} onClick={() => { setQiAccount(acc.id); setActiveDropdown(null); }} className="p-3 border-b border-stone-100 hover:bg-amber-50 cursor-pointer text-xs font-black">{acc.name}</li>
                    ))}
                  </ul>
                )}
              </div>

              {qiType === "TRANSFER" ? (
                <div className="relative">
                  <label className="text-[10px] font-black text-stone-500 uppercase mb-1 block">Ke Tujuan</label>
                  <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'toAcc' ? null : 'toAcc')} className="w-full text-xs font-black p-3 border-2 border-[#1E1E1E] rounded-xl bg-white text-left flex justify-between items-center shadow-[2px_2px_0px_0px_#1E1E1E] border-indigo-300">
                    <span className="truncate mr-2">{accounts.find(a => a.id === qiAccountTo)?.name || "Pilih Tujuan..."}</span> <ChevronDown size={16}/>
                  </button>
                  {activeDropdown === 'toAcc' && (
                    <ul className="absolute z-50 w-full mt-2 bg-white border-2 border-[#1E1E1E] rounded-xl shadow-xl max-h-48 overflow-y-auto animate-in fade-in [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {accounts.map(acc => {
                        if (acc.id === qiAccount) return null; 
                        return <li key={acc.id} onClick={() => { setQiAccountTo(acc.id); setActiveDropdown(null); }} className="p-3 border-b border-stone-100 hover:bg-indigo-50 cursor-pointer text-xs font-black">{acc.name}</li>
                      })}
                    </ul>
                  )}
                </div>
              ) : (
                <div className="relative">
                  <label className="text-[10px] font-black text-stone-500 uppercase mb-1 block">Kategori</label>
                  <button type="button" onClick={() => setActiveDropdown(activeDropdown === 'category' ? null : 'category')} className="w-full text-xs font-black p-3 border-2 border-[#1E1E1E] rounded-xl bg-white text-left flex justify-between items-center shadow-[2px_2px_0px_0px_#1E1E1E]">
                    <span className="truncate mr-2">{qiCategory}</span> <ChevronDown size={16}/>
                  </button>
                  {activeDropdown === 'category' && (
                    <ul className="absolute z-50 w-full mt-2 bg-white border-2 border-[#1E1E1E] rounded-xl shadow-xl max-h-48 overflow-y-auto animate-in fade-in [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                      {dbCategories.map(cat => (
                        <li key={cat} onClick={() => { setQiCategory(cat); setActiveDropdown(null); }} className="p-3 border-b border-stone-100 hover:bg-amber-50 cursor-pointer text-xs font-bold">{cat}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-between p-3 mt-4 bg-stone-100 border-2 border-[#1E1E1E] rounded-xl shadow-[2px_2px_0px_0px_#1E1E1E]">
              <div className="flex items-center gap-2">
                <Repeat size={16} className="text-indigo-600" />
                <span className="text-[10px] font-black uppercase text-stone-600 tracking-wider">Jadikan Tagihan Otomatis</span>
              </div>
              <button 
                type="button"
                onClick={() => setQiIsRecurring(!qiIsRecurring)} 
                className={`w-12 h-6 rounded-full border-2 border-[#1E1E1E] relative transition-colors ${qiIsRecurring ? 'bg-indigo-500' : 'bg-stone-300'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white border-2 border-[#1E1E1E] rounded-full transition-all ${qiIsRecurring ? 'left-6' : 'left-0.5'}`}></div>
              </button>
            </div>
          </div>

          {/* STICKY BOTTOM BUTTON (SIMPAN TRANSAKSI) */}
          <div className="sticky bottom-0 z-30 bg-gradient-to-t from-[#FDFBF7] via-[#FDFBF7] to-transparent p-4 shrink-0 border-t border-stone-200/50">
            <button onClick={handleQuickSubmit} className="w-full min-h-[50px] bg-[#1E1E1E] text-white p-3 rounded-xl font-black text-sm uppercase tracking-widest shadow-[4px_4px_0px_0px_#D6D3D1] active:translate-y-1 transition">
              Simpan Transaksi
            </button>
          </div>
        </div>
      )}

      {/* CHAT AI TAB */}
      {activeTab === "chat" && (
        <div className="flex-1 flex flex-col min-h-0 bg-white animate-in fade-in">
          
          {/* Sub-Header Chat Info */}
          <div className="bg-stone-100 border-b-2 border-stone-200 px-4 py-3 flex justify-between items-center shrink-0">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-widest flex items-center gap-1.5"><Sparkles size={14}/> AI Asisten</span>
            {chatHistory.length > 0 && (
              <button onClick={() => setShowClearChatConfirm(true)} className="flex items-center gap-1.5 text-[9px] font-black text-rose-500 bg-white border-2 border-[#1E1E1E] px-2.5 py-1.5 rounded-lg shadow-[2px_2px_0px_0px_#1E1E1E] active:translate-y-0.5 transition hover:bg-rose-50">
                <Trash2 size={12} strokeWidth={3} /> Bersihkan Memori
              </button>
            )}
          </div>

          {/* Chat Flow (Scrollable Area) */}
          <div ref={chatContainerRef} className="flex-1 p-4 overflow-y-auto space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] scroll-smooth">
            {chatHistory.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-4 opacity-60">
                <Sparkles size={36} className="mb-3 text-stone-400" />
                <p className="text-xs font-bold text-stone-500">Halo Bosku! Mau catat transaksi atau scan struk? <br/>Ketik aja di bawah ini!</p>
              </div>
            )}
            {chatHistory.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] border-2 border-[#1E1E1E] p-3 rounded-xl text-xs font-bold leading-relaxed ${msg.sender === 'user' ? 'bg-amber-100 text-stone-900 rounded-tr-sm shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 text-stone-800 rounded-tl-sm shadow-[2px_2px_0px_0px_#D6D3D1]'}`}>
                  {msg.image && (
                    msg.image.startsWith('blob:') ? (
                      <div className="w-full p-3 bg-rose-50 border-2 border-dashed border-rose-300 rounded-lg text-rose-500 text-[10px] text-center mb-2">⚠️ Gambar lama terhapus dari cache. Silakan "Bersihkan Memori" chat.</div>
                    ) : (
                      <img src={msg.image} alt="Upload Struk" className="w-full h-auto rounded-lg mb-2 border border-stone-300" />
                    )
                  )}
                  {msg.text}
                </div>
                <span className="text-[8px] font-mono text-stone-400 mt-1 px-1">{msg.timestamp}</span>
              </div>
            ))}
            {aiProposedMission && (
              <div className="bg-[#FFFBEB] border-4 border-amber-500 rounded-2xl p-4 shadow-[4px_4px_0px_0px_#F59E0B] space-y-3 max-w-[90%] animate-in slide-in-from-left-4">
                <div className="flex items-center gap-2 text-amber-700"><Sparkles size={16} /><h4 className="text-[10px] font-black uppercase">Pelatih Finansial AI</h4></div>
                <p className="text-xs font-bold text-stone-700">Tantangan baru! Mari aktifkan <strong>Misi: {aiProposedMission.title}</strong> selama 5 hari ke depan?</p>
                {aiProposedMission.accepted ? (
                  <span className="inline-flex text-xs font-black text-emerald-600 bg-emerald-50 border-2 border-emerald-500 px-3 py-1.5 rounded-xl w-full justify-center">✓ Misi Aktif!</span>
                ) : (
                  <button onClick={() => handleAcceptMission(aiProposedMission.title, aiProposedMission.category, aiProposedMission.keywords)} className="w-full bg-amber-500 text-white font-black text-xs uppercase py-3 rounded-xl border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] active:translate-y-0.5">Aktifkan Misi</button>
                )}
              </div>
            )}
          </div>

          {/* STICKY BOTTOM INPUT (CHAT) */}
          <div className="sticky bottom-0 z-30 p-3 border-t-2 border-[#1E1E1E] bg-stone-50 shrink-0">
            <form onSubmit={handleSendChatMessage} className="flex items-center gap-2 bg-white border-2 border-[#1E1E1E] rounded-full p-1.5 shadow-[2px_2px_0px_0px_#1E1E1E]">
              <input type="file" accept="image/*" ref={fileInputRef} onChange={handleRealCameraUpload} className="hidden" />
              <button type="button" onClick={triggerCamera} className="w-10 h-10 flex-shrink-0 bg-stone-100 rounded-full flex items-center justify-center border-2 border-[#1E1E1E] hover:bg-amber-100 active:scale-95 transition">
                <Camera size={18} strokeWidth={2.5} className="text-[#1E1E1E]" />
              </button>
              <input type="text" value={chatInputText} onChange={(e) => setChatInputText(e.target.value)} disabled={isTyping} placeholder="Ketik pesan ke AI..." className="flex-1 text-sm px-2 font-bold bg-transparent outline-none disabled:opacity-50 text-stone-800" />
              <button type="submit" disabled={!chatInputText.trim() || isTyping} className="w-10 h-10 flex-shrink-0 bg-[#1E1E1E] text-white rounded-full flex items-center justify-center hover:bg-stone-800 active:scale-95 transition disabled:opacity-30">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      )}

      {/* POPUP & MODALS (Z-INDEX SUPER TINGGI) */}
      {showClearChatConfirm && (
        <div className="fixed inset-0 bg-black/60 z-[999] flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-xs bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-3xl p-6 shadow-[8px_8px_0px_0px_#000] text-center animate-in zoom-in-95">
            <div className="w-16 h-16 bg-rose-100 rounded-full border-4 border-[#1E1E1E] flex items-center justify-center mx-auto mb-4">
              <Trash2 size={28} className="text-rose-600" />
            </div>
            <h3 className="text-sm font-black text-[#1E1E1E] uppercase mb-2">Bersihkan Memori Chat?</h3>
            <p className="text-xs font-bold text-stone-500 mb-6">Semua riwayat obrolan dengan Asisten AI akan dihapus permanen.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowClearChatConfirm(false)} className="flex-1 py-3 bg-stone-200 text-[#1E1E1E] text-xs font-black uppercase rounded-xl border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] hover:bg-stone-300 transition active:translate-y-px active:shadow-none">
                Batal
              </button>
              <button onClick={executeClearChat} className="flex-1 py-3 bg-rose-500 text-white text-xs font-black uppercase rounded-xl border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E] hover:bg-rose-400 transition active:translate-y-px active:shadow-none">
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}

      {ocrReviewData && (
         <div className="fixed inset-0 bg-black/80 z-[999] flex items-center justify-center p-4">
            <form onSubmit={handleConfirmOcrSubmit} className="w-full max-w-sm bg-[#FDFBF7] border-4 border-[#1E1E1E] rounded-3xl p-5 shadow-[8px_8px_0px_0px_#000] space-y-4 animate-in zoom-in-95 duration-200">
             <div className="flex justify-between items-center border-b-4 border-[#1E1E1E] pb-3">
               <h3 className="text-sm font-black text-[#1E1E1E] uppercase flex items-center gap-1.5"><Sparkles size={16} className="text-amber-500"/> Verifikasi Struk AI</h3>
               <button type="button" onClick={() => setOcrReviewData(null)} className="w-8 h-8 flex items-center justify-center bg-stone-200 rounded-lg border-2 border-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]"><X size={16} /></button>
             </div>
             
             <div className="space-y-3 pt-1">
               <div>
                 <label className="text-[10px] font-black text-stone-500 uppercase block mb-1">Status Peruntukan Dana</label>
                 <div className="flex gap-1.5 bg-stone-200 p-1 rounded-xl border-2 border-[#1E1E1E]">
                   <button type="button" onClick={() => setOcrReviewData({...ocrReviewData, purpose: "PRIBADI"})} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 border-[#1E1E1E] ${ocrReviewData.purpose === "PRIBADI" ? 'bg-sky-400 text-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 text-stone-500'}`}>Pribadi</button>
                   <button type="button" onClick={() => setOcrReviewData({...ocrReviewData, purpose: "USAHA"})} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 border-[#1E1E1E] ${ocrReviewData.purpose === "USAHA" ? 'bg-orange-400 text-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 text-stone-500'}`}>Usaha</button>
                   <button type="button" onClick={() => setOcrReviewData({...ocrReviewData, purpose: "REIMBURSE"})} className={`flex-1 text-[9px] font-black uppercase py-2 rounded-lg transition border-2 border-[#1E1E1E] ${ocrReviewData.purpose === "REIMBURSE" ? 'bg-amber-400 text-[#1E1E1E] shadow-[2px_2px_0px_0px_#1E1E1E]' : 'bg-stone-50 text-stone-500'}`}>Klaim</button>
                 </div>
               </div>
               <div>
                 <label className="text-[10px] font-black text-stone-500 uppercase block mb-1">Gunakan Dompet / CC</label>
                 <select value={ocrReviewData.accountId} onChange={(e) => setOcrReviewData({...ocrReviewData, accountId: e.target.value})} className="w-full text-xs font-bold p-3 border-2 border-[#1E1E1E] rounded-xl bg-white shadow-[2px_2px_0px_0px_#1E1E1E] outline-none">
                   {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name} ({acc.type === 'cc' ? 'Limit' : 'Saldo'}: {formatRp(acc.type === 'cc' ? Number(acc.credit_limit)+Number(acc.balance) : acc.balance)})</option>)}
                 </select>
               </div>
               <div className="grid grid-cols-2 gap-2">
                 <div>
                   <label className="text-[9px] font-black text-stone-500 uppercase block mb-1">Nama Barang</label>
                   <input type="text" value={ocrReviewData.title} onChange={(e) => setOcrReviewData({...ocrReviewData, title: e.target.value})} className="w-full text-xs p-3 border-2 border-[#1E1E1E] bg-white rounded-xl font-bold shadow-[2px_2px_0px_0px_#1E1E1E]" required />
                 </div>
                 <div>
                   <label className="text-[9px] font-black text-stone-500 uppercase block mb-1">Nominal (Rp)</label>
                   <input type="text" inputMode="numeric" value={maskRupiah(ocrReviewData.amount)} onChange={(e) => setOcrReviewData({...ocrReviewData, amount: unmaskNumber(e.target.value)})} className="w-full text-xs p-3 border-2 border-[#1E1E1E] bg-white rounded-xl font-mono font-black text-rose-600 shadow-[2px_2px_0px_0px_#1E1E1E]" required />
                 </div>
               </div>
             </div>
             <button type="submit" className="w-full p-4 mt-2 bg-emerald-500 text-[#1E1E1E] font-black text-xs uppercase tracking-widest rounded-xl border-4 border-[#1E1E1E] shadow-[4px_4px_0px_0px_#1E1E1E] active:scale-95 transition"><CheckCircle size={18} strokeWidth={3} className="inline mr-2" /> VALIDASI & SIMPAN</button>
            </form>
          </div>
      )}
    </div>
  );
}