export const uid = () => Math.random().toString(36).slice(2, 9);

export const today = () => new Date().toISOString().split("T")[0];

export const fmtVND = (n: number) => 
  new Intl.NumberFormat("vi-VN").format(Math.round(n || 0)) + "đ";

export const fmtNum = (n: number, d = 3) => 
  parseFloat((n || 0).toString()).toFixed(d);

export const pct = (a: number, b: number) => 
  b > 0 ? ((a - b) / b * 100).toFixed(1) : "0.0";

export const similarity = (s1: string, s2: string) => {
  let longer = s1.toLowerCase();
  let shorter = s2.toLowerCase();
  if (s1.length < s2.length) {
    longer = s2.toLowerCase();
    shorter = s1.toLowerCase();
  }
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  return (longerLength - editDistance(longer, shorter)) / longerLength;
};

function editDistance(s1: string, s2: string) {
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0) costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}
