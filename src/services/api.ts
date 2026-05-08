import { getProductionInsights } from "./aiService";

export async function fetchAiInsights(data: any, type: 'full' | 'trend' | 'recipe') {
  return await getProductionInsights(data, type);
}
