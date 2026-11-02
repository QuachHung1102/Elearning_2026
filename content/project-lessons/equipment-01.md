# Chuẩn bị dữ liệu và kiểm tra đầu vào

## Sau bài này

Bạn tạo được dữ liệu mẫu và hàm đọc có kiểm tra lỗi cho **Python: Trạm mượn thiết bị cho trường**. Dành khoảng 30–45 phút gồm thời gian tự nhập và chạy.

## Hiểu điều mình đang lưu

Mỗi thiết bị có một asset_id duy nhất. state chỉ nhận available, loan hoặc maintenance. borrower là mã giả, không phải tên thật. due chỉ cần cho thiết bị đang mượn. Một lượt quá hạn vẫn thuộc nhóm loan, không phải thiết bị thứ tư.

Tạo thư mục mới cho dự án và hai tệp `project.py`, `data.csv`. Không đặt tên script là `csv.py`, vì tên đó trùng thư viện chuẩn. Các tệp dùng UTF-8; hàm đọc chấp nhận cả UTF-8 có BOM thường gặp khi xuất từ bảng tính.

## Dữ liệu để làm theo

Dán nguyên khối sau vào `data.csv`:

```csv
asset_id,item,state,borrower,due
D01,Camera,available,,
D02,Microphone,loan,P01,2026-10-01
D03,Tripod,maintenance,,
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

FIELDS = 'asset_id,item,state,borrower,due'.split(',')

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
                if not row['asset_id'] or not row['item'] or row['state'] not in {'available','loan','maintenance'}:
                    raise ValueError('Mã hoặc trạng thái không hợp lệ')
                if row['state'] == 'loan':
                    if not row['borrower']: raise ValueError('Lượt mượn thiếu mã người mượn')
                    date.fromisoformat(row['due'])
                elif row['borrower'] or row['due']:
                    raise ValueError('Thiết bị không cho mượn phải để trống người mượn và hạn trả')
                identity = row['asset_id']
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

Chuyển D03 sang available và xóa dữ liệu mượn nếu có. Lưu một bản dữ liệu gốc để có thể quay lại. Đổi tên một cột rồi chạy lại: lỗi tiêu đề là lỗi cả tệp, khác với một dòng dữ liệu không hợp lệ.

## Tự kiểm tra

Giải thích được vì sao không nên chỉ bỏ mọi dòng lỗi mà không báo. Với dữ liệu mẫu, chương trình đọc đúng 3 dòng. Với một dòng trùng thêm ở cuối, kết quả vẫn 3 dòng và có một thông báo trùng. Gợi ý đáp án: bản ghi trùng không phải quan sát mới, nên nếu đếm lại sẽ làm sai báo cáo.
