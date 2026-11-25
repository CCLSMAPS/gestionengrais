// البيانات المستوردة من سجل استقبال ملفات الفلاحين (Accusé de réception DOSSIER 2026-2027)
const INITIAL_DOSSIERS = [
  { dossier_no: "01", reception_date: "2026-06-30", zone: "FENOUGHIL", farmer_name: "FERME CCLS", culture: "MAIS", phone: "06-74-88-04-95", superficie: "", secteur: "/" },
  { dossier_no: "02", reception_date: "2026-06-30", zone: "ZET KENTA", farmer_name: "BERMATI SEDDIK", culture: "MAIS", phone: "06-55-95-97-14", superficie: "", secteur: "/" },
  { dossier_no: "03", reception_date: "2026-07-01", zone: "ADRAR", farmer_name: "SALMI CHERIF", culture: "MAIS", phone: "06-57-07-00-00", superficie: "", secteur: "/" },
  { dossier_no: "04", reception_date: "2026-07-06", zone: "FENOUGHIL", farmer_name: "HIBAOUI RAHMA", culture: "MAIS", phone: "06-61-66-55-26", superficie: "", secteur: "/" },
  { dossier_no: "05", reception_date: "2026-07-13", zone: "ZET KENTA", farmer_name: "HALA MOHAMMED", culture: "MAIS", phone: "06-63-03-55-64", superficie: "", secteur: "S,T" },
  { dossier_no: "06", reception_date: "2026-07-14", zone: "HMADAT RAYA SBAA", farmer_name: "KASDI ABDENOUR (COODEPA)", culture: "MAIS", phone: "06-62-47-13-21", superficie: "", secteur: "/" },
  { dossier_no: "07", reception_date: "2026-07-14", zone: "HMADAT RAYA SBAA", farmer_name: "RAMDANI OMAR", culture: "MAIS", phone: "05-42-89-65-62", superficie: "", secteur: "/" },
  { dossier_no: "08", reception_date: "2026-07-16", zone: "FENOUGHIL", farmer_name: "YOUSFI ABDERRAHMAN BEN LARBI", culture: "MAIS", phone: "06-62-92-91-79", superficie: "", secteur: "/" },
  { dossier_no: "10", reception_date: "2026-07-20", zone: "FENOUGHIL", farmer_name: "SARL COSIDER AGRICO/BACHA NOUREDDINE", culture: "MAIS", phone: "06-60-82-15-37", superficie: "", secteur: "/" },
  { dossier_no: "11", reception_date: "2026-07-20", zone: "FENOUGHIL", farmer_name: "ZENANI MAHMOUD", culture: "MAIS", phone: "06-65-75-99-21", superficie: "", secteur: "/" },
  { dossier_no: "12", reception_date: "2026-07-20", zone: "FENOUGHIL", farmer_name: "ZENANI OUMRA", culture: "MAIS", phone: "06-65-75-99-21", superficie: "", secteur: "/" },
  { dossier_no: "13", reception_date: "2026-07-21", zone: "HMADAT RAYA SBAA", farmer_name: "KASDI SOUFIANE", culture: "MAIS", phone: "05-54-66-31-47", superficie: "", secteur: "/" },
  { dossier_no: "14", reception_date: "2026-07-21", zone: "HMADAT RAYA SBAA", farmer_name: "KASDI ABDELKRIM", culture: "MAIS", phone: "05-54-66-31-47", superficie: "", secteur: "/" },
  { dossier_no: "15", reception_date: "2026-07-21", zone: "OUED ZIN", farmer_name: "SARL AGRICOFAN/FANDI HOUCINE", culture: "MAIS", phone: "06-61-46-14-14", superficie: "", secteur: "/" },
  { dossier_no: "16", reception_date: "2026-07-21", zone: "SBAA", farmer_name: "MAHRAZ SARRA", culture: "MAIS", phone: "06-72-97-31-15", superficie: "", secteur: "/" },
  { dossier_no: "17", reception_date: "2026-07-22", zone: "INZEGMIR", farmer_name: "BOUZIANE MOHAMMED", culture: "MAIS", phone: "06-65-96-06-62", superficie: "", secteur: "S,T" },
  { dossier_no: "18", reception_date: "2026-07-23", zone: "SBAA", farmer_name: "SALHI SAMIR", culture: "MAIS", phone: "06-60-93-00-71", superficie: "", secteur: "/" },
  { dossier_no: "19", reception_date: "2026-07-26", zone: "HMADAT RAYA SBAA", farmer_name: "RL", culture: "MAIS", phone: "06-61-50-56-74", superficie: "", secteur: "/" },
  { dossier_no: "20", reception_date: "2026-07-26", zone: "HMADAT RAYA SBAA", farmer_name: "TOUATI ABDELAZIZ", culture: "MAIS", phone: "06-61-50-56-74", superficie: "", secteur: "/" },
  { dossier_no: "21", reception_date: "2026-07-27", zone: "FENOUGHIL", farmer_name: "SPA 3A /ARAR ABDELLAH", culture: "MAIS", phone: "06-61-46-21-80", superficie: "", secteur: "/" },
  { dossier_no: "22", reception_date: "2026-07-29", zone: "FENOUGHIL", farmer_name: "ZEGLAOUI ABDELLAH BEN MOHAMMED", culture: "MAIS", phone: "06-63-54-83-80", superficie: "", secteur: "/" },
  { dossier_no: "23", reception_date: "2026-07-29", zone: "HMADAT RAYA SBAA", farmer_name: "DLALDJA SABAR", culture: "MAIS", phone: "06-68-26-36-86", superficie: "", secteur: "/" },
  { dossier_no: "24", reception_date: "2026-07-29", zone: "HMADAT RAYA SBAA", farmer_name: "NAAMAOUI MOHAMMED", culture: "MAIS", phone: "06-60-30-21-37", superficie: "", secteur: "/" },
  { dossier_no: "25", reception_date: "2026-07-30", zone: "TAMMEST", farmer_name: "HACHMANE MOHAMMED", culture: "MAIS", phone: "06-62-20-00-21", superficie: "", secteur: "/" },
  { dossier_no: "26", reception_date: "2026-07-30", zone: "TAMMEST", farmer_name: "AYACHE HOUCIN", culture: "MAIS", phone: "06-64-65-45-26", superficie: "", secteur: "/" }
];

// قائمة الفلاحين الإضافيين من جدول GREEN SEED
const GREEN_SEED_FARMERS = [
  { farmer_name: "OUIS NACIM", superficie: 90, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "EURL TIGANI PROMOTION", superficie: 70, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "TALHA CHIKH", superficie: 55, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "MESMOUDI SALAH", superficie: 30, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "BAHAYA MOHAMMED 2", superficie: 30, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "ABDELAOUI MOHAMMED", superficie: 30, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "BENAMRANI ABDERRAHMANE", superficie: 60, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "BENAMRANI ABDELMADJID", superficie: 80, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "DOUDI MOHAMMED", superficie: 30, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "HALALI YOUSSEF", superficie: 30, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "ABBASSI ABDERRAHMANE", superficie: 30, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "BEN SIHAMOU ABDERRAHMANE", superficie: 40, culture: "BLE", zone: "", phone: "", secteur: "/" },
  { farmer_name: "MOUSSAOUI OUMLAIDE", superficie: 30, culture: "BLE", zone: "", phone: "", secteur: "/" }
];

const DOSSIERS_STORE_KEY = "ccls_dossiers_2026_2027";

function getKnownFarmers(dossiers) {
  const byName = new Map();
  GREEN_SEED_FARMERS.forEach(f => byName.set(f.farmer_name.toUpperCase(), { ...f }));
  (dossiers || []).forEach(d => {
    const key = String(d.farmer_name || "").trim().toUpperCase();
    if (!key) return;
    const prev = byName.get(key) || {};
    byName.set(key, {
      farmer_name: key,
      farmer_card_no: d.farmer_card_no || prev.farmer_card_no || "",
      zone: d.zone || prev.zone || "",
      phone: d.phone || prev.phone || "",
      culture: d.culture || prev.culture || "",
      superficie: d.superficie !== "" && d.superficie != null ? d.superficie : (prev.superficie ?? ""),
      secteur: d.secteur || prev.secteur || "/"
    });
  });
  return [...byName.values()];
}

function readLocalDossiers() {
  try {
    const raw = localStorage.getItem(DOSSIERS_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  const seeded = INITIAL_DOSSIERS.map((r, i) => ({ id: i + 1, ...r }));
  writeLocalDossiers(seeded);
  return seeded;
}

function writeLocalDossiers(rows) {
  try {
    localStorage.setItem(DOSSIERS_STORE_KEY, JSON.stringify(rows));
  } catch (_) {}
}
