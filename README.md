# HANG SÂU

Trò chơi sinh tồn thám hiểm hang động 2D góc nhìn từ trên xuống (Top-Down 2D Cave Exploration Survival Game) dành cho trình duyệt máy tính, được xây dựng với **React 19**, **TypeScript**, **Phaser 4** và **Vite**.

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
- **Di chuyển (Đi bộ - 90 px/s):** Phím `W`, `A`, `S`, `D` hoặc các phím mũi tên (`↑`, `↓`, `←`, `→`).
- **Chạy nhanh (150 px/s):** Giữ phím `Shift` trong khi di chuyển.
- **Thông số kỹ thuật (Debug Overlay):** Nhấn phím `F3` để bật/tắt bảng hiển thị tọa độ người chơi (pixel & ô gạch) và chỉ số `FPS`.

## Cấu trúc thư mục

- `src/config.ts`: Chứa toàn bộ các thông số có thể tinh chỉnh (kích thước ô gạch, bản đồ, tốc độ đi bộ/chạy, kích thước va chạm, thông số camera, bảng màu).
- `src/strings.ts`: Tập trung toàn bộ chuỗi văn bản tiếng Việt hiển thị cho người chơi.
- `src/data/caveMap.ts`: Dữ liệu bản đồ hang động mảng 2 chiều kích thước `60x40` (mỗi ô `32px`), bao gồm cửa hang, các lối đi quanh co, hai khoang hang lớn và hành lang hẹp 1 ô.
- `src/logic/movement.ts`: Logic di chuyển và giải quyết va chạm tường độc lập với tầng hiển thị (chia nhỏ bước di chuyển chống xuyên tường và trượt mượt dọc theo tường khi đi chéo).
- `src/scenes/CaveScene.ts`: Cảnh Phaser hiển thị bản đồ, người chơi, camera bám theo mượt trong giới hạn bản đồ và lớp phủ debug `F3`.
- `src/game/createGame.ts`: Hàm khởi tạo `Phaser.Game`.
- `src/App.tsx`: Khung ứng dụng React với màn hình bắt đầu và quản lý vòng đời canvas Phaser an toàn trong `StrictMode`.
