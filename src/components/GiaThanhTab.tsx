import { useMemo } from "react";
import { Recipe, NVL, ProductionLog, Overhead, MaterialUsage, MaterialConversion } from "../types";
import { fmtVND, uid } from "../lib/utils";
import { calculateRecipeCurrentCost } from "../lib/calculations";
import { Package, Info } from "lucide-react";

interface Props {
  recipes: Recipe[];
  nvl: NVL[];
  materialConversions: MaterialConversion[];
  usage: MaterialUsage[];
  logs: ProductionLog[];
  overheads: Overhead[];
  onSaveOverhead: (item: Overhead) => Promise<void>;
  selectedDate: string;
  selectedXuong: string;
}

export default function GiaThanhTab({ recipes, nvl, materialConversions, usage, logs, overheads, onSaveOverhead, selectedDate, selectedXuong }: Props) {
  const currentOverhead = useMemo(() => 
    overheads.find(o => o.ngay === selectedDate && o.xuong === selectedXuong)?.chiPhiPhu || 0,
    [overheads, selectedDate, selectedXuong]
  );

  const nvlMap = useMemo(() => new Map(nvl.map(n => [n.id, n])), [nvl]);
  const recipeCostMap = useMemo(() => 
    new Map(recipes.map(r => [r.id, calculateRecipeCurrentCost(r, nvl, materialConversions)])),
    [recipes, nvl, materialConversions]
  );
  
  const handleOverheadChange = (val: number) => {
    const existing = overheads.find(o => o.ngay === selectedDate && o.xuong === selectedXuong);
    if (existing) {
      onSaveOverhead({ ...existing, chiPhiPhu: val });
    } else {
      onSaveOverhead({ id: uid(), ngay: selectedDate, xuong: selectedXuong, chiPhiPhu: val });
    }
  };

  // Step 1: Identify Main vs Supplementary NVL based on usage
  const mainNvlIds = useMemo(() => new Set(recipes.flatMap(r => r.nvl.map(item => item.nvlId))), [recipes]);
  
  // Calculate total main material cost from usage
  const totalActualMainMaterialCost = useMemo(() => usage.reduce((acc, u) => {
    if (mainNvlIds.has(u.nvlId)) return acc + u.thanhTien;
    return acc;
  }, 0), [usage, mainNvlIds]);

  // Calculate total supplement (overhead) from usage list (materials used but NOT in recipe)
  const totalSupplementUsageCost = useMemo(() => usage.reduce((acc, u) => {
    if (!mainNvlIds.has(u.nvlId)) return acc + u.thanhTien;
    return acc;
  }, 0), [usage, mainNvlIds]);

  const effectiveOverhead = currentOverhead + totalSupplementUsageCost;
  const totalInputCost = totalActualMainMaterialCost + effectiveOverhead;

  // Step 2: Calculate normalization factor
  const totalTheoreticalStandardCost = useMemo(() => logs.reduce((acc, l) => {
    const currentPrice = recipeCostMap.get(l.recipeId) || 0;
    const r = recipes.find(rec => rec.id === l.recipeId);
    if (!r) return acc;
    return acc + (currentPrice / r.soLuongChuan * l.soLuongSanXuat);
  }, 0), [logs, recipes, recipeCostMap]);

  const normFactor = totalTheoreticalStandardCost > 0 ? totalActualMainMaterialCost / totalTheoreticalStandardCost : 1;

  // Step 3: Calculate Overhead distribution
  const totalProduced = useMemo(() => logs.reduce((sum, l) => sum + l.soLuongSanXuat, 0), [logs]);
  const overheadPerUnit = totalProduced > 0 ? effectiveOverhead / totalProduced : 0;

  const { analysis, totalOutputValue } = useMemo(() => {
    let outVal = 0;
    const items = recipes.map(r => {
      const rLogs = logs.filter(l => l.recipeId === r.id);
      const totalQty = rLogs.reduce((sum, l) => sum + l.soLuongSanXuat, 0);
      
      const standardCostUnit = (recipeCostMap.get(r.id) || 0) / r.soLuongChuan;
      const actualMaterialCostUnit = standardCostUnit * normFactor;
      const totalActualCost = actualMaterialCostUnit + overheadPerUnit;
      
      if (totalQty > 0) {
        outVal += totalActualCost * totalQty;
      }

      const diffPct = standardCostUnit > 0 ? ((totalActualCost - standardCostUnit) / standardCostUnit * 100) : 0;
      const overheadPct = totalActualCost > 0 ? (overheadPerUnit / totalActualCost * 100) : 0;

      return { 
        ...r, 
        standardCostUnit, 
        avgActualCost: totalActualCost, 
        directCost: actualMaterialCostUnit, 
        diffPct, 
        overheadPct,
        logCount: rLogs.length,
        totalQty
      };
    }).filter(item => item.logCount > 0)
      .sort((a, b) => b.diffPct - a.diffPct);
    
    return { analysis: items, totalOutputValue: outVal };
  }, [recipes, logs, recipeCostMap, normFactor, overheadPerUnit]);

  const reconciliationDiff = totalInputCost - totalOutputValue;

  return (
    <div className="space-y-8 md:space-y-12 pb-24 md:pb-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4">
        <div className="space-y-3 md:space-y-4">
          <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-semibold italic">Phân tích tài chính • {selectedXuong}</div>
          <h2 className="text-3xl md:text-5xl font-serif text-white leading-tight">Chỉ số giá thành</h2>
          <p className="text-xs md:text-sm text-gray-400 max-w-sm leading-relaxed font-light">
            Phân bổ chi phí NVL phụ và so sánh định mức thực tế.
          </p>
        </div>
        
        {/* Mobile Stats Scroller */}
        <div className="w-full overflow-x-auto pb-2 md:pb-0">
           <div className="flex md:grid md:grid-cols-3 gap-3 md:gap-8 bg-white/5 p-4 md:p-8 border border-white/5 min-w-max md:min-w-0">
            <div className="text-center px-4 md:px-0">
              <div className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-bold">NVL chính (Thực)</div>
              <div className="text-xl md:text-2xl font-serif text-gold">{fmtVND(totalActualMainMaterialCost)}</div>
            </div>
            <div className="text-center border-l border-white/5 px-4 md:px-0 md:pl-8">
              <div className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-bold">CP Phụ / Bổ sung</div>
              <div className="text-xl md:text-2xl font-serif text-white">{fmtVND(effectiveOverhead)}</div>
            </div>
            <div className="text-center border-l border-white/5 px-4 md:px-0 md:pl-8">
              <div className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gray-500 mb-2 font-bold">Chuẩn hoá</div>
              <div className="text-xl md:text-2xl font-serif text-white italic">x{normFactor.toFixed(3)}</div>
            </div>
          </div>
        </div>

        <div className="bg-dark-surface border border-gold/20 p-4 md:p-6 rounded-sm w-full md:w-64 space-y-3">
          <div className="flex items-center gap-2 text-[8px] uppercase font-bold text-gold tracking-widest">
            <Package className="w-3 h-3" /> CP bổ sung khác (VND)
          </div>
          <input 
            type="number" 
            value={currentOverhead || ""}
            onChange={(e) => handleOverheadChange(parseFloat(e.target.value) || 0)}
            placeholder="Nhập chi phí khác..."
            className="w-full bg-black border border-white/10 p-3 md:p-2 text-sm text-white font-serif focus:border-gold outline-none"
          />
        </div>
      </header>

      {/* Reconciliation Section */}
      <div className="bg-dark-surface p-6 md:p-10 border border-white/5 grid grid-cols-1 md:grid-cols-4 gap-6 md:gap-12">
        <div className="space-y-1">
          <div className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold leading-tight">Tổng Đầu Vào (Input)</div>
          <div className="text-xl md:text-3xl font-serif text-white">{fmtVND(totalInputCost)}</div>
          <div className="text-[8px] text-gray-600 uppercase tracking-tighter">Gồm NVL Chính + Phụ + Khác</div>
        </div>
        <div className="space-y-1">
          <div className="text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold leading-tight">Tổng Đầu Ra (Output)</div>
          <div className="text-xl md:text-3xl font-serif text-gold">{fmtVND(totalOutputValue)}</div>
          <div className="text-[8px] text-gray-600 uppercase tracking-tighter">Tổng giá trị thành phẩm</div>
        </div>
        <div className="space-y-1 flex flex-col justify-center">
            <div className={`text-[9px] uppercase tracking-[0.2em] font-bold ${Math.abs(reconciliationDiff) < 100 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {Math.abs(reconciliationDiff) < 100 ? "✓ Đã Khớp" : "⚠ Sai lệch"}
            </div>
            <div className={`text-lg md:text-xl font-serif ${Math.abs(reconciliationDiff) < 100 ? 'text-gray-500' : 'text-rose-400'}`}>
                {fmtVND(reconciliationDiff)}
            </div>
        </div>
        <div className="flex items-center">
            <div className="p-3 md:p-4 bg-white/5 border border-white/10 text-[8px] md:text-[9px] text-gray-400 leading-relaxed italic w-full">
                Công thức: Giá trị SP = (Định mức x Hệ số chuẩn hóa) + Phân bổ chi phí chung.
            </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6">
        <div className="bg-dark-surface/50 border border-white/5 p-4 md:p-6 space-y-1 md:space-y-2">
          <div className="text-[8px] md:text-[9px] uppercase tracking-widest text-gray-500 font-bold">Sản lượng</div>
          <div className="text-xl md:text-3xl font-serif text-white italic">{totalProduced} <span className="text-xs">Cái</span></div>
        </div>
        <div className="bg-dark-surface/50 border border-white/5 p-4 md:p-6 space-y-1 md:space-y-2">
          <div className="text-[8px] md:text-[9px] uppercase tracking-widest text-gray-500 font-bold">CP Phụ / Cái</div>
          <div className="text-xl md:text-3xl font-serif text-gold">{fmtVND(overheadPerUnit)}</div>
        </div>
        <div className="col-span-2 md:col-span-1 bg-dark-surface/50 border border-white/5 p-4 md:p-6 space-y-2 md:space-y-4 relative overflow-hidden">
          <div className="text-[8px] md:text-[9px] uppercase tracking-widest text-gray-500 font-bold flex justify-between">
            Phân loại NVL 
            <Info className="w-3 h-3 text-gray-700" />
          </div>
          <div className="flex gap-4">
            <div className="flex-1 text-center border-r border-white/5">
              <div className="text-lg md:text-xl font-serif text-white">{mainNvlIds.size}</div>
              <div className="text-[7px] md:text-[8px] uppercase font-bold text-gray-600">Loại NVL Chính</div>
            </div>
             <div className="flex-1 text-center italic">
              <div className="text-lg md:text-xl font-serif text-gray-500">NVL phụ</div>
              <div className="text-[7px] md:text-[8px] uppercase font-bold text-gray-600">Theo Usage</div>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-dark-surface border border-white/5 overflow-hidden rounded-sm">
        <div className="hidden md:block">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-gray-600">
                <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-[0.2em]">Sản phẩm</th>
                <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-[0.2em]">Định mức / Cái</th>
                <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-[0.2em]">Giá thành tổng / Cái</th>
                <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-[0.2em]">Chênh lệch</th>
                <th className="px-10 py-6 text-[10px] font-bold uppercase tracking-[0.2em]">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {analysis.map(item => (
                <RenderAnalysisRow key={item.id} item={item} overheadPerUnit={overheadPerUnit} isMobile={false} />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card List */}
        <div className="md:hidden divide-y divide-white/5">
           {analysis.map(item => (
                <RenderAnalysisRow key={item.id} item={item} overheadPerUnit={overheadPerUnit} isMobile={true} />
            ))}
        </div>
      </div>

      {analysis.length === 0 && <div className="py-20 text-center text-gray-600 font-serif italic text-base">Chưa có dữ liệu phân tích.</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-12 mt-4 md:mt-12">
        <div className="p-6 md:p-12 border border-white/5 bg-dark-surface/40 rounded-sm">
          <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-gold font-bold mb-6 italic">Hiệu quả tối ưu</div>
          <div className="space-y-4 md:space-y-6">
             {analysis.filter(a => a.diffPct <= 2 && a.logCount > 0).slice(0, 3).map(a => (
               <div key={a.id} className="flex justify-between items-center border-b border-white/5 pb-3 md:pb-4">
                  <span className="font-serif text-white italic text-sm">{a.tenBanh}</span>
                  <span className="text-emerald-400 font-serif text-xs md:text-sm">Đạt mục tiêu</span>
               </div>
             ))}
             {analysis.filter(a => a.diffPct <= 2 && a.logCount > 0).length === 0 && <p className="text-gray-600 font-serif italic text-xs">Đang chờ dữ liệu phân tích.</p>}
          </div>
        </div>
        <div className="p-6 md:p-12 border border-rose-900/20 bg-rose-950/5 rounded-sm">
          <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-rose-400 font-bold mb-6 italic">Cảnh báo hao hụt</div>
          <div className="space-y-4 md:space-y-6">
             {analysis.filter(a => a.diffPct > 5).slice(0, 3).map(a => (
               <div key={a.id} className="flex justify-between items-center border-b border-rose-900/10 pb-3 md:pb-4">
                  <span className="font-serif text-white italic text-sm">{a.tenBanh}</span>
                  <span className="text-rose-400 font-serif text-xs md:text-sm">Cần kiểm tra</span>
               </div>
             ))}
             {analysis.filter(a => a.diffPct > 5).length === 0 && <p className="text-gray-600 font-serif italic text-xs">Chỉ số hao hụt ổn định.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenderAnalysisRow({ item, overheadPerUnit, isMobile }: any) {
  const isWarning = item.diffPct > 5;
  const isExcellent = item.diffPct < 0 && item.logCount > 0;
  
  if (isMobile) {
    return (
      <div className="p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <h4 className="text-base font-serif text-white italic leading-tight">{item.tenBanh}</h4>
            <div className="text-[8px] uppercase tracking-widest text-gray-600 font-light">{item.logCount} mẻ • {item.totalQty} cái</div>
          </div>
          <span className={`text-[8px] uppercase tracking-widest font-bold px-2 py-1 border ${
                isWarning ? 'border-rose-900 text-rose-400 bg-rose-950/20' : 
                isExcellent ? 'border-emerald-900 text-emerald-400 bg-emerald-950/20' : 
                'border-white/10 text-gray-500'
              }`}>
            {isWarning ? "Vượt DM" : isExcellent ? "Tối ưu" : "Ổn định"}
          </span>
        </div>
        
        <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-sm border border-white/5">
           <div>
              <div className="text-[7px] text-gray-600 uppercase font-bold tracking-widest mb-1">Định mức / Cái</div>
              <div className="text-xs text-gray-400 font-serif italic">{fmtVND(item.standardCostUnit)}</div>
           </div>
           <div>
              <div className="text-[7px] text-gray-600 uppercase font-bold tracking-widest mb-1">Giá thực tế / Cái</div>
              <div className="text-sm text-white font-serif">{fmtVND(item.avgActualCost)}</div>
           </div>
        </div>

        <div className="flex justify-between items-center px-1">
           <div className="text-[8px] text-gray-500 uppercase tracking-tighter flex gap-2">
              <span>{fmtVND(item.directCost)} chính</span>
              <span>+</span>
              <span className="text-gold">{fmtVND(overheadPerUnit)} phụ</span>
           </div>
           <div className={`text-base font-serif ${item.diffPct > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
              {item.diffPct > 0 ? '+' : ''}{item.diffPct.toFixed(1)}%
           </div>
        </div>
      </div>
    );
  }

  return (
    <tr className="group hover:bg-white/[0.01] transition-colors italic">
      <td className="px-10 py-8">
        <div className="text-lg font-serif text-white">{item.tenBanh}</div>
        <div className="text-[9px] uppercase tracking-widest text-gray-600 font-light mt-1">{item.logCount} mẻ sản xuất</div>
      </td>
      <td className="px-10 py-8 font-serif text-gray-400 text-lg">{fmtVND(item.standardCostUnit)}</td>
      <td className="px-10 py-8">
        <div className="font-serif text-white text-lg font-medium">{item.logCount > 0 ? fmtVND(item.avgActualCost) : "N/A"}</div>
        {item.logCount > 0 && (
          <div className="text-[9px] text-gray-500 uppercase tracking-tighter mt-1 flex gap-2">
            <span>{fmtVND(item.directCost)} chính</span>
            <span>+</span>
            <span className="text-gold">{fmtVND(overheadPerUnit)} phụ ({item.overheadPct.toFixed(1)}%)</span>
          </div>
        )}
      </td>
      <td className="px-10 py-8">
        {item.logCount > 0 ? (
          <div className={`text-xl font-serif ${item.diffPct > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
            {item.diffPct > 0 ? '+' : ''}{item.diffPct.toFixed(1)}%
          </div>
        ) : "-"}
      </td>
      <td className="px-10 py-8">
        {item.logCount > 0 ? (
          <span className={`text-[10px] uppercase tracking-widest font-bold px-4 py-2 border ${
            isWarning ? 'border-rose-900 text-rose-400 bg-rose-950/20' : 
            isExcellent ? 'border-emerald-900 text-emerald-400 bg-emerald-950/20' : 
            'border-white/10 text-gray-500'
          }`}>
            {isWarning ? "Vượt định mức" : isExcellent ? "Tối ưu tốt" : "Ổn định"}
          </span>
        ) : <span className="text-[10px] uppercase tracking-widest text-gray-700 font-bold italic">Chưa đủ dữ liệu</span>}
      </td>
    </tr>
  );
}

