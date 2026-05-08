import { useState, useEffect, useCallback, useMemo } from "react";
import { 
  ChevronRight, 
  LayoutDashboard, 
  Package, 
  BookOpen, 
  FileOutput, 
  DollarSign, 
  FileSearch,
  ArrowLeftRight,
  Sparkles,
  Calendar,
  Warehouse,
  Trash2,
  LogIn,
  LogOut,
  UploadCloud,
  User as UserIcon
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { saveToStorage, loadFromStorage, STORAGE_KEYS } from "./lib/storage";
import { ProductionLog, Recipe, NVL, Overhead, MaterialUsage, MaterialConversion } from "./types";
import { today } from "./lib/utils";
import { useFirebase } from "./components/FirebaseProvider";

// Tab Components
import DashboardTab from "./components/DashboardTab";
import NVLTab from "./components/NVLTab";
import NVLUsageTab from "./components/NVLUsageTab";
import RecipeTab from "./components/RecipeTab";
import XuatTab from "./components/XuatTab";
import ConversionTab from "./components/ConversionTab";
import GiaThanhTab from "./components/GiaThanhTab";
import ReportTab from "./components/ReportTab";

const INIT_NVL: NVL[] = [
  { id: "n1", ten: "Bột mì", donVi: "kg", gia: 15000, xuong: "Four Season" },
  { id: "n2", ten: "Đường trắng", donVi: "kg", gia: 22000, xuong: "Four Season" },
  { id: "n3", ten: "Trứng gà", donVi: "quả", gia: 3500, xuong: "Four Season" },
  { id: "n4", ten: "Bơ lạt", donVi: "kg", gia: 85000, xuong: "Four Season" },
];

const WORKSHOPS = [
  "Four Season",
  "Artisan",
  "Bachus"
];

export default function App() {
  const { 
    user, loading: authLoading, isAdmin, isGuest, workshop, setWorkshop, login, loginGuest, logout,
    nvl: cloudNvl, recipes: cloudRecipes, logs: cloudLogs, overheads: cloudOverheads, materialUsage: cloudUsage,
    loginLogs, materialConversions: cloudConversions,
    saveEntity, saveBatch, deleteEntity,
    syncNVL, syncRecipes, syncLogs, syncOverheads, syncMaterialUsage, syncConversions
  } = useFirebase();

  const [isGodMode, setIsGodMode] = useState(false);
  const hasAdminPrivileges = isAdmin || isGodMode || workshop === "ADMIN";

  const [activeTab, setActiveTab] = useState("dash");
  const [nvl, setNvl] = useState<NVL[]>([]);
  const [materialUsage, setMaterialUsage] = useState<MaterialUsage[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [logs, setLogs] = useState<ProductionLog[]>([]);
  const [overheads, setOverheads] = useState<Overhead[]>([]);
  const [materialConversions, setMaterialConversions] = useState<MaterialConversion[]>([]);
  const [selectedDate, setSelectedDate] = useState(today());
  const [selectedXuong, setSelectedXuong] = useState(WORKSHOPS[0]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Filtering data for specific views (Memoized for performance)
  const filteredNvl = useMemo(() => 
    nvl.filter(n => selectedXuong === "ADMIN" ? true : n.xuong === selectedXuong),
    [nvl, selectedXuong]
  );

  const filteredRecipes = useMemo(() => 
    recipes.filter(r => selectedXuong === "ADMIN" ? true : r.xuong === selectedXuong),
    [recipes, selectedXuong]
  );

  const filteredLogs = useMemo(() => 
    logs.filter(l => l.ngay === selectedDate && (selectedXuong === "ADMIN" ? true : l.xuong === selectedXuong)),
    [logs, selectedDate, selectedXuong]
  );

  // Workshop login states
  const [inputXuong, setInputXuong] = useState("");
  const [inputPass, setInputPass] = useState("");
  const [loginError, setLoginError] = useState("");

  // Clear states on logout
  useEffect(() => {
    if (!user) {
      setIsGodMode(false);
      setWorkshop(null);
    } else if (isAdmin && !workshop) {
      // Auto entry for Admin email
      setIsGodMode(true);
      setWorkshop("ADMIN");
    }
  }, [user, isAdmin, workshop, setWorkshop]);

  // Sync workshop state
  useEffect(() => {
    if (workshop) {
      if (workshop === "ADMIN") {
        setIsGodMode(true);
      }
      setSelectedXuong(workshop);
    }
  }, [workshop]); 

  useEffect(() => {
    if (hasAdminPrivileges && selectedXuong && selectedXuong !== workshop) {
      setWorkshop(selectedXuong);
    }
  }, [selectedXuong, hasAdminPrivileges, setWorkshop, workshop]);

  // Master sync
  useEffect(() => {
    if (cloudNvl.length > 0) setNvl(cloudNvl);
    else {
      const stored = loadFromStorage(STORAGE_KEYS.NVL, INIT_NVL);
      if (stored) setNvl(stored);
    }
  }, [cloudNvl]);

  useEffect(() => { setRecipes(cloudRecipes); }, [cloudRecipes]);
  useEffect(() => { setLogs(cloudLogs); }, [cloudLogs]);
  useEffect(() => { setOverheads(cloudOverheads); }, [cloudOverheads]);
  useEffect(() => { setMaterialUsage(cloudUsage); }, [cloudUsage]);
  useEffect(() => { setMaterialConversions(cloudConversions); }, [cloudConversions]);

  const addOrUpdateNvl = async (item: NVL) => {
    setNvl(prev => {
      const idx = prev.findIndex(n => n.id === item.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
    await saveEntity('nvl', item.id, item);
  };

  const removeNvl = async (id: string) => {
    setNvl(prev => prev.filter(n => n.id !== id));
    await deleteEntity('nvl', id);
  };

  const bulkUpdateNvl = async (data: NVL[]) => {
    const unique = data.filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
    setNvl(unique);
    await saveBatch('nvl', unique);
  };

  const addOrUpdateConversion = async (item: MaterialConversion) => {
    setMaterialConversions(prev => {
      const idx = prev.findIndex(c => c.id === item.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
    await saveEntity('materialConversions', item.id, item);
  };

  const removeConversion = async (id: string) => {
    setMaterialConversions(prev => prev.filter(c => c.id !== id));
    await deleteEntity('materialConversions', id);
  };

  const bulkUpdateConversions = async (data: MaterialConversion[]) => {
    setMaterialConversions(data);
    await saveBatch('materialConversions', data);
  };

  const addOrUpdateRecipe = async (recipe: Recipe) => {
    // 1. Update UI state immediately
    setRecipes(prev => {
      const idx = prev.findIndex(r => r.id === recipe.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = recipe;
        return next;
      }
      return [...prev, recipe];
    });
    
    // 2. Save only this entity to cloud
    await saveEntity('recipes', recipe.id, recipe);
  };

  const removeRecipe = async (id: string) => {
    // 1. Update UI state immediately
    setRecipes(prev => prev.filter(r => r.id !== id));
    
    // 2. Delete from cloud
    await deleteEntity('recipes', id);
  };

  const bulkUpdateRecipes = async (data: Recipe[]) => {
    setRecipes(data);
    await saveBatch('recipes', data);
  };

  const addOrUpdateUsage = async (item: MaterialUsage) => {
    setMaterialUsage(prev => {
      const idx = prev.findIndex(u => u.id === item.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
    await saveEntity('materialUsage', item.id, item);
  };

  const removeUsage = async (id: string) => {
    setMaterialUsage(prev => prev.filter(u => u.id !== id));
    await deleteEntity('materialUsage', id);
  };

  const bulkUpdateUsage = async (data: MaterialUsage[]) => {
    setMaterialUsage(data);
    await saveBatch('materialUsage', data);
  };

  const saveNewLogs = async (newLogs: ProductionLog[]) => {
    setLogs(prev => [...prev, ...newLogs]);
    await saveBatch('productionLogs', newLogs);
  };

  const addOrUpdateOverhead = async (item: Overhead) => {
    setOverheads(prev => {
      const idx = prev.findIndex(o => o.id === item.id);
      if (idx > -1) {
        const next = [...prev];
        next[idx] = item;
        return next;
      }
      return [...prev, item];
    });
    await saveEntity('overheads', item.id, item);
  };

  if (authLoading) return (
    <div className="min-h-screen bg-[#080808] flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="animate-spin text-gold"><Sparkles className="w-8 h-8" /></div>
        <div className="text-gold text-[10px] font-bold uppercase tracking-[0.3em]">Đang khởi động...</div>
      </div>
    </div>
  );

  if (!user || (!workshop && !isAdmin)) {
    const handleJoin = async () => {
      const targetWorkshop = inputXuong.trim().toLowerCase();
      
      // Admin bypass via keyword
      if (targetWorkshop === "admin") {
        if (inputPass === "123456") {
          setIsGodMode(true);
          await loginGuest();
          setWorkshop("ADMIN");
          setLoginError("");
        } else {
          setLoginError("Mật khẩu Admin không chính xác.");
        }
        return;
      }

      // Workshop match
      const match = WORKSHOPS.find(w => w.toLowerCase() === targetWorkshop);
      if (!match) {
        setLoginError("Tên xưởng hoặc thông tin Admin không đúng.");
        return;
      }

      if (inputPass === "123456") {
        await loginGuest(); // Automatic anonymous login for guests
        setWorkshop(match);
        setLoginError("");
        setInputPass("");
        setInputXuong("");
      } else {
        setLoginError("Mật khẩu truy cập không chính xác.");
      }
    };

    return (
      <div className="min-h-screen bg-[#080808] flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-[#0c0c0c] border border-gold/10 p-10 rounded shadow-2xl text-center relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-1 bg-gold"></div>
          <div className="mb-8">
            <div className="w-16 h-16 bg-gold/10 flex items-center justify-center rounded-full border border-gold/20 mx-auto mb-4">
              <Sparkles className="text-gold w-8 h-8" />
            </div>
            <h1 className="text-2xl font-serif font-bold text-gold tracking-widest uppercase">Bakery OS</h1>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] mt-2">Hệ thống quản trị sản xuất</p>
          </div>

          <div className="space-y-4 mb-8">
            <div>
              <label className="block text-left text-[10px] text-gold font-bold uppercase tracking-widest mb-1.5 ml-1">Đơn vị / Quyền hạn</label>
              <input 
                type="text"
                autoFocus
                value={inputXuong}
                onChange={(e) => { setInputXuong(e.target.value); setLoginError(""); }}
                placeholder="Tên xưởng hoặc ADMIN"
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white text-sm outline-none focus:border-gold/50 transition-all rounded"
              />
            </div>
            <div>
              <label className="block text-left text-[10px] text-gold font-bold uppercase tracking-widest mb-1.5 ml-1">Mật khẩu</label>
              <input 
                type="password"
                value={inputPass}
                onChange={(e) => { setInputPass(e.target.value); setLoginError(""); }}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="••••••"
                className="w-full bg-white/5 border border-white/10 px-4 py-3 text-white text-sm outline-none focus:border-gold/50 transition-all rounded"
              />
            </div>
            
            {loginError && <p className="text-rose-500 text-[10px] font-medium uppercase tracking-wider text-left">{loginError}</p>}
            
            <button
              onClick={handleJoin}
              className="w-full bg-gold text-black text-[11px] font-bold uppercase tracking-widest py-4 rounded hover:bg-white transition-all shadow-lg active:scale-[0.98]"
            >
              Vào hệ thống
            </button>
          </div>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[8px] uppercase tracking-widest"><span className="bg-[#0c0c0c] px-2 text-white/20">Hoặc đăng nhập Admin</span></div>
          </div>

          <button
            onClick={login}
            className="w-full bg-white/5 border border-white/10 text-white flex items-center justify-center gap-3 py-3 rounded font-bold text-[10px] uppercase tracking-widest hover:bg-white/10 transition-all"
          >
            <LogIn className="w-3.5 h-3.5" /> Google Admin Login
          </button>
        </motion.div>
      </div>
    );
  }

  const tabs = [
    { id: "dash", label: "Dashboard", shortLabel: "Home", icon: LayoutDashboard },
    { id: "recipe", label: "Công thức", shortLabel: "Recipe", icon: BookOpen },
    { id: "xuat", label: "Sản xuất", shortLabel: "SX", icon: FileOutput },
    { id: "giathanh", label: "Giá thành", shortLabel: "Giá", icon: DollarSign },
    { id: "nvl", label: "Kho NVL", shortLabel: "Kho", icon: Package },
    { id: "report", label: "Báo cáo", shortLabel: "Report", icon: FileSearch },
  ];

  const adminOnlyTabs = [
    { id: "conversion", label: "Quy đổi", shortLabel: "Đổi", icon: ArrowLeftRight },
    { id: "nvl_usage", label: "NVL tính giá", shortLabel: "Sử dụng", icon: DollarSign },
  ];

  const allTabs = hasAdminPrivileges ? [...tabs, ...adminOnlyTabs] : tabs;
  
  return (
    <div className="min-h-screen bg-[#080808] text-[#E5E5E5] font-sans selection:bg-gold/30 pb-16 md:pb-0">
      {/* Header */}
      <nav className="flex flex-col md:flex-row justify-between items-center px-4 md:px-12 py-3 md:py-6 border-b border-white/5 bg-dark-bg sticky top-0 z-40 gap-3 md:gap-0 backdrop-blur-lg bg-opacity-90">
        <div className="flex w-full md:w-auto justify-between items-center">
          <div className="text-xl md:text-2xl font-serif tracking-[0.2em] text-gold uppercase font-bold">Bakery OS</div>
          
          <div className="flex md:hidden items-center gap-2">
             <div className="flex items-center gap-1.5 bg-white/5 border border-white/10 px-2 py-1 relative">
                <Calendar className="w-3 h-3 text-gold" />
                <input 
                  type="date" 
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="bg-transparent text-[10px] text-white outline-none font-serif [color-scheme:dark] uppercase tracking-tighter"
                />
              </div>
          </div>
        </div>

        <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto">
          <div className="hidden md:flex items-center gap-3 bg-white/5 border border-white/10 px-4 py-2 rounded">
            <Calendar className="w-3.5 h-3.5 text-gold" />
            <input 
              type="date" 
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-[11px] text-white outline-none tracking-widest font-serif [color-scheme:dark]"
            />
          </div>
          
          <div className="flex-1 md:flex-none flex items-center gap-2 bg-white/5 border border-white/10 px-3 py-2 group relative">
            <Warehouse className="w-3.5 h-3.5 text-gold" />
            <select 
              value={selectedXuong}
              onChange={(e) => setSelectedXuong(e.target.value)}
              className="bg-transparent text-[10px] md:text-[11px] text-white outline-none uppercase tracking-[0.15em] font-serif cursor-pointer flex-1 appearance-none pr-4"
              disabled={isGuest && !hasAdminPrivileges}
            >
              {hasAdminPrivileges && <option value="ADMIN" className="bg-[#080808]">Tất cả xưởng</option>}
              {WORKSHOPS.map(w => (
                <option key={w} value={w} className="bg-[#080808]">{w}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 pl-2">
            <div className="flex flex-col items-end mr-1">
              <span className="text-[10px] text-white font-medium max-w-[50px] md:max-w-none truncate">{user?.displayName || workshop || 'Bakery'}</span>
              <button onClick={logout} className="text-[8px] text-rose-500 font-bold uppercase tracking-widest">Thoát</button>
            </div>
            <div className="w-7 h-7 md:w-9 md:h-9 border border-gold/30 rounded-full flex items-center justify-center p-0.5 bg-gold/5 shrink-0">
               {user?.photoURL ? (
                  <img src={user.photoURL} alt="avatar" className="w-full h-full rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <UserIcon className="w-4 h-4 text-gold/50" />
                )}
            </div>
          </div>
        </div>
      </nav>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="w-64 h-[calc(100vh-80px)] border-r border-white/5 bg-dark-bg sticky top-[80px] p-8 hidden lg:flex flex-col gap-10">
          <div className="space-y-6">
            <div className="text-[10px] uppercase tracking-[0.25em] text-gray-500 font-bold">Menu Chính</div>
            <nav className="flex flex-col gap-5">
              {allTabs.map(item => (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center gap-4 text-[11px] uppercase tracking-[0.2em] font-medium transition-all ${
                    activeTab === item.id ? "text-gold" : "text-gray-500 hover:text-white"
                  }`}
                >
                  <item.icon className={`w-4 h-4 ${activeTab === item.id ? 'text-gold' : 'text-gray-600'}`} />
                  <span>{item.label}</span>
                </button>
              ))}
            </nav>
          </div>
          
          <div className="mt-auto p-5 bg-gold/5 border border-gold/10 rounded">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-3 h-3 text-gold" />
              <span className="text-[9px] font-bold text-gold tracking-widest uppercase text-nowrap text-ellipsis overflow-hidden">AI Assistant</span>
            </div>
            <p className="text-[9px] text-gray-400 leading-relaxed mb-4">Hệ thống đang hoạt động tối ưu.</p>
            <button 
              onClick={() => setActiveTab("report")}
              className="w-full py-2.5 bg-gold text-black text-[10px] font-bold uppercase tracking-widest hover:bg-white transition-all rounded shadow"
            >
              Báo cáo AI
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="flex-1 p-4 md:p-10 lg:p-12 overflow-y-auto min-h-[calc(100vh-80px)]">
          <div className="max-w-6xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
              >
                {activeTab === "dash" && (
                  <DashboardTab logs={filteredLogs} recipes={filteredRecipes} nvl={filteredNvl} selectedDate={selectedDate} selectedXuong={selectedXuong} />
                )}
                {activeTab === "nvl" && (
                  <NVLTab 
                    allNvl={nvl} 
                    onSaveNvl={addOrUpdateNvl} 
                    onDeleteNvl={removeNvl}
                    onBulkSaveNvl={bulkUpdateNvl}
                    recipes={recipes} 
                    currentXuong={selectedXuong} 
                    hasAdminPrivileges={hasAdminPrivileges} 
                  />
                )}
                {activeTab === "nvl_usage" && (
                  <NVLUsageTab 
                    nvl={nvl} 
                    onBulkSaveNvl={bulkUpdateNvl}
                    usage={materialUsage} 
                    onSaveUsage={addOrUpdateUsage}
                    onDeleteUsage={removeUsage}
                    onBulkSaveUsage={bulkUpdateUsage}
                    conversions={materialConversions} 
                    currentXuong={selectedXuong} 
                    hasAdminPrivileges={hasAdminPrivileges} 
                  />
                )}
                {activeTab === "recipe" && (
                  <RecipeTab 
                    allRecipes={recipes} 
                    onSaveRecipe={addOrUpdateRecipe} 
                    onDeleteRecipe={removeRecipe}
                    onBulkSaveRecipes={bulkUpdateRecipes}
                    allNvl={nvl} 
                    onBulkSaveNvl={bulkUpdateNvl}
                    materialConversions={materialConversions} 
                    currentXuong={selectedXuong} 
                    hasAdminPrivileges={hasAdminPrivileges} 
                  />
                )}
                {activeTab === "conversion" && (
                  <ConversionTab 
                    nvl={nvl} 
                    conversions={materialConversions} 
                    onSaveConversion={addOrUpdateConversion} 
                    onDeleteConversion={removeConversion}
                    onBulkSaveConversions={bulkUpdateConversions}
                    currentXuong={selectedXuong} 
                    hasAdminPrivileges={hasAdminPrivileges} 
                  />
                )}
                {activeTab === "xuat" && (
                  <XuatTab 
                    recipes={filteredRecipes} 
                    nvl={filteredNvl} 
                    materialConversions={materialConversions} 
                    logs={logs} 
                    onSaveNewLogs={saveNewLogs} 
                    selectedDate={selectedDate} 
                    selectedXuong={selectedXuong} 
                  />
                )}
                {activeTab === "giathanh" && (
                  <GiaThanhTab 
                    recipes={filteredRecipes} 
                    nvl={filteredNvl} 
                    materialConversions={materialConversions} 
                    usage={materialUsage.filter(u => u.xuong === selectedXuong)} 
                    logs={filteredLogs} 
                    overheads={overheads} 
                    onSaveOverhead={addOrUpdateOverhead} 
                    selectedDate={selectedDate} 
                    selectedXuong={selectedXuong} 
                  />
                )}
                {activeTab === "report" && (
                  <ReportTab logs={filteredLogs} recipes={filteredRecipes} nvl={filteredNvl} overheads={overheads} materialConversions={materialConversions} usage={materialUsage} currentXuong={selectedXuong} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Mobile Bottom Navigation - Scrollable for iPhone with admin tabs */}
      <div className="fixed bottom-0 left-0 right-0 h-16 bg-dark-bg border-t border-white/5 flex items-stretch md:hidden z-50 backdrop-blur-md bg-opacity-95 overflow-x-auto no-scrollbar pb-safe">
        <div className="flex min-w-full px-2">
          {allTabs.map(item => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex-none w-20 flex flex-col items-center justify-center gap-0.5 transition-all relative ${
                activeTab === item.id ? "text-gold" : "text-gray-600"
              }`}
            >
              <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'stroke-[2.5px]' : 'stroke-[1.5px]'}`} />
              <span className="text-[7px] font-black uppercase tracking-tighter">{item.shortLabel || item.label}</span>
              {activeTab === item.id && <motion.div layoutId="activeTab" className="absolute bottom-0 w-8 h-1 bg-gold rounded-t-full shadow-[0_-4px_10px_rgba(197,160,89,0.3)]" />}
            </button>
          ))}
        </div>
      </div>
      
      {/* Desktop Footer */}
      <div className="hidden md:flex px-12 py-4 border-t border-white/5 justify-between items-center text-[9px] uppercase tracking-widest text-gray-600 bg-dark-bg">
        <div>Bakery OS v3.1 • {new Date().getFullYear()}</div>
        <div className="flex gap-6">
          <span className="emerald-500/30">Hệ thống đang trực tuyến</span>
          <span className="opacity-30">Phát triển bởi Aurelius</span>
        </div>
      </div>
    </div>
  );
}
