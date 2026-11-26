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


## 15. Cập nhật 21/11/2026 – chế độ xem thử Local khi chưa cấu hình Supabase

Người dùng đã clone repository mới về máy và chạy được Vite; màn hình hiện thông báo chưa có cấu hình Supabase. Vì màn hình đăng nhập đang chặn toàn bộ phần Thiết bị khi chưa có Supabase project riêng, đã bổ sung lối vào thử nghiệm chỉ dành cho môi trường phát triển:

- src/AuthScreen.tsx: khi chưa có Supabase và ứng dụng chạy bằng Vite development server, hiển thị nút **Vào chế độ xem thử Local**.
- src/App.tsx: chế độ này cho phép mở phân hệ Thiết bị và đọc/ghi IndexedDB trên trình duyệt hiện tại; hiển thị nhãn rõ ràng “Chế độ thử nghiệm Local” / “Không kết nối Cloud”.
- Hồ sơ tạo trong chế độ này ghi người thêm là “Chế độ thử nghiệm Local” nếu không có email đăng nhập.
- Nút xem thử được điều kiện hóa bằng import.meta.env.DEV; không xuất hiện trong bản build triển khai/Production. Không tạo tài khoản giả, không bỏ qua xác thực Supabase khi có cấu hình, không bật đồng bộ Cloud.

Commits:
- f23310f35dca48fc54e1a6c3dbc723ec7787d430 – thêm trạng thái xem thử Local trong luồng ứng dụng.
- 8ac0fcb0e2ad0bb201cca31407eaf49da7853687 – chỉ hiển thị lối vào thử nghiệm trong development.

Kiểm thử:
- Đã ghi thay đổi lên GitHub nhánh main.
- Chưa chạy build TypeScript/Vite sau thay đổi này và chưa kiểm thử trực tiếp trên trình duyệt. Người dùng cần Pull cập nhật về máy rồi khởi động lại Vite để kiểm tra.
- Chế độ Local chỉ phục vụ kiểm thử giao diện/nghiệp vụ trên máy hiện tại; chưa thay thế đăng nhập thật.


## 16. Cập nhật 25/11/2026 – triển khai bước đầu phân hệ Bảo dưỡng – Sửa chữa

Người dùng yêu cầu tạm gác Checklist, ưu tiên khảo sát và chuyển phân hệ Bảo dưỡng – Sửa chữa từ repository tham chiếu `Vodanhhp/DuAn_BaoTRi` sang `Vodanhhp/BaoTri_Mini`.

### Kết quả khảo sát repository tham chiếu

- Đã đối chiếu `src/App.tsx`, `src/db.ts` và các luồng liên quan của dự án cũ.
- Phân hệ cũ gồm Phiếu YC Bảo dưỡng – Sửa chữa, lịch bảo dưỡng định kỳ, trạng thái hoàn thành, người yêu cầu/người hoàn thành, lịch sử chỉnh sửa, cảnh báo phiếu chưa hoàn thành tại Công việc hôm nay và xuất dữ liệu.
- Phiếu YC được gắn với assetId của hồ sơ thiết bị; không phải một danh sách công việc độc lập.
- Phát hiện mapper Cloud ở dự án cũ đang từ chối một số trường nghiệp vụ (dueDate, requestedBy, editHistory) do schema Cloud chưa hỗ trợ đầy đủ. Không sao chép mù luồng đồng bộ cũ.

### Đã triển khai trên nhánh `feat/maintenance-repair-module`

- Tạo `src/MaintenancePanel.tsx`: giao diện Phiếu YC, lịch bảo dưỡng định kỳ, lọc trạng thái, cập nhật kết quả hoàn thành, lịch sử thao tác và xuất CSV mở được bằng Excel.
- Bổ sung `MaintenanceDashboardSummary`: các Phiếu YC chưa hoàn thành luôn được đưa lên khu vực Công việc hôm nay với cảnh báo đỏ; mở nhanh phân hệ Bảo dưỡng – Sửa chữa.
- `src/db.ts`: bổ sung các kiểu `MaintenanceRequest`, `MaintenanceTask`, `MaintenanceHistory` và Dexie version 12 với ba kho Local phân vùng theo organizationId.
- `src/App.tsx`: bổ sung menu Bảo dưỡng – Sửa chữa; nối phân hệ với danh sách thiết bị và tổ chức hiện chọn; quyền thao tác giới hạn Admin/KTV theo quyền thao tác hiện có, Viewer chỉ xem. Cửa sổ chi tiết thiết bị có mục Lịch sử Bảo dưỡng – Sửa chữa.
- `src/style.css`: bổ sung bố cục responsive và nhấn cảnh báo đỏ cho phiếu đang mở.
- Lịch sử tạo/sửa/đổi trạng thái/hoàn thành được ghi trong maintenanceHistory; không xóa cứng phiếu.

### Giới hạn và nguyên tắc an toàn

- Đây là bước Local-first. Dữ liệu bảo dưỡng hiện lưu trong IndexedDB trên trình duyệt hiện tại; chưa đồng bộ sang máy khác/Cloud.
- Chưa tạo migration, bảng, RPC, RLS, Auth, Storage hoặc thay đổi dữ liệu trên bất kỳ Supabase project nào.
- Chưa thay đổi dữ liệu hay mã nguồn repository cũ.
- Chưa merge PR và chưa deploy Production.
- GitHub Actions trên PR #61: Build and test SUCCESS (run `45546990229`): 188/188 unit tests PASS, TypeScript (`tsc -b`) PASS, Vite production build PASS. Validate BAOTRI Mini SUCCESS (run `45546990449`).
- Chưa kiểm thử trực tiếp trên trình duyệt PC/mobile; chưa xác nhận trải nghiệm thực tế hoặc dữ liệu trên nhiều thiết bị.
- Cần kiểm thử riêng: phân quyền Viewer, tenant isolation, tạo/sửa/hoàn thành Phiếu YC, lịch định kỳ, lịch sử, cảnh báo dashboard, ngày quá hạn và xuất CSV.

### Việc tiếp theo

1. Chạy CI build/test trên Pull Request; xử lý lỗi nếu có.
2. Review toàn bộ dữ liệu Local và luồng đồng thời, đặc biệt bảo đảm transaction ghi phiếu và lịch sử.
3. Kiểm tra thực tế giao diện trên PC/mobile, tenant isolation và quyền Viewer/Admin/KTV.
4. Thiết kế hợp đồng Cloud riêng cho maintenance requests/tasks/history; chỉ triển khai sau khi người dùng duyệt migration và chính sách đồng bộ.
5. Chờ người dùng kiểm tra giao diện và phê duyệt riêng trước khi merge.


## 17. Cập nhật 25/11/2026 – merge phân hệ Bảo dưỡng – Sửa chữa vào main

Người dùng xác nhận dự án hiện vẫn trong giai đoạn xây dựng, chưa đưa vào vận hành; thống nhất ưu tiên đưa phân hệ lên bản chính thức để tiếp tục hoàn thiện và sửa lỗi phát sinh, không cần dựng thêm một vòng kiểm thử nhánh riêng trước khi merge.

- PR #61 `feat: add maintenance and repair workspace` đã được squash-merge vào `main` theo xác nhận của người dùng.
- Merge commit: `993e3228230ff452a45e71868b079c736b9c2236`.
- Phạm vi merge: phân hệ Bảo dưỡng – Sửa chữa Local-first, lịch bảo dưỡng định kỳ, lịch sử thao tác, liên kết hồ sơ thiết bị và menu phân hệ.
- GitHub Actions trước merge: Build/Test PASS (188/188 unit tests; TypeScript và Vite build PASS); Validate BAOTRI Mini PASS.
- Không có migration hoặc thay đổi Supabase/Cloud trong PR; dữ liệu phân hệ hiện vẫn chỉ nằm trong IndexedDB trên trình duyệt đang sử dụng, chưa đồng bộ giữa thiết bị.
- Chưa xác nhận website GitHub Pages đã hoàn tất cập nhật sau merge; cần theo dõi workflow deploy và kiểm tra URL thực tế.
- Từ nay tiếp tục sửa lỗi trực tiếp theo phản hồi khi người dùng chạy ứng dụng; không tự ý thay đổi schema, dữ liệu, Auth, RLS, Storage hoặc bật đồng bộ Cloud nếu chưa được duyệt riêng.


## 18. Cập nhật 25/11/2026 – rà soát và gia cố phân hệ Bảo dưỡng – Sửa chữa

Sau khi người dùng xác nhận giao diện đã khá đồng bộ, rà soát mã nguồn trên `main` phát hiện một rủi ro bất đồng bộ ở `MaintenancePanel`: truy vấn IndexedDB của tổ chức cũ có thể hoàn tất sau khi người dùng chuyển tổ chức và ghi đè dữ liệu đang hiển thị.

Đã sửa trực tiếp trên `main`:
- `src/MaintenancePanel.tsx`: gắn hiệu lực của từng lượt tải với vòng đời tổ chức đang chọn; kết quả truy vấn cũ bị bỏ qua sau khi component đổi tổ chức hoặc unmount. Gộp listener cập nhật dữ liệu vào cùng effect để cùng được hủy khi đổi tổ chức.
- `scripts/maintenanceModule.test.mjs`: bổ sung kiểm tra hồi quy cho guard chống kết quả IndexedDB cũ ghi đè dữ liệu của tổ chức mới.
- Không thay đổi nghiệp vụ, schema IndexedDB, dữ liệu thiết bị/vật tư, Supabase, Auth, RLS, Storage hoặc Cloud Sync.

Commits:
- `0f58d3ed76848a3916cad97cf6de4192d4e4ceb6` – sửa stale reads khi chuyển tổ chức.
- `a683b373938d73468db6fec56cfeba9ee334d86f` – bổ sung test hồi quy.
- `01dc908e51e023bb43e9b0b03dac9f62c3974128` – chỉnh biểu thức test theo định dạng mã nguồn.

Kiểm tra:
- GitHub Actions Build and test run `45548710420`: SUCCESS; unit tests và build đều PASS.
- GitHub Pages deploy run `45548710373`: đã qua các bước Build, xác minh cấu hình Supabase client, giữ CNAME và upload Pages artifact; đang chờ trạng thái kết thúc của workflow.
- Chưa kiểm thử trực tiếp trên trình duyệt PC/mobile hoặc xác minh tương tác thực tế trên website trong lượt rà soát này.

## 19. Cập nhật 25/11/2026 – xuất Excel đúng định dạng trong phân hệ Bảo dưỡng – Sửa chữa

Theo xác nhận của người dùng, chức năng xuất dữ liệu của phân hệ Bảo dưỡng – Sửa chữa phải tạo tệp Excel thực sự (`.xlsx`), không dùng CSV rồi đặt nhãn gây nhầm lẫn.

- `src/MaintenancePanel.tsx`: sử dụng dependency ExcelJS đã có trong dự án để tạo workbook `.xlsx` cho cả Phiếu YC và Lịch bảo dưỡng định kỳ.
- Tệp có hàng tiêu đề được định dạng, bật bộ lọc và cố định hàng đầu; tên tệp lần lượt là `phieu-bao-duong-sua-chua.xlsx` và `lich-bao-duong-dinh-ky.xlsx`.
- Đổi nhãn thao tác thành **Xuất Excel**; không còn xuất CSV trong hai chức năng này.
- `scripts/maintenanceModule.test.mjs`: thêm kiểm tra xác nhận dùng ExcelJS, MIME type XLSX, phần mở rộng `.xlsx` và không còn đường xuất CSV.
- Không thay đổi dữ liệu Local, schema IndexedDB, Supabase, Auth, RLS, Storage hoặc Cloud Sync.

Commits:
- `9502f9809fe2c21ff76a38462e03494ce3cddcc5` – xuất workbook Excel thật.
- `dfb0b938cc81a3245cbbb1335ca56329c5fdfbf4` – bổ sung kiểm tra hồi quy cho định dạng XLSX.

Kiểm tra:
- Tại thời điểm ghi nhận, GitHub chưa trả về status check cho commit kiểm thử mới; chưa đánh dấu CI PASS.
- Chưa kiểm tra thao tác tải và mở file trên trình duyệt/Excel thực tế.


## 20. Cập nhật 25/11/2026 – Chuẩn hóa in phiếu và xuất Excel phân hệ Bảo dưỡng – Sửa chữa

- Thêm nút **In phiếu** theo từng Phiếu YC; bản in riêng khổ A4 dọc, 14 mm lề, hiển thị tên doanh nghiệp, mã phiếu, ngày yêu cầu, thông tin thiết bị, nội dung, thông số, vật tư/phụ tùng, kết quả và bốn khu vực ký xác nhận.
- Phiếu in chỉ xuất hiện trong chế độ in; không in giao diện danh sách hoặc các nút thao tác. Tên doanh nghiệp lấy từ tổ chức đang chọn.
- Loại bỏ bộ tạo Excel riêng của phân hệ. Hai chức năng xuất lịch định kỳ và Phiếu YC dùng chung `src/lib/excelExport.ts` như tab Vật tư/Thiết bị: banner tiêu đề, ngày xuất, tổng bản ghi, STT, định dạng bảng, lọc, cố định tiêu đề, thiết lập giấy A4 ngang và chân trang số trang.
- Xuất Phiếu YC theo bộ lọc trạng thái đang hiển thị; lịch định kỳ xuất toàn bộ lịch của tổ chức hiện tại.
- Bổ sung source test cho nút in, bố cục chữ ký và việc tái sử dụng exporter chung. Chưa xác nhận tải file thực tế, xem trước/in A4 trên trình duyệt hoặc kiểm tra bản in vật lý.
- Thay đổi đang ở nhánh `feat/maintenance-print-and-standard-excel`; chưa merge vào `main`, chưa thay đổi Supabase.


## 21. Cập nhật 25/11/2026 – sửa bố cục mobile phân hệ Bảo dưỡng – Sửa chữa

Người dùng gửi ảnh chụp giao diện trên điện thoại và phản ánh bố cục bị lỗi nặng. Đã đối chiếu CSS thực tế và xác định nguyên nhân:
- Bộ CSS dùng chung `#root .app-shell .table-wrap > table.table-standard` đặt `min-width:0` và `table-layout:fixed`, ghi đè quy tắc `.maintenance-table{min-width:1060px}` có độ ưu tiên thấp hơn.
- Vì bảng Phiếu YC có 10 cột, trình duyệt ép các tiêu đề thành từng ký tự dọc, làm bảng gần như không thể đọc.
- CSS mobile dùng chung ép `.top-actions .primary-btn` thành nút vuông 40px; quy tắc này làm chữ “Tạo Phiếu” tràn và chồng lên nút Xuất Excel.

Đã sửa trên nhánh `fix/maintenance-mobile-layout`:
- Khôi phục chiều rộng nội tại tối thiểu 1060px cho bảng bảo dưỡng, chuyển về `table-layout:auto`, giữ cuộn ngang trên mobile; tiêu đề không bị bẻ từng ký tự.
- Thêm chỉ dẫn vuốt ngang để người dùng biết còn cột ở ngoài màn hình.
- Riêng nhóm nút của phân hệ chuyển sang lưới hai cột, đủ chiều cao chạm, không bị rule nút vuông toàn cục ghi đè.
- Hai tab Phiếu YC/Lịch định kỳ chia đều chiều rộng; bộ lọc trạng thái co giãn theo màn hình.
- Bổ sung test hồi quy kiểm tra CSS responsive của bảng, tiêu đề, nhóm nút và tab.

Giới hạn: thay đổi mới ở nhánh sửa lỗi; chưa merge/deploy, chưa chạy browser thật trên điện thoại. Không thay đổi dữ liệu Local, IndexedDB schema, Supabase hoặc Cloud Sync.


### Trạng thái hoàn tất PR #63 – cập nhật sau merge

- PR #63 `fix: repair maintenance module mobile layout` đã được squash-merge vào `main` theo yêu cầu hoàn tất của người dùng.
- Merge commit: `dbe4ac8648a69486701dec58f99e0bfe832dca75`.
- CI trên PR head `491230baf144bb3bba79a7f4e72b71cc2499b064`: Build and test run `45594803640` SUCCESS (Unit tests PASS, Build PASS); Validate BAOTRI Mini run `45594803441` SUCCESS (npm ci và npm run build PASS).
- Thay đổi CSS và test đã nằm trên `main`; không thay đổi dữ liệu Local, IndexedDB schema, Supabase, Auth, RLS, Storage hoặc Cloud Sync.
- Merge đã hoàn tất. Chưa có bằng chứng workflow deploy GitHub Pages sau merge đã chạy xong; cũng chưa kiểm tra browser thật hoặc giao diện trên điện thoại. Cần xác minh trạng thái deploy riêng, sau đó người dùng kiểm tra lại mobile thực tế.



## 22. Cập nhật 25/11/2026 – Công cụ dữ liệu thử nghiệm trong Superadmin (PR #65)

### Đã phát hành
- PR #65 đã squash-merge vào `main`, merge commit: `8e79f26e74ab19dd84716afa6decaed8a3c41af9`.
- Migration `20261125115908_platform_superadmin_data_tools.sql` đã áp dụng Production; migration history ghi nhận `20261125115908_platform_superadmin_data_tools`.
- Edge Function `platform-data-tools` đã deploy Production, version 1, trạng thái ACTIVE, `verify_jwt=true`.
- GitHub Actions trên PR head `a47405b0f769a5103e2a6e281bb5fd0b524e74f2`: Build/Test PASS, Validate PASS.
- Test project đã chạy SQL integration rollback cho Plan A/B/C/D; xác nhận cấp mã, asset history/sync feed/reservation, inventory receipt/sync event và audit.
- RPC chỉ cho `service_role` EXECUTE; `authenticated` và `anon` không có quyền.
- Kiểm tra Production sau triển khai: 1 asset, 0 inventory item, 0 seed run. Không tạo dữ liệu mẫu trên doanh nghiệp thật.

### Phạm vi công cụ
- Công cụ nằm trong workspace Superadmin, không xuất hiện trong workspace Admin doanh nghiệp.
- Chọn doanh nghiệp đang hoạt động; xem Plan, Catalog Snapshot, hạn mức và số lượng hiện tại.
- Tạo tối đa 30 thiết bị và/hoặc 30 vật tư mẫu.
- Thiết bị lấy loại/nhóm từ Catalog Snapshot của chính doanh nghiệp; cấp mã theo Plan A/B/C/D và sequence server-side.
- Tạo reservation đã xác nhận trước khi insert asset để đáp ứng trigger cấp mã Local-first.
- Vật tư dùng mã VT tiếp nối số lớn nhất; ghi inventory mutation receipt và sync event; tồn ban đầu bằng 0.
- Xác thực Superadmin qua email đã xác nhận và secret `PLATFORM_OWNER_EMAIL`; service-role key chỉ dùng server-side.
- Người tạo ghi là **Superadmin**; audit theo lượt; run ID chống tạo trùng khi retry.
- Không có bulk import vĩnh viễn cho Admin doanh nghiệp.

### Trạng thái còn cần xác minh
- Chưa xác minh giao diện bằng phiên đăng nhập Superadmin thực tế trên trình duyệt.
- Chưa chạy thao tác tạo dữ liệu thực tế trên một tenant được chỉ định; hiện không có seed run nào.
- GitHub Pages deployment sau khi merge và đồng bộ tên migration: workflow run `45609846305` **PASS** (build artifact và Deploy to GitHub Pages). Không thể xác minh giao diện bằng phiên đăng nhập Superadmin thực tế trong phiên làm việc này.
- Chưa triển khai công cụ tạo checklist hoặc các loại dữ liệu mở rộng.

**Lưu ý:** Migration và Edge Function đã được phát hành nhưng chưa tạo bất kỳ dữ liệu mẫu nào. Chỉ thực hiện tạo dữ liệu khi người dùng chọn rõ doanh nghiệp đích và xác nhận thao tác trong giao diện Superadmin.


## 23. Cập nhật 25/11/2026 – chuyển menu Báo cáo từ dự án tham chiếu

### Khảo sát dự án cũ (chỉ đọc)
- Đã đọc `Vodanhhp/DuAn_BaoTRi/src/App.tsx` và `src/style.css`; không sửa mã nguồn, dữ liệu, nhánh hoặc commit của repository cũ.
- Menu Báo cáo cũ gồm bộ chọn kỳ Tuần/Tháng/Quý/Năm và ba nhóm báo cáo:
  1. Công việc bảo trì/bảo dưỡng/sửa chữa đã hoàn thành trong kỳ.
  2. Vật tư đã xuất trong kỳ, số lượt xuất và tồn kho hiện tại.
  3. Tình trạng thiết bị hiện tại, nhấn mạnh thiết bị đang sửa chữa/hỏng.
- Có xuất Excel riêng cho từng nhóm; Viewer chỉ xem, không xuất.
- Quy tắc nguồn dữ liệu: vật tư sử dụng lấy từ giao dịch Xuất kho; không cộng ghi chú vật tư tự do trên Phiếu YC vào lượng xuất kho.
- Dự án cũ lấy báo cáo công việc từ nhật ký hoàn thành; dự án mới dùng `MaintenanceRequest` Local-first, chỉ tính Phiếu YC có trạng thái Hoàn thành và lọc theo ngày hoàn thành.

### Đã triển khai trên nhánh `feat/reports-menu`
- Thêm `src/ReportsPanel.tsx`: bộ lọc kỳ, tìm kiếm nội dung, báo cáo công việc, vật tư và tình trạng thiết bị.
- Dữ liệu truy vấn theo đúng `organizationId` từ IndexedDB Local; effect bỏ qua kết quả tải cũ khi chuyển tổ chức/unmount.
- Báo cáo công việc dùng Phiếu YC đã hoàn thành; báo cáo vật tư chỉ dùng `InventoryMovement.type === 'Xuất'`; tồn kho lấy số lượng hiện tại từ danh mục vật tư.
- Báo cáo thiết bị phản ánh các trạng thái hiện có của dự án mới, bao gồm Lưu kho; loại trừ hồ sơ lưu trữ/đã xóa mềm.
- Tái sử dụng `src/lib/excelExport.ts` để xuất XLSX thật; ẩn nút xuất với Viewer.
- Bổ sung menu Báo cáo cho tài khoản có quyền xem thiết bị hoặc kho; Viewer được xem nhưng không được xuất Excel.
- Bổ sung CSS responsive, bảng cuộn ngang trên mobile và test hồi quy `scripts/reportsModule.test.mjs`.
- Không thay đổi IndexedDB schema, dữ liệu Local, Supabase, Auth, RLS, Storage hoặc Cloud Sync.

### Trạng thái kiểm tra
- Đã tạo nhánh và ghi các thay đổi lên GitHub.
- CI Build/Test, TypeScript/Vite build, kiểm tra giao diện trên trình duyệt và kiểm tra file XLSX thực tế: **chưa xác nhận**.
- Chưa tạo PR, chưa merge vào `main`, chưa deploy GitHub Pages.


## 24. Cập nhật 25/11/2026 – chuyển báo cáo tình trạng thiết bị sang báo cáo hoạt động theo kỳ

### Thay đổi trên nhánh `feat/reports-equipment-activity`
- Thay báo cáo ảnh chụp trạng thái toàn bộ thiết bị bằng **Tình trạng thiết bị** theo hoạt động thực tế trong kỳ; thiết bị không có công việc hoàn thành trong kỳ không xuất hiện.
- Bộ chọn kỳ có Ngày, Tuần, Tháng, Quý, Năm; lọc theo ngày giờ Việt Nam (Asia/Ho_Chi_Minh).
- Nguồn hoạt động hiện có:
  - Phiếu YC Bảo dưỡng/Sửa chữa có trạng thái Hoàn thành.
  - Lịch bảo dưỡng định kỳ có trạng thái Hoàn thành.
- Mỗi dòng thể hiện ngày giờ, mã/tên thiết bị, loại hoạt động, nội dung, chi tiết/thông số, người thao tác xác nhận hoàn thành và kết quả.
- Người thực hiện được ưu tiên lấy từ lịch sử thao tác `maintenanceHistory.actorLabel`; Phiếu YC có thể dự phòng bằng `performedBy`. Lịch định kỳ lấy actor từ sự kiện lịch sử chuyển trạng thái sang Hoàn thành.
- Xuất Excel dùng chung exporter, giữ đầy đủ thời gian, thiết bị, nội dung, người thực hiện và kết quả.
- Hai báo cáo công việc bảo trì và vật tư vẫn được giữ nguyên; báo cáo thiết bị mới thay phần thống kê tổng số/trạng thái hiện tại.
- Truy vấn chỉ lấy dữ liệu Local theo organizationId; không sửa IndexedDB schema, dữ liệu, Supabase, Auth, RLS, Storage hoặc Cloud Sync.

### Giới hạn dữ liệu Checklist
- Hiện BAOTRI Mini chưa có phân hệ Checklist độc lập hoặc dữ liệu kết quả kiểm tra từng hạng mục.
- Báo cáo hiện chỉ hiển thị các bước công việc mô tả trong lịch bảo dưỡng định kỳ khi lịch được đánh dấu hoàn thành; không coi đó là kết quả Checklist từng mục và không tạo dữ liệu giả.
- Khi phân hệ Checklist độc lập được triển khai, cần bổ sung nguồn kết quả checklist, thời điểm kiểm tra và người kiểm tra vào báo cáo này.

### Kiểm tra
- Đã bổ sung source tests cho báo cáo hoạt động theo kỳ, nguồn Phiếu YC/lịch định kỳ, thời gian/người thực hiện/kết quả, lọc ngày và nguyên tắc không giả lập Checklist.
- PR #67: https://github.com/Vodanhhp/BaoTri_Mini/pull/67 (đang OPEN, chưa merge).
- Head commit hiện tại: `970220489eaefbcf36164017e3f0bbaa8bd7c498`.
- GitHub Actions Build and test run `45617994461`: SUCCESS; Unit tests PASS, TypeScript/Vite build PASS.
- Validate BAOTRI Mini run `45617994449`: SUCCESS (`npm ci` và `npm run build` PASS).
- GitHub Pages chưa deploy vì PR chưa merge.
- Chưa kiểm tra trực tiếp giao diện, dữ liệu Local thật hoặc file XLSX tải về.
- PR chưa merge; không thay đổi Supabase.


## 25. Cập nhật 25/11/2026 – bắt buộc ghi nhận kết quả trước khi hoàn thành Phiếu YC

- Trong Phiếu YC, thao tác **Hoàn thành** không còn xác nhận ngay bằng hộp thoại prompt. Hệ thống mở biểu mẫu kết quả sau xử lý.
- Người thực hiện bắt buộc nhập: người thực hiện; thông số sau sửa chữa/bảo dưỡng (có thể ghi nhiều thông số và đơn vị đo); tình trạng thiết bị sau sửa chữa/bảo dưỡng; kết quả Đạt/Không đạt.
- Chỉ lưu biểu mẫu hợp lệ mới chuyển Phiếu YC sang **Hoàn thành**. Nếu thiếu thông tin hoặc hủy biểu mẫu, phiếu vẫn ở trạng thái chưa hoàn thành và tiếp tục xuất hiện trong danh sách/cảnh báo.
- Giữ nguyên trường **Thông số ghi nhận** hiện có như thông tin ban đầu; bổ sung hai trường tùy chọn tương thích dữ liệu cũ: completionReadings và conditionAfterRepair. Không cần nâng phiên bản Dexie vì đây là thuộc tính của bản ghi, không phải index/store mới.
- Bản in, xuất Excel Phiếu YC và báo cáo hoạt động thiết bị bổ sung thông số sau xử lý và tình trạng thiết bị sau xử lý.
- Ghi nhận kết quả và lịch sử hoàn thành trong cùng transaction IndexedDB Local; không thay đổi Supabase, Auth, RLS, Storage hoặc Cloud Sync.
- Viewer vẫn chỉ xem; thao tác hoàn thành chỉ dành cho Admin/KTV theo quyền hiện tại.
- Đã bổ sung source test kiểm tra điều kiện bắt buộc; CI và kiểm thử giao diện thực tế cần được xác nhận riêng.


## 25/11/2026 – chuẩn hóa biểu mẫu in và xuất Excel

Đang triển khai trên nhánh `feat/standardize-print-excel-exports`, chưa merge và chưa triển khai website.

- Dùng chung mẫu Excel của Kho vật tư cho toàn bộ các điểm xuất: thiết bị, kho vật tư, Phiếu YC, lịch bảo dưỡng và các báo cáo.
- Bổ sung tên đơn vị vào phần đầu file Excel; sửa cách xác định chữ cột trong vùng in để hoạt động đúng cả khi bảng có trên 26 cột.
- Báo cáo công việc và báo cáo hoạt động thiết bị bổ sung người yêu cầu/người hoàn thành khi dữ liệu có; báo cáo công việc bổ sung thông số trước/sau và tình trạng sau xử lý.
- Đồng bộ các quy tắc in A4, font chữ, đầu trang, bảng, lặp tiêu đề bảng và chân trang cho phiếu vật tư, Phiếu YC và hồ sơ thiết bị. Tem QR vẫn giữ khổ tem riêng.
- GitHub Actions của PR #69: Validate BAOTRI Mini PASS; Build and test PASS (Unit tests và Build đều PASS).
- Chưa kiểm tra thực tế bằng Excel desktop, trình duyệt hoặc máy in; cần nghiệm thu giao diện và file đầu ra sau khi merge/deploy.


## 25/11/2026 – cải thiện độ rộng cột Excel Phiếu YC

- Trên nhánh `fix/excel-maintenance-column-layout`, điều chỉnh bộ xuất Excel dùng chung: đặt độ rộng ưu tiên cho các cột ngày, mã/tên thiết bị, nội dung, thông số, tình trạng sau xử lý, vật tư và người yêu cầu/người hoàn thành.
- Cột nội dung được nới rộng hơn; hai cột tên người được đặt độ rộng tối thiểu 22 để hạn chế tiêu đề và họ tên bị ép hẹp.
- Tăng chiều cao hàng tiêu đề để tiêu đề dài xuống dòng dễ đọc hơn; giữ nguyên dữ liệu, thứ tự cột, bộ lọc, cố định hàng và vùng in.
- Thay đổi nằm trong nhánh sửa lỗi, chưa tạo PR/merge/deploy. Chưa kiểm tra file XLSX thực tế bằng Excel desktop.


## 25/11/2026 – bổ sung báo cáo nhập – xuất vật tư theo kỳ

- Bổ sung phân hệ báo cáo vật tư trong mục Báo cáo, hiển thị theo bộ lọc kỳ Ngày/Tuần/Tháng/Quý/Năm đang dùng chung với báo cáo.
- Tổng hợp từ lịch sử giao dịch kho Local theo đúng organizationId: số lượng và số lượt Nhập; số lượng và số lượt Xuất; tồn kho hiện tại theo hồ sơ vật tư.
- Tách riêng giao dịch khởi tạo có lý do “Tồn đầu kỳ”, không cộng nhầm vào nhập kho thông thường.
- Tách riêng giao dịch “Điều chỉnh” kiểm kê; không cộng vào tổng Nhập/Xuất. Báo cáo có cột chênh lệch điều chỉnh để người xem đối chiếu.
- Có tìm kiếm theo mã/tên/nhóm vật tư và xuất Excel gồm nhập, xuất, tồn đầu kỳ ghi nhận, điều chỉnh, tồn hiện tại và vị trí lưu kho.
- Không tính nội dung vật tư ghi tự do trên Phiếu YC thành giao dịch xuất kho; không suy ngược nhập/xuất từ tồn hiện tại.
- Chỉ đọc dữ liệu Local; không sửa IndexedDB schema, dữ liệu nghiệp vụ, Supabase, Auth, RLS, Storage hoặc Cloud Sync.
- Đã bổ sung source tests cho tổng hợp Nhập/Xuất và nguyên tắc tách tồn đầu kỳ/điều chỉnh. Chờ CI xác nhận; chưa kiểm tra giao diện thực tế hoặc file XLSX bằng Excel desktop.


## 25/11/2026 – rà soát độ tương phản tiêu đề trong toàn bộ file Excel

- Rà soát tất cả điểm xuất XLSX trên ứng dụng: danh sách thiết bị; tồn kho vật tư; Phiếu YC; lịch bảo dưỡng định kỳ; báo cáo công việc; báo cáo tình trạng/hoạt động thiết bị; báo cáo nhập – xuất vật tư.
- Xác nhận các điểm xuất này đều gọi chung `src/lib/excelExport.ts`; không phát hiện bộ tạo XLSX riêng khác trong các module nghiệp vụ đã rà soát.
- Chuẩn hóa độ tương phản theo nguyên tắc: tiêu đề báo cáo nền xanh đậm dùng chữ trắng; tiêu đề cột nền xanh dùng chữ trắng. Áp dụng font và fill tường minh cho toàn bộ ô thuộc vùng tiêu đề đã gộp, tránh một số trình xem bảng tính lấy màu chữ mặc định/theme không đúng.
- Bổ sung source tests khóa màu chữ trắng, màu nền tiêu đề và xác nhận các module xuất Excel đều dùng chung exporter.
- Chỉ thay đổi định dạng file xuất; không thay đổi dữ liệu, công thức tổng hợp, phân quyền, IndexedDB, Supabase hoặc Cloud Sync.
- Chưa kiểm tra file tải về bằng Excel desktop/LibreOffice hoặc trên mọi trình xem bảng tính; cần kiểm tra thực tế sau khi CI và deploy hoàn tất.



## 25/11/2026 – thu gọn độ rộng cột Excel Phiếu yêu cầu bảo dưỡng – sửa chữa

- Phản ánh thực tế: bảng Phiếu YC có 15 cột, tổng độ rộng lớn khiến các cột cách nhau quá xa và file bị phình ngang.
- Bổ sung profile độ rộng riêng cho đúng biểu mẫu **PHIẾU YÊU CẦU BẢO DƯỠNG – SỬA CHỮA**: giảm các cột ngày, mã/tên thiết bị, loại yêu cầu, nội dung, thông số, vật tư, trạng thái, kết quả và người thực hiện; nội dung dài tiếp tục tự xuống dòng trong ô.
- Không thay đổi thứ tự cột, dữ liệu, tiêu đề, màu sắc, bộ lọc, cố định hàng, các biểu mẫu Excel khác hoặc thiết lập trang in. Các export khác tiếp tục dùng độ rộng hiện tại.
- Bổ sung source test xác nhận profile thu gọn chỉ áp dụng cho Phiếu YC.
- Thay đổi ở nhánh `fix/excel-maintenance-request-compact`; chưa merge/deploy. Chưa kiểm tra file tải thực tế bằng Excel desktop/LibreOffice.
- Không thay đổi dữ liệu Local, IndexedDB, Supabase, Auth, RLS, Storage hoặc Cloud Sync.


## 25/11/2026 – bổ sung lịch sử bảo trì vào bản in chi tiết thiết bị

- Bản in chi tiết thiết bị bổ sung mục III “Lịch sử bảo trì, bảo dưỡng – sửa chữa”, truy vấn đúng theo cặp organizationId + assetId trên Local IndexedDB.
- In các Phiếu YC bảo dưỡng/sửa chữa đã tạo (bao gồm trạng thái đang xử lý và hoàn thành), cùng các công việc bảo dưỡng định kỳ đã hoàn thành; không đưa lịch bảo dưỡng tương lai/chưa thực hiện vào lịch sử.
- Hiển thị ngày, loại công việc, nội dung, vật tư, thông số trước/sau xử lý, tình trạng sau xử lý, người thực hiện, kết quả và trạng thái. Nếu thiết bị chưa có lịch sử thì hiển thị một dòng thông báo, không để bảng rỗng.
- Giữ nguyên mục thông tin thiết bị, lịch sử thay đổi hồ sơ, QR và dữ liệu nghiệp vụ. Không thay đổi schema, dữ liệu, phân quyền, Supabase, Auth, RLS, Storage hoặc Cloud Sync.
- Bổ sung source test cho truy vấn đúng thiết bị/tổ chức, điều kiện công việc bảo dưỡng định kỳ đã hoàn thành và nội dung in. Chưa xác nhận bằng trình duyệt hoặc máy in thực tế; chờ CI.

## 25/11/2026 – checkpoint thiết kế phân hệ Checklist (chưa triển khai)

Người dùng và trợ lý đang thống nhất nghiệp vụ trước khi viết code. Checklist được xác định là phân hệ có nhiều biến thể theo từng doanh nghiệp; không áp một lịch hoặc quy trình cứng cho tất cả.

### Nguyên tắc khởi tạo và cấu hình
- Khi khởi tạo, BAOTRI Mini đề xuất sẵn chu kỳ kiểm tra, thời gian thực hiện, người/nhóm phụ trách và cách xử lý công việc chưa hoàn thành. Admin chọn và xác nhận; thiết lập nâng cao nằm trong phần tùy chỉnh.
- Người thực hiện mặc định ban đầu là Admin. Doanh nghiệp có thể đổi sang KTV hoặc nhóm KTV sau, không bắt buộc cấu hình phân công phức tạp ngay từ đầu.
- App đưa ra gợi ý phù hợp với doanh nghiệp nhưng Admin quyết định cuối cùng; không ép mọi doanh nghiệp dùng mọi loại Checklist.
- Với Checklist hằng ngày, chỉ nên gợi ý khoảng 1–3 công việc quan trọng để tránh quá tải.

### Chu kỳ và Checklist linh hoạt
- Cần hỗ trợ nhiều chu kỳ như hằng ngày, hằng tuần, hằng tháng và các chu kỳ khác theo cấu hình.
- Có doanh nghiệp không cần kiểm tra hằng ngày; có thể chủ yếu kiểm tra tuần/tháng.
- Hỗ trợ Checklist linh hoạt/không có lịch cố định: khi doanh nghiệp chủ động kiểm tra thì mở biểu mẫu, thực hiện và lưu kết quả; không bắt buộc phải tạo lịch định kỳ.

### Hiển thị trên trang Tổng quan
Phân biệt rõ hai nhóm:
1. **Công việc cần thực hiện:** Checklist theo lịch đã cấu hình, có thời điểm/hạn thực hiện và trạng thái theo dõi.
2. **Công việc nên làm hôm nay:** gợi ý tùy chọn từ app, có thể bao gồm Checklist linh hoạt. KTV có thể thực hiện hoặc bỏ qua; bỏ qua không bị tính quá hạn hay ghi nhận là chưa hoàn thành nhiệm vụ bắt buộc. Khi thực hiện, kết quả vẫn được lưu lịch sử.

### Ranh giới triển khai
- Đây mới là quyết định/định hướng thiết kế; chưa có code, schema, migration hay thay đổi dữ liệu nào cho Checklist.
- Tiếp tục thảo luận và thống nhất đầy đủ nghiệp vụ, trải nghiệm Admin/KTV, lịch, phân công, xử lý bỏ dở và báo cáo trước khi triển khai.
- Không tạo nhánh, PR hoặc bắt đầu code Checklist nếu chưa có phê duyệt rõ ràng của người dùng sau khi hoàn tất thiết kế.


## 26/11/2026 – bắt đầu triển khai Checklist trực tiếp trên main

Người dùng thống nhất dùng nhánh `main` làm nhánh thử nghiệm chính; không tạo nhánh Checklist riêng. PR #21 giữ nguyên trạng thái OPEN, không merge.

### Đã triển khai bước đầu
- `src/db.ts`: nâng Dexie lên version 13; bổ sung ba bảng Local riêng `checklistCategorySettings`, `checklistDefinitions`, `checklistRuns`. Dữ liệu Checklist chỉ phân vùng theo organizationId, không liên kết assetId và không ghi vào assetHistory/maintenanceHistory.
- `src/ChecklistPanel.tsx`: thêm giao diện phân hệ Checklist gồm Tổng quan, Checklist Builder, Lịch sử và Báo cáo.
- Bốn nhóm khởi tạo Cơ sở hạ tầng, Hệ thống điện, Hệ thống nước, PCCC mặc định tắt; Admin bật/tắt và chọn chu kỳ gợi ý.
- Builder tạo/sửa Checklist riêng, khai báo đối tượng, chu kỳ, người phụ trách và các nội dung kiểm tra.
- Gợi ý một số Checklist cho nhóm máy nén khí, động cơ điện, máy bơm, máy phát điện khi phát hiện loại thiết bị tương ứng trong danh mục. Đây là gợi ý theo loại, không tự tạo cho mọi thiết bị.
- KTV/Admin có thể thực hiện biểu mẫu; bắt buộc trả lời các mục, ghi Đạt/Không đạt/Không áp dụng, ghi chú và lưu người kiểm tra/thời gian cùng snapshot nội dung biểu mẫu.
- Nếu có mục Không đạt, phải ghi nhận đã tạo Phiếu YC riêng hoặc nêu lý do chưa tạo. Hiện tại đây mới là ghi nhận quyết định trong Checklist; **chưa tự động tạo Phiếu YC trong phân hệ Bảo dưỡng – Sửa chữa**.
- Có lịch sử riêng và báo cáo tổng hợp; xuất Excel bằng ExcelJS.
- Tích hợp mục “Kiểm tra định kỳ” vào menu và đường dẫn từ Trang tổng quan.
- `scripts/checklistModule.test.mjs`: thêm kiểm thử source cho phạm vi dữ liệu độc lập, nhóm khởi tạo, quyền và luồng kết quả.
- `src/style.css`: bổ sung bố cục responsive PC/mobile và quy tắc in.

### Commit đã ghi trên main
- `8870acb` – Dexie v13 và các bảng Checklist độc lập.
- `4dee500` – giao diện Checklist đầu tiên.
- `d38ecad` – tách quyền cấu hình và quyền thực hiện.
- `3666c69` – CSS Checklist.
- `e500b9d` – tích hợp menu và Trang tổng quan.
- `7086ba4` – cập nhật source test của module Báo cáo cho module Checklist mới.
- `e983d46` – thêm source tests Checklist.

### Kiểm thử đã xác nhận
- GitHub Actions Build and test tại commit `e983d46`: SUCCESS.
- 218/218 unit/source tests PASS.
- `tsc -b` và `vite build` đều hoàn tất thành công.
- Chưa kiểm thử thao tác thực tế trên trình duyệt PC/mobile hoặc dữ liệu Local sau migration Dexie v13.
- Workflow GitHub Pages cho commit `e983d46` đang được triển khai tại thời điểm cập nhật; cần xác nhận hoàn tất và mở URL thực tế.

### Chưa hoàn thiện – không được hiểu là đã có
- Chưa có bộ sinh lịch/đợt kiểm tra đến hạn theo ngày, tuần, tháng, quý, năm; tần suất hiện mới là cấu hình trên Checklist.
- Chưa đưa danh sách nhiệm vụ Checklist đến hạn/quá hạn vào Trang tổng quan; Trang tổng quan hiện mới có liên kết mở phân hệ.
- Chưa có luồng “Công việc nên làm hôm nay” cho Checklist linh hoạt.
- Chưa có xử lý nhóm KTV nhận việc, đang thực hiện, hủy/hoàn trả hoặc quy tắc timeout.
- Chưa có lọc báo cáo theo khoảng thời gian và chưa có bản in A4 riêng cho từng kết quả đã thực hiện.
- Chưa tích hợp thao tác tạo Phiếu YC thật từ kết quả Không đạt.
- Chưa có đồng bộ Cloud cho Checklist. Toàn bộ dữ liệu hiện là Local IndexedDB theo trình duyệt; chưa thay đổi Supabase schema, RLS, Auth, Storage hoặc migration.
- Chưa kiểm thử Viewer/KTV/Admin bằng các tài khoản thật trên trình duyệt; quyền hiện tại đang tạm dựa vào quyền xem thiết bị và vai trò Admin/KTV sẵn có.


## 26/11/2026 – triển khai bộ sinh lịch Checklist và Tổng quan

- Nâng Dexie Local lên version 14, bổ sung bảng độc lập `checklistTasks`; không liên kết `assetId`, không ghi vào lịch sử thiết bị hoặc lịch sử bảo trì, không thay đổi Supabase.
- Bộ sinh lịch tạo từng lượt riêng cho chu kỳ ngày/tuần/tháng/quý/năm; Checklist linh hoạt không sinh nhiệm vụ đến hạn.
- Mỗi lượt lưu ảnh chụp tên Checklist, đối tượng, người phụ trách, chu kỳ và nội dung câu hỏi tại thời điểm sinh lịch. Việc sửa biểu mẫu sau đó không làm thay đổi nội dung của lượt đã được lên lịch.
- Lượt chưa thực hiện được giữ nguyên theo ngày đến hạn; khi quá thời điểm, trạng thái chuyển thành **Quá hạn**, không tự chuyển sang kỳ sau và không bị ghi nhận là **Không đạt**.
- Tắt Checklist sẽ dừng sinh lượt tương lai; các lượt đã quá hạn vẫn được giữ để truy vết. Khi đổi chu kỳ, mốc bắt đầu lịch được cập nhật.
- Khi hoàn thành một lượt từ danh sách công việc, kết quả được lưu vào lịch sử Checklist riêng và lượt tương ứng chuyển Hoàn thành.
- Trang Tổng quan hiển thị số lượt đến hạn hôm nay, trong tuần, tháng, năm và danh sách lượt quá hạn/sắp đến hạn.
- Bổ sung source tests cho schema v14, các chu kỳ, trạng thái quá hạn, snapshot biểu mẫu và bộ đếm trên Tổng quan.
- Các thay đổi đang được GitHub Actions kiểm tra; chưa tuyên bố build/test/deploy thành công cho các commit mới cho đến khi có kết quả workflow. Chưa kiểm tra thao tác thực tế trên trình duyệt PC/mobile.
- Các phần chưa hoàn thiện: lịch giờ thực hiện có thể tùy chỉnh (hiện mặc định 09:00); gợi ý linh hoạt “Công việc nên làm hôm nay”; phân công/nhận việc theo nhóm KTV; lọc báo cáo theo kỳ; bản in A4 riêng từng kết quả; tích hợp tạo Phiếu YC thật; Cloud sync Checklist.

- Rà soát bổ sung: mốc lịch được đặt lại khi đổi chu kỳ hoặc bật/tắt cấu hình; các lượt tương lai của Checklist đã tắt được loại khỏi hàng chờ, còn lượt quá hạn cũ vẫn giữ lại và có thể mở để thực hiện bằng snapshot nội dung cũ.
- Không tự động tạo Phiếu YC; không bật Cloud sync. PR #21 vẫn không được merge.

- Bổ sung nhóm **Công việc nên làm hôm nay** trong tab Tổng quan Checklist: gợi ý tối đa 3 loại kiểm tra dựa trên thiết bị quan trọng đã khai báo; KTV có quyền thực hiện ngay, kết quả lưu vào lịch sử Checklist độc lập.
- Gợi ý linh hoạt không tạo lịch định kỳ, không tạo lượt đến hạn và không bị tính quá hạn nếu bỏ qua. Gợi ý đã có kết quả cùng đối tượng trong ngày sẽ tạm ẩn khỏi danh sách hôm nay.
- Source tests bổ sung kiểm tra hành vi gợi ý linh hoạt; chưa xác nhận CI/build/deploy và chưa kiểm thử trình duyệt.


## 26/11/2026 – cấu hình giờ thực hiện Checklist

- Bổ sung trường giờ thực hiện riêng cho từng Checklist; mặc định 09:00 để tương thích các cấu hình đã tạo trước đó.
- Trong bốn nhóm khởi tạo, Admin có thể chọn chu kỳ gợi ý và giờ thực hiện. Với Checklist tự tạo/chỉnh sửa, giờ được cấu hình trực tiếp trong Checklist Builder.
- Bộ sinh lịch sử dụng giờ đã cấu hình cho các chu kỳ ngày/tuần/tháng/quý/năm; giờ thực hiện được lưu trong snapshot của từng lượt.
- Khi thay đổi giờ, các lượt tương lai chưa hoàn thành được sinh lại theo giờ mới; lượt đã hoàn thành và các lượt quá hạn cũ được giữ nguyên. Không thay đổi bảng lịch sử thiết bị hoặc lịch sử bảo trì.
- Không cần thêm migration/index Dexie vì đây là các thuộc tính tùy chọn của bản ghi hiện có; dữ liệu cũ mặc định 09:00.
- Bổ sung source test cho trường giờ, giao diện cấu hình và bộ sinh lịch. Chưa xác nhận CI/build hoặc kiểm tra trình duyệt thực tế; chưa deploy.
- Chưa triển khai phân công/nhận việc theo nhóm KTV, lọc báo cáo theo kỳ, in A4 riêng từng kết quả, tích hợp tạo Phiếu YC thật hoặc Cloud sync.
- Không thay đổi Supabase; PR #21 vẫn để nguyên, không merge.


## 26/11/2026 – phân công và nhận việc Checklist theo nhóm KTV

- Trường Người phụ trách trong Checklist Builder tiếp tục hỗ trợ Admin, tên KTV hoặc tên nhóm; mặc định Admin.
- Với công việc giao cho nhóm (tên người phụ trách bắt đầu bằng “Nhóm”), thành viên KTV/Admin có quyền thực hiện có thể **Nhận việc**. Lượt chuyển sang **Đang thực hiện**, ghi người nhận, thời điểm và sự kiện vào chính bản ghi lượt Checklist.
- Người đã nhận việc có thể mở biểu mẫu để thực hiện hoặc **Trả lại nhóm**. Khi trả lại, lượt quay về Chờ thực hiện hoặc Quá hạn tùy hạn thực tế; sự kiện trả lại được lưu trong assignmentEvents.
- Khi hủy biểu mẫu đang làm, lượt được trả lại hàng chờ và lưu sự kiện Hủy thực hiện/Trả lại nhóm. Lượt đang thực hiện không bị bộ sinh lịch tự đổi thành Quá hạn.
- Với công việc giao đích danh, chỉ người được giao hoặc Admin có quyền mở thực hiện; Viewer vẫn chỉ xem.
- Đây là cơ chế nhận việc cơ bản theo tên nhóm/người phụ trách. Chưa có danh bạ nhóm thành viên được quản trị tập trung, thông báo đẩy, timeout tự động hoặc cơ chế bàn giao khi người nhận mất kết nối.
- Bổ sung source tests cho trạng thái nhận việc, trả lại và lưu sự kiện. Chờ GitHub Actions xác nhận; chưa kiểm tra nhiều tài khoản thực tế trên trình duyệt.
- Không thay đổi Supabase, Auth, RLS, Storage hoặc Cloud Sync. PR #21 vẫn không merge.


- Bổ sung hiển thị lịch sử phân công trên lượt đang chờ/đang làm; khi hoàn thành, sự kiện nhận việc/trả lại/hủy được sao chép vào lịch sử kết quả Checklist để vẫn tra cứu được sau khi lượt rời khỏi danh sách công việc.


- Rà soát vòng đời lịch: khi Admin sửa tên, đối tượng, người phụ trách, nhóm, câu hỏi, chu kỳ hoặc giờ, các lượt tương lai chưa bắt đầu được tạo lại theo cấu hình mới. Lượt đã hoàn thành, lượt quá hạn cũ và lượt đang được KTV nhận xử lý không bị xóa.


## 26/11/2026 – gia cố nhận việc Checklist theo định danh tài khoản

- Bổ sung `claimedByUserId` và `actorUserId` vào bản ghi lượt/lịch sử phân công; tiếp tục giữ tên hiển thị để người quản lý dễ đọc. Bản ghi cũ không có ID vẫn được đọc an toàn, nhưng không được tự nhận là quyền sở hữu hợp lệ.
- Nhận việc và trả lại được thực hiện trong Dexie read-write transaction, đọc lại bản ghi mới nhất trước khi cập nhật để tránh hai thao tác cạnh tranh trên cùng Local database.
- Loại bỏ quyền Admin ghi đè người đang nhận: Admin vẫn có thể cấu hình, nhưng không thể mở/hoàn thành lượt đang do KTV khác nhận nếu chưa có quy trình bàn giao rõ ràng.
- Trước khi lưu kết quả, kiểm tra lại tổ chức, trạng thái và user ID của người nhận; ghi kết quả, đóng lượt và cập nhật lần hoàn thành trong cùng transaction để tránh lưu kết quả nhưng không đóng được lượt.
- Giới hạn rõ: transaction IndexedDB chỉ bảo đảm nhất quán trong cùng database Local trên một trình duyệt/thiết bị. Chưa có Cloud sync/atomic claim giữa nhiều thiết bị; không tuyên bố phân công nhóm liên thiết bị đã được bảo đảm. Muốn giải quyết cần thiết kế và phê duyệt backend/Cloud riêng.
- Bổ sung source test cho định danh tài khoản, transaction và quyền sở hữu. Chờ CI/build/deploy xác nhận; chưa kiểm thử nhiều tài khoản trên trình duyệt.
- Không thay đổi Supabase, Auth, RLS, Storage, migration hoặc PR #21.


## 26/11/2026 – lọc báo cáo Checklist và in riêng kết quả A4

- Tab Báo cáo Checklist có bộ lọc Từ ngày / Đến ngày; số liệu tổng hợp và bảng chi tiết chỉ tính các kết quả trong khoảng ngày đã chọn. Có nút trở về toàn bộ thời gian.
- Xuất Excel sử dụng đúng tập kết quả đang lọc; trạng thái Phiếu yêu cầu phân biệt đã tạo, không tạo sau kết quả Không đạt và không phát sinh với kết quả Đạt.
- Nút In A4 ở từng kết quả lịch sử mở bản in riêng của đúng phiếu đó, gồm thông tin đơn vị, tên Checklist, đối tượng, thời gian, người kiểm tra, từng nội dung/kết quả/ghi chú, quyết định xử lý Không đạt và khu vực ký xác nhận. Không còn gọi in toàn bộ màn hình lịch sử.
- Bổ sung source tests cho lọc theo ngày, dữ liệu Excel sau lọc và nội dung phiếu A4. Chưa thực hiện kiểm tra trực tiếp hộp thoại in hoặc máy in vật lý.
- Không thay đổi Supabase, dữ liệu nghiệp vụ Cloud, Auth, RLS, Storage hoặc migrations. PR #21 vẫn để nguyên, không merge.

## 2026-11-26 – Điều chỉnh trạng thái và cách xem lịch Checklist
- Thời gian cho phép mặc định: 24 giờ tính từ giờ đến hạn của từng lượt Checklist.
- Sau 24 giờ chưa hoàn thành: tự chuyển trạng thái sang **Không Checklist**, hiển thị màu đỏ và giữ bản ghi lượt lịch độc lập; không ghi thành kết quả **Không đạt**.
- Trong 24 giờ cho phép, lượt đã đến giờ vẫn nằm trong danh sách cần thực hiện. Hết thời gian cho phép thì không thể bắt đầu/lưu kết quả muộn. Khi app đang mở, trạng thái được rà soát lại mỗi 60 giây; khi mở lại app cũng tự rà soát.
- Tab Lịch sử tách riêng danh sách **Không Checklist** khỏi kết quả đã kiểm tra (Đạt/Không đạt). Báo cáo và Excel cũng thống kê các lượt Không Checklist.
- Màn hình Tổng quan không liệt kê lịch tương lai. Nút **Lịch sắp tới** mở riêng, cho xem Tuần tới / Tháng tới / Quý tới; mặc định đóng.
- Dashboard rút gọn còn số lượt đến hạn cần làm và số lượt Không Checklist.
- Không thay đổi Local-first, không liên kết Checklist với lịch sử thiết bị, không sửa Supabase, không đụng PR #21.
- CI Build/Test đã thành công (230 bài test); GitHub Pages Deploy đã thành công tại commit `577b2dd9`. Chưa thực hiện browser E2E/PC-mobile hoặc in giấy thật.


## 26/11/2026 – tổ chức danh sách công việc Checklist theo kỳ hiện tại
- Thay phần Lịch sắp tới bằng bốn tab Ngày / Tuần / Tháng / Quý ngay trong khu vực Công việc cần thực hiện.
- Checklist tuần/tháng/quý xuất hiện từ đầu kỳ tương ứng, kể cả khi giờ đến hạn nằm ở ngày sau trong kỳ. Công việc thuộc kỳ nào chỉ nằm trong tab kỳ đó.
- Khi hoàn thành, lượt chuyển Hoàn thành và ẩn khỏi danh sách công việc; kết quả vẫn giữ trong Lịch sử và Báo cáo.
- Mốc Không Checklist vẫn tính 24 giờ sau giờ đến hạn riêng của từng lượt; lượt quá hạn bị loại khỏi danh sách đang làm và được giữ trong mục Không Checklist/Lịch sử/Báo cáo.
- Không thay đổi bộ sinh lịch, dữ liệu Local, Supabase, Auth, RLS, Storage, Cloud Sync hoặc PR #21. Chờ CI và deploy xác nhận; chưa kiểm thử giao diện trình duyệt thực tế.


## Checklist – giao diện gọn và xử lý tắt nhóm (26/11/2026)
- Thu gọn danh sách gợi ý thiết bị sau nút mở; thu gọn nhóm kiểm tra khởi tạo sau nút riêng.
- Bổ sung lối tắt sửa nội dung Checklist ngay từ dòng công việc đang thực hiện; chức năng Builder hiện có hỗ trợ sửa tên, đối tượng, chu kỳ, người phụ trách và danh sách câu hỏi (thêm/bớt qua nội dung nhiều dòng).
- Khi tắt nhóm hoặc Checklist, các task chưa hoàn thành của định nghĩa không còn hoạt động được loại khỏi danh sách, kể cả task có giờ đến hạn đã qua; bản ghi đã hoàn thành và bản ghi Không Checklist được giữ để bảo toàn lịch sử.
- Chưa xác nhận build/deploy và chưa thực hiện kiểm tra trình duyệt PC/mobile sau thay đổi.


## Checklist – phân biệt mẫu đang áp dụng và công việc đến hạn (26/11/2026)
- Sửa danh sách mẫu: chỉ hiển thị định nghĩa còn bật; mẫu thuộc nhóm khởi tạo bị tắt không còn xuất hiện trong danh sách mẫu đang áp dụng.
- Đổi tên khu vực thành **Mẫu Checklist đang áp dụng**, giải thích rõ mẫu là biểu mẫu tái sử dụng, không phải lượt công việc đến hạn.
- Bỏ nút thực hiện trực tiếp khỏi mẫu có chu kỳ Ngày/Tuần/Tháng/Quý. Các lượt định kỳ chỉ bắt đầu từ danh sách **Công việc cần thực hiện** để khi lưu kết quả có thể đóng đúng task và ẩn khỏi danh sách.
- Chỉ Checklist **Linh hoạt** mới cho phép thực hiện trực tiếp từ mẫu.
- Bổ sung source tests cho việc ẩn mẫu tắt và luồng thực hiện theo task định kỳ.
- Chưa xác nhận CI, GitHub Pages deploy hoặc kiểm thử trình duyệt thực tế; không thay đổi Supabase và không đụng PR #21.


## Checklist – sửa lỗi mẫu và lượt định kỳ còn hiển thị sau khi hoàn thành (26/11/2026)
- Phân biệt khu vực **Mẫu Checklist đang áp dụng** với **Công việc cần thực hiện**; giải thích mẫu được giữ để tái sử dụng theo chu kỳ, còn lượt hoàn thành phải biến mất khỏi danh sách công việc.
- Danh sách mẫu chỉ hiển thị định nghĩa đang bật; định nghĩa khởi tạo thuộc nhóm đã tắt không còn xuất hiện.
- Bỏ thao tác thực hiện trực tiếp từ mẫu định kỳ. Lượt Ngày/Tuần/Tháng/Quý chỉ được thực hiện từ task tương ứng để lưu kết quả và đóng đúng task. Mẫu Linh hoạt vẫn có thể thực hiện trực tiếp.
- Bổ sung đối chiếu các kết quả Checklist đã lưu trước đây với task cùng Checklist và cùng kỳ (Ngày/Tuần/Tháng/Quý/Năm), trong giới hạn 24 giờ tính từ giờ đến hạn. Task được đối chiếu chuyển Hoàn thành và ẩn khỏi danh sách; task đã Không Checklist không bị hồi tố thành hoàn thành.
- Bổ sung source tests cho lọc mẫu tắt, chỉ chạy mẫu Linh hoạt trực tiếp và đối chiếu kết quả lịch sử với task.
- Đã cập nhật mã trực tiếp trên main. Chưa xác nhận CI/build/deploy hoặc chạy browser E2E do công cụ hiện tại không cung cấp danh sách workflow push runs; không tuyên bố website đã nhận bản mới.
- Không thay đổi Supabase, Cloud data, Auth, RLS, Storage, migrations; PR #21 vẫn nguyên trạng.


## 26/11/2026 – tinh gọn giao diện Checklist và làm rõ chỉnh sửa mẫu
- Tổng quan chỉ còn một khu vực gợi ý tự nguyện **Công việc nên làm hôm nay**; bỏ khu vực gợi ý thiết bị thứ hai bị trùng nội dung.
- Chuyển cấu hình các nhóm khởi tạo khỏi Tổng quan sang tab **Quản lý mẫu**, sau nút **Cấu hình nhóm mẫu**. Không còn trộn cấu hình nhóm, gợi ý thiết bị và công việc đến hạn trong cùng màn hình.
- Tab **Quản lý mẫu** hiển thị toàn bộ mẫu đang bật/tắt; mỗi mẫu có nút **Sửa nội dung** rõ ràng, có thể bật/tắt lại mẫu.
- Form sửa mẫu chỉ mở khi người dùng chọn sửa hoặc tạo mới. Nội dung kiểm tra được chỉnh từng dòng; có nút thêm và xóa từng mục. Thay đổi biểu mẫu chỉ ảnh hưởng các lượt phát sinh sau; lịch sử cũ giữ snapshot.
- Không thay đổi mô hình Local-first, lịch sử độc lập hoặc dữ liệu Supabase. Cần chờ CI Build/Test và Pages Deploy; chưa xác nhận thao tác trình duyệt PC/mobile.

- Xác nhận GitHub Actions tại commit mã nguồn `08a718cd`: Build/Test thành công, 236/236 tests PASS; Pages build và deploy thành công. Chưa thực hiện browser E2E/kiểm tra trực tiếp PC-mobile.


## 26/11/2026 – tạo Checklist trực tiếp từ thiết bị và từ phân hệ Checklist
- Bổ sung nút **Tạo Checklist cho thiết bị này** trong hồ sơ thiết bị. Khi chọn, ứng dụng chuyển sang phân hệ Checklist và mở sẵn hộp thoại tạo mới với thiết bị được chọn.
- Trong phân hệ Checklist, Admin có thể tạo mẫu cho một thiết bị đã khai báo bằng danh sách chọn; hoặc chọn đối tượng khác để nhập tên hạ tầng, khu vực hay hệ thống.
- Mẫu gắn với thiết bị lưu `targetAssetId` ở cấp định nghĩa để nhận diện đúng đối tượng; từng lượt và kết quả vẫn lưu nhãn đối tượng dạng snapshot riêng, không ghi vào lịch sử thiết bị hoặc lịch sử bảo trì.
- Chu kỳ, giờ, người phụ trách và nội dung Checklist do Admin cấu hình độc lập. Không đọc, sao chép hoặc kế thừa `Asset.cycle` hay chu kỳ bảo trì.
- Không thay đổi bảng lịch sử, không nâng version Dexie, không thay đổi Supabase/Auth/RLS/Storage/Cloud Sync. Chưa kiểm thử browser PC/mobile; cần chờ CI Build/Test và Pages Deploy.
- Sau khi push, CI phát hiện lỗi TypeScript tại nút **Tạo Checklist**: `onClick={openNew}` truyền MouseEvent vào tham số Asset tùy chọn. Đã sửa thành `onClick={()=>openNew()}` trong commit `9df199f1d4d3658facad50d5e628b22d522b2cb8`; các workflow Build/Test và Pages Deploy tự chạy lại. Chỉ xác nhận phát hành sau khi cả hai workflow thành công.

## 26/11/2026 – làm rõ trạng thái mẫu và chuyển trình sửa Checklist thành hộp thoại
- Giữ nguyên Tổng quan theo xác nhận người dùng: bốn kỳ Ngày/Tuần/Tháng/Quý và khu vực Công việc nên làm hôm nay.
- Phân biệt bật/tắt **nhóm mẫu khởi tạo** với trạng thái từng mẫu tự tạo. Trên mẫu tự tạo, đổi nhãn thành **Tạm ngừng lịch / Tiếp tục lịch**: tạm ngừng việc sinh các lượt kiểm tra mới từ mẫu; không xóa kết quả đã hoàn thành và lịch sử. Bổ sung phần giải thích trực tiếp trong tab Quản lý mẫu.
- Mẫu thuộc nhóm khởi tạo không có nút tạm ngừng riêng; bật/tắt nhóm tại cấu hình nhóm khởi tạo là nguồn điều khiển.
- Nhấn **Sửa nội dung** hoặc **Tạo Checklist** mở hộp thoại riêng (modal) có nền phủ, tiêu đề, đóng/hủy, form chỉnh tên/đối tượng/nhóm/chu kỳ/giờ/người phụ trách và thêm/sửa/xóa từng mục. Có responsive PC/mobile.
- Chưa thay đổi Supabase. Chờ CI Build/Test và Pages Deploy; chưa xác nhận browser E2E.


## 26/11/2026 – tách công việc Checklist theo đúng chu kỳ ở các tab Ngày/Tuần/Tháng/Quý
- Sửa bộ lọc Tổng quan: tab **Ngày** chỉ hiển thị lượt của mẫu chu kỳ **Hàng ngày**; **Tuần** chỉ Hàng tuần; **Tháng** chỉ Hàng tháng; **Quý** chỉ Hàng quý. Không còn đưa các lượt Hàng ngày vào danh sách Tuần/Tháng/Quý chỉ vì ngày đến hạn nằm trong khoảng kỳ.
- Bộ đếm **Công việc trong kỳ** và **Không Checklist trong kỳ** đều lọc theo đúng chu kỳ đang chọn và khoảng ngày của kỳ. Lượt đã hoàn thành vẫn ẩn; quy tắc quá 24 giờ sau giờ đến hạn vẫn giữ nguyên.
- Checklist chu kỳ **Hàng năm** không ghép vào tab Quý; kết quả và lượt bỏ lỡ vẫn được tra cứu trong Lịch sử/Báo cáo.
- Bổ sung source test xác nhận cả danh sách công việc lẫn bộ đếm Không Checklist được lọc theo chu kỳ.
- Thực hiện trên nhánh main. Chưa xác nhận CI Build/Test và GitHub Pages Deploy cho đến khi kiểm tra workflow; không kiểm thử trình duyệt thực tế trong bước này.
- Không thay đổi Supabase, Dexie schema, dữ liệu, Auth, RLS, Storage hoặc PR #21.


## 26/11/2026 – chuẩn hóa Excel Checklist và sửa lượt đến hạn ngay sau khi bật mẫu
- Báo cáo Checklist chuyển sang dùng chung hàm `downloadExcelReport` của toàn website: tiêu đề/đơn vị/ngày xuất/tổng bản ghi, header định dạng, zebra rows, bộ lọc, cố định phần đầu, căn lề và thiết lập in A4 ngang. Giữ nguyên dữ liệu kết quả và các lượt **Không Checklist** trong phạm vi lọc báo cáo.
- Sửa bộ sinh lịch: khi Admin tạo hoặc bật mẫu sau giờ thực hiện trong ngày, lượt đến hạn của ngày hiện tại vẫn được sinh nếu còn trong cửa sổ 24 giờ. Nếu đã quá 24 giờ trước thời điểm kích hoạt thì không tạo ngược một lượt bỏ lỡ trước khi mẫu được bật. Áp dụng độc lập cho lịch ngày/tuần/tháng/quý/năm.
- Không thay đổi quan hệ Checklist với thiết bị, chu kỳ bảo trì, Dexie schema hoặc dữ liệu Supabase. Bổ sung source regression tests cho định dạng Excel chung và trường hợp kích hoạt sau giờ đến hạn.


## 26/11/2026 – hoàn thiện trải nghiệm biên soạn nội dung Checklist
- Tab Tổng quan chỉ còn thao tác xem công việc, nhận việc và Thực hiện; bỏ nút Sửa nội dung khỏi từng công việc. Chỉnh sửa biểu mẫu tập trung tại tab Quản lý mẫu.
- Trình tạo/sửa mẫu có thư viện nội dung gợi ý theo loại đối tượng: máy bơm, máy nén khí, động cơ, máy phát điện, hệ thống điện, hệ thống nước, PCCC, cơ sở hạ tầng/khu vực và thiết bị chung. Người dùng chọn nhiều mục phù hợp rồi thêm vào biểu mẫu; có thể bỏ chọn mục không cần.
- Mở rộng thư viện lên nhiều nội dung chuyên biệt cho từng nhóm; vẫn cho phép sửa/xóa từng dòng, thêm câu hỏi riêng. Các câu hỏi đã lưu của mẫu không bị thay thế khi mở trình biên soạn.
- Bỏ nút Làm mới gây nhầm lẫn; xóa nội dung bằng nút Xóa ngay trên dòng câu hỏi. Lịch sử Checklist đã hoàn thành vẫn giữ snapshot cũ.
- Chỉ thay đổi giao diện và dữ liệu mẫu nội dung trong mã nguồn; không thay đổi Dexie schema, dữ liệu người dùng hoặc Supabase.


## 26/11/2026 – chỉnh giao diện chọn nội dung và đưa in phiếu Checklist về Báo cáo
- Thu gọn nút **Thêm nội dung đã chọn**: đổi từ nút chính cỡ lớn sang nút phụ gọn, thêm khoảng cách và đường phân cách với danh sách gợi ý; bố trí responsive để không chèn chữ/nội dung. Giữ nguyên thao tác **Thêm nội dung kiểm tra riêng**.
- Bỏ nút in khỏi tab **Lịch sử**. Tab **Báo cáo** có cột **Phiếu Checklist** và nút **In phiếu A4** cho từng kết quả đã kiểm tra; danh sách **Không Checklist** không có phiếu kết quả để in.
- Sửa vòng đời in: chờ trình duyệt render phiếu vào DOM bằng requestAnimationFrame rồi mới gọi hộp thoại in; giữ phiếu trong DOM cho đến sự kiện afterprint thay vì xóa trạng thái ngay sau window.print(). Chỉnh CSS bản in sang bố cục luồng tài liệu để phiếu dài có thể phân trang A4.
- Bổ sung source regression tests cho vị trí nút in, luồng render/afterprint và style nút gọn. Chưa kiểm tra trực tiếp hộp thoại in trên trình duyệt hoặc máy in vật lý.
- Không thay đổi Dexie schema, dữ liệu Checklist, Supabase, Auth, RLS, Storage, Cloud Sync hoặc PR #21.


## 26/11/2026 – nội dung bắt buộc cho thiết bị, phiếu in Checklist và Reset Checklist
- Mọi Checklist tạo cho một thiết bị tự động có 4 mục kiểm tra chung bắt buộc: hình thức bên ngoài; vệ sinh/thông thoáng/ẩm nước; dây nguồn/đầu nối/tiếp địa (quan sát an toàn); nguồn cấp và điện áp so với thông số (chỉ đo khi đủ điều kiện và người thực hiện đủ chuyên môn). Các mục hiển thị riêng, luôn được áp dụng, không cho sửa/xóa. Gợi ý chuyên biệt và câu hỏi tự thêm vẫn nằm phía dưới; đối tượng khu vực/hệ thống không bị áp dụng bộ câu hỏi thiết bị.
- Sửa phiếu in Checklist dùng đúng wrapper `asset-print-sheet print-checklist` mà CSS A4 đang chờ; trước đây markup dùng class khác nên quy tắc chỉ hiện nội dung in không bắt được phiếu. Phiếu mới theo bố cục form thiết bị: tên đơn vị, tiêu đề BAOTRI MINI, thông tin đối tượng/chu kỳ/người kiểm tra/kết quả, bảng nội dung và kết quả, ghi chú/thông số, xử lý Không đạt và chữ ký.
- Bổ sung Checklist vào transaction reset theo generation của tổ chức. Khi thiết bị Local đã đăng ký nhận generation reset mới, xóa cấu hình nhóm, toàn bộ mẫu Checklist, lịch thực hiện và lịch sử kết quả của đúng tổ chức; Checklist trở về trạng thái khởi tạo. Local Preview và tổ chức khác không bị tác động. Checklist hiện là dữ liệu Dexie Local, không có bảng Cloud riêng; không tạo migration hay thay đổi Supabase.
- Cập nhật nội dung yêu cầu/duyệt Reset để nói rõ Checklist cũng bị xóa. Bổ sung regression tests. Chưa chạy browser E2E hoặc hộp thoại in vật lý; reset destructive chưa được thực hiện trên tổ chức nào.

- Điều chỉnh assertion test cũ theo wrapper in A4 mới `asset-print-sheet print-checklist`; assertion cũ còn kiểm tra class `checklist-print-sheet` đã được thay bằng cấu trúc in chuẩn dùng chung với phiếu thiết bị.


## 26/11/2026 — Reset theo phạm vi độc lập và sửa in phiếu Checklist A4

- Admin doanh nghiệp gửi yêu cầu Reset với ba lựa chọn độc lập: Thiết bị, Vật tư, Checklist; mặc định cả ba đều bỏ chọn và bắt buộc chọn ít nhất một. Superadmin nhìn thấy chính xác phạm vi và số lượng dữ liệu, duyệt/từ chối như trước; Edge Functions chỉ nhận phạm vi đã chọn.
- Supabase migration `20261126141059_selective_reset_scope_optional_checklist.sql` đã áp dụng cho BAOTRI-Mini-Test và BAOTRI-Mini-New. Bổ sung `inventory_generation` và `checklist_generation` bên cạnh generation thiết bị; mỗi phạm vi chỉ tăng generation và xóa dữ liệu của chính phạm vi đó. Checklist Cloud tables là tùy chọn vì phân hệ Checklist hiện Local-first; migration kiểm tra `to_regclass` trước khi đọc/xóa bảng legacy.
- Local reset helper áp dụng từng generation riêng trong một Dexie transaction: chỉ xóa các store thiết bị/vật tư/Checklist tương ứng; xác nhận cả ba generation sau khi purge thành công. Không còn việc chọn Reset thiết bị mà tự động xóa kho vật tư và Checklist.
- Edge Functions `organization-asset-reset-requests` và `platform-manage-asset-reset-requests` đã deploy lên Test và Production; verify_jwt vẫn bật, xác thực Admin doanh nghiệp/Superadmin và mật khẩu Superadmin giữ nguyên.
- Sửa phiếu in Checklist: nguyên nhân trắng là DOM dùng class `asset-print-sheet print-checklist` trong khi CSS in tìm `checklist-print-sheet`. Đã đổi DOM sang selector riêng mà CSS đã định nghĩa, bố cục A4 riêng, không còn phụ thuộc selector in thiết bị.
- Test an toàn trên Test: tạo yêu cầu Reset chỉ vật tư trong transaction rồi rollback; RPC trả về đúng `reset_inventory=true`, hai phạm vi còn lại false. Không thực hiện xóa dữ liệu kiểm thử. Không thực hiện reset thật trên doanh nghiệp nào.
- Migration được ghi vào lịch sử cả Test và Production. Production schema thay đổi, nhưng không có dữ liệu doanh nghiệp nào bị reset. Chưa chạy browser/E2E thực tế hoặc hộp thoại in trên thiết bị người dùng.

- Kiểm tra thêm bằng transaction có rollback trên Production: tạo và duyệt thử yêu cầu **Checklist-only** và **Inventory-only**. Cả hai RPC trả `status=executed` với đúng hai cờ còn lại `false`; transaction rollback nên không xóa dữ liệu doanh nghiệp. Phát hiện và sửa unique constraint cũ `(organization_id,generation)` trên reset history vì nó ngăn nhiều lần Reset vật tư/Checklist khi asset generation không đổi; thay bằng khóa idempotency `(organization_id,request_id)` hiện có.


## Cập nhật 26/11/2026 – bắt đầu Checklist Cloud và quy tắc Online-only

Nhánh triển khai: `feature/checklist-cloud-online-qr`  
PR nháp: https://github.com/Vodanhhp/BaoTri_Mini/pull/75

### Yêu cầu nghiệp vụ đã chốt
- Checklist thực hiện trên điện thoại; PC dành cho Admin quản lý mẫu, cấu hình, xem lịch sử, báo cáo và in.
- Checklist thiết bị sẽ được mở bằng quét QR Code trên điện thoại.
- Checklist theo hệ thống (hạ tầng, điện, nước, PCCC và các hệ thống khác) được chọn thủ công trên điện thoại, không bắt buộc QR.
- Mất Internet: khóa thao tác thực hiện Checklist; không ghi nhận offline để đồng bộ sau.
- Giai đoạn 1 mặc định Admin phụ trách; phân công KTV chi tiết để giai đoạn 2.
- Mẫu Checklist theo hệ thống tối thiểu 5 tiêu chí; mỗi tiêu chí có Đạt / Không đạt / Bỏ qua. Bỏ qua không tính là Đạt hoặc Không đạt; nếu toàn bộ tiêu chí đều Bỏ qua thì kết quả tổng thể là Bỏ qua.

### Đã thay đổi trên nhánh
- Bốn nhóm mẫu gợi ý Cơ sở hạ tầng, Điện, Nước, PCCC được nâng lên 7 tiêu chí mỗi nhóm.
- Builder từ chối lưu mẫu hệ thống có dưới 5 tiêu chí.
- Thay lựa chọn mới thành Bỏ qua; giữ đọc được bản ghi cũ có kết quả Không áp dụng.
- Bổ sung chặn thao tác thực hiện khi trình duyệt offline hoặc giao diện desktop; PC vẫn giữ các tab quản lý, lịch sử, báo cáo và in.
- Bổ sung thông báo trạng thái kết nối và hướng dẫn sử dụng điện thoại.

### Supabase Test
- Đã áp dụng migration `20261126144630_checklist_cloud_online_foundation` trên Supabase Test `oyzhxgzltpdebpymuicb` (chỉ môi trường Test).
- Tạo các bảng mới: `checklist_category_settings`, `checklist_definitions`, `checklist_definition_versions`, `checklist_tasks`, `checklist_runs`, `checklist_task_events`.
- Các bảng mới đều bật RLS và có policy theo `checklist.view` / `checklist.template.manage`; task claim và complete đi qua RPC trong schema private, kiểm tra `checklist.result.create` và cập nhật atomic.
- Smoke test trong transaction rollback: tạo mẫu hệ thống 5 tiêu chí thành công; mẫu 4 tiêu chí bị constraint từ chối; không giữ lại dữ liệu thử nghiệm.
- Đã kiểm tra các bảng và policy sau migration. Security Advisor chỉ trả các cảnh báo hiện hữu của những bảng/hàm khác; không phát hiện bảng Checklist mới thiếu policy.

### Chưa hoàn tất – không được coi là đã nghiệm thu
- Kết nối giao diện Checklist với các bảng Cloud mới; hiện các luồng UI hiện hữu vẫn còn Local Dexie.
- Tạo/sinh lịch công việc trên Cloud và đồng bộ snapshot/version.
- Gắn luồng nhận việc/hoàn thành UI vào RPC atomic.
- Quét QR Code thiết bị và kiểm tra quyền/trạng thái trên Cloud.
- Chặn thực hiện Checklist trên PC cần được xác thực bằng kiểm thử giao diện thực tế; hiện mới có chặn theo viewport desktop.
- Chạy CI/build/test sau các thay đổi; chưa kiểm thử trên điện thoại hoặc camera thực tế.
- Chưa áp dụng bất kỳ migration nào lên Production; chưa merge PR #75.


### Kiểm thử nhánh Checklist (26/11/2026)
- CI `Build and test` run `45843259457`: **success**; các bước Unit tests và Build đều thành công.
- CI `Validate BAOTRI Mini` run `45843259528`: **success**.
- Đã sửa lỗi JSX trùng thuộc tính disabled và cập nhật các kiểm thử để phản ánh chính sách thực hiện Checklist trên điện thoại, online-only.
- Migration đã áp dụng ở Supabase Test được lưu tại `docs/drafts/20261126144630_checklist_cloud_online_foundation.sql`, không nằm trong `supabase/migrations/` vì chưa áp dụng Production và bộ kiểm thử migration yêu cầu đồng bộ chính xác với lịch sử Production.
- Trạng thái vẫn là PR Draft #75; không merge, không deploy Production.


- Bổ sung migration Test `20261126145323_checklist_phase1_admin_only`: RPC nhận việc/hoàn thành kiểm tra role Admin khi task được giao `Admin`, phù hợp giai đoạn 1. Đã kiểm tra định nghĩa hai RPC sau cập nhật trên Supabase Test; file nguồn lưu tại `docs/drafts/20261126145323_checklist_phase1_admin_only.sql`.


## Cập nhật tiếp tục Checklist Cloud – 26/11/2026

### Đã triển khai trên nhánh PR #75
- Thêm `src/lib/checklistCloud.ts`: tải cấu hình, mẫu, lịch công việc, kết quả và lịch sử sự kiện trực tiếp từ Supabase; không dùng Dexie làm nguồn chính cho tổ chức thật.
- Admin lưu mẫu qua RPC Cloud; mỗi lần sửa mẫu tăng version và lưu snapshot ở `checklist_definition_versions`.
- Cloud sinh lượt công việc từ lịch chu kỳ, giữ snapshot nội dung tại thời điểm sinh lượt; khi sửa mẫu, các lượt tương lai chưa nhận sẽ được tạo lại theo mẫu mới, còn lượt đang làm/đã hoàn thành giữ nguyên snapshot.
- Nhận việc, trả việc và hoàn thành dùng RPC server-side; claim được khóa hàng trong PostgreSQL để tránh hai máy nhận cùng lượt.
- Kết quả được ghi vào `checklist_runs`; kiểm tra server xác nhận đúng từng question ID/label, không nhận câu trả lời trùng hoặc thiếu.
- Khi tất cả câu trả lời là Bỏ qua, kết quả tổng thể là Bỏ qua.
- Thêm `ChecklistQrScanner.tsx`: camera QR dùng BarcodeDetector trên trình duyệt hỗ trợ, có ô nhập mã dự phòng. QR hiện có trên tem thiết bị đang mã hóa mã quản lý; luồng mới dùng mã đó tra thiết bị Cloud rồi tìm Checklist đến hạn.
- Checklist thiết bị chỉ mở qua QR; Checklist hệ thống tiếp tục thực hiện thủ công trên điện thoại.
- Giai đoạn 1 khóa người phụ trách ở Admin cả giao diện và server RPC; phân công KTV để giai đoạn 2.
- PC nhận diện theo nền tảng/user-agent và không được thực hiện Checklist; quản lý mẫu, lịch sử, báo cáo, in vẫn giữ.
- Offline: các thao tác thực hiện và quét QR bị khóa; không ghi Local rồi đồng bộ sau.

### Supabase Test đã áp dụng
Project `BAOTRI-Mini-Test` / `oyzhxgzltpdebpymuicb`:
- `20261126144630 checklist_cloud_online_foundation`
- `20261126145323 checklist_phase1_admin_only`
- `20261126150046 checklist_cloud_management_and_schedule_rpcs`
- `20261126150054 checklist_public_rpc_wrappers`
- `20261126150203 checklist_task_snapshot_metadata`
- `20261126150642 checklist_definition_edit_reschedules_pending_tasks`
- `20261126150723 checklist_cloud_cleans_disabled_future_occurrences`
- `20261126150817 checklist_phase_one_admin_only_guards`
- `20261126150853 checklist_result_validates_question_identity`

Kiểm tra:
- 6 bảng Checklist mới bật RLS; mỗi bảng có policy phù hợp theo quyền xem/quản lý.
- Public RPC wrapper chỉ cấp EXECUTE cho authenticated; anon không được gọi. Wrapper là SECURITY INVOKER, phần nghiệp vụ nhạy cảm nằm trong private SECURITY DEFINER đã kiểm tra quyền.
- Smoke test chạy trong transaction rollback: tạo mẫu hệ thống 5 tiêu chí, sinh task, nhận task, hoàn thành với tất cả Bỏ qua và xác nhận outcome Bỏ qua; mẫu 4 tiêu chí và người phụ trách KTV bị từ chối. Không giữ dữ liệu thử nghiệm.
- Security Advisor không báo thiếu policy ở 6 bảng Checklist mới; các cảnh báo hiện hữu khác thuộc những bảng/hàm ngoài phạm vi Checklist.

### Kiểm thử và giới hạn
- CI Build and test + Validate đã thành công ở các commit triển khai Cloud/QR gần nhất; cần chờ xác nhận cuối cùng cho commit hiện tại sau thay đổi mới nhất.
- Chưa kiểm thử camera QR trên điện thoại vật lý; BarcodeDetector không có trên mọi trình duyệt, đã có nhập mã dự phòng.
- Chưa kiểm thử E2E UI với tài khoản Admin thực tế trên trình duyệt.
- Chưa áp dụng bất kỳ migration Checklist nào lên Production; PR #75 vẫn Draft, chưa merge.
- Giao diện Cloud chưa được chạy trên môi trường preview gắn Supabase Test; CI build/test không thay thế kiểm thử vận hành.


### Hoàn thiện kỹ thuật bổ sung – 26/11/2026
- Cloud loader phân trang các bảng mẫu, công việc, kết quả và sự kiện; tránh giới hạn mặc định 1.000 dòng của PostgREST.
- Chỉ tạo trước lịch công việc khi mở lần đầu hoặc sau khi Admin sửa mẫu/cấu hình. Làm mới định kỳ 60 giây chỉ cập nhật trạng thái quá hạn, không tạo lại cả năm công việc liên tục.
- Giới hạn lịch được tải/tạo trong cửa sổ 366 ngày quá khứ và 1 năm tương lai để không gửi lịch cũ ngoài phạm vi RPC.
- Server xóa các lượt tương lai chưa nhận khi mẫu tạm ngừng hoặc nhóm starter bị tắt; lượt đang thực hiện/đã hoàn thành giữ snapshot.
- Giao diện đóng QR scanner khi mất kết nối hoặc thiết bị được nhận diện là PC. Sau khi RPC nhận việc thành công, mở phiếu ngay và làm mới danh sách nền.
- Đã khóa quyền ghi trực tiếp vào `checklist_definitions`; mọi tạo/sửa mẫu phải đi qua RPC có version snapshot. Các bảng lịch sử/task chỉ còn SELECT cho authenticated; anon bị thu hồi quyền bảng.
- Smoke test trong transaction rollback sau khi siết quyền: RPC lưu mẫu vẫn hoạt động với authenticated Admin; INSERT trực tiếp vào bảng definitions bị từ chối.
- CI Build and test + Validate thành công tại commit code `20134a787bf2956bee783e4c2edb09d3e53d1870`. Các thay đổi sau đó chủ yếu là SQL migration source; run mới đang chờ hoàn tất.
- Migration Test bổ sung: `20261126211000 checklist_definitions_write_only_through_versioned_rpc`, `20261126212000 checklist_cloud_minimum_table_privileges`.


### Rà soát sau khi phiên triển khai bị ngắt – 26/11/2026
- PR #75 hiện vẫn OPEN + DRAFT, base `main`, head `feature/checklist-cloud-online-qr`, head SHA `a1ace46aca6cb33d0db0584c45fa6d7bf671e30f`; chưa merge, Production không thay đổi.
- CI tại đúng head SHA đã hoàn tất thành công:
  - Build and test run `45846843476`: Unit tests + Build đều SUCCESS.
  - Validate BAOTRI Mini run `45846843459`: npm ci + npm run build SUCCESS.
- Supabase Test có đủ 11 migration Checklist:
  `20261126144630`, `20261126145323`, `20261126150046`, `20261126150054`, `20261126150203`, `20261126150642`, `20261126150723`, `20261126150817`, `20261126150853`, `20261126151227`, `20261126151244`.
  Public RPC wrappers của migration `20261126150054` hiện được ghi chung trong source draft `docs/drafts/20261126150000_checklist_cloud_management_and_schedule_rpcs.sql`; cần giữ rõ quan hệ này khi tách/chỉnh migration sau này.
- Danh sách phần còn dở trước khi có thể xem là hoàn tất:
  1. Chạy app trên Preview/nhánh thử nghiệm trỏ đúng Supabase Test; đăng nhập tài khoản Admin thật để kiểm thử CRUD mẫu, lịch, task, kết quả, lịch sử, báo cáo và in.
  2. Kiểm thử điện thoại thật: quyền camera, QR tem đang dùng, quét đúng/sai mã, nhiều mẫu cùng thiết bị, không có task đến hạn, mất mạng giữa lúc quét/nhận/lưu, và trình duyệt không hỗ trợ BarcodeDetector.
  3. Xác nhận nghiệp vụ nhập mã thiết bị thủ công dự phòng có được chấp nhận hay thiết bị bắt buộc quét QR bằng camera.
  4. Rà soát nhận diện PC/mobile trên thiết bị lai (tablet, trình duyệt desktop giả lập mobile); hiện là kiểm soát phía giao diện, server RPC vẫn kiểm soát quyền Admin và trạng thái task nhưng không xác minh loại thiết bị.
  5. Chưa triển khai migration lên Production; chỉ làm sau khi Preview/E2E được nghiệm thu và có xác nhận riêng.
- Không được hiểu CI xanh là đã kiểm thử camera, giao diện thực tế hoặc Production.


## Rà soát lỗi và sửa Checklist Cloud/QR – 26/11/2026

### Các lỗi đã phát hiện và sửa
1. **Lịch định kỳ cũ:** bộ sinh lịch trước đây chỉ xét 18 tháng cho chu kỳ tháng, 6 chu kỳ cho quý, 2 năm cho năm; mẫu tạo lâu hơn có thể không sinh lượt. Chu kỳ ngày/tuần cũng có thể gửi lịch quá cũ khiến RPC từ chối. Đã tính điểm bắt đầu trong cửa sổ 366 ngày quá khứ, giữ đúng ngày/tuần/tháng/quý/năm và grace period 24 giờ.
2. **Checklist thiết bị đi vòng QR:** RPC lưu Checklist thủ công trước đây cho phép lưu mẫu thiết bị không qua task QR. Đã chặn đường manual RPC đối với `target_kind='equipment'`; thiết bị phải đi qua lượt task. UI chỉ tìm task theo mã thiết bị đã quét.
3. **Sai thiết bị sau khi sửa mẫu:** task snapshot trước đây thiếu target asset ID/type, khiến task cũ có thể bị ghép theo thiết bị mới sau khi Admin sửa mẫu. Đã bổ sung `targetKind` và `targetAssetId` vào snapshot task, map vào model và dùng target ID snapshot khi tìm task từ QR.
4. **Snapshot kết quả có thể bị client giả mạo:** RPC hoàn thành task trước đây nhận tiêu đề/đối tượng/snapshot từ payload client. Đã chuyển sang lấy toàn bộ metadata và danh sách câu hỏi từ `definition_snapshot` đã lưu trên Cloud.
5. **Gửi trùng Checklist hệ thống:** lưu manual run trước đây tạo ID mới ở mỗi lần gọi, có thể sinh phiếu trùng khi mạng timeout rồi người dùng bấm lưu lại. Đã thêm idempotency key ổn định cho mỗi lượt mở form, lưu key làm primary key của run và trả lại kết quả cũ khi retry; UI khóa nút lưu trong lúc chờ và không cho đóng form khi đang lưu.
6. **Camera QR rò stream:** bấm mở lại camera có thể để stream cũ chạy; callback detect có thể tiếp tục tạo animation frame sau khi đóng modal. Đã dừng stream/frame trước khi mở lại, dùng active ref và dừng cả luồng getUserMedia/play còn pending khi modal đóng.
7. **Máy tính bảng bị coi là điện thoại:** bộ nhận diện trước đây cho phép tablet/iPad. Đã đổi sang chỉ cho phép user-agent điện thoại; tablet/iPad bị khóa. Đây vẫn là guard phía trình duyệt, không phải bằng chứng thiết bị an toàn phía server.
8. **KTV có quyền execute tùy chỉnh:** UI trước đây dựa vào canExecute permission. Đã yêu cầu đồng thời canManage/Admin, phù hợp giai đoạn 1; RPC tiếp tục kiểm tra role Admin.
9. **Tiêu chí tùy chọn bỏ trống:** UI cho phép bỏ trống tiêu chí optional nhưng gửi kết quả rỗng, khiến RPC từ chối. Đã chuẩn hóa câu optional chưa chọn thành Bỏ qua.
10. **Lỗi RPC và trạng thái UI:** bổ sung xử lý lỗi và refresh lại dữ liệu sau các thao tác quản lý/nhận/trả/hoàn thành để tránh hiển thị trạng thái cũ khi phản hồi mạng không chắc chắn.
11. **Phân trang Cloud:** bổ sung sắp xếp phụ theo ID để kết quả phân trang ổn định khi nhiều dòng trùng timestamp.

### SQL/RLS đã cập nhật trên Supabase Test
Project `oyzhxgzltpdebpymuicb` có tổng cộng 20 migration Checklist (11 migration nền ban đầu và 9 migration rà soát/sửa lỗi tiếp theo). Các migration bổ sung:
- `20261126222000_checklist_equipment_requires_qr_task_flow`
- `20261126223000_checklist_enforce_equipment_qr_and_immutable_task_snapshot`
- `20261126224000_checklist_policy_and_fk_index_review`
- `20261126225000_checklist_task_snapshot_target_identity`
- `20261126226000_checklist_manual_run_idempotency`
- `20261126227000_checklist_manual_run_idempotency_persist_run_id`
- `20261126228000_checklist_claim_owner_null_safe_checks`
- `20261126229000_checklist_definition_question_validation`
- `20261126230000_checklist_equipment_target_must_be_active`
- Tách policy SELECT và policy ghi cho bảng cấu hình/mẫu; UPDATE có cả USING và WITH CHECK. Bổ sung index cho các foreign key Checklist.
- Kiểm tra quyền sau migration: 6 bảng bật RLS; anon không có quyền đọc; authenticated chỉ đọc bảng lịch sử/task/version; bảng cấu hình cho phép ghi qua RLS; bảng definitions không cho ghi trực tiếp; public RPC wrappers là SECURITY INVOKER, anon không có EXECUTE, authenticated có EXECUTE.
- Security Advisor không còn phát hiện vấn đề thuộc 6 bảng/RPC Checklist mới; không còn multiple permissive policies ở 2 bảng Checklist. Các cảnh báo definer/RLS còn lại thuộc các bảng/hàm cũ ngoài phạm vi này. Performance Advisor còn báo các index mới chưa được dùng do chưa có tải thực tế.

### Kiểm thử bổ sung
- SQL smoke test trong transaction rollback đã xác nhận: manual RPC từ chối mẫu thiết bị; task QR lưu đúng target asset snapshot; hoàn thành task lấy tiêu đề/đối tượng/câu hỏi từ snapshot Cloud dù payload client bị sửa; manual Checklist hệ thống với tất cả Bỏ qua trả outcome Bỏ qua; gọi lại cùng run ID trả đúng run cũ và chỉ có một bản ghi.
- SQL smoke test trước đó xác nhận Admin-only, tối thiểu 5 tiêu chí hệ thống, từ chối KTV, atomic claim/complete và quyền ghi bảng.
- Smoke test bổ sung xác nhận server từ chối question ID trùng, label rỗng, required flag sai kiểu; mẫu hợp lệ 5 tiêu chí vẫn được chấp nhận. Server cũng từ chối thiết bị Thanh lý làm target Checklist.
- Không giữ lại dữ liệu smoke test vì tất cả chạy trong transaction rollback.
- CI Build and test và Validate đều xanh tại head `3cc303baada7bcd163bd3adbd40968596e018dc4` (Build and test run `45852450473`, Validate run `45852450546`).

### Việc vẫn chặn nghiệm thu/Production
- **Dữ liệu Checklist Local cũ:** nhánh `main` hiện tại lưu cấu hình/mẫu/lượt/kết quả theo từng trình duyệt bằng Dexie. Nhánh Cloud không tự động nhập dữ liệu cũ. Đã thêm cảnh báo Admin nếu trình duyệt hiện tại còn dữ liệu local chưa chuyển Cloud; cảnh báo chỉ kiểm tra được thiết bị đang đăng nhập, không quét được các điện thoại/PC khác. Cần thống nhất phương án gom/chuyển dữ liệu cũ trước Production; tuyệt đối không tự động xóa Dexie.
- Chưa chạy Preview thực tế kết nối Supabase Test với tài khoản Admin.
- Chưa E2E trên điện thoại vật lý: camera permission, QR đúng/sai, task đang có người nhận, task hết hạn, nhiều Checklist cùng thiết bị, mất mạng giữa thao tác.
- Trình duyệt không thể chứng minh tuyệt đối thiết bị là điện thoại; server bảo vệ role/quyền/task nhưng không thể xác minh vật lý camera đã quét.
- Chưa áp dụng bất kỳ migration Checklist nào lên Production. PR #75 tiếp tục Draft, không merge.


### Kiểm tra cuối bổ sung – 26/11/2026
- Thêm server-side validation cho từng câu hỏi: object hợp lệ, ID không rỗng/không trùng, label không rỗng và tối đa 1.000 ký tự, ID tối đa 128 ký tự, required nếu có phải là boolean.
- RPC lưu mẫu thiết bị chỉ chấp nhận thiết bị còn hoạt động, chưa archive/delete và trạng thái không phải Thanh lý.
- Thêm cảnh báo Admin về dữ liệu Checklist Dexie cũ trên chính trình duyệt hiện tại; không tự nhập và không xóa dữ liệu.
- Migration Checklist Test hiện có 20 bản ghi. CI đã xanh tại head hiện tại `3cc303baada7bcd163bd3adbd40968596e018dc4`.


### Hai điểm nghiệp vụ cần chốt trước nghiệm thu – 26/11/2026
- **Xóa/bớt mẫu:** UI hiện có Tạo mẫu, Sửa nội dung và Tạm ngừng/Tiếp tục lịch; chưa có thao tác xóa hoặc lưu trữ mẫu khỏi danh sách. Hard delete không phù hợp vì mẫu đang được lịch sử tham chiếu. Đề xuất dùng Lưu trữ mẫu (soft archive), giữ nguyên kết quả và phiên bản cũ; chờ xác nhận nghiệp vụ trước khi triển khai.
- **Dữ liệu Dexie cũ:** cảnh báo đã được thêm, nhưng chưa có luồng import. Cần chọn một thiết bị/nguồn dữ liệu chuẩn và cách hợp nhất dữ liệu từ nhiều trình duyệt để tránh nhập trùng hoặc ghi đè mẫu.
26/11/2026 — Sửa phụ thuộc khi xóa vĩnh viễn tổ chức

- Điều tra lỗi PostgreSQL `23503` khi xóa tổ chức: `organization_equipment_catalog_history` có FK `ON DELETE RESTRICT` tới `organizations`, nhưng routine cũ chưa dọn bản ghi audit này. Đối chiếu Production còn phát hiện `private.platform_data_seed_runs` cũng cần được dọn trước khi xóa tổ chức.
- Đã merge PR #76 vào `main` (squash commit `43cd748155d5cc93b5c9bae5d7fcf6cbd99370c0`); CI Validate và Build/Unit tests đều thành công.
- Đã áp dụng migration Production `20261126160654_fix_platform_delete_catalog_history_dependencies` và lưu migration tương ứng tại `supabase/migrations/20261126160654_fix_platform_delete_catalog_history_dependencies.sql`.
- Routine mới xóa catalog audit (có kiểm tra `to_regclass`) và seed-run metadata trước khi xóa tổ chức; cleanup giữ trong cùng transaction. Không xóa `auth.users` hoặc `profiles`.
- Đã kiểm tra Production: migration có trong lịch sử, hàm đang chạy có cả hai bước cleanup; tổ chức `My Company` vẫn tồn tại (1 bản ghi). Chưa thực hiện thao tác xóa tổ chức thật; chưa kiểm chứng end-to-end qua giao diện.


## 26/11/2026 — Checklist, Phiếu yêu cầu và báo cáo bảo trì Cloud (đang triển khai)

- Bổ sung cấu trúc Cloud cho Phiếu yêu cầu bảo dưỡng/sửa chữa, liên kết với tổ chức và thiết bị; có lịch sử tạo, cập nhật, hoàn thành. RLS bật, đọc theo quyền `maintenance.view`; ghi dữ liệu qua RPC kiểm tra quyền `maintenance.create/update`.
- Thêm RPC tạo Phiếu yêu cầu từ kết quả Checklist Không đạt. Phiếu lấy thiết bị, người kiểm tra và nội dung tiêu chí Không đạt; mỗi kết quả Checklist chỉ có tối đa một Phiếu liên kết. Lưu `maintenance_request_id` ngược lại trên kết quả Checklist.
- Chuyển đọc/ghi Phiếu yêu cầu và lịch bảo dưỡng định kỳ của phân hệ Bảo dưỡng – Sửa chữa sang Cloud; lưu lịch sử thao tác, cập nhật trạng thái và kết quả hoàn thành.
- Báo cáo bổ sung thống kê Phiếu phát sinh trong kỳ, Phiếu hoàn thành trong kỳ, Phiếu đang xử lý, Phiếu quá hạn và lịch bảo dưỡng định kỳ theo ngày/tuần/tháng/quý/năm. Báo cáo thiết bị giữ nguyên cách tính; báo cáo vật tư không thay đổi và vẫn lấy dữ liệu Local.
- Đã thêm kỳ Năm vào bộ lọc công việc cần thực hiện của Checklist.
- Đã áp dụng các migration bảo trì lên Supabase Test `oyzhxgzltpdebpymuicb`; SQL smoke tests chạy trong transaction rollback xác nhận tạo/cập nhật/hoàn thành Phiếu, lịch định kỳ, liên kết Checklist→Phiếu không trùng, và routine xóa tổ chức xử lý được các phụ thuộc mới. Sau rollback, tổ chức và dữ liệu Test vẫn nguyên vẹn.
- Bổ sung cleanup cho Phiếu yêu cầu, lịch bảo dưỡng và Checklist vào routine xóa tổ chức; xử lý liên kết vòng giữa Checklist run và Phiếu yêu cầu trước khi xóa.
- Chưa có CI mới sau các commit gần nhất; chưa Preview/E2E giao diện. Chưa áp dụng migration nào lên Production, chưa merge PR #75.
- Đã đăng ký các migration Checklist và Cloud maintenance đã áp dụng trên Test vào `supabase/migrations` theo đúng version trong `supabase_migrations.schema_migrations`; bổ sung migration harden tạo phiếu từ Checklist (`20261126165000`).
- Đã đồng bộ nhánh PR với `main` bằng merge commit; PR không còn behind.
- Còn việc phải hoàn tất: có CI Build/Unit mới và kiểm tra TypeScript; kiểm tra Preview giao diện thực tế trên Supabase Test; kiểm thử E2E trên điện thoại vật lý; kiểm tra luồng tạo Phiếu yêu cầu từ Checklist trong UI.
