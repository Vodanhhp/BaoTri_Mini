# Chuẩn giao diện và kích thước — BAOTRI Mini New

Cập nhật: 22/11/2026  
Trạng thái: **Mốc giao diện tham chiếu sau PR #16**. Đây là chuẩn trình bày hiện tại để giữ nhất quán khi tiếp tục phát triển; không đồng nghĩa mọi chức năng nghiệp vụ đã được kiểm thử hoàn tất.

## 1. Typography

- Font giao diện: **Be Vietnam Pro**, fallback `Arial, sans-serif`.
- Dùng thang chữ thống nhất:
  - Chú thích/metadata: **11px**.
  - Nội dung phụ: **12px**.
  - Nội dung chính: **13px**.
  - Tiêu đề khu vực: **15px**.
  - Tiêu đề hộp thoại: **18px**.
  - Tiêu đề trang: **22px**.
- Không dùng cỡ 7–10px cho nội dung có ý nghĩa hoặc thao tác.
- Chỉ giữ Tahoma trong vùng in và Consolas cho mã kỹ thuật/monospace; không để các ngoại lệ này ảnh hưởng giao diện thường.
- Input trên mobile nên có cỡ chữ tối thiểu **16px** để tránh trình duyệt tự phóng to khi focus.

## 2. Bảng dữ liệu

Áp dụng các class dùng chung `.table-standard-wrap`, `.table-standard` và các class phụ trợ đã mô tả tại `docs/UI_TABLE_STANDARD.md`.

| Thành phần | Kích thước tham chiếu |
|---|---:|
| Header bảng | 10px, đậm |
| Padding header | 11px 13px |
| Nội dung ô | 11–12px, line-height 1.5 |
| Padding ô dữ liệu | 10px 13px |
| Bo góc khung bảng | 12px desktop, 9px mobile |
| Viền | 1px theo token `--border` |
| Min-width bảng phổ thông | 620px |
| Min-width bảng lịch sử nhiều cột | khoảng 760px, tùy nội dung |
| Nút thao tác nhỏ | cao tối thiểu khoảng 30px |

- Header nền trung tính, đường phân cách nhẹ, hover kín đáo.
- Màu trạng thái có ngữ nghĩa: xanh = thành công/đã duyệt; vàng cam = chờ/cần chú ý; đỏ = từ chối/lỗi; xám = không hoạt động/chưa xác định.
- Bảng nằm trong vùng cuộn ngang khi viewport hẹp; có thể dùng sticky header và cuộn độc lập.
- Không ẩn trạng thái hoặc hành động thiết yếu trên mobile.
- Bảng in dùng CSS/class riêng, không áp dụng style bảng màn hình.

## 3. Modal và bảng nhiều cột

- Modal nghiệp vụ có bảng nhiều cột: desktop rộng tối đa khoảng **1120px hoặc 96vw**, không dùng modal 680–720px khiến bảng bị bó hẹp.
- Tablet: modal thu về khoảng **760px** tối đa; mobile: khoảng **96vw**, giới hạn chiều cao phù hợp viewport.
- Bảng nhiều cột dùng `table-layout: fixed` khi đã xác định tỷ lệ cột.
- Cột ghi chú được wrap; cột ngày/trạng thái giữ gọn; nhóm thao tác không bị ép vỡ dòng.
- Modal có bảng dài: vùng bảng cuộn độc lập; tiêu đề modal và thao tác chính không bị cuộn khuất.
- Chỉ bật cuộn ngang khi chiều rộng màn hình thực sự không đủ; không giảm cỡ chữ dưới chuẩn để cố nhét tất cả cột.

## 4. Responsive và vùng thao tác

- Desktop ưu tiên hiển thị đủ nội dung, khoảng cách gọn và cân đối.
- Tablet điều chỉnh độ rộng modal, bộ lọc và vùng bảng; tránh để các cột quan trọng bị ép quá hẹp.
- Mobile ưu tiên bố cục xếp dọc, ô nhập dễ chạm, font input 16px; cho phép cuộn ngang ở bảng rộng thay vì làm chữ quá nhỏ.
- Khu vực tìm kiếm Danh mục thiết bị: ô tìm kiếm ở hàng riêng, rộng toàn vùng; bộ lọc có nhãn; nút Đặt lại nằm cùng hàng bộ lọc và tự thích ứng theo viewport.
- Không làm thay đổi bố cục biểu mẫu in, tem QR hoặc nội dung in chỉ để đồng bộ giao diện màn hình.

## 5. Quy tắc giữ chuẩn khi phát triển tiếp

1. Ưu tiên tái sử dụng token và class dùng chung; không tạo thang font hoặc kiểu bảng riêng cho từng module nếu không có lý do nghiệp vụ.
2. Không sửa logic nghiệp vụ, quyền, dữ liệu Local/Cloud hoặc API chỉ vì mục tiêu trình bày.
3. Khi thay đổi CSS chung, kiểm tra các màn hình khác có dùng chung selector.
4. Kiểm tra tối thiểu desktop, tablet và mobile; kiểm tra cả trạng thái dữ liệu dài, rỗng và lỗi.
5. Ghi rõ ngoại lệ kích thước nếu một bảng/modal có yêu cầu nghiệp vụ đặc thù.

## 6. Mốc tham chiếu hiện tại

- PR #16 đã được merge vào `main` bằng commit `2f6fa3d0193acc318ae7057f374e1817994d9dd6`.
- Deployment Vercel Staging theo commit này đang ở trạng thái **READY**.
- Giao diện cơ bản được người dùng đánh giá là đã khá tốt và được chọn làm mốc chuẩn hiện tại.
- Mục **Thuê bao doanh nghiệp** vẫn có thể báo lỗi trong giai đoạn chạy thử; không coi việc giao diện hiển thị tốt là xác nhận luồng Edge Function/CORS/Plan đã hoạt động hoàn chỉnh.
- Khi tiếp tục xử lý lỗi Thuê bao doanh nghiệp, giữ nguyên bố cục/kích thước đã chốt trừ khi có lỗi hiển thị cụ thể cần sửa.
