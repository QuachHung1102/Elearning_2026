# Kế hoạch UX/UI

Tài liệu này bổ sung phần giao diện còn thiếu của [`PROJECT_PLAN.md`](./PROJECT_PLAN.md). Kiến trúc, mô hình thanh toán, bảo mật và hạ tầng đã được chốt ở đó và không được nhắc lại. Ở đây chỉ định nghĩa: token thiết kế, sitemap, trang, component, luồng, trạng thái, responsive, accessibility và quy ước microcopy.

Tài liệu là đầu vào cho hai thứ: file thiết kế `design/elearning.pen` và phần hiện thực trong `apps/web`. Mọi giá trị trong đây là giá trị thi hành, không phải gợi ý.

## 0. Ràng buộc bổ sung so với PROJECT_PLAN

| Ràng buộc | Ảnh hưởng giao diện |
|---|---|
| Catalog theo hình dáng Udemy nhưng kinh tế một chủ sở hữu | Có tìm kiếm, danh mục, bộ lọc, card có rating và số học viên. Không có trang giảng viên, không có so sánh giảng viên, không có chia doanh thu |
| Thanh toán dựng sau cùng | Mọi màn hình checkout được thiết kế nhưng không dựng ở vòng đầu. Cờ `NEXT_PUBLIC_CHECKOUT_ENABLED` quyết định CTA trên trang chi tiết khóa học |
| Seam Enrollment tồn tại từ ngày đầu | `/my-courses` và `/learn/**` chỉ phụ thuộc Enrollment, không phụ thuộc Purchase. Cách duy nhất có Enrollment ở vòng đầu là admin cấp thủ công |
| Demo-first, không có tài khoản ngoài | Player phải phát được nguồn MP4 cục bộ; màn hình xác minh email phải hiển thị link ở chế độ demo; ảnh bìa upload vào thư mục cục bộ |
| Ngôn ngữ giao diện tiếng Việt | `<html lang="vi">`, font phải có subset `vietnamese`, line-height rộng hơn mặc định |

### Ảnh hưởng tới mô hình dữ liệu

Hình dáng catalog Udemy cần thêm dữ liệu mà bảng 13 model của PROJECT_PLAN chưa có. [`DATA_MODEL.md`](./DATA_MODEL.md) đã chốt schema cuối cùng; **tên trường dưới đây là tên thi hành, chép đúng từ đó**. Giao diện không được đặt tên khác — mỗi bí danh là một chỗ hai tài liệu trôi khỏi nhau.

| Trường (tên chốt) | Lý do giao diện | Ghi chú |
|---|---|---|
| `Category` (slug, name, position) và `Course.categoryId` | Hàng chip danh mục ở trang chủ, trang `/categories/[slug]`, bộ lọc catalog | Một cấp, không phân cấp con |
| `Course.subtitle` (`varchar(240)`, nullable) | Dòng mô tả trong `CourseCard`, hero trang chi tiết, thẻ meta SEO | **Không phải `summary`.** Tách khỏi `description` Markdown |
| `Course.enrollmentCount` (`int`, default 0) | Số học viên trên card | **Không phải `studentCount`.** Phi chuẩn hóa, cập nhật cùng transaction với `Enrollment` |
| `Course.ratingAverage` (`decimal(2,1)`, nullable) · `Course.ratingCount` (`int`, default 0) | Sao trên card và hero | **Không phải `ratingAvg`.** `ratingCount` không bao giờ null. Điều kiện ẩn `Rating` là `ratingCount === 0 \|\| ratingAverage === null` |
| `Course.demoStats` (`bool`, default false) | `Badge` `neutral` "Dữ liệu demo" **chỉ ngay cạnh cụm sao** | Cờ này chỉ nói về cụm rating: seed ghi `ratingAverage` và `ratingCount` **bịa** cùng `demoStats = true`, còn `enrollmentCount` **không bao giờ bịa** — nó luôn bằng số hàng `Enrollment` `ACTIVE` (DATA_MODEL.md §Quy tắc nhãn dữ liệu demo). Gắn nhãn demo lên một con số thật là nói dối theo chiều ngược lại. Vòng đầu lưới card **có** khóa hiện sao — xem quy tắc 4 của `CourseCard` |
| `Course.level` enum `BEGINNER \| INTERMEDIATE \| ADVANCED \| ALL_LEVELS` | Badge trình độ, bộ lọc | **Bốn giá trị**, mặc định `ALL_LEVELS`. Nhãn ở §9.5 |
| `Course.learningOutcomes`, `Course.requirements`, `Course.targetAudience` (`text[]`, ≤ 12 mục, mỗi mục ≤ 200 ký tự) | Ba khối "Bạn sẽ học được gì", "Yêu cầu", "Khóa học dành cho ai" ở `/courses/[slug]` | `learningOutcomes` ≥ 1 mục là **điều kiện publish phía server** |
| `Course.compareAtPriceVnd` (`int`, nullable) | `PriceTag` biến thể `strikethrough` và mức giảm % | Phải lớn hơn `priceVnd`, server kiểm |
| `Course.language` (`varchar(10)`, default `vi`) | — | Vòng đầu **không hiển thị**: mọi khóa đều tiếng Việt, một nhãn giống nhau trên mọi card là nhiễu. Hiện khi có khóa thứ hai ngôn ngữ khác |
| `Lesson.durationSeconds` | Tổng thời lượng chương và khóa học trong accordion | Bài dạng article ghi 0, hiển thị "Bài đọc" |

---

## 1. Design tokens

### 1.1 Cơ chế khai báo

Tailwind v4 CSS-first, không có `tailwind.config.js`. Toàn bộ token nằm trong `apps/web/src/app/globals.css` theo bốn khối, đúng thứ tự:

```
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));
@theme static { …giá trị light… }
.dark { …ghi đè biến màu… }
```

Bốn điểm bắt buộc:

- **`@theme static`, không phải `@theme`.** Đã kiểm bằng cách biên dịch đúng bốn khối trên với `tailwindcss` 4.3.3 đang cài trong `apps/web`: dưới `@theme` thường, mọi biến **không** được một tiện ích nào sinh ra sẽ bị loại khỏi `:root` của CSS đầu ra — `--duration-fast`, `--duration-base`, `--shadow-overlay`, `--container-prose` đều biến mất, trong khi `--color-primary` và `--size-icon-md` sống sót vì có tiện ích tham chiếu chúng. Với `@theme static` cả bốn đều có mặt. Token nào chỉ được đọc bằng CSS viết tay (`var(--shadow-overlay)`) mà khai báo trong `@theme` thường thì ở runtime nó là giá trị rỗng — hỏng im lặng, không có cảnh báo build.
- `@theme` chứa giá trị **light**. Khối `.dark` chỉ ghi đè biến màu, không khai báo lại font, spacing hay radius.
- Dark mode dùng class `.dark` trên `<html>`, đặt bởi một script đồng bộ chèn trong `<head>` của root layout, đọc `localStorage` rồi tới `prefers-color-scheme`. Dùng class thay vì chỉ media query vì người dùng cần đổi được chủ đề độc lập với hệ điều hành.
- Token nào không có trong bảng dưới thì không tồn tại. Không dùng giá trị màu, khoảng cách hay bo góc viết thẳng trong component.

### 1.2 Token màu

Cột "Vai trò" là quy tắc dùng, không phải mô tả. Vi phạm vai trò là lỗi review.

#### Nền và chữ

| Token | Light | Dark | Vai trò |
|---|---|---|---|
| `--color-background` | `#F8FAFC` | `#0F172A` | Nền trang |
| `--color-foreground` | `#0F172A` | `#F8FAFC` | Chữ chính |
| `--color-card` | `#FFFFFF` | `#1E293B` | Nền card, panel, modal, header dính |
| `--color-card-foreground` | `#0F172A` | `#F8FAFC` | Chữ chính trên card |
| `--color-muted` | `#F1F5F9` | `#334155` | Nền phụ: chip, header bảng, ô code, vùng rỗng |
| `--color-muted-foreground` | `#64748B` | `#94A3B8` | Chữ phụ **chỉ trên** `background` và `card` |
| `--color-muted-foreground-strong` | `#475569` | `#CBD5E1` | Chữ phụ **trên** `muted`. Bắt buộc, vì `muted-foreground` trên `muted` chỉ đạt 4.34:1 (light) và 4.04:1 (dark) |
| `--color-border` | `#E2E8F0` | `rgba(255,255,255,0.08)` | Đường phân cách và viền card. Trang trí, không mang thông tin |
| `--color-input` | `#64748B` | `rgba(255,255,255,0.40)` | Viền của mọi control nhập liệu. Phải khác `border` vì WCAG 1.4.11 yêu cầu 3:1 cho ranh giới control |
| `--color-overlay` | `rgba(15,23,42,0.55)` | `rgba(2,6,23,0.70)` | Lớp phủ sau modal và drawer |
| `--color-skeleton` | `#E2E8F0` | `#334155` | Nền khối skeleton |

#### Thương hiệu và hành động

| Token | Light | Dark | Vai trò |
|---|---|---|---|
| `--color-primary` | `#0D9488` | `#2DD4BF` | Màu nhận diện. Dùng cho **phần không chứa chữ**: focus ring, thanh tiến độ, chỉ báo tab đang chọn, nền checkbox đã tick, viền trạng thái active |
| `--color-primary-strong` | `#0F766E` | `#2DD4BF` | Nền đặc của mọi bề mặt **có chữ** màu `primary-foreground`: nút solid, badge có chữ |
| `--color-primary-hover` | `#115E59` | `#5EEAD4` | Trạng thái hover của `primary-strong` |
| `--color-primary-foreground` | `#FFFFFF` | `#042F2E` | Chữ/icon đặt trên `primary-strong` |
| `--color-primary-text` | `#0F766E` | `#2DD4BF` | Link và chữ mang màu thương hiệu trên nền `background`/`card` |
| `--color-primary-subtle` | `#CCFBF1` | `#134E4A` | Nền badge nhạt, hàng được chọn trong bảng |
| `--color-primary-on-subtle` | `#0F766E` | `#5EEAD4` | Chữ trên `primary-subtle` |
| `--color-secondary` | `#2DD4BF` | `#14B8A6` | Trang trí không mang thông tin: gạch chân tiêu đề, đường viền minh họa, cột phụ trong biểu đồ. **Không bao giờ làm màu chữ trên nền sáng** — chỉ đạt 1.86:1 |
| `--color-accent` | `#D97706` | `#F59E0B` | CTA chuyển đổi (mua/đăng ký học), sao rating, nhấn giá |
| `--color-accent-hover` | `#B45309` | `#FBBF24` | Hover của `accent` |
| `--color-accent-foreground` | `#431407` | `#431407` | Chữ trên `accent`. Chữ tối, không phải trắng — trắng trên `#D97706` chỉ đạt 3.19:1 |
| `--color-accent-subtle` | `#FEF3C7` | `#78350F` | Nền badge giá khuyến mãi |
| `--color-ring` | `#0D9488` | `#2DD4BF` | Focus ring, luôn kèm `--color-ring-offset` |
| `--color-ring-offset` | `#F8FAFC` | `#0F172A` | Vòng đệm 2px giữa control và ring |

#### Trạng thái ngữ nghĩa

| Token | Light | Dark | Vai trò |
|---|---|---|---|
| `--color-success` | `#15803D` | `#4ADE80` | Đã xuất bản, đã hoàn thành, thanh toán thành công |
| `--color-success-subtle` | `#DCFCE7` | `#14532D` | Nền badge/alert thành công |
| `--color-on-success-subtle` | `#166534` | `#86EFAC` | Chữ trên `success-subtle` |
| `--color-warning` | `#B45309` | `#FBBF24` | Chờ xử lý, video đang encode, sắp hết hạn |
| `--color-warning-subtle` | `#FEF3C7` | `#78350F` | Nền badge/alert cảnh báo |
| `--color-on-warning-subtle` | `#B45309` | `#FCD34D` | Chữ trên `warning-subtle` |
| `--color-destructive` | `#DC2626` | `#F87171` | Lỗi, xóa, thu hồi, khóa tài khoản |
| `--color-destructive-hover` | `#B91C1C` | `#FCA5A5` | Hover của nút destructive |
| `--color-destructive-foreground` | `#FFFFFF` | `#450A0A` | Chữ trên nền `destructive` |
| `--color-destructive-subtle` | `#FEE2E2` | `#7F1D1D` | Nền alert lỗi |
| `--color-on-destructive-subtle` | `#991B1B` | `#FCA5A5` | Chữ trên `destructive-subtle` |
| `--color-info` | `#0369A1` | `#38BDF8` | Thông báo trung tính, banner demo |
| `--color-info-subtle` | `#E0F2FE` | `#0C4A6E` | Nền alert thông tin |
| `--color-on-info-subtle` | `#075985` | `#7DD3FC` | Chữ trên `info-subtle` |

### 1.3 Sai lệch có đo đạc so với palette gốc

Palette được giao đặt `primary #0D9488` cùng `on-primary #FFFFFF`. Cặp này được đo bằng công thức WCAG 2.x và đạt **3.74:1** — không đạt ngưỡng 4.5:1 cho chữ thường mà chính bản brief đặt làm sàn. Ba sai lệch dưới đây là bắt buộc; mọi giá trị khác giữ nguyên.
  
| Sai lệch | Đo được | Xử lý |
|---|---|---|
| `#FFFFFF` trên `#0D9488` | 3.74:1 | Giữ `#0D9488` làm `--color-primary` cho phần không chứa chữ (vẫn đạt 3.74:1 > 3:1 cho UI phi văn bản). Nền đặc có chữ dùng `--color-primary-strong` `#0F766E` = **5.47:1** |
| `#FFFFFF` trên `#D97706` | 3.19:1 | Giữ nguyên `#D97706` — đây là màu CTA nên phải giữ độ tươi. Đổi chữ sang `#431407` = **4.91:1** |
| `#64748B` trên `#F1F5F9` | 4.34:1 | Thêm `--color-muted-foreground-strong` `#475569` = **6.92:1** cho chữ phụ nằm trên bề mặt `muted` |

### 1.4 Typography

Hai họ chữ, cả hai có subset `vietnamese` của Google Fonts. Nạp bằng `next/font/google` với `subsets: ['latin','vietnamese']`, `display: 'swap'`, xuất ra CSS variable rồi gắn vào `<html>`.

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--font-heading` | `var(--font-lexend), ui-sans-serif, system-ui, sans-serif` | h1–h4, số liệu lớn, nhãn nút cỡ `lg` |
| `--font-sans` | `var(--font-inter), ui-sans-serif, system-ui, sans-serif` | Toàn bộ phần còn lại |
| `--font-mono` | `ui-monospace, "Cascadia Code", "Source Code Pro", monospace` | Mã, slug, `appTransId`, id trong bảng admin |

Baloo 2 + Comic Neue bị loại: đó là cặp font ứng dụng trẻ em, không phù hợp sản phẩm bán khóa học cho người lớn.

#### Thang cỡ chữ

Line-height rộng hơn mặc định Tailwind một bậc ở cỡ thân bài, vì dấu tiếng Việt xếp chồng (`ế`, `ộ`, `ỹ`) chạm nhau khi leading chặt.

| Token | Cỡ | Line-height | Weight mặc định | Letter-spacing | Vai trò |
|---|---|---|---|---|---|
| `--text-xs` | 12px / 0.75rem | 16px | 500 | 0.01em | Nhãn badge, chú thích bảng, timestamp |
| `--text-sm` | 14px / 0.875rem | 22px | 400 | 0 | Chữ phụ, meta card, nhãn form, ô nhập trong bảng admin |
| `--text-base` | 16px / 1rem | 26px | 400 | 0 | Thân bài mặc định. Không dùng cỡ nhỏ hơn cho đoạn văn |
| `--text-lg` | 18px / 1.125rem | 30px | 400 | 0 | Đoạn dẫn, nội dung bài học |
| `--text-xl` | 20px / 1.25rem | 28px | 600 | −0.005em | Tiêu đề card, tiêu đề chương |
| `--text-2xl` | 24px / 1.5rem | 32px | 600 | −0.01em | h3, tiêu đề section trang |
| `--text-3xl` | 30px / 1.875rem | 38px | 600 | −0.015em | h2 |
| `--text-4xl` | 36px / 2.25rem | 44px | 700 | −0.02em | h1 ở ≤ 767px, h1 trang trong |
| `--text-5xl` | 48px / 3rem | 54px | 700 | −0.025em | h1 hero từ 768px |

Weight khả dụng: Lexend 500/600/700, Inter 400/500/600/700. Không nạp weight khác — mỗi weight thừa là một file font tiếng Việt phải tải.

| Token weight | Giá trị |
|---|---|
| `--font-weight-normal` | 400 |
| `--font-weight-medium` | 500 |
| `--font-weight-semibold` | 600 |
| `--font-weight-bold` | 700 |

Quy tắc kiểu chữ:

- Đo dòng thân bài tối đa `--container-prose` = `65ch`.
- Không dùng `text-transform: uppercase` ở bất kỳ đâu. Chữ hoa toàn phần làm mất dấu tiếng Việt và giảm tốc độ đọc.
- Không dùng italic cho tiếng Việt dài quá một cụm từ; Inter italic làm dấu móc khó phân biệt.
- Số trong bảng và bộ đếm dùng `font-variant-numeric: tabular-nums`.

### 1.5 Spacing, bo góc, viền, đổ bóng

Tailwind v4 sinh toàn bộ tiện ích khoảng cách từ một biến gốc.

| Token | Giá trị |
|---|---|
| `--spacing` | `0.25rem` (4px) |

Bậc được dùng trong sản phẩm: `1`(4) `2`(8) `3`(12) `4`(16) `5`(20) `6`(24) `8`(32) `10`(40) `12`(48) `16`(64) `20`(80) `24`(96). Không dùng bậc lẻ ngoài danh sách này.

| Nhịp | Giá trị | Vai trò |
|---|---|---|
| Trong control | `2`–`3` | Khoảng cách icon và nhãn |
| Trong card | `4`–`5` | Padding card, khoảng cách các dòng meta |
| Giữa các khối | `6`–`8` | Khoảng cách giữa các card, giữa các trường form |
| Giữa các section trang | `12` (mobile) / `20` (≥1024px) | Nhịp dọc của trang public |
| Gutter trang | `4` (375px) / `6` (768px) / `8` (≥1024px) | Padding ngang container |

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--radius-sm` | 4px | Badge, chip, checkbox |
| `--radius-md` | 6px | Nút, input, select, textarea |
| `--radius-lg` | 8px | Card, panel, alert, ảnh bìa |
| `--radius-xl` | 12px | Modal, drawer, khối hero |
| `--radius-full` | 9999px | Avatar, thanh tiến độ, nút icon tròn |
| `--container-page` | 80rem (1280px) | Bề rộng nội dung tối đa |
| `--container-prose` | 65ch | Bề rộng đoạn văn tối đa |

Flat design: **không có đổ bóng cho phần tử nằm trong luồng tài liệu**. Card, nút, input phân tách bằng viền 1px `--color-border` và bằng chênh lệch nền `card` với `background`. Chỉ hai token bóng, dành riêng cho lớp nổi thật sự:

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--shadow-overlay` | `0 8px 24px rgba(15,23,42,0.12)` | Dropdown, tooltip, popover |
| `--shadow-modal` | `0 16px 48px rgba(15,23,42,0.20)` | Dialog, drawer |

Ở dark mode hai bóng này gần như vô hình, nên modal và dropdown ở dark mode bắt buộc thêm `border: 1px solid rgba(255,255,255,0.12)`.

### 1.6 Motion

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--ease-standard` | `cubic-bezier(0.2, 0, 0, 1)` | Mặc định |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Phần tử xuất hiện |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Phần tử biến mất |
| `--duration-fast` | 150ms | Hover, focus, đổi màu, checkbox |
| `--duration-base` | 200ms | Mở accordion, đổi tab, toast vào |
| `--duration-slow` | 300ms | Drawer trượt, modal, stagger reveal |

- **Tailwind v4 không có namespace `--duration-*`.** Đã kiểm trên 4.3.3: `duration-fast` và `duration-base` không sinh ra tiện ích nào (`duration-200` thì có, vì nó là giá trị tự do). Ba token thời lượng ở trên là **biến CSS thuần**, dùng bằng `transition-duration: var(--duration-base)` trong CSS viết tay hoặc `duration-[var(--duration-base)]` trong class. Viết `duration-base` là một class không tồn tại — không có lỗi, chỉ là không có gì xảy ra.
- Stagger reveal chỉ áp cho lưới card: mỗi card trễ thêm 40ms, tối đa 6 card, sau đó hiện đồng loạt.
- Không animate `height` — dùng `grid-template-rows: 0fr → 1fr` cho accordion.
- `@media (prefers-reduced-motion: reduce)`: mọi `--duration-*` về `1ms`, bỏ stagger, bỏ transform trượt; chỉ giữ chuyển màu. Quy tắc này chỉ chạy được vì `@theme static` đã phát ba biến đó ra `:root` — dưới `@theme` thường thì không có gì để ghi đè.

### 1.7 Icon và breakpoint

Lucide, chỉ SVG, `stroke-width: 1.75`, `currentColor`. Không dùng emoji ở bất kỳ đâu kể cả trạng thái rỗng.

| Token | Giá trị | Dùng cho |
|---|---|---|
| `--size-icon-sm` | 16px | Trong chữ `text-sm`, trong badge |
| `--size-icon-md` | 20px | Nút, mục menu, hàng bài học |
| `--size-icon-lg` | 24px | Nút player, tiêu đề empty state |
| `--size-icon-xl` | 40px | Minh họa trong `EmptyState`, `ErrorState` |

Breakpoint giữ mặc định Tailwind v4. Bốn khung thiết kế trong `elearning.pen` ánh xạ như sau:

| Khung thiết kế | Breakpoint | Bố cục nền |
|---|---|---|
| 375px | mặc định | 1 cột, gutter 16px |
| 768px | `md` (48rem) | 2 cột, gutter 24px |
| 1024px | `lg` (64rem) | 3 cột, gutter 32px, sidebar hiện |
| 1440px | `xl` (80rem) | 4 cột, nội dung khóa `--container-page` 1280px, hai bên là lề |

---

## 2. Sitemap và route map

### 2.1 Nguyên tắc

- Đoạn đường dẫn viết bằng tiếng Anh; nhãn hiển thị viết tiếng Việt. Giá trị `[slug]` sinh từ tiêu đề tiếng Việt đã bỏ dấu: `"Lập trình JavaScript từ đầu — Khóa 2026"` → `lap-trinh-javascript-tu-dau-khoa-2026`.
- Mặc định là Server Component. `'use client'` chỉ đặt ở lá nhỏ nhất cần state hoặc sự kiện, không đặt ở `page.tsx`.
- **Không có Route Handler nào dưới `/api`** trong `apps/web`. PROJECT_PLAN đã chốt rewrite `/api/*` sang NestJS, nên đường dẫn đó thuộc về backend. Thao tác cần chạy trên server của Next dùng Server Action.
- `apps/web/src/proxy.ts` chỉ kiểm tra **sự tồn tại** cookie `elearning_session` để chuyển hướng sớm về `/login?next=…`. Quyết định phân quyền thật nằm ở layout, gọi `GET /api/v1/auth/me`. Proxy không được coi là ranh giới bảo mật, và nó **không chạy** cho request phục vụ trang ISR đã prerender — nên nó không bao giờ được là cổng duy nhất.
  - Tên file là `proxy.ts`, hàm xuất là `export function proxy(request: NextRequest)`. Đã kiểm trong `apps/web/node_modules/next/dist/docs/.../middleware.md` của Next 16.3.3 đang cài: "The `middleware.js` file convention has been **deprecated** in Next.js 16 and renamed to `proxy.js`." Đặt tên `middleware.ts` là file chết, không chạy và không báo lỗi.
  - `export const config = { matcher: ['/my-courses/:path*', '/account/:path*', '/learn/:path*', '/checkout/:path*', '/admin/:path*'] }`. Không có `matcher` thì proxy chạy trên cả `/` và `/courses/*` và phá prerender của nhóm `(marketing)`.
- **Luật `?next=`** (dùng ở 9 chỗ trong tài liệu này): chỉ chấp nhận giá trị bắt đầu bằng đúng **một** dấu `/` và không bắt đầu bằng `//`; mọi giá trị khác bị thay bằng `/my-courses`. Không kiểm thì `next=https://evil.example/` là một open redirect có sẵn trên trang đăng nhập.
- **Không Server Component nào dưới `(marketing)` được gọi `cookies()` hay `headers()`.** Đã kiểm trong tài liệu của Next 16.3.3: "`cookies` is a Request-time API … Using it in a layout or page will opt a route into dynamic rendering." Một lần gọi trong `(marketing)/layout.tsx` là mọi nhãn `ISR 300` và `S` của cả nhóm thành vô nghĩa. Hệ quả bắt buộc: trạng thái đăng nhập và trạng thái enrollment vào trang công khai **chỉ** qua client island (§2.3, §4.4, §4.5). Cách "sửa" bằng cách cache lời gọi enrollment còn tệ hơn: nó nướng trạng thái của một người xem vào HTML dùng chung.
- **Tên trang là thẩm quyền của tài liệu này.** `API_CONTRACT.md` có cột "Trang" để tra chéo, không phải để đặt tên: đường dẫn trang lấy theo §2.2/§2.3 ở đây (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/account/orders`, `/admin/orders`). Ngoại lệ duy nhất là tham số của route checkout — nó bị chính hình dáng endpoint ép, xem §2.2.

### 2.2 Cây thư mục

```text
apps/web/src/app/
├── layout.tsx                 RSC   root: <html lang="vi">, font, theme script, Toaster
├── globals.css
├── not-found.tsx              RSC   404 toàn cục
├── error.tsx                  client
├── global-error.tsx           client
├── sitemap.ts                 RSC   liệt kê course published
├── robots.ts                  RSC
│
├── proxy.ts                   edge  chỉ redirect sớm, có matcher (§2.1)
│
├── (marketing)/
│   ├── layout.tsx             RSC   SiteHeader + SiteFooter — không đọc cookie
│   ├── page.tsx               RSC   /                      static, revalidate 300
│   ├── courses/
│   │   ├── page.tsx           RSC   /courses               dynamic (searchParams)
│   │   ├── loading.tsx        RSC
│   │   └── [slug]/
│   │       ├── page.tsx       RSC   /courses/[slug]        generateStaticParams + revalidate 300
│   │       ├── loading.tsx    RSC
│   │       ├── not-found.tsx  RSC
│   │       └── opengraph-image.tsx
│   ├── categories/[slug]/page.tsx  RSC  /categories/[slug]  generateStaticParams + revalidate 300
│   ├── about/page.tsx         RSC   static
│   ├── contact/page.tsx       RSC   static + ContactForm client (đọc ?course= trong Suspense)
│   ├── terms/page.tsx         RSC   static
│   ├── privacy/page.tsx       RSC   static
│   ├── refund/page.tsx        RSC   static
│   └── payment/page.tsx       RSC   static
│
├── (auth)/
│   ├── layout.tsx             RSC   khung giữa trang, logo, không nav
│   ├── login/page.tsx         RSC   dynamic  (?next=)
│   ├── register/page.tsx      RSC   dynamic
│   ├── forgot-password/page.tsx    RSC static
│   ├── reset-password/page.tsx     RSC dynamic (?token=)
│   └── verify-email/page.tsx       RSC dynamic (?token=)
│
├── (learner)/
│   ├── layout.tsx             RSC   requireUser() + AppHeader
│   ├── my-courses/
│   │   ├── page.tsx           RSC   /my-courses            force-dynamic
│   │   └── loading.tsx        RSC
│   ├── account/
│   │   ├── layout.tsx         RSC   Tabs hồ sơ
│   │   ├── page.tsx           RSC   /account               force-dynamic
│   │   ├── password/page.tsx  RSC   force-dynamic
│   │   ├── sessions/page.tsx  RSC   force-dynamic
│   │   └── orders/
│   │       ├── page.tsx       RSC   force-dynamic
│   │       └── [id]/page.tsx  RSC   force-dynamic
│   └── checkout/[courseSlug]/page.tsx   RSC force-dynamic   ← thiết kế trước, dựng sau
│
├── (player)/
│   └── learn/[courseSlug]/
│       ├── layout.tsx         RSC   requireEnrollment() + khung player, không SiteHeader
│       ├── page.tsx           RSC   redirect tới bài đang học dở
│       └── [lessonId]/
│           ├── page.tsx       RSC   /learn/[courseSlug]/[lessonId]  force-dynamic
│           └── loading.tsx    RSC
│
└── (admin)/
    ├── layout.tsx             RSC   requireAdmin() + AdminSidebar
    └── admin/
        ├── page.tsx           RSC   /admin                 force-dynamic
        ├── categories/page.tsx RSC  /admin/categories      force-dynamic
        ├── courses/
        │   ├── page.tsx       RSC   force-dynamic
        │   ├── new/page.tsx   RSC   static shell + form client
        │   └── [id]/
        │       ├── layout.tsx RSC   Tabs + StickyFormActions
        │       ├── page.tsx   RSC   thông tin chung
        │       ├── curriculum/page.tsx        RSC + SortableList client
        │       └── lessons/[lessonId]/page.tsx RSC + editor client
        ├── users/
        │   ├── page.tsx       RSC   force-dynamic
        │   └── [id]/page.tsx  RSC   force-dynamic
        ├── enrollments/page.tsx   RSC force-dynamic
        ├── orders/page.tsx        RSC force-dynamic   ← thiết kế trước, dựng sau
        └── audit-logs/page.tsx    RSC force-dynamic
```

Route checkout đổi từ `/checkout/[purchaseId]` sang **`/checkout/[courseSlug]`**. Lý do: `API_CONTRACT.md` đã chốt `POST /checkout/{courseSlug}`, và endpoint đó cố ý trả lại QR cũ (`200` thay vì `201`) khi đã có `Purchase` đang chờ — tham số của trang phải là thứ người dùng cầm trong tay trước khi có purchase, tức slug khóa học. Giữ `purchaseId` trên URL nghĩa là phải gọi API một lần chỉ để biết đi đâu, và mỗi lần bấm lại sinh một URL khác cho cùng một giao dịch. `DEMO_MODE.md` §10 từng ghi mâu thuẫn này là câu hỏi mở; đây là câu trả lời, và cột "Trang" của `API_CONTRACT.md` §5.8–§5.9 đã sửa theo.

Ba tên trang `/account/orders`, `/account/orders/[id]`, `/admin/orders` là quyết định điều hướng của tài liệu này: `/account/orders` nằm trong bộ tab hồ sơ và dùng đúng từ vựng "Đơn hàng" ở §9.5. Cột "Trang" của `API_CONTRACT.md` đã được đối chiếu và hiện dùng đúng ba tên này.

### 2.3 Bảng route

`Cache` = `S` static build-time, `ISR n` static + revalidate n giây, `D` render mỗi request.

#### Công khai

| Đường dẫn | Layout | Cache | Client island |
|---|---|---|---|
| `/` | marketing | ISR 300 | `AuthNav`, `SearchHero`, `CategoryChips`, `EnrolledBadge` |
| `/courses` | marketing | D | `AuthNav`, `CourseFilters`, `SortSelect`, `SearchInput`, `Pagination`, `EnrolledBadge` |
| `/courses/[slug]` | marketing | ISR 300 | `AuthNav`, `CurriculumAccordion`, `PreviewDialog`, `EnrollCta`, `DeniedAlert` |
| `/categories/[slug]` | marketing | ISR 300 | `AuthNav`, `SortSelect`, `Pagination`, `EnrolledBadge` |
| `/about` | marketing | S | `AuthNav` |
| `/contact` | marketing | S | `AuthNav`, `ContactForm` |
| `/terms`, `/privacy`, `/refund`, `/payment` | marketing | S | `AuthNav` |

Ba island giữ cho nhãn cache ở trên là thật, chứ không phải nhãn treo trên một trang thực ra render động:

| Island | Đọc gì | Vì sao không làm ở server |
|---|---|---|
| `AuthNav` | `GET /api/v1/auth/me` sau khi mount | `SiteHeader` phải đổi giữa `guest` và `authed`. Đọc cookie ở layout `(marketing)` là ép cả nhóm sang dynamic (§2.1). Vỏ header render tĩnh; chỗ của `UserMenu` là một khối giữ chỗ đúng kích thước để không nhảy layout khi hydrate |
| `EnrolledBadge` | `GET /api/v1/enrollments/me` (một lần, cache trong client, chia sẻ cho cả lưới) | `Badge` "Đã đăng ký" ở chân card và trạng thái của `EnrollCta` là dữ liệu riêng của người xem. Nướng nó vào HTML ISR nghĩa là người xem đầu tiên quyết định card của mọi người. Card luôn chừa sẵn ô cao cố định cho badge |
| `DeniedAlert`, `ContactForm` | `useSearchParams()` trong `<Suspense>` | `/courses/[slug]?denied=1` và `/contact?course=[slug]` là dữ liệu URL. Đọc `searchParams` trong page là ép route sang dynamic; đọc bằng `useSearchParams` chỉ client-render tới ranh giới `Suspense` gần nhất, phần còn lại vẫn prerender |

#### Xác thực

| Đường dẫn | Layout | Cache | Client island |
|---|---|---|---|
| `/login` | auth | D | `LoginForm` |
| `/register` | auth | D | `RegisterForm` |
| `/forgot-password` | auth | S | `ForgotPasswordForm` |
| `/reset-password` | auth | D | `ResetPasswordForm` |
| `/verify-email` | auth | D | `ResendVerificationButton` |

#### Học viên (yêu cầu đăng nhập)

| Đường dẫn | Layout | Cache | Client island |
|---|---|---|---|
| `/my-courses` | learner | D | `Tabs` (Đang học / Đã xong) |
| `/account` | learner + account | D | `ProfileForm` |
| `/account/password` | learner + account | D | `PasswordForm` |
| `/account/sessions` | learner + account | D | `RevokeSessionButton` |
| `/account/orders` | learner + account | D | `Pagination` |
| `/account/orders/[id]` | learner + account | D | — |
| `/learn/[courseSlug]` | player | D | — (chỉ `redirect`) |
| `/learn/[courseSlug]/[lessonId]` | player | D | `VideoPlayer`, `CurriculumAccordion`, `CompleteToggle`, `Drawer` |
| `/checkout/[courseSlug]` | learner | D | `QrPanel`, `PaymentStatus` |

#### Quản trị (yêu cầu role `ADMIN`)

| Đường dẫn | Layout | Cache | Client island |
|---|---|---|---|
| `/admin` | admin | D | — |
| `/admin/categories` | admin | D | `CategoryManager`, `CategoryDialog` |
| `/admin/courses` | admin | D | `DataTable`, `DataTableToolbar` |
| `/admin/courses/new` | admin | D | `CourseForm` |
| `/admin/courses/[id]` | admin + course | D | `CourseForm`, `TagListInput`, `StickyFormActions`, `PublishDialog`, `ArchiveDialog` |
| `/admin/courses/[id]/curriculum` | admin + course | D | `SortableList`, `SectionDialog`, `LessonDialog`, `ConfirmDialog` |
| `/admin/courses/[id]/lessons/[lessonId]` | admin + course | D | `MarkdownEditor`, `VideoAssetField`, `ResourceUploader` |
| `/admin/users` | admin | D | `DataTable` |
| `/admin/users/[id]` | admin | D | `ManualGrantDialog`, `BlockUserDialog` |
| `/admin/enrollments` | admin | D | `DataTable`, `ManualGrantDialog`, `RevokeDialog` |
| `/admin/orders` | admin | D | `DataTable` |
| `/admin/audit-logs` | admin | D | `DataTable`, `Pagination` |

Ba layout bảo vệ gọi API rồi xử lý như sau:

| Layout | Kiểm tra | Khi thất bại |
|---|---|---|
| `(learner)/layout.tsx` | `GET /api/v1/auth/me` trả 200 | `redirect('/login?next=' + pathname)` |
| `(player)/learn/[courseSlug]/layout.tsx` | `me` 200 **và** enrollment active cho khóa | Chưa đăng nhập → `/login?next=…`. Đã đăng nhập nhưng chưa có quyền → `redirect('/courses/[slug]?denied=1')` |
| `(admin)/layout.tsx` | `me` 200 và `role === 'ADMIN'` | Chưa đăng nhập → `/login?next=…`. Sai vai trò → `notFound()` (404 chứ không phải 403, để không lộ sự tồn tại của khu quản trị) |

**Chưa xác minh email không chặn gì cả.** `(learner)` và `(player)` chỉ hỏi `me` 200, không hỏi `emailVerifiedAt`. Người được admin cấp quyền học thủ công phải vào học được ngay — đó là con đường duy nhất có enrollment ở vòng đầu, và chặn nó là chặn đúng luồng quan trọng nhất. Thay vào đó: khi `me.emailVerifiedAt === null`, layout `(learner)` hiện `Alert` `warning` `banner` dính đầu trang, không đóng được — **"Email của bạn chưa được xác minh."** / "Xác minh để nhận thông báo về khóa học và khôi phục được mật khẩu." → nút "Gửi lại email xác minh" (gọi `POST /api/v1/auth/verify-email/request`, cùng cooldown ở §3.2). Banner biến mất ngay khi `emailVerifiedAt` khác null. Khu `(admin)` không có banner này.

`(player)/learn/[courseSlug]/layout.tsx` có thêm một nhánh: `role === 'ADMIN'` thì bỏ qua kiểm tra enrollment. Đó chính là đường xem trước nội dung của admin (`API_CONTRACT.md` chốt bypass theo vai trò ở `GET /learn/*` và `GET /lessons/{id}/content`), và là lý do không cần route preview riêng. Khi bypass đang chạy, header player hiện `Alert` `info` `banner` "Bạn đang xem trước với quyền quản trị. Tiến độ học không được ghi lại."

---

## 3. Page inventory

### 3.1 Công khai

| Trang | Mục đích | Mục tiêu người dùng | Component | Dữ liệu | CTA chính |
|---|---|---|---|---|---|
| `/` | Cửa vào tìm kiếm, thiết lập uy tín | Hiểu nơi này dạy gì trong 5 giây và tìm được khóa phù hợp | `SearchHero`, `CategoryChips`, `CourseGrid`, `TrustStats`, `InstructorCard`, `FaqAccordion`, `SiteFooter` | 8 khóa nổi bật, danh sách category, tổng số học viên và số khóa | "Xem tất cả khóa học" → `/courses` |
| `/courses` | Duyệt và lọc toàn bộ catalog | Thu hẹp từ toàn bộ xuống 3–5 khóa đáng xem | `SearchInput`, `CourseFilters`, `SortSelect`, `CourseGrid`, `CourseCard`, `Pagination`, `EmptyState` | Trang khóa học đã published + tổng số, danh mục, khoảng giá, trình độ | Card → `/courses/[slug]` |
| `/courses/[slug]` | Bán một khóa cụ thể | Quyết định khóa này có đáng thời gian và tiền không | `CourseHero`, `Rating`, `PriceTag`, `EnrollCta`, `CourseHighlights`, `CourseRequirements`, `CourseAudience`, `LessonContent` (mô tả Markdown), `CurriculumAccordion`, `LessonRow`, `PreviewDialog`, `InstructorCard`, `FaqAccordion`, `Alert` | `CourseDetail`: course đầy đủ kèm `subtitle`, `learningOutcomes`, `requirements`, `targetAudience`, `compareAtPriceVnd`, toàn bộ section/lesson kèm cờ preview và thời lượng. **Không có** trạng thái enrollment — nó là dữ liệu riêng của người xem, do island `EnrolledBadge` lấy sau khi hydrate (§2.3) | Đổi theo ngữ cảnh — xem bảng dưới |
| `/categories/[slug]` | Trang đích cho một danh mục | Duyệt trong một chủ đề | `CourseGrid`, `SortSelect`, `Pagination`, `EmptyState` | Category + khóa học thuộc category | Card → `/courses/[slug]` |
| `/about` | Giới thiệu người dạy | Tin vào người đứng lớp | `InstructorCard`, `LessonContent` | Nội dung tĩnh | "Xem khóa học" |
| `/contact` | Kênh liên hệ, và là lối vào xin cấp quyền học khi chưa có thanh toán | Gửi được câu hỏi và biết bao giờ có trả lời | `ContactForm`, `Alert`, `LessonContent` (khối thông tin chủ sở hữu) | Không gọi API lúc render. Khi có `?course=[slug]`, island đọc slug từ URL và hiện một dòng chỉ đọc | "Gửi liên hệ" |
| `/terms`, `/privacy`, `/refund`, `/payment` | Nghĩa vụ pháp lý | Đọc điều khoản | `LessonContent`, `Breadcrumb`, `Alert` (banner bản nháp) | Markdown trong `src/content/legal/*.md`. `isPlaceholder: true` → banner "BẢN NHÁP — chưa có hiệu lực pháp lý, chỉ dùng để demo" + `noindex` | — |

`/contact` là **đường chuyển đổi duy nhất của vòng đầu**, nên nó được đặc tả như một form thật, không phải một trang thông tin:

| Điểm | Quyết định |
|---|---|
| Trường | Họ tên (`Input`, 2–80) · Email (`Input`, `@IsEmail`, ≤ 320) · Nội dung (`Textarea` `autosize`, 10–2000). Khớp một-một với DTO của `POST /api/v1/contact` |
| Khi có `?course=` | Một dòng chỉ đọc trên đầu form: "Khóa học quan tâm: **{title}**", cạnh nó là link "Đổi" về `/courses`. `courseSlug` gửi kèm trong body. Không dùng `Select` — người dùng đến đây từ đúng một khóa, bắt họ chọn lại là hỏi lại thứ vừa biết |
| Nếu slug không tra được tiêu đề | Hiện nguyên slug, vẫn gửi. Một tiêu đề hỏng không được chặn form |
| Người đã đăng nhập | Điền sẵn tên và email từ `me`, vẫn sửa được |
| Chống spam | Rate limit phía server (`429`), không captcha. Một chủ sở hữu, vài liên hệ mỗi ngày — captcha là thuế đánh lên người dùng thật để chặn một vấn đề chưa có |
| Thành công (`202`) | Thay form bằng `Alert` `success`: **"Đã gửi liên hệ"** / "Chúng tôi sẽ trả lời qua email trong vòng 24 giờ." → nút "Về trang chủ" |
| Lỗi gửi | `Alert` `destructive` phía trên form, **giữ nguyên toàn bộ nội dung đã nhập**: "Không gửi được liên hệ. Thử lại sau ít phút." → "Thử lại" |
| `429` | Theo hàng "Quá số lần thử" ở §6.3 |

CTA của `/courses/[slug]` theo ngữ cảnh — đây là điểm mà quyết định "thanh toán dựng sau cùng" lộ ra ngoài giao diện:

`EnrollCta` là client island. Trạng thái mặc định khi HTML tĩnh vừa tới là nhánh "chưa đăng nhập"; sau khi `EnrolledBadge` trả lời thì nút đổi tại chỗ, trong một ô có chiều cao cố định để không đẩy nội dung bên dưới.

| Điều kiện | Nhãn nút | Biến thể | Đích |
|---|---|---|---|
| Đã có enrollment active | "Vào học" hoặc "Tiếp tục học" nếu có tiến độ | `primary`, `lg` | `/learn/[slug]` |
| Chưa đăng nhập | "Đăng nhập để đăng ký học" | `accent`, `lg` | `/login?next=/courses/[slug]` |
| Đã đăng nhập, `NEXT_PUBLIC_CHECKOUT_ENABLED=false` | "Liên hệ để đăng ký" | `accent`, `lg` | `/contact?course=[slug]` |
| Đã đăng nhập, checkout đã bật | "Đăng ký học · 499.000 ₫" | `accent`, `lg` | Gọi `POST /api/v1/checkout/{slug}` rồi `router.push('/checkout/{slug}')` — xem bảng nhánh dưới |
| Khóa `ARCHIVED` | "Khóa học đã ngừng nhận học viên" | `disabled` + `Alert` info | — |

Nhánh của lần bấm "Đăng ký học". Không có route `/checkout` trơn để POST tới — §2.1 cấm Route Handler trong `apps/web`, nên đây là một lời gọi API từ island, không phải form submit:

| Kết quả | Xử lý |
|---|---|
| `201` (tạo mới) hoặc `200` (đã có QR còn hạn) | `router.push('/checkout/{slug}')`. Cùng một đích cho cả hai — endpoint đã tự trả lại giao dịch đang chờ, giao diện không cần biết |
| Trong lúc chờ | Nút ở trạng thái `l`, giữ nguyên bề rộng, `aria-busy="true"`, khóa lần bấm thứ hai. Không có timeout riêng; `429` xử lý theo §6.3 |
| `409 ALREADY_ENROLLED` | `Toast` `info` "Bạn đã có quyền học khóa này." rồi `router.replace('/learn/{slug}')`. Xảy ra thật khi admin vừa cấp quyền trong lúc trang ISR còn cũ |
| `422 COURSE_NOT_PURCHASABLE` | `Alert` `warning` ngay dưới nút: "Khóa học này hiện không nhận đăng ký. Tải lại trang để xem trạng thái mới nhất." → "Tải lại trang" |
| `401` | Theo hàng "Phiên hết hạn giữa thao tác" ở §6.3 |
| Giá hiển thị khác giá server trả về | `Alert` `warning`: "Giá khóa học đã thay đổi. Tải lại trang để xem giá mới." Giá trên trang ISR có thể cũ tới 300 giây — số tiền trong `CheckoutSession` mới là số phải trả |

### 3.2 Xác thực

Năm màn hình đầu phễu. Layout `(auth)`: khung giữa trang rộng tối đa 400px, logo trên cùng là link về `/`, không nav, không footer đầy đủ — chỉ một dòng link tới `/terms` và `/privacy`.

| Trang | Mục đích | Mục tiêu người dùng | Component | Dữ liệu | CTA chính |
|---|---|---|---|---|---|
| `/login` | Vào lại tài khoản | Đăng nhập trong hai ô, không phải nhớ gì thêm | `LoginForm`, `Alert` | `?next=` đã lọc theo luật §2.1 | "Đăng nhập" |
| `/register` | Mở tài khoản | Có tài khoản để được cấp quyền học | `RegisterForm`, `PasswordInput`, `Alert` | — | "Tạo tài khoản" |
| `/forgot-password` | Xin liên kết đặt lại | Nhận được thư mà không lộ email nào có thật | `ForgotPasswordForm`, `Alert` | — | "Gửi liên kết đặt lại" |
| `/reset-password` | Đặt mật khẩu mới | Đặt lại rồi đăng nhập ngay | `ResetPasswordForm`, `PasswordInput`, `ErrorState` | `?token=` | "Đặt mật khẩu mới" |
| `/verify-email` | Tiêu thụ liên kết xác minh | Biết đã xong hay chưa, và làm gì nếu chưa | `Alert`, `ErrorState`, `ResendVerificationButton`, `DemoNotice` | `?token=` | Đổi theo trạng thái — xem §6.2 |

Trường và link chéo. Mỗi form khớp một-một với DTO ở `API_CONTRACT.md` §5.1; không form nào có trường mà endpoint không nhận:

| Trang | Trường | Link phụ |
|---|---|---|
| `/login` | Email · Mật khẩu (`PasswordInput`, không đo độ mạnh — đo độ mạnh mật khẩu cũ là vô nghĩa) | "Quên mật khẩu" → `/forgot-password` · "Chưa có tài khoản? Đăng ký" → `/register?next=…` (giữ nguyên `next`) |
| `/register` | Tên hiển thị (2–80) · Email · Mật khẩu (≥ 8, có đo độ mạnh) · Xác nhận mật khẩu (chỉ client) | "Đã có tài khoản? Đăng nhập" → `/login?next=…` · Dòng chữ nhỏ dưới nút: "Khi tạo tài khoản, bạn đồng ý với [Điều khoản sử dụng] và [Chính sách bảo mật]." — là câu, không phải checkbox: một checkbox bắt buộc chỉ thêm một bước, không thêm một sự đồng ý nào |
| `/forgot-password` | Email | "Quay lại đăng nhập" → `/login` |
| `/reset-password` | Mật khẩu mới (≥ 8, có đo độ mạnh) · Xác nhận mật khẩu | — (khi token hỏng, xem §6.2) |
| `/verify-email` | Không có ô nhập | "Về khóa học của tôi" / "Đăng nhập" / "Gửi lại email xác minh", tùy trạng thái |

Bốn ràng buộc của nhóm này:

- **`/forgot-password` sau khi gửi luôn hiện đúng một thông báo, không phụ thuộc email có thật hay không**: `Alert` `success` thay chỗ form — **"Kiểm tra hộp thư của bạn"** / "Nếu email này đã đăng ký, chúng tôi vừa gửi liên kết đặt lại mật khẩu. Liên kết dùng được trong 60 phút." Endpoint luôn trả `202`; giao diện nói khác đi là mở lại lỗ dò email mà API cố tình bịt.
- **Hai loại liên kết có hai hạn dùng khác nhau**, và microcopy phải nói đúng cái của trang mình: liên kết **xác minh email** có hạn **24 giờ** (`EMAIL_VERIFY_TTL_MINUTES=1440`), liên kết **đặt lại mật khẩu** có hạn **60 phút** (`PASSWORD_RESET_TTL_MINUTES=60`) — hai biến trong `DEMO_MODE.md` §7, giá trị khớp `API_CONTRACT.md` §5.1. Không có biến chung `AUTH_TOKEN_TTL_MINUTES`: hai loại token không cùng rủi ro, link đặt lại mật khẩu là chìa khóa tài khoản nên phải ngắn, còn link xác minh thì người ta mở vào tối hôm sau. Một chuỗi dùng chung cho cả hai trang là sai ở một trong hai trang.
- `ResendVerificationButton` có cooldown **120 giây**, nhãn đếm ngược "Gửi lại sau {n} giây", nút ở trạng thái `x` trong lúc đếm. 120 chứ không phải 60 vì `POST /auth/verify-email/request` chỉ cho 3 lần mỗi 300 giây mỗi người — cooldown 60 giây đẩy người dùng vào `429` một cách có hệ thống.
- Ở chế độ `MAIL_DRIVER=demo`, `/verify-email` và `/forgot-password` hiện `DemoNotice` kèm link tới hộp thư dev `GET /api/v1/dev/mail`. Đây là cách duy nhất xác minh được trên máy cá nhân.

### 3.3 Học viên

| Trang | Mục đích | Mục tiêu người dùng | Component | Dữ liệu | CTA chính |
|---|---|---|---|---|---|
| `/my-courses` | Bảng điều khiển học tập | Quay lại đúng chỗ đang học trong một lần chạm | `Tabs`, `CourseProgressCard`, `ProgressBar`, `EmptyState` | Enrollment active + tiến độ (bài xong / tổng bài) + bài học gần nhất | "Tiếp tục học" trên card đầu tiên |
| `/learn/[courseSlug]/[lessonId]` | Màn hình học | Xem/đọc xong bài rồi sang bài kế tiếp không ma sát | `VideoPlayer`, `LessonContent`, `ResourceList`, `CurriculumAccordion`, `CompleteToggle`, `LessonNav`, `ProgressBar`, `Drawer` | Lesson (nội dung Markdown, playback URL đã ký, tài liệu), toàn bộ curriculum kèm trạng thái hoàn thành, `lastPositionSeconds` | "Đánh dấu hoàn thành và học tiếp" |
| `/account` | Hồ sơ | Sửa tên hiển thị | `Tabs`, `ProfileForm`, `Alert` | `me` | "Lưu thay đổi" |
| `/account/password` | Đổi mật khẩu | Đổi mật khẩu và hiểu rằng mọi phiên khác sẽ bị đăng xuất | `PasswordForm`, `Alert` | — | "Đổi mật khẩu" |
| `/account/sessions` | Quản lý phiên | Đóng những phiên mình không còn dùng | `DataTable` (biến thể gọn), `Badge`, `RevokeSessionButton`, `RevokeAllSessionsButton`, `ConfirmDialog` | `SessionRow[]`: `createdAt`, `expiresAt`, `isCurrent`. **Chỉ ba trường này** | "Đăng xuất tất cả thiết bị khác" |
| `/account/orders` | Lịch sử mua | Tra lại một giao dịch | `DataTable`, `StatusBadge`, `Pagination`, `EmptyState` | Purchase + PaymentAttempt gần nhất | Hàng → `/account/orders/[id]` |
| `/account/orders/[id]` | Chi tiết đơn | Xem tại sao đơn thất bại, hoặc thử lại | `OrderSummary`, `StatusBadge`, `PaymentStatus` | Purchase + toàn bộ PaymentAttempt | "Tiếp tục thanh toán" khi còn QR hiệu lực |
| `/checkout/[courseSlug]` | Thanh toán *(dựng sau cùng)* | Quét QR và biết khi nào xong | `OrderSummary`, `QrPanel`, `PaymentStatus`, `Alert`, `DemoNotice` | `CheckoutSession` từ `POST /checkout/{courseSlug}`, sau đó poll `GET /purchases/{id}` | "Tôi đã thanh toán, kiểm tra lại" (chỉ gọi lại trạng thái, không tự tuyên bố thành công) |

`/account/sessions` chốt bốn điểm, vì dữ liệu ở đây mỏng hơn người ta tưởng:

- **Không có IP, không có tên trình duyệt, không có thiết bị.** `model Session` trong `DATA_MODEL.md` chỉ có `id`, `userId`, `expiresAt`, `revokedAt`, `createdAt`, và `SessionRow` của API cũng chỉ trả `id`, `createdAt`, `expiresAt`, `isCurrent`. Cột `ipAddress` duy nhất trong schema thuộc `AuditLog`, không thuộc `Session`. Viết "nhận ra thiết bị lạ" vào mục tiêu người dùng là hứa một thứ không có dữ liệu để làm.
- Phiên hiện tại mang `Badge` `primary` "Phiên này" và **không có** nút thu hồi — tự đăng xuất mình từ bảng phiên là một cách gọi tên khác của nút Đăng xuất, và nó ở chỗ khác (§5.6).
- Nút phụ "Đăng xuất tất cả thiết bị khác" gọi `DELETE /api/v1/users/me/sessions` (giữ phiên hiện tại), qua `ConfirmDialog` `destructive` — nhan đề "Đăng xuất tất cả thiết bị khác", nút "Đăng xuất tất cả thiết bị khác" / "Hủy". Xong thì `Toast` `success` "Đã đăng xuất {n} phiên khác." Ẩn nút khi chỉ có một phiên.
- Thu hồi một phiên: `RevokeSessionButton` → `ConfirmDialog` `destructive` "Đăng xuất phiên này" / "Hủy" → `Toast` "Đã đăng xuất phiên đó."

### 3.4 Quản trị

| Trang | Mục đích | Mục tiêu người dùng | Component | Dữ liệu | CTA chính |
|---|---|---|---|---|---|
| `/admin` | Tổng quan | Biết trong 10 giây có gì cần xử lý | `StatTile`, `DataTable` (gọn), `Alert` | Năm ô: doanh thu tháng, số enrollment mới, số khóa `DRAFT`, số thanh toán đang treo, số video chưa `READY` | "Xem khóa học" |
| `/admin/categories` | Quản lý danh mục | Tạo, sửa và sắp xếp các chủ đề dùng trong catalog | `CategoryManager`, `CategoryDialog`, `SortableList`, `ConfirmDialog` | Toàn bộ category theo `position` | "Thêm danh mục" |
| `/admin/courses` | Danh sách khóa | Tìm và mở đúng khóa để sửa | `DataTableToolbar`, `DataTable`, `StatusBadge`, `EmptyState` | Toàn bộ course kèm status, giá, số học viên, số bài, cập nhật lần cuối | "Tạo khóa học" |
| `/admin/courses/new` | Tạo khóa | Tạo bản nháp nhanh nhất có thể | `CourseForm` (rút gọn: tiêu đề, slug, danh mục) | Danh sách category | "Tạo bản nháp" |
| `/admin/courses/[id]` | Thông tin chung | Điền đủ dữ liệu để được phép xuất bản | `CourseForm`, `MarkdownEditor`, `PriceInput`, `TagListInput` ×3, `FileDropzone`, `PublishChecklist`, `StickyFormActions`, `PublishDialog`, `ArchiveDialog` | Course đầy đủ (kể cả `subtitle`, `learningOutcomes`, `requirements`, `targetAudience`, `compareAtPriceVnd`, `level`), category, trạng thái checklist | "Lưu" (chính) / "Xuất bản" (khi checklist đủ) |
| `/admin/courses/[id]/curriculum` | Dựng chương trình học | Thêm chương, thêm bài, đổi thứ tự | `SortableList`, `SectionDialog`, `LessonDialog`, `LessonRow`, `Badge`, `EmptyState` | Section + Lesson theo `position`, trạng thái video của từng bài | "Thêm chương" |
| `/admin/courses/[id]/lessons/[lessonId]` | Soạn một bài | Viết nội dung, gắn video và tài liệu | `MarkdownEditor`, `VideoAssetField`, `ResourceUploader`, `ResourceList`, `Switch` (học thử), `StickyFormActions` | Lesson, VideoAsset kèm status, danh sách LessonResource | "Lưu bài học" |
| `/admin/users` | Danh sách người dùng | Tìm một người theo email | `DataTableToolbar`, `DataTable`, `StatusBadge` | User kèm số khóa đang học, ngày đăng ký, trạng thái | Hàng → `/admin/users/[id]` |
| `/admin/users/[id]` | Hồ sơ người dùng | Cấp quyền học hoặc khóa tài khoản | `StatTile`, `DataTable` (enrollment của người này), `ManualGrantDialog`, `ConfirmDialog`, `StatusBadge` | User, enrollment, purchase, session | "Cấp quyền học" |
| `/admin/enrollments` | Trung tâm quyền học | Cấp một quyền học và thu hồi một quyền học | `DataTableToolbar`, `DataTable`, `ManualGrantDialog`, `RevokeDialog`, `StatusBadge` | Enrollment kèm nguồn gốc (`PAID` / `MANUAL`), người cấp, thời điểm | "Cấp quyền học" |
| `/admin/orders` | Đơn hàng *(dựng sau cùng)* | Đối soát một giao dịch | `DataTable`, `StatusBadge`, `Alert` | Purchase + PaymentAttempt + `appTransId` | "Truy vấn lại ZaloPay" |
| `/admin/audit-logs` | Nhật ký | Truy vết ai đã làm gì | `DataTable`, `Pagination`, `DataTableToolbar` | AuditLog: actor, action, entity, thời điểm | — (chỉ đọc) |

**Không có thao tác hàng loạt ở vòng đầu.** Không bảng admin nào có ô tick chọn hàng, không có thanh "đã chọn {n}", không có `ConfirmDialog` hàng loạt. Một chủ sở hữu cấp quyền cho từng người và archive từng khóa; hàng loạt kéo theo giới hạn số hàng, xử lý thành công một phần, và một hộp thoại xác nhận nữa — ba thứ phải test cho một thao tác chưa ai cần. `Checkbox` vẫn tồn tại trong §4.2 cho bộ lọc và ô đồng ý.

**Hai ô của `/admin` bị ẩn khi `NEXT_PUBLIC_CHECKOUT_ENABLED=false`**: "Doanh thu tháng" và "Thanh toán đang treo". Ẩn hẳn, không hiện `0 ₫` — số 0 ở đây không phải là "chưa bán được gì", mà là "chưa có tính năng bán", và hai câu đó khác nhau. Lưới tile co từ 5 xuống 3 cột. "Doanh thu tháng" là **tháng dương lịch hiện tại theo `Asia/Ho_Chi_Minh`**, tính bằng `from` = 00:00 ngày 1 của tháng, `to` = thời điểm gọi.

---

## 4. Component inventory

Trạng thái viết tắt: `d` default, `h` hover, `f` focus-visible, `a` active, `x` disabled, `l` loading, `e` error, `s` selected. Mọi component tương tác phải có đủ `d h f a`; thiếu `f` là lỗi chặn merge.

### 4.1 Nguyên tố

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `Button` | `primary` `accent` `outline` `ghost` `destructive` `link` | `sm` 32px · `md` 40px · `lg` 48px | `d h f a x l` | Mọi trang |
| `IconButton` | `ghost` `outline` `destructive` | `sm` 32 · `md` 40 · `lg` 44 | `d h f a x` | Header, DataTable, player, dialog |
| `Badge` | `neutral` `primary` `success` `warning` `destructive` `accent` | `sm` `md` | `d` | Card, bảng admin, hàng bài học |
| `Tag` | `static` `removable` | `sm` `md` | `d h f` | Bộ lọc đang áp dụng, danh mục khóa học |
| `Avatar` | `image` `initials` | `sm` 24 · `md` 32 · `lg` 64 | `d` | UserMenu, InstructorCard, bảng người dùng |
| `Card` | `plain` `interactive` `muted` | — | `d h f` (chỉ `interactive`) | Toàn sản phẩm |
| `Divider` | `horizontal` `vertical` | — | `d` | Form, menu, curriculum |
| `Skeleton` | `text` `block` `circle` | theo props | `d` | Mọi `loading.tsx` |
| `Spinner` | `inline` `block` | `sm` 16 · `md` 20 · `lg` 24 | `d` | Nút loading, polling thanh toán |
| `Icon` | wrapper Lucide | `sm` `md` `lg` `xl` | `d` | Toàn sản phẩm |
| `Accordion` | `single` `multiple` | — | `d h f` + đóng/mở | Nền cho `CurriculumAccordion`, `FaqAccordion` |

`Button` chi tiết: nút solid `primary` dùng nền `--color-primary-strong`; `accent` dùng nền `--color-accent` với chữ `--color-accent-foreground`. Ở trạng thái `l`, nút giữ nguyên bề rộng, đổi nhãn thành `Spinner` + nhãn gốc, đặt `aria-busy="true"`, không đổi kích thước. Ở trạng thái `x`, thêm `aria-disabled` và **luôn** kèm một dòng giải thích cạnh nút — nút mờ đi không được là tín hiệu duy nhất.

### 4.2 Form

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `FormField` | `stacked` `inline` | — | `d e` + hint | Mọi form |
| `Label` | `default` `required` | — | `d x` | Mọi form |
| `Input` | `text` `email` `url` `number` | `sm` 32 · `md` 40 · `lg` 48 | `d h f x e` + `readonly` | Auth, hồ sơ, admin |
| `PasswordInput` | có nút hiện/ẩn + đo độ mạnh | `md` `lg` | `d h f x e` | `/register`, `/reset-password`, `/account/password` |
| `Textarea` | `default` `autosize` | — | `d h f x e` | Nội dung liên hệ, ghi chú cấp quyền |
| `Select` | `default` (native `<select>`) | `sm` `md` | `d h f x e` | Danh mục, trình độ, sắp xếp, lọc |
| `Checkbox` | `default` `indeterminate` | 20px, vùng chạm 44px | `d h f a x s` | Bộ lọc, chọn hàng trong bảng, điều khoản |
| `RadioGroup` | `stacked` `cards` | — | `d h f a x s` | Phương thức thanh toán *(checkout)* |
| `Switch` | `default` | 44×24 | `d h f a x` | Bài học thử, chế độ tối |
| `SearchInput` | có icon, nút xóa, debounce 300ms | `md` `lg` | `d h f l e` | `SearchHero`, `/courses`, toolbar admin |
| `PriceInput` | hậu tố `₫`, chỉ số nguyên | `md` | `d h f x e` | `/admin/courses/[id]` |
| `MarkdownEditor` | Tabs Soạn / Xem trước | — | `d f x l e` | Mô tả khóa học, nội dung bài học |
| `FileDropzone` | `image` `document` | — | `d h f x l e` + tiến độ | Ảnh bìa, tài liệu bài học |
| `TagListInput` | danh sách dòng, thêm bằng `Enter`, xóa bằng nút `x` và phím `Backspace` ở ô rỗng, đổi thứ tự bằng nút Lên/Xuống | `md` | `d h f x e` + đếm `{n}/12` | `learningOutcomes`, `requirements`, `targetAudience` ở `/admin/courses/[id]` |

`TagListInput` là ô nhập của ba mảng `text[]`: tối đa **12 mục**, mỗi mục **≤ 200 ký tự**, không cho mục rỗng và không cho trùng nhau sau khi cắt khoảng trắng — đúng ba ràng buộc mà `PATCH /admin/courses/{id}` áp phía server. Mỗi mục là một dòng riêng, không phải một ô textarea ngăn bằng dấu phẩy: dấu phẩy nằm trong chính câu tiếng Việt ("Hiểu closure, scope và hoisting").

`FileDropzone` `image` (ảnh bìa khóa học): chỉ nhận `image/jpeg`, `image/png`, `image/webp`; tối đa **50 MB** (`MAX_UPLOAD_BYTES` = 52.428.800); kích thước tối thiểu 1280×720, kiểm ngay trên client bằng `createImageBitmap` trước khi xin URL upload. `FileDropzone` `document` (tài liệu bài học): mọi MIME hợp lệ, cùng mức 50 MB. Microcopy lỗi ở §6.4.

Quy tắc form áp cho toàn bộ nhóm này:

- Nhãn luôn hiển thị phía trên ô. Không dùng placeholder thay nhãn.
- Placeholder chỉ nêu ví dụ định dạng: `ban@vidu.com`, không phải `Nhập email`.
- Validate khi rời ô lần đầu, sau đó validate theo từng phím gõ để lỗi biến mất ngay khi đã sửa xong.
- Lỗi nằm dưới ô, kèm icon `alert-circle` 16px, chữ `--color-destructive`, ô nhận `aria-invalid="true"` và `aria-describedby` trỏ tới id của dòng lỗi.
- `autocomplete` bắt buộc: `email`, `current-password`, `new-password`, `name`.

### 4.3 Lớp phủ và phản hồi

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `Dialog` | `default` `form` | `sm` 400 · `md` 560 · `lg` 720 | `d l` + đóng/mở | Xuất bản, cấp quyền, xem thử, chương/bài |
| `ConfirmDialog` | `neutral` `destructive` | `sm` | `d l` | Xóa, thu hồi, khóa, đăng xuất phiên |
| `Drawer` | `left` `right` `bottom` | mobile full · `md` 360 | `d` + đóng/mở | Nav mobile, bộ lọc mobile, curriculum < 1024px |
| `DropdownMenu` | `default` | — | `d h f s` | UserMenu, menu hành động trong bảng |
| `Tooltip` | `default` | — | `d` | Nút icon không có nhãn chữ |
| `Toast` + `Toaster` | `success` `error` `info` | — | vào / đứng / ra | Sau mọi thao tác ghi |
| `Alert` | `info` `success` `warning` `destructive` | `inline` `banner` | `d` + tùy chọn đóng | Lỗi form ở cấp trang, cảnh báo trạng thái, DemoNotice |
| `EmptyState` | `neutral` `search` `create` | `sm` (trong card) · `md` (cả trang) | `d` | Mọi lưới và bảng |
| `ErrorState` | `network` `server` `notfound` `expired` | `sm` `md` | `d l` (khi đang thử lại) | Mọi `error.tsx` và mọi vùng tải dữ liệu |
| `DemoNotice` | `info` | `banner` | `d` | `/verify-email`, `/checkout`, `/admin/courses/[id]/lessons/[lessonId]` khi driver ở chế độ demo |

Biến thể `forbidden` bị **xóa khỏi `ErrorState`**: không màn hình nào dựng được nó. Khu admin trả `notFound()` khi sai vai trò (§2.3), layout player chuyển hướng về trang khóa học khi thiếu quyền, và 401 xử lý bằng `Toast` + chuyển hướng. Một biến thể không có nơi dùng là một biến thể sẽ được dùng sai. Thay chỗ nó là `expired`, dùng cho liên kết xác minh/đặt lại mật khẩu và mã QR hết hạn — ba chỗ có thật.

`Toast`: hiện tối đa 3 cái, xếp chồng dưới-phải trên desktop và trên-giữa ở mobile (dưới-phải bị bàn phím ảo che). Tự đóng sau 5 giây với `success`/`info`; `error` **không tự đóng**. Vùng chứa có `role="status"` với `aria-live="polite"`, riêng `error` dùng `role="alert"`.

### 4.4 Điều hướng

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `SkipLink` | — | — | ẩn cho tới `f` | Root layout |
| `SiteHeader` | `guest` `authed` | 64px, dính đầu trang | `d` + đổ bóng khi cuộn | `(marketing)`, `(learner)` |
| `MobileNav` | trong `Drawer` | full | `d` + đóng/mở | < 768px |
| `UserMenu` | `DropdownMenu` | — | `d h f s` | Header khi đã đăng nhập |
| `ThemeToggle` | 3 chế độ: hệ thống / sáng / tối | `md` | `d h f a s` | Header, footer |
| `SiteFooter` | `full` `slim` | — | `d` | `(marketing)` full, `(learner)` slim |
| `Breadcrumb` | — | — | `d h f` | Chi tiết khóa, trang pháp lý, trang admin lồng nhau |
| `Tabs` | `underline` `pill` | `md` | `d h f a s x` | Hồ sơ, khóa học của tôi, editor admin, MarkdownEditor |
| `Pagination` | `full` `compact` | `md` | `d h f a x s` | Catalog, mọi bảng admin |
| `AdminSidebar` | `expanded` `icon-only` `drawer` | 240 / 64 / full | `d h f s` | `(admin)` |
| `LessonNav` | nút Trước / Sau | `md` | `d h f x` | Trang bài học |

Nhãn điều hướng chỉ có ở đây. Đây là danh sách nguyên văn, đúng thứ tự hiển thị:

| Bề mặt | Mục |
|---|---|
| `SiteHeader` `guest` | Khóa học · Danh mục · Giới thiệu · Liên hệ · **Đăng nhập** (`ghost`) · **Đăng ký** (`primary`) |
| `SiteHeader` `authed` | Khóa học · Khóa học của tôi · `UserMenu` (avatar + tên hiển thị cắt 1 dòng) |
| `UserMenu` | Hồ sơ · Đổi mật khẩu · Phiên đăng nhập · Đơn hàng · Quản trị *(chỉ `role === 'ADMIN'`)* · `Divider` · Đăng xuất |
| `MobileNav` (< 768px) | Cùng danh sách header theo trạng thái, xếp dọc, mỗi mục cao 48px; `ThemeToggle` ở đáy drawer |
| `AdminSidebar` | Tổng quan · Khóa học · Danh mục · Người dùng · Quyền học · Đơn hàng · Nhật ký |

`SiteFooter` `full` có bốn nhóm, tên nhóm là tiêu đề `--text-sm` `600`:

| Nhóm | Link |
|---|---|
| Khóa học | Tất cả khóa học · Danh mục |
| Về chúng tôi | Giới thiệu · Liên hệ |
| Pháp lý | Điều khoản sử dụng · Chính sách bảo mật · Chính sách hoàn tiền · Chính sách thanh toán |
| Tài khoản | Đăng nhập · Đăng ký · Khóa học của tôi *(chỉ khi đã đăng nhập, do `AuthNav` bật)* |

Dưới bốn nhóm là một hàng: tên chủ sở hữu, năm, `ThemeToggle`. `SiteFooter` `slim` chỉ giữ hàng đó cộng nhóm Pháp lý. Ở 375px mỗi nhóm là một mục `Accordion`, đóng sẵn, trừ nhóm Pháp lý mở sẵn.

`Pagination` là phân trang thật với đường dẫn `?page=n`, không phải cuộn vô hạn. Lý do: cả catalog và bảng admin đều cần link chia sẻ được và cần nút Back của trình duyệt hoạt động đúng.

### 4.5 Catalog

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `SearchHero` | `home` | — | `d f` | `/` |
| `CategoryChips` | `scroll` (mobile) `wrap` (desktop) | `md` | `d h f s` | `/`, `/courses` |
| `CourseFilters` | `sidebar` (≥1024) `drawer` (<1024) | 264px | `d f` + số bộ lọc đang bật | `/courses` |
| `SortSelect` | — | `sm` | `d h f s` | `/courses`, `/categories/[slug]` |
| `CourseCard` | `default` `compact` `enrolled` | — | `d h f` + skeleton | `/`, `/courses`, `/categories/[slug]`, kết quả tìm kiếm |
| `CourseGrid` | 1 / 2 / 3 / 4 cột | — | `d l` (skeleton) `empty` `error` | Mọi trang có lưới |
| `Rating` | `stars` `inline` | `sm` `md` | `d` + `hidden` khi `ratingCount = 0` | `CourseCard`, `CourseHero` |
| `PriceTag` | `default` `strikethrough` | `sm` `md` `lg` | `d` | `CourseCard`, `CourseHero`, `OrderSummary` |
| `CourseMeta` | dòng icon + chữ | `sm` | `d` | `CourseCard`, `CourseHero` |
| `CourseHero` | — | — | `d` | `/courses/[slug]` |
| `CourseHighlights` | danh sách icon `check`, 2 cột từ 768px | — | `d` + ẩn khi mảng rỗng | `/courses/[slug]` |
| `CourseRequirements` | danh sách icon `dot` | — | `d` + ẩn khi mảng rỗng | `/courses/[slug]` |
| `CourseAudience` | danh sách icon `user-check` | — | `d` + ẩn khi mảng rỗng | `/courses/[slug]` |
| `EnrollCta` | 5 ngữ cảnh ở mục 3.1 | `lg` | `d h f a x l` | `/courses/[slug]`, thanh dính mobile |
| `PreviewDialog` | `Dialog` + `VideoPlayer` | `lg` | `d l e` | `/courses/[slug]` |
| `InstructorCard` | `compact` `full` | — | `d` | `/`, `/about`, `/courses/[slug]` |
| `TrustStats` | hàng `StatTile` | — | `d` | `/` |
| `FaqAccordion` | `Accordion` | — | `d h f` | `/`, `/courses/[slug]` |

Ba khối `CourseHighlights` / `CourseRequirements` / `CourseAudience` đọc thẳng `learningOutcomes` / `requirements` / `targetAudience`. Tiêu đề khối lấy nguyên văn từ `DATA_MODEL.md`: **"Bạn sẽ học được gì"**, **"Yêu cầu"**, **"Khóa học dành cho ai"**. Tối đa 12 mục mỗi khối, không cắt bớt và không có nút "xem thêm" — 12 dòng ngắn không đáng một tương tác. Khối nào có mảng rỗng thì biến mất hoàn toàn, kể cả tiêu đề.

`CourseFilters` — bộ lọc là những cái này, không nhiều hơn. Mỗi tham số ánh xạ thẳng sang query của `GET /courses`, nên URL luôn chia sẻ được:

| Bộ lọc | Control | Tham số URL | Giá trị |
|---|---|---|---|
| Danh mục | `Checkbox` nhiều giá trị | `category` | csv slug, lấy từ `GET /categories` |
| Trình độ | 4 `Checkbox` | `level` | `BEGINNER`, `INTERMEDIATE`, `ADVANCED`, `ALL_LEVELS` |
| Giá | `RadioGroup` `stacked`, 4 bậc | `priceVndMin` / `priceVndMax` | Tất cả (không gửi gì) · Dưới 500.000 ₫ (`priceVndMax=499999`) · 500.000 – 1.000.000 ₫ (`priceVndMin=500000&priceVndMax=1000000`) · Trên 1.000.000 ₫ (`priceVndMin=1000001`) |

Bậc giá là `RadioGroup` chứ không phải hai ô số: người mua khóa học nghĩ theo tầm tiền, không theo khoảng chính xác, và hai ô số mở ra bốn trạng thái hỏng (min > max, chữ, số âm, một ô trống) để đổi lấy một tính năng không ai dùng.

`SortSelect` — bốn lựa chọn, nhãn nguyên văn, ánh xạ sang `sort` mà API whitelist:

| Nhãn | `sort` |
|---|---|
| Phổ biến nhất *(mặc định)* | `enrollmentCount:desc` |
| Mới nhất | `publishedAt:desc` |
| Giá thấp đến cao | `priceVnd:asc` |
| Giá cao đến thấp | `priceVnd:desc` |

Không có lựa chọn "Đánh giá cao nhất" chừng nào chưa có module đánh giá thật: sắp xếp theo `ratingAverage` khi số liệu là dữ liệu seed bịa ra chỉ tạo ra một bảng xếp hạng bịa. `sort` không hợp lệ trên URL → dùng mặc định, không báo lỗi.

Số trên nút "Bộ lọc (n)" ở mobile = **số giá trị đang bật**, cộng cả `category` và `level` từng cái một, cộng 1 nếu bậc giá khác "Tất cả". Từ khóa tìm kiếm và sắp xếp **không** tính vào — cả hai đã có control riêng nhìn thấy được ngay trên màn hình.

`PriceTag` **không có** biến thể `free`: cổng publish yêu cầu `priceVnd > 0` (`PLAN_SUPPLEMENT.md` §5), nên không có khóa `PUBLISHED` nào giá 0 để hiển thị. Một khóa 0 đồng không có đường ghi danh nào — `PURCHASE` cần một đơn ZaloPay không tạo được, và `POST /checkout/{slug}` trả `422 COURSE_NOT_PURCHASABLE` cho `priceVnd = 0` — nên nó là một trang bán hàng không có nút mua nào hoạt động. Bộ lọc "miễn phí" cũng không có trong `CourseFilters`.

`PriceTag` biến thể `strikethrough`: giá gốc `compareAtPriceVnd` gạch ngang, cỡ nhỏ hơn một bậc, màu `--color-muted-foreground`, đặt **sau** giá thật; kèm `Badge` `accent` "−{n}%" làm tròn xuống, chỉ hiện khi mức giảm ≥ 5%. Không có `compareAtPriceVnd` thì không có gì cả — không hiện gạch ngang bằng chính giá đang bán. Ba phần tử này mang `aria-label` "Giá gốc {x}, giá hiện tại {y}, giảm {n} phần trăm" để screen reader không đọc ra hai con số trần trụi.

`CourseCard` — bố cục cố định để lưới không bị lệch:

1. Ảnh bìa tỷ lệ 16:9, `object-cover`, `loading="lazy"`, không bìa thì hiện khối `--color-muted` chứa chữ cái đầu của tiêu đề bằng `--font-heading`.
2. Tiêu đề, `--text-xl`, cắt 2 dòng bằng `line-clamp-2`, chiều cao luôn chiếm 2 dòng.
3. `subtitle`, `--text-sm`, `--color-muted-foreground`, `line-clamp-2`. Null thì để trống chỗ đó, không thay bằng đoạn đầu của `description`.
4. Hàng `Rating`: sao + số `4,8` + `(128)`, cộng `Badge` `neutral` "Dữ liệu demo" khi `demoStats === true`. Hàng này có **chiều cao cố định chừa sẵn**, kể cả khi trống. Không ẩn co lại: seed ghi `ratingAverage` 4,4–4,9 và `ratingCount` 35–420 cho khóa demo còn khóa admin tự tạo thì không có gì, nên một lưới ở vòng đầu **có cả hai loại** — quy tắc "mọi card trong lưới phải giống nhau" không tự đúng, phải dựng cho nó đúng. Điều kiện hiện: `ratingCount > 0 && ratingAverage !== null`.
5. Hàng `CourseMeta`: số bài học · tổng thời lượng · `Badge` trình độ (`ALL_LEVELS` → "Mọi trình độ").
6. Chân card: `PriceTag` bên trái, chỗ của `Badge` "Đã đăng ký" bên phải. Badge do island `EnrolledBadge` bật sau khi hydrate, nên ô đó luôn chiếm sẵn chiều cao của một badge — trang công khai là ISR, HTML dùng chung cho mọi người, và một badge trồi ra sau khi tải xong mà không có chỗ sẵn sẽ đẩy cả lưới.

Toàn card là một `<a>` bọc ngoài — không đặt link lồng trong link. Ảnh bìa mang `alt=""` vì tiêu đề ngay bên cạnh đã mô tả nội dung.

### 4.6 Học tập

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `CurriculumAccordion` | `public` (khóa, chỉ mở bài preview) · `player` (điều hướng được) | sidebar 360/400 hoặc full | `d l empty error` | `/courses/[slug]`, trang bài học |
| `CurriculumSection` | — | — | `d h f` + đóng/mở | Trong `CurriculumAccordion` |
| `LessonRow` | `locked` `preview` `playable` `current` `completed` | 44px tối thiểu | `d h f a s x` | Curriculum, `/admin/.../curriculum` |
| `VideoPlayer` | `inline` `preview` | 16:9 | `d l playing paused buffering ended e` | Trang bài học, `PreviewDialog` |
| `LessonContent` | render Markdown đã sanitize | `--container-prose` | `d empty` | Trang bài học, trang pháp lý, `/about` |
| `ResourceList` | — | — | `d l empty error` | Trang bài học |
| `ProgressBar` | `bar` `ring` | `sm` 4px · `md` 8px | `d` + `indeterminate` | Card khóa học của tôi, header player, sidebar |
| `CourseProgressCard` | — | — | `d` | `/my-courses` |
| `CompleteToggle` | `Button` + `Checkbox` | `lg` | `d h f a l s` | Trang bài học |

`LessonRow` hiển thị: icon trạng thái (`circle` chưa xong / `check-circle` đã xong / `lock` chưa có quyền / `play` đang xem), tiêu đề bài, thời lượng, và `Badge` "Học thử" khi `isPreview = true`. Bài `locked` render là `<span aria-disabled="true">` chứ không phải link chết.

`VideoPlayer` là phần tử `<video>` gốc kèm bộ điều khiển tự dựng. Không nạp thư viện player ở vòng đầu: driver demo trả MP4 tiến bộ, driver Cloudflare trả HLS mà Safari/iOS phát được gốc; chỉ khi cần HLS trên Chrome mới nạp `hls.js`, và nạp động chỉ khi `canPlayType('application/vnd.apple.mpegurl')` rỗng. Player phải:

- Gửi `PUT /api/v1/lessons/{lessonId}/progress` body `{ lastPositionSeconds, completed? }` mỗi 15 giây và ở các sự kiện `pause`, `ended`, `visibilitychange → hidden`, gộp lại để không quá 1 request / 5 giây. Là `PUT` chứ không phải `PATCH` — `API_CONTRACT.md` chốt `PUT`, và một `PATCH` vào đúng đường dẫn đó chỉ nhận 404 từ router của Nest. `429` xử lý **y hệt** hàng "Lưu tiến độ thất bại" ở §6.3: giữ tiến độ trong bộ nhớ, chip "Chưa đồng bộ tiến độ", thử lại khi tab quay lại foreground. Không hiện lỗi — người học không làm gì sai.
- Tự tua tới `lastPositionSeconds` khi `loadedmetadata` bắn, trừ khi vị trí đó cách phần cuối dưới 10 giây thì bắt đầu lại từ 0.
- Tự đánh dấu bài hoàn thành khi xem qua 95% thời lượng.
- Xin URL phát mới khi token hết hạn giữa chừng, tối đa 1 lần tự động, thất bại thì rơi vào trạng thái lỗi.

### 4.7 Quản trị

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `DataTable` | `table` (≥768) `cards` (<768) | — | `d l empty error partial` | Mọi bảng admin, phiên đăng nhập, đơn hàng |
| `DataTableToolbar` | tìm kiếm + lọc | — | `d f` | Trên mỗi `DataTable` |
| `StatusBadge` | `DRAFT` `PUBLISHED` `ARCHIVED` `PENDING` `PAID` `REFUND_REQUESTED` `REFUNDED` `CANCELLED` `FAILED` `EXPIRED` `ACTIVE` `REVOKED` `BLOCKED` | `sm` `md` | `d` | Bảng admin, đơn hàng |
| `StatTile` | `plain` `trend` | `md` `lg` | `d l empty` | `/admin`, `/admin/users/[id]`, `TrustStats` |
| `SortableList` | kéo thả + nút lên/xuống | — | `d h f dragging l e` | `/admin/courses/[id]/curriculum` |
| `PublishChecklist` | — | — | `d` + từng mục đạt/chưa đạt | `/admin/courses/[id]`, `PublishDialog` |
| `StickyFormActions` | thanh dính đáy | 64px | `d l x` + "có thay đổi chưa lưu" | Mọi form admin dài |
| `ManualGrantDialog` | `Dialog` dạng form | `md` | `d l e` | `/admin/enrollments`, `/admin/users/[id]` |
| `VideoAssetField` | dán UID + kiểm tra | — | `d l ready processing error` | Editor bài học |
| `ResourceUploader` | `FileDropzone` + danh sách | — | `d l e` | Editor bài học |

`StatusBadge` ánh xạ sang biến thể `Badge` ở §4.1. Bảng này là bắt buộc — không có nó thì mỗi người dựng chọn một màu cho `EXPIRED`:

| Giá trị | Biến thể `Badge` | Chữ hiện ra |
|---|---|---|
| `DRAFT` | `neutral` | Bản nháp |
| `PUBLISHED` | `success` | Đã xuất bản |
| `ARCHIVED` | `neutral` | Đã lưu trữ |
| `ACTIVE` | `success` | Đang hiệu lực |
| `REVOKED` | `destructive` | Đã thu hồi |
| `PENDING` | `warning` | Đang chờ |
| `PAID` | `success` | Đã thanh toán |
| `REFUND_REQUESTED` | `warning` | Đang chờ hoàn tiền |
| `REFUNDED` | `neutral` | Đã hoàn tiền |
| `CANCELLED` | `neutral` | Đã hủy |
| `FAILED` | `destructive` | Thất bại |
| `EXPIRED` | `neutral` | Đã hết hạn |
| `BLOCKED` | `destructive` | Đã khóa |

Bảng này phủ đủ cả năm giá trị `PurchaseStatus` của `DATA_MODEL.md` (`PENDING | PAID | REFUND_REQUESTED | REFUNDED | CANCELLED`) — nếu thiếu một giá trị thì `/account/orders` và `/admin/orders` sẽ có hàng không vẽ được badge nào.

`EXPIRED` là `neutral` chứ không phải `destructive`: hết hạn là kết thúc bình thường của một mã QR, không phải một lỗi ai đó phải xử lý. `REFUNDED` và `CANCELLED` cũng `neutral` vì cả hai là trạng thái cuối bình thường của một đơn, không phải sự cố. `REFUND_REQUESTED` là `warning` vì nó là việc **đang chờ admin xử lý** — cùng nhóm nghĩa với `PENDING`. `REVOKED` thì đúng là `destructive` vì nó là hệ quả của một hành động người khác vừa làm với tài khoản này.

Badge trình độ trên `CourseCard` và `CourseHero` dùng bảng riêng, tất cả đều `neutral` — trình độ không phải trạng thái tốt/xấu, tô màu nó là gán ý nghĩa không có: `BEGINNER` → "Cơ bản", `INTERMEDIATE` → "Trung cấp", `ADVANCED` → "Nâng cao", `ALL_LEVELS` → "Mọi trình độ".

`SortableList` bắt buộc có nút "Lên"/"Xuống" bên cạnh vùng kéo. Kéo thả bằng chuột là đường tắt, không phải cách duy nhất — đây là yêu cầu accessibility, không phải tính năng thêm.

### 4.8 Thanh toán *(thiết kế trước, dựng sau cùng)*

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `OrderSummary` | `checkout` `receipt` | — | `d` | `/checkout/[courseSlug]`, `/account/orders/[id]` |
| `QrPanel` | `zalopay_wallet` `vietqr` | 240px QR | `d l expired e` + đồng hồ đếm ngược | `/checkout/[courseSlug]` |
| `PaymentStatus` | poll trạng thái nội bộ | — | `pending` `paid` `failed` `expired` `unknown` | `/checkout/[courseSlug]`, `/account/orders/[id]` |
| `PaymentResult` | `success` `failed` `expired` | `md` | `d` | Sau khi poll ra kết quả cuối |

### 4.9 Form và dialog theo trang

Các component theo trang được gọi tên ở §2.3 và §3 nhưng không nằm trong bảng nào ở trên. §4 là danh sách thi hành, không phải danh sách tham khảo — thiếu ở đây nghĩa là người dựng tự nghĩ ra trạng thái.

| Component | Biến thể | Kích thước | Trạng thái | Dùng ở |
|---|---|---|---|---|
| `LoginForm` | — | `md` | `d l e` + khóa nút khi `429` | `/login` |
| `RegisterForm` | — | `md` | `d l e` | `/register` |
| `ForgotPasswordForm` | — | `md` | `d l` + `sent` (thay hẳn form bằng `Alert`) | `/forgot-password` |
| `ResetPasswordForm` | — | `md` | `d l e` + `token-invalid` (ẩn form, hiện `ErrorState`) | `/reset-password` |
| `ResendVerificationButton` | `Button` `outline` | `md` | `d h f l x` + đếm ngược 120s | `/verify-email`, banner `(learner)` |
| `ProfileForm` | — | `md` | `d l e` + "có thay đổi chưa lưu" | `/account` |
| `PasswordForm` | — | `md` | `d l e` | `/account/password` |
| `RevokeSessionButton` | `IconButton` `destructive` | `md` | `d h f l x` | `/account/sessions` |
| `RevokeAllSessionsButton` | `Button` `outline` `destructive` | `md` | `d h f l x` (ẩn khi chỉ 1 phiên) | `/account/sessions` |
| `ContactForm` | — | `md` | `d l e` + `sent` | `/contact` |
| `CategoryManager` | danh sách sắp xếp được | — | `d l e` | `/admin/categories` |
| `CategoryDialog` | `create` · `edit` | `sm` | `d l e` | `/admin/categories` |
| `CourseForm` | `create` (3 trường) · `full` | — | `d l e` + "có thay đổi chưa lưu" | `/admin/courses/new`, `/admin/courses/[id]` |
| `PublishDialog` | `Dialog` `default` | `md` | `d l e` (hiện `issues` server trả về) | `/admin/courses/[id]` |
| `ArchiveDialog` | `ConfirmDialog` `neutral` | `sm` | `d l` | `/admin/courses/[id]` |
| `SectionDialog` | `Dialog` `form` | `sm` | `d l e` | `/admin/courses/[id]/curriculum` |
| `LessonDialog` | `Dialog` `form` | `sm` | `d l e` | `/admin/courses/[id]/curriculum` |
| `RevokeDialog` | `ConfirmDialog` `destructive` | `sm` | `d l e` | `/admin/enrollments`, `/admin/users/[id]` |
| `BlockUserDialog` | `ConfirmDialog` `destructive` | `sm` | `d l e` | `/admin/users/[id]` |

Nhãn hai nút của từng dialog — nút chính nhắc lại hành động, không bao giờ là "OK":

| Dialog | Nút chính | Nút phụ |
|---|---|---|
| `PublishDialog` | Xuất bản | Hủy |
| `ArchiveDialog` | Lưu trữ khóa học | Hủy |
| `CategoryDialog` `create` | Tạo danh mục | Hủy |
| `CategoryDialog` `edit` | Lưu thay đổi | Hủy |
| `SectionDialog` | Lưu chương | Hủy |
| `LessonDialog` | Lưu bài học | Hủy |
| `ManualGrantDialog` | Cấp quyền | Hủy |
| `RevokeDialog` | Thu hồi quyền học | Hủy |
| `BlockUserDialog` | Khóa tài khoản | Hủy |
| `ConfirmDialog` xóa chương | Xóa chương | Hủy |
| `ConfirmDialog` xóa bài học | Xóa bài học | Hủy |

---

## 5. Luồng người dùng chính

### 5.1 Khám phá → chi tiết → đăng ký/đăng nhập → ghi danh → học

| # | Màn hình | Hành động | Khi thất bại |
|---|---|---|---|
| 1 | `/` | Gõ từ khóa vào `SearchHero` hoặc chạm một `CategoryChip` | Không tải được danh mục → ẩn hàng chip, ô tìm kiếm vẫn dùng được (giảm cấp, không chặn) |
| 2 | `/courses?q=…` | Lọc theo danh mục, trình độ, giá; sắp xếp | 0 kết quả → `EmptyState` biến thể `search` kèm nút "Xóa bộ lọc". Lỗi mạng → `ErrorState` `network`, giữ nguyên bộ lọc trên URL để "Thử lại" không mất ngữ cảnh |
| 3 | `/courses/[slug]` | Đọc mô tả, mở `CurriculumAccordion`, bấm một bài "Học thử" | Slug không tồn tại hoặc khóa ở `DRAFT` → `not-found.tsx`. Bài preview không phát được → `PreviewDialog` chuyển sang `ErrorState` kèm "Thử lại", phần còn lại của trang vẫn nguyên |
| 4 | `/courses/[slug]` | Bấm `EnrollCta` | Chưa đăng nhập → sang bước 5. Đã có quyền → nhảy thẳng bước 9 |
| 5 | `/login?next=/courses/[slug]` | Điền email và mật khẩu | 401 → `Alert` dưới form: "Email hoặc mật khẩu không đúng." Không nói rõ sai cái nào. 429 → nút khóa kèm đếm ngược. 403 CSRF → tự lấy lại token và gửi lại **một** lần, thất bại thì yêu cầu tải lại trang |
| 6 | `/register` *(nếu người dùng mới)* | Điền tên hiển thị, email, mật khẩu ≥ 8 ký tự | 409 → lỗi ngay tại ô email: "Email này đã được đăng ký." kèm link "Đăng nhập". Lỗi validate → focus vào ô sai đầu tiên |
| 7 | `/verify-email` | Nhận thông báo đã gửi thư | Driver mail ở chế độ demo → `DemoNotice` hiện link xác minh kèm nút sao chép. Đây là cách duy nhất xác minh được trên máy cá nhân |
| 8 | `/courses/[slug]` (quay lại theo `next`) | `EnrollCta` giờ hiện "Liên hệ để đăng ký" (checkout tắt) hoặc "Đăng ký học · giá" (checkout bật) | Checkout tắt → `/contact?course=[slug]`, form gửi `POST /contact` kèm `courseSlug`, thư về hộp thư chủ sở hữu, rồi admin cấp quyền thủ công theo luồng 5.4. Checkout bật → bảng nhánh ở §3.1 |
| 9 | `/learn/[courseSlug]` | Layout tự chuyển hướng tới bài phù hợp | Không có enrollment → về `/courses/[slug]?denied=1`, trang chi tiết hiện `Alert` "Bạn chưa có quyền học khóa này." |
| 10 | `/learn/[courseSlug]/[lessonId]` | Xem video, đọc nội dung, bấm "Đánh dấu hoàn thành và học tiếp" | Không lấy được URL phát → `ErrorState` trong khung player, nội dung chữ và tài liệu vẫn đọc được. Lưu tiến độ thất bại → giữ tiến độ trong bộ nhớ, hiện chip "Chưa đồng bộ tiến độ", tự thử lại khi có mạng |

### 5.2 Học viên quay lại khóa đang học dở

| # | Màn hình | Hành động | Khi thất bại |
|---|---|---|---|
| 1 | Bất kỳ | Bấm "Khóa học của tôi" trên header | Cookie phiên hết hạn → `/login?next=/my-courses`, sau khi đăng nhập quay đúng chỗ |
| 2 | `/my-courses` | Tab "Đang học" mở sẵn, khóa sắp theo lần học gần nhất | Chưa có enrollment nào → `EmptyState` "Bạn chưa có khóa học nào" + nút "Xem danh sách khóa học". Lỗi tải → `ErrorState` `server` + "Thử lại" |
| 3 | `/my-courses` | Bấm "Tiếp tục học" trên `CourseProgressCard` | Khóa đã bị `ARCHIVED` → vẫn vào học được; hiện `Alert` info "Khóa học này đã ngừng nhận học viên mới. Bạn vẫn học được đầy đủ." |
| 4 | `/learn/[courseSlug]` | Server đọc `LessonProgress`, `redirect` tới bài chưa hoàn thành đầu tiên | Toàn bộ bài đã xong → chuyển tới bài **cuối cùng** kèm `Toast` "Bạn đã hoàn thành khóa học này." |
| 5 | `/learn/[courseSlug]/[lessonId]` | Player tự tua tới `lastPositionSeconds` khi có metadata | Vị trí lưu vượt quá thời lượng video (video được thay) → bắt đầu từ 0, không báo lỗi |
| 6 | Trang bài học | `CurriculumAccordion` tự mở chương chứa bài hiện tại và cuộn bài đó vào tầm nhìn | Curriculum lỗi tải → sidebar hiện `ErrorState` `sm`, `LessonNav` Trước/Sau vẫn cho đi tiếp |

### 5.3 Admin dựng một khóa học từ rỗng tới xuất bản

| # | Màn hình | Hành động | Khi thất bại |
|---|---|---|---|
| 1 | `/admin/courses` | Bấm "Tạo khóa học" | Chưa có khóa nào → `EmptyState` `create` chiếm cả bảng |
| 2 | `/admin/courses/new` | Nhập tiêu đề; slug tự sinh từ tiêu đề đã bỏ dấu, sửa được | Slug trùng → lỗi ngay tại ô: "Đường dẫn này đã được dùng." kèm nút "Dùng {slug}-2" |
| 3 | `/admin/courses/[id]` | Điền tóm tắt, mô tả Markdown, danh mục, trình độ, giá, ảnh bìa | Upload ảnh lỗi → `FileDropzone` giữ file, hiện "Tải ảnh thất bại." + nút "Thử lại". Form không mất dữ liệu |
| 4 | `/admin/courses/[id]/curriculum` | "Thêm chương" → `SectionDialog` → nhập tiêu đề | Trùng `position` → server tự đẩy xuống cuối, không báo lỗi cho người dùng |
| 5 | Cùng trang | "Thêm bài học" trong một chương → `LessonDialog` | — |
| 6 | `/admin/courses/[id]/lessons/[lessonId]` | Soạn nội dung Markdown, dán Cloudflare UID vào `VideoAssetField`, bật `Switch` học thử cho ít nhất một bài | UID sai → "Không tìm thấy video với mã này." Video đang encode → `StatusBadge` `warning` "Đang xử lý", cho lưu nhưng chặn xuất bản |
| 7 | `/admin/courses/[id]/curriculum` | Kéo hoặc dùng nút Lên/Xuống để sắp thứ tự | Lưu thứ tự thất bại → danh sách trả về thứ tự cũ + `Toast` lỗi. Không để giao diện và server lệch nhau |
| 8 | `/admin/courses/[id]` | Đọc `PublishChecklist` | Mục nào chưa đạt thì có link nhảy thẳng tới nơi sửa |
| 9 | `PublishDialog` | Bấm "Xuất bản" | Server validate lại và có thể từ chối; dialog hiện đúng mục nào hỏng. Không tin checklist phía client |
| 10 | `/admin/courses` | `StatusBadge` đổi sang `PUBLISHED`, `Toast` "Đã xuất bản khóa học." kèm nút "Xem trang công khai" → `<Link href="/courses/{slug}">` thường | Publish thành công thì Server Action gọi `revalidatePath('/courses/[slug]', 'page')`, `revalidatePath('/courses')` và `revalidatePath('/')` **trước khi** trả về; sau đó trang công khai đã mới |

Không có `?preview=1`. Query string **không** bỏ qua được cache route của App Router: trang đã prerender được đánh khóa theo pathname và Next trả HTML đã cache bất kể tham số, còn trên một route `ISR 300` có `generateStaticParams` thì đọc `searchParams` phía server lại chính là thứ ép route sang dynamic. `API_CONTRACT.md` cũng đã bỏ hẳn `?preview=` ở phía API. Xem trước nội dung chưa xuất bản đi bằng đường khác: admin mở `/learn/{slug}` và dùng nhánh bypass theo vai trò (§2.3).

`PublishChecklist` — server là nơi quyết định, mọi mục đều bắt buộc. Checklist client phải phản chiếu **đúng** điều kiện publish phía server; lệch một mục là màn hình báo đủ rồi server từ chối:

| Mục | Điều kiện |
|---|---|
| Thông tin cơ bản | có `title`, `slug` duy nhất, `categoryId`, `level` |
| Bạn sẽ học được gì | `learningOutcomes` ≥ 1 mục |
| Mô tả | `description` ≥ 200 ký tự sau khi cắt khoảng trắng |
| Giá | `priceVnd` là số nguyên **`> 0`** |
| Ảnh bìa | đã có `coverImageKey`, ảnh tối thiểu 1280×720 |
| Chương trình học | ≥ 1 `Section`, mỗi `Section` ≥ 1 `Lesson` |
| Video | mọi `Lesson` kiểu `VIDEO` có `VideoAsset.status = READY` |
| Nội dung bài đọc | mọi `Lesson` kiểu `ARTICLE` có `content` không rỗng |
| Học thử | ≥ 1 `Lesson` có `isPreview = true` |

Hai điểm mà checklist client **không được** chặt hơn server, vì lệch một mục là màn hình báo chưa đủ trong khi server vẫn cho publish:

- **`subtitle` không nằm trong "Thông tin cơ bản".** `DATA_MODEL.md` để `Course.subtitle` nullable và không liệt kê nó trong luật publish, còn tập `issues[].field` đóng của `API_CONTRACT.md` §5.3 không có giá trị nào cho nó — nghĩa là không có `issue` nào để tô đỏ. Ô `subtitle` vẫn có trong form và vẫn nên điền; nó chỉ không phải điều kiện xuất bản.
- **Giá là `> 0`, không phải `≥ 0`.** Cổng publish từ chối `priceVnd = 0` (`PLAN_SUPPLEMENT.md` §5); `CHECK (price_vnd >= 0)` ở tầng database là chuyện khác, nó chỉ chặn giá âm.

Khi server trả `422 COURSE_NOT_PUBLISHABLE`, `PublishDialog` không hiện một câu chung chung: nó nhận mảng `issues` (mỗi phần tử có `field` và `reason`, có thể kèm `lessonId`) và tô đỏ đúng những mục tương ứng trong chính checklist đó, mỗi mục kèm link nhảy tới nơi sửa. Chín mục trên ánh xạ một-một sang tập `field` đóng `coverImageKey | description | priceVnd | categoryId | learningOutcomes | sections | lessons | videoAsset | previewLesson`.

### 5.4 Admin cấp quyền học thủ công

Đây là con đường duy nhất để người dùng demo có quyền học trước khi thanh toán được dựng. Nó phải chạy được ngay từ vòng đầu.

| # | Màn hình | Hành động | Khi thất bại |
|---|---|---|---|
| 1 | `/admin/enrollments` | Bấm "Cấp quyền học" | — |
| 2 | `ManualGrantDialog` | Gõ email học viên vào ô có gợi ý; chọn khóa học từ `Select` (chỉ khóa `PUBLISHED` và `ARCHIVED`); nhập ghi chú — **không bắt buộc, tối đa 500 ký tự**, đi vào `AuditLog.metadata` | Email chưa tồn tại → "Không tìm thấy tài khoản với email này. Học viên cần tự đăng ký trước." Không có link tạo tài khoản: không có route `/admin/users/new`, và `/admin/users` là trang danh sách chỉ đọc |
| 3 | `ManualGrantDialog` | Bấm "Cấp quyền" | Đã có enrollment active → dialog chuyển sang `Alert` `info`: "Học viên này đã có quyền học khóa đó từ {ngày}." Nút đổi thành "Đóng". Không tạo bản ghi trùng |
| 4 | `/admin/enrollments` | Hàng mới xuất hiện ở đầu bảng với `StatusBadge` `ACTIVE` và cột Nguồn = "Cấp thủ công". `Toast` "Đã cấp quyền học cho {email}." | Lỗi server → dialog vẫn mở, giữ nguyên dữ liệu đã nhập, hiện `Alert` `destructive` |
| 5 | Phía học viên | Khóa học xuất hiện ở `/my-courses` ngay lần tải trang sau | Học viên đang mở sẵn `/my-courses` → không có push; họ thấy sau khi tải lại. Chấp nhận được, không dựng realtime |

Thu hồi quyền đi ngược cùng luồng qua `RevokeDialog`, và đặt `Enrollment.status = REVOKED` chứ không xóa bản ghi. `RevokeDialog` **không có ô lý do**: `DELETE /admin/enrollments/{id}` không nhận body, và API chạy `ValidationPipe` với `forbidNonWhitelisted: true` — gửi thêm một trường vào đó không bị bỏ qua, nó trả `400`. Dấu vết ai thu hồi và lúc nào đã có trong `AuditLog` mà endpoint tự ghi. Dialog chỉ có một câu: "Thu hồi quyền học của {email} với khóa {title}? Học viên sẽ mất quyền truy cập ngay lập tức. Tiến độ học được giữ lại."

### 5.5 Checkout *(thiết kế trước, dựng sau cùng)*

Chỉ đặc tả màn hình. Hợp đồng ZaloPay đã chốt ở PROJECT_PLAN mục "Thiết kế thanh toán ZaloPay" và không lặp lại ở đây.

| # | Màn hình | Nội dung màn hình | Khi thất bại |
|---|---|---|---|
| 1 | `/courses/[slug]` | `EnrollCta` "Đăng ký học · 499.000 ₫" → `POST /checkout/{slug}` → `push('/checkout/{slug}')` | Bốn nhánh lỗi ở bảng §3.1 |
| 2 | `/checkout/[courseSlug]` | Hai cột ≥1024px: trái là `QrPanel` + đồng hồ đếm ngược, phải là `OrderSummary`. Dưới 1024px xếp dọc, QR lên trên | Chưa tạo được QR → `ErrorState` `server` + "Tạo lại mã QR" |
| 3 | Cùng màn | `PaymentStatus` hiện "Đang chờ thanh toán", có `Spinner`, poll trạng thái **nội bộ** mỗi 3 giây, giãn dần lên 10 giây sau 1 phút | Poll lỗi 3 lần liên tiếp → đổi sang trạng thái `unknown`: "Chưa xác nhận được trạng thái. Bấm để kiểm tra lại." Tuyệt đối không tự tuyên bố thành công |
| 4 | Cùng màn | QR hết hạn → `QrPanel` mờ đi, phủ nút "Tạo mã QR mới" | Người dùng đã thanh toán bằng QR cũ → trạng thái vẫn về `paid` khi callback tới; màn hình chuyển sang bước 5 |
| 5 | Cùng màn | `PaymentResult` `success`: dấu tick, "Bạn đã có quyền học khóa này." CTA chính "Vào học ngay", phụ "Xem đơn hàng" | — |
| 6 | `/account/orders/[id]` | Biên nhận: `OrderSummary` `receipt`, mã đơn, thời điểm, phương thức | Thất bại/hết hạn → `PaymentResult` tương ứng + nút "Thử lại" tạo `PaymentAttempt` mới |

### 5.6 Đăng xuất

Một mục menu, không phải một luồng — nhưng nó là chức năng bắt buộc trong PROJECT_PLAN và trước bản này không có ở đâu trong tài liệu.

| # | Chỗ nào | Hành động | Khi thất bại |
|---|---|---|---|
| 1 | Mục cuối `UserMenu` (và đáy `MobileNav`) | Bấm "Đăng xuất" | **Không có `ConfirmDialog`.** Đăng xuất là thao tác đảo ngược được bằng một lần đăng nhập; hỏi lại là thuế đánh lên mọi lần dùng để chặn một cú bấm nhầm vô hại |
| 2 | Island trong header | `POST /api/v1/auth/logout` — cùng origin qua rewrite, nên server xóa được cả hai cookie bằng `Set-Cookie` | `401` (phiên đã chết sẵn) coi như thành công, đi tiếp bước 3 |
| 3 | Sau khi xong | `router.replace('/')` rồi `router.refresh()` để vỏ header render lại ở trạng thái `guest`; `Toast` `success` "Đã đăng xuất." | Lỗi mạng → `Toast` `error` "Không đăng xuất được. Kiểm tra kết nối rồi thử lại." Không xóa trạng thái ở client khi server chưa xác nhận — cookie vẫn còn, và một giao diện nói "đã đăng xuất" trên một phiên còn sống là lời nói dối nguy hiểm nhất trong nhóm này |
| 4 | Nếu đang ở trang cần đăng nhập | Vẫn về `/` chứ không ở lại rồi bị đá sang `/login`. Không kèm `?next=` — người vừa chủ động đăng xuất không đang trên đường đi đâu cả | — |

### 5.7 Thao tác quản trị còn lại

PROJECT_PLAN đòi "xem trước, publish và archive" và "khóa tài khoản". Publish đã ở §5.3; bốn thao tác còn lại đặc tả ở đây.

| Thao tác | Chỗ đặt nút | Luồng | Ràng buộc |
|---|---|---|---|
| Xem trước | `/admin/courses/[id]`, nút `outline` "Xem trước" cạnh "Xuất bản" | Mở `/learn/{slug}` ở tab mới. Layout player bỏ qua kiểm tra enrollment khi `role === 'ADMIN'` (§2.3) và hiện banner "Bạn đang xem trước với quyền quản trị." | Chỉ `ADMIN`. Không có token preview, không có query param — quyền đến từ vai trò, không từ URL, nên không có gì để chuyển tiếp cho người khác |
| Lưu trữ | `/admin/courses/[id]`, nút `outline` trong nhóm hành động phụ | `ArchiveDialog`: **"Lưu trữ khóa học"** / "Khóa học sẽ biến mất khỏi danh sách công khai và không nhận học viên mới. Học viên đang học vẫn học tiếp được đầy đủ." → `POST /admin/courses/{id}/archive` → `Toast` "Đã lưu trữ khóa học." | Khóa `ARCHIVED` hiện nút "Bỏ lưu trữ" ở cùng chỗ, gọi `POST /admin/courses/{id}/unpublish` rồi quay về `DRAFT` — không nhảy thẳng lại `PUBLISHED`, vì checklist phải chạy lại |
| Xóa chương / bài / khóa | Menu ba chấm trên từng hàng | `ConfirmDialog` `destructive`, nhắc lại tên đối tượng trong câu hỏi | Server chặn trước: xóa chương còn bài → `409 SECTION_NOT_EMPTY` → `Alert` trong dialog "Xóa hết bài học trong chương trước đã."; xóa khóa đã có học viên → `409 COURSE_HAS_ENROLLMENTS` → `Alert` "Không xóa được: khóa học đã có học viên." kèm gợi ý "Lưu trữ" thay vì xóa. Xóa bài học **xóa luôn `LessonProgress`** của mọi học viên — dialog nói thẳng: "Tiến độ của {n} học viên với bài này sẽ bị xóa." |
| Khóa tài khoản | `/admin/users/[id]`, nút `destructive` | `BlockUserDialog`: **không có ô lý do** — `PATCH /admin/users/{id}` chỉ nhận `status`, và `forbidNonWhitelisted: true` biến một trường thừa thành `400`. Dialog nêu hệ quả: "Khóa tài khoản {email}? Mọi phiên đăng nhập của người này bị đăng xuất ngay và họ không đăng nhập lại được." → `Toast` "Đã khóa tài khoản {email}." | Không tự khóa được chính mình: `409 SELF_ACTION_FORBIDDEN` → `Alert` trong dialog "Bạn không thể khóa tài khoản của chính mình." Bỏ khóa dùng cùng dialog với `status = ACTIVE`. Ai khóa và lúc nào đã nằm trong `AuditLog` do endpoint tự ghi |

---

## 6. Đặc tả trạng thái

Bốn trạng thái là bắt buộc cho mọi bề mặt có dữ liệu: loading, empty, error, giảm cấp. Microcopy dưới đây là chuỗi thật, dùng nguyên văn.

### 6.1 Quy tắc chung

- Skeleton phải cùng kích thước với nội dung thật. Sai kích thước gây nhảy layout, tệ hơn là không có skeleton.
- Skeleton chỉ dùng cho lần tải đầu. Khi lọc lại hay đổi trang, giữ nội dung cũ ở `opacity: 0.6` kèm `aria-busy="true"` — người dùng không mất chỗ đang nhìn.
- `EmptyState` luôn có CTA. Trạng thái rỗng không có lối ra là ngõ cụt.
- `ErrorState` luôn nói được cái gì hỏng và làm gì tiếp. Không bao giờ hiện mã lỗi thô hay stack trace.
- Skeleton mang `aria-hidden="true"`; vùng chứa mang `aria-busy="true"` và một `<span class="sr-only">Đang tải…</span>`.

### 6.2 Bảng trạng thái theo bề mặt

| Bề mặt | Loading | Empty | Error |
|---|---|---|---|
| `CourseGrid` (`/courses`, `/categories/[slug]`) | 12 khối `CourseCard`: ảnh 16:9, 2 dòng tiêu đề, 2 dòng tóm tắt, 1 dòng meta | Không lọc: **"Chưa có khóa học nào"** / "Khóa học đầu tiên sẽ xuất hiện ở đây ngay khi được xuất bản." → "Về trang chủ".<br>Có lọc: **"Không tìm thấy khóa học phù hợp"** / "Thử bỏ bớt bộ lọc hoặc dùng từ khóa ngắn hơn." → "Xóa bộ lọc" | **"Không tải được danh sách khóa học"** / "Đường truyền hoặc máy chủ đang có sự cố." → "Thử lại" |
| Khóa nổi bật ở `/` | 4 khối card | Ẩn cả section, không hiện khối rỗng ở trang chủ | Ẩn cả section, ghi log. Trang chủ không được vỡ vì một section |
| `CourseHero` | Khối 16:9 + 2 dòng tiêu đề + 1 dòng meta + khối nút | — | Trang đã 404 ở tầng trên, không có trạng thái riêng |
| `CurriculumAccordion` | 3 header chương + 4 dòng bài mỗi chương | **"Chương trình học đang được cập nhật"** / "Nội dung sẽ có sớm." | **"Không tải được chương trình học"** → "Thử lại" |
| `VideoPlayer` | Poster mờ + `Spinner` giữa khung + `ProgressBar` `indeterminate` | — | Token hết hạn: **"Phiên xem đã hết hạn"** / "Tải lại trang để tiếp tục." → "Tải lại trang".<br>Video chưa sẵn sàng: **"Video đang được xử lý"** / "Bài học sẽ xem được sau vài phút." → "Kiểm tra lại".<br>Lỗi khác: **"Không phát được video"** / "Kiểm tra kết nối rồi thử lại." → "Thử lại" |
| `LessonContent` | 6 dòng chữ độ dài lệch nhau | **"Bài học này chưa có nội dung chữ"** / "Xem video ở phía trên." | **"Không tải được nội dung bài học"** → "Thử lại" |
| `ResourceList` | 2 dòng có icon | Ẩn hoàn toàn cả khối tài liệu | **"Không tải được tài liệu"** → "Thử lại" |
| `/my-courses` | 3 khối `CourseProgressCard` | Tab Đang học: **"Bạn chưa có khóa học nào"** / "Khi bạn được cấp quyền học, khóa học sẽ xuất hiện tại đây." → "Xem danh sách khóa học".<br>Tab Đã xong: **"Bạn chưa hoàn thành khóa học nào"** / "Hoàn thành hết bài trong một khóa để nó xuất hiện ở đây." → "Về mục Đang học" | **"Không tải được khóa học của bạn"** → "Thử lại" |
| `/account/orders` | 5 hàng skeleton | **"Bạn chưa có đơn hàng nào"** / "Đơn hàng sẽ xuất hiện ở đây sau lần đăng ký học đầu tiên." → "Xem danh sách khóa học" | **"Không tải được lịch sử đơn hàng"** → "Thử lại" |
| `/account/sessions` | 3 hàng skeleton | Không thể rỗng — luôn có phiên hiện tại | **"Không tải được danh sách phiên đăng nhập"** → "Thử lại" |
| `/admin` `StatTile` | Khối số 32px + nhãn | Số 0 hiện là `0`, không phải trạng thái rỗng | Ô đó hiện `—` kèm `Tooltip` "Không tải được số liệu". Các ô khác vẫn hiển thị |
| `/admin/categories` | 8 hàng skeleton | **"Chưa có danh mục nào"** / "Tạo danh mục đầu tiên để phân loại khóa học." → "Thêm danh mục" | **"Không tải được danh mục"** → "Thử lại" |
| `/admin/courses` | 8 hàng bảng | **"Chưa có khóa học nào"** / "Tạo khóa học đầu tiên để bắt đầu." → "Tạo khóa học" | **"Không tải được danh sách"** → "Thử lại" |
| `/admin/courses/[id]/curriculum` | 2 chương + 3 bài | **"Khóa học chưa có chương nào"** / "Thêm chương đầu tiên rồi thêm bài học vào đó." → "Thêm chương" | **"Không tải được chương trình học"** → "Thử lại" |
| `/admin/users` | 8 hàng bảng | **"Chưa có người dùng nào"** / "Người dùng sẽ xuất hiện sau khi có người đăng ký." | **"Không tải được danh sách người dùng"** → "Thử lại" |
| `/admin/enrollments` | 8 hàng bảng | **"Chưa cấp quyền học cho ai"** / "Cấp quyền thủ công để học viên vào học ngay." → "Cấp quyền học" | **"Không tải được danh sách quyền học"** → "Thử lại" |
| `/admin/audit-logs` | 10 hàng bảng | **"Chưa có hoạt động nào được ghi lại"** | **"Không tải được nhật ký"** → "Thử lại" |
| `QrPanel` *(sau)* | Khối vuông 240px + 2 dòng | — | **"Không tạo được mã QR"** / "Thử lại sau ít phút hoặc liên hệ hỗ trợ." → "Tạo lại mã QR" |
| Kết quả `SearchInput` | `Spinner` `sm` trong ô, giữ nguyên kết quả cũ | **"Không có kết quả cho \"{q}\""** / "Thử từ khóa ngắn hơn hoặc bỏ dấu." → "Xóa tìm kiếm" | Chip inline: "Tìm kiếm lỗi. Thử lại." |

### 6.3 Trạng thái giảm cấp và một phần

| Tình huống | Xử lý | Microcopy |
|---|---|---|
| `ratingCount = 0` hoặc `ratingAverage = null` | Ẩn nội dung `Rating` nhưng **giữ nguyên ô cao cố định** của nó (§4.5 quy tắc 4), vì cùng một lưới có cả khóa seed có sao lẫn khóa mới không có. Không hiện "0 sao" hay "Chưa có đánh giá" — cả hai đều làm khóa học trông tệ | — |
| `demoStats = true` | `Badge` `neutral` "Dữ liệu demo" **chỉ ngay cạnh cụm sao**, ở cả card lẫn hero — **không** cạnh số học viên: `enrollmentCount` là số thật ở mọi thời điểm (DATA_MODEL.md §Quy tắc nhãn dữ liệu demo quy tắc 2 và 4). Không dùng màu `destructive`: đây là chú thích, không phải cảnh báo lỗi. `aria-label`: "Điểm đánh giá là dữ liệu demo". Cụm sao bị ẩn thì badge cũng không render — nhãn tồn tại để đi kèm con số | "Dữ liệu demo" |
| Thiếu ảnh bìa | Khối `--color-muted` với chữ cái đầu của tiêu đề bằng `--font-heading` 48px, màu `--color-muted-foreground-strong` | — |
| Bài học chỉ có chữ | Ẩn khung player, `LessonContent` chiếm toàn bộ bề rộng, hàng meta ghi "Bài đọc" | — |
| Video đang encode ở trang public | `LessonRow` mang `Badge` `warning`; bấm vào không mở gì | "Đang chuẩn bị" |
| Lưu tiến độ thất bại | Giữ tiến độ trong bộ nhớ, thử lại khi tab quay lại foreground, hiện chip cạnh `ProgressBar` | "Chưa đồng bộ tiến độ" |
| Mất kết nối khi đang học | `Alert` `warning` dính đầu trang; video đã đệm vẫn xem tiếp được | "Mất kết nối mạng. Tiến độ sẽ được lưu khi có mạng trở lại." |
| Có kết nối trở lại | `Toast` `success` 3 giây | "Đã đồng bộ tiến độ." |
| Bảng admin lọc lỗi nhưng còn dữ liệu cũ | Giữ hàng cũ ở `opacity: 0.6` + `Alert` `inline` phía trên bảng | "Không cập nhật được danh sách. Đang hiển thị dữ liệu cũ." → "Thử lại" |
| Phiên hết hạn giữa thao tác (401) | `Toast` `error` không tự đóng + chuyển tới `/login?next=` sau 2 giây | "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." |
| CSRF không hợp lệ (403) | Tự lấy lại token và gửi lại **một** lần; thất bại thì hiện `Alert` | "Không thực hiện được thao tác. Tải lại trang rồi thử lại." |
| Quá số lần thử (429) | Khóa nút và đếm ngược | "Bạn đã thử quá nhiều lần. Vui lòng đợi {n} phút rồi thử lại." |
| Tài khoản bị khóa lúc đăng nhập | Trả cùng `401 INVALID_CREDENTIALS` như sai mật khẩu để không lộ trạng thái tài khoản | "Email hoặc mật khẩu không đúng." |
| Driver ngoài đang ở chế độ demo | `DemoNotice` `banner` màu `info`, chỉ hiện khi `NODE_ENV !== 'production'` | "Đang chạy ở chế độ demo. Thanh toán, email và video dùng bản giả lập trên máy." |

### 6.4 Lỗi form — khớp đúng ràng buộc phía server

Các thông báo dưới đây khớp một-một với DTO trong `apps/api/src/auth/auth.controller.ts`. Client validate cùng luật để người dùng biết trước khi gửi; server vẫn là nơi quyết định.

| Trường | Ràng buộc server | Microcopy |
|---|---|---|
| `email` | `IsEmail`, tối đa 320 ký tự | Rỗng: "Nhập email của bạn." · Sai định dạng: "Email không hợp lệ." · Quá dài: "Email không được quá 320 ký tự." |
| `password` (đăng nhập) | `IsString`, 8–128 | Rỗng: "Nhập mật khẩu." |
| `password` (đăng ký) | `IsString`, 8–128 | "Mật khẩu cần ít nhất 8 ký tự." · "Mật khẩu không được quá 128 ký tự." |
| `displayName` | `Length(2, 80)`, tự cắt khoảng trắng | "Nhập tên hiển thị." · "Tên hiển thị cần từ 2 đến 80 ký tự." |
| Xác nhận mật khẩu (chỉ ở client) | trùng `password` | "Hai mật khẩu chưa khớp." |
| Ghi chú cấp quyền | `@MaxLength(500) @IsOptional` | Nhãn: "Ghi chú (không bắt buộc, tối đa 500 ký tự)" · Quá dài: "Ghi chú không được quá 500 ký tự." |
| Nội dung liên hệ | `@Length(10, 2000)` | "Viết ít nhất 10 ký tự." · "Nội dung không được quá 2.000 ký tự." |
| `subtitle` khóa học | `@MaxLength(240)` | "Dòng mô tả không được quá 240 ký tự." |
| Mục trong `TagListInput` | ≤ 12 mục, mỗi mục ≤ 200 ký tự | "Tối đa 12 mục." · "Mỗi mục không được quá 200 ký tự." · "Mục này đã có trong danh sách." |
| Giá khóa học | số nguyên ≥ 0, ≤ 100.000.000 | "Giá phải là số nguyên, không có phần thập phân." · "Giá không được quá 100.000.000 ₫." |
| Giá gạch ngang | `compareAtPriceVnd > priceVnd` | "Giá gạch ngang phải lớn hơn giá bán." |
| Slug | duy nhất, `[a-z0-9-]` | "Đường dẫn chỉ gồm chữ thường không dấu, số và dấu gạch ngang." · "Đường dẫn này đã được dùng." |

Bốn lỗi của `FileDropzone`. Chúng nằm ở đây vì cùng một luật: chuỗi phải khớp ràng buộc server, và con số phải là con số thật, không phải `{n}`:

| Tình huống | Microcopy |
|---|---|
| Sai định dạng ảnh bìa | "Chỉ nhận ảnh JPG, PNG hoặc WebP." |
| Quá dung lượng | "Tệp không được lớn hơn 50 MB." |
| Ảnh bìa nhỏ hơn 1280×720 | "Ảnh bìa cần tối thiểu 1280×720 pixel." |
| Upload thất bại | "Tải tệp thất bại." → nút "Thử lại". Giữ nguyên tệp đã chọn, không bắt chọn lại |

Form có từ 2 lỗi trở lên khi bấm gửi: hiện `Alert` `destructive` ở đầu form, tiêu đề "Vui lòng kiểm tra lại {n} trường", thân là danh sách link nhảy tới từng ô sai. Focus chuyển vào ô sai đầu tiên.

### 6.5 Hai trang tiêu thụ token

`/verify-email` và `/reset-password` nhận `?token=` rồi gọi API một lần. Cả hai có **ba** trạng thái kết thúc, không phải bốn: `AuthToken` có `consumedAt` nên phía database phân biệt được "hết hạn" với "đã dùng", nhưng API cố tình gộp cả ba nguyên nhân (sai, hết hạn, đã dùng) vào đúng một mã `400 TOKEN_INVALID` để không biến trang này thành công cụ dò token. Giao diện không được đoán ra nhánh mà server từ chối nói.

| Trạng thái | Khi nào | Màn hình |
|---|---|---|
| Đang xử lý | Ngay khi vào trang có token | `Spinner` `block` + "Đang xác minh…" (`/verify-email`) hoặc form khóa (`/reset-password`). Không chớp trạng thái lỗi trước khi có câu trả lời |
| Thiếu token | URL không có `?token=`, hoặc token không dài 32–200 ký tự | **Không gọi API.** `ErrorState` `notfound`: **"Liên kết không hợp lệ"** / "Mở lại liên kết trong email, hoặc xin một liên kết mới." → `/verify-email`: "Gửi lại email xác minh" · `/reset-password`: "Xin liên kết mới" → `/forgot-password` |
| Bị từ chối (`400 TOKEN_INVALID`) | Sai, hết hạn, hoặc đã dùng rồi | `ErrorState` `expired`: **"Liên kết đã hết hạn hoặc đã được dùng"** → cùng hai nút như trên. Câu phụ **khác nhau theo trang**, vì hai loại token có hai hạn dùng khác nhau (§3.2): `/verify-email` ghi "Liên kết chỉ dùng được một lần và có hạn 24 giờ."; `/reset-password` ghi "Liên kết chỉ dùng được một lần và có hạn 60 phút." Tiêu đề lấy nguyên văn từ bảng mã lỗi của `API_CONTRACT.md`; một chuỗi dùng chung cho cả hai trang là sai ở một trong hai |
| Thành công | `204` | `/verify-email`: `Alert` `success` **"Email đã được xác minh"** / "Bạn có thể bắt đầu học ngay." → "Về khóa học của tôi" (`/my-courses`).<br>`/reset-password`: `Alert` `success` **"Đã đặt lại mật khẩu"** / "Mọi phiên đăng nhập cũ đã bị đăng xuất. Đăng nhập lại bằng mật khẩu mới." → "Đăng nhập" (`/login`) |
| `429` | Bấm gửi lại quá nhiều | Theo hàng "Quá số lần thử" ở §6.3 |

Người đã đăng nhập mà mở lại liên kết xác minh của một tài khoản đã xác minh vẫn rơi vào nhánh "bị từ chối" — đúng như server thấy. Không dựng một nhánh "đã xác minh trước đó" riêng: nó đòi một câu trả lời mà API không đưa ra, và cái giá của việc đoán sai là nói với người dùng rằng mọi thứ ổn trong khi token của họ vừa bị ai đó dùng mất.

### 6.6 Trang lỗi toàn cục

Ba file ở gốc cây route và một file cục bộ. Chuỗi dưới đây là nguyên văn:

| File | Khi nào | Nội dung |
|---|---|---|
| `not-found.tsx` | Đường dẫn không khớp route nào, hoặc `notFound()` ở khu admin | **"Không tìm thấy trang này"** / "Đường dẫn có thể đã đổi hoặc không còn tồn tại." → "Về trang chủ" (`primary`) + "Xem danh sách khóa học" (`outline`) |
| `courses/[slug]/not-found.tsx` | Slug không tồn tại, hoặc khóa ở `DRAFT`/`ARCHIVED` | **"Khóa học không tồn tại"** / "Khóa học có thể đã được gỡ hoặc chưa xuất bản." → "Xem danh sách khóa học" |
| `error.tsx` | Lỗi runtime trong một route | **"Đã xảy ra lỗi"** / "Thử lại giúp bạn trong hầu hết trường hợp." → "Thử lại" (gọi `reset()`) + "Về trang chủ". Dưới cùng, cỡ `--text-xs` `--color-muted-foreground`: mã tra cứu `X-Request-Id` kèm nút sao chép — đó là mã tra cứu, không phải mã lỗi thô |
| `global-error.tsx` | Lỗi trong chính root layout | Tự render `<html lang="vi">` và `<body>` riêng, không dùng token của app (globals.css có thể chính là thứ hỏng): nền trắng, chữ đen, một câu **"Đã xảy ra lỗi"** / "Tải lại trang giúp bạn trong hầu hết trường hợp." → một nút "Tải lại trang" |

Cả bốn dùng `ErrorState` `md` (trừ `global-error.tsx`), có `<h1>`, nhận focus theo luật §8.3, và **không** hiện stack trace kể cả ở `NODE_ENV=development` — bảng điều khiển của trình duyệt đã có nó.

---

## 7. Responsive

### 7.1 Bố cục nền theo khung

| Bề mặt | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Header | Logo + nút menu; tìm kiếm là icon mở overlay | Logo + tìm kiếm + `UserMenu`; nav trong drawer | Nav đầy đủ nằm ngang, ô tìm kiếm rộng 320px | Như 1024, container 1280px |
| Hero trang chủ | 1 cột, h1 36px, ô tìm kiếm full | 1 cột, h1 48px, ô tìm kiếm 560px | 2 cột 60/40 kèm minh họa | Như 1024 |
| `CourseGrid` | 1 cột | 2 cột | 3 cột | 4 cột |
| `CategoryChips` | Cuộn ngang, không xuống dòng, có gradient báo còn nội dung | Cuộn ngang | Xuống dòng | Xuống dòng |
| `CourseFilters` | Nút "Bộ lọc (2)" mở `Drawer` `bottom` — số trong ngoặc đếm theo luật ở §4.5 | Nút mở `Drawer` `left` | Sidebar dính 264px bên trái | Như 1024 |
| `/courses/[slug]` | 1 cột; `EnrollCta` thành thanh dính đáy màn hình | 1 cột; hộp giá nằm sau phần mô tả | 2 cột: nội dung + hộp giá dính 360px bên phải | 2 cột, hộp giá 380px |
| Footer | 1 cột, các nhóm link là accordion | 2 cột | 4 cột | 4 cột |
| `/my-courses` | 1 cột card | 2 cột | 3 cột | 3 cột, card rộng hơn |
| `AdminSidebar` | `Drawer` mở bằng nút trong header | `icon-only` 64px | `expanded` 240px | `expanded` 240px |
| Form admin | 1 cột, `StickyFormActions` dính đáy | 1 cột rộng hơn | 2 cột: form + cột phụ (`PublishChecklist`, meta) | Như 1024 |

### 7.2 Trang bài học

Đây là màn hình khó nhất; đặc tả riêng.

| | 375 | 768 | 1024 | 1440 |
|---|---|---|---|---|
| Curriculum | `Drawer` `bottom`, cao 85vh, mở bằng nút "Nội dung khóa học" | `Drawer` `right` 360px | Cột dính bên phải 360px, cuộn riêng | Cột dính 400px |
| Video | Full-bleed sát mép, dính đầu trang khi cuộn (chiều cao 56.25vw) | Full-bleed, không dính | Trong cột trái, bo `--radius-lg`, tối đa 900px | Tối đa 1000px |
| Nội dung bài + Tài liệu | `Tabs` "Nội dung" / "Tài liệu" | `Tabs` | Xếp dọc, đều hiện, không dùng Tabs | Như 1024 |
| `LessonNav` | Thanh dính đáy, 2 nút bằng nhau, 48px | Thanh dính đáy | Trong luồng, dưới nội dung | Như 1024 |
| `CompleteToggle` | Trong thanh dính đáy, chiếm ưu tiên | Trong thanh dính đáy | Ngay dưới video, cỡ `lg` | Như 1024 |
| Tiến độ khóa | `ProgressBar` `sm` mỏng ngay dưới header | Như 375 | Đầu sidebar, dạng `bar` `md` kèm "12/40 bài" | Như 1024 |
| Header | Slim 56px: nút quay lại, tiêu đề khóa cắt 1 dòng, nút mở curriculum | Slim 64px | Slim 64px, không có nút curriculum | Như 1024 |

Ba ràng buộc bắt buộc: sidebar curriculum cuộn độc lập với cột nội dung (`overflow-y: auto` + `max-height: calc(100dvh - 64px)`); dùng `dvh` chứ không phải `vh` vì thanh địa chỉ trên iOS làm `vh` sai; drawer curriculum đóng ngay khi chọn một bài, và focus chuyển sang tiêu đề bài mới.

### 7.3 Bảng admin

`DataTable` có hai hình thái, chuyển ở `768px`.

**< 768px — danh sách card.** Mỗi hàng thành một `Card`: dòng đầu là cột nhận dạng chính (tiêu đề khóa / email người dùng) cỡ `--text-base` `600`, các cột còn lại là cặp `nhãn: giá trị` cỡ `--text-sm`, `StatusBadge` ở góc trên phải, hành động gom vào một `DropdownMenu` nút ba chấm 44×44. Không cuộn ngang — cuộn ngang trên cảm ứng là bẫy.

**≥ 768px — bảng thật.** Cột chia ba mức ưu tiên:

| Mức | Ví dụ | 768 | 1024 | 1440 |
|---|---|---|---|---|
| P1 nhận dạng | Tiêu đề, email | Hiện | Hiện | Hiện |
| P1 trạng thái | `StatusBadge` | Hiện | Hiện | Hiện |
| P2 số liệu | Giá, số học viên, số bài | Ẩn | Hiện | Hiện |
| P3 phụ | Ngày tạo, cập nhật lần cuối, id | Ẩn | Ẩn | Hiện |
| Hành động | Menu ba chấm | Hiện, dính phải | Hiện | Hiện + 1 nút chính lộ ra ngoài |

Cột đầu dính trái (`position: sticky; left: 0`) ở mọi bề rộng có bảng. Chiều cao hàng 56px để nút hành động đủ 44px. Header bảng dính đỉnh vùng cuộn với nền `--color-muted` và chữ `--color-muted-foreground-strong`.

---

## 8. Accessibility

Sàn: WCAG 2.2 AA. Kiểm tra bàn phím trước, chuột sau.

### 8.1 Cặp màu phải kiểm

Số đo bằng công thức tương phản WCAG 2.x. Đây là bộ hồi quy — mọi lần đổi token phải chạy lại.

Bộ hồi quy chạy được nằm ở **`design/contrast-check.py`**, và nó đo **đúng bộ token của §1.2 ở tài liệu này**, không phải một bộ nào khác. Chạy `py -3 design/contrast-check.py`: kết quả hiện tại **44/44 pass**, cộng ba cặp bị cấm ở bảng dưới được khẳng định là **vẫn trượt** ngưỡng (nếu một cặp bị cấm bỗng đạt ngưỡng thì ai đó đã đổi palette và script báo đỏ). Script gộp `rgba()` lên nền đã nêu trước khi tính, nên `--color-input` dark (`rgba(255,255,255,0.40)`) được đo đúng như trình duyệt vẽ. Bảng 16 dòng dưới đây là phần tối thiểu; script còn đo thêm các cặp `on-*-subtle`, viền và ring.

| Cặp | Light | Dark | Ngưỡng | Kết quả |
|---|---|---|---|---|
| `foreground` / `background` | 17.06 | 17.06 | 4.5 | Đạt |
| `foreground` / `card` | 17.85 | 13.98 | 4.5 | Đạt |
| `muted-foreground` / `card` | 4.76 | 5.71 | 4.5 | Đạt |
| `muted-foreground` / `background` | 4.55 | 6.96 | 4.5 | Đạt |
| `muted-foreground-strong` / `muted` | 6.92 | 6.97 | 4.5 | Đạt |
| `primary-foreground` / `primary-strong` | 5.47 | 7.77 | 4.5 | Đạt |
| `primary-text` / `card` | 5.47 | 7.86 | 4.5 | Đạt |
| `accent-foreground` / `accent` | 4.91 | 7.29 | 4.5 | Đạt |
| `destructive` / `card` | 4.83 | 5.29 | 4.5 | Đạt |
| `destructive-foreground` / `destructive` | 4.83 | 5.84 | 4.5 | Đạt |
| `success` / `card` | 5.02 | 8.40 | 4.5 | Đạt |
| `on-warning-subtle` / `warning-subtle` | 4.51 | 6.29 | 4.5 | Đạt |
| `on-primary-subtle` / `primary-subtle` | 4.86 | 6.41 | 4.5 | Đạt |
| `ring` / `background` | 3.58 | 9.59 | 3.0 | Đạt |
| `input` / `card` | 4.76 | 3.61 | 3.0 | Đạt |
| `accent` (icon sao) / `card` | 3.19 | 6.81 | 3.0 | Đạt |

Ba cặp bị cấm dùng, ghi lại để không ai vô tình dựng lại:

| Cặp bị cấm | Đo được | Thay bằng |
|---|---|---|
| `#FFFFFF` trên `--color-primary` `#0D9488` | 3.74 | `--color-primary-strong` |
| `#FFFFFF` trên `--color-accent` `#D97706` | 3.19 | `--color-accent-foreground` `#431407` |
| `--color-secondary` `#2DD4BF` làm chữ trên nền sáng | 1.86 | `--color-primary-text` |

`--color-border` trên `card` chỉ đạt 1.23 (light) và 1.28 (dark). Chấp nhận được vì đó là đường phân cách trang trí, không phải ranh giới của control — mọi control nhập liệu dùng `--color-input`. Hệ quả bắt buộc: **không có control nào chỉ được nhận ra nhờ `--color-border`**.

### 8.2 Focus và điều hướng bàn phím

- Focus ring toàn cục: `outline: 2px solid var(--color-ring); outline-offset: 2px`. Không bao giờ `outline: none` mà không có thay thế tương đương.
- `:focus-visible` cho phần tử tương tác. Container nhận focus theo chương trình (tiêu đề trang, khung player) dùng `tabindex="-1"` và không hiện ring.
- Thứ tự tab bám thứ tự DOM. Không dùng `tabindex` dương ở bất kỳ đâu.
- `SkipLink` là phần tử focus được đầu tiên: "Bỏ qua và tới nội dung chính" → `#main`.
- Landmark trên mọi trang: `<header>`, `<nav aria-label="…">`, `<main id="main">`, `<footer>`. Nhiều `<nav>` phải có `aria-label` khác nhau: "Điều hướng chính", "Chương trình học", "Điều hướng quản trị", "Đường dẫn".
- Vùng chạm tối thiểu 44×44px. Icon 16px thì phần tử bọc phải có padding đủ bù.

### 8.3 Focus khi đổi route

App Router không tự đặt lại focus khi điều hướng phía client. Không xử lý thì người dùng bàn phím và screen reader vẫn kẹt ở link cũ.

1. Một component client trong root layout theo dõi `usePathname()`.
2. Khi đường dẫn đổi, đặt focus vào `<h1>` của trang mới (fallback là `#main`), cả hai mang `tabindex="-1"`, rồi `scrollTo(0, 0)`.
3. Cùng lúc ghi tiêu đề trang vào một vùng `aria-live="assertive"` `sr-only` để screen reader đọc "Đã tới {tiêu đề}".
4. Ngoại lệ: điều hướng trong trang bài học **không** cuộn lên đầu — focus vào tiêu đề bài, giữ nguyên vị trí cuộn của player.
5. Modal và drawer: bẫy focus bên trong, `Escape` đóng, focus quay lại đúng phần tử đã mở nó, nền dưới nhận `inert`.

### 8.4 Bàn phím cho `VideoPlayer`

Khung player mang `tabindex="0"`, `role="region"`, `aria-label="Trình phát video"`. Mọi nút điều khiển là `<button>` thật, tab được riêng. Phím tắt chỉ ăn khi focus nằm trong khung player, và bị bỏ qua khi focus đang ở trong ô nhập liệu.

| Phím | Hành động | Thông báo `aria-live` |
|---|---|---|
| `Space` / `K` | Phát / tạm dừng | "Đang phát" / "Đã tạm dừng" |
| `←` / `→` | Lùi / tiến 5 giây | "{mm:ss}" |
| `J` / `L` | Lùi / tiến 10 giây | "{mm:ss}" |
| `↑` / `↓` | Tăng / giảm âm lượng 10% | "Âm lượng {n} phần trăm" |
| `M` | Tắt / bật tiếng | "Đã tắt tiếng" / "Đã bật tiếng" |
| `F` | Bật / thoát toàn màn hình | — |
| `C` | Bật / tắt phụ đề | "Đã bật phụ đề" / "Đã tắt phụ đề" |
| `<` / `>` | Giảm / tăng tốc độ | "Tốc độ {n}x" |
| `0`–`9` | Nhảy tới 0%–90% | "{mm:ss}" |
| `Home` / `End` | Về đầu / tới cuối | "{mm:ss}" |
| `?` | Mở bảng phím tắt | — |

Thanh tua là `<div role="slider">` với `aria-valuemin="0"`, `aria-valuemax="{thời lượng}"`, `aria-valuenow`, `aria-valuetext="3 phút 12 giây trên 12 phút 40 giây"`. Thời gian trong `aria-valuetext` phải đọc thành lời, không phải `03:12` — screen reader đọc dấu hai chấm sai.

Bổ sung: thanh điều khiển hiện lại khi có sự kiện bàn phím hoặc chuột và không bao giờ tự ẩn khi focus nằm trong nó; thông báo `aria-live` dùng `polite` và chống dội để tua liên tục không sinh một tràng thông báo; bảng phím tắt mở được từ một nút thật trong thanh điều khiển, không chỉ bằng phím `?`.

### 8.5 Ngữ nghĩa của cây chương trình học

Không dùng `role="tree"`. Curriculum không phải cây thật — nó là danh sách các nhóm bung/thu, và hỗ trợ pattern tree của screen reader vẫn kém. Dùng disclosure lồng danh sách:

```text
<nav aria-label="Chương trình học">
  <ol>                                    ← danh sách chương
    <li>
      <h3>
        <button aria-expanded="true" aria-controls="section-1-lessons">
          Chương 1: Nhập môn
          <span class="sr-only">12 bài học, 1 giờ 20 phút</span>
        </button>
      </h3>
      <ol id="section-1-lessons">         ← danh sách bài
        <li><a href="…" aria-current="page">Bài 1: …</a></li>
        <li><span aria-disabled="true">Bài 2: … (chưa có quyền học)</span></li>
      </ol>
    </li>
  </ol>
</nav>
```

Bốn ràng buộc:

- `aria-expanded` và `aria-controls` phải khớp trạng thái thật; đóng thì nội dung phải bị `hidden`, không chỉ `height: 0`.
- Bài đang xem mang `aria-current="page"`, và dấu hiệu thị giác không được chỉ là màu — phải có thêm thanh 3px `--color-primary` bên trái.
- Bài chưa có quyền là `<span aria-disabled="true">` kèm chữ ẩn giải thích, không phải link vô hiệu.
- Trạng thái hoàn thành nói bằng chữ ẩn `<span class="sr-only">Đã hoàn thành</span>`, không chỉ bằng icon tick.

### 8.6 Form, ảnh và các mục còn lại

| Hạng mục | Yêu cầu |
|---|---|
| Nhãn | Mỗi control có `<label for>` thật. `aria-label` chỉ dùng cho nút chỉ có icon |
| Lỗi | `aria-invalid="true"` + `aria-describedby` trỏ tới id dòng lỗi. Tóm tắt lỗi ở đầu form mang `role="alert"` và `tabindex="-1"`, nhận focus khi gửi thất bại |
| Trường bắt buộc | `required` + dấu `*` có `aria-hidden="true"` + chữ ẩn "bắt buộc" |
| Autocomplete | `email`, `current-password`, `new-password`, `name` |
| Trạng thái gửi | Nút mang `aria-busy="true"`; kết quả thông báo qua `role="status"` |
| Ảnh bìa khóa học | `alt=""` khi tiêu đề nằm ngay cạnh (ảnh trang trí). `alt` mô tả thật chỉ dùng cho ảnh trong nội dung bài học, do admin nhập |
| Ảnh trong Markdown | Editor bắt buộc ô nhập chữ thay thế; để trống thì cảnh báo khi lưu |
| Video | Khung `<track kind="captions">` sẵn sàng ngay cả khi vòng đầu chưa có file phụ đề |
| Ngôn ngữ | `<html lang="vi">`; đoạn tiếng Anh xen kẽ (tên công nghệ) bọc `<span lang="en">` |
| Zoom | Nội dung dùng được ở 200% zoom và ở `375×667` xoay ngang, không cuộn ngang |
| Chuyển động | `prefers-reduced-motion: reduce` tắt mọi transform và stagger |
| Màu là tín hiệu duy nhất | Cấm. `StatusBadge` luôn có chữ; `LessonRow` hoàn thành luôn có icon tick; lỗi form luôn có icon và chữ |
| Tiêu đề | Đúng một `<h1>` mỗi trang, không nhảy bậc |
| Tiêu đề tài liệu | `<title>` theo mẫu `{Tên trang} · E-learning`, đổi ở mọi route |

### 8.7 Metadata, ảnh OG và dữ liệu có cấu trúc

PROJECT_PLAN đặt "SEO metadata, sitemap và dữ liệu có cấu trúc cho khóa học" vào phạm vi công khai. `<title>` đã có ở §8.6; ba thứ còn lại chốt ở đây.

| Route | `description` |
|---|---|
| `/` | Câu tĩnh trong `src/lib/site.ts`, ≤ 160 ký tự, nêu chủ đề dạy và đối tượng học |
| `/courses` | "Toàn bộ khóa học đang mở, lọc theo danh mục, trình độ và mức giá." |
| `/courses/[slug]` | `course.subtitle`. Null thì lấy 160 ký tự đầu của `description` sau khi bỏ cú pháp Markdown, cắt ở ranh giới từ |
| `/categories/[slug]` | `category.description`. Null thì "{n} khóa học trong danh mục {name}." |
| Trang pháp lý và `/about` | Câu đầu của chính file Markdown |
| Mọi route dưới `(learner)`, `(player)`, `(admin)`, `(auth)` | Không có `description`, và **`robots: { index: false }`** — trang riêng tư không có gì để index |

`opengraph-image.tsx` chỉ có ở `/courses/[slug]`; các route còn lại dùng một ảnh OG tĩnh trong `public/`:

- 1200×630, sinh bằng `ImageResponse` của Next, nền `--color-card` sáng (ảnh OG luôn dùng bảng màu light — mạng xã hội không biết chủ đề của người xem).
- Tiêu đề khóa học bằng `--font-heading` 60px, cắt tối đa 3 dòng bằng dấu `…`.
- Dưới tiêu đề: `subtitle` một dòng 28px màu `--color-muted-foreground`; dưới nữa là hàng meta "{n} bài học · {thời lượng} · {trình độ}".
- Góc dưới trái: logo 40px + tên site. Góc dưới phải: giá đã định dạng theo §9.3. Không có nhánh "Miễn phí" — mọi khóa `PUBLISHED` đều có `priceVnd > 0`, và `opengraph-image.tsx` chỉ chạy cho khóa đã xuất bản.
- Không nhét ảnh bìa vào làm nền: ảnh do admin upload có độ tương phản không kiểm soát được, và chữ trắng trên nền tùy ý là cách chắc chắn nhất để có một thẻ OG không đọc được.

JSON-LD chỉ phát ở `/courses/[slug]`, một khối `<script type="application/ld+json">` do Server Component render, schema `Course`:

| Field | Nguồn |
|---|---|
| `name` | `course.title` |
| `description` | `course.subtitle` hoặc `description` đã cắt |
| `image` | URL tuyệt đối của ảnh bìa |
| `inLanguage` | `course.language` (mặc định `vi`) |
| `provider` | `{ "@type": "Organization", "name": SITE_OWNER, "url": origin }` |
| `offers` | `{ "@type": "Offer", "price": priceVnd, "priceCurrency": "VND", "availability": status === 'PUBLISHED' ? 'InStock' : 'Discontinued', "url": canonical }` |
| `hasCourseInstance` | `{ "@type": "CourseInstance", "courseMode": "online" }` |

Không phát `aggregateRating` chừng nào `demoStats = true`. Số liệu seed là số bịa để lưới card trông thật khi demo; đẩy nó vào dữ liệu có cấu trúc là gửi đánh giá bịa cho công cụ tìm kiếm, và đó là chỗ khác hẳn về mức độ.

---

## 9. Quy ước microcopy tiếng Việt

### 9.1 Giọng văn

- Xưng hô: gọi người dùng là **"bạn"** ở mọi nơi, kể cả khu quản trị. Không dùng "quý khách", "anh/chị", "học viên thân mến".
- Sản phẩm tự xưng: tránh. Viết "Không tải được danh sách khóa học" thay vì "Chúng tôi không tải được…". Chỉ dùng "chúng tôi" ở trang pháp lý và trang liên hệ.
- Câu chủ động, thì hiện tại: "Đã lưu khóa học", không phải "Khóa học đã được lưu bởi hệ thống".
- Không dấu chấm than ở bất kỳ đâu. Không emoji.
- "Vui lòng" chỉ dùng khi thật sự yêu cầu người dùng làm gì đó trong tình huống lỗi ("Vui lòng đăng nhập lại"). Không dùng trong nhãn nút.
- Nhãn nút là động từ hành động, 1–3 từ: "Lưu", "Xuất bản", "Cấp quyền học", "Tiếp tục học". Không dùng "OK", "Gửi đi", "Đồng ý".
- Nút trong `ConfirmDialog` nhắc lại hành động, không phải "Có/Không": "Thu hồi quyền học" / "Hủy".

### 9.2 Viết hoa

- **Chỉ viết hoa chữ cái đầu câu và danh từ riêng.** Áp cho tiêu đề, nhãn nút, header bảng, mục menu: "Khóa học của tôi", không phải "Khóa Học Của Tôi".
- Không viết hoa toàn bộ ở bất kỳ đâu — dấu tiếng Việt trên chữ hoa bị cắt hoặc chồng lấn.
- Tên riêng giữ nguyên hoa: `ZaloPay`, `Cloudflare Stream`, `PostgreSQL`, `Markdown`.
- Tiêu đề không có dấu chấm cuối. Câu mô tả trong `EmptyState` và `ErrorState` thì có.

### 9.3 Số, tiền, thời gian

Toàn bộ định dạng dùng `Intl` với locale `vi-VN` và múi giờ `Asia/Ho_Chi_Minh`. Các chuỗi dưới đây là đầu ra đã kiểm chứng bằng chạy thực tế, không phải phỏng đoán.

| Loại | Cấu hình | Đầu ra | Ghi chú |
|---|---|---|---|
| Tiền | `style:'currency', currency:'VND', maximumFractionDigits:0` | `499.000 ₫` · `1.200.000 ₫` | Dấu chấm ngăn nghìn, ký hiệu `₫` sau số, ngăn cách bằng **U+00A0** (khoảng trắng không ngắt). Không bao giờ có phần thập phân. Không có nhãn "Miễn phí": cổng publish đòi `priceVnd > 0`, nên không khóa `PUBLISHED` nào hiện giá 0 |
| Số nguyên | `Intl.NumberFormat('vi-VN')` | `1.245 học viên` | |
| Rating | `minimumFractionDigits:1` | `4,8` | Dấu **phẩy** thập phân. Kèm số lượt trong ngoặc: `4,8 (128)` |
| Rút gọn | — | **Cấm** | `notation:'compact'` cho ra `13 N` — vô nghĩa với người Việt. Luôn viết đủ số |
| Ngày | `day:'2-digit', month:'2-digit', year:'numeric'` | `01/09/2026` | Không dùng `dateStyle:'short'` (cho ra `1/9/26`, năm 2 chữ số) |
| Ngày giờ | thêm `hour:'2-digit', minute:'2-digit', hour12:false` | `14:05 01/09/2026` | Giờ trước ngày. 24 giờ, không có SA/CH |
| Tương đối | `RelativeTimeFormat('vi', {numeric:'always'})` | `3 giờ trước` · `2 ngày trước` | Bắt buộc `numeric:'always'`. Với `'auto'`, output là `Hôm kia` — viết hoa giữa câu và không nhất quán. Chỉ dùng tương đối khi < 7 ngày, quá thì chuyển sang ngày tuyệt đối |
| Thời lượng bài | tự viết | `12 phút` · `1 giờ 30 phút` | Bỏ đơn vị bằng 0. Không viết `0 giờ 12 phút` |
| Thời lượng khóa | tự viết | `10 giờ 25 phút` | |
| Mốc thời gian video | tự viết | `03:12` · `1:04:30` | `mm:ss` dưới 1 giờ, `h:mm:ss` từ 1 giờ. Chỉ hiển thị, `aria-valuetext` đọc thành lời |
| Bài đọc | — | `Bài đọc` | Khi `durationSeconds = 0` |
| Tiến độ | — | `12/40 bài` · `30%` | Ưu tiên phân số, phần trăm chỉ dùng trong `ProgressBar` `aria-valuetext` |
| Danh sách | `ListFormat('vi')` | `Lập trình, Thiết kế và Kinh doanh` | |

### 9.4 Slug

Chuẩn hóa NFD → bỏ dấu thanh → `đ`/`Đ` thành `d`/`D` → chữ thường → thay chuỗi ký tự không phải `[a-z0-9]` bằng `-` → cắt gạch ngang thừa hai đầu. Đã kiểm: `"Lập trình JavaScript từ đầu — Khóa 2026"` → `lap-trinh-javascript-tu-dau-khoa-2026`. Slug do admin sửa được và cố định sau khi xuất bản; đổi slug của khóa đã xuất bản phải hỏi xác nhận và cảnh báo mất link cũ.

### 9.5 Từ vựng thống nhất

Bảng bên trái là tên trong mã nguồn, bên phải là chữ duy nhất được phép hiện ra giao diện. Một khái niệm chỉ có một cách gọi.

| Mã nguồn | Giao diện |
|---|---|
| `Course` | Khóa học |
| `Category` | Danh mục |
| `Section` | Chương |
| `Lesson` | Bài học |
| `Lesson.isPreview` | Học thử |
| `VideoAsset` | Video |
| `LessonResource` | Tài liệu |
| `Enrollment` | Quyền học · trong ngữ cảnh người học: "Khóa học của tôi" |
| `ManualGrant` | Cấp quyền thủ công |
| `Purchase` | Đơn hàng |
| `PaymentAttempt` | Lần thanh toán |
| `LessonProgress` | Tiến độ |
| `AuditLog` | Nhật ký hoạt động |
| `DRAFT` | Bản nháp |
| `PUBLISHED` | Đã xuất bản |
| `ARCHIVED` | Đã lưu trữ |
| `ACTIVE` | Đang hiệu lực |
| `REVOKED` | Đã thu hồi |
| `PENDING` | Đang chờ |
| `PAID` | Đã thanh toán |
| `REFUND_REQUESTED` | Đang chờ hoàn tiền |
| `REFUNDED` | Đã hoàn tiền |
| `CANCELLED` | Đã hủy |
| `FAILED` | Thất bại |
| `EXPIRED` | Đã hết hạn |
| `BLOCKED` | Đã khóa |
| `BEGINNER` / `INTERMEDIATE` / `ADVANCED` | Cơ bản / Trung cấp / Nâng cao |
| `ALL_LEVELS` | Mọi trình độ |
| `Course.subtitle` | Dòng mô tả |
| `Course.learningOutcomes` | Bạn sẽ học được gì |
| `Course.requirements` | Yêu cầu |
| `Course.targetAudience` | Khóa học dành cho ai |
| `Course.demoStats` | Dữ liệu demo |

Ba từ bị cấm vì đã bị PROJECT_PLAN tách nghĩa: **"đăng ký khóa học"** không được dùng cho hành động mở quyền học (chỉ dùng cho hành động bắt đầu mua); **"mở khóa"** chỉ dùng khi thật sự tạo `Enrollment`; **"ghi danh"** không dùng trong giao diện, chỉ dùng trong tài liệu nội bộ.
