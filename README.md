# Bakery Management System (Aurelius OS)

Ứng dụng quản lý sản xuất và phân tích chiến lược AI dành cho tiệm bánh chuyên nghiệp.

## 🚀 Hướng dẫn chạy ứng dụng

### 1. Chạy trên máy cá nhân (Local)
Sau khi tải mã nguồn về hoặc clone từ GitHub:

1. Mở terminal tại thư mục dự án.
2. Cài đặt thư viện:
   ```bash
   npm install
   ```
3. Cài đặt biến môi trường:
   Tạo file `.env` tại thư mục gốc và thêm mã API Gemini của bạn:
   ```env
   GEMINI_API_KEY=your_api_key_here
   ```
4. Chạy ứng dụng:
   ```bash
   npm run dev
   ```
5. Mở trình duyệt tại: `http://localhost:3000`

### 2. Triển khai (Deployment)
**LƯU Ý QUAN TRỌNG:** Ứng dụng này có phần Backend (Node.js) để xử lý AI.
- **GitHub Pages:** KHÔNG hỗ trợ Backend, nên AI sẽ không hoạt động nếu bạn chỉ dùng GitHub Pages.
- **Khuyến nghị:** Sử dụng **Google Cloud Run**, **Vercel** (với Serverless Functions), hoặc **Render** để triển khai bản build.

## 🛠 Công nghệ sử dụng
- **Frontend:** React, Tailwind CSS, Vite.
- **Backend:** Node.js (Express).
- **AI:** Google Gemini AI (Cố vấn chiến lược Aurelius).
- **Visualization:** Recharts (Biểu đồ sản xuất).

## 📝 Lưu ý về lỗi 403 / Màn hình trắng
- Nếu bạn thấy màn hình trắng trên GitHub, hãy mở Console (F12) để kiểm tra. Đảm bảo đường dẫn `base` trong `vite.config.ts` khớp với cấp độ thư mục của bạn.
- Lỗi 403 khi chia sẻ link Preview là do cơ chế bảo mật của AI Studio. Hãy sử dụng tính năng **Deployment** chính thức để có link công khai.
