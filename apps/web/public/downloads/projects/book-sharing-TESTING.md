# Book-sharing checks / Kiểm thử tủ sách

Use a fresh extracted copy for the starting state. IDs 1 and 3 are available; 2 is borrowed. Carry out rows 1–7 in order. / Dùng bản giải nén mới; mã 1 và 3 đang còn, mã 2 đang mượn. Thực hiện dòng 1–7 theo thứ tự.

| # | Action / Thao tác | Expected / Mong đợi |
| --- | --- | --- |
| 1 | `f`, then an empty keyword / từ khóa trống | Lists IDs 1 and 3; excludes 2 / Có mã 1, 3; không có 2 |
| 2 | `f`, then `  DE MEN  ` | Finds ID 1 despite spaces and case / Tìm thấy mã 1 dù khác khoảng trắng và chữ hoa |
| 3 | `b`, then `1` | `Saved.`; creates or updates `books.json` / Lưu trạng thái mượn |
| 4 | `f`, then `de men` | No available match / Không còn sách trống phù hợp |
| 5 | `b`, then `1` again / lặp lại | Rejects unchanged state / Không báo đã mượn thành công lần nữa |
| 6 | `q`, restart, then `f` + `de men` / thoát, mở lại, tìm | Loan persists; no available match / Trạng thái mượn vẫn được giữ |
| 7 | `r` + `1`, then `f` + `de men` | Saves return; ID 1 appears again / Lưu trả sách; mã 1 xuất hiện lại |
| 8 | `b`, then `abc` | Whole-number reminder; menu continues / Nhắc nhập số nguyên, không bị văng |
| 9 | `b`, then `99` | Unknown-ID response, no successful save / Mã không tồn tại, không báo lưu thành công |
| 10 | `f`, then `a-title-that-is-not-here` | No match, no crash / Không có kết quả, chương trình vẫn chạy |

## Damaged-data checks / Thử dữ liệu hỏng

Only in a copied test folder, while the program is closed:

1. Copy a known-good `books.json` somewhere safe.
2. Replace the test file with invalid JSON, then run the program. It should report `Could not read books.json` and stop without overwriting that file.
3. Restore the copy. Give two records the same integer ID, then run again. Loading should be rejected.
4. Restore the valid copy before continuing.

Chỉ thử trên một thư mục đã sao chép, khi chương trình đã đóng: sao lưu JSON đúng, thử làm hỏng cú pháp hoặc đặt hai mã trùng, kiểm tra chương trình từ chối đọc và không tự ghi đè, rồi khôi phục bản đúng.

## Record results / Ghi kết quả

For each check, record starting data, the exact input, observed output and pass/fail. If a check fails, reproduce it before changing code; rerun the earlier checks after a fix. / Ghi dữ liệu ban đầu, thao tác cụ thể, kết quả quan sát và đạt/chưa đạt. Tái hiện lỗi trước khi sửa; chạy lại các tình huống cũ sau khi sửa.

The program stores loan state only. Returning a book changes `borrowed`; there is no borrower-name field to erase. / Chương trình chỉ lưu trạng thái. Trả sách đổi `borrowed`; không có trường tên người mượn để xóa.
