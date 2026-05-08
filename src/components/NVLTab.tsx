import { useState } from "react";
import { Package, Download, Upload, Search, Edit3, Trash2, Check, X, AlertTriangle, DollarSign } from "lucide-react";
import * as XLSX from "xlsx";
import { NVL, Recipe } from "../types";
import { uid, fmtVND, fmtNum, similarity } from "../lib/utils";

const DON_VI_LIST = ["kg", "g", "lít", "ml", "quả", "cái", "túi"];

interface PreviewItem extends NVL {
  matchId?: string;
  isUsedInRecipe: boolean;
  status: "new" | "update" | "unchanged";
}

interface Props {
  allNvl: NVL[];
  onSaveNvl: (item: NVL) => Promise<void>;
  onDeleteNvl: (id: string) => Promise<void>;
  onBulkSaveNvl: (data: NVL[]) => Promise<void>;
  recipes: Recipe[];
  currentXuong: string;
  hasAdminPrivileges: boolean;
}

export default function NVLTab({ allNvl, onSaveNvl, onDeleteNvl, onBulkSaveNvl, recipes, currentXuong, hasAdminPrivileges }: Props) {
  const [form, setForm] = useState<Partial<NVL>>({ ten: "", donVi: "kg", gia: 0, soLuong: 0, thanhTien: 0 });
  const [editId, setEditId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [pendingUpload, setPendingUpload] = useState<PreviewItem[] | null>(null);

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const nvl = allNvl.filter(n => n.xuong === currentXuong).map(n => {
    const isUsed = recipes.some(r => r.nvl.some(rn => rn.nvlId === n.id));
    return { ...n, loai: isUsed ? "chính" : "phụ" } as NVL;
  });

  const handleEdit = (item: NVL) => {
    setEditId(item.id);
    setForm({ 
      ten: item.ten, 
      donVi: item.donVi, 
      gia: item.gia, 
      soLuong: item.soLuong || 0, 
      thanhTien: item.thanhTien || 0 
    });
  };

  const handleSave = () => {
    if (!form.ten) return;

    if (editId) {
      const existing = allNvl.find(n => n.id === editId);
      if (existing) {
        onSaveNvl({ ...existing, ten: form.ten!, donVi: form.donVi! });
      }
      setEditId(null);
    } else {
      onSaveNvl({ id: uid(), ten: form.ten!, donVi: form.donVi!, gia: 0, xuong: currentXuong });
    }
    setForm({ ten: "", donVi: "kg" });
  };

  const findBestMatch = (name: string) => {
    let best = null;
    let maxSim = 0;
    // Only match against NVL in the current factory to prevent cross-factory contamination
    for (const item of nvl) {
      const sim = similarity(item.ten, name);
      if (sim > maxSim) {
        maxSim = sim;
        best = item;
      }
    }
    return maxSim > 0.65 ? best : null;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData: any[] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });
      
      const preview: PreviewItem[] = [];
      
      jsonData.forEach((row, index) => {
        if (index === 0) return; // Skip header
        if (!row || row.length === 0) return;

        const ten = String(row[0] || "").trim();
        const donVi = String(row[1] || "").trim();
        const tt = parseFloat(String(row[2] || "0")) || 0;
        
        if (ten && donVi) {
          const match = findBestMatch(ten);
          const isUsed = recipes.some(r => r.nvl.some(rn => rn.nvlId === (match?.id || "")));
          
          preview.push({
            id: uid(),
            ten,
            donVi,
            gia: tt,
            soLuong: 1,
            thanhTien: tt,
            xuong: currentXuong,
            matchId: match?.id,
            isUsedInRecipe: isUsed || recipes.some(r => r.nvl.some(rn => {
              const nDetail = nvl.find(n => n.id === rn.nvlId);
              return nDetail && similarity(nDetail.ten, ten) > 0.65;
            })),
            status: match ? (match.thanhTien === tt ? "unchanged" : "update") : "new"
          });
        }
      });

      if (preview.length > 0) {
        setPendingUpload(preview);
      }
      e.target.value = ""; // Reset input
    };
    reader.readAsArrayBuffer(file);
  };

  const confirmUpload = () => {
    if (!pendingUpload) return;
    
    let currentNvl = [...allNvl];
    pendingUpload.forEach(item => {
      if (item.matchId) {
        // Update existing
        currentNvl = currentNvl.map(n => n.id === item.matchId ? { 
          ...n, 
          gia: item.gia, 
          donVi: item.donVi,
          ten: item.ten,
          soLuong: item.soLuong,
          thanhTien: item.thanhTien,
          xuong: currentXuong // Ensure factory is set
        } : n);
      } else {
        // Add new
        currentNvl.push({
          id: item.id,
          ten: item.ten,
          donVi: item.donVi,
          gia: item.gia,
          soLuong: item.soLuong,
          thanhTien: item.thanhTien,
          xuong: currentXuong
        });
      }
    });
    
    onBulkSaveNvl(currentNvl);
    setPendingUpload(null);
  };

  const downloadTemplate = () => {
    const data = [
      ["Tên Nguyên Vật Liệu", "Đơn Vị"],
      ["Bột mì số 11", "kg"],
      ["Trứng gà", "quả"],
      ["Bơ lạt", "kg"]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_NVL");
    XLSX.writeFile(wb, "Template_NVL.xlsx");
  };

  const clearAllData = () => {
    const target = currentXuong.trim().toLowerCase();
    if (window.confirm(`Bạn có chắc chắn muốn xoá TOÀN BỘ dữ liệu NVL của xưởng ${currentXuong}?`)) {
      onBulkSaveNvl(allNvl.filter(n => (n.xuong || "").trim().toLowerCase() !== target));
    }
  };

  const filtered = nvl.filter(n => n.ten.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="space-y-8 md:space-y-12 pb-24 md:pb-0">
      {/* Review Modal */}
      {pendingUpload && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-2 md:p-6 animate-in fade-in duration-300">
          <div className="bg-dark-surface border border-white/10 w-full max-w-5xl max-h-[92vh] md:max-h-[85vh] flex flex-col shadow-2xl rounded-sm">
            <div className="p-5 md:p-8 border-b border-white/5 flex justify-between items-center">
              <div>
                <h3 className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-bold italic">Preview dữ liệu</h3>
                <p className="text-[9px] text-gray-500 mt-1 md:mt-2">Kiểm tra phân loại và khớp nối dữ liệu.</p>
              </div>
              <button 
                onClick={() => setPendingUpload(null)}
                className="p-2 text-gray-500 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
              <div className="space-y-4 md:space-y-0">
                {/* Desktop Table View */}
                <table className="hidden md:table w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-white/5 text-gray-600 uppercase tracking-widest font-bold">
                      <th className="py-4 text-left">NVL từ File</th>
                      <th className="py-4 text-left">Đơn giá</th>
                      <th className="py-4 text-left">Hệ thống gợi ý</th>
                      <th className="py-4 text-center">Sử dụng</th>
                      <th className="py-4 text-right">Trạng thái</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {pendingUpload.map((item, idx) => (
                       <RenderPreviewRow key={idx} item={item} idx={idx} nvl={nvl} recipes={recipes} pendingUpload={pendingUpload} setPendingUpload={setPendingUpload} isMobile={false} />
                    ))}
                  </tbody>
                </table>

                {/* Mobile Card View */}
                <div className="md:hidden space-y-4">
                   {pendingUpload.map((item, idx) => (
                       <RenderPreviewRow key={idx} item={item} idx={idx} nvl={nvl} recipes={recipes} pendingUpload={pendingUpload} setPendingUpload={setPendingUpload} isMobile={true} />
                    ))}
                </div>
              </div>
            </div>

            <div className="p-5 md:p-8 border-t border-white/5 bg-black/20 flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0">
              <div className="flex gap-4 w-full md:w-auto">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-400"></div>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">{pendingUpload.filter(i => i.status === 'new').length} Mới</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-400"></div>
                  <span className="text-[9px] text-gray-500 uppercase tracking-widest">{pendingUpload.filter(i => i.status === 'update').length} Cập nhật</span>
                </div>
              </div>
              <div className="flex gap-3 w-full md:w-auto mt-2 md:mt-0">
                <button 
                  onClick={() => setPendingUpload(null)}
                  className="flex-1 md:flex-none px-6 py-3.5 border border-white/10 text-white text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] rounded-sm"
                >
                  Huỷ bỏ
                </button>
                <button 
                  onClick={confirmUpload}
                  className="flex-[2] md:flex-none px-6 md:px-10 py-3.5 bg-gold text-black text-[9px] md:text-[10px] font-bold uppercase tracking-[0.2em] shadow-xl md:flex items-center gap-2 rounded-sm"
                >
                  Ghi nhận {pendingUpload.length} mục
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
        <div className="space-y-3 md:space-y-4">
          <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-semibold italic">Quản lý kho</div>
          <h2 className="text-3xl md:text-5xl font-serif text-white leading-tight">Danh mục NVL</h2>
          <p className="text-xs md:text-sm text-gray-400 max-w-sm leading-relaxed font-light">
            Quản lý nguyên vật liệu cơ bản theo từng xưởng.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 w-full md:w-auto">
          {hasAdminPrivileges && (
            <button 
              onClick={clearAllData}
              className="flex-1 md:flex-none px-4 md:px-6 py-2.5 border border-rose-900/30 text-rose-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-rose-900 hover:text-white transition-all flex items-center justify-center gap-2 rounded-sm"
            >
              <Trash2 className="w-3 h-3" /> Xoá hết
            </button>
          )}
          <button 
            onClick={downloadTemplate}
            className="flex-1 md:flex-none px-4 md:px-6 py-2.5 border border-white/10 text-gray-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold hover:text-white transition-all flex items-center justify-center gap-2 rounded-sm"
          >
            <Download className="w-3 h-3" /> Mẫu
          </button>
          <label className="flex-1 md:flex-none px-4 md:px-6 py-2.5 border border-gold/30 text-gold text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold cursor-pointer hover:bg-gold hover:text-black transition-all flex items-center justify-center gap-2 rounded-sm">
            <Upload className="w-3 h-3" /> Import
            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        <div className="lg:col-span-4 lg:order-1 order-2">
          <div className="bg-dark-surface border border-white/5 p-6 md:p-10 space-y-6 md:space-y-7 sticky top-32 rounded-sm">
            <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-gold font-bold italic">{editId ? "Cập nhật NVL" : "Thêm mới NVL"}</div>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-light ml-1">Tên nguyên liệu</label>
                <input 
                  type="text" 
                  value={form.ten}
                  onChange={e => setForm({...form, ten: e.target.value})}
                  className="w-full bg-black border border-white/10 p-3.5 md:p-4 text-sm text-white focus:border-gold outline-none font-serif italic"
                  placeholder="VD: Bơ lạt Elle & Vire"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-light ml-1">Đơn vị</label>
                <select 
                  value={form.donVi}
                  onChange={e => setForm({...form, donVi: e.target.value})}
                  className="w-full bg-black border border-white/10 p-3.5 md:p-4 text-sm text-white focus:border-gold outline-none cursor-pointer"
                >
                  {DON_VI_LIST.map(dv => <option key={dv} value={dv}>{dv}</option>)}
                </select>
              </div>
              <div className="flex gap-4 pt-2">
                {editId && (
                  <button onClick={() => { setEditId(null); setForm({ ten: "", donVi: "kg" }); }} className="flex-1 py-4 border border-white/5 text-gray-500 text-[10px] font-bold uppercase tracking-widest hover:text-white">Huỷ</button>
                )}
                <button 
                  onClick={handleSave}
                  className="flex-[2] py-4 md:py-5 bg-gold text-black text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all shadow-xl rounded-sm"
                >
                  {editId ? "Lưu thay đổi" : "Thêm vào danh mục"}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-8 lg:order-2 order-1 space-y-6 md:space-y-8">
          <div className="relative group border-b border-white/10 pb-1">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600" />
            <input 
              type="text" 
              placeholder="Tìm theo tên nguyên liệu..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent pl-8 py-3 text-sm text-white focus:outline-none placeholder:text-gray-700 tracking-[0.2em] font-serif italic text-xs md:text-sm"
            />
          </div>

          <div className="bg-transparent overflow-hidden">
            <div className="hidden md:block">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5">
                    <th className="py-6 text-[9px] md:text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em]">Nguyên liệu</th>
                    <th className="py-6 text-[9px] md:text-[10px] font-bold text-gray-600 uppercase tracking-[0.2em] px-10">Đơn vị</th>
                    <th className="py-6"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map(item => (
                    <tr key={item.id} className="group hover:bg-white/[0.01] transition-colors">
                      <td className="py-6 md:py-8 min-w-[200px]">
                        <div className="flex flex-col">
                          <span className="font-serif text-base md:text-lg text-white italic">{item.ten}</span>
                          <span className={`mt-1.5 text-[8px] px-2 py-0.5 rounded-full w-fit font-bold uppercase tracking-widest ${
                            item.loai === 'phụ' 
                              ? 'bg-amber-900/30 text-amber-500 border border-amber-800/20' 
                              : 'bg-gold/10 text-gold border border-gold/20'
                          }`}>
                            {item.loai || 'chính'}
                          </span>
                        </div>
                      </td>
                      <td className="py-6 md:py-8 font-serif text-base md:text-lg text-white/70 px-10 italic">
                        {item.donVi}
                      </td>
                      <td className="py-6 md:py-8 text-right">
                        <div className="flex justify-end gap-6 opacity-0 group-hover:opacity-100 transition-all pr-4 md:pr-12">
                          <button onClick={() => handleEdit(item)} className="text-gray-600 hover:text-gold transition-colors text-[9px] md:text-[10px] uppercase tracking-widest font-bold">Sửa</button>
                          {hasAdminPrivileges && (
                            <button onClick={() => onDeleteNvl(item.id)} className="text-gray-600 hover:text-rose-400 transition-colors text-[9px] md:text-[10px] uppercase tracking-widest font-bold">Xoá</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile List View */}
            <div className="md:hidden space-y-3">
               {filtered.map(item => (
                <div key={item.id} className="bg-dark-surface border border-white/5 p-4 rounded-sm flex justify-between items-center group active:bg-white/[0.03]">
                  <div className="flex flex-col gap-1">
                    <span className="font-serif text-base text-white italic leading-none">{item.ten}</span>
                     <div className="flex items-center gap-3">
                        <span className="text-[8px] text-gray-500 uppercase tracking-widest">Đơn vị: {item.donVi}</span>
                        <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-widest ${
                          item.loai === 'phụ' 
                            ? 'text-amber-500' 
                            : 'text-gold'
                        }`}>
                          {item.loai || 'chính'}
                        </span>
                     </div>
                  </div>
                  <div className="flex gap-4">
                    <button onClick={() => handleEdit(item)} className="text-[9px] uppercase tracking-widest font-bold text-gray-600 hover:text-gold p-1">Sửa</button>
                    {hasAdminPrivileges && (
                      <button onClick={() => onDeleteNvl(item.id)} className="text-[9px] uppercase tracking-widest font-bold text-gray-600 hover:text-rose-500 p-1">Xoá</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {filtered.length === 0 && <div className="py-16 md:py-20 text-center text-gray-700 font-serif italic text-xs md:text-sm">Chưa có dữ liệu nào.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenderPreviewRow({ item, idx, nvl, recipes, pendingUpload, setPendingUpload, isMobile }: any) {
  const currentMatch = nvl.find((n: any) => n.id === item.matchId);
  const statusLabel = item.status === "update" ? "Cập nhật" : (item.status === "unchanged" ? "Không đổi" : "Mới");
  const statusColor = item.status === "update" ? "text-blue-400" : (item.status === "unchanged" ? "text-gray-600" : "text-emerald-400");

  if (isMobile) {
    return (
      <div className="bg-black/40 border border-white/5 p-4 rounded-sm space-y-4">
         <div className="flex justify-between items-start border-b border-white/5 pb-3">
            <div className="font-serif italic text-white text-base leading-tight pr-4">{item.ten}</div>
            <span className={`text-[8px] font-bold uppercase tracking-widest ${statusColor}`}>{statusLabel}</span>
         </div>
         <div className="grid grid-cols-2 gap-4">
            <div>
               <div className="text-[8px] text-gray-600 uppercase font-bold tracking-widest mb-1">Giá / Đơn vị</div>
               <div className="text-xs text-gold font-serif">{fmtVND(item.gia)} / {item.donVi}</div>
            </div>
            <div>
               <div className="text-[8px] text-gray-600 uppercase font-bold tracking-widest mb-1">Sử dụng</div>
               {item.isUsedInRecipe ? (
                  <span className="text-gold font-bold text-[8px] uppercase tracking-tighter">Đang có Recipe</span>
               ) : (
                  <span className="text-gray-600 font-medium text-[8px] uppercase tracking-tighter italic">Chưa map</span>
               )}
            </div>
         </div>
         <div className="space-y-1">
            <label className="text-[8px] text-gray-600 uppercase font-bold tracking-widest flex items-center justify-between">
               Map tới hệ thống
               {item.matchId && <span className="text-emerald-500 text-[7px]">Đã khớp</span>}
            </label>
            <select 
              value={item.matchId || "new"}
              onChange={(e) => {
                const val = e.target.value;
                const newPending = [...pendingUpload];
                newPending[idx].matchId = val === "new" ? undefined : val;
                const currentMatch = nvl.find((n: any) => n.id === newPending[idx].matchId);
                newPending[idx].status = currentMatch 
                  ? (currentMatch.gia === item.gia && currentMatch.donVi === item.donVi ? "unchanged" : "update")
                  : "new";
                newPending[idx].isUsedInRecipe = recipes.some((r: any) => r.nvl.some((rn: any) => rn.nvlId === (newPending[idx].matchId || "")));
                setPendingUpload(newPending);
              }}
              className="w-full bg-black border border-white/10 text-[10px] p-2.5 text-white outline-none rounded-sm"
            >
              <option value="new">+ Thêm mới hoàn toàn</option>
              {nvl.map((n: any) => (
                <option key={n.id} value={n.id}>{n.ten} ({n.donVi})</option>
              ))}
            </select>
         </div>
      </div>
    );
  }

  return (
    <tr className="group hover:bg-white/[0.02]">
      <td className="py-5 font-serif italic text-white text-base">{item.ten}</td>
      <td className="py-5 text-gold font-serif text-lg">{fmtVND(item.gia)} / {item.donVi}</td>
      <td className="py-5">
        <select 
          value={item.matchId || "new"}
          onChange={(e) => {
            const val = e.target.value;
            const newPending = [...pendingUpload];
            newPending[idx].matchId = val === "new" ? undefined : val;
            const currentMatch = nvl.find((n: any) => n.id === newPending[idx].matchId);
            newPending[idx].status = currentMatch 
              ? (currentMatch.gia === item.gia && currentMatch.donVi === item.donVi ? "unchanged" : "update")
              : "new";
            newPending[idx].isUsedInRecipe = recipes.some((r: any) => r.nvl.some((rn: any) => rn.nvlId === (newPending[idx].matchId || "")));
            setPendingUpload(newPending);
          }}
          className="bg-black border border-white/10 text-[10px] p-2 text-white outline-none focus:border-gold rounded-sm"
        >
          <option value="new">+ Thêm mới hoàn toàn</option>
          <optgroup label="Khớp nối với danh mục hiện có">
            {nvl.map((n: any) => (
              <option key={n.id} value={n.id}>{n.ten} ({n.donVi})</option>
            ))}
          </optgroup>
        </select>
      </td>
      <td className="py-5 text-center">
        {item.isUsedInRecipe ? (
          <span className="px-2 py-1 bg-gold/10 text-gold rounded-sm border border-gold/20 font-bold text-[9px] uppercase tracking-tighter">Đang sử dụng</span>
        ) : (
          <span className="px-2 py-1 bg-gray-800 text-gray-500 rounded-sm border border-white/5 font-bold text-[9px] uppercase tracking-tighter italic">Chưa có Recipe</span>
        )}
      </td>
      <td className="py-5 text-right">
        {statusLabel !== "Không đổi" ? <span className={`${statusColor} italic`}>{statusLabel}</span> : <span className="text-gray-600 italic">Không đổi</span>}
      </td>
    </tr>
  );
}
