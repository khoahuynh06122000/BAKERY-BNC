import React, { useState } from 'react';
import { Trash2, Plus, Download, Upload, Search, HelpCircle } from 'lucide-react';
import { NVL, MaterialConversion } from '../types';
import * as XLSX from 'xlsx';

interface Props {
  nvl: NVL[];
  conversions: MaterialConversion[];
  onSaveConversion: (item: MaterialConversion) => Promise<void>;
  onDeleteConversion: (id: string) => Promise<void>;
  onBulkSaveConversions: (data: MaterialConversion[]) => Promise<void>;
  currentXuong: string;
  hasAdminPrivileges: boolean;
}

export default function ConversionTab({ nvl, conversions, onSaveConversion, onDeleteConversion, onBulkSaveConversions, currentXuong, hasAdminPrivileges }: Props) {
  const [form, setForm] = useState<Partial<MaterialConversion>>({ sourceTen: "", targetNvlId: "", ratio: 1 });
  const [searchTerm, setSearchTerm] = useState("");

  const uid = () => Math.random().toString(36).substring(2, 9);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.sourceTen || !form.targetNvlId || !form.ratio) return;

    const newConv: MaterialConversion = {
      id: uid(),
      sourceTen: form.sourceTen.trim(),
      targetNvlId: form.targetNvlId,
      ratio: Number(form.ratio),
      xuong: currentXuong
    };

    onSaveConversion(newConv);
    setForm({ sourceTen: "", targetNvlId: "", ratio: 1 });
  };

  const deleteConv = (id: string) => {
    if (!hasAdminPrivileges) return;
    onDeleteConversion(id);
  };

  const filtered = conversions.filter(c => 
    c.sourceTen.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Tên NVL trong Recipe", "Tên NVL gốc (Gần đúng/Chính xác)", "Tỷ lệ quy đổi (1 Recipe = X Gốc)"],
      ["Bột mì số 11 (Recipe)", "Bột mì Meizan", 1],
      ["Nhân đậu xanh (Recipe)", "Đậu xanh hạt", 0.5]
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Conversion_Template");
    XLSX.writeFile(wb, `Template_Quy_Doi_${currentXuong}.xlsx`);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      const newConvs: MaterialConversion[] = [];
      data.forEach((row, idx) => {
        if (idx === 0) return;
        const sourceTen = String(row[0] || "").trim();
        const targetTenRaw = String(row[1] || "").trim();
        const ratio = parseFloat(String(row[2] || "1")) || 1;

        if (sourceTen && targetTenRaw) {
          // Find closest NVL
          const targetNvl = nvl.find(n => n.ten.toLowerCase().includes(targetTenRaw.toLowerCase()));
          if (targetNvl) {
            newConvs.push({
              id: uid(),
              sourceTen,
              targetNvlId: targetNvl.id,
              ratio,
              xuong: currentXuong
            });
          }
        }
      });

      if (newConvs.length > 0) {
        onBulkSaveConversions([...conversions, ...newConvs]);
        alert(`Đã nạp thêm ${newConvs.length} quy định quy đổi.`);
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-6 border-b border-white/5 pt-4">
        <div>
          <h2 className="text-xl md:text-2xl font-light tracking-[0.2em] text-white flex items-center gap-3">
            QUY ĐỔI NGUYÊN VẬT LIỆU
            <div className="group relative">
              <HelpCircle className="w-4 h-4 text-gray-500 cursor-help" />
              <div className="absolute left-0 top-6 w-72 md:w-80 p-4 bg-dark-surface border border-white/10 rounded-lg shadow-2xl opacity-0 group-hover:opacity-100 transition-all pointer-events-none z-50 text-[10px] md:text-[11px] leading-relaxed text-gray-400 font-normal normal-case tracking-normal">
                Dùng để ánh xạ tên NVL trong Recipe sang NVL thực tế trong kho.<br/><br/>
                Ví dụ: Recipe ghi "Đỗ xanh chín", quy đổi sang NVL gốc là "Đỗ xanh hạt" với tỷ lệ 0.5 (1kg đỗ chín cần 0.5kg đỗ hạt).
              </div>
            </div>
          </h2>
          <p className="text-gray-500 text-[9px] md:text-[10px] mt-2 tracking-[0.1em] font-medium leading-relaxed">
            ÁNH XẠ TÊN GỌI TRONG CÔNG THỨC SANG DỮ LIỆU GIÁ THÀNH THỰC TẾ
          </p>
        </div>
        <div className="flex gap-3 md:gap-4 w-full md:w-auto">
          <button 
            onClick={downloadTemplate}
            className="flex-1 md:flex-none px-4 md:px-6 py-3 border border-white/10 text-gray-400 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold hover:text-white transition-all flex items-center justify-center gap-2 rounded-sm"
          >
            <Download className="w-3 h-3" /> Mẫu
          </button>
          <label className="flex-1 md:flex-none px-4 md:px-6 py-3 bg-white/5 text-gray-300 text-[9px] md:text-[10px] uppercase tracking-[0.2em] font-bold hover:bg-white/10 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/5 rounded-sm">
            <Upload className="w-3 h-3" /> Nạp Excel
            <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 md:gap-12">
        <div className="lg:col-span-1 lg:border-r border-white/5 lg:pr-12 lg:order-1 order-2">
          <form onSubmit={handleSubmit} className="space-y-6 md:space-y-8 sticky top-32 bg-dark-surface/50 p-6 md:p-0 rounded-sm border border-white/5 md:border-none">
            <div className="text-[10px] uppercase tracking-[0.2em] text-gold font-bold italic mb-2 md:hidden">Thêm quy định mới</div>
            <div className="space-y-2">
              <label className="block text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold ml-1">Tên NVL trong Recipe</label>
              <input
                required
                value={form.sourceTen}
                onChange={e => setForm({...form, sourceTen: e.target.value})}
                placeholder="VD: Đỗ xanh chín"
                className="w-full bg-black/40 md:bg-transparent border-b border-white/10 py-3.5 px-3 md:px-0 text-white focus:border-gold outline-none transition-all placeholder:text-white/10 text-sm font-light italic font-serif"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold ml-1">Ánh xạ sang NVL gốc (Kho)</label>
              <select
                required
                value={form.targetNvlId}
                onChange={e => setForm({...form, targetNvlId: e.target.value})}
                className="w-full bg-black/40 md:bg-dark-surface border border-white/10 py-3.5 px-4 text-white focus:border-gold outline-none transition-all text-sm font-light cursor-pointer"
              >
                <option value="">-- Chọn NVL gốc --</option>
                {nvl.map(n => (
                  <option key={n.id} value={n.id} className="bg-black">{n.ten} ({n.donVi})</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="block text-[9px] md:text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold ml-1">Tỷ lệ quy đổi (1 Recipe = X Gốc)</label>
              <input
                type="number"
                step="0.001"
                required
                value={form.ratio}
                onChange={e => setForm({...form, ratio: parseFloat(e.target.value)})}
                className="w-full bg-black/40 md:bg-transparent border-b border-white/10 py-3.5 px-3 md:px-0 text-white focus:border-gold outline-none transition-all text-sm font-light"
              />
            </div>
            <button
              type="submit"
              className="w-full py-4.5 bg-white text-black text-[10px] uppercase tracking-[0.3em] font-black hover:bg-gold transition-all shadow-2xl rounded-sm mt-4"
            >
              Xác nhận quy đổi
            </button>
          </form>
        </div>

        <div className="lg:col-span-2 lg:order-2 order-1 space-y-6">
          <div className="relative group border-b border-white/5 pb-1">
            <Search className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-gold transition-colors" />
            <input
              placeholder="TÌM KIẾM QUY ĐỔI..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-transparent py-4 pl-10 text-xs md:text-sm tracking-[0.2em] text-white focus:outline-none transition-all font-light italic font-serif"
            />
          </div>

          <div className="overflow-x-auto min-w-0">
             {/* Desktop Table */}
            <table className="hidden md:table w-full">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-4 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Recipe Name</th>
                  <th className="text-left py-4 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Target Material</th>
                  <th className="text-right py-4 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Ratio</th>
                  <th className="text-right py-4 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Calculated Price</th>
                  <th className="text-right py-4 text-[10px] uppercase tracking-[0.2em] text-gray-500 font-bold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filtered.map(item => {
                  const target = nvl.find(n => n.id === item.targetNvlId);
                  const calculatedPrice = (target?.gia || 0) * item.ratio;
                  return (
                    <tr key={item.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-8">
                        <span className="text-white font-medium text-sm tracking-wide italic font-serif">{item.sourceTen}</span>
                      </td>
                      <td className="py-8">
                        <span className="text-gold text-sm tracking-wide font-medium">{target?.ten || "???"}</span>
                        <span className="text-gray-600 text-[10px] block mt-1 tracking-widest uppercase">({target?.donVi || "--"})</span>
                      </td>
                      <td className="py-8 text-right font-mono text-gray-400 text-sm">
                        x {item.ratio}
                      </td>
                      <td className="py-8 text-right">
                        <div className="text-emerald-400 font-serif text-sm italic">{new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(calculatedPrice)}</div>
                        <div className="text-[8px] text-gray-600 uppercase tracking-tighter">Giá áp dụng</div>
                      </td>
                      <td className="py-8 text-right">
                        {hasAdminPrivileges && (
                          <button 
                            onClick={() => deleteConv(item.id)}
                            className="p-2 text-gray-600 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile List View */}
            <div className="md:hidden space-y-3">
               {filtered.map(item => {
                  const target = nvl.find(n => n.id === item.targetNvlId);
                  return (
                    <div key={item.id} className="bg-dark-surface border border-white/5 p-4 rounded-sm space-y-4">
                       <div className="flex justify-between items-start">
                          <div className="space-y-1">
                             <div className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Tên trong Recipe</div>
                             <div className="text-sm text-white font-serif italic">{item.sourceTen}</div>
                          </div>
                          {hasAdminPrivileges && (
                            <button onClick={() => deleteConv(item.id)} className="text-gray-700 hover:text-rose-500 p-1">
                               <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                       </div>
                       <div className="grid grid-cols-2 gap-4 pt-1">
                          <div className="space-y-1">
                             <div className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">NVL Gốc (Kho)</div>
                             <div className="text-xs text-gold font-medium">{target?.ten || "???"} <span className="text-[8px] text-gray-700">({target?.donVi})</span></div>
                          </div>
                          <div className="space-y-1 text-right">
                             <div className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Tỷ lệ (x)</div>
                             <div className="text-xs text-white font-mono">{item.ratio}</div>
                          </div>
                       </div>
                    </div>
                  );
               })}
            </div>

            {filtered.length === 0 && (
              <div className="py-16 md:py-20 text-center text-gray-600 text-[10px] uppercase tracking-[0.2em] font-medium italic">
                CHƯA CÓ QUY ĐỊNH QUY ĐỔI NÀO
              </div>
            )}
          </div>
        </div>
      </div>
    </div>

  );
}
