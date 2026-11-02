## CSS: làm nội dung dễ đọc

**Mục tiêu:** css: làm nội dung dễ đọc bằng một trang hướng dẫn tủ sách. **Thời gian thực hành dự kiến:** 30–45 phút. Dùng file index.html từ bài trước. Giữ một bản sao trước khi sửa. Đây là bài học bằng chữ, không cần chờ video.

## Giải thích và làm từng bước

CSS chọn phần tử rồi đặt quy tắc trình bày. Trong `p { line-height: 1.7; }`, p là bộ chọn, line-height là thuộc tính và 1.7 là giá trị. Các thuộc tính ngăn bằng dấu chấm phẩy. Quy tắc nằm trong style trong head hoặc một file CSS được liên kết. Bài này dùng style để bạn chỉ quản lý một file.

`max-width` giới hạn dòng văn bản trên màn hình lớn; `margin: auto` chia khoảng trống hai bên. Padding tạo khoảng cách bên trong vùng nội dung. Line-height không có đơn vị là hệ số theo cỡ chữ, giúp dòng cách nhau khi thay đổi kích thước chữ.

Màu chữ và nền cần đủ tương phản. Đừng chỉ dùng màu để phân biệt hành động: liên kết nên có gạch chân và focus rõ. Tránh xóa outline chỉ vì nó không hợp thẩm mỹ. Người dùng bàn phím cần biết đang ở đâu.

CSS không thay thế cấu trúc HTML. Nếu tạm bỏ style, nội dung vẫn phải theo thứ tự có nghĩa. Bạn có thể đặt cùng class cho nhiều phần cần cách trình bày giống nhau; đừng sao chép một kiểu inline dài vào mọi phần tử.

Khi quy tắc không áp dụng, kiểm tra bộ chọn có đúng phần tử, dấu ngoặc nhọn có khép và file đã lưu chưa. Nếu dùng CSS riêng, kiểm tra đường dẫn href trước khi đổi hàng loạt thuộc tính.

## Ví dụ để chạy

Giữ HTML bài trước; chèn các quy tắc sau vào style trong head, không dán CSS trực tiếp vào body.

```css
/* Đặt bên trong thẻ style trong head của trang bài trước. */
* { box-sizing: border-box; }
body { margin: 0; background: #f3f1e8; color: #242520; font: 18px/1.7 system-ui, sans-serif; }
main { max-width: 720px; margin: auto; padding: 32px 24px; }
h1, h2 { line-height: 1.25; }
li { margin-block: 12px; }
a { color: #71351f; text-underline-offset: 4px; }
a:focus-visible { outline: 3px solid #71351f; outline-offset: 4px; }
```

## Tự làm trước khi xem lời giải

Áp dụng CSS cho trang trước. Tạo class .note cho một lưu ý, với border-left và padding. Tạm bỏ style để kiểm tra thứ tự nội dung vẫn hợp lý.

## Kiểm tra kết quả

Nội dung có khoảng thở, không chạy dài toàn màn hình; liên kết rõ và có focus khi Tab. Không có mục bị mất chỉ vì đổi style.

Ghi hành động bạn thử, kết quả mong muốn và kết quả thực tế. Nếu khác nhau, lưu lại ví dụ nhỏ nhất còn gây lỗi để tìm nguyên nhân.

## Gợi ý và lời giải có giải thích

Thêm `.note { border-left: 4px solid #71351f; padding-left: 16px; }` và `<p class="note">Hỏi trước khi lấy sách.</p>`. Class nối HTML với CSS; dấu chấm chỉ dùng ở bộ chọn CSS.

Một lời giải tham khảo hoàn chỉnh nằm trong [web-foundations.html](/downloads/projects/web-foundations.html). Mở để xem kết quả hoặc lưu file rồi đọc bằng trình soạn thảo. Chỉ đối chiếu sau khi tự làm; câu chữ và thiết kế của bạn có thể khác mà vẫn đáp ứng yêu cầu.

## Tự đánh giá

Bạn có thể giải thích vai trò của phần mới thêm mà không đọc lại hướng dẫn không? Đổi một nội dung rồi kiểm tra lại. Bài hoàn thành khi bạn hiểu thay đổi, không chỉ khi ảnh chụp giống ví dụ.
