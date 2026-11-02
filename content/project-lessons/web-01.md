## Một trang có cấu trúc

**Mục tiêu:** một trang có cấu trúc bằng một trang hướng dẫn tủ sách. **Thời gian thực hành dự kiến:** 30–45 phút. Không cần biết code trước; cần trình duyệt và trình soạn thảo văn bản. Đây là bài học bằng chữ, không cần chờ video.

## Giải thích và làm từng bước

Bạn sẽ tạo một trang thông tin tủ sách bằng HTML. HTML mô tả ý nghĩa của nội dung; nó không phải ảnh chụp của một trang. Thẻ mở và thẻ đóng bao quanh nội dung, chẳng hạn `<p>...</p>` là một đoạn văn. Một số thẻ như meta không có thẻ đóng.

`head` giữ thông tin về tài liệu: title xuất hiện ở tab trình duyệt, charset giúp đọc chữ tiếng Việt. `body` chứa nội dung người đọc thấy. `lang="vi"` khai báo ngôn ngữ. `h1` là tiêu đề chính, còn `h2` chia các mục; chọn cấp tiêu đề theo cấu trúc, không chỉ theo cỡ chữ.

Tạo thư mục `tu-sach`, mở trình soạn thảo văn bản, lưu ví dụ thành `index.html` với UTF-8. Mở file bằng trình duyệt. Sau mỗi thay đổi, lưu trong trình soạn thảo rồi tải lại trình duyệt. Không cần máy chủ hoặc tài khoản để làm bài này. Nếu trình duyệt hiện code như văn bản, kiểm tra tên file có bị thành index.html.txt không.

Danh sách có thứ tự `ol` phù hợp với các bước cần làm lần lượt; mỗi bước nằm trong li. Thay vì gõ số bằng tay trong nhiều đoạn, cấu trúc danh sách giúp trình duyệt giữ thứ tự và công cụ hỗ trợ đọc nhận ra các bước.

## Ví dụ để chạy

Tạo file index.html với toàn bộ nội dung sau.

```html
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tủ sách lớp mình</title>
</head>
<body>
  <main>
    <h1>Mượn sách từ tủ sách lớp</h1>
    <p>Trang mẫu hướng dẫn ba bước để tìm một cuốn sách.</p>
    <h2>Cách bắt đầu</h2>
    <ol>
      <li>Xem danh sách sách còn trống.</li>
      <li>Hỏi người phụ trách trước khi lấy sách.</li>
      <li>Ghi lại thời điểm trả đã thống nhất.</li>
    </ol>
  </main>
</body>
</html>
```

## Tự làm trước khi xem lời giải

Đổi trang thành hướng dẫn sử dụng một tài nguyên lớp học do bạn chọn. Viết một lời giới thiệu và ba bước. Thêm mục h2 giải thích người đọc có thể hỏi ai khi cần giúp.

## Kiểm tra kết quả

Tab trình duyệt có title riêng; trang có một h1 và các bước đánh số. Lưu, tải lại và kiểm tra câu mới đã xuất hiện.

Ghi hành động bạn thử, kết quả mong muốn và kết quả thực tế. Nếu khác nhau, lưu lại ví dụ nhỏ nhất còn gây lỗi để tìm nguyên nhân.

## Gợi ý và lời giải có giải thích

Đặt h2 và một p bên trong main sau ol. Nội dung giúp người đọc biết hành động tiếp theo; không cần JavaScript. Ví dụ: `<h2>Khi cần giúp</h2><p>Hỏi người phụ trách tủ sách của lớp.</p>`

Một lời giải tham khảo hoàn chỉnh nằm trong [web-foundations.html](/downloads/projects/web-foundations.html). Mở để xem kết quả hoặc lưu file rồi đọc bằng trình soạn thảo. Chỉ đối chiếu sau khi tự làm; câu chữ và thiết kế của bạn có thể khác mà vẫn đáp ứng yêu cầu.

## Tự đánh giá

Bạn có thể giải thích vai trò của phần mới thêm mà không đọc lại hướng dẫn không? Đổi một nội dung rồi kiểm tra lại. Bài hoàn thành khi bạn hiểu thay đổi, không chỉ khi ảnh chụp giống ví dụ.
