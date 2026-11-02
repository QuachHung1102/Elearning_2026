## Mình đang giải quyết việc gì?

Một bạn muốn mượn sách nhưng không biết sách nào đang có sẵn. Phiên bản đầu chỉ cần biết **tên sách, mã sách và trạng thái**. Chưa cần tài khoản hay tên người mượn.

Sau bài này, bạn sẽ biểu diễn được một tủ sách bằng danh sách các dictionary. Bạn cần biết cách chạy Python 3; nếu chưa quen, hãy chạy từng đoạn nhỏ trong trình soạn thảo.

```python
books = [
    {"id": 1, "title": "De Men Phieu Luu Ky", "borrowed": False},
    {"id": 2, "title": "The Little Prince", "borrowed": True},
]
for book in books:
    status = "dang muon" if book["borrowed"] else "con trong"
    print(book["id"], book["title"], status)
```

`books` là danh sách. Mỗi phần tử chứa các thông tin của **cùng một cuốn**. `False` ở đây nghĩa là sách chưa được mượn. Mã `id` giúp phân biệt hai bản sách có cùng tên.

### Tự làm

Thêm một cuốn thứ ba với mã `3`. Chạy lại, rồi đổi trạng thái của nó thành `True`. Bạn phải thấy ba dòng; dòng cuối thay đổi trạng thái, còn hai dòng trước giữ nguyên.

### Kiểm tra trước khi tiếp tục

Vì sao không nên lấy vị trí trong danh sách làm mã sách? Hãy thử đổi thứ tự hai cuốn: mã cần giữ nguyên dù vị trí thay đổi.

Trong bài tiếp theo, mình sẽ tìm sách theo từ khóa và cập nhật trạng thái. [Mã nguồn hoàn chỉnh để đối chiếu](/downloads/projects/book-sharing.py) có nhiều phần hơn bài này; hãy thử làm đoạn nhỏ trước.

<!-- expanded-lesson -->
## Học sâu hơn: mục tiêu và cách làm

**Mục tiêu:** Thiết kế dữ liệu và hiển thị ba sách có mã ổn định. **Thời gian thực hành dự kiến:** 35–45 phút. Bạn có thể dừng giữa các phần; bài học này hoàn thành được bằng chữ và code, không phụ thuộc video.

Hãy tưởng tượng bạn chỉ nhận một danh sách tên. Bạn không biết cuốn nào đang được mượn, và hai bản cùng tên rất khó phân biệt. Vì vậy mỗi bản sách có một id riêng; title dành cho người đọc; borrowed là trạng thái. Mã không cần bằng vị trí trong danh sách.

List là nhóm các cuốn; dictionary là nhóm thông tin của một cuốn. Khi vòng lặp đi qua books, biến book nhận từng dictionary. `book["title"]` lấy giá trị theo khóa văn bản title. Viết sai thành name sẽ gây KeyError nếu khóa đó không tồn tại.

Hai boolean True/False không có dấu nháy. Chuỗi "False" vẫn là văn bản không rỗng; dùng nó trong if sẽ cho hành vi khác False. Hãy kiểm tra kiểu dữ liệu ngay từ bản mẫu, thay vì sửa cách hiển thị để che lỗi.

Đoạn ví dụ đầu dùng biểu thức điều kiện ngắn để chọn status. Bạn có thể viết thành if/else quen thuộc: nếu borrowed thì status = "dang muon", ngược lại status = "con trong". Hai cách đều phải in đúng cả hai trạng thái.

## Bài thực hành có hướng dẫn

Thêm sách mã 3 tên Mat Biec, chưa mượn. Sau đó chuyển toàn bộ khối for thành hàm show_books(items) và gọi với books.

Hãy làm trước khi đọc phần đối chiếu. Ghi đầu vào và kết quả mong đợi; chỉ thay một điều mỗi lần để dễ hiểu tác động.

## Lời giải đối chiếu và lý do

```python
def show_books(items):
    for book in items:
        if book["borrowed"]:
            status = "dang muon"
        else:
            status = "con trong"
        print(book["id"], book["title"], status)

show_books(books)
```

Hàm nhận danh sách qua items nên không cần biết tên biến bên ngoài. Lời gọi nằm sau phần định nghĩa và không thụt vào trong hàm. Nếu chỉ định nghĩa mà chưa gọi, không có bảng sách xuất hiện.

## Điều kiện hoàn thành

Đổi thứ tự hai dictionary: mã và trạng thái vẫn đi cùng đúng tên. Đổi riêng borrowed của mã 3: chỉ trạng thái đó thay đổi. Viết một câu giải thích tại sao mã trùng sẽ gây khó khăn khi mượn sách.

Nếu chưa đạt, chỉ ra bước nhỏ nhất chưa hoạt động, kiểm tra dữ liệu đầu vào và đọc thông báo lỗi. Một bài hoàn thành gồm kết quả chạy được và lời giải thích của bạn, không chỉ bản code giống ví dụ.
