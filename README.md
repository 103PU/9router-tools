# 9Router Tools — local Config Management App

Ứng dụng quản trị và gộp (merge) cấu hình tài khoản, proxy cho hệ thống **9Router** chạy trên môi trường máy cục bộ (Local). Được thiết kế theo phong cách **Dark Glassmorphism** hiện đại, bảo đảm tính bảo mật cao (chỉ bind localhost) và hoàn toàn không sử dụng thư viện bên thứ ba (Zero-dependency, Zero-emoji).

---

## 🚀 Tính Năng Nổi Bật

1. **Quản Lý Cấu Hình Đa Profile:**
   - Hỗ trợ tạo không giới hạn profile cấu hình (Account Config, Proxy Config,...).
   - Sidebar thiết kế 3 tầng thông tin hiển thị rõ: Số bản sao lưu, ngày ghi đè gần nhất, tình trạng file (Healthy / Broken), và ghi chú chi tiết.

2. **Hợp Nhất Thông Minh & Cộng Dồn (Diff & Merge Engine):**
   - Kéo thả file JSON tài khoản để tính toán gộp cấu hình thời gian thực.
   - **Tương tác trực quan:** Cho phép bật/tắt (Check/Uncheck) để loại trừ các dòng kết nối không muốn ghi đè lên file gốc.
   - **Xem chi tiết Diff:** So sánh trực tiếp cấu hình cũ (Base) và cấu hình mới (Imported) dạng JSON chuẩn trước khi tiến hành ghi đè.
   - **Nạp thêm từ file (Append):** Cho phép nạp thêm tài khoản từ nhiều nguồn khác nhau cộng dồn vào hàng đợi hiện tại thay vì ghi đè xoá sạch hàng đợi cũ.

3. **Bản Sao Lưu (Backup) & Lịch Sử Hoạt Động:**
   - Tự động tạo bản sao lưu cấu hình nguyên bản trước mỗi lần ghi đè (Atomic Write).
   - Tự động dọn dẹp các bản sao lưu cũ vượt quá giới hạn cấu hình (Retention Limit) của hệ thống.
   - Xem lịch sử hoạt động chi tiết (Audit logs) và khôi phục (Restore) bất kỳ bản sao lưu nào chỉ với 1 click.

4. **Đóng Gói Profile Bundle (.9rtbundle):**
   - Đóng gói toàn bộ thông tin profile, ghi chú, lịch sử và **tất cả file sao lưu** thành một tệp tin duy nhất `.9rtbundle` để di chuyển nhanh sang máy tính khác.
   - Cơ chế **Path Healing** tự động nhắc sửa đường dẫn cấu hình gốc nếu file không tồn tại trên máy mới sau khi nhập.

5. **Chọn File Phía Máy Chủ (Windows File Dialog Bypass):**
   - Tích hợp nút **"Chọn tệp..."** sử dụng PowerShell để mở hộp thoại Windows OpenFileDialog thật trên Desktop của bạn, giúp bạn lấy đường dẫn tuyệt đối của file cấu hình cực kỳ dễ dàng.

6. **Phím Tắt Bàn Phím Tiện Lợi:**
   - `Ctrl + O`: Mở nhanh file nạp tài khoản.
   - `Ctrl + F`: Tìm kiếm tài khoản trong hàng đợi.
   - `Ctrl + Enter`: Ghi đè file cấu hình nhanh hoặc xác nhận Modal.
   - `Esc`: Đóng nhanh các modal hoặc dropdown menu.
   - `1` - `9`: Chuyển nhanh giữa Profile thứ 1 tới thứ 9.

---

## 🛠️ Cài Đặt và Khởi Chạy

### Yêu Cầu Hệ Thống
- Máy tính chạy hệ điều hành **Windows**.
- Đã cài đặt **Node.js** (Phiên bản v14 trở lên).

### Các Bước Khởi Chạy
1. Tải toàn bộ mã nguồn của dự án về máy tính.
2. Chạy file `run.bat` bằng cách click đúp, hoặc mở Terminal tại thư mục dự án và chạy lệnh:
   ```bash
   node server.js
   ```
3. Mở trình duyệt web của bạn và truy cập địa chỉ:
   👉 **[http://127.0.0.1:3000](http://127.0.0.1:3000)**

---

## 📂 Cấu Trúc Thư Mục Dữ Liệu
Mọi dữ liệu của ứng dụng được lưu trữ cô lập và an toàn tại thư mục ẩn `.9router-data` nằm ngay trong thư mục dự án:
- `.9router-data/state.json`: Lưu trữ danh sách profile và lịch sử trạng thái của ứng dụng.
- `.9router-data/settings.json`: Lưu trữ cấu hình giới hạn sao lưu (Retention Limit) và các thiết lập hiển thị.
- `.9router-data/backups/{profileId}/`: Thư mục chứa các file backup cấu hình dạng JSON được lưu trữ theo mốc thời gian.
- `.9router-data/history.log`: Lưu trữ lịch sử hoạt động chi tiết (Audit log).

---
*Thiết kế và tối ưu bởi Antigravity AI Coder.*
