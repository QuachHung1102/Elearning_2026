# Viết logic xử lý và đối chiếu kết quả

## Sau bài này

Bạn viết được hàm `analyse` nhận dữ liệu đã kiểm tra và trả lại bảng kết quả. Dành khoảng 35–50 phút. Giữ phần `load_rows` ở bài 1; đoạn dưới là phần **thêm vào cuối cùng tệp**, không thay toàn bộ tệp.

## Chọn quy tắc trước khi viết vòng lặp

Tỷ lệ toàn kỳ bằng tổng gram chia tổng suất. Không lấy trung bình ba tỷ lệ của các bữa có số suất khác nhau; cách đó cho mỗi bữa một trọng số bằng nhau và trả lời một câu hỏi khác.

Trước khi chạy máy, hãy ghi dự đoán của mình từ ba dòng mẫu. Viết rõ một nhãn là một nhóm hay là một bản ghi. Đơn vị kết quả của dự án này là **Thức ăn thừa trên mỗi suất (g/suất)**. Một con số không kèm đơn vị hoặc mẫu số rất dễ khiến người đọc hiểu sai.

## Phần xử lý

```python

def analyse(rows):
    total_servings = sum(row['servings'] for row in rows)
    total_waste = sum(row['waste_g'] for row in rows)
    result = [(row['day'] + ' / ' + row['meal'], round(row['waste_g']/row['servings'], 2)) for row in rows]
    result.append(('Toàn kỳ', round(total_waste/total_servings, 2) if total_servings else 0))
    return result
```

Để hàm chỉ nhận `rows` và trả kết quả giúp bạn thử trên một list nhỏ mà không cần mở tệp mỗi lần. Hàm không sửa dữ liệu đầu vào, không tự xóa tệp, không tự gửi thông báo. Vì vậy có thể tách lỗi đọc tệp khỏi lỗi tính toán.

## Đối chiếu dữ liệu mẫu

Mở Python ở thư mục dự án và chạy:

```python
from project import load_rows, analyse
rows, errors = load_rows('data.csv')
print(analyse(rows))
```

Kết quả mong đợi:

```text
[('2026-10-01 / lunch', 40.0), ('2026-10-02 / lunch', 60.0), ('2026-10-03 / lunch', 30.0), ('Toàn kỳ', 38.33)]
```

Nếu kết quả không khớp, so sánh từng cặp nhãn–giá trị. Kiểm tra dữ liệu đầu vào có đang là bản gốc không. Đừng sửa số liệu để làm cho kiểm thử trông như đã đạt. Nếu thay quy tắc, cần viết lại kết quả mong đợi và giải thích lý do.

## Bài thực hành

Tính tay tỷ lệ toàn kỳ từ 2.300 gram và 60 suất. Ghi phép tính hoặc lựa chọn trên giấy trước khi chạy lại. Sau đó thử danh sách rỗng bằng `analyse([])`; không được có lỗi chia cho 0 hoặc truy cập phần tử không tồn tại.

## Kiểm tra hiểu bài

Quy tắc nào của dự án là một lựa chọn thiết kế, quy tắc nào là điều kiện dữ liệu hợp lệ? Nêu một trường hợp dữ liệu đọc đúng nhưng kết luận vẫn sai. Gợi ý: đơn vị hoặc nhóm so sánh không nhất quán có thể tạo kết quả tính đúng về số học nhưng không trả lời câu hỏi ban đầu.

## Giới hạn cần ghi lại

So sánh trước–sau còn phụ thuộc thực đơn, số suất và cách cân. Không khẳng định một thay đổi gây giảm lãng phí chỉ từ bảng số nhỏ này.

Hoàn thành khi dữ liệu mẫu khớp kết quả mong đợi, thay đổi có kiểm soát cho ra kết quả giải thích được, và dữ liệu rỗng không làm chương trình dừng bất ngờ.
