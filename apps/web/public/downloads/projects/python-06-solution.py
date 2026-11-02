def find_titles(titles, keyword):
    matches = []
    for title in titles:
        if keyword.strip().casefold() in title.casefold():
            matches.append(title)
    return matches


titles = ["De Men Phieu Luu Ky", "The Little Prince", "Mat Biec"]
print(find_titles(titles, " DE MEN "))
print(find_titles(titles, "missing"))
