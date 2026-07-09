# 9ROUTER TOOLS — MASTER DESIGN PLAN
## Kế hoạch thiết kế toàn diện — Local Config & Account Management Tool

**Status:** IN PROGRESS (Phase 0-8 Initial Implementation Completed; Patching UI/UX Overhaul)
**Mục đích tài liệu:** Đây là bản thiết kế kiến trúc để bạn (hoặc Codex/Antigravity sau này) đọc và triển khai theo đúng hướng, tránh code tùy hứng làm lệch structure ban đầu.

---

## Accepted Design Decisions (post-audit)

- **dataType ban đầu**: Chỉ hỗ trợ `account-config`.
- **Vị trí thư mục dữ liệu**: `E:\PROJECT\9Router Tools\.9router-data\`.
- **Retention limit**: Mặc định 20 bản backup tối đa cho mỗi profile (có thể tuỳ chỉnh trong cài đặt).
- **Export/Import**: Đã được bổ sung vào phạm vi chính thức thông qua Addendum UI/UX Overhaul.
- **Port mặc định**: 3000.

---

## Phase Tracking

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 0 — Nền tảng | COMPLETED | Tạo cấu trúc thư mục, state-manager.js và schema state.json v1 |
| Phase 1 — Path & Profile | COMPLETED | Giao diện sidebar, quản lý danh sách profile, auto-select last opened profile |
| Phase 2 — Diff Engine | COMPLETED | Gộp tài khoản thông minh (thêm mới & cập nhật token cho codex) |
| Phase 3 — Write Engine | COMPLETED | Ghi đè file gốc atomic (temp -> rename), validation và concurrency lock |
| Phase 4 — Backup Management | COMPLETED | Quản lý bản sao lưu cho từng profile, khôi phục sao lưu atomic & dọn dẹp theo hạn mức |
| Phase 5 — History UI | COMPLETED | Ghi log lịch sử hoạt động append-only, hiển thị dòng thời gian timeline trực quan |
| Phase 6 — Settings | COMPLETED | Cấu hình giới hạn sao lưu, xác nhận trước khi ghi đè & thay đổi theme accent màu |
| Phase 7 — UI Polish | COMPLETED | Bố cục 3 cột (Sidebar - Workspace - Side-panel), responsive, hiệu ứng glow |
| Phase 8 — Migration | COMPLETED | Tự động chuyển đổi các file bak của hệ thống cũ sang cấu trúc backup khoa học mới |
| Phase 9 — UI/UX Overhaul | IN PROGRESS | Nâng cấp trải nghiệm người dùng, SVG set, account list table, mở rộng bộ nút chức năng, export/import chuyên sâu |

---

## TICKET BỔ SUNG: 9Router Tools — UI/UX Overhaul (Addendum cho Master Plan)

**Priority:** Critical | **Type:** UI Redesign
**Áp dụng vào:** `9Router_Tools_Master_Plan.md` — bổ sung/patch các Mục 8, 10, 17

**⚠️ Vẫn là PLAN — không code, không tự làm, chỉ thiết kế hướng đi.**

---

## VẤN ĐỀ ĐÃ NÊU — MAP VÀO ĐÚNG MODULE

| Feedback | Module bị ảnh hưởng | Mức độ |
|---|---|---|
| "sai quá nhiều emoji, cần đổi SVG" | Toàn hệ thống icon | Critical |
| "table list, action button" | Module 3 (Diff Engine) — UI hiển thị kết quả | Critical |
| "list account" | Chưa có trong plan cũ — cần thêm mới | Critical |
| "cần nhiều function button hơn" | Module 5 (Write Engine) — UI thao tác | High |
| "hiển thị profile rõ ràng hơn" | Module 1 (Card Profile) | High |
| "export, import" | **Hoàn toàn thiếu trong Master Plan** — lỗ hổng thật | Critical |
| "command ít hơn" | Luồng thao tác tổng thể | High |
| "nâng cấp" | Tổng thể | — |

---

## PATCH 1 — ICON SYSTEM: Emoji → SVG

### Vấn đề
Toàn bộ badge/status/button trong thiết kế hiện đang dùng emoji (✅ ⚠️ 🔒 🎁 v.v.) — không nhất quán về kích thước, không đổi màu theo theme được, nhìn "rẻ tiền", không đúng vibe Dark + Glassmorphism cao cấp đã có.

### Yêu cầu

```
Thay thế TOÀN BỘ emoji bằng SVG icon set nhất quán.

Nguồn icon đề xuất: Lucide Icons (outline style, stroke-based)
— lý do: nhẹ, không dependency runtime nặng, có thể inline trực
tiếp vào HTML (giữ nguyên triết lý zero-dependency của server,
chỉ cần copy path SVG tĩnh vào file, không cần cài package).

Mapping icon cần thay:
  Trạng thái OK / Healthy       → check-circle
  Trạng thái Broken / Lỗi       → alert-triangle
  Mới (New)                     → plus-circle
  Cập nhật (Update)             → refresh-cw
  Không đổi (Unchanged)         → minus-circle
  Cảnh báo (Warning)             → alert-circle
  Backup                        → archive / history
  Settings                      → settings (gear, giữ nguyên vị trí)
  Xóa                           → trash-2
  Sửa                           → edit-3
  Ghim (Pin)                    → pin
  Export                        → download
  Import                        → upload
  Copy path                     → clipboard
  Mở thư mục                    → folder-open
  Server Active                 → giữ dot tròn có glow (không phải emoji),
                                   dùng CSS animation pulse thay vì icon

Kích thước chuẩn: 16px (inline trong text/button), 20px (trong card
header), 24px (icon action chính). Không dùng nhiều size tùy tiện.

Màu icon: kế thừa theme hiện tại — dùng currentColor để icon tự đổi
màu theo trạng thái cha (success/warning/danger) thay vì hardcode
màu riêng cho từng SVG.
```

### Nguyên tắc áp dụng
```
KHÔNG dùng emoji ở BẤT KỲ đâu trong UI — kể cả trong text mô tả,
tooltip, hay placeholder. Toàn bộ phải là SVG hoặc text thuần.
```

---

## PATCH 2 — LIST ACCOUNT: Bổ sung bảng dữ liệu thật (thiếu hoàn toàn trong plan cũ)

### Vấn đề
Master Plan hiện chỉ mô tả "kết quả Diff hiện dạng tóm tắt" (Mục 10.4: "X mục mới, Y mục cập nhật") — không có bảng danh sách chi tiết từng account để user rà soát trước khi ghi đè. Đây là thiếu sót nghiêm trọng vì user không thấy được **từng dòng cụ thể** sẽ bị ảnh hưởng.

### Yêu cầu — Bảng Account List đầy đủ

```
Thay thế khu vực "Kết quả Diff Preview" (Mục 10.4 cũ) bằng
1 bảng dữ liệu thật (data table), có cấu trúc:

Cột:
  [Checkbox]  | Tài khoản | Trạng thái | Thay đổi        | Actions
  ────────────────────────────────────────────────────────────
  [x]         | user_01   | [Mới]      | —               | [Xem]
  [x]         | user_02   | [Cập nhật] | password, rank   | [Xem][Loại trừ]
  [ ]         | user_03   | [Cảnh báo] | thiếu field 'ig' | [Xem][Sửa]

Tính năng bảng:
  - Sort theo cột (click header)
  - Filter nhanh theo trạng thái (tab nhỏ phía trên bảng:
    "Tất cả" | "Mới" | "Cập nhật" | "Cảnh báo")
  - Search box lọc theo tên account
  - Checkbox mỗi dòng — cho phép LOẠI TRỪ dòng cụ thể khỏi lần
    ghi đè này (không phải tất cả New/Update đều bắt buộc ghi)
  - Checkbox "Chọn tất cả" ở header
  - Đếm số dòng đang chọn: "12/15 dòng sẽ được ghi"

Action per row:
  [Xem] → mở popover/expand inline hiện chi tiết field nào đổi,
          giá trị cũ (gạch ngang) vs giá trị mới (highlight)
  [Loại trừ] → bỏ dòng này khỏi batch ghi hiện tại (không xóa
               khỏi file, chỉ không áp dụng thay đổi lần này)
  [Sửa] → chỉ hiện với dòng Cảnh báo (thiếu field) — cho phép
          user tự điền field thiếu ngay tại bảng trước khi ghi
```

---

## PATCH 3 — ACTION BUTTONS: Mở rộng bộ nút chức năng

### Vấn đề
Hiện tại chỉ có 1 nút chính "Ghi đè trực tiếp" — quá đơn độc, thiếu các thao tác phụ trợ cần thiết.

### Bộ nút đầy đủ cần có

**Trong khu vực thao tác chính (Main Workspace):**
```
Nhóm nút chính (nổi bật):
  [Ghi đè trực tiếp]        — primary action, giữ nguyên vị trí
  [Xem trước chi tiết]      — mở full diff view (nếu bảng chính
                               đang thu gọn)

Nhóm nút phụ (icon-only, nhỏ, cạnh đường dẫn Profile):
  [Copy path]     — copy đường dẫn root vào clipboard
  [Mở thư mục]    — mở File Explorer đúng vị trí file gốc
  [Làm mới]       — đọc lại file gốc từ đĩa (phòng trường hợp
                     file bị đổi bởi tool khác trong lúc đang mở)
  [Đổi path]      — trigger path healing (Mục 9.4 cũ)
```

**Trên mỗi Card Profile (Module 1, danh sách bên trái):**
```
Nhóm nút icon nhỏ, hiện khi hover card:
  [Chọn]    — click cả card cũng tương đương
  [Sửa]     — đổi tên Profile, ghi chú
  [Ghim]    — pin Profile lên đầu danh sách
  [Ẩn]      — archive
  [Xóa]     — xóa hẳn, có confirm dialog
  [⋮ More]  — menu dropdown chứa: Export Profile này, Xem lịch sử
              riêng, Xem backup riêng
```

---

## PATCH 4 — PROFILE DISPLAY: Rõ ràng hơn

### Vấn đề
Card Profile hiện tại (Mục 8.3 cũ) nhồi quá nhiều info vào 1 card nhỏ — tên, trạng thái, thời gian, số backup — dễ rối, không có phân cấp thị giác (visual hierarchy) rõ.

### Redesign Card Profile

```
Cấu trúc lại theo 3 tầng rõ ràng trong 1 card:

TẦNG 1 — Header (nổi bật nhất):
  [Icon trạng thái] Tên Profile              [Badge loại dữ liệu]
  (font lớn, đậm — đây là thứ mắt nhìn thấy đầu tiên)

TẦNG 2 — Meta info (phụ, nhỏ hơn, xám):
  Ghi đè gần nhất: 2 giờ trước
  Đường dẫn: ...accounts.json (truncate giữa, hover hiện full)

TẦNG 3 — Stats row (dạng chip nhỏ, ngang hàng):
  [12 backup]  [+5 -2 lần gần nhất]  [Healthy/Broken]

Khi card ở trạng thái ACTIVE (đang được chọn):
  — border glow rõ rệt hơn hẳn (không chỉ nhạt như hover)
  — có 1 dải màu accent bên trái card (4px, giống active state
    của sidebar menu trong các dự án khác của bạn)
```

### Thêm: Panel chi tiết Profile riêng (khi cần xem sâu)

```
Click vào Tên Profile (không phải click chọn card để làm việc,
mà click riêng vào text tên) → mở modal/drawer "Chi tiết Profile":

  - Toàn bộ thông tin (không truncate)
  - Biểu đồ nhỏ: số lượng account theo thời gian (nếu muốn nâng
    cao — optional, không bắt buộc)
  - Danh sách 5 lần ghi đè gần nhất (rút gọn từ History module)
  - Nút Export riêng Profile này
```

---

## PATCH 5 — EXPORT / IMPORT (Module hoàn toàn mới, bổ sung vào Master Plan)

### Đây là lỗ hổng lớn nhất — Master Plan gốc không có module này

### Module 10 (MỚI): Export / Import System

**Export — 2 loại, phải phân biệt rõ trong UI:**

```
Loại 1 — Export Profile Bundle (di chuyển cấu hình sang máy khác):
  Xuất ra 1 file duy nhất (.9rtbundle hoặc .json) chứa:
    - Toàn bộ metadata Profile đã chọn (không chứa nội dung
      account thật, chỉ config của TOOL)
    - Tùy chọn: kèm theo N bản backup gần nhất nếu user muốn
  Dùng khi: cài tool trên máy mới, muốn mang theo lịch sử quản lý

Loại 2 — Export dữ liệu Account (dùng cho mục đích khác):
  Xuất nội dung account hiện tại trong file gốc ra định dạng:
    - JSON (giữ nguyên cấu trúc)
    - CSV (dẹt hóa, dễ mở bằng Excel để review nhanh)
  Dùng khi: cần gửi danh sách cho người khác xem, hoặc backup
  thủ công ngoài hệ thống backup tự động

Vị trí nút:
  - Export Bundle: trong menu [⋮ More] của Card Profile (Patch 3)
  - Export Data: nút riêng trong khu vực Main Workspace, cạnh
    đường dẫn Profile
```

**Import — 2 loại tương ứng:**

```
Loại 1 — Import Profile Bundle:
  Kéo thả hoặc chọn file .9rtbundle → tool đọc, hiện preview
  "Sẽ thêm N Profile mới: [tên1], [tên2]..." → xác nhận → thêm
  vào danh sách, TỰ ĐỘNG kiểm tra path healing ngay (vì path cũ
  từ máy khác gần như chắc chắn không tồn tại trên máy mới)

Loại 2 — Import làm nguồn merge (đây chính là hành vi kéo-thả
  file account mới hiện tại, KHÔNG đổi gì, chỉ đặt tên lại cho
  rõ ràng thay vì chỉ có khung "kéo thả" mơ hồ):
  Thêm thêm 1 nút tường minh "Chọn file để Import" bên cạnh khu
  vực kéo-thả, cho user không quen thao tác kéo-thả vẫn dùng được
  bằng cách bấm nút mở dialog chọn file như bình thường
```

---

## PATCH 6 — GIẢM SỐ LƯỢNG THAO TÁC (Command Reduction)

### Rà soát luồng hiện tại và cắt bớt bước thừa

```
Luồng ghi đè 1 account (thao tác phổ biến nhất, cần tối ưu nhất):

TRƯỚC (nếu đang nhiều bước):
  Mở tool → chọn Profile → chọn file mới (browse) → xem tóm tắt
  → mở chi tiết xem từng dòng → đóng lại → bấm ghi đè → xác nhận
  → xem thông báo

SAU (rút gọn):
  Mở tool (tool tự mở đúng Profile gần nhất — Patch cũ Mục 9.3)
  → kéo thả file mới (hoặc bấm nút Import loại 2 ở Patch 5)
  → bảng Account List hiện ngay lập tức, không cần bước "mở chi
    tiết" riêng vì bảng đã đủ chi tiết (Patch 2)
  → bấm [Ghi đè trực tiếp] → 1 dialog xác nhận duy nhất (gộp
    "xác nhận" và "xem tóm tắt" làm 1, không tách 2 bước)
  → toast thông báo kết quả

Giảm từ ~8 bước xuống còn 4 bước cho luồng chính.
```

### Thêm phím tắt (Keyboard Shortcuts) — giảm thao tác chuột

```
Ctrl+O     → mở dialog Import file mới (thay vì phải kéo thả)
Ctrl+Enter → xác nhận Ghi đè trực tiếp (khi đang ở màn hình Preview)
Ctrl+F     → focus vào ô Search trong bảng Account List
Esc        → đóng modal/dialog đang mở
1, 2, 3... → nhảy nhanh giữa các Profile trong danh sách (số thứ tự)
```

---

## PATCH 7 — TÁC ĐỘNG NGƯỢC LÊN MASTER PLAN GỐC

Các mục sau trong file `9Router_Tools_Master_Plan.md` cần đọc lại và sửa theo patch này khi triển khai thật:

| Mục gốc | Thay đổi |
|---|---|
| Mục 8.3 (Card Profile) | Áp dụng cấu trúc 3 tầng ở Patch 4 |
| Mục 10.4 (Preview Mode) | Thay bằng bảng Account List đầy đủ ở Patch 2 |
| Mục 17.1 (Layout 3 vùng) | Giữ nguyên bố cục, nhưng Vùng giữa giờ chứa bảng data table thay vì chỉ tóm tắt text |
| Toàn bộ badge/icon nhắc trong Mục 8, 11, 16 | Áp dụng SVG system ở Patch 1, bỏ hết ký hiệu emoji đã lỡ dùng trong bản mô tả cũ |
| **Mục 21 (Extensibility)** | Thêm Module 10 mới (Export/Import) vào danh sách module chính thức, đánh số lại nếu cần |

---

## ACCEPTANCE CRITERIA (OVERHAUL)

- [ ] Toàn bộ emoji được dọn dẹp sạch sẽ khỏi giao diện, thay thế hoàn toàn bằng SVG icons.
- [ ] Bảng Account List chi tiết hỗ trợ checkbox loại trừ, bộ lọc trạng thái, ô tìm kiếm và inline editing (Provider / Priority).
- [ ] Tích hợp đầy đủ thanh công cụ Toolbar: Thêm thủ công, Ping Test và Reset hàng đợi.
- [ ] Card Profile được thiết kế 3 tầng thông tin rõ ràng, hỗ trợ nút thao tác nhanh khi hover và dải accent active.
- [ ] Logs Console có nút thu gọn/mở rộng dạng collapsible và tiêu đề nhấp để đóng/mở.
- [ ] Export Bundle và Export Data hoạt động phân biệt; hỗ trợ chọn file import thông qua nút bấm truyền thống.
- [ ] Luồng ghi đè chính rút ngắn xuống tối đa 4 bước.
- [ ] Ít nhất 5 phím tắt cốt lõi được cấu hình hoạt động chính xác.
- [ ] Menu [⋮ More] trên Card Profile hoạt động đủ 3 chức năng con.
