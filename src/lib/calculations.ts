import { NVL, MaterialConversion, Recipe } from "../types";

export function getMaterialPrice(
  nvlId: string, 
  allNvl: NVL[], 
  conversions: MaterialConversion[]
): number {
  const nvlMap = new Map(allNvl.map(n => [n.id, n]));
  const targetNvl = nvlMap.get(nvlId);
  if (!targetNvl) return 0;

  const conv = conversions.find(c => c.sourceTen.trim().toLowerCase() === targetNvl.ten.trim().toLowerCase());
  
  if (conv) {
    const sourceNvl = nvlMap.get(conv.targetNvlId);
    return (sourceNvl?.gia || 0) * conv.ratio;
  }

  return targetNvl.gia;
}

export function calculateRecipeCurrentCost(
  recipe: Recipe, 
  allNvl: NVL[], 
  conversions: MaterialConversion[]
): number {
  const nvlMap = new Map(allNvl.map(n => [n.id, n]));
  
  return recipe.nvl.reduce((sum, item) => {
    const targetNvl = nvlMap.get(item.nvlId);
    if (!targetNvl) return sum;
    
    let price = targetNvl.gia;
    const conv = conversions.find(c => c.sourceTen.trim().toLowerCase() === targetNvl.ten.trim().toLowerCase());
    if (conv) {
      const sourceNvlFromConv = nvlMap.get(conv.targetNvlId);
      price = (sourceNvlFromConv?.gia || 0) * conv.ratio;
    }
    
    return sum + (price * item.soLuong);
  }, 0);
}
