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

- **Bắt đầu:** Nhấn nút **Bắt đầu** trên màn hình khởi động để vào hang (kích hoạt âm thanh Web Audio).
- **Quan sát (Mouse Look):** Nhấp chuột vào khung hình để khóa con trỏ chuột (Pointer Lock) và xoay góc nhìn. Nếu chạy trong khung xem trước (iframe) chặn khóa chuột, trò chơi tự động chuyển sang chế độ **giữ và kéo chuột trái** để xoay góc nhìn kèm gợi ý mở trong thẻ mới.
- **Di chuyển (Đi bộ - 1.8 m/s):** Phím `W`, `A`, `S`, `D` hoặc các phím mũi tên (`↑`, `↓`, `←`, `→`).
- **Chạy nhanh (3.2 m/s):** Giữ phím `Shift` trong khi di chuyển.
- **Quẹt diêm (`F`):** Thắp 1 que diêm (người chơi bắt đầu với 5 que diêm, mỗi que cháy trong `25 giây` với tầm chiếu sáng `7.0 m` giảm dần xuống `3.5 m` trong 5 giây cuối). Nhấn `F` khi diêm đang cháy sẽ hiển thị thông báo tiếng Việt và không tốn thêm diêm.
- **Menu Tạm dừng & Cài đặt (`Esc`):** Nhấn `Esc` để giải phóng chuột, tạm dừng bộ đếm thời gian diêm / âm thanh và mở bảng cài đặt:
  - **Độ nhạy chuột:** `0.2x` – `3.0x`
  - **Góc nhìn (FOV):** `60°` – `90°` (mặc định `72°`)
  - **Âm lượng tổng & Tắt tiếng:** Điều chỉnh âm lượng Web Audio (`0%–100%`) hoặc tắt tiếng
  - **Nhấp nhô & lắc nhẹ đầu (Head-bob):** Bật / Tắt
- **Thông số kỹ thuật (`F3`):** Nhấn phím `F3` để bật/tắt bảng hiển thị `FPS`, tọa độ `(X, Y, Z)` theo mét, ô gạch `(cột, hàng)`, tốc độ và số lệnh vẽ (`Draw calls`).

## Cấu trúc thư mục

- `src/config.ts`: Chứa toàn bộ các thông số có thể tinh chỉnh (tỷ lệ thế giới, trần hang, tốc độ, bán kính va chạm, thông số diêm, ánh sáng, sương mù, trí nhớ bề mặt, hiệu ứng vignette/grain và Web Audio).
- `src/strings.ts`: Tập trung toàn bộ chuỗi văn bản tiếng Việt hiển thị cho người chơi.
- `src/data/caveMap.ts`: Dữ liệu bản đồ hang động mảng 2 chiều `60x40` cùng danh sách măng đá, nhũ đá và tảng đá trong hai khoang hang.
- `src/logic/movement.ts`: Logic di chuyển trên mặt phẳng `x/z`, xoay góc nhìn và giải quyết va chạm hình tròn bán kính `0.3m` chống xuyên tường (không import Three.js).
- `src/logic/lightAndMemory.ts`: Logic trạng thái diêm, ánh sáng nhấp nháy, kiểm tra tầm nhìn thẳng (line-of-sight) trên lưới ô gạch cho trí nhớ bề mặt theo từng mặt ô gạch và độ nghiêng camera khi bước đi (không import Three.js).
- `src/audio/caveAudio.ts`: Bộ tổng hợp âm thanh Web Audio thuần thủ tục (gió hang trầm, tiếng nước nhỏ giọt ngẫu nhiên, tiếng bước chân trên đá, tiếng quẹt diêm và tắt diêm).
- `src/game/caveGeometry.ts`: Tạo hình học 3D low-poly flat-shaded theo từng mặt ô gạch, cập nhật cục bộ vùng bộ đệm (`addUpdateRange`) khi ghi nhớ bề mặt và mở rộng shader giữ bề mặt đã nhớ hiển thị mờ vượt qua sương mù tối.
- `src/game/caveRenderer.ts`: Quản lý vòng đời `THREE.WebGLRenderer`, 1 đèn `PointLight` động + `AmbientLight`, tạm dừng khi mở `Esc` hoặc ẩn thẻ trình duyệt, và giải phóng tài nguyên khi hủy component.
- `src/App.tsx`: Khung ứng dụng React với màn hình bắt đầu, HUD tối giản góc dưới trái, lớp phủ vignette/film-grain, menu cài đặt `Esc` và bảng `F3`.
