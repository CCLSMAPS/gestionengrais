// البيانات المستوردة من سجل أذون الخروج (BON SORTIE25-26)
const INITIAL_BONS = [
  { bon_no: "870", invoice_no: "1131", sortie_date: "2025-11-27", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "KSC 1", qty: 13500, driver_name: "BERBERI MOHAMED", truck_no: "152-517-35", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "871", invoice_no: "1131", sortie_date: "2025-11-27", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "KSC3", qty: 13500, driver_name: "TURQUI KHALED", truck_no: "233-594-05", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "872", invoice_no: "1131", sortie_date: "2025-11-27", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "KSC SULFACID", qty: 2260, driver_name: "MEKDOUR AMEUF", truck_no: "9478-586-28", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "873", invoice_no: "1131", sortie_date: "2025-11-27", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "FERTILEADER 954", qty: 1130, driver_name: "MALEK RABEH", truck_no: "514-213-16", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "874", invoice_no: "1131", sortie_date: "2025-11-27", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "FERTILEADER 954", qty: 1120, driver_name: "RKHACHE ELHAML", truck_no: "1430-586-16", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "874", invoice_no: "1131", sortie_date: "2025-11-27", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "FERTI ACTYLE BOREO", qty: 2250, driver_name: "RKHACHE ELHAML", truck_no: "1430-586-16", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "875", invoice_no: "1131", sortie_date: "2025-11-27", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "KSC MIX", qty: 2700, driver_name: "BAKIRI BOUALEM", truck_no: "2141-508-16", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "876", invoice_no: "1131", sortie_date: "2025-11-27", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "MAP TIMAC 12-52", qty: 900, driver_name: "LARDJAM ALI", truck_no: "237-510-35", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "1200", invoice_no: "1381", sortie_date: "2025-12-18", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "KSC 1", qty: 8100, driver_name: "EGHICH MED LAM", truck_no: "007860-592-28", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "1200", invoice_no: "1381", sortie_date: "2025-12-18", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "KSC3", qty: 8100, driver_name: "EGHICH MED LAM", truck_no: "007860-592-28", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "1201", invoice_no: "1381", sortie_date: "2025-12-18", farmer_name: "A-FCO-AGRODIV G/ DERKAOUI - BEN", carte_fellah: "1445029", designation: "KSC SULFACID", qty: 1340, driver_name: "MELOUK HAMZA", truck_no: "1710-203-16", zone: "FENOUGHIL", camp: "2025/2026" },
  { bon_no: "1691", invoice_no: "154", sortie_date: "2026-02-03", farmer_name: "AGRO ALIMENTAIRES ACTIVITE 3A ARAR ABDELLAH", carte_fellah: "", designation: "KSC SULFACID", qty: 20, driver_name: "ABHRI MOHAMMED", truck_no: "1128-517-16", zone: "FENOUGHIL", camp: "2025/2026" }
];

const BONS_STORE_KEY = "ccls_bons_2025_2026";

function readLocalBons() {
  try {
    const raw = localStorage.getItem(BONS_STORE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (_) {}
  const seeded = INITIAL_BONS.map((r, i) => ({ id: i + 1, ...r }));
  writeLocalBons(seeded);
  return seeded;
}

function writeLocalBons(rows) {
  try {
    localStorage.setItem(BONS_STORE_KEY, JSON.stringify(rows));
  } catch (_) {}
}
