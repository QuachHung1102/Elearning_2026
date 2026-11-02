## Hàm tìm kiếm và cách kiểm thử

**Cách học:** bài đọc và thực hành độc lập, không cần video. Dự kiến 25–40 phút gồm thời gian tự làm; tốc độ của bạn có thể khác. Hoàn thành bài trước hoặc tự giải thích được ví dụ của bài đó.

### Sau bài này

Viết hàm trả về danh sách tên khớp một từ khóa.

## Hiểu từng bước

Hàm gom một công việc thành phần có tên để gọi lại. `def find_titles(titles, keyword)` định nghĩa hàm nhận hai tham số: danh sách tên và từ khóa. Phần thân chỉ chạy khi hàm được gọi. Các dữ liệu bạn đưa lúc gọi được dùng qua tên tham số bên trong.

Ở bài này ta dùng lại danh sách chuỗi để tập trung vào hàm. `matches = []` tạo kết quả rỗng. Vòng lặp xét từng tên; phép `keyword in title` kiểm tra một chuỗi có nằm trong chuỗi khác không. Khi khớp, `append` thêm tên vào cuối danh sách kết quả.

`strip` bỏ khoảng trắng hai đầu từ khóa và `casefold` hỗ trợ so sánh không phân biệt hoa thường. Nó không loại dấu tiếng Việt. Hàm giữ tên gốc khi thêm vào kết quả nên cách viết tên không bị đổi. Từ khóa rỗng khớp mọi tên theo quy tắc chuỗi của Python; ở đây ta chấp nhận nó như cách xem tất cả tên.

`return` đưa kết quả về nơi gọi và kết thúc lần gọi hàm. `print` hiển thị thông tin. Tách hai việc giúp sau này bạn có thể đếm hoặc trình bày kết quả khác đi mà không sửa phần tìm kiếm. Bạn có thể viết `result = find_titles(titles, "Mat")` rồi `print(result)` để quan sát rõ hai bước.

Nếu đặt return bên trong vòng lặp, hàm có thể kết thúc ngay sau tên đầu. Tìm cuốn đầu có vẻ đúng nhưng tìm cuốn cuối thất bại. Vì vậy hãy thử đầu, cuối, không có kết quả và từ khóa rỗng. Một lần chạy thành công chưa chứng minh mọi trường hợp hoạt động.

## Chạy một ví dụ hoàn chỉnh

Đọc và dự đoán đầu ra trước khi chạy. Tạo file riêng cho bài này để không ghi đè bài trước.

```python
def find_titles(titles, keyword):
    matches = []
    for title in titles:
        if keyword.strip().casefold() in title.casefold():
            matches.append(title)
    return matches


titles = ["De Men Phieu Luu Ky", "The Little Prince", "Mat Biec"]
print(find_titles(titles, " DE MEN "))
print(find_titles(titles, "missing"))
```

## Tài liệu để tự làm

[Tệp bắt đầu](/downloads/projects/python-06-starter.py) · [Lời giải đối chiếu](/downloads/projects/python-06-solution.py). Lưu bản bắt đầu thành `my-work.py`, chạy `python my-work.py` trong thư mục đó. Nếu liên kết mở nội dung trong trình duyệt, dùng Lưu liên kết thành để giữ file `.py`.

## Tự làm trước khi xem lời giải

Hoàn thành find_titles, tìm đúng khi có khoảng trắng ở hai đầu và khác chữ hoa. Trả về list rỗng khi không có kết quả.

## Kiểm tra

" DE MEN " trả một tên, missing trả [], từ khóa rỗng trả cả ba tên.

Ghi một đầu vào, kết quả mong đợi và kết quả thực tế. Nếu khác nhau, ghi thay đổi bạn đã thử.

## Gợi ý từng bước

1. Chuẩn hóa cả từ khóa và title bằng casefold; strip chỉ cần cho từ khóa.
2. append chạy trong if; return chạy sau vòng lặp.

## Đối chiếu lời giải

Mở python-06-solution.py sau khi đã thử. Chạy cùng đầu vào với bản của bạn. Giải thích một khác biệt thay vì chép lại cả file. Lời giải là một cách làm, không phải cách duy nhất.

## Nghĩ thêm

Vì sao chỉ thử sách đầu tiên có thể bỏ sót lỗi?



## Trước khi đánh dấu hoàn thành

Bạn cần chạy được bản của mình, giải thích một dòng bằng lời riêng và thử thêm một đầu vào hoặc thay đổi khác ví dụ. Ghi lại một lỗi đã gặp, cách bạn kiểm tra và kết quả sau khi sửa. Việc xem lời giải không thay cho việc tự chạy và giải thích.
