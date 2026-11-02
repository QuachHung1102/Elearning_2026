# Tạo báo cáo và hoàn thiện phiên bản đầu

## Sau bài này

Bạn chạy chương trình từ đầu đến cuối và mở được báo cáo HTML trên máy. Dành khoảng 35–50 phút. Tiếp tục trong `project.py` đã chứa code từ hai bài trước. Đây là phiên bản dùng tệp CSV và báo cáo cục bộ, không cần cài framework hay đưa dữ liệu lên Internet.

## Thêm phần xuất báo cáo

```python

def write_report(results, errors, path='report.html'):
    body = ''.join('<tr><td>'+escape(str(label))+'</td><td>'+escape(str(value))+'</td></tr>' for label,value in results)
    issues = ''.join('<li>'+escape(message)+'</li>' for message in errors)
    html = '<!doctype html><html lang="vi"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Báo cáo dự án</title><style>body{font:18px system-ui;max-width:850px;margin:30px auto;padding:20px}td,th{padding:12px;border:1px solid #aaa}table{border-collapse:collapse;width:100%}</style><h1>Báo cáo dữ liệu mẫu</h1><table><tr><th>Nhóm</th><th>Giá trị</th></tr>'+body+'</table><h2>Dòng cần kiểm tra</h2><ul>'+issues+'</ul><p>Dữ liệu luyện tập; kiểm tra nguồn và giới hạn trước khi sử dụng thực tế.</p></html>'
    Path(path).write_text(html, encoding='utf-8')

if __name__ == '__main__':
    rows, errors = load_rows('data.csv')
    results = analyse(rows)
    for result in results: print(*result, sep=': ')
    for error in errors: print(error)
    write_report(results, errors)
    print('Đã tạo report.html')
```

`escape` chuyển ký tự đặc biệt thành văn bản an toàn trong HTML. Ví dụ nhãn có `<` phải được hiển thị là nội dung, không trở thành một thẻ. Báo cáo chỉ hiển thị cặp nhãn–giá trị do `analyse` tạo ra, không xuất toàn bộ bản ghi gốc.

`if __name__ == '__main__'` giúp cùng tệp vừa chạy trực tiếp vừa được import để kiểm thử. Nếu import tệp mà không có điều kiện này, đoạn đọc tệp và ghi báo cáo có thể chạy ngoài ý muốn.

## Chạy một lượt hoàn chỉnh

Mở terminal trong thư mục dự án, gõ `python project.py`. Trên một số máy lệnh là `python3 project.py`. Chương trình in kết quả, ghi lỗi cần xem lại, rồi tạo `report.html`. Mở tệp bằng trình duyệt. Mỗi lần chạy sẽ ghi đè báo cáo cũ; nếu cần lưu một lần đo khác, sao chép báo cáo sang tên mới trước khi chạy.

## Đọc báo cáo có trách nhiệm

Đơn vị của cột Giá trị là **Thức ăn thừa trên mỗi suất (g/suất)**. Thêm đơn vị này vào tiêu đề cột trong chuỗi HTML. Thêm ngày tạo và một dòng mô tả nguồn. Dữ liệu đầu vào đang là mẫu, nên không trình bày nó như kết quả của một hoạt động đã diễn ra.

So sánh trước–sau còn phụ thuộc thực đơn, số suất và cách cân. Không khẳng định một thay đổi gây giảm lãng phí chỉ từ bảng số nhỏ này.

## Nâng cấp độc lập

Thiết kế một tuần ghi số liệu cùng đơn vị, cùng cách cân trước khi so sánh. Giữ phiên bản ban đầu trước khi sửa. Bạn có thể thêm bộ lọc hoặc giao diện trong một phiên bản tiếp theo, nhưng cần thử lại logic đang dùng trước khi thay công cụ hiển thị.

## Bảng kiểm tra trước khi chia sẻ

| Thử | Điều mong đợi |
| --- | --- |
| Ba dòng mẫu | Kết quả khớp bài 2 |
| Tệp chỉ có tiêu đề | Có báo cáo, không lỗi chia cho 0 |
| Thêm dòng trùng | Có cảnh báo, không đếm lại |
| Sai tên cột | Báo rõ lỗi trước khi tính |
| Một dòng lỗi | Dòng lỗi không nằm trong kết quả, có số dòng để sửa |
| Chạy lại | Báo cáo mới phản ánh dữ liệu mới |

Thực hiện từng thử trên bản sao của tệp. Ghi kết quả thật của bạn, không đánh dấu đạt trước khi chạy. Sau khi mở báo cáo bằng trình duyệt, thử phóng chữ lên 200% và xem bảng có còn đọc được không.

## Hoàn thành phiên bản đầu

Bạn có thể giải thích dữ liệu đầu vào, quy tắc xử lý, cách khôi phục dữ liệu mẫu và một giới hạn của công cụ. Nhờ một người thử mở báo cáo và diễn giải một hàng; ghi lại một chỗ họ thấy khó hiểu rồi cải thiện nhãn. Đây là bằng chứng cụ thể hơn việc chỉ nói chương trình đã chạy.
