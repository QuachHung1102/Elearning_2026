books = [
    {"id": 1, "title": "De Men Phieu Luu Ky", "borrowed": False},
    {"id": 2, "title": "The Little Prince", "borrowed": True},
]
for book in books:
    if book["borrowed"]:
        status = "dang muon"
    else:
        status = "con trong"
    print(book["id"], book["title"], status)
