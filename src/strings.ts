/**
 * Centralized Vietnamese player-facing strings for HANG SÂU.
 */
export const STRINGS = {
  GAME_TITLE: 'HANG SÂU',
  GAME_SUBTITLE: 'Sinh tồn thám hiểm hang động 3D góc nhìn thứ nhất',
  START_BUTTON: 'Bắt đầu',
  CONTINUE_BUTTON: 'Tiếp tục',
  NEW_GAME_BUTTON: 'Chơi mới',
  CONTROLS_BUTTON: 'Điều khiển',
  BACK_BUTTON: 'Quay lại',

  // Save / Load messages
  SAVE_CORRUPT_WARNING:
    'Dữ liệu lưu trước đó bị hỏng hoặc không hợp lệ và đã được bỏ qua.',
  SAVE_VERSION_WARNING:
    'Phiên bản dữ liệu lưu không tương thích và đã được bỏ qua.',
  SAVE_UNAVAILABLE_HINT:
    'Trình duyệt đang chặn bộ nhớ cục bộ — tiến trình sẽ không tự động lưu.',

  // Controls guide
  CONTROLS_HEADING: 'Điều khiển',
  CONTROL_LOOK: 'Chuột: Quan sát xung quanh (Nhấp vào màn hình để khóa chuột)',
  CONTROL_MOVE: 'WASD / Phím mũi tên: Di chuyển (1.8 m/s)',
  CONTROL_RUN: 'Giữ Shift: Chạy nhanh (3.2 m/s, cần Thể lực >= 10)',
  CONTROL_INTERACT: 'Phím E: Tương tác / Nhặt đồ khi ở gần (trong phạm vi 2 m)',
  CONTROL_MATCH: 'Phím F: Quẹt diêm khô thắp sáng (25 giây)',
  CONTROL_INVENTORY: 'Phím I: Mở / đóng Túi đồ (12 ô)',
  CONTROL_PAUSE: 'Phím Esc: Mở menu Tạm dừng / Cài đặt',
  CONTROL_DEBUG: 'Phím F3: Bật / tắt bảng thông số kỹ thuật',

  // Minimal HUD & Match / Candle messages
  HUD_MATCHES_LABEL: 'Diêm',
  HUD_CANDLE_LABEL: 'Nến',
  HUD_STRIKE_HINT: '[F] Thắp diêm',
  HUD_FLAME_ACTIVE: 'Đang cháy',
  HUD_CANDLE_ACTIVE: 'Nến đang cháy',
  HUD_INVENTORY_HINT: '[I] Túi đồ',
  MSG_MATCH_ALREADY_LIT: 'Đang có lửa cháy — không cần quẹt thêm.',
  MSG_NO_MATCHES_LEFT: 'Đã hết diêm.',
  MSG_WET_MATCH: 'Diêm bị ướt — không thể thắp sáng.',
  MSG_WET_CANDLE: 'Nến bị ướt — không thể thắp sáng.',

  // Survival HUD thin bars
  HUD_HEALTH_LABEL: 'Sinh lực',
  HUD_STAMINA_LABEL: 'Thể lực',
  HUD_HUNGER_LABEL: 'Đói',
  HUD_THIRST_LABEL: 'Khát',
  HUD_STAMINA_HALVED_BADGE: 'Kiệt sức (Thể lực tối đa giảm 50%)',

  // Inventory Modal (12 slots, press I)
  INV_TITLE: 'TÚI ĐỒ THÁM HIỂM',
  INV_SLOTS_LABEL: 'Ô chứa',
  INV_EMPTY_HINT: 'Túi đồ trống. Hãy tìm kiếm vật dụng trong hang.',
  INV_SELECT_ITEM_HINT: 'Chọn một vật phẩm trong ô để kiểm tra, sử dụng hoặc vứt bỏ.',
  INV_ACTION_USE: 'Sử dụng',
  INV_ACTION_INSPECT: 'Kiểm tra',
  INV_ACTION_DROP: 'Vứt bỏ',
  INV_CLOSE_BUTTON: 'Đóng [I]',
  INV_SLOT_COST_LABEL: 'Số ô chiếm',
  INV_STACK_LABEL: 'Số lượng',
  INV_CONDITION_LABEL: 'Tình trạng',
  CONDITION_DRY: 'Khô ráo',
  CONDITION_WET: 'Ướt',
  CONDITION_DAMAGED: 'Hư hại',

  // Item Vietnamese names & inspection descriptions
  ITEM_NAME_MATCHES: 'Hộp diêm',
  ITEM_NAME_CANDLE: 'Nến sáp',
  ITEM_NAME_FOOD: 'Lương khô',
  ITEM_NAME_WATER: 'Bình nước',
  ITEM_NAME_ROPE: 'Dây thừng leo núi',
  ITEM_NAME_ARTIFACT: 'Cổ vật đồng xanh',

  ITEM_DESC_MATCHES:
    'Que diêm gỗ bọc sáp chống ẩm nhẹ. Cháy trong 25 giây với tầm sáng 7 m (giảm còn 3.5 m ở 5 giây cuối). Diêm bị ướt sẽ không thể quẹt lửa.',
  ITEM_DESC_CANDLE:
    'Nến sáp dày cháy được 90 giây với tầm sáng rộng 9 m. Cho ánh sáng ổn định nhưng sẽ tắt hoặc không thể thắp nếu bị ướt.',
  ITEM_DESC_FOOD:
    'Lương khô đóng gói của đoàn thám hiểm cũ. Sử dụng để hồi phục cơn đói và duy trì thể lực.',
  ITEM_DESC_WATER:
    'Bình đựng nước suối ngầm tinh khiết. Sử dụng để giải tỏa cơn khát trong lòng hang khô lạnh.',
  ITEM_DESC_ROPE:
    'Cuộn dây thừng bện dày rất chắc chắn (chiếm 2 ô túi đồ). Dùng để buộc vào móc neo đá vượt qua vực sâu.',
  ITEM_DESC_ARTIFACT:
    'Cổ vật cổ xưa bằng đồng và ngọc thạch tìm thấy bên kia vực thẳm. Hãy mang nó ra lối thoát ở cửa hang.',

  // HUD Objectives & Key Items
  HUD_OBJECTIVE_LABEL: 'Mục tiêu',
  OBJ_FIND_ROPE:
    'Thám hiểm hang sâu, tìm dây thừng để vượt qua vực thẳm phía Nam',
  OBJ_TIE_ROPE:
    'Đến mép vực sâu phía Nam khoang chính và buộc dây thừng vào móc neo đá',
  OBJ_FIND_ARTIFACT:
    'Đi dọc theo đường dây qua vực để tìm cổ vật trong ngách hang bên kia',
  OBJ_RETURN_EXIT:
    'Mang cổ vật quay trở lại lối thoát ở cửa hang để rời khỏi đây',
  HUD_BADGE_ROPE: 'Đã có dây thừng',
  HUD_BADGE_ROPE_TIED: 'Đã buộc dây qua vực',
  HUD_BADGE_ARTIFACT: 'Đã giữ cổ vật',
  HUD_SUPPLIES_LABEL: 'Hành trang',

  // Raycast Interaction Prompts (<= 2m)
  PROMPT_PICKUP_MATCHES: '[E] Nhặt hộp diêm',
  PROMPT_PICKUP_CANDLE: '[E] Nhặt nến sáp',
  PROMPT_PICKUP_ROPE: '[E] Nhặt dây thừng (2 ô)',
  PROMPT_PICKUP_FOOD: '[E] Nhặt lương khô',
  PROMPT_PICKUP_WATER: '[E] Nhặt bình nước',
  PROMPT_TIE_ROPE: '[E] Buộc dây thừng',
  PROMPT_INSPECT_ANCHOR: '[E] Kiểm tra móc neo đá',
  PROMPT_INSPECT_GAP: '[E] Quan sát vực sâu',
  PROMPT_PICKUP_ARTIFACT: '[E] Nhặt cổ vật bí ẩn',
  PROMPT_USE_EXIT: '[E] Thoát khỏi hang',

  // Queued Subtitles (inner monologue & hints)
  SUB_INTRO:
    'Lối vào đã ở sau lưng. Mình phải tìm được cổ vật trong ngách hang sâu rồi quay ra trước khi kiệt sức hoặc hết sạch ánh sáng.',
  SUB_PICKUP_MATCHES:
    'Thêm một hộp diêm. Vài chục giây ánh sáng nơi đáy vực này quý hơn vàng.',
  SUB_PICKUP_MATCHES_WET:
    'Hộp diêm này đã bị ngấm nước lạnh. Chưa thể quẹt lửa cho tới khi làm khô.',
  SUB_PICKUP_CANDLE:
    'Một cây nến sáp còn nguyên bấc. Nó có thể cháy suốt một phút rưỡi và soi sáng rất xa.',
  SUB_PICKUP_ROPE:
    'Một cuộn dây thừng leo núi còn rất chắc (chiếm 2 ô túi đồ). Có thể buộc vào móc đá để vượt qua vực sâu.',
  SUB_PICKUP_FOOD:
    'Một phong lương khô của đoàn thám hiểm trước. Nhấn [I] mở túi đồ để ăn khi đói.',
  SUB_PICKUP_WATER:
    'Bình nước lạnh ngắt như đá ngầm. Nhấn [I] mở túi đồ để uống khi khát.',
  SUB_INVENTORY_FULL:
    'Túi đồ đã đầy (12/12 ô). Phải sử dụng hoặc vứt bớt đồ trong túi [I] trước khi nhặt thêm.',
  SUB_WET_MATCH_FAIL:
    'Que diêm đã ướt sũng, quẹt mãi chỉ tóe khói lạnh. Cần tìm diêm khô hoặc nến khô.',
  SUB_WET_CANDLE_FAIL:
    'Bấc nến bị ướt sũng nên không thể bắt lửa.',
  SUB_CANDLE_LIT:
    'Ngọn nến bùng lên ấm áp, đẩy lùi bóng tối xung quanh xa hơn hẳn que diêm.',
  SUB_CANDLE_WET_OUT:
    'Hơi nước lạnh làm ngọn nến phụt tắt.',
  SUB_USE_FOOD:
    'Miếng lương khô cứng và nhạt, nhưng cơn đói cồn cào đã dịu xuống.',
  SUB_USE_WATER:
    'Dòng nước lạnh buốt trôi qua cổ họng, tỉnh táo hơn hẳn.',
  SUB_USE_ROPE_HINT:
    'Hãy đứng sát móc neo đá ở mép vực phía Nam rồi nhấn [E] hoặc dùng dây thừng tại đó.',
  SUB_USE_ARTIFACT_HINT:
    'Cổ vật lạnh buốt trong lòng bàn tay. Hãy mang nó ra lối thoát ở cửa hang.',
  SUB_DROP_ITEM:
    'Đã đặt vật phẩm xuống nền đá ngay dưới chân.',
  SUB_VITAL_ZERO_WARNING:
    'Cơ thể kiệt quệ vì đói khát — thể lực tối đa bị giảm một nửa! Phải ăn uống ngay trước khi mất máu.',
  SUB_GAP_NO_ROPE:
    'Một vực sâu đen ngòm cắt ngang lối đi. Không có dây thừng, bước xuống là rơi thẳng xuống đáy.',
  SUB_ANCHOR_NO_ROPE:
    'Móc neo bằng sắt cắm chặt vào vách đá sát mép vực. Mình cần tìm một cuộn dây thừng để buộc vào đây.',
  SUB_GAP_HAVE_ROPE:
    'Đã có dây thừng trong túi đồ. Hãy nhắm vào móc neo đá ở mép vực rồi nhấn [E] để buộc dây.',
  SUB_ROPE_TIED:
    'Dây thừng đã căng qua miệng vực. Hãy bước thật cẩn thận dọc theo lối dây hẹp ở giữa.',
  SUB_ROPE_ALREADY_TIED:
    'Dây thừng đã buộc chắc chắn. Cứ bám sát theo đường dây để sang bờ bên kia.',
  SUB_PICKUP_ARTIFACT:
    'Cổ vật đây rồi... Mặt đồng lạnh buốt như có nhịp đập. Phải mang nó quay lại lối thoát ở cửa hang ngay.',
  SUB_EXIT_NO_ARTIFACT:
    'Chưa thể rời đi tay trắng. Cổ vật vẫn còn nằm trong ngách hang bên kia vực sâu.',

  // Pointer lock & iframe fallback hints
  CLICK_TO_LOCK_HINT:
    'Nhấp chuột vào khung hình để khóa tâm nhìn · [I] Túi đồ · [Esc] Tạm dừng',
  DRAG_LOOK_FALLBACK_HINT:
    'Khóa chuột bị hạn chế trong khung xem trước. Giữ và kéo chuột trái để xoay góc nhìn, hoặc mở bản xem trước trong thẻ mới để có trải nghiệm đầy đủ.',
  OPEN_NEW_TAB_LABEL: 'Mở trong thẻ mới',
  SETTINGS_BUTTON_LABEL: 'Tạm dừng (Esc)',

  // Esc Pause & Comfort Settings Menu
  MENU_TITLE: 'TẠM DỪNG & CÀI ĐẶT',
  MENU_SUBTITLE: 'Tùy chỉnh cảm giác điều khiển, góc nhìn và âm thanh',
  SETTING_SENSITIVITY: 'Độ nhạy chuột',
  SETTING_FOV: 'Góc nhìn (FOV)',
  SETTING_FOV_UNIT: '°',
  SETTING_HEAD_BOB: 'Nhấp nhô & lắc nhẹ khi bước đi (Head-bob)',
  SETTING_MASTER_VOLUME: 'Âm lượng tổng',
  SETTING_MUTE: 'Âm thanh',
  SETTING_UNMUTED_LABEL: 'Đang bật',
  SETTING_MUTED_LABEL: 'Tắt tiếng',
  SETTING_ON: 'Bật',
  SETTING_OFF: 'Tắt',
  RESUME_BUTTON: 'Tiếp tục',
  RESTART_BUTTON: 'Chơi lại',
  MAIN_MENU_BUTTON: 'Menu chính',
  RESET_DEFAULTS_BUTTON: 'Mặc định',

  // Win Screen
  WIN_TITLE: 'ĐÃ THOÁT KHỎI HANG SÂU',
  WIN_SUBTITLE: 'Bạn đã mang được cổ vật bí ẩn ra khỏi lòng đất tối tăm.',
  WIN_DESCRIPTION:
    'Ánh sáng lạnh lẽo nơi cửa hang cuối cùng cũng hiện ra phía trên đầu. Tiếng gió rít và bóng tối ngột ngạt dần lùi lại phía sau.',
  WIN_RESTART_BUTTON: 'Chơi lại từ đầu',
  WIN_MAIN_MENU_BUTTON: 'Về menu chính',

  // Collapse / Game Over Screen (when health reaches 0 from starvation/dehydration)
  COLLAPSE_TITLE: 'KIỆT SỨC TRONG BÓNG TỐI',
  COLLAPSE_SUBTITLE: 'Cơ thể bạn gục ngã vì đói khát nơi đáy hang lạnh lẽo.',
  COLLAPSE_DESCRIPTION:
    'Đôi chân không còn chút sức lực nào để bước tiếp. Ngọn lửa tắt lịm và bóng tối vĩnh viễn nuốt chửng lấy bạn.',

  // Tide System HUD & Phases
  HUD_TIDE_LABEL: 'Thủy triều',
  TIDE_PHASE_LOW_1: 'Triều thấp',
  TIDE_PHASE_RISING: 'Triều đang dâng',
  TIDE_PHASE_HIGH: 'Triều cao (Ngập sâu)',
  TIDE_PHASE_FALLING: 'Triều đang rút',
  TIDE_PHASE_LOW_2: 'Triều kiệt',
  HUD_WATER_SHALLOW_BADGE: 'Đang lội nước nông (Chậm & tốn thể lực)',
  HUD_SAFE_ROOM_BADGE: 'Vùng gờ đá cao an toàn (Đang hong khô đồ)',
  HUD_WET_EXPOSURE_LABEL: 'Ngấm nước',
  HUD_DRYING_PROGRESS_LABEL: 'Hong khô diêm/đồ',

  // Tide System Subtitles (warnings, flooding, wetting, drying, safe room)
  SUB_TIDE_WARNING_20S:
    'Tiếng nước ngầm ầm ĩ vọng lại từ lòng đất... Chỉ còn khoảng 20 giây trước khi thủy triều dâng ngập các lối trũng!',
  SUB_TIDE_HIGH_FLOODED:
    'Nước ngầm đã dâng cao, chia cắt hành lang trũng! Hãy tìm lối vòng hoặc trú trên gờ đá cao chờ nước rút.',
  SUB_TIDE_RECEDED:
    'Mực nước ngầm đang rút dần, các lối đi trũng bắt đầu lộ ra.',
  SUB_ITEMS_BECAME_WET:
    'Ngâm nước quá 3 giây! Diêm và đồ dùng trong túi đã bị thấm ướt — không thể quẹt lửa cho tới khi hong khô ở vùng đất cao.',
  SUB_ITEMS_DRIED:
    'Không khí khô trên gờ đá cao đã làm khô ráo lại hộp diêm và hành trang của bạn.',
  SUB_SAFE_ROOM_ENTER:
    'Gờ đá cao này hoàn toàn khô ráo ngay cả khi đỉnh triều. Có thể đứng đây chờ nước rút và hong khô đồ bị ướt (40 giây).',
  SUB_SOFTLOCK_DETECTED:
    'Nước sâu đã bủa vây quanh vị trí hiện tại — bạn có thể tải lại điểm lưu an toàn gần nhất.',

  // Soft-Lock Recovery Banner
  SOFTLOCK_TITLE: 'MẮC KẸT GIỮA DÒNG NƯỚC NGẦM',
  SOFTLOCK_DESC:
    'Không còn lối thoát hoặc vùng gờ đá an toàn nào có thể tiếp cận từ vị trí này.',
  SOFTLOCK_RELOAD_BUTTON: '[R] Tải lại điểm lưu an toàn trước đó',

  // F3 Debug Overlay
  DEBUG_TITLE: 'THÔNG SỐ KỸ THUẬT (F3)',
  DEBUG_FPS: 'FPS',
  DEBUG_POS: 'Tọa độ (m)',
  DEBUG_TILE: 'Ô gạch (cột, hàng)',
  DEBUG_SPEED: 'Tốc độ',
  DEBUG_DRAW_CALLS: 'Lệnh vẽ (Draw calls)',
  DEBUG_TIDE_LABEL: 'Thủy triều / Mực nước',
  DEBUG_TIDE_JUMP_HINT: '[T] Chuyển nhanh pha thủy triều tiếp theo',
  DEBUG_STATE_RUN: 'Chạy',
  DEBUG_STATE_WALK: 'Đi bộ',
  DEBUG_STATE_IDLE: 'Đứng yên',
} as const;
