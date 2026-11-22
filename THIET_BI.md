# QUY TẮC PHÂN CHIA GÓI PLAN VÀ MÃ ID THIẾT BỊ

> Tài liệu ghi nhận phương án đã thống nhất trong buổi trao đổi ngày 21/11/2026. Đây là quy tắc nghiệp vụ làm cơ sở thiết kế BAOTRI Mini; các quyền lợi thương mại khác của từng gói sẽ được bàn và bổ sung sau.

## 1. Phân chia gói doanh nghiệp

| Gói | Quy mô thiết bị tối đa | Nhóm thiết bị | Quản lý nhiều cơ sở | Cấu trúc mã ID |
|---|---:|---|---|---|
| Plan A | 200 thiết bị | Không | Không | `ABCD-XXX` |
| Plan B | 500 thiết bị | Có | Chưa bao gồm | `ABCD-{GROUP_CODE}-YYY` |
| Plan C | 1.000 thiết bị | Có | Có | `ABCD-{GROUP_CODE}-XX-XXX-YYZZ` |
| Plan D | Trên 1.000 thiết bị | Có | Có | `ABCD-{GROUP_CODE}-XX-XXX-YYZZ` |

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

**Cấu trúc:** `ABCD-{GROUP_CODE}-YYY`

Ví dụ: `BOM-DIE-001`, `BOM-BOM-001`.

- `ABCD`: mã rút gọn dựa trên tên thiết bị, từ 2 đến 4 ký tự.
- `{GROUP_CODE}`: mã nhóm thiết bị (mã trong danh mục có thể dài 2–4 ký tự).
- `YYY`: số thứ tự từ `001` đến `500`.
- Có chức năng phân nhóm thiết bị; chưa quản lý nhiều cơ sở.

### 2.3. Plan C — mã có nhóm và cơ sở

**Cấu trúc:** `ABCD-{GROUP_CODE}-XX-XXX-YYZZ`

Ví dụ: `BOM-DIE-00-001-1126`.

- `ABCD`: mã rút gọn dựa trên tên thiết bị, từ 2 đến 4 ký tự.
- `{GROUP_CODE}`: mã nhóm thiết bị (mã trong danh mục có thể dài 2–4 ký tự).
- `XX`: mã cơ sở. Cơ sở mặc định là `00`; cơ sở tiếp theo được cấp mã tăng tuần tự.
- `XXX`: số thứ tự thiết bị, bắt đầu từ `001`. Bộ đếm được quản lý riêng theo tổ hợp mã thiết bị + mã nhóm + mã cơ sở; số thứ tự không được cấp trùng.
- `YYZZ`: tháng và năm thiết bị được đưa vào sử dụng, theo định dạng MMYY. Ví dụ `1126` là tháng 11 năm 2026.

### 2.4. Plan D — doanh nghiệp quy mô lớn

**Cấu trúc:** `ABCD-{GROUP_CODE}-XX-XXX-YYZZ`

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

### 5.7. Phân biệt mã định danh bất biến và thông tin thiết bị có thể thay đổi

Các trường thông tin của thiết bị được chia thành hai nhóm rõ ràng:

**A. Mã định danh bất biến**
- UUID là mã kỹ thuật duy nhất, gắn với hồ sơ thiết bị trong suốt vòng đời; không thay đổi khi sửa tên, đổi nhóm, chuyển cơ sở, lưu kho hoặc khôi phục.
- Mã ID là mã quản lý nghiệp vụ đã được cấp và có thể đã được ghi trong hồ sơ, biên bản, bản vẽ hoặc tài liệu nội bộ của doanh nghiệp. Sau khi lưu thiết bị, mã ID không được tự động hoặc thủ công thay đổi.
- Không sinh mã ID mới chỉ vì Admin thay đổi nhóm thiết bị hoặc Admin/KTV sửa tên gọi thực tế.
- Mã ID phản ánh quy tắc và thông tin phân loại tại thời điểm cấp mã; không bắt buộc phản ánh nhóm hiện tại hoặc tên gọi thực tế hiện tại.

**B. Thông tin nghiệp vụ có thể thay đổi**
- **Tên gọi thực tế (display/working name):** Admin hoặc KTV được phép sửa theo tên đang được doanh nghiệp sử dụng ngoài thực tế. Việc sửa tên này chỉ cập nhật thông tin hiển thị/vận hành, không làm thay đổi UUID, mã ID, mã rút gọn đã cấp hoặc bộ đếm.
- **Nhóm thiết bị hiện tại:** Admin được phép thay đổi khi xác định việc phân loại mới phù hợp hơn với thực tế. Việc thay đổi nhóm chỉ cập nhật phân loại hiện tại, không sửa mã ID đã cấp. Cần ghi lịch sử nhóm cũ, nhóm mới, người thực hiện, thời điểm và lý do nếu có.
- Tên gốc lúc tạo, tên chuẩn hóa lúc cấp mã và tên gọi thực tế hiện tại nên được lưu thành các trường riêng để giữ lịch sử và phục vụ tìm kiếm/báo cáo. Không ghi đè mất tên gốc hoặc dữ liệu tên đã dùng để giải thích việc cấp mã.

Ví dụ: Thiết bị được cấp mã `BOMP-NUO-00-001-1126` khi thuộc nhóm NUO và có tên gọi ban đầu là “Máy bơm nước làm mát”. Sau này Admin chuyển nhóm hiện tại sang PRO, đồng thời KTV sửa tên thực tế thành “Bơm tuần hoàn dây chuyền”. UUID và mã ID vẫn giữ nguyên; hệ thống chỉ cập nhật nhóm hiện tại và tên gọi thực tế, đồng thời lưu lịch sử thay đổi cần thiết.

**Quyền và kiểm soát**
- Admin có quyền xem UUID; KTV và Viewer không được hiển thị UUID trong giao diện hoặc dữ liệu trả về thông thường.
- Admin có quyền thay đổi nhóm thiết bị hiện tại.
- Admin và KTV có thể sửa tên gọi thực tế theo quyền sửa hồ sơ thiết bị được cấp.
- Mọi thay đổi tên/nhóm cần tuân thủ RBAC hiện hành và được ghi nhận lịch sử phù hợp. Quyền sửa thông tin không đồng nghĩa với quyền sửa UUID hoặc mã ID.

### 5.8. Quan hệ với từ điển ngành nghề theo Plan

- Mỗi Plan có phạm vi từ điển ngành nghề phù hợp với mức độ chi tiết của gói.
- Plan A ưu tiên nhóm ngành phổ thông, phục vụ hộ kinh doanh và cơ sở nhỏ (ví dụ: nhà nghỉ/khách sạn mini, cửa hàng, tiệm, văn phòng hoặc công ty nhỏ).
- Plan B phân ngành rõ hơn và bổ sung các nhóm thiết bị đặc trưng.
- Plan C phân ngành sâu hơn, hỗ trợ doanh nghiệp có nhiều cơ sở và danh mục thiết bị lớn.
- Plan D hướng tới từ điển chuyên sâu theo lĩnh vực, phân ngành và loại hình hoạt động đặc thù.
- Việc mở rộng từ điển ở Plan cao hơn không làm thay đổi mã ID đã cấp ở Plan thấp hơn.

### 5.9. Các nội dung cần thiết kế chi tiết sau

- Cấu trúc dữ liệu và phiên bản của từ điển ngành nghề, từ điển thiết bị và từ điển mã.
- Cách chuẩn hóa tiếng Việt, từ viết tắt, tên thương mại, tên model và tên gọi địa phương.
- Quy tắc tạo mã rút gọn khi tên dài, trùng tiền tố hoặc có nhiều cách gọi.
- Cách xử lý thiết bị chưa có trong từ điển, trường hợp phân loại không chắc chắn và quy trình người dùng xác nhận.
- Phạm vi bộ đếm, cách cấp số khi tạo đồng thời và cách xử lý giao dịch thất bại.
- Cách quản trị, phê duyệt và phát hành phiên bản từ điển dùng chung.
- Giao diện đề xuất, chỉnh sửa và xác nhận tên chuẩn/mã ID trước khi lưu.



## 6. Nguyên tắc danh mục chuẩn và danh mục riêng của khách hàng (Snapshot)

Đây là quyết định nghiệp vụ đã thống nhất ngày 21/11/2026.

### 6.1. Danh mục chuẩn
- `public/data/baotri-config.json` là nguồn danh mục chuẩn do chủ hệ thống quản lý.
- Danh mục chuẩn gồm cấu hình Plan, ngành nghề, nhóm thiết bị, từ điển thiết bị/tên gọi tương đương, mã rút gọn và quy tắc sinh mã ID.
- Chủ hệ thống có thể bổ sung hoặc chỉnh sửa danh mục chuẩn. Mỗi lần phát hành cần tăng `dataVersion`; thay đổi cấu trúc dữ liệu mới cần cân nhắc tăng `schemaVersion`.

### 6.2. Khởi tạo danh mục cho khách hàng
- Khi một Organization bắt đầu thuê bao Plan, hệ thống tạo một bản sao độc lập (snapshot) từ danh mục chuẩn tại thời điểm khởi tạo, theo phạm vi Plan đó.
- Snapshot phải lưu thông tin nguồn tối thiểu: phiên bản danh mục chuẩn, Plan, thời điểm khởi tạo và Organization sở hữu.
- Sau khi khởi tạo, danh mục của Organization là dữ liệu riêng, không phải một liên kết động tới tệp chuẩn.

### 6.3. Khách hàng tự bổ sung
- Khách hàng được phép thêm nhóm thiết bị, loại thiết bị, tên gọi tương đương và các mục tùy biến trong phạm vi quyền của Plan.
- Các mục tự bổ sung chỉ được lưu trong danh mục riêng của Organization đó; không ghi ngược vào `baotri-config.json` và không ảnh hưởng Organization khác.
- Việc thêm danh mục không được tự ý thay đổi ID của thiết bị đã cấp.

### 6.4. Khi chủ hệ thống cập nhật danh mục chuẩn
- Organization đã được khởi tạo tiếp tục sử dụng snapshot hiện có cùng các mục riêng đã bổ sung.
- Không tự động đồng bộ, ghi đè, đối chiếu, hợp nhất hoặc xóa dữ liệu của khách hàng hiện hữu.
- Organization đăng ký/khởi tạo mới sau thời điểm phát hành sẽ nhận danh mục chuẩn phiên bản mới.
- Không xây dựng cơ chế tự động hợp nhất danh mục trong phạm vi thiết kế hiện tại.

### 6.5. Lưu trữ và bảo đảm dữ liệu
- Tệp JSON chuẩn là nguồn khởi tạo; không dùng tệp JSON dùng chung làm nơi ghi dữ liệu khách hàng.
- Snapshot và các mục riêng của khách hàng được lưu trong kho dữ liệu của ứng dụng, phân vùng theo `organization_id`, tuân thủ kiến trúc Local/Cloud và chính sách đồng bộ của BAOTRI Mini.
- Mỗi Organization phải được cô lập dữ liệu; khách hàng này không được đọc hoặc sửa danh mục của khách hàng khác.
- Nâng cấp Plan không được làm mất mục riêng hoặc thay đổi ID đã cấp. Quyền sử dụng và giới hạn Plan được kiểm tra riêng với dữ liệu danh mục đã lưu.

## 7. Phạm vi danh mục chuẩn hiện tại và nguyên tắc mở rộng

### 7.1. Ngành nghề
- Plan A: 11 nhóm ngành phổ thông (A01–A11).
- Plan B: 10 nhóm ngành dịch vụ, thương mại, giáo dục, y tế, tòa nhà và xưởng nhỏ (B01–B10).
- Plan C: 11 nhóm ngành sản xuất, cơ khí, điện tử, hóa chất, dược, thực phẩm, logistics, nông nghiệp, thủy sản, vật liệu và khu công nghiệp (C01–C11).
- Plan D: 12 nhóm ngành công nghiệp chuyên sâu (D01–D12).
- Ngành nghề là ngữ cảnh gợi ý, không phải danh sách giới hạn thiết bị được phép khai báo.

### 7.2. Nhóm thiết bị
Danh mục hiện có các nhóm nền tảng: điện, cấp thoát nước, HVAC, PCCC, thang máy/thang cuốn, CNTT, an ninh/camera, máy phát điện, thiết bị sản xuất; các nhóm mở rộng gồm khí nén, hệ thống lạnh, CNC, băng tải/dây chuyền, máy nén khí, nhiệt/lò hơi, xử lý nước, xử lý khí thải; và nhóm chuyên sâu gồm phản ứng, chưng cất, phân ly, trộn, sấy, lọc, nghiền/băm, tuabin, máy nén công nghiệp, robot, PLC, đo lường/cảm biến.

### 7.3. Từ điển thiết bị
- Từ điển chuẩn cung cấp tên thiết bị, mã rút gọn, tên gọi tương đương và nhóm gợi ý.
- Danh mục ban đầu ưu tiên các thiết bị thường gặp trong tòa nhà, cơ sở dịch vụ, nhà xưởng và sản xuất công nghiệp; có thể tiếp tục mở rộng khi phát sinh loại thiết bị phổ biến còn thiếu.
- Không coi từ điển khởi tạo là danh sách đóng. Người dùng vẫn được khai báo thiết bị chưa có trong từ điển; Engine phải yêu cầu xác nhận khi không đủ căn cứ phân loại/mã hóa.
- Mã nhóm và mã thiết bị là hai trường độc lập. Mã nhóm có thể dài 2–4 ký tự; không được giả định mọi mã nhóm đều đúng 3 ký tự chỉ vì ký hiệu minh họa cũ là EFG.

### 7.4. Quy tắc bổ sung danh mục
- Mã danh mục phải duy nhất trong phạm vi loại danh mục tương ứng; không tái sử dụng mã đã phát hành cho mục khác.
- Trước khi thêm, kiểm tra trùng tên chuẩn, tên gọi tương đương, mã rút gọn và nhóm gợi ý.
- Không tự tạo mã rút gọn chỉ bằng cách cắt ký tự nếu có nguy cơ gây hiểu nhầm; trường hợp trùng mã phải được người quản trị chuẩn hóa.
- Bổ sung dữ liệu thông thường làm tăng `dataVersion`; chỉ thay đổi cấu trúc/ý nghĩa schema mới làm tăng `schemaVersion`.
- Mọi thay đổi danh mục chuẩn chỉ áp dụng cho snapshot được khởi tạo sau phiên bản đó; không hồi tố lên khách hàng hiện hữu.


---

**Lưu ý:** Tài liệu này ghi nhận phần phân chia gói và cấu trúc mã ID đã thống nhất ở bước thảo luận hiện tại. Chưa phải đặc tả triển khai kỹ thuật hoàn chỉnh; không tự ý thay đổi cơ sở dữ liệu, migration hoặc mã nguồn chỉ dựa trên tài liệu này.


## 10. Quy tắc đổi Plan và thiết bị đã được cấp mã (22/11/2026)

### 10.1. Nguyên tắc bất biến
- Khi Organization nâng cấp hoặc hạ cấp Plan, mọi thiết bị đã được cấp mã trước thời điểm đổi Plan giữ nguyên UUID, mã quản lý, mã thành phần tại thời điểm cấp và toàn bộ lịch sử.
- Không sinh lại mã, không đổi mã hàng loạt, không xóa, không khóa và không làm mất khả năng quản lý/bảo trì thiết bị cũ chỉ vì thay đổi Plan.
- Plan hiện hành chỉ chi phối việc tạo thiết bị mới sau thời điểm Plan mới có hiệu lực.

### 10.2. Thiết bị tạo mới sau khi đổi Plan
- Thiết bị được tạo sau thời điểm nâng cấp áp dụng cấu trúc mã, nhóm, cơ sở, từ điển và hạn mức của Plan mới.
- Thiết bị được tạo sau thời điểm hạ cấp áp dụng quy tắc của Plan thấp hơn đang có hiệu lực.
- Mỗi hồ sơ giữ snapshot thành phần cấp mã và Plan tại thời điểm cấp; không suy diễn lại mã cũ từ Plan hiện tại.
- Thời điểm hiệu lực Plan phải được ghi nhận để xử lý đúng các yêu cầu cấp mã đang chờ hoặc gửi đồng thời khi đổi Plan.

### 10.3. Hạ cấp khi đang vượt hạn mức
- Nếu số thiết bị hiện có lớn hơn hạn mức Plan mới, giữ nguyên toàn bộ hồ sơ và quyền xem/sửa/bảo trì theo quyền nghiệp vụ.
- Hiển thị cảnh báo vượt hạn mức.
- Không cho tạo thêm thiết bị mới cho đến khi số lượng thiết bị được tính theo chính sách hạn mức nằm trong giới hạn mới.
- Không tự xóa, lưu kho, khóa hoặc đổi mã thiết bị để ép số lượng xuống hạn mức.

### 10.4. Quy trình quản trị Plan
- Admin doanh nghiệp xem Plan hiện tại và gửi yêu cầu nâng cấp/hạ cấp Plan.
- Super Admin tiếp nhận, xác nhận điều kiện thương mại/thanh toán và là người áp dụng Plan mới.
- Ghi lịch sử Plan cũ, Plan mới, người yêu cầu, người duyệt, thời điểm yêu cầu và thời điểm hiệu lực.
- Việc áp dụng Plan không được làm mất danh mục riêng của Organization hoặc dữ liệu thiết bị hiện có.
- Không tự ý thay đổi Plan hoặc Snapshot của tổ chức thật trong lúc chưa có yêu cầu/phê duyệt cụ thể.

## 11. Đổi tên doanh nghiệp và lịch sử
- Admin của Organization được đề xuất có quyền sửa tên hiển thị doanh nghiệp trong thông tin doanh nghiệp.
- Chỉ cập nhật `organizations.name`; không thay đổi `organization_id`, Auth account, membership, mã thiết bị, lịch sử bảo trì hoặc dữ liệu liên quan.
- Ghi lịch sử tên cũ, tên mới, người thực hiện và thời điểm thay đổi.
- Không coi đổi tên doanh nghiệp là tạo Organization mới.

## 12. Thiết bị từ nơi khác chuyển đến khi thêm vào hệ thống (22/11/2026)

### 12.1. Lựa chọn trong quy trình thêm thiết bị
- Bổ sung lựa chọn loại hồ sơ: **Thiết bị mới** hoặc **Nơi khác chuyển đến**.
- Khi chọn **Nơi khác chuyển đến**, yêu cầu khai báo nơi/khu vực tiếp nhận (ví dụ Khu 2) và thông tin nguồn chuyển đến để truy vết.
- Mã quản lý mới của hệ thống được sinh theo quy tắc Plan hiện hành và khu vực/cơ sở tiếp nhận; không lấy bộ đếm của khu vực nguồn.
- Tên hiển thị có dấu `*` ở cuối để nhận biết thiết bị chuyển từ nơi khác đến. Tên gốc/tên chuẩn vẫn được lưu riêng, không chèn dấu `*` vào dữ liệu dùng để phân tích mã.
- Lưu nguồn chuyển đến, khu vực tiếp nhận, người ghi nhận và thời điểm tiếp nhận trong lịch sử.

### 12.2. Bảo toàn định danh
- Nếu đây là thiết bị được đưa từ ngoài phạm vi quản lý của Organization vào hệ thống, UUID nội bộ được tạo cho hồ sơ mới; mã quản lý nội bộ được cấp theo Plan và khu vực tiếp nhận. Mã/serial cũ ở nơi chuyển đi (nếu có) chỉ lưu như thông tin nguồn tham chiếu, không thay thế mã nội bộ.
- Nếu thiết bị đang được quản lý trong cùng Organization và chuyển từ Khu 1 sang Khu 2: giữ nguyên UUID/định danh hồ sơ gốc, nhưng **cấp mã quản lý mới theo quy tắc của khu vực tiếp nhận (Khu 2)**. Mã quản lý trước khi chuyển phải được lưu trong lịch sử để tra cứu, không ghi đè mất dấu vết.
- Tên hiển thị được thêm dấu `*` ở cuối để nhận biết thiết bị đã chuyển đến; tên chuẩn/originalName vẫn giữ nguyên, dấu `*` chỉ là quy ước hiển thị.
- Lịch sử phải có một dòng ghi chú rõ ràng theo mẫu: **“Thiết bị được chuyển từ [khu vực nguồn] tới [khu vực tiếp nhận]”**, kèm thời điểm và người thực hiện.
- Mã quản lý mới được sinh theo Plan đang có hiệu lực và quy tắc mã của khu vực tiếp nhận. Việc cấp mã mới do chuyển khu vực là ngoại lệ nghiệp vụ có chủ đích; không thay đổi UUID gốc hoặc lịch sử thiết bị.

### 12.3. Phạm vi triển khai
- Trường dữ liệu hiện có `transferredFromOtherFacility` mới chỉ là cờ boolean; chưa đủ để lưu lịch sử nơi nguồn/nơi nhận và phân biệt thiết bị ngoài Organization với thiết bị di chuyển nội bộ.
- Khi triển khai cần bổ sung mô hình dữ liệu lịch sử chuyển đến/chuyển khu vực và đồng bộ Local-first → Cloud tương ứng; không chỉ sửa tên hiển thị hoặc dùng ghi chú thay cho lịch sử có cấu trúc.
- Cần bảo đảm tương thích dữ liệu thiết bị cũ, payload Cloud, RPC mutation và luồng khóa chỉnh sửa hiện tại.
