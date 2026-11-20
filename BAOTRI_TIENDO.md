# BAOTRI Mini – TIẾN ĐỘ DỰ ÁN MỚI

Cập nhật: 21/11/2026

## 1. Mục tiêu và phạm vi

Repository mới: https://github.com/Vodanhhp/BaoTri_Mini

Dự án được tách riêng từ BAOTRI Mini gốc (Vodanhhp/DuAn_BaoTRi). Mục tiêu là giữ trải nghiệm giao diện và cách thao tác mà người dùng đã duyệt, nhưng chỉ phát triển từng phân hệ để giảm độ phức tạp.

### Phạm vi giai đoạn 1
- Đăng nhập bằng Supabase Auth, tài khoản được cấp sẵn; không mở đăng ký tự do.
- Quản lý hồ sơ thiết bị.
- Dữ liệu thiết bị hiện lưu Local bằng IndexedDB/Dexie trên trình duyệt.
- Chưa bật đồng bộ Cloud, chưa chia sẻ dữ liệu giữa nhiều thiết bị.

### Chưa triển khai
- Vật tư/kho.
- Checklist.
- Công việc, kế hoạch bảo trì, nhật ký, báo cáo.
- Quản trị tổ chức/phân quyền nâng cao.
- Sao lưu/khôi phục, QR, nhập/xuất Excel, đồng bộ Cloud.

Các module trên chỉ được xem xét sau khi phân hệ Thiết bị hoàn thiện và được người dùng nghiệm thu.

## 2. Nguyên tắc làm việc

1. Repository cũ được giữ nguyên làm mẫu tham chiếu; không xóa, không sửa, không đổi nhánh hoặc tác động dữ liệu của dự án cũ khi làm dự án mới.
2. Dự án mới độc lập về mã nguồn, cấu hình và môi trường Supabase. Không dùng lại URL/key Supabase của dự án cũ nếu chưa có quyết định riêng.
3. Sao chép trải nghiệm giao diện, bố cục, màu sắc, nút bấm và biểu mẫu từ mẫu gốc; không bê nguyên các module chưa cần.
4. Chỉ triển khai từng nhóm chức năng có ý nghĩa; ưu tiên chạy được, kiểm thử được và dễ bảo trì.
5. Không triển khai Production, không thao tác dữ liệu thật và không bật đồng bộ Cloud khi chưa được yêu cầu rõ.
6. Chỉ dùng nhánh chính hiện có của repository mới, không tự tạo thêm nhánh làm việc.

## 3. Nguồn tham chiếu đã đọc

Repository gốc: Vodanhhp/DuAn_BaoTRi, nhánh feature/test-reset-all.

Đã đối chiếu:
- README.md: công nghệ, kiến trúc Local-first và phạm vi các phân hệ hiện tại.
- package.json: phiên bản nền tảng React, TypeScript, Vite, Supabase và Dexie.
- src/App.tsx: bố cục ứng dụng, vùng thiết bị và các mẫu giao diện.
- src/AuthScreen.tsx: giao diện và luồng đăng nhập Supabase.
- src/style.css: bộ CSS giao diện gốc.
- src/lib/supabase.ts: cách khởi tạo Supabase client.
- src/main.tsx, index.html, vite.config.ts, tsconfig*.json.
- BAOTRI_TIENDO_VA_QUYETDINH.md: các quyết định và trạng thái gần nhất; phần cập nhật gần nhất được đối chiếu ở các mục về M023 và chuẩn bị chạy giao diện local ngày 20/11/2026.

Không sao chép cấu hình bí mật, .env.local, dữ liệu người dùng, database hoặc migration từ dự án cũ.

## 4. Thành phần đã khởi tạo ở dự án mới

- [x] Tạo nền tảng React + TypeScript + Vite.
- [x] Thêm Supabase Auth client, không chứa URL/key thật.
- [x] Sao chép và điều chỉnh màn hình đăng nhập.
- [x] Sao chép bộ CSS giao diện gốc.
- [x] Tạo IndexedDB/Dexie riêng cho hồ sơ thiết bị.
- [x] Tạo màn hình danh mục thiết bị: tìm kiếm, lọc trạng thái, thêm, sửa, xóa.
- [x] Tạo biểu mẫu thiết bị cơ bản.
- [x] Tách riêng file cấu hình môi trường mẫu .env.example.
- [ ] Cài dependencies và chạy build kiểm tra.
- [ ] Đối chiếu chi tiết từng trường dữ liệu, danh mục, mã thiết bị và các nút với mẫu gốc.
- [ ] Hoàn thiện nghiệp vụ thiết bị và kiểm thử PC/mobile.
- [ ] Thiết lập Supabase project riêng cho dự án mới trước khi kiểm thử đăng nhập thực tế.

## 5. Lưu ý kỹ thuật hiện tại

- Đăng nhập yêu cầu cấu hình .env.local từ .env.example.
- Chưa có Supabase project riêng được cấu hình cho repository mới.
- Dữ liệu thiết bị hiện là Local-only. Đăng nhập không đồng nghĩa dữ liệu đã được phân vùng theo tài khoản hoặc đồng bộ lên Cloud.
- Không đưa dữ liệu nhạy cảm hoặc tài khoản thật vào repository.
- Chưa thể coi chức năng đã nghiệm thu chỉ vì mã nguồn đã được tạo.

## 6. Điểm tiếp tục

Tiếp tục rà soát và kiểm thử build; sau đó đối chiếu màn hình Thiết bị với mẫu gốc, hoàn thiện trường dữ liệu và thao tác trước khi thiết kế schema Cloud riêng.
