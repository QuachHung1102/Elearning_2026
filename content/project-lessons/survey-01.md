# Chuẩn bị dữ liệu và kiểm tra đầu vào

## Sau bài này

Bạn tạo được dữ liệu mẫu và hàm đọc có kiểm tra lỗi cho **Python: Từ khảo sát đến quyết định của lớp**. Dành khoảng 30–45 phút gồm thời gian tự nhập và chạy.

## Hiểu điều mình đang lưu

Một dòng là một phiếu khảo sát ẩn danh. answer_id là mã giả duy nhất, choice là một trong ba hoạt động library/sport/art, year là khối 6–9. Không thu tên, email hoặc số điện thoại trong bài tập.

Tạo thư mục mới cho dự án và hai tệp `project.py`, `data.csv`. Không đặt tên script là `csv.py`, vì tên đó trùng thư viện chuẩn. Các tệp dùng UTF-8; hàm đọc chấp nhận cả UTF-8 có BOM thường gặp khi xuất từ bảng tính.

## Dữ liệu để làm theo

Dán nguyên khối sau vào `data.csv`:

```csv
answer_id,choice,year
R01,library,6
R02,sport,6
R03,library,7
```

Thứ tự cột có ý nghĩa: chương trình sẽ từ chối tiêu đề khác để bạn sửa nguồn thay vì âm thầm đọc sai trường. Chỉ dùng mã giả trong bài tập.

## Viết phần đọc dữ liệu

Thêm đoạn sau vào `project.py`:

```python
import csv
import math
from datetime import date, datetime
from html import escape
from pathlib import Path

FIELDS = 'answer_id,choice,year'.split(',')

def load_rows(path):
    rows, errors, seen = [], [], set()
    with open(path, encoding='utf-8-sig', newline='') as handle:
        reader = csv.DictReader(handle)
        if reader.fieldnames != FIELDS:
            raise ValueError('Sai tiêu đề cột: ' + ','.join(FIELDS))
        for line, raw in enumerate(reader, start=2):
            try:
                if None in raw or any(v is None for v in raw.values()):
                    raise ValueError('Sai số cột')
                row = {k: v.strip() for k,v in raw.items()}
                row['year'] = int(row['year'])
                if not row['answer_id'] or row['choice'] not in {'library', 'sport', 'art'} or not 6 <= row['year'] <= 9:
                    raise ValueError('Câu trả lời không thuộc lựa chọn cho phép')
                identity = row['answer_id']
                if identity in seen: raise ValueError('Trùng mã hoặc bản ghi')
                seen.add(identity)
                rows.append(row)
            except (ValueError, TypeError) as error:
                errors.append(f'Dòng {line}: {error}')
    return rows, errors
```

`DictReader` biến từng dòng thành dictionary. `strip()` bỏ khoảng trắng ở rìa, không tự đổi nội dung ở giữa. Một dòng chỉ được đưa vào kết quả sau khi kiểm tra thành công. `seen` giúp phát hiện trùng trước khi tính tổng. Danh sách `errors` ghi số dòng để bạn tìm lại nguồn; không xóa lỗi rồi giả vờ dữ liệu đã đầy đủ.

## Chạy và quan sát

Mở Python ở thư mục dự án, chạy `from project import load_rows`, rồi `rows, errors = load_rows('data.csv')`. In `len(rows)` và `errors`: dữ liệu mẫu cho **3** dòng hợp lệ, danh sách lỗi rỗng. Nếu thấy lỗi tệp không tồn tại, kiểm tra thư mục làm việc trước khi sửa code.

## Thử sai có chủ đích

Nhập choice là unknown; kiểm tra phiếu lỗi không lọt vào tổng. Lưu một bản dữ liệu gốc để có thể quay lại. Đổi tên một cột rồi chạy lại: lỗi tiêu đề là lỗi cả tệp, khác với một dòng dữ liệu không hợp lệ.

## Tự kiểm tra

Giải thích được vì sao không nên chỉ bỏ mọi dòng lỗi mà không báo. Với dữ liệu mẫu, chương trình đọc đúng 3 dòng. Với một dòng trùng thêm ở cuối, kết quả vẫn 3 dòng và có một thông báo trùng. Gợi ý đáp án: bản ghi trùng không phải quan sát mới, nên nếu đếm lại sẽ làm sai báo cáo.
