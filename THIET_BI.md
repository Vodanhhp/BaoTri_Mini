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


## 5. Bộ máy định danh thiết bị thông minh (Smart Equipment ID Engine)

### 5.1. Mục tiêu

Xây dựng một công cụ dùng chung cho cả bốn Plan để phân tích tên thiết bị, chuẩn hóa tên, đề xuất phân loại và sinh mã ID phù hợp. Công cụ không chỉ lấy các ký tự đầu của tên rồi ghép số thứ tự; nó phải xét ngữ cảnh doanh nghiệp, ngành nghề, Plan và dữ liệu thiết bị đã tồn tại.

Mục tiêu đầu ra:
- Tên thiết bị chuẩn hóa, dễ hiểu và thống nhất.
- Nhóm thiết bị phù hợp (nếu Plan hỗ trợ hiển thị/quản lý nhóm).
- Mã rút gọn và mã ID theo đúng quy tắc Plan.
- Mã ID duy nhất trong phạm vi doanh nghiệp và ổn định trong suốt vòng đời thiết bị.

### 5.2. Dữ liệu đầu vào

1. **Plan của doanh nghiệp:** quyết định cấu trúc mã, tính năng được phép sử dụng và phạm vi bộ đếm.
2. **Từ điển ngành nghề:** ngành/lĩnh vực hoạt động đã chọn khi đăng ký doanh nghiệp; cung cấp ngữ cảnh để hiểu tên thiết bị.
3. **Từ điển nhóm thiết bị:** danh mục loại/nhóm thiết bị và mã nhóm tương ứng theo phạm vi Plan.
4. **Dữ liệu thiết bị hiện có:** tên gốc, tên chuẩn, mã ID đã cấp, nhóm, cơ sở và các mã đã được sử dụng, bao gồm cả hồ sơ lưu kho hoặc xóa mềm.
5. **Tên thiết bị người dùng nhập:** tên thực tế, cách gọi địa phương, tên thương mại hoặc mô tả có thông số/vị trí.

### 5.3. Quy trình xử lý

1. Nhận tên thiết bị người dùng nhập.
2. Phân tích từ khóa/ngữ nghĩa, nhận diện loại thiết bị, đặc điểm và ngữ cảnh.
3. Đối chiếu từ điển ngành nghề và từ điển thiết bị để đề xuất tên chuẩn, nhóm thiết bị và mã rút gọn.
4. Đọc Plan hiện tại để xác định cấu trúc ID và các thành phần cần có (nhóm, cơ sở, tháng/năm).
5. Đối chiếu dữ liệu và mã đã cấp trong doanh nghiệp.
6. Bộ cấp mã nghiệp vụ cấp số thứ tự an toàn, kiểm tra tính duy nhất.
7. Trả kết quả để người dùng xem và xác nhận trước khi lưu hồ sơ.

### 5.4. Bốn thành phần logic

| Thành phần | Trách nhiệm |
|---|---|
| Industry Dictionary | Từ điển ngành nghề và các tên gọi tương đương |
| Equipment Dictionary | Từ điển tên chuẩn, loại và nhóm thiết bị |
| Smart Naming Engine | Phân tích ngữ cảnh, chuẩn hóa tên và đề xuất phân loại/mã rút gọn |
| ID Generator | Áp dụng quy tắc Plan, cấp số thứ tự và bảo đảm ID duy nhất |

Đây là cách phân chia trách nhiệm logic; chưa bắt buộc phải tách thành bốn dịch vụ hoặc bốn ứng dụng độc lập.

### 5.5. Kết quả trả về

Công cụ cần trả về tối thiểu:
- Tên gốc người dùng nhập (được lưu để tra cứu).
- Tên thiết bị chuẩn hóa.
- Nhóm thiết bị đề xuất (nếu có).
- Mã rút gọn đề xuất.
- Cơ sở áp dụng (nếu Plan có quản lý cơ sở).
- Mã ID dự kiến và trạng thái kiểm tra.
- Thông tin giải thích ngắn gọn khi công cụ không đủ dữ liệu hoặc có nhiều phương án phân loại.

Ví dụ minh họa với Plan C:
- Tên nhập: `Máy bơm nước tăng áp tầng 3`.
- Tên chuẩn đề xuất: `Máy bơm nước tăng áp`.
- Nhóm đề xuất: `Cấp thoát nước`.
- Mã thiết bị đề xuất: `BOM`.
- Cơ sở: `00`.
- Mã ID dự kiến: `BOM-CN-00-001-1126`.

Ví dụ trên chỉ minh họa cách trình bày. Mã nhóm, bộ đếm và mã ID thực tế phải lấy từ từ điển đã được phê duyệt, Plan đang áp dụng và dữ liệu hiện có; không được mặc định rằng `CN` hoặc số `001` luôn hợp lệ.

### 5.6. Nguyên tắc thiết kế bắt buộc

1. **Tách đề xuất thông minh khỏi cấp mã chính thức:** AI/thuật toán có thể phân tích, chuẩn hóa và đề xuất; việc cấp số và bảo đảm duy nhất phải do logic nghiệp vụ xác định.
2. **Không phụ thuộc hoàn toàn vào tên:** Hai thiết bị có tên gần giống nhau nhưng khác chủng loại hoặc công dụng phải được phân tích theo ngữ cảnh; khi không đủ chắc chắn, yêu cầu người dùng chọn/xác nhận thay vì tự suy đoán.
3. **Kiểm tra toàn bộ mã đã dùng:** Phải tính cả thiết bị đang hoạt động, lưu kho, ngừng sử dụng hoặc xóa mềm theo chính sách lưu trữ; không tái cấp mã cũ.
4. **Cấp mã an toàn khi đồng thời:** Nhiều người dùng tạo thiết bị cùng lúc không được nhận cùng một số. Cần cơ chế cấp số nguyên tử và ràng buộc duy nhất ở tầng dữ liệu.
5. **ID đã cấp là bất biến:** Sửa tên, nhóm, cơ sở hoặc thông tin khác không tự động làm thay đổi ID đã cấp.
6. **Lưu tên gốc và tên chuẩn riêng:** Không làm mất cách gọi ban đầu của người dùng; tên chuẩn phục vụ thống nhất dữ liệu, tìm kiếm và báo cáo.
7. **Từ điển có kiểm duyệt:** Những cách gọi và phân loại được người dùng xác nhận có thể được đề xuất bổ sung vào từ điển; không tự động biến dữ liệu riêng của một doanh nghiệp thành chuẩn dùng chung khi chưa kiểm duyệt.
8. **Tương thích theo Plan:** Cùng một bộ máy dùng chung, nhưng áp dụng đúng cấu trúc mã và quyền tính năng của Plan. Plan A không hiển thị/chức năng hóa nhóm thiết bị cho người dùng; bộ máy vẫn có thể dùng phân loại nội bộ để nhận diện và đề xuất mã.
9. **Không khóa thiết bị theo ngành:** Ngành nghề chỉ cung cấp ngữ cảnh và gợi ý. Doanh nghiệp vẫn có thể thêm thiết bị không nằm trong danh mục gợi ý.
10. **Không phá mã cũ khi nâng cấp:** Nâng cấp Plan không tự động đổi ID đã cấp; quy tắc Plan mới áp dụng cho thiết bị tạo mới sau nâng cấp, trừ khi có quyết định nghiệp vụ riêng.

### 5.7. Quan hệ với từ điển ngành nghề theo Plan

- Mỗi Plan có phạm vi từ điển ngành nghề phù hợp với mức độ chi tiết của gói.
- Plan A ưu tiên nhóm ngành phổ thông, phục vụ hộ kinh doanh và cơ sở nhỏ (ví dụ: nhà nghỉ/khách sạn mini, cửa hàng, tiệm, văn phòng hoặc công ty nhỏ).
- Plan B phân ngành rõ hơn và bổ sung các nhóm thiết bị đặc trưng.
- Plan C phân ngành sâu hơn, hỗ trợ doanh nghiệp có nhiều cơ sở và danh mục thiết bị lớn.
- Plan D hướng tới từ điển chuyên sâu theo lĩnh vực, phân ngành và loại hình hoạt động đặc thù.
- Việc mở rộng từ điển ở Plan cao hơn không làm thay đổi mã ID đã cấp ở Plan thấp hơn.

### 5.8. Các nội dung cần thiết kế chi tiết sau

- Cấu trúc dữ liệu và phiên bản của từ điển ngành nghề, từ điển thiết bị và từ điển mã.
- Cách chuẩn hóa tiếng Việt, từ viết tắt, tên thương mại, tên model và tên gọi địa phương.
- Quy tắc tạo mã rút gọn khi tên dài, trùng tiền tố hoặc có nhiều cách gọi.
- Cách xử lý thiết bị chưa có trong từ điển, trường hợp phân loại không chắc chắn và quy trình người dùng xác nhận.
- Phạm vi bộ đếm, cách cấp số khi tạo đồng thời và cách xử lý giao dịch thất bại.
- Cách quản trị, phê duyệt và phát hành phiên bản từ điển dùng chung.
- Giao diện đề xuất, chỉnh sửa và xác nhận tên chuẩn/mã ID trước khi lưu.


---

**Lưu ý:** Tài liệu này ghi nhận phần phân chia gói và cấu trúc mã ID đã thống nhất ở bước thảo luận hiện tại. Chưa phải đặc tả triển khai kỹ thuật hoàn chỉnh; không tự ý thay đổi cơ sở dữ liệu, migration hoặc mã nguồn chỉ dựa trên tài liệu này.
