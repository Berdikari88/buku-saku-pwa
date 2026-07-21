// src/mockData.js

export const INITIAL_ACCOUNTS = [
  { id: "acc-1", name: "Main Cash (Dompet)", type: "CASH", account_group: "PRIBADI", balance: 1420000 },
  { id: "acc-2", name: "BCA Savings", type: "BANK", account_group: "PRIBADI", balance: 8750000 },
  { id: "acc-a2-2", name: "Mandiri Pribadi", type: "BANK", account_group: "PRIBADI", balance: 3200000 },
  { id: "acc-3", name: "GoPay Wallet", type: "EWALLET", account_group: "PRIBADI", balance: 420000 },
  { id: "acc-a3-2", name: "OVO Cash", type: "EWALLET", account_group: "PRIBADI", balance: 250000 },
  { id: "acc-a3-3", name: "Dana Balance", type: "EWALLET", account_group: "PRIBADI", balance: 750000 },
  { id: "acc-a3-4", name: "ShopeePay Balance", type: "EWALLET", account_group: "PRIBADI", balance: 180000 },
  { id: "acc-6", name: "CC BCA Platinum", type: "CREDIT_CARD", account_group: "PRIBADI", balance: -300000 },
  { id: "acc-6-2", name: "CC Tokopedia Card", type: "CREDIT_CARD", account_group: "PRIBADI", balance: -150000 },
  { id: "acc-4", name: "Kas Utama Toko", type: "CASH", account_group: "BISNIS", balance: 5000000 },
  { id: "acc-5", name: "Mandiri Bisnis Principal", type: "BANK", account_group: "BISNIS", balance: 12500000 },
  { id: "acc-5-2", name: "BRI Solusi Usaha", type: "BANK", account_group: "BISNIS", balance: 3500000 },
  { id: "acc-b6-1", name: "CC CIMB Niaga Bisnis", type: "CREDIT_CARD", account_group: "BISNIS", balance: -1500000 },
  { id: "acc-b6-2", name: "CC BNI Corporate", type: "CREDIT_CARD", account_group: "BISNIS", balance: -2000000 }
];

export const INITIAL_TRANSACTIONS = [
  { id: "t-1", account_id: "acc-3", title: "Kopi Starbucks Jajan", amount: 50000, type: "EXPENSE", is_reimbursement: false, category: "Lifestyle", date: "2026-07-15" },
  { id: "t-2", account_id: "acc-2", title: "Makan Bakso Klien", amount: 35000, type: "EXPENSE", is_reimbursement: true, category: "Business Meal", date: "2026-07-14", receipt_url: "struk_bakso.jpg", claim_id: null },
  { id: "t-3", account_id: "acc-5", title: "Restock Bahan Baku Baju", amount: 1500000, type: "EXPENSE", is_reimbursement: false, category: "Inventory", date: "2026-07-13" },
  { id: "t-4", account_id: "acc-6", title: "Beli Token Listrik Rumah", amount: 200000, type: "EXPENSE", is_reimbursement: false, category: "Utilitas", date: "2026-07-12" },
  { id: "t-5", account_id: "acc-2", title: "Bensin Dinas Jakarta", amount: 45000, type: "EXPENSE", is_reimbursement: true, category: "Transport", date: "2026-07-10", receipt_url: "struk_bensin.jpg", claim_id: null }
];

export const INITIAL_CHAT_HISTORY = [
  { id: "m-1", sender: "ai", text: "Layanan Asisten Finansial AI Buku Saku siap membantu Anda. Silakan ketik instruksi atau gunakan simulasi audio/OCR.", timestamp: "10:00" }
];