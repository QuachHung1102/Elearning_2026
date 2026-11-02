## Trang đọc được trên màn hình nhỏ

**Mục tiêu:** trang đọc được trên màn hình nhỏ bằng một trang hướng dẫn tủ sách. **Thời gian thực hành dự kiến:** 30–45 phút. Dùng file index.html từ bài trước. Giữ một bản sao trước khi sửa. Đây là bài học bằng chữ, không cần chờ video.

## Giải thích và làm từng bước

Một trang cần thích nghi với chiều rộng khác nhau. Metadata viewport trong head cho trình duyệt di động dùng chiều rộng thiết bị. Với main có max-width, nội dung có thể nhỏ lại thay vì giữ cứng một chiều rộng lớn. Tránh đặt width:900px lên vùng đọc chính.

Ảnh có thể tràn nếu kích thước tự nhiên lớn. Dùng max-width:100% và height:auto để ảnh không rộng hơn vùng chứa mà vẫn giữ tỉ lệ. Với đoạn văn bản dài không có khoảng trắng, overflow-wrap:anywhere cho phép xuống dòng khi cần. Đừng chữa tràn bằng cách thu tất cả chữ xuống rất nhỏ.

Media query chỉ thêm quy tắc khi điều kiện khớp. Ví dụ ở màn hình hẹp có thể giảm padding. Không phải mọi trang đều cần nhiều điểm ngắt; trước hết thử bố cục linh hoạt đơn giản.

Kiểm tra bằng việc thu cửa sổ, phóng to chữ và dùng bàn phím. Mô phỏng chiều rộng trên máy tính hữu ích nhưng chưa thay thế hoàn toàn thiết bị thật. Nếu chưa thử trên điện thoại, ghi đúng thiết bị đã thử thay vì đánh dấu hoàn tất mọi nền tảng.

Khi đưa trang cho người khác, hỏi họ thực hiện một nhiệm vụ cụ thể: tìm hướng dẫn hoặc giải thích bước đầu. Ghi quan sát và sửa một điểm; đừng chỉ hỏi trang có đẹp không. Một bản hoàn chỉnh có nội dung rõ, đường dẫn hoạt động và ghi chú về giới hạn.

## Ví dụ để chạy

Giữ HTML bài trước; chèn các quy tắc sau vào style trong head, không dán CSS trực tiếp vào body.

```css
/* Thêm vào cuối style đã có. */
img { max-width: 100%; height: auto; }
p, a, code { overflow-wrap: anywhere; }
@media (max-width: 480px) {
  main { padding: 24px 16px; }
}

```

## Tự làm trước khi xem lời giải

Hoàn thiện trang tủ sách. Kiểm tra ở cửa sổ hẹp khoảng 360px, rộng khoảng 1200px và zoom 200%. Thử Tab/Enter. Ghi một vấn đề đã sửa và lưu phiên bản cuối.

## Kiểm tra kết quả

Không phải kéo ngang để đọc đoạn văn; nội dung không bị cắt; liên kết vẫn đến đúng mục. Nộp index.html và ghi chú trước/sau một thay đổi.

Ghi hành động bạn thử, kết quả mong muốn và kết quả thực tế. Nếu khác nhau, lưu lại ví dụ nhỏ nhất còn gây lỗi để tìm nguyên nhân.

## Gợi ý và lời giải có giải thích

Nếu main có width cố định, đổi sang max-width và giữ padding. Nếu ảnh tràn, thêm quy tắc img. Đừng bỏ nội dung để làm kết quả kiểm tra có vẻ đạt.

Một lời giải tham khảo hoàn chỉnh nằm trong [web-foundations.html](/downloads/projects/web-foundations.html). Mở để xem kết quả hoặc lưu file rồi đọc bằng trình soạn thảo. Chỉ đối chiếu sau khi tự làm; câu chữ và thiết kế của bạn có thể khác mà vẫn đáp ứng yêu cầu.

## Tự đánh giá

Bạn có thể giải thích vai trò của phần mới thêm mà không đọc lại hướng dẫn không? Đổi một nội dung rồi kiểm tra lại. Bài hoàn thành khi bạn hiểu thay đổi, không chỉ khi ảnh chụp giống ví dụ.
