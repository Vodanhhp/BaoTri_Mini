# Quy ước ngày giờ BAOTRI Mini

**Hiệu lực:** 24/11/2026  
**Múi giờ nghiệp vụ và hiển thị:** `Asia/Ho_Chi_Minh` (UTC+07:00)

## 1. Quy tắc bắt buộc

1. Mọi ngày giờ hiển thị trong BAOTRI Mini phải theo giờ Việt Nam, bất kể máy tính, điện thoại, trình duyệt hoặc máy chủ đang đặt múi giờ nào.
2. Mọi formatter ngày/giờ trong giao diện phải dùng helper tại `src/lib/dateTime.ts`:
   - `formatDateVN(value)`: hiển thị ngày theo lịch Việt Nam.
   - `formatDateTimeVN(value)`: hiển thị ngày và giờ Việt Nam.
   - `todayVNDateInput()`: lấy ngày hiện tại tại Việt Nam cho các trường nhập ngày.
3. Không gọi trực tiếp `toLocaleString()`, `toLocaleDateString()`, `toLocaleTimeString()` để hiển thị ngày giờ nghiệp vụ nếu không chỉ định rõ `timeZone: 'Asia/Ho_Chi_Minh'`.
4. Không tự cộng hoặc trừ 7 giờ bằng phép tính thủ công. Việc chuyển múi giờ phải do `Intl.DateTimeFormat` thực hiện.

## 2. Lưu trữ và trao đổi dữ liệu

- Timestamp biểu diễn một thời điểm tuyệt đối phải tiếp tục lưu/trao đổi dưới dạng ISO 8601 có timezone hoặc UTC (ví dụ giá trị do `toISOString()` tạo ra). Không đổi dữ liệu lịch sử chỉ để thay đổi cách hiển thị.
- Khi đọc timestamp, giao diện chuyển đổi sang `Asia/Ho_Chi_Minh` tại lớp trình bày.
- Không lưu chuỗi giờ Việt Nam không kèm timezone vào trường timestamp; tránh hiểu nhầm giờ địa phương thành UTC.
- Quy ước này không tự động thay đổi kiểu cột, schema, dữ liệu hoặc logic đồng bộ Local ↔ Cloud.

## 3. Ngày thuần và trường nhập liệu

- Ngày thuần như ngày sinh, ngày bảo trì, ngày giao dịch kho hoặc SQL `DATE` là ngày lịch, không phải timestamp UTC.
- Khi parse chuỗi `YYYY-MM-DD`, phải giữ nguyên ngày lịch Việt Nam; không parse thành UTC rồi hiển thị theo múi giờ thiết bị khiến ngày bị lùi/tiến.
- Giá trị mặc định, giới hạn `min/max` và kiểm tra ngày hiện tại của trường ngày phải lấy theo `todayVNDateInput()`.
- Trường nhập ngày giờ có thời gian phải xác định rõ đó là giờ Việt Nam hay timestamp có timezone; không được dựa vào timezone mặc định của trình duyệt một cách ngầm định.

## 4. Phạm vi áp dụng

Áp dụng thống nhất cho tất cả phân hệ và đầu ra: hồ sơ thiết bị, lịch sử thay đổi/bảo trì, kho vật tư và giao dịch, báo cáo/in phiếu, quản trị tổ chức/thành viên, gói dịch vụ/Plan, thông báo đồng bộ và các màn hình mới bổ sung sau này.

## 5. Kiểm thử khi thay đổi

- Bổ sung regression test cho helper và các màn hình sử dụng ngày giờ.
- Kiểm tra trường hợp timestamp sát 00:00 và ngày thuần để phát hiện lệch ngày.
- Nếu có điều kiện, kiểm tra cùng dữ liệu trên thiết bị đặt timezone khác Việt Nam để xác nhận giao diện vẫn hiển thị UTC+7.
- CI/build xanh không thay thế kiểm tra trực quan trên trình duyệt và thiết bị thực tế.

## 6. Triển khai ban đầu

- Helper chung và các cập nhật màn hình ban đầu được merge vào `main` qua PR #55.
- Merge commit: `b9cf8b09f25bb685b9167e392e3ad3e0c00f338f`.
- CI Build/Test và Validate của PR #55 đều thành công.
