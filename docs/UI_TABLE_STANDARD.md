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
| Header | 11px, đậm, padding 8px 10px |
| Nội dung | 12px, line-height 1.45–1.5; thông tin phụ 11px |
| Padding ô | 8px 10px |
| Bo góc khung | 12px desktop, 9px mobile |
| Viền | 1px theo `--border` |
| Chiều rộng tối thiểu | 0px mặc định; chỉ đặt min-width riêng khi số cột/nghiệp vụ thực sự cần cuộn ngang |
| Nút thao tác | cao thống nhất 40px; nút biểu tượng 40×40px |

## Responsive
- Bọc bảng trong vùng cuộn ngang khi cần; mặc định bảng co theo vùng nội dung, không tự ép min-width 620px.
- Cho phép sticky header khi bảng dài; vùng cuộn có `overscroll-behavior-x: contain`.
- Mobile giảm nhẹ padding bảng, giữ cỡ chữ đọc được và vùng chạm đủ lớn; không ẩn cột chứa trạng thái hoặc hành động thiết yếu.
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

## Quy chuẩn giao diện chung toàn ứng dụng — BAOTRI Mini

Áp dụng cho tất cả module, không chỉ bảng dữ liệu. Màn hình PC, tablet và mobile dùng chung token; breakpoint chỉ thay đổi bố cục, không tự tạo một bộ kích thước nút/ô nhập khác.

### Kích thước điều khiển
- Nút thao tác thông thường: cao **40px**; nút biểu tượng: **40×40px**.
- Nút cùng vai trò phải cùng chiều cao, cỡ chữ, padding, bo góc và trạng thái hover/focus/disabled.
- Chỉ nút điều hướng đáy mobile được dùng vùng cao 48px để phù hợp thao tác cảm ứng; không áp dụng ngoại lệ kích thước tùy tiện theo từng module.
- Input và select một dòng: cao **40px**, rộng theo cột chứa; không tự đặt min-height 34/37/42/44/46px ở từng màn hình.
- Textarea: tối thiểu 96px, cho phép tăng theo nội dung.
- Checkbox/radio giữ kích thước điều khiển riêng, không ép cao 40px.
- Font nhập liệu desktop 13px; mobile có thể dùng 16px để tránh trình duyệt tự phóng to khi focus.

### Thang khoảng cách
Dùng các mức 4 / 8 / 12 / 16 / 24px. Các vùng cùng cấp phải dùng cùng nhịp khoảng cách; không đặt padding lớn riêng lẻ nếu không có lý do nghiệp vụ.

### Mật độ bố cục
- Nội dung chính dùng padding 22–28px trên desktop và 14px trên mobile.
- Panel dùng padding 16px desktop, 14px mobile.
- Thẻ thống kê, thanh công cụ, bộ lọc và vùng thao tác phải gọn; tránh tạo khoảng trống chỉ để lấp chiều rộng.
- Các cột trong form phải có chiều rộng bằng nhau theo grid; không để input/select tự co theo độ dài giá trị.

### Bảng và dữ liệu
- Bảng tiêu chuẩn mặc định co theo vùng chứa (min-width: 0), dùng table-layout: fixed, nội dung dài được xuống dòng trong ô.
- Chỉ bảng thực sự nhiều cột mới có min-width riêng; phải ghi rõ lý do và giữ vùng cuộn ngang độc lập.
- Không áp min-width 620px đại trà cho mọi bảng. Không dùng white-space: nowrap cho toàn bộ bảng.
- Header 11px; dữ liệu 12px; thông tin phụ 11px. Không giảm cỡ chữ để ép bảng vừa màn hình.
- Padding ô thống nhất 8px 10px; nhóm thao tác dùng chung khoảng cách và nút 40px.
- Nếu bảng quá dày trên mobile, chuyển sang thẻ có cấu trúc; không thu nhỏ bảng desktop đến mức khó đọc.

### Thành phần và ngoại lệ
- Dùng chung token tại :root trong src/style.css; CSS theo module chỉ quyết định bố cục, không tự ý thay đổi chiều cao/cỡ chữ nút và ô nhập.
- Không dùng inline style để đặt kích thước điều khiển. Trường hợp đặc biệt phải có lý do và class có phạm vi rõ ràng.
- Không thay đổi nghiệp vụ, quyền, dữ liệu, đồng bộ hoặc định dạng in trong quá trình chuẩn hóa giao diện.
- Mọi thay đổi giao diện phải kiểm tra ở ít nhất ba vùng: desktop rộng, tablet và mobile hẹp; build/test không thay thế kiểm tra trực quan.