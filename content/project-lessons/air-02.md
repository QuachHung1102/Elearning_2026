# Viết logic xử lý và đối chiếu kết quả

## Sau bài này

Bạn viết được hàm `analyse` nhận dữ liệu đã kiểm tra và trả lại bảng kết quả. Dành khoảng 35–50 phút. Giữ phần `load_rows` ở bài 1; đoạn dưới là phần **thêm vào cuối cùng tệp**, không thay toàn bộ tệp.

## Chọn quy tắc trước khi viết vòng lặp

Chia nhóm theo ngày và điểm đo. Tính trung bình cộng chỉ khi các lần đo được lấy theo cùng một quy trình; hiển thị n để người đọc biết có bao nhiêu quan sát.

Trước khi chạy máy, hãy ghi dự đoán của mình từ ba dòng mẫu. Viết rõ một nhãn là một nhóm hay là một bản ghi. Đơn vị kết quả của dự án này là **PM2.5 trung bình (µg/m³)**. Một con số không kèm đơn vị hoặc mẫu số rất dễ khiến người đọc hiểu sai.

## Phần xử lý

```python

def analyse(rows):
    groups = {}
    for row in rows:
        key = (row['time'][:10], row['site'])
        groups.setdefault(key, []).append(row['pm25'])
    return [(f'{day} / {site} (n={len(values)})', round(sum(values)/len(values), 2))
            for (day, site), values in sorted(groups.items())]
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
[('2026-10-01 / A (n=2)', 15.0), ('2026-10-01 / B (n=1)', 24.0)]
```

Nếu kết quả không khớp, so sánh từng cặp nhãn–giá trị. Kiểm tra dữ liệu đầu vào có đang là bản gốc không. Đừng sửa số liệu để làm cho kiểm thử trông như đã đạt. Nếu thay quy tắc, cần viết lại kết quả mong đợi và giải thích lý do.

## Bài thực hành

Thêm một lần đo ở A có giá trị 30 và dự đoán trung bình mới. Ghi phép tính hoặc lựa chọn trên giấy trước khi chạy lại. Sau đó thử danh sách rỗng bằng `analyse([])`; không được có lỗi chia cho 0 hoặc truy cập phần tử không tồn tại.

## Kiểm tra hiểu bài

Quy tắc nào của dự án là một lựa chọn thiết kế, quy tắc nào là điều kiện dữ liệu hợp lệ? Nêu một trường hợp dữ liệu đọc đúng nhưng kết luận vẫn sai. Gợi ý: đơn vị hoặc nhóm so sánh không nhất quán có thể tạo kết quả tính đúng về số học nhưng không trả lời câu hỏi ban đầu.

## Giới hạn cần ghi lại

Báo cáo là bài tập mô tả dữ liệu, không đưa khuyến cáo sức khỏe hay tự suy ra chỉ số AQI. Không so sánh các thiết bị hoặc lịch đo khác nhau như thể chúng tương đương.

Hoàn thành khi dữ liệu mẫu khớp kết quả mong đợi, thay đổi có kiểm soát cho ra kết quả giải thích được, và dữ liệu rỗng không làm chương trình dừng bất ngờ.
