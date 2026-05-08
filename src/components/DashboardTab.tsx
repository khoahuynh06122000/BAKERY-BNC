import { useMemo } from "react";
import { LayoutDashboard, BookOpen, DollarSign, TrendingDown, Clock, AlertTriangle, CheckCircle2, Sparkles } from "lucide-react";
import { ProductionLog, Recipe, NVL } from "../types";
import { today, fmtVND } from "../lib/utils";

interface Props {
  logs: ProductionLog[];
  recipes: Recipe[];
  nvl: NVL[];
  selectedDate: string;
  selectedXuong: string;
}

export default function DashboardTab({ logs, recipes, nvl, selectedDate, selectedXuong }: Props) {
  const nvlMap = useMemo(() => new Map(nvl.map(n => [n.id, n])), [nvl]);
  const recipeMap = useMemo(() => new Map(recipes.map(r => [r.id, r])), [recipes]);

  const { totalCostDay, totalWasteDay } = useMemo(() => {
    let cost = 0;
    let waste = 0;
    
    for (const log of logs) {
      cost += log.giaThanh;
      for (const item of log.items) {
        if (item.chenh > 0) {
          const nvlItem = nvlMap.get(item.nvlId);
          if (nvlItem) {
            waste += item.chenh * nvlItem.gia;
          }
        }
      }
    }
    
    return { totalCostDay: cost, totalWasteDay: waste };
  }, [logs, nvlMap]);

  return (
    <div className="space-y-8 md:space-y-12 pb-20 md:pb-0 px-1 md:px-0">
      <header className="space-y-4 pt-4 px-3 md:px-0">
        <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-bold">
           Xưởng: {selectedXuong} • {selectedDate.split('-').reverse().join('/')}
        </div>
        <h2 className="text-3xl md:text-6xl font-serif text-white leading-tight tracking-tighter">Bakery OS<br/>Trung tâm điều khiển</h2>
        <p className="text-[11px] md:text-sm text-gray-400 max-w-sm md:max-w-md leading-relaxed font-sans">
          Theo dõi thời gian thực sản lượng sản xuất, hao hụt nguyên liệu và chỉ số chi phí vận hành.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 border border-white/5 bg-dark-surface/50 backdrop-blur-sm divide-x divide-y md:divide-y-0 divide-white/5">
        <DataCard label="Mẻ bánh" value={logs.length} />
        <DataCard label="Công thức" value={recipes.length} />
        <DataCard label="Chi phí SX" value={fmtVND(totalCostDay)} isCurrency />
        <DataCard label="Hao hụt VT" value={fmtVND(totalWasteDay)} isCurrency color="text-rose-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-12 mt-6 md:mt-12">
        <div className="lg:col-span-12">
           <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] text-gray-500 mb-6 md:mb-8 font-light">Hoạt động trong ngày</div>
           <div className="space-y-1 border-t border-white/5">
            {logs.length === 0 ? (
              <div className="py-12 text-center text-gray-600 font-serif italic">Chưa có hoạt động sản xuất nào.</div>
            ) : (
              logs.slice().reverse().map(log => {
                const r = recipeMap.get(log.recipeId);
                const isLateByCost = log.items.some(i => i.chenhPct > 5);
                return (
                  <div key={log.id} className="group py-4 md:py-6 border-b border-white/5 flex gap-4 md:gap-8 items-center hover:bg-white/[0.02] px-2 md:px-4 transition-all">
                    <div className="text-xl md:text-2xl font-serif text-gold w-12 md:w-16 shrink-0">{log.thoiGian.split(':')[0]}h</div>
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="text-xs md:text-sm text-white font-medium uppercase tracking-wider truncate">{r?.tenBanh || "Sản phẩm ngoài danh mục"}</div>
                      <div className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500">{log.soLuongSanXuat} cái • {isLateByCost ? "Cần kiểm tra" : "Tiêu chuẩn"}</div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-sm md:text-lg font-serif text-white">{fmtVND(log.giaThanh)}</div>
                      <div className={`text-[8px] md:text-[9px] uppercase tracking-widest font-bold ${isLateByCost ? 'text-rose-400' : 'text-emerald-400 opacity-60'}`}>
                        {isLateByCost ? "Cảnh báo" : "Ổn định"}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="p-6 md:p-12 bg-dark-surface border border-white/10 rounded-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(197,160,89,0.05)_0%,transparent_60%)]"></div>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-6 md:gap-8">
          <div className="space-y-4 text-center md:text-left">
             <div className="text-[10px] md:text-[11px] uppercase tracking-[0.3em] text-gold font-bold mb-2">Gợi ý từ AI</div>
             <p className="text-lg md:text-xl font-serif text-white leading-relaxed italic border-l-0 md:border-l-4 border-gold md:pl-8">
                "Phân tích cho thấy hao hụt lặp lại ở Bơ. Đề xuất kiểm tra quy trình định lượng."
             </p>
          </div>
          <button onClick={() => window.dispatchEvent(new CustomEvent('changeTab', { detail: 'report' }))} className="w-full md:w-auto px-10 py-5 bg-gold text-black text-[11px] font-bold uppercase tracking-[0.2em] hover:bg-white transition-all shadow-2xl">
            Tối ưu ngay
          </button>
        </div>
      </div>

    </div>
  );
}

function DataCard({ label, value, isCurrency, color = "text-white" }: any) {
  return (
    <div className="p-4 md:p-10 space-y-1 md:space-y-2 hover:bg-white/[0.01] transition-colors">
      <div className="text-[8px] md:text-[10px] text-gray-500 uppercase tracking-[0.1em] font-light">{label}</div>
      <div className={`text-sm md:text-3xl font-serif ${color} tracking-tight truncate`}>{value}</div>
      <div className="h-0.5 w-4 bg-gold/40 mt-1 md:mt-4"></div>
    </div>
  );
}
