## Tính tổng nhưng kiểm tra đầu vào trước

Một con số âm hoặc ô trống không phải số đo hợp lệ trong bài này. Mình bỏ qua dòng lỗi **và đếm số dòng bỏ qua** để người đọc biết dữ liệu chưa hoàn hảo.

```python
import math

totals, skipped = {}, 0
for row in reader:
    day = (row.get("day") or "").strip()
    item = (row.get("item") or "").strip()
    try:
        grams = float(row.get("grams", ""))
    except (ValueError, TypeError):
        skipped += 1
        continue
    if not day or not item or grams < 0 or not math.isfinite(grams):
        skipped += 1
        continue
    totals[day] = totals.get(day, 0) + grams
```

Đặt đoạn này **bên trong** khối mở file ở bài trước, thay vòng lặp chỉ in dữ liệu. `continue` chuyển sang dòng tiếp theo. `get(day, 0)` bắt đầu từ 0 khi ngày đó chưa có trong dictionary. `isfinite` loại các giá trị như `nan` và `inf`, vốn chuyển được sang float nhưng không phải số đo dùng được.

### Kết quả mong đợi với file gốc

Monday: 200g; Tuesday: 150g; Wednesday: 230g. Tổng ba ngày là **580g**, số dòng bỏ qua là 0.

### Tự làm

Thêm ba dòng thử với `grams` lần lượt là `-10`, `unknown`, và để trống. Tổng phải vẫn là 580g, số dòng bỏ qua tăng thành 3. Nếu số tổng thay đổi, tìm dòng nào đã lọt qua kiểm tra.

### Còn một câu hỏi

Nếu một ngày có 50 suất ăn và ngày khác có 100 suất, so sánh tổng có công bằng không? Giữ câu hỏi này cho bài cuối trước khi viết kết luận.

<!-- expanded-lesson -->
## Học sâu hơn: mục tiêu và cách làm

**Mục tiêu:** Nhóm số đo hợp lệ theo ngày và báo số dòng bỏ qua. **Thời gian thực hành dự kiến:** 40–55 phút. Bạn có thể dừng giữa các phần; bài học này hoàn thành được bằng chữ và code, không phụ thuộc video.

Tổng theo ngày là một dictionary: khóa là day, giá trị là tổng gram. totals.get(day, 0) lấy tổng hiện có, hoặc 0 nếu ngày chưa xuất hiện. Cộng từng số đo hợp lệ vào tổng, không thay tổng bằng số đo mới nhất.

Phần kiểm tra chia hai loại: chuyển sang số thất bại, hoặc chuyển được nhưng không phải số đo chấp nhận được. Giá trị âm, NaN và vô hạn không hợp lệ trong bài. Dòng không có ngày hoặc tên loại thức ăn cũng bị bỏ qua. Đếm skipped để người đọc biết không phải mọi dòng đều được dùng.

continue kết thúc lượt hiện tại rồi chuyển dòng tiếp theo. Vì vậy câu cập nhật totals phải nằm sau các kiểm tra; nếu đặt trước, dữ liệu lỗi có thể đã ảnh hưởng tổng. Nếu bắt lỗi quá rộng rồi bỏ qua im lặng, bạn có thể che cả lỗi lập trình; ở đây chỉ xử lý các kiểu lỗi chuyển số dự kiến.

Các đoạn minh họa dùng reader từ khối mở file ở bài trước. Để chạy một chương trình hoàn chỉnh, dùng food-waste.py đính kèm; hàm read_totals còn kiểm tra tên cột trước khi duyệt. Bạn có thể gọi hàm với một đường dẫn thử để kiểm tra mà không sửa file gốc.

## Bài thực hành có hướng dẫn

Trong bản sao CSV, thêm dòng âm, unknown và một ô grams trống. Chạy chương trình hoàn chỉnh rồi so sánh tổng và skipped với bản gốc.

Hãy làm trước khi đọc phần đối chiếu. Ghi đầu vào và kết quả mong đợi; chỉ thay một điều mỗi lần để dễ hiểu tác động.

## Lời giải đối chiếu và lý do

Ba dòng mẫu có thể là Thursday,rice,-10; Thursday,rice,unknown; Thursday,rice, (kết thúc bằng dấu phẩy). Khi thêm vào sáu dòng gốc, tổng vẫn là 580 và skipped là 3. Thursday không được đưa vào totals vì không có số đo hợp lệ.

Monday bắt đầu 0, cộng 120 thành 120, rồi cộng 80 thành 200. Đây là cách kiểm tra bằng tay một nhóm trước khi tin toàn bộ báo cáo. Nếu Monday chỉ còn 80, có thể bạn đã gán grams trực tiếp thay vì cộng vào tổng cũ.

## Điều kiện hoàn thành

Đối chiếu bằng tay một ngày và kiểm tra số dòng lỗi. Nêu được vì sao báo số dòng bỏ qua quan trọng khi đọc báo cáo; tổng từ phần dữ liệu hợp lệ không nhất thiết đại diện đầy đủ cho mọi ngày.

Nếu chưa đạt, chỉ ra bước nhỏ nhất chưa hoạt động, kiểm tra dữ liệu đầu vào và đọc thông báo lỗi. Một bài hoàn thành gồm kết quả chạy được và lời giải thích của bạn, không chỉ bản code giống ví dụ.
