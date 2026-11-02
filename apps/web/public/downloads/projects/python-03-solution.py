answer = input("Ham nao hien thi chu trong Python? ").strip().lower()
if answer == "print":
    print("Dung roi!")
elif answer == "":
    print("Ban chua nhap cau tra loi.")
else:
    print("Chua dung. Goi y: ham minh dung o bai 1.")
