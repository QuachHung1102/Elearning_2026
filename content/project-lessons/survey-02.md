# Viết logic xử lý và đối chiếu kết quả

## Sau bài này

Bạn viết được hàm `analyse` nhận dữ liệu đã kiểm tra và trả lại bảng kết quả. Dành khoảng 35–50 phút. Giữ phần `load_rows` ở bài 1; đoạn dưới là phần **thêm vào cuối cùng tệp**, không thay toàn bộ tệp.

## Chọn quy tắc trước khi viết vòng lặp

Mẫu số là số phiếu hợp lệ sau kiểm tra, không phải toàn bộ học sinh trong trường. Khởi tạo cả lựa chọn không ai chọn để biểu đồ không làm mất chúng.

Trước khi chạy máy, hãy ghi dự đoán của mình từ ba dòng mẫu. Viết rõ một nhãn là một nhóm hay là một bản ghi. Đơn vị kết quả của dự án này là **Tỷ lệ câu trả lời hợp lệ (%)**. Một con số không kèm đơn vị hoặc mẫu số rất dễ khiến người đọc hiểu sai.

## Phần xử lý

```python

def analyse(rows):
    counts = {choice: 0 for choice in ['library', 'sport', 'art']}
    for row in rows:
        counts[row['choice']] += 1
    total = len(rows)
    return [(f'{choice} ({count}/{total})', round(count / total * 100, 1) if total else 0)
            for choice, count in counts.items()]
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
[('library (2/3)', 66.7), ('sport (1/3)', 33.3), ('art (0/3)', 0.0)]
```

Nếu kết quả không khớp, so sánh từng cặp nhãn–giá trị. Kiểm tra dữ liệu đầu vào có đang là bản gốc không. Đừng sửa số liệu để làm cho kiểm thử trông như đã đạt. Nếu thay quy tắc, cần viết lại kết quả mong đợi và giải thích lý do.

## Bài thực hành

Thêm một phiếu chọn art và tính lại mẫu số trước khi chạy. Ghi phép tính hoặc lựa chọn trên giấy trước khi chạy lại. Sau đó thử danh sách rỗng bằng `analyse([])`; không được có lỗi chia cho 0 hoặc truy cập phần tử không tồn tại.

## Kiểm tra hiểu bài

Quy tắc nào của dự án là một lựa chọn thiết kế, quy tắc nào là điều kiện dữ liệu hợp lệ? Nêu một trường hợp dữ liệu đọc đúng nhưng kết luận vẫn sai. Gợi ý: đơn vị hoặc nhóm so sánh không nhất quán có thể tạo kết quả tính đúng về số học nhưng không trả lời câu hỏi ban đầu.

## Giới hạn cần ghi lại

Ba phiếu mẫu không đại diện cho toàn trường. Không công bố nhóm quá nhỏ có thể bị nhận diện; báo cáo này chỉ hiển thị tổng lựa chọn và không hiển thị mã phiếu.

Hoàn thành khi dữ liệu mẫu khớp kết quả mong đợi, thay đổi có kiểm soát cho ra kết quả giải thích được, và dữ liệu rỗng không làm chương trình dừng bất ngờ.
