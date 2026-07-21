import React, { useState, useEffect } from "react";
import { PlusCircle, User, Home, Activity, Sparkles } from "lucide-react";
import { supabase } from "./supabaseClient";

// IMPORT SEMUA KOMPONEN LAYAR
import BerandaView from "./components/BerandaView";
import BukuLogView from "./components/BukuLogView";
import AiChatView from "./components/AiChatView";
import SettingsView from "./components/SettingsView";
import AuthView from "./components/AuthView"; 
import OnboardingView from "./components/OnboardingView";

export default function App() {
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [hasProfile, setHasProfile] = useState(null); 

  const [activeTab, setActiveTab] = useState("home");
  const [isLoading, setIsLoading] = useState(false);

  // STATE BARU: MENDETEKSI MODE RESET PASSWORD
  const [isRecovery, setIsRecovery] = useState(false);
  
  // STATE PENAMPUNG DATA
  const [accounts, setAccounts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [savingsTargets, setSavingsTargets] = useState([]);
  const [missions, setMissions] = useState([]);

  useEffect(() => {
    // 1. Deteksi Darurat dari Link URL
    if (window.location.hash.includes('type=recovery')) {
      setIsRecovery(true);
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setIsAuthLoading(false);
      // Kalau lagi recovery, jangan cek profile dulu!
      if (session && !window.location.hash.includes('type=recovery')) {
        checkProfile(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      // 2. Tangkap Event Recovery dari Supabase
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true);
      }
      
      setSession(session);
      
      if (session && event !== 'PASSWORD_RECOVERY' && !window.location.hash.includes('type=recovery')) {
        checkProfile(session.user.id);
      } else if (!session) {
        setAccounts([]);
        setTransactions([]);
        setSavingsTargets([]);
        setMissions([]);
        setHasProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function checkProfile(userId) {
    try {
      const { data, error } = await supabase.from('profiles').select('id').eq('id', userId).single();
      if (data) {
        setHasProfile(true);
        fetchData(); 
      } else {
        setHasProfile(false); 
      }
    } catch (error) {
      setHasProfile(false);
    }
  }

  async function fetchData() {
    setIsLoading(true);
    try {
      const { data: accountsData } = await supabase.from('accounts').select('*').order('name', { ascending: true });
      const { data: transactionsData } = await supabase.from('transactions').select('*').order('date', { ascending: false });
      const { data: targetsData } = await supabase.from('savings_targets').select('*').order('created_at', { ascending: false });
      const { data: missionsData } = await supabase.from('missions').select('*').order('created_at', { ascending: false });

      setAccounts(accountsData || []);
      setTransactions(transactionsData || []);
      setSavingsTargets(targetsData || []);
      setMissions(missionsData || []);
    } catch (error) {
      console.error("Gagal menyedot data:", error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-[#E6E2DE] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-[#1E1E1E] border-t-emerald-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // ========================================================
  // HADANGAN PERTAMA: Belum login ATAU sedang mode Recovery
  // ========================================================
  if (!session || isRecovery) {
    return (
      <AuthView 
        isRecovery={isRecovery} 
        onRecoveryComplete={() => {
          setIsRecovery(false);
          // Bersihkan sisa link di URL agar tidak terjebak recovery saat di-refresh
          window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
          if (session?.user?.id) checkProfile(session.user.id);
        }} 
      />
    );
  }

  if (hasProfile === false) {
    return (
      <OnboardingView 
        session={session} 
        onComplete={() => { setHasProfile(true); fetchData(); }} 
      />
    );
  }

  if (isLoading || hasProfile === null) {
    return (
      <div className="min-h-screen bg-[#E6E2DE] flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-xs font-black text-stone-500 tracking-widest uppercase">Menyiapkan Beranda...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#E6E2DE] text-[#1E1E1E] font-sans flex items-center justify-center p-0 sm:p-4 md:p-8 select-none animate-in fade-in">
      <div className="w-full max-w-md h-screen sm:h-[844px] sm:rounded-[40px] sm:border-8 sm:border-[#1E1E1E] bg-[#F8F5F2] flex flex-col relative overflow-hidden sm:shadow-[12px_12px_0px_0px_#1E1E1E]">
        
        <div className="bg-[#F8F5F2] px-6 pt-4 pb-2 flex justify-between items-center text-[10px] font-black font-mono text-[#666666] border-b-2 border-[#1E1E1E]">
          <span>BUKU SAKU GENERASI PWA</span>
          <span className="bg-emerald-500 w-2 h-2 rounded-full animate-pulse"></span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-28">
          {activeTab === "home" && <BerandaView accounts={accounts} transactions={transactions} missions={missions} savingsTargets={savingsTargets} fetchData={fetchData} session={session} setActiveTab={setActiveTab} />}
          {activeTab === "activity" && <BukuLogView accounts={accounts} setAccounts={setAccounts} transactions={transactions} setTransactions={setTransactions} />}
          {activeTab === "insights" && <AiChatView session={session} fetchData={fetchData} chatHistory={chatHistory} setChatHistory={setChatHistory} transactions={transactions} setTransactions={setTransactions} accounts={accounts} setAccounts={setAccounts} />}
          {activeTab === "profile" && <SettingsView accounts={accounts} transactions={transactions} setAccounts={setAccounts} setTransactions={setTransactions} setChatHistory={setChatHistory} setActiveTab={setActiveTab} fetchData={fetchData} />}
        </div>

        {activeTab !== "insights" && (
          <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 z-20">
            <button onClick={() => setActiveTab("insights")} className="bg-emerald-500 border-2 border-[#1E1E1E] p-3.5 rounded-full shadow-[4px_4px_0px_0px_#1E1E1E] text-white min-w-[44px] min-h-[44px] hover:bg-emerald-400 transition active:scale-95">
              <PlusCircle size={26} className="text-[#1E1E1E]" />
            </button>
          </div>
        )}

        <div className="absolute bottom-0 left-0 right-0 bg-white border-t-2 border-[#1E1E1E] py-2 px-4 flex justify-between items-center z-10 min-h-[64px]">
          <button onClick={() => setActiveTab("home")} className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] text-[10px] font-black ${activeTab === 'home' ? 'text-emerald-600' : 'text-stone-400'}`}><Home size={18} /><span>Beranda</span></button>
          <button onClick={() => setActiveTab("activity")} className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] text-[10px] font-black ${activeTab === 'activity' ? 'text-emerald-600' : 'text-stone-400'}`}><Activity size={18} /><span>Buku Log</span></button>
          <div className="w-12"></div>
          <button onClick={() => setActiveTab("insights")} className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] text-[10px] font-black ${activeTab === 'insights' ? 'text-emerald-600' : 'text-stone-400'}`}><Sparkles size={18} /><span>Asisten Pintar</span></button>
          <button onClick={() => setActiveTab("profile")} className={`flex flex-col items-center justify-center min-w-[50px] min-h-[44px] text-[10px] font-black ${activeTab === 'profile' ? 'text-emerald-600' : 'text-stone-400'}`}><User size={18} /><span>Settings</span></button>
        </div>

      </div>
    </div>
  );
}