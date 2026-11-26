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
