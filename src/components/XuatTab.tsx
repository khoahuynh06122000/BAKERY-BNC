import { useState, useMemo } from "react";
import { CheckCircle2, ChevronRight, AlertTriangle, Save, Calculator, Upload, Download, Trash2, Calendar } from "lucide-react";
import { Recipe, NVL, ProductionLog, MaterialConversion } from "../types";
import { uid, today, fmtVND, fmtNum, similarity } from "../lib/utils";
import { calculateRecipeCurrentCost } from "../lib/calculations";
import * as XLSX from "xlsx";

interface Props {
  recipes: Recipe[];
  nvl: NVL[];
  materialConversions: MaterialConversion[];
  logs: ProductionLog[];
  onSaveNewLogs: (data: ProductionLog[]) => Promise<void>;
  selectedDate: string;
  selectedXuong: string;
}

interface ProductionEntry {
  tempId: string;
  recipeId: string;
  soLuong: number;
  thucTe: Record<string, string>;
}

export default function XuatTab({ recipes, nvl, materialConversions, logs, onSaveNewLogs, selectedDate, selectedXuong }: Props) {
  const [step, setStep] = useState(1);
  const [productionDate, setProductionDate] = useState(selectedDate);
  const [entries, setEntries] = useState<ProductionEntry[]>([]);
  const [currentRecipeId, setCurrentRecipeId] = useState("");
  const [currentSoLuong, setCurrentSoLuong] = useState(10);
  const [success, setSuccess] = useState(false);

  // Sync with prop if it changes
  useMemo(() => {
    setProductionDate(selectedDate);
  }, [selectedDate]);

  const nvlMap = useMemo(() => new Map(nvl.map(n => [n.id, n])), [nvl]);
  const recipeMap = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes]);

  const handleActualUsageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const newEntries = [...entries];
      const errors: string[] = [];

      // Skip first 3 rows (Date, Xuong, Header names)
      jsonData.slice(3).forEach((row) => {
        const tenBanh = String(row[0] || "").trim().toLowerCase();
        const tenNvl = String(row[1] || "").trim().toLowerCase();
        const ttValue = parseFloat(String(row[2] || "0")) || 0;

        if (tenBanh && tenNvl && ttValue > 0) {
          const entryIdx = newEntries.findIndex(e => {
            const r = recipeMap.get(e.recipeId);
            return r && (r.tenBanh.toLowerCase() === tenBanh || similarity(r.tenBanh.toLowerCase(), tenBanh) > 0.65);
          });

          if (entryIdx > -1) {
            const r = recipeMap.get(newEntries[entryIdx].recipeId)!;
            const nvlItem = r.nvl.find(item => {
              const n = nvlMap.get(item.nvlId);
              return n && (n.ten.toLowerCase() === tenNvl || similarity(n.ten.toLowerCase(), tenNvl) > 0.65);
            });

            if (nvlItem) {
              newEntries[entryIdx].thucTe[nvlItem.nvlId] = ttValue.toString();
            } else {
              errors.push(`Không tìm thấy NVL '${tenNvl}' trong công thức '${tenBanh}'`);
            }
          }
        }
      });

      if (errors.length > 0) {
        alert("Có một số lỗi khi nhập file:\n" + Array.from(new Set(errors)).join("\n"));
      }

      setEntries(newEntries);
      e.target.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const downloadActualUsageTemplate = () => {
    const data = [
      ["NGÀY SẢN XUẤT:", productionDate],
      ["XƯỞNG:", selectedXuong],
      ["Tên bánh", "Tên NVL", "Thực tế"]
    ];
    entries.forEach(entry => {
      const r = recipeMap.get(entry.recipeId);
      if (r) {
        r.nvl.forEach(item => {
          const n = nvlMap.get(item.nvlId);
          data.push([r.tenBanh, n?.ten || "", entry.thucTe[item.nvlId]]);
        });
      }
    });
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ThucTeUsage");
    XLSX.writeFile(wb, `Template_Xac_Nhan_Thuc_Te_${productionDate}_${selectedXuong}.xlsx`);
  };

  const handleAddEntry = () => {
    if (!currentRecipeId) return;
    const recipe = recipes.find(r => r.id === currentRecipeId);
    if (!recipe) return;

    const initialThucTe: Record<string, string> = {};
    recipe.nvl.forEach(item => {
      initialThucTe[item.nvlId] = "0";
    });

    setEntries([...entries, {
      tempId: uid(),
      recipeId: currentRecipeId,
      soLuong: currentSoLuong,
      thucTe: initialThucTe
    }]);
    
    setCurrentRecipeId("");
    setCurrentSoLuong(10);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const jsonData: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      const newEntries: ProductionEntry[] = [];
      const errors: string[] = [];

      // Skip metadata and header (rows 0, 1, 2)
      jsonData.slice(3).forEach((row) => {
        const tenBanh = String(row[0] || "").trim();
        const soLuong = parseInt(String(row[1] || "0")) || 0;

        if (tenBanh && soLuong > 0) {
          const recipe = recipes.find(r => 
            r.tenBanh.toLowerCase() === tenBanh.toLowerCase() || 
            similarity(r.tenBanh, tenBanh) > 0.65
          );

          if (recipe) {
            const initialThucTe: Record<string, string> = {};
            recipe.nvl.forEach(item => {
              initialThucTe[item.nvlId] = "0";
            });

            newEntries.push({
              tempId: uid(),
              recipeId: recipe.id,
              soLuong,
              thucTe: initialThucTe
            });
          } else {
            errors.push(`Không tìm thấy công thức cho: ${tenBanh}`);
          }
        }
      });

      if (errors.length > 0) {
        alert(errors.join("\n"));
      }

      setEntries(prev => [...prev, ...newEntries]);
      e.target.value = "";
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const data = [
      ["NGÀY SẢN XUẤT:", productionDate],
      ["XƯỞNG:", selectedXuong],
      ["Tên bánh", "Số lượng sản xuất"],
      ["Ví dụ: Bánh Mì Sandwich", 20],
      ["Ví dụ: Bánh Croissant", 50]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, `Template_Ghi_Nhan_San_Xuat_${productionDate}_${selectedXuong}.xlsx`);
  };

  const handleRemoveEntry = (id: string) => {
    setEntries(entries.filter(e => e.tempId !== id));
  };

  const handleUpdateThucTe = (entryIdx: number, nvlId: string, val: string) => {
    const newEntries = [...entries];
    newEntries[entryIdx].thucTe[nvlId] = val;
    setEntries(newEntries);
  };

  const handleSaveAll = () => {
    const newLogs: ProductionLog[] = entries.map(entry => {
      const recipe = recipeMap.get(entry.recipeId)!;
      const items = recipe.nvl.map(item => {
        const dm = (item.soLuong / recipe.soLuongChuan) * entry.soLuong;
        const tt = parseFloat(entry.thucTe[item.nvlId] || "0");
        return {
          nvlId: item.nvlId,
          dinhMuc: dm,
          thucTe: tt,
          chenh: tt - dm,
          chenhPct: dm > 0 ? ((tt - dm) / dm * 100) : 0
        };
      });

      // The giaThanh in the log represents the "Theorertical Standard Cost" for this produced quantity
      // based on CURRENT prices and conversions.
      const currentRecipeCost = calculateRecipeCurrentCost(recipe, nvl, materialConversions);
      const giaThanh = (currentRecipeCost / recipe.soLuongChuan) * entry.soLuong;

      return {
        id: uid(),
        ngay: productionDate,
        xuong: selectedXuong,
        recipeId: entry.recipeId,
        soLuongSanXuat: entry.soLuong,
        items,
        giaThanh,
        thoiGian: new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })
      };
    });

    onSaveNewLogs(newLogs);
    setSuccess(true);
  };

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center p-8 md:p-24 bg-dark-surface border border-white/5 rounded-sm text-center animate-in fade-in zoom-in duration-700">
        <CheckCircle2 className="w-12 h-12 md:w-16 md:h-16 text-gold mb-6 md:mb-8" />
        <h3 className="text-2xl md:text-3xl font-serif text-white mb-2 md:mb-4">Ghi nhận hoàn tất</h3>
        <p className="text-gray-500 text-[10px] md:text-sm mb-8 md:mb-12 font-light tracking-widest uppercase italic">
          {entries.length} mẻ sản xuất đã được đồng bộ hóa thành công.
        </p>
        <button 
          onClick={() => { setSuccess(false); setStep(1); setEntries([]); }}
          className="w-full md:w-auto px-12 py-4 md:py-5 bg-gold text-black text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all shadow-xl"
        >
          Tiếp tục ghi nhận
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 md:space-y-12 pb-24 md:pb-20">
      <div className="flex items-center gap-4 md:gap-12 mb-6 md:mb-12 px-4 md:px-0">
        <div className="flex flex-col items-center gap-1 md:gap-2">
          <div className={`w-7 h-7 md:w-10 md:h-10 rounded-full flex items-center justify-center text-[9px] md:text-xs font-bold border ${step === 1 ? 'border-gold text-gold' : 'bg-gold text-black border-gold'}`}>01</div>
          <span className="text-[7px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold whitespace-nowrap">Lập danh sách</span>
        </div>
        <div className={`h-[1px] flex-1 ${step >= 2 ? 'bg-gold' : 'bg-white/10'}`} />
        <div className="flex flex-col items-center gap-1 md:gap-2">
          <div className={`w-7 h-7 md:w-10 md:h-10 rounded-full flex items-center justify-center text-[9px] md:text-xs font-bold border ${step === 2 ? 'border-gold text-gold' : 'border-white/10 text-gray-700'}`}>02</div>
          <span className="text-[7px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold whitespace-nowrap">Xác nhận thực</span>
        </div>
      </div>

      {step === 1 ? (
        <div className="space-y-6 md:space-y-10 animate-in slide-in-from-bottom-4 duration-500">
          <div className="bg-dark-surface border border-white/5 p-6 md:p-12 space-y-6 md:space-y-8 rounded-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-white/5">
              <div className="space-y-2 md:space-y-4">
                 <div className="text-[9px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-semibold italic">Bước 01 • Xưởng: {selectedXuong}</div>
                 <h3 className="text-xl md:text-3xl font-serif text-white leading-tight">Ghi nhận mẻ sản xuất mới</h3>
              </div>
              
              <div className="space-y-2">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Ngày SX / Ra thành phẩm</label>
                <div className="relative group">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <Calendar className="w-4 h-4 text-gold/60 group-focus-within:text-gold transition-colors" />
                  </div>
                  <input 
                    type="date"
                    value={productionDate}
                    onChange={e => setProductionDate(e.target.value)}
                    className="w-full md:w-auto bg-black/40 border border-white/10 pl-10 pr-4 py-2.5 text-xs text-white focus:border-gold outline-none font-mono rounded-sm transition-all appearance-none cursor-pointer"
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6 items-end">
              <div className="md:col-span-6 space-y-2">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Chọn sản phẩm</label>
                <select 
                  value={currentRecipeId}
                  onChange={e => setCurrentRecipeId(e.target.value)}
                  className="w-full bg-black/40 md:bg-black border border-white/10 p-3.5 md:p-4 text-sm text-white focus:border-gold outline-none font-serif italic rounded-sm"
                >
                  <option value="">-- Chọn công thức --</option>
                  {recipes.map(r => <option key={r.id} value={r.id} className="bg-black">{r.tenBanh}</option>)}
                </select>
              </div>
              <div className="md:col-span-3 space-y-2">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Số lượng</label>
                <input 
                  type="number" 
                  value={currentSoLuong}
                  onChange={e => setCurrentSoLuong(parseInt(e.target.value) || 1)}
                  className="w-full bg-black/40 md:bg-black border border-white/10 p-3.5 md:p-4 text-sm text-white font-serif outline-none rounded-sm"
                />
              </div>
              <div className="md:col-span-3">
                <button 
                  onClick={handleAddEntry}
                  disabled={!currentRecipeId}
                  className="w-full bg-white text-black text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] py-4 md:py-[1.125rem] hover:bg-gold transition-all disabled:opacity-20 rounded-sm shadow-xl"
                >
                  Thêm vào list
                </button>
              </div>
            </div>

            <div className="pt-6 md:pt-8 border-t border-white/5 grid grid-cols-2 md:flex md:flex-wrap gap-3 md:gap-4">
              <label className="col-span-2 md:flex-1">
                <div className="w-full cursor-pointer bg-white/5 border border-dashed border-white/10 hover:border-gold/50 hover:bg-white/10 transition-all p-4 md:p-6 text-center group rounded-sm">
                  <div className="flex flex-col items-center gap-2">
                    <Upload className="w-4 h-4 md:w-5 md:h-5 text-gold group-hover:scale-110 transition-transform" />
                    <span className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gray-400 font-bold">Tải file hàng loạt</span>
                  </div>
                  <input type="file" onChange={handleFileUpload} accept=".xlsx, .xls" className="hidden" />
                </div>
              </label>
              <button 
                onClick={downloadTemplate}
                className="px-4 md:px-8 py-3 md:py-6 border border-white/10 text-gray-400 text-[8px] md:text-[9px] uppercase tracking-[0.2em] font-bold hover:text-white transition-all flex items-center justify-center gap-2 md:gap-3 rounded-sm"
              >
                <Download className="w-3 h-3 md:w-4 md:h-4" /> Mẫu
              </button>

              {entries.length > 0 && (
                <button 
                  onClick={() => {
                    if (window.confirm("Bạn có chắc chắn muốn xoá TOÀN BỘ danh sách?")) {
                      setEntries([]);
                    }
                  }}
                  className="px-4 md:px-8 py-3 md:py-6 border border-rose-900/30 text-rose-400 text-[8px] md:text-[9px] uppercase tracking-[0.2em] font-bold hover:bg-rose-900 hover:text-white transition-all flex items-center justify-center gap-2 md:gap-3 rounded-sm"
                >
                  <Trash2 className="w-3 h-3 md:w-4 md:h-4" /> Xoá hết
                </button>
              )}
            </div>
          </div>

          {entries.length > 0 && (
            <div className="bg-dark-surface border border-white/5 overflow-hidden rounded-sm mx-1 md:mx-0">
              <div className="px-6 md:px-10 py-4 md:py-6 border-b border-white/5 bg-black/20 flex justify-between items-center">
                <span className="text-[9px] md:text-[10px] font-bold text-gold uppercase tracking-[0.2em]">Đang chờ ghi nhận ({entries.length})</span>
              </div>
              <div className="overflow-x-auto min-w-0">
                <table className="hidden md:table w-full text-left min-w-[400px]">
                  <thead>
                    <tr className="text-[8px] md:text-[9px] uppercase tracking-widest text-gray-700 border-b border-white/5">
                      <th className="px-10 py-4 font-bold">STT</th>
                      <th className="px-10 py-4 font-bold">Sản phẩm</th>
                      <th className="px-10 py-4 font-bold text-right">Số lượng</th>
                      <th className="px-10 py-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {entries.map((entry, idx) => {
                      const recipe = recipes.find(r => r.id === entry.recipeId);
                      return (
                        <tr key={entry.tempId} className="group hover:bg-white/[0.01]">
                          <td className="px-10 py-6 text-[11px] text-gray-500 font-mono">{idx + 1}</td>
                          <td className="px-10 py-6 font-serif text-white italic text-sm">{recipe?.tenBanh}</td>
                          <td className="px-10 py-6 font-serif text-gold text-right text-sm">{entry.soLuong}</td>
                          <td className="px-10 py-6 text-right">
                            <button onClick={() => handleRemoveEntry(entry.tempId)} className="text-[10px] text-gray-700 hover:text-rose-400 uppercase tracking-widest font-bold">Xoá</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {/* Mobile Waiting List */}
                <div className="md:hidden divide-y divide-white/5">
                   {entries.map((entry, idx) => {
                      const recipe = recipes.find(r => r.id === entry.recipeId);
                      return (
                        <div key={entry.tempId} className="p-4 flex justify-between items-center bg-black/5">
                           <div className="flex items-center gap-3">
                              <span className="text-[10px] text-gray-600 font-mono">#{idx+1}</span>
                              <div>
                                 <div className="text-sm text-white font-serif italic leading-tight">{recipe?.tenBanh}</div>
                                 <div className="text-[10px] text-gold font-bold mt-0.5">SL: {entry.soLuong}</div>
                              </div>
                           </div>
                           <button onClick={() => handleRemoveEntry(entry.tempId)} className="p-2 text-gray-700 hover:text-rose-500">
                             <Trash2 className="w-4 h-4" />
                           </button>
                        </div>
                      );
                   })}
                </div>
              </div>
              <div className="p-6 md:p-10 bg-black/20 text-center md:text-right">
                <button 
                  onClick={() => setStep(2)}
                  className="w-full md:w-auto px-10 md:px-12 py-4.5 md:py-5 bg-gold text-black text-[11px] font-black uppercase tracking-[0.2em] hover:bg-white transition-all shadow-xl rounded-sm"
                >
                  Xác nhận mẻ thực tế ({entries.length})
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-8 md:space-y-12 animate-in slide-in-from-right-4 duration-500">
          <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 px-4 md:px-0">
            <div className="space-y-2 md:space-y-4">
               <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-semibold italic">Bước 02 • Kiểm soát mẻ thực tế</div>
               <h3 className="text-2xl md:text-4xl font-serif text-white tracking-tight leading-tight">Chi tiết nguyên liệu</h3>
               <div className="flex items-center gap-2 text-gray-500 font-mono text-[10px] uppercase tracking-widest mt-1">
                 <Calendar className="w-3 h-3 text-gold/50" />
                 <span>Ngày SX: {productionDate}</span>
               </div>
            </div>
            <div className="flex flex-wrap gap-3 items-center w-full md:w-auto">
              <label className="flex-1 cursor-pointer bg-white/5 border border-dashed border-white/10 hover:border-gold/50 transition-all px-4 py-3 md:py-2.5 text-center group flex items-center justify-center gap-2 rounded-sm italic">
                <Upload className="w-3 h-3 text-gold" />
                <span className="text-[8px] uppercase tracking-[0.15em] text-gray-400 font-bold">Import thực tế</span>
                <input type="file" onChange={handleActualUsageUpload} accept=".xlsx, .xls" className="hidden" />
              </label>
              <button onClick={() => setStep(1)} className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 hover:text-white underline font-bold px-2 py-2">Quay lại</button>
            </div>
          </header>

          <div className="space-y-8 md:space-y-20 px-1 md:px-0">
            {entries.map((entry, entryIdx) => {
              const recipe = recipeMap.get(entry.recipeId)!;
              return (
                <div key={entry.tempId} className="space-y-4 md:space-y-6">
                  <div className="flex flex-wrap items-center gap-3 md:gap-6 border-b border-white/10 pb-3 md:pb-4 px-3 md:px-0">
                    <span className="px-2.5 py-1 md:px-4 md:py-1.5 bg-gold text-black text-[8px] md:text-[10px] font-bold uppercase tracking-widest rounded-sm">Mẻ #{entryIdx + 1}</span>
                    <h4 className="text-base md:text-2xl font-serif text-white italic">{recipe.tenBanh} <span className="text-gray-600 text-xs md:text-base ml-2 md:ml-4">({entry.soLuong} cái)</span></h4>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-3 md:gap-6">
                    {recipe.nvl.map((item, idx) => {
                      const n = nvlMap.get(item.nvlId);
                      const dm = (item.soLuong / recipe.soLuongChuan) * entry.soLuong;
                      const ttValue = parseFloat(entry.thucTe[item.nvlId] || "0");
                      const isWarning = ttValue > dm * 1.05;

                      return (
                        <div key={`${entry.tempId}-${item.nvlId}-${idx}`} className={`bg-dark-surface border p-4 md:p-8 transition-all flex flex-col md:flex-row gap-4 md:gap-8 items-start md:items-center rounded-sm ${isWarning ? 'border-rose-900 bg-rose-900/5' : 'border-white/5'}`}>
                          <div className="flex-1 w-full flex justify-between items-center">
                            <div>
                              <div className="text-base md:text-lg font-serif text-white italic">{n?.ten}</div>
                              <div className="text-[8px] md:text-[9px] uppercase tracking-widest text-gray-600 font-light mt-0.5 md:mt-1">Đơn vị: {n?.donVi}</div>
                            </div>
                            {isWarning && <span className="text-[8px] font-bold text-rose-400 uppercase tracking-widest border border-rose-900 px-2 py-1 bg-rose-950/20 rounded-sm">Hao hụt cao</span>}
                          </div>
                          
                          <div className="w-full md:w-32 flex justify-between md:block px-1 md:px-0">
                            <label className="text-[8px] text-gray-600 uppercase font-bold tracking-[0.2em] mb-1 md:mb-2 text-nowrap">Định mức:</label>
                            <div className="text-xs md:text-sm font-serif text-gray-500 italic font-mono">{fmtNum(dm)} {n?.donVi}</div>
                          </div>

                          <div className="w-full md:w-48 px-1 md:px-0">
                            <label className="text-[8px] text-gold uppercase font-bold tracking-[0.2em] block mb-1 md:mb-2">Thực sử dụng ({n?.donVi}):</label>
                            <input 
                              type="number" 
                              value={entry.thucTe[item.nvlId]}
                              onChange={e => handleUpdateThucTe(entryIdx, item.nvlId, e.target.value)}
                              className="w-full bg-black border-b border-gold/30 px-1 py-3 md:py-2 text-lg text-white font-serif focus:border-gold outline-none rounded-sm transition-all"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="sticky bottom-20 md:bottom-10 z-30 px-4 md:px-0">
            <button 
              onClick={handleSaveAll}
              className="w-full bg-gold hover:bg-white text-black text-[11px] md:text-[12px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] py-5 md:py-8 transition-all shadow-3xl border border-black group rounded-sm"
            >
              <div className="flex items-center justify-center gap-3">
                <Save className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span>Xác nhận & Lưu {entries.length} mẻ</span>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>


  );
}
