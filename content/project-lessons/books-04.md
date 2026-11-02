# Kiểm thử và hoàn thiện tủ sách

Một chương trình chạy được với dữ liệu mẫu mới đi được nửa đường. Trước khi đưa cho người khác dùng, hãy kiểm tra xem chương trình phản hồi thế nào khi thao tác không diễn ra như dự kiến.

## Mục tiêu

Sau bài này, bạn có thể lập bảng kiểm thử, tái hiện một lỗi và sửa một điểm giúp người khác dùng công cụ dễ hơn. Bạn cần phiên bản tủ sách đã có tìm kiếm, mượn/trả và lưu JSON từ các bài trước. Dành khoảng 25–35 phút để thực hành ngoài thời gian xem video.

## Chuẩn bị một bản dữ liệu thử

Sao chép thư mục dự án trước khi thử. Dùng tên giả và một vài cuốn sách do bạn tự đặt. Không nhập thông tin liên hệ thật vào dữ liệu luyện tập. Mở lại ứng dụng sau mỗi lần thử lưu để kiểm tra dữ liệu trên ổ đĩa, thay vì chỉ nhìn thông báo “đã lưu”.

## Bảng kiểm thử có kết quả mong đợi

Tạo một tệp `kiem-thu.txt`. Mỗi dòng ghi ba điều: dữ liệu ban đầu, thao tác, kết quả mong đợi.

| Tình huống | Thao tác | Điều cần kiểm tra |
| --- | --- | --- |
| Có sách tên Python | Tìm `python` | Tìm được dù khác chữ hoa |
| Không có tên phù hợp | Tìm một tên khác | Có lời giải thích, chương trình không dừng |
| Sách đang còn | Mượn bằng một mã hợp lệ | Trạng thái đổi sang đang mượn |
| Sách đã mượn | Mượn tiếp cùng mã | Từ chối, không báo mượn thành công lần nữa |
| Sách đang mượn | Trả sách | Đổi trạng thái về chưa mượn |
| Đã thay đổi dữ liệu | Lưu, thoát, mở lại | Trạng thái mới vẫn còn |

Thực hiện từng dòng trên bản dữ liệu thử. Ghi “đạt” chỉ sau khi đã quan sát kết quả. Nếu kết quả khác dự kiến, ghi nguyên văn thao tác đã nhập; lời mô tả “nó không chạy” chưa đủ để tái hiện lỗi.

## Sửa một lỗi có thể chứng minh

Ví dụ: tìm tên sách có khoảng trắng ở đầu không ra kết quả. Đầu vào `"  python  "` vẫn thể hiện cùng một ý định với `"python"`. Trước khi tìm kiếm, chuẩn hóa từ khóa:

```python
keyword = input("Tên sách cần tìm: ").strip().casefold()
```

Đây là dòng để thay phần nhận từ khóa trong chương trình của bạn, không phải toàn bộ ứng dụng. Áp dụng cùng cách chuẩn hóa cho tên sách khi so sánh. Sau khi sửa, thử lại cả tên có khoảng trắng và tên bình thường. Một bản sửa tốt phải giải quyết lỗi và giữ cho tình huống cũ vẫn đúng.

## Nhờ một người dùng thử

Đưa ba nhiệm vụ, không chỉ dẫn từng phím: tìm một cuốn sách, mượn nó, rồi trả và lưu lại. Quan sát chỗ họ dừng lại. Nếu họ không hiểu mã sách, hãy hiển thị ví dụ mã ngay cạnh lời nhắc. Nếu họ không biết cần lưu, cân nhắc thông báo rõ sau mỗi thay đổi. Không tự nhận rằng có người đã thử nếu bạn chưa thực hiện bước này.

## Bài thực hành độc lập

Chọn một thay đổi nhỏ: xác nhận trước khi thoát khi chưa lưu; hiển thị số sách còn; hoặc làm thông báo khi nhập mã không tồn tại dễ hiểu hơn. Trước khi viết code, thêm hai dòng vào bảng kiểm thử cho thay đổi đó. Viết xong, chạy lại sáu tình huống ở trên.

Nếu chưa biết bắt đầu từ đâu, hãy chọn thông báo mã không tồn tại. Gợi ý: tách việc tìm theo mã thành một hàm, cho hàm trả về `None` khi không thấy; phần menu kiểm tra kết quả rồi mới cập nhật sách. Tránh bắt mọi ngoại lệ chỉ để in “có lỗi”, vì cách đó che mất vị trí cần sửa.

## Hoàn thành khi

- Bạn có bảng kiểm thử ghi kết quả thật cho ít nhất sáu tình huống.
- Bạn lưu và mở lại được dữ liệu sau thao tác mượn/trả.
- Bạn chứng minh được một cải tiến bằng kết quả trước và sau.
- Bạn giải thích được công cụ hiện lưu gì, và phần nào còn cần làm trước khi dùng rộng rãi.

[Tải mã tham khảo hoàn chỉnh](/downloads/projects/book-sharing.py). So sánh cách tổ chức sau khi tự làm; không cần chép y nguyên để hoàn thành bài học.
