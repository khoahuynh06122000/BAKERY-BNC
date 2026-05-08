import { useState } from "react";
import { DollarSign, Download, Upload, Search, Trash2, Edit3, Plus } from "lucide-react";
import * as XLSX from "xlsx";
import { NVL, MaterialUsage, MaterialConversion } from "../types";
import { uid, fmtVND, fmtNum } from "../lib/utils";

interface Props {
  nvl: NVL[];
  onBulkSaveNvl: (nvl: NVL[]) => Promise<void>;
  usage: MaterialUsage[];
  onSaveUsage: (item: MaterialUsage) => Promise<void>;
  onDeleteUsage: (id: string) => Promise<void>;
  onBulkSaveUsage: (data: MaterialUsage[]) => Promise<void>;
  conversions: MaterialConversion[];
  currentXuong: string;
  hasAdminPrivileges: boolean;
}

export default function NVLUsageTab({ nvl, onBulkSaveNvl, usage, onSaveUsage, onDeleteUsage, onBulkSaveUsage, conversions, currentXuong, hasAdminPrivileges }: Props) {
  const [form, setForm] = useState<Partial<MaterialUsage>>({ 
    nvlId: "", 
    soLuong: 0, 
    gia: 0, 
    thanhTien: 0 
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUsage = usage.filter(u => u.xuong === currentXuong && (u.ten || "").toLowerCase().includes(searchTerm.toLowerCase()));
  const totalCost = filteredUsage.reduce((acc, u) => acc + u.thanhTien, 0);

  const handleSave = () => {
    if (!form.nvlId) return;
    const n = nvl.find(item => item.id === form.nvlId);
    if (!n) return;

    const qty = form.soLuong || 0;
    const amount = form.thanhTien || 0;
    const price = qty > 0 ? amount / qty : 0;

    const data: MaterialUsage = {
      id: editId || uid(),
      nvlId: form.nvlId,
      ten: n.ten,
      donVi: n.donVi,
      soLuong: qty,
      gia: price,
      thanhTien: amount,
      xuong: currentXuong
    };

    if (editId) {
      onSaveUsage(data);
      setEditId(null);
    } else {
      onSaveUsage(data);
    }
    setForm({ nvlId: "", soLuong: 0, gia: 0, thanhTien: 0 });
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
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      const newUsage: MaterialUsage[] = [];
      const addedNvl: NVL[] = [];
      const updatedNvlList = [...nvl];

      data.slice(1).forEach(row => {
        const tenNvl = String(row[0] || "").trim();
        const donVi = String(row[1] || "").trim();
        
        // Dynamic index detection
        // If 3 columns: Name, Unit, Amount
        // If 4 columns: Name, Unit, Qty, Amount
        let sl = 0;
        let tt = 0;
        if (row.length === 3) {
           tt = parseFloat(String(row[2] || "0")) || 0;
           sl = 1; // Default to 1 if not provided
        } else if (row.length >= 4) {
           sl = parseFloat(String(row[2] || "0")) || 0;
           tt = parseFloat(String(row[3] || "0")) || 0;
        }

        if (tenNvl && tt >= 0) {
          // 1. Tìm khớp trực tiếp theo tên
          let match = updatedNvlList.find(n => n.ten.toLowerCase().trim() === tenNvl.toLowerCase());
          let ratio = 1;

          // 2. Nếu không khớp trực tiếp, tìm trong bảng quy đổi
          if (!match) {
            const conv = conversions.find(c => c.sourceTen.toLowerCase().trim() === tenNvl.toLowerCase());
            if (conv) {
              match = updatedNvlList.find(n => n.id === conv.targetNvlId);
              ratio = conv.ratio;
            }
          }
          
          // 3. Nếu vẫn không thấy, tạo NVL mới (fallback)
          if (!match) {
            const newN = {
              id: uid(),
              ten: tenNvl,
              donVi: donVi || "kg",
              gia: 0,
              xuong: currentXuong
            };
            addedNvl.push(newN);
            updatedNvlList.push(newN);
            match = newN;
          }

          const actualQty = sl * ratio;

          newUsage.push({
            id: uid(),
            nvlId: match.id,
            ten: match.ten,
            donVi: match.donVi,
            soLuong: actualQty,
            gia: actualQty > 0 ? tt/actualQty : 0,
            thanhTien: tt,
            xuong: currentXuong
          });
        }
      });

      if (addedNvl.length > 0) {
        onBulkSaveNvl(updatedNvlList);
      }
      
      const otherUsage = usage.filter(u => u.xuong !== currentXuong);
      onBulkSaveUsage([...otherUsage, ...newUsage]);
    };
    reader.readAsBinaryString(file);
  };

  const downloadTemplate = () => {
    const data = [
      ["Tên Nguyên Vật Liệu", "Đơn Vị", "Số Lượng (Nếu có)", "Thành Tiền"],
      ["Bơ lạt Anchor", "kg", 1, 1800000],
      ["Bột mì số 11", "kg", 1, 1250000]
    ];
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template");
    XLSX.writeFile(wb, "Template_NVL_Usage.xlsx");
  };

  return (
    <div className="space-y-8 md:space-y-12 pb-24 md:pb-0">
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pt-4 px-1 md:px-0">
        <div className="space-y-3 md:space-y-4">
          <div className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] md:tracking-[0.3em] text-gold font-semibold italic">Kế toán giá thành</div>
          <h2 className="text-3xl md:text-5xl font-serif text-white">NVL sử dụng</h2>
          <p className="text-xs md:text-sm text-gray-400 max-w-sm leading-relaxed font-light">
            Nhập thực tế nguyên vật liệu đã xuất để phân tích chính xác.
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-4 items-stretch md:items-end w-full md:w-auto">
          <div className="bg-dark-surface border border-white/5 p-4 md:p-6 md:px-8 text-center md:text-right md:mr-4 rounded-sm">
            <div className="text-[8px] md:text-[9px] uppercase tracking-widest text-gray-500 font-bold mb-1">Tổng chi phí kỳ này</div>
            <div className="text-xl md:text-2xl font-serif text-gold">{fmtVND(totalCost)}</div>
          </div>
          <div className="grid grid-cols-2 md:flex gap-3">
            <button onClick={downloadTemplate} className="flex items-center justify-center gap-2 px-4 md:px-6 py-3.5 md:py-3 border border-white/10 text-[9px] md:text-[10px] uppercase tracking-widest text-gray-400 hover:text-gold hover:border-gold transition-all rounded-sm italic">
              <Download className="w-3 h-3" /> Mẫu
            </button>
            <label className="flex items-center justify-center gap-2 px-4 md:px-6 py-3.5 md:py-3 bg-white/5 border border-white/10 text-[9px] md:text-[10px] uppercase tracking-widest text-white hover:bg-white/10 transition-all cursor-pointer rounded-sm italic">
              <Upload className="w-3 h-3" /> Import
              <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleFileUpload} />
            </label>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
        <div className="lg:col-span-4 space-y-6 md:space-y-8 bg-dark-surface border border-white/5 p-6 md:p-10 rounded-sm">
          <div className="flex items-center gap-3 text-gold">
            <Plus className="w-5 h-5" />
            <span className="text-[10px] md:text-[11px] uppercase tracking-[0.2em] font-bold">{editId ? "Cập nhật sử dụng" : "Thêm mới sử dụng"}</span>
          </div>

          <div className="space-y-5 md:space-y-6">
            <div className="space-y-2">
              <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Chọn Nguyên vật liệu</label>
              <select 
                value={form.nvlId}
                onChange={e => setForm({...form, nvlId: e.target.value})}
                className="w-full bg-black/40 md:bg-black border border-white/10 p-3.5 md:p-4 text-sm text-white focus:border-gold outline-none font-serif italic rounded-sm"
              >
                <option value="">Chọn NVL...</option>
                {nvl.filter(n => n.xuong === currentXuong).map(n => (
                  <option key={n.id} value={n.id} className="bg-black">{n.ten} ({n.donVi})</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-2">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Số lượng</label>
                <input 
                  type="number" 
                  value={form.soLuong}
                  onChange={e => {
                    const sl = parseFloat(e.target.value) || 0;
                    setForm({...form, soLuong: sl});
                  }}
                  className="w-full bg-black/40 md:bg-black border border-white/10 p-3.5 md:p-4 text-sm text-white font-serif focus:border-gold outline-none rounded-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[9px] md:text-[10px] uppercase tracking-widest text-gray-500 font-bold ml-1">Thành tiền (VND)</label>
                <input 
                  type="number" 
                  value={form.thanhTien}
                  onChange={e => {
                    const tt = parseFloat(e.target.value) || 0;
                    setForm({...form, thanhTien: tt});
                  }}
                  className="w-full bg-black/40 md:bg-black border border-white/10 p-3.5 md:p-4 text-sm text-gold font-serif focus:border-gold outline-none rounded-sm"
                />
              </div>
            </div>
            {form.nvlId && (form.soLuong || 0) > 0 && (
              <div className="text-[9px] text-gray-600 italic px-1">
                Đơn giá tính toán: <span className="text-white font-serif">{fmtVND((form.thanhTien || 0) / (form.soLuong || 1))}</span>
              </div>
            )}
            <button 
              onClick={handleSave}
              className="w-full py-4.5 bg-white text-black text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] hover:bg-gold transition-all shadow-xl rounded-sm"
            >
              {editId ? "Lưu thay đổi" : "Xác nhận nạp chi phí"}
            </button>
            {editId && (
              <button onClick={() => {setEditId(null); setForm({nvlId:"", soLuong:0, gia:0, thanhTien:0})}} className="w-full py-2 text-[9px] uppercase tracking-widest text-gray-600 hover:text-white">Hủy chỉnh sửa</button>
            )}
          </div>
        </div>

        <div className="lg:col-span-8 space-y-6">
          <div className="relative group mx-1 md:mx-0">
            <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-gold transition-colors" />
            <input 
              type="text" 
              placeholder="TÌM KIẾM DỮ LIỆU..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 py-5 pl-16 pr-8 text-sm text-white focus:border-gold outline-none transition-all font-light italic font-serif rounded-sm"
            />
          </div>
          
          <div className="overflow-hidden border border-white/5 bg-dark-surface/50 rounded-sm">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/5 bg-white/[0.02]">
                    <th className="px-8 py-6 text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Nguyên vật liệu</th>
                    <th className="px-8 py-6 text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold text-center">Số lượng</th>
                    <th className="px-8 py-6 text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold">Đơn giá</th>
                    <th className="px-8 py-6 text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold text-right">Thành tiền</th>
                    <th className="px-8 py-6 text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold text-right"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsage.map((item) => (
                    <RenderUsageRow key={item.id} item={item} onEdit={() => {setEditId(item.id); setForm(item);}} onDelete={() => onDeleteUsage(item.id)} hasAdmin={hasAdminPrivileges} isMobile={false} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-white/5">
                {filteredUsage.map((item) => (
                    <RenderUsageRow key={item.id} item={item} onEdit={() => {setEditId(item.id); setForm(item);}} onDelete={() => onDeleteUsage(item.id)} hasAdmin={hasAdminPrivileges} isMobile={true} />
                ))}
            </div>

            {filteredUsage.length === 0 && (
              <div className="py-20 text-center text-gray-600 italic font-light tracking-widest text-sm uppercase">Chưa có dữ liệu xuất kho</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RenderUsageRow({ item, onEdit, onDelete, hasAdmin, isMobile }: any) {
  if (isMobile) {
    return (
      <div className="p-4 space-y-4">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="text-white font-medium text-base font-serif italic">{item.ten}</div>
            <div className="text-[10px] text-gray-600 uppercase tracking-widest">ĐVT: {item.donVi}</div>
          </div>
          <div className="flex gap-4">
             <button onClick={onEdit} className="p-2 text-gray-600 hover:text-gold transition-colors"><Edit3 className="w-4 h-4" /></button>
             {hasAdmin && (
              <button onClick={onDelete} className="p-2 text-gray-600 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
             )}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 bg-black/20 p-3 border border-white/5 rounded-sm">
           <div className="space-y-1">
              <div className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Số lượng</div>
              <div className="text-xs text-white font-serif">{fmtNum(item.soLuong)} {item.donVi}</div>
           </div>
           <div className="space-y-1 text-right">
              <div className="text-[8px] text-gray-600 uppercase font-bold tracking-widest">Thành tiền</div>
              <div className="text-sm text-gold font-serif">{fmtVND(item.thanhTien)}</div>
           </div>
        </div>
        <div className="text-[9px] text-gray-700 italic text-right italic px-1">
           Giá trung bình: {fmtVND(item.gia)}
        </div>
      </div>
    );
  }

  return (
    <tr className="group hover:bg-white/[0.03] transition-colors border-b border-white/5">
      <td className="px-8 py-8">
        <div className="text-white font-medium text-lg mb-1 font-serif italic">{item.ten}</div>
        <div className="text-[10px] text-gray-500 uppercase tracking-widest">{item.donVi}</div>
      </td>
      <td className="px-8 py-8 font-serif text-white text-center italic">{fmtNum(item.soLuong)}</td>
      <td className="px-8 py-8 font-serif text-gray-400 text-sm">{fmtVND(item.gia)}</td>
      <td className="px-8 py-8 text-right font-serif text-xl text-gold">{fmtVND(item.thanhTien)}</td>
      <td className="px-8 py-8 text-right">
        <div className="flex justify-end gap-4 opacity-0 group-hover:opacity-100 transition-all">
          <button onClick={onEdit} className="text-gray-500 hover:text-gold"><Edit3 className="w-4 h-4" /></button>
          {hasAdmin && (
            <button onClick={onDelete} className="text-gray-500 hover:text-rose-400"><Trash2 className="w-4 h-4" /></button>
          )}
        </div>
      </td>
    </tr>
  );
}
