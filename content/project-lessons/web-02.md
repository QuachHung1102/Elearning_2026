## Liên kết và hình ảnh có mục đích

**Mục tiêu:** liên kết và hình ảnh có mục đích bằng một trang hướng dẫn tủ sách. **Thời gian thực hành dự kiến:** 30–45 phút. Dùng file index.html từ bài trước. Giữ một bản sao trước khi sửa. Đây là bài học bằng chữ, không cần chờ video.

## Giải thích và làm từng bước

Bài này thêm cách di chuyển giữa các mục. Thuộc tính id gắn tên duy nhất cho một phần của trang. Liên kết `href="#steps"` đi tới phần có `id="steps"` trong cùng tài liệu. Nếu hai giá trị không khớp, người đọc không đến đúng phần. Dùng chữ mô tả đích đến, chẳng hạn “Các bước mượn sách”, thay cho nhiều liên kết chỉ ghi “Bấm đây”.

Ảnh cần giúp hiểu nội dung, không chỉ lấp khoảng trống. Thuộc tính src chỉ nơi file ảnh nằm; đường dẫn tương đối được tính từ vị trí tài liệu. Nếu index.html nằm cạnh thư mục images, ảnh có thể dùng `images/shelf.jpg`. Hãy dùng ảnh bạn có quyền sử dụng; bài mẫu bên dưới không cần ảnh để chạy.

Với ảnh có thông tin, alt mô tả điều người đọc cần biết nếu không nhìn được ảnh. Với ảnh chỉ trang trí, alt rỗng tránh đọc thông tin thừa. Một sơ đồ có chữ không nên dùng mô tả chung “hình ảnh”; hãy giữ phần giải thích quan trọng bằng văn bản trong trang.

Điều hướng nằm trong nav để diễn đạt đây là nhóm liên kết. Dùng bàn phím Tab đến từng liên kết rồi Enter để kích hoạt. Giữ đường viền focus mặc định nếu chưa có kiểu thay thế rõ ràng. Không cần mở mọi liên kết trong tab mới.

## Ví dụ để chạy

Tạo file index.html với toàn bộ nội dung sau.

```html
<!doctype html>
<html lang="vi">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Hướng dẫn tủ sách</title></head>
<body><main>
  <h1>Tủ sách lớp mình</h1>
  <nav aria-label="Trong trang"><a href="#steps">Các bước mượn</a> · <a href="#help">Khi cần giúp</a></nav>
  <h2 id="steps">Các bước mượn</h2>
  <ol><li>Tìm sách còn trống.</li><li>Hỏi người phụ trách.</li><li>Ghi lại ngày trả.</li></ol>
  <h2 id="help">Khi cần giúp</h2>
  <p>Hỏi người phụ trách nếu chưa biết cuốn sách có thể được mượn không.</p>
</main></body></html>
```

## Tự làm trước khi xem lời giải

Thêm mục quy định với id="rules" và một liên kết điều hướng đến nó. Nếu có ảnh phù hợp, thêm ảnh với src và alt; nếu chưa có, hoàn thành bài bằng chữ và liên kết trước.

## Kiểm tra kết quả

Các liên kết tới đúng mục; mỗi id chỉ dùng một lần. Dùng được Tab và Enter. Nếu dùng ảnh, thử đổi sai đường dẫn rồi quan sát alt, sau đó sửa lại.

Ghi hành động bạn thử, kết quả mong muốn và kết quả thực tế. Nếu khác nhau, lưu lại ví dụ nhỏ nhất còn gây lỗi để tìm nguyên nhân.

## Gợi ý và lời giải có giải thích

Liên kết là `<a href="#rules">Quy định</a>` và đích là `<h2 id="rules">Quy định</h2>`. Dấu # chỉ nằm trong href, không nằm trong giá trị id.

Một lời giải tham khảo hoàn chỉnh nằm trong [web-foundations.html](/downloads/projects/web-foundations.html). Mở để xem kết quả hoặc lưu file rồi đọc bằng trình soạn thảo. Chỉ đối chiếu sau khi tự làm; câu chữ và thiết kế của bạn có thể khác mà vẫn đáp ứng yêu cầu.

## Tự đánh giá

Bạn có thể giải thích vai trò của phần mới thêm mà không đọc lại hướng dẫn không? Đổi một nội dung rồi kiểm tra lại. Bài hoàn thành khi bạn hiểu thay đổi, không chỉ khi ảnh chụp giống ví dụ.
