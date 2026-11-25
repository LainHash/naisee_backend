# Dữ liệu Địa giới Hành chính Tỉnh Đồng Nai

Đặt file GeoJSON ranh giới hành chính (định dạng `FeatureCollection`, hệ tọa độ WGS84 `EPSG:4326`) tại:

`naisee_backend/src/core/database/seeds/data/dong-nai-wards.geojson`

Sau đó chạy lệnh từ `naisee_backend`:

```powershell
npm run import:wards
```

Hoặc truyền đường dẫn file tùy chọn:

```powershell
npm run import:wards -- --file=D:\path\to\dong-nai.geojson
```

Mặc định hệ thống kích hoạt toàn bộ đơn vị loại `WARD` (phường). Thêm cờ `--all-communes` nếu muốn kích hoạt đồng thời cả các xã (`COMMUNE`).

# Dữ liệu Seed Nghiệp vụ & Phản ánh (Excel)

File Excel nguồn dữ liệu seed mặc định nằm tại:

`naisee_backend/src/core/database/seeds/data/naisee-seed-data.xlsx`

Gồm 6 sheet: `roles`, `departments`, `categories`, `users`, `media_presets`, và `issues`.

Chạy seed hoặc reset từ `naisee_backend`:

```powershell
npm run seed:reset
```

Hoặc truyền file Excel tùy chọn:

```powershell
npm run seed -- --reset --file=D:\path\to\custom-seed.xlsx
```


