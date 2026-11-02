## Bắt đầu bằng một câu hỏi nhỏ

Mình muốn biết: **trong dữ liệu mẫu, ngày nào có tổng khối lượng bỏ lại nhiều nhất?** Chưa hỏi “nguyên nhân là gì”, vì bảng chưa đủ thông tin để trả lời.

[Tải food-waste.csv](/downloads/projects/food-waste.csv). Sáu dòng đều là số liệu dựng để học, không phải số liệu của một trường hay cộng đồng thật. Đơn vị của `grams` là gram; mỗi dòng ghi một loại thức ăn trong một ngày.

```csv
day,item,grams
Monday,rice,120
Monday,vegetables,80
Tuesday,rice,90
Tuesday,vegetables,60
Wednesday,rice,160
Wednesday,vegetables,70
```

Tạo `read_data.py` cạnh file CSV:

```python
import csv
from pathlib import Path

path = Path(__file__).with_name("food-waste.csv")
with path.open(encoding="utf-8-sig", newline="") as source:
    for row in csv.DictReader(source):
        print(row["day"], row["item"], row["grams"])
```

`DictReader` dùng hàng đầu làm tên cột. Lưu ý `row["grams"]` vẫn là chuỗi, chưa phải số. Cộng hai chuỗi `"120" + "80"` sẽ không cho kết quả 200.

### Tự làm

In kiểu của `row["grams"]` bằng `type()`. Thử chuyển bằng `float()`. Sau đó thêm một dòng có chữ `unknown` ở cột khối lượng và quan sát lỗi. Giữ lại bản gốc để dễ đối chiếu; bài tiếp theo xử lý lỗi này thay vì bỏ qua toàn bộ file.

<!-- expanded-lesson -->
## Học sâu hơn: mục tiêu và cách làm

**Mục tiêu:** Đọc CSV và giải thích ý nghĩa của dữ liệu trước khi tính. **Thời gian thực hành dự kiến:** 30–45 phút. Bạn có thể dừng giữa các phần; bài học này hoàn thành được bằng chữ và code, không phụ thuộc video.

CSV là văn bản có các giá trị phân cách bằng dấu phẩy. Dòng đầu đặt tên cột; mỗi dòng sau là một quan sát. Trong file này, một dòng là khối lượng một loại thức ăn của một ngày, không phải một học sinh. Đơn vị grams là gram, nên không cộng với kilogram nếu chưa đổi đơn vị.

DictReader dùng tên cột làm khóa dictionary. Dù ô nhìn như số, giá trị đọc ban đầu vẫn là văn bản. Vì vậy "120" + "80" tạo "12080", không phải 200. Cần chuyển kiểu trước khi tính, đồng thời có cách xử lý ô không thể chuyển.

with mở file trong một phạm vi rồi đóng nó khi xong. newline="" giúp bộ đọc CSV xử lý xuống dòng; utf-8-sig chấp nhận cả dấu đánh dấu mã hóa có thể có trong file xuất từ phần mềm bảng tính. Path(__file__).with_name giữ đường dẫn cạnh script.

Đặt câu hỏi có thể trả lời từ cột hiện có: ngày nào có tổng lượng ghi nhận cao nhất? Bảng chưa có số suất ăn, khẩu phần hoặc lý do bỏ lại. Vì vậy chưa thể kết luận món nào bị ghét hay hoạt động nào đã giảm lãng phí.

## Bài thực hành có hướng dẫn

Giải thích một dòng bằng lời, in kiểu dữ liệu của grams, rồi thử tổng hai giá trị có và không chuyển float. Thực hiện trên bản sao.

Hãy làm trước khi đọc phần đối chiếu. Ghi đầu vào và kết quả mong đợi; chỉ thay một điều mỗi lần để dễ hiểu tác động.

## Lời giải đối chiếu và lý do

```python
print("120" + "80")       # 12080
print(float("120") + float("80"))  # 200.0
```

Trong vòng lặp CSV, dùng print(type(row["grams"]).__name__) sẽ thấy str. float tạo số mới; nó không tự thay giá trị trong row. Không dùng phép cộng chuỗi để tính khối lượng. Khi thử unknown, ValueError cho biết cần nhánh xử lý dữ liệu lỗi trong bài sau.

## Điều kiện hoàn thành

Nói rõ mỗi dòng biểu diễn gì, đơn vị nào được dùng và điều bảng chưa cho biết. File mẫu có sáu quan sát thuộc ba ngày; không gọi đó là sáu ngày.

Nếu chưa đạt, chỉ ra bước nhỏ nhất chưa hoạt động, kiểm tra dữ liệu đầu vào và đọc thông báo lỗi. Một bài hoàn thành gồm kết quả chạy được và lời giải thích của bạn, không chỉ bản code giống ví dụ.
