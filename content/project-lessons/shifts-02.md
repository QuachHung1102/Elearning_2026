# Viết logic xử lý và đối chiếu kết quả

## Sau bài này

Bạn viết được hàm `analyse` nhận dữ liệu đã kiểm tra và trả lại bảng kết quả. Dành khoảng 35–50 phút. Giữ phần `load_rows` ở bài 1; đoạn dưới là phần **thêm vào cuối cùng tệp**, không thay toàn bộ tệp.

## Chọn quy tắc trước khi viết vòng lặp

Ưu tiên người có ít lựa chọn thời gian hơn; sau đó xét số ca đã làm và mã để kết quả xác định. Mỗi lần chọn đều kiểm tra giới hạn và thời gian rảnh. Đây là thuật toán tham lam, không cam kết tìm được lịch tối ưu cho mọi bộ dữ liệu.

Trước khi chạy máy, hãy ghi dự đoán của mình từ ba dòng mẫu. Viết rõ một nhãn là một nhóm hay là một bản ghi. Đơn vị kết quả của dự án này là **Số người đã xếp cho ca (mỗi ca cần 1)**. Một con số không kèm đơn vị hoặc mẫu số rất dễ khiến người đọc hiểu sai.

## Phần xử lý

```python

def analyse(rows):
    assigned = {row['person']: 0 for row in rows}
    result = []
    for slot in ['morning', 'afternoon']:
        candidates = [row for row in rows if slot in row['slots'] and assigned[row['person']] < row['max_shifts']]
        candidates.sort(key=lambda row: (len(row['slots']), assigned[row['person']], row['person']))
        chosen = candidates[0] if candidates else None
        if chosen:
            assigned[chosen['person']] += 1
        result.append((slot + ': ' + (chosen['person'] if chosen else 'THIẾU NGƯỜI'), 1 if chosen else 0))
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
[('morning: P02', 1), ('afternoon: P03', 1)]
```

Nếu kết quả không khớp, so sánh từng cặp nhãn–giá trị. Kiểm tra dữ liệu đầu vào có đang là bản gốc không. Đừng sửa số liệu để làm cho kiểm thử trông như đã đạt. Nếu thay quy tắc, cần viết lại kết quả mong đợi và giải thích lý do.

## Bài thực hành

Đặt max_shifts của P02 bằng 0; dự đoán ai nhận ca sáng. Ghi phép tính hoặc lựa chọn trên giấy trước khi chạy lại. Sau đó thử danh sách rỗng bằng `analyse([])`; không được có lỗi chia cho 0 hoặc truy cập phần tử không tồn tại.

## Kiểm tra hiểu bài

Quy tắc nào của dự án là một lựa chọn thiết kế, quy tắc nào là điều kiện dữ liệu hợp lệ? Nêu một trường hợp dữ liệu đọc đúng nhưng kết luận vẫn sai. Gợi ý: đơn vị hoặc nhóm so sánh không nhất quán có thể tạo kết quả tính đúng về số học nhưng không trả lời câu hỏi ban đầu.

## Giới hạn cần ghi lại

Công bằng không thể được quyết định chỉ bằng vài dòng code. Quy tắc cần được nhóm đồng ý; khi tăng số ca hoặc thêm yêu cầu vai trò, cần kiểm thử lại và có thể phải dùng thuật toán khác.

Hoàn thành khi dữ liệu mẫu khớp kết quả mong đợi, thay đổi có kiểm soát cho ra kết quả giải thích được, và dữ liệu rỗng không làm chương trình dừng bất ngờ.
