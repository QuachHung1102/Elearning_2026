## Dictionary: thông tin đi cùng nhau

**Cách học:** bài đọc và thực hành độc lập, không cần video. Dự kiến 25–40 phút gồm thời gian tự làm; tốc độ của bạn có thể khác. Hoàn thành bài trước hoặc tự giải thích được ví dụ của bài đó.

### Sau bài này

Gom mã, tên và trạng thái của mỗi cuốn trong một dictionary.

## Hiểu từng bước

Một tên sách chưa đủ để biết cuốn đó có thể được mượn. Dictionary giữ các cặp khóa–giá trị, chẳng hạn khóa `title` đi với tên sách. Cặp ngoặc nhọn bao quanh dictionary; dấu hai chấm nối khóa với giá trị; dấu phẩy ngăn các cặp.

Trong ví dụ, `id` là số nguyên, `title` là văn bản và `borrowed` là boolean. `True` nghĩa là đang mượn; `False` nghĩa là chưa mượn. Hai giá trị này viết hoa chữ đầu và không có dấu nháy. Chuỗi `"False"` là văn bản khác kiểu, không phải giá trị boolean False.

`book["title"]` lấy giá trị theo khóa. Khóa phải có trong dictionary và viết đúng; `book["name"]` gây `KeyError` nếu chỉ có khóa title. Khác với biến book, khóa trong ví dụ là một chuỗi nên có dấu nháy khi tra cứu.

Danh sách `books` chứa nhiều dictionary. Mỗi lượt vòng lặp, `book` nhận một dictionary; điều kiện bên trong chọn chữ hiển thị dựa trên borrowed. Dòng print nằm trong vòng lặp nhưng ngoài hai nhánh điều kiện, để cả hai loại trạng thái đều được in.

Mã sách ổn định dù thứ tự danh sách thay đổi. Hai bản sách cùng tên có thể có hai mã khác nhau. Python chưa tự bảo đảm mã duy nhất trong đoạn này; đó là quy tắc mình sẽ kiểm tra trong dự án. Thay borrowed trực tiếp trong dữ liệu mẫu chỉ là một thí nghiệm, chưa phải chức năng mượn trả cho người dùng.

## Chạy một ví dụ hoàn chỉnh

Đọc và dự đoán đầu ra trước khi chạy. Tạo file riêng cho bài này để không ghi đè bài trước.

```python
books = [
    {"id": 1, "title": "De Men Phieu Luu Ky", "borrowed": False},
    {"id": 2, "title": "The Little Prince", "borrowed": True},
]
for book in books:
    if book["borrowed"]:
        status = "dang muon"
    else:
        status = "con trong"
    print(book["id"], book["title"], status)
```

## Tài liệu để tự làm

[Tệp bắt đầu](/downloads/projects/python-05-starter.py) · [Lời giải đối chiếu](/downloads/projects/python-05-solution.py). Lưu bản bắt đầu thành `my-work.py`, chạy `python my-work.py` trong thư mục đó. Nếu liên kết mở nội dung trong trình duyệt, dùng Lưu liên kết thành để giữ file `.py`.

## Tự làm trước khi xem lời giải

Hiển thị mỗi sách trên một dòng gồm mã, tên và con trong/dang muon. Đổi borrowed của sách 1 rồi chạy lại.

## Kiểm tra

Sách 1 ban đầu còn trống, sách 2 đang mượn; đổi boolean làm đổi đúng trạng thái tương ứng.

Ghi một đầu vào, kết quả mong đợi và kết quả thực tế. Nếu khác nhau, ghi thay đổi bạn đã thử.

## Gợi ý từng bước

1. Duyệt bằng for book in books.
2. Dùng if book["borrowed"] thay vì so sánh với chuỗi "True".

## Đối chiếu lời giải

Mở python-05-solution.py sau khi đã thử. Chạy cùng đầu vào với bản của bạn. Giải thích một khác biệt thay vì chép lại cả file. Lời giải là một cách làm, không phải cách duy nhất.

## Nghĩ thêm

Tại sao mã sách không nên phụ thuộc vào vị trí trong danh sách?



## Trước khi đánh dấu hoàn thành

Bạn cần chạy được bản của mình, giải thích một dòng bằng lời riêng và thử thêm một đầu vào hoặc thay đổi khác ví dụ. Ghi lại một lỗi đã gặp, cách bạn kiểm tra và kết quả sau khi sửa. Việc xem lời giải không thay cho việc tự chạy và giải thích.
