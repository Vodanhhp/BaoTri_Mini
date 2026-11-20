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


## 7. Yêu cầu kế thừa cho phân hệ Thiết bị

Đối chiếu phần quyết định và lịch sử trong TIENDO của repository gốc. Đây là yêu cầu cần rà soát khi hoàn thiện; không phải tất cả đã có trong bản khởi tạo đầu tiên.

- Danh sách có tìm kiếm, lọc kết hợp theo nhóm/vị trí/trạng thái, sắp xếp theo mã/tên/ngày đưa vào sử dụng và nút đặt lại bộ lọc.
- Nhấp tên thiết bị mở cửa sổ chi tiết; có thể xem ảnh và hỗ trợ nhiều ảnh ở bước hoàn thiện hồ sơ.
- Biểu mẫu có đầy đủ thông tin nhận diện và kỹ thuật: mã quản lý, tên, nhóm, hãng, model, serial, vị trí, ngày đưa vào sử dụng, công suất/thông số, chu kỳ nếu được giữ trong phạm vi nghiệp vụ, tình trạng và ghi chú.
- Phân biệt vòng đời thiết bị: Đang hoạt động, Đang sửa chữa, Ngừng sử dụng, Lưu kho và Thanh lý. Lưu kho phải giữ hồ sơ và lịch sử; khôi phục là thao tác riêng; không đồng nhất lưu kho với xóa hoặc thanh lý.
- ID nội bộ UUID bất biến, tách biệt với mã quản lý hiển thị và QR. QR chỉ mở/tra cứu hồ sơ sau khi người dùng đã được xác thực và cấp quyền.
- Mã quản lý tự cấp theo quy ước doanh nghiệp; không dùng mã hiển thị làm khóa chính. Cần đối chiếu tài liệu quy ước mã và logic cấp mã gốc trước khi triển khai. Thiết bị chuyển từ cơ sở khác có cờ riêng và hậu tố theo quy tắc đã thống nhất.
- Các thao tác in chi tiết thiết bị, in tem QR, xuất danh sách Excel và in danh sách là những yêu cầu giao diện/nghiệp vụ của phân hệ Thiết bị; chỉ đưa vào sau khi đối chiếu chính xác hành vi mẫu.
- Trên điện thoại cần giữ thao tác thuận tiện, bảng có thể cuộn ngang hoặc trình bày dạng thẻ; các nút đủ lớn để chạm.

## 8. Các quyết định mới của dự án này

Các quyết định dưới đây do người dùng chốt cho repository mới và được ưu tiên hơn các ghi chú lịch sử trái ngược trong TIENDO cũ:

- Chỉ giữ hai khu vực: Đăng nhập và Thiết bị.
- Người dùng đã yêu cầu có đăng nhập thật; vì vậy quyết định này thay thế ghi chú cũ ở giai đoạn đầu rằng chưa cần đăng nhập.
- Giữ phong cách và trải nghiệm của mẫu BAOTRI Mini; không tự ý thiết kế lại toàn bộ.
- Không xây dựng Vật tư, Checklist hoặc các phân hệ khác trước khi Thiết bị hoàn thiện.
- Dự án mới độc lập; không sửa hoặc xóa repository gốc.
- Bản mã khởi tạo hiện tại mới là khung chức năng ban đầu. Chưa được xác nhận tương đương 1:1 với phân hệ Thiết bị gốc và chưa được nghiệm thu.
