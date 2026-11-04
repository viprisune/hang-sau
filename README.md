# HANG SÂU

Trò chơi sinh tồn thám hiểm hang động 3D góc nhìn thứ nhất (First-Person 3D Cave Exploration Survival Game) với phong cách low-poly u ám, ngột ngạt dành cho trình duyệt máy tính, được xây dựng với **React 19**, **TypeScript**, **Three.js** và **Vite**.

## Yêu cầu hệ thống

- **Node.js** >= 18
- **npm** >= 9

## Hướng dẫn cài đặt và chạy (Run Instructions)

1. **Cài đặt các gói phụ thuộc:**
   ```bash
   npm install
   ```

2. **Chạy máy chủ phát triển (Development Server):**
   ```bash
   npm run dev
   ```
   Sau đó mở trình duyệt tại địa chỉ `http://localhost:3000`.

3. **Kiểm tra kiểu dữ liệu (Typecheck / Lint):**
   ```bash
   npm run lint
   ```

4. **Đóng gói bản dựng sản phẩm (Production Build):**
   ```bash
   npm run build
   ```

## Điều khiển trong trò chơi

- **Bắt đầu:** Nhấn nút **Bắt đầu** trên màn hình khởi động để vào hang.
- **Quan sát (Mouse Look):** Nhấp chuột vào khung hình để khóa con trỏ chuột (Pointer Lock) và xoay góc nhìn. Nếu chạy trong khung xem trước (iframe) chặn khóa chuột, trò chơi tự động chuyển sang chế độ **giữ và kéo chuột trái** để xoay góc nhìn kèm gợi ý mở trong thẻ mới.
- **Di chuyển (Đi bộ - 1.8 m/s):** Phím `W`, `A`, `S`, `D` hoặc các phím mũi tên (`↑`, `↓`, `←`, `→`).
- **Chạy nhanh (3.2 m/s):** Giữ phím `Shift` trong khi di chuyển.
- **Menu Tạm dừng & Cài đặt (`Esc`):** Nhấn `Esc` để giải phóng chuột và mở bảng cài đặt:
  - **Độ nhạy chuột:** `0.2x` – `3.0x`
  - **Góc nhìn (FOV):** `60°` – `90°` (mặc định `72°`)
  - **Nhấp nhô đầu (Head-bob):** Bật / Tắt
- **Thông số kỹ thuật (`F3`):** Nhấn phím `F3` để bật/tắt bảng hiển thị `FPS`, tọa độ `(X, Y, Z)` theo mét, ô gạch `(cột, hàng)`, tốc độ và số lệnh vẽ (`Draw calls`).

## Cấu trúc thư mục

- `src/config.ts`: Chứa toàn bộ các thông số có thể tinh chỉnh (tỷ lệ thế giới `1 ô = 2m`, độ cao trần `2.8m` / hành lang hẹp `2.0m`, độ cao mắt `1.6m`, tốc độ đi bộ `1.8 m/s` / chạy `3.2 m/s`, bán kính va chạm `0.3m`, thông số sương mù, ánh sáng môi trường và bảng màu lạnh).
- `src/strings.ts`: Tập trung toàn bộ chuỗi văn bản tiếng Việt hiển thị cho người chơi.
- `src/data/caveMap.ts`: Dữ liệu bản đồ hang động mảng 2 chiều `60x40` cùng danh sách măng đá, nhũ đá và tảng đá trong hai khoang hang.
- `src/logic/movement.ts`: Logic di chuyển trên mặt phẳng `x/z`, xoay góc nhìn và giải quyết va chạm hình tròn bán kính `0.3m` chống xuyên tường (hoàn toàn độc lập, không import Three.js).
- `src/game/caveGeometry.ts`: Tạo hình học 3D low-poly flat-shaded cho sàn, trần, tường đá, măng đá với biến thiên màu đỉnh (`vertexColors`) và gộp lưới (`mergeGeometries`) tối ưu số lệnh vẽ.
- `src/game/caveRenderer.ts`: Quản lý vòng đời `THREE.WebGLRenderer`, camera góc nhìn thứ nhất, khóa chuột / kéo chuột dự phòng, bộ đếm `FPS` / `Draw calls` và giải phóng tài nguyên khi hủy component.
- `src/App.tsx`: Khung ứng dụng React với màn hình bắt đầu, menu cài đặt `Esc`, lớp phủ `F3` và gắn kết canvas Three.js an toàn trong `StrictMode`.
