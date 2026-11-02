## Bắt đầu với dự án tủ sách

Bạn sẽ làm một công cụ Python chạy trên máy tính để tìm sách đang còn, ghi nhận mượn/trả và giữ trạng thái sau khi đóng chương trình. Một cuốn sách có mã riêng, tên và trạng thái; phiên bản này không lưu tên, số điện thoại hay tài khoản người mượn.

Toàn bộ dự án này miễn phí: video, bài đọc, mã nguồn và bài tự kiểm tra. Bạn có thể học bằng phần chữ và code nếu chưa xem video.

ZIP gồm mã nguồn, dữ liệu mẫu và bài đọc để dùng offline; bốn video được xem trên website.

### 1. Chuẩn bị

- Một máy tính có Python 3 và trình soạn thảo văn bản. Không cần cài thư viện ngoài.
- Biết cách mở một thư mục và chạy một tệp Python. Nếu hàm, list hoặc dictionary còn mới, dừng lại ở từng ví dụ nhỏ trong bài đọc.
- Tải ZIP, giải nén vào một thư mục mới như `codingbuddy-books`. Không chạy trực tiếp bên trong cửa sổ xem ZIP.

Các tệp quan trọng trong bộ tải:

| Tệp | Dùng để làm gì? |
| --- | --- |
| `book-sharing.py` | Chương trình hoàn chỉnh để chạy và đối chiếu |
| `book-sharing-starter.py` | Khung bài tập có TODO để bạn tự viết; chưa có menu hoàn chỉnh |
| `books.example.json` | Ba sách mẫu; bản tham khảo, không phải tệp đang được chương trình cập nhật |
| `book-sharing-README.vi.md` / `book-sharing-README.en.md` | Hướng dẫn chạy bằng tiếng Việt / tiếng Anh |
| `book-sharing-TESTING.md` | Bảng kiểm thử và kết quả mong đợi |
| `lessons/` | Bốn bài đọc trong bản ZIP, có thể học offline |

### 2. Kiểm tra Python

Mở Terminal hoặc Command Prompt trong thư mục vừa giải nén. Chạy:

```text
python --version
```

Nếu máy Windows chưa nhận lệnh `python`, thử `py --version`. Trên một số máy macOS/Linux, dùng `python3 --version`. Dùng cách gọi hoạt động trên máy của bạn cho các lệnh bên dưới.

### 3. Chạy phiên bản hoàn chỉnh

```text
python book-sharing.py
```

Tương đương trên máy dùng Python Launcher hoặc `python3`:

```text
py book-sharing.py
python3 book-sharing.py
```

Chỉ chọn một lệnh phù hợp, không cần chạy cả ba cùng lúc. Khi thấy menu, nhập một chữ rồi nhấn Enter:

| Phím | Thao tác |
| --- | --- |
| `f` | Tìm sách đang còn theo tên. Để từ khóa trống để xem tất cả sách còn |
| `b` | Mượn sách bằng mã số nguyên |
| `r` | Trả sách bằng mã |
| `q` | Thoát chương trình |

Trong dữ liệu ban đầu, sách mã `1` và `3` đang còn; sách `2` đã được mượn. Ví dụ một lần thử:

```text
[f]ind, [b]orrow, [r]eturn, [q]uit: f
Title keyword (blank = all available): de men
1 De Men Phieu Luu Ky
[f]ind, [b]orrow, [r]eturn, [q]uit: b
Book ID: 1
Saved.
```

Tìm lại `de men`: chương trình không liệt kê cuốn đó vì nó đang được mượn. Nhập `r`, rồi `1`, để trả sách và thử tìm lại.

### 4. Dữ liệu được lưu ở đâu?

Sau một lần mượn/trả làm thay đổi trạng thái và ghi thành công, chương trình tạo `books.json` cạnh `book-sharing.py`. Khi mở lại, nó đọc tệp này. Không có nút lưu riêng và thao tác tìm kiếm không tạo tệp dữ liệu.

`books.example.json` chỉ là bản mẫu để đọc hoặc sao chép trong thư mục thử. Muốn tự dùng bản mẫu, sao chép nó thành `books.json` trước khi chạy; không ghi đè dữ liệu bạn muốn giữ. Nếu `books.json` chưa có, chương trình tự dùng ba sách mẫu đã được khai báo trong mã.

Nếu tệp dữ liệu có nhưng hỏng, chương trình báo lỗi và dừng. Không xóa tệp thật chỉ để làm thông báo biến mất; hãy kiểm tra hoặc khôi phục từ một bản sao đúng. Trước khi thử sửa JSON có chủ đích, sao chép cả thư mục dự án.

### 5. Học theo bốn bước

1. **Dữ liệu sách:** chạy một danh sách nhỏ, đọc `id`, `title`, `borrowed` và hiển thị trạng thái. Mã sách không đổi khi đổi thứ tự danh sách.
2. **Tìm, mượn, trả:** đọc cách `find_available` lọc sách và `set_loan` đổi trạng thái. Thử tên không có và mã không tồn tại, không chỉ trường hợp thành công.
3. **Lưu và mở lại:** xem đường đi từ JSON đến dữ liệu Python và ngược lại. Kiểm tra bằng cách thoát rồi chạy lại, thay vì chỉ tin thông báo `Saved.`.
4. **Kiểm thử:** dùng bảng trong `book-sharing-TESTING.md`, ghi kết quả thực tế và giải thích một cải tiến của bạn.

Khi dùng khung TODO, hãy sửa trong một bản sao. Nó chủ động báo `NotImplementedError` nếu gọi hàm chưa viết; đó là dấu nhắc phần bài tập còn thiếu. Dùng `book-sharing.py` để thử toàn bộ menu ngay.

### Nếu gặp lỗi

- **Không tìm thấy tệp:** kiểm tra Terminal có đang ở đúng thư mục và tên không bị thành `book-sharing.py.txt`.
- **Python không được nhận diện:** thử `py` hoặc `python3` như trên; cần có Python 3 được cài trên máy.
- **Mã sách không hợp lệ:** nhập `1`, không nhập `1.0` hoặc tên sách vào câu hỏi `Book ID`.
- **Không lưu được:** chuyển bản thử sang thư mục bạn có quyền ghi và kiểm tra lại. Nếu báo thay đổi chỉ ở trong bộ nhớ, không coi lần lưu đó là thành công.
- **Tìm kiếm không dấu:** `casefold()` hỗ trợ khác chữ hoa/thường; bản này chưa tự bỏ dấu tiếng Việt.

### Hoàn thành khi

Bạn tự chạy được chuỗi tìm → mượn → thoát → mở lại → trả; giải thích được dữ liệu lưu gì; và ghi lại ít nhất sáu tình huống đã thử. Chọn thêm một thay đổi nhỏ nếu muốn: hiển thị số sách còn, thêm thể loại hoặc làm thông báo dễ hiểu hơn.

Đây là bản học tập cho một máy, chưa có xác minh người mượn, nhiều người sửa đồng thời hay sao lưu tự động. Thử với sách mẫu trước khi đề nghị lớp sử dụng thật.
