-- Platform customer provisioning with a Plan-specific, tenant-owned catalog snapshot.
-- The published catalog is copied from public/data/baotri-config.json dataVersion 1.1.0.
-- New customer organization, built-in roles, Plan snapshot and first Admin membership are atomic.

begin;

create table if not exists private.standard_equipment_catalog_versions (
  data_version text primary key,
  schema_version text not null,
  catalog jsonb not null,
  is_current boolean not null default false,
  published_at timestamptz not null default now(),
  constraint standard_equipment_catalog_versions_object
    check (jsonb_typeof(catalog) = 'object')
);

create unique index if not exists standard_equipment_catalog_one_current
on private.standard_equipment_catalog_versions(is_current)
where is_current;

alter table private.standard_equipment_catalog_versions enable row level security;
revoke all on table private.standard_equipment_catalog_versions from public, anon, authenticated, service_role;

insert into private.standard_equipment_catalog_versions(data_version,schema_version,catalog,is_current)
values ('1.1.0','1.0.0',$${"schemaVersion":"1.0.0","dataVersion":"1.1.0","sourceDocument":"THIET_BI.md","description":"Cấu hình Plan, ngành nghề, nhóm thiết bị, từ điển thiết bị và quy tắc sinh mã ID cho BAOTRI Mini.","plans":[{"id":"A","name":"Cơ bản","maxDevices":200,"features":{"equipmentGroups":false,"multipleSites":false},"idRule":"PLAN_A"},{"id":"B","name":"Tiêu chuẩn","maxDevices":500,"features":{"equipmentGroups":true,"multipleSites":false},"idRule":"PLAN_B"},{"id":"C","name":"Chuyên nghiệp","maxDevices":1000,"features":{"equipmentGroups":true,"multipleSites":true},"idRule":"PLAN_C"},{"id":"D","name":"Doanh nghiệp chuyên sâu","maxDevices":null,"features":{"equipmentGroups":true,"multipleSites":true},"idRule":"PLAN_D"}],"industries":[{"code":"A01","name":"Nhà nghỉ, homestay","plan":"A","aliases":["Homestay","Nhà nghỉ"]},{"code":"A02","name":"Khách sạn nhỏ","plan":"A","aliases":["Khách sạn mini"]},{"code":"A03","name":"Cửa hàng tạp hóa","plan":"A","aliases":["Tạp hóa"]},{"code":"A04","name":"Cửa hàng bán lẻ","plan":"A","aliases":["Shop","Cửa hàng"]},{"code":"A05","name":"Quán ăn, nhà hàng nhỏ","plan":"A","aliases":["Quán ăn","Nhà hàng nhỏ"]},{"code":"A06","name":"Quán cà phê, trà sữa","plan":"A","aliases":["Quán cafe","Trà sữa"]},{"code":"A07","name":"Salon tóc, spa","plan":"A","aliases":["Tiệm tóc","Spa"]},{"code":"A08","name":"Tiệm sửa chữa","plan":"A","aliases":["Cửa hàng sửa chữa"]},{"code":"A09","name":"Văn phòng công ty","plan":"A","aliases":["Văn phòng"]},{"code":"A10","name":"Cơ sở kinh doanh dịch vụ","plan":"A","aliases":["Dịch vụ"]},{"code":"A11","name":"Hộ kinh doanh khác","plan":"A","aliases":["Hộ kinh doanh"]},{"code":"B01","name":"Khách sạn","plan":"B","aliases":["Khách sạn"]},{"code":"B02","name":"Nhà hàng","plan":"B","aliases":["Nhà hàng"]},{"code":"B03","name":"Trung tâm thương mại","plan":"B","aliases":["TTTM"]},{"code":"B04","name":"Siêu thị","plan":"B","aliases":["Siêu thị"]},{"code":"B05","name":"Trường học","plan":"B","aliases":["Trường","Cơ sở giáo dục"]},{"code":"B06","name":"Phòng khám","plan":"B","aliases":["Phòng khám tư"]},{"code":"B07","name":"Văn phòng, tòa nhà","plan":"B","aliases":["Tòa nhà văn phòng"]},{"code":"B08","name":"Nhà xưởng nhỏ","plan":"B","aliases":["Xưởng sản xuất"]},{"code":"B09","name":"Cơ sở dịch vụ","plan":"B","aliases":["Doanh nghiệp dịch vụ"]},{"code":"B10","name":"Cửa hàng và chuỗi bán lẻ","plan":"B","aliases":["Chuỗi cửa hàng","Bán lẻ"]},{"code":"C01","name":"Sản xuất công nghiệp","plan":"C","aliases":["Nhà máy","Sản xuất"]},{"code":"C02","name":"Cơ khí chế tạo","plan":"C","aliases":["Cơ khí"]},{"code":"C03","name":"Điện, điện tử","plan":"C","aliases":["Sản xuất điện tử"]},{"code":"C04","name":"Sản xuất hóa chất","plan":"C","aliases":["Hóa chất"]},{"code":"C05","name":"Dược phẩm","plan":"C","aliases":["Nhà máy dược"]},{"code":"C06","name":"Thực phẩm, đồ uống","plan":"C","aliases":["Chế biến thực phẩm","Đồ uống"]},{"code":"C07","name":"Kho vận, logistics","plan":"C","aliases":["Kho vận","Logistics"]},{"code":"C08","name":"Nông nghiệp công nghệ cao","plan":"C","aliases":["Nông nghiệp"]},{"code":"C09","name":"Chế biến thủy sản","plan":"C","aliases":["Thủy sản"]},{"code":"C10","name":"Sản xuất vật liệu","plan":"C","aliases":["Vật liệu xây dựng"]},{"code":"C11","name":"Tòa nhà, khu công nghiệp","plan":"C","aliases":["Khu công nghiệp","KCN"]},{"code":"D01","name":"Hóa chất công nghiệp","plan":"D","aliases":["Hóa chất quy mô lớn"]},{"code":"D02","name":"Dược phẩm, hóa mỹ phẩm","plan":"D","aliases":["Dược","Hóa mỹ phẩm"]},{"code":"D03","name":"Chế biến thực phẩm","plan":"D","aliases":["Nhà máy thực phẩm"]},{"code":"D04","name":"Điện tử, bán dẫn","plan":"D","aliases":["Bán dẫn"]},{"code":"D05","name":"Xi măng, vật liệu xây dựng","plan":"D","aliases":["Xi măng"]},{"code":"D06","name":"Luyện kim, thép","plan":"D","aliases":["Thép","Luyện kim"]},{"code":"D07","name":"Đóng tàu","plan":"D","aliases":["Công nghiệp đóng tàu"]},{"code":"D08","name":"Dầu khí","plan":"D","aliases":["Dầu khí"]},{"code":"D09","name":"Nhiệt điện","plan":"D","aliases":["Nhà máy nhiệt điện"]},{"code":"D10","name":"Sản xuất giấy","plan":"D","aliases":["Giấy"]},{"code":"D11","name":"Dệt may","plan":"D","aliases":["May mặc","Dệt"]},{"code":"D12","name":"Chế biến thủy sản quy mô công nghiệp","plan":"D","aliases":["Nhà máy thủy sản"]}],"equipmentGroups":[{"code":"DIE","name":"Hệ thống điện","availableFromPlan":"B","aliases":["Điện","Điện công nghiệp"]},{"code":"NUO","name":"Cấp thoát nước","availableFromPlan":"B","aliases":["Nước","Cấp nước","Thoát nước"]},{"code":"HVAC","name":"Điều hòa, thông gió","availableFromPlan":"B","aliases":["Điều hòa","Thông gió"]},{"code":"PCCC","name":"Phòng cháy chữa cháy","availableFromPlan":"B","aliases":["Phòng cháy","Chữa cháy"]},{"code":"LIF","name":"Thang máy, thang cuốn","availableFromPlan":"B","aliases":["Thang máy"]},{"code":"IT","name":"Công nghệ thông tin","availableFromPlan":"B","aliases":["CNTT","Mạng máy tính"]},{"code":"SEC","name":"An ninh, camera","availableFromPlan":"B","aliases":["Camera","Kiểm soát ra vào"]},{"code":"GEN","name":"Máy phát điện","availableFromPlan":"B","aliases":["Nguồn dự phòng"]},{"code":"PRO","name":"Thiết bị sản xuất","availableFromPlan":"B","aliases":["Máy sản xuất","Dây chuyền"]},{"code":"KHI","name":"Khí nén","availableFromPlan":"C","aliases":["Hệ thống khí nén"]},{"code":"LAN","name":"Hệ thống lạnh","availableFromPlan":"C","aliases":["Kho lạnh","Làm lạnh"]},{"code":"CNC","name":"Máy CNC","availableFromPlan":"C","aliases":["Gia công CNC"]},{"code":"BANG","name":"Băng tải, dây chuyền","availableFromPlan":"C","aliases":["Băng chuyền"]},{"code":"NEN","name":"Hệ thống máy nén khí","availableFromPlan":"C","aliases":["Máy nén khí"]},{"code":"NHI","name":"Lò hơi, hệ thống nhiệt","availableFromPlan":"C","aliases":["Lò hơi","Nhiệt công nghiệp"]},{"code":"XLN","name":"Xử lý nước","availableFromPlan":"C","aliases":["Nước thải","Nước cấp xử lý"]},{"code":"XLK","name":"Xử lý khí thải","availableFromPlan":"C","aliases":["Khí thải"]},{"code":"REA","name":"Thiết bị phản ứng","availableFromPlan":"D","aliases":["Reactor"]},{"code":"DIS","name":"Thiết bị chưng cất","availableFromPlan":"D","aliases":["Tháp chưng cất"]},{"code":"SEP","name":"Thiết bị phân ly","availableFromPlan":"D","aliases":["Thiết bị tách"]},{"code":"MIX","name":"Máy trộn công nghiệp","availableFromPlan":"D","aliases":["Máy khuấy trộn"]},{"code":"DRY","name":"Thiết bị sấy","availableFromPlan":"D","aliases":["Máy sấy công nghiệp"]},{"code":"FIL","name":"Hệ thống lọc","availableFromPlan":"D","aliases":["Thiết bị lọc"]},{"code":"CHP","name":"Máy nghiền, máy băm","availableFromPlan":"D","aliases":["Máy nghiền công nghiệp"]},{"code":"BOI","name":"Lò hơi công nghiệp","availableFromPlan":"D","aliases":["Nồi hơi"]},{"code":"TUR","name":"Tuabin","availableFromPlan":"D","aliases":["Turbine"]},{"code":"COM","name":"Máy nén công nghiệp","availableFromPlan":"D","aliases":["Compressor công nghiệp"]},{"code":"ROB","name":"Robot công nghiệp","availableFromPlan":"D","aliases":["Robot"]},{"code":"PLC","name":"Hệ thống điều khiển PLC","availableFromPlan":"D","aliases":["PLC"]},{"code":"INS","name":"Thiết bị đo lường, cảm biến","availableFromPlan":"D","aliases":["Instrumentation","Cảm biến"]}],"equipmentDictionary":[{"standardName":"Máy bơm nước","shortCode":"BOM","aliases":["Bơm nước","Bơm tăng áp"],"suggestedGroup":"NUO"},{"standardName":"Động cơ điện","shortCode":"MOT","aliases":["Motor","Mô tơ"],"suggestedGroup":"DIE"},{"standardName":"Máy nén khí","shortCode":"NEN","aliases":["Compressor"],"suggestedGroup":"KHI"},{"standardName":"Máy phát điện","shortCode":"GEN","aliases":["Generator"],"suggestedGroup":"GEN"},{"standardName":"Máy điều hòa","shortCode":"DH","aliases":["Máy lạnh","Điều hòa"],"suggestedGroup":"HVAC"},{"standardName":"Quạt công nghiệp","shortCode":"QG","aliases":["Quạt hút","Quạt thông gió"],"suggestedGroup":"HVAC"},{"standardName":"Tủ điện","shortCode":"TD","aliases":["Tủ điều khiển"],"suggestedGroup":"DIE"},{"standardName":"Biến tần","shortCode":"BT","aliases":["Inverter","VFD"],"suggestedGroup":"DIE"},{"standardName":"Máy biến áp","shortCode":"MBA","aliases":["MBA","Biến áp"],"suggestedGroup":"DIE"},{"standardName":"Cảm biến áp suất","shortCode":"CAP","aliases":["Pressure sensor"],"suggestedGroup":"INS"},{"standardName":"Máy bơm nước thải","shortCode":"BNT","aliases":["Bơm chìm nước thải","Submersible wastewater pump"],"suggestedGroup":"NUO"},{"standardName":"Máy bơm định lượng","shortCode":"BDL","aliases":["Bơm hóa chất định lượng","Metering pump"],"suggestedGroup":"NUO"},{"standardName":"Bình tích áp","shortCode":"BTA","aliases":["Bình áp lực","Pressure tank"],"suggestedGroup":"NUO"},{"standardName":"Van điều khiển","shortCode":"VDC","aliases":["Van tự động","Control valve"],"suggestedGroup":"NUO"},{"standardName":"Quạt thông gió","shortCode":"QTG","aliases":["Quạt hút gió","Ventilation fan"],"suggestedGroup":"HVAC"},{"standardName":"AHU","shortCode":"AHU","aliases":["Air Handling Unit","Air handler"],"suggestedGroup":"HVAC"},{"standardName":"FCU","shortCode":"FCU","aliases":["Fan Coil Unit","Dàn lạnh FCU"],"suggestedGroup":"HVAC"},{"standardName":"Chiller","shortCode":"CHL","aliases":["Máy làm lạnh nước","Water chiller"],"suggestedGroup":"HVAC"},{"standardName":"Tháp giải nhiệt","shortCode":"TGN","aliases":["Cooling tower","Tháp cooling"],"suggestedGroup":"HVAC"},{"standardName":"Máy nén lạnh","shortCode":"MNL","aliases":["Compressor lạnh","Refrigeration compressor"],"suggestedGroup":"LAN"},{"standardName":"Tủ đông","shortCode":"TDO","aliases":["Tủ cấp đông","Freezer"],"suggestedGroup":"LAN"},{"standardName":"Kho lạnh","shortCode":"KHL","aliases":["Phòng lạnh","Cold room"],"suggestedGroup":"LAN"},{"standardName":"Máy hút ẩm","shortCode":"MHA","aliases":["Thiết bị hút ẩm","Dehumidifier"],"suggestedGroup":"HVAC"},{"standardName":"Máy cắt điện","shortCode":"MCD","aliases":["Circuit breaker","Máy cắt"],"suggestedGroup":"DIE"},{"standardName":"Aptomat","shortCode":"APT","aliases":["CB","Circuit breaker"],"suggestedGroup":"DIE"},{"standardName":"Tủ ATS","shortCode":"ATS","aliases":["Bộ chuyển nguồn tự động","Automatic transfer switch"],"suggestedGroup":"DIE"},{"standardName":"Bộ lưu điện","shortCode":"UPS","aliases":["UPS","Uninterruptible power supply"],"suggestedGroup":"DIE"},{"standardName":"Tụ bù","shortCode":"TBU","aliases":["Tủ tụ bù","Power factor capacitor bank"],"suggestedGroup":"DIE"},{"standardName":"Đèn chiếu sáng","shortCode":"DCS","aliases":["Đèn LED","Lighting fixture"],"suggestedGroup":"DIE"},{"standardName":"Máy phát điện dự phòng","shortCode":"MPD","aliases":["Generator dự phòng","Standby generator"],"suggestedGroup":"GEN"},{"standardName":"Bình chữa cháy","shortCode":"BCC","aliases":["Bình PCCC","Fire extinguisher"],"suggestedGroup":"PCCC"},{"standardName":"Tủ báo cháy","shortCode":"TBC","aliases":["Trung tâm báo cháy","Fire alarm panel"],"suggestedGroup":"PCCC"},{"standardName":"Bơm chữa cháy","shortCode":"BCP","aliases":["Bơm cứu hỏa","Firefighting pump"],"suggestedGroup":"PCCC"},{"standardName":"Đầu báo khói","shortCode":"DBK","aliases":["Cảm biến khói","Smoke detector"],"suggestedGroup":"PCCC"},{"standardName":"Thang máy","shortCode":"TM","aliases":["Elevator","Lift"],"suggestedGroup":"LIF"},{"standardName":"Thang cuốn","shortCode":"TC","aliases":["Escalator","Thang tự động"],"suggestedGroup":"LIF"},{"standardName":"Camera giám sát","shortCode":"CAM","aliases":["Camera CCTV","CCTV camera"],"suggestedGroup":"SEC"},{"standardName":"Đầu ghi hình","shortCode":"DVR","aliases":["NVR","Video recorder"],"suggestedGroup":"SEC"},{"standardName":"Bộ kiểm soát cửa","shortCode":"KSC","aliases":["Access control","Kiểm soát ra vào"],"suggestedGroup":"SEC"},{"standardName":"Switch mạng","shortCode":"SW","aliases":["Bộ chuyển mạch","Network switch"],"suggestedGroup":"IT"},{"standardName":"Router mạng","shortCode":"RTR","aliases":["Bộ định tuyến","Network router"],"suggestedGroup":"IT"},{"standardName":"Máy chủ","shortCode":"SRV","aliases":["Server","Máy chủ dữ liệu"],"suggestedGroup":"IT"},{"standardName":"Máy tính công nghiệp","shortCode":"IPC","aliases":["Industrial PC","Máy tính điều khiển"],"suggestedGroup":"IT"},{"standardName":"Máy nén khí trục vít","shortCode":"NKT","aliases":["Máy nén trục vít","Screw air compressor"],"suggestedGroup":"KHI"},{"standardName":"Máy sấy khí","shortCode":"MSK","aliases":["Bộ sấy khí nén","Air dryer"],"suggestedGroup":"KHI"},{"standardName":"Bình chứa khí nén","shortCode":"BCK","aliases":["Bình tích khí","Air receiver"],"suggestedGroup":"KHI"},{"standardName":"Bộ lọc khí nén","shortCode":"BLK","aliases":["Lọc đường khí","Compressed air filter"],"suggestedGroup":"KHI"},{"standardName":"Băng tải","shortCode":"BTAI","aliases":["Băng chuyền","Conveyor"],"suggestedGroup":"BANG"},{"standardName":"Động cơ giảm tốc","shortCode":"MGT","aliases":["Motor giảm tốc","Gear motor"],"suggestedGroup":"PRO"},{"standardName":"Hộp giảm tốc","shortCode":"HGT","aliases":["Gearbox","Hộp số giảm tốc"],"suggestedGroup":"PRO"},{"standardName":"Máy CNC tiện","shortCode":"CNC-T","aliases":["Máy tiện CNC","CNC lathe"],"suggestedGroup":"CNC"},{"standardName":"Máy CNC phay","shortCode":"CNC-P","aliases":["Máy phay CNC","CNC milling machine"],"suggestedGroup":"CNC"},{"standardName":"Máy cắt công nghiệp","shortCode":"MCI","aliases":["Máy cắt vật liệu","Industrial cutting machine"],"suggestedGroup":"PRO"},{"standardName":"Lò hơi","shortCode":"LHO","aliases":["Nồi hơi","Boiler"],"suggestedGroup":"NHI"},{"standardName":"Bơm nước cấp lò hơi","shortCode":"BCL","aliases":["Boiler feed pump","Bơm cấp nước lò"],"suggestedGroup":"NHI"},{"standardName":"Hệ thống xử lý nước thải","shortCode":"HTN","aliases":["Trạm xử lý nước thải","Wastewater treatment system"],"suggestedGroup":"XLN"},{"standardName":"Quạt hút khí thải","shortCode":"QKT","aliases":["Quạt xử lý khí thải","Exhaust gas fan"],"suggestedGroup":"XLK"},{"standardName":"Thiết bị trao đổi nhiệt","shortCode":"TDT","aliases":["Bộ trao đổi nhiệt","Heat exchanger"],"suggestedGroup":"NHI"},{"standardName":"Bồn chứa công nghiệp","shortCode":"BCN","aliases":["Bể chứa","Industrial tank"],"suggestedGroup":"PRO"},{"standardName":"Bồn phản ứng","shortCode":"BPU","aliases":["Reactor","Thiết bị phản ứng"],"suggestedGroup":"REA"},{"standardName":"Tháp chưng cất","shortCode":"TCC","aliases":["Cột chưng cất","Distillation column"],"suggestedGroup":"DIS"},{"standardName":"Máy ly tâm","shortCode":"MLT","aliases":["Centrifuge","Thiết bị phân ly ly tâm"],"suggestedGroup":"SEP"},{"standardName":"Máy trộn công nghiệp","shortCode":"MTR","aliases":["Mixer","Máy khuấy trộn"],"suggestedGroup":"MIX"},{"standardName":"Máy sấy công nghiệp","shortCode":"MSY","aliases":["Dryer","Thiết bị sấy"],"suggestedGroup":"DRY"},{"standardName":"Máy lọc công nghiệp","shortCode":"MLC","aliases":["Industrial filter","Thiết bị lọc"],"suggestedGroup":"FIL"},{"standardName":"Máy nghiền công nghiệp","shortCode":"MNG","aliases":["Crusher","Máy nghiền"],"suggestedGroup":"CHP"},{"standardName":"Tuabin hơi","shortCode":"TBH","aliases":["Steam turbine","Turbine hơi"],"suggestedGroup":"TUR"},{"standardName":"Robot công nghiệp","shortCode":"RBT","aliases":["Industrial robot","Robot tự động"],"suggestedGroup":"ROB"},{"standardName":"PLC điều khiển","shortCode":"PLC","aliases":["Bộ điều khiển PLC","Programmable logic controller"],"suggestedGroup":"PLC"},{"standardName":"Cảm biến nhiệt độ","shortCode":"CBN","aliases":["Temperature sensor","Đầu dò nhiệt"],"suggestedGroup":"INS"},{"standardName":"Cảm biến lưu lượng","shortCode":"CBL","aliases":["Flow sensor","Lưu lượng kế"],"suggestedGroup":"INS"},{"standardName":"Cảm biến mức","shortCode":"CBM","aliases":["Level sensor","Phao/cảm biến mức"],"suggestedGroup":"INS"},{"standardName":"Đồng hồ áp suất","shortCode":"DHA","aliases":["Pressure gauge","Áp kế"],"suggestedGroup":"INS"},{"standardName":"Bộ truyền tín hiệu","shortCode":"BTT","aliases":["Transmitter","Bộ transmitter"],"suggestedGroup":"INS"}],"idRules":{"common":{"uniqueScope":"organization","immutableAfterAssignment":true,"neverReuseAssignedIds":true,"preserveExistingIdsOnPlanChange":true,"sequenceMustExpandBeyondThreeDigits":true,"aiMaySuggestButMustNotAllocateOfficialSequence":true},"PLAN_A":{"pattern":"{EQUIPMENT_CODE}-{SEQUENCE}","equipmentCodeLength":{"min":2,"max":4},"sequence":{"start":1,"minWidth":3,"maxDevices":200},"includesGroupCode":false,"includesSiteCode":false,"includesCommissionMonthYear":false},"PLAN_B":{"pattern":"{EQUIPMENT_CODE}-{GROUP_CODE}-{SEQUENCE}","equipmentCodeLength":{"min":2,"max":4},"sequence":{"start":1,"minWidth":3,"maxDevices":500},"includesGroupCode":true,"includesSiteCode":false,"includesCommissionMonthYear":false},"PLAN_C":{"pattern":"{EQUIPMENT_CODE}-{GROUP_CODE}-{SITE_CODE}-{SEQUENCE}-{MMYY}","equipmentCodeLength":{"min":2,"max":4},"siteCode":{"default":"00","format":"two-digit-sequence"},"sequence":{"start":1,"minWidth":3,"scope":"organization+equipmentCode+groupCode+siteCode","expandable":true},"commissionMonthYear":{"format":"MMYY","source":"confirmedCommissioningDate"},"includesGroupCode":true,"includesSiteCode":true,"includesCommissionMonthYear":true},"PLAN_D":{"pattern":"{EQUIPMENT_CODE}-{GROUP_CODE}-{SITE_CODE}-{SEQUENCE}-{MMYY}","equipmentCodeLength":{"min":2,"max":4},"siteCode":{"default":"00","format":"two-digit-sequence"},"sequence":{"start":1,"minWidth":3,"scope":"organization+equipmentCode+groupCode+siteCode","expandable":true},"commissionMonthYear":{"format":"MMYY","source":"confirmedCommissioningDate"},"includesGroupCode":true,"includesSiteCode":true,"includesCommissionMonthYear":true}},"notes":["Ngành nghề chỉ cung cấp ngữ cảnh và gợi ý, không giới hạn loại thiết bị doanh nghiệp được phép khai báo.","Plan A không hiển thị chức năng nhóm thiết bị; Engine vẫn có thể dùng phân loại nội bộ để hỗ trợ nhận diện.","Các mã nhóm và mã thiết bị là hai lớp khác nhau. Ví dụ BOM là mã loại máy bơm, NUO là mã nhóm cấp thoát nước.","Danh mục hiện là dữ liệu khởi tạo theo phương án đã duyệt; có thể mở rộng bằng cách tăng dataVersion và giữ nguyên schemaVersion.","Tệp này chỉ cung cấp cấu hình dữ liệu. Ứng dụng cần được tích hợp bộ đọc và kiểm tra dữ liệu riêng trước khi sử dụng trong nghiệp vụ.","Danh mục chuẩn được sao chép thành snapshot độc lập cho từng Organization tại thời điểm khởi tạo thuê bao; khách hàng tự bổ sung dữ liệu trong danh mục riêng.","Cập nhật baotri-config.json chỉ áp dụng cho Organization được khởi tạo sau phiên bản mới; không tự động cập nhật hoặc hợp nhất danh mục của khách hàng hiện hữu.","Mã nhóm thiết bị có thể dài 2–4 ký tự; không mặc định mọi mã nhóm đều có đúng 3 ký tự."],"tenantCatalogPolicy":{"mode":"snapshot","source":"public/data/baotri-config.json","initializeOn":"organization_subscription_or_catalog_initialization","copyScope":"plan","existingOrganizations":"keep_existing_snapshot_and_customer_customizations","newOrganizations":"use_latest_published_standard_catalog","customerAdditions":"organization_scoped_only","automaticCatalogMerge":false,"automaticStandardCatalogUpdates":false,"snapshotMetadata":["organization_id","plan_id","source_data_version","initialized_at"]}}$$::jsonb,true);

create or replace function private.platform_provision_customer(
  p_organization_name text,
  p_actor_user_id uuid,
  p_admin_user_id uuid,
  p_admin_email text,
  p_plan_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
set row_security = off
as $function$
declare
  v_actor_email text;
  v_admin_email text;
  v_admin_confirmed boolean;
  v_plan_code text := upper(btrim(coalesce(p_plan_code,'')));
  v_plan_rank integer;
  v_catalog jsonb;
  v_plan jsonb;
  v_groups jsonb;
  v_dictionary jsonb;
  v_industries jsonb;
  v_snapshot jsonb;
  v_org_id uuid;
  v_org_name text;
  v_admin_role_id uuid;
  v_member_id uuid;
  v_source_version text;
begin
  if coalesce(pg_catalog.current_setting('request.jwt.claim.role',true),'') <> 'service_role' then
    raise exception 'Only the trusted platform provisioning service may create customer organizations' using errcode = '42501';
  end if;

  if nullif(btrim(p_organization_name),'') is null or length(btrim(p_organization_name)) not between 2 and 120 then
    raise exception 'Organization name must contain 2 to 120 characters' using errcode = '22023';
  end if;
  if v_plan_code not in ('A','B','C','D') then
    raise exception 'A valid Plan A, B, C or D must be selected before creating a customer' using errcode = '22023';
  end if;

  select pg_catalog.lower(u.email) into v_actor_email
  from auth.users u where u.id=p_actor_user_id;
  if v_actor_email is distinct from 'tuanluongpham1980@gmail.com' then
    raise exception 'The verified platform owner is not authorized for customer provisioning' using errcode = '42501';
  end if;

  select pg_catalog.lower(u.email), (u.email_confirmed_at is not null)
  into v_admin_email,v_admin_confirmed
  from auth.users u where u.id=p_admin_user_id;
  if v_admin_email is null or v_admin_email is distinct from pg_catalog.lower(btrim(coalesce(p_admin_email,''))) then
    raise exception 'The selected first Admin does not match a real Auth account' using errcode = '22023';
  end if;
  if not exists(select 1 from public.profiles p where p.id=p_admin_user_id) then
    raise exception 'The first Admin profile is not ready yet' using errcode = '22023';
  end if;

  v_plan_rank := case v_plan_code when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 end;

  select c.catalog,c.data_version into v_catalog,v_source_version
  from private.standard_equipment_catalog_versions c
  where c.is_current
  order by c.published_at desc
  limit 1;
  if v_catalog is null then
    raise exception 'No published standard equipment catalog is available for provisioning' using errcode = '55000';
  end if;

  select p into v_plan
  from pg_catalog.jsonb_array_elements(v_catalog->'plans') p
  where p->>'id'=v_plan_code
  limit 1;
  if v_plan is null then
    raise exception 'Selected Plan is not present in the published catalog version %',v_source_version using errcode = '22023';
  end if;

  select coalesce(pg_catalog.jsonb_agg(g order by x.ordinality),'[]'::jsonb)
  into v_groups
  from pg_catalog.jsonb_array_elements(v_catalog->'equipmentGroups') with ordinality as x(g,ordinality)
  where case coalesce(g->>'availableFromPlan','B')
    when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 99 end <= v_plan_rank;

  -- Keep all standard equipment-name matches, but remove suggestions for groups
  -- unavailable in this Plan. Plan A deliberately has no visible/usable groups.
  select coalesce(pg_catalog.jsonb_agg(
    case
      when nullif(d->>'suggestedGroup','') is not null and not exists (
        select 1 from pg_catalog.jsonb_array_elements(v_groups) g
        where pg_catalog.regexp_replace(pg_catalog.upper(coalesce(g->>'code','')),'[^A-Z0-9]','','g')
          = pg_catalog.regexp_replace(pg_catalog.upper(coalesce(d->>'suggestedGroup','')),'[^A-Z0-9]','','g')
      ) then d - 'suggestedGroup'
      else d
    end
    order by x.ordinality
  ),'[]'::jsonb)
  into v_dictionary
  from pg_catalog.jsonb_array_elements(v_catalog->'equipmentDictionary') with ordinality as x(d,ordinality);

  select coalesce(pg_catalog.jsonb_agg(i order by x.ordinality),'[]'::jsonb)
  into v_industries
  from pg_catalog.jsonb_array_elements(v_catalog->'industries') with ordinality as x(i,ordinality)
  where case coalesce(i->>'plan','A')
    when 'A' then 1 when 'B' then 2 when 'C' then 3 when 'D' then 4 else 99 end <= v_plan_rank;

  v_snapshot := pg_catalog.jsonb_build_object(
    'schemaVersion',v_catalog->'schemaVersion',
    'dataVersion',v_source_version,
    'plan',v_plan,
    'plans',pg_catalog.jsonb_build_array(v_plan),
    'industries',v_industries,
    'equipmentGroups',v_groups,
    'equipmentDictionary',v_dictionary,
    'idRules',pg_catalog.jsonb_build_object(
      'common',v_catalog->'idRules'->'common',
      'selectedPlan',v_catalog->'idRules'->('PLAN_'||v_plan_code)
    ),
    'tenantCatalogPolicy',v_catalog->'tenantCatalogPolicy',
    'notes',v_catalog->'notes'
  );

  insert into public.organizations(name,created_by)
  values (btrim(p_organization_name),p_actor_user_id)
  returning id,name into v_org_id,v_org_name;

  -- The existing AFTER INSERT trigger seeds the three built-in roles and grants.
  select r.id into v_admin_role_id
  from public.roles r
  where r.organization_id=v_org_id and r.code='admin' and r.is_system=true;
  if v_admin_role_id is null then
    raise exception 'Built-in Admin role was not seeded for the new organization' using errcode = '55000';
  end if;

  insert into public.organization_equipment_catalog(
    organization_id,plan_code,source_data_version,snapshot,created_by_user_id
  ) values (v_org_id,v_plan_code,v_source_version,v_snapshot,p_actor_user_id);

  insert into public.organization_members(
    organization_id,user_id,role,status,invited_by_user_id
  ) values (
    v_org_id,p_admin_user_id,'admin',
    case when v_admin_confirmed then 'active' else 'invited' end,
    p_actor_user_id
  ) returning id into v_member_id;

  insert into public.member_roles(organization_id,member_id,role_id,assigned_by_user_id)
  values (v_org_id,v_member_id,v_admin_role_id,p_actor_user_id);

  return pg_catalog.jsonb_build_object(
    'ok',true,
    'organizationId',v_org_id,
    'organizationName',v_org_name,
    'adminEmail',v_admin_email,
    'status',case when v_admin_confirmed then 'active' else 'invited' end,
    'planCode',v_plan_code,
    'planName',v_plan->>'name',
    'maxDevices',v_plan->'maxDevices',
    'sourceDataVersion',v_source_version,
    'equipmentGroups',pg_catalog.jsonb_array_length(v_groups),
    'equipmentDictionary',pg_catalog.jsonb_array_length(v_dictionary),
    'industries',pg_catalog.jsonb_array_length(v_industries)
  );
end;
$function$;

revoke all on function private.platform_provision_customer(text,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant usage on schema private to service_role;
grant execute on function private.platform_provision_customer(text,uuid,uuid,text,text) to service_role;

create or replace function public.platform_provision_customer(
  p_organization_name text,
  p_actor_user_id uuid,
  p_admin_user_id uuid,
  p_admin_email text,
  p_plan_code text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $function$
  select private.platform_provision_customer(
    p_organization_name,p_actor_user_id,p_admin_user_id,p_admin_email,p_plan_code
  );
$function$;

revoke all on function public.platform_provision_customer(text,uuid,uuid,text,text) from public,anon,authenticated,service_role;
grant execute on function public.platform_provision_customer(text,uuid,uuid,text,text) to service_role;

comment on function public.platform_provision_customer(text,uuid,uuid,text,text) is
  'Atomic platform-owner operation: creates a customer organization, seeds built-in roles, assigns its first Admin, and initializes a Plan-filtered tenant Catalog Snapshot from the current published catalog version.';

commit;
