# BAOTRI Mini

Ứng dụng quản lý thiết bị theo mô hình Local-first, đăng nhập bằng Supabase Auth và cấp mã thiết bị Smart Equipment ID theo Plan A/B/C/D.

## Phạm vi hiện có

- Đăng nhập bằng email/mật khẩu; tài khoản được Admin tạo/cấp trước, không mở đăng ký tự do.
- Quản lý hồ sơ thiết bị tại Local bằng IndexedDB (Dexie).
- Phân vùng dữ liệu Local theo tổ chức đang chọn; tài khoản thuộc nhiều tổ chức phải chọn tổ chức sau đăng nhập.
- Smart Equipment ID: nhận diện tên thiết bị theo Catalog Snapshot của tổ chức; người dùng xác nhận loại/nhóm; Cloud giữ số thứ tự nguyên tử; Local ghép mã hoàn chỉnh và lưu hồ sơ trước; Cloud xác nhận reservation sau đó.
- Plan A không dùng nhóm; Plan B có nhóm; Plan C/D có nhóm, mã cơ sở và tháng/năm đưa vào sử dụng.
- Local ↔ Cloud cho phép nhập hồ sơ giữ nguyên UUID/mã quản lý, tải danh sách Cloud và sửa có khóa theo thiết bị.
- Ảnh thiết bị hiện lưu Local trong trình duyệt, chưa đồng bộ Cloud.

## Supabase đang sử dụng

Project: `BAOTRI-Mini-New`  
Project ref: `dskeaiyvldiwlsfqkboq`  
Region: `ap-southeast-1`

Không dùng cấu hình của Supabase Production/Test cũ.

### Cấu hình frontend

Sao chép `.env.example` thành `.env.local` và kiểm tra:

```dotenv
VITE_SUPABASE_URL=https://dskeaiyvldiwlsfqkboq.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-cua-project-BAOTRI-Mini-New>
```

Chỉ dùng publishable key ở frontend. Tuyệt đối không đưa `service_role` hoặc secret key vào biến `VITE_*`.

### Điều kiện để đăng nhập và cấp mã

1. Tài khoản Auth đã được tạo và email xác nhận theo chính sách của tổ chức.
2. Tài khoản có membership `active` trong một tổ chức đang `active`.
3. Membership có role và permission phù hợp; Admin cần `assets.create` để thêm thiết bị.
4. Tổ chức phải được gán Plan và có `organization_equipment_catalog` (Catalog Snapshot). Nếu chưa có Catalog Snapshot, giao diện sẽ không cấp mã chính thức.
5. Smart ID cần các migration engine/reservation đã áp dụng trên đúng project. Các migration Cloud Asset Public Key cần được áp dụng trước khi bật các luồng Cloud asset theo mã quản lý.
6. Email confirmation và password reset cần Site URL/Redirect URLs trong Supabase Auth khớp với domain đang chạy và `http://localhost:5173/**` khi phát triển local.

## Chạy trên máy tính

```bash
npm install
npm run dev
```

Mở `http://localhost:5173`.

Không cần chạy chế độ Local Preview để thử cấp mã chính thức: Local Preview chỉ là dữ liệu mô phỏng, không gọi bộ cấp số Cloud. Muốn thử Smart Equipment ID chính thức, đăng nhập bằng tài khoản Admin, chọn đúng tổ chức đã được gán Plan/Catalog Snapshot, sau đó vào **Thêm thiết bị**.

## Nguyên tắc dữ liệu

- Local là nơi tạo/sửa hồ sơ và lưu mã hoàn chỉnh.
- Cloud cấp số thứ tự, xác nhận reservation và lưu bản phản chiếu có kiểm soát.
- UUID kỹ thuật và mã quản lý là bất biến sau khi tạo.
- Không tự sinh số thứ tự ngoại tuyến.
- Không tự tạo tài khoản, tổ chức, membership hoặc Plan ngoài quy trình quản trị được phê duyệt.
