export async function fetchAiInsights(data: any, type: 'full' | 'trend' | 'recipe') {
  const response = await fetch("/api/ai/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data, type }),
  });

  const dataRes = await response.json();
  
  if (!response.ok) {
    throw new Error(dataRes.error || "Failed to fetch AI insights");
  }

  return dataRes.result;
}
