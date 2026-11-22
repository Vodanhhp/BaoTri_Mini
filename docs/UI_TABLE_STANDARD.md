# Chuẩn giao diện bảng dữ liệu — BAOTRI Ecosystem

## Mục tiêu
Mọi ứng dụng trong hệ sinh thái BAOTRI dùng cùng một ngôn ngữ trình bày bảng: gọn, rõ, nhất quán, dễ thao tác bằng chuột và cảm ứng. Ưu tiên khả năng đọc dữ liệu hơn trang trí.

## Nguyên tắc thiết kế
- **Một bảng = một mục đích:** tiêu đề cột ngắn, dễ hiểu; không nhồi thông tin không cần thiết.
- **Mật độ vừa phải:** header khoảng 10px; nội dung khoảng 11–12px; padding ô 10–13px; tránh hàng quá cao.
- **Phân cấp thị giác:** header nền trung tính; nội dung chính đậm vừa phải; thông tin phụ đặt dưới bằng chữ nhỏ và màu muted.
- **Đường kẻ nhẹ:** dùng border theo token giao diện; không kẻ ô dày hoặc dùng màu nền rực rỡ.
- **Hover kín đáo:** chỉ làm nổi nhẹ hàng đang trỏ; không dùng hiệu ứng gây xao nhãng.
- **Trạng thái có ngữ nghĩa:** xanh = thành công/đã duyệt; vàng cam = đang chờ/cần chú ý; đỏ = từ chối/lỗi/nguy hiểm; xám = không hoạt động/chưa xác định.
- **Hành động ngắn gọn:** nhóm nút ở cuối hàng; hành động chính nổi bật, hành động phụ trung tính; xác nhận thao tác nguy hiểm riêng.
- **Không làm biến dạng bảng in:** bảng phục vụ giấy tờ dùng class riêng và CSS trong `@media print`.

## Kích thước mặc định
| Thành phần | Chuẩn |
|---|---:|
| Header | 10px, đậm, padding 11px 13px |
| Nội dung | 11–12px, line-height 1.5 |
| Padding ô | 10px 13px |
| Bo góc khung | 12px desktop, 9px mobile |
| Viền | 1px theo `--border` |
| Chiều rộng tối thiểu | 620px cho bảng phổ thông; bảng nhiều cột xác định min-width theo nghiệp vụ và không bó hẹp trong modal |
| Nút thao tác nhỏ | cao tối thiểu khoảng 30px |

## Responsive
- Bọc bảng trong vùng cuộn ngang, không ép chữ thành nhiều dòng đến mức khó đọc.
- Cho phép sticky header khi bảng dài; vùng cuộn có `overscroll-behavior-x: contain`.
- Mobile giảm nhẹ padding và cỡ chữ, giữ thao tác đủ lớn; không ẩn cột chứa trạng thái hoặc hành động thiết yếu.
- Với bảng rất rộng, đặt `min-width` riêng theo nghiệp vụ và ghi rõ trong CSS.

## Cách áp dụng trong React
Dùng wrapper và class chuẩn:

```tsx
<div className="table-wrap table-standard-wrap">
  <table className="table-standard">
    <thead>
      <tr><th>Mã</th><th>Tên</th><th>Trạng thái</th><th>Thao tác</th></tr>
    </thead>
    <tbody>
      {rows.map(row => (
        <tr key={row.id}>
          <td><b>{row.code}</b></td>
          <td>{row.name}</td>
          <td><span className="status green">Đang hoạt động</span></td>
          <td><div className="table-action-group">{/* actions */}</div></td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- Không có dữ liệu: dùng `.table-empty-state`, không tạo một hàng trống khó hiểu.
- Thông tin phụ: dùng `.table-subtext`; ghi chú dài dùng `.table-note-cell`.
- Ngày tháng dùng `.table-date-cell` nếu cần giữ trên một dòng.
- Các nút thao tác dùng `.table-action-group`.
- Tên cột căn trái; số lượng/giá trị có thể căn phải; trạng thái và thao tác căn theo nội dung.
- Bảng có nhiều dữ liệu phải có phân trang/lọc phù hợp; không tải vô hạn toàn bộ dữ liệu chỉ để hiển thị.

## CSS dùng chung
Các class chuẩn được định nghĩa tại cuối `src/style.css`:
- `.table-standard-wrap`
- `.table-standard`
- `.table-subtext`
- `.table-date-cell`
- `.table-note-cell`
- `.table-action-group`
- `.table-empty-state`

Bảng hiện tại trong BAOTRI Mini cần được bọc bằng `.table-wrap`; chỉ bảng màn hình nằm trong wrapper này nhận quy chuẩn. Bảng in nằm ngoài wrapper nên giữ nguyên định dạng giấy.

## Checklist khi thêm bảng mới
1. Tiêu đề cột ngắn và không trùng nghĩa.
2. Có trạng thái tải, lỗi và rỗng rõ ràng.
3. Có khóa định danh ổn định cho từng hàng.
4. Không làm mất thao tác quan trọng trên mobile.
5. Dữ liệu dài có xuống dòng hợp lý hoặc tooltip/chi tiết; không làm vỡ layout.
6. Kiểm tra light/dark theme nếu màn hình hỗ trợ.
7. Kiểm tra bàn phím, focus và nhãn truy cập cho nút thao tác.
8. Không thay đổi nghiệp vụ, quyền hoặc dữ liệu chỉ vì mục tiêu trình bày.

## Quy tắc bố cục bảng nhiều cột và modal
- Không đặt modal chứa bảng nghiệp vụ nhiều cột ở chiều rộng mặc định 680–720px. Desktop dùng khoảng 1000–1120px hoặc tối đa 96vw; tablet/mobile dùng gần toàn màn hình.
- Bảng nhiều cột dùng `table-layout: fixed` khi đã xác định tỷ lệ cột; khai báo tỷ lệ theo nội dung. Cột ghi chú được phép xuống dòng, cột ngày/trạng thái giữ gọn, cột thao tác không bị ép xuống nhiều dòng.
- Trên desktop ưu tiên hiển thị đủ các cột trong vùng nhìn. Chỉ bật cuộn ngang khi viewport thực sự hẹp; không thu nhỏ chữ đến mức khó đọc để cố nhét bảng.
- Nội dung dài phải wrap trong chính ô dữ liệu, không làm cả hàng hoặc modal phình theo chiều dọc bất thường.
- Modal có bảng dài cần giới hạn chiều cao vùng bảng và cho phép cuộn độc lập; tiêu đề modal và thao tác chính không bị cuộn khuất.

## Chuẩn typography dùng chung cho toàn hệ sinh thái

- Font giao diện duy nhất: **Be Vietnam Pro**, khai báo tại `:root` qua `--font-family-ui`; fallback `Arial, sans-serif` khi không tải được font web.
- Không tự khai báo font-family trong component hoặc từng màn hình. Nút, ô nhập, select, textarea và nội dung modal phải kế thừa font từ gốc.
- Thang chữ giao diện: chú thích/metadata 11px; nội dung phụ 12px; nội dung chính 13px; tiêu đề khu vực 15px; tiêu đề hộp thoại 18px; tiêu đề trang 22px.
- Không dùng chữ 7–10px cho nội dung có ý nghĩa hoặc thao tác. Nhãn phụ, trạng thái, ngày tháng, ghi chú và nút nhỏ tối thiểu 11px; không thu nhỏ chữ để ép vừa màn hình.
- Chỉ cho phép font chuyên dụng trong vùng in theo biểu mẫu hoặc chuỗi mã kỹ thuật cần font monospace; các ngoại lệ phải có phạm vi CSS rõ ràng và không lan sang giao diện thường.
- Trên mobile ưu tiên tăng khả năng đọc và vùng chạm; điều chỉnh bố cục/cho cuộn thay vì giảm chữ xuống dưới chuẩn.
- Khi thêm màn hình mới, dùng token typography thay vì đặt giá trị font-size rời rạc. Không nhúng một thang chữ riêng trong component.