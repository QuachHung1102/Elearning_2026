## Cho nội dung một cấu trúc

Tạo file `guide.html` bằng trình soạn thảo văn bản. Dán đoạn dưới, lưu ở dạng UTF-8 rồi mở bằng trình duyệt:

```html
<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Trước khi mở một đường dẫn</title>
  <style>
    body { margin: 0; font: 18px/1.8 system-ui; background: #f3f1e8; color: #242520; }
    main { max-width: 680px; margin: auto; padding: 24px; }
    li { margin-block: 20px; }
  </style>
</head>
<body>
  <main>
    <h1>Trước khi mở một đường dẫn lạ</h1>
    <p>Hãy dừng một chút trước tin nhắn yêu cầu đăng nhập gấp.</p>
    <ol>
      <li>Đọc lại ngữ cảnh của tin nhắn.</li>
      <li>Tự mở ứng dụng hoặc địa chỉ chính thức bạn đã biết.</li>
      <li>Hỏi người đáng tin nếu còn nghi ngờ.</li>
    </ol>
  </main>
</body>
</html>
```

`h1` là tiêu đề chính. `ol` diễn đạt một danh sách có thứ tự; đừng gõ các số rồi dùng nhiều thẻ `div` thay nó. `lang="vi"` giúp công cụ đọc hiểu ngôn ngữ; `viewport` giúp trang dùng đúng chiều rộng điện thoại.

### Tự làm

Thay ba bước bằng bản nháp của bạn. Thêm `h2` cho mục “Thử một ví dụ”, một đoạn giải thích và thẻ `details`/`summary` để ẩn đáp án. Dùng địa chỉ mẫu không bấm được, không chèn liên kết lừa đảo thật.

### Tự kiểm tra

Tắt phần `style`: nội dung vẫn phải đúng thứ tự và hiểu được. CSS giúp trình bày; cấu trúc nội dung cần đứng vững trước.

<!-- expanded-lesson -->
## Học sâu hơn: mục tiêu và cách làm

**Mục tiêu:** Chuyển bản nháp thành HTML dễ đọc, có ví dụ và đáp án. **Thời gian thực hành dự kiến:** 40–55 phút. Bạn có thể dừng giữa các phần; bài học này hoàn thành được bằng chữ và code, không phụ thuộc video.

Bắt đầu bằng nội dung trước khi chọn màu. h1 đặt tên công việc; phần giới thiệu cho biết khi nào cần dùng; ol giữ các bước theo thứ tự. h2 chia mục ví dụ và giới hạn. Không dùng h2 chỉ vì muốn chữ to; ý nghĩa cấu trúc giúp cả người đọc lẫn công cụ hỗ trợ.

CSS trong style chỉ tác động trình bày. max-width giới hạn độ dài dòng, padding tạo khoảng trống, line-height tạo khoảng cách giữa dòng. Nếu nội dung vẫn đúng khi bỏ CSS, cấu trúc cơ bản của bạn đang tốt hơn một trang chỉ có các hộp trang trí.

details và summary cho một câu hỏi mở/đóng mà không cần JavaScript. summary phải diễn đạt câu hỏi thực sự, không chỉ ghi “xem thêm”. Đáp án nên giải thích lý do, không chỉ hiện chữ đúng hoặc sai. Người học có thể dự đoán trước khi mở.

Khi thêm ví dụ, phân biệt nội dung hướng dẫn thật và bài tập. Địa chỉ mẫu chỉ dùng làm dữ liệu đọc, đặt trong code; đừng biến thành nút truy cập. Nếu đổi sang một kỹ năng khác, kiểm tra các bước trên thiết bị mà bạn mô tả.

## Bài thực hành có hướng dẫn

Thêm một h2 cho ví dụ, một câu hỏi trong summary và câu trả lời có lý do. Thêm một liên kết nội bộ từ đầu trang tới mục ví dụ.

Hãy làm trước khi đọc phần đối chiếu. Ghi đầu vào và kết quả mong đợi; chỉ thay một điều mỗi lần để dễ hiểu tác động.

## Lời giải đối chiếu và lý do

```html
<a href="#example">Thử một ví dụ</a>
<h2 id="example">Một tin nhắn yêu cầu làm ngay</h2>
<details>
  <summary>Có nên nhập mật khẩu theo đường dẫn vừa nhận không?</summary>
  <p>Hãy tự mở ứng dụng hoặc địa chỉ chính thức đã biết để kiểm tra trước. Cảm giác khẩn cấp trong tin nhắn không xác nhận người gửi là đáng tin.</p>
</details>
```

href có # còn id không có. details có thể đóng/mở bằng bàn phím. Đây là một ví dụ về cách tổ chức câu hỏi, không phải một bài kiểm tra tự động ghi điểm.

## Điều kiện hoàn thành

Lưu file, mở bằng trình duyệt và dùng Tab/Enter để đến câu hỏi. Tạm bỏ CSS: tiêu đề, bước và đáp án vẫn theo thứ tự có nghĩa. Nộp file HTML có nội dung của riêng bạn.

Nếu chưa đạt, chỉ ra bước nhỏ nhất chưa hoạt động, kiểm tra dữ liệu đầu vào và đọc thông báo lỗi. Một bài hoàn thành gồm kết quả chạy được và lời giải thích của bạn, không chỉ bản code giống ví dụ.
