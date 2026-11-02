## Tìm đúng sách còn trống

Giữ danh sách ở bài trước. Mình chỉ trả về cuốn chưa được mượn và có tên chứa từ khóa:

```python
def find_available(books, keyword):
    keyword = keyword.strip().casefold()
    return [book for book in books
            if not book["borrowed"]
            and keyword in book["title"].casefold()]

print(find_available(books, "DE MEN"))
```

`strip()` bỏ khoảng trắng thừa. `casefold()` giúp không phân biệt chữ hoa/thường; nó **không** bỏ dấu tiếng Việt. Từ khóa rỗng khớp mọi tên, nên kết quả là toàn bộ sách còn trống.

## Một lượt mượn chỉ thay đổi một cuốn

```python
def borrow(books, book_id):
    for book in books:
        if book["id"] == book_id and not book["borrowed"]:
            book["borrowed"] = True
            return True
    return False

print(borrow(books, 1))  # True trong lần đầu
print(borrow(books, 1))  # False: đã được mượn
print(borrow(books, 99)) # False: không có mã này
```

Nếu không có sách phù hợp, trả về `False` giúp giao diện giải thích kết quả thay vì báo thành công sai.

### Tự làm

Viết hàm `return_book` theo chiều ngược lại. Kiểm tra ba trường hợp: mã đúng đang mượn, mã đúng chưa mượn, mã không tồn tại. Sau khi trả sách, tìm lại bằng từ khóa và kiểm tra nó xuất hiện.

### Điểm còn thiếu

Các thay đổi hiện chỉ nằm trong bộ nhớ. Tắt chương trình thì sao? Bài tiếp theo bổ sung file JSON và một menu có thể dùng thật trên máy của bạn.

<!-- expanded-lesson -->
## Học sâu hơn: mục tiêu và cách làm

**Mục tiêu:** Tìm sách còn trống, mượn và trả đúng cuốn. **Thời gian thực hành dự kiến:** 40–55 phút. Bạn có thể dừng giữa các phần; bài học này hoàn thành được bằng chữ và code, không phụ thuộc video.

Tìm kiếm có hai điều kiện: tên khớp và sách chưa được mượn. Từ and yêu cầu cả hai đúng. not borrowed đảo trạng thái boolean, nên cuốn có borrowed=True bị loại. Từ khóa được strip và casefold để chấp nhận khoảng trắng hai đầu và hoa/thường; dấu tiếng Việt vẫn giữ nguyên.

Biểu thức trong ngoặc vuông ở ví dụ đầu là list comprehension: cách viết gọn một vòng lặp xây danh sách. Nếu chưa quen, tạo matches=[], duyệt từng book, nếu thỏa điều kiện thì matches.append(book), cuối cùng return matches. Kết quả chứa dictionary chứ không chỉ tên, để bạn vẫn biết mã của cuốn đó.

Hàm borrow trả True khi có thay đổi mới và False khi không thể thực hiện yêu cầu. Không nên hiểu True là “đang mượn” trong mọi hàm: hàm trả sách thành công cũng trả True dù trạng thái mới là False. Tên hàm và ý nghĩa giá trị trả về cần được giải thích rõ.

Từ khóa rỗng khớp mọi tên, nhưng điều kiện chưa mượn vẫn áp dụng. Một sách không xuất hiện có thể do đã được mượn, không nhất thiết do sai tên. Thử cả đầu vào hợp lệ và không có kết quả trước khi kết luận tìm kiếm bị lỗi.

## Bài thực hành có hướng dẫn

Viết return_book, kiểm tra trả một sách đang mượn, trả lại lần nữa và trả mã không tồn tại. Sau đó tìm lại cuốn vừa trả.

Hãy làm trước khi đọc phần đối chiếu. Ghi đầu vào và kết quả mong đợi; chỉ thay một điều mỗi lần để dễ hiểu tác động.

## Lời giải đối chiếu và lý do

```python
def return_book(books, book_id):
    for book in books:
        if book["id"] == book_id and book["borrowed"]:
            book["borrowed"] = False
            return True
    return False
```

Với dữ liệu ban đầu, return_book(books, 2) là True; gọi lại là False; mã 99 cũng False. Đặt return False sau vòng lặp để không dừng trước khi xét sách thứ hai. Trong file hoàn chỉnh, set_loan gộp mượn và trả bằng một tham số trạng thái; đó là cách giảm lặp logic, không phải yêu cầu bạn phải dùng ngay.

## Điều kiện hoàn thành

Ghi kết quả trước/sau cho một chuỗi tìm → mượn → tìm → trả → tìm. Không báo thành công cho mã 99. Giải thích vì sao chỉ thử sách đầu có thể bỏ sót lỗi return nằm sai vị trí.

Nếu chưa đạt, chỉ ra bước nhỏ nhất chưa hoạt động, kiểm tra dữ liệu đầu vào và đọc thông báo lỗi. Một bài hoàn thành gồm kết quả chạy được và lời giải thích của bạn, không chỉ bản code giống ví dụ.
