# QUY TẮC PHÂN CHIA GÓI PLAN VÀ MÃ ID THIẾT BỊ

> Tài liệu ghi nhận phương án đã thống nhất trong buổi trao đổi ngày 21/11/2026. Đây là quy tắc nghiệp vụ làm cơ sở thiết kế BAOTRI Mini; các quyền lợi thương mại khác của từng gói sẽ được bàn và bổ sung sau.

## 1. Phân chia gói doanh nghiệp

| Gói | Quy mô thiết bị tối đa | Nhóm thiết bị | Quản lý nhiều cơ sở | Cấu trúc mã ID |
|---|---:|---|---|---|
| Plan A | 200 thiết bị | Không | Không | `ABCD-XXX` |
| Plan B | 500 thiết bị | Có | Chưa bao gồm | `ABCD-EFG-YYY` |
| Plan C | 1.000 thiết bị | Có | Có | `ABCD-EFG-XX-XXX-YYZZ` |
| Plan D | Trên 1.000 thiết bị | Có | Có | `ABCD-EFG-XX-XXX-YYZZ` |

- Số lượng thiết bị là giới hạn của gói doanh nghiệp.
- Plan A không sử dụng chức năng nhóm thiết bị.
- Plan B có nhóm thiết bị nhưng chưa có chức năng quản lý nhiều cơ sở.
- Plan C và Plan D hỗ trợ nhóm thiết bị và quản lý nhiều cơ sở.
- Plan D hiện dùng cùng cấu trúc mã ID với Plan C. Những quyền lợi mở rộng riêng của Plan D sẽ được xác định sau.

## 2. Quy tắc mã ID theo từng gói

### 2.1. Plan A — mã đơn giản

**Cấu trúc:** `ABCD-XXX`

Ví dụ: `BOM-001`, `BOM-002`, `MAY-003`.

- `ABCD`: mã rút gọn dựa trên tên thiết bị, tối đa 4 ký tự.
- `XXX`: số thứ tự từ `001` đến `200`.
- Không có mã nhóm thiết bị và mã cơ sở.

### 2.2. Plan B — mã có nhóm thiết bị

**Cấu trúc:** `ABCD-EFG-YYY`

Ví dụ: `BOM-DIE-001`, `BOM-BOM-001`.

- `ABCD`: mã rút gọn dựa trên tên thiết bị, từ 2 đến 4 ký tự.
- `EFG`: mã nhóm thiết bị.
- `YYY`: số thứ tự từ `001` đến `500`.
- Có chức năng phân nhóm thiết bị; chưa quản lý nhiều cơ sở.

### 2.3. Plan C — mã có nhóm và cơ sở

**Cấu trúc:** `ABCD-EFG-XX-XXX-YYZZ`

Ví dụ: `BOM-DIE-00-001-1126`.

- `ABCD`: mã rút gọn dựa trên tên thiết bị, từ 2 đến 4 ký tự.
- `EFG`: mã nhóm thiết bị.
- `XX`: mã cơ sở. Cơ sở mặc định là `00`; cơ sở tiếp theo được cấp mã tăng tuần tự.
- `XXX`: số thứ tự thiết bị, bắt đầu từ `001`. Bộ đếm được quản lý riêng theo tổ hợp mã thiết bị + mã nhóm + mã cơ sở; số thứ tự không được cấp trùng.
- `YYZZ`: tháng và năm thiết bị được đưa vào sử dụng, theo định dạng MMYY. Ví dụ `1126` là tháng 11 năm 2026.

### 2.4. Plan D — doanh nghiệp quy mô lớn

**Cấu trúc:** `ABCD-EFG-XX-XXX-YYZZ`

- Áp dụng cùng quy tắc cấu trúc và sinh mã ID như Plan C.
- Dành cho doanh nghiệp có trên 1.000 thiết bị.
- Các quyền lợi và tính năng mở rộng riêng của Plan D sẽ được thảo luận, chưa quy định trong tài liệu này.

## 3. Nguyên tắc chung khi sinh và quản lý mã ID

1. Mã ID phải duy nhất trong phạm vi một doanh nghiệp (Organization).
2. Hệ thống tự động cấp số thứ tự; không để thao tác đồng thời của nhiều người dùng tạo ra mã trùng.
3. Mã ID đã cấp không tự thay đổi khi người dùng sửa tên thiết bị hoặc thay đổi nhóm thiết bị.
4. Không tái sử dụng mã ID đã cấp, kể cả khi thiết bị bị xóa hoặc chuyển sang lưu kho.
5. Mã rút gọn từ tên thiết bị có thể trùng nhau. Hệ thống phải xử lý bằng bộ cấp số thứ tự, không được dựa vào tên để bảo đảm tính duy nhất.
6. Với Plan C và D, mã tháng/năm phản ánh thời điểm thiết bị được xác nhận đưa vào sử dụng; không tự thay đổi khi sửa các thông tin khác.
7. Khi doanh nghiệp nâng cấp gói, các mã ID đã cấp được giữ nguyên. Quy tắc của gói mới áp dụng cho thiết bị tạo mới sau khi nâng cấp, trừ khi có quyết định nghiệp vụ khác.
8. Khi thiết kế bộ đếm cho Plan C và D, trường số thứ tự cần có khả năng mở rộng khi vượt quá 999; không được để giới hạn độ dài làm phát sinh mã trùng.

## 4. Nội dung cần bàn tiếp

- Quyền lợi và giới hạn ngoài số lượng thiết bị của từng Plan.
- Quy tắc xử lý khi doanh nghiệp vượt giới hạn thiết bị của gói.
- Điều kiện nâng cấp hoặc hạ cấp gói.
- Giới hạn số cơ sở và cách quản lý mã cơ sở.
- Quy tắc chuẩn hóa tên thiết bị, tên nhóm thành mã `ABCD` và `EFG`.
- Có cho phép doanh nghiệp tự chọn/sửa mã rút gọn hay hệ thống tự sinh hoàn toàn.

---

**Lưu ý:** Tài liệu này ghi nhận phần phân chia gói và cấu trúc mã ID đã thống nhất ở bước thảo luận hiện tại. Chưa phải đặc tả triển khai kỹ thuật hoàn chỉnh; không tự ý thay đổi cơ sở dữ liệu, migration hoặc mã nguồn chỉ dựa trên tài liệu này.
