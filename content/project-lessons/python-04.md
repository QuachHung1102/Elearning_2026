## Danh sách và vòng lặp

**Cách học:** bài đọc và thực hành độc lập, không cần video. Dự kiến 25–40 phút gồm thời gian tự làm; tốc độ của bạn có thể khác. Hoàn thành bài trước hoặc tự giải thích được ví dụ của bài đó.

### Sau bài này

Duyệt một danh sách và đếm số phần tử.

## Hiểu từng bước

Danh sách (`list`) giữ nhiều giá trị theo thứ tự. Trong ví dụ, mỗi tên sách là một chuỗi; ngoặc vuông chứa danh sách và dấu phẩy phân cách các phần tử. Một tên có nhiều từ vẫn là một phần tử. Hai phần tử có cùng tên vẫn được tính là hai mục riêng.

`for title in books:` lần lượt gán từng phần tử vào tên `title`, rồi thực hiện khối thụt vào. `books` là cả danh sách; `title` là giá trị đang được xử lý trong mỗi lượt. Bạn có thể đặt tên biến vòng lặp khác, miễn dùng nhất quán.

`len(books)` đếm phần tử trong danh sách, không đếm chữ trong tên sách và không tự loại mục trùng. Đặt dòng in tổng ngoài vòng lặp để nó chỉ chạy một lần sau khi duyệt xong. Nếu đặt trong vòng lặp, tổng sẽ lặp lại sau mỗi cuốn dù con số có thể vẫn đúng.

Thêm một mục vào dữ liệu rồi giữ nguyên vòng lặp. Chương trình tự có thêm một lượt xử lý, nên không cần chép thêm lệnh hiển thị. Đây là bước đầu tách dữ liệu khỏi logic làm việc với dữ liệu.

Với danh sách rỗng `[]`, vòng lặp không chạy lượt nào. Dòng in tổng bên ngoài vẫn chạy và hiện 0. Hãy thử điều này trên bản sao để hiểu thụt dòng thay vì ghi nhớ một mẫu. Nếu thêm sách mà kết quả không đổi, hãy kiểm tra đã lưu file và có đang in một con số cố định thay vì dùng `len` không.

## Chạy một ví dụ hoàn chỉnh

Đọc và dự đoán đầu ra trước khi chạy. Tạo file riêng cho bài này để không ghi đè bài trước.

```python
books = ["De Men Phieu Luu Ky", "The Little Prince", "Mat Biec"]
for title in books:
    print("Sach:", title)
print("So cuon sach:", len(books))
```

## Tài liệu để tự làm

[Tệp bắt đầu](/downloads/projects/python-04-starter.py) · [Lời giải đối chiếu](/downloads/projects/python-04-solution.py). Lưu bản bắt đầu thành `my-work.py`, chạy `python my-work.py` trong thư mục đó. Nếu liên kết mở nội dung trong trình duyệt, dùng Lưu liên kết thành để giữ file `.py`.

## Tự làm trước khi xem lời giải

Thêm một cuốn vào danh sách, in mỗi cuốn một dòng với nhãn Sach:, rồi in số cuốn đúng một lần.

## Kiểm tra

Ba dòng sách và một dòng tổng bằng 3. Thêm cuốn thứ tư thì tổng tự đổi thành 4.

Ghi một đầu vào, kết quả mong đợi và kết quả thực tế. Nếu khác nhau, ghi thay đổi bạn đã thử.

## Gợi ý từng bước

1. Các mục trong list được ngăn bằng dấu phẩy.
2. Dòng in tổng không thụt vào cùng phần thân for.

## Đối chiếu lời giải

Mở python-04-solution.py sau khi đã thử. Chạy cùng đầu vào với bản của bạn. Giải thích một khác biệt thay vì chép lại cả file. Lời giải là một cách làm, không phải cách duy nhất.

## Nghĩ thêm

Một dòng trong for và một dòng sau for được chạy khác nhau thế nào?



## Trước khi đánh dấu hoàn thành

Bạn cần chạy được bản của mình, giải thích một dòng bằng lời riêng và thử thêm một đầu vào hoặc thay đổi khác ví dụ. Ghi lại một lỗi đã gặp, cách bạn kiểm tra và kết quả sau khi sửa. Việc xem lời giải không thay cho việc tự chạy và giải thích.
