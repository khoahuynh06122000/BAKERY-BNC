import { GoogleGenAI } from "@google/genai";

export async function getProductionInsights(data: any, type: 'full' | 'trend' | 'recipe') {
  if (!process.env.GEMINI_API_KEY) {
    return "Lỗi: GEMINI_API_KEY chưa được cấu hình trên máy chủ.";
  }

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const prompts = {
    full: `Bạn là một chuyên gia phân tích dữ liệu và tư vấn chiến lược vận hành doanh nghiệp F&B lừng danh. 
      Dưới đây là dữ liệu thô từ hệ thống sản xuất. Hãy viết một bản báo cáo CHIẾN LƯỢC:
      1. ĐÁNH GIÁ TỔNG QUAN: Nhận định về sức khỏe tài chính xưởng sản xuất.
      2. CẢNH BÁO TRỌNG ĐIỂM: Chỉ ra 2-3 sản phẩm đang có sai lệch giá thành thực tế so với định mức (cost recipe) cao nhất.
      3. HÀNH ĐỘNG CỤ THỂ: Đề xuất các bước thực tế để cắt giảm lãng phí ngay lập tức.
      Sử dụng Markdown chuyên nghiệp với các Heading, Table, Bold text. Hãy dùng giọng văn sắc sảo, chuyên gia.
      Dữ liệu: ${JSON.stringify(data)}`,
    trend: `Bạn là một chuyên gia kiểm soát hao hụt (Loss Prevention Expert). Phân tích sâu về HAO HỤT NGUYÊN VẬT LIỆU:
      - Liệt kê các loại Nguyên Vật Liệu thường xuyên bị hao hụt vượt mức 10%.
      - Phân tích nguyên nhân có thể (do kỹ thuật bếp, do cân đo, hay do định mức sai).
      - Thiết lập "Hàng rào kiểm soát": Các bước cần thay đổi trong quy trình cân chia NVL.
      - Dự báo rủi ro lợi nhuận nếu không xử lý kịp thời.
      Trình bày cực kỳ trực quan với các danh sách súc tích và bảng biểu rủi ro.
      Dữ liệu: ${JSON.stringify(data)}`,
    recipe: `Bạn là Kỹ sư trưởng R&D ngành bánh. Hãy tư vấn hiệu chỉnh CÔNG THỨC & ĐỊNH MỨC:
      - Đề xuất thay đổi định mức (Me/Standard Qty) cho các mã bánh có sai lệch dương (+) liên tục.
      - Phân tích tính khả thi của việc thay thế nguyên liệu hoặc thay đổi quy trình nướng/chế biến để giảm cost.
      - Lập bảng so sánh "Trước & Sau" khi tối ưu hóa công thức.
      Giọng văn kỹ thuật, thực tế và có chiều sâu về công nghệ thực phẩm.
      Dữ liệu: ${JSON.stringify(data)}`
  };

  try {
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompts[type]
    });
    return result.text;
  } catch (error) {
    console.error("Gemini AI Error:", error);
    if (error instanceof Error && error.message.includes("quota")) {
      return "Hệ thống đã hết lượt phân tích miễn phí trong hôm nay. Vui lòng thử lại vào ngày mai.";
    }
    return "Hệ thống chuyên gia đang bận xử lý dữ liệu khác hoặc gặp sự cố kết nối. Vui lòng thử lại sau vài giây.";
  }
}
