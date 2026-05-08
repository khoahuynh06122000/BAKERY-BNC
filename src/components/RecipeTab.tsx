import { useState } from "react";
import { Plus, Trash2, Edit3, DollarSign, Upload, Download, Search } from "lucide-react";
import * as XLSX from "xlsx";
import { Recipe, NVL, MaterialConversion } from "../types";
import { uid, fmtVND, similarity } from "../lib/utils";
import { calculateRecipeCurrentCost } from "../lib/calculations";

interface Props {
  allRecipes: Recipe[];
  allNvl: NVL[];
  materialConversions: MaterialConversion[];
  onSaveRecipe: (data: Recipe) => Promise<void>;
  onDeleteRecipe: (id: string) => Promise<void>;
  onBulkSaveRecipes: (data: Recipe[]) => Promise<void>;
  onBulkSaveNvl: (data: NVL[]) => Promise<void>;
  currentXuong: string;
  hasAdminPrivileges: boolean;
}

export default function RecipeTab({ 
  allRecipes, 
  allNvl, 
  materialConversions, 
  onSaveRecipe,
  onDeleteRecipe,
  onBulkSaveRecipes,
  onBulkSaveNvl, 
  currentXuong, 
  hasAdminPrivileges 
}: Props) {
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState<Recipe>({ id: "", tenBanh: "", soLuongChuan: 10, costDinhMucMe: 0, nvl: [], xuong: currentXuong });
  const [searchTerm, setSearchTerm] = useState("");

  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const nvl = allNvl.filter(n => n.xuong === currentXuong);
  const recipes = allRecipes
    .filter(r => r.xuong === currentXuong)
    .filter(r => r.tenBanh.toLowerCase().includes(searchTerm.toLowerCase()));

  const addNvlRow = () => {
    if (nvl.length === 0) return;
    setForm({ ...form, nvl: [...form.nvl, { nvlId: nvl[0].id, soLuong: 0 }] });
  };

  const handleSave = () => {
    if (!form.tenBanh || form.nvl.length === 0) return;
    
    // Auto calculate cost on save to ensure it's up to date based on conversions/prices
    const currentCalculatedCost = calculateRecipeCurrentCost(form, allNvl, materialConversions);
    const updatedForm = { 
      ...form, 
      id: form.id || uid(),
      xuong: form.xuong || currentXuong,
      costDinhMucMe: currentCalculatedCost || form.costDinhMucMe 
    };

    onSaveRecipe(updatedForm);
    setIsAdding(false);
    setForm({ id: "", tenBanh: "", soLuongChuan: 10, costDinhMucMe: 0, nvl: [], xuong: currentXuong });
  };

  const findBestNvlMatch = (tenNvl: string) => {
    let bestMatch = null;
    let maxSimilarity = 0;

    for (const item of nvl) {
      const sim = similarity(item.ten, tenNvl);
      if (sim > 0.65 && sim > maxSimilarity) {
        maxSimilarity = sim;
        bestMatch = item;
      }
      if (sim === 1) break; // Exact match found
    }
    return bestMatch;
  };

  const downloadTemplate = () => {
    const data = [
      ["Tên Sản Phẩm", "Số Lượng Chuẩn", "Cost Định Mức / Mẻ", "Tên Nguyên Liệu", "ĐVT", "Định mức"],
      ["BNC_Bánh Malesherbes Baguette 250Gr", 1, 15000, "Bột mì T55", "KG", 0.25],
      ["BNC_Bánh Malesherbes Baguette 250Gr", 1, 15000, "Mật ong Tam Đảo 800gr", "CHA", 0.0375],
      ["BNC_Cereals Breads 270Gr", 1, 22000, "Bột mì T150", "KG", 0.025]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Recipe");
    XLSX.writeFile(wb, "Template_Bao_Gia_Cong_Thuc.xlsx");
  };

  const clearAllData = () => {
    if (window.confirm(`Bạn có chắc chắn muốn xoá TOÀN BỘ dữ liệu Recipe của xưởng ${currentXuong}?`)) {
      const remaining = allRecipes.filter(r => (r.xuong || "").trim().toLowerCase() !== currentXuong.trim().toLowerCase());
      onBulkSaveRecipes(remaining);
    }
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
      
      const missingNvl: NVL[] = [];
      const tempAllNvl = [...allNvl];
      const fileRecipeGroups: { [key: string]: Recipe } = {};

      const parseNum = (val: any) => {
        if (typeof val === 'number') return val;
        const s = String(val || "").replace(/[^-0-9.]/g, "");
        return parseFloat(s) || 0;
      };

      jsonData.forEach((row, index) => {
        if (index === 0) return; // Skip header
        if (!row || row.length === 0) return;

        const tenBanh = String(row[0] || "").trim();
        const soLuongChuan = parseInt(String(row[1] || "1").replace(/[^-0-9]/g, "")) || 1;
        const costDinhMucMeInput = parseNum(row[2]);
        const tenNvl = String(row[3] || "").trim();
        const donViNvl = String(row[4] || "kg").trim();
        const soLuongNvl = parseNum(row[5]);

        if (tenBanh && tenNvl && soLuongNvl > 0) {
          let nvlMatch = tempAllNvl.find(n => n.xuong === currentXuong && (n.ten.toLowerCase() === tenNvl.toLowerCase() || similarity(n.ten, tenNvl) > 0.65));
          
          if (!nvlMatch) {
            nvlMatch = {
              id: uid(),
              ten: tenNvl,
              donVi: donViNvl,
              gia: 0,
              xuong: currentXuong,
              loai: 'phụ'
            };
            tempAllNvl.push(nvlMatch);
            missingNvl.push(nvlMatch);
          }

          if (!fileRecipeGroups[tenBanh]) {
            fileRecipeGroups[tenBanh] = {
              id: uid(),
              tenBanh,
              soLuongChuan,
              costDinhMucMe: costDinhMucMeInput,
              nvl: [],
              xuong: currentXuong
            };
          } else {
            // Update cost if a value is provided in subsequent rows of the same bánh
            if (costDinhMucMeInput > 0 && fileRecipeGroups[tenBanh].costDinhMucMe === 0) {
              fileRecipeGroups[tenBanh].costDinhMucMe = costDinhMucMeInput;
            }
          }

          const existingNvl = fileRecipeGroups[tenBanh].nvl.find(n => n.nvlId === nvlMatch!.id);
          if (existingNvl) {
            existingNvl.soLuong += soLuongNvl;
          } else {
            fileRecipeGroups[tenBanh].nvl.push({
              nvlId: nvlMatch.id,
              soLuong: soLuongNvl
            });
          }
        }
      });

      if (missingNvl.length > 0) {
        onBulkSaveNvl(tempAllNvl);
      }

      // Merge logic: Update existing recipes or add new ones
      const updatedAllRecipes = [...allRecipes];
      Object.values(fileRecipeGroups).forEach(newR => {
        const existingIdx = updatedAllRecipes.findIndex(r => 
          r.xuong === currentXuong && r.tenBanh.toLowerCase() === newR.tenBanh.toLowerCase()
        );
        
        if (existingIdx > -1) {
          // Update existing keeping same ID
          updatedAllRecipes[existingIdx] = {
            ...newR,
            id: updatedAllRecipes[existingIdx].id
          };
        } else {
          updatedAllRecipes.push(newR);
        }
      });

      if (Object.keys(fileRecipeGroups).length > 0) {
        onBulkSaveRecipes(updatedAllRecipes);
      }
      e.target.value = ""; // Reset input
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="space-y-8 md:space-y-12 pb-24 md:pb-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
        <div className="space-y-3 md:space-y-4">
          <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-semibold italic">Tiêu chuẩn công thức</div>
          <h2 className="text-3xl md:text-5xl font-serif text-white">Công thức (Recipes)</h2>
          <p className="text-xs md:text-sm text-gray-400 max-w-sm leading-relaxed font-light">
            Các thông số sản xuất chính xác và định mức nguyên vật liệu cho từng loại bánh.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:gap-4 w-full md:w-auto">
          {hasAdminPrivileges && (
            <button 
              onClick={clearAllData}
              className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 border border-rose-900/30 text-rose-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-rose-900 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <Trash2 className="w-3 h-3" /> Xoá hết
            </button>
          )}
          <button 
            onClick={downloadTemplate}
            className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 border border-white/10 text-gray-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold hover:text-white transition-all flex items-center justify-center gap-2"
          >
            <Download className="w-3 h-3" /> Mẫu
          </button>
          <label className="flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 border border-gold/30 text-gold text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold cursor-pointer hover:bg-gold hover:text-black transition-all flex items-center justify-center gap-2">
            <Upload className="w-3 h-3" /> Import
            <input type="file" accept=".csv, .xlsx, .xls" onChange={handleFileUpload} className="hidden" />
          </label>
          {!isAdding && (
            <button 
              onClick={() => setIsAdding(true)}
              className="w-full md:w-auto px-6 md:px-10 py-3.5 md:py-5 bg-gold text-black text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all shadow-xl"
            >
              Thêm mới
            </button>
          )}
        </div>
      </header>

      {isAdding && (
        <div className="bg-dark-surface border border-white/10 p-6 md:p-12 space-y-8 md:space-y-12 animate-in fade-in duration-500 rounded-sm">
          <div className="flex justify-between items-center">
            <h3 className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-bold italic">Bản thảo công thức</h3>
            <button onClick={() => setIsAdding(false)} className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 hover:text-white transition-all font-bold">Huỷ bỏ</button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
            <div className="lg:col-span-4 space-y-6 md:space-y-8">
              <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-light ml-1">Tên sản phẩm</label>
                <input 
                  type="text" 
                  value={form.tenBanh}
                  onChange={e => setForm({...form, tenBanh: e.target.value})}
                  className="w-full bg-black border border-white/10 p-3.5 md:p-4 text-sm text-white focus:border-gold outline-none font-serif italic"
                  placeholder="VD: Bánh mì Men tự nhiên"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-light ml-1">Sản lượng chuẩn (Cái)</label>
                <input 
                  type="number" 
                  value={form.soLuongChuan}
                  onChange={e => setForm({...form, soLuongChuan: parseInt(e.target.value) || 1})}
                  className="w-full bg-black border border-white/10 p-3.5 md:p-4 text-sm text-white font-serif outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-light ml-1">Cost định mức (VND)</label>
                <input 
                  type="number" 
                  value={form.costDinhMucMe}
                  onChange={e => setForm({...form, costDinhMucMe: parseFloat(e.target.value) || 0})}
                  className="w-full bg-black border border-white/10 p-3.5 md:p-4 text-sm text-gold font-serif outline-none"
                />
                <div className="pt-2 flex justify-between items-baseline px-1">
                  <div className="text-[8px] uppercase tracking-[0.2em] text-gray-600 font-bold">Cost quy đổi</div>
                  <div className="text-sm font-serif text-white italic">{fmtVND(calculateRecipeCurrentCost(form, allNvl, materialConversions))}</div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-8 space-y-4 md:space-y-6">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-light">Định mức nguyên liệu</span>
                <button onClick={addNvlRow} className="text-[9px] md:text-[10px] font-bold text-gold uppercase tracking-widest hover:text-white transition-colors">+ Thêm line</button>
              </div>
              
              <div className="space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {form.nvl.map((item, idx) => (
                  <div key={`${item.nvlId}-${idx}`} className="flex gap-2 md:gap-4 items-center bg-black/40 p-3 md:p-4 border border-white/5 rounded-sm">
                    <div className="flex-1 min-w-0">
                      <select 
                        value={item.nvlId}
                        onChange={e => {
                          const newNvl = [...form.nvl];
                          newNvl[idx].nvlId = e.target.value;
                          setForm({ ...form, nvl: newNvl });
                        }}
                        className="w-full bg-transparent text-xs md:text-sm text-white outline-none font-serif italic"
                      >
                        {nvl.map(n => <option key={n.id} value={n.id} className="bg-black">{n.ten} ({n.donVi})</option>)}
                      </select>
                      {(() => {
                        const targetNvl = nvl.find(n => n.id === item.nvlId);
                        const conv = targetNvl ? materialConversions.find(c => c.sourceTen.trim().toLowerCase() === targetNvl.ten.trim().toLowerCase()) : null;
                        if (conv) {
                           const baseNvl = allNvl.find(n => n.id === conv.targetNvlId);
                           return (
                             <div className="text-[7px] text-emerald-400/80 uppercase font-bold mt-1 tracking-tighter truncate">
                                ✓ Lấy giá từ: {baseNvl?.ten} (x{conv.ratio})
                             </div>
                           );
                        }
                        return null;
                      })()}
                    </div>
                    <input 
                      type="number" 
                      value={item.soLuong}
                      step="0.001"
                      onChange={e => {
                        const newNvl = [...form.nvl];
                        newNvl[idx].soLuong = parseFloat(e.target.value) || 0;
                        setForm({ ...form, nvl: newNvl });
                      }}
                      className="w-16 md:w-24 bg-transparent border-b border-white/10 text-xs md:text-sm text-white font-serif text-right outline-none"
                    />
                    <span className="w-10 md:w-12 text-[8px] text-gray-600 uppercase tracking-widest text-center shrink-0">{nvl.find(n => n.id === item.nvlId)?.donVi}</span>
                    <button 
                      onClick={() => setForm({ ...form, nvl: form.nvl.filter((_, i) => i !== idx) })}
                      className="text-gray-700 hover:text-rose-400 transition-colors p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5 md:w-4 md:h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-6 md:pt-8 border-t border-white/5 flex gap-4">
             <button onClick={() => setIsAdding(false)} className="flex-1 md:hidden py-4 border border-white/10 text-white text-[10px] font-bold uppercase tracking-widest">Huỷ</button>
            <button onClick={handleSave} className="flex-[2] md:flex-none md:ml-auto px-12 py-4 md:py-5 bg-gold text-black text-[10px] md:text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all shadow-xl rounded-sm">
              Lưu công thức
            </button>
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 md:gap-6 items-center">
        <div className="relative flex-1 w-full group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-gold transition-colors" />
          <input 
            type="text" 
            placeholder="Tìm kiếm công thức..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-dark-surface border border-white/10 p-3.5 md:p-5 pl-12 md:pl-14 text-sm text-white focus:border-gold outline-none font-serif italic transition-all shadow-xl rounded-sm"
          />
        </div>
        <div className="text-[9px] md:text-[10px] uppercase tracking-[0.1em] md:tracking-[0.2em] text-gray-600 font-bold bg-white/5 py-2.5 md:py-4 px-4 md:px-6 border border-white/5 whitespace-nowrap rounded-sm w-full md:w-auto text-center md:text-left">
          Hiển thị: <span className="text-white mx-1">{recipes.length} / {allRecipes.filter(r => r.xuong === currentXuong).length}</span> món
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-8">
        {recipes.map(recipe => {
          return (
            <div key={recipe.id} className="group bg-dark-surface border border-white/10 p-5 md:p-8 flex flex-col hover:border-gold transition-all relative overflow-hidden rounded-sm">
              <div className="absolute top-2 right-2 md:top-4 md:right-4 p-2 flex gap-3 md:gap-4 transition-all z-10">
                <button onClick={() => { setForm(recipe); setIsAdding(true); }} className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-gray-500 hover:text-gold bg-[#080808]/80 px-2 py-1 rounded">Sửa</button>
                {hasAdminPrivileges && (
                  <button onClick={() => onDeleteRecipe(recipe.id)} className="text-[9px] md:text-[10px] uppercase tracking-widest font-bold text-gray-500 hover:text-rose-400 bg-[#080808]/80 px-2 py-1 rounded">Xoá</button>
                )}
              </div>

              <div className="space-y-2 md:space-y-4 mb-16 md:mb-20">
                <div className="text-[8px] md:text-[10px] uppercase tracking-[0.2em] text-gray-500 font-light">ID: {recipe.id.split('-')[0].toUpperCase()}</div>
                <h4 className="text-xl md:text-3xl font-serif text-white italic group-hover:text-gold transition-colors leading-tight">{recipe.tenBanh}</h4>
                <p className="text-[9px] md:text-[11px] uppercase tracking-[0.15em] text-gray-500 font-medium">{recipe.soLuongChuan} Cái / mẻ</p>
              </div>

              <div className="mt-auto pt-6 md:pt-8 border-t border-white/5 flex flex-col gap-6">
                <div className="flex justify-between items-end">
                  <div className="space-y-3 md:space-y-4">
                    <div className="space-y-1">
                      <div className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gray-600 font-bold">Cost định mức</div>
                      <div className="text-lg md:text-2xl font-serif text-white/30 line-through decoration-gold/30">{fmtVND(recipe.costDinhMucMe)}</div>
                    </div>
                    <div className="space-y-1">
                      <div className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gold font-bold tracking-widest">Cost hiện hành</div>
                      <div className="text-xl md:text-2xl font-serif text-gold">{fmtVND(calculateRecipeCurrentCost(recipe, allNvl, materialConversions))}</div>
                    </div>
                  </div>
                  <div className="space-y-1 text-right">
                    <div className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gray-600 font-bold">Mỗi cái</div>
                    <div className="text-xs md:text-sm font-serif text-gray-400 italic">{fmtVND(calculateRecipeCurrentCost(recipe, allNvl, materialConversions) / recipe.soLuongChuan)}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>

  );
}
