## Lưu lại sau khi đóng chương trình

[Tải book-sharing.py](/downloads/projects/book-sharing.py), đặt trong một thư mục riêng và chạy `python book-sharing.py` (một số máy Windows dùng `py book-sharing.py`). Menu dùng `f` để tìm, `b` để mượn, `r` để trả và `q` để thoát.

Lần đầu, chương trình lấy ba sách mẫu. Sau một thay đổi thành công, nó tạo `books.json` trong cùng thư mục. Phần lưu dùng thư viện chuẩn:

```python
import json
from pathlib import Path

path = Path("books.json")
path.write_text(json.dumps(books, ensure_ascii=False, indent=2), encoding="utf-8")
restored = json.loads(path.read_text(encoding="utf-8"))
```

Trong mã hoàn chỉnh, đường dẫn dựa vào vị trí file chương trình để chạy từ thư mục nào cũng tìm đúng dữ liệu. Hàm `load_books` kiểm tra cấu trúc và mã trùng; nếu file hỏng, chương trình dừng thay vì âm thầm ghi đè.

### Thử như một người dùng

1. Tìm tất cả sách bằng từ khóa rỗng. Mượn mã `1`, thoát, chạy lại: cuốn này không còn trong kết quả sách trống.
2. Trả mã `1`. Nó phải xuất hiện lại.
3. Nhập `abc` thay cho mã sách: menu phải giải thích lỗi, không bị văng.
4. Sao chép file dữ liệu để dự phòng, rồi thử một mã trùng trong bản thử. Chương trình cần báo lỗi rõ ràng.

### Làm tốt hơn một chút

Thêm tìm kiếm không dấu hoặc bộ lọc thể loại. Chọn **một** thay đổi, ghi đầu vào và kết quả mong đợi trước khi sửa.

Đây là công cụ chạy trên một máy, chưa xử lý nhiều người mượn đồng thời và chưa xác minh ai được mượn. Hãy thử bằng sách mẫu trước khi đề nghị lớp dùng chung.

<!-- expanded-lesson -->
## Học sâu hơn: mục tiêu và cách làm

**Mục tiêu:** Lưu trạng thái qua lần chạy và bàn giao một dự án có kiểm thử. **Thời gian thực hành dự kiến:** 45–60 phút. Bạn có thể dừng giữa các phần; bài học này hoàn thành được bằng chữ và code, không phụ thuộc video.

Dữ liệu trong biến sống trong phiên chạy; file lưu trạng thái để phiên sau đọc lại. json.dumps tạo văn bản JSON; write_text ghi văn bản. read_text đọc văn bản và json.loads chuyển nó về dữ liệu Python. JSON dùng true/false chữ thường, Python dùng True/False; thư viện xử lý chuyển đổi.

File hoàn chỉnh chỉ dùng dữ liệu mẫu khi file chưa tồn tại. Nếu file có nhưng sai, chương trình báo lỗi và dừng thay vì giả vờ đó là lần chạy đầu. Việc đọc JSON thành công chưa chứng minh cấu trúc đúng; load_books kiểm tra danh sách, từng trường và mã trùng.

Menu là khung hỗ trợ: while lặp, q dùng break để thoát; input trả văn bản và int thử chuyển mã thành số. Nếu nhập abc, except ValueError hiện lời nhắc và continue quay lại menu. Bạn không cần học thuộc toàn bộ khung mới có thể giải thích đường đi của một lượt mượn.

Sau thay đổi thành công, save_books được gọi. Nếu ghi lỗi, dữ liệu trong bộ nhớ đã đổi nhưng file có thể chưa được cập nhật; chương trình nói rõ điều đó. Đây chưa phải hệ thống cơ sở dữ liệu có giao dịch, sao lưu tự động hay hỗ trợ nhiều máy sửa cùng lúc.

## Bài thực hành có hướng dẫn

Tạo một thư mục thử riêng, lưu source và chạy chuỗi mượn → thoát → mở lại → trả. Sao lưu dữ liệu trước khi cố tình sửa hỏng JSON trong bản thử. Viết README ngắn cho người khác chạy.

Hãy làm trước khi đọc phần đối chiếu. Ghi đầu vào và kết quả mong đợi; chỉ thay một điều mỗi lần để dễ hiểu tác động.

## Lời giải đối chiếu và lý do

README tham khảo: “Cần Python 3. Chạy python book-sharing.py trong thư mục dự án. f tìm sách còn trống; b mượn bằng mã; r trả bằng mã; q thoát. Trạng thái lưu trong books.json cạnh chương trình. Đây là công cụ một máy, dùng sách mẫu và chưa xác minh người mượn.”

Khi file JSON hỏng, khôi phục từ bản sao hợp lệ sau khi kiểm tra, không xóa file thật để che lỗi. Với file có hai sách cùng mã, bản hoàn chỉnh phải từ chối đọc. Mã mới cho sách cần được chọn có chủ đích, không thay ngẫu nhiên lúc khởi động.

## Điều kiện hoàn thành

Nộp file Python, dữ liệu mẫu, README và bảng thử có đầu vào/kết quả thực tế. Nhờ một người thử tìm và mượn; ghi một điểm khó hiểu và một thay đổi. Nếu chưa có người thử, ghi đúng là tự kiểm tra.

Nếu chưa đạt, chỉ ra bước nhỏ nhất chưa hoạt động, kiểm tra dữ liệu đầu vào và đọc thông báo lỗi. Một bài hoàn thành gồm kết quả chạy được và lời giải thích của bạn, không chỉ bản code giống ví dụ.
