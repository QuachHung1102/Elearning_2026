## Nhận câu trả lời bằng biến và input

**Cách học:** bài đọc và thực hành độc lập, không cần video. Dự kiến 25–40 phút gồm thời gian tự làm; tốc độ của bạn có thể khác. Hoàn thành bài trước hoặc tự giải thích được ví dụ của bài đó.

### Sau bài này

Lưu hai câu trả lời vào biến và ghép thành thông báo.

## Hiểu từng bước

Một chương trình tương tác cần nhận thông tin mới mỗi lần chạy. `input("Biet danh cua ban: ")` hiển thị lời nhắc và chờ bạn gõ trong terminal. Nhấn Enter để hoàn tất câu trả lời. Trong file chương trình này, `input` trả về một chuỗi văn bản.

`nickname = input(...)` thực hiện phần bên phải trước, rồi gán kết quả cho tên `nickname`. Một dấu `=` là phép gán, không phải phép so sánh. Biến là tên để dùng lại giá trị; khi gán giá trị mới cho cùng tên, giá trị được tham chiếu bởi tên đó thay đổi.

`print(nickname)` lấy giá trị của biến. `print("nickname")` in nguyên chữ nickname. Đây là khác biệt quan trọng giữa tên dùng trong chương trình và văn bản viết sẵn. Trong ví dụ cuối, biệt danh và tên sách không có dấu nháy ở dòng in, còn cụm `"muon chia se"` có dấu nháy vì nó là phần cố định.

Hai câu hỏi dùng hai biến để tránh ghi đè nhau. `print` nhận nhiều phần ngăn bằng dấu phẩy và mặc định thêm khoảng trắng giữa chúng. Tên sách có nhiều từ vẫn được nhận đầy đủ đến khi bạn nhấn Enter.

Python phân biệt hoa thường: `Book` không phải `book`. Nếu gặp `NameError`, tìm nơi gán biến rồi đối chiếu tên đang sử dụng. Ở bài này câu trả lời chưa được kiểm tra và chưa được lưu thành file; chạy lại thì bạn nhập lại. Đó là giới hạn của phiên bản hiện tại, không phải máy bị quên một file đã lưu.

## Chạy một ví dụ hoàn chỉnh

Đọc và dự đoán đầu ra trước khi chạy. Tạo file riêng cho bài này để không ghi đè bài trước.

```python
nickname = input("Biet danh cua ban: ")
book = input("Cuon sach ban muon chia se: ")
print(nickname, "muon chia se", book)
```

## Tài liệu để tự làm

[Tệp bắt đầu](/downloads/projects/python-02-starter.py) · [Lời giải đối chiếu](/downloads/projects/python-02-solution.py). Lưu bản bắt đầu thành `my-work.py`, chạy `python my-work.py` trong thư mục đó. Nếu liên kết mở nội dung trong trình duyệt, dùng Lưu liên kết thành để giữ file `.py`.

## Tự làm trước khi xem lời giải

Hỏi biệt danh và tên sách rồi in một câu gồm cả hai. Thử tên sách có nhiều từ.

## Kiểm tra

Nhập BanA và Mat Biec phải có cả hai trong kết quả. Đổi dữ liệu, kết quả đổi theo.

Ghi một đầu vào, kết quả mong đợi và kết quả thực tế. Nếu khác nhau, ghi thay đổi bạn đã thử.

## Gợi ý từng bước

1. Dùng hai lần input và hai tên biến khác nhau.
2. print(nickname, "muon chia se", book) ghép các phần bằng khoảng trắng.

## Đối chiếu lời giải

Mở python-02-solution.py sau khi đã thử. Chạy cùng đầu vào với bản của bạn. Giải thích một khác biệt thay vì chép lại cả file. Lời giải là một cách làm, không phải cách duy nhất.

## Nghĩ thêm

Sự khác nhau giữa book và "book" là gì?



## Trước khi đánh dấu hoàn thành

Bạn cần chạy được bản của mình, giải thích một dòng bằng lời riêng và thử thêm một đầu vào hoặc thay đổi khác ví dụ. Ghi lại một lỗi đã gặp, cách bạn kiểm tra và kết quả sau khi sửa. Việc xem lời giải không thay cho việc tự chạy và giải thích.
