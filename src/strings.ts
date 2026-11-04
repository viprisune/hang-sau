/**
 * Centralized Vietnamese player-facing strings for HANG SÂU.
 */
export const STRINGS = {
  GAME_TITLE: 'HANG SÂU',
  GAME_SUBTITLE: 'Sinh tồn thám hiểm hang động 3D góc nhìn thứ nhất',
  START_BUTTON: 'Bắt đầu',

  // Controls guide
  CONTROLS_HEADING: 'Điều khiển',
  CONTROL_LOOK: 'Chuột: Quan sát xung quanh (Nhấp vào màn hình để khóa chuột)',
  CONTROL_MOVE: 'WASD / Phím mũi tên: Di chuyển (1.8 m/s)',
  CONTROL_RUN: 'Giữ Shift: Chạy nhanh (3.2 m/s)',
  CONTROL_PAUSE: 'Phím Esc: Mở menu cài đặt / Giải phóng chuột',
  CONTROL_DEBUG: 'Phím F3: Bật / tắt bảng thông số kỹ thuật',

  // Pointer lock & iframe fallback hints
  CLICK_TO_LOCK_HINT: 'Nhấp chuột vào khung hình để khóa tâm nhìn · Nhấn Esc để mở Cài đặt',
  DRAG_LOOK_FALLBACK_HINT:
    'Khóa chuột bị hạn chế trong khung xem trước. Giữ và kéo chuột trái để xoay góc nhìn, hoặc mở bản xem trước trong thẻ mới để có trải nghiệm đầy đủ.',
  OPEN_NEW_TAB_LABEL: 'Mở trong thẻ mới',
  SETTINGS_BUTTON_LABEL: 'Cài đặt (Esc)',

  // Esc Pause & Comfort Settings Menu
  MENU_TITLE: 'TẠM DỪNG & CÀI ĐẶT',
  MENU_SUBTITLE: 'Tùy chỉnh cảm giác điều khiển và góc nhìn',
  SETTING_SENSITIVITY: 'Độ nhạy chuột',
  SETTING_FOV: 'Góc nhìn (FOV)',
  SETTING_FOV_UNIT: '°',
  SETTING_HEAD_BOB: 'Nhấp nhô đầu khi bước đi (Head-bob)',
  SETTING_ON: 'Bật',
  SETTING_OFF: 'Tắt',
  RESUME_BUTTON: 'Tiếp tục',
  RESET_DEFAULTS_BUTTON: 'Mặc định',

  // F3 Debug Overlay
  DEBUG_TITLE: 'THÔNG SỐ KỸ THUẬT (F3)',
  DEBUG_FPS: 'FPS',
  DEBUG_POS: 'Tọa độ (m)',
  DEBUG_TILE: 'Ô gạch (cột, hàng)',
  DEBUG_SPEED: 'Tốc độ',
  DEBUG_DRAW_CALLS: 'Lệnh vẽ (Draw calls)',
  DEBUG_STATE_RUN: 'Chạy',
  DEBUG_STATE_WALK: 'Đi bộ',
  DEBUG_STATE_IDLE: 'Đứng yên',
} as const;
