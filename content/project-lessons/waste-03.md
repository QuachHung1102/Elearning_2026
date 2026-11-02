## Từ số tổng đến một báo cáo có giới hạn

[Tải food-waste.py](/downloads/projects/food-waste.py) và [food-waste.csv](/downloads/projects/food-waste.csv) vào **cùng một thư mục**. Chạy `python food-waste.py` hoặc `py food-waste.py`.

Với file gốc, chương trình in 200g, 150g và 230g theo ba ngày; tổng 580g; trung bình khoảng 193,3g cho mỗi ngày có ghi dữ liệu. Đây không phải trung bình cho mỗi học sinh hay mỗi suất ăn.

### Viết hai câu khác nhau

**Quan sát có dữ liệu:** “Trong ba ngày mẫu, Wednesday có khối lượng ghi nhận lớn nhất: 230g.”

**Giả thuyết cần kiểm tra:** “Có thể số suất ăn hoặc khẩu phần ngày đó khác.” Không được đổi câu này thành kết luận “mọi người không thích món ăn hôm đó”. Mình chưa có bằng chứng.

### Tự làm

1. Thêm ngày Thursday với 40g cơm và 60g rau. Tổng phải là 680g trên 4 ngày; trung bình 170g.
2. Thử một file chỉ có tiêu đề. Chương trình cần thông báo không có số đo hợp lệ, không chia cho 0.
3. Đổi tên cột `grams` thành `weight`. Chương trình phải giải thích thiếu tiêu đề, không đưa ra một báo cáo rỗng như thể đã thành công.

### Một cải tiến có ích

Đề xuất thêm cột `meals` để tính gram trên mỗi suất ăn, rồi giải thích cách tránh đếm lặp số suất khi một ngày có nhiều dòng. Viết quy tắc dữ liệu trước khi viết code.

Bạn đã có một chương trình đọc CSV, xử lý đầu vào và tạo báo cáo nhỏ. Nếu muốn thu số liệu thật, hãy thống nhất cách đo với người phụ trách, không dùng số liệu mẫu làm bằng chứng tác động.

<!-- expanded-lesson -->
## Học sâu hơn: mục tiêu và cách làm

**Mục tiêu:** Tạo biểu đồ đơn giản và kết luận đúng giới hạn của mẫu. **Thời gian thực hành dự kiến:** 40–55 phút. Bạn có thể dừng giữa các phần; bài học này hoàn thành được bằng chữ và code, không phụ thuộc video.

Một biểu đồ cần đơn vị và tỉ lệ rõ. Ta có thể in thanh bằng ký tự #, mỗi ký tự đại diện 10 gram, kèm số chính xác bên cạnh. Độ dài thanh là số nguyên nên có thể làm tròn xuống; con số kèm theo giúp tránh hiểu thanh là phép đo chính xác tới từng gram.

Trung bình trong ví dụ là tổng chia số ngày có ít nhất một quan sát hợp lệ. Nó không phải trung bình trên sáu dòng, không phải trên mỗi suất ăn và không tự tính các ngày thiếu là 0. Nếu không còn ngày hợp lệ, chương trình thông báo thay vì chia cho 0.

Từ một bảng nhỏ, hãy viết riêng ba phần: quan sát, giới hạn và câu hỏi tiếp theo. “Wednesday có tổng lớn nhất trong mẫu” là quan sát. “Món ăn kém nên bị bỏ nhiều” là suy đoán cần dữ liệu khác. Không biến số liệu học tập thành bằng chứng về một trường thật.

Nếu muốn thu dữ liệu riêng, thống nhất đơn vị, thời điểm đo, phạm vi và người phụ trách. Cùng một ngày có nhiều dòng loại thức ăn nên cột số suất, nếu bổ sung, không được cộng lặp trên từng dòng một cách tùy tiện.

## Bài thực hành có hướng dẫn

Sau khi có totals hợp lệ, in biểu đồ chữ và viết một quan sát, một giới hạn, một câu hỏi. Sau đó thử thêm Thursday 40g và 60g trên bản sao.

Hãy làm trước khi đọc phần đối chiếu. Ghi đầu vào và kết quả mong đợi; chỉ thay một điều mỗi lần để dễ hiểu tác động.

## Lời giải đối chiếu và lý do

```python
for day, grams in totals.items():
    bar = "#" * int(grams / 10)
    print(f"{day}: {bar} ({grams:g} g)")
print("Moi # bieu dien 10 g; thanh duoc lam tron xuong.")
```

Đặt đoạn này trong main của file hoàn chỉnh sau kiểm tra totals không rỗng. Mẫu gốc cho thanh dài 20, 15 và 23 ký tự. Bản thêm Thursday cho tổng 680 trên 4 ngày, trung bình 170g. Câu kết luận mẫu: “Wednesday cao nhất trong ba ngày mẫu. Chưa biết số suất ăn nên chưa so sánh theo mỗi suất. Cần thu thêm số suất theo ngày bằng một quy tắc nhất quán.”

## Điều kiện hoàn thành

Nộp Python, CSV mẫu hoặc dữ liệu có nguồn rõ, kết quả chạy và ba câu báo cáo. Thử file chỉ có tiêu đề và file sai tên cột. Nếu dùng dữ liệu mẫu, giữ nhãn dữ liệu dựng để học trong sản phẩm cuối.

Nếu chưa đạt, chỉ ra bước nhỏ nhất chưa hoạt động, kiểm tra dữ liệu đầu vào và đọc thông báo lỗi. Một bài hoàn thành gồm kết quả chạy được và lời giải thích của bạn, không chỉ bản code giống ví dụ.
