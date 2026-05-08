import React, { useState, useMemo, useRef, useEffect } from "react";
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  Zap, 
  ChevronRight, 
  BarChart3, 
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  ShieldCheck,
  Search
} from "lucide-react";
import { ProductionLog, Recipe, NVL, Overhead, MaterialUsage, MaterialConversion } from "../types";
import { fetchAiInsights } from "../services/api";
import { calculateRecipeCurrentCost } from "../lib/calculations";
import Markdown from "react-markdown";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Cell,
} from "recharts";

interface Props {
  logs: ProductionLog[];
  recipes: Recipe[];
  nvl: NVL[];
  overheads: Overhead[];
  materialConversions: MaterialConversion[];
  usage: MaterialUsage[];
  currentXuong: string;
}

export default function ReportTab({ logs, recipes, nvl, overheads, materialConversions, usage, currentXuong }: Props) {
  const [insight, setInsight] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [reportType, setReportType] = useState<'full' | 'trend' | 'recipe'>('full');
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (insight && resultRef.current) {
      resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [insight]);

  const analysisData = useMemo(() => {
    const periodUsage = usage.filter(u => currentXuong === "ADMIN" ? true : u.xuong === currentXuong);
    const nvlMap = new Map(nvl.map(n => [n.id, n]));
    const recipeCostMap = new Map(recipes.map(r => [r.id, calculateRecipeCurrentCost(r, nvl, materialConversions)]));
    
    // Step 1: Identify Main NVL IDs across all recipes
    const mainNvlIds = new Set(recipes.flatMap(r => r.nvl.map(item => item.nvlId)));
    
    // Calculate total actual main material cost
    const totalActualMainMaterialCost = periodUsage.reduce((sum, u) => {
      if (mainNvlIds.has(u.nvlId)) return sum + u.thanhTien;
      return sum;
    }, 0);
    
    // Total theoretical standard cost for all produced items in this period
    const totalTheoreticalCost = logs.reduce((sum, l) => {
      const currentPrice = recipeCostMap.get(l.recipeId) || 0;
      const recipe = recipes.find(r => r.id === l.recipeId);
      if (!recipe) return sum;
      return sum + (currentPrice / recipe.soLuongChuan) * l.soLuongSanXuat;
    }, 0);

    const normalizationFactor = (totalTheoreticalCost > 0 && totalActualMainMaterialCost > 0) 
      ? totalActualMainMaterialCost / totalTheoreticalCost 
      : 1;
      
    const totalProduced = logs.reduce((sum, l) => sum + l.soLuongSanXuat, 0);
    
    // Also include total supplement usage in overhead distribution as per GiaThanhTab
    const totalSupplementUsageCost = periodUsage.reduce((sum, u) => {
      if (!mainNvlIds.has(u.nvlId)) return sum + u.thanhTien;
      return sum;
    }, 0);

    const currentOverheadInput = currentXuong === "ADMIN" 
      ? overheads.reduce((sum, o) => sum + o.chiPhiPhu, 0)
      : overheads.find(o => o.xuong === currentXuong)?.chiPhiPhu || 0;
      
    const effectiveOverhead = currentOverheadInput + totalSupplementUsageCost;
    const overheadPerUnit = totalProduced > 0 ? effectiveOverhead / totalProduced : 0;

    return recipes.map(r => {
      const rLogs = logs.filter(l => l.recipeId === r.id);
      const totalQty = rLogs.reduce((sum, l) => sum + l.soLuongSanXuat, 0);
      if (totalQty === 0) return null;

      const currentRecipeCost = recipeCostMap.get(r.id) || 0;
      const standardCostUnit = currentRecipeCost / r.soLuongChuan;
      
      const actualCostAvg = (standardCostUnit * normalizationFactor) + overheadPerUnit;
      
      const variance = actualCostAvg - standardCostUnit;
      const variancePct = standardCostUnit > 0 ? (variance / standardCostUnit) * 100 : 0;

      const matIssuesMap = rLogs.flatMap(log => log.items).reduce((acc: any, item) => {
        if (!acc[item.nvlId]) acc[item.nvlId] = { totalChenh: 0, count: 0 };
        acc[item.nvlId].totalChenh += item.chenhPct;
        acc[item.nvlId].count += 1;
        return acc;
      }, {});

      const topBadMats = Object.entries(matIssuesMap)
        .map(([id, info]: any) => ({
          name: nvlMap.get(id)?.ten || "N/A",
          avgChenh: info.totalChenh / info.count
        }))
        .filter(m => m.avgChenh > 0.5) // Even smaller threshold to capture everything
        .sort((a, b) => b.avgChenh - a.avgChenh);

      return {
        id: r.id,
        name: r.tenBanh,
        qty: totalQty,
        std: standardCostUnit,
        act: actualCostAvg,
        variance,
        variancePct,
        topBadMats,
        batchCount: rLogs.length
      };
    }).filter(Boolean);
  }, [logs, recipes, nvl, usage, currentXuong, overheads]);

  const fmtVND = (v: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(v);

  const performAnalysis = async (type: 'full' | 'trend' | 'recipe') => {
    setLoading(true);
    setInsight(null); // Clear previous report
    setReportType(type);
    try {
      const reportData = {
        xuong: currentXuong,
        periodStats: {
          totalProduced: logs.reduce((sum, l) => sum + l.soLuongSanXuat, 0),
          summary: analysisData,
          criticalAlerts: (analysisData || []).filter(a => Math.abs(a?.variancePct || 0) > 5),
          topWasteMaterials: (analysisData || []).flatMap(a => (a?.topBadMats || []).map(m => ({ product: a?.name, ...m }))).sort((a, b) => b.avgChenh - a.avgChenh).slice(0, 10)
        }
      };
      const res = await fetchAiInsights(reportData, type);
      setInsight(res);
    } catch (err: any) {
      console.error("Analysis failed:", err);
      setInsight(`### Đã có lỗi xảy ra\n\nKhông thể kết nối với hệ thống chuyên gia AI. Chi tiết lỗi: ${err.message || 'Unknown error'}\n\nVui lòng kiểm tra kết nối mạng hoặc thử lại sau.`);
    } finally {
      setLoading(false);
    }
  };

  const chartData = (analysisData || []).map(a => ({
    name: a?.name,
    variancePct: parseFloat((a?.variancePct || 0).toFixed(1)),
  })).sort((a, b) => b.variancePct - a.variancePct);

  const avgVariance = useMemo(() => {
    if (!analysisData || analysisData.length === 0) return 0;
    return analysisData.reduce((acc, a) => acc + (a?.variancePct || 0), 0) / analysisData.length;
  }, [analysisData]);

  return (
    <div className="space-y-10 md:space-y-12 pb-24 md:pb-32 px-1 md:px-0">
      {/* Header with Executive Overview */}
      <section className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 md:gap-10 pt-4 px-3 md:px-0">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-gold/10 border border-gold/20 text-gold text-[8px] md:text-[9px] uppercase tracking-[0.2em] font-bold rounded-full">
                Professional Data Insight
             </div>
             <span className="text-gray-700 text-[9px] font-mono">ID: {Math.random().toString(36).substring(7).toUpperCase()}</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-serif text-white tracking-tighter leading-tight">Báo Cáo<br/>Toàn Diện</h1>
          <p className="text-gray-500 text-[11px] md:text-sm max-w-sm md:max-w-xl leading-relaxed italic">
             Hệ thống tự động phân tích biến động dựa trên dữ liệu tiêu thụ thực tế.
          </p>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="bg-dark-surface border border-white/5 p-4 md:p-6 min-w-0 md:min-w-[160px] rounded-sm">
                <div className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-2 md:mb-3">Sai lệch</div>
                <div className="flex items-center gap-2">
                    <span className="text-xl md:text-3xl font-serif text-white tracking-tighter">
                        {avgVariance.toFixed(1)}%
                    </span>
                    {avgVariance > 5 ? 
                        <ArrowUpRight className="w-4 h-4 text-rose-400" /> : <ArrowDownRight className="w-4 h-4 text-emerald-400" />}
                </div>
            </div>
            <div className="bg-dark-surface border border-white/5 p-4 md:p-6 min-w-0 md:min-w-[160px] rounded-sm">
                <div className="text-[8px] md:text-[9px] uppercase tracking-[0.2em] text-gray-500 font-bold mb-2 md:mb-3">Lãng phí</div>
                <div className="flex items-center gap-2">
                    <span className="text-xl md:text-3xl font-serif text-rose-400 tracking-tighter">
                        {analysisData?.filter(a => (a?.variancePct || 0) > 10).length}
                    </span>
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                </div>
            </div>
        </div>
      </section>

      {/* Main Analysis Grid */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-10">
        
        {/* Left: Detailed Variance List/Cards for Mobile */}
        <div className="xl:col-span-2 space-y-6 md:space-y-8">
            <div className="bg-dark-surface border border-white/5 overflow-hidden rounded-sm">
                <div className="p-5 md:p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                    <h3 className="text-[9px] md:text-xs uppercase tracking-[0.2em] text-white font-bold flex items-center gap-2">
                        <Target className="w-4 h-4 text-gold" /> Phân tích sai lệch chi tiết
                    </h3>
                    <div className="text-[9px] text-gray-600 font-mono">LIVE</div>
                </div>
                
                <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/5 bg-white/[0.01]">
                                <th className="p-4 text-[10px] uppercase text-gray-500 font-bold tracking-widest">Tên Sản Phẩm</th>
                                <th className="p-4 text-[10px] uppercase text-gray-400 font-bold text-right tracking-widest">Định Mức</th>
                                <th className="p-4 text-[10px] uppercase text-gray-400 font-bold text-right tracking-widest">Thực Tế</th>
                                <th className="p-4 text-[10px] uppercase text-gray-400 font-bold text-right tracking-widest">Sai Lệch (%)</th>
                                <th className="p-4 text-[10px] uppercase text-gray-400 font-bold tracking-widest">Hành Động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {analysisData?.map((item, idx) => (
                                <tr key={idx} className="border-b border-white/5 hover:bg-white/[0.02] group transition-colors">
                                    <td className="p-4">
                                        <div className="text-xs font-bold text-gray-300 group-hover:text-white uppercase tracking-wider">{item?.name}</div>
                                        <div className="text-[9px] text-gray-600 mt-1 uppercase tracking-tighter">Sản lượng: {item?.qty} cái</div>
                                    </td>
                                    <td className="p-4 text-right text-xs text-gray-500">{fmtVND(item?.std || 0)}</td>
                                    <td className="p-4 text-right text-xs font-serif text-white">{fmtVND(item?.act || 0)}</td>
                                    <td className="p-4 text-right">
                                        <span className={`text-xs font-bold font-mono px-2 py-0.5 rounded-sm ${
                                            (item?.variancePct || 0) > 10 ? 'bg-rose-500/10 text-rose-400' : 
                                            (item?.variancePct || 0) > 0 ? 'bg-gold/10 text-gold' : 'bg-emerald-500/10 text-emerald-400'
                                        }`}>
                                            {(item?.variancePct || 0) > 0 ? '+' : ''}{(item?.variancePct || 0).toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {(item?.variancePct || 0) > 10 ? (
                                            <div className="flex items-center gap-1 text-[9px] text-rose-400 uppercase font-bold animate-pulse">
                                                <AlertTriangle className="w-3 h-3" /> Kiểm tra bếp
                                            </div>
                                        ) : (
                                            <div className="text-[9px] text-emerald-400/50 uppercase font-bold">Ổn định</div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Cards for Analysis */}
                <div className="md:hidden divide-y divide-white/5">
                   {analysisData?.map((item, idx) => (
                      <div key={idx} className="p-5 space-y-4 hover:bg-white/[0.01]">
                         <div className="flex justify-between items-start">
                            <div className="space-y-1">
                               <div className="text-sm font-serif italic text-white leading-tight">{item?.name}</div>
                               <div className="text-[9px] text-gray-600 uppercase tracking-widest">Sản lượng: {item?.qty} cái</div>
                            </div>
                            <span className={`text-[10px] font-mono font-bold px-2 py-1 rounded-sm ${
                                (item?.variancePct || 0) > 10 ? 'bg-rose-500/10 text-rose-400' : 
                                (item?.variancePct || 0) > 0 ? 'bg-gold/10 text-gold' : 'bg-emerald-500/10 text-emerald-400'
                            }`}>
                                {(item?.variancePct || 0).toFixed(1)}%
                            </span>
                         </div>
                         <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 rounded-sm border border-white/5">
                            <div className="space-y-0.5">
                                <div className="text-[8px] text-gray-600 uppercase font-bold">Định mức</div>
                                <div className="text-[11px] text-gray-400 italic">{fmtVND(item?.std || 0)}</div>
                            </div>
                            <div className="space-y-0.5 text-right">
                                <div className="text-[8px] text-gray-100 uppercase font-bold">Thực tế</div>
                                <div className="text-[11px] text-gold italic font-bold">{fmtVND(item?.act || 0)}</div>
                            </div>
                         </div>
                      </div>
                   ))}
                </div>
            </div>

            {/* Visual Variance Chart */}
            <div className="bg-dark-surface border border-white/5 p-8">
                <div className="flex justify-between items-center mb-10">
                    <div>
                        <h3 className="text-xs uppercase tracking-[0.2em] text-white font-bold mb-1">Trực quan hóa sai lệch</h3>
                        <p className="text-[10px] text-gray-500">Mức độ rủi ro chi phí theo sản phẩm</p>
                    </div>
                    <BarChart3 className="w-5 h-5 text-gold/30" />
                </div>
                <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ left: 10, right: 30 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                            <XAxis dataKey="name" stroke="#444" fontSize={9} />
                            <YAxis stroke="#444" fontSize={9} unit="%" />
                            <Tooltip 
                                cursor={{fill: 'rgba(255,255,255,0.02)'}}
                                contentStyle={{ backgroundColor: '#000', border: '1px solid #333', fontSize: '10px' }}
                                formatter={(value: any) => [`${value}%`, 'Sai lệch']}
                            />
                            <Bar dataKey="variancePct" radius={[4, 4, 0, 0]}>
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.variancePct > 10 ? "#f43f5e" : entry.variancePct > 0 ? "#f59e0b" : "#10b981"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        {/* Right: Specific NVL Waste Warnings */}
        <div className="space-y-8 flex flex-col pt-4 md:pt-0">
            <div className="bg-dark-surface border border-white/5 p-6 md:p-8 flex flex-col h-full rounded-sm">
                <div className="flex items-center gap-3 mb-8 md:mb-10">
                    <div className="w-10 h-10 bg-gold/10 border border-gold/20 flex items-center justify-center rounded-sm">
                        <Search className="w-5 h-5 text-gold" />
                    </div>
                    <div>
                        <h3 className="text-[10px] md:text-xs uppercase tracking-[0.2em] text-white font-serif font-bold">Hao hụt NVL</h3>
                        <p className="text-[9px] text-gray-600 uppercase font-sans tracking-widest">Phân tích rủi ro chi phí</p>
                    </div>
                </div>

                <div className="space-y-6 md:space-y-8 flex-1">
                    {analysisData?.filter(a => (a?.topBadMats?.length || 0) > 0).slice(0, 8).map((item, idx) => (
                        <div key={idx} className="space-y-3">
                            <div className="flex justify-between items-end border-b border-white/10 pb-2">
                                <span className="text-[10px] md:text-[11px] font-bold text-gray-500 uppercase italic truncate max-w-[70%]">{item?.name}</span>
                                <span className="text-[9px] font-mono text-rose-500 font-bold whitespace-nowrap">{item?.variancePct.toFixed(1)}% hụt</span>
                            </div>
                            <div className="grid grid-cols-1 gap-2">
                                {item?.topBadMats.map((m: any, midx: number) => (
                                    <div key={midx} className="bg-white/[0.02] border border-white/5 p-2.5 flex justify-between items-center group rounded-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-1 rounded-full bg-rose-900 group-hover:bg-rose-500 shadow-sm" />
                                            <span className="text-[9px] md:text-[10px] text-gray-600 group-hover:text-gray-300 font-medium truncate max-w-[120px]">{m.name}</span>
                                        </div>
                                        <div className="text-rose-500/80 text-[10px] font-mono font-bold">
                                            +{m.avgChenh.toFixed(1)}%
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                    {(!analysisData || analysisData.length === 0) && (
                        <div className="flex flex-col items-center justify-center h-48 opacity-20">
                            <ShieldCheck className="w-10 h-10 mb-2" />
                            <p className="text-[10px] uppercase font-bold tracking-widest text-center">Hệ thống đang kiểm tra...</p>
                        </div>
                    )}
                </div>

                <div className="mt-10 p-4 border border-rose-500/20 bg-rose-500/5 text-[9px] text-rose-200/60 leading-relaxed italic">
                    Lưu ý: Các mức sai lệch trên 3% cần được kiểm soát ngay tại khâu định lượng (Scale) hoặc điều chỉnh lại công thức sản xuất.
                </div>
            </div>
        </div>
      </section>

      {/* AI Strategy Actions */}
      <section className="space-y-8">
        <div className="flex items-center gap-6">
            <h3 className="text-xs uppercase font-serif tracking-[0.4em] text-gold font-bold whitespace-nowrap">Cố vấn Chiến lược Aurelius</h3>
            <div className="h-[1px] flex-1 bg-white/[0.05]" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 px-2 md:px-0">
            {[
                { type: 'full', title: 'Báo cáo Vận hành', desc: 'Phân tích đa chiều về tài chính xưởng.', icon: Activity },
                { type: 'trend', title: 'Hồ sơ Hao hụt', desc: 'Nhấn mạnh điểm mù sử dụng nguyên liệu.', icon: AlertTriangle },
                { type: 'recipe', title: 'Tối ưu Recipe', desc: 'Hiệu chỉnh định mức thực tế tại xưởng.', icon: Zap }
            ].map((btn) => (
                <button 
                    key={btn.type}
                    onClick={() => performAnalysis(btn.type as any)}
                    disabled={loading}
                    className={`group p-6 md:p-10 border text-left transition-all duration-500 rounded-sm ${reportType === btn.type && insight ? 'bg-gold border-gold' : 'bg-dark-surface border-white/5 hover:border-gold/50'}`}
                >
                    <btn.icon className={`w-6 h-6 md:w-8 md:h-8 mb-4 md:mb-6 transition-colors duration-500 ${reportType === btn.type && insight ? 'text-black' : 'text-gold'}`} />
                    <h4 className={`text-base md:text-xl font-serif mb-2 tracking-tight ${reportType === btn.type && insight ? 'text-black' : 'text-white'}`}>{btn.title}</h4>
                    <p className={`text-[10px] md:text-[12px] leading-relaxed mb-6 md:mb-10 font-sans ${reportType === btn.type && insight ? 'text-black/80' : 'text-gray-500'}`}>{btn.desc}</p>
                    <div className={`flex items-center gap-2 text-[8px] md:text-[10px] font-bold uppercase tracking-[0.2em] ${reportType === btn.type && insight ? 'text-black' : 'text-gold'}`}>
                        {loading && reportType === btn.type ? 'ĐANG TÍNH...' : 'PHÂN TÍCH'}
                        <ChevronRight className={`w-3 h-3 md:w-4 md:h-4 transition-transform group-hover:translate-x-1`} />
                    </div>
                </button>
            ))}
        </div>

        {/* AI Insight Result */}
        {insight && (
            <div ref={resultRef} className="bg-dark-surface border border-gold/30 p-6 md:p-12 lg:p-20 relative overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 rounded-sm">
                <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none hidden md:block">
                    <FileText className="w-64 h-64" />
                </div>
                <div className="max-w-4xl mx-auto relative z-10 px-1 md:px-0">
                    <div className="flex items-center gap-4 mb-8 md:mb-12 pb-6 md:pb-8 border-b border-white/10">
                        <div className="w-10 h-10 md:w-12 md:h-12 bg-gold/10 border border-gold/20 flex items-center justify-center rounded-sm">
                            <TrendingUp className="w-5 h-5 md:w-6 md:h-6 text-gold" />
                        </div>
                        <div>
                            <h2 className="text-xl md:text-3xl font-serif text-white">Kết Luận Chuyên Gia</h2>
                            <p className="text-[9px] text-gray-500 uppercase tracking-widest mt-1 md:mt-2">{reportType === 'full' ? 'Vận hành' : reportType === 'trend' ? 'Rủi ro' : 'Tối ưu R&D'}</p>
                        </div>
                    </div>
                    <div className="markdown-body prose prose-invert prose-gold prose-xs md:prose-sm max-w-none font-sans leading-relaxed">
                        <Markdown>{insight}</Markdown>
                    </div>
                    <div className="mt-12 md:mt-20 pt-6 md:pt-10 border-t border-white/5 flex flex-col md:flex-row justify-between items-center gap-4 text-[8px] md:text-[9px] text-gray-600 uppercase tracking-[0.2em] font-bold text-center md:text-left">
                        <span>AI Ver 5.0</span>
                        <span className="hidden md:inline">REF-{Math.random().toString(36).substring(7).toUpperCase()}</span>
                        <span>{new Date().toLocaleString('vi-VN')}</span>
                    </div>
                </div>
            </div>
        )}
      </section>
    </div>
  );
}


