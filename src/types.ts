export interface NVL {
  id: string;
  ten: string;
  donVi: string;
  gia: number; // Unit price (default/standard)
  soLuong?: number;
  thanhTien?: number;
  xuong: string;
  loai?: 'chính' | 'phụ';
}

export interface MaterialUsage {
  id: string;
  nvlId: string;
  ten: string;
  donVi: string;
  soLuong: number;
  gia: number;
  thanhTien: number;
  xuong: string;
}

export interface RecipeItem {
  nvlId: string;
  soLuong: number;
}

export interface Recipe {
  id: string;
  tenBanh: string;
  soLuongChuan: number;
  costDinhMucMe: number;
  nvl: RecipeItem[];
  xuong: string;
}

export interface LogItem {
  nvlId: string;
  dinhMuc: number;
  thucTe: number;
  chenh: number;
  chenhPct: number;
}

export interface ProductionLog {
  id: string;
  ngay: string;
  xuong: string;
  recipeId: string;
  soLuongSanXuat: number;
  items: LogItem[];
  giaThanh: number;
  thoiGian: string;
}

export interface Overhead {
  id: string;
  ngay: string;
  xuong: string;
  chiPhiPhu: number;
}

export interface LoginLog {
  id: string;
  email: string;
  displayName: string;
  timestamp: string;
}

export interface MaterialConversion {
  id: string;
  sourceTen: string; // Tên trong Recipe
  targetNvlId: string; // ID NVL gốc trong kho
  ratio: number; // 1 source = ratio * target
  xuong: string;
}
