## Điều kiện: đúng, sai và bỏ trống

**Cách học:** bài đọc và thực hành độc lập, không cần video. Dự kiến 25–40 phút gồm thời gian tự làm; tốc độ của bạn có thể khác. Hoàn thành bài trước hoặc tự giải thích được ví dụ của bài đó.

### Sau bài này

Dùng if/elif/else để phản hồi ba loại câu trả lời.

## Hiểu từng bước

Điều kiện giúp chương trình chọn hành động theo dữ liệu. Một câu đố cần phân biệt đúng, sai và chưa trả lời. `answer == "print"` so sánh giá trị, khác với dấu `=` dùng để gán. Phép so sánh cho kết quả đúng hoặc sai.

Trong chuỗi `if / elif / else`, Python xét từ trên xuống và thực hiện nhánh đầu tiên thỏa điều kiện. `else` nhận các trường hợp còn lại. Dấu hai chấm bắt đầu khối lệnh; phần thụt vào bên dưới thuộc nhánh đó. Các chữ `if`, `elif`, `else` phải cùng mức thụt dòng.

Hai dấu nháy liền nhau `""` là chuỗi rỗng. Nó khác với một chuỗi chứa dấu cách. Ví dụ dùng `strip()` để bỏ khoảng trắng hai đầu, rồi `lower()` chuyển chữ hoa thành chữ thường trước khi gán kết quả vào `answer`. Vì vậy câu trả lời chỉ chứa khoảng trắng trở thành rỗng.

Đây là lựa chọn thiết kế cho câu đố: chấp nhận PRINT như print. Không phải dữ liệu nào cũng nên chuyển chữ thường. Cách này cũng không sửa chữ gõ sai hoặc khoảng trắng ở giữa tên hàm.

Hãy phân biệt hai kiểu vấn đề. Thiếu dấu hai chấm có thể khiến chương trình không chạy vì cú pháp sai. Chưa xử lý chữ hoa có thể khiến chương trình vẫn chạy nhưng phản hồi không đúng mục tiêu. Vì vậy việc không có thông báo lỗi chưa chứng minh bài làm đã đúng; bạn cần thử nhiều đầu vào.

## Chạy một ví dụ hoàn chỉnh

Đọc và dự đoán đầu ra trước khi chạy. Tạo file riêng cho bài này để không ghi đè bài trước.

```python
answer = input("Ham nao hien thi chu trong Python? ").strip().lower()
if answer == "print":
    print("Dung roi!")
elif answer == "":
    print("Ban chua nhap cau tra loi.")
else:
    print("Chua dung. Goi y: ham minh dung o bai 1.")
```

## Tài liệu để tự làm

[Tệp bắt đầu](/downloads/projects/python-03-starter.py) · [Lời giải đối chiếu](/downloads/projects/python-03-solution.py). Lưu bản bắt đầu thành `my-work.py`, chạy `python my-work.py` trong thư mục đó. Nếu liên kết mở nội dung trong trình duyệt, dùng Lưu liên kết thành để giữ file `.py`.

## Tự làm trước khi xem lời giải

Hoàn thành phản hồi đúng, sai và bỏ trống. Kiểm tra thêm " PRINT " để chắc phần chuẩn hóa hoạt động.

## Kiểm tra

print và " PRINT " được chấp nhận; loop nhận gợi ý; Enter trống được nhắc nhập.

Ghi một đầu vào, kết quả mong đợi và kết quả thực tế. Nếu khác nhau, ghi thay đổi bạn đã thử.

## Gợi ý từng bước

1. So sánh câu trả lời sau khi strip và lower.
2. Nhánh elif answer == "" phải nằm trước else.

## Đối chiếu lời giải

Mở python-03-solution.py sau khi đã thử. Chạy cùng đầu vào với bản của bạn. Giải thích một khác biệt thay vì chép lại cả file. Lời giải là một cách làm, không phải cách duy nhất.

## Nghĩ thêm

Chương trình có thể chạy mà vẫn làm sai ý mình không? Cho một ví dụ.



## Trước khi đánh dấu hoàn thành

Bạn cần chạy được bản của mình, giải thích một dòng bằng lời riêng và thử thêm một đầu vào hoặc thay đổi khác ví dụ. Ghi lại một lỗi đã gặp, cách bạn kiểm tra và kết quả sau khi sửa. Việc xem lời giải không thay cho việc tự chạy và giải thích.
