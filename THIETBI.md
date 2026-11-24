# THIETBI — Chuẩn giao diện phân hệ Quản lý thiết bị

Cập nhật: 24/11/2026  
Nguồn giao diện: `src/App.tsx`, `src/style.css`, các component hồ sơ/ảnh thiết bị và QR hiện hành.

## 1. Nguyên tắc giao diện

- Thiết bị là phân hệ nghiệp vụ chính; ưu tiên đọc nhanh, tìm kiếm/lọc nhanh, nhận diện trạng thái và truy cập hồ sơ.
- Giữ banner xanh `.welcome` làm đầu trang; tiêu đề, mô tả, biểu tượng và Plan/Catalog phải đồng nhất với Kho vật tư.
- Thông tin Plan lấy từ Catalog Snapshot thực tế của tổ chức; không hardcode tên Plan, hạn mức hoặc số nhóm/loại.
- Giữ trạng thái Local/Cloud minh bạch. Không dùng cách trình bày khiến người dùng hiểu nhầm dữ liệu đã đồng bộ khi Cloud Sync chưa bật.
- Desktop ưu tiên bảng danh sách; mobile ưu tiên cách trình bày gọn, thao tác chạm thuận tiện và không làm vỡ khung.

## 2. Khung giao diện chuẩn

| Thành phần | Kích thước / cấu hình mẫu |
|---|---|
| Font | Be Vietnam Pro; fallback Arial, sans-serif |
| Sidebar desktop | Rộng 245px; tablet 205px |
| Nội dung chính | Max-width 1600px; desktop padding 27px 34px; tablet 22px; mobile 14px |
| Topbar desktop | Cao 94px; padding 17px 34px |
| Topbar mobile | Cao 72px; padding 10px 13px |
| Banner phân hệ | `.welcome`; radius 14px; padding desktop 25px 29px |
| Tiêu đề banner | 21px desktop; 16px ở breakpoint mobile cơ sở |
| Eyebrow | 10px; letter-spacing 1.4px; font-weight 700 |
| Biểu tượng banner | 88×88px desktop; 55×55px ở mobile cơ sở |
| Panel | Nền theo theme; border 1px; radius 12px; padding 20px |
| Panel mobile | Padding 14px; module có thể scope xuống 12px |
| Khoảng cách stat grid | 14px desktop; 8px mobile cơ sở |
| Stat card | Padding 17px desktop; 11px mobile; radius 11px |
| Modal thông thường | width min(700px, 100%); max-height 92vh; padding 22px |
| Nút đóng modal | 36×36px; icon SVG 18×18px |

Breakpoint nền: desktop > 1000px; tablet 681–1000px; mobile ≤ 680px. Một số component ảnh/QR có breakpoint riêng trong CSS.

## 3. Danh sách và thao tác thiết bị

- Giữ thanh tìm kiếm/lọc và công cụ thao tác thành các nhóm rõ ràng; không để nút phụ lấn át thao tác chính.
- Bảng desktop phải có tiêu đề cột dễ quét, khoảng đệm đủ đọc, trạng thái dùng badge ngắn gọn.
- Với bảng có nhiều cột, đặt min-width phù hợp trên wrapper cuộn ngang; không làm tràn toàn bộ trang.
- Menu thao tác theo từng thiết bị phải neo gần dòng tương ứng, không bị cắt bởi wrapper và không phủ sai vùng khác. Scope z-index/overflow vào đúng bảng.
- Trên mobile, ưu tiên card hoặc bố cục rút gọn; vùng bấm đủ lớn, không để nhiều nút nhỏ chen nhau.
- Trạng thái thiết bị phải phân biệt rõ đang sử dụng, ngừng sử dụng/lưu kho và hồ sơ đã xóa mềm (nếu có). Không gộp xóa mềm vào trạng thái vận hành.

## 4. Ảnh, QR và hồ sơ

- Giữ giới hạn nghiệp vụ ảnh hiện tại: tối đa 8 ảnh/thiết bị; ảnh JPEG được nén trước khi lưu theo luồng hiện hành.
- Lưới ảnh dùng mẫu CSS hiện tại: `.asset-photo-grid` auto-fill với min-width mỗi ô 105px, gap 9px; thumbnail ảnh cao 92px, object-fit: cover.
- Khung thumbnail radius 8px, padding 6px; ảnh bên trong radius 5px.
- Panel QR trên mobile giảm padding; QR có mẫu kích thước 88×88px tại breakpoint nhỏ theo CSS hiện hành.
- Tem QR hiện hành: 50×30mm. Không tự đổi tỷ lệ tem, vùng mã hoặc nội dung in nếu chưa kiểm tra máy in thực tế.

## 5. Mẫu màu và trạng thái

- Dùng CSS variables: `--bg`, `--panel`, `--panel-alt`, `--text`, `--muted`, `--border`, `--primary`, `--success-bg`, `--warning-bg`, `--danger-bg`.
- Trạng thái dùng class chung `.status.green`, `.status.red`, `.status.orange`, `.status.gray`; không tự đặt màu rời cho từng màn hình.
- Hỗ trợ theme sáng/tối qua `html[data-theme='dark']`; tránh hardcode nền trắng/đen trong component mới nếu đã có token theme.

## 6. Không được tự ý thay đổi

- Quy tắc mã thiết bị/Plan, Catalog Snapshot, lưu Local, đồng bộ Cloud, khóa chỉnh sửa, lịch sử thiết bị và phân quyền.
- Số lượng ảnh, kích thước tem 50×30mm hoặc cơ chế lưu ảnh.
- Không tạo migration, sửa Supabase hoặc bật Cloud Sync chỉ vì thay đổi giao diện.

## 7. Checklist trước khi hoàn tất UI

- [ ] Banner/Plan/Catalog không hardcode và xử lý được loading/error/no catalog.
- [ ] Desktop không tràn ngang ngoài wrapper có chủ đích.
- [ ] Mobile ≤ 680px không vỡ banner, toolbar, form, ảnh hoặc QR.
- [ ] Menu thao tác không bị cắt và không che sai vùng.
- [ ] Theme sáng/tối đọc rõ.
- [ ] Regression tests và build đều đạt; ghi rõ nếu chưa kiểm tra browser/device thực tế.
