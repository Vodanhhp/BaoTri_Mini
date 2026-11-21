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


## 9. Cập nhật 21/11/2026 – hoàn thiện bước đầu nghiệp vụ Thiết bị

Đã cập nhật trực tiếp trên nhánh main:

- `src/db.ts`: bổ sung AssetStatus theo mô hình tham chiếu gồm Đang hoạt động, Đang sửa chữa, Ngừng sử dụng, Thanh lý; bổ sung cycle, cycleStartedAt, transferredFromOtherFacility, images và archivedAt.
- Dexie nâng từ version 1 lên version 2; migration bổ sung trường mặc định cho dữ liệu Local cũ và ánh xạ trạng thái cũ Hỏng/Tạm dừng sang Đang sửa chữa.
- `src/App.tsx`: bổ sung lọc kết hợp nhóm/vị trí/trạng thái, sắp xếp theo cập nhật/mã/tên/ngày sử dụng, nút đặt lại bộ lọc.
- Tách Lưu kho khỏi trạng thái vận hành bằng archivedAt; có danh sách Lưu kho và thao tác Khôi phục.
- Bỏ thao tác xóa cứng khỏi giao diện để tránh mất hồ sơ thiết bị; mã thiết bị vẫn phải duy nhất kể cả khi hồ sơ đang lưu kho.
- Biểu mẫu bổ sung chu kỳ bảo trì và cờ thiết bị chuyển từ cơ sở khác.
- Đối chiếu mã nguồn gốc xác nhận mô hình vòng đời dùng Đang hoạt động/Đang sửa chữa/Ngừng sử dụng/Thanh lý, còn Lưu kho là cờ lưu trữ riêng. Quy ước mã quản lý có cấu trúc ABC-ABXY-xxx-BB-MM-YY; chưa tự động sinh mã vì danh mục mã loại, cơ sở và vị trí cần cấu hình/được chốt trước.

Commit cập nhật:
- `5efe31e73505b5a5d714ddf8e833331db09df09f` – mô hình dữ liệu và migration.
- `a95a71cb344b5db2950d7eddd30a8c031d9e196e` – giao diện danh mục, bộ lọc và lưu kho/khôi phục.

### Việc còn lại / giới hạn kiểm thử
- Chưa xác nhận build TypeScript/Vite. Đã thử clone repo để chạy build trong môi trường hiện tại nhưng không truy cập được github.com do DNS/network; GitHub commit status hiện trả danh sách statuses rỗng. Không đánh dấu build PASS.
- Chưa chạy kiểm thử trực tiếp trên trình duyệt PC/mobile.
- Chưa có trang chi tiết thiết bị, quản lý ảnh, QR/in tem, Excel/in danh sách.
- Chưa triển khai bộ danh mục ABC/ABXY/BB và cơ chế sinh mã; không được hard-code các ví dụ HP01/BB demo thành cấu hình thật.
- Chưa cấu hình Supabase riêng; dữ liệu Local vẫn chưa phân vùng theo user và chưa đồng bộ Cloud.


## 10. Cập nhật 21/11/2026 – chi tiết hồ sơ và ảnh thiết bị

Đã cập nhật trực tiếp trên nhánh `main`:

- `src/App.tsx`: nhấp vào mã/tên thiết bị trong danh sách để mở cửa sổ Chi tiết thiết bị.
- Cửa sổ chi tiết hiển thị mã, tên, nhóm, vị trí, hãng, model, serial, công suất/thông số, ngày sử dụng, chu kỳ bảo trì, thông tin chuyển cơ sở, trạng thái, ngày lưu kho và ghi chú.
- Có thao tác đi từ chi tiết sang chỉnh sửa hồ sơ.
- Biểu mẫu thêm/sửa hỗ trợ tối đa 6 ảnh cho mỗi thiết bị; ảnh được thu nhỏ về cạnh dài tối đa 1400px, chuyển JPEG và lưu dạng data URL trong IndexedDB trên trình duyệt hiện tại.
- Có xem ảnh lớn bằng cách mở ảnh trong tab mới; có thể xóa ảnh khỏi biểu mẫu trước khi lưu.
- `src/style.css`: bổ sung bố cục chi tiết, lưới ảnh và CSS responsive cho màn hình nhỏ.

Commit:
- `d01ed6f5affac0a0c849d0ff89c7222fd042b67f` – cửa sổ chi tiết và quản lý ảnh.
- `0e21272b5f33404776bac7c4b83351dfb674cdca` – giao diện chi tiết và thư viện ảnh.

### Giới hạn cần nhớ
- Ảnh hiện lưu Local trong IndexedDB, không đồng bộ sang máy khác và có thể bị mất nếu người dùng xóa dữ liệu trình duyệt. Chưa dùng Supabase Storage.
- Chưa có kiểm thử build hoặc trình duyệt được xác nhận trong phiên này; chưa đánh dấu nghiệm thu.
- Chưa làm QR, in tem, Excel, cấp mã tự động hoặc cấu hình danh mục mã.


## 11. Cập nhật 21/11/2026 – đối chiếu và hoàn thiện biểu mẫu thiết bị

Đã đối chiếu trực tiếp component `AssetModal` trong repository gốc với biểu mẫu của repository mới.

Đã bổ sung vào biểu mẫu dự án mới:
- Nhóm thiết bị chuyển từ ô nhập tự do sang danh mục chọn theo các nhóm ngành giống danh mục chuẩn trong bản gốc; hồ sơ cũ có tên nhóm ngoài danh mục vẫn được giữ và hiển thị như giá trị cũ để không làm mất dữ liệu.
- Chu kỳ bảo trì chuyển sang danh sách chọn: Hàng ngày, Hàng tuần, Hàng tháng, Hàng quý, Hàng năm; giá trị cũ ngoài danh sách vẫn được giữ.
- Cờ thiết bị chuyển từ cơ sở khác chuyển sang checkbox, thao tác gần với biểu mẫu gốc.
- Giới hạn ảnh tăng từ 6 lên 8 ảnh/hồ sơ, khớp giới hạn của bản gốc. Cơ chế nén ảnh và lưu Local hiện tại vẫn được giữ.

Chưa triển khai trong lượt này:
- Tạo nhóm/loại thiết bị tùy chỉnh và lưu danh mục riêng.
- Tự động cấp mã theo ABC-ABXY-xxx-BB-MM-YY, vì danh mục mã loại/cơ sở/vị trí và quy tắc cấp mã phải được chốt riêng; không tự suy diễn mã cơ sở.
- Chọn danh mục vị trí có mã BB.
- In chi tiết thiết bị, in tem QR, quét QR, xuất Excel và in danh sách.
- Chuyển ảnh lên Supabase Storage.

Commit:
- `df24bd36e4391e96236a7aaa64b49e969ae26152` – đồng bộ danh mục nhóm, chu kỳ và giới hạn ảnh theo biểu mẫu gốc.

Kiểm thử:
- Đã ghi thay đổi lên GitHub nhánh `main`.
- Chưa xác nhận build TypeScript/Vite hoặc kiểm thử trình duyệt. Không đánh dấu PASS/nghiệm thu cho đến khi có kết quả CI hoặc chạy thực tế.


## 12. Cập nhật 21/11/2026 – QR và in hồ sơ thiết bị

Đã bổ sung bước đầu chức năng QR/in trực tiếp trong cửa sổ Chi tiết thiết bị:
- Hiển thị QR được tạo từ mã quản lý hiện có; không tự sinh hoặc thay đổi mã quản lý.
- Có nút In tem QR theo kích thước tem 50 × 30 mm đã có CSS in của giao diện tham chiếu.
- Có nút In chi tiết thiết bị, gồm thông tin nhận diện, kỹ thuật, trạng thái và QR.
- Bổ sung dependency `qrcode.react` trong `package.json`.

Giới hạn:
- QR hiện mã hóa trực tiếp chuỗi mã quản lý; chưa phải luồng QR định danh bằng UUID hoặc URL tra cứu có xác thực.
- Chưa có chức năng quét QR trong dự án mới.
- Chưa có cơ chế cấp mã quản lý tự động; mã hiện vẫn do người dùng nhập.
- Chưa kiểm thử bản in thực tế trên máy in tem; cần kiểm tra kích thước, lề và độ nét sau khi chạy ứng dụng.

Commit:
- `03e531d6076608187a9810090ad23c9e7806bdcf` – thêm dependency QR.
- `1bc2f79c2fd852794ad8e381640948423d40d93f` – thêm QR và in chi tiết/tem trong cửa sổ hồ sơ.


## 13. Cập nhật 21/11/2026 – bổ sung người tạo hồ sơ

- Đối chiếu cửa sổ chi tiết gốc cho thấy còn trường “Người thêm”.
- Bổ sung `createdByLabel` dạng tùy chọn vào kiểu Asset; dữ liệu Local cũ không có trường này vẫn đọc bình thường.
- Khi tạo hồ sơ mới, ứng dụng ghi email tài khoản đang đăng nhập làm người thêm; khi sửa hồ sơ, giữ nguyên người tạo ban đầu.
- Cửa sổ Chi tiết thiết bị hiển thị trường Người thêm.

Commit:
- `92a26aca3242a678aa3ee5b0486b264be3e30978` – bổ sung metadata người tạo.
- `7db24870ae888a5defe15907ed10af3618f9992b` – hiển thị người thêm trong chi tiết.


## 14. Cập nhật 21/11/2026 – sửa đường dẫn và bổ sung triển khai GitHub Pages

Nguyên nhân trang trắng khi mở URL GitHub Pages:
- Dự án dùng Vite nhưng chưa khai báo base path phù hợp khi phục vụ dưới đường dẫn con hoặc domain riêng.
- Workflow trước đó chỉ build kiểm tra, chưa upload artifact và deploy lên GitHub Pages.
- Repository có file `CNAME` trỏ tới domain riêng `baotri.vieclamhp247.com`.

Đã cập nhật:
- `vite.config.ts`: đặt `base: './'` để asset dùng đường dẫn tương đối, phù hợp cả URL GitHub Pages dạng project path và domain riêng.
- Thêm `.github/workflows/pages.yml`: build ứng dụng, giữ file CNAME trong thư mục dist, upload Pages artifact và deploy khi có push lên main hoặc chạy thủ công.

Lưu ý:
- GitHub Pages cần đặt Publishing source là **GitHub Actions** trong Settings → Pages nếu repository chưa chọn nguồn này.
- Chưa xác nhận website đã hiển thị sau deploy; cần đợi workflow Pages hoàn tất và kiểm tra URL.
- Workflow CI build kiểm tra và workflow deploy Pages là hai luồng riêng.
